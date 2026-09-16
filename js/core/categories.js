// ─── CATEGORIES (E-Shop Demo) ────────────────────────────
// Database-driven categories with graceful fallbacks:
//   1. `categories` table (admin-managed: slug, label, order, active)
//   2. distinct product categories already in the catalog
//   3. built-in demo fallback list
// The admin controls categories without editing code: add a product with a
// new category, or manage the `categories` table from Admin → Settings.
import { createClient } from '../supabase/client.js';

export const FALLBACK_CATEGORIES = [
    { slug: 'audio', label: 'Audio' },
    { slug: 'electronics', label: 'Electronics' },
    { slug: 'gaming', label: 'Gaming' },
    { slug: 'wearables', label: 'Wearables' },
    { slug: 'accessories', label: 'Accessories' },
    { slug: 'camera', label: 'Camera' },
    { slug: 'lifestyle', label: 'Lifestyle' }
];

const CACHE_KEY = 'eshop_categories';

function slugify(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleize(slug) {
    return String(slug || '').split('-').filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Other';
}

export function categoriesFromProducts(products) {
    const seen = new Map();
    (products || []).forEach(p => {
        const slug = slugify(p.category);
        if (!slug || seen.has(slug)) return;
        seen.set(slug, { slug, label: titleize(slug) });
    });
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function getCachedCategories() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        const arr = raw ? JSON.parse(raw) : null;
        if (Array.isArray(arr) && arr.length) return arr;
    } catch (_) { /* noop */ }
    return null;
}

export async function fetchManagedCategories() {
    try {
        const supabase = createClient();
        if (!supabase) return null;
        const { data, error } = await supabase
            .from('categories')
            .select('slug,label,sort_order')
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .order('label', { ascending: true });
        if (error) return null; // table may not exist yet → fallback
        if (!data || !data.length) return null;
        return data
            .filter(r => r && slugify(r.slug))
            .map(r => ({ slug: slugify(r.slug), label: String(r.label || titleize(r.slug)) }));
    } catch (_) {
        return null;
    }
}

// Managed table wins; any product categories missing from it are appended
// so new product categories appear automatically.
export async function getCategories(products) {
    const managed = await fetchManagedCategories();
    const fromProducts = categoriesFromProducts(products);
    let list;
    if (managed && managed.length) {
        const slugs = new Set(managed.map(c => c.slug));
        list = managed.concat(fromProducts.filter(c => !slugs.has(c.slug)));
    } else if (fromProducts.length) {
        list = fromProducts;
    } else {
        list = getCachedCategories() || FALLBACK_CATEGORIES.slice();
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch (_) { /* noop */ }
    return list;
}

export function renderFilterChips(container, categories, active, onPick) {
    if (!container) return;
    const all = [{ slug: 'all', label: 'All' }].concat(categories);
    container.innerHTML = all.map(c =>
        '<button class="filter-chip' + (c.slug === active ? ' active' : '') +
        '" data-category="' + c.slug + '">' + c.label.replace(/</g, '&lt;') + '</button>'
    ).join('');
    container.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (onPick) onPick(btn.dataset.category);
        });
    });
}

export function renderSidebarLinks(container, categories) {
    if (!container) return;
    container.innerHTML =
        '<li><a href="collection.html?category=all">Collections</a></li>' +
        categories.map(c =>
            '<li><a href="collection.html?category=' + encodeURIComponent(c.slug) + '">' +
            c.label.replace(/</g, '&lt;') + '</a></li>'
        ).join('');
}
