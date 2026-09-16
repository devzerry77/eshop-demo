// ─── SITE PROFILE (E-Shop Demo) ──────────────────────────
// Database-driven store identity. Admin edits these in
// Admin → Settings → Store Profile (rows in the `settings` table):
//   site_name, site_tagline, footer_note
// Cached in localStorage for instant first paint.
import { createClient } from '../supabase/client.js';

export const SITE_KEYS = ['site_name', 'site_tagline', 'footer_note'];

export const DEFAULT_SITE = {
    site_name: 'E-Shop Demo',
    site_tagline: 'Quality demo products for everyday life.',
    footer_note: '© 2026 E-Shop Demo · Demo portfolio project — no real orders are fulfilled.'
};

const CACHE_KEY = 'eshop_site_profile';

export function getCachedSite() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) return Object.assign({}, DEFAULT_SITE, JSON.parse(raw));
    } catch (_) { /* noop */ }
    return Object.assign({}, DEFAULT_SITE);
}

export function applySiteProfile(site) {
    const s = Object.assign({}, DEFAULT_SITE, site || {});
    document.querySelectorAll('[data-site-name]').forEach(el => {
        if (el.tagName === 'IMG') el.alt = s.site_name;
        else el.textContent = s.site_name;
    });
    document.querySelectorAll('[data-site-tagline]').forEach(el => {
        el.textContent = s.site_tagline;
    });
    document.querySelectorAll('[data-footer-note]').forEach(el => {
        el.textContent = s.footer_note;
    });
    return s;
}

export async function loadSiteProfile() {
    const cached = getCachedSite();
    applySiteProfile(cached);
    try {
        const supabase = createClient();
        if (!supabase) return cached;
        const { data, error } = await supabase
            .from('settings')
            .select('key,value')
            .in('key', SITE_KEYS);
        if (error || !data) return cached;
        const fresh = Object.assign({}, cached);
        data.forEach(row => {
            if (row && row.value && SITE_KEYS.includes(row.key)) fresh[row.key] = row.value;
        });
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch (_) { /* noop */ }
        applySiteProfile(fresh);
        return fresh;
    } catch (e) {
        console.warn('Failed to load site profile:', e);
        return cached;
    }
}
