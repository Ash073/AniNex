-- ═══════════════════════════════════════════════════════════════
--  NOTIFICATION SYSTEM V2 — MIGRATION
--  Run this against your Supabase project via the SQL Editor.
--
--  Changes:
--    1. Add 'mention' to notifications type CHECK constraint
--    2. Add idempotency_key column + unique index
--    3. Add push_status & push_ticket_id columns
--    4. Add push_token_updated_at to users table
--    5. Create push_send_log audit table
--    6. Add performance indexes
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Fix CHECK constraint to include 'mention' ───────────
-- Drop the old constraint first (name may vary — check your DB)
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'dm',
    'server_message',
    'mention',
    'friend_request',
    'friend_online',
    'post_like',
    'post_comment',
    'server_invite',
    'anime_fact'
  ));

-- ─── 2. Idempotency key ─────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Unique index — prevents duplicate notification rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency
  ON notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ─── 3. Push delivery tracking ──────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS push_status TEXT DEFAULT 'pending'
  CHECK (push_status IN ('pending', 'sent', 'failed', 'skipped'));

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS push_ticket_id TEXT;

-- ─── 4. Token freshness tracking on users ───────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- ─── 5. Push send log (audit / debugging) ───────────────────
CREATE TABLE IF NOT EXISTS push_send_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT,
  body          TEXT,
  push_token    TEXT,
  ticket_id     TEXT,
  status        TEXT DEFAULT 'sent',
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for querying a user's push history
CREATE INDEX IF NOT EXISTS idx_push_send_log_user
  ON push_send_log (user_id, created_at DESC);

-- Enable RLS on push_send_log
ALTER TABLE push_send_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read push logs (no client access)
DROP POLICY IF EXISTS "Service role only on push_send_log" ON push_send_log;
CREATE POLICY "Service role only on push_send_log"
  ON push_send_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 6. Performance indexes ─────────────────────────────────
-- Fast lookup of unread notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read, created_at DESC);

-- Fast lookup by type for analytics
CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications (type, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  AUTO-CLEANUP: Remove push_send_log entries older than 30 days
--  Run this as a Supabase cron job (pg_cron) or external scheduler
-- ═══════════════════════════════════════════════════════════════
-- SELECT cron.schedule(
--   'cleanup-push-send-log',
--   '0 3 * * *',  -- daily at 3 AM UTC
--   $$DELETE FROM push_send_log WHERE created_at < now() - interval '30 days'$$
-- );
