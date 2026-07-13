import { Link } from 'react-router-dom';
import { Eye, MessageCircle, TrendingUp, MoveVertical as MoreVertical, Pencil, Copy, Trash2, Zap, Package } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrencyI18n } from '@/lib/i18n';
import type { Product } from '@/types';
import type { ProductAnalytics } from '@/hooks/useProductAnalytics';
import type { ProductTag } from '@/hooks/useProductTags';

interface ProductListViewProps {
  products: Product[];
  selectedProducts: Set<string>;
  updatingProductId: string | null;
  user: any;
  inventoryEnabled?: boolean;
  onSelectProduct: (productId: string, checked: boolean) => void;
  onToggleVisibility: (productId: string, currentVisibility: boolean) => Promise<void>;
  onQuickEdit?: (product: Product) => void;
  onDuplicate?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  getProductAnalytics?: (productId: string) => ProductAnalytics | null;
  getProductTags?: (productId: string) => ProductTag[];
}

export function ProductListView({
  products,
  selectedProducts,
  updatingProductId,
  user,
  inventoryEnabled = false,
  onSelectProduct,
  onToggleVisibility,
  onQuickEdit,
  onDuplicate,
  onDelete,
  getProductAnalytics,
  getProductTags,
}: ProductListViewProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Table Header - hidden on mobile */}
      <div className={`hidden md:grid ${inventoryEnabled ? 'grid-cols-[40px_56px_1fr_120px_80px_80px_100px_80px_44px]' : 'grid-cols-[40px_56px_1fr_120px_80px_80px_80px_44px]'} gap-2 px-3 py-2.5 bg-muted/50 border-b text-xs font-medium text-muted-foreground items-center`}>
        <div />
        <div />
        <div>Produto</div>
        <div>Preço</div>
        <div className="text-center">Views</div>
        <div className="text-center">Leads</div>
        {inventoryEnabled && <div className="text-center">Estoque</div>}
        <div className="text-center">Status</div>
        <div />
      </div>

      {/* Product Rows */}
      <div className="divide-y divide-border/50">
        {products.map((product) => {
          const analytics = getProductAnalytics ? getProductAnalytics(product.id) : null;
          const productTags = getProductTags ? getProductTags(product.id) : [];
          const isSelected = selectedProducts.has(product.id);
          const hasDiscount = product.discounted_price && product.discounted_price < product.price;
          const effectivePrice = hasDiscount ? product.discounted_price : product.price;

          return (
            <div
              key={product.id}
              className={`
                grid grid-cols-[40px_56px_1fr_auto] ${inventoryEnabled ? 'md:grid-cols-[40px_56px_1fr_120px_80px_80px_100px_80px_44px]' : 'md:grid-cols-[40px_56px_1fr_120px_80px_80px_80px_44px]'}
                gap-2 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors
                ${isSelected ? 'bg-primary/5' : ''}
              `}
            >
              {/* Checkbox */}
              <div className="flex justify-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectProduct(product.id, checked as boolean)}
                  className="h-4 w-4"
                />
              </div>

              {/* Image */}
              <Link to={`/dashboard/products/${product.id}/edit`} className="block">
                <div className="h-10 w-10 md:h-11 md:w-11 rounded-lg overflow-hidden bg-white border border-border/50 flex-shrink-0">
                  {product.featured_image_url ? (
                    <img
                      src={product.featured_image_url}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/30">
                      <Package className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              </Link>

              {/* Title + Tags */}
              <div className="min-w-0">
                <Link to={`/dashboard/products/${product.id}/edit`} className="block">
                  <p className="text-xs md:text-sm font-medium text-foreground truncate hover:text-primary transition-colors">
                    {product.title}
                  </p>
                </Link>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {productTags.slice(0, 3).map(tag => (
                    <span
                      key={tag.id}
                      className="inline-block px-1.5 py-0 rounded-full text-[9px] font-medium text-white leading-relaxed"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {analytics?.trending && (
                    <Badge className="bg-sky-500/10 text-sky-600 border-0 text-[9px] px-1 py-0 gap-0.5">
                      <TrendingUp className="h-2.5 w-2.5" />
                    </Badge>
                  )}
                  {/* Mobile-only: show price inline */}
                  <span className="md:hidden text-xs font-semibold text-primary ml-auto">
                    {effectivePrice ? formatCurrencyI18n(effectivePrice, user?.currency || 'BRL', user?.language || 'pt-BR') : '-'}
                  </span>
                </div>
              </div>

              {/* Price - desktop only */}
              <div className="hidden md:block">
                {hasDiscount && (
                  <span className="text-[10px] text-muted-foreground line-through block">
                    {formatCurrencyI18n(product.price, user?.currency || 'BRL', user?.language || 'pt-BR')}
                  </span>
                )}
                <span className="text-xs font-semibold text-primary">
                  {effectivePrice ? formatCurrencyI18n(effectivePrice, user?.currency || 'BRL', user?.language || 'pt-BR') : '-'}
                </span>
              </div>

              {/* Views - desktop only */}
              <div className="hidden md:flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                {analytics?.views_count || 0}
              </div>

              {/* Leads - desktop only */}
              <div className="hidden md:flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <MessageCircle className="h-3 w-3" />
                {analytics?.leads_count || 0}
              </div>

              {/* Stock - desktop only, only when inventory is enabled */}
              {inventoryEnabled && (
                <div className="hidden md:flex items-center justify-center">
                  {product.track_inventory ? (
                    <span className={`text-xs font-medium ${
                      product.stock_quantity === 0 ? 'text-red-500' :
                      (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 5) ? 'text-amber-500' :
                      'text-foreground'
                    }`}>
                      {product.stock_quantity ?? 0}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              )}

              {/* Visibility - desktop only */}
              <div className="hidden md:flex items-center justify-center">
                <Switch
                  checked={product.is_visible_on_storefront ?? true}
                  onCheckedChange={() => onToggleVisibility(product.id, product.is_visible_on_storefront ?? true)}
                  disabled={updatingProductId === product.id}
                  size="sm"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
