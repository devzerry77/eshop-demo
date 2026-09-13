// ─── CHECKOUT PAGE ──────────────────────────────────────
import { formatPrice, escapeHtml } from '../core/utils.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';
import { showToast } from '../components/toast.js';
import { initAuthModal, openAuthModal, closeAuthModal, checkOAuthErrorAndShow } from '../components/auth-modal.js';
import { createAddressSelects } from '../components/address-selects.js';
import { getCart, setCoupon, clearCoupon, getCoupon } from '../core/storage.js';

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
                    inStock: row.in_stock !== false,
                    specs: row.specs || {},
                    shortDesc: details.shortDesc || '',
                    fullDesc: details.fullDesc || '',
                    sections: details.sections || [],
                    related: details.related || [],
                    stock: row.stock_quantity || 0,
                    stock_quantity: row.stock_quantity || 0
                };
            });
            localStorage.setItem('grabby_products', JSON.stringify(productsData));
            return true;
        }
    } catch (e) {
        console.warn('Failed to load products from Supabase:', e);
    }

    // Fallback to localStorage
    const stored = localStorage.getItem('grabby_products');
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
    shippingCost = subtotal >= 2000 ? 0 : 100;
    total = subtotal + shippingCost - discount;
    updateTotals();
}

function updateTotals() {
    const method = paymentSettings.find(m => m.method_name === selectedPayment);
    paymentFee = (method && parseFloat(method.fee)) || 0;
    total = subtotal + shippingCost - discount + paymentFee;
    document.getElementById('subtotalDisplay').textContent = formatPrice(subtotal);
    document.getElementById('shippingDisplay').textContent = formatPrice(shippingCost);
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
}

// ─── PAYMENT METHODS ────────────────────────────────────
const PAYMENT_LOGOS = {
    bkash: 'assets/logos/payments/bkash.png',
    nagad: 'assets/logos/payments/nagad.png',
    rocket: 'assets/logos/payments/rocket.png',
    upay: 'assets/logos/payments/upay.png',
};

function getPaymentLogoSrc(methodName) {
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
        const logoSrc = getPaymentLogoSrc(method.method_name);
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

// ─── COUPON ──────────────────────────────────────────────────
async function applyCoupon(code, showFeedback = true) {
    if (!code) return false;
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
    if (!supabase) {
        showToastMsg('Supabase connection failed. Some features may not work.', 'warning');
        const stored = localStorage.getItem('grabby_products');
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
        const stored = localStorage.getItem('grabby_products');
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

    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error) {
        showToastMsg('Authentication error: ' + error.message, 'error');
    }
    user = authUser;

    if (!user) {
        enterAuthGate();
        return;
    }

    enterCheckout();
}

// ─── AUTH GATE / CHECKOUT CONTINUATION ────────────────────
let authWired = false;

function restoreIntendedCheckout() {
    let stored = null;
    try { stored = sessionStorage.getItem('grabby_auth_return'); } catch { stored = null; }
    if (!stored) return false;
    try { sessionStorage.removeItem('grabby_auth_return'); } catch { /* noop */ }
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

async function enterCheckout() {
    document.getElementById('loginRequired').style.display = 'none';
    document.getElementById('checkoutForm').style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';

    billingSelects = createAddressSelects(document.getElementById('billingSelects'));

    await loadPaymentSettings();
    await loadUserData();

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
    user = await getCurrentUser();
    enterCheckout();
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

// ─── PLACE ORDER ────────────────────────────────────────────
async function placeOrder() {
    if (!isCheckoutReady) {
        showToastMsg('Checkout not ready. Please wait.', 'warning');
        return;
    }

    const name = document.getElementById('billingName').value.trim();
    const email = document.getElementById('billingEmail').value.trim();
    const phone = document.getElementById('billingPhone').value.trim();
    const address1 = document.getElementById('billingAddress1').value.trim();
    const address2 = document.getElementById('billingAddress2').value.trim();
    const loc = billingSelects ? billingSelects.getValues() : { division: '', district: '', area: '' };
    const state = loc.division;
    const city = loc.district;
    const area = loc.area;
    const country = document.getElementById('billingCountry').value.trim();

    if (!name || !email || !phone || !address1 || !city || !country) {
        showToastMsg('Please fill all required fields.', 'warning');
        return;
    }
    if (!selectedPayment) {
        showToastMsg('Please select a payment method.', 'warning');
        return;
    }

    if (supabase) {
        for (let item of orderItems) {
            const p = productsData.find(prod => String(prod.id) === String(item.product_id));
            if (p && p.stock !== undefined && p.stock < item.quantity) {
                showToastMsg(`Insufficient stock for ${p.title}. Available: ${p.stock}`, 'error');
                return;
            }
        }
    }

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
                    name: name,
                    phone: phone,
                    address_line1: address1,
                    address_line2: address2,
                    city: city,
                    state: state,
                    area: area,
                    country: country,
                    is_default: isFirst
                });
        } catch (e) { console.warn('Failed to save address', e); }
    }

    const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const orderData = {
        order_number: orderNumber,
        user_id: user ? user.id : null,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        address_line1: address1,
        address_line2: address2,
        city: city,
        state: state,
        area: area,
        country: country,
        total_amount: total,
        discount: discount,
        shipping_cost: shippingCost,
        coupon_code: couponCode || null,
        payment_method: selectedPayment,
        payment_status: 'pending',
        status: 'pending',
        estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString()
    };

    try {
        if (!supabase) throw new Error('Supabase not available');
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

        for (let item of orderItems) {
            await withTimeout(
                supabase.rpc('decrement_stock', { product_id: item.product_id, quantity: item.quantity }),
                8000, 'Updating stock'
            );
        }

        if (couponCode) {
            await supabase.rpc('increment_coupon_used', { code: couponCode }).catch(() => {});
        }

        if (!window.location.search.includes('product_id')) {
            localStorage.setItem('grabby_cart', '[]');
        }
        clearCoupon();

        window.location.href = `order-success.html?order_id=${order.id}`;
    } catch (err) {
        console.error('Order placement error', err);
        showToastMsg('Failed to place order: ' + err.message, 'error');
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
document.addEventListener('storage', (e) => { if (e.key === 'grabby_theme') loadTheme(); });