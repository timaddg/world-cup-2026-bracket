/**
 * Vercel Cron: daily group standings sync during the group stage.
 * Schedule in vercel.json: 10:00 UTC on June 11–27.
 */
import { runCronSyncResults } from "../lib/cron-sync-handler.mjs";

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  try {
    const { status, body } = await runCronSyncResults();
    res.status(status).json(body);
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
}
