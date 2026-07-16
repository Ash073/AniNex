const express = require('express');
const { protect } = require('../middleware/auth');
const { supabase } = require('../config/supabase');

const router = express.Router();

// Jaccard similarity between two arrays
const jaccardSimilarity = (arr1, arr2) => {
  if (!arr1.length || !arr2.length) return 0;
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const intersection = [...set1].filter(x => set2.has(x));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.length / union.size;
};

// @route   GET /api/recommendations/users
router.get('/users', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data: allUsers, error } = await supabase
      .from('users')
      .select('id, username, avatar, bio, display_name, is_online, genres, interests, favorite_anime, servers, friends')
      .neq('id', req.user.id)
      .eq('onboarding_completed', true);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const me = req.user;
    const myFriends = new Set(me.friends || []);

    // Filter out existing friends
    const nonFriendUsers = (allUsers || []).filter(u => !myFriends.has(u.id));

    const scored = nonFriendUsers.map(user => {
      let score = 0, weights = 0;

      if ((me.genres || []).length && (user.genres || []).length) {
        score += jaccardSimilarity(me.genres, user.genres) * 3;
        weights += 3;
      }
      if ((me.interests || []).length && (user.interests || []).length) {
        score += jaccardSimilarity(me.interests, user.interests) * 2;
        weights += 2;
      }
      if ((me.favorite_anime || []).length && (user.favorite_anime || []).length) {
        score += jaccardSimilarity(me.favorite_anime, user.favorite_anime) * 4;
        weights += 4;
      }

      return { user, score: weights === 0 ? 0 : score / weights };
    });

    const users = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit))
      .filter(item => item.score > 0)
      .map(item => item.user);

    // If not enough scored users, fill with random non-friend users
    if (users.length < parseInt(limit)) {
      const existingIds = new Set(users.map(u => u.id));
      const filler = nonFriendUsers
        .filter(u => !existingIds.has(u.id))
        .slice(0, parseInt(limit) - users.length);
      users.push(...filler);
    }

    res.json({ success: true, data: { users } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/recommendations/servers
router.get('/servers', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const userServerIds = req.user.servers || [];

    let query = supabase
      .from('servers')
      .select('*')
      .eq('is_public', true);

    if (userServerIds.length > 0) {
      // Exclude servers user is already in
      // Supabase doesn't have a direct "not in array" for UUID[], so we filter client-side
    }

    const { data: servers, error } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const me = req.user;
    const filtered = (servers || []).filter(s => !userServerIds.includes(s.id));

    // Calculate server activity scores (message count normalized)
    const serverActivityMap = {};
    filtered.forEach(server => {
      // Normalize message count to prevent domination by very active servers
      const normalizedActivity = Math.log(server.message_count + 1) / 10; // Log scale
      serverActivityMap[server.id] = normalizedActivity;
    });

    const scored = filtered.map(server => {
      let score = 0;
      let weights = 0;

      // === PRIORITY 1: ANIME PREFERENCE (Highest Weight) ===
      
      // Anime theme match (weight: 10) - Most important factor
      if (server.anime_theme && (me.favorite_anime || []).includes(server.anime_theme)) {
        score += 10;
        weights += 10;
      }

      // Tag overlap with user genres (weight: 7)
      if ((server.tags || []).length && (me.genres || []).length) {
        const similarity = jaccardSimilarity(server.tags, me.genres);
        score += similarity * 7;
        weights += 7;
      }

      // === PRIORITY 2: JOINED SERVERS (Medium Weight) ===
      
      // Bonus for servers in similar ecosystem (weight: 4)
      // This could be enhanced with more sophisticated server clustering
      if (userServerIds.length > 0) {
        score += 1; // Small ecosystem bonus
        weights += 4;
      }

      // === PRIORITY 3: ACTIVITY (Lowest Weight) ===
      
      // Server activity level (weight: 3)
      const activityScore = serverActivityMap[server.id] || 0;
      score += activityScore * 3;
      weights += 3;

      // New server bonus (weight: 1)
      const daysOld = (new Date() - new Date(server.created_at)) / (1000 * 60 * 60 * 24);
      if (daysOld < 30) {
        score += 1;
        weights += 1;
      }

      return { 
        server, 
        score: weights === 0 ? 0 : score / weights,
        details: {
          animeThemeMatch: server.anime_theme && (me.favorite_anime || []).includes(server.anime_theme),
          tagSimilarity: (server.tags || []).length && (me.genres || []).length ? 
            jaccardSimilarity(server.tags, me.genres) : 0,
          activityScore: activityScore,
          isNew: daysOld < 30
        }
      };
    });

    // Sort by score (descending) and apply threshold
    const result = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit))
      .filter(item => item.score > 0.1) // Minimum relevance threshold
      .map(item => ({
        ...item.server,
        recommendationScore: item.score,
        recommendationDetails: item.details
      }));

    res.json({ 
      success: true, 
      data: { 
        servers: result,
        rankingFactors: {
          priority1: "Anime Preference (anime theme match: 10pts, tag similarity: 7pts)",
          priority2: "Joined Servers (ecosystem bonus: 4pts)",
          priority3: "Activity (normalized activity: 3pts, new server bonus: 1pt)"
        }
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
