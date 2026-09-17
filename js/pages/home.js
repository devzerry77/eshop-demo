// ─── HOME PAGE ──────────────────────────────────────────
import { CACHE_KEY, CACHE_EXPIRY, STORAGE_KEYS } from '../core/config.js';
import { formatPrice, renderStars, escapeHtml, canFulfill } from '../core/utils.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { loadMarquee } from './marquee.js';
import { initFlashSale } from './flash-sale.js';
import { initHeroBanners } from './hero-banners.js';
import { fetchIPAndLocation, logCartActivity, trackVisitor, trackCartAdd } from './tracking.js';
import { getSearchResults, highlightMatch, getKeywordSuggestions } from '../core/search.js';
import { buildProductCardHTML } from '../core/product-grid.js';
import { ensureProducts } from '../core/products-loader.js';
import { getCategories, renderFilterChips, renderSidebarLinks } from '../core/categories.js';
import { pushRecentlyViewed, getRecentlyViewed } from '../core/premium.js';
import { bindProductCards, flashCardButton, syncCardButtons } from '../core/product-card-actions.js';

// ─── CACHE MANAGER ─────────────────────────────────────
function getCache() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        if (Date.now() - cache.timestamp > CACHE_EXPIRY) {
            sessionStorage.removeItem(CACHE_KEY);
            return null;
        }
        return cache;
    } catch { return null; }
}

function setCache(data) {
    const existing = getCache();
    const cache = {
        products: data,
        timestamp: Date.now(),
        scrollY: existing ? existing.scrollY : (window.scrollY || 0),
        filter: currentCategory,
        sort: currentSort,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function restoreCache() {
    const cache = getCache();
    if (cache) {
        productsData = cache.products;
        currentCategory = cache.filter || 'all';
        currentSort = cache.sort || 'featured';
        return true;
    }
    return false;
}

// ─── SKELETON LOADER ──────────────────────────────────
let skeletonStartTime = 0;
const MIN_SKELETON_DISPLAY_MS = 1000;
const FADE_OUT_MS = 500;

function renderSkeletonCards() {
    const container = document.getElementById('productSkeleton');
    if (!container) return;
    const grid = container.querySelector('.skeleton-grid');
    if (!grid) return;
    let html = '';
    for (let i = 0; i < 8; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-image"></div>
                <div class="skeleton-text long"></div>
                <div class="skeleton-text short"></div>
                <div class="skeleton-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
    }
    grid.innerHTML = html;
}

function showSkeleton() {
    const skeleton = document.getElementById('productSkeleton');
    if (skeleton) {
        if (!skeleton.querySelector('.skeleton-grid').children.length) renderSkeletonCards();
        skeleton.classList.remove('hiding');
        skeleton.style.display = 'block';
        void skeleton.offsetWidth;
        skeleton.classList.add('active');
        skeletonStartTime = Date.now();
    }
    const grid = document.getElementById('productGrid');
    if (grid) grid.style.display = 'none';
    const noMsg = document.getElementById('noProductsMsg');
    if (noMsg) noMsg.style.display = 'none';
}

function hideSkeleton() {
    const skeleton = document.getElementById('productSkeleton');
    if (skeleton) {
        skeleton.classList.add('hiding');
        setTimeout(() => {
            skeleton.classList.remove('active', 'hiding');
            skeleton.style.display = 'none';
        }, FADE_OUT_MS);
    }
    const grid = document.getElementById('productGrid');
    if (grid) grid.style.display = 'grid';
}

function hideSkeletonWithDelay() {
    const elapsed = Date.now() - skeletonStartTime;
    const remaining = Math.max(0, MIN_SKELETON_DISPLAY_MS - elapsed);
    setTimeout(() => {
        const skeleton = document.getElementById('productSkeleton');
        if (skeleton && skeleton.classList.contains('active')) hideSkeleton();
    }, remaining);
}

// ─── STATE ──────────────────────────────────────────────
let productsData = [];
let cart = [];
let currentCategory = 'all';
let currentSort = 'featured';
let filteredProducts = [];
let displayedCount = 8;
let modalProductId = null;
let isLoadingMore = false;
let allLoaded = false;
let scrollObserver = null;
let suggestionCount = 0;
let suggestionIndex = -1;

// ─── DOM REFS ──────────────────────────────────────────
let grid, countEl, noMsg, searchInput, suggestions, cartCountEl;
let cartItemsEl, cartTotalEl, cartSidebar, cartToggleBtn, cartCloseBtn;
let overlay, sidebar, menuBtn, closeBtn, modalOverlay, modalCloseBtn;
let modalImage, modalTitle, modalCategory, modalRating, modalPrice;
let modalDesc, modalSpecs, modalAddBtn, sortSelect;
let checkoutBtn, toastContainer, themeToggle, filterBtn;
let filterPanel, filterPanelClose, searchSubmitBtn, searchClearBtn;
let loader, loadEndMsg;

function getRefs() {
    grid = document.getElementById('productGrid');
    countEl = document.getElementById('productCount');
    noMsg = document.getElementById('noProductsMsg');
    searchInput = document.getElementById('searchInput');
    suggestions = document.getElementById('searchSuggestions');
    cartCountEl = document.getElementById('cartCount');
    cartItemsEl = document.getElementById('cartItems');
    cartTotalEl = document.getElementById('cartTotalAmount');
    cartSidebar = document.getElementById('cartSidebar');
    cartToggleBtn = document.getElementById('cartToggleBtn');
    cartCloseBtn = document.getElementById('cartCloseBtn');
    overlay = document.getElementById('overlay');
    sidebar = document.getElementById('sidebar');
    menuBtn = document.getElementById('menuBtn');
    closeBtn = document.getElementById('closeBtn');
    modalOverlay = document.getElementById('productModal');
    modalCloseBtn = document.getElementById('modalCloseBtn');
    modalImage = document.getElementById('modalImage');
    modalTitle = document.getElementById('modalTitle');
    modalCategory = document.getElementById('modalCategory');
    modalRating = document.getElementById('modalRating');
    modalPrice = document.getElementById('modalPrice');
    modalDesc = document.getElementById('modalDesc');
    modalSpecs = document.getElementById('modalSpecs');
    modalAddBtn = document.getElementById('modalAddBtn');
    sortSelect = document.getElementById('sortSelect');
    checkoutBtn = document.getElementById('checkoutBtn');
    toastContainer = document.getElementById('toastContainer');
    themeToggle = document.getElementById('themeToggle');
    filterBtn = document.getElementById('filterBtn');
    filterPanel = document.getElementById('filterPanel');
    filterPanelClose = document.getElementById('filterPanelClose');
    searchSubmitBtn = document.getElementById('searchSubmitBtn');
    searchClearBtn = document.getElementById('searchClearBtn');
    loader = document.getElementById('loader');
    loadEndMsg = document.getElementById('loadEndMsg');
}

// ─── HELPERS ────────────────────────────────────────────
function getProduct(id) { return productsData.find(p => String(p.id) === String(id)); }
function getCartItem(id) { return cart.find(item => String(item.id) === String(id)); }
function getCartTotal() {
    return cart.reduce((sum, item) => sum + (getProduct(item.id)?.price || 0) * item.quantity, 0);
}
function getCartCount() { return cart.reduce((sum, item) => sum + item.quantity, 0); }

// ─── TOASTS ─────────────────────────────────────────────
function showToast(message, duration = 2000) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ─── DYNAMIC CATEGORIES (DB-driven, fallback to catalog) ──
function pickCategory(category) {
    currentCategory = category;
    displayedCount = 8;
    allLoaded = false;
    renderProducts(true);
    document.querySelectorAll('[data-mega-menu] .mega-link').forEach(a => {
        try {
            const slug = new URL(a.href, location.origin).searchParams.get('category') || 'all';
            a.classList.toggle('active', slug === category);
        } catch (_) {}
    });
    if (filterPanel) filterPanel.classList.remove('active');
    setTimeout(() => setupInfiniteScroll(), 200);
}

async function setupDynamicCategories() {
    try {
        const categories = await getCategories(productsData);
        const chips = document.getElementById('filterChips');
        if (chips) renderFilterChips(chips, categories, currentCategory, pickCategory);
        const shopList = document.querySelector('[data-shop-list]');
        if (shopList) renderSidebarLinks(shopList, categories);
        const mega = document.querySelector('[data-mega-menu]');
        if (mega) {
            mega.innerHTML = [{ slug: 'all', label: 'All' }, ...categories.filter(c => c && c.slug)].slice(0, 12).map(c =>
                `<a class="mega-link ${currentCategory === c.slug ? 'active' : ''}" href="collection.html?category=${encodeURIComponent(c.slug)}">${escapeHtml(c.label || c.slug)}</a>`
            ).join('');
        }
    } catch (e) {
        console.warn('Dynamic categories failed, keeping defaults:', e);
    }
}

function renderMerchandisingRails() {
    try {
        const byId = new Map(productsData.map(p => [String(p.id), p]));
        const featured = productsData.filter(p => p.isFeatured || (p.originalPrice && p.price < p.originalPrice)).slice(0, 8);
        const best = [...productsData].sort((a, b) => (b.reviews || 0) - (a.reviews || 0)).slice(0, 8);
        const fresh = productsData.filter(p => p.isNew).concat(productsData.slice(-8)).slice(0, 8);
        const recent = getRecentlyViewed().map(id => byId.get(String(id))).filter(Boolean).slice(0, 8);
        const paint = (key, list) => {
            const rail = document.querySelector(`[data-rail="${key}"]`);
            const sec = rail?.closest('section');
            if (!rail || !sec) return;
            if (!list.length) { sec.hidden = true; return; }
            sec.hidden = false;
            rail.innerHTML = list.map((p, i) => buildProductCardHTML(p, i, cart)).join('');
        };
        paint('featured', featured);
        paint('best', best);
        paint('new', fresh);
        paint('recent', recent);
    } catch (e) { console.warn('Rails failed:', e); }
}

// ─── INIT ───────────────────────────────────────────────
async function init() {
    getRefs();
    const cacheLoaded = restoreCache();
    if (!cacheLoaded) {
        showSkeleton();
        productsData = await ensureProducts();
        setCache(productsData);
    }

    await setupDynamicCategories();

    loadMarquee();
    initHeroBanners();
    fetchIPAndLocation();
    initFlashSale(productsData);

    const cartStored = localStorage.getItem(STORAGE_KEYS.cart);
    cart = cartStored ? JSON.parse(cartStored) : [];

    localStorage.setItem(STORAGE_KEYS.currency, 'BDT');

    loadTheme();
    loadSitePalette();
    trackVisitor();
    renderProducts();
    renderMerchandisingRails();
    updateCartUI();
    bindEvents();

    hideSkeletonWithDelay();

    const navParams = new URLSearchParams(location.search);
    const openAction = navParams.get('open');
    if (openAction) {
        history.replaceState(null, '', location.pathname);
        if (openAction === 'cart') setTimeout(openCart, 400);
        else if (openAction === 'filter') setTimeout(() => { if (filterPanel) filterPanel.classList.add('active'); }, 400);
    }

    window.addEventListener('pagehide', () => setCache(productsData));
    window.addEventListener('pageshow', () => {
        document.body.classList.remove('page-exit');
        // Repaint rails on return (e.g. recently-viewed after a product page).
        try { renderMerchandisingRails(); } catch (_) {}
    });
    window.addEventListener('popstate', (e) => {
        if (restoreCache()) {
            renderProducts();
            updateCartUI();
            hideSkeleton();
            const cache = getCache();
            if (cache) setTimeout(() => { window.scrollTo(0, cache.scrollY || 0); }, 0);
        } else {
            window.location.reload();
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('eshop_marquee_')) {
            loadMarquee();
        }
        if (e.key === STORAGE_KEYS.currency) {
            renderProducts();
            updateCartUI();
        }
        if (e.key === STORAGE_KEYS.products) {
            ensureProducts().then(list => {
                productsData = list;
                setCache(productsData);
                renderProducts();
                try { renderMerchandisingRails(); } catch (_) {}
            });
        }
    });

    setTimeout(() => {
        const skeleton = document.getElementById('productSkeleton');
        if (skeleton && skeleton.classList.contains('active')) hideSkeleton();
    }, 5000);
}

// ─── RENDER ─────────────────────────────────────────────
function renderProducts(resetScroll = true) {
    if (!grid) return;
    let filtered = productsData.filter(p => currentCategory === 'all' || p.category === currentCategory);
    switch (currentSort) {
        case 'popularity': filtered.sort((a, b) => (b.reviews || 0) - (a.reviews || 0)); break;
        case 'newest': filtered.sort((a, b) => (b.id || 0) - (a.id || 0)); break;
        case 'rating': filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0)); break;
        case 'price-asc': filtered.sort((a, b) => a.price - b.price); break;
        case 'price-desc': filtered.sort((a, b) => b.price - a.price); break;
        case 'name': filtered.sort((a, b) => String(a.title).localeCompare(String(b.title))); break;
        default: break;
    }
    filteredProducts = filtered;
    const total = filteredProducts.length;
    const show = Math.min(displayedCount, total);
    const toRender = filteredProducts.slice(0, show);

    if (total === 0) {
        grid.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        if (countEl) countEl.textContent = '0 products';
        if (loader) loader.style.display = 'none';
        if (loadEndMsg) loadEndMsg.style.display = 'none';
        allLoaded = true;
        const skeleton = document.getElementById('productSkeleton');
        if (skeleton && skeleton.classList.contains('active')) hideSkeleton();
        return;
    }
    if (noMsg) noMsg.style.display = 'none';
    if (countEl) countEl.textContent = total + ' products';

    const html = toRender.map((p, idx) => buildProductCardHTML(p, idx, cart)).join('');
    grid.innerHTML = html;

    if (show < total) {
        if (loader) loader.style.display = 'none';
        if (loadEndMsg) loadEndMsg.style.display = 'none';
        allLoaded = false;
    } else {
        if (loader) loader.style.display = 'none';
        if (loadEndMsg) loadEndMsg.style.display = 'block';
        allLoaded = true;
    }

    const skeleton = document.getElementById('productSkeleton');
    if (skeleton && skeleton.classList.contains('active')) {
        if (skeletonStartTime > 0 && Date.now() - skeletonStartTime > MIN_SKELETON_DISPLAY_MS) hideSkeleton();
    }

    if (resetScroll && grid.parentElement) grid.parentElement.scrollTop = 0;
}

function appendMoreProducts() {
    if (!grid) return;
    const total = filteredProducts.length;
    const start = displayedCount;
    const end = Math.min(start + 8, total);
    if (start >= total) return;
    const newCards = filteredProducts.slice(start, end);
    const html = newCards.map((p, idx) => buildProductCardHTML(p, start + idx, cart)).join('');
    grid.insertAdjacentHTML('beforeend', html);
    displayedCount = end;
    if (displayedCount >= total) {
        if (loader) loader.style.display = 'none';
        if (loadEndMsg) loadEndMsg.style.display = 'block';
        allLoaded = true;
    } else {
        if (loader) loader.style.display = 'none';
        if (loadEndMsg) loadEndMsg.style.display = 'none';
        allLoaded = false;
    }
}

function setupInfiniteScroll() {
    if (scrollObserver) scrollObserver.disconnect();
    const target = document.querySelector('.load-more-wrap');
    if (!target) return;
    scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !allLoaded) {
            const total = filteredProducts.length;
            if (displayedCount < total) {
                isLoadingMore = true;
                if (loader) loader.style.display = 'flex';
                setTimeout(() => {
                    appendMoreProducts();
                    isLoadingMore = false;
                    if (loader) loader.style.display = 'none';
                }, 400);
            }
        }
    }, { root: null, rootMargin: '0px 0px 200px 0px', threshold: 0.1 });
    scrollObserver.observe(target);
}

// ─── CART ───────────────────────────────────────────────
function addToCart(id) {
    const p = getProduct(id);
    if (!p || !p.inStock) return;
    const existing = getCartItem(id);
    if (!canFulfill(p, (existing ? existing.quantity : 0) + 1)) {
        showToast(`Only ${p.stockQty} available in stock`);
        return;
    }
    if (existing) existing.quantity += 1;
    else cart.push({ id, quantity: 1 });
    trackCartAdd();
    logCartActivity(id, p.title);
    saveCart();
    updateCartUI();
    flashCardButton(id);
    if (cartCountEl) cartCountEl.textContent = getCartCount();
    showToast(`${p.title} added to cart`);
}

function removeFromCart(id) {
    const idx = cart.findIndex(item => String(item.id) === String(id));
    if (idx === -1) return;
    if (cart[idx].quantity > 1) cart[idx].quantity -= 1;
    else cart.splice(idx, 1);
    saveCart();
    updateCartUI();
    syncCardButtons(id, cart.some(item => String(item.id) === String(id)));
    if (cartCountEl) cartCountEl.textContent = getCartCount();
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
    document.querySelectorAll('.p-add-btn, .add-cart-btn').forEach(btn => {
        const p = getProduct(parseInt(btn.dataset.id));
        if (p && p.inStock) btn.textContent = 'Add to Cart';
    });
    if (cartCountEl) cartCountEl.textContent = '0';
}
function saveCart() { localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart)); }

function updateCartUI() {
    if (!cartCountEl || !cartTotalEl || !cartItemsEl) return;
    cartCountEl.textContent = getCartCount();
    cartTotalEl.textContent = formatPrice(getCartTotal());
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<div class="empty-cart-msg">Your cart is empty.</div>';
        return;
    }
    cartItemsEl.innerHTML = cart.map(item => {
        const p = getProduct(item.id);
        if (!p) return '';
        const imageSrc = (p.images && p.images.length) ? p.images[0] : p.image;
        return `
            <div class="cart-item" data-id="${item.id}">
                <div class="item-image"><img src="${imageSrc}" alt="${escapeHtml(p.title)}" /></div>
                <div class="item-info">
                    <div class="item-title">${escapeHtml(p.title)}</div>
                    <div class="item-price">${formatPrice(p.price)}</div>
                </div>
                <div class="item-qty">
                    <button data-action="cart-dec" data-id="${item.id}">−</button>
                    <span>${item.quantity}</span>
                    <button data-action="cart-inc" data-id="${item.id}">+</button>
                </div>
                <button class="item-remove" data-action="cart-remove" data-id="${item.id}">✕</button>
            </div>
        `;
    }).join('');
}

// ─── MODAL ──────────────────────────────────────────────
function openModal(id) {
    const p = getProduct(id);
    if (!p) return;
    modalProductId = id;
    const imageSrc = (p.images && p.images.length) ? p.images[0] : p.image;
    if (modalImage) modalImage.innerHTML = `<img src="${imageSrc}" alt="${escapeHtml(p.title)}" />`;
    if (modalTitle) modalTitle.textContent = p.title;
    if (modalCategory) modalCategory.textContent = p.category.toUpperCase();
    if (modalRating) modalRating.innerHTML = `<span class="stars">${renderStars(p.rating)}</span> (${p.reviews} reviews)`;
    if (modalPrice) modalPrice.innerHTML = `${formatPrice(p.price)} ${p.originalPrice ? `<span>${formatPrice(p.originalPrice)}</span>` : ''}`;
    if (modalDesc) modalDesc.textContent = p.description;
    if (modalSpecs && p.specs && Object.keys(p.specs).length) {
        modalSpecs.innerHTML = Object.entries(p.specs).map(([k, v]) =>
            `<span class="spec-label">${escapeHtml(k)}</span><span class="spec-value">${escapeHtml(v)}</span>`
        ).join('');
    } else if (modalSpecs) {
        modalSpecs.innerHTML = '<span class="spec-label">No specs</span><span class="spec-value">—</span>';
    }
    if (modalAddBtn) {
        modalAddBtn.textContent = p.inStock ? 'Add to Cart' : 'Sold Out';
        modalAddBtn.disabled = !p.inStock;
        modalAddBtn.onclick = () => {
            if (p.inStock) {
                addToCart(id);
                modalAddBtn.textContent = '✓ Added!';
                setTimeout(() => modalAddBtn.textContent = 'Add to Cart', 1000);
            }
        };
    }
    if (modalOverlay) {
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}
function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
    modalProductId = null;
}

// ─── NAVIGATE (same-tab: reliable, no popup-blocker issues) ──
function navigateToProduct(id) {
    pushRecentlyViewed(id);
    setCache(productsData);
    window.location.assign('product.html?id=' + encodeURIComponent(id));
}

// ─── SEARCH ─────────────────────────────────────────────
// Typing shows a suggestion dropdown only. Enter / Search button / suggestion click
// navigate to the dedicated results page (search.html?q=...).
function goToSearch(term) {
    term = String(term || '').trim();
    if (term) {
        window.location.href = 'search.html?q=' + encodeURIComponent(term);
    } else if (searchInput) {
        searchInput.focus();
        showToast('Type something to search');
    }
}

function updateSuggestions(query) {
    if (!suggestions) return;
    const q = String(query || '').trim();
    if (!q) { suggestions.classList.remove('active'); suggestionCount = 0; return; }
    const keywords = getKeywordSuggestions(q, 4).filter(kw => !productsData.some(p => String(p.title || '').toLowerCase() === kw));
    const matches = getSearchResults(productsData, q, 6);
    if (!keywords.length && !matches.length) {
        suggestions.innerHTML = `<div class="suggestion-items-empty">No products found for “${escapeHtml(q)}”</div>`;
        suggestions.classList.add('active');
        suggestionCount = 0;
        return;
    }
    const kwHtml = keywords.map(kw => `
        <a class="suggestion-item suggestion-keyword" href="search.html?q=${encodeURIComponent(kw)}" data-q="${encodeURIComponent(kw)}" role="option">
            <svg class="suggestion-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <div class="suggestion-meta">
                <span class="suggestion-title">${highlightMatch(kw, q)}</span>
                <span class="suggestion-cat">Popular</span>
            </div>
        </a>`).join('');
    const prodHtml = matches.map(p => {
        return `<a class="suggestion-item" href="search.html?q=${encodeURIComponent(p.title)}" data-id="${p.id}" role="option">
            <div class="suggestion-meta">
                <span class="suggestion-title">${highlightMatch(p.title, q)}</span>
                <span class="suggestion-cat">${escapeHtml(p.category)}</span>
            </div>
        </a>`;
    }).join('');
    suggestions.innerHTML = kwHtml + prodHtml;
    suggestions.classList.add('active');
    suggestionCount = keywords.length + matches.length;
}

function activateSuggestion(index) {
    if (!suggestions) return;
    suggestions.querySelectorAll('.suggestion-item.active').forEach(el => el.classList.remove('active'));
    const items = suggestions.querySelectorAll('.suggestion-item');
    if (index >= 0 && index < items.length) {
        items[index].classList.add('active');
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

function pickActiveSearch() {
    const active = suggestions && suggestions.querySelector('.suggestion-item.active');
    if (active) { active.click(); return true; }
    return false;
}

function closeSuggestions() {
    if (suggestions) suggestions.classList.remove('active');
    suggestionCount = 0;
    suggestionIndex = -1;
}

// ─── SIDEBAR / OVERLAY ──────────────────────────────────
function toggleSidebar() {
    if (!sidebar || !overlay) return;
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : 'auto';
}
function openCart() {
    if (!cartSidebar || !overlay) return;
    cartSidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeCartFn() {
    if (!cartSidebar || !overlay) return;
    cartSidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// ─── BIND EVENTS ────────────────────────────────────────
function bindEvents() {
    if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', () => {
        if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
        if (cartSidebar && cartSidebar.classList.contains('active')) closeCartFn();
        if (modalOverlay && modalOverlay.classList.contains('active')) closeModal();
    });

    if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCart);
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartFn);
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) { showToast('Cart is empty'); return; }
        window.location.href = 'checkout.html';
    });

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const v = e.target.value;
            if (v.trim()) updateSuggestions(v);
            else closeSuggestions();
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                if (suggestionCount > 0) {
                    e.preventDefault();
                    suggestionIndex = (suggestionIndex + 1) % suggestionCount;
                    activateSuggestion(suggestionIndex);
                }
            } else if (e.key === 'ArrowUp') {
                if (suggestionCount > 0) {
                    e.preventDefault();
                    suggestionIndex = (suggestionIndex - 1 + suggestionCount) % suggestionCount;
                    activateSuggestion(suggestionIndex);
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (!pickActiveSearch()) goToSearch(searchInput.value);
            } else if (e.key === 'Escape') {
                closeSuggestions();
            }
        });
        searchInput.addEventListener('blur', () => setTimeout(closeSuggestions, 150));
        searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) updateSuggestions(searchInput.value); });
    }
    if (searchSubmitBtn) searchSubmitBtn.addEventListener('click', () => goToSearch(searchInput ? searchInput.value : ''));
    if (searchClearBtn) searchClearBtn.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        closeSuggestions();
    });
    if (suggestions) suggestions.addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (!item) return;
        closeSuggestions();
        if (item.dataset.q) { goToSearch(decodeURIComponent(item.dataset.q)); return; }
        const product = getProduct(item.dataset.id);
        goToSearch(product ? product.title : (searchInput ? searchInput.value : ''));
    });

    if (filterBtn) filterBtn.addEventListener('click', () => {
        if (filterPanel) filterPanel.classList.toggle('active');
    });
    if (filterPanelClose) filterPanelClose.addEventListener('click', () => {
        if (filterPanel) filterPanel.classList.remove('active');
    });

    // Filter chips are rendered dynamically (setupDynamicCategories) with
    // their own handlers; the static fallback below only covers the case
    // where dynamic render did not run.
    if (!document.getElementById('filterChips')?.hasChildNodes()) {
    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            pickCategory(btn.dataset.category);
        });
    });
    }

    if (sortSelect) sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        displayedCount = 8;
        allLoaded = false;
        renderProducts(true);
        setTimeout(() => setupInfiniteScroll(), 200);
    });

    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        currentCategory = 'all';
        currentSort = 'featured';
        if (sortSelect) sortSelect.value = 'featured';
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.category === 'all'));
        displayedCount = 8;
        allLoaded = false;
        renderProducts(true);
        setTimeout(setupInfiniteScroll, 200);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalOverlay && modalOverlay.classList.contains('active')) closeModal();
            if (cartSidebar && cartSidebar.classList.contains('active')) closeCartFn();
            if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
        }
    });

    if (grid) {
        bindProductCards(grid, {
            onAdd: id => addToCart(parseInt(id)),
            onQuickView: id => openModal(parseInt(id)),
            onNavigate: id => navigateToProduct(parseInt(id)),
        });
    }
    // Homepage merchandising rails share the same card contract.
    document.querySelectorAll('[data-rail]').forEach(rail => {
        bindProductCards(rail, {
            onAdd: id => addToCart(parseInt(id)),
            onQuickView: id => openModal(parseInt(id)),
            onNavigate: id => navigateToProduct(parseInt(id)),
        });
    });

    if (cartItemsEl) {
        cartItemsEl.addEventListener('click', (e) => {
            const incBtn = e.target.closest('[data-action="cart-inc"]');
            const decBtn = e.target.closest('[data-action="cart-dec"]');
            const removeBtn = e.target.closest('[data-action="cart-remove"]');
            if (incBtn) {
                addToCart(parseInt(incBtn.dataset.id));
            } else if (decBtn) {
                removeFromCart(parseInt(decBtn.dataset.id));
            } else if (removeBtn) {
                const id = parseInt(removeBtn.dataset.id);
                const idx = cart.findIndex(item => String(item.id) === String(id));
                if (idx > -1) {
                    cart.splice(idx, 1);
                    saveCart();
                    updateCartUI();
                    syncCardButtons(id, false);
                    if (cartCountEl) cartCountEl.textContent = getCartCount();
                }
            }
        });
    }

    setTimeout(() => setupInfiniteScroll(), 300);
}

document.addEventListener('DOMContentLoaded', init);