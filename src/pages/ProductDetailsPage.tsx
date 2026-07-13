import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, ArrowLeft, Loader, Package, ShoppingCart, MessageCircle, TriangleAlert as AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getColorValue } from '@/lib/utils';
import { loadTrackingSettings, injectMetaPixel, injectGoogleAnalytics, trackView } from '@/lib/tracking';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { useTranslation, getPageTitle, formatCurrencyI18n, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';
import { updateMetaTags, updateFavicon, getProductMetaTags, resetMetaTags } from '@/utils/metaTags';
import ImageGallery from '@/components/details/ImageGallery';
import ItemDescription from '@/components/details/ItemDescription';
import ContactSidebar from '@/components/details/ContactSidebar';
import TieredPricingTable from '@/components/details/TieredPricingTable';
import TieredPricingSkeleton from '@/components/details/TieredPricingSkeleton';
import { useTieredPricing } from '@/hooks/useTieredPricing';
import { useCart } from '@/contexts/CartContext';
import CartModal from '@/components/corretor/CartModal';
import ProductVariantModal from '@/components/product/ProductVariantModal';
import { getStockStatus } from '@/lib/stockUtils';
import { getAvailableVariantStock } from '@/lib/stockReservationService';
import { useInventoryEnabledForStore } from '@/hooks/useInventoryEnabled';
import { useCheckoutSettingsForStore } from '@/hooks/useCheckoutSettings';
import { StorefrontThemeProvider } from '@/contexts/StorefrontThemeContext';
import type { ProductVariantStock } from '@/types';

interface ProductDetailsPageProps {
  customDomainSlug?: string;
}

export default function ProductDetailsPage({ customDomainSlug }: ProductDetailsPageProps = {}) {
  const { slug: paramSlug, productId } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedColor = searchParams.get('cor');
  const slug = customDomainSlug || paramSlug;
  const [product, setProduct] = useState<any | null>(null);
  const [corretor, setCorretor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareSupported, setShareSupported] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const { theme } = useTheme();
  const [language, setLanguage] = useState<SupportedLanguage>('pt-BR');
  const [currency, setCurrency] = useState<SupportedCurrency>('BRL');
  const { t } = useTranslation(language);
  const { addToCart, getItemQuantity, cart } = useCart();
  const [showCart, setShowCart] = useState(false);

  const { inventoryEnabled, showStockOnStorefront, blockZeroStock } = useInventoryEnabledForStore(corretor?.id);
  const { settings: checkoutSettings } = useCheckoutSettingsForStore(corretor?.id);
  const cartEnabled = checkoutSettings.cartEnabled;
  const [variantStockData, setVariantStockData] = useState<Array<{ id: string; color: string | null; size: string | null; flavor: string | null; weight_variant_id: string | null; quantity: number; reserved_quantity: number; available: number }>>([]);

  const { tiers: priceTiers, loading: loadingTiers } = useTieredPricing(
    product?.id,
    product?.price || 0,
    product?.discounted_price,
    product?.has_tiered_pricing
  );

  useEffect(() => {
    if (product?.id && inventoryEnabled && product.track_inventory) {
      getAvailableVariantStock(product.id).then(setVariantStockData);
    }
  }, [product?.id, inventoryEnabled, product?.track_inventory]);

  useEffect(() => {
    setShareSupported(!!navigator.share && window.isSecureContext);

    const fetchProductDetails = async () => {
      try {
        if (!productId) {
          setError("ID do produto não encontrado");
          return;
        }

        // Fetch product details with images ordered by is_featured (featured first)
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select(`
            *,
            product_images (
              id,
              url,
              is_featured,
              media_type,
              display_order,
              associated_color
            )
          `)
          .eq('id', productId)
          .order('is_featured', { referencedTable: 'product_images', ascending: false })
          .order('display_order', { referencedTable: 'product_images', ascending: true })
          .single();

        if (productError) throw productError;
        if (!productData) {
          setError("Produto não encontrado");
          return;
        }

        // Debug: Log the raw product data from database
        console.log('🔍 RAW PRODUCT DATA FROM DATABASE:', {
          id: productData.id,
          title: productData.title,
          colors: productData.colors,
          sizes: productData.sizes,
          colorsType: typeof productData.colors,
          sizesType: typeof productData.sizes,
          allKeys: Object.keys(productData)
        });
        setProduct(productData);

        // Fetch corretor details
        const { data: corretorData, error: corretorError } = await supabase
          .from('users')
          .select('*')
          .eq('id', productData.user_id)
          .single();

        if (corretorError) throw corretorError;
        setCorretor(corretorData);

        // Update meta tags for social media previews
        const currentLanguage = corretorData.language || 'pt-BR';
        const metaConfig = getProductMetaTags(productData, corretorData, currentLanguage, !!customDomainSlug);
        updateMetaTags(metaConfig);
        
        // Update favicon to product image or user's avatar
        const faviconUrl = productData.featured_image_url || corretorData.avatar_url || 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png.png';
        updateFavicon(faviconUrl);
        
        // Set language and currency from corretor settings
        setLanguage(currentLanguage);
        setCurrency(corretorData.currency || 'BRL');

        // Apply corretor's theme settings
        if (corretorData) {
          // Set theme based on broker's preference
          if (corretorData.theme) {
            document.documentElement.className = corretorData.theme;
          }

          // Load tracking settings
          const trackingSettings = await loadTrackingSettings(corretorData.id);
          
          if (trackingSettings?.meta_pixel_id) {
            injectMetaPixel(trackingSettings.meta_pixel_id);
          }
          
          if (trackingSettings?.ga_measurement_id) {
            injectGoogleAnalytics(trackingSettings.ga_measurement_id);
          }
        }

        // Track product view - this is crucial for the stats
        console.log('Tracking view for product:', productId);
        const viewTracked = await trackView(productId, 'product');
        if (!viewTracked) {
          console.error('Failed to track product view');
        }

      } catch (err) {
        console.error('Error fetching product details:', err);
        setError("Erro ao carregar os dados do produto");
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();

    // Cleanup function
    return () => {
      try {
        // Reset meta tags to default when leaving the product details page
        resetMetaTags();
        // Clean up theme classes when leaving the product details page
        document.documentElement.classList.remove('light', 'dark');
      } catch (e) {
        console.error('Error cleaning up styles:', e);
      }
    };
  }, [productId]);

  const handleShareClick = async () => {
    const shareUrl = window.location.href;
    const shareTitle = product?.title || 'Produto';
    const shareText = `Confira este produto: ${product?.title}`;

    try {
      if (shareSupported) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        toast.success('Compartilhado com sucesso!');
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t('messages.link_copied'));
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success(t('messages.link_copied'));
        } catch (err) {
          toast.error(t('messages.share_failed'));
        }
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'vendido':
        return <Badge variant="destructive" className="bg-destructive/90 backdrop-blur-sm">{t('status.sold')}</Badge>;
      case 'reservado':
        return <Badge variant="destructive" className="bg-destructive/90 backdrop-blur-sm">{t('status.reserved')}</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !product || !corretor) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">
          {error || "Erro ao carregar os dados do produto"}
        </p>
        <Button asChild>
         <Link to={customDomainSlug ? "/" : (slug ? `/${slug}` : "/")}>{t('header.back_to_storefront')}</Link>
        </Button>
      </div>
    );
  }

  // Create array of images, ensuring no duplicates
  const galleryMedia = [];

  // Add all images from product_images table
  if (product.product_images?.length) {
    product.product_images.forEach((img: any) => {
      galleryMedia.push({
        id: img.id,
        url: img.url,
        is_featured: img.is_featured,
        media_type: img.media_type || 'image',
        associated_color: img.associated_color || null,
      });
    });
  }

  // If a color is preselected via query param, move its image to the front
  if (preselectedColor && galleryMedia.length > 0) {
    const colorImageIndex = galleryMedia.findIndex(
      (img) => img.associated_color === preselectedColor
    );
    if (colorImageIndex > 0) {
      const [colorImage] = galleryMedia.splice(colorImageIndex, 1);
      galleryMedia.unshift(colorImage);
    }
  }

  // Fallback to default image if no images at all
  if (galleryMedia.length === 0) {
    galleryMedia.push({
      id: 'default',
      url: "https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg",
      is_featured: true,
      media_type: 'image' as const,
      associated_color: null,
    });
  }

  // Determinar preços e desconto
  const hasDiscount = product.discounted_price && product.discounted_price < product.price;

  // Check if we should use tiered pricing minimum price
  const minimumTieredPrice = priceTiers.length > 0 && product.has_tiered_pricing
    ? Math.min(...priceTiers.map(tier => tier.discounted_unit_price || tier.unit_price))
    : null;

  const isTieredPricing = product.has_tiered_pricing && minimumTieredPrice && minimumTieredPrice > 0;
  const displayPrice = isTieredPricing ? minimumTieredPrice : (hasDiscount ? product.discounted_price : product.price);
  const originalPrice = hasDiscount ? product.price : null;
  const discountPercentage = hasDiscount
    ? Math.round(((product.price - product.discounted_price) / product.price) * 100)
    : null;

  const hasWeightVariants = !!product.has_weight_variants && (product.min_variant_price ?? 0) > 0;

  const isAvailable = product.status === 'disponivel';
  const hasPrice = (product.price && product.price > 0) || (product.has_tiered_pricing && priceTiers.length > 0) || hasWeightVariants;

  const stockStatus = inventoryEnabled ? getStockStatus({
    track_inventory: product.track_inventory,
    stock_quantity: product.stock_quantity,
    low_stock_threshold: product.low_stock_threshold,
  }) : 'untracked';
  const isOutOfStock = stockStatus === 'out_of_stock';

  // Check if product has color or size options
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

  const handleAddToCart = () => {
    if (!isAvailable || !hasPrice) return;

    if (blockZeroStock && isOutOfStock) {
      toast.error('Este produto está esgotado');
      return;
    }

    // If product has options, tiered pricing, or weight variants, show variant modal
    if (hasOptions || product.has_tiered_pricing || hasWeightVariants) {
      setShowVariantModal(true);
      return;
    }

    // For simple products without options, tiered pricing, or weight variants, add directly to cart
    addToCart(product);
  };

  const isPaidPlan = corretor?.plan_status !== 'free';

  return (
    <StorefrontThemeProvider userId={corretor?.id} isPaidPlan={isPaidPlan}>
      <div className="flex-1">
        {/* Back button */}
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            asChild
            className="pl-0 hover:pl-1 transition-all"
            onClick={() => console.log('Back button clicked - returning to storefront')}
          >
            <Link to={customDomainSlug ? "/" : `/${slug}`} state={{ from: 'product-detail' }} className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('header.back_to_storefront')}
            </Link>
        </Button>
      </div>

      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-start gap-8">
            <motion.div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-2 mb-3">
                    {product.category && product.category.length > 0 && (
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm border-primary/20">
                        {product.category[0]}
                      </Badge>
                    )}
                    {hasDiscount && discountPercentage && (
                      <Badge className="bg-green-600 hover:bg-green-700 text-white border-transparent">
                        -{discountPercentage}% OFF
                      </Badge>
                    )}
                    {product.status !== 'disponivel' && getStatusBadge(product.status)}
                    {stockStatus === 'out_of_stock' && (
                      <Badge className="bg-red-600 hover:bg-red-700 text-white border-transparent">
                        Esgotado
                      </Badge>
                    )}
                    {stockStatus === 'low_stock' && (
                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-transparent gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Ultimas unidades
                      </Badge>
                    )}
                    {stockStatus === 'in_stock' && showStockOnStorefront && (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-transparent">
                        Em estoque
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold">{product.title}</h1>
                </div>

                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleShareClick}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Price information */}
              <div className="mt-6 mb-8">
                {hasWeightVariants ? (
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-primary">
                      {t('product.starting_from')} {formatCurrencyI18n(product.min_variant_price!, currency, language)}
                    </div>
                    {product.short_description && (
                      <div className="text-sm text-green-600 font-medium">
                        {product.short_description}
                      </div>
                    )}
                  </div>
                ) : loadingTiers && product.has_tiered_pricing ? (
                  <div className="text-lg font-bold text-muted-foreground animate-pulse">
                    Carregando preços...
                  </div>
                ) : isTieredPricing ? (
                  <div className="space-y-2">
                    {hasDiscount && originalPrice && originalPrice > 0 && (
                      <div className="text-lg text-muted-foreground line-through">
                        {formatCurrencyI18n(originalPrice, currency, language)}
                      </div>
                    )}
                    <div className="text-3xl font-bold text-primary">
                      {t('product.starting_from')} {formatCurrencyI18n(minimumTieredPrice!, currency, language)}
                    </div>
                    {product.short_description && (
                      <div className="text-sm text-green-600 font-medium">
                        {product.short_description}
                      </div>
                    )}
                  </div>
                ) : hasDiscount ? (
                  <div className="space-y-2">
                    {/* Original price with strikethrough */}
                    <div className="text-lg text-muted-foreground line-through">
                      {product.is_starting_price ? t('product.starting_from') + ' ' : ''}
                      {formatCurrencyI18n(originalPrice!, currency, language)}
                    </div>
                    {/* Discounted price */}
                    <div className="text-3xl font-bold text-primary">
                      {product.is_starting_price ? t('product.starting_from') + ' ' : ''}
                      {formatCurrencyI18n(displayPrice!, currency, language)}
                    </div>
                    {/* Promotional message instead of savings */}
                    {product.short_description && (
                      <div className="text-sm text-green-600 font-medium">
                        {product.short_description}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-primary">
                      {product.is_starting_price ? t('product.starting_from') + ' ' : ''}
                      {formatCurrencyI18n(displayPrice!, currency, language)}
                    </div>
                    {/* Promotional message for non-discounted products */}
                    {product.short_description && (
                      <div className="text-sm text-green-600 font-medium">
                        {product.short_description}
                      </div>
                    )}
                  </div>
                )}

                {/* Featured Offer */}
                {product.featured_offer_price && product.featured_offer_installment && (
                  <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-primary mb-2">
                      {t('product.special_offer')}
                    </h3>
                    <div className="space-y-2">
                      <p className="text-lg">
                        {t('product.down_payment')} {formatCurrencyI18n(product.featured_offer_price, currency, language)}
                      </p>
                      <p className="text-lg">
                        {t('product.installments')} {formatCurrencyI18n(product.featured_offer_installment, currency, language)}
                      </p>
                      {product.featured_offer_description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {product.featured_offer_description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Photo Gallery */}
              <ImageGallery
                media={galleryMedia}
                title={product.title}
              />

              {/* Tiered Pricing Table - Moved right after gallery */}
              {product.has_tiered_pricing && (
                <div className="mt-8">
                  {loadingTiers ? (
                    <TieredPricingSkeleton />
                  ) : priceTiers.length > 0 && (
                    <TieredPricingTable
                      tiers={priceTiers}
                      basePrice={product.price || 0}
                      baseDiscountedPrice={product.discounted_price}
                      currency={currency}
                      language={language}
                    />
                  )}
                </div>
              )}

              {/* Product Variants Display */}
              {hasOptions && (
                <div className="mt-8 space-y-6">
                  {/* Available Colors */}
                  {hasColors && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">Cores Disponíveis</h3>
                      <div className="flex flex-wrap gap-3">
                        {product.colors.map((color: string) => {
                          const colorValue = getColorValue(color);
                          const isLightColor = ['branco', 'amarelo', 'bege', 'off-white', 'creme'].includes(color.toLowerCase());

                          return (
                            <div
                              key={color}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card"
                            >
                              <div
                                className={`w-4 h-4 rounded-full border ${isLightColor ? 'border-border' : 'border-border/60'} shadow-sm`}
                                style={{ backgroundColor: colorValue }}
                              />
                              <span className="text-sm capitalize text-foreground">{color}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Available Sizes */}
                  {hasSizes && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-foreground">Tamanhos Disponíveis</h3>

                      {(() => {
                        // Separate apparel sizes from shoe sizes
                        const apparelSizes: string[] = [];
                        const shoeSizes: string[] = [];

                        product.sizes.forEach((size: string) => {
                          const numericSize = parseInt(size);
                          if (!isNaN(numericSize) && numericSize >= 17 && numericSize <= 43) {
                            shoeSizes.push(size);
                          } else {
                            apparelSizes.push(size);
                          }
                        });

                        // Sort sizes appropriately
                        const sortedApparelSizes = apparelSizes.sort((a, b) => {
                          const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
                          const indexA = sizeOrder.indexOf(a);
                          const indexB = sizeOrder.indexOf(b);
                          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                          if (indexA !== -1) return -1;
                          if (indexB !== -1) return 1;
                          return a.localeCompare(b);
                        });

                        const sortedShoeSizes = shoeSizes.sort((a, b) => parseInt(a) - parseInt(b));

                        return (
                          <div className="space-y-4">
                            {/* Apparel Sizes */}
                            {sortedApparelSizes.length > 0 && (
                              <div className="flex flex-wrap gap-3">
                                  {sortedApparelSizes.map((size: string) => (
                                    <div
                                      key={size}
                                      className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 hover:border-border/80"
                                    >
                                      <span className="text-sm font-semibold text-foreground">
                                        {size}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                            )}

                            {/* Shoe Sizes */}
                            {sortedShoeSizes.length > 0 && (
                              <div className="flex flex-wrap gap-3">
                                  {sortedShoeSizes.map((size: string) => (
                                    <div
                                      key={size}
                                      className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 hover:border-border/80"
                                    >
                                      <span className="text-sm font-semibold text-foreground">
                                        {size}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Available Flavors */}
                  {hasFlavors && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold">Sabores Disponíveis</h3>
                      <div className="flex flex-wrap gap-3">
                        {product.flavors.map((flavor: string) => (
                          <div
                            key={flavor}
                            className="flex items-center px-4 py-2 rounded-full border-2 border-primary/20 bg-background shadow-sm hover:shadow-md transition-all duration-200 hover:border-primary/40"
                          >
                            <span className="text-sm font-semibold text-foreground capitalize">
                              {flavor}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}


              {/* External Checkout Button - Always show if configured */}
              {isAvailable && product.external_checkout_url && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
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


              {/* Send Button */}
              {cartEnabled && isAvailable && hasPrice && !isOutOfStock && (
                <div className="mt-8">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {totalInCart > 0 ? `No Carrinho (${totalInCart})` : 'Adicionar ao carrinho'}
                  </Button>
                </div>
              )}

              {isOutOfStock && corretor && (
                <div className="mt-8">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full gap-2"
                    asChild
                  >
                    <a
                      href={`https://wa.me/${corretor.country_code || '55'}${corretor.whatsapp}?text=${encodeURIComponent(`Olá, gostaria de saber sobre a disponibilidade do produto: ${product.title}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-5 w-5" />
                      Consultar disponibilidade
                    </a>
                  </Button>
                </div>
              )}

              {showStockOnStorefront && stockStatus === 'in_stock' && product.stock_quantity != null && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {product.stock_quantity} {product.stock_quantity === 1 ? 'unidade disponivel' : 'unidades disponiveis'}
                </p>
              )}

              {/* Description */}
              <div className="mt-8">
                <ItemDescription description={product.description} isRichText={true} />
              </div>
            </motion.div>
            
            {/* Seller Information Sidebar */}
            <motion.div 
              className="w-full md:w-80 lg:w-96"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <ContactSidebar
                corretor={corretor}
                itemId={product.id}
                itemTitle={product.title}
                itemType="produto"
                createdAt={product.created_at}
                itemImageUrl={product.featured_image_url}
                itemPrice={product.discounted_price || product.price}
                language={language}
              />
            </motion.div>
          </div>
        </div>
      </section>

        {/* Variant Selection Modal */}
        <ProductVariantModal
          open={showVariantModal}
          onOpenChange={setShowVariantModal}
          product={product}
          currency={currency}
          language={language}
          variantStockData={variantStockData}
          inventoryEnabled={inventoryEnabled}
          blockZeroStock={blockZeroStock}
          showStockOnStorefront={showStockOnStorefront}
        />

        {/* Floating Cart Button */}
        <AnimatePresence>
          {cartEnabled && cart.itemCount > 0 && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              onClick={() => setShowCart(true)}
              className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
            >
              <ShoppingCart className="h-6 w-6" />
              <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground">
                {cart.itemCount}
              </Badge>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Cart Modal */}
        {cartEnabled && (
          <CartModal
            open={showCart}
            onOpenChange={setShowCart}
            corretor={corretor}
            currency={currency}
            language={language}
          />
        )}
      </div>
    </StorefrontThemeProvider>
  );
}
