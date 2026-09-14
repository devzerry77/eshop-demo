/* ─── PAGE: ADD / EDIT PRODUCT FORM ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { DOM, STATE, showToast } = admin;

    admin.bootstrapApp(async () => {
        await admin.loadProducts();
        admin.populateRelatedSelect();

        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");

        if (id) {
            const product = STATE.products.find(p => String(p.id) === String(id));
            DOM.formTitle.textContent = "Edit Product";
            DOM.pageTitle.textContent = "Edit Product";
            if (product) {
                admin.fillProductForm(product);
            } else {
                admin.resetForm();
                showToast("Product not found.", "error");
            }
        } else {
            admin.resetForm();
            admin.restoreDraft();
        }

        // After saving go back to the product list.
        admin.afterSave = () => { window.location.href = "products.html"; };

        // Form bindings
        DOM.productForm?.addEventListener("submit", admin.submitForm);
        DOM.cancelEdit?.addEventListener("click", admin.resetForm);
        DOM.formResetButton?.addEventListener("click", admin.resetForm);
        DOM.addSpecBtn?.addEventListener("click", () => admin.addSpecGroup('', ''));
        DOM.addSectionBtn?.addEventListener("click", () => {
            DOM.sectionsContainer.appendChild(admin.createSectionBlock('custom', 'New Section', '', true));
            admin.reorderSections();
            admin.initSortableSections();
        });
        DOM.addImageBtn?.addEventListener("click", () => admin.addImageInput(''));
        DOM.addMediaBtn?.addEventListener("click", () => admin.addMediaInput('', 0));
        DOM.toggleDescPreview?.addEventListener("click", () => {
            const preview = DOM.descPreview;
            const content = DOM.prodFullDesc.value;
            preview.innerHTML = admin.formatDescription(content);
            preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
        });

        admin.initMediaSortable();
        admin.initSortableSections();
        admin.bindAutoSave();

        DOM.refreshStats?.addEventListener("click", async () => {
            await admin.loadProducts();
            admin.populateRelatedSelect();
            showToast("Data refreshed.", "info");
        });
    });

})();