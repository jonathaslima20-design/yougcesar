import { useState, useRef, useCallback, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { supabase } from '@/lib/supabase';
import { uploadHeroMockupImage } from '@/lib/heroMockupUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Upload, X, Plus, RotateCcw } from 'lucide-react';
import { MockupRenderer } from '@/components/landing/mockups/MockupRenderer';
import { getMaxScrollForScreenType } from '@/components/landing/mockups/mockupScrollUtils';
import { FONT_OPTIONS, HEADING_FONT_OPTIONS, loadGoogleFont } from '@/lib/appearanceDefaults';
import { ImageCropperCover } from '@/components/ui/image-cropper-cover';
import { cn } from '@/lib/utils';
import type { HeroScreen } from '@/hooks/useLandingHeroScreens';

interface Props {
  screen: HeroScreen;
  isNew: boolean;
  onSave: (screen: HeroScreen) => void;
  onCancel: () => void;
}

const CROP_ASPECT_RATIOS: Record<string, number> = {
  cover_url: 960 / 860,
};

export function HeroScreenEditor({ screen, isNew, onSave, onCancel }: Props) {
  const [label, setLabel] = useState(screen.label);
  const [screenType] = useState(screen.screen_type);
  const [config, setConfig] = useState<Record<string, any>>(screen.config);
  const [displayOrder, setDisplayOrder] = useState(screen.display_order);
  const [scrollY, setScrollY] = useState(screen.scroll_y || 0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropField, setCropField] = useState<string | null>(null);

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleImageSelect = (field: string, file: File) => {
    if (CROP_ASPECT_RATIOS[field]) {
      const objectUrl = URL.createObjectURL(file);
      setCropImage(objectUrl);
      setCropField(field);
    } else {
      handleImageUpload(field, file);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const field = cropField!;
    setCropImage(null);
    setCropField(null);
    const file = new File([croppedBlob], 'cover.jpg', { type: 'image/jpeg' });
    await handleImageUpload(field, file);
  };

  const handleCropCancel = () => {
    if (cropImage) URL.revokeObjectURL(cropImage);
    setCropImage(null);
    setCropField(null);
  };

  const handleImageUpload = async (field: string, file: File) => {
    setUploading(field);
    try {
      const screenId = screen.id || 'new';
      const url = await uploadHeroMockupImage(file, screenId);
      updateConfig(field, url);
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload');
    } finally {
      setUploading(null);
    }
  };

  const handleProductImageUpload = async (index: number, file: File) => {
    setUploading(`product_${index}`);
    try {
      const screenId = screen.id || 'new';
      const url = await uploadHeroMockupImage(file, screenId);
      const products = [...(config.products || [])];
      products[index] = { ...products[index], image_url: url };
      updateConfig('products', products);
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!label.trim()) { toast.error('Informe um label para a tela'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const { data, error } = await supabase
          .from('landing_hero_screens')
          .insert({
            label,
            screen_type: screenType,
            config,
            display_order: displayOrder,
            scroll_y: scrollY,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      } else {
        const { error } = await supabase
          .from('landing_hero_screens')
          .update({ label, config, display_order: displayOrder, scroll_y: scrollY, updated_at: new Date().toISOString() })
          .eq('id', screen.id);

        if (error) throw error;
        onSave({ ...screen, label, config, display_order: displayOrder, scroll_y: scrollY });
      }
      toast.success('Tela salva!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-xl font-bold text-gray-900">
          {isNew ? 'Nova Tela' : `Editar: ${screen.label}`}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Form Column */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Informacoes Gerais</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome da tela" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem de Exibicao</Label>
                  <Input type="number" min={1} value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Tela</Label>
                <Input value={screenType} disabled className="bg-gray-50" />
              </div>
              <div className="space-y-1.5">
                <Label>URL exibida no navegador</Label>
                <Input
                  value={config.custom_url || ''}
                  onChange={(e) => updateConfig('custom_url', e.target.value)}
                  placeholder="Ex: vitrine.app/minha-loja"
                />
                <p className="text-xs text-gray-400">Deixe em branco para usar a URL automática baseada no tipo de tela.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Hora no relógio</Label>
                <Input
                  value={config.clock_time || ''}
                  onChange={(e) => updateConfig('clock_time', e.target.value)}
                  placeholder="9:41"
                />
                <p className="text-xs text-gray-400">Formato livre. Ex: 9:41, 14:30. Deixe em branco para usar 9:41.</p>
              </div>
            </CardContent>
          </Card>

          {/* Type-specific editor */}
          {screenType === 'storefront' && (
            <StorefrontEditor config={config} updateConfig={updateConfig} onImageUpload={handleImageSelect} onProductImageUpload={handleProductImageUpload} uploading={uploading} />
          )}
          {screenType === 'product_detail' && (
            <ProductDetailEditor
              config={config}
              updateConfig={updateConfig}
              onImageUpload={handleImageUpload}
              onGalleryImageUpload={async (index: number, file: File) => {
                setUploading(`product_gallery_${index}`);
                try {
                  const screenId = screen.id || 'new';
                  const { uploadHeroMockupImage: upload } = await import('@/lib/heroMockupUpload');
                  const url = await upload(file, screenId);
                  setConfig(prev => {
                    const imgs = [...(prev.product_images || ['', '', '', ''])];
                    while (imgs.length < 4) imgs.push('');
                    imgs[index] = url;
                    return { ...prev, product_images: imgs };
                  });
                  toast.success('Imagem enviada!');
                } catch (err: any) {
                  toast.error(err.message || 'Erro no upload');
                } finally {
                  setUploading(null);
                }
              }}
              uploading={uploading}
            />
          )}
          {screenType === 'dashboard' && (
            <DashboardEditor config={config} updateConfig={updateConfig} />
          )}
          {screenType === 'my_products' && (
            <MyProductsEditor config={config} updateConfig={updateConfig} onProductImageUpload={handleProductImageUpload} uploading={uploading} />
          )}
          {screenType === 'custom' && (
            <CustomEditor config={config} onImageUpload={handleImageUpload} uploading={uploading} />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Tela'}
            </Button>
          </div>
        </div>

        {/* Preview Column with Drag-to-Scroll */}
        <div className="lg:sticky lg:top-6 self-start">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Preview em tempo real</CardTitle>
              {scrollY > 0 && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-gray-500" onClick={() => setScrollY(0)}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <DraggableMockupPreview
                screenType={screenType}
                config={config}
                scrollY={scrollY}
                onScrollYChange={setScrollY}
              />
              <p className="text-[11px] text-gray-400 text-center">
                Arraste para cima/baixo para ajustar o scroll
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {cropImage && cropField && (
        <ImageCropperCover
          image={cropImage}
          aspectRatio={CROP_ASPECT_RATIOS[cropField]}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
          open={true}
        />
      )}
    </div>
  );
}

// --- Draggable Preview ---

function DraggableMockupPreview({
  screenType,
  config,
  scrollY,
  onScrollYChange,
}: {
  screenType: string;
  config: Record<string, any>;
  scrollY: number;
  onScrollYChange: (v: number) => void;
}) {
  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastY = useRef(0);
  const [dragging, setDragging] = useState(false);

  const maxScroll = getMaxScrollForScreenType(screenType, config);
  const previewScale = 220 / 393;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    lastY.current = e.clientY;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = lastY.current - e.clientY;
    lastY.current = e.clientY;
    const scaledDelta = deltaY / previewScale;
    onScrollYChange(Math.round(Math.max(0, Math.min(maxScroll, scrollY + scaledDelta))));
  }, [scrollY, maxScroll, previewScale, onScrollYChange]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    setDragging(false);
  }, []);

  return (
    <div
      ref={dragRef}
      className="relative select-none"
      style={{ width: 220, aspectRatio: '393/852', cursor: dragging ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius: '14% / 6.4%', background: '#1a1a1a', padding: '3.2%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
      >
        <div className="relative w-full h-full overflow-hidden bg-white" style={{ borderRadius: '9.5% / 4.4%' }}>
          <MockupRenderer screenType={screenType} config={config} scrollY={scrollY} />
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center justify-end"
            style={{ top: '1.6%', width: '32%', height: '4%', borderRadius: '50px', background: '#000', zIndex: 30, paddingRight: '10%' }}
          >
            <span className="block rounded-full" style={{ width: '18%', height: '52%', background: 'radial-gradient(circle at 38% 38%, #243040 0%, #08121c 55%, #000 100%)' }} />
          </div>
        </div>
      </div>

      {dragging && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap z-50">
          scroll: {scrollY}px
        </div>
      )}

      {dragging && (
        <div className="absolute inset-0 rounded-[14%/6.4%] border-2 border-blue-400/50 pointer-events-none z-40" />
      )}
    </div>
  );
}

// --- Sub-editors ---

function ImageUploadField({ label, value, field, onUpload, uploading }: { label: string; value: string; field: string; onUpload: (field: string, file: File) => void; uploading: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploading === field;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        {value && (
          <img src={value} alt="" className="w-10 h-10 rounded object-cover border" />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Enviando...' : <><Upload className="w-3 h-3 mr-1" /> Upload</>}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(field, file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

function MockupColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded-md border border-gray-200 shadow-sm shrink-0 transition-transform hover:scale-105"
          style={{ backgroundColor: value }}
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '') {
              onChange(v || '#000000');
            }
          }}
          className="h-8 text-xs font-mono"
          placeholder="#000000"
        />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-2 p-3 rounded-lg border bg-popover shadow-lg">
            <HexColorPicker color={value} onChange={onChange} />
          </div>
        </>
      )}
    </div>
  );
}

const SOCIAL_BUTTON_OPTIONS = [
  { value: 'cart', label: 'Carrinho' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'phone', label: 'Telefone' },
  { value: 'location', label: 'Localizacao' },
];

function StorefrontEditor({ config, updateConfig, onImageUpload, onProductImageUpload, uploading }: any) {
  const products = config.products || [];
  const socialButtons: string[] = config.social_buttons || [];

  const addProduct = () => {
    updateConfig('products', [...products, { title: 'Novo Produto', image_url: '', price: 99.90, discount_price: null }]);
  };

  const removeProduct = (i: number) => {
    updateConfig('products', products.filter((_: any, idx: number) => idx !== i));
  };

  const updateProduct = (i: number, key: string, value: any) => {
    const updated = [...products];
    updated[i] = { ...updated[i], [key]: value };
    updateConfig('products', updated);
  };

  const toggleSocialButton = (btn: string) => {
    if (socialButtons.includes(btn)) {
      updateConfig('social_buttons', socialButtons.filter((b: string) => b !== btn));
    } else {
      updateConfig('social_buttons', [...socialButtons, btn]);
    }
  };

  const handleFontChange = (field: string, value: string) => {
    loadGoogleFont(value);
    updateConfig(field, value);
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Perfil da Loja</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ImageUploadField label="Imagem de Capa" value={config.cover_url} field="cover_url" onUpload={onImageUpload} uploading={uploading} />
          <ImageUploadField label="Avatar" value={config.avatar_url} field="avatar_url" onUpload={onImageUpload} uploading={uploading} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome da Loja</Label>
              <Input value={config.store_name || ''} onChange={(e) => updateConfig('store_name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={config.category_name || ''} onChange={(e) => updateConfig('category_name', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Input value={config.bio || ''} onChange={(e) => updateConfig('bio', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Colors - same structure as AppearanceSettings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Cores</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <MockupColorPicker label="Cor do fundo" value={config.bg_color || '#ffffff'} onChange={(v) => updateConfig('bg_color', v)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MockupColorPicker label="Cor do texto" value={config.text_color || '#0a0a0a'} onChange={(v) => updateConfig('text_color', v)} />
            <MockupColorPicker label="Cor dos botoes" value={config.button_bg_color || '#0f172a'} onChange={(v) => updateConfig('button_bg_color', v)} />
            <MockupColorPicker label="Texto dos botoes" value={config.button_text_color || '#f8fafc'} onChange={(v) => updateConfig('button_text_color', v)} />
            <MockupColorPicker label="Cor dos icones" value={config.icon_color || '#0a0a0a'} onChange={(v) => updateConfig('icon_color', v)} />
            <MockupColorPicker label="Cor de destaque" value={config.accent_color || '#0f172a'} onChange={(v) => updateConfig('accent_color', v)} />
            <MockupColorPicker label="Cor das bordas" value={config.border_color || '#e4e4e7'} onChange={(v) => updateConfig('border_color', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tipografia</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fonte do corpo</Label>
            <Select value={config.font_family || 'Inter'} onValueChange={(v) => handleFontChange('font_family', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map(f => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fonte dos titulos</Label>
            <Select value={config.heading_font_family || 'Inter Tight'} onValueChange={(v) => handleFontChange('heading_font_family', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HEADING_FONT_OPTIONS.map(f => (
                  <SelectItem key={f.value} value={f.value}>
                    <span style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tamanho base</Label>
            <div className="flex gap-2">
              {(['sm', 'md', 'lg'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => updateConfig('font_size_base', size)}
                  className={cn(
                    'flex-1 py-2 rounded-md border text-sm font-medium transition-all',
                    (config.font_size_base || 'md') === size
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 hover:border-gray-400'
                  )}
                >
                  {size === 'sm' ? 'P' : size === 'md' ? 'M' : 'G'}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Buttons */}
      <Card>
        <CardHeader><CardTitle className="text-base">Botoes Sociais</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {SOCIAL_BUTTON_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => toggleSocialButton(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-all',
                  socialButtons.includes(opt.value)
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 hover:border-gray-400 text-gray-700'
                )}
              >
                <span className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center',
                  socialButtons.includes(opt.value) ? 'bg-white border-white' : 'border-gray-300'
                )}>
                  {socialButtons.includes(opt.value) && (
                    <svg className="w-3 h-3 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                  )}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Promotional Banner */}
      <Card>
        <CardHeader><CardTitle className="text-base">Banner Promocional</CardTitle></CardHeader>
        <CardContent>
          <ImageUploadField
            label="Banner (entre botoes sociais e produtos)"
            value={config.promotional_banner_url}
            field="promotional_banner_url"
            onUpload={onImageUpload}
            uploading={uploading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos ({products.length}/4)</CardTitle>
          {products.length < 4 && (
            <Button variant="outline" size="sm" onClick={addProduct}><Plus className="w-3 h-3 mr-1" /> Produto</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {products.map((p: any, i: number) => (
            <ProductItemEditor
              key={i}
              index={i}
              product={p}
              onUpdate={updateProduct}
              onRemove={removeProduct}
              onImageUpload={onProductImageUpload}
              uploading={uploading}
            />
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function ProductItemEditor({ index, product, onUpdate, onRemove, onImageUpload, uploading }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploading === `product_${index}`;

  return (
    <div className="p-3 rounded-lg border border-gray-200 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Produto {index + 1}</span>
        <Button variant="ghost" size="sm" className="text-red-500 h-6 w-6 p-0" onClick={() => onRemove(index)}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {product.image_url && <img src={product.image_url} alt="" className="w-8 h-8 rounded object-cover border" />}
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading}>
          {isUploading ? '...' : <><Upload className="w-3 h-3 mr-1" /> Img</>}
        </Button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImageUpload(index, f); e.target.value = ''; }} />
      </div>
      <Input value={product.title} onChange={(e) => onUpdate(index, 'title', e.target.value)} placeholder="Titulo" className="h-8 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" step="0.01" value={product.price} onChange={(e) => onUpdate(index, 'price', Number(e.target.value))} placeholder="Preco" className="h-8 text-sm" />
        <Input type="number" step="0.01" value={product.discount_price || ''} onChange={(e) => onUpdate(index, 'discount_price', e.target.value ? Number(e.target.value) : null)} placeholder="Preco desc." className="h-8 text-sm" />
      </div>
    </div>
  );
}

function ProductGalleryImageField({ index, value, uploading, onUpload }: { index: number; value: string; uploading: string | null; onUpload: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploading = uploading === `product_gallery_${index}`;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Foto {index + 1}</Label>
      <div
        className="relative aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden hover:border-gray-400 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <>
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </>
        ) : isUploading ? (
          <span className="text-xs text-gray-400">Enviando...</span>
        ) : (
          <>
            <Upload className="w-4 h-4 text-gray-400" />
            <span className="text-[10px] text-gray-400">Upload</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />
    </div>
  );
}

function ProductDetailEditor({ config, updateConfig, onImageUpload, onGalleryImageUpload, uploading }: any) {
  const colors = config.color_options || [];
  const sizes = config.size_options || [];
  const productImages: string[] = (() => {
    const imgs = [...(config.product_images || [])];
    while (imgs.length < 4) imgs.push('');
    return imgs.slice(0, 4);
  })();

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Produto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Fotos do Produto (até 4)</Label>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map(i => (
                <ProductGalleryImageField
                  key={i}
                  index={i}
                  value={productImages[i]}
                  uploading={uploading}
                  onUpload={(file) => onGalleryImageUpload(i, file)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Titulo</Label>
            <Input value={config.product_title || ''} onChange={(e) => updateConfig('product_title', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descricao</Label>
            <Input value={config.product_description || ''} onChange={(e) => updateConfig('product_description', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Preco</Label>
              <Input type="number" step="0.01" value={config.price || 0} onChange={(e) => updateConfig('price', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Preco Desc.</Label>
              <Input type="number" step="0.01" value={config.discount_price || ''} onChange={(e) => updateConfig('discount_price', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div className="space-y-1.5">
              <Label>Badge</Label>
              <Input value={config.discount_badge || ''} onChange={(e) => updateConfig('discount_badge', e.target.value)} placeholder="-33%" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Variantes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cores (hex separados por virgula)</Label>
            <Input
              value={colors.join(', ')}
              onChange={(e) => updateConfig('color_options', e.target.value.split(',').map((c: string) => c.trim()).filter(Boolean))}
              placeholder="#000000, #ffffff, #1e40af"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tamanhos (separados por virgula)</Label>
            <Input
              value={sizes.join(', ')}
              onChange={(e) => updateConfig('size_options', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
              placeholder="P, M, G, GG"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Texto do Botao</Label>
              <Input value={config.button_text || ''} onChange={(e) => updateConfig('button_text', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor do Botao</Label>
              <Input type="color" value={config.button_color || '#0f172a'} onChange={(e) => updateConfig('button_color', e.target.value)} className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Vendedor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ImageUploadField label="Avatar do Vendedor" value={config.seller_avatar_url} field="seller_avatar_url" onUpload={onImageUpload} uploading={uploading} />
          <div className="space-y-1.5">
            <Label>Nome do Vendedor</Label>
            <Input value={config.seller_name || ''} onChange={(e) => updateConfig('seller_name', e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function DashboardEditor({ config, updateConfig }: any) {
  const stats = config.stats || [];

  const addStat = () => {
    updateConfig('stats', [...stats, { label: 'Novo', value: '0', icon_name: 'Package' }]);
  };

  const removeStat = (i: number) => {
    updateConfig('stats', stats.filter((_: any, idx: number) => idx !== i));
  };

  const updateStat = (i: number, key: string, value: string) => {
    const updated = [...stats];
    updated[i] = { ...updated[i], [key]: value };
    updateConfig('stats', updated);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Dashboard</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nome do Usuario</Label>
            <Input value={config.user_name || ''} onChange={(e) => updateConfig('user_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Periodo</Label>
            <Input value={config.period_label || ''} onChange={(e) => updateConfig('period_label', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Cor Accent</Label>
          <Input type="color" value={config.accent_color || '#0f172a'} onChange={(e) => updateConfig('accent_color', e.target.value)} className="h-9 w-20" />
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <Label>Stats ({stats.length}/6)</Label>
            {stats.length < 6 && (
              <Button variant="outline" size="sm" onClick={addStat}><Plus className="w-3 h-3 mr-1" /> Stat</Button>
            )}
          </div>
          {stats.map((stat: any, i: number) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded border border-gray-200">
              <Input value={stat.label} onChange={(e) => updateStat(i, 'label', e.target.value)} placeholder="Label" className="h-7 text-xs flex-1" />
              <Input value={stat.value} onChange={(e) => updateStat(i, 'value', e.target.value)} placeholder="Valor" className="h-7 text-xs w-20" />
              <Select value={stat.icon_name} onValueChange={(v) => updateStat(i, 'icon_name', v)}>
                <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Package">Package</SelectItem>
                  <SelectItem value="TrendingUp">TrendingUp</SelectItem>
                  <SelectItem value="Users">Users</SelectItem>
                  <SelectItem value="DollarSign">DollarSign</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => removeStat(i)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MyProductsEditor({ config, updateConfig, onProductImageUpload, uploading }: any) {
  const products = config.products || [];

  const addProduct = () => {
    updateConfig('products', [...products, { title: 'Novo Produto', image_url: '', price: 99.90, views_count: 0, status: 'visible', stock_qty: 10 }]);
  };

  const removeProduct = (i: number) => {
    updateConfig('products', products.filter((_: any, idx: number) => idx !== i));
  };

  const updateProduct = (i: number, key: string, value: any) => {
    const updated = [...products];
    updated[i] = { ...updated[i], [key]: value };
    updateConfig('products', updated);
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Configuracao da Pagina</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Titulo</Label>
              <Input value={config.page_title || ''} onChange={(e) => updateConfig('page_title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Total de Produtos</Label>
              <Input type="number" value={config.product_count || 0} onChange={(e) => updateConfig('product_count', Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Modo de Visualizacao</Label>
            <Select value={config.view_mode || 'grid'} onValueChange={(v) => updateConfig('view_mode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="list">Lista</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Produtos ({products.length}/6)</CardTitle>
          {products.length < 6 && (
            <Button variant="outline" size="sm" onClick={addProduct}><Plus className="w-3 h-3 mr-1" /> Produto</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {products.map((p: any, i: number) => {
            const inputRef = useRef<HTMLInputElement>(null);
            const isUploading = uploading === `product_${i}`;
            return (
              <div key={i} className="p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Produto {i + 1}</span>
                  <Button variant="ghost" size="sm" className="text-red-500 h-6 w-6 p-0" onClick={() => removeProduct(i)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover border" />}
                  <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? '...' : <><Upload className="w-3 h-3 mr-1" /> Img</>}
                  </Button>
                  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onProductImageUpload(i, f); e.target.value = ''; }} />
                </div>
                <Input value={p.title} onChange={(e) => updateProduct(i, 'title', e.target.value)} placeholder="Titulo" className="h-8 text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" step="0.01" value={p.price} onChange={(e) => updateProduct(i, 'price', Number(e.target.value))} placeholder="Preco" className="h-8 text-sm" />
                  <Input type="number" value={p.views_count} onChange={(e) => updateProduct(i, 'views_count', Number(e.target.value))} placeholder="Views" className="h-8 text-sm" />
                  <Input type="number" value={p.stock_qty} onChange={(e) => updateProduct(i, 'stock_qty', Number(e.target.value))} placeholder="Estoque" className="h-8 text-sm" />
                </div>
                <Select value={p.status} onValueChange={(v) => updateProduct(i, 'status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visible">Visivel</SelectItem>
                    <SelectItem value="hidden">Oculto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

function CustomEditor({ config, onImageUpload, uploading }: any) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Tela Customizada</CardTitle></CardHeader>
      <CardContent>
        <ImageUploadField label="Imagem de Tela Inteira" value={config.image_url} field="image_url" onUpload={onImageUpload} uploading={uploading} />
        <p className="text-xs text-gray-500 mt-2">A imagem sera exibida em tela cheia dentro do mockup do celular.</p>
      </CardContent>
    </Card>
  );
}
