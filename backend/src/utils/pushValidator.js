/**
 * pushValidator.js
 *
 * Validates push notification payloads before sending to Expo.
 * Single responsibility: validation only.
 */

const EXPO_TOKEN_REGEX = /^ExponentPushToken\[.+\]$/;

const VALID_NOTIFICATION_TYPES = new Set([
  'dm',
  'server_message',
  'mention',
  'friend_request',
  'friend_online',
  'post_like',
  'post_comment',
  'server_added',
  'server_approved',
  'anime_fact',
  'general',
]);

const MAX_TITLE_LENGTH = 178;
const MAX_BODY_LENGTH = 1024;
const MAX_DATA_SIZE = 4096;

/**
 * Validate an Expo push token format.
 * @param {string} token
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token is null or not a string' };
  }
  if (!EXPO_TOKEN_REGEX.test(token)) {
    return { valid: false, reason: `Invalid token format: ${token.substring(0, 30)}...` };
  }
  return { valid: true };
}

/**
 * Validate a notification type.
 * @param {string} type
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateType(type) {
  if (!type || typeof type !== 'string') {
    return { valid: false, reason: 'Type is required' };
  }
  if (!VALID_NOTIFICATION_TYPES.has(type)) {
    return { valid: false, reason: `Unknown notification type: ${type}` };
  }
  return { valid: true };
}

/**
 * Validate and sanitize push payload before sending.
 * @param {object} payload - { to, title, body, data, channelId }
 * @returns {{ valid: boolean, reason?: string, sanitized?: object }}
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'Payload must be an object' };
  }

  const { to, title, body, data, channelId } = payload;

  const tokenResult = validateToken(to);
  if (!tokenResult.valid) return tokenResult;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, reason: 'Title is required and must be non-empty' };
  }

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return { valid: false, reason: 'Body is required and must be non-empty' };
  }

  if (data) {
    try {
      const dataStr = JSON.stringify(data);
      if (dataStr.length > MAX_DATA_SIZE) {
        return { valid: false, reason: `Data payload exceeds ${MAX_DATA_SIZE} bytes` };
      }
    } catch {
      return { valid: false, reason: 'Data payload is not serializable' };
    }
  }

  const sanitized = {
    to,
    title: title.trim().substring(0, MAX_TITLE_LENGTH),
    body: body.trim().substring(0, MAX_BODY_LENGTH),
    data: data || {},
    channelId: channelId || 'default',
  };

  return { valid: true, sanitized };
}

/**
 * Generate a deterministic idempotency key for a notification.
 * Prevents the same notification from being sent twice.
 * @param {string} userId
 * @param {string} type
 * @param {string} contextId - e.g., messageId, friendRequestId, etc.
 * @returns {string|null}
 */
function generateIdempotencyKey(userId, type, contextId) {
  if (!userId || !type || !contextId) return null;
  return `${userId}:${type}:${contextId}`;
}

module.exports = {
  validateToken,
  validateType,
  validatePayload,
  generateIdempotencyKey,
  VALID_NOTIFICATION_TYPES,
};
