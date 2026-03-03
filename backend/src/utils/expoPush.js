const fetch = require('node-fetch');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification via Expo Push API v2.
 *
 * Delivery guarantees:
 *  • Uses priority: 'high' + ttl: 0 for immediate delivery
 *  • Automatically clears stale/invalid tokens from the DB
 *  • Supports optional EXPO_ACCESS_TOKEN for authenticated sends
 *
 * @param {string}  pushToken  - ExponentPushToken[xxx]
 * @param {string}  title
 * @param {string}  body
 * @param {object}  data       - payload forwarded to the client
 * @param {string}  channelId  - Android notification channel
 * @returns {object} Expo API response or error object
 */
async function sendExpoPush(pushToken, title, body, data = {}, channelId = 'default') {
  // ── Validate token format ──
  if (!pushToken || typeof pushToken !== 'string' || !pushToken.startsWith('ExponentPushToken')) {
    console.warn('[ExpoPush] Invalid token, skipping:', String(pushToken).substring(0, 25));
    return { success: false, error: 'Invalid token format' };
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title: title || 'AniNeX',
    body: body || '',
    data: {
      ...data,
      _displayInForeground: true,
      _contentAvailable: true,
    },
    channelId: channelId || 'default',
    priority: 'high',
    badge: 1,
    ttl: 0,
    mutableContent: true,
  };

  // ── Build headers (with optional access token) ──
  const headers = {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };

  // If an Expo access token is configured, attach it for authenticated sends
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[ExpoPush] HTTP ${response.status}:`, text);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    // ── Process Expo ticket ──
    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      const ticket = result.data[0];

      if (ticket.status === 'ok') {
        console.log(`[ExpoPush] ✓ Queued (ID: ${ticket.id}) for token ...${pushToken.slice(-8)}`);
      } else if (ticket.status === 'error') {
        console.error(`[ExpoPush] ✗ Error:`, ticket.message, ticket.details);

        // Clear stale tokens so we stop retrying dead devices
        const errorType = ticket.details?.error;
        if (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials') {
          console.warn(`[ExpoPush] Clearing stale token (${errorType})...`);
          try {
            const { supabase } = require('../config/supabase');
            await supabase
              .from('users')
              .update({ push_token: null })
              .eq('push_token', pushToken);
            console.log('[ExpoPush] Stale token removed from DB');
          } catch (dbErr) {
            console.error('[ExpoPush] Failed to clear token:', dbErr.message);
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[ExpoPush] Network/fetch error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendExpoPush };
