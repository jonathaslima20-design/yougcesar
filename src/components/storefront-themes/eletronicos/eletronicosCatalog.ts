import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sanitizeCategoryName } from '@/lib/categoryUtils';
import type { ProductFilters } from '@/utils/productDisplayUtils';

/**
 * Lightweight catalog summary for the Eletrônicos theme. The theme's home no longer
 * downloads the whole catalog (every product with all its photos): it only needs a
 * handful of columns per product to draw category covers, the price range, live filter
 * counts and search suggestions. Products themselves are fetched per category/search.
 */
export interface CatalogRow {
  id: string;
  title: string;
  image: string | null;
  categories: string[];
  brand: string | null;
  gender: string | null;
  condition: string | null;
  sizes: string[];
  price: number;
  displayPrice: number;
}

const SUMMARY_SELECT =
  'id,title,featured_image_url,category,brand,gender,condition,sizes,price,discounted_price,has_tiered_pricing,min_tiered_price,has_weight_variants,min_variant_price';

// The price a shopper sees on the card: tier/variant "from" price, else a real markdown, else list price.
function toDisplayPrice(row: any): number {
  if (row.has_tiered_pricing && Number(row.min_tiered_price) > 0) return Number(row.min_tiered_price);
  if (row.has_weight_variants && Number(row.min_variant_price) > 0) return Number(row.min_variant_price);
  const price = Number(row.price) || 0;
  const discounted = Number(row.discounted_price) || 0;
  return discounted > 0 && discounted < price ? discounted : price;
}

export interface CatalogSummary {
  rows: CatalogRow[];
  loading: boolean;
  /** category -> featured image of its first product (used when the merchant set no cover). */
  covers: Record<string, string>;
  priceRange: { min: number; max: number };
}

export function useEletronicosCatalogSummary(userId: string | undefined): CatalogSummary {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('products')
      .select(SUMMARY_SELECT)
      .eq('user_id', userId)
      .eq('is_visible_on_storefront', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Error loading catalog summary:', error);
          setRows([]);
        } else {
          setRows(
            (data || []).map((row: any) => ({
              id: row.id,
              title: row.title || '',
              image: row.featured_image_url || null,
              categories: ((row.category as string[] | null) || []).map(sanitizeCategoryName).filter(Boolean) as string[],
              brand: row.brand || null,
              gender: row.gender || null,
              condition: row.condition || null,
              sizes: (row.sizes as string[] | null) || [],
              price: Number(row.price) || 0,
              displayPrice: toDisplayPrice(row),
            }))
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const covers = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (!row.image) continue;
      for (const category of row.categories) {
        if (!map[category]) map[category] = row.image;
      }
    }
    return map;
  }, [rows]);

  const priceRange = useMemo(() => {
    const prices = rows.map((r) => r.displayPrice).filter((p) => p > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [rows]);

  return { rows, loading, covers, priceRange };
}

// ─── Filtering / facet counts (client-side, over the summary rows) ──────────────

const isSet = (value: string | undefined) => !!value && value !== 'todos';

/** Does `row` pass `filters`, optionally ignoring one facet (to count that facet's options)? */
export function rowMatches(
  row: CatalogRow,
  filters: Partial<ProductFilters> | undefined,
  ignore?: 'category' | 'brand' | 'gender' | 'condition' | 'sizes' | 'price',
  defaults?: { min: number; max: number }
): boolean {
  if (!filters) return true;
  if (ignore !== 'category' && isSet(filters.category) && !row.categories.includes(filters.category as string)) return false;
  if (ignore !== 'brand' && isSet(filters.brand) && row.brand !== filters.brand) return false;
  if (ignore !== 'gender' && isSet(filters.gender) && row.gender !== filters.gender) return false;
  if (ignore !== 'condition' && isSet(filters.condition) && row.condition !== filters.condition) return false;
  if (ignore !== 'sizes' && isSet(filters.sizes) && !row.sizes.includes(filters.sizes as string)) return false;
  if (ignore !== 'price' && defaults) {
    if (filters.minPrice !== undefined && filters.minPrice > defaults.min && row.displayPrice < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && filters.maxPrice < defaults.max && row.displayPrice > filters.maxPrice) return false;
  }
  return true;
}

export function countOptions(
  rows: CatalogRow[],
  filters: Partial<ProductFilters> | undefined,
  facet: 'category' | 'brand' | 'gender' | 'condition',
  defaults?: { min: number; max: number }
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!rowMatches(row, filters, facet, defaults)) continue;
    const values = facet === 'category' ? row.categories : [row[facet]].filter(Boolean) as string[];
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

// ─── Search suggestions ─────────────────────────────────────────────────────────

/** Lowercase, accent-free text so "camera" finds "Câmera". */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function suggestProducts(rows: CatalogRow[], query: string, limit = 6): CatalogRow[] {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const scored: { row: CatalogRow; score: number }[] = [];
  for (const row of rows) {
    const title = normalizeText(row.title);
    const haystack = `${title} ${normalizeText(row.brand || '')} ${row.categories.map(normalizeText).join(' ')}`;
    if (!tokens.every((t) => haystack.includes(t))) continue;
    // Title matches that start with the query, then anywhere in the title, rank above brand/category-only hits.
    const score = title.startsWith(tokens[0]) ? 0 : title.includes(tokens[0]) ? 1 : 2;
    scored.push({ row, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.row);
}

export function suggestCategories(categories: string[], query: string, limit = 3): string[] {
  const q = normalizeText(query);
  if (!q) return [];
  return categories.filter((c) => normalizeText(c).includes(q)).slice(0, limit);
}
