// ─── SUPABASE CLIENT ────────────────────────────────────
// Loaded as an ES module. Import createClient() anywhere on the public pages.
const SUPABASE_URL = "https://arzzuvnuyrhfbqaiwily.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenp1dm51eXJoZmJxYWl3aWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyODc0NDksImV4cCI6MjEwNDg2MzQ0OX0.q1cPuElRwIrX8uhoq-Hhv-JDZL7hF2QLfmX15ok6_tc";

let client = null;

export function createClient() {
    if (client) return client;
    const url = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL)
        ? process.env.SUPABASE_URL : SUPABASE_URL;
    const key = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY)
        ? process.env.SUPABASE_ANON_KEY : SUPABASE_ANON_KEY;
    if (typeof window === 'undefined' || !window.supabase || typeof window.supabase.createClient !== 'function') {
        console.warn('Supabase library not loaded. Make sure the UMD bundle is included before this module.');
        return null;
    }
    client = window.supabase.createClient(url, key);
    return client;
}

export function getSupabaseUrl() {
    return (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL)
        ? process.env.SUPABASE_URL : SUPABASE_URL;
}

export function getSupabaseAnonKey() {
    return (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY)
        ? process.env.SUPABASE_ANON_KEY : SUPABASE_ANON_KEY;
}

export default { createClient, getSupabaseUrl, getSupabaseAnonKey };