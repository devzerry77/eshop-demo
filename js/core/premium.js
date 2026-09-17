// ─── PREMIUM SHARED UTILITIES (wishlist, recently-viewed, dialog, invoice) ───
const WL_KEY = 'eshop_wishlist';
const RV_KEY = 'eshop_recently_viewed';

export function getWishlist() {
  try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch { return []; }
}
export function isWishlisted(id) {
  return getWishlist().some(x => String(x) === String(id));
}
export function toggleWishlist(id) {
  let list = getWishlist().map(String);
  id = String(id);
  if (list.includes(id)) list = list.filter(x => x !== id);
  else list.push(id);
  try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new CustomEvent('wishlist:changed', { detail: { list } }));
  return list.includes(id);
}
export function pushRecentlyViewed(id) {
  try {
    if (localStorage.getItem('eshop_recently_viewed_enabled') === 'false') return;
    let list = JSON.parse(localStorage.getItem(RV_KEY) || '[]').map(String).filter(x => x !== String(id));
    list.unshift(String(id));
    localStorage.setItem(RV_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {}
}
export function getRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem(RV_KEY) || '[]'); } catch { return []; }
}
export function discountPct(p) {
  if (!p || !p.originalPrice || p.originalPrice <= p.price) return 0;
  return Math.round((1 - p.price / p.originalPrice) * 100);
}
export function stockState(p) {
  if (!p || !p.inStock) return 'out';
  if (p.stockQty !== null && p.stockQty !== undefined && p.stockQty <= (p.lowStockThreshold || 5)) return 'low';
  return 'ok';
}
function toastHost() {
  let host = document.getElementById('premiumToastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'premiumToastHost';
    host.setAttribute('aria-live', 'polite');
    host.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:700;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
    document.body.appendChild(host);
  }
  return host;
}
export function premiumToast(msg, type = 'info', ms = 2600) {
  const host = toastHost();
  // Cap stacked toasts so rapid taps never cover the screen.
  while (host.children.length >= 3) host.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'p-toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
  el.setAttribute('role', 'status');
  el.style.pointerEvents = 'auto';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, ms);
}
export function premiumConfirm({ title = 'Are you sure?', body = 'This action cannot be undone.', okText = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'p-dialog-overlay';
    ov.innerHTML = `<div class="p-dialog" role="dialog" aria-modal="true">
      <h3></h3><p></p>
      <div class="p-dialog-actions">
        <button class="p-btn" data-x="no">Cancel</button>
        <button class="p-btn ${danger ? 'danger' : 'primary'}" data-x="yes"></button>
      </div></div>`;
    ov.querySelector('h3').textContent = title;
    ov.querySelector('p').textContent = body;
    ov.querySelector('[data-x="yes"]').textContent = okText;
    const done = v => { ov.remove(); resolve(v); };
    ov.querySelector('[data-x="no"]').onclick = () => done(false);
    ov.querySelector('[data-x="yes"]').onclick = () => done(true);
    ov.addEventListener('click', e => { if (e.target === ov) done(false); });
    document.body.appendChild(ov);
  });
}
export function orderTimelineHTML(status) {
  const steps = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'];
  const labels = { pending: 'Order placed', confirmed: 'Confirmed', processing: 'Processing', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered' };
  const terminal = ['cancelled', 'returned', 'refunded', 'payment_failed'];
  if (terminal.includes(status)) {
    return `<div class="p-timeline"><div class="p-tl-item current"><div class="p-tl-dot">!</div>
      <div class="p-tl-body"><b>${status.replace(/_/g, ' ').toUpperCase()}</b><span>Order ${status}. Contact support for help.</span></div></div></div>`;
  }
  const idx = Math.max(0, steps.indexOf(status));
  return `<div class="p-timeline" aria-label="Order progress">` + steps.map((s, i) => `
    <div class="p-tl-item ${i < idx ? 'done' : i === idx ? 'current' : ''}">
      <div class="p-tl-dot">${i < idx ? '✓' : (i + 1)}</div>
      <div class="p-tl-body"><b>${labels[s]}</b><span>${i <= idx ? 'Completed' : 'Upcoming'}</span></div>
    </div>`).join('') + `</div>`;
}
export function invoiceHTML({ order, items, shop = {}, currency = '৳' }) {
  const rows = (items || []).map(it => `<tr><td>${escapeAttr(it.product_name || it.title || 'Item')}</td>
    <td class="num">${it.quantity}</td><td class="num">${currency} ${Number(it.product_price || it.price || 0).toLocaleString()}</td>
    <td class="num">${currency} ${(Number(it.product_price || it.price || 0) * Number(it.quantity || 1)).toLocaleString()}</td></tr>`).join('');
  return `<div class="p-invoice"><h3 style="margin-bottom:.25rem">${escapeAttr(shop.name || 'E-Shop Demo')}</h3>
    <p style="color:var(--text-secondary);font-size:.82rem;margin-bottom:1rem">Order ${(order.order_number || '')} · ${(order.created_at || '').toString().slice(0, 10)}</p>
    <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <table style="margin-top:.5rem"><tbody>
    <tr><td>Subtotal</td><td class="num">${currency} ${Number(order.total_amount || 0).toLocaleString()}</td></tr>
    <tr><td>Shipping</td><td class="num">${currency} ${Number(order.shipping_cost || 0).toLocaleString()}</td></tr>
    <tr><td>Discount</td><td class="num">− ${currency} ${Number(order.discount || 0).toLocaleString()}</td></tr>
    </tbody></table></div>`;
}
function escapeAttr(s) {
  const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
}
