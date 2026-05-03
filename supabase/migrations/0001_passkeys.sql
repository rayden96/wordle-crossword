-- Run once in your Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists passkey_users (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists passkey_credentials (
  id text primary key,                     -- credentialID (base64url)
  user_id uuid not null references passkey_users(id) on delete cascade,
  public_key text not null,                -- base64url
  counter bigint not null default 0,
  transports text[] null,
  created_at timestamptz not null default now()
);

create index if not exists passkey_credentials_user_id_idx
  on passkey_credentials(user_id);
