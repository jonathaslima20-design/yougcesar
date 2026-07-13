export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6 && cleaned.length !== 3) return null;

  const full = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned;

  const num = parseInt(full, 16);
  if (isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

export function shouldUseLightLogo(bgColor: string): boolean {
  return getRelativeLuminance(bgColor) < 0.5;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

export function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.min(1, hsl.l + amount);
  const result = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(result.r, result.g, result.b);
}

export function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = Math.max(0, hsl.l - amount);
  const result = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(result.r, result.g, result.b);
}

export function mixColorWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const bg = 255;
  const r = Math.round(rgb.r * alpha + bg * (1 - alpha));
  const g = Math.round(rgb.g * alpha + bg * (1 - alpha));
  const b = Math.round(rgb.b * alpha + bg * (1 - alpha));
  return rgbToHex(r, g, b);
}

export function getContrastTextColor(bgHex: string): string {
  const lum = getRelativeLuminance(bgHex);
  return lum > 0.4 ? '#0a0a0a' : '#ffffff';
}

export function isLightColor(hex: string): boolean {
  return getRelativeLuminance(hex) > 0.5;
}

export interface DerivedColors {
  heading_color: string;
  muted_text_color: string;
  border_color: string;
  card_bg_color: string;
  card_border_color: string;
  badge_bg_color: string;
  badge_text_color: string;
  cover_overlay_color: string | null;
}

export function deriveColorsFromBase(
  bgColor: string,
  textColor: string,
  buttonBgColor: string,
  accentColor: string,
  borderColor: string,
): DerivedColors {
  const bgIsLight = isLightColor(bgColor);

  const heading_color = textColor;
  const muted_text_color = bgIsLight
    ? mixColorWithAlpha(textColor, 0.55)
    : lightenColor(textColor, 0.3);
  const card_bg_color = bgIsLight
    ? darkenColor(bgColor, 0.02)
    : lightenColor(bgColor, 0.05);
  const card_border_color = borderColor;
  const badge_bg_color = accentColor;
  const badge_text_color = getContrastTextColor(accentColor);
  return {
    heading_color,
    muted_text_color,
    border_color: borderColor,
    card_bg_color,
    card_border_color,
    badge_bg_color,
    badge_text_color,
    cover_overlay_color: null,
  };
}
