/*
  # Add avatar support for buyer accounts

  1. Changes
    - `customers.avatar_url` (text, nullable) — profile picture for buyer
      accounts, mirroring `users.avatar_url` on the merchant side.

  2. Storage
    - New, isolated RLS policies on `storage.objects` for the `public`
      bucket, scoped to a dedicated `avatars-comprador/{auth.uid()}/...`
      prefix. The merchant-side avatar policies for this same bucket were
      configured directly in the Supabase dashboard and aren't tracked in
      any migration here, so rather than assume anything about them, buyers
      get their own explicit, auditable prefix and policy set — fully
      isolated from whatever the merchant policies allow or don't allow.
    - Any authenticated Supabase user (buyer or merchant) can read/write
      only within their own `avatars-comprador/{their auth uid}/` folder.
*/

ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url text;

DROP POLICY IF EXISTS "Buyers can upload own avatar" ON storage.objects;
CREATE POLICY "Buyers can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'avatars-comprador'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Buyers can update own avatar" ON storage.objects;
CREATE POLICY "Buyers can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'avatars-comprador'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'avatars-comprador'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Buyers can delete own avatar" ON storage.objects;
CREATE POLICY "Buyers can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'avatars-comprador'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Anyone can view buyer avatars" ON storage.objects;
CREATE POLICY "Anyone can view buyer avatars"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] = 'avatars-comprador'
  );
