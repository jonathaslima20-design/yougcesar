const LAST_STORE_KEY = 'vitrineturbo_last_store_slug';

export function saveLastVisitedStore(slug: string): void {
  try {
    sessionStorage.setItem(LAST_STORE_KEY, slug);
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — safe to ignore
  }
}

export function getLastVisitedStore(): string | null {
  try {
    return sessionStorage.getItem(LAST_STORE_KEY);
  } catch {
    return null;
  }
}
