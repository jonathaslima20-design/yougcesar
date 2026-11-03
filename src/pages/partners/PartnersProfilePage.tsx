import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, ExternalLink, ImageUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartner } from '@/contexts/PartnerContext';
import { supabase } from '@/lib/supabase';
import { PARTNER_TYPE_LABELS, SITE_URL, partnerApi, type PartnerProfile, type PartnerType } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, ToneBadge, formatDate } from '@/components/partners/PartnerUi';

const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

type Form = Pick<PartnerProfile, 'company_name' | 'partner_type' | 'website' | 'instagram' | 'city' | 'state' | 'bio' | 'public_slug' | 'is_public' | 'logo_url'> & {
  niches: string;
  services: string;
  document: string;
};

const splitList = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);

export default function PartnersProfilePage() {
  const { user } = useAuth();
  const { profile, overview, refresh } = usePartner();
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      company_name: profile.company_name,
      partner_type: profile.partner_type,
      website: profile.website,
      instagram: profile.instagram,
      city: profile.city,
      state: profile.state,
      bio: profile.bio,
      public_slug: profile.public_slug,
      is_public: profile.is_public,
      logo_url: profile.logo_url,
      niches: profile.niches.join(', '),
      services: profile.services.join(', '),
      document: profile.document ?? '',
    });
  }, [profile]);

  if (!profile || !form) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const levelOrder = overview?.level?.sort_order ?? 1;
  const listed = form.is_public && levelOrder >= 2;

  const uploadLogo = async (file: File) => {
    if (!user?.id) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Use uma imagem de até 2 MB.');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `logos/${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('partner-assets').upload(path, file, { upsert: false, contentType: file.type });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from('partner-assets').getPublicUrl(path);
    setForm({ ...form, logo_url: data.publicUrl });
  };

  const save = async () => {
    const slug = (form.public_slug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) {
      toast.error('O nome do link precisa ter de 3 a 40 caracteres: letras minúsculas, números e hífen.');
      return;
    }
    const doc = form.document.replace(/\D/g, '');
    if (doc && ![11, 14].includes(doc.length)) {
      toast.error('CPF ou CNPJ inválido.');
      return;
    }
    setSaving(true);
    try {
      const patch: Partial<PartnerProfile> = {
        company_name: form.company_name?.trim() || null,
        partner_type: form.partner_type,
        website: form.website?.trim() || null,
        instagram: form.instagram?.trim() || null,
        city: form.city?.trim() || null,
        state: form.state || null,
        bio: form.bio?.trim() || null,
        public_slug: slug,
        is_public: form.is_public,
        logo_url: form.logo_url,
        niches: splitList(form.niches),
        services: splitList(form.services),
      };
      if (!profile.document && doc) {
        patch.document = doc;
        patch.document_type = doc.length === 14 ? 'cnpj' : 'cpf';
      }
      await partnerApi.updateProfile(profile.user_id, patch);
      toast.success('Perfil salvo');
      await refresh();
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg.includes('duplicate') ? 'Este nome de link já está em uso. Escolha outro.' : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-4xl">
      <PageHeader
        title="Perfil público"
        description="Como você aparece para os lojistas no diretório de especialistas e nos seus links."
        actions={
          profile.public_slug ? (
            <Button variant="outline" asChild>
              <a href={`/especialistas/${profile.public_slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Ver página</a>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diretório de especialistas</CardTitle>
          <CardDescription>
            A partir do nível Prata, lojistas que procuram ajuda encontram você em {SITE_URL}/especialistas e os contatos chegam em Oportunidades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />Aparecer no diretório
          </label>
          {form.is_public && !listed && <p className="text-xs text-amber-600 dark:text-amber-400">Seu perfil entra no diretório quando você chegar ao nível Prata.</p>}
          {listed && <ToneBadge tone="green"><BadgeCheck className="h-3.5 w-3.5" />Listado no diretório</ToneBadge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados do parceiro</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <img src={form.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover border" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground"><ImageUp className="h-5 w-5" /></div>
            )}
            <div>
              <Label htmlFor="logo" className="cursor-pointer">
                <span className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageUp className="h-4 w-4 mr-2" />}Enviar logo
                </span>
              </Label>
              <input id="logo" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou WebP, até 2 MB.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Nome da empresa / marca</Label><Input value={form.company_name ?? ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.partner_type} onValueChange={(v) => setForm({ ...form, partner_type: v as PartnerType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PARTNER_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome do seu link</Label>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span className="whitespace-nowrap">{SITE_URL.replace(/^https?:\/\//, '')}/p/</span>
                <Input value={form.public_slug ?? ''} onChange={(e) => setForm({ ...form, public_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
              </div>
              <p className="text-xs text-muted-foreground">Mudar o nome troca o endereço de todos os seus links. Os links antigos deixam de funcionar.</p>
            </div>
            <div className="space-y-1.5"><Label>Instagram</Label><Input value={form.instagram ?? ''} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@agencia" /></div>
            <div className="space-y-1.5"><Label>Site</Label><Input value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.city ?? ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.state ?? ''} onValueChange={(v) => setForm({ ...form, state: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Nichos (separados por vírgula)</Label><Input value={form.niches} onChange={(e) => setForm({ ...form, niches: e.target.value })} placeholder="Moda, Beleza, Alimentação" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Serviços (separados por vírgula)</Label><Input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="Implantação de loja, Gestão de catálogo, Tráfego pago" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Apresentação</Label><Textarea rows={4} maxLength={800} value={form.bio ?? ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados fiscais</CardTitle>
          <CardDescription>Usados nos saques. Depois de salvo, o documento só pode ser alterado pelo suporte.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>CPF ou CNPJ</Label>
            <Input value={form.document} disabled={!!profile.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </div>
          <div className="text-sm text-muted-foreground self-end">
            {profile.document_type === 'cnpj' ? 'Recebimento como pessoa jurídica, com nota fiscal.' : 'Recebimento como pessoa física, até o limite mensal.'}
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Termos aceitos: versão {profile.terms_version ?? '—'} em {formatDate(profile.terms_accepted_at)}.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar perfil</Button>
      </div>
    </div>
  );
}
