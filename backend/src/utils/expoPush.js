/**
 * expoPush.js
 *
 * Low-level Expo Push API client.
 * Handles batching, retries with exponential backoff, and stale token cleanup.
 * No business logic — only HTTP transport.
 */

const fetch = require('node-fetch');
const { supabase } = require('../config/supabase');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_LIMIT = 100;
const RETRY_DELAYS = [1000, 2000, 4000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build headers for Expo Push API (with optional access token).
 */
function buildHeaders() {
  const headers = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

/**
 * Send a single push notification to Expo.
 * @param {object} message - Validated Expo push message object
 * @returns {Promise<{ success: boolean, ticketId?: string, error?: string, errorType?: string }>}
 */
async function sendSinglePush(message) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(message),
      });

      if (response.status === 429) {
        const delay = RETRY_DELAYS[attempt];
        if (delay) {
          console.warn(`[ExpoPush] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1})`);
          await sleep(delay);
          continue;
        }
        console.error('[ExpoPush] Rate limited — all retries exhausted');
        return { success: false, error: 'RATE_LIMITED' };
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`[ExpoPush] HTTP ${response.status}: ${text}`);
        return { success: false, error: `HTTP_${response.status}` };
      }

      const result = await response.json();

      if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        console.error('[ExpoPush] Unexpected response shape:', JSON.stringify(result));
        return { success: false, error: 'INVALID_RESPONSE' };
      }

      const ticket = result.data[0];

      if (ticket.status === 'ok') {
        const tokenSuffix = message.to ? message.to.slice(-8) : 'unknown';
        console.log(`[ExpoPush] Queued (ticket: ${ticket.id}) -> ...${tokenSuffix}`);
        return { success: true, ticketId: ticket.id };
      }

      if (ticket.status === 'error') {
        const errorType = ticket.details?.error;
        console.error(`[ExpoPush] Error: ${ticket.message} (${errorType})`);
        if (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials') {
          await clearStaleToken(message.to);
        }
        return { success: false, error: ticket.message, errorType };
      }

      return { success: false, error: 'UNKNOWN_TICKET_STATUS' };
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        console.warn(`[ExpoPush] Network error, retrying in ${RETRY_DELAYS[attempt]}ms:`, err.message);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      console.error('[ExpoPush] Network error — all retries exhausted:', err.message);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'MAX_RETRIES_EXCEEDED' };
}

/**
 * Send push notifications in batches (for bulk sends like daily facts).
 * @param {Array<object>} messages - Array of validated Expo push message objects
 * @returns {Promise<Array<{ success: boolean, ticketId?: string, error?: string }>>}
 */
async function sendBatchPush(messages) {
  const results = [];

  for (let i = 0; i < messages.length; i += EXPO_BATCH_LIMIT) {
    const batch = messages.slice(i, i + EXPO_BATCH_LIMIT);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(batch),
      });

      if (response.status === 429) {
        console.warn('[ExpoPush] Batch rate limited, waiting 5s...');
        await sleep(5000);
        i -= EXPO_BATCH_LIMIT; // retry this batch
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`[ExpoPush] Batch HTTP ${response.status}: ${text}`);
        batch.forEach(() => results.push({ success: false, error: `HTTP_${response.status}` }));
        continue;
      }

      const result = await response.json();
      const tickets = result.data || [];

      for (let j = 0; j < batch.length; j++) {
        const ticket = tickets[j];
        if (!ticket) {
          results.push({ success: false, error: 'MISSING_TICKET' });
          continue;
        }

        if (ticket.status === 'ok') {
          results.push({ success: true, ticketId: ticket.id });
        } else {
          const errorType = ticket.details?.error;
          if (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials') {
            clearStaleToken(batch[j].to).catch(() => {});
          }
          results.push({ success: false, error: ticket.message, errorType });
        }
      }
    } catch (err) {
      console.error('[ExpoPush] Batch error:', err.message);
      batch.forEach(() => results.push({ success: false, error: err.message }));
    }

    // Small delay between batches to avoid rate limits
    if (i + EXPO_BATCH_LIMIT < messages.length) {
      await sleep(200);
    }
  }

  return results;
}

/**
 * Remove stale push token from database.
 * @param {string} pushToken
 */
async function clearStaleToken(pushToken) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ push_token: null, push_token_updated_at: new Date().toISOString() })
      .eq('push_token', pushToken);

    if (error) {
      console.error('[ExpoPush] Failed to clear stale token:', error.message);
    } else {
      console.log(`[ExpoPush] Stale token cleared: ...${pushToken.slice(-8)}`);
    }
  } catch (err) {
    console.error('[ExpoPush] clearStaleToken exception:', err.message);
  }
}

/**
 * Build an Expo push message object.
 * @param {string} pushToken
 * @param {string} title
 * @param {string} body
 * @param {object} data
 * @param {string} channelId
 * @returns {object}
 */
function buildMessage(pushToken, title, body, data = {}, channelId = 'default') {
  return {
    to: pushToken,
    sound: 'default',
    title: title || 'AniNeX',
    body: body || '',
    data: {
      ...data,
      _displayInForeground: true,
    },
    channelId: channelId || 'default',
    priority: 'high',
    badge: 1,
  };
}

// ── Backward-compat wrapper so existing imports still work ──
async function sendExpoPush(pushToken, title, body, data = {}, channelId = 'default') {
  const { validateToken } = require('./pushValidator');
  const check = validateToken(pushToken);
  if (!check.valid) {
    console.warn('[ExpoPush] Invalid token, skipping:', check.reason);
    return { success: false, error: check.reason };
  }
  const message = buildMessage(pushToken, title, body, data, channelId);
  return sendSinglePush(message);
}

module.exports = {
  sendExpoPush,
  sendSinglePush,
  sendBatchPush,
  buildMessage,
  clearStaleToken,
};
