const STORAGE_PREFIX = 'vitrineturbo_';

const ATTRIBUTION_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
] as const;

export type AttributionParam = typeof ATTRIBUTION_PARAMS[number];
export type AttributionData = Partial<Record<AttributionParam, string>>;

// Reads utm_source/utm_medium/utm_campaign/utm_term/utm_content/gclid/fbclid from the
// current URL and persists whichever are present, so they survive navigation until signup.
export function captureAttributionParams(search: string): void {
  const params = new URLSearchParams(search);

  ATTRIBUTION_PARAMS.forEach((key) => {
    const value = params.get(key);
    if (value) {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    }
  });
}

export function getStoredAttribution(): AttributionData {
  const data: AttributionData = {};

  ATTRIBUTION_PARAMS.forEach((key) => {
    const value = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (value) {
      data[key] = value;
    }
  });

  return data;
}

export function clearStoredAttribution(): void {
  ATTRIBUTION_PARAMS.forEach((key) => {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  });
}
