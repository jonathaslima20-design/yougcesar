import CorretorHeaderEletronicos from '@/components/storefront-themes/eletronicos/CorretorHeaderEletronicos';
import BannerCarousel from '@/components/storefront-themes/eletronicos/BannerCarousel';
import BenefitsBar from '@/components/storefront-themes/eletronicos/BenefitsBar';
import CategoryShowcase from '@/components/storefront-themes/eletronicos/CategoryShowcase';
import MiniBannerGrid from '@/components/storefront-themes/eletronicos/MiniBannerGrid';
import NewArrivalsCarousel from '@/components/storefront-themes/eletronicos/NewArrivalsCarousel';
import CorretorFooterEletronicos from '@/components/storefront-themes/eletronicos/CorretorFooterEletronicos';
import StorefrontProductCatalogSectionEletronicos from '@/components/storefront-themes/eletronicos/StorefrontProductCatalogSectionEletronicos';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

export default function CorretorPageEletronicos(props: StorefrontPageBodyProps) {
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <CorretorHeaderEletronicos {...props} />
      <BannerCarousel userId={props.corretor.id} />
      <BenefitsBar userId={props.corretor.id} />
      <CategoryShowcase {...props} />
      <div className="flex-1">
        <StorefrontProductCatalogSectionEletronicos {...props} />
      </div>
      <MiniBannerGrid userId={props.corretor.id} />
      <NewArrivalsCarousel {...props} />
      <CorretorFooterEletronicos {...props} />
    </div>
  );
}
