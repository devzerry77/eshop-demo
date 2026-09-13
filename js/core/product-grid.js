// ─── PRODUCT CARD BUILDER ───────────────────────────────
import { formatPrice, renderStars, escapeHtml } from './utils.js';
import { getCartItem } from './storage.js';

export function buildProductCardHTML(p, idx, cart = [], wishlist = new Set()) {
    const inCart = getCartItem(cart, p.id);
    const isWish = wishlist.has(p.id);
    const badgeClass = p.badge === 'Sale' ? 'sale' : 'stock';
    const badgeHtml = p.badge ? `<span class="badge ${badgeClass}">${escapeHtml(p.badge)}</span>` : '';
    const btnText = p.inStock ? (inCart ? '✓ In Cart' : 'Add to Cart') : 'Sold Out';
    const btnDisabled = !p.inStock;
    const imageSrc = (p.images && p.images.length) ? p.images[0] : p.image;
    return `
        <div class="product-card" data-id="${p.id}" style="animation-delay:${(idx % 8) * 0.04}s">
            <button class="wishlist-heart ${isWish ? 'liked' : ''}" data-id="${p.id}" data-action="wishlist" aria-label="${isWish ? 'Remove from' : 'Add to'} wishlist">${isWish ? '♥' : '♡'}</button>
            <div class="product-image-container">
                <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(p.title)}" loading="lazy" />
                ${badgeHtml}
            </div>
            <div class="product-info">
                <div class="product-category">${escapeHtml(p.category)}</div>
                <div class="product-title">${escapeHtml(p.title)}</div>
                <div class="product-rating"><span class="stars">${renderStars(p.rating)}</span> (${p.reviews})</div>
                <div class="product-price">${formatPrice(p.price)} ${p.originalPrice ? `<span>${formatPrice(p.originalPrice)}</span>` : ''}</div>
            </div>
            <button class="add-cart-btn" data-id="${p.id}" data-action="add-cart" ${btnDisabled ? 'disabled' : ''} aria-label="${btnText}">${btnText}</button>
        </div>`;
}
