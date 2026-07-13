/*
  # Adicionar opção Trimestral aos planos de assinatura

  1. Resumo
    - Atualizar a constraint do campo duration para incluir 'Trimestral'
    - Permitir que administradores cadastrem planos mensais, trimestrais, semestrais e anuais

  2. Alterações
    - Remove a constraint antiga que só permite Mensal, Semestral e Anual
    - Adiciona nova constraint incluindo a opção Trimestral
    - Valores permitidos: 'Mensal', 'Trimestral', 'Semestral', 'Anual'

  3. Notas Importantes
    - Esta migração não afeta dados existentes
    - Apenas expande as opções disponíveis para novos planos
*/

-- Remove a constraint antiga
ALTER TABLE subscription_plans 
DROP CONSTRAINT IF EXISTS subscription_plans_duration_check;

-- Adiciona a nova constraint com a opção Trimestral
ALTER TABLE subscription_plans
ADD CONSTRAINT subscription_plans_duration_check
CHECK (duration IN ('Mensal', 'Trimestral', 'Semestral', 'Anual'));