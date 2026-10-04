import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import type { CartItem, CartState, Product, PriceTier, VariantDistribution, DistributionItem, CartDistribution, AppliedCoupon } from '@/types';
import { fetchProductPriceTiers, calculateApplicablePrice } from '@/lib/tieredPricingUtils';
import { createDistribution, updateDistribution, deleteDistribution, fetchUserDistributions } from '@/lib/distributionUtils';
import { supabase } from '@/lib/supabase';

interface CartContextType {
  cart: CartState;
  appliedCoupon: AppliedCoupon | null;
  setAppliedCoupon: (coupon: AppliedCoupon | null) => void;
  clearAppliedCoupon: () => void;
  addToCart: (product: Product, selectedColor?: string, selectedSize?: string, quantity?: number, appliedTierPrice?: number, selectedFlavor?: string, selectedWeightVariant?: { id: string; label: string; price: number }) => boolean;
  removeFromCart: (productId: string) => void;
  removeCartVariant: (variantId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateVariantQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
  hasVariant: (productId: string, color?: string, size?: string, flavor?: string) => boolean;
  getItemQuantity: (productId: string) => number;
  getVariantQuantity: (productId: string, color?: string, size?: string, flavor?: string) => number;
  updateItemNotes: (productId: string, notes: string) => void;
  updateVariantNotes: (variantId: string, notes: string) => void;
  updateVariantOptions: (variantId: string, color?: string, size?: string, flavor?: string) => void;
  recalculateTieredPrices: () => Promise<void>;
  addDistribution: (product: Product, totalQuantity: number, items: Array<{ color?: string; size?: string; quantity: number }>) => Promise<boolean>;
  removeDistribution: (distributionId: string) => Promise<boolean>;
  updateDistributionItems: (distributionId: string, items: Array<{ color?: string; size?: string; quantity: number }>) => Promise<boolean>;
  loadDistributions: () => Promise<void>;
  getDistributions: () => CartDistribution[];
  setCurrentStore: (storeId: string | undefined) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'vitrineturbo_cart';
const COUPON_STORAGE_KEY = 'vitrineturbo_coupon';

// Carts saved before each cart remembered its store: take the store from the products
// themselves. Returns 'mixed' when the saved cart already spans two stores.
async function findCartStoreOwner(items: CartItem[], distributions: CartDistribution[]): Promise<string | 'mixed' | null> {
  const owners = new Set<string>();
  distributions.forEach((d) => {
    if (d.product?.user_id) owners.add(d.product.user_id);
  });
  const itemIds = [...new Set(items.map((i) => i.id))];
  if (itemIds.length > 0) {
    const { data, error } = await supabase.from('products').select('id, user_id').in('id', itemIds);
    if (error || !data) return null;
    data.forEach((p) => owners.add(p.user_id));
  }
  if (owners.size === 0) return null;
  return owners.size === 1 ? [...owners][0] : 'mixed';
}

// Identifies "which products, in what quantities" so a coupon's frozen
// discount can be tied to the cart it was validated against.
function getCartSignature(items: CartItem[], distributions: CartDistribution[]): string {
  const itemsSig = (items || [])
    .map((i) => `${i.id}:${i.selectedVariantId || ''}:${i.quantity}`)
    .sort()
    .join('|');
  const distSig = (distributions || [])
    .map((d) => `${d.distribution.id}:${d.distribution.total_quantity}`)
    .sort()
    .join('|');
  return `${itemsSig}##${distSig}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>({
    items: [],
    distributions: [],
    total: 0,
    itemCount: 0,
  });
  const [appliedCoupon, setAppliedCouponState] = useState<AppliedCoupon | null>(null);
  // Store the buyer is browsing right now (set by the store's pages, see useStoreScopedCart).
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [tiersCache, setTiersCache] = useState<Map<string, PriceTier[]>>(new Map());
  const [productsCache, setProductsCache] = useState<Map<string, Product>>(new Map());
  // Snapshot of the cart contents at the moment a coupon was applied — a
  // scoped coupon (specific products/categories) validates against the cart
  // at that instant, so if items/quantities change afterward the discount
  // must be dropped instead of silently carrying over onto products it was
  // never checked against.
  const couponCartSignatureRef = useRef<string | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      let loadedItems: CartItem[] = [];
      let loadedDistributions: CartDistribution[] = [];
      const savedCart = localStorage.getItem(STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        loadedItems = parsedCart.items || [];
        loadedDistributions = parsedCart.distributions || [];
        setCart({
          items: loadedItems,
          distributions: loadedDistributions,
          total: parsedCart.total || 0,
          itemCount: parsedCart.itemCount || 0,
          storeId: parsedCart.storeId,
        });

        if (!parsedCart.storeId && (loadedItems.length > 0 || loadedDistributions.length > 0)) {
          findCartStoreOwner(loadedItems, loadedDistributions).then((owner) => {
            if (owner === 'mixed') {
              setCart({ items: [], distributions: [], total: 0, itemCount: 0 });
              toast.info('Seu carrinho tinha produtos de mais de uma loja e foi esvaziado. Adicione os produtos novamente.');
            } else if (owner) {
              setCart((prev) => ({ ...prev, storeId: owner }));
            }
          });
        }
      }
      const savedCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
      if (savedCoupon) {
        // The signature is tied to the cart restored above — if it doesn't
        // match (e.g. localStorage was edited, or the two keys drifted
        // apart), the watcher effect below drops the coupon right away.
        couponCartSignatureRef.current = getCartSignature(loadedItems, loadedDistributions);
        setAppliedCouponState(JSON.parse(savedCoupon));
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(COUPON_STORAGE_KEY);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cart]);

  // Persist coupon to localStorage
  useEffect(() => {
    try {
      if (appliedCoupon) {
        localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
      } else {
        localStorage.removeItem(COUPON_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving coupon to localStorage:', error);
    }
  }, [appliedCoupon]);

  const setAppliedCoupon = (coupon: AppliedCoupon | null) => {
    couponCartSignatureRef.current = coupon
      ? getCartSignature(cart.items, cart.distributions)
      : null;
    setAppliedCouponState(coupon);
  };

  const clearAppliedCoupon = () => {
    couponCartSignatureRef.current = null;
    setAppliedCouponState(null);
  };

  // A coupon scoped to specific products/categories is only checked against
  // the cart at the moment it's applied — if the buyer adds, removes, or
  // changes quantities afterward, the frozen discount would otherwise keep
  // being subtracted from a cart it was never validated against (including
  // products the coupon was never meant to cover). Drop it and make the
  // buyer re-apply so it gets re-validated against the new cart.
  useEffect(() => {
    if (!appliedCoupon || !couponCartSignatureRef.current) return;
    const currentSignature = getCartSignature(cart.items, cart.distributions);
    if (currentSignature !== couponCartSignatureRef.current) {
      couponCartSignatureRef.current = null;
      setAppliedCouponState(null);
      toast.info('O cupom foi removido porque o carrinho mudou. Aplique-o novamente para revalidar o desconto.');
    }
  }, [cart.items, cart.distributions]);

  // Calculate totals whenever items or distributions change
  useEffect(() => {
    const calculateTotals = async () => {
      const itemCount = (cart.items || []).reduce((sum, item) => sum + item.quantity, 0);
      const distributionCount = (cart.distributions || []).reduce((sum, dist) => sum + dist.distribution.total_quantity, 0);
      const totalCount = itemCount + distributionCount;

      let total = 0;

      for (const item of (cart.items || [])) {
        const effectivePrice = item.applied_tier_price || item.discounted_price || item.price;
        total += effectivePrice * item.quantity;
      }

      for (const dist of (cart.distributions || [])) {
        total += dist.distribution.applied_tier_price * dist.distribution.total_quantity;
      }

      if (cart.total !== total || cart.itemCount !== totalCount) {
        setCart(prev => ({
          ...prev,
          total,
          itemCount: totalCount,
        }));
      }
    };

    calculateTotals();
  }, [cart.items, cart.distributions]);

  const generateVariantId = (productId: string, color?: string, size?: string, flavor?: string, weightVariantId?: string) => {
    return `${productId}-${color || 'no-color'}-${size || 'no-size'}-${flavor || 'no-flavor'}-${weightVariantId || 'no-weight'}`;
  };

  // True when the cart holds products of a different store than `ownerId`.
  const isFromAnotherStore = (ownerId: string | undefined) =>
    !!cart.storeId &&
    !!ownerId &&
    cart.storeId !== ownerId &&
    (cart.items.length > 0 || cart.distributions.length > 0);

  // Empties the cart of its store's products. Distributions live in the database, so their rows go too.
  const emptyCartOfOtherStore = () => {
    setCart({ items: [], distributions: [], total: 0, itemCount: 0, storeId: undefined });
    setAppliedCouponState(null);
    couponCartSignatureRef.current = null;
    Promise.all(cart.distributions.map((d) => deleteDistribution(d.distribution.id))).then(() => loadDistributions());
  };

  // A cart keeps products of one store. Adding a product from another store empties the cart
  // first, so the buyer only ever sees the store they are shopping in.
  const replaceCartForStore = (ownerId: string | undefined) => {
    if (isFromAnotherStore(ownerId)) emptyCartOfOtherStore();
  };

  // Entering a store empties a cart left from another store. Runs again whenever the store or
  // the cart's store changes, so it works whatever order the page and the saved cart load in.
  useEffect(() => {
    if (!currentStoreId || !cart.storeId || cart.storeId === currentStoreId) return;
    if (cart.items.length === 0 && cart.distributions.length === 0) return;
    emptyCartOfOtherStore();
  }, [currentStoreId, cart.storeId, cart.items.length, cart.distributions.length]);

  // Returns false when the item was not added, so callers can skip the next step (e.g. checkout).
  const addToCart = (product: Product, selectedColor?: string, selectedSize?: string, quantity: number = 1, appliedTierPrice?: number, selectedFlavor?: string, selectedWeightVariant?: { id: string; label: string; price: number }): boolean => {
    // Check if product has a price (either base price, tiered price, or weight variant price)
    const hasValidPrice = (product.price && product.price > 0) || (product.has_tiered_pricing && appliedTierPrice && appliedTierPrice > 0) || (selectedWeightVariant && selectedWeightVariant.price > 0);

    if (!hasValidPrice) {
      toast.error('Este produto não pode ser adicionado ao carrinho pois não possui preço definido.');
      return false;
    }

    replaceCartForStore(product.user_id);

    const variantId = generateVariantId(product.id, selectedColor, selectedSize, selectedFlavor, selectedWeightVariant?.id);

    setCart(prev => {
      const existingItem = prev.items.find(item => item.variantId === variantId);

      if (existingItem) {
        // Update quantity if item already exists
        const updatedItems = prev.items.map(item =>
          item.variantId === variantId
            ? {
                ...item,
                quantity: item.quantity + quantity,
                applied_tier_price: appliedTierPrice || item.applied_tier_price,
                has_tiered_pricing: product.has_tiered_pricing || item.has_tiered_pricing
              }
            : item
        );

        const variantText = [selectedWeightVariant?.label, selectedColor, selectedSize, selectedFlavor].filter(Boolean).join(', ');
        toast.success(`Quantidade atualizada: ${product.title}${variantText ? ` (${variantText})` : ''}`);
        return { ...prev, storeId: product.user_id, items: updatedItems };
      } else {
        // Add new item to cart
        // Priority: weight variant price > tiered price > product price
        const effectivePrice = selectedWeightVariant
          ? selectedWeightVariant.price
          : product.has_tiered_pricing && appliedTierPrice && (!product.price || product.price === 0)
          ? appliedTierPrice
          : product.price;

        const newItem: CartItem = {
          id: product.id,
          slug: product.slug,
          variantId,
          title: product.title,
          price: effectivePrice,
          discounted_price: selectedWeightVariant ? undefined : product.discounted_price,
          quantity: quantity,
          featured_image_url: (selectedColor && product.product_images?.find(
            (img: any) => img.associated_color === selectedColor
          )?.url) || product.featured_image_url,
          short_description: product.short_description,
          is_starting_price: product.is_starting_price,
          notes: '',
          selectedColor,
          selectedSize,
          selectedFlavor,
          availableColors: product.colors,
          availableSizes: product.sizes,
          availableFlavors: product.flavors,
          has_tiered_pricing: product.has_tiered_pricing,
          applied_tier_price: appliedTierPrice,
          selectedVariantId: selectedWeightVariant?.id,
          selectedVariantLabel: selectedWeightVariant?.label,
          variantPrice: selectedWeightVariant?.price,
        };

        const variantText = [selectedWeightVariant?.label, selectedColor, selectedSize, selectedFlavor].filter(Boolean).join(', ');
        toast.success(`Adicionado ao carrinho: ${product.title}${variantText ? ` (${variantText})` : ''}`);
        return { ...prev, storeId: product.user_id, items: [...prev.items, newItem] };
      }
    });
    return true;
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const item = prev.items.find(item => item.id === productId);
      if (item) {
        toast.success(`Removido do carrinho: ${item.title}`);
      }
      
      return {
        ...prev,
        items: prev.items.filter(item => item.id !== productId)
      };
    });
  };

  const removeCartVariant = (variantId: string) => {
    setCart(prev => {
      const item = prev.items.find(item => item.variantId === variantId);
      if (item) {
        const variantText = [item.selectedColor, item.selectedSize, item.selectedFlavor].filter(Boolean).join(', ');
        toast.success(`Removido do carrinho: ${item.title}${variantText ? ` (${variantText})` : ''}`);
      }
      
      return {
        ...prev,
        items: prev.items.filter(item => item.variantId !== variantId)
      };
    });
  };
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === productId
          ? { ...item, quantity }
          : item
      )
    }));
  };

  const updateVariantQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeCartVariant(variantId);
      return;
    }

    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.variantId === variantId
          ? { ...item, quantity }
          : item
      )
    }));
  };
  const clearCart = () => {
    setCart({
      items: [],
      distributions: [],
      total: 0,
      itemCount: 0,
      storeId: undefined,
    });
    setAppliedCouponState(null);
    toast.success('Carrinho limpo');
  };

  const isInCart = (productId: string): boolean => {
    return cart.items.some(item => item.id === productId);
  };

  const hasVariant = (productId: string, color?: string, size?: string, flavor?: string): boolean => {
    const variantId = generateVariantId(productId, color, size, flavor);
    return cart.items.some(item => item.variantId === variantId);
  };
  const getItemQuantity = (productId: string): number => {
    // Return total quantity for all variants of this product
    return cart.items
      .filter(item => item.id === productId)
      .reduce((total, item) => total + item.quantity, 0);
  };

  const getVariantQuantity = (productId: string, color?: string, size?: string, flavor?: string): number => {
    const variantId = generateVariantId(productId, color, size, flavor);
    const item = cart.items.find(item => item.variantId === variantId);
    return item?.quantity || 0;
  };

  const updateItemNotes = (productId: string, notes: string) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === productId
          ? { ...item, notes }
          : item
      )
    }));
  };

  const updateVariantNotes = (variantId: string, notes: string) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.variantId === variantId
          ? { ...item, notes }
          : item
      )
    }));
  };

  const updateVariantOptions = (variantId: string, color?: string, size?: string, flavor?: string) => {
    setCart(prev => {
      const item = prev.items.find(item => item.variantId === variantId);
      if (!item) return prev;

      const newVariantId = generateVariantId(item.id, color, size, flavor ?? item.selectedFlavor);
      
      // Check if this new variant already exists
      const existingVariant = prev.items.find(item => item.variantId === newVariantId);
      
      if (existingVariant && newVariantId !== variantId) {
        // Merge quantities if variant already exists
        const updatedItems = prev.items
          .filter(item => item.variantId !== variantId) // Remove old variant
          .map(item => 
            item.variantId === newVariantId
              ? { ...item, quantity: item.quantity + item.quantity }
              : item
          );
        
        toast.success('Variações combinadas no carrinho');
        return { ...prev, items: updatedItems };
      } else {
        // Update the variant options
        const updatedItems = prev.items.map(item =>
          item.variantId === variantId
            ? {
                ...item,
                variantId: newVariantId,
                selectedColor: color,
                selectedSize: size,
                selectedFlavor: flavor ?? item.selectedFlavor
              }
            : item
        );
        
        return { ...prev, items: updatedItems };
      }
    });
  };

  const recalculateTieredPrices = async () => {
    // Recalculate prices for products with tiered pricing
    const updatedItems = await Promise.all(
      cart.items.map(async (item) => {
        if (!item.has_tiered_pricing) return item;

        try {
          const tiers = await fetchProductPriceTiers(item.id);
          if (tiers.length === 0) return item;

          const result = calculateApplicablePrice(
            item.quantity,
            tiers,
            item.price,
            item.discounted_price
          );

          return {
            ...item,
            applied_tier_price: result.unitPrice,
          };
        } catch (error) {
          console.error('Error recalculating tiered price:', error);
          return item;
        }
      })
    );

    setCart(prev => ({
      ...prev,
      items: updatedItems,
    }));
  };

  // Recalculate tiered prices whenever quantities change
  useEffect(() => {
    const hasTieredProducts = cart.items.some(item => item.has_tiered_pricing);
    if (hasTieredProducts) {
      recalculateTieredPrices();
    }
  }, [cart.items.map(item => `${item.id}-${item.quantity}`).join(',')]);

  const addDistribution = async (
    product: Product,
    totalQuantity: number,
    items: Array<{ color?: string; size?: string; quantity: number }>
  ): Promise<boolean> => {
    replaceCartForStore(product.user_id);
    try {
      const tiers = await fetchProductPriceTiers(product.id);
      const basePrice = product.price || 0;
      const discountedPrice = product.discounted_price;

      const distribution = await createDistribution(
        {
          product_id: product.id,
          total_quantity: totalQuantity,
          items,
        },
        tiers,
        basePrice,
        discountedPrice
      );

      if (!distribution) {
        toast.error('Erro ao criar distribuição');
        return false;
      }

      setCart((prev) => ({ ...prev, storeId: product.user_id }));
      await loadDistributions();
      toast.success('Distribuição adicionada ao carrinho');
      return true;
    } catch (error) {
      console.error('Error adding distribution:', error);
      toast.error('Erro ao adicionar distribuição');
      return false;
    }
  };

  const removeDistribution = async (distributionId: string): Promise<boolean> => {
    try {
      const success = await deleteDistribution(distributionId);
      if (success) {
        await loadDistributions();
        toast.success('Distribuição removida do carrinho');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing distribution:', error);
      toast.error('Erro ao remover distribuição');
      return false;
    }
  };

  const updateDistributionItems = async (
    distributionId: string,
    items: Array<{ color?: string; size?: string; quantity: number }>
  ): Promise<boolean> => {
    try {
      const dist = cart.distributions.find(d => d.distribution.id === distributionId);
      if (!dist) return false;

      const tiers = await fetchProductPriceTiers(dist.product.id);
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      const success = await updateDistribution(
        distributionId,
        {
          total_quantity: totalQuantity,
          items,
        },
        tiers,
        dist.product.price || 0,
        dist.product.discounted_price
      );

      if (success) {
        await loadDistributions();
        toast.success('Distribuição atualizada');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating distribution:', error);
      toast.error('Erro ao atualizar distribuição');
      return false;
    }
  };

  const loadDistributions = async () => {
    try {
      const distributions = await fetchUserDistributions();

      const cartDistributions: CartDistribution[] = await Promise.all(
        distributions.map(async (dist) => {
          let product = productsCache.get(dist.product_id);

          if (!product) {
            const { data } = await supabase
              .from('products')
              .select('*, product_images(*), price_tiers(*)')
              .eq('id', dist.product_id)
              .single();

            if (data) {
              product = data;
              setProductsCache(prev => new Map(prev).set(dist.product_id, data));
            }
          }

          return {
            distribution: dist,
            product: product!,
            items: dist.items || [],
          };
        })
      );

      setCart(prev => ({
        ...prev,
        distributions: cartDistributions.filter(d => d.product),
      }));
    } catch (error) {
      // Don't log error for missing tables - this is expected before migrations
      if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') {
        // Silently handle missing table - distributions will just be empty
        setCart(prev => ({
          ...prev,
          distributions: [],
        }));
      } else {
        console.error('Error loading distributions:', error);
      }
    }
  };

  const getDistributions = (): CartDistribution[] => {
    return cart.distributions;
  };

  useEffect(() => {
    loadDistributions();
  }, []);

  const value = {
    cart,
    appliedCoupon,
    setAppliedCoupon,
    clearAppliedCoupon,
    addToCart,
    removeFromCart,
    removeCartVariant,
    updateQuantity,
    updateVariantQuantity,
    clearCart,
    isInCart,
    hasVariant,
    getItemQuantity,
    getVariantQuantity,
    updateItemNotes,
    updateVariantNotes,
    updateVariantOptions,
    recalculateTieredPrices,
    addDistribution,
    removeDistribution,
    updateDistributionItems,
    loadDistributions,
    getDistributions,
    setCurrentStore: setCurrentStoreId,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Call from a store's page with the store's id: a cart from another store is emptied on entry.
export function useStoreScopedCart(storeId: string | undefined) {
  const { setCurrentStore } = useCart();
  useEffect(() => {
    setCurrentStore(storeId);
  }, [storeId, setCurrentStore]);
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart deve ser usado dentro de um CartProvider');
  }
  return context;
};