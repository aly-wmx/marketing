import { createClient } from "@supabase/supabase-js";

// Fallback values point at the WMX Marketing Supabase project so the deployed
// app works without extra Vercel env var setup. The anon key is meant to be
// public — Row Level Security on the table is the actual access boundary.
const FALLBACK_URL = "https://frfxjipxplzahgahlfpg.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZnhqaXB4cGx6YWhnYWhsZnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MTkzMDcsImV4cCI6MjEwMjM5NTMwN30.hCqrvtmyfsEWP9rjI9jRqxs_kM8VY1QDRWcApUoB9R0";

// Vercel env vars occasionally pick up a stray character when pasted (a
// non-breaking space, curly quote, BOM) that's invisible in the dashboard
// but breaks outright once it lands in an HTTP header (apikey / Authorization),
// throwing "String contains non ISO-8859-1 code point" on every request. Guard
// against that by only trusting an env value that actually looks like a
// Supabase URL / JWT, falling back to the known-good hardcoded values otherwise.
const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isValidUrl = (v) => !!v && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(v);
const isValidKey = (v) => !!v && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v);

const url = isValidUrl(rawUrl) ? rawUrl : FALLBACK_URL;
const key = isValidKey(rawKey) ? rawKey : FALLBACK_ANON_KEY;

export const supabase = createClient(url, key);
