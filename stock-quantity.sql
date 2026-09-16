-- ────────────────────────────────────────────────────────────────
-- stock-quantity.sql — Product stock quantities (Grabby Tech)
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
