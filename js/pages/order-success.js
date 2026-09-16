// ─── ORDER SUCCESS PAGE ─────────────────────────────────
import { formatPrice } from '../core/utils.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';

function escapeHtmlBasic(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
}

function renderPublicOrder(order, items) {
    document.getElementById('orderNumberDisplay').textContent = 'Order #' + order.order_number;

    let itemsHtml = '';
    if (items && items.length) {
        itemsHtml = items.map(item => `
            <div style="display:flex; justify-content:space-between; padding:0.3rem 0; border-bottom:1px solid var(--border);">
                <span>${escapeHtmlBasic(item.product_name)} × ${Number(item.quantity) || 0}</span>
                <span>${formatPrice((Number(item.product_price) || 0) * (Number(item.quantity) || 0))}</span>
            </div>
        `).join('');
    }

    document.getElementById('orderDetails').innerHTML = `
        <div class="detail-row"><span>Order Number</span><span>${escapeHtmlBasic(order.order_number)}</span></div>
        <div class="detail-row"><span>Date</span><span>${order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</span></div>
        <div class="detail-row"><span>Payment Method</span><span>${escapeHtmlBasic(order.payment_method)}</span></div>
        <div class="detail-row"><span>Status</span><span class="order-status ${escapeHtmlBasic(order.status)}">${escapeHtmlBasic(String(order.status || '').toUpperCase())}</span></div>
        <div style="margin:0.5rem 0 0.2rem;"><strong>Items</strong></div>
        ${itemsHtml}
        <div class="detail-row" style="font-weight:700; margin-top:0.5rem;"><span>Total</span><span>${formatPrice(order.total_amount)}</span></div>
    `;

    const trackLink = document.querySelector('a[href*="order-tracking.html"]');
    if (trackLink) {
        trackLink.href = `order-tracking.html?order_id=${encodeURIComponent(order.order_number)}`;
    }
}

// Guest-safe lookup: the get_order_public RPC returns only
// non-sensitive fields (no email / phone / address), so anonymous
// customers can confirm their order without a data leak.
async function loadOrderViaPublicRpc(supabase, orderNumber) {
    if (!orderNumber) return false;
    try {
        const { data, error } = await supabase.rpc('get_order_public', { p_order_number: orderNumber });
        if (error || !data || data.ok !== true) return false;
        renderPublicOrder(data.order, data.items || []);
        return true;
    } catch {
        return false;
    }
}

async function loadOrder() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order_id');
    if (!orderId) {
        document.getElementById('orderDetails').innerHTML = '<p>Order ID not found.</p>';
        return;
    }

    try {
        const supabase = createClient();
        if (!supabase) throw new Error('Supabase not initialized');

        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            // Direct read blocked (e.g. guest order under RLS) → fall
            // back to the public RPC using the order number saved at
            // placement time. Never exposes other customers' data.
            let lastOrder = null;
            try { lastOrder = JSON.parse(sessionStorage.getItem('eshop_last_order') || 'null'); } catch { /* noop */ }
            if (lastOrder && String(lastOrder.id) === String(orderId) && lastOrder.number) {
                if (await loadOrderViaPublicRpc(supabase, lastOrder.number)) return;
            }
            document.getElementById('orderDetails').innerHTML = '<p>Order not found.</p>';
            return;
        }

        document.getElementById('orderNumberDisplay').textContent = 'Order #' + order.order_number;

        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

        let itemsHtml = '';
        if (items && items.length) {
            itemsHtml = items.map(item => `
                <div style="display:flex; justify-content:space-between; padding:0.3rem 0; border-bottom:1px solid var(--border);">
                    <span>${item.product_name} × ${item.quantity}</span>
                    <span>${formatPrice(item.product_price * item.quantity)}</span>
                </div>
            `).join('');
        }

        document.getElementById('orderDetails').innerHTML = `
            <div class="detail-row"><span>Order Number</span><span>${order.order_number}</span></div>
            <div class="detail-row"><span>Date</span><span>${new Date(order.created_at).toLocaleString()}</span></div>
            <div class="detail-row"><span>Payment Method</span><span>${order.payment_method}</span></div>
            <div class="detail-row"><span>Status</span><span class="order-status ${order.status}">${order.status.toUpperCase()}</span></div>
            <div style="margin:0.5rem 0 0.2rem;"><strong>Items</strong></div>
            ${itemsHtml}
            <div class="detail-row" style="font-weight:700; margin-top:0.5rem;"><span>Total</span><span>${formatPrice(order.total_amount)}</span></div>
            <div class="detail-row"><span>Shipping Address</span><span>${order.address_line1}, ${[order.area, order.city, order.state, order.country].filter(Boolean).join(', ')}</span></div>
        `;

        const trackLink = document.querySelector('a[href*="order-tracking.html"]');
        if (trackLink) {
            trackLink.href = `order-tracking.html?order_id=${order.order_number}`;
        }

    } catch (err) {
        console.error(err);
        document.getElementById('orderDetails').innerHTML = '<p>Error loading order.</p>';
    }
}

// ─── INIT ───────────────────────────────────────────────
loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'eshop_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

loadOrder();