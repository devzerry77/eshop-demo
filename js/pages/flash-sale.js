// ─── FLASH SALE / HOT DEALS (Swiper) ──────────────────────
// A compact auto-swiping carousel of discounted "hot" products
// at the top of the homepage. Slides move right → left and loop.
// Customized via Admin → Settings → "Flash Sale / Hot Deals".
import { formatPrice, escapeHtml } from '../core/utils.js';
import { createClient } from '../supabase/client.js';

const FLASH_KEYS = [
    'flash_enabled', 'flash_title', 'flash_subtitle', 'flash_badge',
    'flash_product_ids', 'flash_autoplay_ms', 'flash_per_view',
    'flash_accent', 'flash_duration_minutes'
];

const DEFAULT_FLASH = {
    enabled: true,
    title: 'Flash Sale',
    subtitle: 'Deals of the day — grab them before they are gone',
    badge: 'Hot',
    productIds: '',
    autoplayMs: 2600,
    perView: 5,
    accent: '#ff5000',
    durationMin: 120
};

let section = null;
let swiperInstance = null;
let productsCache = [];
let countdownTimer = null;

function readLocalSettings() {
    const s = {};
    FLASH_KEYS.forEach(k => {
        const v = localStorage.getItem('eshop_' + k) ?? localStorage.getItem('grabby_' + k);
        if (v !== null) s[k] = v;
    });
    return s;
}

function persistLocalSettings(settings) {
    FLASH_KEYS.forEach(k => {
        if (settings[k] !== undefined && settings[k] !== null) {
            try { localStorage.setItem('eshop_' + k, String(settings[k])); } catch (e) { /* noop */ }
        }
    });
}

function resolveSettings(local) {
    const s = Object.assign({}, DEFAULT_FLASH, {
        enabled: local.flash_enabled !== undefined ? local.flash_enabled !== 'false' : DEFAULT_FLASH.enabled,
        title: local.flash_title || DEFAULT_FLASH.title,
        subtitle: local.flash_subtitle || DEFAULT_FLASH.subtitle,
        badge: local.flash_badge || DEFAULT_FLASH.badge,
        productIds: local.flash_product_ids || '',
        autoplayMs: parseInt(local.flash_autoplay_ms) || DEFAULT_FLASH.autoplayMs,
        perView: parseInt(local.flash_per_view) || DEFAULT_FLASH.perView,
        accent: local.flash_accent || DEFAULT_FLASH.accent,
        durationMin: parseInt(local.flash_duration_minutes) || DEFAULT_FLASH.durationMin
    });
    return s;
}

async function fetchSupabaseSettings() {
    try {
        const supabase = createClient();
        if (!supabase) return null;
        const { data, error } = await supabase.from('settings').select('*').in('key', FLASH_KEYS);
        if (error || !data) return null;
        const map = {};
        data.forEach(row => { map[row.key] = row.value; });
        return map;
    } catch (e) {
        console.warn('Failed to load flash-sale settings from Supabase:', e);
        return null;
    }
}

function selectProducts(products, settings) {
    const ids = settings.productIds
        .split(',')
        .map(s => String(s).trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
    if (ids.length) {
        const byId = {};
        products.forEach(p => { byId[String(p.id)] = p; });
        const chosen = [];
        ids.forEach(id => { if (byId[id]) chosen.push(byId[id]); });
        if (chosen.length) return chosen;
    }
    // Default: auto-pick discounted products (original_price > price)
    return products.filter(p =>
        p.inStock !== false &&
        p.originalPrice != null &&
        parseFloat(p.originalPrice) > parseFloat(p.price)
    );
}

function discountPercent(p) {
    if (!p.originalPrice || !(p.originalPrice > p.price)) return 0;
    return Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
}

function cardHTML(p, badge) {
    const img = (p.images && p.images.length) ? p.images[0] : p.image;
    const off = discountPercent(p);
    const ribbon = off > 0
        ? `<span class="flash-ribbon flash-ribbon--sale">-${off}%</span>`
        : `<span class="flash-ribbon">${escapeHtml(badge)}</span>`;
    return `
        <div class="swiper-slide flash-slide">
            <div class="flash-card" data-id="${escapeHtml(p.id)}" role="link" tabindex="0" aria-label="${escapeHtml(p.title)}">
                ${ribbon}
                <div class="flash-img"><img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" loading="lazy" /></div>
                <div class="flash-body">
                    <div class="flash-title">${escapeHtml(p.title)}</div>
                    <div class="flash-price">
                        <b>${formatPrice(p.price)}</b>
                        ${p.originalPrice ? `<s>${formatPrice(p.originalPrice)}</s>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
}

function openProduct(id) {
    window.open('product.html?id=' + encodeURIComponent(id), '_blank', 'noopener');
}

// ─── COUNTDOWN ────────────────────────────────────────────
function getCountdownEnd(durationMin) {
    const key = 'eshop_flash_ends_at';
    const now = Date.now();
    try {
        const stored = parseInt(localStorage.getItem(key), 10);
        if (stored && stored > now) return stored;
    } catch (e) { /* noop */ }
    const end = now + (parseInt(durationMin) || DEFAULT_FLASH.durationMin) * 60 * 1000;
    try { localStorage.setItem(key, String(end)); } catch (e) { /* noop */ }
    return end;
}

function pad(n) { return String(n).padStart(2, '0'); }

function startCountdown(el, endAt) {
    const SEP = '<span>:</span>';
    const fmt = (ms) => {
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (total <= 0) {
            return `<span class="fs-count-label">Ends soon</span>`;
        }
        return `<span class="fs-count-label">Ends in</span> <b>${pad(h)}</b>${SEP}<b>${pad(m)}</b>${SEP}<b>${pad(s)}</b>`;
    };
    const tick = () => { el.innerHTML = fmt(endAt - Date.now()); };
    if (countdownTimer) clearInterval(countdownTimer);
    tick();
    countdownTimer = setInterval(tick, 1000);
}

// ─── RENDER / SWIPER ──────────────────────────────────────
function initSwiper(slidesCount, perView, autoplayMs) {
    const el = document.getElementById('flashSwiper');
    if (!el || typeof Swiper === 'undefined') return null;
    if (swiperInstance) {
        swiperInstance.destroy(true, true);
        swiperInstance = null;
    }
    const desktopPerView = Math.max(2, Math.min(parseInt(perView) || DEFAULT_FLASH.perView, slidesCount));
    swiperInstance = new Swiper(el, {
        loop: slidesCount > 1,
        speed: 600,
        watchOverflow: true,
        spaceBetween: 10,
        autoplay: {
            delay: parseInt(autoplayMs) || DEFAULT_FLASH.autoplayMs,
            disableOnInteraction: false,
            pauseOnMouseEnter: true
        },
        pagination: {
            el: el.querySelector('.flash-swiper-pagination'),
            clickable: true
        },
        breakpoints: {
            0: { slidesPerView: 2 },
            600: { slidesPerView: 3 },
            900: { slidesPerView: Math.min(4, slidesCount) },
            1200: { slidesPerView: desktopPerView }
        }
    });
    return swiperInstance;
}

export async function initFlashSale(products) {
    if (!products || !products.length) return;
    section = document.getElementById('flashSaleSection');
    if (!section) return;

    productsCache = products;

    // 1. Instant paint from localStorage cache, then refresh from Supabase.
    const local = readLocalSettings();
    const settings = resolveSettings(local);
    render(section, settings);
    renderSwiper(settings);

    const remote = await fetchSupabaseSettings();
    if (remote) {
        persistLocalSettings(remote);
        const fresh = resolveSettings(Object.assign({}, local, remote));
        if (fresh.enabled !== settings.enabled ||
            fresh.title !== settings.title ||
            fresh.subtitle !== settings.subtitle ||
            fresh.productIds !== settings.productIds ||
            fresh.accent !== settings.accent) {
            render(section, fresh);
            renderSwiper(fresh);
        }
    }
}

function render(container, settings) {
    if (settings.enabled === false) {
        container.classList.remove('active');
        return;
    }
    const titleEl = document.getElementById('flashSaleTitle');
    const subEl = document.getElementById('flashSaleSubtitle');
    const cdEl = document.getElementById('flashSaleCountdown');
    if (titleEl) titleEl.textContent = settings.title;
    if (subEl) subEl.textContent = settings.subtitle;
    if (settings.accent) container.style.setProperty('--flash-accent', settings.accent);
    if (cdEl) startCountdown(cdEl, getCountdownEnd(settings.durationMin));
    container.classList.add('active');
}

function renderSwiper(settings) {
    const wrapper = document.getElementById('flashSwiperWrapper');
    if (!wrapper) return;
    const selected = selectProducts(productsCache, settings);
    const active = settings.enabled !== false && selected.length > 0;
    if (!active) {
        if (section) {
            section.classList.remove('active');
            if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
        }
        return;
    }
    wrapper.innerHTML = selected.map(p => cardHTML(p, settings.badge)).join('');
    initSwiper(selected.length, settings.perView, settings.autoplayMs);

    // Header center / empty-state guard
    if (section) section.classList.add('active');

    wrapper.querySelectorAll('.flash-card').forEach(card => {
        const go = () => openProduct(card.dataset.id);
        card.addEventListener('click', go);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
        });
    });
}

// Reload when the admin saves / changes settings or products in another tab.
window.addEventListener('storage', (e) => {
    if (e.key && (e.key.startsWith('eshop_flash_') || e.key.startsWith('grabby_flash_') || e.key === 'eshop_products')) {
        initFlashSale(productsCache);
    }
});