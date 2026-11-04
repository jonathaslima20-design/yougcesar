import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Download, Link2, Loader2, MessageCircle, Pencil, Plus, QrCode, Ticket, Trash2, UserPlus } from 'lucide-react';
import { usePartner } from '@/contexts/PartnerContext';
import {
  LINK_DESTINATIONS,
  SITE_URL,
  formatBRL,
  partnerApi,
  partnerLinkUrl,
  whatsappShareUrl,
  type PartnerFunnelRow,
  type PartnerLink,
} from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CopyButton, EmptyState, PageHeader, ToneBadge } from '@/components/partners/PartnerUi';

type Draft = Partial<PartnerLink>;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function slugify(v: string) {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function PartnersLinksPage() {
  const { partnerId, profile, canManage, settings } = usePartner();
  const [links, setLinks] = useState<PartnerLink[] | null>(null);
  const [funnel, setFunnel] = useState<PartnerFunnelRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState<{ url: string; data: string; name: string } | null>(null);

  const load = () => {
    partnerApi.links().then(setLinks).catch(() => setLinks([]));
    partnerApi.funnel(90).then(setFunnel).catch(() => undefined);
  };
  useEffect(load, []);

  const stats = useMemo(() => new Map(funnel.filter((f) => f.link_id).map((f) => [f.link_id as string, f])), [funnel]);
  const recruitUrl = profile?.public_slug ? `${SITE_URL}/parceiros?indicado=${profile.public_slug}` : '';

  const save = async () => {
    if (!draft || !partnerId) return;
    const slug = (draft.slug ?? '').trim();
    if (!SLUG_RE.test(slug)) {
      toast.error('Use só letras minúsculas, números e hífen no identificador do link.');
      return;
    }
    const coupon = draft.coupon_code?.trim().toUpperCase() || null;
    if (coupon && !/^[A-Z0-9]{4,20}$/.test(coupon)) {
      toast.error('O cupom precisa ter de 4 a 20 letras ou números, sem espaços.');
      return;
    }
    setSaving(true);
    try {
      await partnerApi.saveLink({
        id: draft.id,
        partner_id: partnerId,
        slug,
        name: draft.name?.trim() || slug,
        destination: draft.destination ?? '/',
        offer: draft.offer ?? 'trial',
        utm_source: draft.utm_source?.trim() || null,
        utm_medium: draft.utm_medium?.trim() || null,
        utm_campaign: draft.utm_campaign?.trim() || null,
        coupon_code: coupon,
        is_active: draft.is_active ?? true,
      });
      toast.success('Link salvo');
      setDraft(null);
      load();
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg.includes('duplicate') ? (msg.includes('coupon') ? 'Este cupom já está em uso.' : 'Você já tem um link com este identificador.') : msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (link: PartnerLink) => {
    if (!confirm(`Excluir o link "${link.name}"? Quem já clicou continua atribuído a você.`)) return;
    try {
      await partnerApi.deleteLink(link.id);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const showQr = async (link: PartnerLink) => {
    const url = partnerLinkUrl(profile?.public_slug, link);
    const data = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    setQr({ url, data, name: link.name });
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Links & Campanhas"
        description="Crie um link para cada canal e descubra qual traz mais clientes. Quem se cadastra por eles em até 90 dias entra na sua carteira."
        actions={canManage ? <Button onClick={() => setDraft({ destination: '/', offer: 'trial', is_active: true })}><Plus className="h-4 w-4 mr-2" />Novo link</Button> : undefined}
      />

      {!profile?.public_slug && (
        <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="pt-6 text-sm">Defina o nome do seu link em <strong>Perfil público</strong> para ativar seus links.</CardContent></Card>
      )}

      {links === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : links.length === 0 ? (
        <Card><EmptyState icon={Link2} title="Nenhum link ainda" /></Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {links.map((link) => {
            const url = partnerLinkUrl(profile?.public_slug, link);
            const s = stats.get(link.id);
            const message = `Monte sua loja online com catálogo, pedidos no WhatsApp e pagamento por Pix e cartão. ${link.offer === 'trial' ? 'Teste grátis: ' : ''}${url}`;
            return (
              <Card key={link.id} className={link.is_active ? '' : 'opacity-60'}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{link.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {LINK_DESTINATIONS.find((d) => d.value === link.destination)?.label ?? link.destination}
                        {link.offer === 'trial' ? ' · com teste grátis' : ''}
                        {link.utm_campaign ? ` · ${link.utm_campaign}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {!link.is_active && <ToneBadge tone="muted">Pausado</ToneBadge>}
                      {link.coupon_code && <ToneBadge tone="blue"><Ticket className="h-3 w-3" />{link.coupon_code}</ToneBadge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={url} className="font-mono text-xs" />
                    <CopyButton value={url} />
                  </div>
                  <div className="grid grid-cols-3 text-center rounded-lg bg-muted/40 py-2 text-sm">
                    <div><p className="font-semibold tabular-nums">{s?.clicks ?? 0}</p><p className="text-xs text-muted-foreground">cliques</p></div>
                    <div><p className="font-semibold tabular-nums">{s?.signups ?? 0}</p><p className="text-xs text-muted-foreground">cadastros</p></div>
                    <div><p className="font-semibold tabular-nums">{s?.paying ?? 0}</p><p className="text-xs text-muted-foreground">pagantes</p></div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Últimos 90 dias</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={whatsappShareUrl(message)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5 mr-1.5" />WhatsApp</a>
                    </Button>
                    <CopyButton value={message} label="Mensagem" />
                    <Button size="sm" variant="outline" onClick={() => showQr(link)} disabled={!url}><QrCode className="h-3.5 w-3.5 mr-1.5" />QR Code</Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setDraft({ ...link })} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                        {link.slug !== 'inicio' && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(link)} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {recruitUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" />Indique outros parceiros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conhece outros profissionais de marketing? Quem se inscrever no programa por este link e for aprovado gera para você {Number(settings?.recruit_override_percentage ?? 5)}% de tudo o que ele receber de comissão nos primeiros {settings?.recruit_override_months ?? 12} meses dele. Exemplo: se ele ganhar {formatBRL(1000)} em um mês, você recebe {formatBRL(Number(settings?.recruit_override_percentage ?? 5) * 10)}. Esse bônus não diminui a comissão dele.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={recruitUrl} className="font-mono text-xs" />
              <CopyButton value={recruitUrl} />
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Editar link' : 'Novo link'}</DialogTitle>
            <DialogDescription>Ex.: um link para o Instagram, outro para anúncios, outro para a sua carteira de clientes.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome</Label>
                <Input
                  value={draft.name ?? ''}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.id || draft.slug ? draft.slug : slugify(e.target.value) })}
                  placeholder="Instagram da agência"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Identificador no link</Label>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="whitespace-nowrap">/p/{profile?.public_slug ?? '…'}/</span>
                  <Input value={draft.slug ?? ''} onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })} disabled={draft.slug === 'inicio' && !!draft.id} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Página de destino</Label>
                <Select value={draft.destination ?? '/'} onValueChange={(v) => setDraft({ ...draft, destination: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LINK_DESTINATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Oferta para o cliente</Label>
                <Select value={draft.offer ?? 'trial'} onValueChange={(v) => setDraft({ ...draft, offer: v as 'none' | 'trial' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Teste grátis</SelectItem>
                    <SelectItem value="none">Sem oferta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Cupom (opcional)</Label><Input value={draft.coupon_code ?? ''} onChange={(e) => setDraft({ ...draft, coupon_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="AGENCIA10" /></div>
              <div className="space-y-1.5"><Label>Campanha (utm_campaign)</Label><Input value={draft.utm_campaign ?? ''} onChange={(e) => setDraft({ ...draft, utm_campaign: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Origem (utm_source)</Label><Input value={draft.utm_source ?? ''} onChange={(e) => setDraft({ ...draft, utm_source: e.target.value })} placeholder="instagram" /></div>
              <div className="space-y-1.5"><Label>Mídia (utm_medium)</Label><Input value={draft.utm_medium ?? ''} onChange={(e) => setDraft({ ...draft, utm_medium: e.target.value })} placeholder="bio" /></div>
              <label className="flex items-center gap-3 sm:col-span-2 text-sm">
                <Switch checked={draft.is_active ?? true} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />Link ativo
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">O cupom pode ser digitado pelo cliente no cadastro, para quem não clicou no seu link.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code · {qr?.name}</DialogTitle>
            <DialogDescription className="break-all">{qr?.url}</DialogDescription>
          </DialogHeader>
          {qr && <img src={qr.data} alt="QR Code do link" className="w-full rounded-lg border bg-white" />}
          <DialogFooter>
            <Button asChild>
              <a href={qr?.data} download={`qrcode-${qr?.name ?? 'link'}.png`}><Download className="h-4 w-4 mr-2" />Baixar PNG</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
