import { supabaseBuyer } from '@/lib/supabaseBuyer';

// Registers the signed-in buyer as a customer of this store (idempotent). The
// login is shared platform-wide, but each store only ever sees/shows its own
// account — see supabase/migrations/20260925100000_create_customer_store_accounts.sql.
// Never throws: a failure here must not block login or navigation.
export async function joinStore(storeSlug: string): Promise<void> {
  try {
    await supabaseBuyer.rpc('join_store', { p_store_slug: storeSlug });
  } catch (error) {
    console.error('join_store failed:', error);
  }
}
