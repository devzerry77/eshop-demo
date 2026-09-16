// ─── SUPABASE CLIENT (E-Shop Demo) ───────────────────────
// Loaded as an ES module. Import createClient() anywhere on the public pages.
// Credentials resolve from js/supabase/supabase-config.js (window.ESHOP_*,
// overridable via git-ignored js/supabase/supabase.local.js).
// The anon key is public by design. NEVER use the service_role key here.
const FALLBACK_URL = "https://qjbttdimbnurqslknwvn.supabase.co";
const FALLBACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqYnR0ZGltYm51cnFzbGtud3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NzA1OTEsImV4cCI6MjEwNTE0NjU5MX0.KNI5wt5I2mRmBWJRlfsIi0nbWPk9aC3BQ2oTHKe18xQ";

function resolveUrl() {
    try {
        if (typeof window !== 'undefined' && window.ESHOP_SUPABASE_URL) return window.ESHOP_SUPABASE_URL;
    } catch (_) { /* noop */ }
    if (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
    return FALLBACK_URL;
}

function resolveKey() {
    try {
        if (typeof window !== 'undefined' && window.ESHOP_SUPABASE_ANON_KEY) return window.ESHOP_SUPABASE_ANON_KEY;
    } catch (_) { /* noop */ }
    if (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
    return FALLBACK_ANON_KEY;
}

let client = null;

export function createClient() {
    if (client) return client;
    const url = resolveUrl();
    const key = resolveKey();
    if (typeof window === 'undefined' || !window.supabase || typeof window.supabase.createClient !== 'function') {
        console.warn('Supabase library not loaded. Make sure the UMD bundle is included before this module.');
        return null;
    }
    client = window.supabase.createClient(url, key);
    return client;
}

export function getSupabaseUrl() {
    return resolveUrl();
}

export function getSupabaseAnonKey() {
    return resolveKey();
}

export default { createClient, getSupabaseUrl, getSupabaseAnonKey };