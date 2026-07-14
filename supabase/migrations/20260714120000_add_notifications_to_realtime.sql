/*
  # Add notifications to Supabase Realtime

  The frontend (subscribeToNotifications in src/lib/notificationService.ts)
  already opens a postgres_changes subscription filtered by user_id on the
  notifications table, but the table was never added to the supabase_realtime
  publication in any migration — so it may never have actually been receiving
  live events, only appearing to work via the initial fetch on page load.

  REPLICA IDENTITY FULL is required because the subscription filters on
  user_id (not the primary key): without it, UPDATE/DELETE events only carry
  the primary key in their payload and the user_id filter silently drops them.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
