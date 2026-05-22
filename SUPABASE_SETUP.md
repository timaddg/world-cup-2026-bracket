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

Deploy to [Vercel](https://vercel.com) or [Netlify](https://netlify.com) (both have free tiers):

1. Push this folder to GitHub.
2. Import the repo in Vercel/Netlify.
3. Add the same two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Deploy and share the URL with friends.

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
   - **Vercel:** cron at **6:00 AM ET** (`/api/cron-sync-results`) — works even if nobody opens the app
   - **Fallback:** first visit each day also syncs if the last sync was 24+ hours ago
4. **Admin** / **Scores** → manual **Sync** still available anytime

Manual JSON in Admin still works as a backup.

**Deploy on Vercel:** set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_FOOTBALL_KEY`, and optional `CRON_SECRET` (Vercel sets this for cron auth).
