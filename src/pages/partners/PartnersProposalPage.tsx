import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePartner } from '@/contexts/PartnerContext';
import { SITE_URL, formatBRL, partnerApi, type PublicProgramInfo } from '@/lib/partners/partnerApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FEATURES = [
  'Catálogo online com link próprio para Instagram e WhatsApp',
  'Pedido chega pronto no WhatsApp da loja',
  'Pagamento online via Pix e cartão',
  'Controle de estoque e pedidos em um só lugar',
  'Domínio próprio com o nome da marca',
];

const DEFAULT_SERVICES = 'Configuração completa da loja\nCadastro dos produtos e categorias\nAjuste de aparência com a identidade da marca\nTreinamento de uso para a equipe';

export default function PartnersProposalPage() {
  const { user } = useAuth();
  const { profile } = usePartner();
  const [plans, setPlans] = useState<PublicProgramInfo['plans']>([]);
  const [form, setForm] = useState({
    client: '',
    store: '',
    plan: '',
    setupFee: '',
    monthlyFee: '',
    services: DEFAULT_SERVICES,
    notes: '',
    validity: '15',
  });

  useEffect(() => {
    partnerApi.publicInfo().then((info) => {
      setPlans(info.plans);
      setForm((f) => ({ ...f, plan: f.plan || info.plans[0]?.name || '' }));
    }).catch(() => undefined);
  }, []);

  const plan = plans.find((p) => p.name === form.plan);
  const partnerName = profile?.company_name || user?.name || '';
  const signupUrl = profile?.public_slug ? `${SITE_URL}/p/${profile.public_slug}` : SITE_URL;
  const today = new Date();
  const validUntil = new Date(today.getTime() + Number(form.validity || 15) * 86400000);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #partner-proposal, #partner-proposal * { visibility: visible !important; }
          #partner-proposal { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link to="/partners/materials" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Materiais</Link>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Imprimir / salvar PDF</Button>
      </div>

      <div className="grid xl:grid-cols-[380px_1fr] gap-6">
        <Card className="h-fit print:hidden">
          <CardHeader><CardTitle className="text-base">Dados da proposta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>Cliente</Label><Input value={form.client} onChange={set('client')} placeholder="Nome do responsável" /></div>
            <div className="space-y-1.5"><Label>Loja</Label><Input value={form.store} onChange={set('store')} placeholder="Nome da loja" /></div>
            <div className="space-y-1.5">
              <Label>Plano VitrineTurbo sugerido</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{plans.map((p) => <SelectItem key={p.name} value={p.name}>{p.name} · {formatBRL(p.price)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Implantação (R$)</Label><Input type="number" min={0} value={form.setupFee} onChange={set('setupFee')} /></div>
              <div className="space-y-1.5"><Label>Gestão mensal (R$)</Label><Input type="number" min={0} value={form.monthlyFee} onChange={set('monthlyFee')} /></div>
            </div>
            <div className="space-y-1.5"><Label>Seus serviços (um por linha)</Label><Textarea rows={5} value={form.services} onChange={set('services')} /></div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={3} value={form.notes} onChange={set('notes')} /></div>
            <div className="space-y-1.5"><Label>Validade (dias)</Label><Input type="number" min={1} value={form.validity} onChange={set('validity')} /></div>
          </CardContent>
        </Card>

        <div id="partner-proposal" className="bg-white text-zinc-900 rounded-xl border shadow-sm p-8 sm:p-12 max-w-[820px] w-full mx-auto">
          <div className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-6">
            <div className="flex items-center gap-4">
              {profile?.logo_url ? <img src={profile.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : null}
              <div>
                <p className="text-xl font-semibold">{partnerName}</p>
                <p className="text-sm text-zinc-500">Parceiro oficial VitrineTurbo</p>
              </div>
            </div>
            <div className="text-right text-sm text-zinc-500">
              <p>Proposta comercial</p>
              <p>{today.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <div className="py-8">
            <p className="text-sm text-zinc-500">Preparado para</p>
            <p className="text-2xl font-semibold mt-1">{form.store || 'Sua loja'}</p>
            {form.client && <p className="text-zinc-600">{form.client}</p>}
            <p className="mt-6 text-zinc-700 leading-relaxed">
              Proposta para colocar {form.store || 'a sua loja'} no ar com uma loja online completa: seus clientes escolhem os produtos sozinhos, com foto e preço, e o pedido chega
              pronto para você.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-xl bg-zinc-50 p-5">
              <p className="font-semibold">O que a plataforma oferece</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                {FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />{f}</li>)}
              </ul>
            </div>
            <div className="rounded-xl bg-zinc-50 p-5">
              <p className="font-semibold">O que eu faço por você</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                {form.services.split('\n').filter((s) => s.trim()).map((s) => <li key={s} className="flex gap-2"><Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />{s.trim()}</li>)}
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <p className="font-semibold">Investimento</p>
            <table className="w-full mt-3 text-sm">
              <tbody className="divide-y divide-zinc-200">
                {plan && (
                  <tr><td className="py-2.5">Plataforma VitrineTurbo · plano {plan.name}</td><td className="py-2.5 text-right font-medium">{formatBRL(plan.price)}</td></tr>
                )}
                {Number(form.setupFee) > 0 && <tr><td className="py-2.5">Implantação (pagamento único)</td><td className="py-2.5 text-right font-medium">{formatBRL(Number(form.setupFee))}</td></tr>}
                {Number(form.monthlyFee) > 0 && <tr><td className="py-2.5">Gestão da loja (mensal)</td><td className="py-2.5 text-right font-medium">{formatBRL(Number(form.monthlyFee))}</td></tr>}
              </tbody>
            </table>
            <p className="text-xs text-zinc-500 mt-2">A assinatura da plataforma é paga diretamente ao VitrineTurbo, com teste grátis antes da primeira cobrança.</p>
          </div>

          {form.notes && <p className="mt-6 text-sm text-zinc-700 whitespace-pre-line">{form.notes}</p>}

          <div className="mt-10 rounded-xl border border-zinc-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Próximo passo</p>
              <p className="text-sm text-zinc-600">Cadastre-se pelo link abaixo para começar o teste grátis.</p>
            </div>
            <p className="font-mono text-sm break-all">{signupUrl}</p>
          </div>
          <p className="text-xs text-zinc-400 mt-6">Proposta válida até {validUntil.toLocaleDateString('pt-BR')}.</p>
        </div>
      </div>
    </div>
  );
}
