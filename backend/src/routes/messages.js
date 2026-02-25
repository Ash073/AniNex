const express = require('express');
const { body } = require('express-validator');
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const { createNotification } = require('../utils/notificationHelper');
const router = express.Router();

// @route   GET /api/messages/channel/:channelId
router.get('/channel/:channelId', protect, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;

    // Get channel
    const { data: channel, error: chanErr } = await supabase
      .from('channels')
      .select('id, server_id')
      .eq('id', req.params.channelId)
      .single();

    if (chanErr || !channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    // Check membership
    const { data: membership } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', channel.server_id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get messages
    let query = supabase
      .from('messages')
      .select('*')
      .eq('channel_id', req.params.channelId)
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

    // Get author info
    const authorIds = [...new Set((messages || []).map(m => m.author_id))];
    const { data: authors } = await supabase
      .from('users')
      .select('id, username, avatar, is_online')
      .in('id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);

    const authorMap = {};
    (authors || []).forEach(a => { authorMap[a.id] = a; });

    const enriched = (messages || []).map(m => ({
      ...m,
      author: authorMap[m.author_id] || null
    }));

    res.json({ success: true, data: { messages: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/messages
router.post('/', protect, [
  body('content').trim().notEmpty().withMessage('Message content is required'),
  body('channelId').notEmpty().withMessage('Channel ID is required'),
  body('repliedToId').optional().isUUID().withMessage('Invalid repliedToId format'),
  validate
], async (req, res) => {
  try {
    const { content, channelId, repliedToId } = req.body;

    const { data: channel } = await supabase
      .from('channels')
      .select('id, server_id, message_count')
      .eq('id', channelId)
      .single();

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const { data: membership } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', channel.server_id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Parse mentions from content
    let processedContent = content;
    const mentions = [];

    // Extract @mentions from content
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      // Get user by username
      const { data: mentionedUser } = await supabase
        .from('users')
        .select('id, username, push_token')
        .eq('username', username)
        .single();

      if (mentionedUser && mentionedUser.id !== req.user.id) {
        mentions.push({
          user_id: mentionedUser.id,
          username: mentionedUser.username
        });
        // Replace @username with formatted mention for frontend
        processedContent = processedContent.replace(`@${username}`, `[@${username}](user:${mentionedUser.id})`);
        // Send notification to mentioned user
        await createNotification(
          mentionedUser.id,
          'mention',
          'You were mentioned',
          `${req.user.username} mentioned you in a message`,
          { channelId, by: req.user.username }
        );
      }
    }

    const insertData = {
      content: processedContent,
      author_id: req.user.id,
      channel_id: channelId,
      server_id: channel.server_id,
      ...(repliedToId && { replied_to_id: repliedToId })
    };

    const { data: message, error } = await supabase
      .from('messages')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Update channel stats
    await supabase.from('channels').update({
      message_count: (channel.message_count || 0) + 1,
      last_message_at: new Date().toISOString()
    }).eq('id', channelId);

    // Update server stats
    await supabase.rpc('increment_server_message_count', { sid: channel.server_id }).catch(() => {
      // Fallback: just ignore if rpc doesn't exist
    });

    // Notify all server members except sender
    const { data: members } = await supabase
      .from('server_members')
      .select('user_id')
      .eq('server_id', channel.server_id);
    if (members) {
      for (const m of members) {
        if (m.user_id !== req.user.id) {
          await createNotification(
            m.user_id,
            'server_message',
            'New Message',
            `${req.user.username} sent a new message in a server you are in`,
            { channelId, by: req.user.username }
          );
        }
      }
    }

    const enriched = {
      ...message,
      author: { id: req.user.id, username: req.user.username, avatar: req.user.avatar, is_online: true },
      mentions: mentions
    };

    res.status(201).json({ success: true, data: { message: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/messages/:messageId
// @desc    Edit a channel message
router.put('/:messageId', protect, [
  body('content').trim().notEmpty().withMessage('Content is required for editing'),
  validate
], async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Get the message
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('id, author_id, channel_id, server_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check if user is the author or has admin/moderator privileges
    if (message.author_id !== userId) {
      // Check if user is admin or moderator in the server
      const { data: membership } = await supabase
        .from('server_members')
        .select('role')
        .eq('server_id', message.server_id)
        .eq('user_id', userId)
        .single();

      if (!membership || !(membership.role === 'admin' || membership.role === 'moderator' || membership.role === 'owner')) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        content,
        is_edited: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      return res.status(500).json({ success: false, message: updateError.message });
    }

    // Get updated message with author info
    const { data: updatedMessage, error: fetchError } = await supabase
      .from('messages')
      .select(`
        *,
        users!inner (id, username, avatar, is_online)
      `)
      .eq('id', messageId)
      .single();

    if (fetchError) {
      return res.status(500).json({ success: false, message: fetchError.message });
    }

    const enriched = {
      ...updatedMessage,
      author: {
        id: updatedMessage.users.id,
        username: updatedMessage.users.username,
        avatar: updatedMessage.users.avatar,
        is_online: updatedMessage.users.is_online
      }
    };

    delete enriched.users;

    res.json({ success: true, data: { message: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete a channel message
router.delete('/:messageId', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Get the message
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('id, author_id, channel_id, server_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check if user is the author or has admin/moderator privileges
    if (message.author_id !== userId) {
      // Check if user is admin or moderator in the server
      const { data: membership } = await supabase
        .from('server_members')
        .select('role')
        .eq('server_id', message.server_id)
        .eq('user_id', userId)
        .single();

      if (!membership || !(membership.role === 'admin' || membership.role === 'moderator' || membership.role === 'owner')) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    // Soft delete the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        is_deleted: true,
        content: 'This message was deleted',
        attachments: [],
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      return res.status(500).json({ success: false, message: updateError.message });
    }

    // Notify all clients in this channel so they can remove the message
    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${message.channel_id}`).emit('message:deleted', {
        messageId,
        channelId: message.channel_id,
      });
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/messages/:messageId/reactions
// @desc    Add a reaction to a channel message
router.post('/:messageId/reactions', protect, [
  body('emoji').notEmpty().withMessage('Emoji is required'),
  validate
], async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // Get the message
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('id, reactions, channel_id, server_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check membership
    const { data: membership } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', message.server_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Update reactions
    const currentReactions = Array.isArray(message.reactions) ? message.reactions : [];
    const newReactions = [...new Set([...currentReactions, emoji])];

    const { error: updateError } = await supabase
      .from('messages')
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