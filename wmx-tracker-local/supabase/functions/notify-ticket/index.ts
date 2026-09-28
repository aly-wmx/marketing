import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Reference copy of what's deployed to Supabase — kept here for version
// control, but the real credentials below are NOT the ones actually
// running. The deployed function has real values filled in directly (no
// secrets-manager tool was available to set them as env vars); this repo
// copy uses placeholders so nothing sensitive is committed to git.
// To redeploy after editing: fill in the real values below, then
// `supabase functions deploy notify-ticket` (or redeploy via the
// dashboard/MCP tools), matching the shared secret in the
// dispatch_ticket_notification() trigger function in schema.sql.
const SLACK_WEBHOOK_URL = "REPLACE_WITH_SLACK_INCOMING_WEBHOOK_URL";
const RESEND_API_KEY = "REPLACE_WITH_RESEND_API_KEY";
const WEBHOOK_SECRET = "REPLACE_WITH_SHARED_SECRET"; // must match schema.sql's dispatch_ticket_notification()
// Resend's sandbox (no verified sending domain yet) only delivers to the
// email the Resend account itself was signed up with, regardless of `to` —
// verify a domain in the Resend dashboard to send to the whole team.
const FROM_EMAIL = "WMX Tracker <onboarding@resend.dev>";

const BIZ_NAME: Record<string, string> = {
  wm: "Watermark Design Build",
  mn: "Manolo Roofing",
  gh: "Garrison House",
  tf: "Twofold Coffee & Kitchen",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: { recipient?: string; title?: string; biz?: string; created_by?: string; ticket_id?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { recipient, title, biz, created_by } = payload;
  if (!recipient || !title) {
    return new Response("Missing recipient/title", { status: 400 });
  }

  const bizName = (biz && BIZ_NAME[biz]) || biz || "WMX";
  const results: { slack: boolean | null; email: boolean | null; email_skipped_reason?: string } = { slack: null, email: null };

  // Look up the recipient's contact info once, used by both channels below —
  // a real Slack mention (<@USER_ID>) actually pings them, unlike plain text.
  let email: string | null = null;
  let slackUserId: string | null = null;
  try {
    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/team_contacts?name=eq.${encodeURIComponent(recipient)}&select=email,slack_user_id`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const rows = await lookupRes.json();
    email = rows?.[0]?.email ?? null;
    slackUserId = rows?.[0]?.slack_user_id ?? null;
  } catch {
    email = null;
    slackUserId = null;
  }

  // Slack
  const mention = slackUserId ? `<@${slackUserId}>` : `*${recipient}*`;
  try {
    const slackRes = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `:ticket: *${created_by || "Someone"}* assigned ${mention} a ticket — "${title}" (${bizName})`,
      }),
    });
    results.slack = slackRes.ok;
  } catch {
    results.slack = false;
  }

  if (!email) {
    results.email = false;
    results.email_skipped_reason = `No email on file for "${recipient}"`;
  } else {
    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: `New ticket assigned: ${title}`,
          html: `<p><b>${created_by || "Someone"}</b> assigned you a ticket in the WMX tracker.</p>
                 <p><b>${title}</b></p>
                 <p>Business: ${bizName}</p>`,
        }),
      });
      results.email = emailRes.ok;
      if (!emailRes.ok) results.email_skipped_reason = await emailRes.text();
    } catch (e) {
      results.email = false;
      results.email_skipped_reason = String(e);
    }
  }

  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});
