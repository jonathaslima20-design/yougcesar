import type { CartItem, CartDistribution, AppliedCoupon } from '@/types';
import { formatCurrencyI18n, generateWhatsAppMessage, type SupportedLanguage, type SupportedCurrency } from '@/lib/i18n';

function getProductUrl(productId: string, corretorSlug: string, color?: string): string {
  const colorParam = color ? `?cor=${encodeURIComponent(color)}` : '';

  if (typeof window === 'undefined') return `https://vitrineturbo.com/${corretorSlug}/produtos/${productId}${colorParam}`;

  const hostname = window.location.hostname;
  const isMainDomain = hostname === 'vitrineturbo.com' || hostname.includes('netlify.app') || hostname.includes('vercel.app');
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isMainDomain) {
    return `https://vitrineturbo.com/${corretorSlug}/produtos/${productId}${colorParam}`;
  } else if (isLocalhost) {
    return `${window.location.origin}/${corretorSlug}/produtos/${productId}${colorParam}`;
  } else {
    return `${window.location.origin}/produtos/${productId}${colorParam}`;
  }
}

interface CustomerData {
  name: string;
  whatsapp: string;
  countryCode: string;
}

interface PaymentDeliveryInfo {
  paymentMethod?: string | null;
  paymentMethodDiscount?: number;
  deliveryOption?: string | null;
  deliveryFee?: number;
}

export function generateCartOrderMessage(
  cartItems: CartItem[],
  total: number,
  sellerName: string,
  corretorSlug: string,
  currency: SupportedCurrency = 'BRL',
  language: SupportedLanguage = 'pt-BR',
  distributions: CartDistribution[] = [],
  customer?: CustomerData,
  coupon?: AppliedCoupon | null,
  paymentDelivery?: PaymentDeliveryInfo
): string {
  if (cartItems.length === 0 && distributions.length === 0) return '';

  const greeting = `Olá ${sellerName}, gostaria de realizar um pedido com os itens abaixo.`;

  let orderMessage = `${greeting}\n\n`;

  if (customer) {
    const customerLabels = {
      'pt-BR': { name: 'Cliente', whatsapp: 'WhatsApp' },
      'en-US': { name: 'Customer', whatsapp: 'WhatsApp' },
      'es-ES': { name: 'Cliente', whatsapp: 'WhatsApp' },
    };
    const labels = customerLabels[language] || customerLabels['pt-BR'];
    orderMessage += `*${labels.name}:* ${customer.name}\n`;
    orderMessage += `*${labels.whatsapp}:* +${customer.countryCode}${customer.whatsapp}\n\n`;
  }
  
  // Order header
  const orderTitles = {
    'pt-BR': 'PEDIDO DE COMPRA',
    'en-US': 'PURCHASE ORDER', 
    'es-ES': 'ORDEN DE COMPRA',
  };
  
  orderMessage += `*${orderTitles[language] || orderTitles['pt-BR']}*\n`;
  orderMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  let itemNumber = 1;

  // Add distribution groups first
  distributions.forEach((dist) => {
    const price = dist.distribution.applied_tier_price;
    const totalPrice = price * dist.distribution.total_quantity;

    orderMessage += `${itemNumber}. *${dist.product.title.trim()}*\n`;
    orderMessage += `   📦 Distribuição de Variações\n`;

    // Add product link
    if (corretorSlug) {
      try {
        orderMessage += `${getProductUrl(dist.product.id, corretorSlug)}\n`;
      } catch {
        orderMessage += `Ver produto\n`;
      }
    }

    const quantityLabels = {
      'pt-BR': 'Quantidade Total',
      'en-US': 'Total Quantity',
      'es-ES': 'Cantidad Total',
    };

    const unitPriceLabels = {
      'pt-BR': 'Preço unitário',
      'en-US': 'Unit price',
      'es-ES': 'Precio unitario',
    };

    const subtotalLabels = {
      'pt-BR': 'Subtotal',
      'en-US': 'Subtotal',
      'es-ES': 'Subtotal',
    };

    const distributionLabels = {
      'pt-BR': 'Distribuição',
      'en-US': 'Distribution',
      'es-ES': 'Distribución',
    };

    orderMessage += `   ${quantityLabels[language] || quantityLabels['pt-BR']}: ${dist.distribution.total_quantity}\n`;
    orderMessage += `   ${unitPriceLabels[language] || unitPriceLabels['pt-BR']}: ${formatCurrencyI18n(price, currency, language)}\n`;
    orderMessage += `   ${subtotalLabels[language] || subtotalLabels['pt-BR']}: ${formatCurrencyI18n(totalPrice, currency, language)}\n`;

    if (dist.items.length > 0) {
      orderMessage += `\n   ${distributionLabels[language] || distributionLabels['pt-BR']}:\n`;
      dist.items.forEach((item) => {
        const variantInfo = [item.color, item.size].filter(Boolean).join(' • ');
        orderMessage += `   • ${item.quantity}x ${variantInfo || 'Padrão'}\n`;
      });
    }

    orderMessage += `\n`;
    itemNumber++;
  });

  // Add regular cart items
  cartItems.forEach((item) => {
    const price = item.applied_tier_price || item.discounted_price || item.price;
    const itemTotal = price * item.quantity;

    orderMessage += `${itemNumber}. *${item.title.trim()}*\n`;

    if (item.selectedVariantLabel) {
      const weightLabels = {
        'pt-BR': 'Variação',
        'en-US': 'Variant',
        'es-ES': 'Variación',
      };
      orderMessage += `   ${weightLabels[language] || weightLabels['pt-BR']}: ${item.selectedVariantLabel}\n`;
    }

    // Add variant information if available - show color, size and flavor separately for clarity
    if (item.selectedColor || item.selectedSize || item.selectedFlavor) {
      if (item.selectedColor) {
        const colorLabels = {
          'pt-BR': 'Cor',
          'en-US': 'Color',
          'es-ES': 'Color',
        };
        orderMessage += `   ${colorLabels[language] || colorLabels['pt-BR']}: ${item.selectedColor}\n`;
      }
      if (item.selectedSize) {
        const sizeLabels = {
          'pt-BR': 'Tamanho',
          'en-US': 'Size',
          'es-ES': 'Tamaño',
        };
        orderMessage += `   ${sizeLabels[language] || sizeLabels['pt-BR']}: ${item.selectedSize}\n`;
      }
      if (item.selectedFlavor) {
        const flavorLabels = {
          'pt-BR': 'Sabor',
          'en-US': 'Flavor',
          'es-ES': 'Sabor',
        };
        orderMessage += `   ${flavorLabels[language] || flavorLabels['pt-BR']}: ${item.selectedFlavor}\n`;
      }
    }

    // Add product link for easy access to full details
    if (corretorSlug) {
      try {
        orderMessage += `${getProductUrl(item.id, corretorSlug, item.selectedColor)}\n`;
      } catch {
        orderMessage += `Ver produto\n`;
      }
    }

    const quantityLabels = {
      'pt-BR': 'Quantidade',
      'en-US': 'Quantity',
      'es-ES': 'Cantidad',
    };

    const unitPriceLabels = {
      'pt-BR': 'Preço unitário',
      'en-US': 'Unit price',
      'es-ES': 'Precio unitario',
    };

    const subtotalLabels = {
      'pt-BR': 'Subtotal',
      'en-US': 'Subtotal',
      'es-ES': 'Subtotal',
    };

    orderMessage += `   ${quantityLabels[language] || quantityLabels['pt-BR']}: ${item.quantity}\n`;
    orderMessage += `   ${unitPriceLabels[language] || unitPriceLabels['pt-BR']}: ${formatCurrencyI18n(price, currency, language)}\n`;
    orderMessage += `   ${subtotalLabels[language] || subtotalLabels['pt-BR']}: ${formatCurrencyI18n(itemTotal, currency, language)}\n`;

    // Add notes if they exist
    if (item.notes && item.notes.trim()) {
      const notesLabels = {
        'pt-BR': 'Observação',
        'en-US': 'Notes',
        'es-ES': 'Observación',
      };
      orderMessage += `   ${notesLabels[language] || notesLabels['pt-BR']}: ${item.notes}\n`;
    }

    orderMessage += `\n`;
    itemNumber++;
  });

  // Order footer
  orderMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (coupon && coupon.calculatedDiscount > 0) {
    const subtotalLabelsFooter = {
      'pt-BR': 'Subtotal',
      'en-US': 'Subtotal',
      'es-ES': 'Subtotal',
    };
    const couponLabels = {
      'pt-BR': 'Cupom',
      'en-US': 'Coupon',
      'es-ES': 'Cupón',
    };
    const subtotalBeforeDiscount = total + coupon.calculatedDiscount;
    orderMessage += `*${subtotalLabelsFooter[language] || subtotalLabelsFooter['pt-BR']}: ${formatCurrencyI18n(subtotalBeforeDiscount, currency, language)}*\n`;
    orderMessage += `*${couponLabels[language] || couponLabels['pt-BR']}:* ${coupon.code} (-${formatCurrencyI18n(coupon.calculatedDiscount, currency, language)})\n`;
  }

  if (paymentDelivery?.paymentMethodDiscount && paymentDelivery.paymentMethodDiscount > 0) {
    const pmDiscountLabels = {
      'pt-BR': 'Desc. forma de pagamento',
      'en-US': 'Payment method discount',
      'es-ES': 'Desc. forma de pago',
    };
    orderMessage += `*${pmDiscountLabels[language] || pmDiscountLabels['pt-BR']}:* -${formatCurrencyI18n(paymentDelivery.paymentMethodDiscount, currency, language)}\n`;
  }

  if (paymentDelivery?.deliveryFee && paymentDelivery.deliveryFee > 0) {
    const deliveryLabels = {
      'pt-BR': 'Entrega',
      'en-US': 'Delivery',
      'es-ES': 'Entrega',
    };
    orderMessage += `*${deliveryLabels[language] || deliveryLabels['pt-BR']}:* ${paymentDelivery.deliveryOption || ''} (+${formatCurrencyI18n(paymentDelivery.deliveryFee, currency, language)})\n`;
  } else if (paymentDelivery?.deliveryOption) {
    const deliveryLabels = {
      'pt-BR': 'Entrega',
      'en-US': 'Delivery',
      'es-ES': 'Entrega',
    };
    const freeLabels = {
      'pt-BR': 'Gratis',
      'en-US': 'Free',
      'es-ES': 'Gratis',
    };
    orderMessage += `*${deliveryLabels[language] || deliveryLabels['pt-BR']}:* ${paymentDelivery.deliveryOption} (${freeLabels[language] || freeLabels['pt-BR']})\n`;
  }

  const totalLabels = {
    'pt-BR': 'TOTAL',
    'en-US': 'TOTAL',
    'es-ES': 'TOTAL',
  };

  orderMessage += `*${totalLabels[language] || totalLabels['pt-BR']}: ${formatCurrencyI18n(total, currency, language)}*\n`;

  if (paymentDelivery?.paymentMethod) {
    const paymentLabels = {
      'pt-BR': 'Forma de Pagamento',
      'en-US': 'Payment Method',
      'es-ES': 'Forma de Pago',
    };
    orderMessage += `*${paymentLabels[language] || paymentLabels['pt-BR']}:* ${paymentDelivery.paymentMethod}\n`;
  }

  orderMessage += `\n`;

  const footerMessages = {
    'pt-BR': 'Aguardo retorno para finalizar o pedido.',
    'en-US': 'I await your response to finalize the order.',
    'es-ES': 'Espero su respuesta para finalizar el pedido.',
  };

  orderMessage += footerMessages[language] || footerMessages['pt-BR'];

  return orderMessage;
}

/**
 * Calculate cart statistics
 */
export function calculateCartStats(cartItems: CartItem[]) {
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce((sum, item) => {
    const price = item.applied_tier_price || item.discounted_price || item.price;
    return sum + (price * item.quantity);
  }, 0);

  return { itemCount, total };
}

/**
 * Validate cart item before adding
 */
export function validateCartItem(item: CartItem): boolean {
  const hasValidPrice = (item.price && item.price > 0) || (item.has_tiered_pricing && item.applied_tier_price && item.applied_tier_price > 0) || (item.variantPrice && item.variantPrice > 0);
  return !!(
    item.id &&
    item.title &&
    hasValidPrice &&
    item.quantity > 0
  );
}