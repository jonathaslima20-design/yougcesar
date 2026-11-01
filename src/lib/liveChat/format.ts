const DEFAULT_TZ = 'America/Sao_Paulo';

function hourIn(timeZone: string, date = new Date()): number {
  try {
    const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date);
    return Number(h);
  } catch {
    return date.getHours();
  }
}

export function greetingFor(timeZone = DEFAULT_TZ, date = new Date()): string {
  const h = hourIn(timeZone, date);
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Variáveis aceitas na saudação personalizada do operador. */
export const GREETING_VARIABLES = [
  { key: '{saudacao}', label: 'Bom dia / Boa tarde / Boa noite' },
  { key: '{nome}', label: 'Nome do operador' },
  { key: '{cargo}', label: 'Cargo do operador' },
  { key: '{chamada}', label: 'Chamada das configurações' },
] as const;

export const DEFAULT_GREETING_TEMPLATE = '{saudacao}! Sou {nome}, {cargo} da VitrineTurbo. {chamada}';

export function renderGreetingTemplate(
  template: string,
  vars: { name?: string; role?: string; cta: string; timeZone?: string },
): string {
  return template
    .replace(/\{saudacao\}/gi, greetingFor(vars.timeZone))
    .replace(/\{nome\}/gi, vars.name ?? '')
    .replace(/\{cargo\}/gi, (vars.role ?? '').toLowerCase())
    .replace(/\{chamada\}/gi, vars.cta)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function buildGreeting(
  operatorName: string | undefined,
  roleTitle: string | undefined,
  cta: string,
  timeZone?: string,
  customTemplate?: string | null,
): string {
  if (customTemplate?.trim()) {
    return renderGreetingTemplate(customTemplate, { name: operatorName, role: roleTitle, cta, timeZone });
  }
  const hello = greetingFor(timeZone);
  if (!operatorName) return `${hello}! ${cta}`;
  const role = roleTitle ? `, ${roleTitle.toLowerCase()} da VitrineTurbo` : ' da VitrineTurbo';
  return `${hello}! Sou ${operatorName}${role}. ${cta}`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(fromIso: string, to = Date.now()): string {
  const secs = Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}min ${secs % 60}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

export function whatsappLink(e164: string, text?: string): string {
  const digits = e164.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function formatPhoneBR(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

export const LANDING_SECTION_LABELS: Record<string, string> = {
  top: 'Topo (hero)',
  recursos: 'Recursos',
  usuarios: 'Quem usa',
  precos: 'Planos',
  faq: 'FAQ',
  cta: 'CTA final',
  footer: 'Rodapé',
};

export function sectionLabel(section: string | null): string {
  if (!section) return '—';
  return LANDING_SECTION_LABELS[section] ?? section;
}
