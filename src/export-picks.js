import { getTeam, getGroupIds } from "./data.js";

const POSITION_LABELS = ["1st", "2nd", "3rd", "4th"];

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function teamName(teamId) {
  if (!teamId) return "";
  return getTeam(teamId)?.name ?? teamId;
}

/** Rows for one player's group picks (group id + four team names). */
export function buildPicksSummaryRows(groups = {}) {
  return getGroupIds().map((groupId) => {
    const order = groups[groupId];
    const places = Array.isArray(order) && order.length === 4 ? order : [null, null, null, null];
    return {
      group: groupId,
      first: teamName(places[0]),
      second: teamName(places[1]),
      third: teamName(places[2]),
      fourth: teamName(places[3]),
    };
  });
}

export function picksToCsv(user) {
  const lines = [];
  const submittedAt = user.groupsSubmittedAt
    ? new Date(user.groupsSubmittedAt).toISOString()
    : "";

  lines.push(["Display Name", user.displayName ?? ""].map(escapeCsvCell).join(","));
  lines.push(["Submitted At", submittedAt].map(escapeCsvCell).join(","));
  lines.push("");
  lines.push(["Group", ...POSITION_LABELS].map(escapeCsvCell).join(","));

  for (const row of buildPicksSummaryRows(user.groups)) {
    lines.push(
      [row.group, row.first, row.second, row.third, row.fourth].map(escapeCsvCell).join(",")
    );
  }

  return lines.join("\n");
}

export function downloadPicksCsv(user) {
  const csv = picksToCsv(user);
  const safeName = (user.displayName ?? "player")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 32);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `wc2026-picks-${safeName}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
