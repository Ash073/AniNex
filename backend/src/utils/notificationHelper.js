const { supabase } = require('../config/supabase');
const { sendExpoPush } = require('./expoPush');

const channelMap = {
  dm: 'default',
  server_message: 'default',
  mention: 'default',
  friend_request: 'default',
  friend_online: 'default',
  post_like: 'default',
  post_comment: 'default',
  server_added: 'default',
  anime_fact: 'default',
  default: 'default'
};

/**
 * Core function: create a notification in the DB, emit via socket, and send Expo push.
 *
 * Flow:
 *   1. Insert into `notifications` table
 *   2. Emit `notification:new` via Socket.IO (for in-app real-time toast)
 *   3. Send Expo push notification (for tray / background / killed state)
 *
 * The client-side dedup system (markNotificationShown + wasRecentlyShown)
 * ensures users don't see double notifications when both socket + push arrive.
 */
async function createNotification(userId, type, title, body, data = {}) {
  try {
    if (!userId || !type || !title || !body) {
      console.warn('[Notify] Missing params:', { userId, type, title, body });
      return null;
    }

    const channelId = channelMap[type] || channelMap['default'];
    const finalData = { ...(data || {}), type };

    // ── 1. Verify user exists ──
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, push_token')
      .eq('id', userId)
      .single();

    if (userError || !userRow) {
      console.warn('[Notify] User not found:', userId);
      return null;
    }

    // ── 2. Insert notification into DB ──
    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        data: finalData,
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Notify] DB insert error:', insertError.message);
      return null;
    }

    // Add the notification ID to data for client-side dedup
    finalData.notificationId = notification.id;

    // ── 3. Emit socket event (real-time, for foreground in-app toast) ──
    const io = global.io;
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', {
        id: notification.id,
        type,
        title,
        body,
        data: finalData,
        created_at: notification.created_at
      });
    }

    // ── 4. Send Expo push (for tray / background / killed) ──
    if (userRow.push_token) {
      try {
        const pushResult = await sendExpoPush(
          userRow.push_token,
          title,
          body,
          finalData,
          channelId
        );

        if (pushResult?.data?.[0]?.status === 'error') {
          console.error(`[Notify] Push failed for ${userId}:`,
            pushResult.data[0].message || pushResult.data[0].details?.error);
        }
      } catch (pushErr) {
        console.error('[Notify] Push exception:', pushErr.message);
      }
    } else {
      console.log(`[Notify] No push token for user ${userId}, socket-only`);
    }

    return notification;
  } catch (error) {
    console.error('[Notify] createNotification error:', error.message);
    return null;
  }
}

// Delete notification by ID
async function deleteNotification(notificationId, userId) {
  try {
    // Verify notification belongs to user
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      console.warn('Notification not found for deletion:', notificationId);
      return { success: false, message: 'Notification not found' };
    }

    if (notification.user_id !== userId) {
      console.warn('Unauthorized notification deletion attempt:', { notificationId, userId });
      return { success: false, message: 'Unauthorized' };
    }

    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (deleteError) {
      console.error('Error deleting notification:', deleteError);
      return { success: false, message: 'Failed to delete notification' };
    }

    return { success: true, message: 'Notification deleted successfully' };
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    return { success: false, message: 'Server error' };
  }
}

// Delete all notifications for a user
async function deleteAllNotifications(userId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting all notifications:', error);
      return { success: false, message: 'Failed to delete notifications' };
    }

    return { success: true, message: 'All notifications deleted' };
  } catch (error) {
    console.error('Error in deleteAllNotifications:', error);
    return { success: false, message: 'Server error' };
  }
}

// Get notification retention policy (delete notifications older than 30 days)
async function cleanupOldNotifications() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const { error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      console.error('Error cleaning up old notifications:', error);
      return { success: false, message: 'Cleanup failed' };
    }

    console.log('Successfully cleaned up old notifications');
    return { success: true, message: 'Cleanup completed' };
  } catch (error) {
    console.error('Error in cleanupOldNotifications:', error);
    return { success: false, message: 'Server error' };
  }
}

// Create friend request notification
async function createFriendRequestNotification(receiverId, sender) {
  // Validate input
  if (!receiverId || !sender || !sender.username) {
    console.warn('Invalid friend request notification data:', { receiverId, sender });
    return null;
  }

  return createNotification(
    receiverId,
    'friend_request',
    'New Friend Request',
    `${sender.username} wants to be your friend`,
    {
      sender_id: sender.id,
      sender_username: sender.username,
      sender_avatar: sender.avatar || null
    }
  );
}

// Create post like notification
async function createPostLikeNotification(postAuthorId, liker, post) {
  // Validate input
  if (!postAuthorId || !liker || !liker.username || !post) {
    console.warn('Invalid post like notification data:', { postAuthorId, liker, post });
    return null;
  }

  // Don't notify if user likes their own post
  if (postAuthorId === liker.id) return null;

  return createNotification(
    postAuthorId,
    'post_like',
    'Post Liked',
    `${liker.username} liked your post`,
    {
      liker_id: liker.id,
      liker_username: liker.username,
      post_id: post.id,
      post_title: post.title || 'Untitled Post',
      post_content: post.content ? post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '') : ''
    }
  );
}

// Create post comment notification
async function createPostCommentNotification(postAuthorId, commenter, post, comment) {
  // Validate input
  if (!postAuthorId || !commenter || !commenter.username || !post || !comment) {
    console.warn('Invalid post comment notification data:', { postAuthorId, commenter, post, comment });
    return null;
  }

  // Don't notify if user comments on their own post
  if (postAuthorId === commenter.id) return null;

  return createNotification(
    postAuthorId,
    'post_comment',
    'New Comment',
    `${commenter.username} commented on your post`,
    {
      commenter_id: commenter.id,
      commenter_username: commenter.username,
      post_id: post.id,
      post_title: post.title || 'Untitled Post',
      comment_content: comment.content ? comment.content.substring(0, 50) + (comment.content.length > 50 ? '...' : '') : ''
    }
  );
}

// Create server invitation notification
async function createServerInviteNotification(userId, inviter, server) {
  // Validate input
  if (!userId || !inviter || !inviter.username || !server) {
    console.warn('Invalid server invite notification data:', { userId, inviter, server });
    return null;
  }

  return createNotification(
    userId,
    'server_added',
    'Server Invitation',
    `${inviter.username} invited you to join ${server.name || 'a server'}`,
    {
      server_id: server.id,
      server_name: server.name || 'Unnamed Server',
      server_icon: server.icon || null,
      inviter_id: inviter.id,
      inviter_username: inviter.username
    }
  );
}

// Create new message notification
async function createNewMessageNotification(userId, sender, message, targetId, type = 'dm', extra = {}) {
  // Validate input
  if (!userId || !sender || !message) {
    console.warn('Invalid message notification data:', { userId, sender, message });
    return null;
  }

  // Type: 'dm' or 'server_message'
  const title = type === 'dm' ? `Message from ${sender.username}` : `New message in ${extra.channelName || 'channel'}`;

  return createNotification(
    userId,
    type,
    title,
    message.content ? message.content.substring(0, 100) : 'Sent an attachment',
    {
      senderId: sender.id,
      senderName: sender.display_name || sender.username,
      senderAvatar: sender.avatar || null,
      type,
      ...(type === 'dm' ? { conversationId: targetId } : { channelId: targetId, channelName: extra.channelName, serverName: extra.serverName })
    }
  );
}

// Create friend online notification
async function createFriendOnlineNotification(userId, friend) {
  // Validate input
  if (!userId || !friend || !friend.username) {
    return null;
  }

  return createNotification(
    userId,
    'friend_online',
    'Friend Online',
    `${friend.username} is now online! 🎌`,
    {
      friend_id: friend.id,
      friend_username: friend.username,
      friend_avatar: friend.avatar || null
    }
  );
}

// Create daily anime fact notification
async function createDailyFactNotification(userId, fact) {
  if (!userId || !fact) return null;

  return createNotification(
    userId,
    'anime_fact',
    'Daily Anime Fact 🏮',
    fact,
    {
      fact
    }
  );
}

module.exports = {
  createNotification,
  deleteNotification,
  deleteAllNotifications,
  cleanupOldNotifications,
  createFriendRequestNotification,
  createPostLikeNotification,
  createPostCommentNotification,
  createServerInviteNotification,
  createNewMessageNotification,
  createFriendOnlineNotification,
  createDailyFactNotification
};