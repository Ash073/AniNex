const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { supabase } = require('../config/supabase');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { validate } = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const { createFriendOnlineNotification } = require('../utils/notificationHelper');

const router = express.Router();

// Helper: strip password from user object
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

// @route   POST /api/auth/check-username
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.length < 3) {
      return res.json({ available: true });
    }
    const { data } = await supabase
      .from('users')
      .select('id')
      .ilike('username', username)
      .single();
    res.json({ available: !data });
  } catch (error) {
    res.json({ available: true });
  }
});

// @route   POST /api/auth/check-email
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.json({ available: true });
    }
    const { data } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .single();
    res.json({ available: !data });
  } catch (error) {
    res.json({ available: true });
  }
});

// @route   POST /api/auth/register
router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  validate
], async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user exists
    const { data: existingByEmail } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .single();

    if (existingByEmail) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const { data: existingByUsername } = await supabase
      .from('users')
      .select('id')
      .ilike('username', username)
      .single();

    if (existingByUsername) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        onboarding_completed: false,
        profile_completed: false
      })
      .select()
      .single();

    if (error) {
      console.error('Register error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user (include password for comparison)
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update online status and compute streak, XP, level, badges
    const now = new Date();
    const lastLogin = user.last_login ? new Date(user.last_login) : null;
    let streak = user.streak || 0;
    let xp = user.xp || 0;
    let badges = user.badges || [];

    if (lastLogin) {
      const diffDays = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak += 1;
      } else if (diffDays > 1) {
        streak = 1;
      }
    } else {
      streak = 1;
    }

    // Daily login reward (e.g., 10 XP)
    xp += 10;
    const level = Math.floor(xp / 100) + 1;

    // Badge milestones for streaks
    const badgeMap = { 5: '5-day streak', 10: '10-day streak', 30: '30-day streak' };
    if (badgeMap[streak] && !badges.includes(badgeMap[streak])) {
      badges.push(badgeMap[streak]);
    }

    // Ensure onboarding and profile flags are set
    const onboarding_completed = user.onboarding_completed ?? false;
    const profile_completed = user.profile_completed ?? false;

    await supabase
      .from('users')
      .update({
        is_online: true,
        last_seen: now.toISOString(),
        last_login: now.toISOString(),
        streak,
        xp,
        level,
        badges,
        onboarding_completed,
        profile_completed,
      })
      .eq('id', user.id);

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Fetch updated user
    const { data: updatedUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Notify friends that user is online (only if they were offline for at least 1 hour)
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const wasOfflineLongEnough = !user.last_seen || (now - new Date(user.last_seen)) > ONE_HOUR_MS;

    if (wasOfflineLongEnough && updatedUser.friends?.length > 0) {
      // Find friends who have a push token
      const { data: friendsToNotify } = await supabase
        .from('users')
        .select('id, push_token')
        .in('id', updatedUser.friends)
        .not('push_token', 'is', null);

      if (friendsToNotify?.length > 0) {
        for (const friend of friendsToNotify) {
          await createFriendOnlineNotification(friend.id, updatedUser);
        }
      }
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(updatedUser),
        token,
        refreshToken,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      data: { token: newToken, refreshToken: newRefreshToken }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/onboarding
router.post('/onboarding', protect, [
  body('favoriteAnime').isArray().withMessage('Favorite anime must be an array'),
  body('genres').isArray().withMessage('Genres must be an array'),
  body('interests').isArray().withMessage('Interests must be an array'),
  body('experienceLevel').isIn(['casual', 'moderate', 'hardcore']).withMessage('Invalid experience level'),
  validate
], async (req, res) => {
  try {
    const { favoriteAnime, genres, interests, experienceLevel } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .update({
        favorite_anime: favoriteAnime,
        genres: genres,
        interests: interests,
        experience_level: experienceLevel,
        onboarding_completed: true
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user }
  });
});

// @route   PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  try {
    // Map camelCase from frontend to snake_case for DB
    const fieldMap = {
      username: 'username',
      bio: 'bio',
      avatar: 'avatar',
      displayName: 'display_name',
      age: 'age',
      dateOfBirth: 'date_of_birth',
      mobile: 'mobile',
      gender: 'gender',
      profileCompleted: 'profile_completed'
    };

    const updates = {};
    for (const [frontendKey, dbKey] of Object.entries(fieldMap)) {
      if (req.body[frontendKey] !== undefined) {
        updates[dbKey] = req.body[frontendKey];
      }
    }

    // If username is being changed, check it's not taken
    if (updates.username) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .ilike('username', updates.username)
        .neq('id', req.user.id)
        .single();

      if (existing) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;

    if (!idToken && !accessToken) {
      return res.status(400).json({ success: false, message: 'Google token is required' });
    }

    // Verify the Google token by fetching user info from Google
    let googleUser;
    try {
      // Try with id_token first (from Google Sign-In)
      if (idToken) {
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
        if (!tokenInfoRes.ok) throw new Error('Invalid id_token');
        const tokenInfo = await tokenInfoRes.json();
        googleUser = {
          email: tokenInfo.email,
          name: tokenInfo.name || tokenInfo.email.split('@')[0],
          picture: tokenInfo.picture,
          sub: tokenInfo.sub,
        };
      } else {
        // Fallback: use access_token to get user info
        const userInfoRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userInfoRes.ok) throw new Error('Invalid access_token');
        googleUser = await userInfoRes.json();
        googleUser = {
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split('@')[0],
          picture: googleUser.picture,
          sub: googleUser.id,
        };
      }
    } catch (tokenErr) {
      console.error('Google token verification failed:', tokenErr);
      return res.status(401).json({ success: false, message: 'Invalid Google token' });
    }

    if (!googleUser?.email) {
      return res.status(400).json({ success: false, message: 'Could not get email from Google' });
    }

    // Check if user already exists with this email
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .ilike('email', googleUser.email)
      .single();

    let user;

    if (existingUser) {
      // Existing user — log them in
      user = existingUser;

      // Update online status
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    } else {
      // New user — create account
      // Generate a unique username from the Google name
      let baseUsername = (googleUser.name || 'user').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
      if (baseUsername.length < 3) baseUsername = 'user';
      let username = baseUsername;
      let suffix = 1;

      // Ensure uniqueness
      while (true) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .ilike('username', username)
          .single();
        if (!existing) break;
        username = `${baseUsername}${suffix}`;
        suffix++;
      }

      // Create with a random password (user signed in via Google, doesn't need one)
      const randomPassword = require('crypto').randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          username,
          email: googleUser.email.toLowerCase().trim(),
          password: hashedPassword,
          display_name: googleUser.name || username,
          avatar: googleUser.picture || '',
          onboarding_completed: false,
          profile_completed: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Google auth user creation error:', error);
        return res.status(500).json({ success: false, message: error.message });
      }

      user = newUser;
    }

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/facebook
router.post('/facebook', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Facebook access token is required' });
    }

    // Verify the Facebook token by fetching user info from Facebook Graph API
    let fbUser;
    try {
      const fbRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
      );
      if (!fbRes.ok) throw new Error('Invalid Facebook access token');
      const fbData = await fbRes.json();
      fbUser = {
        email: fbData.email,
        name: fbData.name || 'User',
        picture: fbData.picture?.data?.url || '',
        id: fbData.id,
      };
    } catch (tokenErr) {
      console.error('Facebook token verification failed:', tokenErr);
      return res.status(401).json({ success: false, message: 'Invalid Facebook token' });
    }

    if (!fbUser?.email) {
      return res.status(400).json({ success: false, message: 'Could not get email from Facebook. Make sure email permission is granted.' });
    }

    // Check if user already exists with this email
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .ilike('email', fbUser.email)
      .single();

    let user;

    if (existingUser) {
      // Existing user — log them in
      user = existingUser;
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    } else {
      // New user — create account
      let baseUsername = (fbUser.name || 'user').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
      if (baseUsername.length < 3) baseUsername = 'user';
      let username = baseUsername;
      let suffix = 1;

      while (true) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .ilike('username', username)
          .single();
        if (!existing) break;
        username = `${baseUsername}${suffix}`;
        suffix++;
      }

      const randomPassword = require('crypto').randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          username,
          email: fbUser.email.toLowerCase().trim(),
          password: hashedPassword,
          display_name: fbUser.name || username,
          avatar: fbUser.picture || '',
          onboarding_completed: false,
          profile_completed: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Facebook auth user creation error:', error);
        return res.status(500).json({ success: false, message: error.message });
      }

      user = newUser;
    }

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Facebook auth error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/logout
router.post('/logout', protect, async (req, res) => {
  try {
    await supabase
      .from('users')
      .update({ is_online: false, last_seen: new Date().toISOString() })
      .eq('id', req.user.id);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/auth/account
// @desc    Permanently delete account and all related data
router.delete('/account', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Remove user from friends lists of all their friends
    const { data: currentUser } = await supabase
      .from('users')
      .select('friends, servers')
      .eq('id', userId)
      .single();

    const myFriends = currentUser?.friends || [];
    for (const friendId of myFriends) {
      const { data: friend } = await supabase
        .from('users')
        .select('friends')
        .eq('id', friendId)
        .single();
      if (friend) {
        const updatedFriends = (friend.friends || []).filter(id => id !== userId);
        await supabase.from('users').update({ friends: updatedFriends }).eq('id', friendId);
      }
    }

    // 2. Delete friend requests (sent and received)
    await supabase.from('friend_requests').delete().eq('sender_id', userId);
    await supabase.from('friend_requests').delete().eq('receiver_id', userId);

    // 3. Leave all servers (except owned ones which we'll delete)
    await supabase.from('server_members').delete().eq('user_id', userId);

    // 4. Delete servers the user owns
    const { data: ownedServers } = await supabase
      .from('servers')
      .select('id')
      .eq('owner_id', userId);
    for (const srv of (ownedServers || [])) {
      await supabase.from('server_members').delete().eq('server_id', srv.id);
      await supabase.from('channels').delete().eq('server_id', srv.id);
      await supabase.from('join_requests').delete().eq('server_id', srv.id);
      await supabase.from('servers').delete().eq('id', srv.id);
    }

    // 5. Delete user's posts, likes, comments
    const { data: userPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('author_id', userId);
    for (const post of (userPosts || [])) {
      await supabase.from('post_likes').delete().eq('post_id', post.id);
      await supabase.from('comments').delete().eq('post_id', post.id);
    }
    await supabase.from('posts').delete().eq('author_id', userId);
    await supabase.from('post_likes').delete().eq('user_id', userId);
    await supabase.from('comments').delete().eq('author_id', userId);

    // 6. Delete DM messages and conversations
    await supabase.from('dm_messages').delete().eq('sender_id', userId);
    await supabase.from('dm_conversations').delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    // 7. Delete join requests by this user
    await supabase.from('join_requests').delete().eq('user_id', userId);

    // 8. Finally delete the user
    await supabase.from('users').delete().eq('id', userId);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
// @route   POST /api/auth/discord
router.post('/discord', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Discord access token is required' });
    }

    // Verify the Discord token by fetching user info from Discord API
    let discordUser;
    try {
      const userInfoRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoRes.ok) throw new Error('Invalid Discord access token');
      discordUser = await userInfoRes.json();
    } catch (tokenErr) {
      console.error('Discord token verification failed:', tokenErr);
      return res.status(401).json({ success: false, message: 'Invalid Discord token' });
    }

    if (!discordUser?.email) {
      return res.status(400).json({ success: false, message: 'Could not get email from Discord. Make sure email permission is granted.' });
    }

    // Check if user already exists with this email
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .ilike('email', discordUser.email)
      .single();

    let user;

    if (existingUser) {
      // Existing user — log them in
      user = existingUser;
      await supabase
        .from('users')
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    } else {
      // New user — create account
      let baseUsername = (discordUser.username || 'user').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 15);
      if (baseUsername.length < 3) baseUsername = 'user';
      let username = baseUsername;
      let suffix = 1;

      while (true) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .ilike('username', username)
          .single();
        if (!existing) break;
        username = `${baseUsername}${suffix}`;
        suffix++;
      }

      const randomPassword = require('crypto').randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 12);

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          username,
          email: discordUser.email.toLowerCase().trim(),
          password: hashedPassword,
          display_name: discordUser.username || username,
          avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : '',
          onboarding_completed: false,
          profile_completed: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Discord auth user creation error:', error);
        return res.status(500).json({ success: false, message: error.message });
      }

      user = newUser;
    }

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Discord auth error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
