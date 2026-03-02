-- Migration: add anime identity fields (AI-driven persona)
-- Run this SQL against your Supabase/PostgreSQL database

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS personality_type TEXT,
  ADD COLUMN IF NOT EXISTS character_name TEXT,
  ADD COLUMN IF NOT EXISTS fandom_category TEXT,
  ADD COLUMN IF NOT EXISTS power_archetype TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS rank TEXT;

-- Index for fandom categorization performance
CREATE INDEX IF NOT EXISTS idx_users_fandom ON public.users(fandom_category);
