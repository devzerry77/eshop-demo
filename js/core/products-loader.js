// ─── PRODUCTS LOADER ────────────────────────────────────
import { DEFAULT_PRODUCTS, STORAGE_KEYS, CACHE_KEY } from './config.js';
import { createClient } from '../supabase/client.js';

const SUPABASE_LOAD_TIMEOUT_MS = 8000;

function normalizeProductRow(row) {
    let images = [];
    if (row.images && Array.isArray(row.images) && row.images.length > 0) {
        if (typeof row.images[0] === 'string') images = row.images;
        else images = row.images.map(item => item.url || '');
    } else if (row.image) { images = [row.image]; }
    if (!images.length) images = ['https://picsum.photos/seed/default/400/400'];
    const details = row.details || {};
    return {
        id: row.id,
        title: row.title,
        category: row.category,
        brand: details.brand || '',
        price: parseFloat(row.price) || 0,
        originalPrice: row.original_price ? parseFloat(row.original_price) : null,
        rating: parseFloat(row.rating) || 0,
        reviews: parseInt(row.reviews) || 0,
        sold: details.sold || '',
        description: row.description || '',
        image: row.image || images[0],
        images: images,
        badge: row.badge || '',
        inStock: row.in_stock !== false,
        specs: row.specs || {},
        shortDesc: details.shortDesc || '',
        fullDesc: details.fullDesc || '',
        sections: details.sections || [],
        related: details.related || []
    };
}

export function getCachedProducts() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        return (cache && Array.isArray(cache.products)) ? cache.products : null;
    } catch { return null; }
}

export function getLocalProducts() {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.products);
        return s ? JSON.parse(s) : null;
    } catch { return null; }
}

export function defaultProducts() {
    return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
}

export async function fetchSupabaseProducts() {
    try {
        const supabase = createClient();
        if (!supabase) return null;
        const req = supabase.from('products').select('*').order('id', { ascending: true });
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase products request timed out')), SUPABASE_LOAD_TIMEOUT_MS));
        const { data, error } = await Promise.race([req, timeout]);
        if (error) throw error;
        if (data && data.length) return data.map(normalizeProductRow);
        return null;
    } catch (e) { console.warn('Supabase load failed, using fallback:', e.message); return null; }
}

export async function ensureProducts() {
    const supabaseList = await fetchSupabaseProducts();
    if (supabaseList && supabaseList.length) {
        try { localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(supabaseList)); } catch (_) { /* noop */ }
        return supabaseList;
    }
    const local = getLocalProducts();
    if (local && local.length) return local;
    const def = defaultProducts();
    try { localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(def)); } catch (_) { /* noop */ }
    return def;
}
