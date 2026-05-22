import { isSupabaseConfigured } from "./supabase.js";
import {
  clearSession,
  getSessionUserName,
  setSessionUserName,
} from "./session.js";
import * as local from "./store-local.js";
import * as remote from "./store-supabase.js";

export { clearSession, getDraftGroups, setDraftGroup, clearDraftGroups } from "./session.js";

let activeBackend = local;
let initError = null;

export function isCloudBackend() {
  return activeBackend === remote;
}

export function getBackendLabel() {
  return isCloudBackend() ? "Supabase (shared)" : "This device only";
}

export function getStoreError() {
  return initError;
}

export async function initStore() {
  initError = null;

  if (isSupabaseConfigured()) {
    try {
      await remote.init();
      activeBackend = remote;
      return;
    } catch (err) {
      initError = err.message ?? String(err);
      console.warn("Supabase unavailable, using local storage:", err);
    }
  }

  activeBackend = local;
  await local.init();
}

export async function refreshStore() {
  if (activeBackend.refresh) await activeBackend.refresh();
  else await activeBackend.init();
}

function bind(name) {
  return (...args) => activeBackend[name](...args);
}

export const getTournamentState = bind("getTournamentState");
export const saveTournamentState = bind("saveTournamentState");
export function getCurrentUserName() {
  return getSessionUserName();
}

export function setCurrentUserName(name) {
  setSessionUserName(name);
}
export const getAllUsers = bind("getAllUsers");
export const getUserEntry = bind("getUserEntry");
export const hasSubmittedGroups = bind("hasSubmittedGroups");
export const areGroupPicksLocked = bind("areGroupPicksLocked");
export const saveUserEntry = bind("saveUserEntry");

export function submitGroupPicksOnce(displayName, groups) {
  return Promise.resolve(activeBackend.submitGroupPicksOnce(displayName, groups));
}

export const listAllUsers = bind("listAllUsers");
export const isGroupStageLocked = bind("isGroupStageLocked");
export const isKnockoutOpen = bind("isKnockoutOpen");
export const isKnockoutLocked = bind("isKnockoutLocked");
export const exportAllData = bind("exportAllData");

export function importAllData(payload) {
  return Promise.resolve(activeBackend.importAllData(payload));
}

export function mergeFormResponses(entries) {
  return Promise.resolve(activeBackend.mergeFormResponses(entries));
}
