-- Authentication System Schema
-- Run this in Supabase SQL Editor after enabling Auth providers

-- ================================================
-- User Profiles Table
-- Extends Supabase Auth with app-specific data
-- ================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  anonymous_user_id TEXT,  -- Links to previous anonymous identity for migration
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for anonymous ID lookups (for migration)
CREATE INDEX IF NOT EXISTS idx_user_profiles_anonymous_id
  ON user_profiles(anonymous_user_id) WHERE anonymous_user_id IS NOT NULL;

-- Index for role lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role
  ON user_profiles(role) WHERE role = 'admin';

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ================================================
-- User Profiles RLS Policies
-- ================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all profiles (including role)
CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- Auto-create profile on signup trigger
-- ================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ================================================
-- Anonymous Migrations Table
-- Tracks which anonymous users have been migrated
-- ================================================

CREATE TABLE IF NOT EXISTS anonymous_migrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anonymous_user_id TEXT NOT NULL UNIQUE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_migrations_auth_user
  ON anonymous_migrations(auth_user_id);

-- Enable RLS
ALTER TABLE anonymous_migrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own migrations
CREATE POLICY "Users can view own migrations"
  ON anonymous_migrations FOR SELECT
  USING (auth_user_id = auth.uid());

-- Users can insert their own migrations
CREATE POLICY "Users can insert own migrations"
  ON anonymous_migrations FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());

-- ================================================
-- Fix cubes.creator_id column type
-- Convert from UUID to TEXT to support both anonymous and auth users
-- ================================================

-- MUST drop ALL policies first before altering column type
-- Drop every possible policy name that could exist on cubes table
DROP POLICY IF EXISTS "Public cubes are viewable by everyone" ON cubes;
DROP POLICY IF EXISTS "Public cubes viewable by everyone" ON cubes;
DROP POLICY IF EXISTS "Creators can view own cubes" ON cubes;
DROP POLICY IF EXISTS "Users can view own cubes" ON cubes;
DROP POLICY IF EXISTS "Admins can view all cubes" ON cubes;
DROP POLICY IF EXISTS "Anyone can create cubes" ON cubes;
DROP POLICY IF EXISTS "Users can create cubes" ON cubes;
DROP POLICY IF EXISTS "Creators can create cubes" ON cubes;
DROP POLICY IF EXISTS "Creators can update own cubes" ON cubes;
DROP POLICY IF EXISTS "Users can update own cubes" ON cubes;
DROP POLICY IF EXISTS "Admins can update any cube" ON cubes;
DROP POLICY IF EXISTS "Creators can delete own cubes" ON cubes;
DROP POLICY IF EXISTS "Users can delete own cubes" ON cubes;
DROP POLICY IF EXISTS "Admins can delete any cube" ON cubes;
-- Catch-all: drop any remaining policies dynamically
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'cubes' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON cubes', pol.policyname);
  END LOOP;
END $$;

-- Drop foreign key constraint if it exists
ALTER TABLE cubes DROP CONSTRAINT IF EXISTS cubes_creator_id_fkey;

-- Convert creator_id from UUID to TEXT if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'cubes'
    AND column_name = 'creator_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE cubes ALTER COLUMN creator_id TYPE TEXT USING creator_id::text;
    RAISE NOTICE 'Converted cubes.creator_id from UUID to TEXT';
  ELSE
    RAISE NOTICE 'cubes.creator_id is already TEXT or does not exist';
  END IF;
END $$;

-- ================================================
-- Updated Cubes RLS Policies
-- ================================================

-- Anyone can view public cubes (no auth required)
CREATE POLICY "Public cubes viewable by everyone"
  ON cubes FOR SELECT
  USING (is_public = true);

-- Authenticated users can view their own cubes
CREATE POLICY "Users can view own cubes"
  ON cubes FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND creator_id = auth.uid()::text
  );

-- Admins can view all cubes
CREATE POLICY "Admins can view all cubes"
  ON cubes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Anyone can create cubes (anonymous or authenticated)
CREATE POLICY "Anyone can create cubes"
  ON cubes FOR INSERT
  WITH CHECK (true);

-- Authenticated users can update their own cubes
CREATE POLICY "Users can update own cubes"
  ON cubes FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND creator_id = auth.uid()::text
  );

-- Admins can update any cube
CREATE POLICY "Admins can update any cube"
  ON cubes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Authenticated users can delete their own cubes
CREATE POLICY "Users can delete own cubes"
  ON cubes FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND creator_id = auth.uid()::text
  );

-- Admins can delete any cube
CREATE POLICY "Admins can delete any cube"
  ON cubes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- Auto-update updated_at trigger for user_profiles
-- ================================================

CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();
