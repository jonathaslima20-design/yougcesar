/*
  # Rename monthly_price to plan_price in subscriptions table

  1. Changes
    - Rename column `monthly_price` to `plan_price` in `subscriptions` table
    - The value now represents the total price for the billing period (not monthly)
    - e.g., for an annual plan, plan_price = annual price, not monthly equivalent

  2. Important Notes
    - Uses safe ALTER TABLE RENAME COLUMN syntax
    - No data loss - only column name changes
    - All existing data is preserved as-is
*/

ALTER TABLE subscriptions RENAME COLUMN monthly_price TO plan_price;
