export type StorefrontThemeId = 'padrao' | 'eletronicos';

export interface StorefrontAppearance {
  id?: string;
  user_id?: string;
  theme_id: StorefrontThemeId;
  bg_color: string;
  text_color: string;
  heading_color: string;
  button_bg_color: string;
  button_text_color: string;
  accent_color: string;
  card_bg_color: string;
  card_border_color: string;
  badge_bg_color: string;
  badge_text_color: string;
  icon_color: string;
  muted_text_color: string;
  border_color: string;
  cover_overlay_color: string | null;
  bg_gradient_enabled: boolean;
  bg_gradient_color_end: string | null;
  bg_gradient_direction: string;
  font_family: string;
  heading_font_family: string;
  font_size_base: 'sm' | 'md' | 'lg';
  card_border_radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  card_shadow: 'none' | 'sm' | 'md' | 'lg';
  button_border_radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  image_border_radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  hover_effect: 'none' | 'scale' | 'lift' | 'glow';
  cover_border_radius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  section_spacing: 'compact' | 'normal' | 'relaxed';
  card_gap: 'compact' | 'normal' | 'relaxed';
  footer_logo_mode: 'default' | 'hidden' | 'custom';
  footer_logo_format: 'rectangular' | 'square';
  custom_logo_url: string | null;
  is_active: boolean;
  // Eletrônicos-theme-only chrome (dark header/topbar/nav/footer background+text
  // and the announcement-bar phrase). Ignored by the "padrao" theme's components.
  header_bg_color: string;
  header_text_color: string;
  nav_bg_color: string;
  nav_text_color: string;
  topbar_bg_color: string;
  topbar_text_color: string;
  footer_bg_color: string;
  footer_text_color: string;
  top_bar_text: string | null;
  header_logo_scale: number;
  category_showcase_enabled: boolean;
  category_showcase_title: string | null;
  header_logo_url: string | null;
  top_bar_phrases: string[];
  top_bar_enabled: boolean;
  benefits_bar_enabled: boolean;
  mini_banners_enabled: boolean;
  // "Banner de destaque": one wide banner (separate desktop/mobile images), no rotation.
  feature_banner_enabled: boolean;
  feature_banner_desktop_url: string | null;
  feature_banner_mobile_url: string | null;
  feature_banner_link_url: string | null;
  // Order of the movable home sections (see HOME_SECTIONS); null = default order.
  home_section_order: string[] | null;
  // Product grid colors (Eletrônicos). null = keep the theme's current look.
  grid_card_bg_color: string | null;
  grid_card_border_color: string | null;
  grid_title_color: string | null;
  grid_price_color: string | null;
  grid_button_bg_color: string | null;
  grid_button_text_color: string | null;
  grid_badge_bg_color: string | null;
  grid_section_bg_color: string | null;
  footer_categories_enabled: boolean;
  footer_contact_enabled: boolean;
  footer_payment_enabled: boolean;
  footer_credit_enabled: boolean;
  footer_tagline: string | null;
  footer_company_name: string | null;
  footer_cnpj: string | null;
  footer_logo_url: string | null;
  footer_institutional_links: { label: string; url: string }[];
  // Per-section background/text color, independent from header/footer.
  banners_bg_color: string;
  banners_text_color: string;
  banners_autoplay_seconds: number;
  benefits_bg_color: string;
  benefits_text_color: string;
  category_showcase_bg_color: string;
  category_showcase_text_color: string;
  mini_banners_bg_color: string;
  mini_banners_text_color: string;
  highlights_bg_color: string;
  highlights_text_color: string;
  new_arrivals_bg_color: string;
  new_arrivals_text_color: string;
}

export const DEFAULT_APPEARANCE: StorefrontAppearance = {
  theme_id: 'padrao',
  bg_color: '#ffffff',
  text_color: '#0a0a0a',
  heading_color: '#0a0a0a',
  button_bg_color: '#0f172a',
  button_text_color: '#f8fafc',
  accent_color: '#0f172a',
  card_bg_color: '#f8f9fa',
  card_border_color: '#e4e4e7',
  badge_bg_color: '#0f172a',
  badge_text_color: '#ffffff',
  icon_color: '#0a0a0a',
  muted_text_color: '#71717a',
  border_color: '#e4e4e7',
  cover_overlay_color: null,
  bg_gradient_enabled: false,
  bg_gradient_color_end: null,
  bg_gradient_direction: 'to bottom',
  font_family: 'Inter',
  heading_font_family: 'Inter Tight',
  font_size_base: 'md',
  card_border_radius: 'lg',
  card_shadow: 'sm',
  button_border_radius: 'md',
  image_border_radius: 'md',
  hover_effect: 'scale',
  cover_border_radius: 'none',
  section_spacing: 'normal',
  card_gap: 'normal',
  footer_logo_mode: 'default',
  footer_logo_format: 'rectangular',
  custom_logo_url: null,
  is_active: true,
  header_bg_color: '#171717',
  header_text_color: '#ffffff',
  nav_bg_color: '#171717',
  nav_text_color: '#ffffff',
  topbar_bg_color: '#171717',
  topbar_text_color: '#ffffff',
  footer_bg_color: '#171717',
  footer_text_color: '#ffffff',
  top_bar_text: null,
  header_logo_scale: 100,
  category_showcase_enabled: true,
  category_showcase_title: null,
  header_logo_url: null,
  top_bar_phrases: [],
  top_bar_enabled: true,
  benefits_bar_enabled: true,
  mini_banners_enabled: true,
  feature_banner_enabled: true,
  feature_banner_desktop_url: null,
  feature_banner_mobile_url: null,
  feature_banner_link_url: null,
  home_section_order: null,
  grid_card_bg_color: null,
  grid_card_border_color: null,
  grid_title_color: null,
  grid_price_color: null,
  grid_button_bg_color: null,
  grid_button_text_color: null,
  grid_badge_bg_color: null,
  grid_section_bg_color: null,
  footer_categories_enabled: true,
  footer_contact_enabled: true,
  footer_payment_enabled: true,
  footer_credit_enabled: true,
  footer_tagline: null,
  footer_company_name: null,
  footer_cnpj: null,
  footer_logo_url: null,
  footer_institutional_links: [],
  banners_bg_color: '#ffffff',
  banners_text_color: '#0a0a0a',
  banners_autoplay_seconds: 5,
  benefits_bg_color: '#ffffff',
  benefits_text_color: '#0a0a0a',
  category_showcase_bg_color: '#ffffff',
  category_showcase_text_color: '#0a0a0a',
  mini_banners_bg_color: '#ffffff',
  mini_banners_text_color: '#0a0a0a',
  highlights_bg_color: '#ffffff',
  highlights_text_color: '#0a0a0a',
  new_arrivals_bg_color: '#ffffff',
  new_arrivals_text_color: '#0a0a0a',
};

/**
 * The "Eletrônicos" home sections a merchant can reorder, in their default order.
 * Top bar, header, menu and footer are fixed and deliberately not listed here.
 */
export const HOME_SECTIONS = [
  { id: 'banners', label: 'Banners' },
  { id: 'benefits', label: 'Barra de benefícios' },
  { id: 'categories', label: 'Navegue por Categorias' },
  { id: 'offers', label: 'Ofertas' },
  { id: 'feature_banner', label: 'Banner de destaque' },
  { id: 'mini_banners', label: 'Mini banners' },
  { id: 'highlights', label: 'Destaques' },
  { id: 'new_arrivals', label: 'Novidades' },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]['id'];

/** Saved order merged with the defaults: unknown ids dropped, missing ones appended. */
export function resolveHomeSectionOrder(saved: string[] | null | undefined): HomeSectionId[] {
  const known = HOME_SECTIONS.map((s) => s.id) as HomeSectionId[];
  const kept = (saved ?? []).filter((id, i, arr): id is HomeSectionId =>
    (known as string[]).includes(id) && arr.indexOf(id) === i
  );
  return [...kept, ...known.filter((id) => !kept.includes(id))];
}

export const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Lato', label: 'Lato' },
];

export const HEADING_FONT_OPTIONS = [
  { value: 'Inter Tight', label: 'Inter Tight' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'DM Sans', label: 'DM Sans' },
];

export const BORDER_RADIUS_OPTIONS = [
  { value: 'none', label: 'Quadrado', px: '0px' },
  { value: 'sm', label: 'Leve', px: '4px' },
  { value: 'md', label: 'Medio', px: '8px' },
  { value: 'lg', label: 'Grande', px: '12px' },
  { value: 'full', label: 'Pill', px: '9999px' },
];

export const SHADOW_OPTIONS = [
  { value: 'none', label: 'Nenhuma', css: 'none' },
  { value: 'sm', label: 'Suave', css: '0 1px 3px rgba(0,0,0,0.08)' },
  { value: 'md', label: 'Media', css: '0 4px 12px rgba(0,0,0,0.1)' },
  { value: 'lg', label: 'Forte', css: '0 10px 30px rgba(0,0,0,0.15)' },
];

export const HOVER_EFFECT_OPTIONS = [
  { value: 'none', label: 'Nenhum' },
  { value: 'scale', label: 'Escala' },
  { value: 'lift', label: 'Elevacao' },
  { value: 'glow', label: 'Brilho' },
];

export const SPACING_OPTIONS = [
  { value: 'compact', label: 'Compacto' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Relaxado' },
];

export const GRADIENT_PRESETS = [
  { name: 'Oceano', colorStart: '#e0f7fa', colorEnd: '#0288d1', direction: 'to bottom' },
  { name: 'Sunset', colorStart: '#fff3e0', colorEnd: '#e65100', direction: 'to bottom right' },
  { name: 'Noite', colorStart: '#1a237e', colorEnd: '#0d1117', direction: 'to bottom' },
  { name: 'Floresta', colorStart: '#e8f5e9', colorEnd: '#2e7d32', direction: 'to bottom' },
  { name: 'Neutro', colorStart: '#fafafa', colorEnd: '#e0e0e0', direction: 'to bottom' },
];

export const STOREFRONT_THEME_OPTIONS: { value: StorefrontThemeId; label: string; description: string }[] = [
  { value: 'padrao', label: 'Padrão', description: 'O layout atual da sua vitrine.' },
  { value: 'eletronicos', label: 'Eletrônicos', description: 'Vitrine estilo loja online, com banners, categorias em destaque e prateleiras de produtos.' },
];

export const GRADIENT_DIRECTION_OPTIONS = [
  { value: 'to bottom', label: 'Vertical' },
  { value: 'to right', label: 'Horizontal' },
  { value: 'to bottom right', label: 'Diagonal' },
];

export function getBackgroundStyle(appearance: StorefrontAppearance): Record<string, string> {
  if (appearance.bg_gradient_enabled && appearance.bg_gradient_color_end) {
    return {
      background: `linear-gradient(${appearance.bg_gradient_direction}, ${appearance.bg_color}, ${appearance.bg_gradient_color_end})`,
    };
  }
  return { backgroundColor: appearance.bg_color };
}

export function getRadiusPx(value: string): string {
  const found = BORDER_RADIUS_OPTIONS.find(o => o.value === value);
  return found?.px || '8px';
}

export function getShadowCss(value: string): string {
  const found = SHADOW_OPTIONS.find(o => o.value === value);
  return found?.css || 'none';
}

export function getSpacingValue(value: string, type: 'section' | 'gap'): string {
  const map = {
    section: { compact: '1.5rem', normal: '3rem', relaxed: '4.5rem' },
    gap: { compact: '0.75rem', normal: '1rem', relaxed: '1.5rem' },
  };
  return map[type][value as keyof typeof map[typeof type]] || map[type].normal;
}

export function getFontSizeScale(value: string): string {
  const map = { sm: '0.875', md: '1', lg: '1.125' };
  return map[value as keyof typeof map] || '1';
}

/** Every color field the Eletrônicos theme exposes, used to build the "cores em uso" quick-pick palette. */
const THEME_COLOR_FIELDS: (keyof StorefrontAppearance)[] = [
  'header_bg_color', 'header_text_color',
  'nav_bg_color', 'nav_text_color',
  'topbar_bg_color', 'topbar_text_color',
  'footer_bg_color', 'footer_text_color',
  'banners_bg_color', 'banners_text_color',
  'benefits_bg_color', 'benefits_text_color',
  'category_showcase_bg_color', 'category_showcase_text_color',
  'mini_banners_bg_color', 'mini_banners_text_color',
  'highlights_bg_color', 'highlights_text_color',
  'new_arrivals_bg_color', 'new_arrivals_text_color',
  'grid_card_bg_color', 'grid_card_border_color', 'grid_title_color', 'grid_price_color',
  'grid_button_bg_color', 'grid_button_text_color', 'grid_badge_bg_color', 'grid_section_bg_color',
];

/**
 * Every distinct hex color already applied somewhere in the theme, deduped
 * case-insensitively. Backs the "cores em uso" quick-pick strip so a merchant
 * can reuse an exact shade instead of eyeballing a new one in the color wheel.
 */
export function getUsedThemeColors(appearance: StorefrontAppearance): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const field of THEME_COLOR_FIELDS) {
    const value = appearance[field];
    if (typeof value === 'string' && value) {
      const key = value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(value);
      }
    }
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG contrast ratio (1–21) between two hex colors. Returns 21 (safe) if either hex is invalid. */
export function getContrastRatio(hexA: string, hexB: string): number {
  try {
    const l1 = relativeLuminance(hexToRgb(hexA));
    const l2 = relativeLuminance(hexToRgb(hexB));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  } catch {
    return 21;
  }
}

export function loadGoogleFont(fontFamily: string): void {
  const builtIn = ['Inter', 'Inter Tight', 'Geist Mono'];
  if (builtIn.includes(fontFamily)) return;

  const id = `google-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}
