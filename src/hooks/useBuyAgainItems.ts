import { useEffect, useState } from 'react';
import { supabaseBuyer } from '@/lib/supabaseBuyer';

export interface BuyAgainItem {
  product_id: string;
  product_title: string;
  product_image_url: string | null;
  selected_color: string | null;
  selected_size: string | null;
  selected_flavor: string | null;
  unit_price: number | null;
  store_owner_id: string;
  timesOrdered: number;
  lastOrderedAt: string;
}

export interface BuyAgainStoreInfo {
  name: string;
  slug: string;
}

// Aggregates past order items into distinct products, ranked by how often
// each was bought, so the buyer can re-add a favorite with one click
// instead of digging through old orders. Shared by BuyerOrdersPage and
// BuyerOverviewPage so the ranking logic only lives in one place.
export function useBuyAgainItems(customerId: string | undefined, limit = 6, storeOwnerId?: string) {
  const [items, setItems] = useState<BuyAgainItem[]>([]);
  const [stores, setStores] = useState<Record<string, BuyAgainStoreInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Waits for the store: the list is scoped to it, never all-stores.
    if (!customerId || !storeOwnerId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data: orderRows } = await supabaseBuyer
        .from('orders')
        .select('id, store_owner_id, created_at')
        .eq('store_owner_id', storeOwnerId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      const rows = orderRows || [];
      if (rows.length === 0) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      const { data: itemRows } = await supabaseBuyer
        .from('order_items')
        .select('order_id, product_id, product_title, product_image_url, unit_price, selected_color, selected_size, selected_flavor, selected_variant_label')
        .in('order_id', rows.map((o) => o.id));

      if (cancelled) return;

      const orderMeta = new Map(rows.map((o) => [o.id, o]));
      const aggregated = new Map<string, BuyAgainItem>();

      (itemRows || []).forEach((item) => {
        // Weight-variant purchases don't record which variant was bought,
        // so there's no safe price to re-add them at — same rule buyerReorder.ts uses.
        if (item.selected_variant_label) return;
        const order = orderMeta.get(item.order_id);
        if (!order) return;

        const existing = aggregated.get(item.product_id);
        if (existing) {
          existing.timesOrdered += 1;
          if (order.created_at > existing.lastOrderedAt) {
            existing.lastOrderedAt = order.created_at;
            existing.product_title = item.product_title;
            existing.product_image_url = item.product_image_url;
            existing.selected_color = item.selected_color;
            existing.selected_size = item.selected_size;
            existing.selected_flavor = item.selected_flavor;
            existing.unit_price = item.unit_price;
            existing.store_owner_id = order.store_owner_id;
          }
        } else {
          aggregated.set(item.product_id, {
            product_id: item.product_id,
            product_title: item.product_title,
            product_image_url: item.product_image_url,
            selected_color: item.selected_color,
            selected_size: item.selected_size,
            selected_flavor: item.selected_flavor,
            unit_price: item.unit_price,
            store_owner_id: order.store_owner_id,
            timesOrdered: 1,
            lastOrderedAt: order.created_at,
          });
        }
      });

      const sorted = Array.from(aggregated.values())
        .sort((a, b) => b.timesOrdered - a.timesOrdered || (a.lastOrderedAt < b.lastOrderedAt ? 1 : -1))
        .slice(0, limit);

      setItems(sorted);

      const storeIds = [...new Set(sorted.map((i) => i.store_owner_id))];
      if (storeIds.length > 0) {
        const { data: storeRows } = await supabaseBuyer.from('users').select('id, name, slug').in('id', storeIds);
        if (!cancelled) {
          const map: Record<string, BuyAgainStoreInfo> = {};
          (storeRows || []).forEach((s: { id: string; name: string; slug: string }) => {
            map[s.id] = { name: s.name, slug: s.slug };
          });
          setStores(map);
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, limit, storeOwnerId]);

  return { items, stores, loading };
}
