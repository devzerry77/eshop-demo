/* ─── PAGE: PUBLIC REVIEWS ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM } = admin;

    admin.bootstrapApp(async () => {
        await admin.loadProducts();
        await admin.loadPublicReviews();
        admin.bindPublicReviewEvents();

        DOM.confirmYes?.addEventListener("click", admin.confirmDeletePublicReview);

        DOM.refreshStats?.addEventListener("click", async () => {
            await Promise.all([admin.loadProducts(), admin.loadPublicReviews()]);
            admin.showToast("Data refreshed.", "info");
        });
    });

})();