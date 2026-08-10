/*
  # Tipo de embalagem e presets de dimensoes reutilizaveis

  1. Problema
    - O formulario de produto so tem 4 campos numericos crus (peso/altura/
      largura/comprimento), sempre tratando o produto como uma caixa —
      sem opcao de envelope ou rolo/cilindro, e sem forma de salvar uma
      combinacao de medidas pra reusar em outros produtos.
    - Referencia: a propria Olist/SuperFrete tem "Tipo da embalagem"
      (Envelope / Pacote-Caixa / Rolo-Cilindro) + um seletor de embalagem
      salva que preenche as medidas automaticamente.

  2. Fix
    - `product_packaging_presets`: biblioteca de embalagens reutilizaveis
      por lojista, modelada em cima de `user_custom_sizes` (RLS dono-
      apenas, mesmo padrao de policies).
    - `products.package_type` (envelope/box/cylinder), `diameter_cm` (so
      usado por cilindro) e `package_preset_id` (qual preset originou os
      valores, se algum).
    - `package_type` entra com DEFAULT 'box' e NOT NULL: todo produto que
      ja tem altura/largura/comprimento preenchidos hoje ja e uma caixa
      implicita, entao nenhum backfill e necessario e nada muda
      visualmente pros produtos existentes.
    - Nao mexe em `height_cm`/`width_cm`/`length_cm`/`weight_kg`: caixa e
      envelope continuam usando essas colunas (envelope so usa
      width+length); so cilindro precisa da coluna nova `diameter_cm`.
*/

CREATE TABLE IF NOT EXISTS product_packaging_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_name text NOT NULL,
  package_type text NOT NULL DEFAULT 'box' CHECK (package_type IN ('envelope', 'box', 'cylinder')),
  weight_kg numeric,
  height_cm numeric,
  width_cm numeric,
  length_cm numeric,
  diameter_cm numeric,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT product_packaging_presets_unique UNIQUE (user_id, preset_name),
  CONSTRAINT preset_name_not_empty CHECK (length(trim(preset_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_product_packaging_presets_user_id ON product_packaging_presets(user_id);

ALTER TABLE product_packaging_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own packaging presets"
  ON product_packaging_presets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own packaging presets"
  ON product_packaging_presets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packaging presets"
  ON product_packaging_presets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packaging presets"
  ON product_packaging_presets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON product_packaging_presets TO authenticated;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'box'
    CHECK (package_type IN ('envelope', 'box', 'cylinder')),
  ADD COLUMN IF NOT EXISTS diameter_cm numeric,
  ADD COLUMN IF NOT EXISTS package_preset_id uuid REFERENCES product_packaging_presets(id) ON DELETE SET NULL;
