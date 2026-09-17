/* ─── ADMIN: MARKETING & SEO ─── */
(() => {
  const admin = (window.admin = window.admin || {});
  const $ = id => document.getElementById(id);
  const KEYS = ['seo_title', 'seo_description', 'seo_keywords', 'announcement_text', 'newsletter_title', 'newsletter_subtitle'];
  const MAP = { seo_title: 'mSeoTitle', seo_description: 'mSeoDesc', seo_keywords: 'mSeoKw', announcement_text: 'mAnnounce', newsletter_title: 'mNewsTitle', newsletter_subtitle: 'mNewsSub' };
  async function load() {
    const sb = admin.STATE.supabase;
    if (!sb) return;
    const { data } = await sb.from('settings').select('key,value').in('key', KEYS);
    (data || []).forEach(r => { const id = MAP[r.key]; if (id && $(id)) $(id).value = r.value || ''; });
    const { data: zones } = await sb.from('shipping_zones').select('*').order('id');
    $('zoneRows').innerHTML = (zones || []).map(z => `<tr><td><b>${escapeHtml(z.name)}</b></td><td>${z.fee}</td><td>${z.free_above ?? '—'}</td><td>${escapeHtml(z.eta_days || '')}</td><td>${escapeHtml(z.courier_hint || '')}</td></tr>`).join('') || '<tr><td colspan="5">No zones — run premium-v1.sql.</td></tr>';
  }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
  admin.bootstrapApp(async () => {
    await load();
    $('saveMarketing').onclick = async () => {
      const sb = admin.STATE.supabase;
      for (const k of KEYS) {
        const id = MAP[k];
        await sb.from('settings').upsert({ key: k, value: $(id).value });
      }
      try {
        const { data: { user } } = await sb.auth.getUser();
        await sb.from('audit_logs').insert({ actor_email: user?.email || null, action: 'settings.marketing', entity: 'settings', entity_id: 'marketing-seo', metadata: {} });
      } catch {}
      admin.showToast('Marketing & SEO saved', 'success');
    };
  });
})();
