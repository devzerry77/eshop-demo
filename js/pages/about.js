// ─── ABOUT PAGE ───────────────────────────────────────
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { formatPrice, escapeHtml } from '../core/utils.js';
import { getCart, getCartCount } from '../core/storage.js';
import { ensureProducts } from '../core/products-loader.js';

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
