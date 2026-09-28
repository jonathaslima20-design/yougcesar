import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { AvatarSection } from '@/components/Profile/AvatarSection';
import { CoverImageSection } from '@/components/Profile/CoverImageSection';
import { PromotionalBannerSection } from '@/components/Profile/PromotionalBannerSection';
import type { StorefrontThemeId } from '@/lib/appearanceDefaults';

interface StorefrontVisualIdentityProps {
  // Cover images and the single promotional banner only render on the "padrao"
  // theme (CorretorPageDefault) — the "eletronicos" theme uses its own carousel
  // (StorefrontBannerManager) instead, so those two sections are hidden for it.
  themeId?: StorefrontThemeId;
}

/**
 * Logo, cover and promotional banner uploads — moved here from ProfileSettings
 * so identity/contact info (Perfil) and store look (Tema) live in separate tabs.
 * Same components, same upload logic, just a new home.
 */
export function StorefrontVisualIdentity({ themeId = 'padrao' }: StorefrontVisualIdentityProps) {
  const { user } = useAuth();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewCover, setPreviewCover] = useState<{ desktop: string | null; mobile: string | null }>({
    desktop: null,
    mobile: null,
  });
  const [previewBanner, setPreviewBanner] = useState<{ desktop: string | null; mobile: string | null }>({
    desktop: null,
    mobile: null,
  });
  const [coverImagesOpen, setCoverImagesOpen] = useState(false);
  const [promotionalBannerOpen, setPromotionalBannerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setPreviewImage(user.avatar_url || null);
    setPreviewCover({
      desktop: user.cover_url_desktop || null,
      mobile: user.cover_url_mobile || null,
    });
    setPreviewBanner({
      desktop: user.promotional_banner_url_desktop || null,
      mobile: user.promotional_banner_url_mobile || null,
    });
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-4 py-2">
        <AvatarSection
          user={user}
          previewImage={previewImage}
          setPreviewImage={setPreviewImage}
        />
      </div>

      {themeId === 'padrao' && (
        <>
          <Collapsible open={coverImagesOpen} onOpenChange={setCoverImagesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-4 px-4 hover:bg-muted/50 rounded-lg border border-input"
                type="button"
              >
                <span className="font-medium">Imagens de Capa</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${coverImagesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <CoverImageSection
                user={user}
                previewCover={previewCover}
                setPreviewCover={setPreviewCover}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={promotionalBannerOpen} onOpenChange={setPromotionalBannerOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between h-auto py-4 px-4 hover:bg-muted/50 rounded-lg border border-input"
                type="button"
              >
                <span className="font-medium">Banner Promocional</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${promotionalBannerOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <PromotionalBannerSection
                user={user}
                previewBanner={previewBanner}
                setPreviewBanner={setPreviewBanner}
              />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}
