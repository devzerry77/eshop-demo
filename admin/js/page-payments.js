/* ─── PAGE: PAYMENT SETTINGS ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM } = admin;

    admin.bootstrapApp(async () => {
        await admin.loadPaymentSettings();
        admin.bindPaymentsEvents();

        DOM.refreshStats?.addEventListener("click", () => {
            admin.loadPaymentSettings();
        });
    });

})();