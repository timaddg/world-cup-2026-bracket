/**
 * Vercel serverless: WC2026 / API-Football standings proxy.
 */
import { handleWcStandings } from "../lib/wc-standings-handler.mjs";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const { status, body } = await handleWcStandings(url.searchParams);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(status).json(body);
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
}
