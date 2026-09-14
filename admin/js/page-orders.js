/* ─── PAGE: ORDERS ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM, showToast } = admin;

    admin.bootstrapApp(async () => {
        await admin.loadOrders();
        admin.bindOrdersEvents();

        DOM.refreshStats?.addEventListener("click", async () => {
            await admin.loadOrders();
            showToast("Data refreshed.", "info");
        });
    });

})();