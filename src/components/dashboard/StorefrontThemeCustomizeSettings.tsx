import { ArrowLeft, ExternalLink, ImageIcon, Megaphone, PanelTop, Menu as MenuIcon, LayoutGrid, PanelBottom, Palette, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { STOREFRONT_THEME_OPTIONS, getUsedThemeColors, type StorefrontThemeId } from '@/lib/appearanceDefaults';
import { StorefrontVisualIdentity } from '@/components/dashboard/StorefrontVisualIdentity';
import { StorefrontTopBarManager } from '@/components/dashboard/StorefrontTopBarManager';
import { StorefrontFooterContentManager } from '@/components/dashboard/StorefrontFooterContentManager';
import { StorefrontGridColorsManager } from '@/components/dashboard/StorefrontGridColorsManager';
import { StorefrontNavCategoriesManager } from '@/components/dashboard/StorefrontNavCategoriesManager';
import { StorefrontMovableSections } from '@/components/dashboard/StorefrontMovableSections';
import { AppearanceSettings } from '@/components/dashboard/AppearanceSettings';
import { ThemeSection, SectionColorSwatches, ColorOnlyRow } from '@/components/dashboard/ThemeSection';
import { ThemeColorPaletteBar } from '@/components/dashboard/ThemeColorPaletteBar';

interface StorefrontThemeCustomizeSettingsProps {
  themeId: StorefrontThemeId;
  onBack: () => void;
}

export function StorefrontThemeCustomizeSettings({ themeId, onBack }: StorefrontThemeCustomizeSettingsProps) {
  const themeLabel = STOREFRONT_THEME_OPTIONS.find((t) => t.value === themeId)?.label || themeId;
  const { user } = useAuth();
  // Drives the discreet bg/text swatches in each content section's header below —
  // independent from whatever each manager's own hook instance fetches internally.
  const { appearance, loading: appearanceLoading, save } = useStorefrontAppearance(user?.id, themeId);
  const palette = getUsedThemeColors(appearance);

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

      {/* Preview without activating: opens the store with the E-commerce theme for the owner
          only (see lib/storefrontPreview.ts). Nothing is published until the theme is activated. */}
      {themeId === 'eletronicos' && user?.slug && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
          <a href={`/${user.slug}?preview_theme=eletronicos`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Visualizar loja
          </a>
        </Button>
      )}

      {/* Eletrônicos: agrupado por categoria (Identidade / Seções da home / Grade de
          produtos / Rodapé) em vez de uma lista única, para não empilhar ~26 campos de
          cor numa única rolagem. A paleta no topo mostra toda cor já usada no tema,
          clicável para copiar — e a mesma lista reaparece como atalho dentro de cada
          seletor de cor, então nunca é preciso "adivinhar" o tom certo de novo. */}
      {themeId === 'eletronicos' && (
        <div className="space-y-4">
          <ThemeColorPaletteBar appearance={appearance} />

          <Tabs defaultValue="identidade">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="identidade" className="gap-1.5"><Palette size={14} /> Identidade</TabsTrigger>
              <TabsTrigger value="secoes" className="gap-1.5"><Rows3 size={14} /> Seções da home</TabsTrigger>
              <TabsTrigger value="grade" className="gap-1.5"><LayoutGrid size={14} /> Grade de produtos</TabsTrigger>
              <TabsTrigger value="rodape" className="gap-1.5"><PanelBottom size={14} /> Rodapé</TabsTrigger>
            </TabsList>

            <TabsContent value="identidade" className="space-y-3">
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
                    palette={palette}
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
                palette={palette}
              />

              {/* Menu: its colors and the categories it lists live in one section. */}
              <ThemeSection
                icon={<MenuIcon size={16} />}
                title="Menu"
                description="Barra de categorias logo abaixo do cabeçalho, e o que ela mostra."
                headerExtra={
                  <SectionColorSwatches
                    bgColor={appearance.nav_bg_color}
                    textColor={appearance.nav_text_color}
                    onBgChange={(v) => save({ nav_bg_color: v })}
                    onTextChange={(v) => save({ nav_text_color: v })}
                    disabled={appearanceLoading}
                    palette={palette}
                  />
                }
              >
                <StorefrontNavCategoriesManager />
              </ThemeSection>
            </TabsContent>

            <TabsContent value="secoes" className="space-y-3">
              {/* Reorderable home sections (each has its own up/down), in page order. */}
              <StorefrontMovableSections />
            </TabsContent>

            <TabsContent value="grade">
              <ThemeSection
                icon={<LayoutGrid size={16} />}
                title="Grade de produtos"
                description="Cores dos cards de produto (Ofertas, Novidades e a lista ao filtrar por categoria)."
                defaultOpen
              >
                <StorefrontGridColorsManager />
              </ThemeSection>
            </TabsContent>

            <TabsContent value="rodape">
              <ThemeSection
                icon={<PanelBottom size={16} />}
                title="Rodapé"
                description="O rodapé, no fim da página."
                defaultOpen
                headerExtra={
                  <SectionColorSwatches
                    bgColor={appearance.footer_bg_color}
                    textColor={appearance.footer_text_color}
                    onBgChange={(v) => save({ footer_bg_color: v })}
                    onTextChange={(v) => save({ footer_text_color: v })}
                    disabled={appearanceLoading}
                    palette={palette}
                  />
                }
              >
                <StorefrontFooterContentManager />
              </ThemeSection>
            </TabsContent>
          </Tabs>
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
