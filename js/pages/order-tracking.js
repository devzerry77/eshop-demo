// ─── ORDER TRACKING PAGE (Premium v1) ─────────────────
import { formatPrice } from '../core/utils.js';
import { orderTimelineHTML } from '../core/premium.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';

function escapeHtmlBasic(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
}

function renderTrackedOrder(order, items) {
    const courier = order.courier_name ? `<p><strong>Courier:</strong> ${escapeHtmlBasic(order.courier_name)}${order.tracking_number ? ` · <strong>Tracking:</strong> ${escapeHtmlBasic(order.tracking_number)}` : ''}</p>` : (order.tracking_number ? `<p><strong>Tracking:</strong> ${escapeHtmlBasic(order.tracking_number)}</p>` : '');
    let itemsHtml = items ? items.map(item => `
        <div style="display:flex; justify-content:space-between; padding:0.3rem 0; border-bottom:1px solid var(--border);">
                <span>${escapeHtmlBasic(item.product_name)} × ${Number(item.quantity) || 0}</span>
            <span>${formatPrice((Number(item.product_price) || 0) * (Number(item.quantity) || 0))}</span>
        </div>
    `).join('') : '';

    document.getElementById('trackResult').innerHTML = `
        <div style="margin-top:1rem;">
            <h3 style="margin-bottom:0.5rem;">Order #${escapeHtmlBasic(order.order_number)}</h3>
            <p><strong>Status:</strong> <span class="p-status ${escapeHtmlBasic(order.status)}">${escapeHtmlBasic(String(order.status || '').toUpperCase())}</span></p>
            <p><strong>Total:</strong> ${formatPrice(order.total_amount)}</p>
            <p><strong>Payment:</strong> ${escapeHtmlBasic(order.payment_method)} (${escapeHtmlBasic(order.payment_status || 'pending')})</p>
            ${courier}
            <div style="margin:1rem 0;"><strong>Items</strong></div>
            ${itemsHtml}
            <div style="margin:1.5rem 0;"><strong>Delivery progress</strong></div>
            ${orderTimelineHTML(order.status)}
            <p style="margin-top:1rem; color:var(--text-secondary);">Estimated delivery: ${order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString() : 'N/A'}</p>
            <div class="no-print" style="margin-top:1rem;display:flex;gap:10px"><button class="button-secondary" onclick="window.print()">🖨 Print / Save invoice</button></div>
        </div>
    `;
    document.getElementById('trackResult').style.display = 'block';
}

async function trackOrder(orderId) {
    try {
        const supabase = createClient();
        if (!supabase) throw new Error('Supabase not initialized');

        // Prefer the public RPC: it returns only non-sensitive fields
        // (no email / phone / address), so tracking links are safe to
        // share and guests can track without an account.
        try {
            const { data, error } = await supabase.rpc('get_order_public', { p_order_number: orderId });
            if (!error && data && data.ok === true) {
                renderTrackedOrder(data.order, data.items || []);
                return;
            }
        } catch { /* fall through to legacy direct lookup */ }

        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('order_number', orderId)
            .single();

        if (error || !order) {
            document.getElementById('trackResult').innerHTML = '<p style="color:var(--danger);">Order not found. Please check your order ID.</p>';
            document.getElementById('trackResult').style.display = 'block';
            return;
        }

        const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

        renderTrackedOrder(order, items || []);

    } catch (err) {
        document.getElementById('trackResult').innerHTML = '<p style="color:var(--danger);">Error tracking order.</p>';
        document.getElementById('trackResult').style.display = 'block';
    }
}

// ─── INIT ───────────────────────────────────────────────
loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'eshop_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

document.getElementById('trackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const orderId = document.getElementById('trackOrderId').value.trim();
    if (!orderId) return;
    trackOrder(orderId);
});

const params = new URLSearchParams(window.location.search);
const orderId = params.get('order_id');
if (orderId) {
    document.getElementById('trackOrderId').value = orderId;
    trackOrder(orderId);
}