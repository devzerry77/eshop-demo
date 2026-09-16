/* ─── PAGE: CART ACTIVITY ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM, showToast } = admin;

    admin.bootstrapApp(async () => {
        admin.renderActivity();

        DOM.clearActivityBtn?.addEventListener("click", () => {
            if (confirm("Clear all activity?")) {
                localStorage.removeItem("eshop_cart_activity");
                admin.renderActivity();
                showToast("Activity cleared.", "info");
            }
        });
    });

})();