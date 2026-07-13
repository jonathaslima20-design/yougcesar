import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GtmSnippet() {
  const [containerId, setContainerId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('landing_tracking_config')
        .select('gtm_container_id')
        .maybeSingle();

      if (data?.gtm_container_id) {
        setContainerId(data.gtm_container_id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!containerId) return;
    if (typeof window === 'undefined') return;
    if ((window as any).google_tag_manager?.[containerId]) return;

    // GTM head script
    const script = document.createElement('script');
    script.id = `gtm-script-${containerId}`;
    script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`;
    document.head.appendChild(script);

    // GTM noscript fallback
    const noscript = document.createElement('noscript');
    noscript.id = `gtm-noscript-${containerId}`;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${containerId}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);

    return () => {
      const s = document.getElementById(`gtm-script-${containerId}`);
      const ns = document.getElementById(`gtm-noscript-${containerId}`);
      if (s) document.head.removeChild(s);
      if (ns) document.body.removeChild(ns);
    };
  }, [containerId]);

  return null;
}
