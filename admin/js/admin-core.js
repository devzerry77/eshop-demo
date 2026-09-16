/* ─── ADMIN CORE: constants, state, DOM cache, toast, utils, theme, auth, lightbox ─── */
(() => {

    "use strict";

    const admin = window.admin = window.admin || {};

    // Credentials resolve from window.ESHOP_* (js/supabase/supabase-config.js
    // or git-ignored overrides). The anon key is public by design — NEVER
    // put the service_role key in frontend code or this repo.
    const SUPABASE_URL = (typeof window !== 'undefined' && window.ESHOP_SUPABASE_URL) || "https://qjbttdimbnurqslknwvn.supabase.co";
    const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.ESHOP_SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqYnR0ZGltYm51cnFzbGtud3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NzA1OTEsImV4cCI6MjEwNTE0NjU5MX0.KNI5wt5I2mRmBWJRlfsIi0nbWPk9aC3BQ2oTHKe18xQ";

    // Image-upload key is NOT hardcoded: window.ESHOP_IMGBB_KEY or
    // localStorage 'eshop_imgbb_key' (Admin → Settings → Image Uploads).
    function getImgBBKey() {
        try {
            if (typeof window !== 'undefined' && window.ESHOP_IMGBB_KEY) return window.ESHOP_IMGBB_KEY;
            return localStorage.getItem('eshop_imgbb_key') || '';
        } catch (_) { return ''; }
    }

    const STATE = {
        products: [],
        allProducts: [],
        page: 1,
        pageSize: 10,
        query: "",
        deleteId: null,
        supabase: null,
        loggedIn: false,
        busy: false,
        deleting: false,
        initialized: false,
        timeout: null,
        lastActivity: Date.now(),
        sessionLimit: 30 * 60 * 1000,
        // Orders (new)
        orders: [],
        orderPage: 1,
        orderPageSize: 8,
        orderQuery: "",
        orderStatus: "all",
        loadingOrders: false,
        // Payments (new)
        paymentMethods: [],
        editingPayment: null,
        savingPayment: false
    };

    const DOM = {};
    const $ = id => document.getElementById(id);
    const $$ = selector => [...document.querySelectorAll(selector)];

    // ─── TOAST ─────────────────────────────────────────────
    function showToast(message, type = "info", duration = 3000) {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || "ℹ️"}</span>
            <span class="toast-message">${message}</span>
            <span class="toast-close">✕</span>
            <div class="toast-progress"></div>
        `;
        toast.querySelector(".toast-close").addEventListener("click", () => {
            toast.classList.add("out");
            setTimeout(() => toast.remove(), 300);
        });
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add("out");
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function cacheDOM() {
        [
            "loginOverlay", "loginForm", "loginEmail", "loginPassword", "loginBtn",
            "loginError", "loginRateLimit", "togglePassword", "adminLayout",
            "adminSidebar", "sidebarBackdrop", "adminMobileToggle", "pageTitle",
            "statsGrid", "statVisits", "statLive", "statCartAdds", "statProducts",
            "statCartCard", "liveTrend", "productTrend",
            // Order stats (new)
            "statTotalOrders", "statTodayOrders", "statRevenue", "statPendingOrders", "statDeliveredOrders",
            "todayOrdersTrend",
            "addSection", "productsSection", "activitySection",
            // Orders (new)
            "ordersSection", "orderStatusFilter", "orderSearchInput", "ordersTableBody",
            "ordersPagination", "exportOrdersBtn",
            // Payments (new)
            "paymentSection", "paymentMethodsAdmin", "addPaymentBtn", "paymentFormArea",
            "pmId", "pmFormTitle", "pmName", "pmType", "pmNumber", "pmMerchant", "pmEmail",
            "pmAccount", "pmInstructions", "pmQr", "pmFee", "pmOrder", "pmEnabled", "pmStatus",
            "savePaymentBtn", "cancelPaymentBtn",
            "productForm", "editId", "prodTitle", "prodCategory",
            "prodBrand", "prodPrice", "prodOriginal", "prodBadge", "prodSold",
            "prodRating", "prodReviews", "prodStock", "prodInStock", "prodShortDesc", "prodFullDesc",
            "descPreview", "toggleDescPreview", "specsContainer", "addSpecBtn",
            "sectionsContainer", "addSectionBtn", "imageInputsWrapper", "addImageBtn",
            "addMediaBtn", "imageGalleryPreview", "relatedProductsSelect", "formTitle",
            "topSaveBtn", "cancelEdit", "formResetButton", "adminProductsTable", "adminSearch",
            "adminPagination", "activityTableBody", "clearActivityBtn", "confirmOverlay",
            "confirmYes", "confirmNo", "imageLightbox", "lightboxImg", "lightboxClose",
            "aiChatPanel", "aiChatToggle", "aiChatClose", "aiChatClear", "aiChatSend",
            "aiChatInput", "aiChatMessages", "toast", "refreshStats", "logoutBtn",
            "exportProductsBtn", "themeToggle", "sidebarClose",
            // Settings
            "settingsDarkMode", "settingsAutoDark", "settingsAnimations", "settingsCompact", "settingsAutoSave",
            "marqueeInput", "marqueeEnabled", "marqueeGlow", "marqueeGlowColor", "marqueeGlowIntensity",
            "marqueeBorderGlow", "marqueeBorderColor", "marqueeSpeed", "marqueeBgColor", "marqueeTextColor",
            "saveMarqueeBtn", "resetMarqueeBtn", "previewMarqueeBtn", "marqueeStatus",
            "marqueePreview", "marqueePreviewContainer",
            // Site theme (new)
            "themePresets", "themeCustomFields",
            "themeBg", "themeCard", "themeSecondary", "themeText", "themeTextSecondary",
            "themeBorder", "themeAccent", "themeHeaderBg", "themeHeaderText",
            "saveThemeBtn", "resetThemeBtn", "themeStatus",
            // Header & footer color (new)
            "hfPickerLight", "hfHexLight", "hfSwatchLight", "hfCurrentLight",
            "hfPickerDark", "hfHexDark", "hfSwatchDark", "hfCurrentDark",
            "saveHfBtn", "resetHfBtn", "hfStatus",
            // Hero banners (new)
            "heroEnabled", "heroTitle", "heroAutoplay", "heroAutoplayLabel",
            "heroAddSlide", "heroSlidesList", "saveHeroBtn", "resetHeroBtn", "heroStatus",
            // Flash sale (new)
            "flashEnabled", "flashTitle", "flashSubtitle", "flashBadge",
            "flashProductSelect", "flashAutoplay", "flashAutoplayLabel",
            "flashPerView", "flashDuration", "flashAccent",
            "saveFlashBtn", "resetFlashBtn", "flashStatus",
            // Messenger / chat support (new)
            "messengerLink", "messengerStatus", "saveMessengerBtn",
            "socialFacebook", "socialInstagram", "socialYouTube", "socialTiktok", "socialX",
            "saveSocialBtn", "socialStatus",
            // Customer order mode (new)
            "orderModeSelect", "orderModeCurrent", "saveOrderModeBtn", "orderModeStatus",
            // Store profile / categories / uploads / admin access (new)
            "siteName", "siteTagline", "siteFooterNote", "saveStoreBtn", "storeStatus",
            "catList", "catLabel", "addCatBtn", "catsStatus",
            "imgbbKey", "saveImgbbBtn", "imgbbStatus",
            "adminList", "adminEmail", "addAdminBtn", "adminsStatus"
        ].forEach(id => DOM[id] = $(id));
    }

    function escapeHTML(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    function formatPrice(value) {
        return "৳ " + Math.round(Number(value) || 0).toLocaleString("bn-BD");
    }

    function debounce(callback, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => callback(...args), delay);
        };
    }

    // ─── YOUTUBE HELPERS ──────────────────────────────────
    function isYouTubeUrl(url) {
        if (!url) return false;
        return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([^&\s]+)/.test(url);
    }

    function getYouTubeThumbnail(url) {
        const videoId = extractYouTubeId(url);
        return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
    }

    function extractYouTubeId(url) {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([^&\s]+)/);
        return match ? match[1] : null;
    }

    function getYouTubeEmbedUrl(url) {
        const id = extractYouTubeId(url);
        return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    function isValidUrl(string) {
        try { new URL(string); return true; } catch { return false; }
    }

    // ─── IMGBB UPLOAD ──────────────────────────────────
    async function uploadToImgBB(file) {
        const key = getImgBBKey();
        if (!key) {
            throw new Error('Image upload key not configured. Set it in Admin → Settings → Image Uploads.');
        }
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key), {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            throw new Error(`ImgBB upload failed: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(`ImgBB error: ${data.error?.message || 'Unknown error'}`);
        }
        return data.data.url;
    }

    // ─── THEME ─────────────────────────────────────────────
    function loadTheme() {
        const saved = localStorage.getItem('eshop_theme');
        const themeToggle = DOM.themeToggle;
        if (saved === 'light') {
            document.documentElement.removeAttribute('data-theme');
            if (themeToggle) {
                themeToggle.querySelector('.theme-icon').textContent = '🌙';
                themeToggle.querySelector('.theme-label').textContent = 'Dark';
            }
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeToggle) {
                themeToggle.querySelector('.theme-icon').textContent = '☀️';
                themeToggle.querySelector('.theme-label').textContent = 'Light';
            }
            if (!saved) localStorage.setItem('eshop_theme', 'dark');
        }
    }

    function toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const themeToggle = DOM.themeToggle;
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('eshop_theme', 'light');
            if (themeToggle) {
                themeToggle.querySelector('.theme-icon').textContent = '🌙';
                themeToggle.querySelector('.theme-label').textContent = 'Dark';
            }
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('eshop_theme', 'dark');
            if (themeToggle) {
                themeToggle.querySelector('.theme-icon').textContent = '☀️';
                themeToggle.querySelector('.theme-label').textContent = 'Light';
            }
        }
    }

    // ─── ADMIN PREFS (shared across all pages) ─────────────
    const PREFS_KEY = 'eshop_admin_settings';
    const DRAFT_KEY = 'eshop_admin_product_draft';
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
        try { localStorage.setItem('eshop_theme', dark ? 'dark' : 'light'); } catch { /* noop */ }
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

    function setPrefs(patch) {
        loadPrefs();
        Object.assign(prefs, patch);
        savePrefs();
        applyPrefsAll();
    }

    function syncPrefsFromThemeToggle() {
        prefs.autoDark = false;
        prefs.dark = document.documentElement.getAttribute('data-theme') === 'dark';
        savePrefs();
        setAdminDark(prefs.dark);
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
            stock: DOM.prodStock.value,
            inStock: DOM.prodInStock.checked,
            shortDesc: DOM.prodShortDesc.value,
            fullDesc: DOM.prodFullDesc.value
        };
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* noop */ }
    }

    function clearDraft() {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    }

    // Read-only accessor for the Drafted Products page (same draft system).
    function getProductDraft() {
        try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; }
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
        DOM.prodStock.value = draft.stock || '';
        DOM.prodInStock.checked = draft.inStock !== false;
        DOM.prodShortDesc.value = draft.shortDesc || '';
        DOM.prodFullDesc.value = draft.fullDesc || '';
        showToast('Draft restored — finish filling it in and save.', 'info');
    }

    const debouncedDraftSave = (() => {
        let timer;
        return () => { clearTimeout(timer); timer = setTimeout(saveDraft, 800); };
    })();

    function onFormValue() {
        if (prefs.autoSave && DOM.editId && !DOM.editId.value) debouncedDraftSave();
    }

    function bindAutoSave() {
        DOM.productForm?.addEventListener('input', onFormValue);
        DOM.productForm?.addEventListener('change', onFormValue);
    }

    // ─── AUTH ──────────────────────────────────────────────
    function initSupabase() {
        if (!window.supabase || !window.supabase.createClient) return false;
        STATE.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }

    // Demo credentials shown on the login panel (portfolio demo only).
    // NOTE: this user must exist in Supabase Dashboard → Authentication → Users.
    // Create: admin@eshop.demo / Demo123! (auto-confirm email), then allow-list it:
    //   INSERT INTO public.admin_users (email) VALUES ('admin@eshop.demo')
    //   ON CONFLICT (email) DO NOTHING;
    const DEMO_ADMIN_EMAIL = "admin@eshop.demo";
    const DEMO_ADMIN_PASSWORD = "Demo123!";

    function injectDemoCreds() {
        try {
            const card = document.querySelector(".login-card");
            if (!card || card.querySelector(".demo-creds")) return;
            const box = document.createElement("div");
            box.className = "demo-creds";
            box.innerHTML =
                '<strong>Demo access</strong>' +
                '<div class="demo-creds-row"><span>Email: <code></code></span></div>' +
                '<div class="demo-creds-row"><span>Password: <code></code></span></div>' +
                '<button type="button" class="demo-fill-btn">Fill demo credentials</button>';
            box.querySelectorAll("code")[0].textContent = DEMO_ADMIN_EMAIL;
            box.querySelectorAll("code")[1].textContent = DEMO_ADMIN_PASSWORD;
            box.querySelector(".demo-fill-btn").addEventListener("click", () => {
                if (DOM.loginEmail) DOM.loginEmail.value = DEMO_ADMIN_EMAIL;
                if (DOM.loginPassword) DOM.loginPassword.value = DEMO_ADMIN_PASSWORD;
                if (DOM.loginError) DOM.loginError.classList.remove("show");
                DOM.loginEmail?.focus();
            });
            const footer = card.querySelector(".login-footer");
            if (footer) footer.before(box);
            else card.appendChild(box);
        } catch (_) { /* noop */ }
    }

    function showLogin() {
        STATE.loggedIn = false;
        DOM.loginOverlay?.classList.remove("hidden");
        DOM.adminLayout?.classList.remove("active");
        clearTimeout(STATE.timeout);
        injectDemoCreds();
    }

    function showAdmin() {
        STATE.loggedIn = true;
        DOM.loginOverlay?.classList.add("hidden");
        DOM.adminLayout?.classList.add("active");
        showToast("Welcome back!", "success");
        if (!STATE.initialized) {
            STATE.initialized = true;
            admin.pageInit && admin.pageInit();
        }
        resetSession();
    }

    async function checkSession() {
        const { data: { session } } = await STATE.supabase.auth.getSession();
        if (!session) { showLogin(); return; }
        const allowed = await isAdminUser(session.user);
        if (allowed) showAdmin();
        else {
            await STATE.supabase.auth.signOut();
            showLogin();
            if (DOM.loginError) {
                DOM.loginError.textContent = 'This account is not an admin. Ask the store owner to add it in Admin → Settings → Admin Access.';
                DOM.loginError.classList.add('show');
            }
            showToast('Not an admin account', 'error');
        }
    }

    // Admin allow-list backed by the `admin_users` table (see
    // eshop-demo-setup.sql). Backwards compatible: if the table does not
    // exist yet (or is empty), any signed-in user is allowed so existing
    // setups keep working until the setup SQL is run.
    async function isAdminUser(user) {
        if (!user || !user.email) return false;
        try {
            const { data, error } = await STATE.supabase
                .from('admin_users')
                .select('email')
                .eq('email', user.email)
                .maybeSingle();
            if (error) return true; // table missing → legacy open behavior
            if (data) return true;
            // Table exists: allow only listed emails, unless nobody is
            // listed yet (fresh setup → first login claims admin).
            const { data: any, error: err2 } = await STATE.supabase
                .from('admin_users')
                .select('email')
                .limit(1);
            if (err2) return true;
            return !any || !any.length;
        } catch (_) {
            return true;
        }
    }

    function initLogin() {
        injectDemoCreds();
        DOM.togglePassword?.addEventListener("click", () => {
            const isPassword = DOM.loginPassword.type === "password";
            DOM.loginPassword.type = isPassword ? "text" : "password";
            DOM.togglePassword.textContent = isPassword ? "Hide" : "Show";
        });

        DOM.loginForm?.addEventListener("submit", async event => {
            event.preventDefault();
            if (STATE.busy) return;
            const email = DOM.loginEmail.value.trim();
            const password = DOM.loginPassword.value;
            if (!email || !password) {
                DOM.loginError.textContent = "Please enter your email and password.";
                DOM.loginError.classList.add("show");
                return;
            }
            STATE.busy = true;
            DOM.loginBtn.disabled = true;
            DOM.loginBtn.querySelector(".button-label").textContent = "Signing in...";
            DOM.loginError.classList.remove("show");
            try {
                const { error } = await STATE.supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                await checkSession();
            } catch (error) {
                DOM.loginError.textContent = error.message || "Invalid login details.";
                DOM.loginError.classList.add("show");
            } finally {
                STATE.busy = false;
                DOM.loginBtn.disabled = false;
                DOM.loginBtn.querySelector(".button-label").textContent = "Sign in";
            }
        });
    }

    async function logout() {
        await STATE.supabase?.auth.signOut();
        STATE.initialized = false;
        STATE.products = [];
        showLogin();
        showToast("Signed out", "info");
    }

    function resetSession() {
        clearTimeout(STATE.timeout);
        STATE.lastActivity = Date.now();
        STATE.timeout = setTimeout(() => {
            if (Date.now() - STATE.lastActivity >= STATE.sessionLimit) logout();
            else resetSession();
        }, 60000);
    }

    // ─── LIGHTBOX ──────────────────────────────────────────
    function openLightbox(src) {
        if (!src) return;
        DOM.lightboxImg.src = src;
        DOM.imageLightbox.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
        DOM.imageLightbox.classList.remove("active");
        document.body.style.overflow = "";
    }

    // ─── EXPORT ─────────────────────────────────────────────
    function exportCSV(headers, rows, filename) {
        const csv = [headers.join(','), ...rows.map(r => r.map(cell => {
            const value = String(cell ?? '');
            return value.includes(',') || value.includes('"') || value.includes('\n')
                ? '"' + value.replace(/"/g, '""') + '"'
                : value;
        }).join(','))].join('\n');
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    }

    Object.assign(admin, {
        STATE, DOM, $, $$,
        showToast, cacheDOM, escapeHTML, formatPrice, debounce,
        isYouTubeUrl, extractYouTubeId, getYouTubeThumbnail, getYouTubeEmbedUrl, isValidUrl,
        uploadToImgBB, getImgBBKey,
        loadTheme, toggleTheme,
        loadPrefs, savePrefs, applyPrefsAll, applyDarkFromPrefs, setAdminDark,
        updateThemeToggleUI, applyMotionPref, applyCompactPref, setPrefs, syncPrefsFromThemeToggle,
        saveDraft, clearDraft, getProductDraft, restoreDraft, onFormValue, bindAutoSave,
        initSupabase, showLogin, showAdmin, checkSession, initLogin, logout, resetSession,
        openLightbox, closeLightbox,
        exportCSV
    });

})();