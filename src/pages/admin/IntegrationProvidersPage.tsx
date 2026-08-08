import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, Upload, Loader as Loader2, Boxes, GripVertical, Image as ImageIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface IntegrationProvider {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  is_enabled: boolean;
  sort_order: number;
}

const LOGO_FOLDER = 'integration-logos';

// Supabase client errors (PostgrestError, StorageError) are plain objects with
// a `message` field — they don't extend the JS `Error` class, so a naive
// `error instanceof Error` check silently swallows the real reason (RLS
// denial, unique violation, missing table) and falls back to a generic
// message. This pulls `.message` off anything that has one.
function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function IntegrationProvidersPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IntegrationProvider | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    setLoading(true);
    const { data, error } = await supabase
      .from('integration_providers')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      toast.error(getErrorMessage(error, 'Erro ao carregar integrações'));
    } else {
      setProviders(data || []);
    }
    setLoading(false);
  }

  async function handleToggleEnabled(provider: IntegrationProvider, checked: boolean) {
    setProviders((prev) => prev.map((p) => (p.id === provider.id ? { ...p, is_enabled: checked } : p)));
    const { error } = await supabase
      .from('integration_providers')
      .update({ is_enabled: checked })
      .eq('id', provider.id);
    if (error) {
      toast.error(getErrorMessage(error, 'Erro ao atualizar'));
      setProviders((prev) => prev.map((p) => (p.id === provider.id ? { ...p, is_enabled: !checked } : p)));
    } else {
      toast.success(checked ? `${provider.name} agora aparece para os lojistas` : `${provider.name} ocultada dos lojistas`);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('integration_providers').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error(getErrorMessage(error, 'Erro ao excluir integração'));
    } else {
      toast.success('Integração excluída');
      setProviders((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl page-title">Integrações</h1>
          <p className="text-muted-foreground">
            Controle quais sistemas de gestão (ERP) aparecem para os lojistas em Configurações → Integrações,
            e configure o nome/logo de cada um.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nova Integração
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : providers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Boxes className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Nenhuma integração cadastrada ainda</p>
            <Button variant="outline" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />
              Criar primeira integração
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 hidden sm:block" />

                <div className="h-11 w-11 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {provider.logo_url ? (
                    <img src={provider.logo_url} alt={provider.name} className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <Boxes className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{provider.name}</p>
                    <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {provider.slug}
                    </code>
                  </div>
                  {provider.description && (
                    <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant={provider.is_enabled ? 'default' : 'outline'} className={provider.is_enabled ? 'bg-green-500 text-white' : undefined}>
                    {provider.is_enabled ? 'Visível' : 'Oculta'}
                  </Badge>
                  <Switch
                    checked={provider.is_enabled}
                    onCheckedChange={(checked) => handleToggleEnabled(provider, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(provider);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(provider)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProviderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editing}
        adminUserId={user?.id}
        onSaved={() => {
          setDialogOpen(false);
          loadProviders();
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A integração some da lista e do painel dos lojistas. Se algum lojista já estiver conectado, a
              sincronização em segundo plano continua funcionando, mas ele perde o acesso à tela de configuração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: IntegrationProvider | null;
  adminUserId?: string;
  onSaved: () => void;
}

function ProviderFormDialog({ open, onOpenChange, provider, adminUserId, onSaved }: ProviderFormDialogProps) {
  const isEditing = !!provider;
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlug(provider?.slug || '');
    setName(provider?.name || '');
    setDescription(provider?.description || '');
    setLogoUrl(provider?.logo_url || null);
    setIsEnabled(provider?.is_enabled ?? false);
    setSortOrder(provider?.sort_order ?? 0);
  }, [open, provider]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !adminUserId) return;

    if (file.size > 500 * 1024) {
      toast.error('Arquivo muito grande. Tamanho máximo: 500KB.');
      return;
    }
    const allowedTypes = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, SVG, WebP ou JPEG.');
      return;
    }

    setUploading(true);
    try {
      const { uploadImage } = await import('@/lib/image');
      const url = await uploadImage(file, adminUserId, LOGO_FOLDER);
      setLogoUrl(url);
    } catch {
      toast.error('Erro ao carregar a logo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleRemoveLogo() {
    if (logoUrl) {
      try {
        const { deleteImage } = await import('@/lib/image');
        await deleteImage(logoUrl);
      } catch {
        // ignore — the row is what matters, an orphaned file in storage is harmless
      }
    }
    setLogoUrl(null);
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedSlug = slugify(slug);

    if (!trimmedName) {
      toast.error('Informe o nome da integração.');
      return;
    }
    if (!trimmedSlug) {
      toast.error('Informe um identificador (slug) para a integração.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && provider) {
        const { error } = await supabase
          .from('integration_providers')
          .update({
            name: trimmedName,
            description: description.trim() || null,
            logo_url: logoUrl,
            is_enabled: isEnabled,
            sort_order: sortOrder,
          })
          .eq('id', provider.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('integration_providers').insert({
          slug: trimmedSlug,
          name: trimmedName,
          description: description.trim() || null,
          logo_url: logoUrl,
          is_enabled: isEnabled,
          sort_order: sortOrder,
        });
        if (error) throw error;
      }
      toast.success('Integração salva com sucesso');
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erro ao salvar integração'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Integração' : 'Nova Integração'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Ajuste como esta integração aparece para os lojistas.'
              : 'Cadastre um novo sistema. Se ainda não houver conector pronto, deixe desativado até estar disponível.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Logo</Label>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden border">
                {logoUrl ? (
                  <img src={logoUrl} alt={name} className="h-full w-full object-contain p-1.5" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border cursor-pointer transition-colors',
                  uploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50 hover:bg-muted/30'
                )}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Carregando...' : logoUrl ? 'Trocar logo' : 'Carregar logo'}
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs text-destructive hover:underline text-left"
                  >
                    Remover logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              PNG, SVG ou WebP, formato retangular (ex: 400x225px) fica melhor no card. Máximo 500KB.
            </p>
          </div>

          <div>
            <Label htmlFor="provider-name">Nome</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!isEditing) setSlug(slugify(e.target.value));
              }}
              placeholder="Ex: Olist ERP (Tiny), Bling"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="provider-slug">Identificador (slug)</Label>
            <Input
              id="provider-slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="Ex: olist, bling"
              className="mt-1.5 font-mono text-xs"
              disabled={isEditing}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {isEditing
                ? 'Não pode ser alterado depois de criado.'
                : 'Usado internamente para ligar este cartão ao conector correspondente.'}
            </p>
          </div>

          <div>
            <Label htmlFor="provider-description">Descrição curta</Label>
            <Textarea
              id="provider-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Estoque e produtos"
              className="mt-1.5"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Visível para os lojistas</Label>
              <p className="text-xs text-muted-foreground">Aparece na aba Integrações do painel.</p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
