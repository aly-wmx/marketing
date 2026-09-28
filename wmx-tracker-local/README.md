# WMX Portfolio Control — realtime, Supabase-backed, deployable

A real, running copy of the WMX tracker with:
- **Persistence** — saved to Supabase, not just one browser
- **Realtime sync** — when someone else saves, you see it live (or get asked before it overwrites your unsaved edits)
- **Per-user attribution** — every save records who made it ("Last edited by Aly · 2:14 PM")
- **Ticket assignment notifications** — assign a new ticket to a teammate and they get a live in-app banner (plus a desktop notification if their tab is in the background and they've allowed it)
- **Social Media Hub** — a tab for tracking follower counts per brand/platform, backed by the `brands`/`platforms`/`weekly_snapshots` tables already provisioned in Supabase (manual entry for now, week-over-week deltas, a trend sparkline per platform, ready for an automated API sync later)
- **Real login** — Supabase Auth gates the app: Google OAuth or an email/password account, not just a name label. Every table's RLS policy requires an authenticated session, so the data is actually protected, not just hidden behind a UI screen.
- **Tickets with priority, due dates, and comments** — filterable by business/priority/title, sorted by priority then due date within each column. New tickets open in a labeled popup form; cards are drag-and-droppable directly between Open/In Progress/Resolved; reassigning a ticket (from the card itself, not just at creation) automatically notifies the new assignee.
- **Activity feed** — a live log of discrete actions (status changes, ticket moves, comments, follower counts logged) across the whole app, not just a single "last edited by" line.
- **CSV export** — an "Export CSV" button on the KPIs and Social Media Hub tabs downloads the current data (all businesses) for a leadership update, no screenshotting required.

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

Open `http://localhost:5173`. First thing you'll see: a real sign-in screen —
"Continue with Google" or an email/password account (sign-up is restricted to
`@wmx.group` addresses, enforced server-side). Your display name comes
straight from the account — your Google profile name, or the name you give
at sign-up — no separate "who's this" step to get through first. It follows
your account across devices (stored in Supabase Auth's user metadata, not
localStorage). Click the pencil icon next to your name in the sidebar to
change it later, or the sign-out icon to switch accounts. The first time any
account signs in, a short one-time welcome tour walks through the tabs.

### Enabling Google sign-in (one-time setup, do this in the dashboards)

Email/password sign-in works immediately — Supabase enables it by default.
Google sign-in needs two manual steps that can't be done from code:

1. **Google Cloud Console** → APIs & Services → Credentials → **Create
   OAuth client ID** (type: Web application).
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Authorized JavaScript origin: your deployed app's URL (and
     `http://localhost:5173` for local dev)
2. **Supabase Dashboard** → Authentication → Providers → **Google** → paste
   in the Client ID and Client Secret from step 1 → Save.
3. Still in Authentication → URL Configuration, make sure your deployed
   app's URL is listed under **Redirect URLs** (this is what
   `options.redirectTo` in `supabaseClient`'s auth call has to match).

Until that's done, "Continue with Google" will error — email/password still
works fine in the meantime.

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

**If a build fails with `vite: command not found`**: check Project Settings
→ General → Framework Settings → **Install Command**. If "Override" is on
but the box is empty (just gray placeholder text), Vercel skips the install
step entirely — type `npm install` into it and Save. This bit us for weeks
on the `wmx-tracker-live` project: every deploy failed silently on this,
while production stayed frozen on whatever build last succeeded.

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

- **Roles are mixed: real for Accounts & Logins, UI-level everywhere else.**
  Admins (`aly`, `jeff`, `jason`, `nick` @wmx.group — managed via the
  `public.app_admins` table) get a `role: admin` tag stamped into their
  account automatically on sign-up. Accounts & Logins now lives in its own
  `credential_accounts` table with an RLS policy that checks
  `public.is_admin()` — a non-admin account literally cannot read or write
  that table, not just a hidden tab. Deleting tickets and editing the Team
  tab's task statuses are still UI-level only, since tickets/team live in
  the shared `tracker_state.data` JSON blob with one table-wide policy —
  give those their own tables too before this includes people you don't
  fully trust with all of it.
- **One shared row, not normalized tables.** Simplest possible model to get
  realtime + attribution working fast. If this grows past a small team, the
  fuller relational schema in `wmx-tracker-build-spec.md` (separate tables
  per tab, per-row history) is the next real step — it lets you show
  "who changed *this specific ticket*" instead of "who changed *something*."
- **Passwords in Accounts & Logins are still plaintext** in the
  `credential_accounts` table — RLS now restricts who can query that table
  to admins, but the values themselves aren't encrypted at rest. Don't put
  anything highly sensitive in there until that's moved to an encrypted
  column (e.g. via Supabase Vault).
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
