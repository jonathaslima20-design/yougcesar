import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptBRCommon from './locales/pt-BR/common.json';
import ptBRLanding from './locales/pt-BR/landing.json';
import ptBRAuth from './locales/pt-BR/auth.json';
import ptBRPricing from './locales/pt-BR/pricing.json';

import esCommon from './locales/es/common.json';
import esLanding from './locales/es/landing.json';
import esAuth from './locales/es/auth.json';
import esPricing from './locales/es/pricing.json';

import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import enAuth from './locales/en/auth.json';
import enPricing from './locales/en/pricing.json';

import ptPTCommon from './locales/pt-PT/common.json';
import ptPTLanding from './locales/pt-PT/landing.json';
import ptPTAuth from './locales/pt-PT/auth.json';
import ptPTPricing from './locales/pt-PT/pricing.json';

// Path prefix -> i18next language code. '' (no prefix) is the default, pt-BR.
// Keep this list in sync with LOCALE_PREFIXES in netlify/edge-functions/meta-handler.ts
// (that file runs on Deno and can't import from src/, so it keeps its own copy).
export const LOCALE_PATH_PREFIXES = ['es', 'en', 'pt'] as const;
export type LocalePathPrefix = (typeof LOCALE_PATH_PREFIXES)[number];

export const DEFAULT_LOCALE = 'pt-BR';

export const PATH_PREFIX_TO_LOCALE: Record<LocalePathPrefix, string> = {
  es: 'es',
  en: 'en',
  pt: 'pt-PT',
};

export function isLocalePathPrefix(value: string | undefined): value is LocalePathPrefix {
  return !!value && (LOCALE_PATH_PREFIXES as readonly string[]).includes(value);
}

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { common: ptBRCommon, landing: ptBRLanding, auth: ptBRAuth, pricing: ptBRPricing },
    es: { common: esCommon, landing: esLanding, auth: esAuth, pricing: esPricing },
    en: { common: enCommon, landing: enLanding, auth: enAuth, pricing: enPricing },
    'pt-PT': { common: ptPTCommon, landing: ptPTLanding, auth: ptPTAuth, pricing: ptPTPricing },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  ns: ['common', 'landing', 'auth', 'pricing'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
