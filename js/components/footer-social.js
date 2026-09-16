// ─── FOOTER SOCIAL LINKS ─────────────────────────────────
// Renders a row of social icons in the site footer. Each icon only
// appears when the admin has configured a URL for that platform
// (stored in the 'settings' Supabase table + mirrored to localStorage).
import { createClient } from '../supabase/client.js';

const FA_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';

const SOCIALS = [
    { id: 'facebook', icon: 'fa-facebook-f', label: 'Facebook' },
    { id: 'instagram', icon: 'fa-instagram', label: 'Instagram' },
    { id: 'youtube', icon: 'fa-youtube', label: 'YouTube' },
    { id: 'tiktok', icon: 'fa-tiktok', label: 'TikTok' },
    { id: 'x', icon: 'fa-x-twitter', label: 'X' }
];

let container = null;

function ensureFontAwesome() {
    const hasFA = document.querySelector('link[rel="stylesheet"][href*="font-awesome"]');
    if (hasFA) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FA_CSS;
    document.head.appendChild(link);
}

function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getContainer() {
    if (container) return container;
    const inner = document.querySelector('.footer-inner');
    if (!inner) return null;
    let el = document.getElementById('footerSocial');
    if (!el) {
        el = document.createElement('div');
        el.id = 'footerSocial';
        el.className = 'footer-social';
        const copy = inner.querySelector('.footer-copy');
        if (copy) inner.insertBefore(el, copy);
        else inner.appendChild(el);
    }
    container = el;
    return container;
}

function render() {
    const el = getContainer();
    if (!el) return;
    el.innerHTML = SOCIALS.map(s => {
        const url = (localStorage.getItem('eshop_social_' + s.id) || '').trim();
        const attrs = url
            ? `href="${escapeAttr(url)}" target="_blank" rel="noopener"`
            : `tabindex="-1" aria-disabled="true"`;
        const cls = url ? 'footer-social-link' : 'footer-social-link is-empty';
        return `<a class="${cls}" ${attrs} aria-label="${s.label}"><i class="fa-brands ${s.icon}" aria-hidden="true"></i></a>`;
    }).join('');
    el.style.display = 'flex';
}

async function load() {
    ensureFontAwesome();
    render();

    try {
        const supabase = createClient();
        if (!supabase) return;
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .in('key', SOCIALS.map(s => 'social_' + s.id));
        if (error) throw error;
        (data || []).forEach(row => {
            const id = String(row.key).replace(/^social_/, '');
            localStorage.setItem('eshop_social_' + id, row.value || '');
        });
        render();
    } catch (e) {
        console.warn('Failed to load footer social links:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    load();
    window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('eshop_social_')) render();
    });
});