// ─── PRODUCT CARD BUILDER (Premium v1) ──────────────────
import { formatPrice, renderStars, escapeHtml } from './utils.js';
import { getCartItem } from './storage.js';
import { discountPct, stockState, isWishlisted } from './premium.js';

export function buildProductCardHTML(p, idx, cart = []) {
    const inCart = getCartItem(cart, p.id);
    const pct = discountPct(p);
    const st = stockState(p);
    const wished = isWishlisted(p.id);
    const badges = [];
    if (!p.inStock) badges.push('<span class="p-badge out">Sold out</span>');
    else {
        if (p.badge) badges.push(`<span class="p-badge ${p.badge === 'Sale' ? 'sale' : 'hot'}">${escapeHtml(p.badge)}</span>`);
        if (pct >= 10) badges.push(`<span class="p-badge sale">−${pct}%</span>`);
        if (p.isNew) badges.push('<span class="p-badge new">New</span>');
        if (st === 'low') badges.push(`<span class="p-badge low">Only ${p.stockQty} left</span>`);
    }
    const btnText = !p.inStock ? 'Sold Out' : (inCart ? '✓ In Cart' : 'Add to Cart');
    const imageSrc = (p.images && p.images.length) ? p.images[0] : p.image;
    const stockLine = !p.inStock
        ? '<div class="p-stock-line out">Out of stock</div>'
        : (st === 'low' ? `<div class="p-stock-line low">Low stock — only ${p.stockQty} left</div>` : '');
    return `
        <div class="product-card premium" data-id="${p.id}" style="animation-delay:${(idx % 8) * 0.04}s">
            <div class="p-card-media">
                <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(p.title)}" loading="lazy" decoding="async" />
                <div class="p-card-badges">${badges.join('')}</div>
                <button class="p-wishlist-btn ${wished ? 'active' : ''}" data-action="wishlist" data-id="${p.id}" aria-label="Toggle wishlist" aria-pressed="${wished}">♥</button>
            </div>
            <div class="p-card-body">
                <div class="p-card-cat">${escapeHtml(p.brand || p.category || '')}</div>
                <div class="p-card-title">${escapeHtml(p.title)}</div>
                <div class="p-card-rating"><span class="stars">${renderStars(p.rating)}</span><span>(${(p.reviews || 0).toLocaleString()})</span>${p.sku ? `<span>· ${escapeHtml(p.sku)}</span>` : ''}</div>
                <div class="p-card-price"><span class="p-price">${formatPrice(p.price)}</span>${p.originalPrice && pct > 0 ? `<span class="p-price-old">${formatPrice(p.originalPrice)}</span><span class="p-off">−${pct}%</span>` : ''}</div>
                ${stockLine}
                <div class="p-card-foot">
                    <button class="p-add-btn" data-id="${p.id}" data-action="add-cart" ${!p.inStock ? 'disabled' : ''} aria-label="${btnText} — ${escapeHtml(p.title)}">${btnText}</button>
                    <button class="p-view-btn" data-action="quick-view" data-id="${p.id}" aria-label="Quick view ${escapeHtml(p.title)}">View</button>
                </div>
            </div>
        </div>`;
}
