// Internationalization utilities for CorretorPage
export type SupportedLanguage = 'pt-BR' | 'en-US' | 'es-ES';
export type SupportedCurrency = 'BRL' | 'USD' | 'EUR' | 'GBP';

// Translation keys and their values for each supported language
export const translations = {
  'pt-BR': {
    // Header and navigation
    'header.search_placeholder': 'Buscar produtos...',
    'header.filters': 'Filtros',
    'header.back_to_storefront': 'Voltar para a vitrine',
    
    // Product status
    'status.available': 'Disponível',
    'status.sold': 'Vendido',
    'status.reserved': 'Reservado',
    
    // Product conditions
    'condition.new': 'Novo',
    'condition.used': 'Usado',
    'condition.semi_new': 'Seminovo',
    
    // Gender
    'gender.masculine': 'Masculino',
    'gender.feminine': 'Feminino',
    'gender.unisex': 'Unissex',
    
    // Filters
    'filters.all_status': 'Todos',
    'filters.all_categories': 'Todas as categorias',
    'filters.all_brands': 'Todas as marcas',
    'filters.all_genders': 'Todos os gêneros',
    'filters.all_conditions': 'Todas',
    'filters.price_range': 'Faixa de Preço',
    'filters.minimum': 'Mínimo',
    'filters.maximum': 'Máximo',
    'filters.category': 'Categoria',
    'filters.brand': 'Marca',
    'filters.gender': 'Gênero',
    'filters.condition': 'Condição',
    'filters.sizes': 'Tamanho',
    'filters.all_sizes': 'Todos os tamanhos',
    'size_type.apparel': 'Vestuário',
    'size_type.shoe': 'Calçados',
    'size_type.custom': 'Personalizado',
    'filters.clear_filters': 'Limpar Filtros',
    'filters.apply_filters': 'Aplicar Filtros',
    'filters.refine_search': 'Refine sua busca usando os filtros abaixo',
    
    // Product details
    'product.starting_from': 'A partir de',
    'product.discount_off': 'OFF',
    'product.special_offer': 'Oferta Especial',
    'product.down_payment': 'Entrada de',
    'product.installments': 'Parcelas de',
    'product.description': 'Descrição',
    'product.share': 'Compartilhar',
    'product.copy_link': 'Copiar link do produto',
    
    // Contact and social
    'contact.talk_now': 'Fale agora conosco',
    'contact.seller': 'Vendedor',
    'contact.whatsapp': 'Falar no WhatsApp',
    'contact.phone': 'Telefone',
    'contact.instagram': 'Instagram',
    'contact.location': 'Localização',
    
    // Messages and states
    'messages.no_products': 'Nenhum produto disponível no momento.',
    'messages.no_results': 'Nenhum produto encontrado com os filtros selecionados.',
    'messages.loading_storefront': 'Carregando Vitrine...',
    'messages.user_not_found': 'Usuário não encontrado',
    'messages.error_loading': 'Erro ao carregar vitrine',
    'messages.user_not_exists': 'O usuário que você está procurando não existe ou não está disponível.',
    'messages.back_to_home': 'Voltar para a página inicial',
    'messages.load_more': 'Carregar Mais Produtos',
    'messages.shared_successfully': 'Compartilhado com sucesso!',
    'messages.link_copied': 'Link copiado para a área de transferência',
    'messages.share_failed': 'Não foi possível copiar o link',
    'messages.product': 'produto',
    'messages.products': 'produtos',
    'messages.found': 'encontrado(s)',
    'messages.loading_search_results': 'Carregando resultados da busca...',
    'messages.showing_active_products_only': 'Mostrando apenas produtos ativos nesta categoria',
    
    // Categories
    'categories.others': 'Outros',
    'categories.share_category': 'Compartilhar categoria',
    'categories.copy_category_link': 'Copiar link da categoria',
    
    // Time and dates
    'time.created_at': 'Cadastrado em',
    'time.updated_at': 'Atualizado em',
    
    // Cart
    'cart.add_to_cart': 'Adicionar ao Carrinho',
    'cart.remove_from_cart': 'Remover do Carrinho',
    'cart.update_quantity': 'Atualizar Quantidade',
    'cart.clear_cart': 'Limpar Carrinho',
    'cart.send_order': 'Enviar Pedido',
    'cart.cart_empty': 'Carrinho vazio',
    'cart.items_in_cart': 'itens no carrinho',
    'cart.total': 'Total',
    'cart.quantity': 'Quantidade',
    'cart.subtotal': 'Subtotal',
    'cart.unit_price': 'Preço unitário',
    'cart.order_title': 'PEDIDO DE COMPRA',
    'cart.order_footer': 'Gostaria de finalizar este pedido. Aguardo retorno com informações sobre pagamento e entrega.',
  },
  
  'en-US': {
    // Header and navigation
    'header.search_placeholder': 'Search products...',
    'header.filters': 'Filters',
    'header.back_to_storefront': 'Back to storefront',
    
    // Product status
    'status.available': 'Available',
    'status.sold': 'Sold',
    'status.reserved': 'Reserved',
    
    // Product conditions
    'condition.new': 'New',
    'condition.used': 'Used',
    'condition.semi_new': 'Like New',
    
    // Gender
    'gender.masculine': 'Men',
    'gender.feminine': 'Women',
    'gender.unisex': 'Unisex',
    
    // Filters
    'filters.all_status': 'All',
    'filters.all_categories': 'All categories',
    'filters.all_brands': 'All brands',
    'filters.all_genders': 'All genders',
    'filters.all_conditions': 'All',
    'filters.price_range': 'Price Range',
    'filters.minimum': 'Minimum',
    'filters.maximum': 'Maximum',
    'filters.category': 'Category',
    'filters.brand': 'Brand',
    'filters.gender': 'Gender',
    'filters.condition': 'Condition',
    'filters.sizes': 'Size',
    'filters.all_sizes': 'All sizes',
    'size_type.apparel': 'Apparel',
    'size_type.shoe': 'Footwear',
    'size_type.custom': 'Custom',
    'filters.clear_filters': 'Clear Filters',
    'filters.apply_filters': 'Apply Filters',
    'filters.refine_search': 'Refine your search using the filters below',
    
    // Product details
    'product.starting_from': 'Starting from',
    'product.discount_off': 'OFF',
    'product.special_offer': 'Special Offer',
    'product.down_payment': 'Down payment of',
    'product.installments': 'Installments of',
    'product.description': 'Description',
    'product.share': 'Share',
    'product.copy_link': 'Copy product link',
    
    // Contact and social
    'contact.talk_now': 'Contact us now',
    'contact.seller': 'Seller',
    'contact.whatsapp': 'Chat on WhatsApp',
    'contact.phone': 'Phone',
    'contact.instagram': 'Instagram',
    'contact.location': 'Location',
    
    // Messages and states
    'messages.no_products': 'No products available at the moment.',
    'messages.no_results': 'No products found with the selected filters.',
    'messages.loading_storefront': 'Loading Storefront...',
    'messages.user_not_found': 'User not found',
    'messages.error_loading': 'Error loading storefront',
    'messages.user_not_exists': 'The user you are looking for does not exist or is not available.',
    'messages.back_to_home': 'Back to homepage',
    'messages.load_more': 'Load More Products',
    'messages.shared_successfully': 'Shared successfully!',
    'messages.link_copied': 'Link copied to clipboard',
    'messages.share_failed': 'Could not copy link',
    'messages.product': 'product',
    'messages.products': 'products',
    'messages.found': 'found',
    'messages.loading_search_results': 'Loading search results...',
    'messages.showing_active_products_only': 'Showing active products only in this category',

    // Categories
    'categories.others': 'Others',
    'categories.share_category': 'Share category',
    'categories.copy_category_link': 'Copy category link',
    
    // Time and dates
    'time.created_at': 'Created on',
    'time.updated_at': 'Updated on',
    
    // Cart
    'cart.add_to_cart': 'Add to Cart',
    'cart.remove_from_cart': 'Remove from Cart',
    'cart.update_quantity': 'Update Quantity',
    'cart.clear_cart': 'Clear Cart',
    'cart.send_order': 'Send Order',
    'cart.cart_empty': 'Cart is empty',
    'cart.items_in_cart': 'items in cart',
    'cart.total': 'Total',
    'cart.quantity': 'Quantity',
    'cart.subtotal': 'Subtotal',
    'cart.unit_price': 'Unit price',
    'cart.order_title': 'PURCHASE ORDER',
    'cart.order_footer': 'I would like to finalize this order. I await your response with payment and delivery information.',
  },
  
  'es-ES': {
    // Header and navigation
    'header.search_placeholder': 'Buscar productos...',
    'header.filters': 'Filtros',
    'header.back_to_storefront': 'Volver al escaparate',
    
    // Product status
    'status.available': 'Disponible',
    'status.sold': 'Vendido',
    'status.reserved': 'Reservado',
    
    // Product conditions
    'condition.new': 'Nuevo',
    'condition.used': 'Usado',
    'condition.semi_new': 'Seminuevo',
    
    // Gender
    'gender.masculine': 'Masculino',
    'gender.feminine': 'Femenino',
    'gender.unisex': 'Unisex',
    
    // Filters
    'filters.all_status': 'Todos',
    'filters.all_categories': 'Todas las categorías',
    'filters.all_brands': 'Todas las marcas',
    'filters.all_genders': 'Todos los géneros',
    'filters.all_conditions': 'Todas',
    'filters.price_range': 'Rango de Precio',
    'filters.minimum': 'Mínimo',
    'filters.maximum': 'Máximo',
    'filters.category': 'Categoría',
    'filters.brand': 'Marca',
    'filters.gender': 'Género',
    'filters.condition': 'Condición',
    'filters.sizes': 'Talla',
    'filters.all_sizes': 'Todas las tallas',
    'size_type.apparel': 'Vestuario',
    'size_type.shoe': 'Calzado',
    'size_type.custom': 'Personalizado',
    'filters.clear_filters': 'Limpiar Filtros',
    'filters.apply_filters': 'Aplicar Filtros',
    'filters.refine_search': 'Refina tu búsqueda usando los filtros de abajo',
    
    // Product details
    'product.starting_from': 'Desde',
    'product.discount_off': 'DESC',
    'product.special_offer': 'Oferta Especial',
    'product.down_payment': 'Entrada de',
    'product.installments': 'Cuotas de',
    'product.description': 'Descripción',
    'product.share': 'Compartir',
    'product.copy_link': 'Copiar enlace del producto',
    'product.available_colors': 'Colores Disponibles',
    'product.available_sizes': 'Tallas Disponibles',

    // Contact and social
    'contact.talk_now': 'Contáctanos ahora',
    'contact.seller': 'Vendedor',
    'contact.whatsapp': 'Hablar por WhatsApp',
    'contact.phone': 'Teléfono',
    'contact.instagram': 'Instagram',
    'contact.location': 'Ubicación',
    
    // Messages and states
    'messages.no_products': 'No hay productos disponibles en este momento.',
    'messages.no_results': 'No se encontraron productos con los filtros seleccionados.',
    'messages.loading_storefront': 'Cargando Escaparate...',
    'messages.user_not_found': 'Usuario no encontrado',
    'messages.error_loading': 'Error al cargar escaparate',
    'messages.user_not_exists': 'El usuario que buscas no existe o no está disponible.',
    'messages.back_to_home': 'Volver a la página principal',
    'messages.load_more': 'Cargar Más Productos',
    'messages.shared_successfully': '¡Compartido exitosamente!',
    'messages.link_copied': 'Enlace copiado al portapapeles',
    'messages.share_failed': 'No se pudo copiar el enlace',
    'messages.product': 'producto',
    'messages.products': 'productos',
    'messages.found': 'encontrado(s)',
    'messages.loading_search_results': 'Cargando resultados de búsqueda...',
    'messages.showing_active_products_only': 'Mostrando solo productos activos en esta categoría',

    // Categories
    'categories.others': 'Otros',
    'categories.share_category': 'Compartir categoría',
    'categories.copy_category_link': 'Copiar enlace de categoría',
    
    // Time and dates
    'time.created_at': 'Creado el',
    'time.updated_at': 'Actualizado el',
    
    // Cart
    'cart.add_to_cart': 'Añadir al Carrito',
    'cart.remove_from_cart': 'Quitar del Carrito',
    'cart.update_quantity': 'Actualizar Cantidad',
    'cart.clear_cart': 'Vaciar Carrito',
    'cart.send_order': 'Enviar Pedido',
    'cart.cart_empty': 'Carrito vacío',
    'cart.items_in_cart': 'artículos en el carrito',
    'cart.total': 'Total',
    'cart.quantity': 'Cantidad',
    'cart.subtotal': 'Subtotal',
    'cart.unit_price': 'Precio unitario',
    'cart.order_title': 'ORDEN DE COMPRA',
    'cart.order_footer': 'Me gustaría finalizar este pedido. Espero su respuesta con información de pago y entrega.',
  },
};

/**
 * Get translation for a key in the specified language
 */
export function t(key: string, language: SupportedLanguage = 'pt-BR'): string {
  const languageTranslations = translations[language];
  if (!languageTranslations) {
    console.warn(`Language ${language} not supported, falling back to pt-BR`);
    return translations['pt-BR'][key] || key;
  }
  
  return languageTranslations[key] || translations['pt-BR'][key] || key;
}

/**
 * Hook for using translations in components
 */
export function useTranslation(language: SupportedLanguage = 'pt-BR') {
  return {
    t: (key: string) => t(key, language),
    language,
  };
}

/**
 * Format currency based on language and currency settings
 */
export function formatCurrencyI18n(
  value: number, 
  currency: SupportedCurrency = 'BRL', 
  language: SupportedLanguage = 'pt-BR'
): string {
  try {
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    console.error('Error formatting currency:', error);
    // Fallback to BRL/pt-BR
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }
}

/**
 * Format date based on language settings
 */
export function formatDateI18n(
  date: Date | string, 
  language: SupportedLanguage = 'pt-BR',
  options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(language, options).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return typeof date === 'string' ? date : date.toLocaleDateString();
  }
}

/**
 * Get locale-specific configuration
 */
export function getLocaleConfig(language: SupportedLanguage) {
  const configs = {
    'pt-BR': {
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm',
      firstDayOfWeek: 0, // Sunday
      decimalSeparator: ',',
      thousandsSeparator: '.',
    },
    'en-US': {
      dateFormat: 'MM/dd/yyyy',
      timeFormat: 'h:mm a',
      firstDayOfWeek: 0, // Sunday
      decimalSeparator: '.',
      thousandsSeparator: ',',
    },
    'es-ES': {
      dateFormat: 'dd/MM/yyyy',
      timeFormat: 'HH:mm',
      firstDayOfWeek: 1, // Monday
      decimalSeparator: ',',
      thousandsSeparator: '.',
    },
  };

  return configs[language] || configs['pt-BR'];
}

/**
 * Get currency symbol based on currency and language
 */
export function getCurrencySymbol(currency: SupportedCurrency = 'BRL', language: SupportedLanguage = 'pt-BR'): string {
  const symbols = {
    'BRL': 'R$',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
  };
  
  return symbols[currency] || 'R$';
}

/**
 * Generate WhatsApp message based on language
 */
export function generateWhatsAppMessage(
  language: SupportedLanguage,
  sellerName: string,
  itemTitle?: string,
  itemId?: string,
  itemUrl?: string
): string {
  console.log('🌍 GENERATING WHATSAPP MESSAGE:', {
    language,
    sellerName,
    itemTitle,
    itemId: itemId?.substring(0, 8)
  });

  const urlSuffix = itemUrl ? `\n\n${itemUrl}` : '';

  const messages = {
    'pt-BR': itemTitle
      ? `Olá ${sellerName}, estou interessado no produto "${itemTitle}" (Ref: ${itemId?.substring(0, 8)}). Pode me enviar mais informações?${urlSuffix}`
      : `Olá ${sellerName}, vi sua vitrine e gostaria de mais informações sobre seus produtos.`,
    'en-US': itemTitle
      ? `Hello ${sellerName}, I'm interested in the product "${itemTitle}" (Ref: ${itemId?.substring(0, 8)}). Can you send me more information?${urlSuffix}`
      : `Hello ${sellerName}, I saw your storefront and would like more information about your products.`,
    'es-ES': itemTitle
      ? `Hola ${sellerName}, estoy interesado en el producto "${itemTitle}" (Ref: ${itemId?.substring(0, 8)}). ¿Puedes enviarme más información?${urlSuffix}`
      : `Hola ${sellerName}, vi tu escaparate y me gustaría más información sobre tus productos.`,
  };

  const message = messages[language] || messages['pt-BR'];
  console.log('🌍 GENERATED MESSAGE:', message);
  return message;
}

/**
 * Get page title based on language
 */
export function getPageTitle(
  language: SupportedLanguage,
  sellerName: string,
  itemTitle?: string,
  isCustomDomain = false
): string {
  console.log('🏷️ GENERATING PAGE TITLE:', {
    language,
    sellerName,
    itemTitle
  });

  const suffix = isCustomDomain ? '' : ' | VitrineTurbo';
  const titles = {
    'pt-BR': itemTitle
      ? `${itemTitle} - ${sellerName}${suffix}`
      : `${sellerName}${suffix}`,
    'en-US': itemTitle
      ? `${itemTitle} - ${sellerName}${suffix}`
      : `${sellerName}${suffix}`,
    'es-ES': itemTitle
      ? `${itemTitle} - ${sellerName}${suffix}`
      : `${sellerName}${suffix}`,
  };

  const finalTitle = titles[language] || titles['pt-BR'];
  console.log('🏷️ FINAL TITLE GENERATED:', finalTitle);
  return finalTitle;
}