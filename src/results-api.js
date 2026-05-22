import { apiTeamToOurId } from "./team-map.js";

const GROUP_IDS = "ABCDEFGHIJKL".split("");

function extractGroupId(raw) {
  if (!raw) return null;
  const m = String(raw).match(/([A-L])\s*$/i) || String(raw).match(/^([A-L])$/i);
  return m ? m[1].toUpperCase() : null;
}

export function getResultsApiProvider() {
  const key = import.meta.env.VITE_API_FOOTBALL_KEY ?? "";
  if (key.startsWith("wc26_")) return "wc2026";
  if (key) return "api-football";
  return null;
}

export function isResultsApiConfigured() {
  return Boolean(getResultsApiProvider());
}

/** WC2026 API — https://api.wc2026api.com */
function sortWc2026Standings(rows) {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      a.team_name.localeCompare(b.team_name)
  );
}

export function parseWc2026Group(payload) {
  const groupId = extractGroupId(payload?.name);
  if (!groupId) throw new Error("Invalid WC2026 group response");

  const sorted = sortWc2026Standings(payload.standings ?? []);
  const order = [];

  for (const row of sorted) {
    const id = apiTeamToOurId({ name: row.team_name, code: row.team_code });
    if (!id) {
      throw new Error(
        `Could not map team "${row.team_name}" in Group ${groupId}. Add an alias in team-map.js.`
      );
    }
    if (!order.includes(id)) order.push(id);
  }

  if (order.length !== 4) {
    throw new Error(`Group ${groupId}: expected 4 teams, got ${order.length}`);
  }

  return { groupId, order };
}

export async function fetchWc2026GroupResults() {
  const groups = {};

  for (const groupId of GROUP_IDS) {
    const res = await fetch(`/api/wc-standings?group=${groupId}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Failed to fetch group ${groupId} (${res.status})`);
    }
    const payload = await res.json();
    const { order } = parseWc2026Group(payload);
    groups[groupId] = order;
  }

  return groups;
}

/**
 * Parse API-Football standings response into our groupResults shape.
 */
export function parseApiFootballStandings(payload) {
  const block = payload?.response?.[0]?.league?.standings ?? payload?.response?.[0]?.standings;

  if (!block?.length) {
    throw new Error(
      "No group standings in API response. The group stage may not be finished yet."
    );
  }

  const groups = {};

  for (const item of block) {
    let rows;
    let groupId;

    if (Array.isArray(item)) {
      rows = item;
      groupId = extractGroupId(rows[0]?.group);
    } else if (item.table) {
      rows = item.table;
      groupId = extractGroupId(item.group ?? item.name);
    } else {
      continue;
    }

    if (!groupId) continue;

    const sorted = [...rows].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    const order = [];

    for (const row of sorted) {
      const id = apiTeamToOurId(row.team);
      if (!id) {
        throw new Error(
          `Could not map team "${row.team?.name}" in Group ${groupId}. Add an alias in team-map.js.`
        );
      }
      if (!order.includes(id)) order.push(id);
    }

    if (order.length !== 4) {
      throw new Error(
        `Group ${groupId}: expected 4 teams, got ${order.length}. Standings may still be updating.`
      );
    }

    groups[groupId] = order;
  }

  const missing = GROUP_IDS.filter((id) => !groups[id]);
  if (missing.length) {
    throw new Error(
      `Missing groups in API data: ${missing.join(", ")}. Try again after more matches are played.`
    );
  }

  return groups;
}

function formatApiErrors(errors) {
  if (!errors || typeof errors !== "object") return null;
  const messages = Object.entries(errors)
    .filter(([, v]) => v)
    .map(([k, v]) => (k === "plan" ? String(v) : `${k}: ${v}`));
  return messages.length ? messages.join(" ") : null;
}

export async function fetchApiFootballStandings() {
  const season = import.meta.env.VITE_API_FOOTBALL_SEASON || "2026";
  const url = `/api/wc-standings?provider=api-football&season=${season}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API request failed (${res.status})`);
  }

  const payload = await res.json();
  const apiError = formatApiErrors(payload.errors);

  if (apiError) {
    throw new Error(
      `${apiError} For World Cup 2026 on the free plan, use manual JSON in Admin, or use a WC2026 API key (wc26_…).`
    );
  }

  if (!payload.response?.length) {
    throw new Error(
      "No standings returned yet. The group stage may not be finished, or this season is not on your API plan."
    );
  }

  return payload;
}

export async function fetchGroupResultsFromApi() {
  const provider = getResultsApiProvider();

  if (!provider) {
    throw new Error(
      "Add VITE_API_FOOTBALL_KEY to .env (WC2026 API key from wc2026api.com or API-Football)"
    );
  }

  if (provider === "wc2026") {
    return fetchWc2026GroupResults();
  }

  const payload = await fetchApiFootballStandings();
  return parseApiFootballStandings(payload);
}
