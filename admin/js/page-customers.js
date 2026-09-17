/* ─── ADMIN: CUSTOMERS (aggregated from orders — no PII over-exposure) ─── */
(() => {
  const admin = (window.admin = window.admin || {});
  const $ = id => document.getElementById(id);
  const esc = s => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
  let list = [];
  admin.bootstrapApp(async () => {
    const sb = admin.STATE.supabase;
    if (!sb) return;
    const { data, error } = await sb.from('orders').select('customer_name,customer_email,customer_phone,total_amount,status,city,area,created_at').order('created_at', { ascending: false }).limit(2000);
    if (error) { $('cRows').innerHTML = `<tr><td colspan="5">${esc(error.message)}</td></tr>`; return; }
    const map = new Map();
    (data || []).forEach(o => {
      const key = (o.customer_email || o.customer_phone || 'guest').toLowerCase();
      if (!map.has(key)) map.set(key, { name: o.customer_name, email: o.customer_email, phone: o.customer_phone, orders: 0, spent: 0, last: '', area: o.area || o.city || '' });
      const c = map.get(key);
      c.orders++; c.last = (o.created_at || '').slice(0, 10);
      if (!['cancelled', 'returned', 'refunded'].includes(o.status)) c.spent += Number(o.total_amount || 0);
      if (!c.area && (o.area || o.city)) c.area = o.area || o.city;
    });
    list = [...map.values()].sort((a, b) => b.spent - a.spent);
    $('cTotal').textContent = list.length;
    $('cRepeat').textContent = list.filter(c => c.orders >= 2).length;
    $('cRev').textContent = '৳ ' + Math.round(list.reduce((s, c) => s + c.spent, 0)).toLocaleString();
    $('cRows').innerHTML = list.slice(0, 200).map(c => `<tr><td><b>${esc(c.name || 'Guest')}</b><br><small>${esc(c.email || '')} ${esc(c.phone || '')}</small></td>
      <td>${c.orders}</td><td>৳ ${Math.round(c.spent).toLocaleString()}</td><td>${esc(c.last)}</td><td>${esc(c.area)}</td></tr>`).join('') || '<tr><td colspan="5">No customers yet.</td></tr>';
    $('exportCustomers').onclick = () => {
      const csv = 'name,email,phone,orders,spent,last_order\n' + list.map(c => [c.name, c.email, c.phone, c.orders, Math.round(c.spent), c.last].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'customers.csv'; a.click();
    };
  });
})();
