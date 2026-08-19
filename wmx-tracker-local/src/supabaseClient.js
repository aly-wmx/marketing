import { createClient } from "@supabase/supabase-js";

// Fallback values point at the WMX Marketing Supabase project so the deployed
// app works without extra Vercel env var setup. The anon key is meant to be
// public — Row Level Security on the table is the actual access boundary.
const FALLBACK_URL = "https://frfxjipxplzahgahlfpg.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZnhqaXB4cGx6YWhnYWhsZnBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MTkzMDcsImV4cCI6MjEwMjM5NTMwN30.hCqrvtmyfsEWP9rjI9jRqxs_kM8VY1QDRWcApUoB9R0";

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

export const supabase = createClient(url, key);
