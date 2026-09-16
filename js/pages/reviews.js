// ─── PRODUCT REVIEWS MODULE ────────────────────────────────
// Renders the review summary, the review list (with images / YouTube
// video) and the write-a-review form for the Product Detail page.
//
// Gating rules (enforced again server-side by reviews.sql):
//   * Only a logged-in customer who owns a "delivered" order for the
//     product may write a review.
//   * Review submission always goes through the SECURITY DEFINER RPC
//     submit_customer_review — direct inserts are impossible.
import { renderStars, escapeHtml, isYouTubeUrl, getYouTubeEmbedUrl, getYouTubeThumbnail } from '../core/utils.js';
import { createClient } from '../supabase/client.js';
import { showToast } from '../components/toast.js';
import { initAuthModal, openAuthModal } from '../components/auth-modal.js';
import { getImgBBKey } from '../core/imgbb.js';

const TOAST_ID = 'pageToastContainer';

function showToastMsg(msg, type = 'info') {
    showToast(TOAST_ID, msg, 2500);
}

function getSupabase() {
    return createClient();
}

// ─── IMG UPLOAD (uses the store's ImgBB key configured in Admin → Settings) ──
export async function uploadReviewImage(file) {
    if (!file) throw new Error('No file selected');
    if (!file.type.startsWith('image/')) throw new Error('Please select an image file');
    const key = getImgBBKey();
    if (!key) throw new Error('Photo uploads are disabled on this demo store.');
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(key), {
        method: 'POST',
        body: formData
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Image upload failed: ' + (data.error?.message || 'Unknown error'));
    return data.data.url;
}

// ─── VERIFY PURCHASE (mirrors the DB check) ─────────────────
export async function hasDeliveredPurchase(supabase, userId, productId) {
    if (!supabase || !userId || !productId) return false;
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('id, status')
            .eq('user_id', userId)
            .eq('status', 'delivered');
        if (error || !data || !data.length) return false;
        const orderIds = data.map(o => o.id);
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('product_id')
            .in('order_id', orderIds)
            .eq('product_id', productId);
        return !itemsError && !!items && items.length > 0;
    } catch (e) {
        return false;
    }
}

function normalizeMedia(review) {
    let images = [];
    const raw = review.images;
    if (raw) {
        if (Array.isArray(raw)) {
            images = raw.map(item => (typeof item === 'string' ? item : ((item && item.url) || ''))).filter(url => url);
        } else if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    images = parsed.map(item => (typeof item === 'string' ? item : ((item && item.url) || ''))).filter(url => url);
                } else if (parsed) {
                    images = [parsed.url || raw];
                }
            } catch {
                images = [raw];
            }
        }
    }
    const video = (review.video_url && isYouTubeUrl(review.video_url)) ? review.video_url : null;
    return { images, video };
}

function reviewerInitial(name) {
    const n = (name || 'V').trim();
    return n.charAt(0).toUpperCase();
}

function reviewAvatar(name) {
    return `<span class="review-avatar" aria-hidden="true">${escapeHtml(reviewerInitial(name))}</span>`;
}

function reviewMediaHtml(media) {
    let html = '';
    if (media.video) {
        html += `
            <div class="review-media-item review-video">
                <div class="review-video-embed">
                    <iframe src="${getYouTubeEmbedUrl(media.video)}"
                        title="Review video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        loading="lazy"
                        style="width:100%; height:100%; border:none; background:#000;"></iframe>
                </div>
            </div>`;
    }
    media.images.forEach(url => {
        html += `
            <div class="review-media-item">
                <img src="${escapeHtml(url)}" alt="Review photo" loading="lazy" data-review-img="${escapeHtml(url)}" />
            </div>`;
    });
    return html ? `<div class="review-media">${html}</div>` : '';
}

function renderReviewCard(review) {
    const media = normalizeMedia(review);
    const date = review.created_at ? new Date(review.created_at).toLocaleDateString() : '';
    const tag = review.source === 'admin' ? '<span class="review-source-tag">Demo store</span>' : '<span class="review-source-tag verified">Verified Purchase</span>';
    return `
        <div class="review-item" data-review-id="${escapeHtml(review.id)}">
            <div class="review-avatar-wrap">${reviewAvatar(review.reviewer_name)}</div>
            <div class="review-body">
                <div class="review-meta">
                    <span class="review-name">${escapeHtml(review.reviewer_name)}</span>
                    ${tag}
                    <span class="review-date">${escapeHtml(date)}</span>
                </div>
                <div class="review-stars"><span class="stars">${renderStars(review.rating)}</span><span class="review-rating-num">${review.rating}.0</span></div>
                ${review.review_text ? `<p class="review-text">${escapeHtml(review.review_text)}</p>` : ''}
                ${reviewMediaHtml(media)}
            </div>
        </div>
    `;
}

function buildSummaryHtml(reviews) {
    const total = reviews.length;
    if (!total) {
        return `
            <div class="review-summary empty">
                <div class="review-summary-score">
                    <div class="review-summary-number">0</div>
                    <div class="review-summary-stars"><span class="stars">☆☆☆☆☆</span></div>
                    <div class="review-summary-count">No reviews yet</div>
                </div>
                <div class="review-summary-bars"></div>
            </div>`;
    }
    const avg = reviews.reduce((sum, r) => sum + Number(r.rating) || 0, 0) / total;
    const buckets = [5, 4, 3, 2, 1].map(star => {
        const count = reviews.filter(r => Number(r.rating) === star).length;
        const pct = Math.round((count / total) * 100);
        return { star, count, pct };
    });
    return `
        <div class="review-summary">
            <div class="review-summary-score">
                <div class="review-summary-number">${avg.toFixed(1)}</div>
                <div class="review-summary-stars"><span class="stars">${renderStars(avg)}</span></div>
                <div class="review-summary-count">${total} review${total > 1 ? 's' : ''}</div>
            </div>
            <div class="review-summary-bars">
                ${buckets.map(b => `
                    <div class="review-bar-row">
                        <span class="review-bar-label">${b.star}★</span>
                        <span class="review-bar-track"><span class="review-bar-fill" style="width:${b.pct}%"></span></span>
                        <span class="review-bar-count">${b.count}</span>
                    </div>`).join('')}
            </div>
        </div>`;
}

function buildWriteGate(supabase, user, productId) {
    if (!user) {
        // Visitors can read reviews but must sign in before we can verify a purchase.
        return `
            <div class="review-write-gate">
                <button type="button" class="review-login-btn" id="reviewLoginBtn">Sign in to write a review</button>
                <p class="review-gate-note">Only customers who purchased and received this product can write a review.</p>
            </div>`;
    }
    return `
        <div class="review-write-gate">
            <p class="review-gate-note">You can write a review once your order for this product is <strong>delivered</strong>.</p>
        </div>`;
}

function buildWriteForm() {
    return `
        <div class="review-form" id="reviewForm">
            <div class="review-form-head">
                <span>Write a Review</span>
                <button type="button" class="review-close-form" id="reviewCloseFormBtn">✕</button>
            </div>
            <div class="review-form-body">
                <div class="review-form-field">
                    <label>Your rating *</label>
                    <div class="review-star-picker" id="reviewStarPicker" data-value="0">
                        ${[1, 2, 3, 4, 5].map(i => `<span class="review-star" data-star="${i}">★</span>`).join('')}
                        <span class="review-star-label">Select a rating</span>
                    </div>
                </div>
                <div class="review-form-field">
                    <label>Your review</label>
                    <textarea id="reviewText" rows="4" placeholder="Share your experience with this product..." maxlength="2000"></textarea>
                </div>
                <div class="review-form-field">
                    <label>Add photos (optional)</label>
                    <div class="review-upload-row">
                        <button type="button" class="review-upload-btn" id="reviewUploadBtn">📷 Upload Image</button>
                        <input type="file" id="reviewImageInput" accept="image/*" multiple style="display:none;" />
                    </div>
                    <div class="review-upload-previews" id="reviewUploadPreviews"></div>
                </div>
                <button type="button" class="review-submit-btn" id="reviewSubmitBtn">Submit Review</button>
            </div>
        </div>`;
}

// ─── MAIN RENDER ─────────────────────────────────────────────
export async function renderReviews(container, productId) {
    if (!container) return;
    const supabase = getSupabase();
    const user = supabase ? ((await supabase.auth.getUser()).data?.user || null) : null;

    container.innerHTML = `
        <div class="reviews-section">
            <h3 class="reviews-heading">Product Reviews</h3>
            <div class="reviews-loading">Loading reviews…</div>
        </div>`;

    let reviews = [];
    try {
        if (supabase) {
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('product_id', productId)
                .eq('is_published', true)
                .order('created_at', { ascending: false });
            if (!error && data) reviews = data;
        }
    } catch (e) { /* show nothing if DB unavailable */ }

    const canReview = user ? await hasDeliveredPurchase(supabase, user.id, productId) : false;
    const alreadyReviewed = !!(user && reviews.some(r => r.user_id && String(r.user_id) === String(user.id)));

    let writeHtml;
    if (!user) {
        writeHtml = buildWriteGate(supabase, user, productId);
    } else if (alreadyReviewed) {
        writeHtml = `<div class="review-write-gate"><p class="review-gate-note">You have already reviewed this product.</p></div>`;
    } else if (canReview) {
        writeHtml = buildWriteForm();
    } else {
        writeHtml = buildWriteGate(supabase, user, productId);
    }

    container.innerHTML = `
        <div class="reviews-section" id="reviewsSection">
            <h3 class="reviews-heading">Product Reviews</h3>
            ${buildSummaryHtml(reviews)}
            <div class="review-list">
                ${reviews.length ? reviews.map(renderReviewCard).join('') : '<p class="review-none">No reviews yet. Be the first to review this product!</p>'}
            </div>
            <div class="review-write-area">
                <div class="review-write-heading">${!user ? 'Write a Review' : (alreadyReviewed ? 'Your Review' : (canReview ? 'Share your experience' : 'Write a Review'))}</div>
                ${writeHtml}
            </div>
        </div>`;

    bindReviewEvents(container, supabase, user, productId, canReview, alreadyReviewed, reviews);
}

function bindReviewEvents(container, supabase, user, productId, canReview, alreadyReviewed, reviews) {
    // Lightbox for review images
    container.addEventListener('click', e => {
        const img = e.target.closest('[data-review-img]');
        if (!img || img.closest('a')) return;
        const overlay = document.getElementById('zoomOverlay');
        const zoomImg = document.getElementById('zoomImage');
        if (overlay && zoomImg) {
            zoomImg.src = img.dataset.reviewImg;
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    });

    // Open review form for a signed-out / eligible visitor
    const loginBtn = container.querySelector('#reviewLoginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            initAuthModal();
            openAuthModal({
                mode: 'signin',
                onSuccess: async () => {
                    toast('Signed in successfully');
                    await renderReviews(container, productId);
                },
                onNotice: m => toast(m)
            });
        });
    }

    // Close the write form inline (read-only stays)
    const closeFormBtn = container.querySelector('#reviewCloseFormBtn');
    if (closeFormBtn) {
        closeFormBtn.addEventListener('click', () => {
            container.querySelector('.review-write-area').innerHTML = buildWriteGate(supabase, user, productId);
        });
    }

    const form = container.querySelector('#reviewForm');
    if (!form) return;

    // Star picker
    const picker = form.querySelector('#reviewStarPicker');
    let rating = 0;
    if (picker) {
        const stars = picker.querySelectorAll('.review-star');
        const label = picker.querySelector('.review-star-label');
        const paint = v => {
            stars.forEach(s => {
                const sv = parseInt(s.dataset.star);
                s.classList.toggle('lit', sv <= v);
            });
        };
        stars.forEach(s => {
            s.addEventListener('mouseenter', () => paint(parseInt(s.dataset.star)));
            s.addEventListener('click', () => {
                rating = parseInt(s.dataset.star);
                picker.dataset.value = rating;
                label.textContent = rating === 0 ? 'Select a rating' : `${rating} star${rating > 1 ? 's' : ''}`;
                paint(rating);
            });
        });
        picker.addEventListener('mouseleave', () => paint(rating));
    }

    // Image uploads (reuses ImgBB)
    const uploadBtn = form.querySelector('#reviewUploadBtn');
    const fileInput = form.querySelector('#reviewImageInput');
    const previewsWrap = form.querySelector('#reviewUploadPreviews');
    const uploaded = [];
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
            const files = Array.from(fileInput.files || []).slice(0, 6 - uploaded.length);
            if (!files.length) return;
            uploadBtn.textContent = '⏳ Uploading…';
            uploadBtn.disabled = true;
            for (const file of files) {
                try {
                    const url = await uploadReviewImage(file);
                    uploaded.push(url);
                    const chip = document.createElement('div');
                    chip.className = 'review-upload-chip';
                    chip.innerHTML = `<img src="${escapeHtml(url)}" alt=""><button type="button" class="review-upload-remove" data-url="${escapeHtml(url)}">✕</button>`;
                    previewsWrap.appendChild(chip);
                } catch (err) {
                    showToastMsg(err.message || 'Upload failed', 'error');
                }
            }
            uploadBtn.textContent = '📷 Upload Image';
            uploadBtn.disabled = false;
            fileInput.value = '';
        });
        previewsWrap.addEventListener('click', e => {
            const btn = e.target.closest('.review-upload-remove');
            if (!btn) return;
            const idx = uploaded.indexOf(btn.dataset.url);
            if (idx > -1) uploaded.splice(idx, 1);
            btn.closest('.review-upload-chip')?.remove();
        });
    }

    // Submit via secure RPC
    const submitBtn = form.querySelector('#reviewSubmitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (rating < 1) { showToastMsg('Please select a star rating.', 'warning'); return; }
            const text = form.querySelector('#reviewText').value.trim();
            if (!text) { showToastMsg('Please write a few words about the product.', 'warning'); return; }
            if (!supabase) { showToastMsg('Could not connect. Please try again later.', 'error'); return; }

            submitBtn.textContent = 'Submitting…';
            submitBtn.disabled = true;
            try {
                const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Verified Buyer';
                const { data, error } = await supabase.rpc('submit_customer_review', {
                    p_product_id: productId,
                    p_reviewer_name: name,
                    p_rating: rating,
                    p_review_text: text,
                    p_images: uploaded,
                    p_video_url: null
                });
                if (error) throw error;
                const result = data && data[0] ? data[0] : data;
                if (!result || result.ok !== true) {
                    const code = result?.error || 'UNKNOWN';
                    const msg = code === 'PRODUCT_NOT_PURCHASED'
                        ? 'You can only review products you purchased and received.'
                        : code === 'ALREADY_REVIEWED'
                            ? 'You have already reviewed this product.'
                            : code === 'NOT_AUTHENTICATED'
                                ? 'Please sign in to write a review.'
                                : 'Could not submit your review. Please try again.';
                    showToastMsg(msg, code === 'PRODUCT_NOT_PURCHASED' ? 'warning' : 'error');
                    return;
                }
                showToastMsg('Thank you! Your review has been posted.', 'success');
                await renderReviews(container, productId);
            } catch (err) {
                showToastMsg('Could not submit your review: ' + (err.message || err), 'error');
            } finally {
                submitBtn.textContent = 'Submit Review';
                submitBtn.disabled = false;
            }
        });
    }
}

export default { renderReviews, uploadReviewImage, hasDeliveredPurchase };