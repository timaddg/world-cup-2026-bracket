import { runCronSyncResults } from "../../lib/cron-sync-handler.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  if (request.headers.get("x-netlify-event") === "schedule") return true;

  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${cronSecret}`;
}

export default async (request) => {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { status, body } = await runCronSyncResults();
    return json(body, status);
  } catch (err) {
    return json({ error: String(err.message ?? err) }, 500);
  }
};
