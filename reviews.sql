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