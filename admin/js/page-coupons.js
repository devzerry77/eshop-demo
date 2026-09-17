/* ─── ADMIN: COUPONS (Premium v1, uses coupons v2 columns) ─── */
(() => {
  const admin = (window.admin = window.admin || {});
  let editing = null;
  const $ = id => document.getElementById(id);

  async function load() {
    const sb = admin.STATE.supabase;
    if (!sb) return;
    const { data, error } = await sb.from('coupons').select('*').order('code');
    const tb = $('couponRows');
    if (error) { tb.innerHTML = `<tr><td colspan="10">Error: ${escapeHtml(error.message)}. Run premium-v1.sql.</td></tr>`; return; }
    const now = new Date();
    let active = 0, used = 0, expired = 0;
    (data || []).forEach(c => {
      if (c.active) active++;
      used += Number(c.used_count || 0);
      if (c.valid_to && new Date(c.valid_to) < now) expired++;
    });
    $('kpiActive').textContent = active;
    $('kpiUsed').textContent = used.toLocaleString();
    $('kpiExpired').textContent = expired;
    tb.innerHTML = (data || []).map(c => `<tr>
      <td><b>${escapeHtml(c.code)}</b>${c.campaign ? `<br><small>${escapeHtml(c.campaign)}</small>` : ''}</td>
      <td>${escapeHtml(c.discount_type || '')}</td><td>${escapeHtml(String(c.discount_value ?? ''))}</td>
      <td>${c.min_order_amount || 0}</td><td>${c.max_discount ?? '—'}</td>
      <td>${c.used_count || 0}${c.usage_limit ? ' / ' + c.usage_limit : ''}</td>
      <td>${c.per_user_limit ?? '∞'}</td>
      <td><small>${(c.valid_from || '').slice(0, 10)} → ${(c.valid_to || '').slice(0, 10)}</small></td>
      <td><span class="p-status ${c.active ? 'delivered' : 'cancelled'}">${c.active ? 'active' : 'off'}</span></td>
      <td style="white-space:nowrap"><button class="button-secondary" data-edit="${escapeHtml(c.code)}">Edit</button>
      <button class="button-secondary" data-toggle="${escapeHtml(c.code)}" data-on="${c.active ? '1' : ''}">${c.active ? 'Disable' : 'Enable'}</button></td>
    </tr>`).join('') || '<tr><td colspan="10">No coupons yet.</td></tr>';
    tb.querySelectorAll('[data-edit]').forEach(b => (b.onclick = () => openDialog((data || []).find(x => x.code === b.dataset.edit))));
    tb.querySelectorAll('[data-toggle]').forEach(b => (b.onclick = async () => {
      const { error: e2 } = await sb.from('coupons').update({ active: !(b.dataset.on === '1') }).eq('code', b.dataset.toggle);
      admin.showToast(e2 ? 'Update failed: ' + e2.message : 'Updated', e2 ? 'error' : 'success');
      audit('coupon.toggle', 'coupon', b.dataset.toggle, { active: !(b.dataset.on === '1') });
      load();
    }));
  }
  function openDialog(c = null) {
    editing = c?.code || null;
    $('couponDlgTitle').textContent = editing ? 'Edit ' + editing : 'New coupon';
    $('cCode').value = c?.code || ''; $('cCode').disabled = !!editing;
    $('cType').value = c?.discount_type || 'percentage';
    $('cValue').value = c?.discount_value ?? 10;
    $('cMin').value = c?.min_order_amount ?? 0;
    $('cMax').value = c?.max_discount ?? '';
    $('cLimit').value = c?.usage_limit ?? '';
    $('cPerUser').value = c?.per_user_limit ?? '';
    $('cActive').value = String(!!(c?.active ?? true));
    $('cFrom').value = (c?.valid_from || '').slice(0, 10);
    $('cTo').value = (c?.valid_to || '').slice(0, 10);
    $('cCampaign').value = c?.campaign || '';
    $('couponDialog').hidden = false;
    // Move focus into the dialog for keyboard users.
    setTimeout(() => { try { $('cCode').disabled ? $('cValue').focus() : $('cCode').focus(); } catch (_) {} }, 50);
  }
  // v2-only columns — stripped + retried on DBs without premium-v1.sql.
  const V2_KEYS = ['max_discount', 'per_user_limit', 'campaign'];
  function stripV2(p) { V2_KEYS.forEach(k => delete p[k]); return p; }
  function isMissingColumn(e) { return e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(e.message || '')); }
  async function save() {
    const sb = admin.STATE.supabase;
    const num = v => (v === '' || v == null ? null : Number(v));
    const payload = {
      discount_type: $('cType').value,
      discount_value: Number($('cValue').value) || 0,
      min_order_amount: Number($('cMin').value) || 0,
      max_discount: num($('cMax').value),
      usage_limit: num($('cLimit').value),
      per_user_limit: num($('cPerUser').value),
      active: $('cActive').value === 'true',
      valid_from: $('cFrom').value ? new Date($('cFrom').value).toISOString() : new Date().toISOString(),
      valid_to: $('cTo').value ? new Date($('cTo').value).toISOString() : null,
      campaign: $('cCampaign').value.trim() || null,
    };
    let error;
    if (editing) {
      ({ error } = await sb.from('coupons').update(payload).eq('code', editing));
      if (error && isMissingColumn(error)) ({ error } = await sb.from('coupons').update(stripV2({ ...payload })).eq('code', editing));
    } else {
      ({ error } = await sb.from('coupons').insert({ code: $('cCode').value.trim().toUpperCase(), ...payload }));
      if (error && isMissingColumn(error)) ({ error } = await sb.from('coupons').insert({ code: $('cCode').value.trim().toUpperCase(), ...stripV2({ ...payload }) }));
    }
    if (error) { admin.showToast('Save failed: ' + error.message, 'error'); return; }
    $('couponDialog').hidden = true;
    admin.showToast('Coupon saved', 'success');
    audit(editing ? 'coupon.update' : 'coupon.create', 'coupon', editing || $('cCode').value.trim().toUpperCase(), payload);
    load();
  }
  async function audit(action, entity, entity_id, metadata) {
    try {
      const sb = admin.STATE.supabase;
      const { data: { user } } = await sb.auth.getUser();
      await sb.from('audit_logs').insert({ actor_email: user?.email || null, action, entity, entity_id, metadata: metadata || {} });
    } catch {}
  }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
  admin.bootstrapApp(async () => {
    $('newCouponBtn').onclick = () => openDialog(null);
    $('couponCancel').onclick = () => ($('couponDialog').hidden = true);
    $('couponSave').onclick = save;
    // Overlay click + Escape also dismiss (Cancel parity).
    $('couponDialog').addEventListener('click', e => { if (e.target === $('couponDialog')) $('couponDialog').hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('couponDialog').hidden) $('couponDialog').hidden = true; });
    await load();
  });
})();
