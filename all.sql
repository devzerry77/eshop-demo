-- ────────────────────────────────────────────────────────────────
-- all.sql — E-Shop Demo COMPLETE SETUP (single-file demo run)
--
-- Run this ONE file in Supabase: SQL Editor -> open all.sql -> Run.
-- Safe to re-run (every statement is idempotent).
--
-- Contains, in dependency order:
--   1. BASE SCHEMA (settings, products, orders, order_items,
--      payment_settings, coupons, addresses + decrement_stock,
--      increment_coupon_used, products_sync_in_stock trigger + seeds)
--   2. stock-quantity.sql (stock_quantity column + decrement_stock + trigger)
--   3. eshop-demo-setup.sql (admin_users, categories + seeds, store-profile
--      settings, grabby_admin_email()/eshop_admin_email() helpers)
--   4. reviews.sql (reviews table + submit_customer_review RPC +
--      purchase-check trigger + RLS)
--   5. guest-checkout.sql (customer_order_mode + is_guest/idempotency_key +
--      create_order_secure + get_order_public + orders_secure_insert + RLS)
--   6. products.sql (demo catalog, 18 products, BDT prices)
--   7. demo_reviews.sql (sample [DEMO] reviews for review UI testing only)
--
-- After running: add your admin email:
--   INSERT INTO public.admin_users (email) VALUES ('you@example.com')
--   ON CONFLICT (email) DO NOTHING;
-- Never put the service_role key in client code or this repo.
-- ────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════
-- BUNDLED FILE: all.sql
-- ════════════════════════════════════════════════════════════════
-- ────────────────────────────────────────────────────────────────
-- all.sql — E-Shop Demo BASE SCHEMA (section 1 of this bundle)
--
-- This section creates the base tables. The remaining sections of this
-- file (stock-quantity, eshop-demo-setup, reviews, guest-checkout,
-- products, demo_reviews) build on top of it in dependency order.
-- Safe to re-run (every statement is idempotent).
--
-- Reconstructed from the actual queries in js/ + admin/js/ so a fresh
-- project matches what the code reads and writes. Creates:
--   Tables: settings, products, orders, order_items, payment_settings,
--           coupons, addresses
--   RPCs:   decrement_stock(product_id, quantity),
--           increment_coupon_used(code)
--   Trigger: products_sync_in_stock (keeps in_stock honest)
--   Seeds:  core settings, demo payment methods, demo coupons
--
-- Access model (deliberate, mirrors the app architecture):
--   * The storefront + admin panel both use the public anon key, so the
--     base policies below are permissive ("demo_open_*"). For production,
--     tighten them and move privileged writes to Edge Functions.
--   * Checkout integrity does NOT rely on these policies: the
--     create_order_secure RPC (guest-checkout.sql) recomputes prices,
--     stock, coupons and totals server-side, and the orders_secure_insert
--     trigger forces payment_status/status/is_guest on every insert.
--   * Never put the service_role key in client code or this repo.
-- ────────────────────────────────────────────────────────────────

-- Extensions used by follow-up files (reviews.sql needs gen_random_uuid).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ══ 1. SETTINGS (key/value store for theme, homepage, store profile) ══
CREATE TABLE IF NOT EXISTS public.settings (
    key text PRIMARY KEY,
    value text NOT NULL DEFAULT ''
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_open_settings" ON public.settings;
CREATE POLICY "demo_open_settings" ON public.settings
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- Core rows the app reads on every page (admin can change all of these
-- in Admin → Settings; eshop-demo-setup.sql tops up the rest).
INSERT INTO public.settings (key, value) VALUES
    ('customer_order_mode', 'login'),
    ('site_name', 'E-Shop Demo'),
    ('site_tagline', 'Quality demo products for everyday life.'),
    ('footer_note', '© 2026 E-Shop Demo · Demo portfolio project — no real orders are fulfilled.'),
    ('marquee_text', '🚚 Demo delivery on all orders &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🎁 Demo gift wrapping &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; ↩️ 7-day easy return &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🔒 Secure checkout'),
    ('marquee_enabled', 'true'),
    ('theme_preset', 'silver')
ON CONFLICT (key) DO NOTHING;

-- ══ 2. PRODUCTS ══
CREATE TABLE IF NOT EXISTS public.products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT '',
    price numeric NOT NULL DEFAULT 0,
    original_price numeric,
    rating numeric NOT NULL DEFAULT 0,
    reviews integer NOT NULL DEFAULT 0,
    description text NOT NULL DEFAULT '',
    image text NOT NULL DEFAULT '',
    images jsonb NOT NULL DEFAULT '[]'::jsonb,
    badge text NOT NULL DEFAULT '',
    in_stock boolean NOT NULL DEFAULT true,
    stock_quantity integer NOT NULL DEFAULT 50,
    specs jsonb NOT NULL DEFAULT '{}'::jsonb,
    details jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Guard: stock can never go negative.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_quantity_check'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_stock_quantity_check CHECK (stock_quantity >= 0);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);
CREATE INDEX IF NOT EXISTS products_stock_quantity_idx ON public.products (stock_quantity);

-- Keep in_stock honest on every write (admin edits included).
CREATE OR REPLACE FUNCTION public.products_sync_in_stock()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF COALESCE(NEW.stock_quantity, 0) <= 0 THEN
        NEW.in_stock := false;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_in_stock ON public.products;
CREATE TRIGGER trg_products_sync_in_stock
    BEFORE INSERT OR UPDATE OF stock_quantity ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.products_sync_in_stock();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_open_products" ON public.products;
CREATE POLICY "demo_open_products" ON public.products
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- ══ 3. ORDERS + ORDER_ITEMS ══
CREATE TABLE IF NOT EXISTS public.orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_number text NOT NULL UNIQUE,
    user_id uuid,
    is_guest boolean NOT NULL DEFAULT false,
    customer_name text NOT NULL DEFAULT '',
    customer_email text NOT NULL DEFAULT '',
    customer_phone text NOT NULL DEFAULT '',
    address_line1 text NOT NULL DEFAULT '',
    address_line2 text NOT NULL DEFAULT '',
    city text NOT NULL DEFAULT '',
    state text NOT NULL DEFAULT '',
    area text NOT NULL DEFAULT '',
    country text NOT NULL DEFAULT '',
    total_amount numeric NOT NULL DEFAULT 0,
    discount numeric NOT NULL DEFAULT 0,
    shipping_cost numeric NOT NULL DEFAULT 0,
    coupon_code text,
    payment_method text NOT NULL DEFAULT '',
    payment_status text NOT NULL DEFAULT 'pending',
    status text NOT NULL DEFAULT 'pending',
    estimated_delivery text NOT NULL DEFAULT '',
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency keys are unique when present (double-click/refresh safety).
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uidx
    ON public.orders (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);

CREATE TABLE IF NOT EXISTS public.order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
    product_id bigint,
    product_name text NOT NULL DEFAULT '',
    product_price numeric NOT NULL DEFAULT 0,
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    image_url text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Demo-open base policies (see header note). Owner-scoped policies below
-- keep My Orders / tracking / cancel working even if the open policies
-- are later tightened for production.
DROP POLICY IF EXISTS "demo_open_orders" ON public.orders;
CREATE POLICY "demo_open_orders" ON public.orders
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "demo_open_order_items" ON public.order_items;
CREATE POLICY "demo_open_order_items" ON public.order_items
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_orders_select" ON public.orders;
CREATE POLICY "owner_orders_select" ON public.orders
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_orders_cancel" ON public.orders;
CREATE POLICY "owner_orders_cancel" ON public.orders
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_items_select" ON public.order_items;
CREATE POLICY "owner_items_select" ON public.order_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    ));

-- ══ 4. PAYMENT_SETTINGS ══
CREATE TABLE IF NOT EXISTS public.payment_settings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    method_name text NOT NULL UNIQUE,
    enabled boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'available',
    fee numeric NOT NULL DEFAULT 0,
    account_info jsonb NOT NULL DEFAULT '{}'::jsonb,
    instructions text NOT NULL DEFAULT '',
    qr_code_url text NOT NULL DEFAULT '',
    display_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_open_payment_settings" ON public.payment_settings;
CREATE POLICY "demo_open_payment_settings" ON public.payment_settings
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- Demo payment methods (Admin → Payment Settings can edit all of this).
INSERT INTO public.payment_settings
    (method_name, enabled, status, fee, account_info, instructions, display_order)
VALUES
    ('bKash', true, 'available', 0,
     '{"type": "mobile", "number": "01XXXXXXXXX"}',
     'Send money to the bKash number above, then enter your TrxID on the tracking page.', 1),
    ('Nagad', true, 'available', 0,
     '{"type": "mobile", "number": "01XXXXXXXXX"}',
     'Send money to the Nagad number above, then enter your TrxID on the tracking page.', 2),
    ('Rocket', true, 'available', 0,
     '{"type": "mobile", "number": "01XXXXXXXXX"}',
     'Send money to the Rocket number above, then enter your TrxID on the tracking page.', 3),
    ('Cash on Delivery', true, 'available', 0,
     '{"type": "cod"}',
     'Pay in cash when your order arrives.', 4)
ON CONFLICT (method_name) DO NOTHING;

-- ══ 5. COUPONS ══
CREATE TABLE IF NOT EXISTS public.coupons (
    code text PRIMARY KEY,
    active boolean NOT NULL DEFAULT true,
    valid_from timestamptz,
    valid_to timestamptz,
    usage_limit integer,
    used_count integer NOT NULL DEFAULT 0,
    min_order_amount numeric,
    discount_type text NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_open_coupons" ON public.coupons;
CREATE POLICY "demo_open_coupons" ON public.coupons
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- Demo coupons (codes are upper-cased before validation in checkout.js).
INSERT INTO public.coupons
    (code, active, valid_from, valid_to, usage_limit, used_count,
     min_order_amount, discount_type, discount_value)
VALUES
    ('DEMO10', true, now() - interval '1 day', now() + interval '365 days',
     NULL, 0, 0, 'percentage', 10),
    ('FLAT50', true, now() - interval '1 day', now() + interval '365 days',
     NULL, 0, 500, 'fixed', 50)
ON CONFLICT (code) DO NOTHING;

-- ══ 6. ADDRESSES (customer address book) ══
CREATE TABLE IF NOT EXISTS public.addresses (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL,
    name text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    address_line1 text NOT NULL DEFAULT '',
    address_line2 text NOT NULL DEFAULT '',
    state text NOT NULL DEFAULT '',
    city text NOT NULL DEFAULT '',
    area text NOT NULL DEFAULT '',
    country text NOT NULL DEFAULT '',
    is_default boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON public.addresses (user_id);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_open_addresses" ON public.addresses;
CREATE POLICY "demo_open_addresses" ON public.addresses
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_addresses_all" ON public.addresses;
CREATE POLICY "owner_addresses_all" ON public.addresses
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ══ 7. RPCs ══
-- Atomic stock decrement (legacy checkout path; the secure RPC in
-- guest-checkout.sql does its own conditional decrement).
CREATE OR REPLACE FUNCTION public.decrement_stock(product_id bigint, quantity integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_qty integer := GREATEST(COALESCE(quantity, 0), 0);
    v_new integer;
BEGIN
    IF product_id IS NULL OR v_qty <= 0 THEN
        SELECT COALESCE(stock_quantity, 0) INTO v_new
        FROM public.products WHERE id = product_id;
        RETURN COALESCE(v_new, 0);
    END IF;

    UPDATE public.products
    SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_qty, 0),
        in_stock = (GREATEST(COALESCE(stock_quantity, 0) - v_qty, 0) > 0)
    WHERE id = product_id
    RETURNING stock_quantity INTO v_new;

    RETURN COALESCE(v_new, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_stock(bigint, integer) TO anon, authenticated;

-- Coupon usage counter (called with { code } after an order is placed).
CREATE OR REPLACE FUNCTION public.increment_coupon_used(code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.coupons
    SET used_count = COALESCE(used_count, 0) + 1
    WHERE coupons.code = increment_coupon_used.code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_used(text) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- BUNDLED FILE: stock-quantity.sql
-- ════════════════════════════════════════════════════════════════
-- ────────────────────────────────────────────────────────────────
-- stock-quantity.sql — Product stock quantities (E-Shop Demo)
--
-- Run this in Supabase: SQL Editor -> open stock-quantity.sql -> Run.
-- Safe to re-run (all statements are idempotent).
--
-- What it does:
--  1. Adds `products.stock_quantity` (integer, >= 0, default 50).
--     Existing rows get 50, except rows currently marked out of
--     stock (`in_stock = false`), which get 0 to preserve intent.
--  2. Creates the `decrement_stock(product_id, quantity)` RPC used by
--     checkout.js after an order is placed. It clamps at 0 (never
--     negative) and flips `in_stock` to false when stock hits 0.
--  3. Adds a trigger that keeps `in_stock` in sync: any write that
--     takes `stock_quantity` to 0 forces `in_stock = false`.
--
-- Root cause it fixes:
--  checkout.js reads `row.stock_quantity || 0`, but the column did not
--  exist, so EVERY product (including newly added ones) normalised to
--  available = 0 ("Available Products: 0"). After this migration the
--  real stored quantity flows to Buy Now / Cart / Checkout.
-- ────────────────────────────────────────────────────────────────

-- 1. Column (new products automatically get 50 unless admin sets a value)
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 50;

-- Keep the NOT NULL default for future inserts
ALTER TABLE public.products
    ALTER COLUMN stock_quantity SET DEFAULT 50;

-- Clamp + backfill: preserve intentional out-of-stock rows
UPDATE public.products SET stock_quantity = 0 WHERE in_stock IS FALSE AND stock_quantity <> 0;

-- Guard: stock can never go negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_quantity_check'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_stock_quantity_check CHECK (stock_quantity >= 0);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS products_stock_quantity_idx
    ON public.products (stock_quantity);

-- 2. Atomic decrement used by checkout after successful order insert
CREATE OR REPLACE FUNCTION public.decrement_stock(product_id bigint, quantity integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_qty integer := GREATEST(COALESCE(quantity, 0), 0);
    v_new integer;
BEGIN
    IF product_id IS NULL OR v_qty <= 0 THEN
        SELECT COALESCE(stock_quantity, 0) INTO v_new
        FROM public.products WHERE id = product_id;
        RETURN COALESCE(v_new, 0);
    END IF;

    UPDATE public.products
    SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_qty, 0),
        in_stock = (GREATEST(COALESCE(stock_quantity, 0) - v_qty, 0) > 0)
    WHERE id = product_id
    RETURNING stock_quantity INTO v_new;

    RETURN COALESCE(v_new, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_stock(bigint, integer) TO anon, authenticated;

-- 3. Keep in_stock honest on every write (admin edits included)
CREATE OR REPLACE FUNCTION public.products_sync_in_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF COALESCE(NEW.stock_quantity, 0) <= 0 THEN
        NEW.in_stock := false;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_in_stock ON public.products;
CREATE TRIGGER trg_products_sync_in_stock
    BEFORE INSERT OR UPDATE OF stock_quantity ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.products_sync_in_stock();

-- ════════════════════════════════════════════════════════════════
-- BUNDLED FILE: eshop-demo-setup.sql
-- ════════════════════════════════════════════════════════════════
-- ────────────────────────────────────────────────────────────────
-- eshop-demo-setup.sql — E-Shop Demo portfolio setup
--
-- Generic, database-driven storefront: categories, store profile,
-- admin allow-list and a neutral admin-email default.
--
-- Run in Supabase: SQL Editor -> open eshop-demo-setup.sql -> Run.
-- Run AFTER all.sql (+ reviews.sql / guest-checkout.sql if you use them).
-- Safe to re-run (every statement is idempotent).
--
-- What it does:
--  0. Creates `admin_users` (email) allow-list with RLS first (category
--     policies depend on it): authenticated read; first admin claims access
--     while empty, afterwards only listed admins can add/remove.
--  1. Creates `categories` (slug, label, sort_order, active) with RLS:
--     public read, admin write. Seeds demo categories.
--  2. Seeds generic store-profile rows in the EXISTING `settings` table:
--     site_name, site_tagline, footer_note (+ login-safe order mode).
--  3. Points the legacy `grabby_admin_email()` default at the neutral
--     demo address and adds `eshop_admin_email()` as the new canonical
--     helper (old SQL files keep working).
--  4. Add your own admin email at the bottom and re-run.
--
-- Security notes:
--  * Never put the `service_role` key in client code or this repo.
--  * The anon key in js/supabase/supabase-config.js is public by design.
--  * Order totals, prices, stock and coupons are recomputed server-side
--    by create_order_secure (guest-checkout.sql) — never trust the browser.
-- ────────────────────────────────────────────────────────────────

-- ── 0. ADMIN ALLOW-LIST (created first: category policies depend on it)
CREATE TABLE IF NOT EXISTS public.admin_users (
    email text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users authenticated read" ON public.admin_users;
CREATE POLICY "admin_users authenticated read"
    ON public.admin_users FOR SELECT
    TO authenticated
    USING (true);

-- First admin can claim access while the table is empty; afterwards only
-- listed admins can add more. Never exposed to anonymous users.
DROP POLICY IF EXISTS "admin_users admin insert" ON public.admin_users;
CREATE POLICY "admin_users admin insert"
    ON public.admin_users FOR INSERT
    TO authenticated
    WITH CHECK (
        NOT EXISTS (SELECT 1 FROM public.admin_users)
        OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = auth.email())
    );

DROP POLICY IF EXISTS "admin_users admin delete" ON public.admin_users;
CREATE POLICY "admin_users admin delete"
    ON public.admin_users FOR DELETE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = auth.email())
    );

-- ── 1. CATEGORIES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
    slug text PRIMARY KEY,
    label text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories public read" ON public.categories;
CREATE POLICY "categories public read"
    ON public.categories FOR SELECT
    TO anon, authenticated
    USING (active = true);

DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write"
    ON public.categories FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = auth.email())
        OR NOT EXISTS (SELECT 1 FROM public.admin_users)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.admin_users a WHERE a.email = auth.email())
        OR NOT EXISTS (SELECT 1 FROM public.admin_users)
    );

-- Slug format guard: lowercase letters, numbers and dashes only.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_format') THEN
        ALTER TABLE public.categories
            ADD CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
    END IF;
END
$$;

INSERT INTO public.categories (slug, label, sort_order, active) VALUES
    ('audio', 'Audio', 10, true),
    ('electronics', 'Electronics', 20, true),
    ('gaming', 'Gaming', 30, true),
    ('wearables', 'Wearables', 40, true),
    ('accessories', 'Accessories', 50, true),
    ('camera', 'Camera', 60, true),
    ('lifestyle', 'Lifestyle', 70, true)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. STORE PROFILE + SAFE DEFAULTS (existing settings table) ──
INSERT INTO public.settings (key, value) VALUES
    ('site_name', 'E-Shop Demo'),
    ('site_tagline', 'Quality demo products for everyday life.'),
    ('footer_note', '© 2026 E-Shop Demo · Demo portfolio project — no real orders are fulfilled.'),
    ('customer_order_mode', 'login'),
    ('marquee_text', '🚚 Demo delivery on all orders &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🎁 Demo gift wrapping &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; ↩️ 7-day easy return &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🔒 Secure checkout')
ON CONFLICT (key) DO NOTHING;

-- ── 3. NEUTRAL ADMIN EMAIL (legacy helper compat) ─────────
-- The `admin_users` table (section 0) is the primary gate; these helpers
-- keep reviews.sql / guest-checkout.sql working with a neutral default.
CREATE OR REPLACE FUNCTION public.grabby_admin_email()
RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'admin@eshop.demo' $$;

CREATE OR REPLACE FUNCTION public.eshop_admin_email()
RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'admin@eshop.demo' $$;

-- ── 4. DEMO ADMIN + YOUR ADMIN LOGIN ──────────────────────
-- Demo login shown on the admin panel (create this user first in
-- Supabase Dashboard → Authentication → Users → Add user, auto-confirm
-- email, password: Demo123!):
INSERT INTO public.admin_users (email) VALUES ('admin@eshop.demo')
ON CONFLICT (email) DO NOTHING;
-- Replace with your real Supabase Auth user email, then re-run:
-- INSERT INTO public.admin_users (email) VALUES ('you@example.com')
-- ON CONFLICT (email) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- BUNDLED FILE: reviews.sql
-- ════════════════════════════════════════════════════════════════
-- ────────────────────────────────────────────────────────────────
-- reviews.sql  —  Product Reviews (Daraz / AliExpress style)
--
-- Run AFTER all.sql has created `products`, `orders`, `order_items`.
-- In Supabase: SQL Editor -> open reviews.sql -> Run.
--
-- Notes:
--  * To grant review-management to another admin user, change
--    ADMIN_EMAIL below to that user's email and re-run the policy
--    statements (the function is used by the RLS policy).
--  * Customer reviews are only created through the
--    `submit_customer_review` RPC, which (a) verifies the caller owns a
--    "delivered" order containing the product and (b) blocks duplicate
--    reviews for the same product. Any other write path is rejected by
--    the REVIEW_PREVENT_BYPASS trigger.
--  * Admin custom reviews are inserted with a NULL user_id and
--    source = 'admin'. They are NOT subject to the purchase check.
-- ────────────────────────────────────────────────────────────────

-- Configure the admin email allowed to manage reviews via the client
-- side admin panel (mirrors the existing wide-open anon architecture).
CREATE OR REPLACE FUNCTION public.grabby_admin_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT 'admin@eshop.demo'
$$;

-- ────────────────────────────────────────────────────────────────
-- REVIEWS TABLE
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewer_name   text NOT NULL DEFAULT 'Verified Buyer',
    rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text     text NOT NULL DEFAULT '',
    images          jsonb DEFAULT '[]'::jsonb,
    video_url       text,
    source          text NOT NULL DEFAULT 'customer' CHECK (source IN ('customer', 'admin')),
    is_published    boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reviews_customer_user CHECK (
        (source = 'admin' AND user_id IS NULL) OR
        (source = 'customer' AND user_id IS NOT NULL)
    )
);

-- Customers may only review a product once.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_customer
    ON public.reviews (product_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reviews_product_published_idx
    ON public.reviews (product_id, is_published DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS reviews_user_idx
    ON public.reviews (user_id);

-- ────────────────────────────────────────────────────────────────
-- PURCHASE CHECK (shared by RPC + trigger)
-- A customer can review a product only when a delivered order for
-- that product is attached to their account.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customer_can_review(p_user uuid, p_product bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.id
        WHERE o.user_id = p_user
          AND o.status = 'delivered'
          AND oi.product_id = p_product
    )
$$;

-- ────────────────────────────────────────────────────────────────
-- CUSTOMER REVIEW SUBMISSION (SECURITY DEFINER)
-- The ONLY supported way for a customer to create a review.
-- Verifies the caller owns a delivered order for the product.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_customer_review(
    p_product_id bigint,
    p_reviewer_name text,
    p_rating integer,
    p_review_text text,
    p_images jsonb DEFAULT '[]'::jsonb,
    p_video_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_existing_id uuid;
    v_new_id uuid;
    v_name text;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    IF p_product_id IS NULL OR p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
    END IF;

    IF NOT public.customer_can_review(v_uid, p_product_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'PRODUCT_NOT_PURCHASED');
    END IF;

    SELECT id INTO v_existing_id
    FROM public.reviews
    WHERE product_id = p_product_id AND user_id = v_uid
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_REVIEWED');
    END IF;

    v_name := NULLIF(btrim(COALESCE(p_reviewer_name, '')), '');
    IF v_name IS NULL THEN
        v_name := 'Verified Buyer';
    END IF;

    INSERT INTO public.reviews (
        product_id, user_id, reviewer_name, rating,
        review_text, images, video_url, source, is_published
    ) VALUES (
        p_product_id, v_uid, v_name, p_rating,
        btrim(COALESCE(p_review_text, '')),
        COALESCE(p_images, '[]'::jsonb),
        NULLIF(btrim(COALESCE(p_video_url, '')), ''),
        'customer', true
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'ok', true,
        'id', v_new_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_customer_review(bigint, text, integer, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_can_review(uuid, bigint) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- BYPASS PROTECTION TRIGGER
-- Re-checks the purchase rule on EVERY row change so a user cannot
-- bypass the UI (direct insert / UPDATE user_id / forged source).
-- Admin rows (user_id IS NULL) come from the admin panel only and
-- are not subject to the purchase check.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_prevent_bypass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF NEW.source = 'customer' THEN
        IF NEW.user_id IS NULL THEN
            RAISE EXCEPTION 'Customer reviews must belong to a user (use submit_customer_review).';
        END IF;
        -- Store admins may moderate customer reviews (edit / hide / publish).
        IF auth.email() = public.grabby_admin_email() THEN
            NULL;
        ELSE
            -- Only the signed-in user may create/update their own review.
            IF v_uid IS NULL OR v_uid <> NEW.user_id THEN
                RAISE EXCEPTION 'You can only create or edit your own review.';
            END IF;
            IF NOT public.customer_can_review(NEW.user_id, NEW.product_id) THEN
                RAISE EXCEPTION 'You can only review products you purchased and received.';
            END IF;
        END IF;
    ELSIF NEW.source = 'admin' THEN
        -- Admin reviews come from the admin panel (NULL user_id).
        IF NEW.user_id IS NOT NULL THEN
            RAISE EXCEPTION 'Admin reviews must have a NULL user_id.';
        END IF;
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_prevent_bypass ON public.reviews;
CREATE TRIGGER trg_review_prevent_bypass
    BEFORE INSERT OR UPDATE
    ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.review_prevent_bypass();

-- ────────────────────────────────────────────────────────────────
-- TABLE ACCESS + ROW LEVEL SECURITY
--   1. Everyone can read published reviews (RLS filters rows).
--   2. The admin email can insert/update/delete reviews (the client
--      side admin panel inserts admin rows with user_id IS NULL).
-- Customer writes go through the SECURITY DEFINER RPC; direct writes
-- by non-admin users are blocked by RLS and the trigger.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;

DROP POLICY IF EXISTS reviews_read_published ON public.reviews;
CREATE POLICY reviews_read_published ON public.reviews
    FOR SELECT
    USING (is_published = true);

DROP POLICY IF EXISTS reviews_admin_all ON public.reviews;
CREATE POLICY reviews_admin_all ON public.reviews
    FOR ALL
    TO authenticated
    USING (auth.email() = public.grabby_admin_email())
    WITH CHECK (
        auth.email() = public.grabby_admin_email() AND
        (user_id IS NULL OR source = 'customer')
    );

-- ════════════════════════════════════════════════════════════════
-- BUNDLED FILE: guest-checkout.sql
-- ════════════════════════════════════════════════════════════════
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
            RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'admin@eshop.demo' $$;
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

-- ════════════════════════════════════════════════════════════════
-- BUNDLED FILE: products.sql
-- ════════════════════════════════════════════════════════════════
-- ────────────────────────────────────────────────────────────────
-- products.sql  —  Real Daraz-style product seed data (BDT)
--
-- Run this AFTER all.sql has created the `products` table.
-- In Supabase: SQL Editor -> open products.sql -> Run.
--
-- Data sources: real Daraz Bangladesh / Bangladeshi retailer
-- listings (avg. market prices, Sept 2026). Prices are in BDT.
-- Images are seeded placeholders, matching the existing site
-- defaults; swap `url` values with real Daraz image links if needed.
-- ────────────────────────────────────────────────────────────────

-- Optional: clear existing seed products first
-- DELETE FROM products;

-- ── ELECTRONICS (Smartphones) ────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Samsung Galaxy A36 5G (128GB)',
  'electronics',
  29999, 32999, 4.7, 214,
  '6.6-inch 120Hz Super AMOLED+ display, Snapdragon 6 Gen 3, 50MP OIS camera and 5000mAh battery with official 1-year warranty.',
  'https://picsum.photos/seed/galaxy-a36/400/400',
  '[{"url":"https://picsum.photos/seed/galaxy-a36/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/galaxy-a36-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Display":"6.6\" 120Hz Super AMOLED+","Processor":"Snapdragon 6 Gen 3","Camera":"50MP OIS","Battery":"5000mAh","RAM":"6GB","Storage":"128GB","Warranty":"1 Year"}',
  '{"brand":"Samsung","sold":"1.1K+ sold","shortDesc":"Best-selling 5G phone with 120Hz AMOLED display.","fullDesc":"The Galaxy A36 5G delivers a flagship-like experience at a mid-range price with a 6.6-inch 120Hz Super AMOLED+ panel, Snapdragon 6 Gen 3 processor, 50MP OIS main camera and a 5000mAh battery. Official Samsung BD warranty included.","sections":[{"title":"Highlights","body":"120Hz Super AMOLED+ display | 50MP OIS camera | 4 years OS updates"},{"title":"In the box","body":"Phone, Type-C cable, adapter, SIM ejector tool"}],"related":[]}'
),
(
  'realme 15 5G',
  'electronics',
  27990, 30490, 4.5, 96,
  '12GB RAM, 256GB storage, 108MP camera, 120Hz AMOLED display and 67W fast charging.',
  'https://picsum.photos/seed/realme-15/400/400',
  '[{"url":"https://picsum.photos/seed/realme-15/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/realme-15-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Display":"6.7\" 120Hz AMOLED","Camera":"108MP","Battery":"5500mAh","Charging":"67W","RAM":"12GB","Storage":"256GB","Warranty":"1 Year"}',
  '{"brand":"realme","sold":"480+ sold","shortDesc":"Maximum specs under 30K.","fullDesc":"realme 15 5G packs 12GB RAM, 256GB storage, a 108MP main camera and 67W fast charging with a 120Hz AMOLED display. The best specs-to-price ratio in the 25K-30K segment.","sections":[{"title":"Highlights","body":"12GB RAM + 256GB storage | 108MP camera | 67W charging"},{"title":"In the box","body":"Phone, 67W adapter, USB cable, case"}],"related":[]}'
),
(
  'Redmi Note 15 5G',
  'electronics',
  24990, 27490, 4.6, 143,
  '108MP camera, 120Hz AMOLED display, Dimensity 6080 processor and 67W fast charging with Xiaomi official warranty.',
  'https://picsum.photos/seed/redmi-note-15/400/400',
  '[{"url":"https://picsum.photos/seed/redmi-note-15/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/redmi-note-15-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Display":"6.67\" 120Hz AMOLED","Camera":"108MP","Battery":"5000mAh","Charging":"67W","Processor":"Dimensity 6080","RAM":"8GB","Storage":"256GB","Warranty":"1 Year"}',
  '{"brand":"Xiaomi","sold":"890+ sold","shortDesc":"108MP camera phone under 25K.","fullDesc":"The Redmi Note 15 5G brings a 108MP camera and 120Hz AMOLED display into the under-25K segment, powered by the Dimensity 6080 with 67W fast charging.","sections":[{"title":"Highlights","body":"108MP camera | 120Hz AMOLED | 67W fast charging"},{"title":"In the box","body":"Phone, 67W adapter, USB cable, protective case"}],"related":[]}'
),
(
  'Samsung Galaxy A26 5G',
  'electronics',
  27999, 29999, 4.6, 88,
  '6.5-inch 120Hz Super AMOLED, 50MP OIS camera, Exynos 1380 and 5000mAh battery with 4-year software support.',
  'https://picsum.photos/seed/galaxy-a26/400/400',
  '[{"url":"https://picsum.photos/seed/galaxy-a26/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/galaxy-a26-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Display":"6.5\" 120Hz Super AMOLED","Camera":"50MP OIS","Battery":"5000mAh","Processor":"Exynos 1380","RAM":"6GB","Storage":"128GB","Warranty":"1 Year"}',
  '{"brand":"Samsung","sold":"330+ sold","shortDesc":"Long-term software support at a fair price.","fullDesc":"Galaxy A26 5G offers a 120Hz Super AMOLED display, 50MP OIS camera and 4-year OS / 5-year security updates. A dependable all-rounder from Samsung.","sections":[{"title":"Highlights","body":"120Hz Super AMOLED | 4-year OS updates | 50MP OIS"},{"title":"In the box","body":"Phone, Type-C cable, adapter"}],"related":[]}'
);

-- ── ACCESSORIES ─────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Baseus 15W Cobble Qi Wireless Charger',
  'accessories',
  1150, 1850, 4.4, 156,
  '15W max output, non-slip silicone ring, foreign-object detection and LED indicator. Charges through most phone cases.',
  'https://picsum.photos/seed/baseus-charger/400/400',
  '[{"url":"https://picsum.photos/seed/baseus-charger/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/baseus-charger-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Output":"15W Max","Input":"Type-C 5V/2A, 9V/2A","Standard":"Qi","Compatibility":"iPhone, Samsung, Xiaomi","Accessory":"Type-C cable","Brand":"Baseus"}',
  '{"brand":"Baseus","sold":"2K+ sold","shortDesc":"Popular 15W wireless charging pad.","fullDesc":"The Baseus Cobble wireless charger delivers 15W fast charging with foreign-object detection and works through protective cases up to 4mm thick.","sections":[{"title":"Highlights","body":"15W Qi fast charge | LED indicator | Non-slip design"},{"title":"Compatible","body":"Qi-enabled iPhones and Android devices"}],"related":[]}'
),
(
  'Anker Nano 33W GaN Fast Charger (Type-C)',
  'accessories',
  1200, 1600, 4.5, 233,
  '33W GaN technology, single USB-C port, fast charging for iPhone and Android with full safety protection.',
  'https://picsum.photos/seed/anker-nano/400/400',
  '[{"url":"https://picsum.photos/seed/anker-nano/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/anker-nano-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Output":"33W Max","Ports":"USB-C (1)","Technology":"GaN II","Plug":"US / EU","Brand":"Anker","Warranty":"18 Months"}',
  '{"brand":"Anker","sold":"3.4K+ sold","shortDesc":"Mini 33W GaN charger for fast top-ups.","fullDesc":"Anker Nano 33W uses GaN II technology to pack powerful 33W fast charging into a compact size, ideal for travel and daily use.","sections":[{"title":"Highlights","body":"33W GaN II | Compact size | MultiProtect safety"},{"title":"In the box","body":"Charger only (cable not included)"}],"related":[]}'
),
(
  'Baseus 10000mAh Mini Power Bank',
  'accessories',
  1499, 1999, 4.5, 312,
  '20W PD fast charging, 10000mAh capacity, digital display and dual output in a slim lightweight design.',
  'https://picsum.photos/seed/baseus-powerbank/400/400',
  '[{"url":"https://picsum.photos/seed/baseus-powerbank/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/baseus-powerbank-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Capacity":"10000mAh","Output":"20W PD / 18W QC","Ports":"USB-C + USB-A","Display":"Digital LED %","Brand":"Baseus"}',
  '{"brand":"Baseus","sold":"1.8K+ sold","shortDesc":"Slim power bank with digital display.","fullDesc":"Baseus Mini power bank charges your phone twice with 20W PD fast output, showing remaining battery level on a clear digital display.","sections":[{"title":"Highlights","body":"20W PD output | Digital display | Dual ports"},{"title":"In the box","body":"Power bank, short USB-C cable"}],"related":[]}'
),
(
  '9H Tempered Glass Screen Protector (UV Full Cover)',
  'accessories',
  199, 299, 4.2, 678,
  '9H hardness tempered glass with oleophobic coating, full screen coverage and easy bubble-free installation kit.',
  'https://picsum.photos/seed/tempered-glass/400/400',
  '[{"url":"https://picsum.photos/seed/tempered-glass/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/tempered-glass-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Hardness":"9H","Coverage":"Full (3D curved)","Coating":"Oleophobic","Thickness":"0.33mm","Kit":"Wipes + dust absorber"}',
  '{"brand":"Generic","sold":"9K+ sold","shortDesc":"Bestselling UV tempered glass on Daraz.","fullDesc":"Shock-resistant 9H tempered glass with an oleophobic coating that resists fingerprints, plus a complete DIY installation kit.","sections":[{"title":"Highlights","body":"9H hardened | Anti-fingerprint | Kit included"},{"title":"Compatibility","body":"Select your phone model from options"}],"related":[]}'
);

-- ── AUDIO ───────────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Awei PC-2 3.5mm Wired Earphone',
  'audio',
  390, 450, 4.1, 512,
  'Lightweight in-ear earphone with 3.5mm jack, inline mic and 3-button remote. Deep bass sound at an unbeatable price.',
  'https://picsum.photos/seed/awei-earphone/400/400',
  '[{"url":"https://picsum.photos/seed/awei-earphone/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/awei-earphone-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Jack":"3.5mm","Mic":"Yes (inline)","Driver":"10mm","Cable Length":"1.2m","Brand":"Awei"}',
  '{"brand":"Awei","sold":"7.5K+ sold","shortDesc":"Bangladesh bestselling budget wired earphone.","fullDesc":"The Awei PC-2 delivers punchy bass, a clear inline microphone and a tangle-resistant cable for office, study and calls.","sections":[{"title":"Highlights","body":"Deep bass | Inline mic | Universal 3.5mm jack"},{"title":"Note","body":"Classic 3.5mm headphones - not USB-C"}],"related":[]}'
),
(
  'Baseus Bowie MA10 TWS Wireless Earbuds',
  'audio',
  2199, 3199, 4.3, 421,
  'ENC noise-reduction mics, 13mm drivers, touch controls and up to 30 hours total battery life with charging case.',
  'https://picsum.photos/seed/bowie-earbuds/400/400',
  '[{"url":"https://picsum.photos/seed/bowie-earbuds/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/bowie-earbuds-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Bluetooth":"5.3","Driver":"13mm","Battery":"30H (with case)","Charging":"USB-C","Mic":"ENC noise-reduction","Brand":"Baseus"}',
  '{"brand":"Baseus","sold":"1.6K+ sold","shortDesc":"TWS earbuds with clear calls and big sound.","fullDesc":"Baseus Bowie MA10 earbuds bring 13mm dynamic drivers, ENC call noise-reduction and 30 hours of total playback in a lightweight ergonomic design.","sections":[{"title":"Highlights","body":"13mm drivers | 30H battery | ENC mic"},{"title":"In the box","body":"Earbuds, charging case, USB-C cable"}],"related":[]}'
),
(
  'JBL GO 4 Portable Bluetooth Speaker',
  'audio',
  2999, 3999, 4.6, 89,
  'JBL Pro Sound, IP67 waterproof design, up to 7 hours playtime and a compact pocketable size.',
  'https://picsum.photos/seed/jbl-go4/400/400',
  '[{"url":"https://picsum.photos/seed/jbl-go4/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/jbl-go4-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Output":"JBL Pro Sound","Bluetooth":"5.3","Battery":"7H","Waterproof":"IP67","Brand":"JBL","Warranty":"1 Year"}',
  '{"brand":"JBL","sold":"250+ sold","shortDesc":"Pocket wireless speaker, fully waterproof.","fullDesc":"The JBL GO 4 is a tiny portable speaker with JBL Pro Sound, IP67 waterproof build and 7 hours of playtime, perfect for trips and outdoor use.","sections":[{"title":"Highlights","body":"JBL Pro Sound | IP67 waterproof | 7H battery"},{"title":"In the box","body":"Speaker, USB-C cable, strap"}],"related":[]}'
);

-- ── WEARABLES ───────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Xiaomi Redmi Watch 5 Active',
  'wearables',
  4999, 5999, 4.4, 178,
  '1.96-inch AMOLED display, 140+ sport modes, Bluetooth calling and 18-day battery life.',
  'https://picsum.photos/seed/redmi-watch5/400/400',
  '[{"url":"https://picsum.photos/seed/redmi-watch5/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/redmi-watch5-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Display":"1.96\" AMOLED","Battery":"18 Days","Bluetooth Calling":"Yes","Sport Modes":"140+","Water Resistant":"5ATM","Brand":"Xiaomi"}',
  '{"brand":"Xiaomi","sold":"1.3K+ sold","shortDesc":"Big AMOLED smart watch with calling.","fullDesc":"Redmi Watch 5 Active pairs a large 1.96-inch AMOLED screen with Bluetooth calling, 140+ sport modes and an 18-day battery for all-day wear.","sections":[{"title":"Highlights","body":"AMOLED display | Bluetooth calling | 18-day battery"},{"title":"In the box","body":"Watch, charging cable, manual"}],"related":[]}'
),
(
  'Xiaomi Smart Band 9',
  'wearables',
  2699, 3199, 4.5, 245,
  '1.62-inch AMOLED display, 150+ sport modes, SpO2 and heart-rate monitoring with 21-day battery.',
  'https://picsum.photos/seed/mi-band9/400/400',
  '[{"url":"https://picsum.photos/seed/mi-band9/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/mi-band9-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Display":"1.62\" AMOLED","Battery":"21 Days","Health":"SpO2 + HR + Sleep","Sport Modes":"150+","Water Resistant":"5ATM","Brand":"Xiaomi"}',
  '{"brand":"Xiaomi","sold":"2.2K+ sold","shortDesc":"Fitness band with 21-day battery life.","fullDesc":"Xiaomi Smart Band 9 tracks heart rate, SpO2 and sleep across 150+ sport modes, with a bright AMOLED display and up to 21 days of battery.","sections":[{"title":"Highlights","body":"AMOLED display | 21-day battery | 150+ sport modes"},{"title":"In the box","body":"Band, proprietary charger, manual"}],"related":[]}'
);

-- ── GAMING ──────────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Fantech ACGP01 Gamepad Holder Mobile Gaming Grip',
  'gaming',
  1150, 1550, 4.3, 167,
  'Adjustable smartphone gaming grip with cool-swap faceplates for trigger-free precision control.',
  'https://picsum.photos/seed/fantech-grip/400/400',
  '[{"url":"https://picsum.photos/seed/fantech-grip/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/fantech-grip-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Compatibility":"Phones 4.5\" - 7\"","Material":"ABS + silicone","Feature":"Cool-swap faceplate","Brand":"Fantech"}',
  '{"brand":"Fantech","sold":"540+ sold","shortDesc":"Comfort grip for mobile esports.","fullDesc":"The Fantech ACGP01 attaches firmly to any 4.5-7 inch phone for a comfortable, console-like grip during long Call of Duty Mobile and Free Fire sessions.","sections":[{"title":"Highlights","body":"Adjustable fit | Swappable faceplates | Anti-slip grip"},{"title":"Note","body":"Grip only - does not add physical triggers"}],"related":[]}'
),
(
  'Fantech K613 Valkyrie RGB Gaming Keyboard',
  'gaming',
  2299, 2899, 4.4, 198,
  'Rainbow backlit mechanical-feel keyboard with 31-key anti-ghosting and durable switches.',
  'https://picsum.photos/seed/fantech-k613/400/400',
  '[{"url":"https://picsum.photos/seed/fantech-k613/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/fantech-k613-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Layout":"Full (104 keys)","Backlight":"RGB Rainbow","Anti-Ghosting":"31 Keys","Interface":"USB","Brand":"Fantech"}',
  '{"brand":"Fantech","sold":"1.1K+ sold","shortDesc":"RGB gaming keyboard on a budget.","fullDesc":"Fantech K613 delivers colourful RGB backlighting, responsive keys and 31-key anti-ghosting - a great entry point for PC and mobile gaming.","sections":[{"title":"Highlights","body":"RGB backlight | Anti-ghosting | USB plug-and-play"},{"title":"In the box","body":"Keyboard, manual"}],"related":[]}'
);

-- ── CAMERA ──────────────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Akaso EK7000 4K Action Camera',
  'camera',
  7999, 9999, 4.2, 121,
  '4K30 video, 12MP photos, 2-inch touch screen, EIS image stabilization and waterproof housing to 30m.',
  'https://picsum.photos/seed/akaso-camera/400/400',
  '[{"url":"https://picsum.photos/seed/akaso-camera/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/akaso-camera-2/400/400","type":"image","order":2},{"url":"https://picsum.photos/seed/akaso-camera-3/400/400","type":"image","order":3}]',
  'Sale', true,
  '{"Video":"4K30fps","Photo":"12MP","Display":"2\" Touch","Stabilization":"EIS","Waterproof":"30m (housing)","Battery":"1050mAh","Brand":"Akaso"}',
  '{"brand":"Akaso","sold":"390+ sold","shortDesc":"Budget 4K action cam with mounting kit.","fullDesc":"The Akaso EK7000 records crisp 4K video and 12MP photos, with electronic image stabilization and a waterproof case down to 30 metres. Great for vlogging and travel.","sections":[{"title":"Highlights","body":"4K30 video | 30m waterproof | Touch display"},{"title":"In the box","body":"Camera, waterproof case, mounting kit, 2 batteries"}],"related":[]}'
);

-- ── LIFESTYLE / HOME ────────────────────────────────────────

INSERT INTO products (title, category, price, original_price, rating, reviews, description, image, images, badge, in_stock, specs, details) VALUES
(
  'Baseus Fiber 1.5L Water Bottle',
  'lifestyle',
  1350, 1750, 4.4, 205,
  'Large 1.5L capacity bottle with time scale markings, leak-proof straw and carry loop. BPA-free material.',
  'https://picsum.photos/seed/baseus-bottle/400/400',
  '[{"url":"https://picsum.photos/seed/baseus-bottle/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/baseus-bottle-2/400/400","type":"image","order":2}]',
  NULL, true,
  '{"Capacity":"1.5L","Material":"BPA-free Tritan","Feature":"Time markings + carry loop","Brand":"Baseus"}',
  '{"brand":"Baseus","sold":"890+ sold","shortDesc":"Gym and office water bottle bestseller.","fullDesc":"Keep hydration on track with the Baseus Fiber 1.5L bottle - it shows hourly time markings, a leak-proof straw lid and a soft carry loop.","sections":[{"title":"Highlights","body":"1.5L capacity | Time markings | Leak-proof straw"},{"title":"Note","body":"Hand wash recommended"}],"related":[]}'
),
(
  'Walton Electric Kettle 1.8L',
  'lifestyle',
  1499, 1899, 4.3, 267,
  '1.8-litre stainless steel electric kettle, 1200W, automatic shut-off and boil-dry protection with 1-year warranty.',
  'https://picsum.photos/seed/walton-kettle/400/400',
  '[{"url":"https://picsum.photos/seed/walton-kettle/400/400","type":"image","order":1},{"url":"https://picsum.photos/seed/walton-kettle-2/400/400","type":"image","order":2}]',
  'Sale', true,
  '{"Capacity":"1.8L","Power":"1200W","Material":"Stainless Steel","Safety":"Auto shut-off + boil-dry","Brand":"Walton","Warranty":"1 Year"}',
  '{"brand":"Walton","sold":"1.9K+ sold","shortDesc":"Fast-boiling stainless steel kettle.","fullDesc":"The Walton 1.8L kettle boils water quickly with a 1200W element, stainless steel body, automatic shut-off and boil-dry protection for complete safety.","sections":[{"title":"Highlights","body":"1200W quick boil | Auto shut-off | 1-year national warranty"},{"title":"In the box","body":"Kettle, base, manual"}],"related":[]}'
);

-- Done. 15 products seeded. Use the Admin panel -> Products to edit images/details,
-- or run additional INSERT statements following the same format.

-- ════════════════════════════════════════════════════════════════
-- BUNDLED FILE: demo_reviews.sql
-- ════════════════════════════════════════════════════════════════
-- ────────────────────────────────────────────────────────────────
-- demo_reviews.sql — DEMO / SAMPLE REVIEWS (test data only)
--
-- Run AFTER all.sql AND reviews.sql (the reviews table + trigger).
--
-- ⚠️ IMPORTANT
--   These are SAMPLE/DEMO reviews for testing the review UI only.
--   They are NOT genuine customer purchases.
--   Every reviewer name is suffixed with "[DEMO]" so they can never
--   be mistaken for real verified feedback.
--
-- Why source = 'admin'?
--   The reviews table stores verified customer reviews from real
--   users (source = 'customer', user_id = auth.uid()) and admin-made
--   custom reviews (source = 'admin', user_id = NULL). Because demo
--   rows have no real auth user behind them, they are inserted as
--   admin-source rows — exactly like reviews created in
--   Admin → Custom Reviews. They intentionally have NO user_id, so
--   they never claim a real purchase.
--
-- Re-run safety: this file can be run again; unique rows are
--   identified by a fixed (idempotent) reviewer name + product pair.
--   Use DELETE FROM public.reviews WHERE reviewer_name LIKE '%[DEMO]%';
--   to wipe them at any time.
--
-- product_id values: assume a clean run of all.sql + products.sql, so
--   products get sequential ids 1-18 in the order they were seeded
--   (Galaxy A36 = 1 ... Walton Kettle = 18). If your local product ids
--   differ, replace the id numbers with the ids from your products table.
-- YouTube video_url values are placeholder links (a working sample video)
--   to demonstrate the review-video embed feature — swap them for real
--   product-review video links if you want genuine-looking clips.
-- ────────────────────────────────────────────────────────────────

-- Optionally clear previous demo rows first (uncomment to re-seed clean):
-- DELETE FROM public.reviews WHERE reviewer_name LIKE '%[DEMO]%';

INSERT INTO public.reviews (product_id, user_id, reviewer_name, rating, review_text, images, video_url, source, is_published, created_at) VALUES
-- ── Product 1: Samsung Galaxy A36 5G (128GB) ──────────────────
(1, NULL, 'Rafi Ahmed [DEMO]', 5, 'Battery life is genuinely impressive — easy 1.5 days on normal use. The 120Hz AMOLED is silky smooth and the camera handles low light surprisingly well for this price tier. Very happy with the purchase.', '["https://picsum.photos/seed/demo1a/400/400", "https://picsum.photos/seed/demo1b/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-07-12T09:15:00+00:00'),
(1, NULL, 'Nusrat Jahan [DEMO]', 4, 'Phone feels premium and the software updates are a big plus. Only wish the charger was in the box. Other than that, superb everyday performance.', '[]'::jsonb, NULL, 'admin', true, '2026-07-28T14:40:00+00:00'),
(1, NULL, 'Tanvir Iqbal [DEMO]', 5, 'Upgraded from an A2x series and the difference is night and day. Fast, bright display, great battery. Highly recommended.', '["https://picsum.photos/seed/demo1c/400/400"]'::jsonb, NULL, 'admin', true, '2026-08-02T11:05:00+00:00'),

-- ── Product 2: realme 15 5G ────────────────────────────────────
(2, NULL, 'Mahmudul Hasan [DEMO]', 5, 'Charging speed is crazy fast and the 5G support is a bonus for the price. Camera gives natural colours in daylight. Value for money!', '["https://picsum.photos/seed/demo2a/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-07-19T18:22:00+00:00'),
(2, NULL, 'Sharmin Akter [DEMO]', 4, 'Good performance for everyday use and gaming is smooth at medium settings. Build feels a bit plastic-heavy but that is expected at this price.', '[]'::jsonb, NULL, 'admin', true, '2026-08-10T08:50:00+00:00'),

-- ── Product 3: Redmi Note 15 5G ────────────────────────────────
(3, NULL, 'Sajid Khan [DEMO]', 5, 'The best display in this segment. Bright, punchy and great for Netflix. Battery easily lasts the whole day with heavy use.', '["https://picsum.photos/seed/demo3a/400/400", "https://picsum.photos/seed/demo3b/400/400"]'::jsonb, NULL, 'admin', true, '2026-06-30T16:10:00+00:00'),
(3, NULL, 'Farhana Rahman [DEMO]', 4, 'Everything works well out of the box. MIUI is a bit heavy with ads in some apps but disabling them is easy. Overall a solid buy.', '[]'::jsonb, NULL, 'admin', true, '2026-07-22T13:30:00+00:00'),

-- ── Product 4: Samsung Galaxy A26 5G ───────────────────────────
(4, NULL, 'Imran Hossain [DEMO]', 4, 'Reliable daily driver. Samsung UI is clean, updates come on time. Camera is decent in good lighting. Would have loved a higher refresh rate.', '["https://picsum.photos/seed/demo4a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-05T10:45:00+00:00'),
(4, NULL, 'Joya Chowdhury [DEMO]', 5, 'Bought it for my parents — they love how simple and lag-free it is. Excellent build quality and warranty support.', '[]'::jsonb, NULL, 'admin', true, '2026-08-14T19:00:00+00:00'),

-- ── Product 5: Baseus 15W Cobble Qi Wireless Charger ───────────
(5, NULL, 'Alamgir Kabir [DEMO]', 5, 'Charges my phone and earbuds reliably. Small footprint, stays cool, and the build is solid. Great value.', '["https://picsum.photos/seed/demo5a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-14T20:30:00+00:00'),
(5, NULL, 'Tasnim Alam [DEMO]', 4, 'Works as advertised. Charging is not the fastest but perfect for overnight top-ups. Looks clean on the desk.', '[]'::jsonb, NULL, 'admin', true, '2026-08-05T09:20:00+00:00'),

-- ── Product 6: Anker Nano 33W GaN Fast Charger ────────────────
(6, NULL, 'Rahat Sheikh [DEMO]', 5, 'Tiny but powerful! Charges my phone from 0 to 60% in about 30 minutes. Plugs are tight and secure. This is my go-to travel charger.', '["https://picsum.photos/seed/demo6a/400/400", "https://picsum.photos/seed/demo6b/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-08-01T15:55:00+00:00'),
(6, NULL, 'Mehzabin Sultana [DEMO]', 5, 'Replaced three big chargers with this one. Safe, cool and compact. Highly recommended.', '[]'::jsonb, NULL, 'admin', true, '2026-08-20T12:10:00+00:00'),

-- ── Product 7: Baseus 10000mAh Mini Power Bank ────────────────
(7, NULL, 'Arifuzzaman Rony [DEMO]', 4, 'Pocket-friendly and charges a phone almost twice. Output is decent and the indicator LEDs are helpful.', '["https://picsum.photos/seed/demo7a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-08T11:40:00+00:00'),
(7, NULL, 'Sabiha Nahar [DEMO]', 5, 'Perfect for long days out. Compact, lightweight and delivers the rated capacity. Delivery was fast too.', '[]'::jsonb, NULL, 'admin', true, '2026-08-11T17:25:00+00:00'),

-- ── Product 8: 9H Tempered Glass Screen Protector ──────────────
(8, NULL, 'Nayeem Ahmed [DEMO]', 4, 'Installation is easy with the alignment frame and the fingerprint sensor still works perfectly. Dipped once already, no scratches.', '["https://picsum.photos/seed/demo8a/400/400"]'::jsonb, NULL, 'admin', true, '2026-06-25T14:00:00+00:00'),
(8, NULL, 'Puja Saha [DEMO]', 3, 'Good protection but the UV glue bottle was messy for me on my first try. Curved edges are a pain to install. Once on, it works fine.', '[]'::jsonb, NULL, 'admin', true, '2026-07-30T10:15:00+00:00'),

-- ── Product 9: Awei PC-2 3.5mm Wired Earphone ─────────────────
(9, NULL, 'Mithun Das [DEMO]', 4, 'Surprisingly good sound for the price. Bass is punchy, voice clarity is clear on calls. Cable feels durable.', '["https://picsum.photos/seed/demo9a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-16T09:50:00+00:00'),
(9, NULL, 'Rumana Islam [DEMO]', 4, 'Bought as a spare pair. Mic works well for virtual meetings. Great value for money.', '[]'::jsonb, NULL, 'admin', true, '2026-08-06T18:35:00+00:00'),

-- ── Product 10: Baseus Bowie MA10 TWS Wireless Earbuds ─────────
(10, NULL, 'Shakib Alam [DEMO]', 5, 'Pairing is instant, sound quality is balanced and the ANC makes a real difference on the bus. Battery life is excellent.', '["https://picsum.photos/seed/demo10a/400/400", "https://picsum.photos/seed/demo10b/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-07-02T12:30:00+00:00'),
(10, NULL, 'Farzana Haque [DEMO]', 4, 'Comfortable fit for small ears and the case is pocket-friendly. Touch controls take a day to get used to.', '[]'::jsonb, NULL, 'admin', true, '2026-08-18T08:05:00+00:00'),
(10, NULL, 'Zubair Ahmed [DEMO]', 4, 'Great bass and call quality. Battery case charges fast with USB-C. Minor complaint: no wireless charging.', '["https://picsum.photos/seed/demo10c/400/400"]'::jsonb, NULL, 'admin', true, '2026-08-25T20:45:00+00:00'),

-- ── Product 11: JBL GO 4 Portable Bluetooth Speaker ────────────
(11, NULL, 'Tanin Rahman [DEMO]', 5, 'Huge sound from such a tiny speaker! IP67 waterproofing is a lifesaver near the pool. Easily fills a room.', '["https://picsum.photos/seed/demo11a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-20T16:00:00+00:00'),
(11, NULL, 'Shuvo Mandal [DEMO]', 4, 'Great for outdoor trips. Battery lasts about 8 hours which is fine for me. Case quality feels premium.', '[]'::jsonb, NULL, 'admin', true, '2026-08-12T19:15:00+00:00'),

-- ── Product 12: Xiaomi Redmi Watch 5 Active ───────────────────
(12, NULL, 'Adnan Karim [DEMO]', 4, 'Nice big display and accurate step tracking. Notifications work flawlessly with both my phones. Battery around 9 days.', '["https://picsum.photos/seed/demo12a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-11T07:55:00+00:00'),
(12, NULL, 'Sadia Afrin [DEMO]', 5, 'Looks way more expensive than it is. Sleep tracking is surprisingly accurate. Great entry-level smartwatch.', '[]'::jsonb, NULL, 'admin', true, '2026-08-15T13:40:00+00:00'),

-- ── Product 13: Xiaomi Smart Band 9 ────────────────────────────
(13, NULL, 'Rony Chowdhury [DEMO]', 5, 'The AMOLED screen on this band is gorgeous and always-on is a huge upgrade. Battery easily lasts two weeks.', '["https://picsum.photos/seed/demo13a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-24T10:20:00+00:00'),
(13, NULL, 'Moumita Roy [DEMO]', 4, 'Lightweight and barely notice it wearing it. Heart rate and workout tracking are dependable. App works well.', '[]'::jsonb, NULL, 'admin', true, '2026-08-08T17:30:00+00:00'),

-- ── Product 14: Fantech ACGP01 Gamepad Holder ─────────────────
(14, NULL, 'Asif Mahmud [DEMO]', 4, 'Solid grip for long PUBG sessions and makes touch controls feel lighter. Adjustable to fit different phone sizes.', '["https://picsum.photos/seed/demo14a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-06T20:05:00+00:00'),
(14, NULL, 'Sumon Sarkar [DEMO]', 3, 'Does the job but the clamp gets tight on phones with side buttons. Fine for the price otherwise.', '[]'::jsonb, NULL, 'admin', true, '2026-08-03T11:50:00+00:00'),

-- ── Product 15: Fantech K613 Valkyrie RGB Gaming Keyboard ──────
(15, NULL, 'Nishat Rahman [DEMO]', 5, 'Love the hot-swappable switches and the RGB effects are smooth. Typing feels tactile and gaming input is responsive.', '["https://picsum.photos/seed/demo15a/400/400", "https://picsum.photos/seed/demo15b/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-18T14:15:00+00:00'),
(15, NULL, 'Likhon Das [DEMO]', 4, 'Great budget mechanical keyboard. Build is sturdy and the detachable cable is handy. Software is a bit basic.', '[]'::jsonb, NULL, 'admin', true, '2026-08-22T09:35:00+00:00'),

-- ── Product 16: Akaso EK7000 4K Action Camera ─────────────────
(16, NULL, 'Tanzim Alam [DEMO]', 4, '4K at 30fps looks surprisingly good for the price. Image stabilization helps during riding. Battery packs included save you money.', '["https://picsum.photos/seed/demo16a/400/400"]'::jsonb, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'admin', true, '2026-07-21T12:00:00+00:00'),
(16, NULL, 'Fahim Hasan [DEMO]', 3, 'Solid budget action cam, but low-light footage is noisy. With good sunlight it performs much better.', '[]'::jsonb, NULL, 'admin', true, '2026-08-16T15:25:00+00:00'),

-- ── Product 17: Baseus Fiber 1.5L Water Bottle ────────────────
(17, NULL, 'Priya Das [DEMO]', 5, 'Sleek design and super easy to carry. The leak-proof cap works great in my bag. Love the minimalist look.', '["https://picsum.photos/seed/demo17a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-09T08:25:00+00:00'),
(17, NULL, 'Rakibul Islam [DEMO]', 4, 'Good size bottle with a nice grip. Keeps water fresh all day. Would love a bigger lid for ice cubes.', '[]'::jsonb, NULL, 'admin', true, '2026-08-09T18:20:00+00:00'),

-- ── Product 18: Walton Electric Kettle 1.8L ───────────────────
(18, NULL, 'Hasibul Karim [DEMO]', 5, 'Boils 1.8L in no time and the auto shut-off is reliable. Wide mouth makes cleaning easy. Solid build.', '["https://picsum.photos/seed/demo18a/400/400"]'::jsonb, NULL, 'admin', true, '2026-07-13T10:30:00+00:00'),
(18, NULL, 'Ayesha Siddiqua [DEMO]', 4, 'Fast and safe for daily chai. Handle stays cool and the cord is long enough. Minor: the lid can be a little stiff getting open.', '[]'::jsonb, NULL, 'admin', true, '2026-08-07T16:45:00+00:00');

-- Repair older demo imports that may have been saved as hidden.
UPDATE public.reviews
SET is_published = true, updated_at = now()
WHERE source = 'admin'
	AND reviewer_name LIKE '%[DEMO]%'
	AND is_published IS DISTINCT FROM true;

-- ────────────────────────────────────────────────────────────────
-- Verify: every product should now show demo reviews on the product
-- page. To remove all demo data later run:
--   DELETE FROM public.reviews WHERE reviewer_name LIKE '%[DEMO]%';
-- ────────────────────────────────────────────────────────────────

