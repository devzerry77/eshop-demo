// ─── MY ORDERS PAGE ─────────────────────────────────────
import { formatPrice } from '../core/utils.js';
import { loadTheme, toggleTheme, loadSitePalette } from '../core/theme.js';
import { createClient } from '../supabase/client.js';
import { showToast } from '../components/toast.js';

const TOAST_ID = 'ordersToast';

function showToastMsg(msg) {
    showToast(TOAST_ID, msg, 2000);
}

async function loadOrders() {
    try {
        const supabase = createClient();
        if (!supabase) throw new Error('Supabase not initialized');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            document.getElementById('ordersList').innerHTML = `
                <div class="empty-orders">
                    <div class="icon">🔐</div>
                    <h2>Please Login</h2>
                    <p>You need to be logged in to view your orders.</p>
                    <a href="index.html" class="button button-primary" style="margin-top:1rem;">Go to Home</a>
                </div>
            `;
            return;
        }

        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!orders || orders.length === 0) {
            document.getElementById('ordersList').innerHTML = `
                <div class="empty-orders">
                    <div class="icon">📦</div>
                    <h2>No Orders Yet</h2>
                    <p>Start shopping to see your orders here.</p>
                    <a href="index.html" class="button button-primary" style="margin-top:1rem;">Start Shopping</a>
                </div>
            `;
            return;
        }

        let html = '';
        for (let order of orders) {
            const { data: items } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', order.id);

            const itemsHtml = items ? items.map(item => `
                <div class="order-item">
                    <img src="${item.image_url || 'https://picsum.photos/seed/default/50/50'}" alt="${item.product_name}">
                    <div class="item-detail">
                        <div class="name">${item.product_name}</div>
                        <div class="meta">${item.quantity} × ${formatPrice(item.product_price)}</div>
                    </div>
                    <div style="font-weight:600;">${formatPrice(item.product_price * item.quantity)}</div>
                </div>
            `).join('') : '';

            html += `
                <div class="order-card">
                    <div class="order-header">
                        <span class="order-id">#${order.order_number}</span>
                        <span class="order-status ${order.status}">${order.status.toUpperCase()}</span>
                    </div>
                    <div style="font-size:0.9rem; color:var(--text-secondary); margin:0.3rem 0;">
                        ${new Date(order.created_at).toLocaleDateString()} · ${order.payment_method}
                    </div>
                    <div class="order-items">${itemsHtml}</div>
                    <div class="order-footer">
                        <div><strong>Total: ${formatPrice(order.total_amount)}</strong></div>
                        <div class="order-actions">
                            ${order.status === 'pending' ? `<button class="cancel" data-order-id="${order.id}">Cancel</button>` : ''}
                            <button class="reorder" data-order-id="${order.id}">Reorder</button>
                            <a href="order-tracking.html?order_id=${order.order_number}&phone=${order.customer_phone}" class="track">Track</a>
                            <a href="#" class="invoice" data-order-id="${order.id}">Invoice</a>
                        </div>
                    </div>
                </div>
            `;
        }

        document.getElementById('ordersList').innerHTML = html;

        document.querySelectorAll('.reorder').forEach(btn => {
            btn.addEventListener('click', async function () {
                const orderId = this.dataset.orderId;
                try {
                    const { data: items } = await supabase
                        .from('order_items')
                        .select('*')
                        .eq('order_id', orderId);
                    if (items && items.length) {
                        let cart = JSON.parse(localStorage.getItem('grabby_cart') || '[]');
                        items.forEach(item => {
                            const existing = cart.find(c => String(c.id) === String(item.product_id));
                            if (existing) existing.quantity += item.quantity;
                            else cart.push({ id: item.product_id, quantity: item.quantity });
                        });
                        localStorage.setItem('grabby_cart', JSON.stringify(cart));
                        showToastMsg('Items added to cart!');
                        window.location.href = 'checkout.html?cart=true';
                    }
                } catch (e) { showToastMsg('Reorder failed'); }
            });
        });

        document.querySelectorAll('.cancel').forEach(btn => {
            btn.addEventListener('click', async function () {
                if (!confirm('Cancel this order?')) return;
                const orderId = this.dataset.orderId;
                try {
                    const { error } = await supabase
                        .from('orders')
                        .update({ status: 'cancelled' })
                        .eq('id', orderId);
                    if (error) throw error;
                    showToastMsg('Order cancelled.');
                    loadOrders();
                } catch (e) { showToastMsg('Cancel failed'); }
            });
        });

        document.querySelectorAll('.invoice').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                const orderId = this.dataset.orderId;
                const order = orders.find(o => String(o.id) === String(orderId));
                if (!order) return;
                const text = `Invoice\nOrder #${order.order_number}\nDate: ${new Date(order.created_at).toLocaleString()}\nTotal: ${formatPrice(order.total_amount)}\nPayment: ${order.payment_method}\nStatus: ${order.status}\n\nThank you for shopping with Grabby Tech!`;
                const blob = new Blob([text], { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `invoice-${order.order_number}.txt`;
                a.click();
            });
        });

    } catch (err) {
        console.error(err);
        document.getElementById('ordersList').innerHTML = '<p style="color:var(--danger);">Error loading orders.</p>';
    }
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        const supabase = createClient();
        if (supabase) {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        }
    } catch (e) { showToastMsg('Logout failed'); }
});

// ─── INIT ───────────────────────────────────────────────
loadTheme();
loadSitePalette();
document.addEventListener('storage', (e) => { if (e.key === 'grabby_theme') loadTheme(); });
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

loadOrders();