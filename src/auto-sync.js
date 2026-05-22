import { AUTO_SYNC, isWithinAutoSyncWindow, shouldRunDailySync } from "../lib/auto-sync-dates.mjs";
import { isResultsApiConfigured } from "./results-api.js";
import { getTournamentState, isCloudBackend } from "./store.js";

export { AUTO_SYNC, isWithinAutoSyncWindow, shouldRunDailySync };

let autoSyncPromise = null;

/**
 * When someone opens the app during the sync window, run at most one sync per 24h
 * (uses shared Supabase group_results_synced_at so all devices agree).
 */
export async function maybeAutoSyncGroupResults(syncFn) {
  if (!isResultsApiConfigured() || !isCloudBackend()) return { ran: false };

  const state = getTournamentState();
  if (!shouldRunDailySync(state.groupResultsSyncedAt)) {
    return { ran: false, reason: "not_due" };
  }

  if (autoSyncPromise) return autoSyncPromise;

  autoSyncPromise = (async () => {
    try {
      await syncFn();
      return { ran: true };
    } catch (err) {
      console.warn("Auto group-results sync failed:", err);
      return { ran: false, error: err };
    } finally {
      autoSyncPromise = null;
    }
  })();

  return autoSyncPromise;
}

export function autoSyncStatusLabel() {
  if (!isWithinAutoSyncWindow()) {
    return `Daily auto-sync runs ${AUTO_SYNC.start}–${AUTO_SYNC.end} (${AUTO_SYNC.timezone}).`;
  }
  return `Daily auto-sync active (${AUTO_SYNC.start}–${AUTO_SYNC.end}, ${AUTO_SYNC.timezone}).`;
}
