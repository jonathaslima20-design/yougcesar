import { Suspense, lazy } from 'react';
import CorretorHeader from '@/components/corretor/CorretorHeader';
import StorefrontProductCatalogSectionPadrao from '@/components/storefront-themes/padrao/StorefrontProductCatalogSectionPadrao';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

const PromotionalBanner = lazy(() => import('@/components/corretor/PromotionalBanner'));

export default function CorretorPageDefault(props: StorefrontPageBodyProps) {
  const { corretor, language, currency, cartEnabled, onlineSalesEnabled } = props;

  return (
    <div className="flex-1">
      <CorretorHeader
        corretor={corretor}
        language={language}
        currency={currency}
        cartEnabled={cartEnabled}
        onlineSalesEnabled={onlineSalesEnabled}
      />

      <div className="mt-6 mb-8">
        <Suspense fallback={<div className="h-20 bg-muted animate-pulse rounded-lg" />}>
          <PromotionalBanner corretor={corretor} />
        </Suspense>
      </div>

      <StorefrontProductCatalogSectionPadrao {...props} />
    </div>
  );
}
