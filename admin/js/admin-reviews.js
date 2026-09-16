/* ─── ADMIN REVIEWS: Custom Reviews CRUD (product select, name, rating, text, images, video, publish) ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, showToast, escapeHTML, formatPrice, isYouTubeUrl, getYouTubeThumbnail } = admin;

    const RATING_NUMBERS = [5, 4, 3, 2, 1];
    let uploadedImages = [];
    let deleteReviewId = null;

    STATE.selectedProductId = STATE.selectedProductId || null;
    STATE.reviewProductSearch = STATE.reviewProductSearch || '';

    // ─── DATA ────────────────────────────────────────────────
    function normalizeReviews(reviews) {
        return (reviews || []).map(row => {
            let images = [];
            const raw = row.images;
            if (raw) {
                if (Array.isArray(raw)) {
                    images = raw.map(item => (typeof item === 'string' ? item : ((item && item.url) || ''))).filter(Boolean);
                } else if (typeof raw === 'string') {
                    try {
                        const parsed = JSON.parse(raw);
                        images = Array.isArray(parsed) ? parsed.map(item => (typeof item === 'string' ? item : ((item && item.url) || ''))).filter(Boolean) : [raw];
                    } catch {
                        images = [raw];
                    }
                }
            }
            return {
                id: row.id,
                product_id: row.product_id,
                user_id: row.user_id,
                reviewer_name: row.reviewer_name || 'Verified Buyer',
                rating: Number(row.rating) || 0,
                review_text: row.review_text || '',
                images: images,
                video_url: row.video_url || '',
                source: row.source || 'customer',
                is_published: row.is_published !== false,
                created_at: row.created_at
            };
        });
    }

    // ─── PRODUCT SELECTOR GRID ──────────────────────────────
    function selectedProduct() {
        return (STATE.products || []).find(p => String(p.id) === String(STATE.selectedProductId));
    }

    function renderProductGrid() {
        populateState();
        if (!DOM.reviewProductGrid) return;
        const all = STATE.products || [];
        const q = String(STATE.reviewProductSearch || '').trim().toLowerCase();
        const products = q
            ? all.filter(p =>
                (p.title && String(p.title).toLowerCase().includes(q)) ||
                String(p.id).includes(q))
            : all;
        if (!products.length) {
            DOM.reviewProductGrid.innerHTML = `<div class="empty-state">${q ? 'No products match your search.' : 'No products available.'}</div>`;
            return;
        }
        DOM.reviewProductGrid.innerHTML = products.map(p => {
            const img = p.image || 'https://picsum.photos/seed/default/400/400';
            const active = String(p.id) === String(STATE.selectedProductId) ? ' active' : '';
            return `
                <button type="button" class="review-product-card${active}" data-product-id="${escapeHTML(String(p.id))}" aria-pressed="${active ? 'true' : 'false'}">
                    <img class="review-product-thumb" src="${escapeHTML(img)}" alt="" loading="lazy">
                    <span class="review-product-name">${escapeHTML(p.title)}</span>
                    <span class="review-product-price">${formatPrice(p.price)}</span>
                </button>`;
        }).join("");
        updateCurrentProductLabel();
    }

    function selectProduct(id) {
        STATE.selectedProductId = id !== null && id !== undefined && id !== '' ? id : null;
        STATE.reviews = [];
        if (DOM.reviewFormArea) DOM.reviewFormArea.style.display = "none";
        renderProductGrid();
        renderReviews();
        loadReviews();
    }

    function updateCurrentProductLabel() {
        if (!DOM.reviewCurrentProduct) return;
        const p = selectedProduct();
        DOM.reviewCurrentProduct.innerHTML = p
            ? `Editing reviews for: <strong>${escapeHTML(p.title)}</strong>`
            : 'No product selected.';
    }

    async function loadReviews() {
        if (!STATE.supabase) return;
        populateState();
        const requestedId = String(STATE.selectedProductId || '');
        renderProductGrid();
        let query = STATE.supabase
            .from("reviews")
            .select("*")
            .order("created_at", { ascending: false });
        if (requestedId) {
            query = query.eq("product_id", STATE.selectedProductId);
        }
        try {
            const { data, error } = await query;
            if (error) throw error;
            if (String(STATE.selectedProductId || '') !== requestedId) return;
            STATE.reviews = normalizeReviews(data);
        } catch (err) {
            if (String(STATE.selectedProductId || '') !== requestedId) return;
            showToast("Could not load reviews: " + (err.message || err), "error");
            STATE.reviews = [];
        }
        renderReviews();
    }

    // ─── RENDER LIST ─────────────────────────────────────────
    function productTitle(productId) {
        const p = (STATE.products || []).find(prod => String(prod.id) === String(productId));
        return p ? p.title : ('#' + productId);
    }

    function renderReviews() {
        if (!DOM.reviewsTableBody) return;
        const reviews = STATE.reviews || [];
        if (!STATE.selectedProductId) {
            DOM.reviewsTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">Select a product above to manage its custom reviews.</td></tr>`;
            return;
        }
        if (!reviews.length) {
            DOM.reviewsTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">
                <div class="review-empty-state">
                    <strong>No Reviews</strong>
                    <button type="button" class="button button-primary" data-start-review>➕ Add New Review</button>
                </div>
            </td></tr>`;
            return;
        }
        DOM.reviewsTableBody.innerHTML = reviews.map(r => {
            const thumb = r.images && r.images.length
                ? `<img class="review-thumb" src="${escapeHTML(r.images[0])}" alt="" data-lightbox="${escapeHTML(r.images[0])}">`
                : (r.video_url && isYouTubeUrl(r.video_url))
                    ? `<img class="review-thumb" src="${escapeHTML(getYouTubeThumbnail(r.video_url))}" alt="" data-lightbox="${escapeHTML(r.video_url)}">`
                    : '<span class="product-id">—</span>';
            return `<tr data-review-id="${escapeHTML(r.id)}">
                <td>
                    <div class="product-name">${escapeHTML(productTitle(r.product_id))}</div>
                    <div class="product-id">Product #${escapeHTML(String(r.product_id))}</div>
                </td>
                <td>${r.source === 'admin' ? '<span class="order-status-pill admin">ADMIN</span>' : '<span class="order-status-pill delivered">BUYER</span>'}<br>${escapeHTML(r.reviewer_name)}</td>
                <td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td>
                <td style="max-width:260px;">
                    <div class="review-text-cell">${escapeHTML(r.review_text)}</div>
                    ${r.video_url ? `<div class="product-id">▶ video</div>` : ''}
                </td>
                <td>${thumb}</td>
                <td><span class="order-status-pill ${r.is_published ? 'delivered' : 'cancelled'}">${r.is_published ? 'Published' : 'Hidden'}</span></td>
                <td><div class="product-id">${r.created_at ? escapeHTML(new Date(r.created_at).toLocaleDateString()) : '—'}</div></td>
                <td>
                    <div class="table-actions">
                        <button class="table-action" data-edit-review="${escapeHTML(r.id)}">Edit</button>
                        <button class="table-action danger" data-toggle-review="${escapeHTML(r.id)}">${r.is_published ? 'Hide' : 'Publish'}</button>
                        <button class="table-action danger" data-delete-review="${escapeHTML(r.id)}">Delete</button>
                    </div>
                </td>
            </tr>`;
        }).join("");
    }

    // ─── FORM ────────────────────────────────────────────────
    function buildRatingSelect(selected) {
        return RATING_NUMBERS.map(n =>
            `<option value="${n}" ${Number(selected) === n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n} star${n > 1 ? 's' : ''})</option>`
        ).join('');
    }

    function showForm(review) {
        if (!DOM.reviewFormArea) return;
        if (!STATE.selectedProductId) {
            showToast("Select a product first.", "warning");
            return;
        }
        // Mobile: a leftover sidebar backdrop (z-index 90) or open chat panel
        // sits above the form and swallows the Save tap. Dismiss both using
        // the exact same form logic — no separate mobile flow.
        try {
            document.getElementById("adminSidebar")?.classList.remove("active");
            document.getElementById("sidebarBackdrop")?.classList.remove("active");
            document.getElementById("aiChatPanel")?.classList.remove("active");
        } catch { /* noop */ }
        DOM.reviewFormArea.style.display = "block";
        DOM.reviewFormTitle.textContent = review ? "Edit Review" : "Add Custom Review";
        DOM.reviewRating.innerHTML = buildRatingSelect(review ? review.rating : 5);
        DOM.reviewId.value = review ? review.id : "";
        DOM.reviewName.value = review ? review.reviewer_name : "";
        DOM.reviewRating.value = review ? String(review.rating) : "5";
        DOM.reviewText.value = review ? review.review_text : "";
        DOM.reviewVideo.value = review ? (review.video_url || '') : "";
        DOM.reviewPublished.checked = review ? review.is_published : true;
        uploadedImages = review ? [...(review.images || [])] : [];
        renderImagePreviews();
        // Keep the sticky mobile header from covering the form title.
        try {
            DOM.reviewFormArea.scrollIntoView({ behavior: "smooth", block: "start" });
            if (window.innerWidth <= 768) window.setTimeout(() => window.scrollBy({ top: -70, behavior: "smooth" }), 350);
        } catch {
            DOM.reviewFormArea.scrollIntoView();
        }
    }

    function hideForm() {
        if (DOM.reviewFormArea) DOM.reviewFormArea.style.display = "none";
        uploadedImages = [];
        renderImagePreviews();
    }

    function renderImagePreviews() {
        if (!DOM.reviewImagesPreview) return;
        if (!uploadedImages.length) {
            DOM.reviewImagesPreview.innerHTML = '<span class="form-hint">No images uploaded yet.</span>';
            return;
        }
        DOM.reviewImagesPreview.innerHTML = uploadedImages.map((url, index) => `
            <div class="review-img-chip">
                <img src="${escapeHTML(url)}" alt="Review image ${index + 1}">
                <button type="button" data-remove-img="${index}" aria-label="Remove image">✕</button>
            </div>
        `).join("");
    }

    async function onUploadImages(fileList) {
        const files = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith('image/'));
        if (!files.length) {
            showToast("Please select image files.", "warning");
            return;
        }
        const remaining = Math.max(0, 6 - uploadedImages.length);
        const toUpload = files.slice(0, remaining);
        DOM.reviewUploadBtn.disabled = true;
        DOM.reviewUploadBtn.textContent = "Uploading…";
        try {
            for (const file of toUpload) {
                const url = await admin.uploadToImgBB(file);
                uploadedImages.push(url);
                renderImagePreviews();
            }
            showToast(`${toUpload.length} image(s) uploaded.`, "success");
            if (remaining <= 0) showToast("Maximum 6 images per review.", "warning");
        } catch (err) {
            showToast(err.message || "Upload failed.", "error");
        } finally {
            DOM.reviewUploadBtn.disabled = false;
            DOM.reviewUploadBtn.textContent = "📷 Upload Image";
            DOM.reviewUploadInput.value = "";
        }
    }

    // ─── SAVE / TOGGLE / DELETE ─────────────────────────────
    function collectPayload() {
        const rating = parseInt(DOM.reviewRating.value) || 5;
        const name = DOM.reviewName.value.trim() || "Verified Buyer";
        const text = DOM.reviewText.value.trim();
        const videoUrl = DOM.reviewVideo.value.trim();
        if (!text) throw new Error("Please enter the review text.");
        if (videoUrl && !isYouTubeUrl(videoUrl)) throw new Error("Please enter a valid YouTube link.");
        if (!STATE.selectedProductId) throw new Error("Select a product for this review.");
        return {
            product_id: Number(STATE.selectedProductId),
            reviewer_name: name,
            rating: Math.min(5, Math.max(1, rating)),
            review_text: text,
            images: uploadedImages,
            video_url: videoUrl || null,
            source: 'admin',
            user_id: null,
            is_published: DOM.reviewPublished.checked
        };
    }

    async function saveReview() {
        // Mobile keyboard is still open when Save is tapped; dismiss it now
        // (click already fired) so toasts/errors are visible. Same payload.
        try {
            if (window.innerWidth <= 768 && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        } catch { /* noop */ }
        let payload;
        try {
            payload = collectPayload();
        } catch (err) {
            showToast(err.message, "warning");
            return;
        }
        if (!STATE.supabase) return;
        const id = DOM.reviewId.value;
        DOM.saveReviewBtn.disabled = true;
        DOM.saveReviewBtn.textContent = id ? "Saving…" : "Adding…";
        try {
            if (id) {
                const { error } = await STATE.supabase.from("reviews").update(payload).eq("id", id);
                if (error) throw error;
                showToast("Review updated.", "success");
            } else {
                const { error } = await STATE.supabase.from("reviews").insert(payload);
                if (error) throw error;
                showToast("Custom review added.", "success");
            }
            hideForm();
            await loadReviews();
        } catch (err) {
            showToast("Save failed: " + (err.message || err), "error");
        } finally {
            DOM.saveReviewBtn.disabled = false;
            DOM.saveReviewBtn.textContent = id ? "Save Review" : "Add Review";
        }
    }

    async function toggleReview(id) {
        if (!STATE.supabase) return;
        const review = (STATE.reviews || []).find(r => String(r.id) === String(id));
        if (!review) return;
        const next = !review.is_published;
        try {
            const { error } = await STATE.supabase.from("reviews").update({ is_published: next }).eq("id", id);
            if (error) throw error;
            review.is_published = next;
            showToast(next ? "Review published." : "Review hidden.", "success");
            renderReviews();
        } catch (err) {
            showToast("Could not update review: " + (err.message || err), "error");
        }
    }

    function openDeleteReview(id) {
        deleteReviewId = id;
        DOM.confirmTitle.textContent = "Delete Review?";
        DOM.confirmYes.textContent = "Delete";
        DOM.confirmOverlay.classList.add("active");
    }

    async function confirmDeleteReview() {
        if (!deleteReviewId) return;
        if (!STATE.supabase) return;
        try {
            const { error } = await STATE.supabase.from("reviews").delete().eq("id", deleteReviewId);
            if (error) throw error;
            showToast("Review deleted.", "success");
            await loadReviews();
        } catch (err) {
            showToast("Delete failed: " + (err.message || err), "error");
        } finally {
            deleteReviewId = null;
            DOM.confirmOverlay.classList.remove("active");
        }
    }

    function populateState() {
        DOM.reviewsTableBody = document.getElementById("reviewsTableBody");
        DOM.reviewFormArea = document.getElementById("reviewFormArea");
        DOM.reviewFormTitle = document.getElementById("reviewFormTitle");
        DOM.reviewId = document.getElementById("reviewId");
        DOM.reviewName = document.getElementById("reviewName");
        DOM.reviewRating = document.getElementById("reviewRating");
        DOM.reviewText = document.getElementById("reviewText");
        DOM.reviewVideo = document.getElementById("reviewVideo");
        DOM.reviewPublished = document.getElementById("reviewPublished");
        DOM.reviewUploadBtn = document.getElementById("reviewUploadBtn");
        DOM.reviewUploadInput = document.getElementById("reviewUploadInput");
        DOM.reviewImagesPreview = document.getElementById("reviewImagesPreview");
        DOM.saveReviewBtn = document.getElementById("saveReviewBtn");
        DOM.cancelReviewBtn = document.getElementById("cancelReviewBtn");
        DOM.addReviewBtn = document.getElementById("addReviewBtn");
        DOM.exportReviewsBtn = document.getElementById("exportReviewsBtn");
        DOM.reviewProductGrid = document.getElementById("reviewProductGrid");
        DOM.reviewProductSearch = document.getElementById("reviewProductSearch");
        DOM.reviewCurrentProduct = document.getElementById("reviewCurrentProduct");
    }

    // ─── EVENTS ──────────────────────────────────────────────
    function bindReviewEvents() {
        populateState();

        DOM.addReviewBtn?.addEventListener("click", () => showForm(null));
        DOM.cancelReviewBtn?.addEventListener("click", hideForm);
        DOM.saveReviewBtn?.addEventListener("click", saveReview);
        DOM.reviewUploadBtn?.addEventListener("click", () => DOM.reviewUploadInput?.click());
        DOM.reviewUploadInput?.addEventListener("change", e => onUploadImages(e.target.files));
        DOM.reviewProductGrid?.addEventListener("click", e => {
            const card = e.target.closest("[data-product-id]");
            if (!card) return;
            selectProduct(card.dataset.productId);
        });
        DOM.reviewProductSearch?.addEventListener("input", () => {
            STATE.reviewProductSearch = DOM.reviewProductSearch.value;
            renderProductGrid();
        });
        DOM.reviewImagesPreview?.addEventListener("click", e => {
            const btn = e.target.closest("[data-remove-img]");
            if (!btn) return;
            const index = Number(btn.dataset.removeImg);
            if (index > -1 && index < uploadedImages.length) {
                uploadedImages.splice(index, 1);
                renderImagePreviews();
            }
        });

        DOM.reviewsTableBody?.addEventListener("click", async e => {
            const edit = e.target.closest("[data-edit-review]");
            const toggle = e.target.closest("[data-toggle-review]");
            const del = e.target.closest("[data-delete-review]");
            const lightbox = e.target.closest("[data-lightbox]");
            if (edit) {
                const review = (STATE.reviews || []).find(r => String(r.id) === String(edit.dataset.editReview));
                if (review) showForm(review);
            } else if (e.target.closest("[data-start-review]")) {
                showForm(null);
            } else if (toggle) {
                await toggleReview(toggle.dataset.toggleReview);
            } else if (del) {
                openDeleteReview(del.dataset.deleteReview);
            } else if (lightbox) {
                admin.openLightbox(lightbox.dataset.lightbox);
            }
        });

        DOM.exportReviewsBtn?.addEventListener("click", () => {
            const rows = (STATE.reviews || []).map(r => [
                productTitle(r.product_id),
                r.reviewer_name,
                r.rating,
                r.review_text,
                r.images.join('|'),
                r.video_url,
                r.source,
                r.is_published ? 'published' : 'hidden',
                r.created_at ? r.created_at : ''
            ]);
            admin.exportCSV(["Product", "Reviewer", "Rating", "Review", "Images", "Video URL", "Source", "Status", "Created"], rows, "reviews.csv");
        });
    }

    // ─── EXPORT ──────────────────────────────────────────────
    Object.assign(admin, {
        loadReviews, renderReviews, bindReviewEvents, confirmDeleteReview,
        renderProductGrid, selectProduct
    });

})();