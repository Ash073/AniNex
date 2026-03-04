-- ═══════════════════════════════════════════════════════════════
--  AniNex — Complete Supabase Migration (run in SQL Editor)
--  Consolidated from: supabase_migration.sql + all /src/migrations/*
--  with fixes for column mismatches found in backend code.
--
--  Safe to run on a FRESH Supabase project.
--  All statements use IF NOT EXISTS / IF EXISTS so re-running is safe.
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  bio TEXT DEFAULT '' CHECK (char_length(bio) <= 500),
  display_name TEXT DEFAULT '' CHECK (char_length(display_name) <= 50),
  age INTEGER CHECK (age >= 13 AND age <= 120),
  date_of_birth DATE,
  mobile TEXT DEFAULT '',
  gender TEXT DEFAULT '' CHECK (gender IN ('Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say', '')),

  -- Onboarding data
  favorite_anime TEXT[] DEFAULT '{}',
  genres TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  experience_level TEXT DEFAULT 'casual' CHECK (experience_level IN ('casual', 'moderate', 'hardcore')),

  -- Anime Identity (AI-driven persona)
  personality_type TEXT,
  character_name TEXT,
  fandom_category TEXT,
  power_archetype TEXT,
  title TEXT,
  rank TEXT,

  -- User Progress
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  last_login TIMESTAMPTZ,
  badges JSONB DEFAULT '[]'::jsonb,

  -- Social
  servers UUID[] DEFAULT '{}',
  friends UUID[] DEFAULT '{}',

  -- Settings
  settings JSONB DEFAULT '{"profile_visibility": "public", "show_online_status": true, "allow_friend_requests": true, "show_activity_status": true, "allow_dm_from": "everyone"}'::jsonb,

  -- Metadata
  onboarding_completed BOOLEAN DEFAULT FALSE,
  profile_completed BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  push_token TEXT,
  push_token_updated_at TIMESTAMPTZ,       -- v2: token freshness tracking

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. SERVERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  description TEXT DEFAULT '' CHECK (char_length(description) <= 500),
  icon TEXT DEFAULT 'https://api.dicebear.com/7.x/shapes/svg?seed=default',
  banner TEXT,
  anime_theme TEXT,
  tags TEXT[] DEFAULT '{}',
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT TRUE,
  max_members INTEGER DEFAULT 1000,
  member_count INTEGER DEFAULT 1,
  message_count INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',             -- server settings (used by routes + socket)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. SERVER MEMBERS (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS server_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, user_id)
);

-- ============================================
-- 4. CHANNELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  description TEXT DEFAULT '' CHECK (char_length(description) <= 500),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice', 'announcement')),
  is_public BOOLEAN DEFAULT TRUE,
  allowed_roles TEXT[] DEFAULT '{}',
  position INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'system', 'announcement')),
  attachments JSONB DEFAULT '[]',
  read_by JSONB DEFAULT '[]',
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'seen')),
  replied_to_id UUID REFERENCES messages(id),
  reactions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL CHECK (char_length(content) <= 5000),
  title TEXT CHECK (char_length(title) <= 200),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id UUID REFERENCES servers(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'discussion' CHECK (category IN ('discussion', 'review', 'recommendation', 'fan-art', 'meme', 'question', 'announcement')),
  tags TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  is_pinned BOOLEAN DEFAULT FALSE,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'selected')),
  allowed_users UUID[] DEFAULT '{}',
  comments_enabled BOOLEAN DEFAULT TRUE,
  mentions TEXT[] DEFAULT '{}',            -- used by posts route for @mentions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. POST LIKES (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- ============================================
-- 8. COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. COMMENT LIKES (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- ============================================
-- 10. CONVERSATIONS (Direct Messages)
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2),
  CHECK (participant_1 < participant_2)
);

-- ============================================
-- 11. DIRECT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  image_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'seen')),
  replied_to_id UUID REFERENCES direct_messages(id),
  reactions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. FRIEND REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id != receiver_id)
);

-- ============================================
-- 13. JOIN REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. NOTIFICATIONS TABLE (includes v2 columns)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'dm', 'server_message', 'mention', 'friend_request', 'friend_online',
    'post_like', 'post_comment', 'server_invite', 'anime_fact',
    'server_added', 'server_approved', 'general'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  idempotency_key TEXT,                                                     -- v2: dedup
  push_status TEXT DEFAULT 'pending' CHECK (push_status IN ('pending', 'sent', 'failed', 'skipped')),  -- v2
  push_ticket_id TEXT,                                                      -- v2
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 15. POST VIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS post_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- ============================================
-- 16. BLOCKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ============================================
-- 17. REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reported_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('spam', 'harassment', 'inappropriate_content', 'impersonation', 'violence', 'hate_speech', 'other')),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_report_target CHECK (
    (reported_user_id IS NOT NULL AND reported_post_id IS NULL) OR
    (reported_user_id IS NULL AND reported_post_id IS NOT NULL)
  )
);

-- ============================================
-- 18. PUSH SEND LOG (audit table)
--     Column names match backend/src/services/notificationService.js
-- ============================================
CREATE TABLE IF NOT EXISTS push_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,         -- code inserts "notification_type", NOT "type"
  title TEXT,
  body TEXT,
  push_token TEXT,
  ticket_id TEXT,
  idempotency_key TEXT,                    -- code inserts this column
  push_ticket_id TEXT,                     -- code inserts this column
  status TEXT DEFAULT 'sent',
  error_message TEXT,                      -- code inserts "error_message", NOT "error"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 19. PUSH TOKENS TABLE (multi-device support, v3)
--     Each user can have multiple devices registered.
--     notificationService queries this table for push delivery.
-- ============================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  device_id     TEXT,
  platform      TEXT DEFAULT 'unknown' CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  ALTER TABLE — add columns that may be missing on EXISTING tables
--  (CREATE TABLE IF NOT EXISTS won't add new columns to existing tables)
-- ═══════════════════════════════════════════════════════════════

-- users: columns added by later migrations
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS character_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fandom_category TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS power_archetype TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;

-- servers: settings column
ALTER TABLE servers ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- posts: mentions column
ALTER TABLE posts ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';

-- direct_messages: image_url column
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- notifications: v2 columns
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_status TEXT DEFAULT 'pending';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_ticket_id TEXT;

-- Update notifications type CHECK to include all types used by backend
-- (drop old constraint first, then re-add)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
DO $$
BEGIN
  -- Only add if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'dm', 'server_message', 'mention', 'friend_request', 'friend_online',
        'post_like', 'post_comment', 'server_invite', 'anime_fact',
        'server_added', 'server_approved', 'general'
      ));
  END IF;
END $$;

-- Add push_status CHECK if missing (for existing rows)
-- Cannot use ADD CONSTRAINT IF NOT EXISTS before PG 17, so wrap in DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_push_status_check'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_push_status_check
      CHECK (push_status IN ('pending', 'sent', 'failed', 'skipped'));
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
--  INDEXES
-- ═══════════════════════════════════════════════════════════════

-- Users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_fandom ON users(fandom_category);
CREATE INDEX IF NOT EXISTS idx_users_streak ON users(streak);

-- Servers
-- (no extra indexes needed beyond PK/FK)

-- Server Members
CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);

-- Channels
CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id, position);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_server ON messages(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_replied_to ON messages(replied_to_id);

-- Posts
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_server ON posts(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category, created_at DESC);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at DESC);

-- Conversations & DMs
CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_status ON direct_messages(status);
CREATE INDEX IF NOT EXISTS idx_direct_messages_replied_to ON direct_messages(replied_to_id);

-- Friend Requests
CREATE INDEX IF NOT EXISTS idx_fr_sender ON friend_requests(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_fr_receiver ON friend_requests(receiver_id, status);

-- Join Requests
CREATE INDEX IF NOT EXISTS idx_jr_server_status ON join_requests(server_id, status);
CREATE INDEX IF NOT EXISTS idx_jr_user ON join_requests(user_id, status);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Post Views
CREATE INDEX IF NOT EXISTS idx_post_views_post ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user ON post_views(user_id);

-- Blocks
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_created ON blocks(created_at);

-- Reports
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_post ON reports(reported_post_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

-- Push Send Log
CREATE INDEX IF NOT EXISTS idx_push_send_log_user ON push_send_log(user_id, created_at DESC);

-- Push Tokens (multi-device, v3)
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_token ON push_tokens(user_id, token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON push_tokens(user_id, is_active) WHERE is_active = TRUE;

-- ═══════════════════════════════════════════════════════════════
--  AUTO-UPDATE updated_at TRIGGER
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop first so re-running doesn't error
DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP TRIGGER IF EXISTS servers_updated_at ON servers;
DROP TRIGGER IF EXISTS channels_updated_at ON channels;
DROP TRIGGER IF EXISTS messages_updated_at ON messages;
DROP TRIGGER IF EXISTS posts_updated_at ON posts;
DROP TRIGGER IF EXISTS comments_updated_at ON comments;
DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
DROP TRIGGER IF EXISTS direct_messages_updated_at ON direct_messages;
DROP TRIGGER IF EXISTS friend_requests_updated_at ON friend_requests;
DROP TRIGGER IF EXISTS join_requests_updated_at ON join_requests;
DROP TRIGGER IF EXISTS push_tokens_updated_at ON push_tokens;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER servers_updated_at BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER direct_messages_updated_at BEFORE UPDATE ON direct_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER friend_requests_updated_at BEFORE UPDATE ON friend_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER join_requests_updated_at BEFORE UPDATE ON join_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER push_tokens_updated_at BEFORE UPDATE ON push_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
--  Your backend uses the SERVICE ROLE key (bypasses RLS),
--  so we enable RLS but use permissive "allow all" policies.
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Permissive policies (service role bypasses these; anon key uses them)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'users','servers','server_members','channels','messages',
    'posts','post_likes','comments','comment_likes',
    'conversations','direct_messages','friend_requests',
    'join_requests','notifications','post_views','blocks','reports','push_send_log','push_tokens'
  ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Allow all for anon" ON %I; CREATE POLICY "Allow all for anon" ON %I FOR ALL USING (true) WITH CHECK (true);',
      tbl, tbl
    );
  END LOOP;
END $$;
