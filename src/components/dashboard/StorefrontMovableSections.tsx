import { ArrowUp, ArrowDown, GalleryHorizontal, BadgePercent, LayoutGrid, Images, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { resolveHomeSectionOrder, type HomeSectionId } from '@/lib/appearanceDefaults';
import { ThemeSection, SectionColorSwatches } from '@/components/dashboard/ThemeSection';
import { StorefrontBannerManager } from '@/components/dashboard/StorefrontBannerManager';
import { StorefrontBenefitsManager } from '@/components/dashboard/StorefrontBenefitsManager';
import { StorefrontCategoryShowcaseManager } from '@/components/dashboard/StorefrontCategoryShowcaseManager';
import { StorefrontFeatureBannerManager } from '@/components/dashboard/StorefrontFeatureBannerManager';
import { StorefrontMiniBannerManager } from '@/components/dashboard/StorefrontMiniBannerManager';
import { StorefrontNewArrivalsManager, StorefrontOffersManager } from '@/components/dashboard/StorefrontNewArrivalsManager';

/**
 * The reorderable home sections of the "Eletrônicos" theme, listed here in the same
 * order they appear on the store's home — each with ↑/↓ on its own header, so moving
 * a section is done right where you edit it. Top bar, header, menu and footer live
 * outside this list on purpose: they're fixed.
 */
export function StorefrontMovableSections() {
  const { user } = useAuth();
  const { appearance, loading, save } = useStorefrontAppearance(user?.id, 'eletronicos');

  const order = resolveHomeSectionOrder(appearance.home_section_order);

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    const ok = await save({ home_section_order: next });
    if (!ok) toast.error('Erro ao salvar a ordem das seções');
  };

  const swatches = (bg: keyof typeof appearance, text: keyof typeof appearance) => (
    <SectionColorSwatches
      bgColor={appearance[bg] as string}
      textColor={appearance[text] as string}
      onBgChange={(v) => save({ [bg]: v })}
      onTextChange={(v) => save({ [text]: v })}
      disabled={loading}
    />
  );

  const sections: Record<HomeSectionId, { icon: React.ReactNode; title: string; description: string; extra?: React.ReactNode; body: React.ReactNode }> = {
    banners: {
      icon: <GalleryHorizontal size={16} />,
      title: 'Banners',
      description: 'Vários banners em carrossel na home do catálogo. Cada banner precisa de uma imagem desktop e uma mobile.',
      extra: swatches('banners_bg_color', 'banners_text_color'),
      body: <StorefrontBannerManager />,
    },
    benefits: {
      icon: <BadgePercent size={16} />,
      title: 'Barra de benefícios',
      description: 'Os ícones com texto (parcelamento, envios, atendimento...).',
      extra: swatches('benefits_bg_color', 'benefits_text_color'),
      body: <StorefrontBenefitsManager />,
    },
    categories: {
      icon: <LayoutGrid size={16} />,
      title: 'Navegue por Categorias',
      description: 'A fileira de categorias em círculo.',
      extra: swatches('category_showcase_bg_color', 'category_showcase_text_color'),
      body: <StorefrontCategoryShowcaseManager />,
    },
    offers: {
      icon: <BadgePercent size={16} />,
      title: 'Ofertas',
      description: 'Carrossel dos produtos que você escolher para aparecer em oferta.',
      body: <StorefrontOffersManager />,
    },
    feature_banner: {
      icon: <GalleryHorizontal size={16} />,
      title: 'Banner de destaque',
      description: 'Faixa larga com um banner, com imagem separada para celular.',
      body: <StorefrontFeatureBannerManager />,
    },
    mini_banners: {
      icon: <Images size={16} />,
      title: 'Mini banners',
      description: 'Grade de 3 banners menores.',
      extra: swatches('mini_banners_bg_color', 'mini_banners_text_color'),
      body: <StorefrontMiniBannerManager />,
    },
    new_arrivals: {
      icon: <Sparkles size={16} />,
      title: 'Novidades',
      description: 'Carrossel dos produtos que você escolher para aparecer em destaque.',
      extra: swatches('new_arrivals_bg_color', 'new_arrivals_text_color'),
      body: <StorefrontNewArrivalsManager />,
    },
  };

  return (
    <>
      {order.map((id, index) => {
        const section = sections[id];
        return (
          <ThemeSection
            key={id}
            icon={section.icon}
            title={section.title}
            description={section.description}
            headerExtra={
              <div className="flex items-center gap-1">
                {section.extra}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Mover para cima na página"
                  aria-label={`Mover ${section.title} para cima`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Mover para baixo na página"
                  aria-label={`Mover ${section.title} para baixo`}
                  disabled={index === order.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            }
          >
            {section.body}
          </ThemeSection>
        );
      })}
    </>
  );
}
