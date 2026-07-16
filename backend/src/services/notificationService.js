/**
 * notificationService.js
 *
 * THE single service layer for all notification operations.
 * ALL notification sends MUST go through this module.
 *
 * Responsibilities:
 *   1. Input validation
 *   2. Idempotency (memory + DB unique index)
 *   3. Rate limiting per user
 *   4. DB persistence (notifications table)
 *   5. Socket.IO real-time emit
 *   6. Multi-device Expo push delivery (via push_tokens table)
 *   7. Audit logging (push_send_log table)
 *
 * Architecture guarantee:
 *   Features like DMs, friend requests, daily facts, etc. do NOT
 *   call Expo directly. They call notificationController functions,
 *   which call this service.
 */

const { supabase } = require('../config/supabase');
const { sendSinglePush, sendBatchPush, buildMessage } = require('../utils/pushSender');
const { validatePayload, validateType, validateToken } = require('../utils/pushValidator');

// ─── In-memory idempotency cache ─────────────────────────────
// Prevents duplicate push sends within a short window.
// The DB unique index on idempotency_key is the authoritative guard.
const recentKeys = new Map();
const IDEMPOTENCY_WINDOW_MS = 30_000; // 30 seconds

// ─── In-memory rate limiter ──────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30;           // max 30 notifications per user per minute

// ─── Periodic cleanup (every 5 min) ─────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentKeys) {
    if (now - ts > IDEMPOTENCY_WINDOW_MS) recentKeys.delete(key);
  }
  for (const [userId, data] of rateLimitMap) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(userId);
  }
}, 5 * 60_000).unref();

// ─── Android channel mapping ─────────────────────────────────
const CHANNEL_MAP = {
  dm: 'default',
  server_message: 'default',
  mention: 'default',
  friend_request: 'default',
  friend_online: 'default',
  post_like: 'default',
  post_comment: 'default',
  server_added: 'default',
  server_approved: 'default',
  server_invite: 'default',
  anime_fact: 'default',
  general: 'default',
};

// ═════════════════════════════════════════════════════════════
//  CORE: sendNotification
// ═════════════════════════════════════════════════════════════

/**
 * Send a notification to a single user.
 * This is the ONLY function that controllers/routes/socket handlers should call.
 *
 * @param {object}  params
 * @param {string}  params.userId           - Target user UUID
 * @param {string}  params.type             - Notification type
 * @param {string}  params.title            - Display title
 * @param {string}  params.body             - Display body (must be string)
 * @param {object}  [params.data={}]        - Additional data payload
 * @param {string}  [params.idempotencyKey] - Unique key to prevent duplicate sends
 * @param {boolean} [params.pushOnly=false] - Skip DB insert + socket emit
 * @param {boolean} [params.silent=false]   - Skip push (DB + socket only)
 * @returns {Promise<{ success: boolean, notification?: object, pushResults?: Array, skipped?: string }>}
 */
async function sendNotification({
  userId,
  type,
  title,
  body,
  data = {},
  idempotencyKey = null,
  pushOnly = false,
  silent = false,
}) {
  const logTag = `[NotifService:${type}:${userId?.substring(0, 8) || '?'}]`;

  try {
    // ── 1. Input validation ──────────────────────────────────
    if (!userId || !type || !title || !body) {
      console.warn(`${logTag} SKIP — missing required params`, {
        hasUserId: !!userId,
        hasType: !!type,
        hasTitle: !!title,
        hasBody: !!body,
      });
      return { success: false, skipped: 'MISSING_PARAMS' };
    }

    // Ensure body is always a string
    const safeBody = String(body);

    const typeCheck = validateType(type);
    if (!typeCheck.valid) {
      console.warn(`${logTag} SKIP — invalid type: ${typeCheck.reason}`);
      return { success: false, skipped: typeCheck.reason };
    }

    // ── 2. Idempotency check (memory) ────────────────────────
    if (idempotencyKey) {
      if (recentKeys.has(idempotencyKey)) {
        console.log(`${logTag} SKIP — duplicate (memory cache): ${idempotencyKey}`);
        return { success: true, skipped: 'DUPLICATE_MEMORY' };
      }
      recentKeys.set(idempotencyKey, Date.now());
    }

    // ── 3. Rate limiting ─────────────────────────────────────
    if (!checkRateLimit(userId)) {
      console.warn(`${logTag} SKIP — rate limited`);
      return { success: false, skipped: 'RATE_LIMITED' };
    }

    const channelId = CHANNEL_MAP[type] || 'default';
    const finalData = { ...data, type };

    let notification = null;

    // ── 4. DB persistence ────────────────────────────────────
    if (!pushOnly) {
      const insertObj = {
        user_id: userId,
        type,
        title,
        body: safeBody,
        data: finalData,
        is_read: false,
        created_at: new Date().toISOString(),
        push_status: 'pending',
      };
      if (idempotencyKey) {
        insertObj.idempotency_key = idempotencyKey;
      }

      let insertSuccess = false;
      const MAX_RETRIES = 2;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { data: row, error: insertError } = await supabase
            .from('notifications')
            .insert(insertObj)
            .select()
            .single();

          if (insertError) {
            if (insertError.code === '23505' && idempotencyKey) {
              console.log(`${logTag} SKIP — duplicate (DB unique index): ${idempotencyKey}`);
              return { success: true, skipped: 'DUPLICATE_DB' };
            }
            console.error(`${logTag} DB insert error (attempt ${attempt + 1}):`, insertError.message);
            if (attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, 500));
              continue;
            }
          } else {
            notification = row;
            finalData.notificationId = notification.id;
            console.log(`${logTag} DB row created: ${notification.id}`);
            insertSuccess = true;
            break;
          }
        } catch (dbErr) {
          console.error(`${logTag} DB exception (attempt ${attempt + 1}):`, dbErr.message);
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
        }
      }

      if (!insertSuccess) {
        console.error(`${logTag} ABORT — DB insert failed after ${MAX_RETRIES + 1} attempts. Skipping push.`);
        return { success: false, skipped: 'DB_INSERT_FAILED' };
      }
    }

    // ── 5. Socket.IO real-time emit ──────────────────────────
    if (!pushOnly) {
      try {
        const io = global.io;
        if (io) {
          io.to(`user:${userId}`).emit('notification:new', {
            id: notification?.id || null,
            type,
            title,
            body: safeBody,
            data: finalData,
            created_at: notification?.created_at || new Date().toISOString(),
          });
          console.log(`${logTag} Socket emitted to user:${userId}`);
        }
      } catch (socketErr) {
        console.error(`${logTag} Socket emit error:`, socketErr.message);
      }
    }

    // ── 6. FCM Push (multi-device) ──────────────────────
    let pushResults = [];

    if (!silent) {
      const tokens = await getUserPushTokens(userId);

      if (tokens.length === 0) {
        console.log(`${logTag} No push tokens — socket/DB only`);
        await updatePushStatus(notification?.id, 'skipped');
      } else {
        console.log(`${logTag} Sending push to ${tokens.length} device(s)`);

        for (const tokenRow of tokens) {
          const tokenCheck = validateToken(tokenRow.token);
          if (!tokenCheck.valid) {
            console.warn(`${logTag} Invalid token skipped: ${tokenCheck.reason}`);
            continue;
          }

          const payloadCheck = validatePayload({
            to: tokenRow.token,
            title,
            body: safeBody,
            data: finalData,
            channelId,
          });

          if (!payloadCheck.valid) {
            console.warn(`${logTag} Invalid payload skipped: ${payloadCheck.reason}`);
            continue;
          }

          const message = buildMessage(
            tokenRow.token,
            title,
            safeBody,
            finalData,
            channelId,
          );

          const pushResult = await sendSinglePush(message);
          pushResults.push(pushResult);

          // Audit log
          await logPushAudit({
            userId,
            type,
            title,
            body: safeBody,
            pushToken: tokenRow.token,
            idempotencyKey,
            pushResult,
          });
        }

        // Update push_status on notification row
        const anySuccess = pushResults.some(r => r.success);
        const firstMessageId = pushResults.find(r => r.messageId)?.messageId || null;

        if (anySuccess) {
          await updatePushStatus(notification?.id, 'sent', firstMessageId);
        } else if (pushResults.length > 0) {
          await updatePushStatus(notification?.id, 'failed');
        }
      }
    }

    return { success: true, notification, pushResults };

  } catch (err) {
    console.error(`${logTag} UNHANDLED ERROR:`, err.message, err.stack);
    return { success: false, skipped: 'INTERNAL_ERROR' };
  }
}

// ═════════════════════════════════════════════════════════════
//  BULK: sendBulkNotifications
// ═════════════════════════════════════════════════════════════

/**
 * Send notifications to many users efficiently.
 * Uses batched Expo push for throughput (daily facts, announcements).
 *
 * @param {Array<{userId, type, title, body, data?, idempotencyKey?}>} notifications
 * @returns {Promise<{ sent: number, skipped: number, failed: number }>}
 */
async function sendBulkNotifications(notifications) {
  const stats = { sent: 0, skipped: 0, failed: 0 };
  const pushMessages = [];
  const pushMeta = [];

  console.log(`[BulkNotif] Starting bulk send of ${notifications.length} notifications`);

  for (const notif of notifications) {
    const { userId, type, title, body, data = {}, idempotencyKey = null } = notif;

    // Validate
    if (!userId || !type || !title || !body) {
      stats.skipped++;
      continue;
    }

    const safeBody = String(body);

    // Idempotency (memory check)
    if (idempotencyKey && recentKeys.has(idempotencyKey)) {
      stats.skipped++;
      continue;
    }
    if (idempotencyKey) recentKeys.set(idempotencyKey, Date.now());

    // Rate limit
    if (!checkRateLimit(userId)) {
      stats.skipped++;
      continue;
    }

    const finalData = { ...data, type };

    // DB insert
    try {
      const insertObj = {
        user_id: userId,
        type,
        title,
        body: safeBody,
        data: finalData,
        is_read: false,
        created_at: new Date().toISOString(),
        push_status: 'pending',
      };
      if (idempotencyKey) insertObj.idempotency_key = idempotencyKey;

      const { data: row, error } = await supabase
        .from('notifications')
        .insert(insertObj)
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505' && idempotencyKey) {
          stats.skipped++;
          continue;
        }
        console.error(`[BulkNotif] DB error for ${userId}:`, error.message);
      }

      if (row) finalData.notificationId = row.id;

      // Socket emit
      const io = global.io;
      if (io) {
        io.to(`user:${userId}`).emit('notification:new', {
          id: row?.id || null,
          type,
          title,
          body: safeBody,
          data: finalData,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[BulkNotif] DB/socket error for ${userId}:`, err.message);
    }

    // Gather push tokens for this user (multi-device)
    try {
      const tokens = await getUserPushTokens(userId);

      for (const tokenRow of tokens) {
        const tokenCheck = validateToken(tokenRow.token);
        if (!tokenCheck.valid) continue;

        pushMessages.push(
          buildMessage(tokenRow.token, title, safeBody, finalData, CHANNEL_MAP[type] || 'default'),
        );
        pushMeta.push({ userId, type, idempotencyKey, token: tokenRow.token });
      }
    } catch (e) {
      // Silently continue
    }
  }

  // Send all pushes in Expo batches
  if (pushMessages.length > 0) {
    console.log(`[BulkNotif] Sending ${pushMessages.length} push messages in batches`);
    const results = await sendBatchPush(pushMessages);

    for (let i = 0; i < results.length; i++) {
      if (results[i].success) {
        stats.sent++;
        logPushAudit({
          userId: pushMeta[i].userId,
          type: pushMeta[i].type,
          pushToken: pushMeta[i].token,
          idempotencyKey: pushMeta[i].idempotencyKey,
          pushResult: results[i],
        }).catch(() => {});
      } else {
        stats.failed++;
      }
    }
  }

  console.log(`[BulkNotif] Done: ${stats.sent} sent, ${stats.skipped} skipped, ${stats.failed} failed`);
  return stats;
}

// ═════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════

/**
 * Fetch all valid push tokens for a user from push_tokens table.
 * Falls back to users.push_token if push_tokens table is empty/missing.
 *
 * @param {string} userId
 * @returns {Promise<Array<{ token: string, device_id?: string }>>}
 */
async function getUserPushTokens(userId) {
  try {
    // Primary: push_tokens table (multi-device)
    const { data: tokenRows, error: ptError } = await supabase
      .from('push_tokens')
      .select('token, device_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!ptError && tokenRows && tokenRows.length > 0) {
      return tokenRows;
    }

    // Fallback: legacy users.push_token column
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (!userError && userRow?.push_token) {
      return [{ token: userRow.push_token }];
    }

    return [];
  } catch (err) {
    console.error(`[NotifService] Error fetching push tokens for ${userId}:`, err.message);

    // Last-resort fallback to users table
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('push_token')
        .eq('id', userId)
        .single();
      if (userRow?.push_token) return [{ token: userRow.push_token }];
    } catch {
      // give up
    }
    return [];
  }
}

/**
 * Rate limiter check (sliding window).
 * @param {string} userId
 * @returns {boolean} true if allowed
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

/**
 * Update push_status on a notification row.
 * @param {string|null} notificationId
 * @param {string} status - 'pending' | 'sent' | 'failed' | 'skipped'
 * @param {string|null} messageId
 */
async function updatePushStatus(notificationId, status, messageId = null) {
  if (!notificationId) return;
  try {
    const update = { push_status: status };
    if (messageId) update.push_ticket_id = messageId;
    await supabase.from('notifications').update(update).eq('id', notificationId);
  } catch (e) {
    console.error('[NotifService] updatePushStatus error:', e.message);
  }
}

/**
 * Write audit row to push_send_log for debugging.
 */
async function logPushAudit({ userId, type, title, body, pushToken, idempotencyKey, pushResult }) {
  try {
    await supabase.from('push_send_log').insert({
      user_id: userId,
      notification_type: type,
      title: title || null,
      body: body || null,
      push_token: pushToken || null,
      idempotency_key: idempotencyKey || null,
      push_ticket_id: pushResult?.messageId || null,
      status: pushResult?.success ? 'sent' : 'failed',
      error_message: pushResult?.error || null,
    });
  } catch (e) {
    // Non-critical — log and continue
    console.warn('[NotifService] Audit log insert failed:', e.message);
  }
}

module.exports = {
  sendNotification,
  sendBulkNotifications,
};
