const express = require('express');
const { body } = require('express-validator');
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Helper: get or create conversation between two users
async function getOrCreateConversation(userA, userB) {
  // Enforce ordering so the UNIQUE constraint works
  const p1 = userA < userB ? userA : userB;
  const p2 = userA < userB ? userB : userA;

  // Try to find existing
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('participant_1', p1)
    .eq('participant_2', p2)
    .single();

  if (existing) return existing;

  // Create new
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ participant_1: p1, participant_2: p2 })
    .select()
    .single();

  if (error) throw error;
  return created;
}

// @route   GET /api/dm/conversations
// @desc    Get all conversations for the current user
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get conversations where user is either participant
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Get the "other" participant's info for each convo
    const otherIds = (conversations || []).map(c =>
      c.participant_1 === userId ? c.participant_2 : c.participant_1
    );

    const { data: otherUsers } = await supabase
      .from('users')
      .select('id, username, avatar, display_name, is_online, last_seen')
      .in('id', otherIds.length ? otherIds : ['00000000-0000-0000-0000-000000000000']);

    const userMap = {};
    (otherUsers || []).forEach(u => { userMap[u.id] = u; });

    // Count unread per conversation
    const enriched = await Promise.all((conversations || []).map(async (c) => {
      const otherId = c.participant_1 === userId ? c.participant_2 : c.participant_1;

      const { count } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .eq('is_read', false)
        .neq('sender_id', userId);

      return {
        ...c,
        otherUser: userMap[otherId] || null,
        unreadCount: count || 0,
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/dm/total-unread
// @desc    Get total unread DM count across all conversations
router.get('/total-unread', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Count all unread messages sent to this user (not by them)
    const { count, error } = await supabase
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .neq('sender_id', userId)
      // Only messages in conversations the user is part of
      .in('conversation_id',
        await supabase
          .from('conversations')
          .select('id')
          .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
          .then(r => (r.data || []).map(c => c.id))
      );

    if (error) return res.status(500).json({ success: false, message: error.message });

    res.json({ success: true, data: { count: count || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/dm/conversations
// @desc    Start or get a conversation with another user
router.post('/conversations', protect, [
  body('userId').notEmpty().withMessage('User ID is required'),
  validate
], async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: "Can't message yourself" });
    }

    // Verify the other user exists
    const { data: otherUser } = await supabase
      .from('users')
      .select('id, username, avatar, display_name, is_online')
      .eq('id', userId)
      .single();

    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const conversation = await getOrCreateConversation(req.user.id, userId);

    res.json({
      success: true,
      data: { ...conversation, otherUser }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/dm/messages/:conversationId
// @desc    Get messages in a conversation
router.get('/messages/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;
    const userId = req.user.id;

    // Verify user is a participant
    const { data: convo } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!convo) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (convo.participant_1 !== userId && convo.participant_2 !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get messages
    let query = supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Get senders
    const senderIds = [...new Set((messages || []).map(m => m.sender_id))];
    const { data: senders } = await supabase
      .from('users')
      .select('id, username, avatar, display_name, is_online')
      .in('id', senderIds.length ? senderIds : ['00000000-0000-0000-0000-000000000000']);

    const senderMap = {};
    (senders || []).forEach(s => { senderMap[s.id] = s; });

    const enriched = (messages || []).map(m => ({
      ...m,
      sender: senderMap[m.sender_id] || null,
    }));

    res.json({ success: true, data: { messages: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/dm/messages
// @desc    Send a direct message
router.post('/messages', protect, [
  body('conversationId').notEmpty().withMessage('Conversation ID is required'),
  body('content').optional().trim(),
  body('repliedToId').optional().isUUID().withMessage('Invalid repliedToId format'),
  validate
], async (req, res) => {
  try {
    const { conversationId, content, image_url, repliedToId } = req.body;

    if (!content && !image_url) {
      return res.status(400).json({ success: false, message: 'Message content or image is required' });
    }
    const userId = req.user.id;

    // Verify user is participant
    const { data: convo } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (!convo) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (convo.participant_1 !== userId && convo.participant_2 !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if either user has blocked the other
    const otherUserId = convo.participant_1 === userId ? convo.participant_2 : convo.participant_1;
    const { data: blockCheck1 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', otherUserId)
      .single();

    const { data: blockCheck2 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', otherUserId)
      .eq('blocked_id', userId)
      .single();

    if (blockCheck1 || blockCheck2) {
      return res.status(403).json({ success: false, message: 'Messaging not allowed due to blocking' });
    }

    // Insert message
    const insertData = {
      conversation_id: conversationId,
      sender_id: userId,
      content: content || '',
    };
    // Add image_url if the column exists
    if (image_url) insertData.image_url = image_url;
    // Add reply functionality
    if (repliedToId) insertData.replied_to_id = repliedToId;

    const { data: message, error } = await supabase
      .from('direct_messages')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message_text: image_url ? '📷 Image' : (content || '').substring(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // Emit via socket
    const io = req.app.get('io');
    const otherId = convo.participant_1 === userId ? convo.participant_2 : convo.participant_1;

    const populatedMessage = {
      ...message,
      sender: {
        id: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar,
        is_online: true,
      },
    };

    io.to(`dm:${conversationId}`).emit('dm:new', populatedMessage);
    // Also notify the other user if they haven't joined the room
    io.to(`user:${otherId}`).emit('dm:notification', {
      conversationId,
      message: populatedMessage,
    });

    res.json({ success: true, data: { message: populatedMessage } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/dm/messages/:conversationId/read
// @desc    Mark all messages in a conversation as read
router.put('/messages/:conversationId/read', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify participant
    const { data: convo } = await supabase
      .from('conversations')
      .select('participant_1, participant_2')
      .eq('id', conversationId)
      .single();

    if (!convo || (convo.participant_1 !== userId && convo.participant_2 !== userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Mark all messages from the other person as read
    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/dm/messages/:messageId
// @desc    Edit a direct message
router.put('/messages/:messageId', protect, [
  body('content').trim().notEmpty().withMessage('Content is required for editing'),
  validate
], async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Get the message
    const { data: message, error: msgError } = await supabase
      .from('direct_messages')
      .select('id, sender_id, conversation_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Update the message
    const { error: updateError } = await supabase
      .from('direct_messages')
      .update({
        content,
        is_edited: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      return res.status(500).json({ success: false, message: updateError.message });
    }

    // Get updated message
    const { data: updatedMessage, error: fetchError } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (fetchError) {
      return res.status(500).json({ success: false, message: fetchError.message });
    }

    res.json({ success: true, data: { message: updatedMessage } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/dm/messages/:messageId
// @desc    Delete a direct message
router.delete('/messages/:messageId', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Get the message and conversation
    const { data: message, error: msgError } = await supabase
      .from('direct_messages')
      .select('id, sender_id, conversation_id, is_read')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if message has been read by the other user
    if (message.is_read) {
      return res.status(400).json({ success: false, message: 'Cannot delete message that has been read by recipient' });
    }

    // Soft delete the message
    const { error: updateError } = await supabase
      .from('direct_messages')
      .update({
        is_deleted: true,
        content: 'This message was deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      return res.status(500).json({ success: false, message: updateError.message });
    }

    // Notify both DM participants so they can remove the message
    const io = req.app.get('io');
    if (io) {
      // Fetch conversation to know which room to target
      const { data: convo } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', message.conversation_id)
        .single();

      if (convo) {
        io.to(`dm:${convo.id}`).emit('dm:deleted', {
          messageId,
          conversationId: convo.id,
        });
      }
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/dm/messages/:messageId/reactions
// @desc    Add a reaction to a direct message
router.post('/messages/:messageId/reactions', protect, [
  body('emoji').notEmpty().withMessage('Emoji is required'),
  validate
], async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // Get the message
    const { data: message, error: msgError } = await supabase
      .from('direct_messages')
      .select('id, reactions, conversation_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Verify user is a participant of the conversation
    const { data: convo } = await supabase
      .from('conversations')
      .select('participant_1, participant_2')
      .eq('id', message.conversation_id)
      .single();

    if (!convo || (convo.participant_1 !== userId && convo.participant_2 !== userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Update reactions (stored as a simple array of unique emojis for now)
    const currentReactions = Array.isArray(message.reactions) ? message.reactions : [];
    const newReactions = [...new Set([...currentReactions, emoji])];

    const { error: updateError } = await supabase
      .from('direct_messages')
      .update({ reactions: newReactions })
      .eq('id', messageId);

    if (updateError) {
      return res.status(500).json({ success: false, message: updateError.message });
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(`dm:${message.conversation_id}`).emit('dm:reaction', {
      messageId,
      reactions: newReactions
    });

    res.json({ success: true, reactions: newReactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
