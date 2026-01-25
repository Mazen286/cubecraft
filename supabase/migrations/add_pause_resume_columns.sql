-- Migration: Add pause/resume timer sync columns
-- Run this in your Supabase SQL Editor if you already have existing tables

-- Add columns for pause/resume functionality with synced timers
ALTER TABLE draft_sessions
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS time_remaining_at_pause INTEGER,
ADD COLUMN IF NOT EXISTS resume_at TIMESTAMPTZ;

-- These columns allow:
-- paused_at: When the session was paused
-- time_remaining_at_pause: How many seconds were left on the timer when paused
-- resume_at: Timestamp when the 5-second resume countdown ends (for sync)
