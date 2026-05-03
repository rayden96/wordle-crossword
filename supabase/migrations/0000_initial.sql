-- Run this FIRST in the new Supabase project (SQL Editor).
-- Recreates the core daily-content tables that existed in the old project.

create extension if not exists "pgcrypto";

-- One row per day. crossword_entries is the source of truth (list of {answer, clue});
-- crossword_data is the generator's cached layout (server fills it in).
create table if not exists experiences (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  wordle_answer text not null,
  crossword_entries jsonb not null,
  crossword_data jsonb null,
  reward_text text not null,
  updated_at timestamptz not null default now()
);

create index if not exists experiences_date_idx on experiences(date);

-- Per-player, per-day progress. We use composite (code, date) so onConflict works.
create table if not exists progress (
  code text not null,
  date date not null,
  wordle_completed boolean not null default false,
  crossword_completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (code, date)
);
