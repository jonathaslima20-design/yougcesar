import { useEffect, useState } from 'react';
import { fetchEletronicosThemeEnabled } from '@/lib/platformThemeSettings';

/** `enabled` stays false until the flag loads, so a hidden theme never flashes on screen. */
export function useEletronicosThemeEnabled() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchEletronicosThemeEnabled().then((value) => {
      if (cancelled) return;
      setEnabled(value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
}
