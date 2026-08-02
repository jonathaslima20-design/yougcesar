/*
  # Allow affiliates to view their own store's products

  1. Problem
    - The affiliate panel adds a "Catálogo" page so an affiliate can see which
      products earn them the most commission. The base `products` table's
      RLS predates this project's migration history (created directly
      against the live DB before migrations were tracked), so its exact
      policy text isn't recoverable from the repo — it very likely already
      allows public storefront reads for visible products, but that isn't
      something to silently assume for a feature that needs to work
      reliably.

  2. Changes
    - New, narrowly-scoped SELECT policy: an authenticated affiliate can read
      products belonging to their own store (`products.user_id` matches the
      `store_owner_id` of an affiliate row where `id = auth.uid()`). This is
      additive — Postgres RLS unions multiple permissive policies — so it's
      harmless even if a broader public policy already covers the same rows.
*/

DROP POLICY IF EXISTS "Affiliates can view own store products" ON public.products;
CREATE POLICY "Affiliates can view own store products"
  ON public.products FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliates a
    WHERE a.id = auth.uid() AND a.store_owner_id = products.user_id
  ));
