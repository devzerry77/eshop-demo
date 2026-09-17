-- ═══════════════════════════════════════════════════════════════
-- E-SHOP DEMO — PREMIUM v1 MIGRATION (additive, idempotent)
-- Run ONCE in Supabase SQL Editor AFTER all.sql.
-- Adds: brands, subcategories, SKU, variants, inventory ledger,
-- shipping zones, staff roles, audit logs, coupon engine v2,
-- SEO fields, marketing CMS keys, secure RPCs v2, tightened RLS.
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. BRANDS ───
CREATE TABLE IF NOT EXISTS public.brands (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  logo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brands_public_read ON public.brands;
CREATE POLICY brands_public_read ON public.brands FOR SELECT TO anon, authenticated USING (active = TRUE);
DROP POLICY IF EXISTS brands_admin_write ON public.brands;
CREATE POLICY brands_admin_write ON public.brands FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 2. CATEGORIES: subcategories + merchandising ───
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_slug TEXT REFERENCES public.categories(slug) ON DELETE SET NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- ─── 3. PRODUCTS: SKU, brand, merchandising, SEO ───
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_id BIGINT REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_flash BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS flash_ends_at TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight_gram INT CHECK (weight_gram IS NULL OR weight_gram >= 0);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_flash ON public.products(is_flash) WHERE is_flash = TRUE;

-- ─── 4. PRODUCT VARIANTS ───
CREATE TABLE IF NOT EXISTS public.product_variants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size_label TEXT,
  color_label TEXT,
  sku TEXT UNIQUE,
  price_override NUMERIC CHECK (price_override IS NULL OR price_override >= 0),
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (size_label IS NOT NULL OR color_label IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS variants_public_read ON public.product_variants;
CREATE POLICY variants_public_read ON public.product_variants FOR SELECT TO anon, authenticated USING (active = TRUE);
DROP POLICY IF EXISTS variants_admin_write ON public.product_variants;
CREATE POLICY variants_admin_write ON public.product_variants FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 5. INVENTORY LEDGER ───
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id BIGINT REFERENCES public.product_variants(id) ON DELETE SET NULL,
  change_qty INT NOT NULL CHECK (change_qty <> 0),
  reason TEXT NOT NULL DEFAULT 'adjustment',
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  actor_email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_product ON public.inventory_ledger(product_id, created_at DESC);
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledger_admin_all ON public.inventory_ledger;
CREATE POLICY ledger_admin_all ON public.inventory_ledger FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 6. SHIPPING ZONES (courier-ready) ───
CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  districts TEXT[] NOT NULL DEFAULT '{}',
  fee NUMERIC NOT NULL DEFAULT 0 CHECK (fee >= 0),
  free_above NUMERIC CHECK (free_above IS NULL OR free_above >= 0),
  eta_days TEXT NOT NULL DEFAULT '2-4 days',
  courier_hint TEXT NOT NULL DEFAULT 'standard',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zones_public_read ON public.shipping_zones;
CREATE POLICY zones_public_read ON public.shipping_zones FOR SELECT TO anon, authenticated USING (active = TRUE);
DROP POLICY IF EXISTS zones_admin_write ON public.shipping_zones;
CREATE POLICY zones_admin_write ON public.shipping_zones FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.shipping_zones (name, districts, fee, free_above, eta_days, courier_hint)
VALUES
  ('Inside Dhaka', ARRAY['Dhaka'], 60, 2000, '1-2 days', 'standard'),
  ('Outside Dhaka', ARRAY['Chattogram','Sylhet','Khulna','Rajshahi','Barishal','Rangpur','Mymensingh'], 120, 3000, '2-4 days', 'standard'),
  ('Nationwide Default', ARRAY[]::TEXT[], 100, 2000, '2-5 days', 'standard')
ON CONFLICT (name) DO NOTHING;

-- ─── 7. ORDERS: tracking + courier-ready ───
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_zone_id BIGINT REFERENCES public.shipping_zones(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_note TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS variant_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_id BIGINT REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_label TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON public.orders(tracking_number) WHERE tracking_number IS NOT NULL;

-- ─── 8. COUPON ENGINE v2 ───
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_discount NUMERIC CHECK (max_discount IS NULL OR max_discount >= 0);
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS per_user_limit INT CHECK (per_user_limit IS NULL OR per_user_limit > 0);
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS product_ids BIGINT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS category_slugs TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS campaign TEXT;
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coupon_code TEXT NOT NULL REFERENCES public.coupons(code) ON DELETE CASCADE,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  user_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_redemptions_coupon ON public.coupon_redemptions(coupon_code);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS redemptions_admin_all ON public.coupon_redemptions;
CREATE POLICY redemptions_admin_all ON public.coupon_redemptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 9. STAFF ROLES (RBAC) ───
CREATE TABLE IF NOT EXISTS public.admin_roles (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('super_admin','manager','order_manager','product_manager','marketing_manager','staff')),
  permissions JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_admin_read ON public.admin_roles;
CREATE POLICY roles_admin_read ON public.admin_roles FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS roles_super_write ON public.admin_roles;
CREATE POLICY roles_super_write ON public.admin_roles FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── 10. AUDIT LOGS ───
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity, entity_id);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_admin_read ON public.audit_logs;
CREATE POLICY audit_admin_read ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS audit_system_write ON public.audit_logs;
CREATE POLICY audit_system_write ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ─── 11. ADMIN HELPERS (must exist before policies above) ───
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE lower(email) = lower(COALESCE(auth.email(), '')));
$$;
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_roles WHERE lower(email) = lower(COALESCE(auth.email(), '')) AND role = 'super_admin')
      OR lower(COALESCE(auth.email(), '')) = lower(COALESCE((SELECT value FROM public.settings WHERE key = 'super_admin_email'), 'admin@eshop.demo'));
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ─── 12. Harden legacy demo-open write policies ───
-- Keep public SELECT for storefront; writes go through RPCs / admin policies.
DO $$ BEGIN
  DROP POLICY IF EXISTS demo_open_products ON public.products;
  DROP POLICY IF EXISTS demo_open_settings ON public.settings;
  DROP POLICY IF EXISTS demo_open_payments ON public.payment_settings;
  DROP POLICY IF EXISTS demo_open_coupons ON public.coupons;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS products_admin_write ON public.products;
CREATE POLICY products_admin_write ON public.products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS settings_public_read ON public.settings;
CREATE POLICY settings_public_read ON public.settings FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS settings_admin_write ON public.settings;
CREATE POLICY settings_admin_write ON public.settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS payments_public_read ON public.payment_settings;
CREATE POLICY payments_public_read ON public.payment_settings FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS payments_admin_write ON public.payment_settings;
CREATE POLICY payments_admin_write ON public.payment_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS coupons_public_read ON public.coupons;
CREATE POLICY coupons_public_read ON public.coupons FOR SELECT TO anon, authenticated USING (active = TRUE);
DROP POLICY IF EXISTS coupons_admin_write ON public.coupons;
CREATE POLICY coupons_admin_write ON public.coupons FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── 13. SECURE RPCs v2 ───
-- Atomic stock adjustment + ledger + audit (admin only)
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id BIGINT, p_variant_id BIGINT, p_delta INT, p_reason TEXT DEFAULT 'adjustment', p_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor TEXT := lower(COALESCE(auth.email(), ''));
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'FORBIDDEN'); END IF;
  IF p_delta = 0 THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'EMPTY_DELTA'); END IF;
  IF p_variant_id IS NOT NULL THEN
    UPDATE public.product_variants SET stock_quantity = stock_quantity + p_delta
      WHERE id = p_variant_id AND (stock_quantity + p_delta) >= 0;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'NEGATIVE_STOCK'); END IF;
  ELSE
    UPDATE public.products SET stock_quantity = COALESCE(stock_quantity, 0) + p_delta
      WHERE id = p_product_id AND (COALESCE(stock_quantity, 0) + p_delta) >= 0;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'NEGATIVE_STOCK'); END IF;
  END IF;
  INSERT INTO public.inventory_ledger (product_id, variant_id, change_qty, reason, actor_email, note)
    VALUES (p_product_id, p_variant_id, p_delta, COALESCE(p_reason, 'adjustment'), v_actor, p_note);
  INSERT INTO public.audit_logs (actor_email, action, entity, entity_id, metadata)
    VALUES (v_actor, 'inventory.adjust', COALESCE(CASE WHEN p_variant_id IS NOT NULL THEN 'variant' ELSE 'product' END, 'product'),
            COALESCE(p_variant_id::TEXT, p_product_id::TEXT), jsonb_build_object('delta', p_delta, 'reason', p_reason));
  RETURN jsonb_build_object('ok', TRUE);
END $$;
REVOKE ALL ON FUNCTION public.adjust_stock(BIGINT, BIGINT, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_stock(BIGINT, BIGINT, INT, TEXT, TEXT) TO authenticated;

-- Secure order status transition (restocks on cancel, audits everything)
CREATE OR REPLACE FUNCTION public.set_order_status(p_order_id BIGINT, p_status TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor TEXT := lower(COALESCE(auth.email(), ''));
DECLARE v_old TEXT;
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'FORBIDDEN'); END IF;
  IF p_status NOT IN ('pending','confirmed','processing','packed','shipped','out_for_delivery','delivered','cancelled','returned','refunded','payment_failed') THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'BAD_STATUS');
  END IF;
  SELECT status INTO v_old FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'NOT_FOUND'); END IF;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  IF p_status = 'cancelled' AND v_old NOT IN ('cancelled','refunded','returned') THEN
    UPDATE public.products p SET stock_quantity = COALESCE(p.stock_quantity, 0) + oi.quantity
      FROM public.order_items oi WHERE oi.order_id = p_order_id AND oi.product_id = p.id;
    INSERT INTO public.inventory_ledger (product_id, change_qty, reason, order_id, actor_email)
      SELECT oi.product_id, oi.quantity, 'order_cancel', p_order_id, v_actor
      FROM public.order_items oi WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL;
  END IF;
  INSERT INTO public.audit_logs (actor_email, action, entity, entity_id, metadata)
    VALUES (v_actor, 'order.status', 'order', p_order_id::TEXT, jsonb_build_object('from', v_old, 'to', p_status));
  RETURN jsonb_build_object('ok', TRUE, 'from', v_old, 'to', p_status);
END $$;
REVOKE ALL ON FUNCTION public.set_order_status(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_status(BIGINT, TEXT) TO authenticated;

-- Coupon validator (mirrors server rules; checkout RPC remains source of truth)
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_subtotal NUMERIC, p_email TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_used INT; v_per_user INT;
BEGIN
  SELECT * INTO r FROM public.coupons WHERE upper(code) = upper(TRIM(COALESCE(p_code, '')));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'INVALID'); END IF;
  IF NOT r.active THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'INACTIVE'); END IF;
  IF r.valid_from IS NOT NULL AND NOW() < r.valid_from THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'NOT_STARTED'); END IF;
  IF r.valid_to IS NOT NULL AND NOW() > r.valid_to THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'EXPIRED'); END IF;
  IF r.usage_limit IS NOT NULL AND COALESCE(r.used_count, 0) >= r.usage_limit THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'LIMIT_REACHED'); END IF;
  IF p_subtotal < COALESCE(r.min_order_amount, 0) THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'MIN_ORDER', 'min', r.min_order_amount); END IF;
  IF r.per_user_limit IS NOT NULL AND p_email IS NOT NULL THEN
    SELECT COUNT(*) INTO v_per_user FROM public.coupon_redemptions WHERE coupon_code = r.code AND lower(user_email) = lower(p_email);
    IF v_per_user >= r.per_user_limit THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'PER_USER_LIMIT'); END IF;
  END IF;
  DECLARE v_disc NUMERIC := CASE WHEN r.discount_type = 'percentage' THEN p_subtotal * (r.discount_value / 100.0) ELSE r.discount_value END;
  BEGIN
    IF r.max_discount IS NOT NULL THEN v_disc := LEAST(v_disc, r.max_discount); END IF;
    v_disc := LEAST(v_disc, p_subtotal);
    RETURN jsonb_build_object('ok', TRUE, 'code', r.code, 'discount', FLOOR(v_disc),
      'type', r.discount_type, 'campaign', COALESCE(r.campaign, ''));
  END;
END $$;
REVOKE ALL ON FUNCTION public.validate_coupon(TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC, TEXT) TO anon, authenticated;

-- Admin analytics snapshot (single round-trip for dashboard)
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total NUMERIC := 0; v_today NUMERIC := 0; v_week NUMERIC := 0; v_month NUMERIC := 0;
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('ok', FALSE, 'error', 'FORBIDDEN'); END IF;
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total FROM public.orders WHERE status NOT IN ('cancelled','returned','refunded');
  SELECT COALESCE(SUM(total_amount), 0) INTO v_today FROM public.orders WHERE status NOT IN ('cancelled','returned','refunded') AND created_at >= date_trunc('day', NOW());
  SELECT COALESCE(SUM(total_amount), 0) INTO v_week FROM public.orders WHERE status NOT IN ('cancelled','returned','refunded') AND created_at >= NOW() - INTERVAL '7 days';
  SELECT COALESCE(SUM(total_amount), 0) INTO v_month FROM public.orders WHERE status NOT IN ('cancelled','returned','refunded') AND created_at >= NOW() - INTERVAL '30 days';
  RETURN jsonb_build_object('ok', TRUE, 'revenue_total', v_total, 'revenue_today', v_today,
    'revenue_week', v_week, 'revenue_month', v_month,
    'orders_total', (SELECT COUNT(*) FROM public.orders),
    'orders_pending', (SELECT COUNT(*) FROM public.orders WHERE status = 'pending'),
    'orders_processing', (SELECT COUNT(*) FROM public.orders WHERE status IN ('confirmed','processing','packed','shipped','out_for_delivery')),
    'orders_delivered', (SELECT COUNT(*) FROM public.orders WHERE status = 'delivered'),
    'orders_cancelled', (SELECT COUNT(*) FROM public.orders WHERE status IN ('cancelled','returned','refunded')),
    'products_total', (SELECT COUNT(*) FROM public.products),
    'products_low', (SELECT COUNT(*) FROM public.products WHERE COALESCE(stock_quantity, 0) BETWEEN 1 AND COALESCE(low_stock_threshold, 5)),
    'products_out', (SELECT COUNT(*) FROM public.products WHERE COALESCE(stock_quantity, 0) <= 0 OR in_stock = FALSE),
    'customers_total', (SELECT COUNT(DISTINCT user_id) FROM public.orders WHERE user_id IS NOT NULL));
END $$;
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

-- ─── 14. MARKETING / SEO SETTINGS SEEDS ───
INSERT INTO public.settings (key, value) VALUES
  ('announcement_text', 'Premium delivery across Bangladesh · Cash on Delivery available'),
  ('newsletter_title', 'Get premium drops & exclusive coupons'),
  ('newsletter_subtitle', 'Join 10,000+ smart shoppers. No spam, unsubscribe anytime.'),
  ('seo_title', 'E-Shop Demo — Premium Online Store in Bangladesh'),
  ('seo_description', 'Shop electronics, fashion, home & living with bKash, Nagad, Rocket and Cash on Delivery.'),
  ('seo_keywords', 'online shop bangladesh, electronics, fashion, bkash shopping'),
  ('super_admin_email', 'admin@eshop.demo'),
  ('free_shipping_progress', 'true'),
  ('recently_viewed_enabled', 'true'),
  ('wishlist_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- ─── 15. BRAND + SUBCATEGORY + SKU SEEDS ───
INSERT INTO public.brands (name, slug) VALUES
  ('Samsung','samsung'),('Apple','apple'),('Xiaomi','xiaomi'),('Anker','anker'),
  ('JBL','jbl'),('Baseus','baseus'),('Sony','sony'),('Generic','generic')
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (slug, label, sort_order, active, parent_slug) VALUES
  ('earbuds','Earbuds', 11, TRUE, 'audio'),
  ('headphones','Headphones', 12, TRUE, 'audio'),
  ('smartphones','Smartphones', 21, TRUE, 'electronics'),
  ('smartwatch','Smartwatches', 31, TRUE, 'wearables')
ON CONFLICT (slug) DO NOTHING;
-- Backfill SKUs where missing
UPDATE public.products SET sku = 'ESH-' || LPAD(id::TEXT, 6, '0') WHERE sku IS NULL;
UPDATE public.products SET is_featured = TRUE WHERE id IN (SELECT id FROM public.products ORDER BY rating DESC NULLS LAST LIMIT 8);
UPDATE public.products SET low_stock_threshold = 5 WHERE low_stock_threshold IS NULL;

-- ─── 16. SUPER ADMIN SEED ───
INSERT INTO public.admin_roles (email, role, permissions) VALUES
  ('admin@eshop.demo', 'super_admin', '{"all": true}')
ON CONFLICT (email) DO UPDATE SET role = 'super_admin';
