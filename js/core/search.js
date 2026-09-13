// ─── SEARCH / RELEVANCE ─────────────────────────────────
import { escapeHtml } from './utils.js';

let indexedProducts = null;

function ensureIndex(products) {
    if (indexedProducts === products) return;
    for (const p of products) {
        p._searchTitle = String(p.title || '').toLowerCase();
        p._searchCategory = String(p.category || '').toLowerCase();
        p._searchBrand = String(p.brand || '').toLowerCase();
        p._searchShortDesc = String(p.shortDesc || p.description || '').toLowerCase();
        p._titleWords = p._searchTitle.split(/\W+/).filter(Boolean);
        p._textWords = new Set(
            [p._searchTitle, p._searchCategory, p._searchBrand, p._searchShortDesc,
             String(p.fullDesc || '').toLowerCase()].join(' ').split(/\W+/).filter(Boolean)
        );
    }
    indexedProducts = products;
}

export function buildSearchIndex(products) { ensureIndex(products); }

function matchRank(p, q, qWords) {
    const t = p._searchTitle;
    if (t.startsWith(q)) return 0;
    if (t.includes(q)) return 1;
    if (qWords.length && qWords.every(w => p._titleWords.some(tw => tw.startsWith(w)))) return 2;
    if (p._searchCategory.includes(q) || p._searchBrand.includes(q) || p._searchShortDesc.includes(q)) return 3;
    if (qWords.every(w => p._textWords.has(w))) return 4;
    return -1;
}

function matchScore(p, q, qWords) {
    let s = 0;
    if (p._searchTitle.startsWith(q)) s += 0;
    else if (p._searchTitle.includes(q)) s += 5;
    else s += 50;
    for (const w of qWords) {
        if (!p._textWords.has(w)) s += 1000;
        else if (p._searchTitle.startsWith(w)) s -= 2;
        else if (p._titleWords[0] === w) s -= 1;
        else s += 1;
    }
    return s;
}

/**
 * Returns products matching rawQ ranked by relevance (title-first).
 * When any title/brand/category match exists, description-only matches are dropped.
 * Returns [] when rawQ is empty/whitespace.
 */
export function getSearchResults(products, rawQ, limit = 0) {
    const q = String(rawQ || '').trim().toLowerCase();
    if (!q) return [];
    ensureIndex(products);
    const qWords = q.split(/\s+/).filter(Boolean);
    const out = [];
    let bestRank = 99;
    for (const p of products) {
        const r = matchRank(p, q, qWords);
        if (r < 0) continue;
        if (r < bestRank) bestRank = r;
        p._searchRank = r;
        p._searchScore = matchScore(p, q, qWords);
        out.push(p);
    }
    if (!out.length) return [];
    if (bestRank <= 3) {
        for (let i = out.length - 1; i >= 0; i--) { if (out[i]._searchRank >= 4) out.splice(i, 1); }
    }
    out.sort((a, b) => (a._searchRank - b._searchRank) || (a._searchScore - b._searchScore) || ((b.reviews || 0) - (a.reviews || 0)));
    return limit ? out.slice(0, limit) : out;
}

export function highlightMatch(text, q) {
    const safe = escapeHtml(text);
    if (!q) return safe;
    return safe.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
}
