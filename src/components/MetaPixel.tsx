import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function MetaPixel() {
  const [pixelId, setPixelId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('landing_tracking_config')
        .select('meta_pixel_id, meta_pixel_enabled')
        .maybeSingle();

      if (data?.meta_pixel_enabled && data.meta_pixel_id) {
        setPixelId(data.meta_pixel_id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!pixelId) return;
    if (typeof window === 'undefined') return;
    if (window.fbq) return;

    const script = document.createElement('script');
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);

    const noscript = document.createElement('noscript');
    const img = document.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
    noscript.appendChild(img);
    document.body.appendChild(noscript);

    return () => {
      document.head.removeChild(script);
      document.body.removeChild(noscript);
    };
  }, [pixelId]);

  return null;
}
