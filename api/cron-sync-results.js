/**
 * Vercel Cron: daily group standings sync during the group stage.
 * Schedule in vercel.json: 06:00 America/New_York (10:00 UTC) on June 11–27.
 *
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_FOOTBALL_KEY, CRON_SECRET
 */
import { createClient } from "@supabase/supabase-js";
import { isWithinAutoSyncWindow, shouldRunDailySync } from "../lib/auto-sync-dates.mjs";
import {
  fetchGroupResultsFromApiKey,
  getApiKeyFromEnv,
  getResultsApiProvider,
} from "../lib/fetch-group-results.mjs";

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  if (!isWithinAutoSyncWindow()) {
    res.status(200).json({ ok: true, skipped: true, reason: "outside_sync_window" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const apiKey = getApiKeyFromEnv();

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: "Supabase env vars missing" });
    return;
  }

  if (!getResultsApiProvider(apiKey)) {
    res.status(500).json({ error: "VITE_API_FOOTBALL_KEY missing" });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: row, error: readErr } = await supabase
      .from("tournament")
      .select("phase, group_results_synced_at")
      .eq("id", 1)
      .maybeSingle();

    if (readErr) {
      res.status(500).json({ error: readErr.message });
      return;
    }

    const lastSynced = row?.group_results_synced_at
      ? new Date(row.group_results_synced_at).getTime()
      : null;

    if (!shouldRunDailySync(lastSynced)) {
      res.status(200).json({ ok: true, skipped: true, reason: "synced_within_24h" });
      return;
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
      res.status(500).json({ error: writeErr.message });
      return;
    }

    res.status(200).json({
      ok: true,
      synced: true,
      groups: Object.keys(groupResults).length,
      phase: nextPhase,
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
}
