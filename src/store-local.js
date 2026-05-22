import { gameConfig } from "./config.js";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultTournamentState() {
  return {
    phase: "groups_open",
    groupResults: {},
    knockoutFixtures: {},
    knockoutResults: {},
    googleSheetCsvUrl: gameConfig.googleSheetCsvUrl || "",
    lastFormSyncAt: null,
    lastFormSyncCount: 0,
  };
}

export async function init() {
  /* no-op for local */
}

export function getTournamentState() {
  return readJson(gameConfig.storageKeys.state, defaultTournamentState());
}

export function saveTournamentState(state) {
  writeJson(gameConfig.storageKeys.state, state);
}

export function getCurrentUserName() {
  return localStorage.getItem(gameConfig.storageKeys.currentUser) || "";
}

export function setCurrentUserName(name) {
  localStorage.setItem(gameConfig.storageKeys.currentUser, name.trim());
}

export function getAllUsers() {
  return readJson(gameConfig.storageKeys.users, {});
}

function saveAllUsers(users) {
  writeJson(gameConfig.storageKeys.users, users);
}

export function getUserEntry(displayName) {
  const key = displayName.trim().toLowerCase();
  return getAllUsers()[key] ?? null;
}

export function hasSubmittedGroups(displayName) {
  return !!getUserEntry(displayName)?.groupsSubmittedAt;
}

export function areGroupPicksLocked(entry) {
  if (!entry) return false;
  return !!entry.groupsSubmittedAt || isGroupStageLocked();
}

export function saveUserEntry(displayName, patch) {
  const key = displayName.trim().toLowerCase();
  const users = getAllUsers();
  const existing = users[key] ?? {
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
    users[key] = { ...existing, ...allowed, displayName: displayName.trim() };
    saveAllUsers(users);
    return users[key];
  }

  users[key] = { ...existing, ...patch, displayName: displayName.trim() };
  saveAllUsers(users);
  return users[key];
}

export function submitGroupPicksOnce(displayName) {
  const key = displayName.trim().toLowerCase();
  const entry = getUserEntry(displayName);

  if (!entry) {
    return { ok: false, reason: "No picks found. Complete the form first." };
  }

  if (entry.groupsSubmittedAt) {
    return { ok: false, reason: "already_submitted" };
  }

  if (isGroupStageLocked()) {
    return { ok: false, reason: "Group stage is locked." };
  }

  const users = getAllUsers();
  users[key] = { ...entry, groupsSubmittedAt: Date.now() };
  saveAllUsers(users);
  return { ok: true, entry: users[key] };
}

export function listAllUsers() {
  return Object.values(getAllUsers()).map((u) => ({
    displayName: u.displayName,
    groupsSubmittedAt: u.groupsSubmittedAt,
    knockoutSubmittedAt: u.knockoutSubmittedAt,
    groupProgress: Object.keys(u.groups || {}).length,
  }));
}

export function isGroupStageLocked() {
  const state = getTournamentState();
  if (state.phase !== "groups_open") return true;
  return Date.now() >= new Date(gameConfig.groupLockAt).getTime();
}

export function isKnockoutOpen() {
  const state = getTournamentState();
  if (state.phase === "knockout_open" || state.phase === "knockout_locked") return true;
  if (state.phase === "scored") return true;
  return Date.now() >= new Date(gameConfig.knockoutOpensAt).getTime();
}

export function isKnockoutLocked() {
  const state = getTournamentState();
  return state.phase === "knockout_locked" || state.phase === "scored";
}

export function exportAllData() {
  return {
    users: getAllUsers(),
    state: getTournamentState(),
    exportedAt: new Date().toISOString(),
  };
}

export function importAllData(payload) {
  if (!payload?.users) throw new Error("Invalid backup file");
  writeJson(gameConfig.storageKeys.users, payload.users);
  if (payload.state) writeJson(gameConfig.storageKeys.state, payload.state);
}

export function mergeFormResponses(entries) {
  const users = getAllUsers();
  let merged = 0;

  for (const entry of entries) {
    const key = entry.displayName.trim().toLowerCase();
    if (!key) continue;

    const existing = users[key];
    if (existing?.groupsSubmittedAt) continue;

    users[key] = {
      ...(existing ?? {
        displayName: entry.displayName.trim(),
        createdAt: Date.now(),
        knockout: {},
        knockoutSubmittedAt: null,
      }),
      displayName: entry.displayName.trim(),
      groups: { ...(existing?.groups ?? {}), ...entry.groups },
      groupsSubmittedAt: entry.groupsSubmittedAt ?? Date.now(),
      importedFrom: entry.importedFrom ?? "google_forms",
    };
    merged += 1;
  }

  saveAllUsers(users);
  return merged;
}
