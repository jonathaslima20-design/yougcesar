import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GoogleAdsSnippet() {
  const [config, setConfig] = useState<{ tagId: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('landing_tracking_config')
        .select('google_ads_tag_id, google_ads_enabled')
        .maybeSingle();

      if (data?.google_ads_enabled && data?.google_ads_tag_id) {
        setConfig({ tagId: data.google_ads_tag_id });
      }
    })();
  }, []);

  useEffect(() => {
    if (!config) return;
    if (typeof window === 'undefined') return;

    const scriptSrc = `https://www.googletagmanager.com/gtag/js?id=${config.tagId}`;
    const existingScript = document.getElementById('google-ads-gtag-lib');
    if (existingScript) return;

    const libScript = document.createElement('script');
    libScript.id = 'google-ads-gtag-lib';
    libScript.async = true;
    libScript.src = scriptSrc;
    document.head.appendChild(libScript);

    const initScript = document.createElement('script');
    initScript.id = 'google-ads-gtag-init';
    initScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${config.tagId}');
    `;
    document.head.appendChild(initScript);

    return () => {
      const lib = document.getElementById('google-ads-gtag-lib');
      const init = document.getElementById('google-ads-gtag-init');
      if (lib) document.head.removeChild(lib);
      if (init) document.head.removeChild(init);
    };
  }, [config]);

  return null;
}
