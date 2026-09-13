// ─── STORAGE ─────────────────────────────────────────────
import { STORAGE_KEYS } from './config.js';

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ─── CART ───────────────────────────────────────────────
export function getCart() {
    return readJSON(STORAGE_KEYS.cart, []);
}

export function saveCart(cart) {
    writeJSON(STORAGE_KEYS.cart, cart);
}

export function getCartCount(cart) {
    return Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
}

export function getCartItem(cart, id) {
    return cart.find(item => String(item.id) === String(id));
}

export function computeCartTotal(cart, products, getPrice) {
    return (cart || []).reduce((sum, item) => {
        const p = products.find(prod => String(prod.id) === String(item.id));
        const price = getPrice ? getPrice(p) : (p ? Number(p.price) || 0 : 0);
        return sum + price * (item.quantity || 0);
    }, 0);
}

export function addCartItem(cart, id) {
    const existing = cart.find(item => String(item.id) === String(id));
    if (existing) existing.quantity += 1;
    else cart.push({ id, quantity: 1 });
    return cart;
}

export function removeCartItem(cart, id) {
    const idx = cart.findIndex(item => String(item.id) === String(id));
    if (idx === -1) return cart;
    if (cart[idx].quantity > 1) cart[idx].quantity -= 1;
    else cart.splice(idx, 1);
    return cart;
}

export function clearCart() {
    localStorage.setItem(STORAGE_KEYS.cart, '[]');
}

// ─── WISHLIST ───────────────────────────────────────────
export function loadWishlist() {
    const stored = readJSON(STORAGE_KEYS.wishlist, []);
    return new Set(stored);
}

export function saveWishlist(wishlist) {
    writeJSON(STORAGE_KEYS.wishlist, [...wishlist]);
}

// ─── COUPON (session) ───────────────────────────────────
export function getCoupon() {
    try {
        return sessionStorage.getItem(STORAGE_KEYS.coupon);
    } catch {
        return null;
    }
}

export function setCoupon(code) {
    try {
        sessionStorage.setItem(STORAGE_KEYS.coupon, code);
    } catch { /* noop */ }
}

export function clearCoupon() {
    try {
        sessionStorage.removeItem(STORAGE_KEYS.coupon);
    } catch { /* noop */ }
}