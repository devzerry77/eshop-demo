// ─── CHECKOUT PAGE ──────────────────────────────────────
import { formatPrice, escapeHtml, parseStockQty, resolveStock, canFulfill } from '../core/utils.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';
import { showToast } from '../components/toast.js';
import { initAuthModal, openAuthModal, closeAuthModal, checkOAuthErrorAndShow } from '../components/auth-modal.js';
import { createAddressSelects } from '../components/address-selects.js';
import { getCart, setCoupon, clearCoupon, getCoupon } from '../core/storage.js';
import { loadStoreSettings, calcShipping } from '../core/store-settings.js';

const TOAST_ID = 'checkoutToast';

function showToastMsg(msg, type = 'info') {
    showToast(TOAST_ID, msg, 2000);
}

function getSupabase() {
    return createClient();
}

// ─── NETWORK FAST-FAIL ─────────────────────────────────────
function withTimeout(promise, ms = 10000, label = 'Request') {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(label + ' timed out')), ms);
        promise.then(
            (v) => { clearTimeout(t); resolve(v); },
            (e) => { clearTimeout(t); reject(e); }
        );
    });
}

// ─── CUSTOMER ORDER MODE (Admin → Settings → Customer Order Mode) ───
// 'login' (secure default): customers must sign in before checkout.
// 'guest': guest checkout allowed; logged-in flow works unchanged.
// The saved setting lives in the existing `settings` table
// (key = customer_order_mode) and is cached for instant paint.
const ORDER_MODE_KEY = 'customer_order_mode';
const ORDER_MODE_CACHE = 'eshop_customer_order_mode';
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
let orderMode = 'login';
let isGuestCheckout = false;
let placingOrder = false;

function getCachedOrderMode() {
    try {
        return localStorage.getItem(ORDER_MODE_CACHE) === 'guest' ? 'guest' : 'login';
    } catch { return 'login'; }
}

async function loadOrderMode() {
    orderMode = getCachedOrderMode();
    if (!supabase) return orderMode;
    try {
        const { data, error } = await withTimeout(
            supabase.from('settings').select('value').eq('key', ORDER_MODE_KEY).maybeSingle(),
            8000, 'Loading order mode'
        );
        if (!error && data && (data.value === 'guest' || data.value === 'login')) {
            orderMode = data.value;
            try { localStorage.setItem(ORDER_MODE_CACHE, orderMode); } catch { /* noop */ }
        }
    } catch (e) {
        console.warn('Order mode load failed, defaulting to login:', e);
    }
    return orderMode;
}

// ─── INPUT SANITIZATION (length-cap + strip control chars) ───
function cleanStr(value, max) {
    return String(value || '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim().slice(0, max);
}

function readBillingForm() {
    const loc = billingSelects ? billingSelects.getValues() : { division: '', district: '', area: '' };
    return {
        name: cleanStr(document.getElementById('billingName').value, 80),
        email: cleanStr(document.getElementById('billingEmail').value, 320).toLowerCase(),
        phone: cleanStr(document.getElementById('billingPhone').value, 30),
        address1: cleanStr(document.getElementById('billingAddress1').value, 200),
        address2: cleanStr(document.getElementById('billingAddress2').value, 200),
        state: cleanStr(loc.division, 80),
        city: cleanStr(loc.district, 80),
        area: cleanStr(loc.area, 80),
        country: cleanStr(document.getElementById('billingCountry').value, 80)
    };
}

function validateBilling(b) {
    if (b.name.length < 2) return 'Please enter your full name.';
    if (!EMAIL_RE.test(b.email)) return 'Please enter a valid email address.';
    const digits = b.phone.replace(/[^0-9]/g, '');
    if (digits.length < 6 || digits.length > 15) return 'Please enter a valid phone number.';
    if (b.address1.length < 5) return 'Please enter your street address.';
    if (b.city.length < 2) return 'Please select your district.';
    if (b.country.length < 2) return 'Please enter your country.';
    return null;
}

// ─── IDEMPOTENCY + ABUSE GUARDS ──────────────────────────────
// One key per checkout attempt (kept across refresh/retry so the
// server returns the existing order instead of a duplicate).
function getIdempotencyKey() {
    try {
        let k = sessionStorage.getItem('eshop_order_key');
        if (!k) {
            k = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : 'key-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            sessionStorage.setItem('eshop_order_key', k);
        }
        return k;
    } catch {
        return 'key-' + Date.now();
    }
}

// Device-side complement to the server rate limit: max 5 orders/hour,
// min 10s between orders. Only successful orders are recorded.
function orderRateHit() {
    try {
        const now = Date.now();
        const arr = JSON.parse(localStorage.getItem('eshop_order_times') || '[]')
            .filter(t => typeof t === 'number' && now - t < 3600000);
        if (arr.length >= 5) return true;
        if (arr.length && now - arr[arr.length - 1] < 10000) return true;
        return false;
    } catch { return false; }
}

function recordOrderTime() {
    try {
        const now = Date.now();
        const arr = JSON.parse(localStorage.getItem('eshop_order_times') || '[]')
            .filter(t => typeof t === 'number' && now - t < 3600000);
        arr.push(now);
        localStorage.setItem('eshop_order_times', JSON.stringify(arr));
    } catch { /* noop */ }
}

// ─── STATE ──────────────────────────────────────────────────
let productsData = [];
let orderItems = [];
let subtotal = 0;
let shippingCost = 0;
let discount = 0;
let paymentFee = 0;
let couponCode = '';
let total = 0;
let selectedPayment = '';
let paymentSettings = [];
let supabase = null;
let user = null;
let isCheckoutReady = false;
let billingSelects = null;

// ─── LOAD PRODUCTS FROM SUPABASE FIRST ──────────────────
async function loadProducts() {
    // Try Supabase first
    try {
        const { data, error } = await withTimeout(
            supabase.from('products').select('*').order('id', { ascending: true }),
            8000, 'Loading products'
        );
        if (error) throw error;
        if (data && data.length) {
            productsData = data.map(row => {
                let images = [];
                if (row.images && Array.isArray(row.images) && row.images.length > 0) {
                    images = typeof row.images[0] === 'string' ? row.images : row.images.map(item => item.url || '');
                } else if (row.image) {
                    images = [row.image];
                }
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
                    inStock: resolveStock(row).inStock,
                    specs: row.specs || {},
                    shortDesc: details.shortDesc || '',
                    fullDesc: details.fullDesc || '',
                    sections: details.sections || [],
                    related: details.related || [],
                    stockQty: parseStockQty(row),
                    stock: parseStockQty(row),
                    stock_quantity: parseStockQty(row)
                };
            });
            localStorage.setItem('eshop_products', JSON.stringify(productsData));
            return true;
        }
    } catch (e) {
        console.warn('Failed to load products from Supabase:', e);
    }

    // Fallback to localStorage
    const stored = localStorage.getItem('eshop_products');
    if (stored) {
        try {
            productsData = JSON.parse(stored);
            return true;
        } catch (e) { /* noop */ }
    }
    return false;
}

// ─── BUILD ORDER ITEMS ────────────────────────────────────
function buildOrderItems() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product_id');
    const quantity = parseInt(params.get('quantity')) || 1;

    if (productId) {
        const p = productsData.find(prod => String(prod.id) === String(productId));
        if (p) {
            orderItems = [{
                product_id: p.id,
                product_name: p.title,
                price: p.price,
                quantity: quantity,
                image_url: p.image
            }];
            return;
        }
    }

    // From cart
    const storedCart = getCart();
    if (storedCart.length) {
        orderItems = storedCart.map(item => {
            const p = productsData.find(prod => String(prod.id) === String(item.id));
            if (!p) return null;
            return {
                product_id: p.id,
                product_name: p.title,
                price: p.price,
                quantity: item.quantity,
                image_url: p.image
            };
        }).filter(item => item !== null);
    }
}

// ─── RENDER ORDER SUMMARY ──────────────────────────────
function renderOrderSummary() {
    const container = document.getElementById('orderItemsList');
    if (!container) return;
    if (orderItems.length === 0) {
        container.innerHTML = '<p>No items.</p>';
        return;
    }
    container.innerHTML = orderItems.map(item => `
        <div style="display:flex; gap:12px; padding:0.5rem 0; border-bottom:1px solid var(--border);">
            <img src="${item.image_url}" alt="${escapeHtml(item.product_name)}" style="width:50px; height:50px; object-fit:cover; border-radius:8px;">
            <div style="flex:1;">
                <div style="font-weight:500;">${escapeHtml(item.product_name)}</div>
                <div style="font-size:0.85rem; color:var(--text-secondary);">${item.quantity} × ${formatPrice(item.price)}</div>
            </div>
            <div style="font-weight:600;">${formatPrice(item.price * item.quantity)}</div>
        </div>
    `).join('');

    subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    shippingCost = calcShipping(subtotal);
    total = subtotal + shippingCost - discount;
    updateTotals();
}

function updateTotals() {
    const method = paymentSettings.find(m => m.method_name === selectedPayment);
    paymentFee = (method && parseFloat(method.fee)) || 0;
    total = subtotal + shippingCost - discount + paymentFee;
    document.getElementById('subtotalDisplay').textContent = formatPrice(subtotal);
    document.getElementById('shippingDisplay').textContent = shippingCost === 0 && subtotal > 0 ? 'FREE' : formatPrice(shippingCost);
    document.getElementById('totalDisplay').textContent = formatPrice(total);
    const discountRow = document.getElementById('discountRow');
    if (discount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('discountDisplay').textContent = `- ${formatPrice(discount)}`;
    } else {
        discountRow.style.display = 'none';
    }
    const feeRow = document.getElementById('feeRow');
    if (feeRow) {
        if (paymentFee > 0) {
            feeRow.style.display = 'flex';
            document.getElementById('feeDisplay').textContent = `+ ${formatPrice(paymentFee)}`;
        } else {
            feeRow.style.display = 'none';
        }
    }
    // Free-shipping progress (threshold from store settings)
    try {
        const bar = document.getElementById('shipProgressFill');
        const label = document.getElementById('shipProgressLabel');
        const threshold = Number(localStorage.getItem('eshop_shipping_free_above') || 2000);
        if (bar && label && threshold > 0) {
            const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
            bar.style.width = pct + '%';
            label.textContent = subtotal >= threshold
                ? `🎉 You've unlocked FREE shipping!`
                : `Add ${formatPrice(threshold - subtotal)} more for FREE shipping`;
        }
    } catch (_) {}
}

// ─── PAYMENT METHODS ────────────────────────────────────
const PAYMENT_LOGOS = {
    bkash: 'assets/logos/payments/bkash.png',
    nagad: 'assets/logos/payments/nagad.png',
    rocket: 'assets/logos/payments/rocket.png',
    upay: 'assets/logos/payments/upay.png',
};

function getPaymentLogoSrc(methodOrName) {
    const method = (methodOrName && typeof methodOrName === 'object') ? methodOrName : null;
    // Admin-uploaded logo (payment_settings.logo_url) always wins.
    if (method && method.logo_url && String(method.logo_url).trim()) {
        return String(method.logo_url).trim();
    }
    const methodName = method ? method.method_name : methodOrName;
    const s = String(methodName || '').toLowerCase().replace(/[\s._-]/g, '');
    if (s.includes('bkash')) return PAYMENT_LOGOS.bkash;
    if (s.includes('nagad')) return PAYMENT_LOGOS.nagad;
    if (s.includes('rocket')) return PAYMENT_LOGOS.rocket;
    if (s.includes('upay')) return PAYMENT_LOGOS.upay;
    return null;
}

function renderPaymentMethods() {
    const container = document.getElementById('paymentMethodsContainer');
    if (!container) return;
    if (!paymentSettings.length) {
        container.innerHTML = '<p>No payment methods available.</p>';
        return;
    }
    container.innerHTML = paymentSettings.map((method, index) => {
        const checked = index === 0 ? 'checked' : '';
        const accountInfo = method.account_info || {};
        let detail = '';
        if (method.method_name === 'Cash on Delivery') {
            detail = 'Pay on delivery';
        } else if (accountInfo.number) {
            detail = `Number: ${accountInfo.number}`;
        } else if (accountInfo.email) {
            detail = `Email: ${accountInfo.email}`;
        } else if (accountInfo.account) {
            detail = `Account: ${accountInfo.account}`;
        }
        if (method.status && method.status !== 'available') {
            detail += ` [${method.status.toUpperCase()}]`;
        }
        const logoSrc = getPaymentLogoSrc(method);
        return `
            <label class="payment-method ${checked ? 'selected' : ''}" data-id="${method.id}">
                <input type="radio" name="payment" value="${escapeHtml(method.method_name)}" ${checked} ${method.status !== 'available' ? 'disabled' : ''}>
                ${logoSrc ? `<span class="method-logo"><img src="${logoSrc}" alt="${escapeHtml(method.method_name)}" loading="lazy" /></span>` : ''}
                <div class="method-info">
                    <div class="method-name">${escapeHtml(method.method_name)}</div>
                    <div class="method-detail">${detail}</div>
                </div>
                ${method.fee > 0 ? `<span class="method-fee">+${formatPrice(method.fee)} fee</span>` : ''}
            </label>
        `;
    }).join('');

    const firstRadio = container.querySelector('input[type="radio"]:not([disabled])');
    if (firstRadio) {
        firstRadio.checked = true;
        selectedPayment = firstRadio.value;
        showPaymentDetails(selectedPayment);
    } else if (container.querySelector('input[type="radio"]')) {
        const anyRadio = container.querySelector('input[type="radio"]');
        anyRadio.checked = true;
        selectedPayment = anyRadio.value;
        showPaymentDetails(selectedPayment);
    }

    container.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function () {
            container.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
            this.closest('.payment-method').classList.add('selected');
            selectedPayment = this.value;
            showPaymentDetails(selectedPayment);
        });
    });
}

function showPaymentDetails(methodName) {
    const method = paymentSettings.find(m => m.method_name === methodName);
    paymentFee = (method && parseFloat(method.fee)) || 0;
    updateTotals();
    const detailsDiv = document.getElementById('paymentDetails');
    const instructions = document.getElementById('paymentInstructions');
    const qrDiv = document.getElementById('paymentQR');
    if (!method || method.method_name === 'Cash on Delivery' || method.status !== 'available') {
        detailsDiv.style.display = 'none';
        return;
    }
    detailsDiv.style.display = 'block';
    const accountInfo = method.account_info || {};
    let instr = method.instructions || '';
    if (accountInfo.number) {
        instr += `<br><strong>Account Number:</strong> ${accountInfo.number}`;
    }
    if (accountInfo.merchant) {
        instr += `<br><strong>Merchant:</strong> ${accountInfo.merchant}`;
    }
    instructions.innerHTML = instr;
    qrDiv.innerHTML = method.qr_code_url ? `<img src="${method.qr_code_url}" alt="QR Code" style="max-width:150px; margin-top:0.5rem;">` : '';
}

// ─── COUPON (server-validated, client fallback) ─────────
async function applyCoupon(code, showFeedback = true) {
    code = String(code || '').trim().toUpperCase().slice(0, 32);
    if (!code) return false;
    const fb = document.getElementById('couponFeedback');
    // 1) Preferred: secure server validator (max_discount, per-user limit, dates)
    try {
        const email = document.getElementById('billingEmail')?.value?.trim() || user?.email || null;
        const { data, error } = await withTimeout(
            supabase.rpc('validate_coupon', { p_code: code, p_subtotal: subtotal, p_email: email }),
            8000, 'Applying coupon'
        );
        if (!error && data && data.ok) {
            discount = Math.min(Number(data.discount) || 0, subtotal);
            couponCode = data.code || code;
            if (showFeedback && fb) fb.innerHTML = `<span style="color:var(--success);">Coupon applied! Discount: ${formatPrice(discount)}</span>`;
            setCoupon(couponCode);
            updateTotals();
            return true;
        }
        if (!error && data && !data.ok && data.error && !['INVALID'].includes(data.error)) {
            // Server gave a specific reason (EXPIRED, MIN_ORDER, LIMIT...) — surface it.
            const reasons = { INACTIVE: 'Coupon is inactive.', NOT_STARTED: 'Coupon is not yet valid.', EXPIRED: 'Coupon expired.', LIMIT_REACHED: 'Coupon usage limit reached.', PER_USER_LIMIT: 'You have already used this coupon.', MIN_ORDER: `Minimum order ${formatPrice(data.min || 0)} required.` };
            if (showFeedback && fb) fb.innerHTML = `<span style="color:var(--danger);">${reasons[data.error] || 'Coupon not applicable.'}</span>`;
            return false;
        }
    } catch (_) { /* fall through to client check */ }
    try {
        const { data, error } = await withTimeout(
            supabase
                .from('coupons')
                .select('*')
                .eq('code', code)
                .eq('active', true)
                .single(),
            8000, 'Applying coupon'
        );
        if (error || !data) {
            if (showFeedback) document.getElementById('couponFeedback').innerHTML = '<span style="color:var(--danger);">Invalid or inactive coupon.</span>';
            return false;
        }
        const now = new Date();
        const validFrom = new Date(data.valid_from);
        const validTo = new Date(data.valid_to);
        if (now < validFrom || now > validTo) {
            if (showFeedback) document.getElementById('couponFeedback').innerHTML = '<span style="color:var(--danger);">Coupon expired or not yet valid.</span>';
            return false;
        }
        if (data.usage_limit && data.used_count >= data.usage_limit) {
            if (showFeedback) document.getElementById('couponFeedback').innerHTML = '<span style="color:var(--danger);">Coupon usage limit reached.</span>';
            return false;
        }
        if (data.min_order_amount && subtotal < data.min_order_amount) {
            if (showFeedback) document.getElementById('couponFeedback').innerHTML = `<span style="color:var(--danger);">Minimum order amount ${formatPrice(data.min_order_amount)} required.</span>`;
            return false;
        }
        let discountAmount = 0;
        if (data.discount_type === 'percentage') {
            discountAmount = subtotal * (data.discount_value / 100);
        } else {
            discountAmount = data.discount_value;
        }
        discount = Math.min(discountAmount, subtotal);
        couponCode = code;
        if (showFeedback) document.getElementById('couponFeedback').innerHTML = `<span style="color:var(--success);">Coupon applied! Discount: ${formatPrice(discount)}</span>`;
        setCoupon(code);
        updateTotals();
        return true;
    } catch (e) {
        console.error('Coupon error', e);
        if (showFeedback) document.getElementById('couponFeedback').innerHTML = '<span style="color:var(--danger);">Error applying coupon.</span>';
        return false;
    }
}

// ─── USER DATA ──────────────────────────────────────────────
async function loadUserData() {
    try {
        if (!user) return;
        document.getElementById('billingEmail').value = user.email || '';
        document.getElementById('billingName').value = user.user_metadata?.full_name || '';
        const { data: addresses, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', user.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (!addresses || !addresses.length) {
            renderSavedAddresses([]);
            return;
        }
        const addr = addresses.find(a => a.is_default) || addresses[0];
        fillBillingForm(addr);
        renderSavedAddresses(addresses);
    } catch (e) {
        console.warn('Failed to load user data', e);
    }
}

function fillBillingForm(addr) {
    document.getElementById('billingName').value = addr.name || document.getElementById('billingName').value;
    document.getElementById('billingPhone').value = addr.phone || '';
    document.getElementById('billingAddress1').value = addr.address_line1 || '';
    document.getElementById('billingAddress2').value = addr.address_line2 || '';
    if (billingSelects) billingSelects.setValues({ division: addr.state, district: addr.city, area: addr.area });
    document.getElementById('billingCountry').value = addr.country || 'Bangladesh';
}

function renderSavedAddresses(addresses) {
    const wrap = document.getElementById('savedAddressesWrap');
    const list = document.getElementById('savedAddressesList');
    if (!wrap || !list) return;
    if (!addresses.length) {
        wrap.style.display = 'none';
        return;
    }
    wrap.style.display = 'block';
    list.innerHTML = addresses.map(addr => `
        <label class="saved-address" data-id="${addr.id}">
            <input type="radio" name="savedAddress" value="${addr.id}" ${addr.is_default ? 'checked' : ''}>
            <span class="saved-address-body">
                <span class="saved-address-line"><strong>${escapeHtml(addr.name || '')}</strong> · ${escapeHtml(addr.phone || '')}</span>
                <span class="saved-address-line">${escapeHtml(addr.address_line1 || '')}${addr.address_line2 ? ', ' + escapeHtml(addr.address_line2) : ''}</span>
                <span class="saved-address-line">${escapeHtml([addr.area, addr.city, addr.state].filter(Boolean).join(', '))}</span>
                <span class="saved-address-line">${addr.is_default ? '<em class="saved-address-default">Default</em>' : ''}</span>
            </span>
        </label>
    `).join('');

    list.querySelectorAll('input[name="savedAddress"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const addr = addresses.find(a => String(a.id) === String(radio.value));
            if (addr) fillBillingForm(addr);
        });
    });
}

// ─── MAIN INIT ──────────────────────────────────────────────
async function initCheckout() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('loginRequired').style.display = 'none';
    document.getElementById('checkoutForm').style.display = 'none';

    supabase = getSupabase();
    // Load dynamic shipping/currency/logo cache first (instant from
    // localStorage, then refreshed from Supabase). Re-render totals once
    // the fresh shipping rules arrive.
    try { await loadStoreSettings(); } catch (_) { /* noop */ }
    if (!supabase) {
        showToastMsg('Supabase connection failed. Some features may not work.', 'warning');
        const stored = localStorage.getItem('eshop_products');
        if (stored) {
            try { productsData = JSON.parse(stored); } catch (e) { /* noop */ }
        }
        buildOrderItems();
        if (orderItems.length > 0) {
            renderOrderSummary();
            document.getElementById('checkoutForm').style.display = 'block';
            document.getElementById('loadingState').style.display = 'none';
            showToastMsg('Please login manually (Supabase unavailable)', 'warning');
            isCheckoutReady = true;
            return;
        }
        showToastMsg('No items found. Redirecting...', 'warning');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return;
    }

    // Restore the exact checkout URL (Buy-Now product / quantity) after Google
    // OAuth in case the redirect landed here without the query string.
    if (restoreIntendedCheckout()) return;

    const productsLoaded = await loadProducts();
    if (!productsLoaded) {
        showToastMsg('Could not load products. Please refresh.', 'error');
        const stored = localStorage.getItem('eshop_products');
        if (stored) {
            try { productsData = JSON.parse(stored); } catch (e) { /* noop */ }
        }
    }

    buildOrderItems();
    if (orderItems.length === 0) {
        showToastMsg('No items in cart. Redirecting...', 'warning');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return;
    }

    renderOrderSummary();

    // Saved Customer Order Mode decides whether anonymous users may
    // continue. Secure default: require login when the setting cannot
    // be loaded. Fetched in parallel with the auth state (one paint).
    const [modeResult, userResult] = await Promise.allSettled([
        loadOrderMode(),
        supabase.auth.getUser()
    ]);
    if (modeResult.status === 'fulfilled') orderMode = modeResult.value || orderMode;
    if (userResult.status === 'fulfilled' && !userResult.value.error) {
        user = userResult.value.data.user || null;
    } else if (userResult.status === 'rejected' || userResult.value.error) {
        showToastMsg('Authentication error. Please try again.', 'error');
    }

    if (!user && orderMode !== 'guest') {
        enterAuthGate();
        return;
    }

    enterCheckout({ guest: !user });
}

// ─── AUTH GATE / CHECKOUT CONTINUATION ────────────────────
let authWired = false;

function restoreIntendedCheckout() {
    let stored = null;
    try { stored = sessionStorage.getItem('eshop_auth_return'); } catch { stored = null; }
    if (!stored) return false;
    try { sessionStorage.removeItem('eshop_auth_return'); } catch { /* noop */ }
    try {
        const target = new URL(stored, window.location.origin);
        if (target.origin !== window.location.origin) return false;
        if (target.pathname !== window.location.pathname) return false;
        if (window.location.href === target.href) return false;
        window.location.replace(target.href);
        return true;
    } catch (e) {
        return false;
    }
}

async function getCurrentUser() {
    try {
        if (!supabase) return null;
        const { data: { user: u } } = await supabase.auth.getUser();
        return u;
    } catch (e) {
        return null;
    }
}

async function enterCheckout(opts = {}) {
    isGuestCheckout = !!opts.guest;
    document.getElementById('loginRequired').style.display = 'none';
    document.getElementById('checkoutForm').style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';

    billingSelects = createAddressSelects(document.getElementById('billingSelects'));
    // Re-entry (e.g. guest signs in mid-checkout) rebuilds the selects:
    // restore any already-chosen location so nothing is lost.
    if (opts.keepLocation) {
        try { billingSelects.setValues(opts.keepLocation); } catch { /* noop */ }
    }

    await loadPaymentSettings();
    if (user) {
        await loadUserData();
    } else {
        // Guest checkout: auth modal stays available for optional sign-in.
        initAuthModal();
        checkOAuthErrorAndShow();
        wireGuestLogin();
    }

    const guestNotice = document.getElementById('guestNotice');
    if (guestNotice) guestNotice.style.display = isGuestCheckout ? 'block' : 'none';
    const saveRow = document.getElementById('saveAddressRow');
    if (saveRow) saveRow.style.display = user ? '' : 'none';

    const savedCoupon = getCoupon();
    if (savedCoupon) {
        couponCode = savedCoupon;
        document.getElementById('couponInput').value = couponCode;
        await applyCoupon(couponCode, false);
    }

    isCheckoutReady = true;
}

function enterAuthGate() {
    document.getElementById('checkoutForm').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('loginRequired').style.display = 'block';

    initAuthModal();
    checkOAuthErrorAndShow();
    wireAuthGate();
}

function wireAuthGate() {
    if (authWired) return;
    authWired = true;
    document.getElementById('showLoginBtn')?.addEventListener('click', () => {
        openAuthModal({
            mode: 'signin',
            onSuccess: onAuthSuccess,
            onNotice: (msg) => showToastMsg(msg)
        });
    });
}

async function onAuthSuccess() {
    closeAuthModal();
    showToastMsg('Signed in successfully');
    const keepLocation = billingSelects ? billingSelects.getValues() : null;
    user = await getCurrentUser();
    enterCheckout(keepLocation ? { keepLocation } : {});
}

function wireGuestLogin() {
    if (authWired) return;
    authWired = true;
    document.getElementById('guestLoginBtn')?.addEventListener('click', () => {
        openAuthModal({
            mode: 'signin',
            onSuccess: onAuthSuccess,
            onNotice: (msg) => showToastMsg(msg)
        });
    });
}

async function loadPaymentSettings() {
    try {
        const { data, error } = await withTimeout(
            supabase.from('payment_settings').select('*').order('display_order', { ascending: true }),
            8000, 'Loading payment settings'
        );
        if (!error && data) {
            paymentSettings = data.filter(m => m.enabled !== false);
            renderPaymentMethods();
        }
    } catch (e) {
        console.warn('Failed to load payment settings', e);
        paymentSettings = [
            { method_name: 'Cash on Delivery', enabled: true, status: 'available', fee: 0, account_info: {}, instructions: 'Pay on delivery' }
        ];
        renderPaymentMethods();
    }
}

// ─── PLACE ORDER (secure: server recomputes everything) ───
// The browser sends ONLY contact/address text, the payment method
// name, the coupon code and [{product_id, quantity}]. Prices,
// discounts, shipping, totals, payment status and ownership are all
// derived server-side by the create_order_secure RPC from trusted
// tables + auth state — never from client values.
function setPlacingUI(active) {
    const btn = document.getElementById('placeOrderBtn');
    if (!btn) return;
    btn.disabled = active;
    btn.textContent = active ? 'Placing order…' : 'Place Order';
}

function handleOrderErrorCode(code) {
    switch (code) {
        case 'LOGIN_REQUIRED':
            showToastMsg('Please log in to place your order.', 'warning');
            enterAuthGate();
            break;
        case 'RATE_LIMITED':
            showToastMsg('Too many orders. Please try again later.', 'warning');
            break;
        case 'OUT_OF_STOCK':
        case 'INSUFFICIENT_STOCK':
            showToastMsg('Some items just went out of stock. Please review your cart.', 'error');
            break;
        case 'INVALID_COUPON':
            showToastMsg('This coupon is no longer valid.', 'warning');
            break;
        case 'INVALID_PAYMENT':
            showToastMsg('Please select a valid payment method.', 'warning');
            break;
        default:
            showToastMsg('Please check your details and try again.', 'warning');
    }
}

async function placeOrder() {
    if (!isCheckoutReady) {
        showToastMsg('Checkout not ready. Please wait.', 'warning');
        return;
    }
    if (placingOrder) return; // double-click / double-tap guard

    const b = readBillingForm();
    const formError = validateBilling(b);
    if (formError) {
        showToastMsg(formError, 'warning');
        return;
    }
    if (!selectedPayment) {
        showToastMsg('Please select a payment method.', 'warning');
        return;
    }
    if (!orderItems.length || orderItems.length > 50) {
        showToastMsg('Your cart is empty or too large.', 'warning');
        return;
    }
    if (orderRateHit()) {
        showToastMsg('Too many orders. Please try again later.', 'warning');
        return;
    }

    // Fail fast on obviously stale stock; the server re-checks
    // atomically and is the real source of truth.
    if (supabase) {
        for (let item of orderItems) {
            const p = productsData.find(prod => String(prod.id) === String(item.product_id));
            if (p && !canFulfill(p, item.quantity)) {
                const avail = (p.stockQty === null || p.stockQty === undefined) ? 0 : p.stockQty;
                showToastMsg(`Insufficient stock for ${p.title}. Available: ${avail}`, 'error');
                return;
            }
        }
    }

    placingOrder = true;
    setPlacingUI(true);
    try {
        if (!supabase) throw new Error('Supabase not available');
        const rpcItems = orderItems.map(item => ({
            product_id: item.product_id,
            quantity: Math.min(Math.max(parseInt(item.quantity, 10) || 1, 1), 10)
        }));
        const { data, error } = await withTimeout(
            supabase.rpc('create_order_secure', {
                p_name: b.name,
                p_email: b.email,
                p_phone: b.phone,
                p_address1: b.address1,
                p_address2: b.address2 || '',
                p_city: b.city,
                p_state: b.state || '',
                p_area: b.area || '',
                p_country: b.country,
                p_payment_method: selectedPayment,
                p_coupon_code: couponCode || '',
                p_items: rpcItems,
                p_idempotency_key: getIdempotencyKey()
            }),
            20000, 'Placing order'
        );
        if (error) {
            // Migration not run yet → fall back to the legacy path so
            // checkout keeps working; otherwise surface the failure.
            if (/create_order_secure|PGRST202/i.test(error.message || '') || error.code === '42883') {
                return placeOrderLegacy(b);
            }
            throw error;
        }
        if (data && data.ok === false) {
            handleOrderErrorCode(data.error);
            return;
        }
        await afterOrderPlaced(data.order_id, data.order_number, b);
    } catch (err) {
        // Log without PII; customers only see a generic message.
        console.error('Order placement failed:', err && (err.code || err.message));
        showToastMsg('Failed to place order. Please try again.', 'error');
    } finally {
        placingOrder = false;
        setPlacingUI(false);
    }
}

async function afterOrderPlaced(orderId, orderNumber, b) {
    // Optional address book save for signed-in customers only.
    const saveAddress = document.getElementById('saveAddressCheck').checked;
    if (saveAddress && user && supabase) {
        try {
            const { data: existing } = await supabase
                .from('addresses')
                .select('id')
                .eq('user_id', user.id);
            const isFirst = !existing || !existing.length;
            await supabase
                .from('addresses')
                .insert({
                    user_id: user.id,
                    name: b.name,
                    phone: b.phone,
                    address_line1: b.address1,
                    address_line2: b.address2,
                    city: b.city,
                    state: b.state,
                    area: b.area,
                    country: b.country,
                    is_default: isFirst
                });
        } catch (e) { console.warn('Failed to save address', e); }
    }

    recordOrderTime();
    try {
        sessionStorage.setItem('eshop_last_order',
            JSON.stringify({ id: orderId, number: orderNumber }));
        sessionStorage.removeItem('eshop_order_key');
    } catch (_) { /* noop */ }

    if (!window.location.search.includes('product_id')) {
        localStorage.setItem('eshop_cart', '[]');
    }
    clearCoupon();

    window.location.href = `order-success.html?order_id=${orderId}`;
}

// Legacy direct-insert path: used ONLY when the guest-checkout.sql
// migration has not been run yet (RPC missing). Totals are recomputed
// here from the trusted products catalog — never from DOM values.
async function placeOrderLegacy(b) {
    try {
        if (!supabase) throw new Error('Supabase not available');
        // Recompute from the trusted catalog loaded from Supabase —
        // never from DOM/client totals.
        const freshSubtotal = orderItems.reduce((sum, item) => {
            const p = productsData.find(prod => String(prod.id) === String(item.product_id));
            return sum + (p ? (Number(p.price) || 0) : 0) * (parseInt(item.quantity, 10) || 0);
        }, 0);
        const freshShipping = calcShipping(freshSubtotal);
        const method = paymentSettings.find(m => m.method_name === selectedPayment);
        const freshFee = (method && parseFloat(method.fee)) || 0;
        const freshTotal = Math.max(0, freshSubtotal + freshShipping + freshFee - Math.min(discount, freshSubtotal));

        const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

        const orderData = {
            order_number: orderNumber,
            user_id: user ? user.id : null,
            customer_name: b.name,
            customer_email: b.email,
            customer_phone: b.phone,
            address_line1: b.address1,
            address_line2: b.address2,
            city: b.city,
            state: b.state,
            area: b.area,
            country: b.country,
            total_amount: freshTotal,
            discount: Math.min(discount, freshSubtotal),
            shipping_cost: freshShipping,
            coupon_code: couponCode || null,
            payment_method: selectedPayment,
            payment_status: 'pending',
            status: 'pending',
            estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };

        const { data: order, error: orderError } = await withTimeout(
            supabase.from('orders').insert(orderData).select().single(),
            15000, 'Placing order'
        );
        if (orderError) throw orderError;

        const items = orderItems.map(item => ({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name,
            product_price: item.price,
            quantity: item.quantity,
            image_url: item.image_url
        }));
        const { error: itemsError } = await withTimeout(
            supabase.from('order_items').insert(items),
            15000, 'Saving items'
        );
        if (itemsError) throw itemsError;

        // Best-effort stock decrement: never fail an already-placed order
        // when the RPC is missing, and skip rows with unknown stock so the
        // migration backfill is the only thing that sets quantities.
        for (let item of orderItems) {
            try {
                const p = productsData.find(prod => String(prod.id) === String(item.product_id));
                if (p && (p.stockQty === null || p.stockQty === undefined)) continue;
                await withTimeout(
                    supabase.rpc('decrement_stock', { product_id: item.product_id, quantity: item.quantity }),
                    8000, 'Updating stock'
                );
                if (p && p.stockQty !== null && p.stockQty !== undefined) {
                    p.stockQty = Math.max(0, p.stockQty - item.quantity);
                    p.stock = p.stockQty;
                    p.stock_quantity = p.stockQty;
                    if (p.stockQty <= 0) p.inStock = false;
                }
            } catch (e) { console.warn('Stock decrement failed for', item.product_id, e); }
        }
        try { localStorage.setItem('eshop_products', JSON.stringify(productsData)); } catch (_) { /* noop */ }

        if (couponCode) {
            await supabase.rpc('increment_coupon_used', { code: couponCode }).catch(() => {});
        }

        if (!window.location.search.includes('product_id')) {
            localStorage.setItem('eshop_cart', '[]');
        }
        clearCoupon();

        try {
            sessionStorage.setItem('eshop_last_order',
                JSON.stringify({ id: order.id, number: order.order_number }));
            sessionStorage.removeItem('eshop_order_key');
        } catch (_) { /* noop */ }
        recordOrderTime();

        window.location.href = `order-success.html?order_id=${order.id}`;
    } catch (err) {
        console.error('Order placement error:', err && (err.code || err.message));
        showToastMsg('Failed to place order. Please try again.', 'error');
    }
}

// ─── EVENT BINDINGS ────────────────────────────────────────
initCheckout();

const applyCouponBtn = document.getElementById('applyCouponBtn');
if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', async () => {
        const code = document.getElementById('couponInput').value.trim();
        if (!code) return;
        await applyCoupon(code, true);
    });
}

document.getElementById('placeOrderBtn')?.addEventListener('click', placeOrder);

// ─── THEME ───────────────────────────────────────────────
loadTheme();
loadSitePalette();
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
document.addEventListener('storage', (e) => { if (e.key === 'eshop_theme') loadTheme(); });