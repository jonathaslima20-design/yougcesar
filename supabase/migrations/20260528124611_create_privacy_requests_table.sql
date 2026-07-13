/*
  # Create privacy_requests table

  ## Summary
  Stores LGPD-related data requests submitted by users or visitors through the
  public "Excluir minha conta" page. Requests are recorded for manual review by
  admins; no automatic data deletion is performed in this version.

  ## New Table: privacy_requests
  - `id`           (uuid, PK)       — surrogate key
  - `name`         (text, NOT NULL) — requester's full name
  - `email`        (text, NOT NULL) — email of the account in question
  - `request_type` (text, NOT NULL) — one of: delete_account | correct_data |
                                       data_copy | revoke_consent | other
  - `message`      (text)           — optional details from the requester
  - `status`       (text)           — pending | in_review | completed | rejected
  - `created_at`   (timestamptz)
  - `updated_at`   (timestamptz)

  ## Security
  - RLS enabled; table is locked by default.
  - Anyone (anon + authenticated) can INSERT a new request.
  - Only admins (role = 'admin') can SELECT or UPDATE requests.
*/

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL DEFAULT '',
  email        text        NOT NULL DEFAULT '',
  request_type text        NOT NULL DEFAULT 'delete_account',
  message      text,
  status       text        NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.privacy_requests              IS 'LGPD data-subject requests submitted through the public deletion/correction form.';
COMMENT ON COLUMN public.privacy_requests.request_type IS 'delete_account | correct_data | data_copy | revoke_consent | other';
COMMENT ON COLUMN public.privacy_requests.status       IS 'pending | in_review | completed | rejected';

-- Index for admin list view (most common sort/filter)
CREATE INDEX IF NOT EXISTS privacy_requests_status_created_idx
  ON public.privacy_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS privacy_requests_email_idx
  ON public.privacy_requests (email);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request (anon or authenticated)
CREATE POLICY "Anyone can submit a privacy request"
  ON public.privacy_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read requests
CREATE POLICY "Admins can view all privacy requests"
  ON public.privacy_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Only admins can update status
CREATE POLICY "Admins can update privacy requests"
  ON public.privacy_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );
