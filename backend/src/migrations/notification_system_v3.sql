-- ═══════════════════════════════════════════════════════════════
--  NOTIFICATION SYSTEM V3 — MIGRATION
--  Run this against your Supabase project via the SQL Editor.
--
--  Changes from v2:
--    1. NEW push_tokens table (multi-device support)
--    2. Align push_send_log columns to match backend code
--    3. Add missing notification types to CHECK constraint
--    4. Add cleanup cron SQL (commented, enable if pg_cron available)
--
--  Safe to re-run (all statements use IF NOT EXISTS / IF EXISTS).
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. PUSH TOKENS TABLE (multi-device support) ────────────
-- Each user can have multiple devices with push tokens.
-- The notification service queries this table to deliver pushes.
CREATE TABLE IF NOT EXISTS push_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  device_id     TEXT,                          -- optional device identifier
  platform      TEXT DEFAULT 'unknown'         -- 'ios', 'android', 'unknown'
                  CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Only one active token per device per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_token
  ON push_tokens (user_id, token);

-- Fast lookup by token (for cleanup when Expo reports DeviceNotRegistered)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token
  ON push_tokens (token);

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active
  ON push_tokens (user_id, is_active)
  WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Permissive policy (service role bypasses; adjust if needed)
DROP POLICY IF EXISTS "Allow all for anon" ON push_tokens;
CREATE POLICY "Allow all for anon"
  ON push_tokens FOR ALL USING (true) WITH CHECK (true);


-- ─── 2. ENSURE push_send_log HAS ALL COLUMNS BACKEND USES ──
-- The backend inserts: user_id, notification_type, title, body,
--   push_token, idempotency_key, push_ticket_id, status, error_message
-- Older migrations may have created this table with different column names.

-- Add columns that may be missing
ALTER TABLE push_send_log ADD COLUMN IF NOT EXISTS notification_type TEXT;
ALTER TABLE push_send_log ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE push_send_log ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE push_send_log ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE push_send_log ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE push_send_log ADD COLUMN IF NOT EXISTS push_ticket_id TEXT;
ALTER TABLE push_send_log ADD COLUMN IF NOT EXISTS error_message TEXT;

-- If old column "type" exists and "notification_type" is empty, copy data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'push_send_log' AND column_name = 'type'
  ) THEN
    UPDATE push_send_log SET notification_type = type WHERE notification_type IS NULL AND type IS NOT NULL;
  END IF;
END $$;


-- ─── 3. NOTIFICATIONS — ensure all types are allowed ────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'dm', 'server_message', 'mention',
        'friend_request', 'friend_online',
        'post_like', 'post_comment',
        'server_invite', 'server_added', 'server_approved',
        'anime_fact', 'general'
      ));
  END IF;
END $$;


-- ─── 4. Ensure idempotency_key unique index on notifications ─
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency
  ON notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ─── 5. Ensure push_status columns on notifications ─────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_status TEXT DEFAULT 'pending';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_ticket_id TEXT;


-- ─── 6. Ensure push_token_updated_at on users ───────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;


-- ─── 7. Updated trigger for push_tokens ─────────────────────
-- Auto-update updated_at on push_tokens
DROP TRIGGER IF EXISTS push_tokens_updated_at ON push_tokens;
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════
--  USEFUL QUERIES (for debugging / operations)
-- ═══════════════════════════════════════════════════════════════

-- Insert a push token for a user:
-- INSERT INTO push_tokens (user_id, token, device_id, platform)
-- VALUES ('USER_UUID', 'ExponentPushToken[xxx]', 'device-123', 'android')
-- ON CONFLICT (user_id, token) DO UPDATE SET
--   is_active = TRUE,
--   updated_at = now();

-- Remove an invalid token:
-- DELETE FROM push_tokens WHERE token = 'ExponentPushToken[xxx]';

-- Fetch all active push tokens for a user:
-- SELECT token, device_id, platform
-- FROM push_tokens
-- WHERE user_id = 'USER_UUID' AND is_active = TRUE;

-- Fetch notifications for a user:
-- SELECT * FROM notifications
-- WHERE user_id = 'USER_UUID'
-- ORDER BY created_at DESC
-- LIMIT 50;

-- Insert a notification:
-- INSERT INTO notifications (user_id, type, title, body, data, is_read, push_status)
-- VALUES ('USER_UUID', 'dm', 'New Message', 'Hello!', '{}', false, 'pending');

-- Mark a notification as read:
-- UPDATE notifications SET is_read = TRUE WHERE id = 'NOTIF_UUID';


-- ═══════════════════════════════════════════════════════════════
--  OPTIONAL: Auto-cleanup old data (enable if pg_cron available)
-- ═══════════════════════════════════════════════════════════════

-- Clean push_send_log entries older than 30 days (daily at 3 AM UTC):
-- SELECT cron.schedule(
--   'cleanup-push-send-log',
--   '0 3 * * *',
--   $$DELETE FROM push_send_log WHERE created_at < now() - interval '30 days'$$
-- );

-- Clean stale push tokens that haven't been updated in 90 days:
-- SELECT cron.schedule(
--   'cleanup-stale-push-tokens',
--   '0 4 * * 0',
--   $$DELETE FROM push_tokens WHERE updated_at < now() - interval '90 days'$$
-- );

-- Clean old read notifications older than 60 days:
-- SELECT cron.schedule(
--   'cleanup-old-notifications',
--   '0 5 * * *',
--   $$DELETE FROM notifications WHERE is_read = TRUE AND created_at < now() - interval '60 days'$$
-- );
