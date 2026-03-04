/**
 * pushSender.js
 *
 * Low-level Expo Push API HTTP client.
 * Handles single sends, batch sends, retries with exponential backoff,
 * and automatic cleanup of invalid tokens.
 *
 * No business logic. No database reads for user data.
 * Only responsibility: deliver messages to Expo and report results.
 */

const fetch = require('node-fetch');
const { supabase } = require('../config/supabase');

// ─── Configuration ───────────────────────────────────────────
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_LIMIT = 100;        // Expo accepts up to 100 messages per request
const MAX_RETRIES = 3;               // Maximum retry attempts
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff delays (ms)
const BATCH_DELAY_MS = 250;          // Delay between batches to avoid rate limits

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Headers ─────────────────────────────────────────────────

/**
 * Build HTTP headers for Expo Push API.
 * Includes optional access token if configured.
 */
function buildHeaders() {
  const headers = {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

// ─── Message Builder ─────────────────────────────────────────

/**
 * Build an Expo push message object with all required fields.
 *
 * @param {string} pushToken   - ExponentPushToken[xxx]
 * @param {string} title       - Notification title (required)
 * @param {string} body        - Notification body (required, must be string)
 * @param {object} data        - Custom data payload
 * @param {string} channelId   - Android notification channel
 * @returns {object} Expo push message object
 */
function buildMessage(pushToken, title, body, data = {}, channelId = 'default') {
  // Enforce title and body are always strings
  const safeTitle = (typeof title === 'string' && title.trim()) ? title.trim() : 'AniNeX';
  const safeBody = (typeof body === 'string' && body.trim()) ? body.trim() : 'New notification';

  return {
    to: pushToken,
    sound: 'default',
    title: safeTitle,
    body: safeBody,
    data: {
      ...data,
      _displayInForeground: true,
    },
    channelId: channelId || 'default',
    priority: 'high',
    badge: 1,
  };
}

// ─── Single Push ─────────────────────────────────────────────

/**
 * Send a single push notification to Expo with retry logic.
 *
 * @param {object} message - Built Expo push message object
 * @returns {Promise<{ success: boolean, ticketId?: string, error?: string, errorType?: string }>}
 */
async function sendSinglePush(message) {
  const tokenSuffix = message.to ? message.to.slice(-8) : 'unknown';
  const logPrefix = `[PushSender:single:...${tokenSuffix}]`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`${logPrefix} Attempt ${attempt + 1}/${MAX_RETRIES + 1}`);

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(message),
      });

      console.log(`${logPrefix} HTTP ${response.status}`);

      // Rate limited — retry with backoff
      if (response.status === 429) {
        const delay = RETRY_DELAYS[attempt];
        if (delay) {
          console.warn(`${logPrefix} Rate limited, retrying in ${delay}ms`);
          await sleep(delay);
          continue;
        }
        console.error(`${logPrefix} Rate limited — all retries exhausted`);
        return { success: false, error: 'RATE_LIMITED', errorType: 'RateLimited' };
      }

      // Non-OK HTTP status
      if (!response.ok) {
        const text = await response.text();
        console.error(`${logPrefix} HTTP error: ${text.substring(0, 200)}`);
        return { success: false, error: `HTTP_${response.status}`, errorType: 'HttpError' };
      }

      // Parse response
      const result = await response.json();

      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        console.error(`${logPrefix} Unexpected response shape:`, JSON.stringify(result).substring(0, 200));
        return { success: false, error: 'INVALID_RESPONSE', errorType: 'InvalidResponse' };
      }

      const ticket = result.data[0];

      // Success
      if (ticket.status === 'ok') {
        console.log(`${logPrefix} Queued successfully (ticket: ${ticket.id})`);
        return { success: true, ticketId: ticket.id };
      }

      // Expo error
      if (ticket.status === 'error') {
        const errorType = ticket.details?.error || 'UnknownError';
        console.error(`${logPrefix} Expo error: ${ticket.message} [${errorType}]`);

        // Auto-cleanup stale tokens
        if (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials') {
          await removeInvalidToken(message.to, logPrefix);
        }

        return { success: false, error: ticket.message, errorType };
      }

      console.warn(`${logPrefix} Unknown ticket status:`, ticket);
      return { success: false, error: 'UNKNOWN_TICKET_STATUS', errorType: 'Unknown' };

    } catch (err) {
      // Network error — retry
      if (attempt < MAX_RETRIES && RETRY_DELAYS[attempt]) {
        console.warn(`${logPrefix} Network error, retrying in ${RETRY_DELAYS[attempt]}ms:`, err.message);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      console.error(`${logPrefix} Network error — all retries exhausted:`, err.message);
      return { success: false, error: err.message, errorType: 'NetworkError' };
    }
  }

  return { success: false, error: 'MAX_RETRIES_EXCEEDED', errorType: 'MaxRetries' };
}

// ─── Batch Push ──────────────────────────────────────────────

/**
 * Send push notifications in batches of up to 100 (Expo limit).
 * Used for bulk sends like daily facts.
 *
 * @param {Array<object>} messages - Array of built Expo push message objects
 * @returns {Promise<Array<{ success: boolean, ticketId?: string, error?: string, errorType?: string }>>}
 */
async function sendBatchPush(messages) {
  if (!messages || messages.length === 0) {
    return [];
  }

  const results = [];
  let batchRetryCount = 0;
  const MAX_BATCH_RETRIES = 2;

  for (let i = 0; i < messages.length; i += EXPO_BATCH_LIMIT) {
    const batch = messages.slice(i, i + EXPO_BATCH_LIMIT);
    const batchNum = Math.floor(i / EXPO_BATCH_LIMIT) + 1;
    const totalBatches = Math.ceil(messages.length / EXPO_BATCH_LIMIT);
    const logPrefix = `[PushSender:batch:${batchNum}/${totalBatches}]`;

    try {
      console.log(`${logPrefix} Sending ${batch.length} messages`);

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(batch),
      });

      console.log(`${logPrefix} HTTP ${response.status}`);

      // Rate limited — retry this batch (with limit to prevent infinite loop)
      if (response.status === 429) {
        if (batchRetryCount < MAX_BATCH_RETRIES) {
          batchRetryCount++;
          const delay = 5000 * batchRetryCount;
          console.warn(`${logPrefix} Rate limited, retry ${batchRetryCount}/${MAX_BATCH_RETRIES} in ${delay}ms`);
          await sleep(delay);
          i -= EXPO_BATCH_LIMIT; // retry this batch
          continue;
        }
        console.error(`${logPrefix} Rate limited — max batch retries exhausted`);
        batch.forEach(() => results.push({ success: false, error: 'RATE_LIMITED', errorType: 'RateLimited' }));
        batchRetryCount = 0; // Reset for next batch
        continue;
      }

      batchRetryCount = 0; // Reset on success

      // HTTP error
      if (!response.ok) {
        const text = await response.text();
        console.error(`${logPrefix} HTTP error: ${text.substring(0, 200)}`);
        batch.forEach(() => results.push({ success: false, error: `HTTP_${response.status}`, errorType: 'HttpError' }));
        continue;
      }

      // Parse tickets
      const result = await response.json();
      const tickets = result.data || [];

      for (let j = 0; j < batch.length; j++) {
        const ticket = tickets[j];
        if (!ticket) {
          results.push({ success: false, error: 'MISSING_TICKET', errorType: 'MissingTicket' });
          continue;
        }

        if (ticket.status === 'ok') {
          results.push({ success: true, ticketId: ticket.id });
        } else {
          const errorType = ticket.details?.error || 'UnknownError';
          if (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials') {
            removeInvalidToken(batch[j].to, logPrefix).catch(() => {});
          }
          results.push({ success: false, error: ticket.message, errorType });
        }
      }

    } catch (err) {
      console.error(`${logPrefix} Network error:`, err.message);
      batch.forEach(() => results.push({ success: false, error: err.message, errorType: 'NetworkError' }));
    }

    // Small delay between batches to avoid rate limits
    if (i + EXPO_BATCH_LIMIT < messages.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`[PushSender:batch] Complete: ${sent} sent, ${failed} failed out of ${messages.length}`);

  return results;
}

// ─── Token Cleanup ───────────────────────────────────────────

/**
 * Remove an invalid push token from BOTH the push_tokens table
 * and the legacy users.push_token column.
 *
 * @param {string} pushToken
 * @param {string} logPrefix
 */
async function removeInvalidToken(pushToken, logPrefix = '[PushSender]') {
  if (!pushToken) return;

  try {
    // Remove from push_tokens table
    const { error: ptError } = await supabase
      .from('push_tokens')
      .delete()
      .eq('token', pushToken);

    if (ptError) {
      console.warn(`${logPrefix} Failed to remove token from push_tokens:`, ptError.message);
    } else {
      console.log(`${logPrefix} Removed invalid token from push_tokens: ...${pushToken.slice(-8)}`);
    }

    // Also clear from legacy users.push_token column
    const { error: userError } = await supabase
      .from('users')
      .update({ push_token: null, push_token_updated_at: new Date().toISOString() })
      .eq('push_token', pushToken);

    if (userError) {
      console.warn(`${logPrefix} Failed to clear legacy token from users:`, userError.message);
    }
  } catch (err) {
    console.error(`${logPrefix} removeInvalidToken exception:`, err.message);
  }
}

// ─── Backward-compat wrapper ─────────────────────────────────
/**
 * Legacy sendExpoPush function for existing debug scripts.
 */
async function sendExpoPush(pushToken, title, body, data = {}, channelId = 'default') {
  const { validateToken } = require('./pushValidator');
  const check = validateToken(pushToken);
  if (!check.valid) {
    console.warn('[PushSender] Invalid token, skipping:', check.reason);
    return { success: false, error: check.reason };
  }
  const message = buildMessage(pushToken, title, body, data, channelId);
  return sendSinglePush(message);
}

module.exports = {
  buildMessage,
  sendSinglePush,
  sendBatchPush,
  removeInvalidToken,
  sendExpoPush,
};
