import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ImageCropperBanner } from '@/components/ui/image-cropper-banner';
import { useAuth } from '@/contexts/AuthContext';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { uploadImage, getExtensionForBlob } from '@/lib/image';

const SOCIAL_FIELDS = [
  { key: 'facebook_url', label: 'Facebook', placeholder: 'https://facebook.com/sualoja' },
  { key: 'x_url', label: 'X (Twitter)', placeholder: 'https://x.com/sualoja' },
  { key: 'youtube_url', label: 'YouTube', placeholder: 'https://youtube.com/@sualoja' },
  { key: 'pinterest_url', label: 'Pinterest', placeholder: 'https://pinterest.com/sualoja' },
  { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/sualoja' },
  { key: 'tiktok_url', label: 'TikTok', placeholder: 'https://tiktok.com/@sualoja' },
] as const;

export function StorefrontFooterContentManager() {
  const { user, updateUser } = useAuth();
  const { appearance, loading, save } = useStorefrontAppearance(user?.id, 'eletronicos');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoCropperOpen, setLogoCropperOpen] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [draftLinkLabel, setDraftLinkLabel] = useState('');
  const [draftLinkUrl, setDraftLinkUrl] = useState('');

  if (loading) return null;

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
      const file = new File([croppedBlob], selectedLogoFile?.name || `footer-logo.${getExtensionForBlob(croppedBlob)}`, { type: croppedBlob.type });
      const url = await uploadImage(file, user.id, 'theme-footer-logo');
      await save({ footer_logo_url: url });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar imagem');
    } finally {
      setUploadingLogo(false);
      setSelectedLogoFile(null);
    }
  };

  const handleSocialBlur = async (key: (typeof SOCIAL_FIELDS)[number]['key'], value: string) => {
    const normalized = value.trim() || null;
    if (normalized === (user?.[key] ?? null)) return;
    await updateUser({ [key]: normalized });
  };

  const links = appearance.footer_institutional_links;

  const addLink = async () => {
    if (!draftLinkLabel.trim() || !draftLinkUrl.trim()) return;
    await save({ footer_institutional_links: [...links, { label: draftLinkLabel.trim(), url: draftLinkUrl.trim() }] });
    setDraftLinkLabel('');
    setDraftLinkUrl('');
  };

  const removeLink = (index: number) => {
    save({ footer_institutional_links: links.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Logo do rodapé (opcional)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Substitui o nome da loja por uma imagem no rodapé. Pode ser diferente da logo do cabeçalho.
        </p>
        {appearance.footer_logo_url && (
          <div className="rounded p-3 mb-2 inline-block border bg-muted/30">
            <img src={appearance.footer_logo_url} alt="" className="h-10 w-auto object-contain" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="footer-logo-upload"
            accept="image/*"
            className="hidden"
            disabled={uploadingLogo}
            onChange={handleLogoFileChange}
          />
          <label htmlFor="footer-logo-upload">
            <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} asChild>
              <span>
                {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {appearance.footer_logo_url ? 'Trocar' : 'Enviar logo'}
              </span>
            </Button>
          </label>
          {appearance.footer_logo_url && (
            <Button type="button" variant="ghost" size="sm" onClick={() => save({ footer_logo_url: null })}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover
            </Button>
          )}
        </div>
      </div>

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

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Frase abaixo do nome/logo</Label>
        <Input
          defaultValue={appearance.footer_tagline ?? ''}
          onBlur={(e) => save({ footer_tagline: e.target.value || null })}
          placeholder={user?.bio || 'Usa a bio do perfil por padrão'}
          maxLength={160}
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Redes sociais</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Instagram e WhatsApp já usam o que está configurado no seu perfil. Preencha aqui só as demais redes —
          o ícone só aparece no rodapé se o campo estiver preenchido.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
              <Input
                defaultValue={user?.[key] || ''}
                onBlur={(e) => handleSocialBlur(key, e.target.value)}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Coluna "Institucional"</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Links que você quiser (Sobre Nós, Trocas e devoluções, Segurança...). Sem nenhum link cadastrado, a
          coluna não aparece.
        </p>
        <div className="space-y-2">
          {links.map((link, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="flex-1 text-sm truncate">
                <span className="font-medium">{link.label}</span>
                <span className="text-muted-foreground"> — {link.url}</span>
              </span>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={draftLinkLabel}
              onChange={(e) => setDraftLinkLabel(e.target.value)}
              placeholder="Nome (ex: Trocas e devoluções)"
              maxLength={40}
            />
            <Input
              value={draftLinkUrl}
              onChange={(e) => setDraftLinkUrl(e.target.value)}
              placeholder="https://..."
            />
            <Button type="button" variant="outline" size="sm" onClick={addLink} disabled={!draftLinkLabel.trim() || !draftLinkUrl.trim()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Coluna "Categorias"</span>
          <Switch
            checked={appearance.footer_categories_enabled}
            onCheckedChange={(v) => save({ footer_categories_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Coluna "Atendimento"</span>
          <Switch
            checked={appearance.footer_contact_enabled}
            onCheckedChange={(v) => save({ footer_contact_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Coluna "Formas de pagamento" / Selos</span>
          <Switch
            checked={appearance.footer_payment_enabled}
            onCheckedChange={(v) => save({ footer_payment_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Linha "Catálogo online por VitrineTurbo"</span>
          <Switch
            checked={appearance.footer_credit_enabled}
            onCheckedChange={(v) => save({ footer_credit_enabled: v })}
          />
        </div>
      </div>
    </div>
  );
}
