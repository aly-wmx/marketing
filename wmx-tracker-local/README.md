# WMX Portfolio Control — realtime, Supabase-backed, deployable

A real, running copy of the WMX tracker with:
- **Persistence** — saved to Supabase, not just one browser
- **Realtime sync** — when someone else saves, you see it live (or get asked before it overwrites your unsaved edits)
- **Per-user attribution** — every save records who made it ("Last edited by Aly · 2:14 PM")
- **Ticket assignment notifications** — assign a new ticket to a teammate and they get a live in-app banner (plus a desktop notification if their tab is in the background and they've allowed it)
- **Social Media Hub** — a tab for tracking follower counts per brand/platform, backed by the `brands`/`platforms`/`weekly_snapshots` tables already provisioned in Supabase (manual entry for now, week-over-week deltas, ready for an automated API sync later)

## 1. Create a Supabase project (free tier is fine)

1. https://supabase.com → sign in → **New project**. Name it (e.g. `wmx-tracker`), set a DB password, pick a region. Wait ~2 min.

## 2. Create the table + enable realtime

1. **SQL Editor → New query** → paste in `supabase/schema.sql` → **Run**.
   This creates `tracker_state` (one JSON-blob row, plus `updated_by`/`updated_at`) and
   `ticket_notifications` (one row per ticket assignment), sets an open RLS policy on
   both so the app works immediately, and adds both tables to Supabase's realtime
   publication (required — realtime is off per-table by default).

## 3. Connect the app

1. **Project Settings → API** → copy the **Project URL** and the **`anon` `public`** key.
2. `cp .env.example .env.local`, then fill in:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
   ```

## 4. Run it locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. First thing you'll see: a "Who's this?" prompt —
pick your name (or type one). It's stored in your browser only and gets
attached to your saves so teammates know who changed what.

**To test realtime**: open the app in two browser tabs (or two browsers),
pick a different name in each. Toggle a status and Save in one tab — the
other tab updates live if it has no unsaved changes of its own, or shows a
banner ("Aly saved changes — reload to see theirs, or keep working") if it does.

## 5. Deploy it live on Vercel

```bash
npm i -g vercel
vercel
```

Follow the prompts (link/create a project). Then in the Vercel dashboard for
that project: **Settings → Environment Variables** → add the same two
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values (Vercel doesn't read
your local `.env.local`). Redeploy (`vercel --prod`) and you have a real URL
anyone on the team can open.

## How the realtime piece actually works

- Every browser tab opens a Supabase Realtime channel subscribed to
  `postgres_changes` on the `tracker_state` row.
- When *anyone* saves, Supabase pushes that update to every open tab within
  ~1 second.
- If your tab has **no unsaved changes**, it just applies the incoming update
  silently — your screen now matches what was just saved.
- If your tab **does** have unsaved changes, it doesn't clobber them — you get
  a banner to either reload their version or keep working and overwrite with
  yours on your next Save. This is "last write wins with a warning," not
  true field-level merging — good enough for a small team, not built for
  heavy simultaneous editing of the exact same field.

## Known limits (be aware of these before relying on it)

- **No real auth.** Anyone with the app URL and anon key can read/write.
  "Who's this?" is a name label, not a login — it doesn't stop anyone from
  typing someone else's name. Fine for an internal tool on a private URL;
  add Supabase Auth before this is public-facing.
- **One shared row, not normalized tables.** Simplest possible model to get
  realtime + attribution working fast. If this grows past a small team, the
  fuller relational schema in `wmx-tracker-build-spec.md` (separate tables
  per tab, per-row history) is the next real step — it lets you show
  "who changed *this specific ticket*" instead of "who changed *something*."
- **Passwords in Accounts & Logins are still plaintext** in the JSON blob,
  same caveat as before. Don't put anything actually sensitive in there until
  it's moved to an encrypted column with RLS scoped to authenticated users.
- **Ticket notifications only reach an open tab**, not a closed browser or a
  phone that doesn't have the app open — this is a realtime in-app/desktop
  notification, not true push notifications (which need a service worker,
  VAPID keys, and a backend to send them while the browser is fully closed).

## Project structure

```
wmx-tracker-local/
├── .env.example
├── index.html
├── package.json
├── vite.config.js
├── supabase/
│   └── schema.sql        — table + RLS policy + realtime publication
└── src/
    ├── main.jsx
    ├── supabaseClient.js
    └── App.jsx            — tabs (including Social Media Hub), identity prompt, realtime subscription, Save
```
