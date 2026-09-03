import type { LocalePathPrefix } from './config';

// Which URL-prefix locale a visitor from a given billing country should land on.
// Deliberately mirrors the country set in src/lib/billing/provider.ts's
// COUNTRY_CURRENCY map (kept as a separate map since this is a locale/UI-language
// decision, not a billing decision — the two happen to share the same country list
// today but are conceptually different concerns).
const COUNTRY_TO_LOCALE_PREFIX: Record<string, LocalePathPrefix> = {
  MX: 'es',
  CL: 'es',
  ES: 'es',
  US: 'en',
  PT: 'pt',
};

/** Returns null when the visitor should stay on the unprefixed (pt-BR) funnel. */
export function countryToLocalePrefix(country: string | null | undefined): LocalePathPrefix | null {
  if (!country) return null;
  return COUNTRY_TO_LOCALE_PREFIX[country.toUpperCase()] ?? null;
}
