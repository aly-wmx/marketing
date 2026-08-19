# WMX Portfolio Control — local dev server + Supabase

This is a real, runnable copy of the WMX tracker, wired to Supabase so progress
is saved for real and shared across anyone using the app — not just one browser.

## 1. Create a Supabase project (free tier is fine)

1. Go to https://supabase.com and sign in / sign up.
2. **New project** → pick an org, name it (e.g. `wmx-tracker`), set a database password, choose a region.
3. Wait ~2 minutes for it to provision.

## 2. Create the table

1. In your new project, go to **SQL Editor → New query**.
2. Paste in the contents of `supabase/schema.sql` (in this folder) and click **Run**.
   This creates one table, `tracker_state`, that holds the whole app's data as a
   single JSON blob under the row `id = 'default'` — same shape the app already
   uses internally, so no data-model translation needed.

## 3. Connect the app to your project

1. In Supabase: **Project Settings → API**. Copy the **Project URL** and the
   **`anon` `public`** key (not the `service_role` key — that one must never
   ship in frontend code).
2. In this folder, copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
3. Paste your values into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
   ```

## 4. Run it

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). The **Save changes**
button now writes straight to your Supabase table — check **Table Editor →
tracker_state** in the Supabase dashboard and you'll see the `data` column
update after you click it.

## What this does and doesn't give you yet

- ✅ Real persistence, survives restarts, shared across anyone who runs the app
  against the same Supabase project.
- ✅ No secrets in the artifact/preview — your keys stay in `.env.local`, which
  is already gitignored.
- ⚠️ **No auth yet.** The RLS policy in `schema.sql` is wide open (`using (true)`)
  so the app works immediately. Anyone with your anon key can read/write the
  table. Fine for a private internal tool; add Supabase Auth before this is
  reachable by anyone outside your team.
- ⚠️ **Single shared row, not per-user.** Everyone editing sees the same data —
  there's no "my view" vs "your view" yet, and no realtime push (you'll see
  someone else's changes on your next Save/reload, not instantly). Both are
  natural next additions once this is deployed.

## Deploying (so it's not just localhost)

This is a standard Vite + React app, so it deploys to Vercel with no extra
config:

```bash
npm i -g vercel
vercel
```

Add the same two `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values as
Environment Variables in the Vercel project settings (Vercel won't read your
local `.env.local`).

## Project structure

```
wmx-tracker-local/
├── .env.example          — copy to .env.local and fill in your Supabase values
├── index.html
├── package.json
├── vite.config.js
├── supabase/
│   └── schema.sql        — run once in Supabase's SQL Editor
└── src/
    ├── main.jsx           — React entry point
    ├── supabaseClient.js  — Supabase client, reads the env vars above
    └── App.jsx            — the tracker itself (all 7 tabs, Save button)
```
