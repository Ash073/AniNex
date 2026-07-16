/**
 * pushValidator.js
 *
 * Pure validation module for push notification payloads, tokens, and types.
 * No side effects. No network calls. No database access.
 *
 * Responsibilities:
 *   - Validate Expo push token format
 *   - Validate notification type
 *   - Validate + sanitize full push payload (title, body, data size)
 *   - Generate deterministic idempotency keys
 */

// ─── Constants ───────────────────────────────────────────────
// FCM tokens are typically 100-300 char alphanumeric strings with colons/hyphens/underscores
const FCM_TOKEN_REGEX = /^[a-zA-Z0-9_:!\-]{50,400}$/;

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
  'server_invite',
  'anime_fact',
  'general',
]);

const MAX_TITLE_LENGTH = 178;
const MAX_BODY_LENGTH = 1024;
const MAX_DATA_SIZE_BYTES = 4096;

// ─── Token Validation ────────────────────────────────────────

/**
 * Validate an FCM device registration token format.
 * @param {string} token
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'TOKEN_NULL_OR_NOT_STRING' };
  }
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'TOKEN_EMPTY' };
  }
  if (!FCM_TOKEN_REGEX.test(trimmed)) {
    return { valid: false, reason: `INVALID_TOKEN_FORMAT: ${trimmed.substring(0, 30)}` };
  }
  return { valid: true };
}

// ─── Type Validation ─────────────────────────────────────────

/**
 * Validate a notification type against the known set.
 * @param {string} type
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateType(type) {
  if (!type || typeof type !== 'string') {
    return { valid: false, reason: 'TYPE_REQUIRED' };
  }
  if (!VALID_NOTIFICATION_TYPES.has(type)) {
    return { valid: false, reason: `UNKNOWN_TYPE: ${type}` };
  }
  return { valid: true };
}

// ─── Full Payload Validation ─────────────────────────────────

/**
 * Validate and sanitize a push notification payload before sending to Expo.
 * Ensures title/body are always present strings and data doesn't exceed limits.
 *
 * @param {object} payload - { to, title, body, data, channelId }
 * @returns {{ valid: boolean, reason?: string, sanitized?: object }}
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'PAYLOAD_NOT_OBJECT' };
  }

  const { to, title, body, data, channelId } = payload;

  // 1. Token
  const tokenResult = validateToken(to);
  if (!tokenResult.valid) {
    return { valid: false, reason: `TOKEN: ${tokenResult.reason}` };
  }

  // 2. Title — must be a non-empty string
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, reason: 'TITLE_REQUIRED_NON_EMPTY_STRING' };
  }

  // 3. Body — must be a non-empty string (Expo requirement)
  if (body === undefined || body === null) {
    return { valid: false, reason: 'BODY_REQUIRED' };
  }
  if (typeof body !== 'string') {
    return { valid: false, reason: `BODY_MUST_BE_STRING (got ${typeof body})` };
  }
  if (body.trim().length === 0) {
    return { valid: false, reason: 'BODY_EMPTY' };
  }

  // 4. Data payload size check (Expo limit ~4KB)
  if (data) {
    try {
      const dataStr = JSON.stringify(data);
      if (dataStr.length > MAX_DATA_SIZE_BYTES) {
        return {
          valid: false,
          reason: `DATA_TOO_LARGE: ${dataStr.length}B exceeds ${MAX_DATA_SIZE_BYTES}B`,
        };
      }
    } catch {
      return { valid: false, reason: 'DATA_NOT_SERIALIZABLE' };
    }
  }

  // 5. Build sanitized output
  const sanitized = {
    to: to.trim(),
    title: title.trim().substring(0, MAX_TITLE_LENGTH),
    body: body.trim().substring(0, MAX_BODY_LENGTH),
    data: data || {},
    channelId: channelId || 'default',
  };

  return { valid: true, sanitized };
}

// ─── Idempotency Key ────────────────────────────────────────

/**
 * Generate a deterministic idempotency key.
 * Format: "userId:type:contextId"
 *
 * @param {string} userId
 * @param {string} type       - Notification type
 * @param {string} contextId  - Message ID, date string, request ID, etc.
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
  MAX_TITLE_LENGTH,
  MAX_BODY_LENGTH,
  MAX_DATA_SIZE_BYTES,
};
