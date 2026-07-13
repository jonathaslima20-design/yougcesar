import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyI18n, useTranslation, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';
import { useCart } from '@/contexts/CartContext';
import { useCustomDomain } from '@/contexts/CustomDomainContext';
import ProductVariantModal from './ProductVariantModal';
import type { Product } from '@/types';
import { fetchProductPriceTiers, getMinimumPriceFromTiers, getFirstTierPrices } from '@/lib/tieredPricingUtils';
import { supabase } from '@/lib/supabase';
import { getStockStatus } from '@/lib/stockUtils';

interface ProductCardProps {
  product: Product;
  corretorSlug: string;
  currency?: SupportedCurrency;
  language?: SupportedLanguage;
  inventoryEnabled?: boolean;
  showStockOnStorefront?: boolean;
  cartEnabled?: boolean;
  onNavigate?: () => void;
}

function ProductCardComponent({
  product,
  corretorSlug,
  currency = 'BRL',
  language = 'pt-BR',
  inventoryEnabled = false,
  showStockOnStorefront = false,
  cartEnabled = true,
  onNavigate
}: ProductCardProps) {
  const { t } = useTranslation(language);
  const { addToCart, isInCart, getItemQuantity } = useCart();
  const { isCustomDomain } = useCustomDomain();
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [minimumTieredPrice, setMinimumTieredPrice] = useState<number | null>(null);
  const [firstTierPrices, setFirstTierPrices] = useState<any>(null);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(product.featured_image_url || null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (product.has_tiered_pricing) {
      setLoadingTiers(true);
      fetchProductPriceTiers(product.id)
        .then(tiers => {
          const minPrice = getMinimumPriceFromTiers(tiers);
          const firstTierData = getFirstTierPrices(tiers);
          setMinimumTieredPrice(minPrice);
          setFirstTierPrices(firstTierData);
        })
        .catch(err => console.error('Error loading price tiers:', err))
        .finally(() => setLoadingTiers(false));
    }
  }, [product.id, product.has_tiered_pricing]);

  useEffect(() => {
    const ensureFeaturedImage = async () => {
      if (!displayImageUrl) {
        const { data, error } = await supabase
          .from('product_images')
          .select('url')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          setDisplayImageUrl(data.url);
        }
      }
    };

    ensureFeaturedImage();
  }, [product.id, displayImageUrl]);

  // Calculate discount information
  const effectiveMinPrice = product.has_tiered_pricing && minimumTieredPrice && minimumTieredPrice > 0 ? minimumTieredPrice : null;
  const hasDiscount = product.discounted_price && product.discounted_price < product.price;
  const baseDisplayPrice = hasDiscount ? product.discounted_price : product.price;
  const displayPrice = effectiveMinPrice !== null ? effectiveMinPrice : baseDisplayPrice;
  const originalPrice = hasDiscount ? product.price : null;
  const discountPercentage = hasDiscount && product.price > 0
    ? Math.round(((product.price - product.discounted_price!) / product.price) * 100)
    : null;
  const isTieredPricing = product.has_tiered_pricing && effectiveMinPrice !== null && effectiveMinPrice > 0;

  const hasWeightVariants = !!product.has_weight_variants && (product.min_variant_price ?? 0) > 0;
  const weightVariantMinPrice = hasWeightVariants ? Number(product.min_variant_price) : null;

  const isAvailable = product.status === 'disponivel';
  const stockStatus = inventoryEnabled ? getStockStatus(product) : 'untracked';
  const isOutOfStock = stockStatus === 'out_of_stock';
  const hasPrice = (displayPrice && displayPrice > 0) || (product.has_tiered_pricing && minimumTieredPrice && minimumTieredPrice > 0) || hasWeightVariants;
  
  // More robust checking for colors and sizes with debug logging
  const hasColors = product.colors && 
                   Array.isArray(product.colors) && 
                   product.colors.length > 0 &&
                   product.colors.some(color => color && color.trim().length > 0);
                   
  const hasSizes = product.sizes &&
                  Array.isArray(product.sizes) &&
                  product.sizes.length > 0 &&
                  product.sizes.some(size => size && size.trim().length > 0);

  const hasFlavors = product.flavors &&
                    Array.isArray(product.flavors) &&
                    product.flavors.length > 0 &&
                    product.flavors.some(flavor => flavor && flavor.trim().length > 0);

  const hasOptions = hasColors || hasSizes || hasFlavors;
  
  const totalInCart = getItemQuantity(product.id);

  // Debug logging for troubleshooting
  if (process.env.NODE_ENV === 'development') {
    console.log('🛒 ProductCard - Product data:', {
      id: product.id,
      title: product.title,
      colors: product.colors,
      sizes: product.sizes,
      hasColors,
      hasSizes,
      hasOptions
    });
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If product has options (colors/sizes) OR tiered pricing, show variant modal
    if (isAvailable && hasPrice && (hasOptions || product.has_tiered_pricing || hasWeightVariants)) {
      setShowVariantModal(true);
      return;
    }

    // For simple products without options or tiered pricing, add directly to cart
    if (isAvailable && hasPrice && !hasOptions && !product.has_tiered_pricing && !hasWeightVariants) {
      addToCart(product);
      return;
    }

    // Don't do anything for products without price or not available
    if (!hasPrice) {
      return;
    }

    if (!isAvailable) {
      return;
    }
  };

  const handleProductClick = (e: React.MouseEvent) => {
    const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
    console.log('📌 ProductCard clicked - saving scroll position:', currentScrollPosition);
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link
        to={isCustomDomain ? `/produtos/${product.id}` : `/${corretorSlug}/produtos/${product.id}`}
        state={{ from: 'product-detail' }}
        onClick={handleProductClick}
        className="block h-full"
      >
        <div className="rounded-xl border bg-card text-card-foreground shadow overflow-hidden h-full flex flex-col hover:shadow-lg transition-all duration-300 cursor-pointer">
          {/* Image Container */}
          <div className="relative aspect-square overflow-hidden p-2 md:p-3">
            <div className="w-full h-full bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              <div className="relative w-full h-full">
                <img
                  src={displayImageUrl || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg'}
                  alt={product.title}
                  className={`w-full h-full object-cover transition-opacity duration-500 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    setImageError(true);
                    setImageLoaded(true);
                  }}
                  decoding="async"
                  srcSet={`
                    ${displayImageUrl || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg'} 1x,
                    ${displayImageUrl || 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg'} 2x
                  `}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  style={{
                    backgroundColor: '#ffffff',
                    backgroundImage: imageLoaded || imageError ? 'none' : 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                    backgroundSize: '200% 100%',
                    animation: imageLoaded || imageError ? 'none' : 'shimmer 2s infinite'
                  }}
                />
                {!imageLoaded && !imageError && (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                )}
              </div>
            </div>
            
            {/* Badges - Top Right */}
            <div className="absolute top-3 right-3 md:top-5 md:right-5 flex flex-col gap-1.5">
              {(hasDiscount && discountPercentage || (isTieredPricing && firstTierPrices?.discountPercentage)) && (
                <Badge className="bg-green-600 hover:bg-green-700 text-white border-transparent text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1">
                  -{firstTierPrices?.discountPercentage || discountPercentage}%
                </Badge>
              )}
              {stockStatus === 'out_of_stock' && (
                <Badge className="bg-red-600 hover:bg-red-700 text-white border-transparent text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1">
                  Esgotado
                </Badge>
              )}
              {stockStatus === 'low_stock' && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-transparent text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1">
                  Últimas unidades
                </Badge>
              )}
              {stockStatus === 'in_stock' && showStockOnStorefront && (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1">
                  Em estoque
                </Badge>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="p-2 md:p-4 flex-1 flex flex-col">
            <h3 className="font-semibold text-xs md:text-sm leading-tight mb-2 md:mb-3 line-clamp-2 min-h-[32px] md:h-[35px]">
              {product.title}
            </h3>
            
            <div className="mt-auto">
              {/* Price Display */}
              {hasWeightVariants && weightVariantMinPrice ? (
                <div className="text-sm md:text-lg font-bold text-primary">
                  {t('product.starting_from')} {formatCurrencyI18n(weightVariantMinPrice, currency, language)}
                </div>
              ) : loadingTiers && product.has_tiered_pricing ? (
                <div className="text-sm md:text-lg font-bold text-muted-foreground animate-pulse">
                  Carregando preços...
                </div>
              ) : isTieredPricing && firstTierPrices && firstTierPrices.hasPromotionalPricing ? (
                <div className="space-y-0.5 md:space-y-1">
                  <div className="text-[10px] md:text-xs text-muted-foreground line-through">
                    De {formatCurrencyI18n(firstTierPrices.unitPrice, currency, language)}
                  </div>
                  <div className="text-sm md:text-lg font-bold text-primary">
                    por {formatCurrencyI18n(firstTierPrices.discountedPrice, currency, language)}
                  </div>
                </div>
              ) : isTieredPricing ? (
                <div className="space-y-0.5 md:space-y-1">
                  {firstTierPrices && firstTierPrices.hasPromotionalPricing ? (
                    <div className="text-[10px] md:text-xs text-muted-foreground line-through">
                      De {formatCurrencyI18n(firstTierPrices.unitPrice, currency, language)}
                    </div>
                  ) : hasDiscount && originalPrice && originalPrice > 0 ? (
                    <div className="text-[10px] md:text-xs text-muted-foreground line-through">
                      {formatCurrencyI18n(originalPrice, currency, language)}
                    </div>
                  ) : null}
                  <div className="text-sm md:text-lg font-bold text-primary">
                    a partir de {formatCurrencyI18n(minimumTieredPrice!, currency, language)}
                  </div>
                </div>
              ) : hasDiscount && displayPrice && displayPrice > 0 ? (
                <div className="space-y-0.5 md:space-y-1">
                  <div className="text-[10px] md:text-xs text-muted-foreground line-through">
                    {formatCurrencyI18n(originalPrice!, currency, language)}
                  </div>
                  <div className="text-sm md:text-lg font-bold text-primary">
                    {product.is_starting_price ? t('product.starting_from') + ' ' : ''}
                    {formatCurrencyI18n(displayPrice!, currency, language)}
                  </div>
                </div>
              ) : displayPrice && displayPrice > 0 ? (
                <div className="text-sm md:text-lg font-bold text-primary">
                  {product.is_starting_price ? t('product.starting_from') + ' ' : ''}
                  {formatCurrencyI18n(displayPrice!, currency, language)}
                </div>
              ) : null}

              {/* Promotional Message - Below Price */}
              {product.short_description && (
                <p className="text-xs text-muted-foreground/70 mt-1.5 md:mt-2 line-clamp-2 md:line-clamp-3">
                  {product.short_description}
                </p>
              )}


              {/* Stock quantity text */}
              {stockStatus === 'in_stock' && showStockOnStorefront && product.stock_quantity != null && (
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                  {product.stock_quantity} {product.stock_quantity === 1 ? 'unidade disponível' : 'unidades disponíveis'}
                </p>
              )}

              {/* Add to Cart Button, View Details Button, or Consult Availability */}
              {isAvailable && hasPrice && !isOutOfStock && (
                <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t">
                  {cartEnabled ? (
                    <Button
                      size="sm"
                      className="w-full text-[10px] md:text-xs h-7 md:h-8"
                      onClick={handleAddToCart}
                    >
                      <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      {totalInCart > 0 ? `No Carrinho (${totalInCart})` : 'Adicionar'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full text-[10px] md:text-xs h-7 md:h-8"
                    >
                      Exibir detalhes
                    </Button>
                  )}
                </div>
              )}
              {isOutOfStock && (
                <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-[10px] md:text-xs h-7 md:h-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    Consultar disponibilidade
                  </Button>
                </div>
              )}

              {/* External Checkout Button */}
              {isAvailable && product.external_checkout_url && (
                <div className="mt-2 md:mt-3 pt-1.5 md:pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-[10px] md:text-xs h-7 md:h-8"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a 
                      href={product.external_checkout_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Comprar
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
      
      {/* Variant Selection Modal */}
      <ProductVariantModal
        open={showVariantModal}
        onOpenChange={setShowVariantModal}
        product={product}
        currency={currency}
        language={language}
      />
    </motion.div>
  );
}

const arePropsEqual = (prevProps: ProductCardProps, nextProps: ProductCardProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.title === nextProps.product.title &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.product.discounted_price === nextProps.product.discounted_price &&
    prevProps.product.featured_image_url === nextProps.product.featured_image_url &&
    prevProps.product.colors === nextProps.product.colors &&
    prevProps.product.sizes === nextProps.product.sizes &&
    prevProps.product.status === nextProps.product.status &&
    prevProps.product.has_tiered_pricing === nextProps.product.has_tiered_pricing &&
    prevProps.product.has_weight_variants === nextProps.product.has_weight_variants &&
    prevProps.product.min_variant_price === nextProps.product.min_variant_price &&
    prevProps.product.track_inventory === nextProps.product.track_inventory &&
    prevProps.product.stock_quantity === nextProps.product.stock_quantity &&
    prevProps.product.low_stock_threshold === nextProps.product.low_stock_threshold &&
    prevProps.inventoryEnabled === nextProps.inventoryEnabled &&
    prevProps.showStockOnStorefront === nextProps.showStockOnStorefront &&
    prevProps.cartEnabled === nextProps.cartEnabled &&
    prevProps.currency === nextProps.currency &&
    prevProps.language === nextProps.language &&
    prevProps.corretorSlug === nextProps.corretorSlug
  );
};

export const ProductCard = React.memo(ProductCardComponent, arePropsEqual);