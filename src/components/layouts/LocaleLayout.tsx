import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import i18n, { DEFAULT_LOCALE, PATH_PREFIX_TO_LOCALE, type LocalePathPrefix } from '@/i18n/config';
import { useLocaleRedirect } from '@/i18n/useLocaleRedirect';

/**
 * Connects a locale prefix (passed explicitly by App.tsx's literal /es, /en,
 * /pt routes, or omitted for the unprefixed pt-BR route) to the active
 * i18next language. Mounted 4 times in App.tsx (once per prefix + once
 * unprefixed) rather than via a single dynamic `/:lang` route, because a
 * dynamic segment there would match — and shadow — every merchant's
 * single-segment storefront slug (`/:slug`, e.g. `/sneakerhouse`).
 */
export default function LocaleLayout({ lang }: { lang?: LocalePathPrefix }) {
  const activeLocale = lang ? PATH_PREFIX_TO_LOCALE[lang] : DEFAULT_LOCALE;

  useEffect(() => {
    i18n.changeLanguage(activeLocale);
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  useLocaleRedirect(!lang);

  return <Outlet />;
}
