import { defineConfig } from "vite";

export default defineConfig({
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
  ],
});
