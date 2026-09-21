const GEOCODE_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-cep`;

export interface GeocodeCoordinates {
  latitude: number;
  longitude: number;
}

// Public, no auth (same call shape from the dashboard and from anonymous
// storefront checkout). Best-effort: a miss (network error, or the provider
// simply has no coordinate for this CEP — a normal, expected outcome, not
// every CEP has one) resolves to `null` rather than throwing, so callers can
// always fall back to the existing city-match behavior instead of blocking
// the checkout or the settings save.
export async function geocodeCep(cep: string): Promise<GeocodeCoordinates | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  try {
    const resp = await fetch(GEOCODE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cep: digits }),
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
      return { latitude: data.latitude, longitude: data.longitude };
    }
    return null;
  } catch {
    return null;
  }
}
