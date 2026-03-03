const fetch = require('node-fetch');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification to a device using Expo's API 🎌
 * Following the style of "Test Local Tray" for simplicity and robustness.
 * 
 * @param {string} pushToken Expo push token (starts with 'ExponentPushToken')
 * @param {string} title Notification title
 * @param {string} body Notification body
 * @param {object} data Optional data payload (used for routing/logic)
 * @param {string} channelId Android notification channel ID
 * @returns {Promise<object>} Expo API response
 */
async function sendExpoPush(pushToken, title, body, data = {}, channelId = 'default') {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.warn(`[ExpoPush] Invalid token: ${pushToken}`);
    return { success: false, error: 'Invalid Expo push token' };
  }

  // Ensure data has the minimal expected structure
  const finalData = {
    ...data,
    _displayInForeground: true, // Hint for some older handlers
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

    // Log the result for debugging
    if (result.data?.[0]?.status === 'error') {
      console.error(`[ExpoPush] Error sending to ${pushToken}:`, result.data[0].message);
    } else {
      console.log(`[ExpoPush] Success! Message sent to ${pushToken}`);
    }

    return result;
  } catch (error) {
    console.error('[ExpoPush] Critical fetch error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendExpoPush };
