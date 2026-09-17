# Payments & Courier — integration guide (Premium v1)

## Current state (working demo)
- Manual-verify methods: **bKash, Nagad, Rocket, COD** via `payment_settings`
  (account number, instructions, trxID, fee, logo, active flag). Admin: Payments page.
- Checkout collects trxID; admin flips `payment_status` pending → verified.
- No secrets in frontend. `service_role` never ships to the browser.

## Adding an official gateway later (SSLCommerz / ShurjoPay / Stripe / bKash PG)
1. Create `supabase/functions/<gateway>-session/index.ts` (Deno, server-side only).
   Store the secret key with `supabase secrets set GATEWAY_SECRET=...`.
2. From checkout, call the function (authenticated or anon with order idempotency key),
   redirect to the returned `checkout_url`.
3. Handle the gateway webhook in a second function; verify signature server-side,
   then update `orders.payment_status` + insert `audit_logs`.
4. Add the method row in `payment_settings` with `account_info: { type: "gateway", public_key: "..." }`.

## Adding a courier later (Pathao / Steadfast / RedX)
1. Zones already exist: `shipping_zones` (districts, fee, free_above, eta, courier_hint).
2. `js/core/shipping.js` exposes `resolveZone()` + `listCouriers()` stubs.
3. Create `supabase/functions/create-shipment` holding the courier API token in env.
   Admin → Orders → “Create shipment” calls it, saves `courier_name` + `tracking_number`.
4. Tracking page already renders courier + tracking number + timeline.
