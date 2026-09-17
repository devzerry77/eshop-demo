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
    ('marquee_text', '🚚 Demo delivery on all orders &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🎁 Demo gift wrapping &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; ↩️ 7-day easy return &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; 🔒 Secure checkout'),
    -- 100% dynamic storefront (see dynamic-store.sql — same seeds, safe to re-run)
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

-- ── 2b. PAYMENT LOGO COLUMN (custom logo per method, see dynamic-store.sql) ──
ALTER TABLE public.payment_settings
    ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '';

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
