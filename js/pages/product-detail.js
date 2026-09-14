// ─── PRODUCT DETAIL PAGE ────────────────────────────────
import { formatPrice, renderStars, escapeHtml, renderDescription, isYouTubeUrl, getYouTubeEmbedUrl } from '../core/utils.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';
import { showToast } from '../components/toast.js';
import { getCart as readCart, saveCart, getCartCount } from '../core/storage.js';

const TOAST_ID = 'pageToastContainer';

function showPageToast(msg) {
    showToast(TOAST_ID, msg, 2000);
}

// ─── CART ──────────────────────────────────────────────────
function getCart() {
    return readCart();
}

function updateCartUI(cart, products) {
    const countEl = document.getElementById('pageCartCount');
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotalAmount');
    if (!itemsEl || !totalEl) return;
    const count = getCartCount(cart);
    if (countEl) countEl.textContent = count;
    if (cart.length === 0) {
        itemsEl.innerHTML = '<div class="empty-cart-msg">Your cart is empty.</div>';
        totalEl.textContent = '৳ 0';
        return;
    }
    let total = 0;
    let html = '';
    cart.forEach(item => {
        const p = products.find(prod => String(prod.id) === String(item.id));
        if (!p) return;
        total += p.price * item.quantity;
        const img = (p.images && p.images.length) ? (typeof p.images[0] === 'string' ? p.images[0] : p.images[0].url) : p.image;
        html += `
            <div class="cart-item" data-id="${item.id}">
                <div class="item-image"><img src="${img}" alt="${escapeHtml(p.title)}" /></div>
                <div class="item-info">
                    <div class="item-title">${escapeHtml(p.title)}</div>
                    <div class="item-price">${formatPrice(p.price)}</div>
                </div>
                <div class="item-qty">
                    <button data-action="cart-dec" data-id="${item.id}">−</button>
                    <span>${item.quantity}</span>
                    <button data-action="cart-inc" data-id="${item.id}">+</button>
                </div>
                <button class="item-remove" data-action="cart-remove" data-id="${item.id}">✕</button>
            </div>
        `;
    });
    itemsEl.innerHTML = html;
    totalEl.textContent = formatPrice(total);
}

function addToCart(productId, products) {
    let cart = getCart();
    const existing = cart.find(item => String(item.id) === String(productId));
    if (existing) existing.quantity += 1;
    else cart.push({ id: productId, quantity: 1 });
    saveCart(cart);
    updateCartUI(cart, products);
    const btn = document.getElementById('detailAddBtn');
    if (btn && !btn.disabled) {
        btn.textContent = '✓ Added!';
        setTimeout(() => { btn.textContent = 'Add to Cart'; }, 1200);
    }
    const barBtn = document.getElementById('barAddCartBtn');
    if (barBtn) {
        barBtn.textContent = '✓ Added!';
        setTimeout(() => { barBtn.textContent = 'Add to Cart'; }, 1200);
    }
    showPageToast('Added to cart');
    let total = parseInt(localStorage.getItem('grabby_total_cart_adds') || '0');
    total++;
    localStorage.setItem('grabby_total_cart_adds', total);
}

function removeFromCart(productId, products) {
    let cart = getCart();
    const idx = cart.findIndex(item => String(item.id) === String(productId));
    if (idx === -1) return;
    if (cart[idx].quantity > 1) cart[idx].quantity -= 1;
    else cart.splice(idx, 1);
    saveCart(cart);
    updateCartUI(cart, products);
    const btn = document.getElementById('detailAddBtn');
    if (btn && !btn.disabled) {
        const p = products.find(prod => String(prod.id) === String(productId));
        if (p) {
            const inCart = cart.some(item => String(item.id) === String(productId));
            btn.textContent = inCart ? '✓ In Cart' : 'Add to Cart';
        }
    }
    const barBtn = document.getElementById('barAddCartBtn');
    if (barBtn) {
        const p = products.find(prod => String(prod.id) === String(productId));
        if (p) {
            const inCart = cart.some(item => String(item.id) === String(productId));
            barBtn.textContent = inCart ? '✓ In Cart' : 'Add to Cart';
        }
    }
}

function openCart() {
    document.getElementById('cartSidebar').classList.add('active');
    document.getElementById('overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCartFn() {
    document.getElementById('cartSidebar').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
    document.body.style.overflow = 'auto';
}

// ─── LOAD PRODUCT ───────────────────────────────────────
async function loadProduct() {
    let productsData = [];
    try {
        const supabase = createClient();
        if (supabase) {
            const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
            if (!error && data && data.length) {
                productsData = data.map(row => {
                    let images = [];
                    if (row.images) {
                        if (Array.isArray(row.images)) {
                            if (row.images.length > 0 && typeof row.images[0] === 'string') {
                                images = row.images;
                            } else {
                                images = row.images.map(item => item.url || '');
                            }
                        } else if (typeof row.images === 'string') {
                            try {
                                const parsed = JSON.parse(row.images);
                                if (Array.isArray(parsed)) {
                                    if (parsed.length > 0 && typeof parsed[0] === 'string') {
                                        images = parsed;
                                    } else {
                                        images = parsed.map(item => item.url || '');
                                    }
                                } else {
                                    images = [row.images];
                                }
                            } catch {
                                images = [row.images];
                            }
                        } else {
                            images = [row.images];
                        }
                    }
                    if (!images.length && row.image) images = [row.image];
                    if (!images.length) images = ['https://picsum.photos/seed/default/400/400'];

                    const details = row.details || {};
                    return {
                        id: row.id,
                        title: row.title,
                        category: row.category,
                        brand: details.brand || '',
                        price: parseFloat(row.price) || 0,
                        originalPrice: row.original_price ? parseFloat(row.original_price) : null,
                        rating: parseFloat(row.rating) || 0,
                        reviews: parseInt(row.reviews) || 0,
                        sold: details.sold || '',
                        description: row.description || '',
                        image: row.image || images[0],
                        images: images,
                        badge: row.badge || '',
                        inStock: row.in_stock !== false,
                        specs: row.specs || {},
                        shortDesc: details.shortDesc || '',
                        fullDesc: details.fullDesc || '',
                        sections: details.sections || [],
                        related: details.related || []
                    };
                });
            }
        }
    } catch (e) { console.warn('Supabase load failed on product page'); }

    if (!productsData.length) {
        const stored = localStorage.getItem('grabby_products');
        if (stored) { try { productsData = JSON.parse(stored); } catch { productsData = []; } }
    }

    const params = new URLSearchParams(window.location.search);
    const productId = parseInt(params.get('id'));
    const p = productsData.find(prod => String(prod.id) === String(productId));

    if (!p) {
        document.getElementById('productContent').innerHTML =
            '<div style="text-align:center;padding:4rem;color:var(--text-secondary);"><h2>Product not found</h2><a href="index.html" class="back-btn" style="margin-top:1rem;">Back to Shop</a></div>';
        document.getElementById('stickyBar').style.display = 'none';
        return;
    }

    document.title = p.title + ' — Grabby Tech';
    const isWish = (JSON.parse(localStorage.getItem('grabby_wishlist') || '[]')).includes(p.id);
    const cart = getCart();

    let mediaItems = p.images || [p.image];
    if (!Array.isArray(mediaItems)) mediaItems = [mediaItems];
    mediaItems = mediaItems.filter(url => url && typeof url === 'string' && url.trim() !== '');
    if (mediaItems.length === 0) mediaItems = ['https://picsum.photos/seed/default/400/400'];

    const ratingStars = renderStars(p.rating);
    const soldText = p.sold ? ` · Sold: ${p.sold}` : '';
    const brandText = p.brand ? ` · ${p.brand}` : '';
    const discount = p.originalPrice ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
    const savings = p.originalPrice ? p.originalPrice - p.price : 0;
    const badgeHtml = p.badge ? `<span class="badge-product">${p.badge}</span>` : '';

    let sectionsHtml = '';
    if (p.sections && p.sections.length) {
        const enabled = p.sections.filter(s => s.enabled !== false);
        enabled.forEach((s, idx) => {
            const contentHtml = renderDescription(s.content);
            sectionsHtml += `
                <div class="collapsible-section">
                    <button class="section-toggle" aria-expanded="${idx === 0 ? 'true' : 'false'}">
                        <span>${escapeHtml(s.label)}</span>
                        <span class="toggle-icon">${idx === 0 ? '−' : '+'}</span>
                    </button>
                    <div class="section-content-collapsible" style="${idx === 0 ? '' : 'display:none;'}">
                        ${contentHtml}
                    </div>
                </div>
            `;
        });
    }

    let relatedHtml = '';
    let relatedIds = p.related || [];
    let relatedProducts = [];
    if (relatedIds.length) {
        relatedProducts = productsData.filter(rp => relatedIds.includes(rp.id) && rp.id !== p.id);
    }
    if (!relatedProducts.length) {
        relatedProducts = productsData.filter(rp => rp.category === p.category && rp.id !== p.id).slice(0, 4);
    }
    if (relatedProducts.length) {
        relatedHtml = `
            <div class="related-section">
                <h3>You May Also Like</h3>
                <div class="related-grid">
                    ${relatedProducts.map(rp => {
                        const img = (rp.images && rp.images.length) ? rp.images[0] : rp.image;
                        return `<div class="product-card related-card" data-id="${rp.id}">
                            <div class="product-image-container"><img src="${img}" alt="${escapeHtml(rp.title)}" loading="lazy" /></div>
                            <div class="product-info">
                                <div class="product-category">${rp.category}</div>
                                <div class="product-title">${escapeHtml(rp.title)}</div>
                                <div class="product-price">${formatPrice(rp.price)}</div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    const thumbsHtml = mediaItems.map((url, i) => {
        const active = i === 0 ? 'active' : '';
        const isVideo = isYouTubeUrl(url);
        if (isVideo) {
            return `<div class="gallery-thumb ${active}" data-index="${i}">
                    <div class="video-thumb-btn">
                        <span class="play-arrow"></span>
                    </div>
                </div>`;
        }
        return `<div class="gallery-thumb ${active}" data-index="${i}">
                <img src="${url}" alt="Media ${i + 1}" loading="lazy" />
            </div>`;
    }).join('');

    const slidesHtml = mediaItems.map((url) => {
        const isVideo = isYouTubeUrl(url);
        if (isVideo) {
            const embedUrl = getYouTubeEmbedUrl(url);
            const finalSrc = embedUrl && embedUrl.includes('youtube.com/embed/') ? embedUrl : url;
            return `<div class="gallery-slide">
                    <iframe src="${finalSrc}"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        loading="lazy"
                        style="width:100%; height:100%; border:none; background:#000;">
                    </iframe>
                </div>`;
        }
        return `<div class="gallery-slide"><img src="${url}" alt="${escapeHtml(p.title)}" loading="lazy" /></div>`;
    }).join('');

    const inCart = cart.some(item => String(item.id) === String(p.id));
    const btnText = p.inStock ? (inCart ? '✓ In Cart' : 'Add to Cart') : 'Sold Out';
    const btnDisabled = !p.inStock;

    const renderedDesc = renderDescription(p.fullDesc || p.shortDesc || '');
    const renderedShortDesc = renderDescription(p.shortDesc);

    document.getElementById('productContent').innerHTML = `
        <div class="product-detail-grid">
            <div class="product-gallery">
                <div class="gallery-main" id="galleryMain">
                    <div class="gallery-carousel" id="galleryCarousel">
                        <div class="gallery-track" id="galleryTrack">
                            ${slidesHtml}
                        </div>
                        <button class="gallery-nav prev" id="galleryPrev">‹</button>
                        <button class="gallery-nav next" id="galleryNext">›</button>
                        <span class="image-counter" id="imageCounter">1/${mediaItems.length}</span>
                    </div>
                </div>
                <div class="gallery-thumbs" id="galleryThumbs">${thumbsHtml}</div>
            </div>
            <div class="product-detail-info">
                <div class="product-header">
                    <div class="product-category">${p.category.toUpperCase()}</div>
                    <h1 class="product-title">${escapeHtml(p.title)}</h1>
                    <div class="product-rating-row">
                        <span class="stars">${ratingStars}</span>
                        <span class="review-count">(${p.reviews} reviews)</span>
                        ${soldText}
                        ${brandText}
                    </div>
                </div>
                <div class="product-price-section">
                    <div class="price-row">
                        <span class="current-price">${formatPrice(p.price)}</span>
                        ${p.originalPrice ? `<span class="original-price">${formatPrice(p.originalPrice)}</span>` : ''}
                        ${discount > 0 ? `<span class="discount-badge">-${discount}%</span>` : ''}
                    </div>
                    ${savings > 0 ? `<div class="savings">You save ${formatPrice(savings)}</div>` : ''}
                    ${badgeHtml}
                </div>
                ${p.shortDesc ? `<div class="short-desc">${renderedShortDesc}</div>` : ''}
                <div class="product-sections">
                    ${sectionsHtml}
                </div>
                <div class="product-detail-actions">
                    <button class="detail-add-btn" id="detailAddBtn" ${!p.inStock ? 'disabled' : ''}>${btnText}</button>
                    <button class="detail-wish-btn ${isWish ? 'liked' : ''}" id="detailWishBtn">${isWish ? '♥' : '♡'}</button>
                </div>
                <div class="product-detail-meta">
                    <span class="${p.inStock ? 'stock-in' : 'stock-out'}">📦 ${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
                    <span>Verified Product ✅</span>
                    <span>↩️ 7-day return</span>
                </div>
            </div>
        </div>
        ${relatedHtml}
    `;

    // ─── CAROUSEL LOGIC ──────────────────────────────────
    const trackEl = document.getElementById('galleryTrack');
    const slides = trackEl.querySelectorAll('.gallery-slide');
    const totalSlides = slides.length;
    const galleryPrevBtn = document.getElementById('galleryPrev');
    const galleryNextBtn = document.getElementById('galleryNext');
    const counter = document.getElementById('imageCounter');

    if (totalSlides === 0) {
        trackEl.innerHTML =
            `<div class="gallery-slide"><div style="color:var(--text-secondary); padding:2rem;">No media available</div></div>`;
        counter.textContent = '0/0';
        galleryPrevBtn.classList.add('hidden');
        galleryNextBtn.classList.add('hidden');
        return;
    }

    let currentIndex = 0;
    let isAnimating = false;

    const thumbs = document.querySelectorAll('.gallery-thumb');
    const mainContainer = document.getElementById('galleryMain');
    const zoomOverlay = document.getElementById('zoomOverlay');
    const zoomImg = document.getElementById('zoomImage');
    const zoomClose = document.getElementById('zoomCloseBtn');

    function updateCarousel(index, animate = true) {
        if (isAnimating) return;
        if (index < 0) index = totalSlides - 1;
        if (index >= totalSlides) index = 0;
        const offset = -index * 100;
        trackEl.style.transition = animate ? 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
        trackEl.style.transform = `translateX(${offset}%)`;
        currentIndex = index;
        thumbs.forEach((thumb, i) => {
            thumb.classList.toggle('active', i === currentIndex);
        });
        counter.textContent = `${currentIndex + 1}/${totalSlides}`;
        galleryPrevBtn.classList.toggle('hidden', totalSlides <= 1);
        galleryNextBtn.classList.toggle('hidden', totalSlides <= 1);
        const activeThumb = thumbs[currentIndex];
        if (activeThumb) {
            activeThumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        if (animate) {
            isAnimating = true;
            setTimeout(() => { isAnimating = false; }, 350);
        }
    }

    thumbs.forEach((thumb, i) => {
        thumb.addEventListener('click', () => updateCarousel(i));
    });

    galleryPrevBtn.addEventListener('click', () => updateCarousel(currentIndex - 1));
    galleryNextBtn.addEventListener('click', () => updateCarousel(currentIndex + 1));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') updateCarousel(currentIndex - 1);
        if (e.key === 'ArrowRight') updateCarousel(currentIndex + 1);
    });

    let startX = 0;
    let isSwiping = false;
    mainContainer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isSwiping = true;
    }, { passive: true });
    mainContainer.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) updateCarousel(currentIndex + 1);
            else updateCarousel(currentIndex - 1);
        }
        isSwiping = false;
    }, { passive: true });

    function isCurrentSlideImage() {
        const slide = slides[currentIndex];
        if (!slide) return false;
        return slide.querySelector('img') !== null;
    }

    mainContainer.addEventListener('click', (e) => {
        const img = e.target.closest('img');
        if (img && isCurrentSlideImage()) {
            zoomImg.src = img.src;
            zoomOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    });

    function closeZoom() {
        zoomOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    zoomClose.addEventListener('click', closeZoom);
    zoomOverlay.addEventListener('click', (e) => {
        if (e.target === zoomOverlay) closeZoom();
    });

    let lastTap = 0;
    mainContainer.addEventListener('touchstart', (e) => {
        const now = Date.now();
        if (now - lastTap < 300 && isCurrentSlideImage()) {
            const img = slides[currentIndex]?.querySelector('img');
            if (img) {
                zoomImg.src = img.src;
                if (zoomOverlay.classList.contains('active')) closeZoom();
                else {
                    zoomOverlay.classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }
        }
        lastTap = now;
    }, { passive: true });

    updateCarousel(0, false);

    // ─── COLLAPSIBLE SECTIONS ──────────────────────────
    document.querySelectorAll('.section-toggle').forEach(btn => {
        btn.addEventListener('click', function () {
            const content = this.nextElementSibling;
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : 'block';
            this.querySelector('.toggle-icon').textContent = isOpen ? '+' : '−';
            this.setAttribute('aria-expanded', !isOpen);
        });
    });

    // ─── WISHLIST ────────────────────────────────────────
    function updateWishlistUI() {
        const wishData = new Set(JSON.parse(localStorage.getItem('grabby_wishlist') || '[]'));
        const liked = wishData.has(p.id);
        const btns = [document.getElementById('detailWishBtn'), document.getElementById('barWishlistBtn')];
        btns.forEach(btn => {
            if (btn) {
                btn.textContent = liked ? '♥' : '♡';
                btn.classList.toggle('liked', liked);
            }
        });
    }

    function toggleWishlist() {
        let wishData = new Set(JSON.parse(localStorage.getItem('grabby_wishlist') || '[]'));
        const liked = wishData.has(p.id);
        if (liked) wishData.delete(p.id);
        else wishData.add(p.id);
        localStorage.setItem('grabby_wishlist', JSON.stringify([...wishData]));
        updateWishlistUI();
        showPageToast(liked ? 'Removed from wishlist' : 'Added to wishlist');
    }

    document.getElementById('detailWishBtn')?.addEventListener('click', toggleWishlist);
    document.getElementById('barWishlistBtn')?.addEventListener('click', toggleWishlist);
    updateWishlistUI();

    // ─── ADD TO CART ──────────────────────────────────────
    function handleAddToCart() {
        if (!p.inStock) return;
        addToCart(p.id, productsData);
        const cartNow = getCart();
        const inCartNow = cartNow.some(item => String(item.id) === String(p.id));
        const btn = document.getElementById('detailAddBtn');
        if (btn) btn.textContent = inCartNow ? '✓ In Cart' : 'Add to Cart';
        const barBtn = document.getElementById('barAddCartBtn');
        if (barBtn) barBtn.textContent = inCartNow ? '✓ In Cart' : 'Add to Cart';
    }

    document.getElementById('detailAddBtn')?.addEventListener('click', handleAddToCart);
    document.getElementById('barAddCartBtn')?.addEventListener('click', handleAddToCart);

    // ─── BUY NOW ─────────────────────────────────────────
    document.getElementById('barBuyNowBtn')?.addEventListener('click', () => {
        if (!p.inStock) { showPageToast('Out of stock'); return; }
        window.location.href = `checkout.html?product_id=${encodeURIComponent(p.id)}&quantity=1`;
    });

    // ─── SHARE ──────────────────────────────────────────
    document.getElementById('barShareBtn')?.addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({
                title: p.title,
                text: `Check out ${p.title} on Grabby Tech!`,
                url: window.location.href
            }).catch(() => { });
        } else {
            navigator.clipboard.writeText(window.location.href).then(() => {
                showPageToast('Link copied to clipboard!');
            }).catch(() => {
                showPageToast('Share: ' + window.location.href);
            });
        }
    });

    // ─── RELATED PRODUCT CLICKS ─────────────────────────
    document.querySelectorAll('.related-card').forEach(card => {
        card.addEventListener('click', function () {
            window.location.href = 'product.html?id=' + this.dataset.id;
        });
    });

    // ─── CART SIDEBAR EVENTS ────────────────────────────
    updateCartUI(cart, productsData);
    document.getElementById('pageCartBtn')?.addEventListener('click', openCart);
    document.getElementById('cartCloseBtn')?.addEventListener('click', closeCartFn);
    document.getElementById('overlay')?.addEventListener('click', closeCartFn);

    document.getElementById('cartItems')?.addEventListener('click', (e) => {
        const inc = e.target.closest('[data-action="cart-inc"]');
        const dec = e.target.closest('[data-action="cart-dec"]');
        const remove = e.target.closest('[data-action="cart-remove"]');
        if (inc) {
            const id = parseInt(inc.dataset.id);
            addToCart(id, productsData);
        } else if (dec) {
            const id = parseInt(dec.dataset.id);
            removeFromCart(id, productsData);
        } else if (remove) {
            const id = parseInt(remove.dataset.id);
            let cartNow = getCart();
            cartNow = cartNow.filter(item => String(item.id) !== String(id));
            saveCart(cartNow);
            updateCartUI(cartNow, productsData);
            const btn = document.getElementById('detailAddBtn');
            if (btn && !btn.disabled) {
                const pNow = productsData.find(prod => String(prod.id) === String(id));
                if (pNow) {
                    const inCartNow = cartNow.some(item => String(item.id) === String(id));
                    btn.textContent = inCartNow ? '✓ In Cart' : 'Add to Cart';
                }
            }
            const barBtn = document.getElementById('barAddCartBtn');
            if (barBtn) {
                const pNow = productsData.find(prod => String(prod.id) === String(id));
                if (pNow) {
                    const inCartNow = cartNow.some(item => String(item.id) === String(id));
                    barBtn.textContent = inCartNow ? '✓ In Cart' : 'Add to Cart';
                }
            }
            showPageToast('Removed from cart');
        }
    });

    document.getElementById('checkoutBtn')?.addEventListener('click', () => {
        const cartNow = getCart();
        if (!cartNow.length) { showPageToast('Cart is empty'); return; }
        window.location.href = 'checkout.html';
    });

    document.getElementById('stickyBar').style.display = 'block';
}

// ─── INIT ───────────────────────────────────────────────
loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'grabby_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

loadProduct();