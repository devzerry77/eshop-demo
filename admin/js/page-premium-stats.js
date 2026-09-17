/* ─── PAGE: DASHBOARD PREMIUM (server snapshot + 14-day chart) ───
   Loaded AFTER page-dashboard.js. Exposes admin.renderPremiumStats(),
   which page-dashboard.js calls once orders/products are loaded. */
(() => {
  "use strict";
  const admin = window.admin;
  let refreshTimer = null;
  let resizeBound = false;

  async function paint() {
    try {
      const sb = admin.STATE && admin.STATE.supabase;
      if (!sb) return;
      const { data, error } = await sb.rpc('admin_stats');
      if (!error && data && data.ok) {
        const fmt = n => '৳ ' + Math.round(Number(n || 0)).toLocaleString();
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('pRevToday', fmt(data.revenue_today));
        const todayCount = (admin.STATE.orders || []).filter(o => String(o.created_at || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
        set('pOrdToday', todayCount + ' orders today');
        set('pRevWeek', fmt(data.revenue_week));
        set('pRevMonth', fmt(data.revenue_month));
        set('pStock', `${data.products_low} / ${data.products_out}`);
        set('pStockSub', 'low / out of stock');
        const note = document.getElementById('premiumStatsNote');
        if (note) note.textContent = `Total revenue ${fmt(data.revenue_total)} · ${data.orders_total} orders · ${data.customers_total} customers`;
      } else if (error) {
        const note = document.getElementById('premiumStatsNote');
        if (note) note.textContent = 'Server stats unavailable — showing local trends.';
      }
      // Defer chart until layout settles so canvas width is correct.
      requestAnimationFrame(() => requestAnimationFrame(drawChart));
    } catch (e) { console.warn('premium stats:', e && e.message); }
  }

  function drawChart() {
    const cv = document.getElementById('pOrdersChart');
    if (!cv) return;
    const orders = (admin.STATE && admin.STATE.orders) || [];
    const days = [...Array(14)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return d.toISOString().slice(0, 10);
    });
    const counts = days.map(d => orders.filter(o => String(o.created_at || '').slice(0, 10) === d).length);
    const max = Math.max(1, ...counts);
    const ctx = cv.getContext('2d');
    const W = (cv.width = Math.max(280, cv.clientWidth || cv.offsetWidth || 600)), H = (cv.height = 140);
    ctx.clearRect(0, 0, W, H);
    const bw = W / 14;
    counts.forEach((c, i) => {
      const h = Math.max(4, (c / max) * (H - 30));
      const x = i * bw + bw * 0.22, w = bw * 0.56, y = H - 18 - h;
      ctx.fillStyle = c ? '#6d28d9' : '#e5e7eb';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, 5); else ctx.rect(x, y, w, h);
      ctx.fill();
    });
    ctx.fillStyle = '#6b7280'; ctx.font = '10px Inter, sans-serif';
    ctx.fillText(days[0], 4, H - 4);
    ctx.fillText(days[13], W - 62, H - 4);
  }

  admin.renderPremiumStats = async () => {
    await paint();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(paint, 60000);
    if (!resizeBound) {
      resizeBound = true;
      let t = null;
      window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(drawChart, 200); });
    }
  };
})();
