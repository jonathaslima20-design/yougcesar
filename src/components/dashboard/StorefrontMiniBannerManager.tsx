import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, X, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImage, deleteImage, getExtensionForBlob } from '@/lib/image';
import { ImageCropperBanner } from '@/components/ui/image-cropper-banner';
import { BannerLinkField } from '@/components/dashboard/BannerLinkField';
import { useStorefrontMiniBanners, type StorefrontMiniBanner } from '@/hooks/useStorefrontMiniBanners';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';

export function StorefrontMiniBannerManager() {
  const { user } = useAuth();
  const { banners, loading, create, update, remove, move } = useStorefrontMiniBanners(user?.id);
  const { appearance, loading: appearanceLoading, save: saveAppearance } = useStorefrontAppearance(user?.id, 'eletronicos');

  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [draftLink, setDraftLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyBannerId, setBusyBannerId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    setSelectedFile(file);
    setCropperOpen(true);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user?.id) return;
    try {
      setUploading(true);
      setCropperOpen(false);
      const file = new File([croppedBlob], selectedFile?.name || `mini-banner.${getExtensionForBlob(croppedBlob)}`, { type: croppedBlob.type });
      const url = await uploadImage(file, user.id, 'theme-mini-banners');
      setDraftImage(url);
    } catch (error: any) {
      console.error('Error uploading mini banner image:', error);
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!user?.id || !draftImage) return;
    setSaving(true);
    const success = await create(user.id, {
      image_url: draftImage,
      link_url: draftLink.trim() || null,
    });
    setSaving(false);
    if (success) {
      setDraftImage(null);
      setDraftLink('');
      toast.success('Banner adicionado');
    } else {
      toast.error('Erro ao salvar banner');
    }
  };

  const handleDelete = async (banner: StorefrontMiniBanner) => {
    setBusyBannerId(banner.id);
    await deleteImage(banner.image_url).catch(() => {});
    const success = await remove(banner.id);
    setBusyBannerId(null);
    if (success) toast.success('Banner removido');
    else toast.error('Erro ao remover banner');
  };

  const handleToggleActive = async (banner: StorefrontMiniBanner) => {
    setBusyBannerId(banner.id);
    await update(banner.id, { is_active: !banner.is_active });
    setBusyBannerId(null);
  };

  const handleToggleEnabled = async () => {
    await saveAppearance({ mini_banners_enabled: !appearance.mini_banners_enabled });
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
      <div className="flex items-center gap-2">
        <Switch checked={appearance.mini_banners_enabled} onCheckedChange={handleToggleEnabled} />
        <span className="text-sm">{appearance.mini_banners_enabled ? 'Seção visível na loja' : 'Seção oculta na loja'}</span>
      </div>

      {!appearance.mini_banners_enabled ? null : (
      <>
      <div className="space-y-3">
        {banners.map((banner, index) => (
          <Card key={banner.id}>
            <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
              <img
                src={banner.image_url}
                alt=""
                className="w-full sm:w-28 aspect-[832/960] object-cover rounded border shrink-0"
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
          <h3 className="font-medium">Adicionar banner</h3>

          <div className="max-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Imagem (832x960)</Label>
            {draftImage && (
              <img src={draftImage} alt="" className="w-full aspect-[832/960] object-cover rounded border mb-2" />
            )}
            <input
              type="file"
              id="new-mini-banner"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
            <label htmlFor="new-mini-banner">
              <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                <span>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {draftImage ? 'Trocar' : 'Escolher imagem'}
                </span>
              </Button>
            </label>
          </div>

          <div>
            <BannerLinkField value={draftLink || null} onChange={(v) => setDraftLink(v || '')} />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveDraft} disabled={!draftImage || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Adicionar banner
            </Button>
            {draftImage && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraftImage(null)}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {cropperOpen && selectedFile && (
        <ImageCropperBanner
          image={URL.createObjectURL(selectedFile)}
          onCrop={handleCropComplete}
          onCancel={() => {
            setCropperOpen(false);
            setSelectedFile(null);
          }}
          open={cropperOpen}
          aspectRatio={832 / 960}
        />
      )}
    </div>
  );
}
