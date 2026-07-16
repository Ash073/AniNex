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
  // BEST METHOD FOR RENDER: Base64 Encoded JSON
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const buffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
      const serviceAccount = JSON.parse(buffer.toString('utf-8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('[Firebase] Admin SDK initialized with FIREBASE_SERVICE_ACCOUNT_BASE64');
      return module.exports = admin;
    } catch (e) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // 1. If the user accidentally pasted the ENTIRE JSON file, extract just the private_key
    if (privateKey.trim().startsWith('{') && privateKey.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(privateKey);
        if (parsed.private_key) {
          privateKey = parsed.private_key;
        }
      } catch (e) {
        console.warn('[Firebase] FIREBASE_PRIVATE_KEY looks like JSON but failed to parse');
      }
    }

    // 2. Strip leading/trailing quotes (single or double)
    privateKey = privateKey.replace(/^['"]|['"]$/g, '');

    // 3. Replace escaped literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    // 4. If Render squashed the newlines into spaces (common copy-paste issue)
    if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      privateKey = privateKey.replace(/-----BEGIN PRIVATE KEY-----\s*/g, '-----BEGIN PRIVATE KEY-----\n');
      privateKey = privateKey.replace(/\s*-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----');
      // Replace all spaces in the base64 part with newlines
      privateKey = privateKey.replace(/(-----\n)(.+)(\n-----)/, (match, p1, p2, p3) => {
        return p1 + p2.replace(/ /g, '\n') + p3;
      });
    }
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
      '[Firebase] Missing credentials. Set FIREBASE_SERVICE_ACCOUNT_BASE64 env var.',
    );
  }
}

module.exports = admin;
