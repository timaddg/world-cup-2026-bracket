import { createClient } from "@supabase/supabase-js";
import { isWithinAutoSyncWindow, shouldRunDailySync } from "./auto-sync-dates.mjs";
import {
  fetchGroupResultsFromApiKey,
  getApiKeyFromEnv,
  getResultsApiProvider,
} from "./fetch-group-results.mjs";

export async function runCronSyncResults() {
  if (!isWithinAutoSyncWindow()) {
    return { status: 200, body: { ok: true, skipped: true, reason: "outside_sync_window" } };
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const apiKey = getApiKeyFromEnv();

  if (!supabaseUrl || !supabaseKey) {
    return { status: 500, body: { error: "Supabase env vars missing" } };
  }

  if (!getResultsApiProvider(apiKey)) {
    return { status: 500, body: { error: "VITE_API_FOOTBALL_KEY or API_FOOTBALL_KEY missing" } };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: row, error: readErr } = await supabase
    .from("tournament")
    .select("phase, group_results_synced_at")
    .eq("id", 1)
    .maybeSingle();

  if (readErr) {
    return { status: 500, body: { error: readErr.message } };
  }

  const lastSynced = row?.group_results_synced_at
    ? new Date(row.group_results_synced_at).getTime()
    : null;

  if (!shouldRunDailySync(lastSynced)) {
    return { status: 200, body: { ok: true, skipped: true, reason: "synced_within_24h" } };
  }

  const groupResults = await fetchGroupResultsFromApiKey(apiKey);
  const phase = row?.phase ?? "groups_open";
  const nextPhase =
    phase === "groups_open" || phase === "groups_locked" ? "scored" : phase;

  const { error: writeErr } = await supabase
    .from("tournament")
    .update({
      group_results: groupResults,
      group_results_synced_at: new Date().toISOString(),
      group_results_source: getResultsApiProvider(apiKey),
      phase: nextPhase,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (writeErr) {
    return { status: 500, body: { error: writeErr.message } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      synced: true,
      groups: Object.keys(groupResults).length,
      phase: nextPhase,
    },
  };
}
