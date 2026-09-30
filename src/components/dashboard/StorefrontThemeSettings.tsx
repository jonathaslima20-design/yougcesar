import { useState } from 'react';
import { Check, Loader as LoaderIcon, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { STOREFRONT_THEME_OPTIONS, type StorefrontThemeId } from '@/lib/appearanceDefaults';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StorefrontThemeSettingsProps {
  // Opens the "Personalizar <tema>" tab for the given theme — its banners,
  // identidade visual and cores live there now, not stacked on this picker.
  onCustomize: (themeId: StorefrontThemeId) => void;
}

// Miniature, non-literal wireframe of each theme's home layout. Not a real
// screenshot (themes have no static render to snapshot), but enough visual
// shape — header/nav/banner/grid proportions — to tell the layouts apart at
// a glance, in any color scheme.
function ThemePreview({ variant }: { variant: StorefrontThemeId }) {
  if (variant === 'eletronicos') {
    return (
      <div className="flex h-full w-full flex-col gap-1.5 bg-muted/60 p-2.5">
        <div className="h-1 w-full shrink-0 rounded-full bg-foreground/10" />
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-foreground/25" />
          <div className="h-2 flex-1 rounded-full bg-foreground/10" />
          <div className="h-2 w-2 shrink-0 rounded-full bg-foreground/15" />
        </div>
        <div className="flex shrink-0 gap-1">
          <div className="h-1.5 w-6 rounded-full bg-foreground/15" />
          <div className="h-1.5 w-5 rounded-full bg-foreground/15" />
          <div className="h-1.5 w-7 rounded-full bg-foreground/15" />
          <div className="h-1.5 w-4 rounded-full bg-foreground/15" />
        </div>
        <div className="h-7 shrink-0 rounded-md bg-foreground/15" />
        <div className="grid flex-1 grid-cols-4 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-0.5 rounded-sm border border-foreground/5 bg-background/70 p-0.5">
              <div className="flex-1 rounded-[2px] bg-foreground/15" />
              <div className="h-1 w-3/4 rounded-full bg-foreground/20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-1.5 bg-muted/60 p-2.5">
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-foreground/25" />
        <div className="h-1.5 w-12 rounded-full bg-foreground/15" />
      </div>
      <div className="flex-1 rounded-md bg-foreground/15" />
      <div className="grid shrink-0 grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-square rounded-sm bg-foreground/10" />
        ))}
      </div>
    </div>
  );
}

export function StorefrontThemeSettings({ onCustomize }: StorefrontThemeSettingsProps) {
  const { user, updateUser } = useAuth();
  const activeThemeId: StorefrontThemeId = user?.active_storefront_theme_id || 'padrao';
  const [savingTheme, setSavingTheme] = useState<StorefrontThemeId | null>(null);

  const handleActivate = async (themeId: StorefrontThemeId) => {
    if (themeId === activeThemeId || savingTheme) return;
    setSavingTheme(themeId);
    const { error } = await updateUser({ active_storefront_theme_id: themeId });
    setSavingTheme(null);
    if (!error) {
      toast.success('Tema da vitrine atualizado');
    } else {
      toast.error('Não foi possível atualizar o tema. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Tema da Vitrine</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o layout do seu catálogo público. Você pode personalizar qualquer tema antes de usá-lo —
          trocar de tema não afeta produtos nem a personalização já salva.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {STOREFRONT_THEME_OPTIONS.map((theme) => {
          const isActive = activeThemeId === theme.value;
          const isSaving = savingTheme === theme.value;
          return (
            <Card
              key={theme.value}
              className={cn(
                'relative overflow-hidden p-0 transition-all',
                isActive ? 'border-2 border-primary shadow-sm' : 'border-2 border-border hover:border-muted-foreground/40',
                savingTheme && !isSaving && 'opacity-60 pointer-events-none'
              )}
            >
              <div className="aspect-video w-full border-b">
                <ThemePreview variant={theme.value} />
              </div>

              {isActive && (
                <Badge className="absolute top-3 right-3 gap-1 shadow-sm">
                  <Check className="h-3 w-3" />
                  Tema ativo
                </Badge>
              )}

              <div className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-medium">{theme.label}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{theme.description}</p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onCustomize(theme.value)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Personalizar
                  </Button>

                  {!isActive && (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={!!savingTheme}
                      onClick={() => handleActivate(theme.value)}
                    >
                      {isSaving ? (
                        <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {isSaving ? 'Ativando...' : 'Usar este tema'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
