import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronDown,
  Gift,
  Layers,
  Link2,
  Loader2,
  Megaphone,
  Repeat,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { partnerApi, formatBRL, PARTNER_TYPE_LABELS, type PartnerType, type PublicProgramInfo } from '@/lib/partners/partnerApi';

const DURATION_MONTHS: Record<string, number> = { Mensal: 1, Trimestral: 3, Semestral: 6, Anual: 12 };

const NICHES = ['Moda', 'Calçados', 'Beleza', 'Alimentação', 'Eletrônicos', 'Casa e decoração', 'Infantil', 'Pet', 'Saúde', 'Outros'];
const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const FAQ = [
  {
    q: 'Por quanto tempo recebo a comissão de um cliente?',
    a: 'Enquanto o cliente continuar pagando e você continuar ativo no programa (trazendo pelo menos um cliente novo a cada 12 meses). Cada renovação gera uma nova comissão.',
  },
  {
    q: 'Quando posso sacar?',
    a: 'A comissão fica disponível 24 horas depois que o pagamento do cliente é confirmado. No plano anual, você recebe a comissão sobre o valor do ano inteiro de uma vez. O saque é feito via PIX pelo painel.',
  },
  {
    q: 'Preciso ter CNPJ?',
    a: 'Não para começar. Pessoas físicas recebem até um limite mensal; acima dele, pedimos um CNPJ (MEI serve) e a nota fiscal de serviço no saque.',
  },
  {
    q: 'Posso cobrar do cliente pela implantação?',
    a: 'Pode e deve. O VitrineTurbo paga a comissão recorrente; a implantação, a configuração e a gestão da loja são serviços seus, com o preço que você definir.',
  },
  {
    q: 'O que acontece se outro parceiro indicar o mesmo cliente?',
    a: 'Os contatos que você registra no painel ficam protegidos por 60 dias. Fora disso, vale o último link de parceiro que o cliente acessou nos 90 dias anteriores ao cadastro.',
  },
  {
    q: 'Consigo acessar a loja do meu cliente?',
    a: 'Sim, com a permissão dele. Quando você cria a loja pelo painel, o cliente decide no convite se você continua com acesso de gestor, e pode mudar isso a qualquer momento.',
  },
];

type FormState = {
  name: string;
  email: string;
  whatsapp: string;
  partner_type: PartnerType;
  company_name: string;
  document: string;
  instagram: string;
  website: string;
  city: string;
  state: string;
  client_count: string;
  niches: string[];
  how_will_sell: string;
  accepted: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  whatsapp: '',
  partner_type: 'freelancer',
  company_name: '',
  document: '',
  instagram: '',
  website: '',
  city: '',
  state: '',
  client_count: '',
  niches: [],
  how_will_sell: '',
  accepted: false,
};

export default function PartnersProgramPage() {
  const [searchParams] = useSearchParams();
  const [info, setInfo] = useState<PublicProgramInfo | null>(null);
  const recruitPct = Number(info?.recruit_override_percentage ?? 5);
  const recruitMonths = info?.recruit_override_months ?? 12;
  const faq = [
    ...FAQ,
    {
      q: 'Quanto ganho indicando outro parceiro?',
      a: `Quando um profissional se inscreve pelo seu link de indicação e é aprovado, você ganha ${recruitPct}% de tudo o que ele receber de comissão nos primeiros ${recruitMonths} meses dele no programa. Exemplo: se ele ganhar ${formatBRL(1000)} de comissão em um mês, você recebe ${formatBRL(recruitPct * 10)}. Esse bônus é pago pelo VitrineTurbo e não diminui a comissão dele.`,
    },
  ];
  const [clients, setClients] = useState(10);
  const [planName, setPlanName] = useState<string>('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = 'VitrineTurbo Partners: ganhe comissão recorrente montando lojas online';
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute(
      'content',
      'Programa de parceiros para agências, social medias e consultores: monte lojas online para seus clientes e ganhe comissão recorrente todo mês.',
    );
    partnerApi
      .publicInfo()
      .then((data) => {
        setInfo(data);
        const monthly = data.plans.find((p) => p.duration === 'Mensal') ?? data.plans[0];
        if (monthly) setPlanName(monthly.name);
      })
      .catch(() => setInfo(null));
  }, []);

  const levels = info?.levels ?? [];
  const plan = info?.plans.find((p) => p.name === planName);
  const monthlyPerClient = plan ? Number(plan.price) / (DURATION_MONTHS[plan.duration] ?? 1) : 0;
  const mrr = monthlyPerClient * clients;

  const reachedLevel = useMemo(() => {
    let current = levels[0];
    for (const l of levels) {
      if (mrr >= Number(l.min_mrr) || clients >= l.min_active_clients) current = l;
    }
    return current;
  }, [levels, mrr, clients]);

  const rate = Number(reachedLevel?.commission_percentage ?? 0);
  const monthlyCommission = (mrr * rate) / 100;
  const maxRate = levels.length ? Math.max(...levels.map((l) => Number(l.commission_percentage))) : 40;
  const baseRate = levels.length ? Number(levels[0].commission_percentage) : 25;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accepted) {
      toast.error('Aceite os termos do programa para continuar.');
      return;
    }
    setSubmitting(true);
    try {
      const utm: Record<string, string> = {};
      for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
        const v = searchParams.get(key);
        if (v) utm[key] = v;
      }
      await partnerApi.submitApplication({
        ...form,
        recruited_by: searchParams.get('indicado') ?? undefined,
        utm,
      });
      setSubmitted(true);
      document.getElementById('inscricao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      toast.error((error as Error).message || 'Não foi possível enviar sua inscrição.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white text-ink-900 min-h-screen" id="top">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-light border-b hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src="/logos/vitrinelogo-black.png"
              alt="VitrineTurbo"
              className="h-10 sm:h-12 w-auto"
              onError={(e) => {
                // Same fallback as the landing header when the local asset is missing.
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/vitrinelogo-black.png.png';
              }}
            />
            <span className="hidden sm:inline font-serif italic text-lg text-ink-700">Partners</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <a href="#como-funciona" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900">Como funciona</a>
            <a href="#ganhos" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900">Ganhos</a>
            <a href="#niveis" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900">Níveis</a>
            <a href="#faq" className="font-mono-label uppercase text-[12px] text-ink-500 hover:text-ink-900">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/partners/login" className="btn-ghost rounded-full px-3 sm:px-4 py-2 text-[13px] font-display font-medium whitespace-nowrap">
              Entrar
            </Link>
            <a href="#inscricao" className="btn-primary rounded-full px-3 sm:px-4 py-2 text-[13px] font-display font-medium whitespace-nowrap">
              Quero ser parceiro
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 border hairline bg-white rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono-label uppercase text-[11px] text-ink-700">Para agências, social medias e consultores</span>
            </span>
            <h1 className="font-display font-semibold text-[38px] sm:text-[56px] lg:text-[68px] leading-[1.03] tracking-[-0.035em] mt-6">
              Monte lojas online para seus clientes e ganhe <span className="text-emerald-600">todo mês</span>.
            </h1>
            <p className="text-ink-500 text-[17px] lg:text-[19px] mt-6 leading-[1.55] max-w-2xl">
              Comissão recorrente de {baseRate}% a {maxRate}% sobre cada mensalidade dos lojistas que você trouxer, enquanto eles
              continuarem assinando. Você cobra pela implantação; o VitrineTurbo paga a recorrência.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a href="#inscricao" className="btn-primary rounded-full px-6 py-3 text-[15px] font-display font-medium inline-flex items-center justify-center gap-2">
                Quero ser parceiro <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#ganhos" className="btn-ghost rounded-full px-6 py-3 text-[15px] font-display font-medium inline-flex items-center justify-center">
                Calcular meus ganhos
              </a>
            </div>
            {info && info.founder_slots_left > 0 && (
              <p className="mt-6 text-[14px] text-ink-500 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Parceiros Fundadores: restam <strong className="text-ink-900">{info.founder_slots_left}</strong> vagas com +{Number(info.founder_bonus_pp)} pontos de comissão para sempre.
              </p>
            )}
          </div>
          <div className="bg-white border hairline rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
            <p className="font-mono-label uppercase text-[11px] text-ink-500">Exemplo</p>
            <p className="font-display text-[22px] font-semibold mt-2">20 clientes no plano mensal</p>
            <div className="mt-6 space-y-3 text-[15px]">
              <Row label="Receita da sua carteira" value={info ? formatBRL(exampleMrr(info, 20)) : '—'} />
              <Row label="Seu nível" value={info ? levelFor(info, 20).name : '—'} />
              <Row
                label="Sua comissão por mês"
                value={info ? formatBRL((exampleMrr(info, 20) * Number(levelFor(info, 20).commission_percentage)) / 100) : '—'}
                strong
              />
            </div>
            <p className="text-[12px] text-ink-400 mt-5">Sem contar o que você cobra pela implantação e pela gestão das lojas.</p>
          </div>
        </div>
      </section>

      {/* Value strip */}
      <section className="border-y hairline bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Value icon={Repeat} title="Recorrente" text="Comissão em toda renovação, não só na primeira venda." />
          <Value icon={Gift} title={info ? `Bônus de ${formatBRL(info.first_sale_bonus_amount)}` : 'Bônus de primeira venda'} text="Na sua primeira venda nos primeiros 30 dias." />
          <Value icon={Store} title="Teste grátis" text="Seus clientes testam antes de assinar." />
          <Value icon={Wallet} title="Saque via PIX" text="Direto pelo painel, sem burocracia." />
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <SectionTitle eyebrow="Como funciona" title="Três formas de ganhar, no mesmo painel" />
          <div className="grid md:grid-cols-3 gap-5 mt-12">
            <ModelCard
              icon={Link2}
              title="Indicação"
              text="Compartilhe seus links e cupom. Quem assina pelo seu link entra na sua carteira, com teste grátis para o cliente."
              items={['Um link por canal', 'QR Code e cupom', 'Funil de cliques a pagantes']}
            />
            <ModelCard
              icon={Store}
              title="Gestão"
              text="Monte a loja do cliente pelo painel e envie um convite. Ele assume a conta e decide se você continua como gestor."
              items={['Loja pronta antes de pagar', 'Convite por WhatsApp', 'Acesso de gestor com permissão']}
              highlight
            />
            <ModelCard
              icon={Users}
              title="Agência"
              text="Traga sua equipe para operar as lojas da carteira, cada pessoa com o seu acesso."
              items={['Gestores e operadores', 'Financeiro só para o titular', 'Histórico de ações']}
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
            <Step n="01" title="Inscreva-se" text="Leva 2 minutos. Respondemos em até 48h." />
            <Step n="02" title="Acesse o painel" text="Links, materiais e loja demo prontos para usar." />
            <Step n="03" title="Traga clientes" text="Links, materiais prontos, proposta com a sua marca." />
            <Step n="04" title="Receba todo mês" text="Comissão liberada em 24h, saque via PIX." />
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section id="ganhos" className="py-20 lg:py-28 bg-ink-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="font-mono-label uppercase text-[12px] text-ink-300">Calculadora</p>
            <h2 className="font-display font-semibold text-[34px] sm:text-[46px] leading-[1.05] tracking-[-0.03em] mt-4">
              Quanto você pode ganhar
            </h2>
            <p className="text-ink-300 text-[17px] mt-5 leading-relaxed max-w-lg">
              A sua taxa sobe com o tamanho da carteira e vale para todos os clientes, inclusive os antigos.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
            <div className="flex items-baseline justify-between">
              <label className="text-[14px] text-ink-300">Clientes ativos</label>
              <span className="font-display text-[28px] font-semibold">{clients}</span>
            </div>
            <Slider className="mt-4" trackClassName="h-2 bg-white/20" rangeClassName="bg-emerald-400" thumbClassName="h-5 w-5 border-2 border-emerald-400 bg-white shadow-lg shadow-emerald-500/30" value={[clients]} min={1} max={100} step={1} onValueChange={(v) => setClients(v[0])} />
            {info && info.plans.length > 0 && (
              <div className="mt-6">
                <label className="text-[14px] text-ink-300">Plano mais comum dos seus clientes</label>
                <div className="flex flex-wrap gap-2 mt-3">
                  {info.plans.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setPlanName(p.name)}
                      className={`rounded-full px-4 py-1.5 text-[13px] border transition-colors ${
                        p.name === planName ? 'bg-white text-ink-900 border-white' : 'border-white/20 text-ink-300 hover:border-white/40'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <Stat label="Receita da carteira" value={formatBRL(mrr)} sub="por mês" />
              <Stat label={`Nível ${reachedLevel?.name ?? ''}`} value={`${rate}%`} sub="de comissão" />
            </div>
            <div className="mt-4 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 p-5">
              <p className="text-[13px] text-emerald-200">Sua comissão</p>
              <p className="font-display text-[34px] font-semibold mt-1">{formatBRL(monthlyCommission)}<span className="text-[16px] text-emerald-200 font-normal"> /mês</span></p>
              <p className="text-[13px] text-emerald-200 mt-1">{formatBRL(monthlyCommission * 12)} por ano, recorrente</p>
            </div>
            <p className="text-[12px] text-ink-400 mt-4">
              Simulação com base nos preços atuais. Planos trimestrais, semestrais e anuais são convertidos para o valor mensal; no anual, a comissão do ano inteiro é paga de uma vez.
            </p>
          </div>
        </div>
      </section>

      {/* Levels */}
      <section id="niveis" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <SectionTitle eyebrow="Níveis" title="Quanto maior a carteira, maior a taxa" subtitle="Você sobe na hora em que atinge o critério, e só desce depois de 2 meses abaixo dele." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
            {levels.map((l, idx) => (
              <div key={l.slug} className={`rounded-3xl border p-6 flex flex-col ${idx === levels.length - 1 ? 'bg-ink-950 text-white border-ink-950' : 'bg-white hairline'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color ?? '#999' }} />
                  <span className="font-display font-semibold text-[18px]">{l.name}</span>
                </div>
                <p className="font-display text-[44px] font-semibold mt-4 leading-none">{Number(l.commission_percentage)}%</p>
                <p className={`text-[13px] mt-2 ${idx === levels.length - 1 ? 'text-ink-300' : 'text-ink-500'}`}>
                  {idx === 0 ? 'Ao ser aprovado' : `A partir de ${formatBRL(l.min_mrr)}/mês ou ${l.min_active_clients} clientes`}
                </p>
                <ul className="mt-5 space-y-2 text-[14px] flex-1">
                  {l.benefits.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Toolkit */}
      <section className="py-20 lg:py-28 bg-surface border-y hairline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <SectionTitle eyebrow="Painel do parceiro" title="Tudo o que você precisa para vender" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            <Feature icon={BarChart3} title="Carteira e saúde das lojas" text="Veja quem está em teste, quem renova esta semana e quais lojas precisam de atenção." />
            <Feature icon={Link2} title="Links e campanhas" text="Um link por canal, QR Code, cupom e o funil completo de cada um." />
            <Feature icon={Layers} title="Oportunidades protegidas" text="Registre seus contatos: eles ficam protegidos por 60 dias." />
            <Feature icon={Megaphone} title="Materiais prontos" text="Textos para WhatsApp, Instagram e e-mail, respostas para objeções e proposta com a sua marca." />
            <Feature icon={Users} title="Indique outros parceiros" text={`Ganhe ${recruitPct}% de tudo o que o parceiro indicado receber de comissão nos primeiros ${recruitMonths} meses dele.`} />
            <Feature icon={ShieldCheck} title="Regras claras" text="Comissão, atribuição e saque definidos nos termos. Sem surpresas." />
          </div>
        </div>
      </section>

      {/* Application */}
      <section id="inscricao" className="py-20 lg:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <SectionTitle eyebrow="Inscrição" title="Quero ser parceiro" subtitle="Respondemos em até 48 horas pelo WhatsApp informado." center />
          {submitted ? (
            <div className="mt-10 rounded-3xl border hairline bg-white p-8 text-center">
              <BadgeCheck className="h-12 w-12 text-emerald-500 mx-auto" />
              <h3 className="font-display text-[24px] font-semibold mt-4">Inscrição recebida!</h3>
              <p className="text-ink-500 mt-3">
                Vamos analisar seu perfil e enviar o link de ativação do seu painel pelo WhatsApp. Enquanto isso, conheça a{' '}
                <Link to="/" className="underline">plataforma</Link>.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-10 rounded-3xl border hairline bg-white p-5 sm:p-8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Seu nome *">
                  <input required className={inputCls} value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={120} />
                </Field>
                <Field label="E-mail *">
                  <input required type="email" className={inputCls} value={form.email} onChange={(e) => update('email', e.target.value)} />
                </Field>
                <Field label="WhatsApp com DDD *">
                  <input required inputMode="tel" className={inputCls} value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} placeholder="(11) 98888-7777" />
                </Field>
                <Field label="Você é *">
                  <select className={inputCls} value={form.partner_type} onChange={(e) => update('partner_type', e.target.value as PartnerType)}>
                    {Object.entries(PARTNER_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Empresa / agência">
                  <input className={inputCls} value={form.company_name} onChange={(e) => update('company_name', e.target.value)} maxLength={160} />
                </Field>
                <Field label="CPF ou CNPJ">
                  <input inputMode="numeric" className={inputCls} value={form.document} onChange={(e) => update('document', e.target.value)} />
                </Field>
                <Field label="Instagram">
                  <input className={inputCls} value={form.instagram} onChange={(e) => update('instagram', e.target.value)} placeholder="@seuperfil" />
                </Field>
                <Field label="Site">
                  <input className={inputCls} value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" />
                </Field>
                <Field label="Cidade">
                  <input className={inputCls} value={form.city} onChange={(e) => update('city', e.target.value)} />
                </Field>
                <Field label="Estado">
                  <select className={inputCls} value={form.state} onChange={(e) => update('state', e.target.value)}>
                    <option value="">Selecione</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field group label="Quantos clientes você atende hoje?">
                <div className="flex flex-wrap gap-2">
                  {['Nenhum ainda', '1 a 5', '6 a 20', '21 a 50', 'Mais de 50'].map((opt) => (
                    <Chip key={opt} active={form.client_count === opt} onClick={() => update('client_count', opt)}>{opt}</Chip>
                  ))}
                </div>
              </Field>
              <Field group label="Nichos em que você atua">
                <div className="flex flex-wrap gap-2">
                  {NICHES.map((n) => (
                    <Chip
                      key={n}
                      active={form.niches.includes(n)}
                      onClick={() => update('niches', form.niches.includes(n) ? form.niches.filter((x) => x !== n) : [...form.niches, n])}
                    >
                      {n}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Como você pretende vender o VitrineTurbo?">
                <textarea className={`${inputCls} min-h-[96px]`} value={form.how_will_sell} onChange={(e) => update('how_will_sell', e.target.value)} maxLength={1000} />
              </Field>
              <label className="flex items-start gap-3 text-[14px] text-ink-700">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={form.accepted} onChange={(e) => update('accepted', e.target.checked)} />
                <span>
                  Li e aceito os{' '}
                  <Link to="/parceiros/termos" target="_blank" className="underline">termos do programa de parceiros</Link> e a{' '}
                  <Link to="/politica-de-privacidade" target="_blank" className="underline">política de privacidade</Link>.
                </span>
              </label>
              <button type="submit" disabled={submitting} className="btn-primary w-full rounded-full px-6 py-3.5 text-[15px] font-display font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enviar inscrição
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 lg:py-28 bg-surface border-t hairline">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <SectionTitle eyebrow="FAQ" title="Perguntas frequentes" center />
          <div className="mt-10 divide-y hairline border-y hairline">
            {faq.map((item, idx) => (
              <div key={item.q}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-4 py-5 text-left"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  aria-expanded={openFaq === idx}
                >
                  <span className="font-display font-medium text-[17px]">{item.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-ink-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && <p className="pb-5 text-ink-500 leading-relaxed">{item.a}</p>}
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <p className="text-ink-500">Procurando alguém para montar a sua loja?</p>
            <Link to="/especialistas" className="inline-flex items-center gap-1 mt-2 font-display font-medium underline">
              Conheça os especialistas VitrineTurbo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 text-[15px] text-ink-900 outline-none focus:border-ink-400 focus:ring-2 focus:ring-ink-100';

function exampleMrr(info: PublicProgramInfo, clients: number) {
  const monthly = info.plans.find((p) => p.duration === 'Mensal') ?? info.plans[0];
  return monthly ? Number(monthly.price) * clients : 0;
}

function levelFor(info: PublicProgramInfo, clients: number) {
  const mrr = exampleMrr(info, clients);
  let current = info.levels[0];
  for (const l of info.levels) if (mrr >= Number(l.min_mrr) || clients >= l.min_active_clients) current = l;
  return current ?? { name: '—', commission_percentage: 0 };
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b hairline pb-3 last:border-0">
      <span className="text-ink-500">{label}</span>
      <span className={strong ? 'font-display font-semibold text-[22px] text-emerald-600' : 'font-medium'}>{value}</span>
    </div>
  );
}

function Value({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div>
      <Icon className="h-5 w-5 text-ink-700" />
      <p className="font-display font-semibold mt-3">{title}</p>
      <p className="text-[14px] text-ink-500 mt-1">{text}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title, subtitle, center }: { eyebrow: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <div className={center ? 'text-center' : 'max-w-3xl'}>
      <p className="font-mono-label uppercase text-[12px] text-ink-500">{eyebrow}</p>
      <h2 className="font-display font-semibold text-[32px] sm:text-[44px] leading-[1.06] tracking-[-0.03em] mt-3">{title}</h2>
      {subtitle && <p className="text-ink-500 text-[17px] mt-4 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function ModelCard({
  icon: Icon,
  title,
  text,
  items,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-7 ${highlight ? 'border-ink-900 shadow-[0_20px_60px_-35px_rgba(0,0,0,0.35)]' : 'hairline'}`}>
      <div className="h-11 w-11 rounded-2xl bg-ink-100 flex items-center justify-center">
        <Icon className="h-5 w-5 text-ink-900" />
      </div>
      <h3 className="font-display font-semibold text-[22px] mt-5">{title}</h3>
      <p className="text-ink-500 mt-2 leading-relaxed">{text}</p>
      <ul className="mt-5 space-y-2 text-[14px]">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <Check className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="border-t-2 border-ink-900 pt-4">
      <p className="font-mono-label text-[12px] text-ink-400">{n}</p>
      <p className="font-display font-semibold text-[18px] mt-2">{title}</p>
      <p className="text-ink-500 text-[14px] mt-1">{text}</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <p className="text-[12px] text-ink-300">{label}</p>
      <p className="font-display text-[24px] font-semibold mt-1">{value}</p>
      <p className="text-[12px] text-ink-400">{sub}</p>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-3xl bg-white border hairline p-6">
      <Icon className="h-5 w-5 text-ink-900" />
      <p className="font-display font-semibold text-[18px] mt-4">{title}</p>
      <p className="text-ink-500 text-[14px] mt-2 leading-relaxed">{text}</p>
    </div>
  );
}

function Field({ label, children, group }: { label: string; children: React.ReactNode; group?: boolean }) {
  const Wrapper = group ? 'div' : 'label';
  return (
    <Wrapper className="block" {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="block text-[13px] font-medium text-ink-700 mb-1.5">{label}</span>
      {children}
    </Wrapper>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[13px] border transition-colors ${
        active ? 'bg-ink-900 text-white border-ink-900' : 'border-ink-100 text-ink-700 hover:border-ink-300'
      }`}
    >
      {children}
    </button>
  );
}
