const GROUP_IDS = "ABCDEFGHIJKL".split("");

function sortWc2026Standings(rows) {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      String(a.team_name).localeCompare(String(b.team_name))
  );
}

export function getApiKeyFromEnv() {
  return process.env.VITE_API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY || "";
}

export function getResultsApiProvider(apiKey = getApiKeyFromEnv()) {
  if (apiKey.startsWith("wc26_")) return "wc2026";
  if (apiKey) return "api-football";
  return null;
}

export async function fetchWc2026GroupResults(apiKey) {
  const groups = {};

  for (const groupId of GROUP_IDS) {
    const res = await fetch(`https://api.wc2026api.com/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `WC2026 API group ${groupId} failed (${res.status})`);
    }

    const payload = await res.json();
    const sorted = sortWc2026Standings(payload.standings ?? []);
    const order = [];

    for (const row of sorted) {
      const code = row.team_code?.trim().toUpperCase();
      if (!code) {
        throw new Error(`Group ${groupId}: missing team_code for ${row.team_name}`);
      }
      if (!order.includes(code)) order.push(code);
    }

    if (order.length !== 4) {
      throw new Error(`Group ${groupId}: expected 4 teams, got ${order.length}`);
    }

    groups[groupId] = order;
  }

  return groups;
}

export async function fetchGroupResultsFromApiKey(apiKey = getApiKeyFromEnv()) {
  const provider = getResultsApiProvider(apiKey);
  if (!provider) {
    throw new Error("API key not configured (VITE_API_FOOTBALL_KEY)");
  }
  if (provider !== "wc2026") {
    throw new Error("Scheduled sync supports WC2026 API keys (wc26_…) only");
  }
  return fetchWc2026GroupResults(apiKey);
}
