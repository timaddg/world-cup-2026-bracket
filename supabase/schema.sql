-- Run this in Supabase: SQL Editor → New query → Run
-- https://supabase.com/dashboard/project/_/sql

-- Players (one row per display name)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  display_name_key text not null,
  groups jsonb not null default '{}'::jsonb,
  groups_submitted_at timestamptz,
  knockout jsonb not null default '{}'::jsonb,
  knockout_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint players_display_name_key_unique unique (display_name_key)
);

-- Tournament settings (single row, id = 1)
create table if not exists public.tournament (
  id int primary key default 1 check (id = 1),
  phase text not null default 'groups_open',
  group_results jsonb not null default '{}'::jsonb,
  knockout_results jsonb not null default '{}'::jsonb,
  knockout_fixtures jsonb not null default '{}'::jsonb,
  google_sheet_csv_url text default '',
  last_form_sync_at timestamptz,
  last_form_sync_count int default 0,
  updated_at timestamptz not null default now()
);

insert into public.tournament (id) values (1)
on conflict (id) do nothing;

-- Row Level Security
alter table public.players enable row level security;
alter table public.tournament enable row level security;

-- Anyone with the anon key can read (friends pool)
create policy "players_select" on public.players for select using (true);
create policy "tournament_select" on public.tournament for select using (true);

-- Insert new players
create policy "players_insert" on public.players for insert with check (true);

-- Update only while not yet submitted (locks picks after submit)
create policy "players_update_draft" on public.players
  for update
  using (groups_submitted_at is null)
  with check (true);

-- Tournament: allow updates (admin in app)
create policy "tournament_update" on public.tournament for update using (true);
create policy "tournament_insert" on public.tournament for insert with check (id = 1);

-- Optional: Supabase Dashboard → Database → Publications → supabase_realtime → add "players"
