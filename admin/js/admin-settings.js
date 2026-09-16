/* ─── ADMIN SETTINGS: homepage marquee controls ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, showToast, escapeHTML } = admin;

    const DEFAULT_MARQUEE_TEXT = '🚚 Demo delivery on all orders &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🎁 Free gift wrapping &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; ↩️ 7-day easy return &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🔒 Secure checkout';

    async function loadMarqueeSettings() {
        try {
            const { data, error } = await STATE.supabase
                .from('settings')
                .select('*')
                .in('key', [
                    'marquee_text', 'marquee_enabled', 'marquee_glow', 'marquee_glow_color',
                    'marquee_glow_intensity', 'marquee_border_glow', 'marquee_border_color',
                    'marquee_speed', 'marquee_bg_color', 'marquee_text_color'
                ]);
            if (error) throw error;

            const settings = {};
            data.forEach(row => { settings[row.key] = row.value; });

            DOM.marqueeInput.value = settings.marquee_text || DEFAULT_MARQUEE_TEXT;
            DOM.marqueeEnabled.checked = settings.marquee_enabled !== 'false';
            DOM.marqueeGlow.checked = settings.marquee_glow !== 'false';
            DOM.marqueeGlowColor.value = settings.marquee_glow_color || '#ff6b6b';
            DOM.marqueeGlowIntensity.value = parseInt(settings.marquee_glow_intensity) || 20;
            document.getElementById('glowIntensityLabel').textContent = DOM.marqueeGlowIntensity.value + 'px';
            DOM.marqueeBorderGlow.checked = settings.marquee_border_glow !== 'false';
            DOM.marqueeBorderColor.value = settings.marquee_border_color || '#667eea';
            DOM.marqueeSpeed.value = parseInt(settings.marquee_speed) || 20;
            document.getElementById('speedLabel').textContent = DOM.marqueeSpeed.value + 's';
            DOM.marqueeBgColor.value = settings.marquee_bg_color || '#0a0a0a';
            DOM.marqueeTextColor.value = settings.marquee_text_color || '#ffffff';

            updateMarqueePreview();
        } catch (err) {
            showToast('Failed to load marquee settings: ' + err.message, 'error');
        }
    }

    async function saveMarqueeSettings() {
        const text = DOM.marqueeInput.value.trim();
        if (!text) {
            showToast('Marquee text cannot be empty.', 'warning');
            return;
        }

        const settings = [
            { key: 'marquee_text', value: text },
            { key: 'marquee_enabled', value: String(DOM.marqueeEnabled.checked) },
            { key: 'marquee_glow', value: String(DOM.marqueeGlow.checked) },
            { key: 'marquee_glow_color', value: DOM.marqueeGlowColor.value },
            { key: 'marquee_glow_intensity', value: String(DOM.marqueeGlowIntensity.value) },
            { key: 'marquee_border_glow', value: String(DOM.marqueeBorderGlow.checked) },
            { key: 'marquee_border_color', value: DOM.marqueeBorderColor.value },
            { key: 'marquee_speed', value: String(DOM.marqueeSpeed.value) },
            { key: 'marquee_bg_color', value: DOM.marqueeBgColor.value },
            { key: 'marquee_text_color', value: DOM.marqueeTextColor.value }
        ];

        DOM.marqueeStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase
                .from('settings')
                .upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            showToast('Marquee settings saved!', 'success');
            DOM.marqueeStatus.textContent = '✓ Saved';
            settings.forEach(s => {
                localStorage.setItem('eshop_' + s.key, s.value);
            });
            updateMarqueePreview();
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
            DOM.marqueeStatus.textContent = '✗ Error';
        }
    }

    function resetMarqueeToDefault() {
        DOM.marqueeInput.value = DEFAULT_MARQUEE_TEXT;
        DOM.marqueeEnabled.checked = true;
        DOM.marqueeGlow.checked = true;
        DOM.marqueeGlowColor.value = '#ff6b6b';
        DOM.marqueeGlowIntensity.value = 20;
        document.getElementById('glowIntensityLabel').textContent = '20px';
        DOM.marqueeBorderGlow.checked = true;
        DOM.marqueeBorderColor.value = '#667eea';
        DOM.marqueeSpeed.value = 20;
        document.getElementById('speedLabel').textContent = '20s';
        DOM.marqueeBgColor.value = '#0a0a0a';
        DOM.marqueeTextColor.value = '#ffffff';
        updateMarqueePreview();
        DOM.marqueeStatus.textContent = 'Reset to default';
        setTimeout(() => { DOM.marqueeStatus.textContent = ''; }, 2000);
    }

    function updateMarqueePreview() {
        const text = DOM.marqueeInput.value || 'Preview text';
        const preview = DOM.marqueePreview;
        const container = DOM.marqueePreviewContainer;
        const speed = DOM.marqueeSpeed.value || 20;

        preview.textContent = text.replace(/&nbsp;/g, ' ').replace(/<[^>]*>/g, '');
        preview.style.animation = `marqueeScroll ${speed}s linear infinite`;
        preview.style.color = DOM.marqueeTextColor.value;
        container.style.background = DOM.marqueeBgColor.value;

        if (DOM.marqueeGlow.checked) {
            const intensity = DOM.marqueeGlowIntensity.value || 20;
            preview.style.textShadow = `0 0 ${intensity}px ${DOM.marqueeGlowColor.value}, 0 0 ${intensity * 2}px ${DOM.marqueeGlowColor.value}40`;
        } else {
            preview.style.textShadow = 'none';
        }

        if (DOM.marqueeBorderGlow.checked) {
            container.style.boxShadow = `0 0 20px ${DOM.marqueeBorderColor.value}, inset 0 0 20px ${DOM.marqueeBorderColor.value}20`;
            container.style.border = `1px solid ${DOM.marqueeBorderColor.value}40`;
        } else {
            container.style.boxShadow = 'none';
            container.style.border = '1px solid var(--border)';
        }
    }

    // ─── FLASH SALE / HOT DEALS ────────────────────────────────
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
    const FLASH_KEYS = [
        'flash_enabled', 'flash_title', 'flash_subtitle', 'flash_badge',
        'flash_product_ids', 'flash_autoplay_ms', 'flash_per_view',
        'flash_accent', 'flash_duration_minutes'
    ];
    let flashSelectedIds = [];
    let heroSlides = [];

    function updateFlashAutoplayLabel() {
        if (!DOM.flashAutoplay || !DOM.flashAutoplayLabel) return;
        DOM.flashAutoplayLabel.textContent = (DOM.flashAutoplay.value / 1000).toFixed(1) + 's';
    }

    function recordFlashSelection() {
        if (!DOM.flashProductSelect) return;
        flashSelectedIds = [...DOM.flashProductSelect.selectedOptions].map(o => o.value);
    }

    function populateFlashProductSelect() {
        if (!DOM.flashProductSelect) return;
        const selected = new Set(DOM.flashProductSelect.selectedOptions ?
            [...DOM.flashProductSelect.selectedOptions].map(o => o.value) : flashSelectedIds);
        if (!selected.size) flashSelectedIds.forEach(id => selected.add(String(id)));
        const products = STATE.allProducts && STATE.allProducts.length ? STATE.allProducts : STATE.products;
        if (!products.length) {
            DOM.flashProductSelect.innerHTML = '<option value="" disabled>No products yet</option>';
            return;
        }
        DOM.flashProductSelect.innerHTML = products.map(p =>
            `<option value="${escapeHTML(p.id)}" ${selected.has(String(p.id)) ? 'selected' : ''}>${escapeHTML(p.title)} (৳${Math.round(Number(p.price) || 0)})</option>`
        ).join('');
    }

    async function loadFlashSettings() {
        try {
            const { data, error } = await STATE.supabase.from('settings').select('*').in('key', FLASH_KEYS);
            if (error) throw error;
            const map = {};
            (data || []).forEach(row => { map[row.key] = row.value; });

            DOM.flashEnabled.checked = map.flash_enabled !== 'false';
            DOM.flashTitle.value = map.flash_title || DEFAULT_FLASH.title;
            DOM.flashSubtitle.value = map.flash_subtitle || DEFAULT_FLASH.subtitle;
            DOM.flashBadge.value = map.flash_badge || DEFAULT_FLASH.badge;
            DOM.flashAutoplay.value = parseInt(map.flash_autoplay_ms) || DEFAULT_FLASH.autoplayMs;
            DOM.flashPerView.value = String(parseInt(map.flash_per_view) || DEFAULT_FLASH.perView);
            DOM.flashAccent.value = map.flash_accent || DEFAULT_FLASH.accent;
            DOM.flashDuration.value = parseInt(map.flash_duration_minutes) || DEFAULT_FLASH.durationMin;
            flashSelectedIds = String(map.flash_product_ids || '').split(',').map(s => s.trim()).filter(Boolean);
            updateFlashAutoplayLabel();
            populateFlashProductSelect();
        } catch (err) {
            showToast('Failed to load flash sale settings: ' + err.message, 'error');
        }
    }

    async function saveFlashSettings() {
        const title = DOM.flashTitle.value.trim();
        if (!title) { showToast('Flash sale title cannot be empty.', 'warning'); DOM.flashTitle.focus(); return; }
        const productIds = [...DOM.flashProductSelect.selectedOptions].map(o => o.value).join(',');
        const settings = [
            { key: 'flash_enabled', value: String(DOM.flashEnabled.checked) },
            { key: 'flash_title', value: title },
            { key: 'flash_subtitle', value: DOM.flashSubtitle.value.trim() },
            { key: 'flash_badge', value: DOM.flashBadge.value.trim() || DEFAULT_FLASH.badge },
            { key: 'flash_product_ids', value: productIds },
            { key: 'flash_autoplay_ms', value: String(parseInt(DOM.flashAutoplay.value) || DEFAULT_FLASH.autoplayMs) },
            { key: 'flash_per_view', value: String(parseInt(DOM.flashPerView.value) || DEFAULT_FLASH.perView) },
            { key: 'flash_accent', value: DOM.flashAccent.value },
            { key: 'flash_duration_minutes', value: String(parseInt(DOM.flashDuration.value) || DEFAULT_FLASH.durationMin) }
        ];

        DOM.flashStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            settings.forEach(s => { localStorage.setItem('eshop_' + s.key, s.value); });
            showToast('Flash sale settings saved! The homepage will update within seconds.', 'success');
            DOM.flashStatus.textContent = '✓ Saved';
            setTimeout(() => { DOM.flashStatus.textContent = ''; }, 2500);
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
            DOM.flashStatus.textContent = '✗ Error';
        }
    }

    function resetFlashSettings() {
        DOM.flashEnabled.checked = DEFAULT_FLASH.enabled;
        DOM.flashTitle.value = DEFAULT_FLASH.title;
        DOM.flashSubtitle.value = DEFAULT_FLASH.subtitle;
        DOM.flashBadge.value = DEFAULT_FLASH.badge;
        DOM.flashAutoplay.value = DEFAULT_FLASH.autoplayMs;
        DOM.flashPerView.value = String(DEFAULT_FLASH.perView);
        DOM.flashAccent.value = DEFAULT_FLASH.accent;
        DOM.flashDuration.value = DEFAULT_FLASH.durationMin;
        flashSelectedIds = [];
        updateFlashAutoplayLabel();
        populateFlashProductSelect();
        DOM.flashStatus.textContent = 'Reset to default — click Save to publish';
        setTimeout(() => { DOM.flashStatus.textContent = ''; }, 3000);
    }

    // ─── HERO / TOP BANNER CAROUSEL ──────────────────────────
    const HERO_KEYS = ['hero_enabled', 'hero_title', 'hero_autoplay_ms', 'hero_slides'];
    const DEFAULT_HERO_ENABLED = true;

    function defaultHeroSlides() {
        return [];
    }

    function heroProductOptionsHTML(selected) {
        const products = STATE.allProducts && STATE.allProducts.length ? STATE.allProducts : STATE.products;
        if (!products || !products.length) return '<option value="">No products yet</option>';
        return `<option value="">Choose product…</option>` + products.map(p =>
            `<option value="${escapeHTML(p.id)}" ${String(p.id) === String(selected) ? 'selected' : ''}>${escapeHTML(p.title)} (৳${Math.round(Number(p.price) || 0)})</option>`
        ).join('');
    }

    function heroSlidePreviewHTML(slide) {
        const url = (slide.url || '').trim();
        if (!url) return '<span style="font-size:12px;color:var(--text-secondary);">?</span>';
        if (slide.type === 'youtube' || admin.isYouTubeUrl(url)) {
            const thumb = admin.getYouTubeThumbnail(url);
            if (thumb) return `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;">`;
        }
        return `<img src="${escapeHTML(url)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='❌';">`;
    }

    function renderHeroSlides() {
        const container = DOM.heroSlidesList;
        if (!container) return;
        const slides = heroSlides;
        container.innerHTML = slides.map((slide, idx) => {
            const isYouTube = slide.type === 'youtube' || admin.isYouTubeUrl(slide.url);
            const type = slide.type && slide.type !== 'image' ? slide.type : (isYouTube ? 'youtube' : 'image');
            return `
                <div class="hero-slide-row" data-idx="${idx}" style="border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px; background:var(--surface); display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="width:56px; height:56px; border-radius:8px; overflow:hidden; background:var(--secondary-bg); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:16px;">
                            ${heroSlidePreviewHTML(slide)}
                        </span>
                        <div style="flex:1; display:flex; flex-direction:column; gap:6px; min-width:0;">
                            <select class="hero-slide-type" style="padding:5px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text);">
                                <option value="image" ${type === 'image' ? 'selected' : ''}>🖼️ Image</option>
                                <option value="video" ${type === 'video' ? 'selected' : ''}>🎬 Video (mp4/webm)</option>
                                <option value="youtube" ${type === 'youtube' ? 'selected' : ''}>▶️ YouTube</option>
                            </select>
                            <input class="hero-slide-url" type="text" placeholder="Image / video / YouTube URL" value="${escapeHTML(slide.url || '')}" style="padding:5px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text); width:100%;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                            <label style="display:flex; align-items:center; gap:4px; font-size:0.72rem; color:var(--text-secondary);">
                                <input type="checkbox" class="hero-slide-enabled" ${slide.enabled !== false ? 'checked' : ''}> On
                            </label>
                            <button type="button" class="hero-slide-remove" style="padding:4px 10px; font-size:12px; background:var(--danger); color:#fff; border-radius:6px;">✕</button>
                            <button type="button" class="hero-slide-up" style="padding:4px 10px; font-size:12px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text);" ${idx === 0 ? 'disabled' : ''}>▲</button>
                            <button type="button" class="hero-slide-down" style="padding:4px 10px; font-size:12px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text);" ${idx === slides.length - 1 ? 'disabled' : ''}>▼</button>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <input class="hero-slide-title" type="text" placeholder="Slide title (optional)" value="${escapeHTML(slide.title || '')}" style="flex:1; min-width:120px; padding:5px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text);">
                        <select class="hero-slide-link-type" style="padding:5px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text);">
                            <option value="none" ${!slide.link_target ? 'selected' : ''}>🔗 No link</option>
                            <option value="product" ${slide.link_target === 'product' ? 'selected' : ''}>🏷️ Product</option>
                            <option value="url" ${slide.link_target === 'url' ? 'selected' : ''}>🌐 Custom URL</option>
                        </select>
                        ${slide.link_target === 'product'
                            ? `<select class="hero-slide-product" style="flex:1; min-width:140px; padding:5px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text);">${heroProductOptionsHTML(slide.link_value)}</select>`
                            : ''}
                        ${slide.link_target === 'url'
                            ? `<input class="hero-slide-url-value" type="text" placeholder="https://…" value="${escapeHTML(slide.link_value || '')}" style="flex:1; min-width:140px; padding:5px 8px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text);">`
                            : ''}
                        <button type="button" class="hero-slide-upload" style="padding:5px 10px; font-size:12px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--text);">📤 Upload</button>
                        <input type="file" accept="image/*" class="hero-slide-file" style="display:none;">
                    </div>
                </div>`;
        }).join('');
        bindHeroSlideEvents(container);
        bindHeroFileInputs(container);
    }

    function bindHeroSlideEvents(container) {
        container.onclick = function (e) {
            const row = e.target.closest('.hero-slide-row');
            if (!row) return;
            const idx = parseInt(row.dataset.idx);
            if (e.target.closest('.hero-slide-remove')) {
                e.preventDefault();
                heroSlides.splice(idx, 1);
                renderHeroSlides();
                return;
            }
            if (e.target.closest('.hero-slide-up')) {
                if (idx > 0) {
                    const t = heroSlides[idx - 1];
                    heroSlides[idx - 1] = heroSlides[idx];
                    heroSlides[idx] = t;
                    renderHeroSlides();
                }
                return;
            }
            if (e.target.closest('.hero-slide-down')) {
                if (idx < heroSlides.length - 1) {
                    const t = heroSlides[idx + 1];
                    heroSlides[idx + 1] = heroSlides[idx];
                    heroSlides[idx] = t;
                    renderHeroSlides();
                }
                return;
            }
        };
        container.onchange = function (e) {
            const row = e.target.closest('.hero-slide-row');
            if (!row) return;
            const idx = parseInt(row.dataset.idx);
            const slide = heroSlides[idx];
            if (!slide) return;
            if (e.target.classList.contains('hero-slide-type')) {
                slide.type = e.target.value;
                renderHeroSlides();
                return;
            }
            if (e.target.classList.contains('hero-slide-enabled')) {
                slide.enabled = e.target.checked;
                return;
            }
            if (e.target.classList.contains('hero-slide-link-type')) {
                slide.link_target = e.target.value;
                if (slide.link_target === 'none') delete slide.link_value;
                renderHeroSlides();
                return;
            }
            if (e.target.classList.contains('hero-slide-product')) {
                slide.link_value = e.target.value;
            }
        };
        container.oninput = function (e) {
            const row = e.target.closest('.hero-slide-row');
            if (!row) return;
            const idx = parseInt(row.dataset.idx);
            const slide = heroSlides[idx];
            if (!slide) return;
            if (e.target.classList.contains('hero-slide-url')) {
                slide.url = e.target.value;
                const th = row.querySelector('.hero-slide-type');
                if (th && admin.isYouTubeUrl(e.target.value)) {
                    th.value = 'youtube';
                    slide.type = 'youtube';
                }
            } else if (e.target.classList.contains('hero-slide-title')) {
                slide.title = e.target.value;
            } else if (e.target.classList.contains('hero-slide-url-value')) {
                slide.link_value = e.target.value;
            }
        };
    }

    function bindHeroFileInputs(container) {
        container.querySelectorAll('.hero-slide-file').forEach(fileInput => {
            fileInput.addEventListener('change', async function () {
                const file = this.files[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                    showToast('Please select an image file.', 'warning');
                    this.value = '';
                    return;
                }
                const row = this.closest('.hero-slide-row');
                const idx = parseInt(row.dataset.idx);
                const uploadBtn = row.querySelector('.hero-slide-upload');
                uploadBtn.textContent = '⏳ Uploading...';
                uploadBtn.disabled = true;
                try {
                    const url = await admin.uploadToImgBB(file);
                    const slide = heroSlides[idx];
                    slide.url = url;
                    slide.type = 'image';
                    renderHeroSlides();
                    showToast('Image uploaded successfully!', 'success');
                } catch (err) {
                    showToast('Upload failed: ' + err.message, 'error');
                } finally {
                    renderHeroSlides();
                }
            });
        });
        container.querySelectorAll('.hero-slide-upload').forEach(btn => {
            btn.onclick = () => {
                const row = btn.closest('.hero-slide-row');
                const fileInput = row.querySelector('.hero-slide-file');
                if (fileInput) fileInput.click();
            };
        });
    }

    function readHeroSlides() {
        const rows = DOM.heroSlidesList ? DOM.heroSlidesList.querySelectorAll('.hero-slide-row') : [];
        return Array.from(rows).map((row, idx) => {
            const slide = heroSlides[idx] || {};
            return {
                type: slide.type || 'image',
                url: slide.url || '',
                title: slide.title || '',
                enabled: slide.enabled !== false,
                link_target: slide.link_target || 'none',
                link_value: slide.link_value || ''
            };
        });
    }

    function updateHeroAutoplayLabel() {
        if (DOM.heroAutoplay && DOM.heroAutoplayLabel) {
            DOM.heroAutoplayLabel.textContent = (DOM.heroAutoplay.value / 1000).toFixed(1) + 's';
        }
    }

    async function loadHeroSettings() {
        heroSlides = defaultHeroSlides();
        try {
            const { data, error } = await STATE.supabase.from('settings').select('*').in('key', HERO_KEYS);
            if (error) throw error;
            const map = {};
            (data || []).forEach(row => { map[row.key] = row.value; });
            DOM.heroEnabled.checked = map.hero_enabled !== 'false';
            DOM.heroTitle.value = map.hero_title || '';
            DOM.heroAutoplay.value = parseInt(map.hero_autoplay_ms) || 4000;
            updateHeroAutoplayLabel();
            try { heroSlides = JSON.parse(map.hero_slides || '[]'); } catch (e) { heroSlides = []; }
            if (!Array.isArray(heroSlides)) heroSlides = [];
            renderHeroSlides();
        } catch (err) {
            showToast('Failed to load hero banner settings: ' + err.message, 'error');
        }
    }

    async function saveHeroSettings() {
        const slides = readHeroSlides();
        const valid = slides.filter(s => s.url.trim());
        if (valid.length === 0) {
            showToast('Add at least one slide with a media URL.', 'warning');
            return;
        }
        const settings = [
            { key: 'hero_enabled', value: String(DOM.heroEnabled.checked) },
            { key: 'hero_title', value: DOM.heroTitle.value.trim() },
            { key: 'hero_autoplay_ms', value: String(parseInt(DOM.heroAutoplay.value) || 4000) },
            { key: 'hero_slides', value: JSON.stringify(valid) }
        ];
        DOM.heroStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            settings.forEach(s => { localStorage.setItem('eshop_' + s.key, s.value); });
            showToast('Hero banners saved! The homepage will update within seconds.', 'success');
            DOM.heroStatus.textContent = '✓ Saved';
            setTimeout(() => { DOM.heroStatus.textContent = ''; }, 2500);
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
            DOM.heroStatus.textContent = '✗ Error';
        }
    }

    async function toggleHeroSetting() {
        const isEnabled = DOM.heroEnabled.checked;
        const settings = [{ key: 'hero_enabled', value: String(isEnabled) }];
        DOM.heroStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            localStorage.setItem('eshop_hero_enabled', String(isEnabled));
            showToast(isEnabled ? 'Hero banners enabled' : 'Hero banners disabled', 'success');
            DOM.heroStatus.textContent = '✓ Saved';
            setTimeout(() => { DOM.heroStatus.textContent = ''; }, 2000);
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
            DOM.heroStatus.textContent = '✗ Error';
        }
    }

    async function resetHeroSettings() {
        heroSlides = defaultHeroSlides();
        DOM.heroEnabled.checked = DEFAULT_HERO_ENABLED;
        DOM.heroTitle.value = '';
        DOM.heroAutoplay.value = 4000;
        updateHeroAutoplayLabel();
        renderHeroSlides();
        const settings = [
            { key: 'hero_enabled', value: 'true' },
            { key: 'hero_title', value: '' },
            { key: 'hero_autoplay_ms', value: '4000' },
            { key: 'hero_slides', value: '[]' }
        ];
        DOM.heroStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            settings.forEach(s => { localStorage.setItem('eshop_' + s.key, s.value); });
            showToast('Hero banners reset to default', 'success');
            DOM.heroStatus.textContent = '✓ Saved';
            setTimeout(() => { DOM.heroStatus.textContent = ''; }, 2000);
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
            DOM.heroStatus.textContent = '✗ Error';
        }
    }

    function addHeroSlide() {
        if (!heroSlides) heroSlides = [];
        heroSlides.push({ type: 'image', url: '', title: '', enabled: true, link_target: 'none', link_value: '' });
        renderHeroSlides();
    }

    // ─── SITE THEME / COLORS ───────────────────────────────────
    const SITE_COLOR_KEYS = [
        { key: 'bg', prop: '--bg', id: 'themeBg' },
        { key: 'card', prop: '--card-bg', id: 'themeCard' },
        { key: 'secondary', prop: '--secondary-bg', id: 'themeSecondary' },
        { key: 'text', prop: '--text', id: 'themeText' },
        { key: 'textSecondary', prop: '--text-secondary', id: 'themeTextSecondary' },
        { key: 'border', prop: '--border', id: 'themeBorder' },
        { key: 'accent', prop: '--accent', id: 'themeAccent' },
        { key: 'headerBg', prop: '--header-bg', id: 'themeHeaderBg' },
        { key: 'headerText', prop: '--header-text', id: 'themeHeaderText' }
    ];

    const PRESET_COLORS = {
        silver: { bg: '#f1f3f5', card: '#ffffff', secondary: '#e7eaee', text: '#181b20', textSecondary: '#5f6670', border: '#d2d7dd', accent: '#20242b', headerBg: '#20242b', headerText: '#f5f7fa' },
        light: { bg: '#ffffff', card: '#ffffff', secondary: '#e9ebef', text: '#14171c', textSecondary: '#5b6470', border: '#d8dce2', accent: '#23282f', headerBg: '#23282f', headerText: '#f5f7fa' },
        dark: { bg: '#0f1115', card: '#161a20', secondary: '#1a1e24', text: '#e8eaee', textSecondary: '#8b939e', border: '#2b313a', accent: '#2a2f37', headerBg: '#0a0c0f', headerText: '#f5f7fa' }
    };

    function readCustomTheme() {
        return {
            bg: DOM.themeBg.value, card: DOM.themeCard.value, secondary: DOM.themeSecondary.value,
            text: DOM.themeText.value, textSecondary: DOM.themeTextSecondary.value,
            border: DOM.themeBorder.value, accent: DOM.themeAccent.value,
            headerBg: DOM.themeHeaderBg.value, headerText: DOM.themeHeaderText.value
        };
    }

    function setActivePreset(preset) {
        const container = DOM.themePresets;
        if (!container) return;
        container.querySelectorAll('.theme-preset').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.preset === preset)
        );
        if (DOM.themeCustomFields) DOM.themeCustomFields.style.display = preset === 'custom' ? 'grid' : 'none';
    }

    function fillThemeForm(preset, colors) {
        setActivePreset(preset);
        const values = Object.assign({}, PRESET_COLORS[preset] || PRESET_COLORS.silver, colors);
        SITE_COLOR_KEYS.forEach(({ key, id }) => {
            const el = document.getElementById(id);
            if (el && values[key]) el.value = values[key];
        });
    }

    async function loadThemeSettings() {
        try {
            const keys = ['theme_preset', ...SITE_COLOR_KEYS.map(({ key }) => 'theme_' + key)];
            const { data, error } = await STATE.supabase.from('settings').select('*').in('key', keys);
            if (error) throw error;
            const map = {};
            (data || []).forEach(row => { map[row.key] = row.value; });
            const preset = map.theme_preset || 'silver';
            const colors = {};
            SITE_COLOR_KEYS.forEach(({ key }) => { if (map['theme_' + key]) colors[key] = map['theme_' + key]; });
            fillThemeForm(preset, colors);
        } catch (err) {
            showToast('Failed to load theme settings: ' + (err.message || err), 'error');
        }
    }

    async function saveThemeSettings() {
        if (!DOM.themePresets) return;
        const activeBtn = DOM.themePresets.querySelector('.theme-preset.active') ||
            DOM.themePresets.querySelector('.theme-preset[data-preset="silver"]');
        const preset = activeBtn ? activeBtn.dataset.preset : 'silver';
        let customColors = readCustomTheme();

        // Always persist the concrete color values, not just the preset name.
        // If a named preset is active, fall back to its colors for any empty fields.
        const base = PRESET_COLORS[preset] || PRESET_COLORS.silver;
        Object.keys(base).forEach(key => { if (!customColors[key]) customColors[key] = base[key]; });

        const settings = [{ key: 'theme_preset', value: preset }];
        SITE_COLOR_KEYS.forEach(({ key }) =>
            settings.push({ key: 'theme_' + key, value: customColors[key] })
        );

        DOM.themeStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            localStorage.setItem('eshop_site_colors', JSON.stringify({ preset, colors: customColors }));
            showToast('Theme saved! The website now uses these colors.', 'success');
            DOM.themeStatus.textContent = '✓ Saved';
            setTimeout(() => { DOM.themeStatus.textContent = ''; }, 2500);
        } catch (err) {
            showToast('Failed to save theme: ' + (err.message || err), 'error');
            DOM.themeStatus.textContent = '✗ Error';
        }
    }

    function resetThemeSettings() {
        fillThemeForm('silver', {});
        DOM.themeStatus.textContent = 'Reset to Silver — click Save to publish';
        setTimeout(() => { DOM.themeStatus.textContent = ''; }, 3500);
    }

    // ─── HEADER & FOOTER COLOR (per color mode, default matte black) ──
    // Same Header & Footer color setting, editable two ways:
    //   1. visual color picker,  2. manual HEX code entry.
    // Stored in the existing `settings` table as:
    //   header_footer_bg_light + header_footer_bg_dark
    const HF_KEYS = ['header_footer_bg_light', 'header_footer_bg_dark'];
    const HF_DEFAULT = '#000000';
    const HF_CACHE_KEY = 'eshop_header_footer_colors';

    function normalizeHfHex(value) {
        if (typeof value !== 'string') return null;
        let v = value.trim().toLowerCase();
        if (!v) return null;
        if (v.charAt(0) !== '#') v = '#' + v;
        if (/^#[0-9a-f]{3}$/.test(v)) {
            v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        }
        return /^#[0-9a-f]{6}$/.test(v) ? v : null;
    }

    function setHfModeUI(mode, color) {
        const c = normalizeHfHex(color) || HF_DEFAULT;
        const picker = mode === 'dark' ? DOM.hfPickerDark : DOM.hfPickerLight;
        const hex = mode === 'dark' ? DOM.hfHexDark : DOM.hfHexLight;
        const swatch = mode === 'dark' ? DOM.hfSwatchDark : DOM.hfSwatchLight;
        const current = mode === 'dark' ? DOM.hfCurrentDark : DOM.hfCurrentLight;
        if (picker) picker.value = c;
        if (hex) { hex.value = c; hex.classList.remove('invalid'); }
        if (swatch) swatch.style.background = c;
        if (current) current.textContent = c;
    }

    function readHfModeUI(mode) {
        const hex = mode === 'dark' ? DOM.hfHexDark : DOM.hfHexLight;
        return normalizeHfHex(hex ? hex.value : '');
    }

    function cacheHfColors(light, dark) {
        try { localStorage.setItem(HF_CACHE_KEY, JSON.stringify({ light, dark })); } catch { /* noop */ }
    }

    async function loadHfColors() {
        // Show cached values instantly, then refresh from the database.
        try {
            const cached = JSON.parse(localStorage.getItem(HF_CACHE_KEY) || 'null');
            if (cached) {
                setHfModeUI('light', cached.light);
                setHfModeUI('dark', cached.dark);
            }
        } catch { /* noop */ }
        try {
            const { data, error } = await STATE.supabase.from('settings').select('*').in('key', HF_KEYS);
            if (error) throw error;
            const map = {};
            (data || []).forEach(row => { map[row.key] = row.value; });
            const light = normalizeHfHex(map.header_footer_bg_light) || HF_DEFAULT;
            const dark = normalizeHfHex(map.header_footer_bg_dark) || HF_DEFAULT;
            setHfModeUI('light', light);
            setHfModeUI('dark', dark);
            cacheHfColors(light, dark);
        } catch (err) {
            showToast('Failed to load header & footer color: ' + (err.message || err), 'error');
        }
    }

    async function saveHfColors() {
        const light = readHfModeUI('light');
        const dark = readHfModeUI('dark');
        if (!light) {
            showToast('Bright Mode color is not a valid HEX code (e.g. #000000).', 'warning');
            if (DOM.hfHexLight) { DOM.hfHexLight.classList.add('invalid'); DOM.hfHexLight.focus(); }
            return;
        }
        if (!dark) {
            showToast('Dark Mode color is not a valid HEX code (e.g. #000000).', 'warning');
            if (DOM.hfHexDark) { DOM.hfHexDark.classList.add('invalid'); DOM.hfHexDark.focus(); }
            return;
        }
        const settings = [
            { key: 'header_footer_bg_light', value: light },
            { key: 'header_footer_bg_dark', value: dark }
        ];
        if (DOM.hfStatus) DOM.hfStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            setHfModeUI('light', light);
            setHfModeUI('dark', dark);
            cacheHfColors(light, dark);
            showToast('Header & footer color saved! The website updates automatically.', 'success');
            if (DOM.hfStatus) {
                DOM.hfStatus.textContent = '✓ Saved';
                setTimeout(() => { if (DOM.hfStatus) DOM.hfStatus.textContent = ''; }, 2500);
            }
        } catch (err) {
            showToast('Failed to save: ' + (err.message || err), 'error');
            if (DOM.hfStatus) DOM.hfStatus.textContent = '✗ Error';
        }
    }

    function resetHfColors() {
        setHfModeUI('light', HF_DEFAULT);
        setHfModeUI('dark', HF_DEFAULT);
        if (DOM.hfStatus) {
            DOM.hfStatus.textContent = 'Reset to matte black — click Save to publish';
            setTimeout(() => { if (DOM.hfStatus) DOM.hfStatus.textContent = ''; }, 3500);
        }
    }

    function bindHfModePair(mode) {
        const picker = mode === 'dark' ? DOM.hfPickerDark : DOM.hfPickerLight;
        const hex = mode === 'dark' ? DOM.hfHexDark : DOM.hfHexLight;
        // 1. Visual picker -> HEX field + live swatch
        picker?.addEventListener('input', () => setHfModeUI(mode, picker.value));
        // 2. Manual HEX entry -> picker + live swatch (when valid)
        hex?.addEventListener('input', () => {
            const c = normalizeHfHex(hex.value);
            const swatch = mode === 'dark' ? DOM.hfSwatchDark : DOM.hfSwatchLight;
            const current = mode === 'dark' ? DOM.hfCurrentDark : DOM.hfCurrentLight;
            if (c) {
                hex.classList.remove('invalid');
                if (picker) picker.value = c;
                if (swatch) swatch.style.background = c;
                if (current) current.textContent = c;
            } else {
                hex.classList.add('invalid');
            }
        });
        // Normalize the HEX text on blur (e.g. "abc" -> "#aabbcc")
        hex?.addEventListener('change', () => {
            const c = normalizeHfHex(hex.value);
            if (c) setHfModeUI(mode, c);
        });
    }

    // ─── MESSENGER / CHAT SUPPORT ─────────────────────────────
    const MESSENGER_KEY = 'messenger_link';
    const DEFAULT_MESSENGER_LINK = '';

    function loadMessengerSettings() {
        if (!DOM.messengerLink) return;
        const cached = localStorage.getItem('eshop_messenger_link');
        DOM.messengerLink.value = cached || '';
        try {
            STATE.supabase
                .from('settings')
                .select('*')
                .eq('key', MESSENGER_KEY)
                .then(({ data, error }) => {
                    if (error) throw error;
                    const row = data && data[0];
                    if (row && row.value) {
                        DOM.messengerLink.value = row.value;
                        localStorage.setItem('eshop_messenger_link', row.value);
                    }
                })
                .catch(err => {
                    showToast('Failed to load messenger settings: ' + (err.message || err), 'error');
                });
        } catch (err) {
            showToast('Failed to load messenger settings: ' + (err.message || err), 'error');
        }
    }

    async function saveMessengerSettings() {
        if (!DOM.messengerLink) return;
        const link = DOM.messengerLink.value.trim();
        if (link && !admin.isValidUrl(link)) {
            showToast('Please enter a valid Messenger/Facebook URL (https://...).', 'warning');
            return;
        }
        const setting = [{ key: MESSENGER_KEY, value: link }];
        DOM.messengerStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(setting, { onConflict: 'key' });
            if (error) throw error;
            localStorage.setItem('eshop_messenger_link', link);
            showToast('Messenger link saved!', 'success');
            DOM.messengerStatus.textContent = '✓ Saved';
            setTimeout(() => { DOM.messengerStatus.textContent = ''; }, 2500);
        } catch (err) {
            showToast('Failed to save: ' + (err.message || err), 'error');
            DOM.messengerStatus.textContent = '✗ Error';
        }
    }

    // ─── SOCIAL MEDIA LINKS ─────────────────────────────
const SOCIAL_KEYS = ['social_facebook', 'social_instagram', 'social_youtube', 'social_tiktok', 'social_x'];
const SOCIAL_LABELS = ['facebook', 'instagram', 'youtube', 'tiktok', 'x'];
const SOCIAL_INPUT_IDS = {
    facebook: 'socialFacebook',
    instagram: 'socialInstagram',
    youtube: 'socialYouTube',
    tiktok: 'socialTiktok',
    x: 'socialX'
};

async function loadSocialSettings() {
    try {
        const { data, error } = await STATE.supabase.from('settings').select('*').in('key', SOCIAL_KEYS);
        if (error) throw error;
        (data || []).forEach(row => {
            const id = SOCIAL_LABELS[SOCIAL_KEYS.indexOf(row.key)];
            const inputId = SOCIAL_INPUT_IDS[id];
            if (id && inputId && DOM[inputId]) {
                DOM[inputId].value = row.value || '';
                localStorage.setItem('eshop_social_' + id, row.value || '');
            }
        });
    } catch (err) {
        showToast('Failed to load social settings: ' + (err.message || err), 'error');
    }
}

async function saveSocialSettings() {
    const settings = [];
    for (const id of SOCIAL_LABELS) {
        const input = DOM[SOCIAL_INPUT_IDS[id]];
        const link = input ? input.value.trim() : '';
        if (link && !admin.isValidUrl(link)) {
            showToast('Please enter a valid URL for ' + id + '.', 'warning');
            input.focus();
            return;
        }
        settings.push({ key: 'social_' + id, value: link });
    }

    DOM.socialStatus.textContent = 'Saving...';
    try {
        const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
        if (error) throw error;
        settings.forEach(s => localStorage.setItem('eshop_' + s.key, s.value));
        showToast('Social links saved! The public footer updates automatically.', 'success');
        DOM.socialStatus.textContent = '✓ Saved';
        setTimeout(() => { DOM.socialStatus.textContent = ''; }, 2500);
    } catch (err) {
        showToast('Failed to save: ' + (err.message || err), 'error');
        DOM.socialStatus.textContent = '✗ Error';
    }
}

    // ─── CUSTOMER ORDER MODE ─────────────────────────────
    // Single row in the EXISTING `settings` table:
    //   customer_order_mode = 'login' | 'guest'
    // 'login' (default): checkout requires sign-in (existing flow).
    // 'guest': checkout allows guest orders (secured server-side by
    // the create_order_secure RPC in guest-checkout.sql).
    const ORDER_MODE_KEY = 'customer_order_mode';
    const ORDER_MODE_CACHE = 'eshop_customer_order_mode';
    const ORDER_MODE_LABELS = {
        login: 'Customer Order with Login (login required)',
        guest: 'Customer Order without Login (guest checkout)'
    };

    function normalizeOrderMode(value) {
        return value === 'guest' ? 'guest' : 'login';
    }

    function renderOrderModeUI(mode) {
        const m = normalizeOrderMode(mode);
        if (DOM.orderModeSelect) DOM.orderModeSelect.value = m;
        if (DOM.orderModeCurrent) DOM.orderModeCurrent.textContent = ORDER_MODE_LABELS[m];
    }

    async function loadOrderModeSettings() {
        // Cached value first so the current mode shows instantly.
        try {
            const cached = localStorage.getItem(ORDER_MODE_CACHE);
            if (cached) renderOrderModeUI(cached);
        } catch { /* noop */ }
        try {
            const { data, error } = await STATE.supabase
                .from('settings')
                .select('value')
                .eq('key', ORDER_MODE_KEY)
                .maybeSingle();
            if (error) throw error;
            const mode = normalizeOrderMode(data && data.value);
            renderOrderModeUI(mode);
            try { localStorage.setItem(ORDER_MODE_CACHE, mode); } catch { /* noop */ }
        } catch (err) {
            showToast('Failed to load order mode: ' + (err.message || err), 'error');
        }
    }

    async function saveOrderModeSettings() {
        const mode = normalizeOrderMode(DOM.orderModeSelect && DOM.orderModeSelect.value);
        if (DOM.orderModeStatus) DOM.orderModeStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase
                .from('settings')
                .upsert([{ key: ORDER_MODE_KEY, value: mode }], { onConflict: 'key' });
            if (error) throw error;
            renderOrderModeUI(mode);
            try { localStorage.setItem(ORDER_MODE_CACHE, mode); } catch { /* noop */ }
            showToast('Customer order mode saved! Checkout updates automatically.', 'success');
            if (DOM.orderModeStatus) {
                DOM.orderModeStatus.textContent = '✓ Saved';
                setTimeout(() => { if (DOM.orderModeStatus) DOM.orderModeStatus.textContent = ''; }, 2500);
            }
        } catch (err) {
            showToast('Failed to save: ' + (err.message || err), 'error');
            if (DOM.orderModeStatus) DOM.orderModeStatus.textContent = '✗ Error';
        }
    }

// ─── SETTINGS PAGE BINDINGS ─────────────────────────────
    function bindSettingsControls() {
        // Marquee controls
        DOM.marqueeGlowIntensity?.addEventListener('input', function() {
            document.getElementById('glowIntensityLabel').textContent = this.value + 'px';
            admin.updateMarqueePreview();
        });
        DOM.marqueeSpeed?.addEventListener('input', function() {
            document.getElementById('speedLabel').textContent = this.value + 's';
            admin.updateMarqueePreview();
        });
        DOM.marqueeEnabled?.addEventListener('change', admin.updateMarqueePreview);
        DOM.marqueeGlow?.addEventListener('change', admin.updateMarqueePreview);
        DOM.marqueeGlowColor?.addEventListener('input', admin.updateMarqueePreview);
        DOM.marqueeBorderGlow?.addEventListener('change', admin.updateMarqueePreview);
        DOM.marqueeBorderColor?.addEventListener('input', admin.updateMarqueePreview);
        DOM.marqueeBgColor?.addEventListener('input', admin.updateMarqueePreview);
        DOM.marqueeTextColor?.addEventListener('input', admin.updateMarqueePreview);
        DOM.marqueeInput?.addEventListener('input', admin.updateMarqueePreview);

        DOM.saveMarqueeBtn?.addEventListener('click', admin.saveMarqueeSettings);
        DOM.resetMarqueeBtn?.addEventListener('click', admin.resetMarqueeToDefault);
        DOM.previewMarqueeBtn?.addEventListener('click', () => {
            admin.updateMarqueePreview();
            showToast('Preview updated!', 'info');
        });

        // Hero banner controls
        DOM.heroAutoplay?.addEventListener('input', admin.updateHeroAutoplayLabel);
        DOM.heroEnabled?.addEventListener('change', admin.toggleHeroSetting);
        DOM.saveHeroBtn?.addEventListener('click', admin.saveHeroSettings);
        DOM.resetHeroBtn?.addEventListener('click', admin.resetHeroSettings);
        DOM.heroAddSlide?.addEventListener('click', () => {
            admin.addHeroSlide();
        });

        // Flash sale controls
        DOM.flashAutoplay?.addEventListener('input', admin.updateFlashAutoplayLabel);
        DOM.flashEnabled?.addEventListener('change', admin.populateFlashProductSelect);
        DOM.saveFlashBtn?.addEventListener('click', admin.saveFlashSettings);
        DOM.resetFlashBtn?.addEventListener('click', admin.resetFlashSettings);
        DOM.flashProductSelect?.addEventListener('change', admin.recordFlashSelection);

        // Messenger / chat support
        DOM.saveMessengerBtn?.addEventListener('click', admin.saveMessengerSettings);
        // Social media links
        DOM.saveSocialBtn?.addEventListener('click', admin.saveSocialSettings);

        // Header & footer color (picker + HEX, per color mode)
        admin.bindHfModePair('light');
        admin.bindHfModePair('dark');
        DOM.saveHfBtn?.addEventListener('click', admin.saveHfColors);
        DOM.resetHfBtn?.addEventListener('click', admin.resetHfColors);

        // Customer order mode
        DOM.orderModeSelect?.addEventListener('change', () =>
            renderOrderModeUI(DOM.orderModeSelect.value));
        DOM.saveOrderModeBtn?.addEventListener('click', admin.saveOrderModeSettings);

        // Store profile
        DOM.saveStoreBtn?.addEventListener('click', admin.saveStoreSettings);

        // Categories
        DOM.addCatBtn?.addEventListener('click', admin.addCategory);
        DOM.catLabel?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); admin.addCategory(); }
        });

        // Image upload key
        DOM.saveImgbbBtn?.addEventListener('click', admin.saveImgbbKey);

        // Admin access
        DOM.addAdminBtn?.addEventListener('click', admin.addAdmin);
        DOM.adminEmail?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); admin.addAdmin(); }
        });
    }

    function bindThemeSettings() {
        admin.loadPrefs();

        // Theme preset / custom colors
        DOM.themePresets?.addEventListener('click', e => {
            const btn = e.target.closest('.theme-preset');
            if (!btn) return;
            setActivePreset(btn.dataset.preset);
        });
        DOM.saveThemeBtn?.addEventListener('click', saveThemeSettings);
        DOM.resetThemeBtn?.addEventListener('click', resetThemeSettings);

        // Admin preference toggles
        DOM.settingsDarkMode?.addEventListener('change', () => {
            admin.setPrefs({ dark: DOM.settingsDarkMode.checked, autoDark: false });
            if (DOM.settingsAutoDark) DOM.settingsAutoDark.checked = false;
        });
        DOM.settingsAutoDark?.addEventListener('change', () => {
            const dark = document.documentElement.getAttribute('data-theme') === 'dark';
            admin.setPrefs({ autoDark: DOM.settingsAutoDark.checked, dark: DOM.settingsAutoDark.checked ? null : dark });
        });
        DOM.settingsAnimations?.addEventListener('change', () => admin.setPrefs({ animations: DOM.settingsAnimations.checked }));
        DOM.settingsCompact?.addEventListener('change', () => admin.setPrefs({ compact: DOM.settingsCompact.checked }));
        DOM.settingsAutoSave?.addEventListener('change', () => {
            admin.setPrefs({ autoSave: DOM.settingsAutoSave.checked });
            if (!DOM.settingsAutoSave.checked) admin.clearDraft();
            showToast('Auto-save ' + (DOM.settingsAutoSave.checked ? 'enabled' : 'disabled'), 'info');
        });

        admin.bindAutoSave();
    }

    // ─── STORE PROFILE (site_name / site_tagline / footer_note) ──
    // Shown on every public page via js/core/site.js. Fully admin-editable.
    const STORE_KEYS = ['site_name', 'site_tagline', 'footer_note'];
    const STORE_DEFAULTS = {
        site_name: 'E-Shop Demo',
        site_tagline: 'Quality demo products for everyday life.',
        footer_note: '© 2026 E-Shop Demo · Demo portfolio project — no real orders are fulfilled.'
    };

    async function loadStoreSettings() {
        if (!DOM.siteName) return;
        try {
            const cached = JSON.parse(localStorage.getItem('eshop_site_profile') || 'null');
            if (cached) {
                DOM.siteName.value = cached.site_name || '';
                DOM.siteTagline.value = cached.site_tagline || '';
                DOM.siteFooterNote.value = cached.footer_note || '';
            }
        } catch (_) { /* noop */ }
        try {
            const { data, error } = await STATE.supabase.from('settings').select('*').in('key', STORE_KEYS);
            if (error) throw error;
            const map = {};
            (data || []).forEach(row => { map[row.key] = row.value; });
            if (map.site_name) DOM.siteName.value = map.site_name;
            if (map.site_tagline) DOM.siteTagline.value = map.site_tagline;
            if (map.footer_note) DOM.siteFooterNote.value = map.footer_note;
        } catch (err) {
            showToast('Failed to load store profile: ' + (err.message || err), 'error');
        }
    }

    async function saveStoreSettings() {
        const name = (DOM.siteName.value || '').trim().slice(0, 60) || STORE_DEFAULTS.site_name;
        const tagline = (DOM.siteTagline.value || '').trim().slice(0, 140) || STORE_DEFAULTS.site_tagline;
        const footer = (DOM.siteFooterNote.value || '').trim().slice(0, 200) || STORE_DEFAULTS.footer_note;
        const settings = [
            { key: 'site_name', value: name },
            { key: 'site_tagline', value: tagline },
            { key: 'footer_note', value: footer }
        ];
        if (DOM.storeStatus) DOM.storeStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            try { localStorage.setItem('eshop_site_profile', JSON.stringify({ site_name: name, site_tagline: tagline, footer_note: footer })); } catch (_) { /* noop */ }
            showToast('Store profile saved! The website updates automatically.', 'success');
            if (DOM.storeStatus) {
                DOM.storeStatus.textContent = '✓ Saved';
                setTimeout(() => { if (DOM.storeStatus) DOM.storeStatus.textContent = ''; }, 2500);
            }
        } catch (err) {
            showToast('Failed to save: ' + (err.message || err), 'error');
            if (DOM.storeStatus) DOM.storeStatus.textContent = '✗ Error';
        }
    }

    // ─── CATEGORIES (admin-managed `categories` table) ─────────
    function slugifyCat(value) {
        return String(value || '').trim().toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    }

    function renderCatList(rows) {
        if (!DOM.catList) return;
        if (!rows || !rows.length) {
            DOM.catList.innerHTML = '<span style="font-size:0.8rem; color:var(--text-secondary);">No managed categories yet — the site uses product categories automatically.</span>';
            return;
        }
        DOM.catList.innerHTML = rows.map(r =>
            '<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border); border-radius:8px;">' +
            '<strong style="flex:1; font-size:0.85rem;">' + escapeHTML(r.label) + '</strong>' +
            '<code style="font-size:0.75rem; color:var(--text-secondary);">' + escapeHTML(r.slug) + '</code>' +
            '<button type="button" class="button button-secondary del-cat" data-slug="' + escapeHTML(r.slug) + '" style="padding:4px 10px; font-size:0.75rem;">Delete</button>' +
            '</div>'
        ).join('');
        DOM.catList.querySelectorAll('.del-cat').forEach(btn => {
            btn.addEventListener('click', () => deleteCategory(btn.dataset.slug));
        });
    }

    async function loadCategories() {
        if (!DOM.catList) return;
        try {
            const { data, error } = await STATE.supabase
                .from('categories')
                .select('slug,label,sort_order')
                .order('sort_order', { ascending: true })
                .order('label', { ascending: true });
            if (error) throw error;
            renderCatList(data || []);
        } catch (err) {
            renderCatList([]);
            if (DOM.catsStatus) {
                DOM.catsStatus.textContent = 'Categories table missing — run eshop-demo-setup.sql';
                setTimeout(() => { if (DOM.catsStatus) DOM.catsStatus.textContent = ''; }, 4000);
            }
        }
    }

    async function addCategory() {
        const label = (DOM.catLabel.value || '').trim().slice(0, 40);
        if (!label) { showToast('Type a category label first.', 'warning'); return; }
        const slug = slugifyCat(label);
        if (!slug) { showToast('Could not make a URL slug from that label.', 'warning'); return; }
        if (DOM.catsStatus) DOM.catsStatus.textContent = 'Saving...';
        try {
            const { data: existing } = await STATE.supabase
                .from('categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
            const nextOrder = (existing && existing[0] && Number(existing[0].sort_order) + 1) || 0;
            const { error } = await STATE.supabase
                .from('categories').upsert([{ slug, label, sort_order: nextOrder, active: true }], { onConflict: 'slug' });
            if (error) throw error;
            DOM.catLabel.value = '';
            showToast('Category added!', 'success');
            if (DOM.catsStatus) {
                DOM.catsStatus.textContent = '✓ Saved';
                setTimeout(() => { if (DOM.catsStatus) DOM.catsStatus.textContent = ''; }, 2000);
            }
            loadCategories();
        } catch (err) {
            showToast('Failed to add category: ' + (err.message || err), 'error');
            if (DOM.catsStatus) DOM.catsStatus.textContent = '✗ Error';
        }
    }

    async function deleteCategory(slug) {
        try {
            const { error } = await STATE.supabase.from('categories').delete().eq('slug', slug);
            if (error) throw error;
            showToast('Category deleted.', 'info');
            loadCategories();
        } catch (err) {
            showToast('Failed to delete: ' + (err.message || err), 'error');
        }
    }

    // ─── IMAGE UPLOAD KEY (shared via settings, never in code) ──
    async function loadImgbbKey() {
        if (!DOM.imgbbKey) return;
        try { DOM.imgbbKey.value = localStorage.getItem('eshop_imgbb_key') || ''; } catch (_) { /* noop */ }
        try {
            const { data, error } = await STATE.supabase.from('settings').select('value').eq('key', 'imgbb_key').maybeSingle();
            if (!error && data && data.value) {
                DOM.imgbbKey.value = data.value;
                try { localStorage.setItem('eshop_imgbb_key', data.value); } catch (_) { /* noop */ }
            }
        } catch (_) { /* keep local value */ }
    }

    async function saveImgbbKey() {
        const key = (DOM.imgbbKey.value || '').trim();
        if (!key) { showToast('Paste an ImgBB API key first.', 'warning'); return; }
        if (DOM.imgbbStatus) DOM.imgbbStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert([{ key: 'imgbb_key', value: key }], { onConflict: 'key' });
            if (error) throw error;
            try { localStorage.setItem('eshop_imgbb_key', key); } catch (_) { /* noop */ }
            showToast('Upload key saved!', 'success');
            if (DOM.imgbbStatus) {
                DOM.imgbbStatus.textContent = '✓ Saved';
                setTimeout(() => { if (DOM.imgbbStatus) DOM.imgbbStatus.textContent = ''; }, 2500);
            }
        } catch (err) {
            showToast('Failed to save: ' + (err.message || err), 'error');
            if (DOM.imgbbStatus) DOM.imgbbStatus.textContent = '✗ Error';
        }
    }

    // ─── ADMIN ACCESS (`admin_users` allow-list) ───────────────
    const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

    function renderAdminList(rows) {
        if (!DOM.adminList) return;
        if (!rows || !rows.length) {
            DOM.adminList.innerHTML = '<span style="font-size:0.8rem; color:var(--text-secondary);">No admins listed (or table missing). Run eshop-demo-setup.sql, then add your login email here.</span>';
            return;
        }
        DOM.adminList.innerHTML = rows.map(r =>
            '<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border); border-radius:8px;">' +
            '<span style="flex:1; font-size:0.85rem;">' + escapeHTML(r.email) + '</span>' +
            '<button type="button" class="button button-secondary del-admin" data-email="' + escapeHTML(r.email) + '" style="padding:4px 10px; font-size:0.75rem;">Remove</button>' +
            '</div>'
        ).join('');
        DOM.adminList.querySelectorAll('.del-admin').forEach(btn => {
            btn.addEventListener('click', () => removeAdmin(btn.dataset.email));
        });
    }

    async function loadAdmins() {
        if (!DOM.adminList) return;
        try {
            const { data, error } = await STATE.supabase.from('admin_users').select('email').order('email');
            if (error) throw error;
            renderAdminList(data || []);
        } catch (_) {
            renderAdminList([]);
        }
    }

    async function addAdmin() {
        const email = (DOM.adminEmail.value || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) { showToast('Enter a valid email address.', 'warning'); return; }
        if (DOM.adminsStatus) DOM.adminsStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('admin_users').upsert([{ email }], { onConflict: 'email' });
            if (error) throw error;
            DOM.adminEmail.value = '';
            showToast('Admin added!', 'success');
            if (DOM.adminsStatus) {
                DOM.adminsStatus.textContent = '✓ Saved';
                setTimeout(() => { if (DOM.adminsStatus) DOM.adminsStatus.textContent = ''; }, 2000);
            }
            loadAdmins();
        } catch (err) {
            showToast('Failed to add admin: ' + (err.message || err), 'error');
            if (DOM.adminsStatus) DOM.adminsStatus.textContent = '✗ Error';
        }
    }

    async function removeAdmin(email) {
        try {
            const { error } = await STATE.supabase.from('admin_users').delete().eq('email', email);
            if (error) throw error;
            showToast('Admin removed.', 'info');
            loadAdmins();
        } catch (err) {
            showToast('Failed to remove: ' + (err.message || err), 'error');
        }
    }

    Object.assign(admin, {
        loadMarqueeSettings, saveMarqueeSettings, resetMarqueeToDefault, updateMarqueePreview,
        loadThemeSettings, saveThemeSettings, resetThemeSettings,
        loadHfColors, saveHfColors, resetHfColors, bindHfModePair,
        loadFlashSettings, saveFlashSettings, resetFlashSettings,
        populateFlashProductSelect, updateFlashAutoplayLabel, recordFlashSelection,
        loadHeroSettings, saveHeroSettings, resetHeroSettings, toggleHeroSetting, addHeroSlide, updateHeroAutoplayLabel,
        loadMessengerSettings, saveMessengerSettings,
        loadSocialSettings, saveSocialSettings,
        loadOrderModeSettings, saveOrderModeSettings,
        loadStoreSettings, saveStoreSettings,
        loadCategories, addCategory, deleteCategory,
        loadImgbbKey, saveImgbbKey,
        loadAdmins, addAdmin, removeAdmin,
        bindSettingsControls, bindThemeSettings
    });

})();