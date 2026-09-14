// ─── HERO / TOP BANNER CAROUSEL (Swiper) ────────────────
// Full-width auto-swiping banner cards at the very top of the homepage.
// Admin manages slides (image / video / YouTube) + enable + autoplay + links.
import { escapeHtml } from '../core/utils.js';
import { createClient } from '../supabase/client.js';

const HERO_KEYS = ['hero_enabled', 'hero_title', 'hero_autoplay_ms', 'hero_slides'];

const DEFAULT_HERO = {
    enabled: true,
    title: '',
    autoplayMs: 4000,
    slides: []
};

let section = null;
let swiperInstance = null;

function readLocalSettings() {
    const s = {};
    HERO_KEYS.forEach(k => {
        const v = localStorage.getItem('grabby_' + k);
        if (v !== null) s[k] = v;
    });
    return s;
}

function persistLocalSettings(settings) {
    HERO_KEYS.forEach(k => {
        if (settings[k] !== undefined && settings[k] !== null) {
            try { localStorage.setItem('grabby_' + k, String(settings[k])); } catch (e) { /* noop */ }
        }
    });
}

function normalizeSlides(raw) {
    try {
        const arr = JSON.parse(raw || '[]');
        if (!Array.isArray(arr)) return [];
        return arr.filter(s => s && s.url && String(s.url).trim());
    } catch (e) {
        return [];
    }
}

function resolveSettings(local) {
    const slides = normalizeSlides(local.hero_slides);
    return {
        enabled: local.hero_enabled !== undefined ? local.hero_enabled !== 'false' : DEFAULT_HERO.enabled,
        title: local.hero_title || '',
        autoplayMs: parseInt(local.hero_autoplay_ms) || DEFAULT_HERO.autoplayMs,
        slides: slides.length ? slides : DEFAULT_HERO.slides
    };
}

async function fetchSupabaseSettings() {
    try {
        const supabase = createClient();
        if (!supabase) return null;
        const { data, error } = await supabase.from('settings').select('*').in('key', HERO_KEYS);
        if (error || !data) return null;
        const map = {};
        data.forEach(row => { map[row.key] = row.value; });
        return map;
    } catch (e) {
        console.warn('Failed to load hero banner settings from Supabase:', e);
        return null;
    }
}

function isYouTubeUrl(url) {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)/.test(url || '');
}

function youtubeId(url) {
    const m = String(url).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([^&\s]+)/);
    return m ? m[1] : '';
}

function youtubeEmbed(url) {
    const id = youtubeId(url);
    if (!id) return '';
    return 'https://www.youtube.com/embed/' + id + '?autoplay=1&mute=1&loop=1&playlist=' + id + '&controls=0&rel=0';
}

function slideMediaHTML(slide) {
    if (slide.type === 'video') {
        return `
            <video class="hero-video" src="${escapeHtml(slide.url)}" autoplay muted loop playsinline preload="metadata"></video>
            ${slide.title ? `<div class="hero-caption">${escapeHtml(slide.title)}</div>` : ''}
        `;
    }
    if (slide.type === 'youtube' || isYouTubeUrl(slide.url)) {
        const id = youtubeId(slide.url);
        return `
            <div class="hero-youtube">
                ${id ? `<img class="hero-youtube-thumb" src="https://img.youtube.com/vi/${escapeHtml(id)}/hqdefault.jpg" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
                <span class="hero-play">▶</span>
                <iframe class="hero-youtube-frame" src="${escapeHtml(youtubeEmbed(slide.url))}" allow="autoplay; encrypted-media; picture-in-picture" title="${escapeHtml(slide.title || 'Banner video')}"></iframe>
            </div>
            ${slide.title ? `<div class="hero-caption">${escapeHtml(slide.title)}</div>` : ''}
        `;
    }
    return `
        <img class="hero-img" src="${escapeHtml(slide.url)}" alt="${escapeHtml(slide.title || 'Banner')}" loading="lazy" />
        ${slide.title ? `<div class="hero-caption">${escapeHtml(slide.title)}</div>` : ''}
    `;
}

function linkFor(slide) {
    if (slide.link_target === 'product' && slide.link_value) {
        return 'product.html?id=' + encodeURIComponent(String(slide.link_value).split(',').pop().trim());
    }
    if (slide.link_target === 'url' && slide.link_value) {
        return slide.link_value;
    }
    return '';
}

function slideHTML(slide) {
    const link = linkFor(slide);
    const inner = slideMediaHTML(slide);
    return `
        <div class="swiper-slide hero-slide">
            ${link ? `<a class="hero-slide-link" href="${escapeHtml(link)}">${inner}</a>` : `<div class="hero-slide-link">${inner}</div>`}
        </div>`;
}

function render(settings) {
    if (!section) return;
    const active = settings.enabled !== false && settings.slides.length > 0;
    if (!active) {
        section.querySelector('.swiper-wrapper').innerHTML = '';
        section.classList.remove('active');
        if (swiperInstance) { swiperInstance.destroy(true, true); swiperInstance = null; }
        return;
    }
    const wrapper = section.querySelector('.swiper-wrapper');
    if (wrapper) wrapper.innerHTML = settings.slides.map(slideHTML).join('');
    const titleEl = section.querySelector('.hero-title');
    if (titleEl) titleEl.textContent = settings.title;
    section.style.setProperty('--hero-autoplay', settings.autoplayMs + 'ms');
    section.classList.add('active');
    initSwiper(settings.slides.length, settings.autoplayMs);
}

function initSwiper(slidesCount, autoplayMs) {
    const el = document.getElementById('heroSwiper');
    if (!el || typeof Swiper === 'undefined') {
        if (section) {
            section.classList.add('active');
            section.classList.add('no-swiper');
        }
        return null;
    }
    section.classList.remove('no-swiper');
    if (swiperInstance) {
        swiperInstance.destroy(true, true);
        swiperInstance = null;
    }
    swiperInstance = new Swiper(el, {
        loop: slidesCount > 1,
        speed: 700,
        watchOverflow: true,
        autoplay: {
            delay: parseInt(autoplayMs) || DEFAULT_HERO.autoplayMs,
            disableOnInteraction: false,
            pauseOnMouseEnter: true
        },
        pagination: {
            el: el.querySelector('.hero-swiper-pagination'),
            clickable: true,
            dynamicBullets: true
        },
        navigation: {
            nextEl: el.querySelector('.hero-swiper-next'),
            prevEl: el.querySelector('.hero-swiper-prev'),
            disabledClass: 'swiper-button-disabled'
        },
        breakpoints: {
            0: { slidesPerView: 1 },
            1024: { slidesPerView: 1 },
            1400: { slidesPerView: 1 }
        }
    });
    return swiperInstance;
}

export async function initHeroBanners() {
    section = document.getElementById('heroBanners');
    if (!section) return;

    const wrapper = section.querySelector('.swiper-wrapper');
    if (wrapper) wrapper.innerHTML = '<div class="hero-loading">Loading banners…</div>';
    section.classList.remove('active');

    const local = readLocalSettings();
    const remote = await fetchSupabaseSettings();
    if (remote) persistLocalSettings(remote);
    const settings = resolveSettings(remote || local);
    render(settings);
}

// Reload when the admin saves hero settings in another tab.
window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('grabby_hero_')) {
        initHeroBanners();
    }
});