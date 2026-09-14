/* ─── ADMIN MAIN: shared bootstrap for every admin page ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, showToast } = admin;

    // ─── COMMON UI (sidebar, theme, chat, session) ─────────
    function bindCommonUI() {
        const adminNav = document.querySelector('.admin-nav');
        if (adminNav && !document.querySelector('[data-section="back-to-website"]')) {
            const backLink = document.createElement('a');
            backLink.href = '../../index.html';
            backLink.dataset.section = 'back-to-website';
            backLink.innerHTML = '<span class="nav-icon">⌂</span><span>Go Back to Website</span>';
            adminNav.prepend(backLink);
        }
        DOM.adminMobileToggle?.addEventListener("click", () => {
            DOM.adminSidebar.classList.toggle("active");
            DOM.sidebarBackdrop.classList.toggle("active");
        });
        DOM.sidebarBackdrop?.addEventListener("click", () => {
            DOM.adminSidebar.classList.remove("active");
            DOM.sidebarBackdrop.classList.remove("active");
        });
        DOM.sidebarClose?.addEventListener("click", () => {
            DOM.adminSidebar.classList.remove("active");
            DOM.sidebarBackdrop.classList.remove("active");
        });

        DOM.themeToggle?.addEventListener("click", () => {
            admin.toggleTheme();
            admin.syncPrefsFromThemeToggle && admin.syncPrefsFromThemeToggle();
        });

        DOM.logoutBtn?.addEventListener("click", admin.logout);

        admin.bindChatEvents && admin.bindChatEvents();

        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                DOM.confirmOverlay?.classList.remove("active");
                admin.closeLightbox();
                DOM.aiChatPanel?.classList.remove("active");
            }
        });

        ["click", "mousemove", "scroll", "touchstart"].forEach(ev =>
            document.addEventListener(ev, () => { if (STATE.loggedIn) admin.resetSession(); }, { passive: true })
        );
    }

    // ─── CONFIRM MODAL (product delete) ─────────────────────
    function bindConfirmModal() {
        DOM.confirmNo?.addEventListener("click", () => {
            DOM.confirmOverlay.classList.remove("active");
            STATE.deleteId = null;
        });
        DOM.confirmYes?.addEventListener("click", async () => {
            if (STATE.deleting || !STATE.deleteId) return;
            STATE.deleting = true;
            try {
                await admin.deleteProduct(STATE.deleteId);
                showToast("Product deleted.", "success");
            } catch (error) {
                showToast(error.message || "Delete failed.", "error");
            } finally {
                STATE.deleting = false;
                STATE.deleteId = null;
                DOM.confirmOverlay.classList.remove("active");
            }
        });
    }

    // ─── BOOTSTRAP ──────────────────────────────────────────
    async function bootstrapApp(pageInit) {
        admin.cacheDOM();
        admin.loadTheme();
        admin.loadPrefs && admin.loadPrefs();
        admin.applyPrefsAll && admin.applyPrefsAll();
        if (!admin.initSupabase()) {
            DOM.loginError.textContent = "Supabase could not be loaded.";
            DOM.loginError.classList.add("show");
            return;
        }
        admin.initLogin();
        admin.pageInit = pageInit || (async () => {});
        bindCommonUI();
        bindConfirmModal();
        await admin.checkSession();
    }

    Object.assign(admin, { bindCommonUI, bindConfirmModal, bootstrapApp });

    // ─── BOOTSTRAP (page scripts set their own pageInit first) ───
    // Expected usage: page script does: admin.bootstrapApp(async () => {...});

})();