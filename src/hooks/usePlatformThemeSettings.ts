import { useEffect, useState } from 'react';
import { fetchPlatformThemeSettings, type PlatformThemeSettings } from '@/lib/platformThemeSettings';

const CLOSED: PlatformThemeSettings = { eletronicosEnabled: false, eletronicosAllowedUserIds: [] };

/** Stays "closed" until the settings load, so a hidden theme never flashes on screen. */
export function usePlatformThemeSettings() {
  const [settings, setSettings] = useState<PlatformThemeSettings>(CLOSED);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformThemeSettings().then((value) => {
      if (cancelled) return;
      setSettings(value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}
