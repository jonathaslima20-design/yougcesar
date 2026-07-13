export interface StorefrontAppearance {
  id?: string;
  user_id?: string;
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
}

export const DEFAULT_APPEARANCE: StorefrontAppearance = {
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
};

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
