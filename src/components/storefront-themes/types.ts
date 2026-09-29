import type { RefObject } from 'react';
import type { User, Product, PriceTier } from '@/types';
import type { SupportedLanguage, SupportedCurrency } from '@/lib/i18n';

/**
 * Props shared by every storefront home theme (padrão, eletrônicos, ...).
 * CorretorPage.tsx owns all data-fetching/state (search, pagination, scroll
 * restoration) and hands the resolved data down here — themes only differ in
 * how they lay it out, never in how it's fetched.
 */
export interface StorefrontPageBodyProps {
  corretor: User;
  language: SupportedLanguage;
  currency: SupportedCurrency;
  cartEnabled: boolean;
  onlineSalesEnabled: boolean;
  allProducts: Product[];
  filterMetadata: any;
  /** Merchant's show/hide + order choices for categories (Configurações → Vitrine). */
  categorySettings?: any[];
  settings: any;
  sizeTypeMapping: any;
  filters: any;
  onFiltersChange: (filters: any) => void;
  productsContainerRef: RefObject<HTMLDivElement | null>;
  productsError: string | null;
  productsLoading: boolean;
  organizedProducts: Record<string, Product[]>;
  t: (key: string) => string;
  inventoryEnabled: boolean;
  showStockOnStorefront: boolean;
  blockZeroStock: boolean;
  priceTiersMap: Map<string, PriceTier[] | null>;
  onProductNavigate: () => void;
  isSearchActive: boolean;
  searchResultsPage: number;
  allServerSearchResults: any[];
  serverSearchLoading: boolean;
  handlePageChange: (newPage: number) => void;
  usePagination: boolean;
  currentProductPage: number;
  totalProductPages: number;
  totalProducts: number;
  pageSize: number;
  hasNextCategory: boolean;
  loadNextCategory: () => void;
}
