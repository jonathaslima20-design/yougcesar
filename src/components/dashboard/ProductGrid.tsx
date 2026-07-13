import { Link } from 'react-router-dom';
import { Loader as Loader2, GripVertical, SquareCheck as CheckSquare, Square, Eye, MessageCircle, TrendingUp, MoveVertical as MoreVertical, Pencil, Copy, Trash2, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrencyI18n } from '@/lib/i18n';
import type { Product } from '@/types';
import { useState, useEffect, memo } from 'react';
import { fetchProductPriceTiers, getMinimumPriceFromTiers, getFirstTierPrices } from '@/lib/tieredPricingUtils';
import { StockEditPopover } from './StockEditPopover';
import { EnhancedProductGrid } from './EnhancedProductGrid';
import type { ProductAnalytics } from '@/hooks/useProductAnalytics';
import type { ProductTag } from '@/hooks/useProductTags';

interface ProductGridProps {
  products: Product[];
  productsByCategory?: Record<string, Product[]>;
  isDragMode: boolean;
  reordering: boolean;
  bulkActionLoading: boolean;
  selectedProducts: Set<string>;
  updatingProductId: string | null;
  user: any;
  inventoryEnabled?: boolean;
  onSelectProduct: (productId: string, checked: boolean) => void;
  onToggleVisibility: (productId: string, currentVisibility: boolean) => Promise<void>;
  onDragEnd: (result: any) => Promise<void>;
  onSaveOrder?: () => Promise<void>;
  onCancelReorder?: () => void;
  onStockUpdated?: (productId: string, newQuantity: number) => void;
  onQuickEdit?: (product: Product) => void;
  onDuplicate?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  getProductAnalytics?: (productId: string) => ProductAnalytics | null;
  getProductTags?: (productId: string) => ProductTag[];
}

function MiniSparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const width = 48;
  const height = 16;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block ml-1 opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ProductCardComponent = memo(function ProductCardComponent({
  product,
  isDragMode,
  isSelected,
  updatingProductId,
  user,
  inventoryEnabled,
  analytics,
  productTags,
  onSelectProduct,
  onToggleVisibility,
  onQuickEdit,
  onDuplicate,
  onDelete,
}: {
  product: Product;
  isDragMode: boolean;
  isSelected: boolean;
  updatingProductId: string | null;
  user: any;
  inventoryEnabled: boolean;
  analytics: ProductAnalytics | null;
  productTags: ProductTag[];
  onSelectProduct: (productId: string, checked: boolean) => void;
  onToggleVisibility: (productId: string, currentVisibility: boolean) => Promise<void>;
  onQuickEdit?: (product: Product) => void;
  onDuplicate?: (product: Product) => void;
  onDelete?: (product: Product) => void;
}) {
  const [minimumTieredPrice, setMinimumTieredPrice] = useState<number | null>(null);
  const [firstTierPrices, setFirstTierPrices] = useState<any>(null);
  const [loadingTiers, setLoadingTiers] = useState(false);

  useEffect(() => {
    if (product.has_tiered_pricing) {
      setLoadingTiers(true);
      fetchProductPriceTiers(product.id)
        .then(tiers => {
          setMinimumTieredPrice(getMinimumPriceFromTiers(tiers));
          setFirstTierPrices(getFirstTierPrices(tiers));
        })
        .catch(err => console.error('Error loading price tiers:', err))
        .finally(() => setLoadingTiers(false));
    }
  }, [product.id, product.has_tiered_pricing]);

  const effectiveMinPrice = product.has_tiered_pricing && minimumTieredPrice && minimumTieredPrice > 0 ? minimumTieredPrice : null;
  const hasDiscount = product.discounted_price && product.discounted_price < product.price;
  const baseDisplayPrice = hasDiscount ? product.discounted_price : product.price;
  const displayPrice = effectiveMinPrice !== null ? effectiveMinPrice : baseDisplayPrice;
  const originalPrice = hasDiscount ? product.price : null;
  const discountPercentage = hasDiscount
    ? Math.round(((product.price - product.discounted_price!) / product.price) * 100)
    : null;
  const isTieredPricing = product.has_tiered_pricing && effectiveMinPrice !== null && effectiveMinPrice > 0;

  const stockLevel = inventoryEnabled && product.track_inventory
    ? product.stock_quantity === 0
      ? 'out'
      : product.stock_quantity !== null && product.stock_quantity <= (product.low_stock_threshold ?? 5)
        ? 'low'
        : 'ok'
    : null;

  const stockBorderColor = stockLevel === 'out'
    ? 'border-l-red-500'
    : stockLevel === 'low'
      ? 'border-l-amber-500'
      : '';

  return (
    <Card className={`
      h-full relative group overflow-hidden
      transition-all duration-300 ease-out
      hover:shadow-xl hover:-translate-y-1
      border border-border/60
      ${isDragMode ? 'cursor-grab active:cursor-grabbing' : ''}
      ${isSelected ? 'ring-2 ring-primary shadow-lg shadow-primary/10' : ''}
      ${stockBorderColor ? `border-l-[3px] ${stockBorderColor}` : ''}
    `}>
      <CardContent className="p-0 relative">
        {/* Selection Checkbox */}
        {!isDragMode && (
          <div className="absolute top-2 left-2 z-20">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectProduct(product.id, checked as boolean)}
              className="bg-background/95 backdrop-blur-sm border-2 shadow-sm h-4 w-4 md:h-5 md:w-5"
            />
          </div>
        )}

        {/* Drag Handle */}
        {isDragMode && (
          <div className="absolute top-2 right-2 z-20 bg-primary/90 backdrop-blur-sm rounded-md p-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        )}

        {/* Context Menu */}
        {!isDragMode && (
          <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/90 backdrop-blur-sm shadow-sm hover:bg-background">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link to={`/dashboard/products/${product.id}/edit`} className="flex items-center gap-2">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Link>
                </DropdownMenuItem>
                {onQuickEdit && (
                  <DropdownMenuItem onClick={() => onQuickEdit(product)} className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5" />
                    Edição Rápida
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(product)} className="flex items-center gap-2">
                    <Copy className="h-3.5 w-3.5" />
                    Duplicar
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={() => onDelete(product)} className="flex items-center gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Image */}
        <Link to={`/dashboard/products/${product.id}/edit`} className={isDragMode ? 'pointer-events-none' : ''}>
          <div className="aspect-square relative overflow-hidden bg-white">
            {product.featured_image_url ? (
              <img
                src={product.featured_image_url}
                alt={product.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/30">
                <span className="text-muted-foreground text-xs">Sem imagem</span>
              </div>
            )}

            {/* Overlay badges - top */}
            <div className="absolute top-2 left-8 md:left-9 flex flex-wrap gap-1">
              {(hasDiscount && discountPercentage || (isTieredPricing && firstTierPrices?.discountPercentage)) && (
                <Badge className="bg-sky-500 hover:bg-sky-600 text-white border-0 text-[10px] px-1.5 py-0 font-semibold shadow-sm">
                  -{firstTierPrices?.discountPercentage || discountPercentage}%
                </Badge>
              )}
              {product.status === 'vendido' && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shadow-sm">Vendido</Badge>
              )}
              {product.status === 'reservado' && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shadow-sm">Reservado</Badge>
              )}
            </div>

            {/* Trending badge */}
            {analytics?.trending && (
              <div className="absolute bottom-2 left-2">
                <Badge className="bg-sky-500/80 hover:bg-sky-500 text-white border-0 text-[10px] px-1.5 py-0 font-medium shadow-sm gap-0.5">
                  <TrendingUp className="h-2.5 w-2.5" />
                  Tendência
                </Badge>
              </div>
            )}

            {/* Stock badge */}
            {inventoryEnabled && product.track_inventory && (
              <div className="absolute bottom-2 right-2">
                <StockEditPopover
                  productId={product.id}
                  stockQuantity={product.stock_quantity ?? null}
                  lowStockThreshold={product.low_stock_threshold ?? 5}
                  trackInventory={product.track_inventory}
                  onStockUpdated={() => {}}
                />
              </div>
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="p-2.5 md:p-3 space-y-1.5">
          {/* Tags */}
          {productTags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {productTags.slice(0, 2).map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0 rounded-full text-[9px] md:text-[10px] font-medium text-white leading-relaxed"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {productTags.length > 2 && (
                <span className="text-[9px] text-muted-foreground">+{productTags.length - 2}</span>
              )}
            </div>
          )}

          {/* Title */}
          <Link to={`/dashboard/products/${product.id}/edit`} className={isDragMode ? 'pointer-events-none' : ''}>
            <h3 className="font-semibold text-[11px] md:text-xs leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
              {product.title}
            </h3>
          </Link>

          {/* Price */}
          <div className="space-y-0.5">
            {loadingTiers && product.has_tiered_pricing ? (
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            ) : isTieredPricing && firstTierPrices?.hasPromotionalPricing ? (
              <>
                <div className="text-[10px] text-muted-foreground line-through">
                  {formatCurrencyI18n(firstTierPrices.unitPrice, user?.currency || 'BRL', user?.language || 'pt-BR')}
                </div>
                <div className="text-xs md:text-sm font-bold text-primary">
                  {formatCurrencyI18n(firstTierPrices.discountedPrice, user?.currency || 'BRL', user?.language || 'pt-BR')}
                </div>
              </>
            ) : isTieredPricing ? (
              <>
                {hasDiscount && originalPrice && originalPrice > 0 && (
                  <div className="text-[10px] text-muted-foreground line-through">
                    {formatCurrencyI18n(originalPrice, user?.currency || 'BRL', user?.language || 'pt-BR')}
                  </div>
                )}
                <div className="text-xs md:text-sm font-bold text-primary">
                  a partir de {formatCurrencyI18n(minimumTieredPrice!, user?.currency || 'BRL', user?.language || 'pt-BR')}
                </div>
              </>
            ) : hasDiscount ? (
              <>
                <div className="text-[10px] text-muted-foreground line-through">
                  {product.is_starting_price ? 'A partir de ' : ''}
                  {formatCurrencyI18n(originalPrice!, user?.currency || 'BRL', user?.language || 'pt-BR')}
                </div>
                <div className="text-xs md:text-sm font-bold text-primary">
                  {product.is_starting_price ? 'A partir de ' : ''}
                  {formatCurrencyI18n(displayPrice!, user?.currency || 'BRL', user?.language || 'pt-BR')}
                </div>
              </>
            ) : displayPrice && displayPrice > 0 ? (
              <div className="text-xs md:text-sm font-bold text-primary">
                {product.is_starting_price ? 'A partir de ' : ''}
                {formatCurrencyI18n(displayPrice!, user?.currency || 'BRL', user?.language || 'pt-BR')}
              </div>
            ) : null}
          </div>

          {/* Analytics bar */}
          {analytics && (analytics.views_count > 0 || analytics.leads_count > 0) && (
            <div className="flex items-center gap-2.5 pt-1 text-muted-foreground">
              <span className="flex items-center gap-0.5 text-[10px]">
                <Eye className="h-3 w-3" />
                {analytics.views_count}
              </span>
              {analytics.leads_count > 0 && (
                <span className="flex items-center gap-0.5 text-[10px]">
                  <MessageCircle className="h-3 w-3" />
                  {analytics.leads_count}
                </span>
              )}
              <MiniSparkline data={analytics.weekly_views} />
            </div>
          )}

          {/* Footer with visibility toggle */}
          <div className={`flex items-center justify-between pt-1.5 border-t border-border/50 ${isDragMode ? 'pointer-events-none opacity-50' : ''}`}>
            <div className="flex items-center gap-1">
              {product.is_visible_on_storefront ? (
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 text-[9px] md:text-[10px] px-1.5 py-0 font-medium">
                  <CheckSquare className="h-2.5 w-2.5 mr-0.5" />
                  Visível
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[9px] md:text-[10px] px-1.5 py-0 font-medium border-0 bg-muted">
                  <Square className="h-2.5 w-2.5 mr-0.5" />
                  Oculto
                </Badge>
              )}
            </div>
            <Switch
              checked={product.is_visible_on_storefront ?? true}
              onCheckedChange={() => onToggleVisibility(product.id, product.is_visible_on_storefront ?? true)}
              disabled={updatingProductId === product.id || isDragMode}
              size="sm"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export function ProductGrid({
  products,
  productsByCategory = {},
  isDragMode,
  reordering,
  bulkActionLoading,
  selectedProducts,
  updatingProductId,
  user,
  inventoryEnabled = false,
  onSelectProduct,
  onToggleVisibility,
  onDragEnd,
  onSaveOrder,
  onCancelReorder,
  onStockUpdated,
  onQuickEdit,
  onDuplicate,
  onDelete,
  getProductAnalytics,
  getProductTags,
}: ProductGridProps) {
  if (isDragMode) {
    return (
      <EnhancedProductGrid
        products={products}
        isDragMode={isDragMode}
        onDragEnd={onDragEnd}
        onSaveOrder={onSaveOrder || (() => Promise.resolve())}
        onCancelReorder={onCancelReorder || (() => {})}
        user={user}
        reordering={reordering}
      />
    );
  }

  const displayedProducts = Object.keys(productsByCategory).length > 0
    ? Object.values(productsByCategory).flat()
    : products;

  if (displayedProducts.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <h2 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h2>
          <p className="text-muted-foreground mb-4">Tente ajustar os filtros ou termo de busca</p>
        </CardContent>
      </Card>
    );
  }

  const renderProductCard = (product: Product) => (
    <ProductCardComponent
      key={product.id}
      product={product}
      isDragMode={false}
      isSelected={selectedProducts.has(product.id)}
      updatingProductId={updatingProductId}
      user={user}
      inventoryEnabled={inventoryEnabled}
      analytics={getProductAnalytics ? getProductAnalytics(product.id) : null}
      productTags={getProductTags ? getProductTags(product.id) : []}
      onSelectProduct={onSelectProduct}
      onToggleVisibility={onToggleVisibility}
      onQuickEdit={onQuickEdit}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
    />
  );

  return (
    <>
      {Object.keys(productsByCategory).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(productsByCategory).map(([categoryName, categoryProducts]) => (
            <div key={categoryName} className="space-y-3">
              <div className="px-1">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  {categoryName}
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {categoryProducts.length}
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
                {categoryProducts.map(renderProductCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
          {displayedProducts.map(renderProductCard)}
        </div>
      )}

      {(reordering || bulkActionLoading) && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl p-4 flex items-center gap-3 shadow-2xl border">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {reordering ? 'Atualizando ordem...' : 'Processando...'}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
