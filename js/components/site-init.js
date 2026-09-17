// ─── SITE INIT (E-Shop Demo) ─────────────────────────────
// Tiny bootstrap included on every public page: applies the
// database-driven store profile (name / tagline / footer note) plus the
// 100%-dynamic store settings (logo, shipping/currency cache, footer
// links, about content, chatbot). Never blocks render.
import { loadSiteProfile } from '../core/site.js';
import { loadStoreSettings } from '../core/store-settings.js';
import { renderDynamicLinks } from './footer-links.js';

function initSite() {
    loadSiteProfile();
    loadStoreSettings().then(() => renderDynamicLinks()).catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSite);
} else {
    initSite();
}
