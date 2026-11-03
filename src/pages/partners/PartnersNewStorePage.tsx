import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, ListChecks, Loader2, Send, Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartner } from '@/contexts/PartnerContext';
import { supabase } from '@/lib/supabase';
import { openClientStore, partnerApi, type PartnerLead } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInputWithCountry } from '@/components/ui/phone-input-with-country';
import { PageHeader } from '@/components/partners/PartnerUi';
import { InviteLinkDialog } from './PartnersClientDetailPage';


const CHECKLIST = [
  'Dados da loja e WhatsApp que recebe os pedidos',
  'Aparência: tema, logo e banner',
  'Categorias e produtos (use a importação em massa para muitos itens)',
  'Pagamentos e entrega',
  'Domínio próprio, se o cliente tiver',
  'Um pedido de teste do início ao fim',
];

export default function PartnersNewStorePage() {
  const { user } = useAuth();
  const { settings, profile } = usePartner();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ store_name: '', name: '', email: '', whatsapp: '', country_code: '55', niche: 'diversos' });
  const [leadId, setLeadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ user_id: string; invite_url: string; trial_days: number } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const lead = searchParams.get('lead');
    if (!lead) return;
    supabase
      .from('partner_leads')
      .select('*')
      .eq('id', lead)
      .maybeSingle()
      .then(({ data }) => {
        const l = data as PartnerLead | null;
        if (!l) return;
        setLeadId(l.id);
        setForm((f) => ({ ...f, name: l.name, email: l.email ?? '', whatsapp: l.whatsapp ?? '', store_name: l.company ?? '' }));
      });
  }, [searchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await partnerApi.createStore({ ...form, lead_id: leadId ?? undefined });
      setCreated(result);
      toast.success('Loja criada!');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <CardTitle>A loja {form.store_name || form.name} foi criada</CardTitle>
            <CardDescription>
              Ela está em teste grátis por {created.trial_days} dias. Configure tudo antes de entregar e, quando estiver pronta, envie o convite para o cliente assumir a conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium flex items-center gap-2"><ListChecks className="h-4 w-4" />Checklist de implantação</p>
              <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground list-decimal pl-5">
                {CHECKLIST.map((c) => <li key={c}>{c}</li>)}
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={async () => {
                  setOpening(true);
                  try {
                    await openClientStore(created.user_id, user?.email);
                  } catch (err) {
                    toast.error((err as Error).message);
                    setOpening(false);
                  }
                }}
                disabled={opening}
              >
                {opening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Store className="h-4 w-4 mr-2" />}Configurar a loja agora
              </Button>
              <Button variant="outline" onClick={() => setInviteOpen(true)}><Send className="h-4 w-4 mr-2" />Enviar convite</Button>
              <Button variant="ghost" asChild><Link to={`/partners/clients/${created.user_id}`}>Ver cliente</Link></Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao configurar a loja, você entra como o cliente nesta aba. Para voltar ao painel Partners, use o aviso no topo da loja e entre de novo com o seu e-mail.
            </p>
          </CardContent>
        </Card>
        <InviteLinkDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          url={created.invite_url}
          clientName={form.name}
          whatsapp={form.whatsapp}
          partnerName={profile?.company_name}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-6">
      <PageHeader title="Nova loja" description={`Crie a loja do seu cliente. Ela começa com ${settings?.store_trial_days ?? 15} dias de teste grátis e fica na sua carteira.`} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="store_name">Nome da loja</Label>
              <Input id="store_name" value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} placeholder="Ex.: Ateliê da Ana" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome do responsável *</Label>
                <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail do cliente *</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>WhatsApp do cliente *</Label>
                <PhoneInputWithCountry
                  value={form.whatsapp}
                  defaultCountry="BR"
                  onChange={(data) => setForm((f) => ({ ...f, whatsapp: data.phone, country_code: data.ddi.replace('+', '') }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O cliente define a própria senha pelo convite. Você não precisa (e não deve) saber a senha dele.
            </p>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar loja
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
