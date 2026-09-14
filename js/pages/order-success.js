// ─── ORDER SUCCESS PAGE ─────────────────────────────────
import { formatPrice } from '../core/utils.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';

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
            trackLink.href = `order-tracking.html?order_id=${order.order_number}&phone=${order.customer_phone}`;
        }

    } catch (err) {
        console.error(err);
        document.getElementById('orderDetails').innerHTML = '<p>Error loading order.</p>';
    }
}

// ─── INIT ───────────────────────────────────────────────
loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'grabby_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

loadOrder();