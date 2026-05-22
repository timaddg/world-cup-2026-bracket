/** In-memory only — cleared on page refresh. */

let currentUserName = "";
let draftGroups = {};

export function getSessionUserName() {
  return currentUserName;
}

export function setSessionUserName(name) {
  currentUserName = String(name ?? "").trim();
  if (!currentUserName) draftGroups = {};
}

export function getDraftGroups() {
  return draftGroups;
}

export function setDraftGroup(groupId, order) {
  draftGroups = { ...draftGroups, [groupId]: order };
}

export function clearDraftGroups() {
  draftGroups = {};
}

export function clearSession() {
  currentUserName = "";
  draftGroups = {};
}
