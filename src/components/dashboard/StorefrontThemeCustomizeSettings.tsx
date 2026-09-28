import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { STOREFRONT_THEME_OPTIONS, type StorefrontThemeId } from '@/lib/appearanceDefaults';
import { StorefrontVisualIdentity } from '@/components/dashboard/StorefrontVisualIdentity';
import { StorefrontBannerManager } from '@/components/dashboard/StorefrontBannerManager';
import { StorefrontBenefitsManager } from '@/components/dashboard/StorefrontBenefitsManager';
import { StorefrontCategoryShowcaseManager } from '@/components/dashboard/StorefrontCategoryShowcaseManager';
import { StorefrontMiniBannerManager } from '@/components/dashboard/StorefrontMiniBannerManager';
import { StorefrontNewArrivalsManager } from '@/components/dashboard/StorefrontNewArrivalsManager';
import { AppearanceSettings } from '@/components/dashboard/AppearanceSettings';

interface StorefrontThemeCustomizeSettingsProps {
  themeId: StorefrontThemeId;
  onBack: () => void;
}

export function StorefrontThemeCustomizeSettings({ themeId, onBack }: StorefrontThemeCustomizeSettingsProps) {
  const themeLabel = STOREFRONT_THEME_OPTIONS.find((t) => t.value === themeId)?.label || themeId;

  return (
    <div className="space-y-6">
      <div>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-2" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para Temas
        </Button>
        <h2 className="text-lg font-semibold mb-1">Personalizar tema {themeLabel}</h2>
        <p className="text-sm text-muted-foreground">
          Essas configurações valem só para o tema {themeLabel} — trocar de tema não afeta o que você ajustar aqui.
        </p>
      </div>

      {/* Eletrônicos: seções na mesma ordem em que os elementos aparecem na página —
          logo/cabeçalho no topo, depois banners, depois a barra de benefícios.
          (O rodapé usa as mesmas cores do cabeçalho, então fica junto dessa seção.) */}
      {themeId === 'eletronicos' && (
        <>
          <div>
            <h2 className="text-lg font-semibold mb-1">Identidade visual</h2>
            <p className="text-sm text-muted-foreground mb-4">Foto de perfil exibida no cabeçalho.</p>
            <StorefrontVisualIdentity themeId={themeId} />
          </div>

          <Separator />

          <div>
            <h2 className="text-lg font-semibold mb-1">Cores e tipografia</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Cabeçalho, menu e frase do topo — essas cores também valem para o rodapé, no fim da página.
            </p>
            <AppearanceSettings themeId={themeId} />
          </div>

          <Separator />
          <StorefrontBannerManager />
          <Separator />
          <StorefrontBenefitsManager />
          <Separator />
          <StorefrontCategoryShowcaseManager />
          <Separator />
          <StorefrontMiniBannerManager />
          <Separator />
          <StorefrontNewArrivalsManager />
        </>
      )}

      {/* Padrão: ordem original — identidade visual (capa/banner) e depois cores. */}
      {themeId === 'padrao' && (
        <>
          <Separator />

          <div>
            <h2 className="text-lg font-semibold mb-1">Identidade visual</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Logo, capa e banner promocional exibidos no seu catálogo.
            </p>
            <StorefrontVisualIdentity themeId={themeId} />
          </div>

          <Separator />

          <div>
            <h2 className="text-lg font-semibold mb-1">Cores e tipografia</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Ajuste as cores e fontes do catálogo neste tema.
            </p>
            <AppearanceSettings themeId={themeId} />
          </div>
        </>
      )}
    </div>
  );
}
