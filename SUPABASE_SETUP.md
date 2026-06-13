# Supabase setup (free backend)

Follow these steps once. After that, every phone using your deployed site shares the same picks and leaderboard.

## 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign up (free).
2. **New project** → pick a name and password → choose a region close to you.
3. Wait until the project is ready (~2 minutes).

## 2. Create the database tables

1. In the dashboard, open **SQL Editor**.
2. Click **New query**.
3. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and paste it in.
4. Click **Run**. You should see “Success”.

**Already created the tables earlier?** Also run [`supabase/migration-group-results-sync.sql`](./supabase/migration-group-results-sync.sql) so daily sync can record last sync time.

## 3. Get your API keys

1. **Project Settings** (gear icon) → **API**.
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`  
   (Use the `anon` key, **not** the `service_role` key.)

## 4. Configure the app

In the project folder:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Restart the dev server:

```bash
npm install
npm run dev
```

The footer should say **Storage: Supabase (shared)**.

## 5. Deploy (so friends can use it on their phones)

### Netlify (e.g. wc2026bayarea.netlify.app)

1. Push this folder to GitHub and connect the repo in [Netlify](https://netlify.com).
2. Build settings are in [`netlify.toml`](./netlify.toml) (`npm run build`, publish `dist`).
3. **Site configuration → Environment variables** — add:

| Variable | Required for |
|----------|----------------|
| `VITE_SUPABASE_URL` | Picks + leaderboard |
| `VITE_SUPABASE_ANON_KEY` | Picks + leaderboard |
| `VITE_API_FOOTBALL_KEY` | Sync button in app (shows in build) |
| `API_FOOTBALL_KEY` | Same WC2026 key for **server functions** (recommended — keeps key off client if you remove `VITE_` later) |

4. **Trigger deploy → Clear cache and deploy** (env vars are baked in at build time).
5. Footer should say **Storage: Supabase (shared)**.
6. **Admin** or **Scores** → **Sync FIFA group results** should work (`/api/wc-standings` via Netlify Function).
7. **Daily auto-sync** runs at **10:00 UTC** (~6:00 AM ET) Jun 11–27 via Netlify scheduled function.

### Vercel

1. Import the repo in [Vercel](https://vercel.com).
2. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_FOOTBALL_KEY`, optional `CRON_SECRET`.
3. Deploy — cron is configured in [`vercel.json`](./vercel.json).

## How it works

| Feature | Behavior |
|---------|----------|
| Picks | Saved in `players` table, one row per display name |
| Submit once | Database policy blocks edits after `groups_submitted_at` is set |
| Leaderboard | All devices read the same `players` + `tournament` rows |
| Admin results | Stored in `tournament` table (id = 1) |

## Troubleshooting

- **“Could not connect”** — Wrong URL/key, or `schema.sql` not run.
- **Submit fails** — Name may already be submitted; each display name is unique.
- **Still says “This device only”** — `.env` missing or dev server not restarted after adding `.env`.

## Cost

Supabase **free tier** is enough for a friends pool (thousands of rows, well within limits).

## Auto group results (WC2026 API)

1. Add to `.env`: `VITE_API_FOOTBALL_KEY=wc26_…` (from [wc2026api.com](https://wc2026api.com))
2. Restart `npm run dev`
3. **Daily auto-sync** runs **June 11–27, 2026** (America/New_York):
   - **Netlify:** scheduled function at **10:00 UTC** (~6:00 AM ET)
   - **Vercel:** cron at **10:00 UTC** on June 11–27
   - **Fallback:** first visit each day also syncs if the last sync was 24+ hours ago
4. **Admin** / **Scores** → manual **Sync** still available anytime

Manual JSON in Admin still works as a backup.

**Troubleshooting sync:** Run [`supabase/migration-group-results-sync.sql`](./supabase/migration-group-results-sync.sql). On Netlify, confirm `/api/wc-standings?group=A` returns JSON (not 404).
