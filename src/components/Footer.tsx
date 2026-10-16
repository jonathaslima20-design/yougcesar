import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Logo from '@/components/Logo';
import { getRememberedStorefrontTheme, getRememberedFooterLogoHint } from '@/lib/storefrontThemeHint';
import { supabase } from '@/lib/supabase';

interface FooterProps {
  hideLogo?: boolean;
  hideBlogLink?: boolean;
}

// Module-level cache: Footer persists across route changes inside PublicLayout,
// so this normally fires once per page session rather than once per navigation.
let cachedShowLegalLinks: boolean | null = null;

export default function Footer({ hideLogo = false, hideBlogLink = false }: FooterProps) {
  const location = useLocation();
  const [bgColor, setBgColor] = useState<string | undefined>(undefined);
  // Lazy-initialized from a remembered hint (see lib/storefrontThemeHint.ts) so a
  // RETURNING visit to this same store — including a plain in-session navigation
  // from the storefront into a product page — never flashes the platform's own
  // logo/tagline under the next page's loading spinner, even for the one frame
  // before StorefrontThemeContext's own effect runs and sets the authoritative
  // data-* attributes the effect below reads.
  const [footerLogoHint] = useState(() => getRememberedFooterLogoHint(location.pathname));
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(footerLogoHint?.logoUrl ?? null);
  const [footerLogoMode, setFooterLogoMode] = useState<string>(footerLogoHint?.mode ?? 'default');
  const [footerLogoFormat, setFooterLogoFormat] = useState<string>(footerLogoHint?.format ?? 'rectangular');
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [hidePlatformFooter, setHidePlatformFooter] = useState(
    () => getRememberedStorefrontTheme(location.pathname) === 'eletronicos'
  );
  // Admin-controlled, platform-wide (Central Legal, /admin/legal). Defaults to
  // shown (current/original behavior) until the setting is confirmed off.
  const [showLegalLinks, setShowLegalLinks] = useState(cachedShowLegalLinks ?? true);

  useEffect(() => {
    if (cachedShowLegalLinks !== null) return;
    supabase
      .from('site_settings')
      .select('setting_value')
      .eq('setting_name', 'show_footer_legal_links')
      .maybeSingle()
      .then(({ data }) => {
        const enabled = data?.setting_value !== 'false';
        cachedShowLegalLinks = enabled;
        setShowLegalLinks(enabled);
      });
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const readState = () => {
      if (root.classList.contains('sf-themed')) {
        const sfBg = getComputedStyle(root).getPropertyValue('--sf-bg').trim();
        setBgColor(sfBg || undefined);
      } else {
        setBgColor(undefined);
      }
      setReferralLink(root.getAttribute('data-referral-link'));
      // Only the presence of `data-theme-resolved` means "the real theme/appearance
      // is now known for sure" (StorefrontThemeProvider only mounts once corretor
      // data has loaded). Before that — e.g. right after a hard reload, or while
      // the next page's own loading spinner is still up — leave these exactly as
      // the lazy initializer guessed instead of forcing them back to the platform
      // defaults, or the guess (the whole point of remembering the hint) gets
      // wiped out immediately.
      if (root.hasAttribute('data-theme-resolved')) {
        setHidePlatformFooter(root.hasAttribute('data-hide-platform-footer'));
      }
      if (root.hasAttribute('data-footer-logo-mode')) {
        setCustomLogoUrl(root.getAttribute('data-custom-logo-url'));
        setFooterLogoMode(root.getAttribute('data-footer-logo-mode') || 'default');
        setFooterLogoFormat(root.getAttribute('data-footer-logo-format') || 'rectangular');
      }
    };

    readState();

    const observer = new MutationObserver(readState);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-custom-logo-url', 'data-footer-logo-mode', 'data-footer-logo-format', 'data-referral-link', 'data-hide-platform-footer', 'data-theme-resolved'],
    });

    return () => observer.disconnect();
  }, []);

  if (hidePlatformFooter) return null;

  const logoHeight = footerLogoFormat === 'square' ? '96px' : '72px';

  const renderLogo = () => {
    if (hideLogo || footerLogoMode === 'hidden') return null;

    if (footerLogoMode === 'custom' && customLogoUrl) {
      return (
        <img
          src={customLogoUrl}
          alt="Logo"
          className="object-contain"
          style={{ height: logoHeight, maxWidth: footerLogoFormat === 'square' ? '96px' : '240px' }}
        />
      );
    }

    const logoElement = <Logo size="md" showText={false} backgroundColor={bgColor} noLink />;

    return (
      <>
        {referralLink ? (
          <a href={referralLink} target="_blank" rel="noopener noreferrer">
            {logoElement}
          </a>
        ) : (
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}>
            {logoElement}
          </Link>
        )}
        <div className="flex items-center gap-4 text-sm -mt-1">
          {referralLink ? (
            <a href={referralLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
              Crie sua Vitrine Digital
            </a>
          ) : (
            <Link to="/login" className="text-muted-foreground hover:text-primary transition-colors">
              Crie sua Vitrine Digital
            </Link>
          )}
        </div>
      </>
    );
  };

  return (
    <footer className="platform-footer mt-auto py-6 border-t border-border/50">
      <div className="container mx-auto px-4 flex flex-col items-center">
        {renderLogo()}
        <div className={`flex items-center gap-4 text-xs text-muted-foreground/70 ${hideLogo || footerLogoMode === 'hidden' ? '' : 'mt-2'}`}>
          {!hideBlogLink && (
            <Link to="/blog" className="hover:text-muted-foreground transition-colors py-2">
              Blog
            </Link>
          )}
          {showLegalLinks && (
            <>
              <Link to="/politica-de-privacidade" className="hover:text-muted-foreground transition-colors py-2">
                Privacidade
              </Link>
              <Link to="/politica-de-cookies" className="hover:text-muted-foreground transition-colors py-2">
                Cookies
              </Link>
              <Link to="/termos-de-uso" className="hover:text-muted-foreground transition-colors py-2">
                Termos de Uso
              </Link>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
