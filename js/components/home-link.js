// ─── HOME LINK RESET ────────────────────────────────────
// Clicking a Home control clears the homepage session cache
// (scroll position / filter / sort) so index.html always loads
// in its default state: all products, featured sort, no filter.
const HOME_CACHE_KEY = 'grabby_cache';

(function () {
    const links = document.querySelectorAll('[data-home-link]');
    links.forEach((a) => {
        a.addEventListener('click', () => {
            try { sessionStorage.removeItem(HOME_CACHE_KEY); } catch (e) { /* ignore */ }
        });
    });
})();