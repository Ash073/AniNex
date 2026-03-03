/**
 * notificationService.js
 *
 * THE single service layer for all notification operations.
 * ALL notification sends MUST go through this module.
 *
 * Responsibilities:
 *   1. Deduplication via idempotency keys
 *   2. Rate limiting per user
 *   3. DB persistence
 *   4. Socket.IO real-time emit
 *   5. Expo push delivery
 *   6. Audit logging
 */

const { supabase } = require('../config/supabase');
const { sendSinglePush, sendBatchPush, buildMessage } = require('../utils/expoPush');
const { validatePayload, validateType, validateToken } = require('../utils/pushValidator');

// ─── In-memory rate limiter ───
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30;           // max 30 notifications per user per minute

// ─── In-memory idempotency cache ───
const recentKeys = new Map();
const IDEMPOTENCY_WINDOW_MS = 30_000; // 30 seconds

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentKeys) {
    if (now - ts > IDEMPOTENCY_WINDOW_MS) recentKeys.delete(key);
  }
  for (const [userId, data] of rateLimitMap) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(userId);
  }
}, 5 * 60_000);

/**
 * Channel ID mapping for Android notification channels.
 */
const CHANNEL_MAP = {
  dm: 'default',
  server_message: 'default',
  mention: 'default',
  friend_request: 'default',
  friend_online: 'default',
  post_like: 'default',
  post_comment: 'default',
  server_added: 'default',
  anime_fact: 'default',
  general: 'default',
};

/**
 * CORE: Send a notification to a user.
 * This is the ONLY function that routes/socket handlers should call.
 *
 * @param {object} params
 * @param {string} params.userId      - Target user ID
 * @param {string} params.type        - Notification type
 * @param {string} params.title       - Notification title
 * @param {string} params.body        - Notification body
 * @param {object} [params.data]      - Additional data payload
 * @param {string} [params.idempotencyKey] - Unique key to prevent duplicate sends
 * @param {boolean} [params.pushOnly] - Skip DB insert and socket emit
 * @param {boolean} [params.silent]   - Skip push (DB + socket only)
 * @returns {Promise<{ success: boolean, notification?: object, pushResult?: object, skipped?: string }>}
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
  const logPrefix = `[NotifService:${type}]`;

  try {
    // ── 1. Input validation ──
    if (!userId || !type || !title || !body) {
      console.warn(`${logPrefix} Missing required params:`, {
        userId,
        type,
        title: !!title,
        body: !!body,
      });
      return { success: false, skipped: 'MISSING_PARAMS' };
    }

    const typeCheck = validateType(type);
    if (!typeCheck.valid) {
      console.warn(`${logPrefix} Invalid type:`, typeCheck.reason);
      return { success: false, skipped: typeCheck.reason };
    }

    // ── 2. Idempotency check (memory) ──
    if (idempotencyKey) {
      if (recentKeys.has(idempotencyKey)) {
        console.log(`${logPrefix} Duplicate skipped (memory): ${idempotencyKey}`);
        return { success: true, skipped: 'DUPLICATE_MEMORY' };
      }
      recentKeys.set(idempotencyKey, Date.now());
    }

    // ── 3. Rate limiting ──
    if (!checkRateLimit(userId)) {
      console.warn(`${logPrefix} Rate limited for user ${userId}`);
      return { success: false, skipped: 'RATE_LIMITED' };
    }

    // ── 4. Fetch user (push_token) ──
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, push_token')
      .eq('id', userId)
      .single();

    if (userError || !userRow) {
      console.warn(`${logPrefix} User not found: ${userId}`);
      return { success: false, skipped: 'USER_NOT_FOUND' };
    }

    const channelId = CHANNEL_MAP[type] || 'default';
    const finalData = { ...data, type };

    let notification = null;

    // ── 5. DB persistence ──
    if (!pushOnly) {
      try {
        const insertObj = {
          user_id: userId,
          type,
          title,
          body,
          data: finalData,
          is_read: false,
          created_at: new Date().toISOString(),
          push_status: 'pending',
        };

        if (idempotencyKey) {
          insertObj.idempotency_key = idempotencyKey;
        }

        const { data: row, error: insertError } = await supabase
          .from('notifications')
          .insert(insertObj)
          .select()
          .single();

        if (insertError) {
          // Check if it's an idempotency violation (duplicate key)
          if (insertError.code === '23505' && idempotencyKey) {
            console.log(`${logPrefix} Duplicate skipped (DB): ${idempotencyKey}`);
            return { success: true, skipped: 'DUPLICATE_DB' };
          }
          console.error(`${logPrefix} DB insert error:`, insertError.message);
          // Continue — push is more important than DB record
        } else {
          notification = row;
          finalData.notificationId = notification.id;
        }
      } catch (dbErr) {
        console.error(`${logPrefix} DB exception:`, dbErr.message);
      }
    }

    // ── 6. Socket.IO real-time emit ──
    if (!pushOnly) {
      try {
        const io = global.io;
        if (io) {
          io.to(`user:${userId}`).emit('notification:new', {
            id: notification?.id || null,
            type,
            title,
            body,
            data: finalData,
            created_at: notification?.created_at || new Date().toISOString(),
          });
        }
      } catch (socketErr) {
        console.error(`${logPrefix} Socket emit error:`, socketErr.message);
      }
    }

    // ── 7. Expo Push ──
    let pushResult = null;

    if (!silent && userRow.push_token) {
      const tokenCheck = validateToken(userRow.push_token);
      if (!tokenCheck.valid) {
        console.warn(`${logPrefix} Invalid token for ${userId}: ${tokenCheck.reason}`);
        await updatePushStatus(notification?.id, 'skipped');
      } else {
        const message = buildMessage(
          userRow.push_token,
          title,
          body,
          finalData,
          channelId,
        );

        const payloadCheck = validatePayload({
          to: userRow.push_token,
          title,
          body,
          data: finalData,
          channelId,
        });

        if (!payloadCheck.valid) {
          console.warn(`${logPrefix} Invalid payload: ${payloadCheck.reason}`);
          await updatePushStatus(notification?.id, 'failed');
        } else {
          pushResult = await sendSinglePush(message);

          if (pushResult.success) {
            await updatePushStatus(notification?.id, 'sent', pushResult.ticketId);
          } else {
            await updatePushStatus(notification?.id, 'failed');
          }

          // Audit log
          await logPushSend(userId, type, idempotencyKey, pushResult);
        }
      }
    } else if (!silent && !userRow.push_token) {
      console.log(`${logPrefix} No push token for ${userId} — socket-only`);
      await updatePushStatus(notification?.id, 'skipped');
    }

    return { success: true, notification, pushResult };
  } catch (err) {
    console.error(`${logPrefix} Unhandled error:`, err.message, err.stack);
    return { success: false, skipped: 'INTERNAL_ERROR' };
  }
}

/**
 * Bulk send notifications (for daily facts, server announcements, etc.)
 * Uses batched Expo push for efficiency.
 *
 * @param {Array<{userId, type, title, body, data, idempotencyKey}>} notifications
 * @returns {Promise<{ sent: number, skipped: number, failed: number }>}
 */
async function sendBulkNotifications(notifications) {
  const stats = { sent: 0, skipped: 0, failed: 0 };
  const pushMessages = [];
  const pushMeta = [];

  for (const notif of notifications) {
    const { userId, type, title, body, data = {}, idempotencyKey = null } = notif;

    // Validate
    if (!userId || !type || !title || !body) {
      stats.skipped++;
      continue;
    }

    // Idempotency
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
        body,
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
          body,
          data: finalData,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[BulkNotif] Error for ${userId}:`, err.message);
    }

    // Queue push message
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('push_token')
        .eq('id', userId)
        .single();

      if (userRow?.push_token) {
        const tokenCheck = validateToken(userRow.push_token);
        if (tokenCheck.valid) {
          pushMessages.push(
            buildMessage(
              userRow.push_token,
              title,
              body,
              finalData,
              CHANNEL_MAP[type] || 'default',
            ),
          );
          pushMeta.push({ userId, type, idempotencyKey });
        }
      }
    } catch (e) {
      // silently continue
    }
  }

  // Send all pushes in Expo batches
  if (pushMessages.length > 0) {
    const results = await sendBatchPush(pushMessages);
    for (let i = 0; i < results.length; i++) {
      if (results[i].success) {
        stats.sent++;
        logPushSend(
          pushMeta[i].userId,
          pushMeta[i].type,
          pushMeta[i].idempotencyKey,
          results[i],
        ).catch(() => {});
      } else {
        stats.failed++;
      }
    }
  }

  console.log(
    `[BulkNotif] Done: ${stats.sent} sent, ${stats.skipped} skipped, ${stats.failed} failed`,
  );
  return stats;
}

// ─── Helper: Rate Limiter ───
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

// ─── Helper: Update push_status on notification row ───
async function updatePushStatus(notificationId, status, ticketId = null) {
  if (!notificationId) return;
  try {
    const update = { push_status: status };
    if (ticketId) update.push_ticket_id = ticketId;
    await supabase.from('notifications').update(update).eq('id', notificationId);
  } catch (e) {
    // silently continue
  }
}

// ─── Helper: Audit log ───
async function logPushSend(userId, type, idempotencyKey, pushResult) {
  try {
    await supabase.from('push_send_log').insert({
      user_id: userId,
      notification_type: type,
      idempotency_key: idempotencyKey,
      push_ticket_id: pushResult?.ticketId || null,
      status: pushResult?.success ? 'sent' : 'failed',
      error_message: pushResult?.error || null,
    });
  } catch (e) {
    // silently continue
  }
}

module.exports = {
  sendNotification,
  sendBulkNotifications,
};
