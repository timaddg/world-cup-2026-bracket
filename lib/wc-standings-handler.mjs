import { getApiKeyFromEnv, getResultsApiProvider } from "./fetch-group-results.mjs";

export async function handleWcStandings(searchParams, apiKey = getApiKeyFromEnv()) {
  if (!apiKey) {
    return { status: 500, body: { error: "API key not configured on server" } };
  }

  const group = searchParams.get("group");
  const provider =
    searchParams.get("provider") || (apiKey.startsWith("wc26_") ? "wc2026" : "api-football");

  if (provider === "wc2026") {
    if (!group) {
      return { status: 400, body: { error: "Missing group query param (A–L)" } };
    }

    const response = await fetch(`https://api.wc2026api.com/groups/${group}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json();
    return { status: response.status, body: data };
  }

  const season = process.env.VITE_API_FOOTBALL_SEASON || "2026";
  const response = await fetch(
    `https://v3.football.api-sports.io/standings?league=1&season=${season}`,
    { headers: { "x-apisports-key": apiKey } }
  );
  const data = await response.json();
  return { status: response.status, body: data };
}

export function isApiConfigured(apiKey = getApiKeyFromEnv()) {
  return Boolean(getResultsApiProvider(apiKey));
}
