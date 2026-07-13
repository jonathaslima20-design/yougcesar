export type CookieCategory = 'necessary' | 'analytics' | 'functional' | 'marketing';

export interface CookiePreferences {
  necessary: true;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  savedAt: string;
}

const STORAGE_KEY = 'vitrineturbo_cookie_preferences';

export function getCookiePreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookiePreferences;
  } catch {
    return null;
  }
}

export function saveCookiePreferences(prefs: Omit<CookiePreferences, 'necessary' | 'savedAt'>): void {
  const toSave: CookiePreferences = {
    necessary: true,
    analytics: prefs.analytics,
    functional: prefs.functional,
    marketing: prefs.marketing,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

export function acceptAll(): void {
  saveCookiePreferences({ analytics: true, functional: true, marketing: true });
}

export function rejectNonEssential(): void {
  saveCookiePreferences({ analytics: false, functional: false, marketing: false });
}

export function hasCookieConsent(category: CookieCategory): boolean {
  if (category === 'necessary') return true;
  const prefs = getCookiePreferences();
  if (!prefs) return false;
  return prefs[category] === true;
}

export function hasUserChosen(): boolean {
  return getCookiePreferences() !== null;
}
