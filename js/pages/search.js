// ─── SEARCH RESULTS PAGE (Daraz/AliExpress style) ───────
import { formatPrice, escapeHtml } from '../core/utils.js';
import { loadTheme, toggleTheme } from '../core/theme.js';
import { getCart, saveCart, getCartCount, addCartItem, removeCartItem, loadWishlist, saveWishlist, getCartItem, computeCartTotal } from '../core/storage.js';
import { buildProductCardHTML } from '../core/product-grid.js';
import { getSearchResults, highlightMatch, getKeywordSuggestions } from '../core/search.js';
import { getCachedProducts, ensureProducts } from '../core/products-loader.js';
import { STORAGE_KEYS } from '../core/config.js';

// ─── STATE ──────────────────────────────────────────────
let productsData = [];
let cart = getCart();
let wishlist = loadWishlist();
let q = '';
let currentCategory = 'all';
let currentSort = 'featured';
let filteredProducts = [];
let displayedCount = 8;
let allLoaded = false;
let isLoadingMore = false;
let scrollObserver = null;
let suggestionCount = 0;
let suggestionIndex = -1;

// ─── DOM REFS ──────────────────────────────────────────
let grid, countEl, noMsg, loader, loadEndMsg, heading, searchInput, suggestions, searchSubmitBtn, searchClearBtn;
let filterBtn, filterPanel, filterPanelClose, sortSelect;
let cartCountEl, cartTotalEl, cartItemsEl, cartSidebar, cartToggleBtn, cartCloseBtn, overlay, checkoutBtn, toastContainer;
let sidebar, menuBtn, closeBtn, themeToggle;

function getRefs() {
    grid = document.getElementById('productGrid');
    countEl = document.getElementById('productCount');
    noMsg = document.getElementById('noProductsMsg');
    loader = document.getElementById('loader');
    loadEndMsg = document.getElementById('loadEndMsg');
    heading = document.getElementById('searchHeading');
    searchInput = document.getElementById('searchInput');
    suggestions = document.getElementById('searchSuggestions');
    searchSubmitBtn = document.getElementById('searchSubmitBtn');
    searchClearBtn = document.getElementById('searchClearBtn');
    filterBtn = document.getElementById('filterBtn');
    filterPanel = document.getElementById('filterPanel');
    filterPanelClose = document.getElementById('filterPanelClose');
    sortSelect = document.getElementById('sortSelect');
    cartCountEl = document.getElementById('cartCount');
    cartTotalEl = document.getElementById('cartTotalAmount');
    cartItemsEl = document.getElementById('cartItems');
    cartSidebar = document.getElementById('cartSidebar');
    cartToggleBtn = document.getElementById('cartToggleBtn');
    cartCloseBtn = document.getElementById('cartCloseBtn');
    overlay = document.getElementById('overlay');
    checkoutBtn = document.getElementById('checkoutBtn');
    toastContainer = document.getElementById('toastContainer');
    sidebar = document.getElementById('sidebar');
    menuBtn = document.getElementById('menuBtn');
    closeBtn = document.getElementById('closeBtn');
    themeToggle = document.getElementById('themeToggle');
}

function getProduct(id) { return productsData.find(p => String(p.id) === String(id)); }

// ─── TOAST ──────────────────────────────────────────────
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

// ─── NAVIGATE ───────────────────────────────────────────
function goToSearch(term) {
    term = String(term || '').trim();
    if (term) {
        window.location.href = 'search.html?q=' + encodeURIComponent(term);
    } else if (searchInput) {
        searchInput.focus();
        showToast('Type something to search');
    }
}

// ─── SUGGESTIONS ────────────────────────────────────────
function updateSuggestions(query) {
    if (!suggestions) return;
    const input = String(query || '').trim();
    if (!input) { suggestions.classList.remove('active'); suggestionCount = 0; return; }
    const keywords = getKeywordSuggestions(input, 4).filter(kw => !productsData.some(p => String(p.title || '').toLowerCase() === kw));
    const matches = getSearchResults(productsData, input, 6);
    if (!keywords.length && !matches.length) {
        suggestions.innerHTML = `<div class="suggestion-items-empty">No products found for “${escapeHtml(input)}”</div>`;
        suggestions.classList.add('active');
        suggestionCount = 0;
        return;
    }
    const kwHtml = keywords.map(kw => `
        <a class="suggestion-item suggestion-keyword" href="search.html?q=${encodeURIComponent(kw)}" data-q="${encodeURIComponent(kw)}" role="option">
            <svg class="suggestion-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <div class="suggestion-meta"><span class="suggestion-title">${highlightMatch(kw, input)}</span><span class="suggestion-cat">Popular</span></div>
        </a>`).join('');
    const prodHtml = matches.map(p => {
        return `<a class="suggestion-item" href="search.html?q=${encodeURIComponent(p.title)}" data-id="${p.id}" role="option">
            <div class="suggestion-meta"><span class="suggestion-title">${highlightMatch(p.title, input)}</span><span class="suggestion-cat">${escapeHtml(p.category)}</span></div>
        </a>`;
    }).join('');
    suggestions.innerHTML = kwHtml + prodHtml;
    suggestions.classList.add('active');
    suggestionCount = keywords.length + matches.length;
}

function activateSuggestion(index) {
    if (!suggestions) return;
    const items = suggestions.querySelectorAll('.suggestion-item');
    items.forEach(el => el.classList.remove('active'));
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

// ─── RENDER ─────────────────────────────────────────────
function sortProducts(list) {
    if (q && currentSort === 'featured') return list;
    const sorted = list.slice();
    switch (currentSort) {
        case 'popularity': sorted.sort((a, b) => (b.reviews || 0) - (a.reviews || 0)); break;
        case 'newest': sorted.sort((a, b) => (b.id || 0) - (a.id || 0)); break;
        case 'rating': sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0)); break;
        case 'price-asc': sorted.sort((a, b) => a.price - b.price); break;
        case 'price-desc': sorted.sort((a, b) => b.price - a.price); break;
        case 'name': sorted.sort((a, b) => String(a.title).localeCompare(String(b.title))); break;
        default: break;
    }
    return sorted;
}

function applyFilter() {
    let pool = productsData;
    if (currentCategory !== 'all') pool = pool.filter(p => p.category === currentCategory);
    let list = q ? getSearchResults(pool, q) : pool.slice();
    return sortProducts(list);
}

function render(resetScroll = true) {
    if (!grid) return;
    const skeletonEl = document.getElementById('productSkeleton');
    if (skeletonEl) skeletonEl.style.display = 'none';
    filteredProducts = applyFilter();
    const total = filteredProducts.length;
    const show = Math.min(displayedCount, total);
    const toRender = filteredProducts.slice(0, show);

    if (total === 0) {
        grid.innerHTML = '';
        if (noMsg) {
            noMsg.style.display = 'block';
            noMsg.textContent = q ? `No products found for “${q}”. Try something else.` : 'No products found.';
        }
        if (countEl) countEl.textContent = '0 products';
        if (loader) loader.style.display = 'none';
        if (loadEndMsg) loadEndMsg.style.display = 'none';
        allLoaded = true;
        return;
    }
    if (noMsg) noMsg.style.display = 'none';
    if (countEl) countEl.textContent = total + (q ? ` results for “${q}”` : ' products');

    grid.innerHTML = toRender.map((p, idx) => buildProductCardHTML(p, idx, cart, wishlist)).join('');

    if (show < total) { if (loader) loader.style.display = 'none'; if (loadEndMsg) loadEndMsg.style.display = 'none'; allLoaded = false; }
    else { if (loader) loader.style.display = 'none'; if (loadEndMsg) loadEndMsg.style.display = 'block'; allLoaded = true; }

    if (resetScroll && grid.parentElement) grid.parentElement.scrollTop = 0;
}

function appendMore() {
    if (!grid) return;
    const start = displayedCount;
    const end = Math.min(start + 8, filteredProducts.length);
    if (start >= filteredProducts.length) return;
    const html = filteredProducts.slice(start, end).map((p, idx) => buildProductCardHTML(p, start + idx, cart, wishlist)).join('');
    grid.insertAdjacentHTML('beforeend', html);
    displayedCount = end;
    allLoaded = displayedCount >= filteredProducts.length;
    if (loader) loader.style.display = 'none';
    if (loadEndMsg) loadEndMsg.style.display = allLoaded ? 'block' : 'none';
}

function setupInfiniteScroll() {
    if (scrollObserver) scrollObserver.disconnect();
    const target = document.querySelector('.load-more-wrap');
    if (!target) return;
    scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !allLoaded && displayedCount < filteredProducts.length) {
            isLoadingMore = true;
            if (loader) loader.style.display = 'flex';
            setTimeout(() => { appendMore(); isLoadingMore = false; if (loader) loader.style.display = 'none'; }, 350);
        }
    }, { root: null, rootMargin: '0px 0px 200px 0px', threshold: 0.1 });
    scrollObserver.observe(target);
}

// ─── CART / WISHLIST ────────────────────────────────────
function refreshProductCards() {
    if (!grid) return;
    grid.querySelectorAll('.add-cart-btn').forEach(btn => {
        if (btn.disabled) return;
        const p = getProduct(btn.dataset.id);
        if (p) btn.textContent = getCartItem(cart, p.id) ? '✓ In Cart' : 'Add to Cart';
    });
    grid.querySelectorAll('.wishlist-heart').forEach(btn => {
        const liked = wishlist.has(Number(btn.dataset.id));
        btn.classList.toggle('liked', liked);
        btn.textContent = liked ? '♥' : '♡';
    });
}

function updateCartUI() {
    if (cartCountEl) cartCountEl.textContent = getCartCount(cart);
    if (cartTotalEl) cartTotalEl.textContent = formatPrice(computeCartTotal(cart, productsData));
    if (!cartItemsEl) return;
    if (!cart.length) { cartItemsEl.innerHTML = '<div class="empty-cart-msg">Your cart is empty.</div>'; return; }
    cartItemsEl.innerHTML = cart.map(item => {
        const p = getProduct(item.id);
        if (!p) return '';
        const imageSrc = (p.images && p.images.length) ? p.images[0] : p.image;
        return `
            <div class="cart-item" data-id="${item.id}">
                <div class="item-image"><img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(p.title)}" /></div>
                <div class="item-info"><div class="item-title">${escapeHtml(p.title)}</div><div class="item-price">${formatPrice(p.price)}</div></div>
                <div class="item-qty">
                    <button data-action="cart-dec" data-id="${item.id}">−</button><span>${item.quantity}</span><button data-action="cart-inc" data-id="${item.id}">+</button>
                </div>
                <button class="item-remove" data-action="cart-remove" data-id="${item.id}">✕</button>
            </div>`;
    }).join('');
}

function addToCart(id) {
    const p = getProduct(id);
    if (!p || !p.inStock) return;
    addCartItem(cart, id);
    saveCart(cart);
    updateCartUI();
    refreshProductCards();
    showToast(p.title + ' added to cart');
}

function removeFromCart(id) {
    removeCartItem(cart, id);
    saveCart(cart);
    updateCartUI();
    refreshProductCards();
}

function toggleWishlist(id) {
    const p = getProduct(id);
    if (!p) return;
    const was = wishlist.has(id);
    if (was) wishlist.delete(id); else wishlist.add(id);
    saveWishlist(wishlist);
    updateWishlistUI();
    refreshProductCards();
    showToast(was ? 'Removed from wishlist' : 'Added to wishlist');
}
function updateWishlistUI() { /* heart state handled in refreshProductCards */ }

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
function toggleSidebar(open) {
    if (!sidebar || !overlay) return;
    sidebar.classList.toggle('active', open);
    overlay.classList.toggle('active', open);
    document.body.style.overflow = open ? 'hidden' : 'auto';
}

// ─── EVENTS ─────────────────────────────────────────────
function bindEvents() {
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const v = e.target.value;
            if (v.trim()) updateSuggestions(v);
            else closeSuggestions();
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                if (suggestionCount > 0) { e.preventDefault(); suggestionIndex = (suggestionIndex + 1) % suggestionCount; activateSuggestion(suggestionIndex); }
            } else if (e.key === 'ArrowUp') {
                if (suggestionCount > 0) { e.preventDefault(); suggestionIndex = (suggestionIndex - 1 + suggestionCount) % suggestionCount; activateSuggestion(suggestionIndex); }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (!pickActiveSearch()) goToSearch(searchInput.value);
            } else if (e.key === 'Escape') { closeSuggestions(); }
        });
        searchInput.addEventListener('blur', () => setTimeout(closeSuggestions, 150));
        searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) updateSuggestions(searchInput.value); });
    }
    if (suggestions) suggestions.addEventListener('click', (e) => {
        const el = e.target.closest('.suggestion-item');
        if (!el) return;
        closeSuggestions();
        if (el.dataset.q) { goToSearch(decodeURIComponent(el.dataset.q)); return; }
        const product = getProduct(el.dataset.id);
        goToSearch(product ? product.title : (searchInput ? searchInput.value : ''));
    });
    if (searchSubmitBtn) searchSubmitBtn.addEventListener('click', () => goToSearch(searchInput ? searchInput.value : ''));
    if (searchClearBtn) searchClearBtn.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        closeSuggestions();
    });
    if (filterBtn && filterPanel) filterBtn.addEventListener('click', () => filterPanel.classList.toggle('active'));
    if (filterPanelClose && filterPanel) filterPanelClose.addEventListener('click', () => filterPanel.classList.remove('active'));

    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            displayedCount = 8;
            allLoaded = false;
            render(true);
            if (filterPanel) filterPanel.classList.remove('active');
            setTimeout(() => setupInfiniteScroll(), 200);
        });
    });

    if (sortSelect) sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        displayedCount = 8;
        allLoaded = false;
        render(true);
        setTimeout(() => setupInfiniteScroll(), 200);
    });

    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        currentCategory = 'all';
        currentSort = 'featured';
        if (sortSelect) sortSelect.value = 'featured';
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.category === 'all'));
        displayedCount = 8;
        allLoaded = false;
        render(true);
        setTimeout(() => setupInfiniteScroll(), 200);
    });

    if (menuBtn) menuBtn.addEventListener('click', () => toggleSidebar(true));
    if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar(false));
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    if (cartToggleBtn) cartToggleBtn.addEventListener('click', openCart);
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartFn);
    if (overlay) overlay.addEventListener('click', () => {
        closeCartFn();
        toggleSidebar(false);
        closeSuggestions();
    });
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
        if (!cart.length) { showToast('Cart is empty'); return; }
        window.location.href = 'checkout.html';
    });

    if (cartItemsEl) cartItemsEl.addEventListener('click', (e) => {
        const inc = e.target.closest('[data-action="cart-inc"]');
        const dec = e.target.closest('[data-action="cart-dec"]');
        const rem = e.target.closest('[data-action="cart-remove"]');
        if (inc) addToCart(Number(inc.dataset.id));
        else if (dec) removeFromCart(Number(dec.dataset.id));
        else if (rem) removeFromCart(Number(rem.dataset.id));
    });

    if (grid) grid.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        const wishBtn = e.target.closest('[data-action="wishlist"]');
        const cartBtn = e.target.closest('[data-action="add-cart"]');
        if (wishBtn) { e.stopPropagation(); e.preventDefault(); toggleWishlist(Number(wishBtn.dataset.id)); return; }
        if (cartBtn) { e.stopPropagation(); e.preventDefault(); addToCart(Number(cartBtn.dataset.id)); return; }
        if (card) { e.preventDefault(); window.location.href = 'product.html?id=' + card.dataset.id; }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCartFn();
            toggleSidebar(false);
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.cart) { cart = getCart(); updateCartUI(); refreshProductCards(); }
        if (e.key === STORAGE_KEYS.wishlist) { wishlist = loadWishlist(); refreshProductCards(); }
        if (e.key === STORAGE_KEYS.products) { ensureProducts().then(list => { productsData = list; render(true); }); }
    });

    setTimeout(() => setupInfiniteScroll(), 300);
}

// ─── INIT ───────────────────────────────────────────────
async function init() {
    getRefs();
    const params = new URLSearchParams(window.location.search);
    q = (params.get('q') || '').trim();
    if (searchInput) searchInput.value = q;
    if (heading) heading.textContent = q ? `Results for “${q}”` : 'All products';
    if (sortSelect) sortSelect.value = currentSort;
    loadTheme();

    const cached = getCachedProducts();
    if (cached) {
        productsData = cached;
        render(true);
        updateCartUI();
    }

    productsData = await ensureProducts();
    render(true);
    updateCartUI();
    bindEvents();
}

document.addEventListener('DOMContentLoaded', init);