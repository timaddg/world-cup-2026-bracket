import { fetchGroupResultsFromApi, getResultsApiProvider } from "./results-api.js";
import { getTournamentState, saveTournamentState } from "./store.js";

export async function syncGroupResultsFromApiAndSave() {
  const groupResults = await fetchGroupResultsFromApi();
  const state = getTournamentState();
  state.groupResults = groupResults;
  state.groupResultsSyncedAt = Date.now();
  state.groupResultsSource = getResultsApiProvider() ?? "api";
  if (state.phase === "groups_open" || state.phase === "groups_locked") {
    state.phase = "scored";
  }
  saveTournamentState(state);
  return groupResults;
}
