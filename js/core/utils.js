// ─── UTILS ───────────────────────────────────────────────
export function formatPrice(amount) {
    const num = parseFloat(amount) || 0;
    return '৳ ' + Math.round(num).toLocaleString('bn-BD');
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

// ─── DESCRIPTION RENDERER ───────────────────────────────
export function renderDescription(text) {
    if (!text) return '';
    const htmlTagRegex = /<[^>]*>/;
    if (htmlTagRegex.test(text)) {
        return text;
    }
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs.map(p => {
        if (p.trim() === '') return '';
        const lines = p.split(/\n/);
        if (lines.length === 1) return `<p>${escapeHtml(lines[0])}</p>`;
        const inner = lines.map(line => escapeHtml(line)).join('<br>');
        return `<p>${inner}</p>`;
    }).join('');
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

// ─── MISC ───────────────────────────────────────────────
export function debounce(callback, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(...args), delay);
    };
}