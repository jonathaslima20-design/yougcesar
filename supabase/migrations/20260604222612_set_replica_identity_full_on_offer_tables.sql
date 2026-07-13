/*
  # Set REPLICA IDENTITY FULL on offer-related tables

  Supabase Realtime postgres_changes filters on non-PK columns (like offer_id)
  only work when the table's replica identity includes those columns.
  The default replica identity is just the primary key, which means
  filters like `offer_id=eq.XXX` silently receive no events.

  Setting REPLICA IDENTITY FULL ensures all columns are included in the
  WAL output, allowing Realtime filters on any column to work correctly.
*/

ALTER TABLE offer_user_assignments REPLICA IDENTITY FULL;
ALTER TABLE offer_impressions REPLICA IDENTITY FULL;
