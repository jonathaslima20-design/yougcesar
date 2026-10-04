/*
  # Produtos: slug legível na URL (/:loja/produtos/:slug)

  1. Changes to products
    - `slug` (text) — gerado do título, único dentro de cada loja (user_id).
      Ex.: "Relógio Monte Carlo Masculino" -> "relogio-monte-carlo-masculino"; se já existir,
      recebe sufixo: "...-2", "...-3".
    - Fixado na criação: renomear o produto NÃO muda o slug, para não quebrar links já compartilhados.

  2. Notes
    - Aditivo: os links com o ID (UUID) continuam funcionando.
    - Produtos atuais recebem slug nesta migração; produtos novos recebem pelo gatilho,
      em qualquer caminho de criação (cadastro, importação, cópia entre contas).
    - Nenhuma alteração de RLS.
    - Preenchimento em duas etapas (uma atualização para todos, depois só os repetidos),
      para não estourar o tempo limite do SQL Editor. O índice único é criado por último.
*/

-- O preenchimento pode levar mais que o limite padrão do SQL Editor.
SET statement_timeout = '15min';

-- 1) Coluna
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS slug text;

-- 2) Base do slug: minúsculas, sem acento, só letras e números separados por hífen
CREATE OR REPLACE FUNCTION public.product_slug_base(title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(both '-' FROM regexp_replace(
        translate(lower(coalesce(title, '')),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn'),
        '[^a-z0-9]+', '-', 'g')),
      ''),
    'produto');
$$;

-- 3) Preenchimento em uma atualização só: base + sufixo numerado dentro de cada loja, na ordem de criação
WITH ranked AS (
  SELECT
    id,
    public.product_slug_base(title) AS base,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, public.product_slug_base(title)
      ORDER BY created_at, id
    ) AS n
  FROM products
  WHERE slug IS NULL
)
UPDATE products p
SET slug = CASE WHEN r.n = 1 THEN r.base ELSE r.base || '-' || r.n END
FROM ranked r
WHERE p.id = r.id;

-- 4) Conflitos: um título pode gerar o mesmo slug que outro já tinha (ex.: "Tênis 2" e o "-2" de "Tênis").
--    Só os produtos repetidos são renomeados, sempre mantendo o mais antigo com o nome original.
DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n integer;
BEGIN
  FOR r IN
    SELECT p.id, p.user_id, p.slug
    FROM products p
    WHERE EXISTS (
      SELECT 1 FROM products q
      WHERE q.user_id = p.user_id AND q.slug = p.slug AND q.id <> p.id
        AND (q.created_at, q.id) < (p.created_at, p.id)
    )
    ORDER BY p.created_at, p.id
  LOOP
    base := r.slug;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM products q WHERE q.user_id = r.user_id AND q.slug = candidate) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    UPDATE products SET slug = candidate WHERE id = r.id;
  END LOOP;
END;
$$;

-- 5) Unicidade por loja (agora todos os produtos já têm slug distinto dentro da loja)
CREATE UNIQUE INDEX IF NOT EXISTS products_user_slug_key
  ON products (user_id, slug);

-- 6) Gatilho: gera o slug quando ele não é informado. Não altera um slug já existente.
CREATE OR REPLACE FUNCTION public.assign_product_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  n integer := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.product_slug_base(NEW.title);
    candidate := base;
    WHILE EXISTS (
      SELECT 1 FROM products p
      WHERE p.user_id = NEW.user_id AND p.slug = candidate AND p.id <> NEW.id
    ) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_assign_slug ON products;
CREATE TRIGGER products_assign_slug
  BEFORE INSERT OR UPDATE OF title, slug ON products
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_product_slug();
