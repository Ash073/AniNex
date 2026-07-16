/**
 * firebase.js
 *
 * Initializes Firebase Admin SDK for server-side FCM push delivery.
 *
 * Reads credentials from environment variables:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (the PEM string, with literal \n)
 *
 * Alternatively, set GOOGLE_APPLICATION_CREDENTIALS to point to a JSON file.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Strip leading/trailing quotes if user copied them from JSON
    privateKey = privateKey.replace(/^"|"$/g, '');
    // Replace escaped literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    console.log('[Firebase] Admin SDK initialized with env credentials');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('[Firebase] Admin SDK initialized with GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    console.error(
      '[Firebase] Missing credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars.',
    );
  }
}

module.exports = admin;
