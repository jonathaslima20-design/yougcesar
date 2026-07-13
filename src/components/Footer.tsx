import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Logo from '@/components/Logo';

export default function Footer() {
  const [bgColor, setBgColor] = useState<string | undefined>(undefined);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [footerLogoMode, setFooterLogoMode] = useState<string>('default');
  const [footerLogoFormat, setFooterLogoFormat] = useState<string>('rectangular');
  const [referralLink, setReferralLink] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;

    const readState = () => {
      if (root.classList.contains('sf-themed')) {
        const sfBg = getComputedStyle(root).getPropertyValue('--sf-bg').trim();
        setBgColor(sfBg || undefined);
      } else {
        setBgColor(undefined);
      }
      setCustomLogoUrl(root.getAttribute('data-custom-logo-url'));
      setFooterLogoMode(root.getAttribute('data-footer-logo-mode') || 'default');
      setFooterLogoFormat(root.getAttribute('data-footer-logo-format') || 'rectangular');
      setReferralLink(root.getAttribute('data-referral-link'));
    };

    readState();

    const observer = new MutationObserver(readState);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-custom-logo-url', 'data-footer-logo-mode', 'data-footer-logo-format', 'data-referral-link'],
    });

    return () => observer.disconnect();
  }, []);

  const logoHeight = footerLogoFormat === 'square' ? '96px' : '72px';

  const renderLogo = () => {
    if (footerLogoMode === 'hidden') return null;

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
    <footer className="mt-auto py-6 border-t border-border/50">
      <div className="container mx-auto px-4 flex flex-col items-center">
        {renderLogo()}
        <div className={`flex items-center gap-4 text-xs text-muted-foreground/70 ${footerLogoMode === 'hidden' ? '' : 'mt-2'}`}>
          <Link to="/politica-de-privacidade" className="hover:text-muted-foreground transition-colors">
            Privacidade
          </Link>
          <Link to="/politica-de-cookies" className="hover:text-muted-foreground transition-colors">
            Cookies
          </Link>
          <Link to="/termos-de-uso" className="hover:text-muted-foreground transition-colors">
            Termos de Uso
          </Link>
        </div>
      </div>
    </footer>
  );
}
