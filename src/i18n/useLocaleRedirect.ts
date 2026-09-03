import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchGeoCountry } from '@/lib/geoCountry';
import { countryToLocalePrefix } from './countryToLocalePrefix';

const CHOICE_MADE_KEY = 'vt_locale_choice_made';

/**
 * Soft, one-time, client-side-only redirect from the unprefixed (pt-BR) funnel
 * to a visitor's likely locale based on IP geolocation. Never runs for an
 * already-locale-prefixed URL (that's an explicit choice — a shared/bookmarked
 * link — and must never be overridden). Must stay client-side-after-mount only:
 * crawler bots never execute this JS (netlify/edge-functions/meta-handler.ts
 * intercepts them before the SPA mounts), so an edge-level redirect would risk
 * being seen by real search crawlers (Googlebot isn't in that bot allowlist) and
 * could confuse indexing — this hook structurally can't do that.
 */
export function useLocaleRedirect(enabled: boolean) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    try {
      if (localStorage.getItem(CHOICE_MADE_KEY)) return;
    } catch {
      return;
    }

    (async () => {
      const country = await fetchGeoCountry();
      if (cancelled) return;

      try {
        localStorage.setItem(CHOICE_MADE_KEY, '1');
      } catch {
        // ignore — worst case we re-check next visit too
      }

      const targetPrefix = countryToLocalePrefix(country);
      if (targetPrefix) {
        navigate(`/${targetPrefix}${location.pathname}${location.search}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
