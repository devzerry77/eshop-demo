/* ─── PAGE: DRAFTED PRODUCTS (unsaved Add-Product autosave draft) ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { showToast, escapeHTML, formatPrice } = admin;

    // Render the single autosaved draft from the existing draft system.
    // A draft only exists while a new product was started but not yet saved;
    // saving or clearing the form removes it (see admin.saveDraft/clearDraft).
    function renderDrafts() {
        const tbody = document.getElementById("draftProductsTable");
        if (!tbody) return;
        const draft = admin.getProductDraft ? admin.getProductDraft() : null;
        const hasContent = draft && [draft.title, draft.price, draft.brand, draft.shortDesc, draft.fullDesc]
            .some(v => v !== undefined && v !== null && String(v).trim() !== "");
        if (!hasContent) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No drafted products. Start a new product and it will autosave here until you save it.</td></tr>`;
            return;
        }
        const title = (draft.title || "Untitled draft").trim() || "Untitled draft";
        const price = draft.price !== '' && draft.price !== undefined ? Number(draft.price) || 0 : 0;
        const stock = draft.stock !== '' && draft.stock !== undefined ? draft.stock : '—';
        tbody.innerHTML = `<tr>
            <td><div class="product-cell"><div><div class="product-name" title="${escapeHTML(title)}">${escapeHTML(title)}</div><div class="product-id">Unsaved draft</div></div></div></td>
            <td><span class="category-pill">${escapeHTML(draft.category || 'uncategorized')}</span></td>
            <td><strong>${formatPrice(price)}</strong></td>
            <td><div class="product-name">${escapeHTML(String(stock))}</div></td>
            <td><div class="table-actions">
                <button class="table-action" data-draft-continue>Continue Editing</button>
                <button class="table-action delete" data-draft-discard>Discard</button>
            </div></td>
        </tr>`;
    }

    admin.bootstrapApp(async () => {
        renderDrafts();

        document.getElementById("draftProductsTable")?.addEventListener("click", e => {
            if (e.target.closest("[data-draft-continue]")) {
                // product-form.html auto-restores this same draft for new products.
                window.location.href = "product-form.html";
                return;
            }
            if (e.target.closest("[data-draft-discard]")) {
                admin.clearDraft();
                renderDrafts();
                showToast("Draft discarded.", "info");
            }
        });

        document.getElementById("refreshStats")?.addEventListener("click", () => {
            renderDrafts();
            showToast("Data refreshed.", "info");
        });
    });

})();
