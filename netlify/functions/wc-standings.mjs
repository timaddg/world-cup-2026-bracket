import { handleWcStandings } from "../../lib/wc-standings-handler.mjs";

const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(request.url);
    const { status, body } = await handleWcStandings(url.searchParams);
    return json(body, status);
  } catch (err) {
    return json({ error: String(err.message ?? err) }, 500);
  }
};
