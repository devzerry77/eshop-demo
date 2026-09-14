/* ─── PAGE: DASHBOARD ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM, STATE, showToast } = admin;

    admin.bootstrapApp(async () => {
        await admin.loadProducts();
        await admin.loadOrders();
        admin.renderStats();

        DOM.refreshStats?.addEventListener("click", async () => {
            await Promise.all([admin.loadProducts(), admin.loadOrders(), admin.loadPaymentSettings()]);
            admin.renderStats();
            showToast("Data refreshed.", "info");
        });

        DOM.statCartCard?.addEventListener("click", () => {
            window.location.href = "activity.html";
        });

        setInterval(() => {
            if (STATE.loggedIn) admin.renderStats();
        }, 60000);
    });

})();