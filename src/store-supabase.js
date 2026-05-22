import { gameConfig } from "./config.js";
import { getSupabase, isSupabaseConfigured } from "./supabase.js";

function defaultTournamentState() {
  return {
    phase: "groups_open",
    groupResults: {},
    knockoutFixtures: {},
    knockoutResults: {},
    googleSheetCsvUrl: gameConfig.googleSheetCsvUrl || "",
    lastFormSyncAt: null,
    lastFormSyncCount: 0,
    groupResultsSyncedAt: null,
    groupResultsSource: null,
  };
}

let usersCache = {};
let stateCache = defaultTournamentState();
let loadError = null;

function nameKey(displayName) {
  return displayName.trim().toLowerCase();
}

function rowToEntry(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    createdAt: new Date(row.created_at).getTime(),
    groups: row.groups ?? {},
    groupsSubmittedAt: row.groups_submitted_at
      ? new Date(row.groups_submitted_at).getTime()
      : null,
    knockout: row.knockout ?? {},
    knockoutSubmittedAt: row.knockout_submitted_at
      ? new Date(row.knockout_submitted_at).getTime()
      : null,
  };
}

function entryToRow(entry) {
  return {
    display_name: entry.displayName,
    display_name_key: nameKey(entry.displayName),
    groups: entry.groups ?? {},
    groups_submitted_at: entry.groupsSubmittedAt
      ? new Date(entry.groupsSubmittedAt).toISOString()
      : null,
    knockout: entry.knockout ?? {},
    knockout_submitted_at: entry.knockoutSubmittedAt
      ? new Date(entry.knockoutSubmittedAt).toISOString()
      : null,
  };
}

function rowToState(row) {
  if (!row) return defaultTournamentState();
  return {
    phase: row.phase ?? "groups_open",
    groupResults: row.group_results ?? {},
    knockoutFixtures: row.knockout_fixtures ?? {},
    knockoutResults: row.knockout_results ?? {},
    googleSheetCsvUrl: row.google_sheet_csv_url ?? "",
    lastFormSyncAt: row.last_form_sync_at
      ? new Date(row.last_form_sync_at).getTime()
      : null,
    lastFormSyncCount: row.last_form_sync_count ?? 0,
    groupResultsSyncedAt: row.group_results_synced_at
      ? new Date(row.group_results_synced_at).getTime()
      : null,
    groupResultsSource: row.group_results_source ?? null,
  };
}

function stateToRow(state) {
  return {
    id: 1,
    phase: state.phase,
    group_results: state.groupResults ?? {},
    knockout_results: state.knockoutResults ?? {},
    knockout_fixtures: state.knockoutFixtures ?? {},
    google_sheet_csv_url: state.googleSheetCsvUrl ?? "",
    last_form_sync_at: state.lastFormSyncAt
      ? new Date(state.lastFormSyncAt).toISOString()
      : null,
    last_form_sync_count: state.lastFormSyncCount ?? 0,
    group_results_synced_at: state.groupResultsSyncedAt
      ? new Date(state.groupResultsSyncedAt).toISOString()
      : null,
    group_results_source: state.groupResultsSource ?? null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertPlayer(entry) {
  const supabase = getSupabase();
  const { error } = await supabase.from("players").upsert(entryToRow(entry), {
    onConflict: "display_name_key",
  });
  if (error) throw error;
}

async function saveTournamentRemote(state) {
  const supabase = getSupabase();
  const { error } = await supabase.from("tournament").upsert(stateToRow(state));
  if (error) throw error;
}

export function getLoadError() {
  return loadError;
}

export async function init() {
  if (!isSupabaseConfigured()) return;

  loadError = null;
  const supabase = getSupabase();

  const [playersRes, tourRes] = await Promise.all([
    supabase.from("players").select("*").order("created_at", { ascending: true }),
    supabase.from("tournament").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (playersRes.error) {
    loadError = playersRes.error.message;
    throw playersRes.error;
  }

  usersCache = {};
  for (const row of playersRes.data ?? []) {
    const entry = rowToEntry(row);
    usersCache[nameKey(entry.displayName)] = entry;
  }

  if (tourRes.error) {
    loadError = tourRes.error.message;
    throw tourRes.error;
  }

  stateCache = rowToState(tourRes.data);
}

export async function refresh() {
  await init();
}

export function getTournamentState() {
  return { ...stateCache };
}

export function saveTournamentState(state) {
  stateCache = { ...state };
  saveTournamentRemote(stateCache).catch((err) => {
    console.error("Failed to save tournament", err);
  });
}

export function getAllUsers() {
  return { ...usersCache };
}

export function getUserEntry(displayName) {
  return usersCache[nameKey(displayName)] ?? null;
}

export function hasSubmittedGroups(displayName) {
  return !!getUserEntry(displayName)?.groupsSubmittedAt;
}

export function areGroupPicksLocked(entry) {
  if (!entry) return false;
  return !!entry.groupsSubmittedAt || isGroupStageLocked();
}

export function saveUserEntry(displayName, patch) {
  const key = nameKey(displayName);
  const existing = usersCache[key] ?? {
    displayName: displayName.trim(),
    createdAt: Date.now(),
    groups: {},
    groupsSubmittedAt: null,
    knockout: {},
    knockoutSubmittedAt: null,
  };

  if (existing.groupsSubmittedAt) {
    const { groups, groupsSubmittedAt, ...allowed } = patch;
    if (groups !== undefined || groupsSubmittedAt !== undefined) {
      return existing;
    }
    const next = { ...existing, ...allowed, displayName: displayName.trim() };
    usersCache[key] = next;
    return next;
  }

  const next = { ...existing, ...patch, displayName: displayName.trim() };
  usersCache[key] = next;

  if (existing.groupsSubmittedAt || patch.groupsSubmittedAt) {
    upsertPlayer(next).catch((err) => {
      console.error("Failed to save player", err);
      alert(`Could not save to server: ${err.message}`);
    });
  }

  return next;
}

export async function submitGroupPicksOnce(displayName, groups) {
  const key = nameKey(displayName);
  const existing = getUserEntry(displayName);

  if (existing?.groupsSubmittedAt) {
    return { ok: false, reason: "already_submitted" };
  }

  if (isGroupStageLocked()) {
    return { ok: false, reason: "Group stage is locked." };
  }

  if (!groups || typeof groups !== "object") {
    return { ok: false, reason: "No picks found. Complete the form first." };
  }

  const next = {
    displayName: displayName.trim(),
    createdAt: existing?.createdAt ?? Date.now(),
    groups,
    groupsSubmittedAt: Date.now(),
    knockout: existing?.knockout ?? {},
    knockoutSubmittedAt: existing?.knockoutSubmittedAt ?? null,
  };

  usersCache[key] = next;

  try {
    await upsertPlayer(next);
    return { ok: true, entry: next };
  } catch (err) {
    delete usersCache[key];
    const msg = String(err.message ?? "");
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, reason: "already_submitted" };
    }
    return { ok: false, reason: msg || "Submit failed" };
  }
}

export function listAllUsers() {
  return Object.values(usersCache).map((u) => ({
    displayName: u.displayName,
    groupsSubmittedAt: u.groupsSubmittedAt,
    knockoutSubmittedAt: u.knockoutSubmittedAt,
    groupProgress: Object.keys(u.groups || {}).length,
  }));
}

export function isGroupStageLocked() {
  if (stateCache.phase !== "groups_open") return true;
  return Date.now() >= new Date(gameConfig.groupLockAt).getTime();
}

export function isKnockoutOpen() {
  if (stateCache.phase === "knockout_open" || stateCache.phase === "knockout_locked") return true;
  if (stateCache.phase === "scored") return true;
  return Date.now() >= new Date(gameConfig.knockoutOpensAt).getTime();
}

export function isKnockoutLocked() {
  return stateCache.phase === "knockout_locked" || stateCache.phase === "scored";
}

export function exportAllData() {
  return {
    users: getAllUsers(),
    state: getTournamentState(),
    exportedAt: new Date().toISOString(),
  };
}

export async function importAllData(payload) {
  if (!payload?.users) throw new Error("Invalid backup file");

  for (const entry of Object.values(payload.users)) {
    if (!entry?.displayName) continue;
    usersCache[nameKey(entry.displayName)] = entry;
    await upsertPlayer(entry);
  }

  if (payload.state) {
    stateCache = payload.state;
    await saveTournamentRemote(stateCache);
  }
}

export async function mergeFormResponses(entries) {
  let merged = 0;

  for (const entry of entries) {
    const key = nameKey(entry.displayName);
    if (!key) continue;

    if (usersCache[key]?.groupsSubmittedAt) continue;

    const next = {
      ...(usersCache[key] ?? {
        displayName: entry.displayName.trim(),
        createdAt: Date.now(),
        knockout: {},
        knockoutSubmittedAt: null,
      }),
      displayName: entry.displayName.trim(),
      groups: { ...(usersCache[key]?.groups ?? {}), ...entry.groups },
      groupsSubmittedAt: entry.groupsSubmittedAt ?? Date.now(),
    };

    usersCache[key] = next;
    await upsertPlayer(next);
    merged += 1;
  }

  return merged;
}
