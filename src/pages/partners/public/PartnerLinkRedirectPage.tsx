import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { trackPartnerClick } from '@/lib/partners/partnerAttribution';

/** /p/:code and /p/:code/:link — records the partner click and forwards to the link's destination. */
export default function PartnerLinkRedirectPage() {
  const { code, link } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = code ? await trackPartnerClick(code, link ?? null).catch(() => null) : null;
      if (cancelled) return;
      if (!result) {
        navigate('/', { replace: true });
        return;
      }
      const params = new URLSearchParams(window.location.search);
      if (result.utm_source && !params.has('utm_source')) params.set('utm_source', result.utm_source);
      if (result.utm_medium && !params.has('utm_medium')) params.set('utm_medium', result.utm_medium);
      if (result.utm_campaign && !params.has('utm_campaign')) params.set('utm_campaign', result.utm_campaign);
      if (!params.has('utm_source')) params.set('utm_source', 'parceiro');
      if (result.offer === 'trial' && (result.destination === '/' || result.destination === '/register')) params.set('teste', '15');
      const query = params.toString();
      navigate(`${result.destination}${query ? `?${query}` : ''}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [code, link, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
