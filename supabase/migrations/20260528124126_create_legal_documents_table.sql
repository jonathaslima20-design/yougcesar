/*
  # Create legal_documents table

  ## Summary
  Creates a versioned store for the platform's legal documents (Terms of Use,
  Privacy Policy, Cookie Policy). Admins manage all rows; the general public can
  read only the active document for each type.

  ## New Table: legal_documents
  - `id`            (uuid, PK)         — surrogate key
  - `document_type` (text, NOT NULL)   — slug identifier: 'terms_of_use' | 'privacy_policy' | 'cookies_policy'
  - `title`         (text, NOT NULL)   — display name, e.g. "Termos de Uso"
  - `version`       (text, NOT NULL)   — version string, e.g. "1.0", "2026-05-28"
  - `content`       (text)             — full document body (HTML or Markdown)
  - `is_active`     (boolean)          — marks the currently published version
  - `created_at`    (timestamptz)
  - `updated_at`    (timestamptz)

  ## Constraints
  - Unique partial index: only one active document per type at a time.

  ## Security
  - RLS enabled; table is locked by default.
  - Admins (role = 'admin') can SELECT, INSERT, UPDATE, DELETE any row.
  - Authenticated and anonymous users can SELECT active documents only.
*/

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text        NOT NULL,
  title         text        NOT NULL DEFAULT '',
  version       text        NOT NULL DEFAULT '1.0',
  content       text,
  is_active     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.legal_documents                IS 'Versioned legal documents managed by admins and readable by the public.';
COMMENT ON COLUMN public.legal_documents.document_type  IS 'Slug: terms_of_use | privacy_policy | cookies_policy';
COMMENT ON COLUMN public.legal_documents.version        IS 'Human-readable version, e.g. "1.0" or "2026-05-28"';
COMMENT ON COLUMN public.legal_documents.content        IS 'Document body in HTML or Markdown';
COMMENT ON COLUMN public.legal_documents.is_active      IS 'True for the version currently shown to end users';

-- Only one active document per type at a time
CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_one_active_per_type
  ON public.legal_documents (document_type)
  WHERE is_active = true;

-- Fast lookup by type
CREATE INDEX IF NOT EXISTS legal_documents_document_type_idx
  ON public.legal_documents (document_type);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

-- Admins: full read access
CREATE POLICY "Admins can view all legal documents"
  ON public.legal_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Admins: insert new versions
CREATE POLICY "Admins can insert legal documents"
  ON public.legal_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Admins: update existing versions
CREATE POLICY "Admins can update legal documents"
  ON public.legal_documents
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

-- Admins: delete old versions
CREATE POLICY "Admins can delete legal documents"
  ON public.legal_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Public (authenticated + anonymous): read active documents only
CREATE POLICY "Public can read active legal documents"
  ON public.legal_documents
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
