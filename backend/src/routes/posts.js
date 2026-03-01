const express = require('express');
const { body } = require('express-validator');
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createPostLikeNotification, createPostCommentNotification } = require('../utils/notificationHelper');
const { addXP } = require('../utils/userProgress');

const router = express.Router();

// @route   GET /api/posts/feed
router.get('/feed', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const feed = await getPersonalizedFeed(req.user.id, limit);
    res.json({ success: true, data: { posts: feed } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/post
router.get('/', protect, async (req, res) => {
  try {
    const { serverId, category, limit = 20, skip = 0 } = req.query;

    let query = supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .or('is_public.eq.true,is_public.is.null')
      .order('created_at', { ascending: false })
      .range(parseInt(skip), parseInt(skip) + parseInt(limit) - 1);

    if (serverId) query = query.eq('server_id', serverId);
    if (category) query = query.eq('category', category);

    const { data: posts, error, count: total } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Get author + server info
    const authorIds = [...new Set((posts || []).map(p => p.author_id))];
    const serverIds = [...new Set((posts || []).filter(p => p.server_id).map(p => p.server_id))];

    const [{ data: authors }, { data: servers }] = await Promise.all([
      supabase.from('users').select('id, username, avatar').in('id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']),
      serverIds.length
        ? supabase.from('servers').select('id, name, icon').in('id', serverIds)
        : { data: [] }
    ]);

    const authorMap = {};
    (authors || []).forEach(a => { authorMap[a.id] = a; });
    const serverMap = {};
    (servers || []).forEach(s => { serverMap[s.id] = s; });

    // Check which posts the current user has liked
    const postIds = (posts || []).map(p => p.id);
    const { data: userLikes } = postIds.length
      ? await supabase.from('post_likes').select('post_id').eq('user_id', req.user.id).in('post_id', postIds)
      : { data: [] };
    const likedSet = new Set((userLikes || []).map(l => l.post_id));

    // Get view counts from Supabase for each post
    const viewCounts = {};
    try {
      // Get all view counts for the posts
      const postIds = (posts || []).map(p => p.id);
      if (postIds.length > 0) {
        const { data: viewData, error: viewError } = await supabase
          .from('post_views')
          .select('post_id, view_count')
          .in('post_id', postIds);

        if (viewError) {
          console.warn('Failed to fetch post view counts from Supabase:', viewError.message);
        } else {
          // Group view counts by post_id and sum them
          const viewMap = {};
          (viewData || []).forEach(view => {
            if (!viewMap[view.post_id]) {
              viewMap[view.post_id] = 0;
            }
            viewMap[view.post_id] += view.view_count;
          });

          // Assign to viewCounts object
          Object.keys(viewMap).forEach(postId => {
            viewCounts[postId] = viewMap[postId];
          });
        }
      }
    } catch (dbError) {
      console.warn('Failed to fetch post view counts:', dbError.message);
    }

    const enriched = (posts || []).map(p => ({
      ...p,
      author: authorMap[p.author_id] || null,
      server: p.server_id ? serverMap[p.server_id] || null : null,
      liked_by_me: likedSet.has(p.id),
      viewCount: viewCounts[p.id] || 0  // Add view count from Supabase
    }));

    res.json({
      success: true,
      data: {
        posts: enriched,
        pagination: {
          total: total || 0,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: (total || 0) > parseInt(skip) + (posts || []).length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/posts
router.post('/', protect, [
  body('content').trim().notEmpty().withMessage('Post content is required'),
  body('title').optional().trim(),
  body('category').optional().isIn(['discussion', 'review', 'recommendation', 'fan-art', 'meme', 'question', 'announcement']),
  body('serverId').optional(),
  body('visibility').optional().isIn(['public', 'followers', 'selected']),
  body('allowedUsers').optional().isArray(),
  body('commentsEnabled').optional().isBoolean(),
  body('mentions').optional().isArray(),
  validate
], async (req, res) => {
  try {
    const { content, title, category, serverId, tags, images, visibility, allowedUsers, commentsEnabled, mentions } = req.body;

    // Prepare post data
    const postData = {
      content,
      title: title || null,
      category: category || 'discussion',
      author_id: req.user.id,
      server_id: serverId || null,
      tags: tags || [],
      images: images || [],
      visibility: visibility || 'public',
      is_public: (visibility || 'public') === 'public',
      allowed_users: allowedUsers || [],
      comments_enabled: commentsEnabled !== false,
      mentions: mentions || [],
    };

    const { data: post, error } = await supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Award XP for creating a post (+20 XP)
    await addXP(req.user.id, 20);

    const enriched = {
      ...post,
      author: { id: req.user.id, username: req.user.username, avatar: req.user.avatar },
      server: null
    };

    // Send notifications to mentioned users
    if (mentions && mentions.length > 0) {
      try {
        const { createNotification } = require('../utils/notificationHelper');
        for (const mentionedUserId of mentions) {
          if (mentionedUserId !== req.user.id) {
            await createNotification(
              mentionedUserId,
              'mention',
              'You were mentioned in a post',
              `${req.user.username} mentioned you in their post${title ? `: "${title}"` : ''}`,
              {
                postId: post.id,
                authorId: req.user.id,
                authorUsername: req.user.username,
              }
            ).catch(() => { });
          }
        }
      } catch (notifErr) {
        // Notifications are best-effort
        console.warn('Failed to send mention notifications:', notifErr.message);
      }
    }

    res.status(201).json({ success: true, data: { post: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/posts/user/:userId
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const { data: posts, error, count: total } = await supabase
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(skip), parseInt(skip) + parseInt(limit) - 1);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Get author info
    const { data: author } = await supabase
      .from('users')
      .select('id, username, avatar, display_name')
      .eq('id', userId)
      .single();

    // Get server info
    const serverIds = [...new Set((posts || []).filter(p => p.server_id).map(p => p.server_id))];
    const { data: servers } = serverIds.length
      ? await supabase.from('servers').select('id, name, icon').in('id', serverIds)
      : { data: [] };

    const serverMap = {};
    (servers || []).forEach(s => { serverMap[s.id] = s; });

    // Check which posts the current user has liked
    const postIds = (posts || []).map(p => p.id);
    const { data: userLikes } = postIds.length
      ? await supabase.from('post_likes').select('post_id').eq('user_id', req.user.id).in('post_id', postIds)
      : { data: [] };
    const likedSet = new Set((userLikes || []).map(l => l.post_id));

    // Get view counts from Supabase for each post
    const viewCounts = {};
    try {
      // Get all view counts for the posts
      const postIds = (posts || []).map(p => p.id);
      if (postIds.length > 0) {
        const { data: viewData, error: viewError } = await supabase
          .from('post_views')
          .select('post_id, view_count')
          .in('post_id', postIds);

        if (viewError) {
          console.warn('Failed to fetch post view counts from Supabase:', viewError.message);
        } else {
          // Group view counts by post_id and sum them
          const viewMap = {};
          (viewData || []).forEach(view => {
            if (!viewMap[view.post_id]) {
              viewMap[view.post_id] = 0;
            }
            viewMap[view.post_id] += view.view_count;
          });

          // Assign to viewCounts object
          Object.keys(viewMap).forEach(postId => {
            viewCounts[postId] = viewMap[postId];
          });
        }
      }
    } catch (dbError) {
      console.warn('Failed to fetch post view counts:', dbError.message);
    }

    const enriched = (posts || []).map(p => ({
      ...p,
      author: author || null,
      server: p.server_id ? serverMap[p.server_id] || null : null,
      liked_by_me: likedSet.has(p.id),
      viewCount: viewCounts[p.id] || 0  // Add view count from Supabase
    }));

    res.json({
      success: true,
      data: {
        posts: enriched,
        pagination: {
          total: total || 0,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: (total || 0) > parseInt(skip) + (posts || []).length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/posts/:id
router.get('/:id', protect, async (req, res) => {
  try {
    // Get post data including privacy controls
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check privacy restrictions
    const { visibility, allowed_users } = post;

    if (visibility === 'selected' && (!allowed_users || !allowed_users.includes(req.user.id))) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this post' });
    }

    if (visibility === 'followers') {
      // Check if user is following the post author
      const { data: user } = await supabase
        .from('users')
        .select('friends')
        .eq('id', post.author_id)
        .single();

      if (user && user.friends && !user.friends.includes(req.user.id)) {
        return res.status(403).json({ success: false, message: 'This post is only visible to followers' });
      }
    }

    // Get author info
    const { data: author } = await supabase
      .from('users')
      .select('id, username, avatar, display_name')
      .eq('id', post.author_id)
      .single();

    // Get server info
    let server = null;
    if (post.server_id) {
      const { data: srv } = await supabase
        .from('servers')
        .select('id, name, icon')
        .eq('id', post.server_id)
        .single();
      server = srv;
    }

    // Check if current user liked this post
    const { data: myLike } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', req.user.id)
      .single();

    // Check if either user has blocked the other (for interactions like comments/likes)
    const { data: blockCheck1 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', req.user.id)
      .eq('blocked_id', post.author_id)
      .single();

    const { data: blockCheck2 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', post.author_id)
      .eq('blocked_id', req.user.id)
      .single();

    if (blockCheck1 || blockCheck2) {
      return res.status(403).json({ success: false, message: 'Interaction not allowed due to blocking' });
    }

    // Get view count for this post from Supabase
    let viewCount = 0;
    try {
      const { data: viewData, error: viewError } = await supabase
        .from('post_views')
        .select('view_count')
        .eq('post_id', post.id);

      if (!viewError && viewData) {
        // Sum all view counts for this post
        viewCount = viewData.reduce((sum, view) => sum + view.view_count, 0);
      }
    } catch (viewCountError) {
      console.warn('Failed to fetch post view count:', viewCountError.message);
    }

    // Add privacy and comment info to the response
    const enrichedPost = {
      ...post,
      author: author || null,
      server,
      liked_by_me: !!myLike,
      viewCount: viewCount,
      commentsEnabled: true
    };

    res.json({
      success: true,
      data: {
        post: enrichedPost
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/posts/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const postId = req.params.id;

    // Fetch the post first to verify ownership
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, author_id, images')
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.author_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only delete your own posts' });
    }

    // Delete associated images from Supabase Storage
    if (post.images && post.images.length > 0) {
      const filePaths = post.images
        .filter(url => typeof url === 'string' && url.includes('/chat-images/'))
        .map(url => {
          const parts = url.split('/chat-images/');
          return parts[parts.length - 1];
        })
        .filter(Boolean);

      if (filePaths.length > 0) {
        await supabase.storage.from('chat-images').remove(filePaths);
      }
    }

    // Delete likes for this post
    await supabase.from('post_likes').delete().eq('post_id', postId);

    // Delete comments for this post
    await supabase.from('comments').delete().eq('post_id', postId);

    // Delete the post
    const { error: deleteError } = await supabase.from('posts').delete().eq('id', postId);

    if (deleteError) {
      return res.status(500).json({ success: false, message: deleteError.message });
    }

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/posts/:id/like
router.post('/:id/like', protect, async (req, res) => {
  try {
    const postId = req.params.id;

    // Get post and author info
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, author_id, title, content')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if either user has blocked the other
    const { data: blockCheck1 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', req.user.id)
      .eq('blocked_id', post.author_id)
      .single();

    const { data: blockCheck2 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', post.author_id)
      .eq('blocked_id', req.user.id)
      .single();

    if (blockCheck1 || blockCheck2) {
      return res.status(403).json({ success: false, message: 'Interaction not allowed due to blocking' });
    }

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', req.user.id)
      .single();

    let liked;
    if (existingLike) {
      // Unlike
      await supabase.from('post_likes').delete().eq('id', existingLike.id);
      liked = false;
    } else {
      // Like
      await supabase.from('post_likes').insert({ post_id: postId, user_id: req.user.id });
      liked = true;

      // Award XP for liking a post (+2 XP)
      await addXP(req.user.id, 2);

      // Send notification to post author (if not self-like)
      if (post.author_id !== req.user.id) {
        await createPostLikeNotification(post.author_id, req.user, post);
      }
    }

    // Get accurate count
    const { count } = await supabase
      .from('post_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);

    await supabase.from('posts').update({ like_count: count || 0 }).eq('id', postId);

    res.json({ success: true, data: { liked, likeCount: count || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/posts/:id/comments
router.get('/:id/comments', protect, async (req, res) => {
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', req.params.id)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Get authors
    const authorIds = [...new Set((comments || []).map(c => c.author_id))];
    const { data: authors } = await supabase
      .from('users')
      .select('id, username, avatar')
      .in('id', authorIds.length ? authorIds : ['00000000-0000-0000-0000-000000000000']);

    const authorMap = {};
    (authors || []).forEach(a => { authorMap[a.id] = a; });

    const enriched = (comments || []).map(c => ({
      ...c,
      author: authorMap[c.author_id] || null
    }));

    res.json({ success: true, data: { comments: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/posts/:id/comments
router.post('/:id/comments', protect, [
  body('content').trim().notEmpty().withMessage('Comment content is required'),
  validate
], async (req, res) => {
  try {
    const { content, parentCommentId } = req.body;

    // Check post exists and get author info including comments enabled status
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, author_id, title, comment_count')
      .eq('id', req.params.id)
      .single();

    if (postError || !post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if comments are enabled for this post
    if (post.comments_enabled === false) {
      return res.status(403).json({ success: false, message: 'Comments are disabled for this post' });
    }

    // Check if either user has blocked the other
    const { data: blockCheck1 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', req.user.id)
      .eq('blocked_id', post.author_id)
      .single();

    const { data: blockCheck2 } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', post.author_id)
      .eq('blocked_id', req.user.id)
      .single();

    if (blockCheck1 || blockCheck2) {
      return res.status(403).json({ success: false, message: 'Interaction not allowed due to blocking' });
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        content,
        author_id: req.user.id,
        post_id: req.params.id,
        parent_comment_id: parentCommentId || null
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Award XP for commenting (+5 XP)
    await addXP(req.user.id, 5);

    // Update post comment count
    await supabase
      .from('posts')
      .update({ comment_count: (post.comment_count || 0) + 1 })
      .eq('id', req.params.id);

    // Send notification to post author (if not self-comment)
    if (post.author_id !== req.user.id) {
      await createPostCommentNotification(post.author_id, req.user, post, comment);
    }

    const enriched = {
      ...comment,
      author: { id: req.user.id, username: req.user.username, avatar: req.user.avatar }
    };

    res.status(201).json({ success: true, data: { comment: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/posts/:id/view
router.post('/:id/view', protect, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    // Get existing view count for this post and user
    const { data: existingView, error: viewError } = await supabase
      .from('post_views')
      .select('id, view_count')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (viewError && viewError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.warn('Error checking existing view:', viewError.message);
    }

    // If user hasn't viewed this post before, create a view record
    if (!existingView) {
      const { error: insertError } = await supabase
        .from('post_views')
        .insert({
          post_id: postId,
          user_id: userId,
          view_count: 1
        });

      if (insertError) {
        console.warn('Failed to insert view record:', insertError.message);
      }
    } else {
      // If user has viewed before, increment their view count
      const { error: updateError } = await supabase
        .from('post_views')
        .update({ view_count: existingView.view_count + 1 })
        .eq('id', existingView.id);

      if (updateError) {
        console.warn('Failed to update view count:', updateError.message);
      }
    }

    // Get total view count for the post
    const { data: totalViews, error: countError } = await supabase
      .from('post_views')
      .select('view_count')
      .eq('post_id', postId);

    if (countError) {
      console.warn('Failed to get total view count:', countError.message);
      return res.json({ success: true });
    }

    const totalViewCount = totalViews.reduce((sum, view) => sum + view.view_count, 0);

    res.json({
      success: true,
      data: {
        viewCount: totalViewCount,
        message: 'View counted successfully'
      }
    });
  } catch (error) {
    console.warn('Failed to track post view:', error.message);
    // Don't fail the request if view tracking fails
    res.json({ success: true });
  }
});

module.exports = router;
