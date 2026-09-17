-- ────────────────────────────────────────────────────────────────
-- dynamic-store.sql — 100% dynamic storefront (E-Shop Demo)
--
-- Run in Supabase: SQL Editor -> open dynamic-store.sql -> Run.
-- Run AFTER all.sql (safe to re-run, every statement is idempotent).
--
-- What it does:
--  1. Seeds new `settings` keys so the whole storefront is admin-editable:
--     shipping_free_above, shipping_cost, currency_code, currency_symbol,
--     logo_url, footer_links (JSON), about_content (JSON),
--     chatbot_intro (JSON), chatbot_options (JSON)
--  2. Adds `payment_settings.logo_url` so each payment method can have a
--     custom logo (checkout prefers it, falls back to built-in icons).
--  3. Patches `create_order_secure` so shipping is read from settings
--     (shipping_free_above / shipping_cost) instead of hardcoded 2000/100.
-- ────────────────────────────────────────────────────────────────

-- ── 1. NEW SETTINGS KEYS ────────────────────────────────────────
INSERT INTO public.settings (key, value) VALUES
    ('shipping_free_above', '2000'),
    ('shipping_cost', '100'),
    ('currency_code', 'BDT'),
    ('currency_symbol', '৳'),
    ('logo_url', 'assets/logo.svg'),
    ('footer_links', '{"policies":[{"label":"Privacy Policy","url":"#"},{"label":"Refund Policy","url":"#"},{"label":"Shipping Policy","url":"#"},{"label":"Terms of Service","url":"#"}],"about":[{"label":"Our Story","url":"about.html"},{"label":"Our Sustainability Approach","url":"about.html"},{"label":"About","url":"about.html"}],"connect":[{"label":"Contact Us","url":"#"},{"label":"Contact Information","url":"#"},{"label":"Email","url":"#"},{"label":"Regulatory Information","url":"#"}]}'),
    ('about_content', '{"eyebrow":"About this demo","subtitle":"Quality demo products for everyday life.","notice":"This is a generic portfolio demo store — not a real business. Products, prices and reviews are sample data you can fully manage from the admin panel.","sections":[{"title":"What Is This?","body":"E-Shop Demo is a portfolio project showing a complete e-commerce front-end built with vanilla HTML, CSS and JavaScript, backed by Supabase for products, orders, coupons and site settings."},{"title":"Demo Notice","body":"No real orders are fulfilled and no real payments are processed. Sample data (including product images) is for demonstration only."}],"values":[{"icon":"🛍️","title":"Browse & Search","body":"Filter by category, sort, search and open product pages with galleries and reviews."},{"icon":"🧾","title":"Cart & Checkout","body":"Add items to the cart, apply a coupon and place a demo order with bKash, Nagad, Rocket or Cash on Delivery instructions."},{"icon":"📦","title":"Orders & Tracking","body":"Sign in to see your orders, follow their status and track delivery on the tracking page."},{"icon":"⚙️","title":"Admin Panel","body":"Open the admin panel to manage products, stock, orders, coupons, banners and theme — no code changes needed."}]}'),
    ('chatbot_intro', '["Hi! 👋 Welcome to E-Shop Demo 🛍️ Great to have you here!","Hi, is delivery free on all gadgets? 🙂","Free delivery across Bangladesh above our threshold, plus 7-day easy returns! 🚚 Pick an option below for details 👇"]'),
    ('chatbot_options', '[{"key":"product","label":"🛍️ Product Information","reply":"You can browse the full catalog to see the latest gadgets and deals. Use the search bar to find a specific product, open it, and check its photos, specifications and price. Need more details? Chat with us on Messenger anytime."},{"key":"order","label":"🚚 Order / Delivery Help","reply":"You can track your order on the My Orders or Order Tracking pages using your order number. We deliver across Bangladesh — free delivery above the free-delivery threshold, and 7-day easy returns."},{"key":"payment","label":"💳 Payment Help","reply":"We accept bKash, Nagad, Rocket, Upay, major cards and Cash on Delivery. Your chosen payment method is shown at checkout with full instructions to complete the payment."},{"key":"return","label":"↩️ Return / Refund","reply":"Every product comes with a 7-day easy return policy. If something is not right, reach out to us on Messenger with your order number and we will arrange a return or refund quickly."}]')
ON CONFLICT (key) DO NOTHING;

-- ── 2. PAYMENT LOGO COLUMN ──────────────────────────────────────
ALTER TABLE public.payment_settings
    ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '';

-- ── 3. DYNAMIC SHIPPING IN SECURE ORDER RPC ─────────────────────
-- Re-reads shipping rules from settings on every order so admin changes
-- apply instantly and server totals stay authoritative.
-- Only the shipping block differs from guest-checkout.sql; everything
-- else is identical.
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
    v_free_above numeric := 2000; v_ship_cost numeric := 100;
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

    SELECT count(*) INTO v_recent FROM public.orders
    WHERE created_at > now() - interval '1 hour'
      AND (lower(customer_email) = v_email OR customer_phone = v_phone);
    IF v_recent >= 5 THEN
        RAISE LOG 'guest order rate-limited (email/phone seen % times in 1h)', v_recent;
        RETURN jsonb_build_object('ok', false, 'error', 'RATE_LIMITED');
    END IF;

    SELECT * INTO v_pay FROM public.payment_settings
    WHERE method_name = v_payment
      AND COALESCE(enabled, true) = true
      AND COALESCE(status, 'available') = 'available'
    LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PAYMENT');
    END IF;
    v_fee := COALESCE(v_pay.fee, 0);

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

    -- ── Dynamic shipping from settings (admin-editable) ──
    BEGIN
        SELECT COALESCE(NULLIF(value, ''), '2000') INTO v_free_above
        FROM public.settings WHERE key = 'shipping_free_above' LIMIT 1;
        v_free_above := COALESCE(v_free_above::numeric, 2000);
    EXCEPTION WHEN OTHERS THEN
        v_free_above := 2000;
    END;
    BEGIN
        SELECT COALESCE(NULLIF(value, ''), '100') INTO v_ship_cost
        FROM public.settings WHERE key = 'shipping_cost' LIMIT 1;
        v_ship_cost := COALESCE(v_ship_cost::numeric, 100);
    EXCEPTION WHEN OTHERS THEN
        v_ship_cost := 100;
    END;
    v_shipping := CASE WHEN v_subtotal >= v_free_above THEN 0 ELSE v_ship_cost END;
    v_total := GREATEST(round(v_subtotal + v_shipping + v_fee - v_discount, 2), 0);

    LOOP
        v_attempts := v_attempts + 1;
        v_order_number := 'ORD-' || (floor(extract(epoch from now()) * 1000))::bigint
            || '-' || upper(substr(md5(random()::text), 1, 4));
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.orders WHERE order_number = v_order_number
        );
        IF v_attempts > 5 THEN
            RETURN jsonb_build_object('ok', false, 'error', 'RETRY');
        END IF;
    END LOOP;

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
        v_address1, v_address2, v_city, v_state, v_area, v_country,
        v_total, v_discount, v_shipping, v_coupon,
        v_payment, 'pending', 'pending',
        (CURRENT_DATE + interval '7 days')::text, v_idem, now()
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.order_items (order_id, product_id, product_name, product_price, quantity, image_url)
    SELECT v_order_id,
           (x ->> 'product_id')::bigint,
           x ->> 'name',
           (x ->> 'price')::numeric,
           (x ->> 'quantity')::integer,
           x ->> 'image'
    FROM jsonb_array_elements(v_lines) AS x;

    UPDATE public.products p
    SET stock_quantity = GREATEST(COALESCE(p.stock_quantity, 0) - (x ->> 'quantity')::integer, 0),
        in_stock = (GREATEST(COALESCE(p.stock_quantity, 0) - (x ->> 'quantity')::integer, 0) > 0)
    FROM jsonb_array_elements(v_lines) AS x
    WHERE p.id = (x ->> 'product_id')::bigint
      AND p.stock_quantity IS NOT NULL;

    IF v_coupon IS NOT NULL THEN
        UPDATE public.coupons
        SET used_count = COALESCE(used_count, 0) + 1
        WHERE code = v_coupon;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'order_id', v_order_id,
        'order_number', v_order_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_secure(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) TO anon, authenticated;
