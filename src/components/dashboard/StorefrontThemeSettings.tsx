import { useState } from 'react';
import { Check, Loader as LoaderIcon, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { STOREFRONT_THEME_OPTIONS, type StorefrontThemeId } from '@/lib/appearanceDefaults';
import { useEletronicosThemeEnabled } from '@/hooks/useEletronicosThemeEnabled';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StorefrontThemeSettingsProps {
  // Opens the "Personalizar <tema>" tab for the given theme — its banners,
  // identidade visual and cores live there now, not stacked on this picker.
  onCustomize: (themeId: StorefrontThemeId) => void;
}

export function StorefrontThemeSettings({ onCustomize }: StorefrontThemeSettingsProps) {
  const { user, updateUser } = useAuth();
  const { enabled: eletronicosEnabled } = useEletronicosThemeEnabled();
  const isAdmin = user?.role === 'admin';
  // While the platform switch is off, merchants only see "Padrão"; admins still
  // see "Eletrônicos" (tagged) so they can keep configuring it ahead of launch.
  const visibleThemes = STOREFRONT_THEME_OPTIONS.filter(
    (theme) => theme.value !== 'eletronicos' || eletronicosEnabled || isAdmin
  );
  const storedThemeId: StorefrontThemeId = user?.active_storefront_theme_id || 'padrao';
  const activeThemeId: StorefrontThemeId =
    storedThemeId === 'eletronicos' && !eletronicosEnabled && !isAdmin ? 'padrao' : storedThemeId;
  const [savingTheme, setSavingTheme] = useState<StorefrontThemeId | null>(null);

  const handleSelect = async (themeId: StorefrontThemeId) => {
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
          Escolha o layout do seu catálogo público. Você pode trocar quando quiser,
          sem perder produtos ou personalização de cores.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleThemes.map((theme) => {
          const isActive = activeThemeId === theme.value;
          const isSaving = savingTheme === theme.value;
          return (
            <Card
              key={theme.value}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(theme.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSelect(theme.value);
              }}
              className={cn(
                'relative p-4 cursor-pointer transition-all border-2',
                isActive ? 'border-primary' : 'border-border hover:border-muted-foreground/40',
                savingTheme && !isSaving && 'opacity-60 pointer-events-none'
              )}
            >
              {isActive && (
                <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-3.5 w-3.5" />
                </div>
              )}
              <div className="aspect-video rounded-md bg-muted mb-3 flex items-center justify-center text-xs text-muted-foreground">
                Prévia em breve
              </div>
              <h3 className="font-medium mb-1">
                {theme.label}
                {theme.value === 'eletronicos' && !eletronicosEnabled && (
                  <span className="ml-2 text-xs font-normal text-amber-600">Oculto para lojistas</span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">{theme.description}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onCustomize(theme.value);
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Personalizar
              </Button>
              {isSaving && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LoaderIcon className="h-3 w-3 animate-spin" /> Salvando...
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
