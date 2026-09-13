// ─── THEME ──────────────────────────────────────────────
import { STORAGE_KEYS } from './config.js';
import { createClient } from '../supabase/client.js';

const COLORS_CACHE_KEY = 'grabby_site_colors';

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

// Applies cached colors immediately, then refreshes from Supabase async.
export function loadSitePalette() {
    const cached = getSitePalette();
    if (cached) applySitePalette(cached);

    (async () => {
        try {
            const supabase = createClient();
            if (!supabase) return;
            const keys = ['theme_preset', ...Object.keys(SITE_COLOR_KEYS).map(k => 'theme_' + k)];
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
            }
        } catch (e) {
            console.warn('Failed to load site theme:', e);
        }
    })();
}