// Shared client for the /api/geo-country edge function (netlify/edge-functions/geo-country.ts).
// Falls back to 'BR' on any failure — geolocation must never block the funnel.
// Cached in sessionStorage so repeated calls across components/pages in the same
// tab (locale redirect, multi-currency pricing) don't each trigger a network request.

const CACHE_KEY = 'vt_geo_country_cache';

export async function fetchGeoCountry(): Promise<string> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return cached;
  } catch {
    // sessionStorage unavailable (private mode, etc.) — just skip caching
  }

  let country = 'BR';
  try {
    const res = await fetch('/api/geo-country');
    if (res.ok) {
      const data = await res.json();
      if (data?.country) country = data.country;
    }
  } catch {
    // geolocation unavailable — fall back to BR
  }

  try {
    sessionStorage.setItem(CACHE_KEY, country);
  } catch {
    // ignore
  }

  return country;
}
