/* ─── ADMIN CORE: constants, state, DOM cache, toast, utils, theme, auth, lightbox ─── */
(() => {

    "use strict";

    const admin = window.admin = window.admin || {};

    const SUPABASE_URL = "https://arzzuvnuyrhfbqaiwily.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyenp1dm51eXJoZmJxYWl3aWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyODc0NDksImV4cCI6MjEwNDg2MzQ0OX0.q1cPuElRwIrX8uhoq-Hhv-JDZL7hF2QLfmX15ok6_tc";
    const IMGBB_API_KEY = "c849986a59aa08b8bc5593a21a744e57";

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
            "prodRating", "prodReviews", "prodInStock", "prodShortDesc", "prodFullDesc",
            "descPreview", "toggleDescPreview", "specsContainer", "addSpecBtn",
            "sectionsContainer", "addSectionBtn", "imageInputsWrapper", "addImageBtn",
            "addMediaBtn", "imageGalleryPreview", "relatedProductsSelect", "formTitle",
            "cancelEdit", "formResetButton", "adminProductsTable", "adminSearch",
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
            // Flash sale (new)
            "flashEnabled", "flashTitle", "flashSubtitle", "flashBadge",
            "flashProductSelect", "flashAutoplay", "flashAutoplayLabel",
            "flashPerView", "flashDuration", "flashAccent",
            "saveFlashBtn", "resetFlashBtn", "flashStatus"
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
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
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
        const saved = localStorage.getItem('grabby_theme');
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
            if (!saved) localStorage.setItem('grabby_theme', 'dark');
        }
    }

    function toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const themeToggle = DOM.themeToggle;
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('grabby_theme', 'light');
            if (themeToggle) {
                themeToggle.querySelector('.theme-icon').textContent = '🌙';
                themeToggle.querySelector('.theme-label').textContent = 'Dark';
            }
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('grabby_theme', 'dark');
            if (themeToggle) {
                themeToggle.querySelector('.theme-icon').textContent = '☀️';
                themeToggle.querySelector('.theme-label').textContent = 'Light';
            }
        }
    }

    // ─── AUTH ──────────────────────────────────────────────
    function initSupabase() {
        if (!window.supabase || !window.supabase.createClient) return false;
        STATE.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }

    function showLogin() {
        STATE.loggedIn = false;
        DOM.loginOverlay?.classList.remove("hidden");
        DOM.adminLayout?.classList.remove("active");
        clearTimeout(STATE.timeout);
    }

    function showAdmin() {
        STATE.loggedIn = true;
        DOM.loginOverlay?.classList.add("hidden");
        DOM.adminLayout?.classList.add("active");
        showToast("Welcome back!", "success");
        if (!STATE.initialized) {
            STATE.initialized = true;
            admin.initDashboard && admin.initDashboard();
        }
        resetSession();
    }

    async function checkSession() {
        const { data: { session } } = await STATE.supabase.auth.getSession();
        session ? showAdmin() : showLogin();
    }

    function initLogin() {
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
                showAdmin();
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
        uploadToImgBB,
        loadTheme, toggleTheme,
        initSupabase, showLogin, showAdmin, checkSession, initLogin, logout, resetSession,
        openLightbox, closeLightbox,
        exportCSV
    });

})();