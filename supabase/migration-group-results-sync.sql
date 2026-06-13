-- Run once if your tournament table was created before group_results sync columns existed.
-- Supabase → SQL Editor → New query → Run

ALTER TABLE public.tournament
  ADD COLUMN IF NOT EXISTS group_results_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS group_results_source text;
