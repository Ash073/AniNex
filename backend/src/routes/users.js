const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');

// POST /api/users/push-token
router.post('/push-token', protect, async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token required' });
  }
  const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
  res.json({ success: true });
});

// @route   GET /api/users/search
// @desc    Search users by username or display_name
router.get('/search', protect, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, data: { users: [] } });
    }

    const term = q.trim().toLowerCase();

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, avatar, bio, display_name, is_online, genres, interests, favorite_anime, servers, friends, xp, level, streak, badges')
      .neq('id', req.user.id)
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .limit(parseInt(limit));

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, data: { users: users || [] } });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, avatar, bio, display_name, favorite_anime, genres, interests, experience_level, servers, friends, onboarding_completed, profile_completed, is_online, last_seen, created_at, gender, mobile, age, date_of_birth, settings, xp, level, streak, badges')
      .eq('id', req.params.id)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/friends
// @desc    Get a user's friends list
router.get('/:id/friends', async (req, res) => {
  try {
    const userId = req.params.id;

    const { data: user, error } = await supabase
      .from('users')
      .select('friends')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.friends || user.friends.length === 0) {
      return res.json({ success: true, data: { friends: [] } });
    }

    // Get friend details
    const { data: friends, error: friendsError } = await supabase
      .from('users')
      .select('id, username, avatar, display_name, is_online')
      .in('id', user.friends);

    if (friendsError) {
      console.error('Error fetching friends:', friendsError);
      return res.status(500).json({ success: false, message: friendsError.message });
    }

    res.json({ success: true, data: { friends: friends || [] } });
  } catch (error) {
    console.error('Error fetching user friends:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/:id/servers
// @desc    Get servers a user is a member of
router.get('/:id/servers', async (req, res) => {
  try {
    const userId = req.params.id;

    const { data: memberships, error: memError } = await supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', userId);

    if (memError) {
      return res.status(500).json({ success: false, message: memError.message });
    }

    if (!memberships || memberships.length === 0) {
      return res.json({ success: true, data: { servers: [] } });
    }

    const serverIds = memberships.map(m => m.server_id);
    const { data: servers, error: srvError } = await supabase
      .from('servers')
      .select('id, name, icon, member_count')
      .in('id', serverIds);

    if (srvError) {
      return res.status(500).json({ success: false, message: srvError.message });
    }

    res.json({ success: true, data: { servers: servers || [] } });
  } catch (error) {
    console.error('Error fetching user servers:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/users/status
// @desc    Update online/offline status
router.put('/status', protect, async (req, res) => {
  try {
    const { isOnline } = req.body;
    const updates = {
      is_online: !!isOnline,
      last_seen: new Date().toISOString(),
    };

    await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id);

    // Broadcast via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('user:status', {
        userId: req.user.id,
        isOnline: !!isOnline,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const {
      username, bio, avatar, displayName,
      gender, mobile, age, dateOfBirth,
      favoriteAnime, genres, interests, experienceLevel,
      settings,
    } = req.body;
    const updates = {};

    if (username) updates.username = username;
    if (bio !== undefined) updates.bio = bio;
    if (avatar) updates.avatar = avatar;
    if (displayName !== undefined) updates.display_name = displayName;
    if (gender !== undefined) updates.gender = gender;
    if (mobile !== undefined) updates.mobile = mobile;
    if (age !== undefined) updates.age = age;
    if (dateOfBirth !== undefined) updates.date_of_birth = dateOfBirth;
    if (favoriteAnime !== undefined) updates.favorite_anime = favoriteAnime;
    if (genres !== undefined) updates.genres = genres;
    if (interests !== undefined) updates.interests = interests;
    if (experienceLevel !== undefined) updates.experience_level = experienceLevel;
    if (settings !== undefined) updates.settings = settings;

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Remove password before sending
    if (user) delete user.password;

    res.json({ success: true, data: { user } });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/users/friends/:userId
router.post('/friends/:userId', protect, async (req, res) => {
  try {
    const friendId = req.params.userId;
    const userId = req.user.id;

    // Check friend exists
    const { data: friend, error: friendErr } = await supabase
      .from('users')
      .select('id, friends')
      .eq('id', friendId)
      .single();

    if (friendErr || !friend) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get current user's friends
    const { data: currentUser } = await supabase
      .from('users')
      .select('friends')
      .eq('id', userId)
      .single();

    const myFriends = currentUser.friends || [];
    if (myFriends.includes(friendId)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    // Add to both friend lists
    await supabase
      .from('users')
      .update({ friends: [...myFriends, friendId] })
      .eq('id', userId);

    const theirFriends = friend.friends || [];
    await supabase
      .from('users')
      .update({ friends: [...theirFriends, userId] })
      .eq('id', friendId);

    res.json({ message: 'Friend added successfully' });
  } catch (error) {
    console.error('Error adding friend:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/friends/:userId
router.delete('/friends/:userId', protect, async (req, res) => {
  try {
    const friendId = req.params.userId;
    const userId = req.user.id;

    const { data: currentUser } = await supabase
      .from('users')
      .select('friends')
      .eq('id', userId)
      .single();

    const { data: friend } = await supabase
      .from('users')
      .select('friends')
      .eq('id', friendId)
      .single();

    if (!friend) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from both
    const myFriends = (currentUser.friends || []).filter(id => id !== friendId);
    const theirFriends = (friend.friends || []).filter(id => id !== userId);

    await supabase.from('users').update({ friends: myFriends }).eq('id', userId);
    await supabase.from('users').update({ friends: theirFriends }).eq('id', friendId);

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
