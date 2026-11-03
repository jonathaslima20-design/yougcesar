import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Globe, Instagram, Loader2, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { PARTNER_TYPE_LABELS, type PartnerType } from '@/lib/partners/partnerApi';

interface PublicPartner {
  slug: string;
  name: string;
  partner_type: PartnerType;
  city: string | null;
  state: string | null;
  niches: string[];
  services: string[];
  bio: string | null;
  logo_url: string | null;
  level_slug: string;
  level_name: string;
  certified: boolean;
  instagram: string | null;
  website: string | null;
}

const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

function Avatar({ partner, size = 'h-14 w-14' }: { partner: Pick<PublicPartner, 'logo_url' | 'name'>; size?: string }) {
  return partner.logo_url ? (
    <img src={partner.logo_url} alt="" className={`${size} rounded-2xl object-cover border hairline`} />
  ) : (
    <div className={`${size} rounded-2xl bg-ink-900 text-white flex items-center justify-center font-display font-semibold text-lg`}>
      {partner.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function safeUrl(url: string | null) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function SpecialistsDirectoryPage() {
  const [partners, setPartners] = useState<PublicPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = 'Especialistas VitrineTurbo: quem monta a sua loja online';
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .rpc('list_public_partners', { p_state: state || null, p_niche: null })
      .then(({ data }) => setPartners((data as PublicPartner[]) ?? []))
      .then(() => setLoading(false));
  }, [state]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? partners.filter((p) => [p.name, p.city, ...(p.niches ?? []), ...(p.services ?? [])].join(' ').toLowerCase().includes(q))
    : partners;

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="font-mono-label uppercase text-[12px] text-ink-500">Especialistas</p>
        <h1 className="font-display font-semibold text-[34px] sm:text-[48px] tracking-[-0.035em] leading-[1.05] mt-3 text-ink-900">
          Quer ajuda para montar sua loja?
        </h1>
        <p className="text-ink-500 text-[17px] mt-4 max-w-2xl">
          Parceiros VitrineTurbo que implantam e gerenciam lojas online. Escolha um especialista e envie uma mensagem.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="w-full rounded-xl border border-ink-100 pl-10 pr-3.5 py-2.5 text-[15px] outline-none focus:border-ink-400"
              placeholder="Buscar por nome, cidade ou nicho"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="rounded-xl border border-ink-100 px-3.5 py-2.5 text-[15px]" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">Todos os estados</option>
            {STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20 text-ink-500">
            Nenhum especialista encontrado{state ? ` em ${state}` : ''}.{' '}
            <Link to="/parceiros" className="underline">Você é especialista? Seja parceiro.</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {visible.map((p) => (
              <Link key={p.slug} to={`/especialistas/${p.slug}`} className="rounded-3xl border hairline p-6 hover:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.3)] transition-shadow">
                <div className="flex items-center gap-4">
                  <Avatar partner={p} />
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-[17px] text-ink-900 truncate">{p.name}</p>
                    <p className="text-[13px] text-ink-500">{PARTNER_TYPE_LABELS[p.partner_type]}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-4 text-[12px]">
                  <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-700">Parceiro {p.level_name}</span>
                  {p.certified && (
                    <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 inline-flex items-center gap-1">
                      <BadgeCheck className="h-3.5 w-3.5" /> Certificado
                    </span>
                  )}
                  {(p.city || p.state) && (
                    <span className="inline-flex items-center gap-1 text-ink-500"><MapPin className="h-3.5 w-3.5" />{[p.city, p.state].filter(Boolean).join(' / ')}</span>
                  )}
                </div>
                {p.bio && <p className="text-[14px] text-ink-500 mt-4 line-clamp-3">{p.bio}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PartnerDetail extends PublicPartner {
  listed: boolean;
  portfolio: { name: string; slug: string }[];
}

export function SpecialistProfilePage() {
  const { slug } = useParams();
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', whatsapp: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase
      .rpc('get_public_partner', { p_slug: slug })
      .then(({ data }) => {
        setPartner((data as PartnerDetail) ?? null);
        if (data) document.title = `${(data as PartnerDetail).name} | Especialista VitrineTurbo`;
      })
      .then(() => setLoading(false));
  }, [slug]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.rpc('submit_partner_directory_lead', {
      p_slug: slug,
      p_name: form.name,
      p_email: form.email,
      p_whatsapp: form.whatsapp,
      p_message: form.message,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>;
  if (!partner || !partner.listed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-ink-500">Especialista não encontrado.</p>
        <Link to="/especialistas" className="underline">Ver todos os especialistas</Link>
      </div>
    );
  }

  const website = safeUrl(partner.website);
  const instagram = partner.instagram ? `https://instagram.com/${partner.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}` : null;

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid lg:grid-cols-[1fr_380px] gap-10">
        <div>
          <Link to="/especialistas" className="text-sm text-ink-500 hover:text-ink-900">← Especialistas</Link>
          <div className="flex items-center gap-4 mt-6">
            <Avatar partner={partner} size="h-20 w-20" />
            <div>
              <h1 className="font-display font-semibold text-[28px] sm:text-[34px] tracking-[-0.03em] text-ink-900">{partner.name}</h1>
              <p className="text-ink-500">{PARTNER_TYPE_LABELS[partner.partner_type]}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-5 text-[13px]">
            <span className="rounded-full bg-ink-100 px-3 py-1 text-ink-700">Parceiro {partner.level_name}</span>
            {partner.certified && (
              <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 inline-flex items-center gap-1"><BadgeCheck className="h-4 w-4" /> Certificado VitrineTurbo</span>
            )}
            {(partner.city || partner.state) && (
              <span className="inline-flex items-center gap-1 text-ink-500"><MapPin className="h-4 w-4" />{[partner.city, partner.state].filter(Boolean).join(' / ')}</span>
            )}
          </div>
          {partner.bio && <p className="text-ink-700 leading-relaxed mt-6 whitespace-pre-line">{partner.bio}</p>}
          {partner.services?.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display font-semibold text-[18px]">Serviços</h2>
              <div className="flex flex-wrap gap-2 mt-3">
                {partner.services.map((s) => <span key={s} className="rounded-full border hairline px-3 py-1 text-[13px]">{s}</span>)}
              </div>
            </div>
          )}
          {partner.niches?.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display font-semibold text-[18px]">Nichos</h2>
              <div className="flex flex-wrap gap-2 mt-3">
                {partner.niches.map((s) => <span key={s} className="rounded-full border hairline px-3 py-1 text-[13px]">{s}</span>)}
              </div>
            </div>
          )}
          {partner.portfolio?.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display font-semibold text-[18px]">Lojas no portfólio</h2>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                {partner.portfolio.map((s) => (
                  <a key={s.slug} href={`/${s.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border hairline px-4 py-3 hover:bg-surface">
                    {s.name}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-4 mt-8 text-[14px]">
            {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 underline"><Instagram className="h-4 w-4" />Instagram</a>}
            {website && <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 underline"><Globe className="h-4 w-4" />Site</a>}
          </div>
        </div>

        <div className="lg:sticky lg:top-8 h-fit rounded-3xl border hairline p-6">
          {sent ? (
            <div className="text-center py-6">
              <BadgeCheck className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="font-display font-semibold text-[18px] mt-3">Mensagem enviada!</p>
              <p className="text-ink-500 text-[14px] mt-2">{partner.name} vai entrar em contato com você.</p>
            </div>
          ) : (
            <form onSubmit={send} className="space-y-3">
              <p className="font-display font-semibold text-[18px]">Fale com {partner.name}</p>
              <input required placeholder="Seu nome" className="w-full rounded-xl border border-ink-100 px-3.5 py-2.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input type="email" placeholder="E-mail" className="w-full rounded-xl border border-ink-100 px-3.5 py-2.5" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input inputMode="tel" placeholder="WhatsApp com DDD" className="w-full rounded-xl border border-ink-100 px-3.5 py-2.5" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              <textarea placeholder="Conte um pouco sobre a sua loja" className="w-full rounded-xl border border-ink-100 px-3.5 py-2.5 min-h-[96px]" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} />
              <button disabled={sending} className="btn-primary w-full rounded-full px-5 py-3 font-display font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {sending && <Loader2 className="h-4 w-4 animate-spin" />} Enviar
              </button>
              <p className="text-[12px] text-ink-400">Seus dados vão apenas para este especialista, para que ele possa responder.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
