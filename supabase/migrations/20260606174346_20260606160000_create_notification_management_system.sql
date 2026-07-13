/*
# Create Notification Management System

1. New Tables
  - `notification_templates`
    - `id` (uuid, PK) - Unique template identifier
    - `slug` (text, unique) - Machine-readable identifier (e.g. "subscription_expiring_7d")
    - `category` (text) - Category: vencimento, indicacao, ofertas, sistema, novidades
    - `notification_type` (text) - Maps to existing NotificationType
    - `title_template` (text) - Title with {{placeholders}}
    - `message_template` (text) - Message body with {{placeholders}}
    - `cta_label` (text, nullable) - CTA button text
    - `cta_url` (text, nullable) - CTA button destination URL
    - `is_enabled` (boolean) - Whether template is active
    - `is_system` (boolean) - System templates cannot be deleted
    - `created_at`, `updated_at` (timestamptz)

  - `notification_rules`
    - `id` (uuid, PK) - Unique rule identifier
    - `template_id` (uuid, FK) - Associated template
    - `rule_type` (text) - Type: days_before_expiry, days_after_expiry, on_referral_signup, on_referral_upgrade, on_plan_change, periodic
    - `rule_config` (jsonb) - Parameters like {"days": 7}
    - `target_audience` (text) - all, active, expired, free
    - `cooldown_hours` (int) - Prevents duplicate sends
    - `is_enabled` (boolean)
    - `last_executed_at` (timestamptz, nullable)
    - `created_at`, `updated_at`

  - `notification_broadcasts`
    - `id` (uuid, PK) - Unique broadcast identifier
    - `template_id` (uuid, FK, nullable) - Optional template reference
    - `title` (text) - Notification title
    - `message` (text) - Notification message
    - `notification_type` (text) - Notification type
    - `cta_label` (text, nullable) - CTA button text
    - `cta_url` (text, nullable) - CTA destination
    - `target_audience` (text) - all, active, expired, free, specific
    - `target_user_ids` (uuid[], nullable) - For specific user targeting
    - `scheduled_at` (timestamptz, nullable) - Scheduled send time
    - `sent_at` (timestamptz, nullable) - Actual send time
    - `recipients_count` (int) - Number of recipients
    - `status` (text) - draft, scheduled, sending, sent, failed
    - `sent_by` (uuid) - Admin who created it
    - `created_at`, `updated_at`

2. Modified Tables
  - `notifications` - Added cta_label and cta_url columns for CTA support

3. Security
  - Enable RLS on all new tables
  - Admin-only access policies (role = 'admin' check via users table)

4. Indexes
  - notification_broadcasts(status, scheduled_at) for scheduled processing
  - notification_templates(category) for category filtering
  - notification_rules(template_id) for rule lookups

5. Functions
  - send_broadcast_notifications(uuid) - Sends notifications to target audience
  - process_scheduled_broadcasts() - Processes due scheduled broadcasts

6. Seed Data
  - Pre-configured templates for subscription expiry, referrals, and system notifications
  - Default rules for expiry notifications (7d, 3d, 1d before; 1d, 2d after)
*/

-- Add CTA columns to existing notifications table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'cta_label') THEN
    ALTER TABLE notifications ADD COLUMN cta_label text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'cta_url') THEN
    ALTER TABLE notifications ADD COLUMN cta_url text;
  END IF;
END $$;

-- Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  category text NOT NULL DEFAULT 'sistema',
  notification_type text NOT NULL DEFAULT 'system',
  title_template text NOT NULL,
  message_template text NOT NULL DEFAULT '',
  cta_label text,
  cta_url text,
  is_enabled boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create notification_rules table
CREATE TABLE IF NOT EXISTS notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES notification_templates(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  rule_config jsonb NOT NULL DEFAULT '{}',
  target_audience text NOT NULL DEFAULT 'all',
  cooldown_hours int NOT NULL DEFAULT 72,
  is_enabled boolean NOT NULL DEFAULT true,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create notification_broadcasts table
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  notification_type text NOT NULL DEFAULT 'system',
  cta_label text,
  cta_url text,
  target_audience text NOT NULL DEFAULT 'all',
  target_user_ids uuid[],
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_broadcasts_status_scheduled
  ON notification_broadcasts (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_notification_templates_category
  ON notification_templates (category);

CREATE INDEX IF NOT EXISTS idx_notification_rules_template
  ON notification_rules (template_id);

-- Enable RLS
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_templates (admin-only)
DROP POLICY IF EXISTS "admin_select_templates" ON notification_templates;
CREATE POLICY "admin_select_templates" ON notification_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_templates" ON notification_templates;
CREATE POLICY "admin_insert_templates" ON notification_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_templates" ON notification_templates;
CREATE POLICY "admin_update_templates" ON notification_templates FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "admin_delete_templates" ON notification_templates;
CREATE POLICY "admin_delete_templates" ON notification_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
    AND is_system = false
  );

-- RLS Policies for notification_rules (admin-only)
DROP POLICY IF EXISTS "admin_select_rules" ON notification_rules;
CREATE POLICY "admin_select_rules" ON notification_rules FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "admin_insert_rules" ON notification_rules;
CREATE POLICY "admin_insert_rules" ON notification_rules FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "admin_update_rules" ON notification_rules;
CREATE POLICY "admin_update_rules" ON notification_rules FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "admin_delete_rules" ON notification_rules;
CREATE POLICY "admin_delete_rules" ON notification_rules FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- RLS Policies for notification_broadcasts (admin-only)
DROP POLICY IF EXISTS "admin_select_broadcasts" ON notification_broadcasts;
CREATE POLICY "admin_select_broadcasts" ON notification_broadcasts FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "admin_insert_broadcasts" ON notification_broadcasts;
CREATE POLICY "admin_insert_broadcasts" ON notification_broadcasts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "admin_update_broadcasts" ON notification_broadcasts;
CREATE POLICY "admin_update_broadcasts" ON notification_broadcasts FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "admin_delete_broadcasts" ON notification_broadcasts;
CREATE POLICY "admin_delete_broadcasts" ON notification_broadcasts FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- Function to send broadcast notifications
CREATE OR REPLACE FUNCTION send_broadcast_notifications(p_broadcast_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_broadcast record;
  v_user record;
  v_count int := 0;
BEGIN
  SELECT * INTO v_broadcast FROM notification_broadcasts WHERE id = p_broadcast_id;
  
  IF v_broadcast IS NULL THEN
    RAISE EXCEPTION 'Broadcast not found';
  END IF;

  IF v_broadcast.status = 'sent' THEN
    RETURN 0;
  END IF;

  UPDATE notification_broadcasts SET status = 'sending', updated_at = now() WHERE id = p_broadcast_id;

  FOR v_user IN
    SELECT u.id FROM users u
    WHERE u.role NOT IN ('admin', 'parceiro')
    AND (
      v_broadcast.target_audience = 'all'
      OR (v_broadcast.target_audience = 'active' AND u.plan_status = 'active')
      OR (v_broadcast.target_audience = 'expired' AND u.plan_status = 'expired')
      OR (v_broadcast.target_audience = 'free' AND u.plan_status = 'free')
      OR (v_broadcast.target_audience = 'specific' AND u.id = ANY(v_broadcast.target_user_ids))
    )
  LOOP
    INSERT INTO notifications (user_id, type, title, message, cta_label, cta_url)
    VALUES (v_user.id, v_broadcast.notification_type, v_broadcast.title, v_broadcast.message, v_broadcast.cta_label, v_broadcast.cta_url);
    v_count := v_count + 1;
  END LOOP;

  UPDATE notification_broadcasts
  SET status = 'sent', sent_at = now(), recipients_count = v_count, updated_at = now()
  WHERE id = p_broadcast_id;

  RETURN v_count;
END;
$$;

-- Function to process scheduled broadcasts
CREATE OR REPLACE FUNCTION process_scheduled_broadcasts()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_broadcast record;
  v_total int := 0;
  v_sent int;
BEGIN
  FOR v_broadcast IN
    SELECT id FROM notification_broadcasts
    WHERE status = 'scheduled' AND scheduled_at <= now()
  LOOP
    v_sent := send_broadcast_notifications(v_broadcast.id);
    v_total := v_total + v_sent;
  END LOOP;

  RETURN v_total;
END;
$$;

-- Seed system templates
INSERT INTO notification_templates (slug, category, notification_type, title_template, message_template, cta_label, cta_url, is_enabled, is_system)
VALUES
  ('subscription_expiring', 'vencimento', 'subscription_expiring', 'Assinatura expirando', 'Sua assinatura expira em {{dias}} dias. Renove para manter sua vitrine ativa.', 'Renovar agora', '/dashboard/settings', true, true),
  ('subscription_expiring_today', 'vencimento', 'subscription_expiring', 'Assinatura expira hoje!', 'Sua assinatura expira hoje! Renove para manter sua vitrine ativa.', 'Renovar agora', '/dashboard/settings', true, true),
  ('subscription_expired_grace', 'vencimento', 'subscription_expired', 'Assinatura vencida', 'Sua assinatura venceu. Voce tem mais {{dias}} dia(s) para renovar antes do bloqueio automatico.', 'Renovar agora', '/dashboard/settings', true, true),
  ('subscription_blocked', 'vencimento', 'subscription_expired', 'Vitrine bloqueada', 'Sua vitrine foi bloqueada por falta de pagamento. Renove seu plano para reativar o acesso completo.', 'Renovar plano', '/dashboard/settings', true, true),
  ('referral_signup', 'indicacao', 'referral_signup', 'Nova indicacao!', '{{nome}} se cadastrou usando seu link de indicacao.', NULL, NULL, true, true),
  ('referral_upgrade', 'indicacao', 'referral_upgrade', 'Comissao recebida!', '{{nome}} assinou um plano. Voce recebeu uma comissao!', 'Ver ganhos', '/dashboard/referral', true, true),
  ('system_maintenance', 'sistema', 'system', 'Manutencao programada', '{{mensagem}}', NULL, NULL, true, true),
  ('system_update', 'novidades', 'system', 'Novidade no VitrineTurbo!', '{{mensagem}}', 'Saiba mais', '{{url}}', true, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed default rules for expiry templates
DO $$
DECLARE
  v_template_id uuid;
BEGIN
  -- Rule: 7 days before expiry
  SELECT id INTO v_template_id FROM notification_templates WHERE slug = 'subscription_expiring';
  IF v_template_id IS NOT NULL THEN
    INSERT INTO notification_rules (template_id, rule_type, rule_config, target_audience, cooldown_hours, is_enabled)
    VALUES
      (v_template_id, 'days_before_expiry', '{"days": 7}', 'active', 72, true),
      (v_template_id, 'days_before_expiry', '{"days": 3}', 'active', 72, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Rule: expiring today
  SELECT id INTO v_template_id FROM notification_templates WHERE slug = 'subscription_expiring_today';
  IF v_template_id IS NOT NULL THEN
    INSERT INTO notification_rules (template_id, rule_type, rule_config, target_audience, cooldown_hours, is_enabled)
    VALUES (v_template_id, 'days_before_expiry', '{"days": 0}', 'active', 24, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Rule: expired grace period
  SELECT id INTO v_template_id FROM notification_templates WHERE slug = 'subscription_expired_grace';
  IF v_template_id IS NOT NULL THEN
    INSERT INTO notification_rules (template_id, rule_type, rule_config, target_audience, cooldown_hours, is_enabled)
    VALUES
      (v_template_id, 'days_after_expiry', '{"days": 1}', 'active', 24, true),
      (v_template_id, 'days_after_expiry', '{"days": 2}', 'active', 24, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
