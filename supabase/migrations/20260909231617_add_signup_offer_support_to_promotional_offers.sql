/*
  # Add signup-offer support to Promotional Offers

  1. Changes to `promotional_offers`
    - `planos_aplicaveis` (uuid[], nullable) - When set, the offer's discount only
      applies to these subscription plan ids inside the mandatory plan-selection
      screen. NULL/empty means all paid plans.
    - `contador_modo` (text) - 'fixo' (existing behavior: same `data_fim` for
      everyone) or 'apos_cadastro' (new: a personal countdown computed per user
      from their own `users.created_at`).
    - `contador_horas_apos_cadastro` (int, nullable) - Hours after signup the
      personal countdown lasts, used only when `contador_modo = 'apos_cadastro'`.

  2. Changes to `offer_display_config`
    - `gatilho_acao` CHECK extended with `'bloqueio_planos'`: marks an offer to be
      fused into the mandatory (forced) plan-selection modal shown to users with
      no active plan, instead of shown as a dismissible floating overlay.
*/

ALTER TABLE promotional_offers
  ADD COLUMN IF NOT EXISTS planos_aplicaveis uuid[],
  ADD COLUMN IF NOT EXISTS contador_modo text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS contador_horas_apos_cadastro int;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotional_offers_contador_modo_check'
  ) THEN
    ALTER TABLE promotional_offers
      ADD CONSTRAINT promotional_offers_contador_modo_check
      CHECK (contador_modo IN ('fixo', 'apos_cadastro'));
  END IF;
END $$;

ALTER TABLE offer_display_config DROP CONSTRAINT IF EXISTS offer_display_config_gatilho_acao_check;

ALTER TABLE offer_display_config
  ADD CONSTRAINT offer_display_config_gatilho_acao_check
  CHECK (gatilho_acao IN ('ao_entrar', 'apos_cadastrar_produto', 'apos_atingir_limite', 'ao_navegar_planos', 'manual_apenas', 'bloqueio_planos'));
