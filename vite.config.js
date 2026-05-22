import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      {
        name: "google-sheet-proxy",
        configureServer(server) {
          server.middlewares.use("/api/google-sheet", async (req, res) => {
            try {
              const url = new URL(req.url ?? "", "http://localhost").searchParams.get("url");
              if (!url || !url.startsWith("https://docs.google.com/")) {
                res.statusCode = 400;
                res.end("Missing or invalid sheet url");
                return;
              }
              const response = await fetch(url);
              const text = await response.text();
              res.setHeader("Content-Type", "text/csv; charset=utf-8");
              res.statusCode = response.ok ? 200 : response.status;
              res.end(text);
            } catch (err) {
              res.statusCode = 500;
              res.end(String(err.message ?? err));
            }
          });
        },
      },
      {
        name: "wc-standings-proxy",
        configureServer(server) {
          server.middlewares.use("/api/wc-standings", async (req, res) => {
            const key = env.VITE_API_FOOTBALL_KEY;
            if (!key) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "VITE_API_FOOTBALL_KEY missing in .env" }));
              return;
            }

            try {
              const url = new URL(req.url ?? "", "http://localhost");
              const group = url.searchParams.get("group");
              const provider =
                url.searchParams.get("provider") ||
                (key.startsWith("wc26_") ? "wc2026" : "api-football");

              let response;

              if (provider === "wc2026") {
                if (!group) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "Missing ?group=A parameter" }));
                  return;
                }
                response = await fetch(`https://api.wc2026api.com/groups/${group}`, {
                  headers: { Authorization: `Bearer ${key}` },
                });
              } else {
                const season = env.VITE_API_FOOTBALL_SEASON || "2026";
                response = await fetch(
                  `https://v3.football.api-sports.io/standings?league=1&season=${season}`,
                  { headers: { "x-apisports-key": key } }
                );
              }

              const text = await response.text();
              res.setHeader("Content-Type", "application/json");
              res.statusCode = response.status;
              res.end(text);
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: String(err.message ?? err) }));
            }
          });
        },
      },
    ],
  };
});
