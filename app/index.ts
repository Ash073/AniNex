import messaging from '@react-native-firebase/messaging';

// Register FCM background/quit message handler — MUST be top-level, before app entry
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[FCM] Background message:', remoteMessage.messageId);
  // Android automatically displays the notification from the `notification` payload.
  // Custom logic (e.g. badge count) can go here.
});

// Use Expo Router as the single app entry to avoid double roots on web
import 'expo-router/entry';
