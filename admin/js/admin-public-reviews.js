/* ─── ADMIN PUBLIC REVIEWS: customer review moderation (view, edit, hide/publish, delete) ─── */
(() => {

    "use strict";

    const admin = window.admin;
    const { STATE, DOM, showToast, escapeHTML, isYouTubeUrl, getYouTubeThumbnail } = admin;

    const RATING_NUMBERS = [5, 4, 3, 2, 1];
    let uploadedImages = [];
    let deleteReviewId = null;

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

    async function loadPublicReviews() {
        if (!STATE.supabase) return;
        populateState();
        try {
            const { data, error } = await STATE.supabase
                .from("reviews")
                .select("*")
                .eq("source", "customer")
                .order("created_at", { ascending: false });
            if (error) throw error;
            STATE.publicReviews = normalizeReviews(data);
        } catch (err) {
            showToast("Could not load reviews: " + (err.message || err), "error");
            STATE.publicReviews = [];
        }
        renderPublicReviews();
    }

    // ─── RENDER LIST ─────────────────────────────────────────
    function productTitle(productId) {
        const p = (STATE.products || []).find(prod => String(prod.id) === String(productId));
        return p ? p.title : ('#' + productId);
    }

    function renderPublicReviews() {
        if (!DOM.publicReviewsTableBody) return;
        const reviews = STATE.publicReviews || [];
        if (!reviews.length) {
            DOM.publicReviewsTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No customer reviews yet.</td></tr>`;
            return;
        }
        DOM.publicReviewsTableBody.innerHTML = reviews.map(r => {
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
                <td>${escapeHTML(r.reviewer_name)}</td>
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
        if (!DOM.publicReviewFormArea || !review) return;
        DOM.publicReviewFormArea.style.display = "block";
        DOM.publicReviewFormTitle.textContent = "Edit Review";
        DOM.publicReviewRating.innerHTML = buildRatingSelect(review.rating);
        DOM.publicReviewId.value = review.id;
        DOM.publicReviewName.value = review.reviewer_name;
        DOM.publicReviewRating.value = String(review.rating);
        DOM.publicReviewText.value = review.review_text;
        DOM.publicReviewVideo.value = review.video_url || '';
        DOM.publicReviewPublished.checked = review.is_published;
        uploadedImages = [...(review.images || [])];
        DOM.publicReviewCurrentProduct.innerHTML = `Product: <strong>${escapeHTML(productTitle(review.product_id))}</strong>`;
        renderImagePreviews();
        DOM.publicReviewFormArea.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function hideForm() {
        if (DOM.publicReviewFormArea) DOM.publicReviewFormArea.style.display = "none";
        uploadedImages = [];
        renderImagePreviews();
    }

    function renderImagePreviews() {
        if (!DOM.publicReviewImagesPreview) return;
        if (!uploadedImages.length) {
            DOM.publicReviewImagesPreview.innerHTML = '<span class="form-hint">No images uploaded yet.</span>';
            return;
        }
        DOM.publicReviewImagesPreview.innerHTML = uploadedImages.map((url, index) => `
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
        DOM.publicReviewUploadBtn.disabled = true;
        DOM.publicReviewUploadBtn.textContent = "Uploading…";
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
            DOM.publicReviewUploadBtn.disabled = false;
            DOM.publicReviewUploadBtn.textContent = "📷 Upload Image";
            DOM.publicReviewUploadInput.value = "";
        }
    }

    function collectPayload() {
        const rating = parseInt(DOM.publicReviewRating.value) || 5;
        const name = DOM.publicReviewName.value.trim() || "Verified Buyer";
        const text = DOM.publicReviewText.value.trim();
        const videoUrl = DOM.publicReviewVideo.value.trim();
        if (!text) throw new Error("Please enter the review text.");
        if (videoUrl && !isYouTubeUrl(videoUrl)) throw new Error("Please enter a valid YouTube link.");
        // Keep product_id / user_id / source unchanged so the review stays
        // linked to its product and the DB constraint stays satisfied.
        return {
            reviewer_name: name,
            rating: Math.min(5, Math.max(1, rating)),
            review_text: text,
            images: uploadedImages,
            video_url: videoUrl || null,
            is_published: DOM.publicReviewPublished.checked
        };
    }

    async function savePublicReview() {
        let payload;
        try {
            payload = collectPayload();
        } catch (err) {
            showToast(err.message, "warning");
            return;
        }
        if (!STATE.supabase) return;
        const id = DOM.publicReviewId.value;
        if (!id) return;
        DOM.savePublicReviewBtn.disabled = true;
        DOM.savePublicReviewBtn.textContent = "Saving…";
        try {
            const { error } = await STATE.supabase.from("reviews").update(payload).eq("id", id);
            if (error) throw error;
            showToast("Review updated.", "success");
            hideForm();
            await loadPublicReviews();
        } catch (err) {
            showToast("Save failed: " + (err.message || err), "error");
        } finally {
            DOM.savePublicReviewBtn.disabled = false;
            DOM.savePublicReviewBtn.textContent = "Save Review";
        }
    }

    async function toggleReview(id) {
        if (!STATE.supabase) return;
        const review = (STATE.publicReviews || []).find(r => String(r.id) === String(id));
        if (!review) return;
        const next = !review.is_published;
        try {
            const { error } = await STATE.supabase.from("reviews").update({ is_published: next }).eq("id", id);
            if (error) throw error;
            review.is_published = next;
            showToast(next ? "Review published." : "Review hidden.", "success");
            renderPublicReviews();
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

    async function confirmDeletePublicReview() {
        if (!deleteReviewId) return;
        if (!STATE.supabase) return;
        try {
            const { error } = await STATE.supabase.from("reviews").delete().eq("id", deleteReviewId);
            if (error) throw error;
            showToast("Review deleted.", "success");
            await loadPublicReviews();
        } catch (err) {
            showToast("Delete failed: " + (err.message || err), "error");
        } finally {
            deleteReviewId = null;
            DOM.confirmOverlay.classList.remove("active");
        }
    }

    function populateState() {
        DOM.publicReviewsTableBody = document.getElementById("publicReviewsTableBody");
        DOM.publicReviewFormArea = document.getElementById("publicReviewFormArea");
        DOM.publicReviewFormTitle = document.getElementById("publicReviewFormTitle");
        DOM.publicReviewId = document.getElementById("publicReviewId");
        DOM.publicReviewCurrentProduct = document.getElementById("publicReviewCurrentProduct");
        DOM.publicReviewName = document.getElementById("publicReviewName");
        DOM.publicReviewRating = document.getElementById("publicReviewRating");
        DOM.publicReviewText = document.getElementById("publicReviewText");
        DOM.publicReviewVideo = document.getElementById("publicReviewVideo");
        DOM.publicReviewPublished = document.getElementById("publicReviewPublished");
        DOM.publicReviewUploadBtn = document.getElementById("publicReviewUploadBtn");
        DOM.publicReviewUploadInput = document.getElementById("publicReviewUploadInput");
        DOM.publicReviewImagesPreview = document.getElementById("publicReviewImagesPreview");
        DOM.savePublicReviewBtn = document.getElementById("savePublicReviewBtn");
        DOM.cancelPublicReviewBtn = document.getElementById("cancelPublicReviewBtn");
        DOM.exportPublicReviewsBtn = document.getElementById("exportPublicReviewsBtn");
    }

    // ─── EVENTS ──────────────────────────────────────────────
    function bindPublicReviewEvents() {
        populateState();

        DOM.cancelPublicReviewBtn?.addEventListener("click", hideForm);
        DOM.savePublicReviewBtn?.addEventListener("click", savePublicReview);
        DOM.publicReviewUploadBtn?.addEventListener("click", () => DOM.publicReviewUploadInput?.click());
        DOM.publicReviewUploadInput?.addEventListener("change", e => onUploadImages(e.target.files));
        DOM.publicReviewImagesPreview?.addEventListener("click", e => {
            const btn = e.target.closest("[data-remove-img]");
            if (!btn) return;
            const index = Number(btn.dataset.removeImg);
            if (index > -1 && index < uploadedImages.length) {
                uploadedImages.splice(index, 1);
                renderImagePreviews();
            }
        });

        DOM.publicReviewsTableBody?.addEventListener("click", async e => {
            const edit = e.target.closest("[data-edit-review]");
            const toggle = e.target.closest("[data-toggle-review]");
            const del = e.target.closest("[data-delete-review]");
            const lightbox = e.target.closest("[data-lightbox]");
            if (edit) {
                const review = (STATE.publicReviews || []).find(r => String(r.id) === String(edit.dataset.editReview));
                if (review) showForm(review);
            } else if (toggle) {
                await toggleReview(toggle.dataset.toggleReview);
            } else if (del) {
                openDeleteReview(del.dataset.deleteReview);
            } else if (lightbox) {
                admin.openLightbox(lightbox.dataset.lightbox);
            }
        });

        DOM.exportPublicReviewsBtn?.addEventListener("click", () => {
            const rows = (STATE.publicReviews || []).map(r => [
                productTitle(r.product_id),
                r.reviewer_name,
                r.rating,
                r.review_text,
                r.images.join('|'),
                r.video_url,
                r.is_published ? 'published' : 'hidden',
                r.created_at ? r.created_at : ''
            ]);
            admin.exportCSV(["Product", "Reviewer", "Rating", "Review", "Images", "Video URL", "Status", "Created"], rows, "public-reviews.csv");
        });
    }

    // ─── EXPORT ──────────────────────────────────────────────
    Object.assign(admin, {
        loadPublicReviews, renderPublicReviews, bindPublicReviewEvents, confirmDeletePublicReview
    });

})();