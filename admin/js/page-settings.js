/* ─── PAGE: SETTINGS ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM } = admin;

    admin.bootstrapApp(async () => {
        await admin.loadProducts();
        admin.bindThemeSettings();
        admin.bindSettingsControls();
        await admin.loadMarqueeSettings();
        await admin.loadThemeSettings();
        await admin.loadHfColors();
        await admin.loadFlashSettings();
        await admin.loadHeroSettings();
        admin.loadMessengerSettings();
        admin.loadSocialSettings();
        admin.loadOrderModeSettings();
        admin.populateFlashProductSelect();

        DOM.refreshStats?.addEventListener("click", () => {
            admin.loadMarqueeSettings();
            admin.loadThemeSettings();
            admin.loadHfColors();
            admin.loadFlashSettings();
            admin.loadHeroSettings();
            admin.loadMessengerSettings();
            admin.loadSocialSettings();
            admin.loadOrderModeSettings();
            admin.populateFlashProductSelect();
        });
    });

})();