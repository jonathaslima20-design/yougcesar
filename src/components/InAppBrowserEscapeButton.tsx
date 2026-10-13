import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { isInAppBrowser } from '@/lib/inAppBrowser';

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

// iOS has no way to escape a webview without a tap (Apple blocks it), and
// Android's onload attempt in inAppBrowserEscape.ts can be blocked by the
// webview since it isn't triggered by a user gesture. This anchor tap is one,
// so it's the one-tap fallback that works everywhere the onload attempt can't.
function buildEscapeHref(): string | null {
  const url = window.location.href;
  const withoutScheme = url.replace(/^https?:\/\//, '');
  if (isIOS()) return `x-safari-https://${withoutScheme}`;
  if (isAndroid()) {
    return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  return null;
}

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
