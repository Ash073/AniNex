const fetch = require('node-fetch');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification via Expo API 🎌
 * Optimized for maximum deliverability when the app is closed.
 * 
 * @param {string} pushToken 
 * @param {string} title 
 * @param {string} body 
 * @param {object} data 
 * @param {string} channelId 
 */
async function sendExpoPush(pushToken, title, body, data = {}, channelId = 'default') {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    return { success: false, error: 'Invalid token format' };
  }

  const finalData = {
    ...data,
    _displayInForeground: true, // Legacy compatibility
    _contentAvailable: true,   // Wake up iOS apps
  };

  const message = {
    to: pushToken,
    sound: 'default',
    title: title || 'AniNeX',
    body: body || '',
    data: finalData,
    channelId: channelId || 'default',
    priority: 'high',
    badge: 1,
    // ttl: 0 ensures immediate delivery attempt
    ttl: 0,
    // mutableContent allows notification service extensions to modify the notification
    mutableContent: true,
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data && result.data[0]) {
      const { status, message: errMsg, details } = result.data[0];
      if (status === 'error') {
        console.error(`[ExpoPush] Delivery failed for ${pushToken}:`, errMsg, details);
      } else {
        console.log(`[ExpoPush] Successfully queued! ID: ${result.data[0].id}`);
      }
    }

    return result;
  } catch (error) {
    console.error('[ExpoPush] API Request failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendExpoPush };
