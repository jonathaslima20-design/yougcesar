import { supabaseBuyer } from './supabaseBuyer';

export interface BuyerFavorite {
  id: string;
  customer_id: string;
  product_id: string;
  store_owner_id: string;
  created_at: string;
}

export async function fetchFavorites(customerId: string): Promise<BuyerFavorite[]> {
  const { data, error } = await supabaseBuyer
    .from('buyer_favorites')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addFavorite(customerId: string, productId: string, storeOwnerId: string): Promise<void> {
  const { error } = await supabaseBuyer
    .from('buyer_favorites')
    .insert({ customer_id: customerId, product_id: productId, store_owner_id: storeOwnerId });

  // 23505 = unique_violation — already favorited, nothing to do
  if (error && error.code !== '23505') throw error;
}

export async function removeFavorite(customerId: string, productId: string): Promise<void> {
  const { error } = await supabaseBuyer
    .from('buyer_favorites')
    .delete()
    .eq('customer_id', customerId)
    .eq('product_id', productId);

  if (error) throw error;
}
