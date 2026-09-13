/* ─── ADMIN MAIN: navigation (showSection), event bindings, init ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, $$, showToast } = admin;

    // ─── NAVIGATION ────────────────────────────────────────
    function showSection(section, skipReset = false) {
        $$(".admin-nav a").forEach(link => link.classList.remove("active"));
        document.querySelector(`.admin-nav a[data-section="${section}"]`)?.classList.add("active");
        const titles = {
            dashboard: "Dashboard", products: "Products", add: "Add Product",
            orders: "Orders", activity: "Cart Activity", payments: "Payment Settings", settings: "Settings"
        };
        DOM.pageTitle.textContent = titles[section] || "Dashboard";
        DOM.statsGrid.style.display = section === "dashboard" ? "grid" : "none";
        DOM.addSection.style.display = (section === "dashboard" || section === "add") ? "block" : "none";
        DOM.productsSection.style.display = (section === "dashboard" || section === "products") ? "block" : "none";
        DOM.ordersSection.style.display = (section === "orders") ? "block" : "none";
        DOM.activitySection.style.display = section === "activity" ? "block" : "none";
        DOM.paymentSection.style.display = section === "payments" ? "block" : "none";
        const settingsSection = document.getElementById('settingsSection');
        if (settingsSection) settingsSection.style.display = section === "settings" ? "block" : "none";

        if (section === "add" && !skipReset) admin.resetForm();
        if (section === "activity") admin.renderActivity();
        if (section === "settings") { admin.loadMarqueeSettings(); admin.loadThemeSettings(); admin.loadFlashSettings(); admin.populateFlashProductSelect(); }
        if (section === "orders") admin.loadOrders();
        if (section === "payments") admin.loadPaymentSettings();
        if (window.innerWidth <= 768) {
            DOM.adminSidebar.classList.remove("active");
            DOM.sidebarBackdrop.classList.remove("active");
        }
    }

    // ─── EVENTS ─────────────────────────────────────────────
    function bindEvents() {
        $$(".admin-nav a").forEach(link =>
            link.addEventListener("click", e => {
                e.preventDefault();
                showSection(link.dataset.section);
            })
        );
        DOM.adminMobileToggle.addEventListener("click", () => {
            DOM.adminSidebar.classList.toggle("active");
            DOM.sidebarBackdrop.classList.toggle("active");
        });
        DOM.sidebarBackdrop.addEventListener("click", () => {
            DOM.adminSidebar.classList.remove("active");
            DOM.sidebarBackdrop.classList.remove("active");
        });
        DOM.sidebarClose?.addEventListener("click", () => {
            DOM.adminSidebar.classList.remove("active");
            DOM.sidebarBackdrop.classList.remove("active");
        });

        DOM.productForm.addEventListener("submit", admin.submitForm);
        DOM.cancelEdit.addEventListener("click", admin.resetForm);
        DOM.formResetButton.addEventListener("click", admin.resetForm);

        // Theme toggle
        DOM.themeToggle?.addEventListener("click", admin.toggleTheme);

        // Specs
        DOM.addSpecBtn.addEventListener("click", () => admin.addSpecGroup('', ''));

        // Sections
        DOM.addSectionBtn.addEventListener("click", () => {
            DOM.sectionsContainer.appendChild(admin.createSectionBlock('custom', 'New Section', '', true));
            admin.reorderSections();
            admin.initSortableSections();
        });

        // Media gallery
        DOM.addImageBtn?.addEventListener("click", () => admin.addImageInput(''));
        DOM.addMediaBtn?.addEventListener("click", () => admin.addMediaInput('', 0));

        // Description preview
        DOM.toggleDescPreview.addEventListener("click", () => {
            const preview = DOM.descPreview;
            const content = DOM.prodFullDesc.value;
            preview.innerHTML = admin.formatDescription(content);
            preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
        });

        // Search & filters
        DOM.adminSearch.addEventListener("input", admin.debounce(e => {
            STATE.query = e.target.value;
            STATE.page = 1;
            admin.renderProducts();
        }));

        // Table actions
        DOM.adminProductsTable.addEventListener("click", e => {
            const edit = e.target.closest("[data-edit]");
            const del = e.target.closest("[data-delete]");
            if (edit) admin.editProduct(edit.dataset.edit);
            if (del) {
                STATE.deleteId = del.dataset.delete;
                DOM.confirmOverlay.classList.add("active");
            }
        });

        // Confirm modal
        DOM.confirmNo.addEventListener("click", () => {
            DOM.confirmOverlay.classList.remove("active");
            STATE.deleteId = null;
        });
        DOM.confirmYes.addEventListener("click", async () => {
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

        // Activity clear
        DOM.clearActivityBtn.addEventListener("click", () => {
            if (confirm("Clear all activity?")) {
                localStorage.removeItem("grabby_cart_activity");
                admin.renderActivity();
                showToast("Activity cleared.", "info");
            }
        });

        // Refresh stats
        DOM.refreshStats.addEventListener("click", async () => {
            await Promise.all([admin.loadProducts(), admin.loadOrders(), admin.loadPaymentSettings()]);
            showToast("Data refreshed.", "info");
        });

        // Logout
        DOM.logoutBtn.addEventListener("click", admin.logout);
        DOM.statCartCard.addEventListener("click", () => showSection("activity"));

        // Chat
        admin.bindChatEvents();

        // Orders + payments
        admin.bindOrdersEvents();

        // Export products CSV
        DOM.exportProductsBtn?.addEventListener("click", admin.exportProductsCSV);

        // ─── MARQUEE CONTROLS ──────────────────────────────
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

        // ─── FLASH SALE CONTROLS ────────────────────────────
        DOM.flashAutoplay?.addEventListener('input', admin.updateFlashAutoplayLabel);
        DOM.flashEnabled?.addEventListener('change', admin.populateFlashProductSelect);
        DOM.saveFlashBtn?.addEventListener('click', admin.saveFlashSettings);
        DOM.resetFlashBtn?.addEventListener('click', admin.resetFlashSettings);
        DOM.flashProductSelect?.addEventListener('change', admin.recordFlashSelection);

        // Escape key
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                DOM.confirmOverlay.classList.remove("active");
                admin.closeLightbox();
                DOM.aiChatPanel.classList.remove("active");
            }
        });

        // Session reset
        ["click", "mousemove", "scroll", "touchstart"].forEach(ev =>
            document.addEventListener(ev, () => { if (STATE.loggedIn) admin.resetSession(); }, { passive: true })
        );
    }

    // ─── INIT ────────────────────────────────────────────
    async function initDashboard() {
        bindEvents();
        admin.bindThemeSettings();
        admin.addChatMessage("bot", "Hello. I can help you manage the admin panel.");
        await admin.loadProducts();
        await admin.loadOrders();
        admin.populateFlashProductSelect();
        showSection("dashboard");
        admin.initSortableSections();
        admin.initMediaSortable();
        setInterval(() => {
            if (STATE.loggedIn) admin.renderStats();
        }, 60000);
    }

    async function init() {
        admin.cacheDOM();
        admin.loadTheme();
        if (!admin.initSupabase()) {
            DOM.loginError.textContent = "Supabase could not be loaded.";
            DOM.loginError.classList.add("show");
            return;
        }
        admin.initLogin();
        await admin.checkSession();
    }

    Object.assign(admin, { showSection, bindEvents, initDashboard, init });

    // ─── BOOTSTRAP ───────────────────────────────────────
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", admin.init);
    else admin.init();

})();