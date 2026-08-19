-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query).

create extension if not exists "pgcrypto";

create table if not exists tracker_state (
  id text primary key default 'default',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table tracker_state enable row level security;

-- Wide-open policy so the app works immediately with the public anon key.
-- This is fine for an internal tool behind a private URL, but tighten it once
-- you add Supabase Auth for the team (e.g. restrict to authenticated users,
-- or split into per-table policies matching the fuller schema in
-- wmx-tracker-build-spec.md).
drop policy if exists "allow all for now" on tracker_state;
create policy "allow all for now" on tracker_state
  for all
  using (true)
  with check (true);

-- Seed an empty starting row so the first load doesn't error.
-- (The app also handles a missing row gracefully and falls back to its
-- built-in seed data, so this is optional.)
insert into tracker_state (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;
