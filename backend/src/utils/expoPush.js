const fetch = require('node-fetch');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification to a device using Expo's API
 * @param {string} pushToken Expo push token (starts with 'ExponentPushToken')
 * @param {string} title Notification title
 * @param {string} body Notification body
 * @param {object} data Optional data payload
 * @returns {Promise<object>} Expo API response
 */
async function sendExpoPush(pushToken, title, body, data = {}) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    throw new Error('Invalid Expo push token');
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  return response.json();
}

module.exports = { sendExpoPush };
