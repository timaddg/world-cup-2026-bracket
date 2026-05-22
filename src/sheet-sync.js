import { parseFormResponsesCsv, toCsvExportUrl } from "./forms-import.js";
import { mergeFormResponses, saveTournamentState, getTournamentState } from "./store.js";

async function fetchCsvText(csvUrl) {
  const exportUrl = toCsvExportUrl(csvUrl);

  try {
    const direct = await fetch(exportUrl);
    if (direct.ok) return await direct.text();
  } catch {
    /* CORS — try dev proxy */
  }

  const proxyUrl = `/api/google-sheet?url=${encodeURIComponent(exportUrl)}`;
  const proxied = await fetch(proxyUrl);
  if (!proxied.ok) {
    throw new Error(
      `Could not fetch sheet (${proxied.status}). Publish the sheet or upload a CSV file instead.`
    );
  }
  return proxied.text();
}

export async function syncFromGoogleSheet(csvUrl) {
  const text = await fetchCsvText(csvUrl);
  const { entries, errors, warnings } = parseFormResponsesCsv(text);
  const merged = mergeFormResponses(entries);

  const state = getTournamentState();
  state.googleSheetCsvUrl = toCsvExportUrl(csvUrl);
  state.lastFormSyncAt = Date.now();
  state.lastFormSyncCount = merged;
  saveTournamentState(state);

  return { merged, entries: entries.length, errors, warnings };
}

export async function syncFromCsvFile(file) {
  const text = await file.text();
  const { entries, errors, warnings } = parseFormResponsesCsv(text);
  const merged = mergeFormResponses(entries);

  const state = getTournamentState();
  state.lastFormSyncAt = Date.now();
  state.lastFormSyncCount = merged;
  saveTournamentState(state);

  return { merged, entries: entries.length, errors, warnings };
}
