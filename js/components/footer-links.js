// ─── FOOTER LINKS + SIDEBAR CONNECT (DB-driven) ─────────────
// Renders `.footer-nav` columns (Policies / About Us / Connect) and the
// sidebar `[data-shop-list]`-adjacent CONNECT section from the
// `settings.footer_links` JSON value. Falls back to existing static HTML
// when no links are configured.
import { getFooterLinks, loadStoreSettings } from '../core/store-settings.js';

function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function linkHTML(link) {
    const label = escapeHtml(link.label || 'Link');
    const url = escapeHtml(link.url || '#');
    const external = /^https?:\/\//i.test(link.url || '');
    return `<li><a href="${url}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a></li>`;
}

export function renderFooterLinks() {
    const links = getFooterLinks();
    const nav = document.querySelector('.footer-nav');
    if (!nav) return;
    const hasAny = links.policies.length || links.about.length || links.connect.length;
    if (!hasAny) return; // keep static fallback HTML
    const cols = nav.querySelectorAll('.footer-col');
    if (cols.length < 3) return;
    const lists = nav.querySelectorAll('.footer-col ul');
    if (lists.length < 3) return;
    if (links.policies.length) lists[0].innerHTML = links.policies.map(linkHTML).join('');
    if (links.about.length) lists[1].innerHTML = links.about.map(linkHTML).join('');
    if (links.connect.length) lists[2].innerHTML = links.connect.map(linkHTML).join('');
}

export function renderSidebarConnect() {
    const links = getFooterLinks();
    if (!links.connect.length) return;
    // Sidebar CONNECT section: find the menu-section whose H3 is CONNECT.
    document.querySelectorAll('.sidebar-menu .menu-section').forEach(section => {
        const h3 = section.querySelector('h3');
        if (h3 && h3.textContent.trim().toUpperCase() === 'CONNECT') {
            const ul = section.querySelector('ul');
            if (ul && !ul.hasAttribute('data-shop-list')) {
                ul.innerHTML = links.connect.map(linkHTML).join('');
            }
        }
    });
}

export function renderDynamicLinks() {
    renderFooterLinks();
    renderSidebarConnect();
}

export async function loadFooterLinks() {
    renderDynamicLinks(); // instant paint from cache
    await loadStoreSettings();
    renderDynamicLinks(); // re-paint after Supabase refresh
    try {
        // Live-update when admin saves in another tab.
        window.addEventListener('storage', (e) => {
            if (e.key === 'eshop_footer_links') renderDynamicLinks();
        });
    } catch (_) { /* noop */ }
}

// Auto-run on every public page (same pattern as footer-social.js).
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadFooterLinks());
} else {
    loadFooterLinks();
}
