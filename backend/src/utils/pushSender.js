/**
 * pushSender.js
 *
 * Low-level Firebase Cloud Messaging (FCM) push sender via firebase-admin.
 * Handles single sends, batch sends, and automatic cleanup of invalid tokens.
 *
 * No business logic. No database reads for user data.
 * Only responsibility: deliver messages to FCM and report results.
 */

const admin = require('../config/firebase');
const { supabase } = require('../config/supabase');

// ─── Message Builder ─────────────────────────────────────────

/**
 * Build an FCM message object with notification + data payload.
 *
 * @param {string} pushToken   - FCM device registration token
 * @param {string} title       - Notification title
 * @param {string} body        - Notification body
 * @param {object} data        - Custom data payload (all values must be strings)
 * @param {string} channelId   - Android notification channel ID
 * @returns {object} FCM message object for admin.messaging().send()
 */
function buildMessage(pushToken, title, body, data = {}, channelId = 'default') {
  const safeTitle = (typeof title === 'string' && title.trim()) ? title.trim() : 'AniNeX';
  const safeBody = (typeof body === 'string' && body.trim()) ? body.trim() : 'New notification';

  // FCM data values must ALL be strings
  const stringData = {};
  for (const [key, value] of Object.entries(data)) {
    stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  return {
    token: pushToken,
    notification: {
      title: safeTitle,
      body: safeBody,
    },
    data: stringData,
    android: {
      priority: 'high',
      notification: {
        channelId: channelId || 'default',
        sound: 'default',
        priority: 'high',
      },
    },
  };
}

// ─── Single Push ─────────────────────────────────────────────

/**
 * Send a single push notification via FCM.
 *
 * @param {object} message - Built FCM message object from buildMessage()
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, errorType?: string }>}
 */
async function sendSinglePush(message) {
  const tokenSuffix = message.token ? message.token.slice(-8) : 'unknown';
  const logPrefix = `[PushSender:single:...${tokenSuffix}]`;

  try {
    console.log(`${logPrefix} Sending via FCM`);
    const messageId = await admin.messaging().send(message);
    console.log(`${logPrefix} Sent successfully (messageId: ${messageId})`);
    return { success: true, messageId };
  } catch (err) {
    const errorCode = err.code || '';
    console.error(`${logPrefix} FCM error: ${err.message} [${errorCode}]`);

    // Auto-cleanup stale/invalid tokens
    if (
      errorCode === 'messaging/registration-token-not-registered' ||
      errorCode === 'messaging/invalid-registration-token' ||
      errorCode === 'messaging/invalid-argument'
    ) {
      await removeInvalidToken(message.token, logPrefix);
      return { success: false, error: err.message, errorType: 'InvalidToken' };
    }

    return { success: false, error: err.message, errorType: errorCode || 'FCMError' };
  }
}

// ─── Batch Push ──────────────────────────────────────────────

/**
 * Send push notifications in batches of up to 500 (FCM limit).
 *
 * @param {Array<object>} messages - Array of built FCM message objects
 * @returns {Promise<Array<{ success: boolean, messageId?: string, error?: string, errorType?: string }>>}
 */
async function sendBatchPush(messages) {
  if (!messages || messages.length === 0) return [];

  const FCM_BATCH_LIMIT = 500;
  const results = [];

  for (let i = 0; i < messages.length; i += FCM_BATCH_LIMIT) {
    const batch = messages.slice(i, i + FCM_BATCH_LIMIT);
    const batchNum = Math.floor(i / FCM_BATCH_LIMIT) + 1;
    const totalBatches = Math.ceil(messages.length / FCM_BATCH_LIMIT);
    const logPrefix = `[PushSender:batch:${batchNum}/${totalBatches}]`;

    try {
      console.log(`${logPrefix} Sending ${batch.length} messages via FCM`);
      const response = await admin.messaging().sendEach(batch);

      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          results.push({ success: true, messageId: resp.messageId });
        } else {
          const errorCode = resp.error?.code || '';
          const errorMsg = resp.error?.message || 'Unknown error';

          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
          ) {
            removeInvalidToken(batch[idx].token, logPrefix).catch(() => {});
          }

          results.push({ success: false, error: errorMsg, errorType: errorCode });
        }
      });

      console.log(`${logPrefix} ${response.successCount} sent, ${response.failureCount} failed`);
    } catch (err) {
      console.error(`${logPrefix} Batch error:`, err.message);
      batch.forEach(() =>
        results.push({ success: false, error: err.message, errorType: 'BatchError' }),
      );
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`[PushSender:batch] Complete: ${sent} sent, ${failed} failed out of ${messages.length}`);

  return results;
}

// ─── Token Cleanup ───────────────────────────────────────────

/**
 * Remove an invalid push token from BOTH the push_tokens table
 * and the legacy users.push_token column.
 */
async function removeInvalidToken(pushToken, logPrefix = '[PushSender]') {
  if (!pushToken) return;

  try {
    const { error: ptError } = await supabase
      .from('push_tokens')
      .delete()
      .eq('token', pushToken);

    if (ptError) {
      console.warn(`${logPrefix} Failed to remove token from push_tokens:`, ptError.message);
    } else {
      console.log(`${logPrefix} Removed invalid token from push_tokens: ...${pushToken.slice(-8)}`);
    }

    const { error: userError } = await supabase
      .from('users')
      .update({ push_token: null })
      .eq('push_token', pushToken);

    if (userError) {
      console.warn(`${logPrefix} Failed to clear users.push_token:`, userError.message);
    }
  } catch (err) {
    console.error(`${logPrefix} removeInvalidToken error:`, err.message);
  }
}

/**
 * Backward-compatible wrapper matching the old sendExpoPush(token, title, body, data) signature.
 * Used by debug scripts.
 */
async function sendExpoPush(token, title, body, data = {}) {
  const message = buildMessage(token, title, body, data);
  return sendSinglePush(message);
}

module.exports = {
  buildMessage,
  sendSinglePush,
  sendBatchPush,
  removeInvalidToken,
  sendExpoPush,
};
