import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImage, deleteImage, getExtensionForBlob } from '@/lib/image';
import { ImageCropperBanner } from '@/components/ui/image-cropper-banner';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';

type Slot = 'desktop' | 'mobile';

const SLOTS: Record<Slot, { label: string; hint: string; ratio: number; aspectClass: string; field: 'feature_banner_desktop_url' | 'feature_banner_mobile_url'; folder: string }> = {
  desktop: {
    label: 'Imagem desktop',
    hint: 'Recomendado 2580x600 (proporção 4,3:1). Em 1290x300 fica menos nítida em telas retina.',
    ratio: 1290 / 300,
    aspectClass: 'aspect-[1290/300]',
    field: 'feature_banner_desktop_url',
    folder: 'theme-feature-banner-desktop',
  },
  mobile: {
    label: 'Imagem mobile',
    hint: 'Recomendado 1600x1200 (proporção 4:3), pensada para o celular.',
    ratio: 4 / 3,
    aspectClass: 'aspect-[4/3]',
    field: 'feature_banner_mobile_url',
    folder: 'theme-feature-banner-mobile',
  },
};

export function StorefrontFeatureBannerManager() {
  const { user } = useAuth();
  const { appearance, loading, save } = useStorefrontAppearance(user?.id, 'eletronicos');

  const [uploadingSlot, setUploadingSlot] = useState<Slot | null>(null);
  const [cropperSlot, setCropperSlot] = useState<Slot | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (slot: Slot) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    setSelectedFile(file);
    setCropperSlot(slot);
  };

  const handleCropComplete = async (croppedBlob: Blob, slot: Slot) => {
    if (!user?.id) return;
    const { field, folder } = SLOTS[slot];
    const previousUrl = appearance[field];
    try {
      setUploadingSlot(slot);
      setCropperSlot(null);
      const file = new File([croppedBlob], selectedFile?.name || `feature-banner-${slot}.${getExtensionForBlob(croppedBlob)}`, { type: croppedBlob.type });
      const url = await uploadImage(file, user.id, folder);
      const ok = await save({ [field]: url });
      if (!ok) {
        toast.error('Erro ao salvar banner');
        return;
      }
      if (previousUrl) await deleteImage(previousUrl).catch(() => {});
    } catch (error: any) {
      console.error('Error uploading feature banner image:', error);
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploadingSlot(null);
      setSelectedFile(null);
    }
  };

  const handleRemove = async (slot: Slot) => {
    const { field } = SLOTS[slot];
    const url = appearance[field];
    if (!url) return;
    const ok = await save({ [field]: null });
    if (!ok) {
      toast.error('Erro ao remover imagem');
      return;
    }
    await deleteImage(url).catch(() => {});
  };

  const handleLinkBlur = async (value: string) => {
    const normalized = value.trim() || null;
    if (normalized === appearance.feature_banner_link_url) return;
    const ok = await save({ feature_banner_link_url: normalized });
    if (!ok) toast.error('Erro ao salvar link');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Switch
          checked={appearance.feature_banner_enabled}
          onCheckedChange={(checked) => save({ feature_banner_enabled: checked })}
        />
        <span className="text-sm">{appearance.feature_banner_enabled ? 'Seção visível na loja' : 'Seção oculta na loja'}</span>
      </div>

      {appearance.feature_banner_enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(SLOTS) as Slot[]).map((slot) => {
              const config = SLOTS[slot];
              const url = appearance[config.field];
              const busy = uploadingSlot === slot;
              return (
                <div key={slot}>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">{config.label}</Label>
                  {url ? (
                    <img src={url} alt="" className={`w-full ${config.aspectClass} object-cover rounded border mb-2`} />
                  ) : (
                    <div className={`w-full ${config.aspectClass} rounded border border-dashed bg-muted/40 mb-2 flex items-center justify-center text-xs text-muted-foreground`}>
                      Sem imagem
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mb-2">{config.hint}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id={`feature-banner-${slot}`}
                      accept="image/*"
                      onChange={handleFileChange(slot)}
                      className="hidden"
                      disabled={busy}
                    />
                    <label htmlFor={`feature-banner-${slot}`}>
                      <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
                        <span>
                          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                          {url ? 'Trocar' : 'Escolher imagem'}
                        </span>
                      </Button>
                    </label>
                    {url && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(slot)} disabled={busy}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Link ao clicar (opcional)</Label>
            <Input
              defaultValue={appearance.feature_banner_link_url || ''}
              placeholder="https://..."
              onBlur={(e) => handleLinkBlur(e.target.value)}
            />
          </div>

          {!appearance.feature_banner_desktop_url && !appearance.feature_banner_mobile_url && (
            <p className="text-xs text-muted-foreground">
              Enquanto nenhuma imagem for enviada, a seção fica oculta na loja. Se enviar só uma, ela é usada nos dois tamanhos de tela.
            </p>
          )}
        </>
      )}

      {cropperSlot && selectedFile && (
        <ImageCropperBanner
          image={URL.createObjectURL(selectedFile)}
          onCrop={(blob) => handleCropComplete(blob, cropperSlot)}
          onCancel={() => {
            setCropperSlot(null);
            setSelectedFile(null);
          }}
          open={!!cropperSlot}
          aspectRatio={SLOTS[cropperSlot].ratio}
        />
      )}
    </div>
  );
}
