/* ─── ADMIN SETTINGS: homepage marquee controls ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, showToast, escapeHTML } = admin;

    const DEFAULT_MARQUEE_TEXT = '🚚 Free delivery all over Bangladesh &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🎁 Free gift wrapping &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; ↩️ 7-day easy return &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🔒 Secure checkout';

    async function loadMarqueeSettings() {
        try {
            const { data, error } = await STATE.supabase
                .from('settings')
                .select('*')
                .in('key', [
                    'marquee_text', 'marquee_enabled', 'marquee_glow_color',
                    'marquee_glow_intensity', 'marquee_border_glow', 'marquee_border_color',
                    'marquee_speed', 'marquee_bg_color', 'marquee_text_color'
                ]);
            if (error) throw error;

            const settings = {};
            data.forEach(row => { settings[row.key] = row.value; });

            DOM.marqueeInput.value = settings.marquee_text || DEFAULT_MARQUEE_TEXT;
            DOM.marqueeEnabled.checked = settings.marquee_enabled !== 'false';
            DOM.marqueeGlow.checked = true;
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
                localStorage.setItem('grabby_' + s.key, s.value);
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
            settings.forEach(s => { localStorage.setItem('grabby_' + s.key, s.value); });
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
        const customColors = preset === 'custom' ? readCustomTheme() : {};

        const settings = [{ key: 'theme_preset', value: preset }];
        if (preset === 'custom') {
            SITE_COLOR_KEYS.forEach(({ key }) =>
                settings.push({ key: 'theme_' + key, value: customColors[key] })
            );
        }

        DOM.themeStatus.textContent = 'Saving...';
        try {
            const { error } = await STATE.supabase.from('settings').upsert(settings, { onConflict: 'key' });
            if (error) throw error;
            localStorage.setItem('grabby_site_colors', JSON.stringify({ preset, colors: customColors }));
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

    // ─── ADMIN PREFERENCE TOGGLES (Dark / Auto-dark / Animations / Compact / Auto-Save) ───
    const PREFS_KEY = 'grabby_admin_settings';
    const DRAFT_KEY = 'grabby_admin_product_draft';
    const DEFAULT_PREFS = { dark: null, autoDark: false, animations: true, compact: false, autoSave: true };
    let prefs = Object.assign({}, DEFAULT_PREFS);

    function loadPrefs() {
        try {
            const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
            prefs = Object.assign({}, DEFAULT_PREFS, saved);
        } catch {
            prefs = Object.assign({}, DEFAULT_PREFS);
        }
    }

    function savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* noop */ }
    }

    function updateThemeToggleUI(dark) {
        const t = DOM.themeToggle;
        if (!t) return;
        const icon = t.querySelector('.theme-icon');
        const label = t.querySelector('.theme-label');
        if (icon) icon.textContent = dark ? '☀️' : '🌙';
        if (label) label.textContent = dark ? 'Light' : 'Dark';
    }

    function setAdminDark(dark) {
        const root = document.documentElement;
        if (dark) root.setAttribute('data-theme', 'dark');
        else root.removeAttribute('data-theme');
        try { localStorage.setItem('grabby_theme', dark ? 'dark' : 'light'); } catch { /* noop */ }
        updateThemeToggleUI(dark);
        if (DOM.settingsDarkMode) DOM.settingsDarkMode.checked = !!dark;
        if (DOM.settingsAutoDark) DOM.settingsAutoDark.checked = !!prefs.autoDark;
    }

    function applyDarkFromPrefs() {
        if (prefs.autoDark) {
            setAdminDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
            return;
        }
        if (prefs.dark === null || typeof prefs.dark === 'undefined') {
            setAdminDark(document.documentElement.getAttribute('data-theme') === 'dark');
            return;
        }
        setAdminDark(!!prefs.dark);
    }

    function applyMotionPref() {
        document.documentElement.classList.toggle('reduce-motion', !prefs.animations);
    }

    function applyCompactPref() {
        document.body.classList.toggle('admin-compact', !!prefs.compact);
    }

    function applyPrefsAll() {
        if (DOM.settingsAnimations) DOM.settingsAnimations.checked = prefs.animations;
        if (DOM.settingsCompact) DOM.settingsCompact.checked = prefs.compact;
        if (DOM.settingsAutoSave) DOM.settingsAutoSave.checked = prefs.autoSave;
        applyDarkFromPrefs();
        applyMotionPref();
        applyCompactPref();
    }

    // ─── NEW-PRODUCT AUTOSAVE DRAFT ─────────────────────────
    function saveDraft() {
        if (!prefs.autoSave) return;
        if (DOM.editId && DOM.editId.value) return;
        const draft = {
            title: DOM.prodTitle.value,
            category: DOM.prodCategory.value,
            brand: DOM.prodBrand.value,
            price: DOM.prodPrice.value,
            original: DOM.prodOriginal.value,
            badge: DOM.prodBadge.value,
            sold: DOM.prodSold.value,
            rating: DOM.prodRating.value,
            reviews: DOM.prodReviews.value,
            inStock: DOM.prodInStock.checked,
            shortDesc: DOM.prodShortDesc.value,
            fullDesc: DOM.prodFullDesc.value
        };
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* noop */ }
    }

    function clearDraft() {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    }

    function restoreDraft() {
        if (!prefs.autoSave) return;
        if (DOM.editId && DOM.editId.value) return;
        let draft = null;
        try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { draft = null; }
        if (!draft) return;
        DOM.prodTitle.value = draft.title || '';
        DOM.prodCategory.value = draft.category || '';
        DOM.prodBrand.value = draft.brand || '';
        DOM.prodPrice.value = draft.price || '';
        DOM.prodOriginal.value = draft.original || '';
        DOM.prodBadge.value = draft.badge || '';
        DOM.prodSold.value = draft.sold || '';
        DOM.prodRating.value = draft.rating || '';
        DOM.prodReviews.value = draft.reviews || '';
        DOM.prodInStock.checked = draft.inStock !== false;
        DOM.prodShortDesc.value = draft.shortDesc || '';
        DOM.prodFullDesc.value = draft.fullDesc || '';
        showToast('Draft restored — finish filling it in and save.', 'info');
    }

    const debouncedDraftSave = admin.debounce(saveDraft, 800);

    function onFormValue() {
        if (prefs.autoSave && DOM.editId && !DOM.editId.value) debouncedDraftSave();
    }

    function bindAutoSave() {
        DOM.productForm?.addEventListener('input', onFormValue);
        DOM.productForm?.addEventListener('change', onFormValue);
    }

    let prefsBound = false;

    function bindPrefsEvents() {
        if (prefsBound) return;
        prefsBound = true;

        DOM.settingsDarkMode?.addEventListener('change', () => {
            prefs.dark = DOM.settingsDarkMode.checked;
            prefs.autoDark = false;
            savePrefs();
            setAdminDark(prefs.dark);
            if (DOM.settingsAutoDark) DOM.settingsAutoDark.checked = false;
        });

        DOM.settingsAutoDark?.addEventListener('change', () => {
            prefs.autoDark = DOM.settingsAutoDark.checked;
            prefs.dark = prefs.autoDark ? null : (document.documentElement.getAttribute('data-theme') === 'dark');
            savePrefs();
            applyDarkFromPrefs();
        });

        DOM.settingsAnimations?.addEventListener('change', () => {
            prefs.animations = DOM.settingsAnimations.checked;
            savePrefs();
            applyMotionPref();
        });

        DOM.settingsCompact?.addEventListener('change', () => {
            prefs.compact = DOM.settingsCompact.checked;
            savePrefs();
            applyCompactPref();
        });

        DOM.settingsAutoSave?.addEventListener('change', () => {
            prefs.autoSave = DOM.settingsAutoSave.checked;
            savePrefs();
            if (!prefs.autoSave) clearDraft();
            showToast('Auto-save ' + (prefs.autoSave ? 'enabled' : 'disabled'), 'info');
        });

        // Keep prefs in sync when the header dark/light toggle is used.
        DOM.themeToggle?.addEventListener('click', () => {
            prefs.autoDark = false;
            prefs.dark = document.documentElement.getAttribute('data-theme') === 'dark';
            savePrefs();
            setAdminDark(prefs.dark);
        });

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onSystemChange = () => { if (prefs.autoDark) applyDarkFromPrefs(); };
        if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
        else if (mq.addListener) mq.addListener(onSystemChange);

        // Restore the pending new-product draft when opening a fresh Add form.
        document.querySelectorAll('.admin-nav a[data-section="add"]').forEach(link =>
            link.addEventListener('click', () => { if (prefs.autoSave) restoreDraft(); })
        );

        bindAutoSave();
    }

    function bindThemeSettings() {
        loadPrefs();
        DOM.themePresets?.addEventListener('click', e => {
            const btn = e.target.closest('.theme-preset');
            if (!btn) return;
            setActivePreset(btn.dataset.preset);
        });
        DOM.saveThemeBtn?.addEventListener('click', saveThemeSettings);
        DOM.resetThemeBtn?.addEventListener('click', resetThemeSettings);
        bindPrefsEvents();
        applyPrefsAll();
    }

    Object.assign(admin, {
        loadPrefs, applyPrefsAll, applyDarkFromPrefs, saveDraft, clearDraft, restoreDraft,
        loadMarqueeSettings, saveMarqueeSettings, resetMarqueeToDefault, updateMarqueePreview,
        loadThemeSettings, saveThemeSettings, resetThemeSettings, bindThemeSettings,
        loadFlashSettings, saveFlashSettings, resetFlashSettings,
        populateFlashProductSelect, updateFlashAutoplayLabel, recordFlashSelection
    });

})();