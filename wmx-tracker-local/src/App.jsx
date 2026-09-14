import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  ListChecks, Users, Layers, BarChart3, CreditCard, KeyRound, Inbox,
  CheckCircle2, Circle, CircleDot, Eye, EyeOff, Mail, Plus, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, ChevronRight, Save, Check, Loader2, Bell, X,
  Share2, TrendingUp, TrendingDown,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";

/* ---------------------------------- tokens --------------------------------- */
const C = {
  bg: "#F6F3EC",
  sidebar: "#FBFAF6",
  card: "#FFFFFF",
  line: "#E7E1D2",
  ink: "#20242B",
  sub: "#777064",
  navy: "#152341",
  navySoft: "#EBEEF4",
  pine: "#17332A",
  pineSoft: "#E7EFE9",
  brass: "#B4915B",
  brassSoft: "#F5EEDE",
  good: "#3E7A52",
  warn: "#B4442E",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
.wmx-display{font-family:'Archivo',sans-serif;}
.wmx-body{font-family:'Inter',sans-serif;}
.wmx-focus:focus-visible{outline:2px solid ${C.brass};outline-offset:2px;}
.wmx-spin{animation:wmx-spin .8s linear infinite;}
@keyframes wmx-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
`;

const STORAGE_KEY = "wmx-tracker-state";
const STATUS_ORDER = ["not_started", "in_progress", "done"];
const STATUS_LABEL = { not_started: "Not started", in_progress: "In progress", done: "Done" };
const STATUS_COLOR = { not_started: C.sub, in_progress: C.brass, done: C.good };
const nextStatus = (s) => STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
const STATUS_WEIGHT = { not_started: 0, in_progress: 0.5, done: 1 };
const weightedPct = (items) => Math.round((items.reduce((sum, i) => sum + STATUS_WEIGHT[i.status], 0) / items.length) * 100);

/* -------------------------------- seed data -------------------------------- */
const BUSINESSES = [
  { id: "wm", name: "Watermark", model: "Lead-Gen", color: C.navy, soft: C.navySoft },
  { id: "mn", name: "Manolo Roofing", model: "Lead-Gen", color: C.navy, soft: C.navySoft },
  { id: "gh", name: "Garrison House", model: "Destination", color: C.pine, soft: C.pineSoft },
  { id: "tf", name: "Twofold", model: "Destination", color: C.pine, soft: C.pineSoft },
];
const bizById = (id) => BUSINESSES.find((b) => b.id === id);

// Maps this app's short business ids to the `brands.slug` values already
// seeded in Supabase (brands/platforms/weekly_snapshots — set up for social
// stats tracking, manual entry for now until an API sync is wired in).
const BRAND_SLUG_BY_BIZ = { wm: "watermark", mn: "manolo", gh: "garrison", tf: "twofold" };

const initOnboarding = () => {
  const items = {
    wm: ["LSA verification", "GBP overhaul", "GHL missed-call text-back", "Review automation",
         "Pixels installed (GTM)", "UTM convention documented", "Instagram content plan (Kenny)"],
    mn: ["LSA verification (office/insurance)", "GBP video re-verification", "Duplicate/NAP audit",
         "GHL missed-call text-back", "Pixels installed (GTM)", "TikTok launch", "Local Falcon center point set"],
    gh: ["Spotipo/UniFi captive portal", "Auth window set to 8–12 hrs", "GHL welcome flow live",
         "Membership pitch flow live", "A2P registration (own entity)", "Privacy policy SMS clause"],
    tf: ["A2P registration (own entity)", "GHL sub-account split confirmed", "GBP Attributes/Menu complete",
         "Events newsletter flow live", "Member exclusion audience built", "Privacy policy SMS clause"],
  };
  const out = {};
  Object.entries(items).forEach(([biz, labels]) => {
    out[biz] = labels.map((label, i) => ({ id: `${biz}-${i}`, label, status: i === 0 ? "in_progress" : "not_started" }));
  });
  return out;
};

const initTeam = () => [
  { id: "you", name: "You", role: "CMO — brand & creative direction", biz: ["wm", "mn", "gh", "tf"], vendor: false,
    tasks: [{ t: "Approve WMX palette rollout", s: "in_progress" }, { t: "Sign off Deni SOW", s: "done" }] },
  { id: "avery", name: "Avery", role: "Research Support (no-login tasks)", biz: ["wm", "mn", "gh", "tf"], vendor: false,
    tasks: [{ t: "Category recon (all 4)", s: "in_progress" }, { t: "25-question AI baseline", s: "not_started" },
             { t: "Manolo NAP/duplicate audit", s: "not_started" }] },
  { id: "aly", name: "Aly", role: "GHL Support & Automation", biz: ["wm", "mn", "gh", "tf"], vendor: false,
    tasks: [{ t: "Missed-call text-back (candidate handoff)", s: "not_started" },
             { t: "Review automation (candidate handoff)", s: "not_started" }] },
  { id: "brad", name: "Brad", role: "Web / SEO Dev & Maintenance", biz: ["wm", "mn", "gh", "tf"], vendor: false,
    tasks: [{ t: "Privacy policy + SMS opt-in form", s: "in_progress" }, { t: "GTM container per site", s: "done" },
             { t: "Schema / robots.txt / sitemap", s: "not_started" }] },
  { id: "kenny", name: "Kenny", role: "In-house Photo/Video (all brands)", biz: ["wm", "mn", "gh", "tf"], vendor: false,
    tasks: [{ t: "Watermark Instagram content gap", s: "not_started" }, { t: "Manolo TikTok launch content", s: "not_started" }] },
  { id: "jeff", name: "Jeff", role: "Marketing Director — high-production film", biz: ["wm", "mn", "gh", "tf"], vendor: false,
    tasks: [{ t: "Q3 brand film scope", s: "not_started" }] },
  { id: "bluecollar", name: "Blue Collar Media Group", role: "Vendor — paid social (FB/IG/YouTube/LinkedIn)", biz: ["wm"], vendor: true,
    tasks: [{ t: "Clarify $200/mo pixel line item", s: "not_started" }] },
  { id: "spagenie", name: "Spa Genie", role: "Vendor — Meta ads (Manolo only)", biz: ["mn"], vendor: true,
    tasks: [{ t: "Q3 creative refresh", s: "not_started" }] },
];

const STACK = [
  { id: "ghl", name: "GoHighLevel", manager: "Aly", purpose: "CRM / ads / email / SMS", biz: ["wm", "mn", "gh", "tf"], status: "active" },
  { id: "callrail", name: "CallRail / WhatConverts", manager: "You", purpose: "Keyword-level call tracking (DNI)", biz: ["mn"], status: "future — gated to Manolo Search launch" },
  { id: "localfalcon", name: "Local Falcon", manager: "You", purpose: "Map-pack geo-grid rank tracking", biz: ["wm", "mn", "gh", "tf"], status: "active" },
  { id: "metricool", name: "Metricool", manager: "Kenny", purpose: "Social scheduling & reporting", biz: ["wm", "mn", "gh", "tf"], status: "active" },
  { id: "screamingfrog", name: "Screaming Frog", manager: "Brad", purpose: "Technical SEO crawl", biz: ["wm", "mn", "gh", "tf"], status: "active" },
  { id: "sendjim", name: "SendJim", manager: "You", purpose: "Direct-mail postcards", biz: ["wm", "mn"], status: "active" },
  { id: "semrush", name: "Semrush", manager: "You", purpose: "Broad SEO suite", biz: ["wm", "mn", "gh", "tf"], status: "future — once location pages exist" },
  { id: "playbook", name: "Playbook", manager: "Blue Collar", purpose: "Bundled in Blue Collar retainer", biz: ["wm"], status: "active (bundled)" },
  { id: "metabc", name: "Meta Ads — Blue Collar", manager: "Blue Collar", purpose: "Paid social", biz: ["wm"], status: "active" },
  { id: "metasg", name: "Meta Ads — Spa Genie", manager: "Spa Genie", purpose: "Paid social", biz: ["mn"], status: "active" },
  { id: "mysterypixel", name: "Unverified \"pixel\" line item", manager: "Blue Collar", purpose: "Likely visitor ID/de-anon tool — confirm", biz: ["mn"], status: "needs verification" },
];

const KPI_CATEGORIES = [
  { id: "leadgen", name: "Lead Generation" },
  { id: "gbp", name: "Google Business Profile" },
  { id: "paid", name: "Paid Media" },
  { id: "organic", name: "Organic Social" },
  { id: "email", name: "Email / SMS" },
  { id: "destination", name: "Destination Metrics" },
  { id: "seo", name: "SEO & AI Search" },
];

// Full names for the per-business KPI tabs, as distinct from the shorter
// names (BUSINESSES[].name) used everywhere else in the app.
const KPI_TAB_NAME = {
  wm: "Watermark Design Build",
  mn: "Manolo Roofing",
  gh: "Garrison House",
  tf: "Twofold Coffee & Kitchen",
};

// Every metric is tracked per business — a lead-gen business and a
// destination business genuinely have different numbers here.
const KPI_METRICS_BY_CATEGORY = [
  ["leadgen", ["Leads per week", "Cost per lead", "Lead → job close rate"]],
  ["gbp", ["Map-pack position (grid avg)", "Review count", "Review score"]],
  ["paid", ["LSA spend vs. budget cap", "Meta CPA"]],
  ["organic", ["Follower growth rate", "Engagement by reach", "Saves/shares"]],
  ["email", ["Missed-call text-back reply rate", "Review request → completion rate"]],
  ["destination", ["WiFi capture sign-ups / week", "Visit → membership conversion"]],
  ["seo", ["AI baseline: mentions / 25 questions", "Organic map-pack impressions"]],
];

function seedKpis() {
  const rows = [];
  let n = 0;
  const add = (categoryId, metric, biz) =>
    rows.push({ id: `k${n++}`, categoryId, biz, metric, current: "", target: "", cadence: "Monthly", notes: "" });
  KPI_METRICS_BY_CATEGORY.forEach(([categoryId, metrics]) => {
    metrics.forEach((metric) => BUSINESSES.forEach((b) => add(categoryId, metric, b.id)));
  });
  return rows;
}

const SAAS = [
  { id: "ghl", tool: "GoHighLevel", cost: 297, biz: ["wm", "mn", "gh", "tf"], notes: "active" },
  { id: "callrail", tool: "CallRail / WhatConverts", cost: 50, biz: ["mn"], notes: "future — gated to Manolo Search launch" },
  { id: "localfalcon", tool: "Local Falcon", cost: 40, biz: ["wm", "mn", "gh", "tf"], notes: "active" },
  { id: "metricool", tool: "Metricool", cost: 49, biz: ["wm", "mn", "gh", "tf"], notes: "active" },
  { id: "screamingfrog", tool: "Screaming Frog", cost: 20, biz: ["wm", "mn", "gh", "tf"], notes: "active" },
  { id: "sendjim", tool: "SendJim", cost: 150, biz: ["wm", "mn"], notes: "active" },
  { id: "semrush", tool: "Semrush", cost: 0, biz: ["wm", "mn", "gh", "tf"], notes: "future — once location pages exist" },
  { id: "playbook", tool: "Playbook", cost: 0, biz: ["wm"], notes: "bundled in Blue Collar retainer" },
  { id: "mysterypixel", tool: "Unverified \"pixel\" line item", cost: 200, biz: ["mn"], notes: "Confirm with Blue Collar before renewing" },
];

const initAccounts = () => [
  { id: "a1", biz: "wm", platform: "Instagram", username: "@watermark_tampa", password: "correcthorsebattery", notes: "" },
  { id: "a2", biz: "mn", platform: "Google Business Profile", username: "manolo.roofing@gmail.com", password: "roofingpw2026", notes: "Video verification pending" },
  { id: "a3", biz: "gh", platform: "GoHighLevel sub-account", username: "gh-admin", password: "gh-pw-2026", notes: "" },
  { id: "a4", biz: "tf", platform: "TikTok", username: "@twofold.tampa", password: "twofoldpw", notes: "" },
];

const initTickets = () => [
  { id: "t1", biz: "gh", type: "issue", title: "Spotipo auth window reverted to 30 days?",
    details: "Double-check UniFi didn't reset the 8–12hr setting after firmware update.",
    submitter: "You", status: "open", created: "Aug 12", assignee: "" },
  { id: "t2", biz: "wm", type: "question", title: "Confirm the $200/mo pixel product with Blue Collar",
    details: "Need to know if this is a de-anon tool before renewing.", submitter: "You", status: "in_progress", created: "Aug 14", assignee: "" },
];

function seedState() {
  return {
    onboarding: initOnboarding(),
    team: initTeam(),
    kpis: seedKpis(),
    accounts: initAccounts().map((a) => ({ ...a, show: false })),
    tickets: initTickets(),
  };
}

// Guards against a corrupted/partial saved payload silently breaking the
// progress math (e.g. a stale save from an older version of this tool).
function isValidOnboarding(onboarding) {
  if (!onboarding || typeof onboarding !== "object") return false;
  return BUSINESSES.every((b) => Array.isArray(onboarding[b.id]) && onboarding[b.id].length > 0
    && onboarding[b.id].every((item) => item && typeof item.status === "string" && STATUS_ORDER.includes(item.status)));
}

// Guards against a save from before KPIs were split per business (every row
// used to share biz: null except the Organic Social category).
function isValidKpis(kpis) {
  return Array.isArray(kpis) && kpis.length > 0 && kpis.every((k) => k && typeof k.biz === "string" && bizById(k.biz));
}

const USER_NAME_KEY = "wmx-user-name";
const KNOWN_TEAM_NAMES = ["You", "Avery", "Aly", "Brad", "Kenny", "Jeff"];

/* --------------------------------- helpers --------------------------------- */
function Pill({ children, color, bg }) {
  return (
    <span className="wmx-body" style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color, background: bg, letterSpacing: 0.2, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Avatar({ name, color }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }} className="wmx-display">{initials}</div>
  );
}

function Ring({ pct, size = 72, color }) {
  const inner = size - 10;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${color} ${pct * 3.6}deg, ${C.line} 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: inner, height: inner, borderRadius: "50%", background: C.sidebar, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="wmx-display" style={{ fontSize: size * 0.22, color: C.ink }}>{pct}%</span>
      </div>
    </div>
  );
}

function StatusRow({ label, status, onClick }) {
  const Icon = status === "done" ? CheckCircle2 : status === "in_progress" ? CircleDot : Circle;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.line}` }}>
      <span className="wmx-body" style={{ fontSize: 13, color: C.ink }}>{label}</span>
      <button onClick={onClick} className="wmx-focus" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6 }}>
        <Icon size={15} color={STATUS_COLOR[status]} />
        <span className="wmx-body" style={{ fontSize: 11.5, color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
      </button>
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 1px 2px rgba(20,20,15,0.04)", ...style }}>{children}</div>;
}

function PageHeader({ eyebrow, title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
      <div>
        <div className="wmx-body" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1, color: C.brass, fontWeight: 700, marginBottom: 4 }}>{eyebrow}</div>
        <h1 className="wmx-display" style={{ fontSize: 26, color: C.ink, margin: 0 }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------- tabs ------------------------------------ */

function SetupProgress({ onboarding, setOnboarding }) {
  return (
    <>
      <PageHeader eyebrow="Onboarding" title="Setup Progress" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 16 }}>
        {BUSINESSES.map((b) => {
          const items = onboarding[b.id];
          const done = items.filter((i) => i.status === "done").length;
          const pct = weightedPct(items);
          return (
            <Card key={b.id} style={{ padding: 18 }}>
              <div style={{ height: 4, borderRadius: 4, background: b.color, marginBottom: 14, marginTop: -4, marginLeft: -4, marginRight: -4 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div className="wmx-display" style={{ fontSize: 16, color: C.ink }}>{b.name}</div>
                  <Pill color={b.color} bg={b.soft}>{b.model}</Pill>
                </div>
                <Ring pct={pct} size={56} color={b.color} />
              </div>
              <div className="wmx-body" style={{ fontSize: 11.5, color: C.sub, margin: "12px 0 4px" }}>{done}/{items.length} tasks complete</div>
              <div>{items.map((item) => (
                <StatusRow key={item.id} label={item.label} status={item.status} onClick={() =>
                  setOnboarding((prev) => ({ ...prev, [b.id]: prev[b.id].map((it) => it.id === item.id ? { ...it, status: nextStatus(it.status) } : it) }))
                } />
              ))}</div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function TeamTab({ team, setTeam }) {
  const toggleTask = (memberId, idx) =>
    setTeam((prev) => prev.map((m) => m.id !== memberId ? m : { ...m, tasks: m.tasks.map((t, i) => i === idx ? { ...t, s: nextStatus(t.s) } : t) }));
  return (
    <>
      <PageHeader eyebrow="Who's doing what" title="Team" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 16 }}>
        {team.map((m) => {
          const primaryColor = m.vendor ? C.brass : bizById(m.biz[0]).color;
          return (
            <Card key={m.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar name={m.name} color={primaryColor} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <div className="wmx-display" style={{ fontSize: 15, color: C.ink }}>{m.name}</div>
                    {m.vendor && <Pill color={C.brass} bg={C.brassSoft}>Vendor</Pill>}
                  </div>
                  <div className="wmx-body" style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{m.role}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "12px 0" }}>
                {m.biz.map((id) => { const b = bizById(id); return <Pill key={id} color={b.color} bg={b.soft}>{b.name}</Pill>; })}
              </div>
              <div>{m.tasks.map((t, i) => <StatusRow key={i} label={t.t} status={t.s} onClick={() => toggleTask(m.id, i)} />)}</div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function StackTab({ stack }) {
  return (
    <>
      <PageHeader eyebrow="Tools in play" title="Stack" />
      <Card style={{ padding: 6, overflowX: "auto" }}>
        <table className="wmx-body" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: C.sub, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "12px 14px" }}>Tool</th><th>Manager</th><th>Purpose</th><th>Businesses</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {stack.map((s) => (
              <tr key={s.id} style={{ borderTop: `1px solid ${C.line}` }} onMouseEnter={(e) => e.currentTarget.style.background = C.bg} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: C.ink }}>{s.name}</td>
                <td style={{ color: C.ink }}>{s.manager}</td>
                <td style={{ color: C.sub }}>{s.purpose}</td>
                <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{s.biz.map((id) => { const b = bizById(id); return <Pill key={id} color={b.color} bg={b.soft}>{b.name}</Pill>; })}</div></td>
                <td style={{ color: s.status.startsWith("needs") ? C.warn : C.sub, fontStyle: s.status.startsWith("future") ? "italic" : "normal" }}>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function KpiTab({ kpis, setKpis }) {
  const [activeBiz, setActiveBiz] = useState(BUSINESSES[0].id);
  const [open, setOpen] = useState({ leadgen: true });
  const update = (id, field, val) => setKpis((prev) => prev.map((k) => k.id === id ? { ...k, [field]: val } : k));
  const metricCount = KPI_METRICS_BY_CATEGORY.reduce((sum, [, metrics]) => sum + metrics.length, 0);

  return (
    <>
      <PageHeader eyebrow={`${metricCount} metrics · ${KPI_CATEGORIES.length} categories · tracked per business`} title="KPIs" />

      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {BUSINESSES.map((b) => (
          <button key={b.id} onClick={() => setActiveBiz(b.id)} className="wmx-body wmx-focus"
            style={{
              fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8,
              border: `1px solid ${activeBiz === b.id ? b.color : C.line}`,
              background: activeBiz === b.id ? b.color : "transparent",
              color: activeBiz === b.id ? "#fff" : C.ink,
              cursor: "pointer",
            }}>
            {KPI_TAB_NAME[b.id]}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {KPI_CATEGORIES.map((cat) => {
          const rows = kpis.filter((k) => k.categoryId === cat.id && k.biz === activeBiz);
          const isOpen = !!open[cat.id];
          return (
            <Card key={cat.id} style={{ padding: 0, overflow: "hidden" }}>
              <button onClick={() => setOpen((o) => ({ ...o, [cat.id]: !o[cat.id] }))} className="wmx-focus"
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "none", border: "none", cursor: "pointer" }}>
                <span className="wmx-display" style={{ fontSize: 15, color: C.ink }}>{cat.name}</span>
                {isOpen ? <ChevronUp size={16} color={C.sub} /> : <ChevronDown size={16} color={C.sub} />}
              </button>
              {isOpen && (
                <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ overflowX: "auto" }}>
                    <table className="wmx-body" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 14 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: C.sub, fontSize: 10.5, textTransform: "uppercase" }}>
                          <th style={{ padding: "6px 0" }}>Metric</th><th>Current</th><th>Target</th><th>Cadence</th><th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((k) => (
                          <tr key={k.id} style={{ borderTop: `1px solid ${C.line}` }}>
                            <td style={{ padding: "8px 0", color: C.ink }}>{k.metric}</td>
                            <td><input value={k.current} placeholder="—" onChange={(e) => update(k.id, "current", e.target.value)} className="wmx-body wmx-focus" style={{ width: 70, border: "none", borderBottom: `1px solid ${C.line}`, background: "transparent", fontSize: 12.5, padding: "3px 0" }} /></td>
                            <td><input value={k.target} placeholder="—" onChange={(e) => update(k.id, "target", e.target.value)} className="wmx-body wmx-focus" style={{ width: 70, border: "none", borderBottom: `1px solid ${C.line}`, background: "transparent", fontSize: 12.5, padding: "3px 0" }} /></td>
                            <td style={{ color: C.sub }}>{k.cadence}</td>
                            <td><input value={k.notes} placeholder="—" onChange={(e) => update(k.id, "notes", e.target.value)} className="wmx-body wmx-focus" style={{ width: 130, border: "none", borderBottom: `1px solid ${C.line}`, background: "transparent", fontSize: 12.5, padding: "3px 0" }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function SaasTab({ saas }) {
  const total = saas.reduce((sum, s) => sum + s.cost, 0);
  return (
    <>
      <PageHeader eyebrow="Monthly spend" title="SaaS & Billing" right={
        <Card style={{ padding: "10px 18px" }}>
          <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>Total / month</div>
          <div className="wmx-display" style={{ fontSize: 22, color: C.brass }}>${total.toLocaleString()}</div>
        </Card>
      } />
      <Card style={{ padding: 6, overflowX: "auto" }}>
        <table className="wmx-body" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: C.sub, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "12px 14px" }}>Tool</th><th>$ / month</th><th>Businesses</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {saas.map((s) => (
              <tr key={s.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: C.ink }}>{s.tool}</td>
                <td className="wmx-body" style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>${s.cost}</td>
                <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{s.biz.map((id) => { const b = bizById(id); return <Pill key={id} color={b.color} bg={b.soft}>{b.name}</Pill>; })}</div></td>
                <td style={{ color: s.id === "mysterypixel" ? C.warn : C.sub }}>{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function AccountsTab({ accounts, setAccounts }) {
  const toggle = (id) => setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, show: !a.show } : a));
  return (
    <>
      <PageHeader eyebrow="Logins per business" title="Accounts & Logins" />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.brassSoft, border: `1px solid ${C.brass}40`, borderRadius: 8, padding: 14, marginBottom: 18 }}>
        <AlertTriangle size={16} color={C.brass} style={{ flexShrink: 0, marginTop: 2 }} />
        <span className="wmx-body" style={{ fontSize: 12.5, color: C.ink }}>
          Convenience storage only — <b>not an encrypted vault</b>, and saved data here is <b>visible to anyone who opens this artifact</b>.
          Keep anything financial elsewhere, and route this through Supabase Row Level Security + column-level encryption before production use.
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 16 }}>
        {BUSINESSES.map((b) => {
          const rows = accounts.filter((a) => a.biz === b.id);
          return (
            <Card key={b.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color }} />
                <span className="wmx-display" style={{ fontSize: 15, color: C.ink }}>{b.name}</span>
              </div>
              {rows.map((a) => (
                <div key={a.id} style={{ padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
                  <div className="wmx-body" style={{ fontSize: 12, color: C.sub }}>{a.platform}</div>
                  <div className="wmx-body" style={{ fontSize: 13, color: C.ink }}>{a.username}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: C.ink }}>{a.show ? a.password : "••••••••"}</span>
                    <button onClick={() => toggle(a.id)} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      {a.show ? <EyeOff size={14} color={C.sub} /> : <Eye size={14} color={C.sub} />}
                    </button>
                  </div>
                  {a.notes && <div className="wmx-body" style={{ fontSize: 11.5, color: C.warn, marginTop: 4 }}>{a.notes}</div>}
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function TicketsTab({ tickets, setTickets, assignableNames, userName, onTicketAssigned }) {
  const [showForm, setShowForm] = useState(false);
  const blankForm = () => ({ biz: "wm", type: "question", title: "", details: "", submitter: userName || "", assignee: "" });
  const [form, setForm] = useState(blankForm);

  const addTicket = () => {
    if (!form.title.trim()) return;
    const ticket = { ...form, id: `t${Date.now()}`, status: "open", created: "Today" };
    setTickets((prev) => [...prev, ticket]);
    if (ticket.assignee) onTicketAssigned(ticket);
    setForm(blankForm());
    setShowForm(false);
  };
  const setStatus = (id, status) => setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
  const remove = (id) => setTickets((prev) => prev.filter((t) => t.id !== id));

  const columns = [
    { id: "open", label: "Open", accent: C.brass },
    { id: "in_progress", label: "In Progress", accent: C.navy },
    { id: "resolved", label: "Resolved", accent: C.pine },
  ];

  return (
    <>
      <PageHeader eyebrow="Shared board · visible to everyone with this link" title="Tickets" right={
        <button onClick={() => setShowForm((s) => !s)} className="wmx-body wmx-focus"
          style={{ display: "flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "9px 16px", fontWeight: 600 }}>
          <Plus size={15} /> New ticket
        </button>
      } />

      {showForm && (
        <Card style={{ padding: 16, marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
            <select value={form.biz} onChange={(e) => setForm({ ...form, biz: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }}>
              {BUSINESSES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }}>
              {["question", "idea", "request", "issue"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6, gridColumn: "span 2" }} />
            <input placeholder="Your name" value={form.submitter} onChange={(e) => setForm({ ...form, submitter: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }} />
            <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }}>
              <option value="">Assign to…</option>
              {assignableNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input placeholder="Details" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6, gridColumn: "span 3" }} />
          </div>
          <button onClick={addTicket} className="wmx-body wmx-focus" style={{ marginTop: 10, background: C.ink, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "8px 14px", fontWeight: 600 }}>Submit</button>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {columns.map((col) => {
          const items = tickets.filter((t) => t.status === col.id);
          return (
            <div key={col.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span className="wmx-display" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: col.accent }}>{col.label}</span>
                <span className="wmx-body" style={{ fontSize: 11, color: C.sub, background: C.line, borderRadius: 999, padding: "1px 7px" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 40 }}>
                {items.map((t) => {
                  const b = bizById(t.biz);
                  const mailto = `mailto:ops@wmx.com?subject=${encodeURIComponent(`[${t.type}] ${t.title}`)}&body=${encodeURIComponent(`${t.details}\n\n— ${t.submitter || "Unknown"} (${b.name})`)}`;
                  const nextCol = col.id === "open" ? "in_progress" : col.id === "in_progress" ? "resolved" : null;
                  return (
                    <Card key={t.id} style={{ padding: 14, borderTop: `3px solid ${col.accent}` }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                        <Pill color={b.color} bg={b.soft}>{b.name}</Pill>
                        <Pill color={C.sub} bg={C.bg}>{t.type}</Pill>
                        {t.assignee && <Pill color={C.brass} bg={C.brassSoft}>→ {t.assignee}</Pill>}
                      </div>
                      <div className="wmx-display" style={{ fontSize: 14, color: C.ink }}>{t.title}</div>
                      {t.details && <div className="wmx-body" style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{t.details}</div>}
                      <div className="wmx-body" style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>{t.submitter || "Unknown"} · {t.created}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                        <a href={mailto} className="wmx-body" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: C.brass, textDecoration: "none" }}>
                          <Mail size={12} /> Notify Aly
                        </a>
                        <div style={{ display: "flex", gap: 4 }}>
                          {nextCol && (
                            <button onClick={() => setStatus(t.id, nextCol)} title={`Move to ${nextCol.replace("_", " ")}`} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                              <ChevronRight size={15} color={C.sub} />
                            </button>
                          )}
                          <button onClick={() => remove(t.id)} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                            <Trash2 size={13} color={C.sub} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {items.length === 0 && <div className="wmx-body" style={{ fontSize: 12, color: C.sub, textAlign: "center", padding: "18px 0", border: `1px dashed ${C.line}`, borderRadius: 8 }}>Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SocialPlatformRow({ platform, latest, previous, onLog }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const delta = latest && previous ? latest.followers - previous.followers : null;

  const submit = async () => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    await onLog(n);
    setSaving(false);
    setValue("");
  };

  return (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: platform.color_hex || C.sub }} />
          <span className="wmx-body" style={{ fontSize: 12.5, color: C.ink, fontWeight: 600 }}>{platform.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="wmx-display" style={{ fontSize: 18, color: C.ink }}>{latest ? latest.followers.toLocaleString() : "—"}</span>
          {delta !== null && delta !== 0 && (
            <span className="wmx-body" style={{ fontSize: 11, fontWeight: 600, color: delta > 0 ? C.good : C.warn, display: "flex", alignItems: "center", gap: 2 }}>
              {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(delta).toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>
        {latest ? `as of ${latest.week_ending}` : "no data logged yet"}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="New count" type="number" min="0"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="wmx-body wmx-focus" style={{ width: 110, padding: "5px 8px", border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12 }} />
        <button onClick={submit} disabled={!value || saving} className="wmx-body wmx-focus"
          style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "none", cursor: value ? "pointer" : "default", background: value ? C.ink : C.line, color: value ? "#fff" : C.sub }}>
          {saving ? "…" : "Log"}
        </button>
      </div>
    </div>
  );
}

function SocialTab() {
  const [brands, setBrands] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: brandRows }, { data: platformRows }, { data: snapshotRows }] = await Promise.all([
          supabase.from("brands").select("id, name, slug").order("name"),
          supabase.from("platforms").select("id, name, color_hex").order("name"),
          supabase.from("weekly_snapshots").select("id, brand_id, platform_id, week_ending, followers, source, updated_at"),
        ]);
        if (!cancelled) {
          setBrands(brandRows || []);
          setPlatforms(platformRows || []);
          setSnapshots(snapshotRows || []);
        }
      } catch (e) {
        console.warn("Could not load social stats:", e.message ?? e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // realtime: another tab logging a count (or a future automated sync) shows up live
  useEffect(() => {
    const channel = supabase
      .channel("weekly_snapshots_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_snapshots" }, (payload) => {
        setSnapshots((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((s) => s.id !== payload.old.id);
          return [...prev.filter((s) => s.id !== payload.new.id), payload.new];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const historyByKey = useMemo(() => {
    const map = {};
    snapshots.forEach((s) => {
      const key = `${s.brand_id}:${s.platform_id}`;
      (map[key] ||= []).push(s);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => b.week_ending.localeCompare(a.week_ending)));
    return map;
  }, [snapshots]);

  const totalFollowers = useMemo(
    () => Object.values(historyByKey).reduce((sum, arr) => sum + (arr[0]?.followers || 0), 0),
    [historyByKey]
  );

  const logSnapshot = useCallback(async (brandId, platformId, followers) => {
    const weekEnding = new Date().toISOString().slice(0, 10);
    try {
      const { error } = await supabase
        .from("weekly_snapshots")
        .upsert(
          { brand_id: brandId, platform_id: platformId, week_ending: weekEnding, followers, source: "manual" },
          { onConflict: "brand_id,platform_id,week_ending" }
        )
        .select();
      if (error) throw error;
    } catch (e) {
      console.error("Could not log follower count:", e.message ?? e);
    }
  }, []);

  return (
    <>
      <PageHeader eyebrow="Weekly tracking · manual for now, ready for API sync later" title="Social Media Hub" right={
        <Card style={{ padding: "10px 18px" }}>
          <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>Total followers</div>
          <div className="wmx-display" style={{ fontSize: 22, color: C.brass }}>{totalFollowers.toLocaleString()}</div>
        </Card>
      } />
      {!loaded && <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Loading social stats…</div>}
      {loaded && brands.length === 0 && (
        <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub }}>
          No brands/platforms found in Supabase yet — nothing to show here.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 16 }}>
        {BUSINESSES.map((b) => {
          const brandRow = brands.find((row) => row.slug === BRAND_SLUG_BY_BIZ[b.id]);
          return (
            <Card key={b.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color }} />
                <span className="wmx-display" style={{ fontSize: 15, color: C.ink }}>{b.name}</span>
              </div>
              {!brandRow && (
                <div className="wmx-body" style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>Not set up in Supabase yet.</div>
              )}
              {brandRow && platforms.map((p) => {
                const key = `${brandRow.id}:${p.id}`;
                const history = historyByKey[key] || [];
                return (
                  <SocialPlatformRow
                    key={p.id}
                    platform={p}
                    latest={history[0] || null}
                    previous={history[1] || null}
                    onLog={(followers) => logSnapshot(brandRow.id, p.id, followers)}
                  />
                );
              })}
            </Card>
          );
        })}
      </div>
    </>
  );
}

/* --------------------------------- app shell -------------------------------- */
const TABS = [
  { id: "setup", label: "Setup Progress", icon: ListChecks },
  { id: "team", label: "Team", icon: Users },
  { id: "stack", label: "Stack", icon: Layers },
  { id: "kpis", label: "KPIs", icon: BarChart3 },
  { id: "social", label: "Social Media Hub", icon: Share2 },
  { id: "saas", label: "SaaS & Billing", icon: CreditCard },
  { id: "accounts", label: "Accounts & Logins", icon: KeyRound },
  { id: "tickets", label: "Tickets", icon: Inbox },
];

export default function WMXTracker() {
  const [tab, setTab] = useState("setup");
  const [data, setData] = useState(seedState);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [lastSaved, setLastSaved] = useState(null);
  const [lastEditedBy, setLastEditedBy] = useState(null);
  const [userName, setUserName] = useState(() => localStorage.getItem(USER_NAME_KEY) || "");
  const [nameDraft, setNameDraft] = useState("");
  const [remoteBanner, setRemoteBanner] = useState(null); // { by, at } when a remote save lands while dirty
  const [toasts, setToasts] = useState([]); // in-app "you were assigned a ticket" banners
  const [unreadCount, setUnreadCount] = useState(0);
  const dirtyRef = useRef(dirty);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  const chooseName = (name) => {
    const clean = name.trim();
    if (!clean) return;
    localStorage.setItem(USER_NAME_KEY, clean);
    setUserName(clean);
    // Ask now, while we still have the click as a user gesture — browsers
    // refuse silent/background permission prompts.
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ticket assignment: write one row per assignment, the recipient's own
  // browser tab picks it up over the realtime channel below.
  const notifyAssignee = useCallback(async (ticket) => {
    if (!ticket.assignee || ticket.assignee === userName) return; // no need to notify yourself
    try {
      await supabase.from("ticket_notifications").insert({
        ticket_id: ticket.id,
        recipient: ticket.assignee,
        title: ticket.title,
        biz: ticket.biz,
        created_by: userName || ticket.submitter || "Unknown",
      });
    } catch (e) {
      console.error("Could not send ticket notification:", e.message ?? e);
    }
  }, [userName]);

  // realtime: pushed a ticket notification addressed to us — surface it as an
  // in-app toast (and, if the tab isn't focused, a real OS notification too).
  useEffect(() => {
    if (!userName) return;
    const channel = supabase
      .channel(`ticket_notifications_${userName}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_notifications", filter: `recipient=eq.${userName}` },
        (payload) => {
          const n = payload.new;
          setToasts((prev) => [...prev, n]);
          setUnreadCount((c) => c + 1);
          setTimeout(() => dismissToast(n.id), 8000);
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
            new Notification(`New ticket from ${n.created_by}`, { body: n.title });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userName]);

  // load persisted state on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from("tracker_state")
          .select("data, updated_by, updated_at")
          .eq("id", "default")
          .single();
        if (error) throw error;
        if (!cancelled && row?.data && Object.keys(row.data).length > 0) {
          setData((prev) => ({
            ...prev,
            ...row.data,
            onboarding: isValidOnboarding(row.data.onboarding) ? row.data.onboarding : prev.onboarding,
            kpis: isValidKpis(row.data.kpis) ? row.data.kpis : prev.kpis,
          }));
          if (row.updated_by) setLastEditedBy({ by: row.updated_by, at: row.updated_at });
        }
      } catch (e) {
        // no saved row yet, or Supabase not configured — keep seed defaults
        console.warn("Could not load saved state from Supabase:", e.message ?? e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // realtime: live-merge changes saved by other users, without clobbering unsaved local edits
  useEffect(() => {
    const channel = supabase
      .channel("tracker_state_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tracker_state", filter: "id=eq.default" },
        (payload) => {
          const incoming = payload.new;
          if (!incoming || incoming.updated_by === userName) return; // ignore our own save echoing back
          setLastEditedBy({ by: incoming.updated_by, at: incoming.updated_at });
          if (dirtyRef.current) {
            // don't silently overwrite unsaved local changes — let the user decide
            setRemoteBanner({ by: incoming.updated_by, at: incoming.updated_at });
          } else if (isValidOnboarding(incoming.data?.onboarding)) {
            setData((prev) => ({
              ...prev,
              ...incoming.data,
              kpis: isValidKpis(incoming.data?.kpis) ? incoming.data.kpis : prev.kpis,
            }));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  const markDirty = useCallback(() => setDirty(true), []);

  const setOnboarding = useCallback((updater) => {
    setData((prev) => ({ ...prev, onboarding: typeof updater === "function" ? updater(prev.onboarding) : updater }));
    markDirty();
  }, [markDirty]);

  const setTeam = useCallback((updater) => {
    setData((prev) => ({ ...prev, team: typeof updater === "function" ? updater(prev.team) : updater }));
    markDirty();
  }, [markDirty]);

  const setKpis = useCallback((updater) => {
    setData((prev) => ({ ...prev, kpis: typeof updater === "function" ? updater(prev.kpis) : updater }));
    markDirty();
  }, [markDirty]);

  const setTickets = useCallback((updater) => {
    setData((prev) => ({ ...prev, tickets: typeof updater === "function" ? updater(prev.tickets) : updater }));
    markDirty();
  }, [markDirty]);

  // password show/hide is transient UI, not saved progress — doesn't mark dirty
  const setAccounts = useCallback((updater) => {
    setData((prev) => ({ ...prev, accounts: typeof updater === "function" ? updater(prev.accounts) : updater }));
  }, []);

  const handleSave = async () => {
    setSaveState("saving");
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("tracker_state")
        .upsert({ id: "default", data, updated_by: userName || "Unknown", updated_at: nowIso });
      if (error) throw error;
      setDirty(false);
      setSaveState("saved");
      setLastSaved(new Date());
      setLastEditedBy({ by: userName || "Unknown", at: nowIso });
      setRemoteBanner(null);
      setTimeout(() => setSaveState("idle"), 1800);
    } catch (e) {
      console.error("Save to Supabase failed:", e.message ?? e);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  };

  // autosave: once things settle for a moment after an edit, save without
  // waiting for the user to click the button, so a refresh sees it too.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => { handleSave(); }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dirty]);

  const reloadFromRemote = async () => {
    const { data: row } = await supabase.from("tracker_state").select("data, updated_by, updated_at").eq("id", "default").single();
    if (row?.data) {
      setData((prev) => ({
        ...prev,
        ...row.data,
        onboarding: isValidOnboarding(row.data.onboarding) ? row.data.onboarding : prev.onboarding,
        kpis: isValidKpis(row.data.kpis) ? row.data.kpis : prev.kpis,
      }));
      setDirty(false);
    }
    setRemoteBanner(null);
  };

  const portfolioPct = useMemo(() => {
    const pcts = BUSINESSES.map((b) => weightedPct(data.onboarding[b.id]));
    return Math.round(pcts.reduce((a, c) => a + c, 0) / pcts.length);
  }, [data.onboarding]);

  const openTicketCount = data.tickets.filter((t) => t.status !== "resolved").length;
  const assignableNames = useMemo(() => data.team.filter((m) => !m.vendor).map((m) => m.name), [data.team]);

  if (!userName) {
    return (
      <div className="wmx-body" style={{ minHeight: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{FONTS}</style>
        <Card style={{ padding: 28, maxWidth: 360, width: "100%" }}>
          <div className="wmx-display" style={{ fontSize: 18, color: C.ink, marginBottom: 6 }}>Who's this?</div>
          <div className="wmx-body" style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>
            Used to label your changes for the team (e.g. "Aly updated 2 min ago"). Stored only in this browser.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {KNOWN_TEAM_NAMES.map((n) => (
              <button key={n} onClick={() => chooseName(n)} className="wmx-body wmx-focus"
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.line}`, background: "transparent", cursor: "pointer" }}>
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Or type your name"
              onKeyDown={(e) => e.key === "Enter" && chooseName(nameDraft)}
              className="wmx-body wmx-focus" style={{ flex: 1, padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }} />
            <button onClick={() => chooseName(nameDraft)} className="wmx-body wmx-focus"
              style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontWeight: 600 }}>
              Continue
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="wmx-body" style={{ minHeight: "100%", background: C.bg, display: "flex" }}>
      <style>{FONTS}</style>

      <aside style={{ width: 250, flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.line}`, padding: "22px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }} className="wmx-display">W</div>
          <div>
            <div className="wmx-display" style={{ fontSize: 15, color: C.ink, lineHeight: 1.1 }}>WMX</div>
            <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub }}>Portfolio Control</div>
          </div>
        </div>

        <Card style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <Ring pct={portfolioPct} size={52} color={C.brass} />
          <div>
            <div className="wmx-display" style={{ fontSize: 12.5, color: C.ink }}>Portfolio setup</div>
            <div className="wmx-body" style={{ fontSize: 11, color: C.sub }}>Avg across 4 businesses</div>
          </div>
        </Card>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.good }} title="You're connected" />
            <span className="wmx-body" style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>{userName}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => { setTab("tickets"); setUnreadCount(0); }} className="wmx-focus" title="Tickets assigned to you"
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <Bell size={15} color={unreadCount > 0 ? C.brass : C.sub} />
              {unreadCount > 0 && (
                <span className="wmx-body" style={{ position: "absolute", top: -6, right: -7, fontSize: 9.5, fontWeight: 700, color: "#fff", background: C.warn, borderRadius: 999, padding: "0 4px", lineHeight: "13px", minWidth: 13, textAlign: "center" }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => { localStorage.removeItem(USER_NAME_KEY); setUserName(""); }} className="wmx-body wmx-focus"
              style={{ fontSize: 10.5, color: C.sub, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              switch
            </button>
          </div>
        </div>

        <button onClick={handleSave} disabled={!dirty || saveState === "saving"} className="wmx-focus"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            border: "none", borderRadius: 8, cursor: dirty ? "pointer" : "default", fontSize: 13, fontWeight: 600, padding: "10px 12px",
            background: saveState === "error" ? C.warn : saveState === "saved" ? C.good : dirty ? C.ink : C.line,
            color: dirty || saveState !== "idle" ? "#fff" : C.sub,
            transition: "background .15s",
          }}>
          {saveState === "saving" && <Loader2 size={15} className="wmx-spin" />}
          {saveState === "saved" && <Check size={15} />}
          {saveState === "idle" && <Save size={15} />}
          {saveState === "error" && <AlertTriangle size={15} />}
          <span>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed — retry" : dirty ? "Save changes" : "All changes saved"}
          </span>
        </button>
        {lastSaved && (
          <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, textAlign: "center", marginTop: -10 }}>
            Last saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
        {lastEditedBy && !lastSaved && (
          <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, textAlign: "center", marginTop: -10 }}>
            Last edited by {lastEditedBy.by} · {new Date(lastEditedBy.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const badge = t.id === "tickets" && openTicketCount > 0 ? openTicketCount : null;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="wmx-focus"
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8,
                  border: "none", cursor: "pointer", textAlign: "left",
                  background: active ? C.brassSoft : "transparent",
                  borderLeft: active ? `3px solid ${C.brass}` : "3px solid transparent",
                }}>
                <Icon size={16} color={active ? C.brass : C.sub} />
                <span className="wmx-body" style={{ fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? C.ink : C.sub, flex: 1 }}>{t.label}</span>
                {badge && <span className="wmx-body" style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: C.brass, borderRadius: 999, padding: "1px 6px" }}>{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <div className="wmx-body" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: C.sub, marginBottom: 8 }}>Business key</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.navy }} />
              <span className="wmx-body" style={{ fontSize: 11.5, color: C.sub }}>Lead-Gen — Watermark, Manolo</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.pine }} />
              <span className="wmx-body" style={{ fontSize: 11.5, color: C.sub }}>Destination — Garrison House, Twofold</span>
            </div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>
        <div style={{ maxWidth: 1000 }}>
          {!loaded && (
            <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Loading saved progress…</div>
          )}
          {remoteBanner && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: C.brassSoft, border: `1px solid ${C.brass}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, flexWrap: "wrap" }}>
              <span className="wmx-body" style={{ fontSize: 12.5, color: C.ink }}>
                <b>{remoteBanner.by}</b> saved changes while you had unsaved edits — reload to see theirs, or keep working and Save to overwrite with yours.
              </span>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={reloadFromRemote} className="wmx-body wmx-focus" style={{ fontSize: 12, fontWeight: 600, background: C.ink, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>
                  Reload theirs
                </button>
                <button onClick={() => setRemoteBanner(null)} className="wmx-body wmx-focus" style={{ fontSize: 12, background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>
                  Keep mine
                </button>
              </div>
            </div>
          )}
          {tab === "setup" && <SetupProgress onboarding={data.onboarding} setOnboarding={setOnboarding} />}
          {tab === "team" && <TeamTab team={data.team} setTeam={setTeam} />}
          {tab === "stack" && <StackTab stack={STACK} />}
          {tab === "kpis" && <KpiTab kpis={data.kpis} setKpis={setKpis} />}
          {tab === "social" && <SocialTab />}
          {tab === "saas" && <SaasTab saas={SAAS} />}
          {tab === "accounts" && <AccountsTab accounts={data.accounts} setAccounts={setAccounts} />}
          {tab === "tickets" && <TicketsTab tickets={data.tickets} setTickets={setTickets} assignableNames={assignableNames} userName={userName} onTicketAssigned={notifyAssignee} />}

          <div className="wmx-body" style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", fontSize: 11, color: C.sub, flexWrap: "wrap", gap: 6 }}>
            <span>WMX Management Group — internal tool</span>
            <span>Synced to Supabase · everyone with this app URL shares the same data</span>
          </div>
        </div>
      </main>

      <div style={{ position: "fixed", top: 18, right: 18, display: "flex", flexDirection: "column", gap: 8, zIndex: 50, maxWidth: 320 }}>
        {toasts.map((n) => (
          <Card key={n.id} style={{ padding: "12px 14px", boxShadow: "0 6px 18px rgba(20,20,15,0.14)", borderLeft: `3px solid ${C.brass}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div className="wmx-body" style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{n.created_by} assigned you a ticket</div>
                <div className="wmx-body" style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{n.title}</div>
                <button onClick={() => { setTab("tickets"); dismissToast(n.id); }} className="wmx-body wmx-focus"
                  style={{ marginTop: 6, fontSize: 11.5, color: C.brass, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                  View ticket
                </button>
              </div>
              <button onClick={() => dismissToast(n.id)} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}>
                <X size={13} color={C.sub} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
