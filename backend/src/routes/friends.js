const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');
const { createFriendRequestNotification } = require('../utils/notificationHelper');
const { addXP, checkFriendBadges } = require('../utils/userProgress');

// ─── Get accepted friends list with user details ───
// GET /api/friends/list
router.get('/list', protect, async (req, res) => {
  try {
    const friendIds = req.user.friends || [];
    if (friendIds.length === 0) {
      return res.json({ success: true, data: { friends: [] } });
    }

    const { data: friends, error } = await supabase
      .from('users')
      .select('id, username, display_name, avatar, bio, is_online, last_seen')
      .in('id', friendIds);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, data: { friends: friends || [] } });
  } catch (error) {
    console.error('Error fetching friends list:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Send friend request ───
// POST /api/friends/request/:userId
router.post('/request/:userId', protect, async (req, res) => {
  try {
    const senderId = req.user.id;
    const receiverId = req.params.userId;

    if (senderId === receiverId) {
      return res.status(400).json({ success: false, message: "You can't send a request to yourself" });
    }

    // Check receiver exists
    const { data: receiver, error: recErr } = await supabase
      .from('users')
      .select('id, friends')
      .eq('id', receiverId)
      .single();

    if (recErr || !receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if either user has blocked the other
    const { data: blockCheck1 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', senderId)
      .eq('blocked_id', receiverId)
      .single();

    const { data: blockCheck2 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', receiverId)
      .eq('blocked_id', senderId)
      .single();

    if (blockCheck1 || blockCheck2) {
      return res.status(400).json({ success: false, message: 'Cannot send friend request to a blocked user' });
    }

    // Already friends?
    const myFriends = req.user.friends || [];
    if (myFriends.includes(receiverId)) {
      return res.status(400).json({ success: false, message: 'Already friends' });
    }

    // Check if a request already exists in either direction
    const { data: existing } = await supabase
      .from('friend_requests')
      .select('id, status, sender_id, receiver_id')
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .in('status', ['pending', 'accepted']);

    if (existing && existing.length > 0) {
      const req0 = existing[0];
      if (req0.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'Already friends' });
      }
      // If the OTHER person already sent us a request, auto-accept
      if (req0.sender_id === receiverId && req0.receiver_id === senderId) {
        // Accept it
        await supabase
          .from('friend_requests')
          .update({ status: 'accepted' })
          .eq('id', req0.id);

        // Add to both friend lists
        const theirFriends = receiver.friends || [];
        await supabase.from('users').update({ friends: [...myFriends, receiverId] }).eq('id', senderId);
        await supabase.from('users').update({ friends: [...theirFriends, senderId] }).eq('id', receiverId);

        // Notify via socket
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${receiverId}`).emit('friend:accepted', { userId: senderId });
          io.to(`user:${senderId}`).emit('friend:accepted', { userId: receiverId });
        }

        // Award XP and check badges
        await addXP(senderId, 10);
        await addXP(receiverId, 10);
        await checkFriendBadges(senderId, [...myFriends, receiverId]);
        await checkFriendBadges(receiverId, [...theirFriends, senderId]);

        return res.json({ success: true, data: { status: 'accepted', message: 'You are now friends!' } });
      }
      // Already sent
      return res.status(400).json({ success: false, message: 'Friend request already sent' });
    }

    // Create new request
    const { data: newReq, error: insertErr } = await supabase
      .from('friend_requests')
      .insert({ sender_id: senderId, receiver_id: receiverId })
      .select()
      .single();

    if (insertErr) {
      return res.status(500).json({ success: false, message: insertErr.message });
    }

    // Send notification to receiver
    await createFriendRequestNotification(receiverId, req.user);

    // Notify receiver via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${receiverId}`).emit('friend:request', {
        id: newReq.id,
        senderId,
        senderUsername: req.user.username,
        senderAvatar: req.user.avatar,
      });
    }

    res.status(201).json({ success: true, data: { request: newReq } });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Accept friend request ───
// PUT /api/friends/accept/:requestId
router.put('/accept/:requestId', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: fr, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('id', req.params.requestId)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .single();

    if (error || !fr) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Update status
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', fr.id);

    // Add to both friend lists
    const { data: sender } = await supabase.from('users').select('friends').eq('id', fr.sender_id).single();
    const myFriends = req.user.friends || [];
    const theirFriends = sender?.friends || [];

    await supabase.from('users').update({ friends: [...myFriends, fr.sender_id] }).eq('id', userId);
    await supabase.from('users').update({ friends: [...theirFriends, userId] }).eq('id', fr.sender_id);

    // Notify sender via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${fr.sender_id}`).emit('friend:accepted', {
        userId,
        username: req.user.username,
        avatar: req.user.avatar,
      });
    }

    // Award XP and check badges
    await addXP(userId, 10);
    await addXP(fr.sender_id, 10);
    await checkFriendBadges(userId, [...myFriends, fr.sender_id]);
    await checkFriendBadges(fr.sender_id, [...theirFriends, userId]);

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Reject friend request ───
// PUT /api/friends/reject/:requestId
router.put('/reject/:requestId', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: fr, error } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('id', req.params.requestId)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .single();

    if (error || !fr) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', fr.id);

    res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Cancel a sent request ───
// DELETE /api/friends/cancel/:userId
router.delete('/cancel/:userId', protect, async (req, res) => {
  try {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('sender_id', req.user.id)
      .eq('receiver_id', req.params.userId)
      .eq('status', 'pending');

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, message: 'Request cancelled' });
  } catch (error) {
    console.error('Error cancelling request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Get pending requests I received ───
// GET /api/friends/pending
router.get('/pending', protect, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, status, created_at')
      .eq('receiver_id', req.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Enrich with sender info
    const senderIds = requests.map((r) => r.sender_id);
    let senders = [];
    if (senderIds.length > 0) {
      const { data } = await supabase
        .from('users')
        .select('id, username, avatar, display_name, bio, is_online')
        .in('id', senderIds);
      senders = data || [];
    }

    const enriched = requests.map((r) => ({
      ...r,
      sender: senders.find((u) => u.id === r.sender_id) || null,
    }));

    res.json({ success: true, data: { requests: enriched } });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Get requests I sent (so UI can show "Requested") ───
// GET /api/friends/sent
router.get('/sent', protect, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('id, receiver_id, status, created_at')
      .eq('sender_id', req.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, data: { requests: requests || [] } });
  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
