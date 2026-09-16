// ─── SITE INIT (E-Shop Demo) ─────────────────────────────
// Tiny bootstrap included on every public page: applies the
// database-driven store profile (name / tagline / footer note).
// Loaded as a module AFTER the page's own scripts; never blocks render.
import { loadSiteProfile } from '../core/site.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadSiteProfile());
} else {
    loadSiteProfile();
}
