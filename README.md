# World Cup 2026 — Friends Prediction Pool

Pick group standings (1st–4th for all 12 groups) in the web app. Each friend's picks sync via **Supabase** (free) so everyone sees the same leaderboard on any phone.

## Quick start (local)

```bash
npm install
cp .env.example .env   # add Supabase keys — see SUPABASE_SETUP.md
npm run dev
```

Open `http://localhost:5173/`

**Without Supabase:** the app still works; picks stay on that browser only.

## Supabase (recommended)

Full steps: **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Put URL + anon key in `.env`
4. Deploy to Vercel/Netlify with the same env vars

## How to play

1. **Home** — Enter a unique display name (one submission per name).
2. **My picks** — Table form for groups A–L → **Save & submit** (locked forever for that name).
3. **Scores** — Leaderboard for everyone in the pool.
4. **Admin** — Enter real group results to calculate points.

## Customize

- `data/groups.json` — teams per group
- `src/config.js` — lock dates, scoring
