// ─── MOBILE BOTTOM NAVIGATION (AliExpress-style) ─────────────
// Injects a 4-item fixed bottom bar on mobile screens only.
// Every item connects to existing pages/features:
//   Home      → index.html (or scroll-to-top when already there)
//   Category  → open the existing Filter & Sort panel on the shop page
//   Cart      → open the page's cart sidebar (shop / product), else jump to index.html?open=cart
//   Account   → login.html when signed out, profile.html when signed in (session-aware)
// Desktop is untouched — the bar is display:none above the mobile breakpoint.
(() => {
    if (location.pathname.includes('/admin')) return;
    if (document.getElementById('mobileBottomNav')) return;

    const CART_KEY = 'grabby_cart';
    let badgeEl = null;

    function getCartCount() {
        try {
            const arr = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
            return arr.reduce((sum, item) => sum + (item.quantity || 1), 0);
        } catch (e) {
            return 0;
        }
    }

    function updateBadge() {
        if (!badgeEl) return;
        const n = getCartCount();
        badgeEl.textContent = n;
        badgeEl.hidden = n < 1;
    }

    function isHomePage() {
        return location.pathname === '/' || location.pathname.endsWith('/index.html');
    }

    function isMyOrdersPage() {
        return /\/my-orders\.html$/.test(location.pathname);
    }

    function isAccountPage() {
        return /(?:login|profile)\.html$/.test(location.pathname);
    }

    function buildNav() {
        const nav = document.createElement('nav');
        nav.className = 'mobile-bottom-nav';
        nav.id = 'mobileBottomNav';
        nav.setAttribute('aria-label', 'Mobile navigation');
        nav.innerHTML = `
            <div class="nav-inner">
                <a class="nav-item${isHomePage() ? ' active' : ''}" href="index.html" aria-label="Home" data-nav="home">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span>Home</span>
                </a>
                <a class="nav-item" href="index.html?open=filter" aria-label="Category" data-nav="category">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    <span>Category</span>
                </a>
                <a class="nav-item" href="index.html?open=cart" aria-label="Cart" data-nav="cart">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    <span>Cart</span>
                    <span class="nav-badge" id="mobileNavCartCount" hidden>0</span>
                </a>
                <a class="nav-item${isAccountPage() ? ' active' : ''}" href="login.html" aria-label="Account" data-nav="account">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>Account</span>
                </a>
            </div>`;
        document.body.appendChild(nav);
        badgeEl = nav.querySelector('#mobileNavCartCount');
        updateBadge();
    }

    function openLocalCart() {
        const btn = document.getElementById('cartToggleBtn') || document.getElementById('pageCartBtn');
        if (btn) { btn.click(); return true; }
        const sb = document.getElementById('cartSidebar');
        if (sb) {
            sb.classList.add('active');
            const ov = document.getElementById('overlay');
            if (ov) ov.classList.add('active');
            document.body.style.overflow = 'hidden';
            return true;
        }
        return false;
    }

    function wireEvents() {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('.mobile-bottom-nav .nav-item');
            if (!a) return;
            const key = a.dataset.nav;

            if (key === 'home') {
                if (isHomePage()) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                return;
            }

            if (key === 'category') {
                const filterPanel = document.getElementById('filterPanel');
                if (filterPanel) {
                    e.preventDefault();
                    filterPanel.classList.add('active');
                    return;
                }
            }

            if (key === 'cart') {
                if (openLocalCart()) e.preventDefault();
                return;
            }
        });

        window.addEventListener('storage', (e) => { if (e.key === CART_KEY) updateBadge(); });
        document.addEventListener('visibilitychange', updateBadge);

        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="add-cart"], [data-action="cart-inc"], [data-action="cart-dec"], [data-action="cart-remove"], .add-cart-btn, .bar-add-cart')) {
                setTimeout(updateBadge, 60);
            }
        }, { passive: true });
    }

    async function applySignedInRouting() {
        const accountItem = document.querySelector('.mobile-bottom-nav [data-nav="account"]');
        if (!accountItem) return;
        try {
            const { createClient } = await import('../supabase/client.js');
            const supabase = createClient();
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (user) accountItem.href = 'profile.html';
        } catch (e) { /* noop — keep login.html */ }
    }

    function init() {
        buildNav();
        wireEvents();
        applySignedInRouting();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();