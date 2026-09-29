import { ArrowLeft, ImageIcon, Megaphone, PanelTop, Menu as MenuIcon, MousePointerClick, PanelBottom } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { STOREFRONT_THEME_OPTIONS, type StorefrontThemeId } from '@/lib/appearanceDefaults';
import { StorefrontVisualIdentity } from '@/components/dashboard/StorefrontVisualIdentity';
import { StorefrontTopBarManager } from '@/components/dashboard/StorefrontTopBarManager';
import { StorefrontFooterContentManager } from '@/components/dashboard/StorefrontFooterContentManager';
import { StorefrontMovableSections } from '@/components/dashboard/StorefrontMovableSections';
import { AppearanceSettings } from '@/components/dashboard/AppearanceSettings';
import { ThemeSection, SectionColorSwatches, ColorOnlyRow } from '@/components/dashboard/ThemeSection';

interface StorefrontThemeCustomizeSettingsProps {
  themeId: StorefrontThemeId;
  onBack: () => void;
}

export function StorefrontThemeCustomizeSettings({ themeId, onBack }: StorefrontThemeCustomizeSettingsProps) {
  const themeLabel = STOREFRONT_THEME_OPTIONS.find((t) => t.value === themeId)?.label || themeId;
  const { user } = useAuth();
  // Drives the discreet bg/text swatches in each content section's header below —
  // independent from whatever each manager's own hook instance fetches internally.
  const { appearance, loading: appearanceLoading, save } = useStorefrontAppearance(user?.id, 'eletronicos');

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

      {/* Eletrônicos: seções na mesma ordem em que os elementos aparecem na página,
          de cima para baixo — frase do topo, cabeçalho, menu, banners, benefícios,
          categorias, mini banners, novidades e por último o rodapé. Cada bloco é
          colapsável (só o primeiro abre por padrão) para não empilhar todos os
          controles na tela ao mesmo tempo. */}
      {themeId === 'eletronicos' && (
        <div className="space-y-3">
          <ThemeSection icon={<ImageIcon size={16} />} title="Logo" defaultOpen>
            <StorefrontVisualIdentity themeId={themeId} />
          </ThemeSection>

          <ThemeSection
            icon={<Megaphone size={16} />}
            title="Frases do topo"
            description="A faixa de aviso que roda no topo da página, acima do cabeçalho."
            headerExtra={
              <SectionColorSwatches
                bgColor={appearance.topbar_bg_color}
                textColor={appearance.topbar_text_color}
                onBgChange={(v) => save({ topbar_bg_color: v })}
                onTextChange={(v) => save({ topbar_text_color: v })}
                disabled={appearanceLoading}
              />
            }
          >
            <StorefrontTopBarManager />
          </ThemeSection>

          {/* Pure color choices — no other setting to hide/show — so they're plain
              rows, not accordions. */}
          <ColorOnlyRow
            icon={<PanelTop size={16} />}
            title="Cabeçalho"
            description="Barra com a logo e a busca."
            bgColor={appearance.header_bg_color}
            textColor={appearance.header_text_color}
            onBgChange={(v) => save({ header_bg_color: v })}
            onTextChange={(v) => save({ header_text_color: v })}
            disabled={appearanceLoading}
          />

          <ColorOnlyRow
            icon={<MousePointerClick size={16} />}
            title="Botões"
            description='Botão de busca e o botão "Ofertas Especiais" no cabeçalho.'
            bgColor={appearance.button_bg_color}
            textColor={appearance.button_text_color}
            onBgChange={(v) => save({ button_bg_color: v })}
            onTextChange={(v) => save({ button_text_color: v })}
            disabled={appearanceLoading}
          />

          <ColorOnlyRow
            icon={<MenuIcon size={16} />}
            title="Menu"
            description="Barra de categorias logo abaixo do cabeçalho."
            bgColor={appearance.nav_bg_color}
            textColor={appearance.nav_text_color}
            onBgChange={(v) => save({ nav_bg_color: v })}
            onTextChange={(v) => save({ nav_text_color: v })}
            disabled={appearanceLoading}
          />

          {/* Reorderable home sections (each has its own up/down), in page order. */}
          <StorefrontMovableSections />


          <ThemeSection
            icon={<PanelBottom size={16} />}
            title="Rodapé"
            description="O rodapé, no fim da página."
            headerExtra={
              <SectionColorSwatches
                bgColor={appearance.footer_bg_color}
                textColor={appearance.footer_text_color}
                onBgChange={(v) => save({ footer_bg_color: v })}
                onTextChange={(v) => save({ footer_text_color: v })}
                disabled={appearanceLoading}
              />
            }
          >
            <StorefrontFooterContentManager />
          </ThemeSection>
        </div>
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
