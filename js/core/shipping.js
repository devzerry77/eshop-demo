// ─── SHIPPING (courier-ready architecture, Premium v1) ───
// Today: zone lookup from `shipping_zones` (fallback: settings free_above/cost).
// Future: implement createShipment() per courier AFTER signing contracts.
// Do NOT hardcode courier API secrets here — use a Supabase Edge Function
// with the secret stored in server env, called from the admin panel.
import { createClient } from '../supabase/client.js';

const COURIERS = {
  standard: { label: 'Standard courier', createShipment: null },
  pathao: { label: 'Pathao Courier (stub)', createShipment: null },
  steadfast: { label: 'Steadfast (stub)', createShipment: null },
  redx: { label: 'RedX (stub)', createShipment: null },
};

export function listCouriers() {
  return Object.entries(COURIERS).map(([id, c]) => ({ id, label: c.label, ready: !!c.createShipment }));
}

// Resolve zone fee client-side for UX only — checkout RPC recomputes server-side.
export async function resolveZone(district) {
  try {
    const sb = createClient();
    if (!sb) return null;
    const { data } = await sb.from('shipping_zones').select('*').eq('active', true);
    if (!data?.length) return null;
    const d = String(district || '').toLowerCase();
    return (
      data.find(z => (z.districts || []).some(x => String(x).toLowerCase() === d)) ||
      data.find(z => !(z.districts || []).length) ||
      data[0]
    );
  } catch { return null; }
}

// ─── FUTURE INTEGRATION POINT ───
// export async function createShipment({ courier = 'steadfast', order }) {
//   // 1. Deploy supabase/functions/create-shipment with the courier secret in env.
//   // 2. POST { courier, order } from admin/orders.html (admin auth required).
//   // 3. Save returned tracking_number + courier_name via set_order_status metadata.
//   throw new Error(`Courier "${courier}" not configured yet — see docs/PAYMENTS-COURIER.md`);
// }
export { COURIERS };
