import { useEffect, useState } from 'react';
import { ChevronDown, ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ImageCropperBanner } from '@/components/ui/image-cropper-banner';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { AvatarSection } from '@/components/Profile/AvatarSection';
import { CoverImageSection } from '@/components/Profile/CoverImageSection';
import { PromotionalBannerSection } from '@/components/Profile/PromotionalBannerSection';
import { uploadImage, getExtensionForBlob } from '@/lib/image';
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
  const { appearance, loading: appearanceLoading, save } = useStorefrontAppearance(
    themeId === 'eletronicos' ? user?.id : undefined,
    'eletronicos'
  );
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoCropperOpen, setLogoCropperOpen] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoScale, setLogoScale] = useState(100);

  useEffect(() => {
    if (!appearanceLoading) setLogoScale(appearance.header_logo_scale ?? 100);
  }, [appearanceLoading, appearance.header_logo_scale]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    setSelectedLogoFile(file);
    setLogoCropperOpen(true);
  };

  const handleLogoCropComplete = async (croppedBlob: Blob) => {
    if (!user?.id) return;
    try {
      setUploadingLogo(true);
      setLogoCropperOpen(false);
      const file = new File([croppedBlob], selectedLogoFile?.name || `header-logo.${getExtensionForBlob(croppedBlob)}`, { type: croppedBlob.type });
      const url = await uploadImage(file, user.id, 'theme-header-logo');
      await save({ header_logo_url: url });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploadingLogo(false);
      setSelectedLogoFile(null);
    }
  };

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
      {themeId === 'padrao' && (
        <div className="flex flex-col items-center space-y-4 py-2">
          <AvatarSection
            user={user}
            previewImage={previewImage}
            setPreviewImage={setPreviewImage}
          />
        </div>
      )}

      {themeId === 'eletronicos' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
            <ImageIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Este tema usa uma <strong>logo retangular</strong> no lugar da foto de perfil circular.
              O ideal é uma imagem com fundo transparente, proporção 4:1 (ex: 320x80px).
            </p>
          </div>

          <div>
            {appearance.header_logo_url && (
              <div className="bg-neutral-900 rounded p-3 mb-3 inline-block">
                <img src={appearance.header_logo_url} alt="" className="h-10 w-auto object-contain" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="header-logo-upload"
                accept="image/*"
                className="hidden"
                disabled={uploadingLogo}
                onChange={handleLogoFileChange}
              />
              <label htmlFor="header-logo-upload">
                <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} asChild>
                  <span>
                    {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {appearance.header_logo_url ? 'Trocar' : 'Enviar logo'}
                  </span>
                </Button>
              </label>
              {appearance.header_logo_url && (
                <Button type="button" variant="ghost" size="sm" onClick={() => save({ header_logo_url: null })}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover
                </Button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-muted-foreground">Tamanho da logo</Label>
              <span className="text-xs text-muted-foreground">{logoScale}%</span>
            </div>
            <Slider
              value={[logoScale]}
              onValueChange={([v]) => setLogoScale(v)}
              onValueCommit={([v]) => save({ header_logo_scale: v })}
              min={50}
              max={200}
              step={5}
            />
          </div>
        </div>
      )}

      {logoCropperOpen && selectedLogoFile && (
        <ImageCropperBanner
          image={URL.createObjectURL(selectedLogoFile)}
          onCrop={handleLogoCropComplete}
          onCancel={() => {
            setLogoCropperOpen(false);
            setSelectedLogoFile(null);
          }}
          open={logoCropperOpen}
          aspectRatio={3}
        />
      )}

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
