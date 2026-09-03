import { useEffect, useState } from 'react';
import { fetchGeoCountry } from '@/lib/geoCountry';
import { getProviderForCountry, type BillingCurrency } from '@/lib/billing/provider';

interface DetectedBilling {
  country: string;
  currency: BillingCurrency;
  loading: boolean;
}

/**
 * Geo-detected billing country/currency for the public pricing sections —
 * deliberately independent of the active UI language: /es is shown to MX,
 * CL and ES visitors, who pay in 3 different currencies. Defaults to
 * BR/BRL (today's behavior) until geolocation resolves, same fail-open
 * pattern as useLocaleRedirect.
 */
export function useDetectedCountry(): DetectedBilling {
  const [state, setState] = useState<DetectedBilling>({ country: 'BR', currency: 'BRL', loading: true });

  useEffect(() => {
    let cancelled = false;
    fetchGeoCountry().then((country) => {
      if (cancelled) return;
      const { currency } = getProviderForCountry(country);
      setState({ country, currency, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
