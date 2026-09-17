/* ─── ADMIN: INVENTORY ─── */
(() => {
  const admin = (window.admin = window.admin || {});
  const $ = id => document.getElementById(id);
  const esc = s => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
  let rows = [];
  function paint(filter = '') {
    const q = filter.toLowerCase();
    const list = rows.filter(r => !q || (r.title || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q));
    let ok = 0, low = 0, out = 0;
    rows.forEach(r => {
      const qty = Number(r.stock_quantity ?? 0);
      if (qty <= 0 || r.in_stock === false) out++;
      else if (qty <= Number(r.low_stock_threshold ?? 5)) low++;
      else ok++;
    });
    $('invOk').textContent = ok; $('invLow').textContent = low; $('invOut').textContent = out;
    $('invRows').innerHTML = list.slice(0, 100).map(r => {
      const qty = Number(r.stock_quantity ?? 0);
      const st = (qty <= 0 || r.in_stock === false) ? ['cancelled', 'OUT'] : (qty <= Number(r.low_stock_threshold ?? 5) ? ['pending', 'LOW'] : ['delivered', 'OK']);
      return `<tr><td><b>${esc(r.title)}</b><br><small>${esc(r.category || '')}</small></td>
        <td><code>${esc(r.sku || ('ESH-' + String(r.id).padStart(6, '0')))}</code></td>
        <td><b>${qty}</b></td><td>${r.low_stock_threshold ?? 5}</td>
        <td><span class="p-status ${st[0]}">${st[1]}</span></td>
        <td style="white-space:nowrap"><button class="button-secondary" data-adj="${r.id}|1">+1</button>
        <button class="button-secondary" data-adj="${r.id}|-1">−1</button>
        <button class="button-secondary" data-adj="${r.id}|10">+10</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">No products.</td></tr>';
    $('invRows').querySelectorAll('[data-adj]').forEach(b => (b.onclick = async () => {
      const [pid, delta] = b.dataset.adj.split('|');
      const sb = admin.STATE.supabase;
      const { data, error } = await sb.rpc('adjust_stock', { p_product_id: Number(pid), p_variant_id: null, p_delta: Number(delta), p_reason: 'manual_adjust', p_note: 'admin panel' });
      if (error || !data?.ok) admin.showToast('Adjust failed: ' + (error?.message || data?.error || 'unknown'), 'error');
      else { admin.showToast('Stock updated', 'success'); init(); }
    }));
  }
  async function init() {
    const sb = admin.STATE.supabase;
    if (!sb) return;
    const { data, error } = await sb.from('products').select('id,title,category,sku,stock_quantity,in_stock,low_stock_threshold').order('id').limit(500);
    if (error) { $('invRows').innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`; return; }
    rows = data || [];
    paint($('invSearch').value);
    const { data: ledger } = await sb.from('inventory_ledger').select('created_at,product_id,change_qty,reason,actor_email').order('created_at', { ascending: false }).limit(50);
    const byId = new Map(rows.map(r => [r.id, r.title]));
    $('ledgerRows').innerHTML = (ledger || []).map(l => `<tr><td><small>${esc((l.created_at || '').slice(0, 16).replace('T', ' '))}</small></td>
      <td>${esc(byId.get(l.product_id) || ('#' + l.product_id))}</td>
      <td><b style="color:${l.change_qty > 0 ? 'green' : 'red'}">${l.change_qty > 0 ? '+' : ''}${l.change_qty}</b></td>
      <td>${esc(l.reason || '')}</td><td><small>${esc(l.actor_email || '')}</small></td></tr>`).join('') || '<tr><td colspan="5">No history yet — adjustments will appear here.</td></tr>';
  }
  admin.bootstrapApp(async () => { $('invSearch').oninput = e => paint(e.target.value); await init(); });
})();
