/**
 * Proxy for World Cup standings APIs (WC2026 API or API-Football).
 * Set VITE_API_FOOTBALL_KEY in deployment env (works for wc26_… or API-Football keys).
 */
export default async function handler(req, res) {
  const key = process.env.VITE_API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY;

  if (!key) {
    res.status(500).json({ error: "API key not configured on server" });
    return;
  }

  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const group = url.searchParams.get("group");
    const provider =
      url.searchParams.get("provider") ||
      (key.startsWith("wc26_") ? "wc2026" : "api-football");

    if (provider === "wc2026") {
      if (!group) {
        res.status(400).json({ error: "Missing group query param (A–L)" });
        return;
      }
      const response = await fetch(`https://api.wc2026api.com/groups/${group}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await response.json();
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(response.status).json(data);
      return;
    }

    const season = process.env.VITE_API_FOOTBALL_SEASON || "2026";
    const response = await fetch(
      `https://v3.football.api-sports.io/standings?league=1&season=${season}`,
      { headers: { "x-apisports-key": key } }
    );
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
}
