// ─── ORDER TRACKING PAGE ────────────────────────────────
import { formatPrice } from '../core/utils.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';

async function trackOrder(orderId, phone) {
    try {
        const supabase = createClient();
        if (!supabase) throw new Error('Supabase not initialized');

        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('order_number', orderId)
            .eq('customer_phone', phone)
            .single();

        if (error || !order) {
            document.getElementById('trackResult').innerHTML = '<p style="color:var(--danger);">Order not found. Please check your order ID and phone number.</p>';
            document.getElementById('trackResult').style.display = 'block';
            return;
        }

        const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

        const statuses = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'];
        const currentStatusIndex = statuses.indexOf(order.status);
        const completedStatuses = statuses.slice(0, currentStatusIndex + 1);

        let timelineHtml = completedStatuses.map((status, index) => {
            const isCompleted = index <= currentStatusIndex;
            const isActive = index === currentStatusIndex;
            return `
                <div class="status-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">
                    <div class="step-label">${status.replace(/_/g, ' ').toUpperCase()}</div>
                    ${isActive ? `<div class="step-date">Current status</div>` : ''}
                </div>
            `;
        }).join('');

        let itemsHtml = items ? items.map(item => `
            <div style="display:flex; justify-content:space-between; padding:0.3rem 0; border-bottom:1px solid var(--border);">
                    <span>${item.product_name} × ${item.quantity}</span>
                <span>${formatPrice(item.product_price * item.quantity)}</span>
            </div>
        `).join('') : '';

        document.getElementById('trackResult').innerHTML = `
            <div style="margin-top:1rem;">
                <h3 style="margin-bottom:0.5rem;">Order #${order.order_number}</h3>
                <p><strong>Status:</strong> <span class="order-status ${order.status}">${order.status.toUpperCase()}</span></p>
                <p><strong>Total:</strong> ${formatPrice(order.total_amount)}</p>
                <p><strong>Payment:</strong> ${order.payment_method}</p>
                <div style="margin:1rem 0;"><strong>Items</strong></div>
                ${itemsHtml}
                <div style="margin:1.5rem 0;"><strong>Timeline</strong></div>
                <div class="status-timeline">${timelineHtml}</div>
                <p style="margin-top:1rem; color:var(--text-secondary);">Estimated delivery: ${order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString() : 'N/A'}</p>
            </div>
        `;
        document.getElementById('trackResult').style.display = 'block';

    } catch (err) {
        document.getElementById('trackResult').innerHTML = '<p style="color:var(--danger);">Error tracking order.</p>';
        document.getElementById('trackResult').style.display = 'block';
    }
}

// ─── INIT ───────────────────────────────────────────────
loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'grabby_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

document.getElementById('trackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const orderId = document.getElementById('trackOrderId').value.trim();
    const phone = document.getElementById('trackPhone').value.trim();
    if (!orderId || !phone) return;
    trackOrder(orderId, phone);
});

const params = new URLSearchParams(window.location.search);
const orderId = params.get('order_id');
const phone = params.get('phone');
if (orderId && phone) {
    document.getElementById('trackOrderId').value = orderId;
    document.getElementById('trackPhone').value = phone;
    trackOrder(orderId, phone);
}