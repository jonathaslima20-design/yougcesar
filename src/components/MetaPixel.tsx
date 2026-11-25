import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { isPlatformPath } from '@/lib/platformRoutes';

// VitrineTurbo's own Meta pixel. Loaded only on the platform's own pages, never on
// merchant storefronts or custom domains: fbq('track') fans out to EVERY
// initialized pixel, so loading it there fed store shoppers' PageViews (and any
// store events) into VitrineTurbo's ad optimization. The separate admin "global
// pixel" (site_settings.global_meta_pixel_id) injected by useCorretorData is
// intentional and untouched.
export default function MetaPixel({ isCustomDomain = false }: { isCustomDomain?: boolean }) {
  const [pixelId, setPixelId] = useState<string | null>(null);
  const { pathname } = useLocation();
  const shouldLoad = !isCustomDomain && isPlatformPath(pathname);

  useEffect(() => {
    if (!shouldLoad || pixelId) return;
    (async () => {
      const { data } = await supabase
        .from('landing_tracking_config')
        .select('meta_pixel_id, meta_pixel_enabled')
        .maybeSingle();

      if (data?.meta_pixel_enabled && data.meta_pixel_id) {
        setPixelId(data.meta_pixel_id);
      }
    })();
  }, [shouldLoad, pixelId]);

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
