/* ─── ADMIN PRODUCTS: normalize, CRUD, render, pagination, form ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, showToast, escapeHTML, formatPrice, isYouTubeUrl } = admin;

    // ─── PRODUCTS CRUD ──────────────────────────────────────
    function normalizeProduct(row) {
        const details = row.details || {};
        let images = [];
        if (row.images && Array.isArray(row.images) && row.images.length > 0) {
            if (typeof row.images[0] === 'string') {
                images = row.images.map((url, index) => ({
                    url: url,
                    type: isYouTubeUrl(url) ? 'youtube' : 'image',
                    order: index + 1
                }));
            } else {
                images = row.images.map(item => ({
                    url: item.url || '',
                    type: item.type || (isYouTubeUrl(item.url) ? 'youtube' : 'image'),
                    order: item.order || 0
                }));
            }
        } else if (row.image) {
            images = [{
                url: row.image,
                type: isYouTubeUrl(row.image) ? 'youtube' : 'image',
                order: 1
            }];
        }
        images.sort((a, b) => (a.order || 0) - (b.order || 0));
        const urls = images.map(img => img.url);
        // Pre-migration rows carry no quantity → null (unknown), never 0.
        const rawQty = row.stock_quantity;
        const stockQuantity = (rawQty === null || rawQty === undefined || rawQty === '')
            ? null
            : Math.max(0, Math.floor(Number(rawQty) || 0));
        return {
            id: row.id,
            title: row.title || "Untitled",
            category: row.category || "uncategorized",
            brand: details.brand || '',
            sku: row.sku || ('ESH-' + String(row.id).padStart(6, '0')),
            lowStockThreshold: row.low_stock_threshold ?? 5,
            isFeatured: !!row.is_featured,
            isFlash: !!row.is_flash,
            seoTitle: row.seo_title || '',
            seoDescription: row.seo_description || '',
            price: Number(row.price) || 0,
            originalPrice: row.original_price === null ? null : Number(row.original_price) || null,
            rating: Number(row.rating) || 0,
            reviews: Number(row.reviews) || 0,
            sold: details.sold || '',
            badge: row.badge || '',
            stockQuantity: stockQuantity,
            inStock: row.in_stock !== false && (stockQuantity === null || stockQuantity > 0),
            image: row.image || (urls.length ? urls[0] : 'https://picsum.photos/seed/default/400/400'),
            images: images,
            specs: row.specs || {},
            shortDesc: details.shortDesc || '',
            fullDesc: details.fullDesc || '',
            sections: details.sections || [],
            related: details.related || []
        };
    }

    async function loadProducts() {
        if (!STATE.supabase) return;
        const { data, error } = await STATE.supabase
            .from("products")
            .select("*")
            .order("id", { ascending: false });
        if (error) { showToast("Could not load products.", "error"); return; }
        STATE.products = (data || []).map(normalizeProduct);
        STATE.allProducts = STATE.products;
        admin.renderAll();
        populateRelatedSelect();
    }

    function productPayload(product) {
        let images = product.images || [];
        images = images.map((img, idx) => ({
            url: img.url || img,
            type: img.type || (isYouTubeUrl(img.url || img) ? 'youtube' : 'image'),
            order: img.order !== undefined ? img.order : idx + 1
        }));
        images.sort((a, b) => a.order - b.order);
        if (!images.length) {
            images = [{
                url: "https://picsum.photos/seed/default/400/400",
                type: "image",
                order: 1
            }];
        }
        const urls = images.map(img => img.url);
        const details = {
            brand: product.brand || '',
            sold: product.sold || '',
            shortDesc: product.shortDesc || '',
            fullDesc: product.fullDesc || '',
            sections: product.sections || [],
            related: product.related || []
        };
        const qty = Number.isFinite(Number(product.stockQuantity)) ? Math.max(0, Math.floor(Number(product.stockQuantity))) : 0;
        // Premium v1 columns are optional — legacy DBs without the migration ignore unknown keys via try/catch in saveProduct.
        return {
            title: product.title,
            category: product.category,
            price: product.price,
            original_price: product.originalPrice,
            rating: product.rating,
            reviews: product.reviews,
            description: product.fullDesc || product.shortDesc || '',
            image: urls[0],
            images: images,
            badge: product.badge,
            stock_quantity: qty,
            in_stock: product.inStock && qty > 0,
            specs: product.specs || {},
            details: details,
            sku: (product.sku || '').trim() || null,
            low_stock_threshold: Number.isFinite(Number(product.lowStockThreshold)) ? Math.max(0, Number(product.lowStockThreshold)) : 5,
            is_featured: !!product.isFeatured,
            is_flash: !!product.isFlash,
            seo_title: product.seoTitle || null,
            seo_description: product.seoDescription || null
        };
    }

    const PREMIUM_KEYS = ['sku', 'low_stock_threshold', 'is_featured', 'is_flash', 'seo_title', 'seo_description'];
    async function saveProduct(product) {
        const isNew = !product.id;
        let payload = productPayload(product);
        const stripPremium = () => { PREMIUM_KEYS.forEach(k => delete payload[k]); };
        const isMissingColumn = e => e && (e.code === '42703' || /column .* does not exist|Could not find the .* column/i.test(e.message || ''));
        if (isNew) {
            let { data, error } = await STATE.supabase.from("products").insert(payload).select().single();
            if (error && isMissingColumn(error)) { stripPremium(); ({ data, error } = await STATE.supabase.from("products").insert(payload).select().single()); }
            if (error) throw error;
            STATE.products.unshift(normalizeProduct(data));
        } else {
            let { error } = await STATE.supabase.from("products").update(payload).eq("id", product.id);
            if (error && isMissingColumn(error)) { stripPremium(); ({ error } = await STATE.supabase.from("products").update(payload).eq("id", product.id)); }
            if (error) throw error;
            const index = STATE.products.findIndex(item => String(item.id) === String(product.id));
            if (index !== -1) STATE.products[index] = product;
        }
        admin.renderAll();
        populateRelatedSelect();
    }

    async function deleteProduct(id) {
        const { error } = await STATE.supabase.from("products").delete().eq("id", id);
        if (error) throw error;
        STATE.products = STATE.products.filter(product => String(product.id) !== String(id));
        admin.renderAll();
        populateRelatedSelect();
    }

    // ─── RENDER ─────────────────────────────────────────────
    function filteredProducts() {
        const query = STATE.query.toLowerCase().trim();
        if (!query) return STATE.products;
        return STATE.products.filter(p =>
            [p.title, p.category, p.badge, p.brand].join(" ").toLowerCase().includes(query)
        );
    }

    function renderProducts() {
        const products = filteredProducts();
        const totalPages = Math.max(1, Math.ceil(products.length / STATE.pageSize));
        STATE.page = Math.min(STATE.page, totalPages);
        const start = (STATE.page - 1) * STATE.pageSize;
        const items = products.slice(start, start + STATE.pageSize);
        if (!items.length) {
            DOM.adminProductsTable.innerHTML = `<tr><td colspan="5" class="empty-state">No products found.</td></tr>`;
            renderPagination(totalPages);
            return;
        }
        DOM.adminProductsTable.innerHTML = items.map(p => {
            const imgSrc = p.images && p.images.length ? p.images[0].url : p.image;
            return `<tr data-product-id="${escapeHTML(p.id)}">
                <td><div class="product-cell"><img class="cell-img" src="${escapeHTML(imgSrc)}" alt=""><div><div class="product-name" title="${escapeHTML(p.title)}">${escapeHTML(p.title)}</div><div class="product-id">ID: ${escapeHTML(p.id)}</div></div></div></td>
                <td><span class="category-pill">${escapeHTML(p.category)}</span></td>
                <td><strong>${formatPrice(p.price)}</strong></td>
                <td><div class="product-name">${p.stockQuantity === null || p.stockQuantity === undefined ? '—' : escapeHTML(String(p.stockQuantity))}</div><div><span class="stock-pill ${p.inStock ? 'in' : 'out'}">${p.inStock ? 'In stock' : 'Out of stock'}</span></div></td>
                <td><div class="table-actions"><button class="table-action" data-edit="${escapeHTML(p.id)}">Edit</button><button class="table-action delete" data-delete="${escapeHTML(p.id)}">Delete</button></div></td>
            </tr>`;
        }).join("");
        DOM.adminProductsTable.querySelectorAll("img[data-image]").forEach(img => {
            img.addEventListener("error", () => {
                img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100%25' height='100%25' fill='%23eeeeee'/%3E%3C/svg%3E";
            }, { once: true });
        });
        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        if (totalPages <= 1) { DOM.adminPagination.innerHTML = ""; return; }
        let html = "";
        for (let page = 1; page <= totalPages; page++) {
            html += `<button class="${page === STATE.page ? 'active' : ''}" data-page="${page}">${page}</button>`;
        }
        DOM.adminPagination.innerHTML = html;
        DOM.adminPagination.querySelectorAll("[data-page]").forEach(btn => {
            btn.addEventListener("click", () => {
                STATE.page = Number(btn.dataset.page);
                renderProducts();
            });
        });
    }

    // ─── FORM ──────────────────────────────────────────────
    function readForm() {
        const images = admin.getMediaItems();
        images.sort((a, b) => a.order - b.order);
        if (!images.length) images.push({ url: "https://picsum.photos/seed/default/400/400", order: 1 });
        const sections = admin.getSectionsData();
        const relatedSelect = DOM.relatedProductsSelect;
        const relatedIds = Array.from(relatedSelect.selectedOptions).map(opt => parseInt(opt.value));
        return {
            id: DOM.editId.value || null,
            title: DOM.prodTitle.value.trim(),
            category: DOM.prodCategory.value,
            brand: DOM.prodBrand.value.trim(),
            sku: document.getElementById('prodSku')?.value.trim() || '',
            lowStockThreshold: Number(document.getElementById('prodLowStock')?.value) || 5,
            isFeatured: !!document.getElementById('prodFeatured')?.checked,
            isFlash: !!document.getElementById('prodFlash')?.checked,
            seoTitle: document.getElementById('prodSeoTitle')?.value.trim() || '',
            seoDescription: document.getElementById('prodSeoDesc')?.value.trim() || '',
            price: Number(DOM.prodPrice.value) || 0,
            originalPrice: DOM.prodOriginal.value ? Number(DOM.prodOriginal.value) : null,
            rating: Math.max(0, Math.min(5, Number(DOM.prodRating.value) || 0)),
            reviews: Math.max(0, Number(DOM.prodReviews.value) || 0),
            sold: DOM.prodSold.value.trim(),
            badge: DOM.prodBadge.value.trim(),
            stockQuantity: DOM.prodStock.value === '' ? NaN : Math.floor(Number(DOM.prodStock.value)),
            inStock: DOM.prodInStock.checked,
            image: images[0]?.url || '',
            images: images.map(item => ({
                url: item.url,
                type: isYouTubeUrl(item.url) ? 'youtube' : 'image',
                order: item.order
            })),
            specs: admin.getSpecs(),
            shortDesc: DOM.prodShortDesc.value.trim(),
            fullDesc: DOM.prodFullDesc.value.trim(),
            sections: sections,
            related: relatedIds
        };
    }

    async function submitForm(event) {
        event.preventDefault();
        if (STATE.busy) return;
        const product = readForm();
        if (!product.title) { showToast("Product title is required.", "warning"); DOM.prodTitle.focus(); return; }
        if (product.price < 0) { showToast("Price cannot be negative.", "warning"); return; }
        if (!Number.isFinite(product.stockQuantity) || product.stockQuantity < 0) { showToast("Stock quantity is required (0 or more).", "warning"); DOM.prodStock.focus(); return; }
        STATE.busy = true;
        try {
            await saveProduct(product);
            showToast(product.id ? "Product updated successfully!" : "Product added successfully!", "success");
            if (admin.clearDraft) admin.clearDraft();
            resetForm();
            if (admin.afterSave) admin.afterSave(product);
        } catch (error) {
            showToast(error.message || "Could not save product.", "error");
        } finally {
            STATE.busy = false;
        }
    }

    function fillProductForm(product) {
        DOM.editId.value = product.id;
        DOM.prodTitle.value = product.title;
        DOM.prodCategory.value = product.category;
        DOM.prodBrand.value = product.brand || '';
        DOM.prodPrice.value = product.price;
        DOM.prodOriginal.value = product.originalPrice ?? '';
        DOM.prodBadge.value = product.badge || '';
        DOM.prodSold.value = product.sold || '';
        DOM.prodRating.value = product.rating;
        DOM.prodReviews.value = product.reviews;
        DOM.prodStock.value = (product.stockQuantity === null || product.stockQuantity === undefined) ? '' : product.stockQuantity;
        DOM.prodInStock.checked = product.inStock;
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) (el.type === 'checkbox' ? el.checked = !!v : el.value = v ?? ''); };
        setVal('prodSku', product.sku || '');
        setVal('prodLowStock', product.lowStockThreshold ?? 5);
        setVal('prodFeatured', product.isFeatured);
        setVal('prodFlash', product.isFlash);
        setVal('prodSeoTitle', product.seoTitle || '');
        setVal('prodSeoDesc', product.seoDescription || '');
        DOM.prodShortDesc.value = product.shortDesc || '';
        DOM.prodFullDesc.value = product.fullDesc || '';
        admin.setSpecs(product.specs || {});
        admin.setSectionsData(product.sections || []);
        const mediaItems = product.images && product.images.length ? product.images : [{ url: product.image || '', order: 1 }];
        admin.setMediaItems(mediaItems);
        const relatedSelect = DOM.relatedProductsSelect;
        Array.from(relatedSelect.options).forEach(opt => {
            opt.selected = product.related && product.related.includes(parseInt(opt.value));
        });
        DOM.formTitle.textContent = "Edit Product";
    }

    function editProduct(id) {
        const product = STATE.products.find(item => String(item.id) === String(id));
        if (!product) return;
        populateRelatedSelect();
        fillProductForm(product);
        if (admin.showSection) admin.showSection("add", true);
    }

    function resetForm() {
        DOM.productForm.reset();
        DOM.editId.value = "";
        DOM.formTitle.textContent = "Add Product";
        DOM.prodStock.value = '50';
        DOM.prodBrand.value = '';
        DOM.prodSold.value = '';
        DOM.prodShortDesc.value = '';
        DOM.prodFullDesc.value = '';
        admin.setSpecs({});
        admin.setSectionsData([]);
        admin.setMediaItems([]);
        Array.from(DOM.relatedProductsSelect.options).forEach(opt => opt.selected = false);
    }

    function populateRelatedSelect() {
        if (!DOM.relatedProductsSelect) return;
        const select = DOM.relatedProductsSelect;
        const currentVal = select.value;
        select.innerHTML = '';
        STATE.allProducts.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.title;
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    }

    // ─── EXPORT CSV (products) ──────────────────────────────
    function exportProductsCSV() {
        const headers = ['ID', 'Title', 'Category', 'Price', 'Original Price', 'Rating', 'Reviews', 'Stock Qty', 'In Stock', 'Badge'];
        const rows = STATE.products.map(p => [
            p.id, p.title, p.category, p.price, p.originalPrice ?? '', p.rating, p.reviews, p.stockQuantity ?? '', p.inStock, p.badge
        ]);
        admin.exportCSV(headers, rows, 'eshop_products.csv');
    }

    Object.assign(admin, {
        normalizeProduct, loadProducts, productPayload, saveProduct, deleteProduct,
        filteredProducts, renderProducts, renderPagination,
        readForm, submitForm, editProduct, fillProductForm, resetForm, populateRelatedSelect,
        exportProductsCSV
    });

})();