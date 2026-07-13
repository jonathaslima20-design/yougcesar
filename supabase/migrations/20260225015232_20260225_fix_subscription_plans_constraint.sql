/*
  # Fix Subscription Plans Constraint

  1. Summary
    - Remove restrictive check constraint temporarily
    - Update all plan records to use consistent duration values
    - Reapply constraint with new allowed values (Mensal, Semestral, Anual)

  2. Process
    - Step 1: Drop old constraint
    - Step 2: Update Trimestral to Mensal
    - Step 3: Add new constraint with correct values
*/

-- Disable the constraint by dropping it
ALTER TABLE IF EXISTS subscription_plans DISABLE TRIGGER ALL;

-- Drop the constraint that's causing issues
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_duration_check;

-- Enable triggers
ALTER TABLE IF EXISTS subscription_plans ENABLE TRIGGER ALL;

-- Now update the data with no constraints blocking
UPDATE subscription_plans
SET 
  name = 'Plano Mensal',
  duration = 'Mensal',
  updated_at = now()
WHERE duration = 'Trimestral';

-- Add the new, updated constraint
ALTER TABLE subscription_plans
ADD CONSTRAINT subscription_plans_duration_check
CHECK (duration IN ('Mensal', 'Semestral', 'Anual'));
