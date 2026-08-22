/*
  # Add manual shipping tracking fields to orders

  1. Changes
    - `orders`
      - New column `carrier` (text, nullable) - transportadora informada
        manualmente pelo lojista (ex: "Correios", "Jadlog")
      - New column `tracking_code` (text, nullable) - código de rastreio
        informado manualmente pelo lojista

  2. Notes
    - Sem integração com API de transportadora neste projeto (a integração
      com SuperFrete hoje é só cotação de frete, não gera etiqueta/código) —
      esses campos são preenchidos manualmente pelo lojista ao marcar o
      pedido como enviado, e exibidos ao comprador para ele copiar e
      rastrear no site da transportadora.
    - Nenhuma policy nova necessária: `orders` já tem RLS cobrindo leitura
      pelo dono da loja (merchant) e pelo comprador (`buyer_id = auth.uid()`),
      e essas colunas ficam sujeitas às mesmas policies existentes.
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code text;
