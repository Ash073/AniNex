-- Migration: add user progress fields for streak, XP, level, and badges
-- Run this SQL against your Supabase/PostgreSQL database

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;

-- Optional: create index for faster queries on streak
CREATE INDEX IF NOT EXISTS idx_users_streak ON public.users(streak);
