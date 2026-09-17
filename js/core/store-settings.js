// ─── STORE SETTINGS (100% dynamic storefront) ───────────────
// Central loader for every remaining admin-editable setting:
//   shipping_free_above, shipping_cost, currency_code, currency_symbol,
//   logo_url, footer_links (JSON), about_content (JSON),
//   chatbot_intro (JSON), chatbot_options (JSON)
// Pattern matches the rest of the app: instant paint from localStorage,
// then refresh from Supabase `settings` table.
import { createClient } from '../supabase/client.js';

export const STORE_SETTING_KEYS = [
    'shipping_free_above', 'shipping_cost',
    'currency_code', 'currency_symbol', 'logo_url',
    'footer_links', 'about_content',
    'chatbot_intro', 'chatbot_options'
];

export const DEFAULT_STORE_SETTINGS = {
    shipping_free_above: '2000',
    shipping_cost: '100',
    currency_code: 'BDT',
    currency_symbol: '৳',
    logo_url: 'assets/logo.svg',
    footer_links: '{"policies":[],"about":[],"connect":[]}',
    about_content: '{}',
    chatbot_intro: '[]',
    chatbot_options: '[]'
};

const LS_PREFIX = 'eshop_';

function lsGet(key, fallback) {
    try {
        const v = localStorage.getItem(LS_PREFIX + key);
        return v !== null && v !== undefined ? v : fallback;
    } catch (_) { return fallback; }
}

function lsSet(key, value) {
    try { localStorage.setItem(LS_PREFIX + key, String(value)); } catch (_) { /* noop */ }
}

// ─── SYNC READERS (safe to call during render) ──────────────
export function getShippingThreshold() {
    const n = parseFloat(lsGet('shipping_free_above', DEFAULT_STORE_SETTINGS.shipping_free_above));
    return Number.isFinite(n) && n >= 0 ? n : 2000;
}

export function getShippingCost() {
    const n = parseFloat(lsGet('shipping_cost', DEFAULT_STORE_SETTINGS.shipping_cost));
    return Number.isFinite(n) && n >= 0 ? n : 100;
}

export function calcShipping(subtotal) {
    const s = Number(subtotal) || 0;
    return s >= getShippingThreshold() ? 0 : getShippingCost();
}

export function getCurrencySymbol() {
    return lsGet('currency_symbol', DEFAULT_STORE_SETTINGS.currency_symbol) || '৳';
}

export function getCurrencyCode() {
    return lsGet('currency_code', DEFAULT_STORE_SETTINGS.currency_code) || 'BDT';
}

export function getLogoUrl() {
    return lsGet('logo_url', DEFAULT_STORE_SETTINGS.logo_url) || 'assets/logo.svg';
}

export function getFooterLinks() {
    const fallback = { policies: [], about: [], connect: [] };
    try {
        const raw = lsGet('footer_links', '');
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return {
            policies: Array.isArray(parsed.policies) ? parsed.policies : [],
            about: Array.isArray(parsed.about) ? parsed.about : [],
            connect: Array.isArray(parsed.connect) ? parsed.connect : []
        };
    } catch (_) { return fallback; }
}

export function getAboutContent() {
    try {
        const raw = lsGet('about_content', '');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) { return null; }
}

export function getChatbotIntro() {
    try {
        const raw = lsGet('chatbot_intro', '');
        if (!raw) return null;
        const arr = JSON.parse(raw);
        return Array.isArray(arr) && arr.length ? arr.map(String) : null;
    } catch (_) { return null; }
}

export function getChatbotOptions() {
    try {
        const raw = lsGet('chatbot_options', '');
        if (!raw) return null;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr) || !arr.length) return null;
        return arr.filter(o => o && o.key && o.label && o.reply);
    } catch (_) { return null; }
}

// ─── LOGO APPLY ─────────────────────────────────────────────
export function applyLogo(url) {
    const src = (url || getLogoUrl() || '').trim() || 'assets/logo.svg';
    document.querySelectorAll('img.logo-img, img.brand-logo').forEach(img => {
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && favicon.getAttribute('href') !== src) {
        // Only swap favicon when the logo is an image URL (not inline SVG issues).
        favicon.setAttribute('href', src);
    }
}

// ─── ASYNC LOADER ───────────────────────────────────────────
export async function loadStoreSettings() {
    // Instant paint from cache.
    applyLogo(getLogoUrl());
    try {
        const supabase = createClient();
        if (!supabase) return getCachedStoreSettings();
        const { data, error } = await supabase
            .from('settings')
            .select('key,value')
            .in('key', STORE_SETTING_KEYS);
        if (error || !data) return getCachedStoreSettings();
        data.forEach(row => {
            if (row && STORE_SETTING_KEYS.includes(row.key) && row.value !== null && row.value !== undefined) {
                lsSet(row.key, row.value);
            }
        });
        applyLogo(getLogoUrl());
        return getCachedStoreSettings();
    } catch (e) {
        console.warn('Failed to load store settings:', e);
        return getCachedStoreSettings();
    }
}

export function getCachedStoreSettings() {
    const out = {};
    STORE_SETTING_KEYS.forEach(k => {
        out[k] = lsGet(k, DEFAULT_STORE_SETTINGS[k]);
    });
    return out;
}
