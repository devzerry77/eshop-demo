// ─── UTILS ───────────────────────────────────────────────
// Currency symbol is admin-editable (settings.currency_symbol) and cached
// in localStorage by js/core/store-settings.js. formatPrice stays
// synchronous so every cart/checkout render can use it.
export function getCurrencySymbolSync() {
    try {
        return localStorage.getItem('eshop_currency_symbol') || '৳';
    } catch (_) { return '৳'; }
}

export function formatPrice(amount) {
    const num = parseFloat(amount) || 0;
    return getCurrencySymbolSync() + ' ' + Math.round(num).toLocaleString('bn-BD');
}

export function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '⯪' : '') + '☆'.repeat(empty);
}

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ─── DESCRIPTION RENDERER (safe allowlist) ────────────
// Escapes everything, then restores a tiny set of SAFE formatting tags
// (no attributes allowed, so no onclick/javascript: vectors). Stored
// rich descriptions render correctly; anything else shows as plain text.
const SAFE_DESC_TAGS = /&lt;(\/?)(p|br|b|strong|i|em|u|ul|ol|li)(\s*\/?)&gt;/gi;
export function renderDescription(text) {
    if (!text) return '';
    const safe = escapeHtml(text).replace(SAFE_DESC_TAGS, '<$1$2$3>');
    if (/<(p|ul|ol)[\s>]/.test(safe)) return safe;
    return safe
        .split(/\n\s*\n/)
        .filter(p => p.trim() !== '')
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

// ─── YOUTUBE HELPERS ───────────────────────────────────
export function isYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\s]+)/,
        /youtube\.com\/watch\?.*v=([^&\s]+)/
    ];
    return patterns.some(p => p.test(url));
}

export function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\s]+)/);
    if (match) return match[1];
    const watchMatch = url.match(/youtube\.com\/watch\?.*v=([^&\s]+)/);
    return watchMatch ? watchMatch[1] : null;
}

export function getYouTubeEmbedUrl(url) {
    if (!url || typeof url !== 'string') return url;
    const id = extractYouTubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : url;
}

export function getYouTubeThumbnail(url) {
    const id = extractYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

// ─── URL VALIDATION ─────────────────────────────────────
export function isValidUrl(string) {
    try { new URL(string); return true; } catch { return false; }
}

// ─── MEDIA ──────────────────────────────────────────────
export function firstImage(p) {
    if (!p) return '';
    if (p.images && Array.isArray(p.images) && p.images.length) {
        const first = p.images[0];
        return typeof first === 'string' ? first : (first?.url || '');
    }
    return p.image || '';
}

// ─── STOCK (single source of truth: DB `products.stock_quantity`) ───
// Rows written before the stock-quantity migration carry no value, which
// parses to null (unknown) and must NEVER be treated as 0 — that fallback
// was the root cause of newly added products showing "Available: 0".
export function parseStockQty(row) {
    if (!row) return null;
    const v = row.stock_quantity;
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export function resolveStock(row) {
    const stockQty = parseStockQty(row);
    const inStock = (row ? row.in_stock : undefined) !== false && (stockQty === null || stockQty > 0);
    return { stockQty, inStock };
}

// How many more units of `product` can be added (null stockQty = uncapped).
export function canFulfill(product, wantedQty) {
    if (!product || !product.inStock) return false;
    if (product.stockQty === null || product.stockQty === undefined) return true;
    return Number(wantedQty) <= product.stockQty;
}

// ─── MISC ───────────────────────────────────────────────
export function debounce(callback, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(...args), delay);
    };
}