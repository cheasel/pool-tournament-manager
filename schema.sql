-- Supabase Schema for Pool Tournament Manager
-- Enable UUID extension just in case
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  skill_level_8 INTEGER NOT NULL DEFAULT 3,
  skill_level_9 INTEGER NOT NULL DEFAULT 3,
  skill_level_10 INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TOURNAMENTS TABLE
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL CHECK (game_type IN ('8-Ball', '9-Ball', '10-Ball')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  winner_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  entry_fee NUMERIC,
  payout_percentages INTEGER[],
  has_calcutta BOOLEAN DEFAULT false,
  calcutta_min_start_bet NUMERIC,
  calcutta_min_increment NUMERIC,
  calcutta_payout_percentages INTEGER[],
  calcutta_bids JSONB DEFAULT '[]'::jsonb,
  entry_fee_paid_ids TEXT[] DEFAULT '{}'::text[],
  calcutta_bids_paid_ids TEXT[] DEFAULT '{}'::text[],
  player_payout_paid_ids TEXT[] DEFAULT '{}'::text[],
  owner_payout_paid_ids TEXT[] DEFAULT '{}'::text[],
  handicap_race_style TEXT NOT NULL DEFAULT 'default'
);

-- 3. GROUPS TABLE
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  player_ids TEXT[] DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'active'
);

-- 4. MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id TEXT,
  player2_id TEXT,
  player1_score INTEGER NOT NULL DEFAULT 0,
  player2_score INTEGER NOT NULL DEFAULT 0,
  player1_target INTEGER NOT NULL DEFAULT 0,
  player2_target INTEGER NOT NULL DEFAULT 0,
  player1_spotted_balls INTEGER[] DEFAULT '{}'::integer[],
  player2_spotted_balls INTEGER[] DEFAULT '{}'::integer[],
  status TEXT NOT NULL DEFAULT 'scheduled',
  winner_id TEXT,
  player1_stats JSONB DEFAULT '{}'::jsonb,
  player2_stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  handicap_race_style TEXT NOT NULL DEFAULT 'default'
);

-- 5. HANDICAP HISTORY TABLE
CREATE TABLE IF NOT EXISTS handicap_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  old_skill_level_8 INTEGER NOT NULL,
  old_skill_level_9 INTEGER NOT NULL,
  old_skill_level_10 INTEGER NOT NULL,
  new_skill_level_8 INTEGER NOT NULL,
  new_skill_level_9 INTEGER NOT NULL,
  new_skill_level_10 INTEGER NOT NULL,
  changed_by TEXT
);

-- 6. HANDICAP RACES TABLE
CREATE TABLE IF NOT EXISTS handicap_races (
  game_type TEXT NOT NULL,
  higher_skill INTEGER NOT NULL,
  lower_skill INTEGER NOT NULL,
  higher_target INTEGER NOT NULL,
  lower_target INTEGER NOT NULL,
  spotted_balls INTEGER[] DEFAULT '{}'::integer[],
  difference INTEGER NOT NULL,
  PRIMARY KEY (game_type, higher_skill, lower_skill)
);
