// ─── ABOUT PAGE (content 100% admin-editable) ────────────
// Static HTML in about.html is the fallback. When
// `settings.about_content` exists it replaces eyebrow, notice, info
// sections and value cards (Admin → Settings → About Page).
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { formatPrice, escapeHtml } from '../core/utils.js';
import { getCart, getCartCount } from '../core/storage.js';
import { ensureProducts } from '../core/products-loader.js';
import { createClient } from '../supabase/client.js';

async function loadAboutContent() {
    // 1. Instant paint from cache.
    try {
        const raw = localStorage.getItem('eshop_about_content') || '';
        if (raw) applyAboutContent(JSON.parse(raw));
    } catch (_) { /* keep static fallback */ }
    // 2. Refresh from Supabase.
    try {
        const supabase = createClient();
        if (!supabase) return;
        const { data, error } = await supabase.from('settings')
            .select('value').eq('key', 'about_content').maybeSingle();
        if (error || !data || !data.value) return;
        try { localStorage.setItem('eshop_about_content', data.value); } catch (_) { /* noop */ }
        applyAboutContent(JSON.parse(data.value));
    } catch (_) { /* keep fallback */ }
}

function applyAboutContent(content) {
    if (!content || typeof content !== 'object') return;
    if (content.eyebrow) {
        const el = document.getElementById('aboutEyebrow');
        if (el) el.textContent = String(content.eyebrow);
    }
    if (content.notice) {
        const el = document.getElementById('aboutNotice');
        if (el) el.textContent = String(content.notice);
    }
    if (Array.isArray(content.sections) && content.sections.length) {
        const wrap = document.getElementById('aboutSections');
        if (wrap) {
            wrap.innerHTML = content.sections.map(s =>
                `<section class="about-section"><h2>${escapeHtml(s.title || '')}</h2>` +
                `<p>${escapeHtml(s.body || '')}</p></section>`
            ).join('');
        }
    }
    if (Array.isArray(content.values) && content.values.length) {
        const grid = document.getElementById('aboutValues');
        if (grid) {
            grid.innerHTML = content.values.map(v =>
                `<div class="about-value"><div class="icon">${escapeHtml(v.icon || '✨')}</div>` +
                `<h3>${escapeHtml(v.title || '')}</h3><p>${escapeHtml(v.body || '')}</p></div>`
            ).join('');
        }
    }
}

loadAboutContent();
window.addEventListener('storage', (e) => {
    if (e.key === 'eshop_about_content' && e.newValue) {
        try { applyAboutContent(JSON.parse(e.newValue)); } catch (_) { /* noop */ }
    }
});

loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'eshop_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

// ─── CART SIDEBAR (same shared component as other public pages) ──
let productsData = [];
let productsLoaded = false;

async function loadProductsOnce() {
    if (productsLoaded) return;
    productsLoaded = true;
    try { productsData = (await ensureProducts()) || []; }
    catch { productsData = []; }
}

function updateCartUI() {
    const cart = getCart();
    const countEl = document.getElementById('pageCartCount');
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotalAmount');
    if (countEl) countEl.textContent = getCartCount(cart);
    if (!itemsEl || !totalEl) return;
    if (!cart.length) {
        itemsEl.innerHTML = '<div class="empty-cart-msg">Your cart is empty.</div>';
        totalEl.textContent = formatPrice(0);
        return;
    }
    let total = 0;
    itemsEl.innerHTML = cart.map(item => {
        const p = productsData.find(prod => String(prod.id) === String(item.id));
        const title = p ? p.title : ('Product #' + item.id);
        const price = p ? Number(p.price) || 0 : 0;
        total += price * (item.quantity || 1);
        return `<div class="cart-item" data-id="${item.id}">
            <div class="item-info"><div class="item-title">${escapeHtml(title)}</div>`
            + `<div class="item-price">${formatPrice(price)} × ${item.quantity || 1}</div></div>
        </div>`;
    }).join('');
    totalEl.textContent = formatPrice(total);
}

async function openCart() {
    await loadProductsOnce();
    updateCartUI();
    document.getElementById('cartSidebar')?.classList.add('active');
    document.getElementById('overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCartFn() {
    document.getElementById('cartSidebar')?.classList.remove('active');
    document.getElementById('overlay')?.classList.remove('active');
    document.body.style.overflow = 'auto';
}

updateCartUI();
document.getElementById('pageCartBtn')?.addEventListener('click', openCart);
document.getElementById('cartCloseBtn')?.addEventListener('click', closeCartFn);
document.getElementById('overlay')?.addEventListener('click', closeCartFn);
document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    if (!getCart().length) return;
    window.location.href = 'checkout.html';
});
