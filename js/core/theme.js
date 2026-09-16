// ─── THEME ──────────────────────────────────────────────
import { STORAGE_KEYS } from './config.js';
import { createClient } from '../supabase/client.js';

const COLORS_CACHE_KEY = 'grabby_site_colors';
const HF_CACHE_KEY = 'grabby_header_footer_colors';
export const HF_DEFAULT = '#000000';

// Map of settings key suffix -> CSS custom property
export const SITE_COLOR_KEYS = {
    bg: '--bg',
    card: '--card-bg',
    secondary: '--secondary-bg',
    text: '--text',
    textSecondary: '--text-secondary',
    border: '--border',
    accent: '--accent',
    headerBg: '--header-bg',
    headerText: '--header-text'
};

export function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (saved === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
}

export function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(STORAGE_KEYS.theme, 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem(STORAGE_KEYS.theme, 'dark');
    }
}

export function bindThemeToggle(btn) {
    if (!btn) return;
    btn.addEventListener('click', toggleTheme);
}

// ─── SITE COLOR PRESETS (silver / light / dark / custom) ──
export function getSitePalette() {
    try {
        return JSON.parse(localStorage.getItem(COLORS_CACHE_KEY)) || null;
    } catch {
        return null;
    }
}

export function saveSitePalette(palette) {
    try {
        localStorage.setItem(COLORS_CACHE_KEY, JSON.stringify(palette));
    } catch { /* noop */ }
}

export function applySitePalette(palette) {
    const root = document.documentElement;
    const colors = (palette && palette.colors) || {};
    if (palette && palette.preset && palette.preset !== 'custom') {
        root.setAttribute('data-chrome', palette.preset);
        Object.keys(SITE_COLOR_KEYS).forEach(key =>
            root.style.removeProperty(SITE_COLOR_KEYS[key])
        );
    } else {
        root.removeAttribute('data-chrome');
        Object.keys(SITE_COLOR_KEYS).forEach(key => {
            if (colors[key]) root.style.setProperty(SITE_COLOR_KEYS[key], colors[key]);
            else root.style.removeProperty(SITE_COLOR_KEYS[key]);
        });
    }
}

// ─── HEADER & FOOTER SOLID COLOR (per color mode, default matte black) ──
// Stored in the existing `settings` table as:
//   header_footer_bg_light + header_footer_bg_dark
export function getHeaderFooterColors() {
    try {
        const cached = JSON.parse(localStorage.getItem(HF_CACHE_KEY)) || {};
        return {
            light: normalizeHexColor(cached.light) || HF_DEFAULT,
            dark: normalizeHexColor(cached.dark) || HF_DEFAULT
        };
    } catch {
        return { light: HF_DEFAULT, dark: HF_DEFAULT };
    }
}

export function applyHeaderFooterColors(colors) {
    const root = document.documentElement;
    const light = normalizeHexColor(colors && colors.light) || HF_DEFAULT;
    const dark = normalizeHexColor(colors && colors.dark) || HF_DEFAULT;
    root.style.setProperty('--hf-bg-light', light);
    root.style.setProperty('--hf-bg-dark', dark);
}

export function normalizeHexColor(value) {
    if (typeof value !== 'string') return null;
    let v = value.trim().toLowerCase();
    if (!v) return null;
    if (v.charAt(0) !== '#') v = '#' + v;
    if (/^#[0-9a-f]{3}$/.test(v)) {
        v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    }
    return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

// Applies cached colors immediately, then refreshes from Supabase async.
export function loadSitePalette() {
    const cached = getSitePalette();
    if (cached) applySitePalette(cached);
    applyHeaderFooterColors(getHeaderFooterColors());

    (async () => {
        try {
            const supabase = createClient();
            if (!supabase) return;
            const keys = ['theme_preset', ...Object.keys(SITE_COLOR_KEYS).map(k => 'theme_' + k),
                'header_footer_bg_light', 'header_footer_bg_dark'];
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .in('key', keys);
            if (error) throw error;
            if (data && data.length) {
                const map = {};
                data.forEach(row => { map[row.key] = row.value; });
                const preset = map.theme_preset || 'silver';
                const colors = {};
                Object.keys(SITE_COLOR_KEYS).forEach(key => {
                    if (map['theme_' + key]) colors[key] = map['theme_' + key];
                });
                const palette = { preset, colors };
                saveSitePalette(palette);
                applySitePalette(palette);
                const hf = {
                    light: normalizeHexColor(map.header_footer_bg_light) || HF_DEFAULT,
                    dark: normalizeHexColor(map.header_footer_bg_dark) || HF_DEFAULT
                };
                try { localStorage.setItem(HF_CACHE_KEY, JSON.stringify(hf)); } catch { /* noop */ }
                applyHeaderFooterColors(hf);
            }
        } catch (e) {
            console.warn('Failed to load site theme:', e);
        }
    })();
}