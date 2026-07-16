/**
 * notificationHelper.js
 *
 * BACKWARD-COMPATIBLE wrapper that delegates everything to the new
 * notificationController + notificationService.
 *
 * Existing route files continue to work without changing imports.
 * NEW code should import from controllers/notificationController directly.
 */

const controller = require('../controllers/notificationController');
const { sendNotification } = require('../services/notificationService');
const { supabase } = require('../config/supabase');

// ─── Direct mapping to controller functions ──────────────────
const createFriendRequestNotification = controller.notifyFriendRequest;
const createFriendOnlineNotification = controller.notifyFriendOnline;
const createPostLikeNotification = controller.notifyPostLike;
const createPostCommentNotification = controller.notifyPostComment;
const createServerInviteNotification = controller.notifyServerInvite;
const createDailyFactNotification = controller.notifyDailyFact;

/**
 * Generic createNotification — maps to sendNotification.
 */
async function createNotification(userId, type, title, body, data = {}) {
  return sendNotification({ userId, type, title, body: String(body), data });
}

/**
 * createNewMessageNotification — routes to the correct controller function.
 */
async function createNewMessageNotification(userId, sender, message, targetId, type = 'dm', extra = {}) {
  if (type === 'dm') {
    return controller.notifyDMMessage(userId, sender, message, targetId);
  }
  if (type === 'mention') {
    return controller.notifyMention(userId, sender, message.content, targetId, 'channel', extra);
  }
  return controller.notifyChannelMessage(userId, sender, message, targetId, extra);
}

// ─── CRUD operations (unchanged) ────────────────────────────

async function deleteNotification(notificationId, userId) {
  try {
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) return { success: false, message: 'Notification not found' };
    if (notification.user_id !== userId) return { success: false, message: 'Unauthorized' };

    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (deleteError) return { success: false, message: 'Failed to delete notification' };
    return { success: true, message: 'Notification deleted successfully' };
  } catch (error) {
    return { success: false, message: 'Server error' };
  }
}

async function deleteAllNotifications(userId) {
  try {
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
    if (error) return { success: false, message: 'Failed to delete notifications' };
    return { success: true, message: 'All notifications deleted' };
  } catch (error) {
    return { success: false, message: 'Server error' };
  }
}

async function cleanupOldNotifications() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoffDate.toISOString());
    if (error) return { success: false, message: 'Cleanup failed' };
    return { success: true, message: 'Cleanup completed' };
  } catch (error) {
    return { success: false, message: 'Server error' };
  }
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
  createDailyFactNotification,
};
