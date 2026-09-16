-- ────────────────────────────────────────────────────────────────
-- guest-checkout.sql — Customer Order Mode + secure guest checkout
--
-- Run in Supabase: SQL Editor -> open guest-checkout.sql -> Run.
-- Run AFTER all.sql (and stock-quantity.sql). Safe to re-run
-- (every statement is idempotent).
--
-- What it does:
--  1. Seeds the `customer_order_mode` row in the EXISTING `settings`
--     table ('login' = require login, 'guest' = allow guest checkout).
--     The Admin panel (Settings page) reads/writes this same row —
--     no second settings system is created.
--  2. Adds `orders.is_guest` + `orders.idempotency_key` (unique) so
--     guest orders live in the SAME orders table and the admin
--     manages them exactly like normal orders.
--  3. Creates `create_order_secure(...)` (SECURITY DEFINER) — the ONLY
--     path the checkout uses. It re-reads the saved order mode and:
--       - rejects anonymous callers while mode = 'login'
--       - validates + sanitizes every input server-side
--       - looks up TRUSTED product prices / stock from `products`
--         (client prices, discounts, shipping, totals are ignored)
--       - re-validates coupon + payment method + fee server-side
--       - enforces stock atomically (concurrent checkouts cannot
--         oversell; the whole transaction rolls back on shortage)
--       - enforces an idempotency key (double-click / refresh /
--         retry returns the already-created order, never a duplicate)
--       - rate-limits guest ordering per email/phone (abuse guard)
--       - always creates orders with payment_status = 'pending' and
--         status = 'pending' (order ownership / payment state can
--         never be set from the browser)
--  4. Creates `get_order_public(order_number)` (SECURITY DEFINER) so
--     guests can view tracking / confirmation WITHOUT exposing
--     email, phone or address through a public API.
--  5. Adds an insert guard trigger + additive (non-breaking) RLS
--     policies: owners read their own orders, the store admin reads
--     everything. Direct anonymous reads/writes stay as they were
--     until you drop the legacy permissive policies (see the
--     optional hardening block at the bottom).
--
-- Security notes:
--  * Never put the `service_role` key in client code or this repo.
--  * Errors returned to the browser are generic codes; details go
--    to the Postgres log via RAISE LOG (no PII is exposed).
-- ────────────────────────────────────────────────────────────────

-- 1. Seed the mode in the EXISTING settings table (default: login required)
INSERT INTO public.settings (key, value)
VALUES ('customer_order_mode', 'login')
ON CONFLICT (key) DO NOTHING;

-- 2. Guest columns on the EXISTING orders table
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uidx
    ON public.orders (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Backfill: historic orders without a user are guest orders.
UPDATE public.orders
SET is_guest = true
WHERE user_id IS NULL AND is_guest IS NOT TRUE;

-- 3a. Reuse the admin-email helper from reviews.sql when present,
--     otherwise create the same default (admin全-access policies below
--     depend on it). Never overwrites an existing custom value.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grabby_admin_email') THEN
        EXECUTE $fn$
            CREATE FUNCTION public.grabby_admin_email()
            RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'grabby@tech.com' $$;
        $fn$;
    END IF;
END
$$;

-- 3b. SECURE ORDER CREATION — single entry point for checkout.
-- Client sends ONLY: contact/address text, payment method name,
-- coupon code, [{product_id, quantity}] and an idempotency key.
-- Prices, discounts, shipping, totals, payment status and ownership
-- are ALL derived server-side from trusted tables + auth state.
CREATE OR REPLACE FUNCTION public.create_order_secure(
    p_name text,
    p_email text,
    p_phone text,
    p_address1 text,
    p_address2 text,
    p_city text,
    p_state text,
    p_area text,
    p_country text,
    p_payment_method text,
    p_coupon_code text,
    p_items jsonb,
    p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_mode text := 'login';
    v_name text; v_email text; v_phone text; v_digits text;
    v_address1 text; v_address2 text; v_city text; v_state text;
    v_area text; v_country text; v_payment text; v_coupon text; v_idem text;
    v_count integer := 0; v_total_qty integer := 0;
    v_subtotal numeric := 0; v_shipping numeric := 0;
    v_discount numeric := 0; v_fee numeric := 0; v_total numeric := 0;
    v_order_id public.orders.id%TYPE;
    v_order_number text;
    v_existing_id public.orders.id%TYPE;
    v_existing_number text;
    v_recent integer := 0;
    v_lines jsonb := '[]'::jsonb;
    el jsonb; v_pid bigint; v_qty integer;
    v_price numeric; v_stock integer; v_in_stock boolean;
    v_pname text; v_pimg text;
    v_pay record; v_coupon_rec record;
    v_attempts integer := 0;
    BAD text := 'INVALID_INPUT';
BEGIN
    -- ── Saved order mode (secure default: login required) ──
    BEGIN
        SELECT value INTO v_mode FROM public.settings
        WHERE key = 'customer_order_mode' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_mode := 'login';
    END;
    IF v_mode IS NULL OR v_mode NOT IN ('login', 'guest') THEN
        v_mode := 'login';
    END IF;
    IF v_uid IS NULL AND v_mode = 'login' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'LOGIN_REQUIRED');
    END IF;

    -- ── Sanitize (length-cap every free-text field) ──
    v_name     := left(btrim(COALESCE(p_name, '')), 80);
    v_email    := left(lower(btrim(COALESCE(p_email, ''))), 320);
    v_phone    := left(btrim(COALESCE(p_phone, '')), 30);
    v_address1 := left(btrim(COALESCE(p_address1, '')), 200);
    v_address2 := left(btrim(COALESCE(p_address2, '')), 200);
    v_city     := left(btrim(COALESCE(p_city, '')), 80);
    v_state    := left(btrim(COALESCE(p_state, '')), 80);
    v_area     := left(btrim(COALESCE(p_area, '')), 80);
    v_country  := left(btrim(COALESCE(p_country, '')), 80);
    v_payment  := left(btrim(COALESCE(p_payment_method, '')), 80);
    v_coupon   := upper(left(btrim(COALESCE(p_coupon_code, '')), 40));
    v_idem     := left(btrim(COALESCE(p_idempotency_key, '')), 100);

    -- ── Validate contact / address ──
    IF char_length(v_name) < 2 THEN
        RETURN jsonb_build_object('ok', false, 'error', BAD);
    END IF;
    IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', BAD);
    END IF;
    v_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
    IF char_length(v_digits) < 6 OR char_length(v_digits) > 15 THEN
        RETURN jsonb_build_object('ok', false, 'error', BAD);
    END IF;
    IF char_length(v_address1) < 5 OR char_length(v_city) < 2
       OR char_length(v_country) < 2 THEN
        RETURN jsonb_build_object('ok', false, 'error', BAD);
    END IF;
    IF v_payment = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PAYMENT');
    END IF;

    -- ── Validate items shape ──
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
        RETURN jsonb_build_object('ok', false, 'error', BAD);
    END IF;
    SELECT count(*) INTO v_count FROM jsonb_array_elements(p_items);
    IF v_count < 1 OR v_count > 50 THEN
        RETURN jsonb_build_object('ok', false, 'error', BAD);
    END IF;
    IF v_idem <> '' AND v_idem !~ '^[A-Za-z0-9_.:~+-]{8,100}$' THEN
        v_idem := '';
    END IF;

    -- ── Idempotency: refresh / retry / double-click returns the
    --    already-created order instead of inserting a duplicate ──
    IF v_idem <> '' THEN
        SELECT id, order_number INTO v_existing_id, v_existing_number
        FROM public.orders WHERE idempotency_key = v_idem LIMIT 1;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'ok', true, 'deduped', true,
                'order_id', v_existing_id, 'order_number', v_existing_number);
        END IF;
    ELSE
        v_idem := NULL;
    END IF;

    -- ── Abuse guard: max 5 orders / hour per email or phone ──
    SELECT count(*) INTO v_recent FROM public.orders
    WHERE created_at > now() - interval '1 hour'
      AND (lower(customer_email) = v_email OR customer_phone = v_phone);
    IF v_recent >= 5 THEN
        RAISE LOG 'guest order rate-limited (email/phone seen % times in 1h)', v_recent;
        RETURN jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
    END IF;

    -- ── Payment method + fee from the TRUSTED table ──
    SELECT * INTO v_pay FROM public.payment_settings
    WHERE method_name = v_payment
      AND COALESCE(enabled, true) = true
      AND COALESCE(status, 'available') = 'available'
    LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PAYMENT');
    END IF;
    v_fee := COALESCE(v_pay.fee, 0);

    -- ── Price + stock from the TRUSTED products table ──
    FOR el IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        BEGIN
            v_pid := (el ->> 'product_id')::bigint;
            v_qty := (el ->> 'quantity')::integer;
        EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('ok', false, 'error', BAD);
        END;
        IF v_pid IS NULL OR v_qty IS NULL OR v_qty < 1 OR v_qty > 10 THEN
            RETURN jsonb_build_object('ok', false, 'error', BAD);
        END IF;
        SELECT price, stock_quantity, in_stock, title, image
          INTO v_price, v_stock, v_in_stock, v_pname, v_pimg
        FROM public.products WHERE id = v_pid;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PRODUCT');
        END IF;
        IF COALESCE(v_in_stock, true) = false THEN
            RETURN jsonb_build_object('ok', false, 'error', 'OUT_OF_STOCK');
        END IF;
        -- NULL stock_quantity = uncapped legacy row (never treat as 0).
        IF v_stock IS NOT NULL AND v_stock < v_qty THEN
            RETURN jsonb_build_object('ok', false, 'error', 'OUT_OF_STOCK');
        END IF;
        v_price := COALESCE(v_price, 0);
        v_subtotal := v_subtotal + v_price * v_qty;
        v_total_qty := v_total_qty + v_qty;
        v_lines := v_lines || jsonb_build_object(
            'product_id', v_pid, 'quantity', v_qty,
            'price', v_price,
            'name', left(COALESCE(v_pname, 'Product'), 200),
            'image', left(COALESCE(v_pimg, ''), 500),
            'stock', v_stock);
    END LOOP;
    IF v_total_qty < 1 OR v_total_qty > 100 THEN
        RETURN jsonb_build_object('ok', false, 'error', BAD);
    END IF;

    -- ── Coupon re-validated server-side (client discount ignored) ──
    IF v_coupon <> '' THEN
        SELECT * INTO v_coupon_rec FROM public.coupons
        WHERE code = v_coupon AND COALESCE(active, false) = true LIMIT 1;
        IF NOT FOUND
           OR (v_coupon_rec.valid_from IS NOT NULL AND now() < v_coupon_rec.valid_from)
           OR (v_coupon_rec.valid_to IS NOT NULL AND now() > v_coupon_rec.valid_to)
           OR (v_coupon_rec.usage_limit IS NOT NULL
               AND COALESCE(v_coupon_rec.used_count, 0) >= v_coupon_rec.usage_limit)
           OR (v_coupon_rec.min_order_amount IS NOT NULL
               AND v_subtotal < v_coupon_rec.min_order_amount) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'INVALID_COUPON');
        END IF;
        IF v_coupon_rec.discount_type = 'percentage' THEN
            v_discount := v_subtotal * (COALESCE(v_coupon_rec.discount_value, 0) / 100);
        ELSE
            v_discount := COALESCE(v_coupon_rec.discount_value, 0);
        END IF;
        v_discount := LEAST(GREATEST(v_discount, 0), v_subtotal);
    ELSE
        v_coupon := NULL;
    END IF;

    -- ── Shipping + total from server-side rules (never the browser) ──
    v_shipping := CASE WHEN v_subtotal >= 2000 THEN 0 ELSE 100 END;
    v_total := GREATEST(round(v_subtotal + v_shipping + v_fee - v_discount, 2), 0);

    -- ── Unique order number (retry on the astronomically rare clash) ──
    LOOP
        v_attempts := v_attempts + 1;
        v_order_number := 'ORD-' || (floor(extract(epoch from now()) * 1000))::bigint
            || '-' || upper(substr(md5(random()::text), 1, 4));
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.orders WHERE order_number = v_order_number);
        IF v_attempts > 5 THEN
            RAISE LOG 'order number collision after 5 attempts';
            RETURN jsonb_build_object('ok', false, 'error', 'RETRY');
        END IF;
    END LOOP;

    -- ── Atomic insert: order + items; stock decrement is conditional
    --    so concurrent checkouts cannot oversell (0 rows updated
    --    raises, rolling back the whole transaction) ──
    INSERT INTO public.orders (
        order_number, user_id, is_guest,
        customer_name, customer_email, customer_phone,
        address_line1, address_line2, city, state, area, country,
        total_amount, discount, shipping_cost, coupon_code,
        payment_method, payment_status, status,
        estimated_delivery, idempotency_key, created_at
    ) VALUES (
        v_order_number, v_uid, (v_uid IS NULL),
        v_name, v_email, v_phone,
        v_address1, NULLIF(v_address2, ''), v_city,
        NULLIF(v_state, ''), NULLIF(v_area, ''), v_country,
        v_total, v_discount, v_shipping, v_coupon,
        v_payment, 'pending', 'pending',
        (CURRENT_DATE + 7)::text, v_idem, now()
    ) RETURNING id INTO v_order_id;

    FOR el IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
        INSERT INTO public.order_items (
            order_id, product_id, product_name,
            product_price, quantity, image_url
        ) VALUES (
            v_order_id, (el ->> 'product_id')::bigint,
            el ->> 'name', (el ->> 'price')::numeric,
            (el ->> 'quantity')::integer, NULLIF(el ->> 'image', '')
        );
        IF (el ->> 'stock') IS NOT NULL THEN
            UPDATE public.products
            SET stock_quantity = stock_quantity - (el ->> 'quantity')::integer,
                in_stock = ((stock_quantity - (el ->> 'quantity')::integer) > 0)
            WHERE id = (el ->> 'product_id')::bigint
              AND stock_quantity >= (el ->> 'quantity')::integer;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'INSUFFICIENT_STOCK';
            END IF;
        END IF;
    END LOOP;

    IF v_coupon IS NOT NULL THEN
        UPDATE public.coupons
        SET used_count = COALESCE(used_count, 0) + 1
        WHERE code = v_coupon;
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'deduped', false,
        'order_id', v_order_id, 'order_number', v_order_number,
        'total_amount', v_total);
EXCEPTION
    WHEN raise_exception THEN
        -- Insufficient-stock (and similar) aborts the whole order:
        -- surface a generic code, keep details in the server log.
        RAISE LOG 'create_order_secure aborted: %', SQLERRM;
        RETURN jsonb_build_object('ok', false, 'error', 'OUT_OF_STOCK');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_secure(
    text, text, text, text, text, text, text, text, text,
    text, text, jsonb, text
) TO anon, authenticated;

-- 4. PUBLIC order lookup WITHOUT sensitive fields (tracking page +
--    order-success page for guests). Never returns email/phone/address.
CREATE OR REPLACE FUNCTION public.get_order_public(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_o record;
    v_items jsonb;
BEGIN
    SELECT id, order_number, status, payment_method, payment_status,
           total_amount, discount, shipping_cost,
           created_at, estimated_delivery
      INTO v_o
    FROM public.orders
    WHERE order_number = btrim(COALESCE(p_order_number, ''))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'product_name', product_name,
        'product_price', product_price,
        'quantity', quantity,
        'image_url', image_url
        ) ORDER BY product_name), '[]'::jsonb)
      INTO v_items
    FROM public.order_items WHERE order_id = v_o.id;

    RETURN jsonb_build_object(
        'ok', true,
        'order', jsonb_build_object(
            'id', v_o.id, 'order_number', v_o.order_number,
            'status', v_o.status, 'payment_method', v_o.payment_method,
            'payment_status', v_o.payment_status,
            'total_amount', v_o.total_amount, 'discount', v_o.discount,
            'shipping_cost', v_o.shipping_cost,
            'created_at', v_o.created_at,
            'estimated_delivery', v_o.estimated_delivery),
        'items', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_public(text) TO anon, authenticated;

-- 5. Insert guard: no browser write can set payment status, order
--    status or guest flag — only the store admin may do so directly
--    (normal orders always go through create_order_secure).
CREATE OR REPLACE FUNCTION public.orders_secure_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.payment_status := 'pending';
    NEW.is_guest := (NEW.user_id IS NULL);
    IF auth.email() IS DISTINCT FROM public.grabby_admin_email() THEN
        NEW.status := 'pending';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_secure_insert ON public.orders;
CREATE TRIGGER trg_orders_secure_insert
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.orders_secure_insert();

-- 6. Additive (non-breaking) RLS policies. These only ADD access for
--    owners + the store admin; they never remove anything, so the
--    existing admin panel and customer pages keep working.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_checkout_admin_orders ON public.orders;
CREATE POLICY guest_checkout_admin_orders ON public.orders
    FOR ALL TO authenticated
    USING (auth.email() = public.grabby_admin_email())
    WITH CHECK (auth.email() = public.grabby_admin_email());

DROP POLICY IF EXISTS guest_checkout_owner_orders ON public.orders;
CREATE POLICY guest_checkout_owner_orders ON public.orders
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS guest_checkout_admin_items ON public.order_items;
CREATE POLICY guest_checkout_admin_items ON public.order_items
    FOR ALL TO authenticated
    USING (auth.email() = public.grabby_admin_email())
    WITH CHECK (auth.email() = public.grabby_admin_email());

DROP POLICY IF EXISTS guest_checkout_owner_items ON public.order_items;
CREATE POLICY guest_checkout_owner_items ON public.order_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    ));

-- ────────────────────────────────────────────────────────────────
-- OPTIONAL HARDENING (production): the policies above are additive.
-- If all.sql created wide-open permissive policies on these tables
-- (e.g. "allow everything for anon"), direct browser reads/writes
-- can still bypass the RPC. After confirming checkout, tracking,
-- my-orders and the admin panel all work through the RPCs above:
--   1. Inspect: SELECT policyname, roles, cmd FROM pg_policies
--      WHERE tablename IN ('orders', 'order_items');
--   2. Drop the legacy permissive policies, e.g.:
--      DROP POLICY IF EXISTS "<legacy policy name>" ON public.orders;
--   3. Re-test guest checkout, logged-in checkout, order tracking
--      and Admin -> Orders.
-- Do NOT block the admin email or the two RPCs (they run as
-- SECURITY DEFINER and bypass RLS by design).
-- ────────────────────────────────────────────────────────────────
