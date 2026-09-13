// ─── ABOUT PAGE ───────────────────────────────────────
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';

loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'grabby_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);