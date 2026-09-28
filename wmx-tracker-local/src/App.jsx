import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  ListChecks, Users, Layers, BarChart3, CreditCard, KeyRound, Inbox,
  CheckCircle2, Circle, CircleDot, Eye, EyeOff, Mail, Plus, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, ChevronRight, Save, Check, Loader2, Bell, X,
  Share2, TrendingUp, TrendingDown, LogOut, Pencil, Activity as ActivityIcon, Download, ShieldCheck,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";
import wmxCrest from "./assets/wmx-crest.png";

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
.wmx-shell{display:flex;}
.wmx-sidebar{width:250px;flex-shrink:0;}
.wmx-nav{display:flex;flex-direction:column;gap:2px;}
.wmx-main{flex:1;padding:28px 32px;min-width:0;}
.wmx-ticket-board{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.wmx-form-grid{display:grid;grid-template-columns:1fr 1fr;}
@media (max-width: 860px){
  .wmx-shell{flex-direction:column;}
  .wmx-sidebar{width:100%;}
  .wmx-nav{flex-direction:row;overflow-x:auto;gap:6px;padding-bottom:4px;}
  .wmx-main{padding:18px 16px;}
  .wmx-ticket-board{grid-template-columns:1fr;}
}
@media (max-width: 520px){
  .wmx-form-grid{grid-template-columns:1fr;}
}
`;

const STORAGE_KEY = "wmx-tracker-state";
const STATUS_ORDER = ["not_started", "in_progress", "done"];
const STATUS_LABEL = { not_started: "Not started", in_progress: "In progress", done: "Done" };
const STATUS_COLOR = { not_started: C.sub, in_progress: C.brass, done: C.good };
const nextStatus = (s) => STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
const STATUS_WEIGHT = { not_started: 0, in_progress: 0.5, done: 1 };
const weightedPct = (items) => Math.round((items.reduce((sum, i) => sum + STATUS_WEIGHT[i.status], 0) / items.length) * 100);
const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High" };
const PRIORITY_COLOR = { low: C.good, medium: C.brass, high: C.warn };
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const csvEscape = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (headers, rows) => [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
const downloadCsv = (filename, csv) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

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
  { id: "jason", name: "Jason", role: "Team", biz: ["wm", "mn", "gh", "tf"], vendor: false, tasks: [] },
  { id: "nick", name: "Nick", role: "Team", biz: ["wm", "mn", "gh", "tf"], vendor: false, tasks: [] },
  { id: "bluecollar", name: "Blue Collar Media Group", role: "Vendor — paid social (FB/IG/YouTube/LinkedIn)", biz: ["wm"], vendor: true,
    tasks: [{ t: "Clarify $200/mo pixel line item", s: "not_started" }] },
  { id: "spagenie", name: "Spa Genie", role: "Vendor — Meta ads (Manolo only)", biz: ["mn"], vendor: true,
    tasks: [{ t: "Q3 creative refresh", s: "not_started" }] },
];

const initStack = () => [
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

const initSaas = () => [
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

const initTickets = () => [
  { id: "t1", biz: "gh", type: "issue", title: "Spotipo auth window reverted to 30 days?",
    details: "Double-check UniFi didn't reset the 8–12hr setting after firmware update.",
    submitter: "You", status: "open", created: "Aug 12", assignee: "", priority: "medium", dueDate: "", comments: [] },
  { id: "t2", biz: "wm", type: "question", title: "Confirm the $200/mo pixel product with Blue Collar",
    details: "Need to know if this is a de-anon tool before renewing.", submitter: "You", status: "in_progress", created: "Aug 14", assignee: "", priority: "medium", dueDate: "", comments: [] },
];

function seedState() {
  return {
    onboarding: initOnboarding(),
    team: initTeam(),
    kpis: seedKpis(),
    stack: initStack(),
    saas: initSaas(),
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

function StatusRow({ label, status, onClick, disabled }) {
  const Icon = status === "done" ? CheckCircle2 : status === "in_progress" ? CircleDot : Circle;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.line}` }}>
      <span className="wmx-body" style={{ fontSize: 13, color: C.ink }}>{label}</span>
      <button onClick={disabled ? undefined : onClick} disabled={disabled} className="wmx-focus" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: disabled ? "default" : "pointer", padding: "2px 6px", borderRadius: 6 }}>
        <Icon size={15} color={STATUS_COLOR[status]} />
        <span className="wmx-body" style={{ fontSize: 11.5, color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
      </button>
    </div>
  );
}

function Card({ children, style, ...rest }) {
  return <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 1px 2px rgba(20,20,15,0.04)", ...style }} {...rest}>{children}</div>;
}

function BizTogglePills({ selected, onToggle }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {BUSINESSES.map((b) => {
        const active = selected.includes(b.id);
        return (
          <button key={b.id} onClick={() => onToggle(b.id)} className="wmx-focus" type="button"
            style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: `1px solid ${active ? b.color : C.line}`, background: active ? b.soft : "transparent", color: active ? b.color : C.sub, cursor: "pointer" }}>
            {b.name}
          </button>
        );
      })}
    </div>
  );
}

function FormField({ label, children, span }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <span className="wmx-body" style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  );
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

function SetupProgress({ onboarding, setOnboarding, logActivity }) {
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
                <StatusRow key={item.id} label={item.label} status={item.status} onClick={() => {
                  const next = nextStatus(item.status);
                  setOnboarding((prev) => ({ ...prev, [b.id]: prev[b.id].map((it) => it.id === item.id ? { ...it, status: next } : it) }));
                  logActivity("update", `marked "${item.label}" ${STATUS_LABEL[next].toLowerCase()}`, b.id);
                }} />
              ))}</div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function TeamTab({ team, setTeam, canEdit, logActivity }) {
  const [filterPerson, setFilterPerson] = useState("all");
  const toggleTask = (memberId, idx) => {
    const member = team.find((m) => m.id === memberId);
    const next = nextStatus(member.tasks[idx].s);
    setTeam((prev) => prev.map((m) => m.id !== memberId ? m : { ...m, tasks: m.tasks.map((t, i) => i === idx ? { ...t, s: next } : t) }));
    logActivity("update", `marked "${member.tasks[idx].t}" ${STATUS_LABEL[next].toLowerCase()} for ${member.name}`);
  };
  const visible = filterPerson === "all" ? team : team.filter((m) => m.id === filterPerson);
  return (
    <>
      <PageHeader eyebrow={canEdit ? "Who's doing what" : "Who's doing what · admins only can edit"} title="Team" right={
        <select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} className="wmx-body"
          style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12.5 }}>
          <option value="all">Everyone</option>
          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 16 }}>
        {visible.map((m) => {
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
              <div>{m.tasks.map((t, i) => <StatusRow key={i} label={t.t} status={t.s} onClick={() => toggleTask(m.id, i)} disabled={!canEdit} />)}</div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

const cellInput = { width: "100%", border: "none", background: "transparent", fontSize: 13, padding: "4px 2px", color: C.ink };

function StackTab({ stack, setStack, logActivity }) {
  const update = (id, field, val) => setStack((prev) => prev.map((s) => s.id === id ? { ...s, [field]: val } : s));
  const toggleBiz = (id, bizId) => setStack((prev) => prev.map((s) => s.id !== id ? s : {
    ...s, biz: s.biz.includes(bizId) ? s.biz.filter((x) => x !== bizId) : [...s.biz, bizId],
  }));
  const addRow = () => {
    setStack((prev) => [...prev, { id: `stack${Date.now()}`, name: "", manager: "", purpose: "", biz: [], status: "active" }]);
    logActivity("create", "added a new tool to the Stack");
  };
  const removeRow = (id) => {
    const row = stack.find((s) => s.id === id);
    setStack((prev) => prev.filter((s) => s.id !== id));
    logActivity("delete", `removed "${row?.name || "a tool"}" from the Stack`);
  };

  return (
    <>
      <PageHeader eyebrow="Tools in play" title="Stack" right={
        <button onClick={addRow} className="wmx-body wmx-focus"
          style={{ display: "flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "9px 16px", fontWeight: 600 }}>
          <Plus size={15} /> Add tool
        </button>
      } />
      <Card style={{ padding: 6, overflowX: "auto" }}>
        <table className="wmx-body" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: C.sub, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "12px 14px" }}>Tool</th><th>Manager</th><th>Purpose</th><th>Businesses</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {stack.map((s) => (
              <tr key={s.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "8px 14px" }}><input value={s.name} onChange={(e) => update(s.id, "name", e.target.value)} placeholder="Tool name" className="wmx-focus" style={{ ...cellInput, fontWeight: 600 }} /></td>
                <td><input value={s.manager} onChange={(e) => update(s.id, "manager", e.target.value)} placeholder="—" className="wmx-focus" style={cellInput} /></td>
                <td><input value={s.purpose} onChange={(e) => update(s.id, "purpose", e.target.value)} placeholder="—" className="wmx-focus" style={{ ...cellInput, color: C.sub }} /></td>
                <td><BizTogglePills selected={s.biz} onToggle={(bizId) => toggleBiz(s.id, bizId)} /></td>
                <td><input value={s.status} onChange={(e) => update(s.id, "status", e.target.value)} placeholder="—"
                  className="wmx-focus" style={{ ...cellInput, color: s.status.startsWith("needs") ? C.warn : C.sub, fontStyle: s.status.startsWith("future") ? "italic" : "normal" }} /></td>
                <td>
                  <button onClick={() => removeRow(s.id)} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={13} color={C.sub} />
                  </button>
                </td>
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

  const exportCsv = () => {
    const headers = ["Business", "Category", "Metric", "Current", "Target", "Cadence", "Notes"];
    const rows = kpis.map((k) => {
      const cat = KPI_CATEGORIES.find((c) => c.id === k.categoryId);
      return [KPI_TAB_NAME[k.biz] || k.biz, cat?.name || k.categoryId, k.metric, k.current, k.target, k.cadence, k.notes];
    });
    downloadCsv(`wmx-kpis-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
  };

  return (
    <>
      <PageHeader eyebrow={`${metricCount} metrics · ${KPI_CATEGORIES.length} categories · tracked per business`} title="KPIs" right={
        <button onClick={exportCsv} className="wmx-body wmx-focus"
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, cursor: "pointer", fontSize: 12.5, padding: "8px 14px", fontWeight: 600 }}>
          <Download size={14} /> Export CSV
        </button>
      } />

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

function SaasTab({ saas, setSaas, logActivity }) {
  const total = saas.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
  const update = (id, field, val) => setSaas((prev) => prev.map((s) => s.id === id ? { ...s, [field]: val } : s));
  const toggleBiz = (id, bizId) => setSaas((prev) => prev.map((s) => s.id !== id ? s : {
    ...s, biz: s.biz.includes(bizId) ? s.biz.filter((x) => x !== bizId) : [...s.biz, bizId],
  }));
  const addRow = () => {
    setSaas((prev) => [...prev, { id: `saas${Date.now()}`, tool: "", cost: 0, biz: [], notes: "" }]);
    logActivity("create", "added a new tool to SaaS & Billing");
  };
  const removeRow = (id) => {
    const row = saas.find((s) => s.id === id);
    setSaas((prev) => prev.filter((s) => s.id !== id));
    logActivity("delete", `removed "${row?.tool || "a tool"}" from SaaS & Billing`);
  };

  return (
    <>
      <PageHeader eyebrow="Monthly spend" title="SaaS & Billing" right={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={addRow} className="wmx-body wmx-focus"
            style={{ display: "flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "9px 16px", fontWeight: 600 }}>
            <Plus size={15} /> Add tool
          </button>
          <Card style={{ padding: "10px 18px" }}>
            <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>Total / month</div>
            <div className="wmx-display" style={{ fontSize: 22, color: C.brass }}>${total.toLocaleString()}</div>
          </Card>
        </div>
      } />
      <Card style={{ padding: 6, overflowX: "auto" }}>
        <table className="wmx-body" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: C.sub, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "12px 14px" }}>Tool</th><th>$ / month</th><th>Businesses</th><th>Notes</th><th></th>
            </tr>
          </thead>
          <tbody>
            {saas.map((s) => (
              <tr key={s.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "8px 14px" }}><input value={s.tool} onChange={(e) => update(s.id, "tool", e.target.value)} placeholder="Tool name" className="wmx-focus" style={{ ...cellInput, fontWeight: 600 }} /></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    $<input type="number" min="0" value={s.cost} onChange={(e) => update(s.id, "cost", e.target.value === "" ? 0 : Number(e.target.value))}
                      className="wmx-focus" style={{ ...cellInput, width: 70, fontVariantNumeric: "tabular-nums" }} />
                  </div>
                </td>
                <td><BizTogglePills selected={s.biz} onToggle={(bizId) => toggleBiz(s.id, bizId)} /></td>
                <td><input value={s.notes} onChange={(e) => update(s.id, "notes", e.target.value)} placeholder="—"
                  className="wmx-focus" style={{ ...cellInput, color: s.notes?.toLowerCase().includes("confirm") ? C.warn : C.sub }} /></td>
                <td>
                  <button onClick={() => removeRow(s.id)} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={13} color={C.sub} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// Its own table with admin-only RLS (public.credential_accounts, policy
// checks public.is_admin()) — not part of the shared tracker_state blob, so
// this is a real database-level restriction, not just a hidden tab.
function AccountsTab() {
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [shown, setShown] = useState({}); // local-only reveal state, id -> bool

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: rows, error } = await supabase.from("credential_accounts").select("*").order("biz");
        if (error) throw error;
        if (!cancelled) setAccounts(rows || []);
      } catch (e) {
        console.warn("Could not load accounts:", e.message ?? e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("credential_accounts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "credential_accounts" }, (payload) => {
        setAccounts((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((a) => a.id !== payload.old.id);
          return [...prev.filter((a) => a.id !== payload.new.id), payload.new];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggle = (id) => setShown((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <PageHeader eyebrow="Logins per business · admins only" title="Accounts & Logins" />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.brassSoft, border: `1px solid ${C.brass}40`, borderRadius: 8, padding: 14, marginBottom: 18 }}>
        <AlertTriangle size={16} color={C.brass} style={{ flexShrink: 0, marginTop: 2 }} />
        <span className="wmx-body" style={{ fontSize: 12.5, color: C.ink }}>
          Restricted at the database level to admins — not just hidden in the UI. Still <b>not an encrypted vault</b>; keep anything highly sensitive elsewhere.
        </span>
      </div>
      {!loaded && <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Loading…</div>}
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
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: C.ink }}>{shown[a.id] ? a.password : "••••••••"}</span>
                    <button onClick={() => toggle(a.id)} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      {shown[a.id] ? <EyeOff size={14} color={C.sub} /> : <Eye size={14} color={C.sub} />}
                    </button>
                  </div>
                  {a.notes && <div className="wmx-body" style={{ fontSize: 11.5, color: C.warn, marginTop: 4 }}>{a.notes}</div>}
                </div>
              ))}
              {rows.length === 0 && loaded && (
                <div className="wmx-body" style={{ fontSize: 11.5, color: C.sub }}>No accounts logged for this business yet.</div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function TicketCard({ t, col, nextCol, canDelete, userName, assignableNames, contacts, onStatus, onRemove, onAddComment, onReassign, dragging, onDragStart, onDragEnd }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const b = bizById(t.biz);
  const assigneeEmail = t.assignee ? contacts[t.assignee] : null;
  const mailto = `mailto:${assigneeEmail || "ops@wmx.com"}?subject=${encodeURIComponent(`[${t.type}] ${t.title}`)}&body=${encodeURIComponent(`${t.details}\n\n— ${t.submitter || "Unknown"} (${b.name})`)}`;
  const overdue = !!t.dueDate && t.status !== "resolved" && t.dueDate < new Date().toISOString().slice(0, 10);
  const comments = t.comments || [];

  const submitComment = () => {
    if (!draft.trim()) return;
    onAddComment(t.id, draft.trim(), userName || "Unknown");
    setDraft("");
  };

  return (
    <Card draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); onDragStart?.(t.id); }} onDragEnd={onDragEnd}
      style={{ padding: 14, borderTop: `3px solid ${col.accent}`, cursor: "grab", opacity: dragging ? 0.4 : 1 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Pill color={b.color} bg={b.soft}>{b.name}</Pill>
        <Pill color={C.sub} bg={C.bg}>{t.type}</Pill>
        <Pill color={PRIORITY_COLOR[t.priority] || C.brass} bg={C.bg}>{PRIORITY_LABEL[t.priority] || "Medium"}</Pill>
        <select value={t.assignee || ""} onChange={(e) => onReassign(t.id, e.target.value)} draggable={false}
          className="wmx-body wmx-focus"
          style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, border: `1px solid ${t.assignee ? C.brass : C.line}`, background: t.assignee ? C.brassSoft : "transparent", color: t.assignee ? C.brass : C.sub, cursor: "pointer" }}>
          <option value="">Unassigned</option>
          {assignableNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="wmx-display" style={{ fontSize: 14, color: C.ink }}>{t.title}</div>
      {t.details && <div className="wmx-body" style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{t.details}</div>}
      <div className="wmx-body" style={{ fontSize: 11, color: C.sub, marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span>{t.submitter || "Unknown"} · {t.created}</span>
        {t.dueDate && (
          <span style={{ color: overdue ? C.warn : C.sub, fontWeight: overdue ? 700 : 400 }}>
            · Due {t.dueDate}{overdue ? " (overdue)" : ""}
          </span>
        )}
      </div>

      <button onClick={() => setExpanded((s) => !s)} className="wmx-body wmx-focus"
        style={{ marginTop: 8, fontSize: 11, color: C.brass, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
        {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? "s" : ""}` : "Add comment"}
      </button>

      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
          {comments.map((c) => (
            <div key={c.id} style={{ marginBottom: 6 }}>
              <div className="wmx-body" style={{ fontSize: 11, color: C.ink }}><b>{c.by}</b> <span style={{ color: C.sub }}>· {c.at}</span></div>
              <div className="wmx-body" style={{ fontSize: 12, color: C.ink }}>{c.text}</div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitComment()} draggable={false}
              placeholder="Add a comment…" className="wmx-body wmx-focus" style={{ flex: 1, padding: 6, border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12 }} />
            <button onClick={submitComment} className="wmx-body wmx-focus"
              style={{ fontSize: 11, background: C.ink, color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontWeight: 600 }}>
              Post
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
        <a href={mailto} className="wmx-body" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: C.brass, textDecoration: "none" }}>
          <Mail size={12} /> {t.assignee ? `Email ${t.assignee}` : "Email ops"}
        </a>
        <div style={{ display: "flex", gap: 4 }}>
          {nextCol && (
            <button onClick={() => onStatus(t.id, nextCol)} title={`Move to ${nextCol.replace("_", " ")}`} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
              <ChevronRight size={15} color={C.sub} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onRemove(t.id)} className="wmx-focus" style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
              <Trash2 size={13} color={C.sub} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function TicketsTab({ tickets, setTickets, assignableNames, userName, onTicketAssigned, canDelete, logActivity }) {
  const [showForm, setShowForm] = useState(false);
  const blankForm = () => ({ biz: "wm", type: "question", title: "", details: "", submitter: userName || "", assignee: "", priority: "medium", dueDate: "" });
  const [form, setForm] = useState(blankForm);
  const [filterBiz, setFilterBiz] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [contacts, setContacts] = useState({});

  useEffect(() => {
    let cancelled = false;
    supabase.from("team_contacts").select("name, email").then(({ data, error }) => {
      if (!error && !cancelled) setContacts(Object.fromEntries((data || []).map((r) => [r.name, r.email])));
    });
    return () => { cancelled = true; };
  }, []);

  const addTicket = () => {
    if (!form.title.trim()) return;
    const ticket = { ...form, id: `t${Date.now()}`, status: "open", created: "Today", comments: [] };
    setTickets((prev) => [...prev, ticket]);
    if (ticket.assignee) onTicketAssigned(ticket);
    logActivity("create", `opened ticket "${ticket.title}"`, ticket.biz);
    setForm(blankForm());
    setShowForm(false);
  };
  const setStatus = (id, status) => {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket || ticket.status === status) return;
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    logActivity("update", `moved "${ticket.title}" to ${status.replace("_", " ")}`, ticket.biz);
  };
  const remove = (id) => {
    const ticket = tickets.find((t) => t.id === id);
    setTickets((prev) => prev.filter((t) => t.id !== id));
    logActivity("delete", `deleted ticket "${ticket.title}"`, ticket.biz);
  };
  const reassign = (id, assignee) => {
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket || ticket.assignee === assignee) return;
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, assignee } : t));
    if (assignee) {
      onTicketAssigned({ ...ticket, assignee });
      logActivity("assign", `assigned "${ticket.title}" to ${assignee}`, ticket.biz);
    } else {
      logActivity("update", `unassigned "${ticket.title}"`, ticket.biz);
    }
  };
  const addComment = (id, text, by) => {
    const ticket = tickets.find((t) => t.id === id);
    setTickets((prev) => prev.map((t) => t.id !== id ? t : {
      ...t,
      comments: [...(t.comments || []), { id: `c${Date.now()}`, by, text, at: new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) }],
    }));
    logActivity("comment", `commented on "${ticket.title}"`, ticket.biz);
  };

  const columns = [
    { id: "open", label: "Open", accent: C.brass },
    { id: "in_progress", label: "In Progress", accent: C.navy },
    { id: "resolved", label: "Resolved", accent: C.pine },
  ];

  const filtered = tickets.filter((t) =>
    (filterBiz === "all" || t.biz === filterBiz) &&
    (filterPriority === "all" || (t.priority || "medium") === filterPriority) &&
    (!search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase()))
  );
  const sortColumn = (items) => [...items].sort((a, b) => {
    const p = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (p !== 0) return p;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.dueDate ? -1 : b.dueDate ? 1 : 0;
  });

  return (
    <>
      <PageHeader eyebrow="Shared board · visible to everyone with this link" title="Tickets" right={
        <button onClick={() => setShowForm((s) => !s)} className="wmx-body wmx-focus"
          style={{ display: "flex", alignItems: "center", gap: 6, background: C.ink, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "9px 16px", fontWeight: 600 }}>
          <Plus size={15} /> New ticket
        </button>
      } />

      {showForm && (
        <div className="wmx-body" style={{ position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 100 }}
          onClick={() => setShowForm(false)}>
          <Card style={{ padding: 24, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="wmx-display" style={{ fontSize: 17, color: C.ink, marginBottom: 16 }}>New ticket</div>
            <div className="wmx-form-grid" style={{ gap: 12 }}>
              <FormField label="Business">
                <select value={form.biz} onChange={(e) => setForm({ ...form, biz: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                  {BUSINESSES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </FormField>
              <FormField label="Type">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                  {["question", "idea", "request", "issue"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                </select>
              </FormField>
              <FormField label="Priority">
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                  {["high", "medium", "low"].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </FormField>
              <FormField label="Deadline">
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }} />
              </FormField>
              <FormField label="Title" span={2}>
                <input placeholder="What's this about?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }} />
              </FormField>
              <FormField label="Assign to">
                <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }}>
                  <option value="">Unassigned</option>
                  {assignableNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </FormField>
              <FormField label="Your name">
                <input placeholder="Submitted by" value={form.submitter} onChange={(e) => setForm({ ...form, submitter: e.target.value })} className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }} />
              </FormField>
              <FormField label="Details" span={2}>
                <textarea placeholder="Any extra context" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={3}
                  className="wmx-body" style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6, resize: "vertical", fontFamily: "inherit" }} />
              </FormField>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={addTicket} disabled={!form.title.trim()} className="wmx-body wmx-focus"
                style={{ background: form.title.trim() ? C.ink : C.line, color: form.title.trim() ? "#fff" : C.sub, border: "none", borderRadius: 6, cursor: form.title.trim() ? "pointer" : "default", fontSize: 13, padding: "9px 16px", fontWeight: 600 }}>
                Create ticket
              </button>
              <button onClick={() => setShowForm(false)} className="wmx-body wmx-focus"
                style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, cursor: "pointer", fontSize: 13, padding: "9px 16px", fontWeight: 600, color: C.ink }}>
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Search tickets…" value={search} onChange={(e) => setSearch(e.target.value)} className="wmx-body wmx-focus"
          style={{ padding: 7, border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12.5, minWidth: 160 }} />
        <select value={filterBiz} onChange={(e) => setFilterBiz(e.target.value)} className="wmx-body" style={{ padding: 7, border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12.5 }}>
          <option value="all">All businesses</option>
          {BUSINESSES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="wmx-body" style={{ padding: 7, border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12.5 }}>
          <option value="all">All priorities</option>
          {["high", "medium", "low"].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
      </div>

      <div className="wmx-ticket-board">
        {columns.map((col) => {
          const items = sortColumn(filtered.filter((t) => t.status === col.id));
          return (
            <div key={col.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span className="wmx-display" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, color: col.accent }}>{col.label}</span>
                <span className="wmx-body" style={{ fontSize: 11, color: C.sub, background: C.line, borderRadius: 999, padding: "1px 7px" }}>{items.length}</span>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
                onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
                onDrop={(e) => { e.preventDefault(); setDragOverCol(null); setStatus(e.dataTransfer.getData("text/plain"), col.id); }}
                style={{
                  display: "flex", flexDirection: "column", gap: 10, minHeight: 60, borderRadius: 8, padding: 4, margin: -4,
                  outline: dragOverCol === col.id ? `2px dashed ${col.accent}` : "2px dashed transparent", outlineOffset: -2,
                  transition: "outline-color .1s",
                }}>
                {items.map((t) => {
                  const nextCol = col.id === "open" ? "in_progress" : col.id === "in_progress" ? "resolved" : null;
                  return (
                    <TicketCard key={t.id} t={t} col={col} nextCol={nextCol} canDelete={canDelete} userName={userName} assignableNames={assignableNames} contacts={contacts}
                      dragging={draggingId === t.id}
                      onDragStart={setDraggingId} onDragEnd={() => setDraggingId(null)}
                      onStatus={setStatus} onRemove={remove} onAddComment={addComment} onReassign={reassign} />
                  );
                })}
                {items.length === 0 && <div className="wmx-body" style={{ fontSize: 12, color: C.sub, textAlign: "center", padding: "18px 0", border: `1px dashed ${C.line}`, borderRadius: 8 }}>Empty — drop a ticket here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// A single-series trend line — thin 2px stroke, rounded end, no axes/gridlines
// (recessive by design for a compact embedded sparkline), native <title> tags
// on each point stand in for a hover tooltip without extra chart machinery.
function Sparkline({ points, color }) {
  const width = 120, height = 30;
  if (points.length < 2) {
    return <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, height, display: "flex", alignItems: "center" }}>Not enough data yet for a trend line</div>;
  }
  const values = points.map((p) => p.followers);
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => [i * stepX, height - ((p.followers - min) / range) * height]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={6} fill="transparent">
          <title>{`${points[i].week_ending}: ${points[i].followers.toLocaleString()}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function StatTile({ label, value, delta, color }) {
  return (
    <div>
      <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div className="wmx-display" style={{ fontSize: 30, color }}>{value !== null && value !== undefined ? value.toLocaleString() : "—"}</div>
        {delta !== null && delta !== undefined && delta !== 0 && (
          <span className="wmx-body" style={{ fontSize: 12, fontWeight: 600, color: delta > 0 ? C.good : C.warn, display: "flex", alignItems: "center", gap: 2 }}>
            {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

function SocialTab({ logActivity }) {
  const [activeBiz, setActiveBiz] = useState(BUSINESSES[0].id);
  const [activePlatform, setActivePlatform] = useState(null);
  const [followersInput, setFollowersInput] = useState("");
  const [engagementInput, setEngagementInput] = useState("");
  const [saving, setSaving] = useState(false);
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
          supabase.from("weekly_snapshots").select("id, brand_id, platform_id, week_ending, followers, engagement, source, updated_at"),
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

  // default to the first platform once they've loaded
  useEffect(() => {
    if (!activePlatform && platforms.length > 0) setActivePlatform(platforms[0].id);
  }, [platforms, activePlatform]);

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

  const logSnapshot = useCallback(async (brandId, platformId, followers, engagement) => {
    const weekEnding = new Date().toISOString().slice(0, 10);
    try {
      const payload = { brand_id: brandId, platform_id: platformId, week_ending: weekEnding, source: "manual" };
      if (followers !== null) payload.followers = followers;
      if (engagement !== null) payload.engagement = engagement;
      const { error } = await supabase
        .from("weekly_snapshots")
        .upsert(payload, { onConflict: "brand_id,platform_id,week_ending" })
        .select();
      if (error) throw error;
      const platform = platforms.find((p) => p.id === platformId);
      const slug = brands.find((b) => b.id === brandId)?.slug;
      const bizId = Object.keys(BRAND_SLUG_BY_BIZ).find((id) => BRAND_SLUG_BY_BIZ[id] === slug);
      const parts = [];
      if (followers !== null) parts.push(`${followers.toLocaleString()} followers`);
      if (engagement !== null) parts.push(`${engagement.toLocaleString()} engagement`);
      logActivity("log", `logged ${parts.join(" / ")} for ${platform?.name || "a platform"}`, bizId);
    } catch (e) {
      console.error("Could not log stats:", e.message ?? e);
    }
  }, [brands, platforms, logActivity]);

  const exportCsv = () => {
    const headers = ["Business", "Platform", "Followers", "Engagement", "As of", "Follower change vs previous"];
    const rows = [];
    BUSINESSES.forEach((b) => {
      const brandRow = brands.find((row) => row.slug === BRAND_SLUG_BY_BIZ[b.id]);
      if (!brandRow) return;
      platforms.forEach((p) => {
        const history = historyByKey[`${brandRow.id}:${p.id}`] || [];
        const latest = history[0];
        if (!latest) return;
        const delta = history[1] && latest.followers != null && history[1].followers != null ? latest.followers - history[1].followers : "";
        rows.push([b.name, p.name, latest.followers ?? "", latest.engagement ?? "", latest.week_ending, delta]);
      });
    });
    downloadCsv(`wmx-social-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
  };

  return (
    <>
      <PageHeader eyebrow="Weekly tracking · manual for now, ready for API sync later" title="Social Media Hub" right={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={exportCsv} className="wmx-body wmx-focus"
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 8, cursor: "pointer", fontSize: 12.5, padding: "8px 14px", fontWeight: 600 }}>
            <Download size={14} /> Export CSV
          </button>
          <Card style={{ padding: "10px 18px" }}>
            <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6 }}>Total followers</div>
            <div className="wmx-display" style={{ fontSize: 22, color: C.brass }}>{totalFollowers.toLocaleString()}</div>
          </Card>
        </div>
      } />
      {!loaded && <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Loading social stats…</div>}
      {loaded && brands.length === 0 && (
        <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub }}>
          No brands/platforms found in Supabase yet — nothing to show here.
        </div>
      )}

      {loaded && brands.length > 0 && (() => {
        const brandRow = brands.find((row) => row.slug === BRAND_SLUG_BY_BIZ[activeBiz]);
        const platform = platforms.find((p) => p.id === activePlatform);
        const key = brandRow && platform ? `${brandRow.id}:${platform.id}` : null;
        const history = key ? (historyByKey[key] || []) : [];
        const latest = history[0] || null;
        const previous = history[1] || null;
        const followerDelta = latest?.followers != null && previous?.followers != null ? latest.followers - previous.followers : null;
        const engagementDelta = latest?.engagement != null && previous?.engagement != null ? latest.engagement - previous.engagement : null;
        const followerPoints = [...history].reverse().filter((h) => h.followers != null).map((h) => ({ week_ending: h.week_ending, followers: h.followers }));
        const engagementPoints = [...history].reverse().filter((h) => h.engagement != null).map((h) => ({ week_ending: h.week_ending, followers: h.engagement }));

        const submitLog = async () => {
          const f = followersInput.trim() === "" ? null : parseInt(followersInput, 10);
          const e = engagementInput.trim() === "" ? null : parseInt(engagementInput, 10);
          if (f === null && e === null) return;
          setSaving(true);
          await logSnapshot(brandRow.id, platform.id, f, e);
          setSaving(false);
          setFollowersInput("");
          setEngagementInput("");
        };

        return (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {BUSINESSES.map((b) => (
                <button key={b.id} onClick={() => setActiveBiz(b.id)} className="wmx-body wmx-focus"
                  style={{ fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, border: `1px solid ${activeBiz === b.id ? b.color : C.line}`, background: activeBiz === b.id ? b.color : "transparent", color: activeBiz === b.id ? "#fff" : C.ink, cursor: "pointer" }}>
                  {b.name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
              {platforms.map((p) => (
                <button key={p.id} onClick={() => setActivePlatform(p.id)} className="wmx-body wmx-focus"
                  style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 999, border: `1px solid ${activePlatform === p.id ? (p.color_hex || C.brass) : C.line}`, background: activePlatform === p.id ? (p.color_hex || C.brass) : "transparent", color: activePlatform === p.id ? "#fff" : C.ink, cursor: "pointer" }}>
                  {p.name}
                </button>
              ))}
            </div>

            {!brandRow && <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub }}>{bizById(activeBiz).name} isn't set up in Supabase yet.</div>}

            {brandRow && platform && (
              <Card style={{ padding: 24 }}>
                <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginBottom: 18 }}>
                  <StatTile label="Followers" value={latest?.followers} delta={followerDelta} color={C.brass} />
                  <StatTile label="Engagement" value={latest?.engagement} delta={engagementDelta} color={platform.color_hex || C.navy} />
                </div>
                <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, marginBottom: 14 }}>
                  {latest ? `as of ${latest.week_ending}` : "no data logged yet"}
                </div>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 18 }}>
                  <div>
                    <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>Followers trend</div>
                    <Sparkline points={followerPoints} color={C.brass} />
                  </div>
                  <div>
                    <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>Engagement trend</div>
                    <Sparkline points={engagementPoints} color={platform.color_hex || C.navy} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
                  <FormField label="Followers">
                    <input value={followersInput} onChange={(e) => setFollowersInput(e.target.value)} placeholder="New count" type="number" min="0"
                      onKeyDown={(e) => e.key === "Enter" && submitLog()}
                      className="wmx-body wmx-focus" style={{ width: 120, padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12.5 }} />
                  </FormField>
                  <FormField label="Engagement">
                    <input value={engagementInput} onChange={(e) => setEngagementInput(e.target.value)} placeholder="New count" type="number" min="0"
                      onKeyDown={(e) => e.key === "Enter" && submitLog()}
                      className="wmx-body wmx-focus" style={{ width: 120, padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 12.5 }} />
                  </FormField>
                  <button onClick={submitLog} disabled={(!followersInput && !engagementInput) || saving} className="wmx-body wmx-focus"
                    style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 6, border: "none", cursor: (followersInput || engagementInput) ? "pointer" : "default", background: (followersInput || engagementInput) ? C.ink : C.line, color: (followersInput || engagementInput) ? "#fff" : C.sub }}>
                    {saving ? "…" : "Log this week"}
                  </button>
                </div>
              </Card>
            )}
          </>
        );
      })()}
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
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "admin", label: "Admin", icon: ShieldCheck },
];

const ACTIVITY_ICON_COLOR = { create: C.good, update: C.brass, delete: C.warn, comment: C.navy, assign: C.brass, log: C.pine };

function ActivityTab() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from("activity_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        if (!cancelled) setEntries(rows || []);
      } catch (e) {
        console.warn("Could not load activity:", e.message ?? e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("activity_log_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, (payload) => {
        setEntries((prev) => [payload.new, ...prev].slice(0, 100));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <>
      <PageHeader eyebrow="Who did what, across the whole app" title="Activity" />
      {!loaded && <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Loading…</div>}
      {loaded && entries.length === 0 && (
        <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub }}>Nothing logged yet — actions across the app will show up here live.</div>
      )}
      <Card style={{ padding: 4 }}>
        {entries.map((e, i) => {
          const b = e.biz ? bizById(e.biz) : null;
          return (
            <div key={e.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACTIVITY_ICON_COLOR[e.action] || C.sub, marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="wmx-body" style={{ fontSize: 13, color: C.ink }}>
                  <b>{e.actor}</b> {e.detail}
                  {b && <span style={{ color: C.sub }}> · {b.name}</span>}
                </div>
                <div className="wmx-body" style={{ fontSize: 10.5, color: C.sub, marginTop: 1 }}>
                  {new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}

// Admin-only: manage who has admin access. Direct writes to app_admins are
// blocked for everyone (no insert/update/delete RLS policy on it) — every
// change goes through the admin_set_role RPC, which re-checks admin status
// server-side and also updates the target account's role in auth.users if
// it already exists (the sign-up trigger only stamps role at account
// creation, so a role change after that has to happen here instead).
function AdminTab({ userEmail, logActivity }) {
  const [accounts, setAccounts] = useState([]); // [{ email, role, joined }] — every real account, plus any pre-authorized email that hasn't signed in yet
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ data: userRows, error: userErr }, { data: adminRows, error: adminErr }] = await Promise.all([
        supabase.rpc("admin_list_users"),
        supabase.from("app_admins").select("email"),
      ]);
      if (userErr) throw userErr;
      if (adminErr) throw adminErr;
      const merged = {};
      (userRows || []).forEach((u) => {
        merged[u.email] = { email: u.email, role: u.role === "admin" ? "admin" : "member", joined: true };
      });
      (adminRows || []).forEach((r) => {
        if (!merged[r.email]) merged[r.email] = { email: r.email, role: "admin", joined: false };
      });
      setAccounts(Object.values(merged).sort((a, b) => a.email.localeCompare(b.email)));
      setError(null);
    } catch (e) {
      setError(e.message ?? "Could not load accounts.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("app_admins_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_admins" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const setRole = async (targetEmail, makeAdmin) => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc("admin_set_role", { target_email: targetEmail, make_admin: makeAdmin });
      if (err) throw err;
      logActivity(makeAdmin ? "assign" : "delete", `${makeAdmin ? "granted" : "revoked"} admin access for ${targetEmail}`);
      if (makeAdmin) setEmail("");
      await load();
    } catch (e) {
      setError(e.message ?? "Could not update that account.");
    } finally {
      setBusy(false);
    }
  };

  const grant = () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !/^\S+@\S+\.\S+$/.test(clean)) { setError("Enter a valid email."); return; }
    if (!clean.endsWith("@wmx.group")) { setError("Only @wmx.group accounts can be admins."); return; }
    setRole(clean, true);
  };

  return (
    <>
      <PageHeader eyebrow="Admin only · who has full access" title="Admin" />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.brassSoft, border: `1px solid ${C.brass}40`, borderRadius: 8, padding: 14, marginBottom: 18 }}>
        <AlertTriangle size={16} color={C.brass} style={{ flexShrink: 0, marginTop: 2 }} />
        <span className="wmx-body" style={{ fontSize: 12.5, color: C.ink }}>
          Admins can see Accounts & Logins, delete tickets, edit Team task statuses, and grant/revoke admin access — including their own.
          If an account already exists for the email, its access changes immediately; otherwise it takes effect the moment they first sign in.
        </span>
      </div>

      <Card style={{ padding: 18, marginBottom: 18 }}>
        <div className="wmx-display" style={{ fontSize: 14, color: C.ink, marginBottom: 10 }}>Pre-authorize a new admin</div>
        <div className="wmx-body" style={{ fontSize: 11.5, color: C.sub, marginBottom: 10 }}>
          For someone who hasn't signed in yet — their account doesn't exist until they do, so it can't show up in the list below.
          Already have an account? Just change their access level directly in the list instead.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <FormField label="Email" span={2}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && grant()}
              placeholder="name@wmx.group" type="email" className="wmx-body wmx-focus"
              style={{ minWidth: 200, padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }} />
          </FormField>
          <FormField label="Access level">
            <select value="admin" disabled className="wmx-body"
              style={{ padding: 8, border: `1px solid ${C.line}`, borderRadius: 6, background: C.bg, color: C.ink }}>
              <option value="admin">Admin</option>
            </select>
          </FormField>
          <button onClick={grant} disabled={busy} className="wmx-body wmx-focus"
            style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 6, padding: "9px 16px", cursor: busy ? "default" : "pointer", fontWeight: 600, fontSize: 13 }}>
            Grant
          </button>
        </div>
        {error && <div className="wmx-body" style={{ fontSize: 12, color: C.warn, marginTop: 8 }}>{error}</div>}
      </Card>

      <div className="wmx-display" style={{ fontSize: 14, color: C.ink, marginBottom: 10 }}>All accounts</div>
      {!loaded && <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub }}>Loading…</div>}
      <Card style={{ padding: 4 }}>
        {loaded && accounts.length === 0 && (
          <div className="wmx-body" style={{ fontSize: 12.5, color: C.sub, padding: 14 }}>No accounts yet.</div>
        )}
        {accounts.map((a, i) => (
          <div key={a.email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderTop: i === 0 ? "none" : `1px solid ${C.line}`, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {a.role === "admin" ? <ShieldCheck size={14} color={C.brass} /> : <Users size={14} color={C.sub} />}
              <span className="wmx-body" style={{ fontSize: 13, color: C.ink }}>{a.email}</span>
              {!a.joined && <Pill color={C.sub} bg={C.bg}>Not signed in yet</Pill>}
              {a.email === userEmail && <Pill color={C.sub} bg={C.bg}>You</Pill>}
            </div>
            <select value={a.role} onChange={(e) => setRole(a.email, e.target.value === "admin")} disabled={busy}
              className="wmx-body wmx-focus"
              style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: `1px solid ${a.role === "admin" ? C.brass : C.line}`, background: a.role === "admin" ? C.brassSoft : "transparent", color: a.role === "admin" ? C.brass : C.ink, cursor: busy ? "default" : "pointer" }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
      </Card>
    </>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

// Identity comes straight from the signed-in account — Google's profile name,
// or the name given at sign-up, or (last resort) the email's local part —
// never a separate "who's this" screen the user has to get past first.
function deriveDisplayName(session) {
  const meta = session?.user?.user_metadata || {};
  if (meta.display_name) return meta.display_name.trim();
  if (meta.full_name) return meta.full_name.trim();
  if (meta.name) return meta.name.trim();
  const local = (session?.user?.email || "").split("@")[0] || "";
  return local.replace(/[._]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function LoginScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Google redirects failures back as #error_description=... in the URL
  // rather than throwing client-side (e.g. an account outside @wmx.group
  // rejected by the sign-up trigger) — surface it instead of silently
  // bouncing back to a blank login screen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const desc = params.get("error_description");
    if (desc) {
      setError(desc);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const withGoogle = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (err) { setError(err.message); setGoogleBusy(false); }
      // on success the browser redirects away, so no need to reset googleBusy
    } catch (e) {
      setError(e.message ?? "Could not start Google sign-in.");
      setGoogleBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (mode === "signup" && !name.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "signup" && !/@wmx\.group$/i.test(email.trim())) {
      setError("Sign-up is restricted to @wmx.group accounts.");
      setBusy(false);
      return;
    }
    try {
      // Call directly on supabase.auth (not destructured into a variable) —
      // these are class methods that rely on `this`, and destructuring them
      // off the object loses that binding, throwing before any request
      // is ever sent.
      const { error: err } = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
      if (err) setError(err.message);
      else if (mode === "signup") setNotice("Check your email to confirm your account, then sign in.");
    } catch (e) {
      setError(e.message ?? "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wmx-body" style={{ minHeight: "100%", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{FONTS}</style>
      <Card style={{ padding: "36px 32px 28px", maxWidth: 380, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 26 }}>
          <img src={wmxCrest} alt="WMX" style={{ width: 68, height: 68, borderRadius: "50%", marginBottom: 16, boxShadow: `0 0 0 1px ${C.line}` }} />
          <div className="wmx-display" style={{ fontSize: 21, color: C.ink, lineHeight: 1.15 }}>Welcome to WMX</div>
          <div className="wmx-body" style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Sign in to Portfolio Control</div>
        </div>

        <button onClick={withGoogle} disabled={googleBusy} className="wmx-body wmx-focus"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "11px 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", cursor: googleBusy ? "default" : "pointer", fontSize: 13.5, fontWeight: 600, color: C.ink }}>
          <GoogleGlyph /> {googleBusy ? "Redirecting…" : "Continue with Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: C.line }} />
          <span className="wmx-body" style={{ fontSize: 10, color: C.sub, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>Or continue with email</span>
          <div style={{ flex: 1, height: 1, background: C.line }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mode === "signup" && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name"
              className="wmx-body wmx-focus" style={{ padding: 10, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13.5 }} />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@wmx.group" autoComplete="email"
            className="wmx-body wmx-focus" style={{ padding: 10, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13.5 }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="wmx-body wmx-focus" style={{ padding: 10, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13.5 }} />
          {error && <div className="wmx-body" style={{ fontSize: 12, color: C.warn }}>{error}</div>}
          {notice && <div className="wmx-body" style={{ fontSize: 12, color: C.good }}>{notice}</div>}
          <button type="submit" disabled={busy} className="wmx-body wmx-focus"
            style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 8, padding: "11px 14px", cursor: busy ? "default" : "pointer", fontWeight: 600, fontSize: 13.5, marginTop: 4 }}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button onClick={() => { setMode((m) => m === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }} className="wmx-body wmx-focus"
          style={{ display: "block", width: "100%", textAlign: "center", marginTop: 16, fontSize: 12, color: C.sub, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          {mode === "signin" ? "New to WMX? Create an account" : "Already have an account? Sign in"}
        </button>

        <div className="wmx-body" style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.line}`, textAlign: "center", fontSize: 10.5, color: C.sub }}>
          Internal tool · access restricted to @wmx.group accounts
        </div>
      </Card>
    </div>
  );
}

function NamePrompt({ current, onChoose, onCancel }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="wmx-body" style={{ position: "fixed", inset: 0, background: "rgba(20,18,12,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 100 }}>
      <Card style={{ padding: 28, maxWidth: 360, width: "100%" }}>
        <div className="wmx-display" style={{ fontSize: 18, color: C.ink, marginBottom: 6 }}>Change your display name</div>
        <div className="wmx-body" style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>
          Labels your changes for the team (e.g. "Aly updated 2 min ago") and lets teammates assign you tickets. Currently: <b>{current}</b>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New name"
            onKeyDown={(e) => e.key === "Enter" && draft.trim() && onChoose(draft)}
            autoFocus
            className="wmx-body wmx-focus" style={{ flex: 1, padding: 8, border: `1px solid ${C.line}`, borderRadius: 6 }} />
          <button onClick={() => onChoose(draft)} disabled={!draft.trim()} className="wmx-body wmx-focus"
            style={{ background: C.ink, color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: draft.trim() ? "pointer" : "default", fontWeight: 600 }}>
            Save
          </button>
        </div>
        <button onClick={onCancel} className="wmx-body wmx-focus"
          style={{ marginTop: 12, fontSize: 12, color: C.sub, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Cancel
        </button>
      </Card>
    </div>
  );
}

function OnboardingTour({ onDismiss }) {
  const steps = [
    { icon: ListChecks, title: "Setup Progress", body: "Track onboarding for each business — updates sync live to the whole team as soon as anyone makes them." },
    { icon: BarChart3, title: "KPIs", body: "Four tabs, one per business — Watermark Design Build, Twofold Coffee & Kitchen, Manolo Roofing, Garrison House." },
    { icon: Share2, title: "Social Media Hub", body: "Log weekly follower counts per platform and see the week-over-week change." },
    { icon: Inbox, title: "Tickets", body: "Assign a ticket to a teammate and they get a live notification, even if they're on a different tab." },
    { icon: Save, title: "Autosave", body: "Changes save automatically a couple seconds after you stop — no need to remember to hit Save." },
  ];
  return (
    <div className="wmx-body" style={{ position: "fixed", inset: 0, background: "rgba(20,18,12,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 100 }}>
      <Card style={{ padding: 28, maxWidth: 440, width: "100%" }}>
        <div className="wmx-display" style={{ fontSize: 20, color: C.ink, marginBottom: 4 }}>Welcome to WMX Portfolio Control</div>
        <div className="wmx-body" style={{ fontSize: 13, color: C.sub, marginBottom: 18 }}>
          A quick look at how this works before you dive in.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: C.brassSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} color={C.brass} />
                </div>
                <div>
                  <div className="wmx-display" style={{ fontSize: 13, color: C.ink }}>{s.title}</div>
                  <div className="wmx-body" style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>{s.body}</div>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onDismiss} className="wmx-body wmx-focus"
          style={{ width: "100%", background: C.ink, color: "#fff", border: "none", borderRadius: 6, padding: "10px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
          Got it — let's go
        </button>
      </Card>
    </div>
  );
}

export default function WMXTracker() {
  const [tab, setTab] = useState("setup");
  const [data, setData] = useState(seedState);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [lastSaved, setLastSaved] = useState(null);
  const [lastEditedBy, setLastEditedBy] = useState(null);
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [remoteBanner, setRemoteBanner] = useState(null); // { by, at } when a remote save lands while dirty
  const [toasts, setToasts] = useState([]); // in-app "you were assigned a ticket" banners
  const [unreadCount, setUnreadCount] = useState(0);
  const dirtyRef = useRef(dirty);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  // real auth: Google OAuth or email/password, backed by Supabase Auth —
  // the "who's this" name is now a display label on top of a real account,
  // not the whole login.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // first-ever login for this account: show a one-time walkthrough. Tracked
  // on the account itself (not localStorage) so it follows them across
  // devices and only ever shows once, the same way the display name does.
  useEffect(() => {
    if (session && !session.user.user_metadata?.has_onboarded) setShowTour(true);
  }, [session]);

  const dismissTour = () => {
    setShowTour(false);
    supabase.auth.updateUser({ data: { has_onboarded: true } });
  };

  const userName = useMemo(() => deriveDisplayName(session), [session]);
  const isAdmin = session?.user?.user_metadata?.role === "admin";

  // First time we see an account with no display_name saved yet (a fresh
  // Google sign-in, or an old account from before sign-up asked for a name),
  // persist the derived one so it's stable from here on — no separate
  // "who's this" screen the user has to get past first.
  useEffect(() => {
    if (!session) return;
    if (!session.user.user_metadata?.display_name && userName) {
      supabase.auth.updateUser({ data: { display_name: userName } });
    }
  }, [session, userName]);

  const chooseName = async (name) => {
    const clean = name.trim();
    if (!clean) return;
    await supabase.auth.updateUser({ data: { display_name: clean } });
    setEditingName(false);
    // Ask now, while we still have the click as a user gesture — browsers
    // refuse silent/background permission prompts.
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // fire-and-forget: one row per discrete action, shown live on the Activity tab.
  const logActivity = useCallback((action, detail, biz) => {
    supabase.from("activity_log").insert({ actor: userName || "Unknown", action, detail, biz }).then(({ error }) => {
      if (error) console.error("Could not log activity:", error.message);
    });
  }, [userName]);

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
          const incomingOnboarding = isValidOnboarding(incoming.data?.onboarding) ? incoming.data.onboarding : null;
          if (dirtyRef.current) {
            // don't silently overwrite unsaved local edits elsewhere — let the
            // user decide. Setup Progress is a shared checklist, not a
            // freeform field, so it stays live for everyone regardless.
            if (incomingOnboarding) setData((prev) => ({ ...prev, onboarding: incomingOnboarding }));
            setRemoteBanner({ by: incoming.updated_by, at: incoming.updated_at });
          } else if (incomingOnboarding) {
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

  const setStack = useCallback((updater) => {
    setData((prev) => ({ ...prev, stack: typeof updater === "function" ? updater(prev.stack) : updater }));
    markDirty();
  }, [markDirty]);

  const setSaas = useCallback((updater) => {
    setData((prev) => ({ ...prev, saas: typeof updater === "function" ? updater(prev.saas) : updater }));
    markDirty();
  }, [markDirty]);

  const setTickets = useCallback((updater) => {
    setData((prev) => ({ ...prev, tickets: typeof updater === "function" ? updater(prev.tickets) : updater }));
    markDirty();
  }, [markDirty]);

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

  if (!authChecked) {
    return <div className="wmx-body" style={{ minHeight: "100%", background: C.bg }} />;
  }
  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="wmx-body wmx-shell" style={{ minHeight: "100%", background: C.bg }}>
      <style>{FONTS}</style>

      <aside className="wmx-sidebar" style={{ background: C.sidebar, borderRight: `1px solid ${C.line}`, padding: "22px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
          <img src={wmxCrest} alt="" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0 }} />
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
            {isAdmin && <Pill color={C.brass} bg={C.brassSoft}>Admin</Pill>}
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
            <button onClick={() => setEditingName(true)} title="Change display name" className="wmx-focus"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <Pencil size={12} color={C.sub} />
            </button>
            <button onClick={() => supabase.auth.signOut()} title="Sign out" className="wmx-focus"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
              <LogOut size={13} color={C.sub} />
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

        <nav className="wmx-nav">
          {TABS.filter((t) => (t.id !== "accounts" && t.id !== "admin") || isAdmin).map((t) => {
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

      <main className="wmx-main">
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
          {tab === "setup" && <SetupProgress onboarding={data.onboarding} setOnboarding={setOnboarding} logActivity={logActivity} />}
          {tab === "team" && <TeamTab team={data.team} setTeam={setTeam} canEdit={isAdmin} logActivity={logActivity} />}
          {tab === "stack" && <StackTab stack={data.stack} setStack={setStack} logActivity={logActivity} />}
          {tab === "kpis" && <KpiTab kpis={data.kpis} setKpis={setKpis} />}
          {tab === "social" && <SocialTab logActivity={logActivity} />}
          {tab === "saas" && <SaasTab saas={data.saas} setSaas={setSaas} logActivity={logActivity} />}
          {tab === "accounts" && isAdmin && <AccountsTab />}
          {tab === "tickets" && <TicketsTab tickets={data.tickets} setTickets={setTickets} assignableNames={assignableNames} userName={userName} onTicketAssigned={notifyAssignee} canDelete={isAdmin} logActivity={logActivity} />}
          {tab === "activity" && <ActivityTab />}
          {tab === "admin" && isAdmin && <AdminTab userEmail={session?.user?.email} logActivity={logActivity} />}

          <div className="wmx-body" style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", fontSize: 11, color: C.sub, flexWrap: "wrap", gap: 6 }}>
            <span>WMX Management Group — internal tool</span>
            <span>Synced to Supabase · everyone with this app URL shares the same data</span>
          </div>
        </div>
      </main>

      <div style={{ position: "fixed", top: 18, right: 18, left: 18, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, zIndex: 50 }}>
        {toasts.map((n) => (
          <Card key={n.id} style={{ padding: "12px 14px", boxShadow: "0 6px 18px rgba(20,20,15,0.14)", borderLeft: `3px solid ${C.brass}`, maxWidth: 320, width: "100%" }}>
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

      {editingName && <NamePrompt current={userName} onChoose={chooseName} onCancel={() => setEditingName(false)} />}
      {showTour && !editingName && <OnboardingTour onDismiss={dismissTour} />}
    </div>
  );
}
