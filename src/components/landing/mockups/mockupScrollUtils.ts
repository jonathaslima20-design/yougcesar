export function getMaxScrollForScreenType(screenType: string, config: Record<string, any>): number {
  switch (screenType) {
    case 'storefront': {
      const productCount = config.products?.length || 0;
      const rows = Math.ceil(productCount / 2);
      return 400 + rows * 260;
    }
    case 'product_detail':
      return 1000;
    case 'dashboard': {
      const statCount = config.stats?.length || 0;
      const statRows = Math.ceil(statCount / 2);
      return 200 + statRows * 120 + 400;
    }
    case 'my_products': {
      const productCount = config.products?.length || 0;
      return 200 + productCount * 100;
    }
    case 'custom':
      return 400;
    default:
      return 400;
  }
}
