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

// @route   GET /api/posts/
router.get('/', protect, async (req, res) => {
  try {
    const { serverId, category, limit = 20, skip = 0 } = req.query;

    let query = supabase
      .from('posts')
      .select(`
        *,
        author:users(id, username, avatar, display_name),
        server:servers(id, name, icon),
        post_likes(user_id),
        post_views(count)
      `, { count: 'exact' })
      .or('is_public.eq.true,is_public.is.null')
      .eq('post_likes.user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(parseInt(skip), parseInt(skip) + parseInt(limit) - 1);

    if (serverId) query = query.eq('server_id', serverId);
    if (category) query = query.eq('category', category);

    const { data: posts, error, count: total } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const enriched = (posts || []).map(p => {
      // post_views(count) returns an array with a single object containing the count
      const viewCount = p.post_views && p.post_views.length > 0 ? p.post_views[0].count : 0;
      // post_likes is already filtered to only contain the current user's like if it exists
      const likedByMe = p.post_likes && p.post_likes.length > 0;
      
      // Remove the raw nested arrays to match original response shape
      delete p.post_likes;
      delete p.post_views;

      return {
        ...p,
        author: p.author || null,
        server: p.server || null,
        liked_by_me: likedByMe,
        viewCount: viewCount
      };
    });

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
      .select(`
        *,
        author:users(id, username, avatar, display_name),
        server:servers(id, name, icon),
        post_likes(user_id),
        post_views(count)
      `, { count: 'exact' })
      .eq('author_id', userId)
      .eq('post_likes.user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(parseInt(skip), parseInt(skip) + parseInt(limit) - 1);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const enriched = (posts || []).map(p => {
      const viewCount = p.post_views && p.post_views.length > 0 ? p.post_views[0].count : 0;
      const likedByMe = p.post_likes && p.post_likes.length > 0;

      // Remove the raw nested arrays to match original response shape
      delete p.post_likes;
      delete p.post_views;

      return {
        ...p,
        author: p.author || null,
        server: p.server || null,
        liked_by_me: likedByMe,
        viewCount: viewCount
      };
    });

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
    // Get post data including privacy controls and relations
    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:users(id, username, avatar, display_name, friends),
        server:servers(id, name, icon),
        post_likes(user_id),
        post_views(count)
      `)
      .eq('id', req.params.id)
      .eq('post_likes.user_id', req.user.id)
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
      // Check if user is following the post author using the joined data
      const authorFriends = post.author?.friends || [];
      if (!authorFriends.includes(req.user.id)) {
        return res.status(403).json({ success: false, message: 'This post is only visible to followers' });
      }
    }

    // Remove friends from author object to avoid leaking private data
    if (post.author) {
      delete post.author.friends;
    }

    // Process likes and views
    const viewCount = post.post_views && post.post_views.length > 0 ? post.post_views[0].count : 0;
    const likedByMe = post.post_likes && post.post_likes.length > 0;

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

    // Remove the raw nested arrays to match original response shape
    delete post.post_likes;
    delete post.post_views;

    // Add privacy and comment info to the response
    const enrichedPost = {
      ...post,
      author: post.author || null,
      server: post.server || null,
      liked_by_me: likedByMe,
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
      .select(`
        *,
        author:users(id, username, avatar)
      `)
      .eq('post_id', req.params.id)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Ensure author object is present even if null for some reason
    const enriched = (comments || []).map(c => ({
      ...c,
      author: c.author || null
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
