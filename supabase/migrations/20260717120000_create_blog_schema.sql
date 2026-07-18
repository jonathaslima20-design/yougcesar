/*
  # Create blog schema (categories, posts, view counter)

  1. Why
    - Organic SEO strategy for the "catálogo digital" niche requires a content
      hub the app doesn't have yet. This mirrors the existing Help Center
      schema shape (help_categories / help_articles) so the admin and public
      pages can reuse the same patterns, with two additions specific to SEO:
      `meta_title` / `meta_description` per post, and `cover_image_url` for
      Open Graph / social sharing images.

  2. New tables
    - `blog_categories` — name, slug, description, display_order, is_active
    - `blog_posts` — title, slug, markdown content, excerpt, cover image,
      category_id (FK), tags, meta_title/meta_description, is_published,
      is_featured, view_count, published_at

  3. View counting
    - No raw event-log table (nothing consumes it yet — would be dead weight,
      see [[project convention: avoid speculative tables]]). Instead a single
      SECURITY DEFINER RPC `increment_blog_post_view` bumps the counter,
      following the same safe-increment shape as `public.is_admin()` — this
      avoids granting anon a broad UPDATE policy on blog_posts just to let
      visitors increment a view counter.

  4. Security
    - RLS enabled on both tables. Public (anon + authenticated) can read
      active categories / published posts; only admins (via public.is_admin(),
      the recursion-safe helper introduced in
      20260716181000_fix_recursive_users_rls_policies.sql) can write.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL,
  excerpt text,
  cover_image_url text,
  category_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  meta_title text,
  meta_description text,
  is_published boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_category_id ON public.blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_is_published ON public.blog_posts(is_published);
CREATE INDEX IF NOT EXISTS idx_blog_categories_is_active ON public.blog_categories(is_active);

CREATE OR REPLACE FUNCTION public.increment_blog_post_view(post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE id = post_id AND is_published = true;
$$;

GRANT EXECUTE ON FUNCTION public.increment_blog_post_view(uuid) TO anon, authenticated;

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active blog categories"
  ON public.blog_categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins can insert blog categories"
  ON public.blog_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update blog categories"
  ON public.blog_categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete blog categories"
  ON public.blog_categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Public can view published blog posts"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (is_published = true OR public.is_admin());

CREATE POLICY "Admins can insert blog posts"
  ON public.blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update blog posts"
  ON public.blog_posts FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete blog posts"
  ON public.blog_posts FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;
