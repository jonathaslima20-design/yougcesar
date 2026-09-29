import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { useStorefrontCategoryImages } from '@/hooks/useStorefrontCategoryImages';
import { useProductFilterMetadata } from '@/hooks/useProductFilterMetadata';
import { uploadImage } from '@/lib/image';

// Category circles are shown at ~80px, so a raw upload (often 1000-1600px, hundreds
// of KB) is pure waste. Center-crop to a square and downscale to 400px (still sharp
// on 2x screens) as WebP before uploading. Falls back to the original file if the
// browser can't decode/encode it. Only used by this theme's category images.
const CATEGORY_IMAGE_SIZE = 400;

async function toCategoryThumbnail(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const target = Math.min(side, CATEGORY_IMAGE_SIZE);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, target, target);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob || blob.type !== 'image/webp') return file;
    return new File([blob], `category.webp`, { type: 'image/webp' });
  } catch {
    return file;
  }
}

export function StorefrontCategoryShowcaseManager() {
  const { user } = useAuth();
  const { appearance, loading: appearanceLoading, save } = useStorefrontAppearance(user?.id, 'eletronicos');
  const { loading: imagesLoading, getImage, setImage, removeImage } = useStorefrontCategoryImages(user?.id);
  const { metadata, loading: categoriesLoading } = useProductFilterMetadata({ userId: user?.id || '', enabled: !!user?.id });

  const [title, setTitle] = useState('');
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!appearanceLoading) setTitle(appearance.category_showcase_title || '');
  }, [appearanceLoading, appearance.category_showcase_title]);

  const handleToggleEnabled = async () => {
    await save({ category_showcase_enabled: !appearance.category_showcase_enabled });
  };

  const handleTitleBlur = async () => {
    const normalized = title.trim() || null;
    if (normalized === appearance.category_showcase_title) return;
    await save({ category_showcase_title: normalized });
  };

  const handleUpload = (category: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    setUploadingCategory(category);
    try {
      const url = await uploadImage(await toCategoryThumbnail(file), user.id, 'theme-category-images');
      const success = await setImage(user.id, category, url);
      if (success) toast.success('Imagem da categoria atualizada');
      else toast.error('Erro ao salvar imagem');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploadingCategory(null);
    }
  };

  const handleRemoveOverride = async (category: string) => {
    if (!user?.id) return;
    setUploadingCategory(category);
    const success = await removeImage(user.id, category);
    setUploadingCategory(null);
    if (success) toast.success('Voltou a usar a imagem automática');
  };

  const loading = appearanceLoading || imagesLoading || categoriesLoading;

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
        <Switch checked={appearance.category_showcase_enabled} onCheckedChange={handleToggleEnabled} />
        <span className="text-sm">{appearance.category_showcase_enabled ? 'Seção visível na loja' : 'Seção oculta na loja'}</span>
      </div>

      {appearance.category_showcase_enabled && (
        <>
          <div className="max-w-sm">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Título da seção</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Navegue por Categorias"
              maxLength={60}
            />
          </div>

          {metadata.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não tem categorias cadastradas nos produtos.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {metadata.categories.map((category) => {
                const customImage = getImage(category);
                const isBusy = uploadingCategory === category;
                const inputId = `category-image-${category}`;
                return (
                  <Card key={category}>
                    <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
                      <span className="h-16 w-16 rounded-full overflow-hidden bg-muted border flex items-center justify-center">
                        {customImage ? (
                          <img src={customImage} alt={category} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground px-1">Imagem automática</span>
                        )}
                      </span>
                      <span className="text-xs font-medium leading-tight">{category}</span>

                      <input
                        type="file"
                        id={inputId}
                        accept="image/*"
                        className="hidden"
                        disabled={isBusy}
                        onChange={handleUpload(category)}
                      />
                      <label htmlFor={inputId} className="w-full">
                        <Button type="button" variant="outline" size="sm" className="w-full" disabled={isBusy} asChild>
                          <span>
                            {isBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                            {customImage ? 'Trocar' : 'Enviar imagem'}
                          </span>
                        </Button>
                      </label>

                      {customImage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-muted-foreground"
                          disabled={isBusy}
                          onClick={() => handleRemoveOverride(category)}
                        >
                          <X className="mr-1 h-3 w-3" /> Usar automática
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
