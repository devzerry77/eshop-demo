/* ─── ADMIN: AUDIT LOGS ─── */
(() => {
  const admin = (window.admin = window.admin || {});
  const $ = id => document.getElementById(id);
  const esc = s => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
  async function load() {
    const sb = admin.STATE.supabase;
    const f = $('logFilter').value;
    let q = sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (f) q = q.ilike('action', f + '%');
    const { data, error } = await q;
    if (error) { $('logRows').innerHTML = `<tr><td colspan="5">${esc(error.message)} — run premium-v1.sql.</td></tr>`; return; }
    $('logRows').innerHTML = (data || []).map(l => `<tr><td><small>${esc((l.created_at || '').slice(0, 16).replace('T', ' '))}</small></td>
      <td><small>${esc(l.actor_email || 'system')}</small></td><td><code>${esc(l.action)}</code></td>
      <td>${esc(l.entity || '')} ${esc(l.entity_id || '')}</td><td><small>${esc(JSON.stringify(l.metadata || {}).slice(0, 120))}</small></td></tr>`).join('') || '<tr><td colspan="5">No audit events yet. Status changes, inventory and coupon edits will appear here.</td></tr>';
  }
  admin.bootstrapApp(async () => { $('logFilter').onchange = load; await load(); });
})();
