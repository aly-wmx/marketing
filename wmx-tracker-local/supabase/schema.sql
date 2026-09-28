-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query).

create extension if not exists "pgcrypto";

create table if not exists tracker_state (
  id text primary key default 'default',
  data jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- in case you already ran an earlier version of this file without updated_by
alter table tracker_state add column if not exists updated_by text;

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

-- REQUIRED for realtime: tell Supabase to broadcast changes on this table.
-- (Realtime is off by default per-table, even though the project has it enabled globally.)
-- Wrapped in a check so re-running this script (e.g. after an update) doesn't error
-- if the table's already been added to the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'tracker_state'
  ) then
    alter publication supabase_realtime add table tracker_state;
  end if;
end $$;

-- Seed an empty starting row so the first load doesn't error.
-- (The app also handles a missing row gracefully and falls back to its
-- built-in seed data, so this is optional.)
insert into tracker_state (id, data, updated_by)
values ('default', '{}'::jsonb, 'seed')
on conflict (id) do nothing;

-- Ticket assignment notifications: one row per "you were assigned a ticket"
-- event. The app subscribes to inserts filtered to its own name over
-- realtime, so this only needs to be inserted into and read via that
-- channel — no polling, no per-user table.
create table if not exists ticket_notifications (
  id uuid primary key default gen_random_uuid(),
  ticket_id text,
  recipient text not null,
  title text,
  biz text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table ticket_notifications enable row level security;

drop policy if exists "allow all for now" on ticket_notifications;
create policy "allow all for now" on ticket_notifications
  for all
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ticket_notifications'
  ) then
    alter publication supabase_realtime add table ticket_notifications;
  end if;
end $$;

-- The app's login is the only access gate now that the project's Vercel
-- deployment protection is off, so new accounts must be restricted here,
-- server-side — covers both email/password sign-up and Google OAuth, since
-- both create the account by inserting into auth.users. Emails in
-- app_admins also get role: admin stamped into their account automatically.
create table if not exists public.app_admins (
  email text primary key
);

insert into public.app_admins (email) values
  ('aly@wmx.group'), ('jeff@wmx.group'), ('jason@wmx.group'), ('nick@wmx.group')
on conflict (email) do nothing;

create or replace function public.enforce_wmx_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email !~* '@wmx\.group$' then
    raise exception 'Sign-up is restricted to @wmx.group accounts.';
  end if;
  if exists (select 1 from public.app_admins a where lower(a.email) = lower(new.email)) then
    new.raw_user_meta_data = coalesce(new.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_wmx_email_domain on auth.users;
create trigger enforce_wmx_email_domain
  before insert on auth.users
  for each row execute function public.enforce_wmx_email_domain();

-- Accounts & Logins: its own table with real, database-level RLS
-- restricting it to admins (not just a hidden tab in the UI).
create table if not exists public.credential_accounts (
  id text primary key,
  biz text not null,
  platform text not null,
  username text not null default '',
  password text not null default '',
  notes text not null default '',
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.credential_accounts enable row level security;

-- reads the caller's email straight off their JWT — no auth.users access
-- needed, so no security definer required either.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.app_admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
  );
$$;

drop policy if exists "admins_all" on public.credential_accounts;
create policy "admins_all" on public.credential_accounts
  for all
  using (public.is_admin())
  with check (public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'credential_accounts'
  ) then
    alter publication supabase_realtime add table credential_accounts;
  end if;
end $$;

-- Activity feed: one row per discrete action (toggling a status, opening/
-- moving/deleting a ticket, commenting, logging a follower count), shown
-- live on the Activity tab — a real log instead of just "last edited by X".
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  detail text,
  biz text,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

drop policy if exists "authenticated_all" on public.activity_log;
create policy "authenticated_all" on public.activity_log
  for all
  to authenticated
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'activity_log'
  ) then
    alter publication supabase_realtime add table activity_log;
  end if;
end $$;

-- Admin tab: lets an admin grant/revoke admin access from the app itself.
-- app_admins already has RLS enabled with no write policy at all — every
-- change goes through admin_set_role (security definer), which re-checks
-- admin status server-side and also updates auth.users.raw_user_meta_data
-- directly for an account that already exists (the sign-up trigger above
-- only stamps role at account creation, so a later change needs this).
drop policy if exists "admins_select" on public.app_admins;
create policy "admins_select" on public.app_admins
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.admin_set_role(target_email text, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles.';
  end if;
  if target_email is null or target_email = '' then
    raise exception 'An email is required.';
  end if;

  if make_admin then
    insert into public.app_admins (email) values (lower(target_email))
    on conflict (email) do nothing;
  else
    delete from public.app_admins where lower(email) = lower(target_email);
  end if;

  update auth.users
  set raw_user_meta_data = case
    when make_admin then coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
    else (coalesce(raw_user_meta_data, '{}'::jsonb) - 'role')
  end
  where lower(email) = lower(target_email);
end;
$$;

revoke all on function public.admin_set_role(text, boolean) from public;
grant execute on function public.admin_set_role(text, boolean) to authenticated;

-- Ticket-assignment notifications, pushed to Slack + email via the
-- notify-ticket Edge Function (supabase/functions/notify-ticket/index.ts).
create table if not exists public.team_contacts (
  name text primary key,
  email text not null
);

alter table public.team_contacts enable row level security;

-- Readable by anyone signed in (not just admins) — it's just names/emails,
-- and the app's "Email <assignee>" button on every ticket needs it too.
drop policy if exists "authenticated_select" on public.team_contacts;
create policy "authenticated_select" on public.team_contacts
  for select
  to authenticated
  using (true);

-- insert/update the real roster here — matches whatever names appear in
-- the Team tab / ticket assignee dropdown.
insert into public.team_contacts (name, email) values
  ('Aly', 'aly@wmx.group'),
  ('Jeff', 'jeff@wmx.group'),
  ('Jason', 'jason@wmx.group'),
  ('Nick', 'nick@wmx.group')
on conflict (name) do update set email = excluded.email;

create extension if not exists pg_net with schema extensions;

-- Fires on every ticket_notifications insert (i.e. every ticket
-- assignment) and hands off to the notify-ticket Edge Function. A shared
-- secret (not a Supabase JWT) gates the function since this is a
-- server-to-server call, not a client request — REPLACE_WITH_SHARED_SECRET
-- below must match the WEBHOOK_SECRET the deployed function actually
-- checks (real value isn't committed here, see the function file's notes).
create or replace function public.dispatch_ticket_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://frfxjipxplzahgahlfpg.supabase.co/functions/v1/notify-ticket',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', 'REPLACE_WITH_SHARED_SECRET'
    ),
    body := jsonb_build_object(
      'ticket_id', new.ticket_id,
      'recipient', new.recipient,
      'title', new.title,
      'biz', new.biz,
      'created_by', new.created_by
    )
  );
  return new;
end;
$$;

drop trigger if exists dispatch_ticket_notification on public.ticket_notifications;
create trigger dispatch_ticket_notification
  after insert on public.ticket_notifications
  for each row execute function public.dispatch_ticket_notification();
