/* ─── PAGE: PRODUCTS LIST ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM, STATE, showToast } = admin;

    admin.bootstrapApp(async () => {
        await admin.loadProducts();

        DOM.adminSearch?.addEventListener("input", admin.debounce(e => {
            STATE.query = e.target.value;
            STATE.page = 1;
            admin.renderProducts();
        }));

        DOM.adminProductsTable?.addEventListener("click", e => {
            const edit = e.target.closest("[data-edit]");
            const del = e.target.closest("[data-delete]");
            if (edit) {
                window.location.href = `product-form.html?id=${encodeURIComponent(edit.dataset.edit)}`;
            }
            if (del) {
                STATE.deleteId = del.dataset.delete;
                DOM.confirmOverlay.classList.add("active");
            }
        });

        DOM.exportProductsBtn?.addEventListener("click", admin.exportProductsCSV);

        DOM.refreshStats?.addEventListener("click", async () => {
            await admin.loadProducts();
            showToast("Data refreshed.", "info");
        });
    });

})();