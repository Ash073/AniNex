/**
 * sendTestFCM.js
 *
 * Example: send a test FCM push notification to a specific device token.
 *
 * Usage:
 *   node scripts/sendTestFCM.js <FCM_DEVICE_TOKEN>
 *
 * Requires env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

require('dotenv').config();
const admin = require('../src/config/firebase');

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error('Usage: node scripts/sendTestFCM.js <FCM_DEVICE_TOKEN>');
    process.exit(1);
  }

  const message = {
    token,
    notification: {
      title: 'AniNeX Test',
      body: 'FCM push notification is working!',
    },
    data: {
      type: 'general',
      notificationId: 'test-' + Date.now(),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
      },
    },
  };

  try {
    const messageId = await admin.messaging().send(message);
    console.log('Sent successfully. Message ID:', messageId);
  } catch (err) {
    console.error('Failed to send:', err.message);
    process.exit(1);
  }
}

main();
