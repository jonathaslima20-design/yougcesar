/*
  # Track when a user's plan_status last changed

  1. Problem
    - The Partners commission engine needs a grace period: a managed user
      whose plan just lapsed should still count toward their partner's
      "active users" tier for a few days, to avoid the commission rate
      flapping around a renewal date that's a day or two late.
    - `users.updated_at` cannot be used for this: no BEFORE UPDATE trigger
      auto-touches it anywhere in this repo's tracked migration history, so
      it only changes when application code happens to set it explicitly
      (inconsistent, and bumped by unrelated edits like a partner renaming a
      managed user). A dedicated, purpose-built column is needed instead.

  2. Changes
    - `users.plan_status_changed_at`: timestamptz, defaults to now() for
      existing rows (best-effort baseline — we don't have real history).
    - `set_plan_status_changed_at()` + `BEFORE UPDATE OF plan_status`
      trigger: stamps the column only when `plan_status` actually changes.
*/

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_status_changed_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_plan_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status THEN
    NEW.plan_status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_plan_status_changed_at ON public.users;
CREATE TRIGGER trigger_set_plan_status_changed_at
  BEFORE UPDATE OF plan_status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_plan_status_changed_at();
