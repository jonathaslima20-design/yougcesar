import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { isInAppBrowser, buildEscapeHref } from '@/lib/inAppBrowser';

export function InAppBrowserEscapeButton() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (isInAppBrowser()) setHref(buildEscapeHref());
  }, []);

  if (!href) return null;

  return (
    <a
      href={href}
      className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2.5 text-sm font-medium shadow-lg"
    >
      <ExternalLink className="h-4 w-4" />
      Abrir no navegador
    </a>
  );
}
