/**
 * notificationController.js
 *
 * High-level notification factory functions.
 * Translates business events into notification service calls.
 * Routes/socket handlers call THESE functions.
 *
 * Each function:
 *   - Validates business-level params (e.g., don't notify self)
 *   - Generates an idempotency key
 *   - Delegates to notificationService.sendNotification()
 */

const { sendNotification, sendBulkNotifications } = require('../services/notificationService');
const { generateIdempotencyKey } = require('../utils/pushValidator');

// ─── DM Message ───
async function notifyDMMessage(recipientId, sender, message, conversationId) {
  if (!recipientId || !sender?.id || !message) return null;
  if (recipientId === sender.id) return null;

  const messageId = message.id || `${conversationId}-${Date.now()}`;
  const idempotencyKey = generateIdempotencyKey(recipientId, 'dm', messageId);

  return sendNotification({
    userId: recipientId,
    type: 'dm',
    title: `Message from ${sender.username || 'Someone'}`,
    body: message.content
      ? message.content.substring(0, 100)
      : message.image_url
        ? '📷 Sent an image'
        : 'New message',
    data: {
      senderId: sender.id,
      senderName: sender.display_name || sender.username,
      senderAvatar: sender.avatar || null,
      conversationId,
    },
    idempotencyKey,
  });
}

// ─── Server Channel Message ───
async function notifyChannelMessage(recipientId, sender, message, channelId, extra = {}) {
  if (!recipientId || !sender?.id || !message) return null;
  if (recipientId === sender.id) return null;

  const messageId = message.id || `${channelId}-${Date.now()}`;
  const idempotencyKey = generateIdempotencyKey(recipientId, 'server_message', messageId);

  return sendNotification({
    userId: recipientId,
    type: 'server_message',
    title: `New message in ${extra.channelName || 'channel'}`,
    body: message.content
      ? message.content.substring(0, 100)
      : 'Sent an attachment',
    data: {
      senderId: sender.id,
      senderName: sender.display_name || sender.username,
      senderAvatar: sender.avatar || null,
      channelId,
      channelName: extra.channelName,
      serverName: extra.serverName,
    },
    idempotencyKey,
  });
}

// ─── @Mention in Channel/Post ───
async function notifyMention(recipientId, sender, content, targetId, targetType = 'channel', extra = {}) {
  if (!recipientId || !sender?.id) return null;
  if (recipientId === sender.id) return null;

  const idempotencyKey = generateIdempotencyKey(
    recipientId,
    'mention',
    `${targetId}-${sender.id}-${Date.now()}`,
  );

  const title =
    targetType === 'channel'
      ? `${sender.username} mentioned you in ${extra.channelName || 'a channel'}`
      : `${sender.username} mentioned you in a post`;

  return sendNotification({
    userId: recipientId,
    type: 'mention',
    title,
    body: content ? content.substring(0, 100) : 'You were mentioned',
    data: {
      senderId: sender.id,
      senderName: sender.username,
      ...(targetType === 'channel'
        ? { channelId: targetId, channelName: extra.channelName, serverName: extra.serverName }
        : { postId: targetId }),
    },
    idempotencyKey,
  });
}

// ─── Friend Request ───
async function notifyFriendRequest(receiverId, sender) {
  if (!receiverId || !sender?.id || !sender?.username) return null;
  if (receiverId === sender.id) return null;

  const idempotencyKey = generateIdempotencyKey(
    receiverId,
    'friend_request',
    `${sender.id}-${Date.now()}`,
  );

  return sendNotification({
    userId: receiverId,
    type: 'friend_request',
    title: 'New Friend Request',
    body: `${sender.username} wants to be your friend`,
    data: {
      sender_id: sender.id,
      sender_username: sender.username,
      sender_avatar: sender.avatar || null,
    },
    idempotencyKey,
  });
}

// ─── Friend Online ───
async function notifyFriendOnline(userId, friend) {
  if (!userId || !friend?.id || !friend?.username) return null;
  if (userId === friend.id) return null;

  // Only notify once per day per friend
  const today = new Date().toISOString().split('T')[0];
  const idempotencyKey = generateIdempotencyKey(userId, 'friend_online', `${friend.id}-${today}`);

  return sendNotification({
    userId,
    type: 'friend_online',
    title: 'Friend Online',
    body: `${friend.username} is now online!`,
    data: {
      friend_id: friend.id,
      friend_username: friend.username,
      friend_avatar: friend.avatar || null,
    },
    idempotencyKey,
  });
}

// ─── Post Like ───
async function notifyPostLike(postAuthorId, liker, post) {
  if (!postAuthorId || !liker?.id || !post?.id) return null;
  if (postAuthorId === liker.id) return null;

  const idempotencyKey = generateIdempotencyKey(postAuthorId, 'post_like', `${post.id}-${liker.id}`);

  return sendNotification({
    userId: postAuthorId,
    type: 'post_like',
    title: 'Post Liked',
    body: `${liker.username} liked your post`,
    data: {
      liker_id: liker.id,
      liker_username: liker.username,
      post_id: post.id,
      post_title: post.title || 'Untitled Post',
    },
    idempotencyKey,
  });
}

// ─── Post Comment ───
async function notifyPostComment(postAuthorId, commenter, post, comment) {
  if (!postAuthorId || !commenter?.id || !post?.id || !comment) return null;
  if (postAuthorId === commenter.id) return null;

  const idempotencyKey = generateIdempotencyKey(
    postAuthorId,
    'post_comment',
    `${post.id}-${commenter.id}-${comment.id || Date.now()}`,
  );

  return sendNotification({
    userId: postAuthorId,
    type: 'post_comment',
    title: 'New Comment',
    body: `${commenter.username} commented on your post`,
    data: {
      commenter_id: commenter.id,
      commenter_username: commenter.username,
      post_id: post.id,
      post_title: post.title || 'Untitled Post',
      comment_content: comment.content ? comment.content.substring(0, 50) : '',
    },
    idempotencyKey,
  });
}

// ─── Server Invite ───
async function notifyServerInvite(userId, inviter, server) {
  if (!userId || !inviter?.id || !server?.id) return null;
  if (userId === inviter.id) return null;

  const idempotencyKey = generateIdempotencyKey(userId, 'server_added', `${server.id}-${inviter.id}`);

  return sendNotification({
    userId,
    type: 'server_added',
    title: 'Server Invitation',
    body: `${inviter.username} invited you to join ${server.name || 'a server'}`,
    data: {
      server_id: server.id,
      server_name: server.name || 'Unnamed Server',
      server_icon: server.icon || null,
      inviter_id: inviter.id,
      inviter_username: inviter.username,
    },
    idempotencyKey,
  });
}

// ─── Daily Anime Fact ───
async function notifyDailyFact(userId, fact) {
  if (!userId || !fact) return null;

  const today = new Date().toISOString().split('T')[0];
  const idempotencyKey = generateIdempotencyKey(userId, 'anime_fact', today);

  return sendNotification({
    userId,
    type: 'anime_fact',
    title: 'Daily Anime Fact',
    body: fact,
    data: { fact },
    idempotencyKey,
  });
}

// ─── Bulk Daily Facts (uses batched push) ───
async function sendBulkDailyFacts(userFacts) {
  const today = new Date().toISOString().split('T')[0];

  const notifications = userFacts.map(({ userId, fact }) => ({
    userId,
    type: 'anime_fact',
    title: 'Daily Anime Fact',
    body: fact,
    data: { fact },
    idempotencyKey: generateIdempotencyKey(userId, 'anime_fact', today),
  }));

  return sendBulkNotifications(notifications);
}

module.exports = {
  notifyDMMessage,
  notifyChannelMessage,
  notifyMention,
  notifyFriendRequest,
  notifyFriendOnline,
  notifyPostLike,
  notifyPostComment,
  notifyServerInvite,
  notifyDailyFact,
  sendBulkDailyFacts,
};
