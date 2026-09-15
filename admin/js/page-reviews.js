/* ─── PAGE: CUSTOM REVIEWS ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM } = admin;

    admin.bootstrapApp(async () => {
        await admin.loadProducts();
        admin.renderProductGrid();
        if (admin.STATE.products && admin.STATE.products.length) {
            admin.selectProduct(admin.STATE.products[0].id);
        } else {
            admin.loadReviews();
        }
        admin.bindReviewEvents();

        // Reviews deletes use the shared confirm modal; the generic
        // product-delete handler no-ops while STATE.deleteId is null.
        DOM.confirmYes?.addEventListener("click", admin.confirmDeleteReview);

        DOM.refreshStats?.addEventListener("click", async () => {
            await admin.loadProducts();
            admin.renderProductGrid();
            await admin.loadReviews();
            admin.showToast("Data refreshed.", "info");
        });
    });

})();