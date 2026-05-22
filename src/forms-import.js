import { getAllTeams, getGroups } from "./data.js";
import { isGroupComplete } from "./groups.js";

const GROUP_IDS = "ABCDEFGHIJKL".split("");
const POSITIONS = ["1st", "2nd", "3rd", "4th"];

/** Names as they appear on the Google Form → internal team id */
const TEAM_ALIASES = {
  "korea republic": "KOR",
  "south korea": "KOR",
  czechia: "CZE",
  "czech republic": "CZE",
  turkiye: "TUR",
  turkey: "TUR",
  "cote divoire": "CIV",
  "côte d'ivoire": "CIV",
  "ivory coast": "CIV",
  "ir iran": "IRN",
  iran: "IRN",
  "cabo verde": "CPV",
  "cape verde": "CPV",
  "congo dr": "COD",
  "dr congo": "COD",
  usa: "USA",
  "united states": "USA",
};

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['']/g, "'");
}

function buildTeamLookup() {
  const lookup = new Map();
  for (const team of getAllTeams()) {
    lookup.set(normalize(team.name), team.id);
  }
  for (const [alias, id] of Object.entries(TEAM_ALIASES)) {
    lookup.set(normalize(alias), id);
  }
  return lookup;
}

function resolveTeamId(label, lookup) {
  if (!label?.trim()) return null;
  return lookup.get(normalize(label)) ?? null;
}

/** Parse CSV with quoted fields */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  if (rows.length < 2) return { headers: [], rows: [] };

  const headers = rows[0];
  const dataRows = rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    return obj;
  });

  return { headers, rows: dataRows };
}

function findNameColumn(headers) {
  const idx = headers.findIndex((h) => /your name|^name$/i.test(h.trim()));
  return idx >= 0 ? headers[idx] : headers[1] ?? headers[0];
}

function extractGroupId(text) {
  const m = String(text).match(/group\s*([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}

function extractPosition(text) {
  const m = String(text).match(/\b(1st|2nd|3rd|4th)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function detectColumnLayout(headers, lookup) {
  const nameCol = findNameColumn(headers);
  const byGroup = Object.fromEntries(GROUP_IDS.map((id) => ({ id, byPosition: {}, byTeam: {} })));

  for (const header of headers) {
    if (header === nameCol) continue;
    if (/^timestamp$/i.test(header.trim())) continue;

    const groupId = extractGroupId(header);
    if (!groupId) continue;

    const pos = extractPosition(header);
    const g = byGroup[groupId];

    if (pos) {
      g.byPosition[pos] = header;
      continue;
    }

    let teamPart = header.split(/[[\]]/)[0].split(/group/i)[0].trim();
    const groupFirst = header.match(/^group\s*([A-L])\s*[-:]\s*(.+)$/i);
    if (groupFirst) {
      teamPart = groupFirst[2].trim();
    }
    const teamId = resolveTeamId(teamPart, lookup);
    if (teamId) {
      g.byTeam[header] = teamId;
    }
  }

  return { nameCol, byGroup };
}

function buildGroupOrderFromRow(row, groupId, layout, lookup, errors) {
  const g = layout.byGroup[groupId];
  const order = [null, null, null, null];

  const posHeaders = Object.keys(g.byPosition);
  if (posHeaders.length >= 4) {
    for (const [posLabel, header] of Object.entries(g.byPosition)) {
      const idx = POSITIONS.indexOf(posLabel);
      if (idx < 0) continue;
      const teamId = resolveTeamId(row[header], lookup);
      if (teamId) order[idx] = teamId;
    }
  }

  const teamHeaders = Object.keys(g.byTeam);
  if (teamHeaders.length >= 4) {
    for (const [header, teamId] of Object.entries(g.byTeam)) {
      const posLabel = normalize(row[header]);
      const idx = POSITIONS.findIndex((p) => normalize(p) === posLabel);
      if (idx >= 0) order[idx] = teamId;
    }
  }

  if (order.every(Boolean)) return order;

  errors.push(`Group ${groupId}: could not read all 4 positions`);
  return null;
}

/**
 * Parse Google Form / Sheets CSV into user entries.
 * Supports column layouts from the FIFA World Coup Group Stages form.
 */
export function parseFormResponsesCsv(csvText) {
  const lookup = buildTeamLookup();
  const { headers, rows } = parseCsv(csvText);
  const errors = [];
  const warnings = [];

  if (!headers.length) {
    return { entries: [], errors: ["CSV is empty or invalid"], warnings };
  }

  const layout = detectColumnLayout(headers, lookup);
  const entries = [];

  for (const row of rows) {
    const displayName = (row[layout.nameCol] ?? "").trim();
    if (!displayName) continue;

    const groups = {};
    const rowErrors = [];

    for (const groupId of GROUP_IDS) {
      const order = buildGroupOrderFromRow(row, groupId, layout, lookup, rowErrors);
      if (order) groups[groupId] = order;
    }

    const complete = GROUP_IDS.every((id) => isGroupComplete(groups[id]));
    if (!complete) {
      warnings.push(`${displayName}: incomplete groups (${Object.keys(groups).length}/12)`);
    }

    if (Object.keys(groups).length > 0) {
      entries.push({
        displayName,
        groups,
        groupsSubmittedAt: Date.now(),
        importedFrom: "google_forms",
      });
    }

    errors.push(...rowErrors.map((e) => `${displayName}: ${e}`));
  }

  if (!entries.length && !errors.length) {
    errors.push(
      "No responses found. Check that CSV columns include Group A–L and Your Name."
    );
  }

  return { entries, errors, warnings };
}

/** Build a Google Sheets CSV export URL from a spreadsheet link or id */
export function toCsvExportUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (trimmed.includes("export?format=csv")) return trimmed;

  const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return trimmed;

  const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}
