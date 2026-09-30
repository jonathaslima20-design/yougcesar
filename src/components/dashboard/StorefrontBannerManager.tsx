import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, X, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImage, deleteImage, getExtensionForBlob } from '@/lib/image';
import { ImageCropperBanner } from '@/components/ui/image-cropper-banner';
import { BannerLinkField } from '@/components/dashboard/BannerLinkField';
import { useStorefrontBanners, type StorefrontBanner } from '@/hooks/useStorefrontBanners';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';

type DraftSlot = 'desktop' | 'mobile';

const MAX_BANNERS = 5;

export function StorefrontBannerManager() {
  const { user } = useAuth();
  const { banners, loading, create, update, remove, move } = useStorefrontBanners(user?.id);
  const { appearance, loading: appearanceLoading, save: saveAppearance } = useStorefrontAppearance(user?.id, 'eletronicos');

  const [draft, setDraft] = useState<{ desktop: string | null; mobile: string | null }>({ desktop: null, mobile: null });
  const [draftLink, setDraftLink] = useState('');
  const [uploadingSlot, setUploadingSlot] = useState<DraftSlot | null>(null);
  const [cropperSlot, setCropperSlot] = useState<DraftSlot | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoplaySeconds, setAutoplaySeconds] = useState(5);

  useEffect(() => {
    if (!appearanceLoading) setAutoplaySeconds(appearance.banners_autoplay_seconds ?? 5);
  }, [appearanceLoading, appearance.banners_autoplay_seconds]);
  const [saving, setSaving] = useState(false);
  const [busyBannerId, setBusyBannerId] = useState<string | null>(null);

  const handleFileChange = (slot: DraftSlot) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    setSelectedFile(file);
    setCropperSlot(slot);
  };

  const handleCropComplete = async (croppedBlob: Blob, slot: DraftSlot) => {
    if (!user?.id) return;
    try {
      setUploadingSlot(slot);
      setCropperSlot(null);
      const file = new File([croppedBlob], selectedFile?.name || `banner-${slot}.${getExtensionForBlob(croppedBlob)}`, { type: croppedBlob.type });
      const url = await uploadImage(file, user.id, slot === 'desktop' ? 'theme-banners-desktop' : 'theme-banners-mobile');
      setDraft((prev) => ({ ...prev, [slot]: url }));
    } catch (error: any) {
      console.error('Error uploading theme banner image:', error);
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploadingSlot(null);
      setSelectedFile(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id || !draft.desktop || !draft.mobile) return;
    setSaving(true);
    const success = await create(user.id, {
      image_url_desktop: draft.desktop,
      image_url_mobile: draft.mobile,
      link_url: draftLink.trim() || null,
    });
    setSaving(false);
    if (success) {
      setDraft({ desktop: null, mobile: null });
      setDraftLink('');
      toast.success('Banner adicionado');
    } else {
      toast.error('Erro ao salvar banner');
    }
  };

  const handleDelete = async (banner: StorefrontBanner) => {
    setBusyBannerId(banner.id);
    await deleteImage(banner.image_url_desktop).catch(() => {});
    await deleteImage(banner.image_url_mobile).catch(() => {});
    const success = await remove(banner.id);
    setBusyBannerId(null);
    if (success) toast.success('Banner removido');
    else toast.error('Erro ao remover banner');
  };

  const handleToggleActive = async (banner: StorefrontBanner) => {
    setBusyBannerId(banner.id);
    await update(banner.id, { is_active: !banner.is_active });
    setBusyBannerId(null);
  };

  if (loading || appearanceLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs text-muted-foreground">Tempo entre banners</Label>
          <span className="text-xs text-muted-foreground">{autoplaySeconds}s</span>
        </div>
        <Slider
          value={[autoplaySeconds]}
          onValueChange={([v]) => setAutoplaySeconds(v)}
          onValueCommit={([v]) => saveAppearance({ banners_autoplay_seconds: v })}
          min={2}
          max={10}
          step={1}
        />
      </div>

      <div className="space-y-3">
        {banners.map((banner, index) => (
          <Card key={banner.id}>
            <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
              <img
                src={banner.image_url_desktop}
                alt=""
                className="w-full sm:w-40 aspect-[1920/650] object-cover rounded border shrink-0"
              />
              <div className="flex-1 space-y-2">
                <BannerLinkField
                  value={banner.link_url}
                  onChange={(v) => update(banner.id, { link_url: v })}
                  disabled={busyBannerId === banner.id}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 mr-2">
                  <Switch
                    checked={banner.is_active}
                    onCheckedChange={() => handleToggleActive(banner)}
                    disabled={busyBannerId === banner.id}
                  />
                  <span className="text-xs text-muted-foreground">{banner.is_active ? 'Ativo' : 'Inativo'}</span>
                </div>
                <Button variant="outline" size="icon" disabled={index === 0 || busyBannerId === banner.id} onClick={() => move(banner.id, 'up')}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" disabled={index === banners.length - 1 || busyBannerId === banner.id} onClick={() => move(banner.id, 'down')}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="icon" disabled={busyBannerId === banner.id} onClick={() => handleDelete(banner)}>
                  {busyBannerId === banner.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Adicionar banner</h3>
            <span className="text-xs text-muted-foreground">{banners.length}/{MAX_BANNERS}</span>
          </div>

          {banners.length >= MAX_BANNERS ? (
            <p className="text-sm text-muted-foreground">
              Limite de {MAX_BANNERS} banners atingido. Remova um banner para adicionar outro.
            </p>
          ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Imagem desktop (1920x650)</Label>
              {draft.desktop && (
                <img src={draft.desktop} alt="" className="w-full aspect-[1920/650] object-cover rounded border mb-2" />
              )}
              <input
                type="file"
                id="new-banner-desktop"
                accept="image/*"
                onChange={handleFileChange('desktop')}
                className="hidden"
                disabled={uploadingSlot === 'desktop'}
              />
              <label htmlFor="new-banner-desktop">
                <Button type="button" variant="outline" size="sm" disabled={uploadingSlot === 'desktop'} asChild>
                  <span>
                    {uploadingSlot === 'desktop' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {draft.desktop ? 'Trocar' : 'Escolher imagem'}
                  </span>
                </Button>
              </label>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Imagem mobile (960x425)</Label>
              {draft.mobile && (
                <img src={draft.mobile} alt="" className="w-full aspect-[960/425] object-cover rounded border mb-2" />
              )}
              <input
                type="file"
                id="new-banner-mobile"
                accept="image/*"
                onChange={handleFileChange('mobile')}
                className="hidden"
                disabled={uploadingSlot === 'mobile'}
              />
              <label htmlFor="new-banner-mobile">
                <Button type="button" variant="outline" size="sm" disabled={uploadingSlot === 'mobile'} asChild>
                  <span>
                    {uploadingSlot === 'mobile' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {draft.mobile ? 'Trocar' : 'Escolher imagem'}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          <div>
            <BannerLinkField value={draftLink || null} onChange={(v) => setDraftLink(v || '')} />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveDraft} disabled={!draft.desktop || !draft.mobile || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Adicionar banner
            </Button>
            {draft.desktop && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ desktop: null, mobile: null })}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancelar
              </Button>
            )}
          </div>
          {(!draft.desktop || !draft.mobile) && (draft.desktop || draft.mobile) && (
            <p className="text-xs text-muted-foreground">
              Falta enviar a imagem {!draft.desktop ? 'desktop' : 'mobile'} — as duas são obrigatórias para salvar o banner.
            </p>
          )}
          </>
          )}
        </CardContent>
      </Card>

      {cropperSlot && selectedFile && (
        <ImageCropperBanner
          image={URL.createObjectURL(selectedFile)}
          onCrop={(blob) => handleCropComplete(blob, cropperSlot)}
          onCancel={() => {
            setCropperSlot(null);
            setSelectedFile(null);
          }}
          open={!!cropperSlot}
          aspectRatio={cropperSlot === 'desktop' ? 1920 / 650 : 960 / 425}
        />
      )}
    </div>
  );
}
