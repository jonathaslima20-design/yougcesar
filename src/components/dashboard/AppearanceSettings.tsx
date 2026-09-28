import { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Save, RotateCcw, ChevronDown, Lock, Palette, Type, Image, Upload, Trash2, PanelTop, PanelBottom, Loader2, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { useMockupData } from '@/hooks/useMockupData';
import { PhoneMockup } from '@/components/dashboard/PhoneMockup';
import { ImageCropperBanner } from '@/components/ui/image-cropper-banner';
import { uploadImage } from '@/lib/image';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { cn } from '@/lib/utils';
import { deriveColorsFromBase } from '@/utils/colorUtils';
import {
  DEFAULT_APPEARANCE,
  FONT_OPTIONS,
  HEADING_FONT_OPTIONS,
  loadGoogleFont,
  type StorefrontAppearance,
  type StorefrontThemeId,
} from '@/lib/appearanceDefaults';

interface AppearanceSettingsProps {
  themeId?: StorefrontThemeId;
}

export function AppearanceSettings({ themeId = 'padrao' }: AppearanceSettingsProps) {
  const { user } = useAuth();
  const { appearance, loading, save } = useStorefrontAppearance(user?.id, themeId);
  const mockupData = useMockupData();
  const [localAppearance, setLocalAppearance] = useState<StorefrontAppearance>(DEFAULT_APPEARANCE);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPremiumBlock, setShowPremiumBlock] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoCropperOpen, setLogoCropperOpen] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);

  const isFreePlan = user?.plan_status === 'free' || user?.plan_status === 'expired';

  useEffect(() => {
    if (!loading) {
      setLocalAppearance(appearance);
    }
  }, [loading, appearance]);

  const updateField = <K extends keyof StorefrontAppearance>(field: K, value: StorefrontAppearance[K]) => {
    setLocalAppearance(prev => {
      const next = { ...prev, [field]: value };
      const colorFields: (keyof StorefrontAppearance)[] = ['bg_color', 'text_color', 'button_bg_color', 'accent_color', 'border_color'];
      if (colorFields.includes(field as keyof StorefrontAppearance)) {
        const derived = deriveColorsFromBase(
          next.bg_color,
          next.text_color,
          next.button_bg_color,
          next.accent_color,
          next.border_color,
        );
        return { ...next, ...derived };
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (isFreePlan) {
      setShowPremiumBlock(true);
      return;
    }
    setSaving(true);
    const { id, user_id, ...data } = localAppearance as StorefrontAppearance & { id?: string; user_id?: string };
    const success = await save(data);
    if (success) {
      logActivity('appearance.update', 'Alterou a aparência da vitrine', 'appearance');
      toast.success('Aparência salva com sucesso!');
      setHasChanges(false);
    } else {
      toast.error('Erro ao salvar aparencia');
    }
    setSaving(false);
  };

  const handleReset = async () => {
    setLocalAppearance(DEFAULT_APPEARANCE);
    setHasChanges(true);
    toast.info('Aparência restaurada para o padrão. Clique em Salvar para confirmar.');
  };

  const handleFontChange = (field: 'font_family' | 'heading_font_family', value: string) => {
    loadGoogleFont(value);
    updateField(field, value);
  };

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
      const file = new File([croppedBlob], selectedLogoFile?.name || 'header-logo.jpg', { type: 'image/jpeg' });
      const url = await uploadImage(file, user.id, 'theme-header-logo');
      updateField('header_logo_url', url);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploadingLogo(false);
      setSelectedLogoFile(null);
    }
  };

  const updateTopBarPhrase = (index: number, value: string) => {
    const next = [...localAppearance.top_bar_phrases];
    next[index] = value;
    updateField('top_bar_phrases', next);
  };

  const removeTopBarPhrase = (index: number) => {
    updateField('top_bar_phrases', localAppearance.top_bar_phrases.filter((_, i) => i !== index));
  };

  const addTopBarPhrase = () => {
    updateField('top_bar_phrases', [...localAppearance.top_bar_phrases, '']);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (showPremiumBlock) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Funcionalidade Premium</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              A personalização de aparência está disponível apenas para planos pagos. Faça upgrade para aplicar cores, fontes e estilos exclusivos à sua vitrine.
            </p>
            <Button
              onClick={() => {
                const event = new CustomEvent('open-subscription-modal');
                window.dispatchEvent(event);
              }}
            >
              Fazer Upgrade
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-8', themeId === 'padrao' && 'lg:grid-cols-[1fr,auto]')}>
      {/* Controls Panel */}
      <div className="space-y-4 order-2 lg:order-1">
        {/* Colors Section — only applies to "padrao": every rule that reads these
            tokens (card, badge, icon, accent, border...) is scoped `.theme-padrao`
            in index.css, so on "eletronicos" none of these fields do anything. */}
        {themeId === 'padrao' && (
          <CollapsibleSection
            icon={<Palette size={16} />}
            title="Cores"
            defaultOpen
          >
            <div className="space-y-5">
              {/* Background color */}
              <div>
                <ColorPicker
                  label="Cor do fundo"
                  value={localAppearance.bg_color}
                  onChange={(v) => updateField('bg_color', v)}
                  disabled={false}
                />

              </div>

              {/* Core colors grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ColorPicker label="Cor do texto" value={localAppearance.text_color} onChange={(v) => updateField('text_color', v)} disabled={false} />
                <ColorPicker label="Cor dos botões" value={localAppearance.button_bg_color} onChange={(v) => updateField('button_bg_color', v)} disabled={false} />
                <ColorPicker label="Texto dos botões" value={localAppearance.button_text_color} onChange={(v) => updateField('button_text_color', v)} disabled={false} />
                <ColorPicker label="Cor dos ícones" value={localAppearance.icon_color} onChange={(v) => updateField('icon_color', v)} disabled={false} />
                <ColorPicker label="Cor de destaque" value={localAppearance.accent_color} onChange={(v) => updateField('accent_color', v)} disabled={false} />
                <ColorPicker label="Cor das bordas" value={localAppearance.border_color} onChange={(v) => updateField('border_color', v)} disabled={false} />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Eletrônicos-only chrome: every field here maps to an element this theme
            actually renders — dark header/topbar/nav/footer, the announcement
            phrase, and the search/"Ofertas Especiais" buttons in the header. */}
        {themeId === 'eletronicos' && (
          <CollapsibleSection
            icon={<PanelTop size={16} />}
            title="Cabeçalho, menu e rodapé"
            defaultOpen
          >
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">Frases do topo</Label>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={localAppearance.top_bar_enabled}
                      onCheckedChange={(v) => updateField('top_bar_enabled', v)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {localAppearance.top_bar_enabled ? 'Visível' : 'Oculta'}
                    </span>
                  </div>
                </div>
                {localAppearance.top_bar_enabled && (
                  <div className="space-y-2">
                    {localAppearance.top_bar_phrases.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Sem frases cadastradas — mostra "Fale com a gente pelo WhatsApp" por padrão.
                      </p>
                    )}
                    {localAppearance.top_bar_phrases.map((phrase, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={phrase}
                          onChange={(e) => updateTopBarPhrase(index, e.target.value)}
                          placeholder="Ex: Frete grátis acima de R$ 200"
                          maxLength={120}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTopBarPhrase(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addTopBarPhrase}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar frase
                    </Button>
                    {localAppearance.top_bar_phrases.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Com mais de uma frase, elas alternam automaticamente no topo da loja.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Logo retangular (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Substitui a foto de perfil (circular) no cabeçalho por uma logo retangular.
                </p>
                {localAppearance.header_logo_url && (
                  <div className="bg-neutral-900 rounded p-2 mb-2 inline-block">
                    <img src={localAppearance.header_logo_url} alt="" className="h-10 w-auto object-contain" />
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
                        {localAppearance.header_logo_url ? 'Trocar' : 'Enviar logo'}
                      </span>
                    </Button>
                  </label>
                  {localAppearance.header_logo_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => updateField('header_logo_url', null)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-muted-foreground">Tamanho da logo</Label>
                  <span className="text-xs text-muted-foreground">{localAppearance.header_logo_scale ?? 100}%</span>
                </div>
                <Slider
                  value={[localAppearance.header_logo_scale ?? 100]}
                  onValueChange={([v]) => updateField('header_logo_scale', v)}
                  min={50}
                  max={200}
                  step={5}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ColorPicker
                  label="Cor da seção (cabeçalho/rodapé)"
                  value={localAppearance.header_bg_color}
                  onChange={(v) => updateField('header_bg_color', v)}
                  disabled={false}
                />
                <ColorPicker
                  label="Cor do texto"
                  value={localAppearance.header_text_color}
                  onChange={(v) => updateField('header_text_color', v)}
                  disabled={false}
                />
                <ColorPicker
                  label="Cor do botão (busca / Ofertas Especiais)"
                  value={localAppearance.button_bg_color}
                  onChange={(v) => updateField('button_bg_color', v)}
                  disabled={false}
                />
                <ColorPicker
                  label="Cor do texto/ícone do botão"
                  value={localAppearance.button_text_color}
                  onChange={(v) => updateField('button_text_color', v)}
                  disabled={false}
                />
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Eletrônicos-only footer controls: which columns show, the credit line,
            and a footer-specific tagline (falls back to the profile bio). */}
        {themeId === 'eletronicos' && (
          <CollapsibleSection
            icon={<PanelBottom size={16} />}
            title="Rodapé"
          >
            <div className="space-y-5">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Frase abaixo do nome da loja</Label>
                <Input
                  value={localAppearance.footer_tagline ?? ''}
                  onChange={(e) => updateField('footer_tagline', e.target.value || null)}
                  placeholder={user?.bio || 'Usa a bio do perfil por padrão'}
                  maxLength={160}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Coluna "Categorias"</span>
                  <Switch
                    checked={localAppearance.footer_categories_enabled}
                    onCheckedChange={(v) => updateField('footer_categories_enabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Coluna "Atendimento"</span>
                  <Switch
                    checked={localAppearance.footer_contact_enabled}
                    onCheckedChange={(v) => updateField('footer_contact_enabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Coluna "Formas de pagamento" / Selos</span>
                  <Switch
                    checked={localAppearance.footer_payment_enabled}
                    onCheckedChange={(v) => updateField('footer_payment_enabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Linha "Catálogo online por VitrineTurbo"</span>
                  <Switch
                    checked={localAppearance.footer_credit_enabled}
                    onCheckedChange={(v) => updateField('footer_credit_enabled', v)}
                  />
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Typography Section — only "padrao" markup reads --sf-font/--sf-font-heading */}
        {themeId === 'padrao' && (
          <CollapsibleSection
            icon={<Type size={16} />}
            title="Tipografia"
          >
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Fonte do corpo</Label>
                <Select
                  value={localAppearance.font_family}
                  onValueChange={(v) => handleFontChange('font_family', v)}
                  disabled={false}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Fonte dos títulos</Label>
                <Select
                  value={localAppearance.heading_font_family}
                  onValueChange={(v) => handleFontChange('heading_font_family', v)}
                  disabled={false}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEADING_FONT_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Tamanho base</Label>
                <div className="flex gap-2">
                  {(['sm', 'md', 'lg'] as const).map(size => (
                    <button
                      key={size}
                      disabled={false}
                      onClick={() => updateField('font_size_base', size)}
                      className={cn(
                        'flex-1 py-2 rounded-md border text-sm font-medium transition-all',
                        localAppearance.font_size_base === size
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {size === 'sm' ? 'P' : size === 'md' ? 'M' : 'G'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Footer Logo Section - "padrao" only, annual plan only */}
        {themeId === 'padrao' && user?.billing_cycle === 'annually' && user?.plan_status === 'active' && (
          <CollapsibleSection
            icon={<Image size={16} />}
            title="Logomarca do Rodapé"
          >
            <FooterLogoEditor
              mode={localAppearance.footer_logo_mode}
              logoFormat={localAppearance.footer_logo_format}
              logoUrl={localAppearance.custom_logo_url}
              userId={user.id}
              onModeChange={(mode) => updateField('footer_logo_mode', mode)}
              onFormatChange={(fmt) => updateField('footer_logo_format', fmt)}
              onLogoUrlChange={(url) => updateField('custom_logo_url', url)}
            />
          </CollapsibleSection>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-card pb-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={false}
            className="gap-2"
          >
            <RotateCcw size={14} />
            Restaurar padrão
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-2 flex-1"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </div>

      </div>

      {/* Phone Mockup (sticky on desktop) — only represents the "padrao" layout */}
      {themeId === 'padrao' && (
        <div className="order-1 lg:order-2 lg:sticky lg:top-8 lg:self-start">
          <div className="flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-3 font-medium">Preview em tempo real</p>
            <PhoneMockup
              appearance={localAppearance}
              name={mockupData.name}
              bio={mockupData.bio}
              avatar_url={mockupData.avatar_url}
              cover_url_mobile={mockupData.cover_url_mobile}
              promotional_banner_url_mobile={mockupData.promotional_banner_url_mobile}
              whatsapp={mockupData.whatsapp}
              instagram={mockupData.instagram}
              phone={mockupData.phone}
              location={mockupData.location}
              products={mockupData.products}
              categoryName={mockupData.categoryName}
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
    </div>
  );
}

// --- Sub-components ---

function CollapsibleSection({
  icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 text-sm font-medium">
            {icon}
            {title}
          </div>
          <ChevronDown
            size={16}
            className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pt-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', disabled && 'opacity-50 pointer-events-none')}>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded-md border border-border shadow-sm shrink-0 transition-transform hover:scale-105"
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
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 p-3 rounded-lg border bg-popover shadow-lg">
            <HexColorPicker color={value} onChange={onChange} />
          </div>
        </>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn(disabled && 'opacity-50 pointer-events-none')}>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FooterLogoEditor({
  mode,
  logoFormat,
  logoUrl,
  userId,
  onModeChange,
  onFormatChange,
  onLogoUrlChange,
}: {
  mode: 'default' | 'hidden' | 'custom';
  logoFormat: 'rectangular' | 'square';
  logoUrl: string | null;
  userId: string;
  onModeChange: (mode: 'default' | 'hidden' | 'custom') => void;
  onFormatChange: (fmt: 'rectangular' | 'square') => void;
  onLogoUrlChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 500KB.');
      return;
    }

    const allowedTypes = ['image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato invalido. Use PNG, SVG ou WebP.');
      return;
    }

    setUploading(true);
    try {
      const { uploadImage } = await import('@/lib/image');
      const url = await uploadImage(file, userId, 'footer-logos');
      onLogoUrlChange(url);
      toast.success('Logo carregada com sucesso!');
    } catch {
      toast.error('Erro ao carregar a logo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (logoUrl) {
      try {
        const { deleteImage } = await import('@/lib/image');
        await deleteImage(logoUrl);
      } catch {
        // ignore deletion errors
      }
    }
    onLogoUrlChange(null);
    onModeChange('default');
  };

  const options: { value: 'default' | 'hidden' | 'custom'; label: string; description: string }[] = [
    { value: 'default', label: 'Exibir logo VitrineTurbo', description: 'Logo e frase padrão no rodapé' },
    { value: 'hidden', label: 'Ocultar logo e frase', description: 'Somente links de privacidade permanecem' },
    { value: 'custom', label: 'Usar logo personalizada', description: 'Carregue sua própria logomarca' },
  ];

  const formatOptions: { value: 'rectangular' | 'square'; label: string; dimensions: string; aspect: string }[] = [
    { value: 'rectangular', label: 'Retangular', dimensions: '160x40px', aspect: '4/1' },
    { value: 'square', label: 'Quadrada', dimensions: '160x160px', aspect: '1/1' },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onModeChange(opt.value)}
            className={cn(
              'w-full text-left p-3 rounded-lg border transition-all',
              mode === opt.value
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:border-primary/40'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                mode === opt.value ? 'border-primary' : 'border-muted-foreground/40'
              )}>
                {mode === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {mode === 'custom' && (
        <div className="space-y-4 pt-2 border-t">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Formato da logo</Label>
            <div className="grid grid-cols-2 gap-2">
              {formatOptions.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => onFormatChange(fmt.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                    logoFormat === fmt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <div
                    className={cn(
                      'border-2 border-dashed rounded',
                      logoFormat === fmt.value ? 'border-primary/60' : 'border-muted-foreground/30'
                    )}
                    style={{
                      width: fmt.value === 'rectangular' ? '64px' : '36px',
                      height: fmt.value === 'rectangular' ? '16px' : '36px',
                    }}
                  />
                  <div className="text-center">
                    <p className="text-xs font-medium">{fmt.label}</p>
                    <p className="text-[10px] text-muted-foreground">{fmt.dimensions}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            PNG com fundo transparente, {logoFormat === 'rectangular' ? '160x40px' : '160x160px'}. Tamanho máximo: 500KB.
          </p>

          {logoUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <img
                src={logoUrl}
                alt="Logo personalizada"
                className="max-w-[160px] object-contain"
                style={{ height: logoFormat === 'rectangular' ? '72px' : '96px' }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveLogo}
                className="ml-auto text-destructive hover:text-destructive"
              >
                <Trash2 size={14} className="mr-1" />
                Remover
              </Button>
            </div>
          ) : (
            <label className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
              uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50 hover:bg-muted/30'
            )}>
              <Upload size={20} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {uploading ? 'Carregando...' : 'Clique para carregar sua logo'}
              </span>
              <input
                type="file"
                accept="image/png,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
