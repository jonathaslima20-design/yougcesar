import { LOCALE_PATH_PREFIXES } from '@/i18n/config';

// First path segments that belong to VitrineTurbo's OWN audience (prospects and
// merchants): landing/funnel, merchant dashboard, admin, partners, blog, SEO
// landing pages, help, legal. Everything else on the main domain is a merchant
// storefront (/:slug/...), a store buyer area (/conta, /:slug/conta) or a store
// affiliate area (/afiliado) — visitors there are the merchants' customers.
const PLATFORM_SEGMENTS = new Set<string>([
  '',
  ...LOCALE_PATH_PREFIXES,
  'login',
  'register',
  'planos',
  'completar-cadastro',
  'dashboard',
  'admin',
  'auth',
  'blog',
  'help',
  'parceiros',
  'partners',
  'especialistas',
  'p',
  'convite',
  'catalogo-digital-gratis',
  'catalogo-para-whatsapp',
  'dominio-proprio',
  'loja-virtual-sem-taxa',
  'excluir-minha-conta',
  'politica-de-cookies',
  'politica-de-privacidade',
  'termos-de-uso',
  'termos-indicacoes',
]);

/** True for VitrineTurbo's own pages, false for merchant storefronts and their buyer/affiliate areas. */
export function isPlatformPath(pathname: string): boolean {
  const firstSegment = pathname.split('/')[1] ?? '';
  return PLATFORM_SEGMENTS.has(firstSegment);
}
