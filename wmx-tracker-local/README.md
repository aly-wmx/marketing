# WMX Marketing Tracker — realtime, Supabase-backed, deployable

A real, running copy of the WMX tracker with:
- **Persistence** — saved to Supabase, not just one browser
- **Realtime sync** — when someone else saves, you see it live (or get asked before it overwrites your unsaved edits)
- **Per-user attribution** — every save records who made it ("Last edited by Aly · 2:14 PM")
- **Ticket assignment notifications** — assign a new ticket to a teammate and they get a live in-app banner (plus a desktop notification if their tab is in the background), a Slack message, and an email — all three fire automatically from a database trigger the instant a ticket's assignee is set or changed, not just from the client that made the change.
- **Social Media Hub** — pick a business, pick a platform (Facebook/Instagram/LinkedIn/TikTok), see followers + engagement for that combo with week-over-week deltas and trend sparklines, backed by the `brands`/`platforms`/`weekly_snapshots` tables already provisioned in Supabase (manual entry for now, ready for an automated API sync later)
- **Real login** — Supabase Auth gates the app: Google OAuth or an email/password account, not just a name label. Every table's RLS policy requires an authenticated session, so the data is actually protected, not just hidden behind a UI screen.
- **Tickets with priority, due dates, and comments** — filterable by business/priority/title, sorted by priority then due date within each column. New tickets open in a labeled popup form; cards are drag-and-droppable directly between Open/In Progress/Resolved; reassigning a ticket (from the card itself, not just at creation) automatically notifies the new assignee.
- **Activity feed** — a live log of discrete actions (status changes, ticket moves, comments, follower counts logged) across the whole app, not just a single "last edited by" line.
- **CSV export** — an "Export CSV" button on the KPIs and Social Media Hub tabs downloads the current data (all businesses) for a leadership update, no screenshotting required.
- **Editable Stack and SaaS & Billing** — both are now inline-editable tables (business toggle-pills, Add/Remove row) instead of static read-only lists, synced and autosaved the same as everything else.
- **Team filter** — a "filter by person" dropdown to see one teammate's card instead of the whole roster.
- **Admin tab** (admin-only) — lists every real account (via `admin_set_role`/`admin_list_users`, both `security definer` Postgres functions that re-check admin status server-side) with an editable access-level dropdown per row, so any existing account's role can be changed directly, plus a way to pre-authorize an email that hasn't signed in yet.
- **Real branding** — the actual WMX crest (`src/assets/wmx-crest.png`) replaces the placeholder "W" mark in both the sidebar and the redesigned login screen.
- **Quick-create a ticket from anywhere** — a "New Ticket" button under the sidebar logo jumps to Tickets and opens the popup form directly, no need to switch tabs first.
- **Overview dashboard** — the default landing tab, led by marketing-outcome numbers (KPIs behind target, portfolio-wide follower growth for the latest week) ahead of the operational ones (portfolio setup %, open tickets, monthly SaaS spend, team size), plus a per-business setup ring you can click into and the 6 most recent activity-log entries.
- **Mobile-friendly data tables** — Stack, SaaS & Billing, and KPIs collapse from a table into stacked labeled fields under 720px instead of forcing horizontal scroll.
- **KPI attainment at a glance** — every metric row gets an On target / Close / Behind badge computed from Current vs. Target (parsed out of the free-text values), and each category header shows how many of its metrics are behind without needing to expand it.
- **Social Media Hub portfolio comparison** — a table above the per-business drill-down shows every business × platform combo's latest followers/engagement and week-over-week deltas at once; click a row to jump into that combo's detail and trend lines.
- **Overdue tickets are flagged on the card itself** — an "Overdue" badge next to the priority pill, not just a color change buried in the metadata line.
- **SaaS spend by business** — chips above the SaaS & Billing table show monthly spend touching each business (a shared tool counts fully toward each business it serves, so these don't sum back to the total — they answer "how much is being spent on this business's stack," not "what's this business's exclusive share").
- **Marketing-shaped ticket types** — Campaign and Content join Request/Question/Idea/Issue, so deadline-driven marketing work isn't lumped in with generic requests.
- **Search on Stack, SaaS & Billing, and KPIs** — matches Tickets' search; KPIs search also auto-expands any category with a match.
- **Tickets table view** — a Board/Table toggle next to "New ticket"; Table lists every filtered ticket as one sortable, word-wrapping grid (click a column header to sort by it) instead of three drag-and-drop columns — better for scanning a long list, while the board stays the default for day-to-day status moves.
- **Edit and delete from the table** — each row's Actions column has an edit icon (opens a popup with every field, including status — saving stamps a real "last updated" timestamp + who) and a delete icon that requires typing DELETE to confirm before anything is removed.
- **Import/Export tickets as CSV** — Export downloads the currently filtered tickets; Import reads a CSV back in, matching rows to existing tickets by their ID column (updating them) and creating new tickets for any row without a recognized ID — so a spreadsheet round-trip (bulk edit in Excel/Sheets, re-import) works without hand-editing the app. The Import button opens a guide (column meanings, accepted values, a "Download sample CSV" template) before you pick a file, so the format doesn't have to be guessed or reverse-engineered from an export.

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

### Slack + email ticket notifications (one-time setup)

Assigning (or reassigning) a ticket pushes to Slack and email automatically,
via a Postgres trigger (`dispatch_ticket_notification`, in `schema.sql`)
that calls the `notify-ticket` Edge Function (`supabase/functions/notify-ticket/`).

1. **Slack**: `api.slack.com/apps` → Create New App → *Blank app* → pick your
   workspace → **Features → Incoming Webhooks** → activate → **Add New
   Webhook to Workspace** → pick a channel → copy the webhook URL.
2. **Email**: sign up at `resend.com` (free tier) → **API Keys** → create
   one. Sending is sandboxed to your own Resend account's email until you
   verify a sending domain under **Domains** — do that before relying on
   this for the whole team.
3. **Who gets emailed / mentioned**: the `team_contacts` table maps a ticket
   assignee's name (as it appears in the Team tab / assignee dropdown) to
   their email, and optionally their Slack member ID (`slack_user_id` — from
   their Slack profile's "..." menu → Copy member ID). With it set, the
   Slack message uses a real `<@USER_ID>` mention that pings them instead of
   just naming them in text. Add/update rows there as the roster changes —
   there's no UI for it yet.
4. Fill in `SLACK_WEBHOOK_URL`, `RESEND_API_KEY`, and a `WEBHOOK_SECRET`
   (any random string) at the top of `supabase/functions/notify-ticket/index.ts`,
   deploy it (`supabase functions deploy notify-ticket` or via the
   dashboard), then put the **same** `WEBHOOK_SECRET` into
   `dispatch_ticket_notification()` in `schema.sql` and re-run that
   function's `create or replace`. The two secrets have to match — the
   function rejects any call whose `x-webhook-secret` header doesn't equal it.

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

- **Slack/Resend credentials are embedded in the deployed Edge Function
  source, not stored as env secrets.** No secrets-manager tool was
  available to set them properly. Not exposed to the browser (Edge
  Functions run server-side), but rotating them means editing and
  redeploying the function rather than just updating a secret. Also,
  email delivery is sandboxed to one address until a sending domain is
  verified in Resend — see the setup section above.
- **Roles are mixed: real for Accounts & Logins, UI-level everywhere else.**
  Admins get a `role: admin` tag stamped into their account automatically on
  sign-up if their email is in `public.app_admins` — managed from the app's
  own **Admin** tab now (admin-only), not just by running SQL. Accounts & Logins now lives in its own
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
