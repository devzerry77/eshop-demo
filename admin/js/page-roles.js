/* ─── ADMIN: STAFF ROLES ─── */
(() => {
  const admin = (window.admin = window.admin || {});
  const $ = id => document.getElementById(id);
  const esc = s => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
  async function load() {
    const sb = admin.STATE.supabase;
    const { data, error } = await sb.from('admin_roles').select('*').order('created_at');
    if (error) {
      $('roleRows').innerHTML = `<tr><td colspan="4">${esc(error.message)} — run premium-v1.sql then re-login.</td></tr>`;
      $('roleWarn').style.display = 'block';
      $('roleWarn').textContent = 'admin_roles table missing. Run premium-v1.sql in Supabase SQL Editor.';
      return;
    }
    $('roleRows').innerHTML = (data || []).map(r => `<tr><td><b>${esc(r.email)}</b></td>
      <td><span class="p-status ${r.role === 'super_admin' ? 'pending' : 'processing'}">${esc(r.role)}</span></td>
      <td><small>${esc((r.created_at || '').slice(0, 10))}</small></td>
      <td><button class="button-secondary" data-del="${esc(r.email)}">Remove</button></td></tr>`).join('') || '<tr><td colspan="4">No staff yet.</td></tr>';
    $('roleRows').querySelectorAll('[data-del]').forEach(b => (b.onclick = async () => {
      if (!confirm('Remove ' + b.dataset.del + '?')) return;
      const { error: e2 } = await sb.from('admin_roles').delete().eq('email', b.dataset.del);
      admin.showToast(e2 ? e2.message : 'Removed', e2 ? 'error' : 'success');
      load();
    }));
  }
  function openDialog() {
    $('roleDialog').hidden = false;
    setTimeout(() => { try { $('rEmail').focus(); } catch (_) {} }, 50);
  }
  admin.bootstrapApp(async () => {
    $('addRoleBtn').onclick = openDialog;
    $('roleCancel').onclick = () => ($('roleDialog').hidden = true);
    $('roleDialog').addEventListener('click', e => { if (e.target === $('roleDialog')) $('roleDialog').hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('roleDialog').hidden) $('roleDialog').hidden = true; });
    $('roleSave').onclick = async () => {
      const sb = admin.STATE.supabase;
      const email = $('rEmail').value.trim().toLowerCase();
      if (!email) return admin.showToast('Email required', 'error');
      const { error } = await sb.from('admin_roles').upsert({ email, role: $('rRole').value });
      if (error) admin.showToast(error.message, 'error');
      else { $('roleDialog').hidden = true; admin.showToast('Saved', 'success'); load(); }
    };
    await load();
  });
})();
