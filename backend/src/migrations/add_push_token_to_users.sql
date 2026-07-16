-- Migration: Add push_token column to users table
ALTER TABLE users ADD COLUMN push_token TEXT;
