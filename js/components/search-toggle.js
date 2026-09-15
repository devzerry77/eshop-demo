// ─── SEARCH TOGGLE (mobile) ───────────────────────────────
// Shows/hides the header search bar on mobile screens.
// Hidden by default on mobile; toggled via the search icon in header-actions.
(() => {
    if (location.pathname.includes('/admin')) return;
    const header = document.querySelector('.header');
    const toggle = document.getElementById('searchToggleBtn');
    const bar    = document.getElementById('searchBar');
    const input  = document.getElementById('searchInput');
    if (!header || !toggle || !bar) return;

    let closing = false;

    function hideSuggestions() {
        const sug = document.getElementById('searchSuggestions');
        if (sug) sug.classList.remove('active');
    }

    toggle.addEventListener('click', () => {
        if (closing) return;
        const open = header.classList.contains('search-open');

        if (open) {
            input?.blur();
            hideSuggestions();
            header.classList.remove('search-open');
            header.classList.add('search-closing');
            closing = true;
            toggle.setAttribute('aria-expanded', 'false');
            header.addEventListener('animationend', function end() {
                header.classList.remove('search-closing');
                header.removeEventListener('animationend', end);
                closing = false;
            });
        } else {
            header.classList.add('search-open');
            header.classList.remove('search-closing');
            toggle.setAttribute('aria-expanded', 'true');
            if (input) setTimeout(() => input.focus(), 120);
        }
    });
})();