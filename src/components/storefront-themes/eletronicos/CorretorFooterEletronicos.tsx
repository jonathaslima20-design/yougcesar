import { useEffect, useState } from 'react';
import { ChevronDown, MapPin, Phone, Mail, ArrowUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible';
import { getWhatsAppContactUrl, cn } from '@/lib/utils';
import { generateWhatsAppMessage } from '@/lib/i18n';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type FooterProps = Pick<StorefrontPageBodyProps, 'corretor' | 'language' | 'currency' | 'filterMetadata' | 'filters' | 'onFiltersChange'>;

const InstagramIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
  </svg>
);

const WhatsAppIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Same badge images the VitrineTurbo landing page uses (footer.legalHeading section) —
// Mercado Pago/Pix/bandeiras are BRL-only features, so these only render for BRL stores.
const PAYMENT_LOGOS = [
  { src: '/logos/mercado-pago.png', alt: 'Mercado Pago', className: 'h-6' },
  { src: 'https://auth.vitrineturbo.com/storage/v1/object/public/landing/logopix.png', alt: 'Pix', className: 'h-6' },
  { src: 'https://auth.vitrineturbo.com/storage/v1/object/public/landing/logobandeiras.png', alt: 'Bandeiras aceitas', className: 'h-6' },
];
const SECURITY_LOGOS = [
  { src: 'https://auth.vitrineturbo.com/storage/v1/object/public/landing/logossl.webp', alt: 'Pagamento seguro', className: 'h-10' },
];

function FooterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Mobile: collapsible accordion, closed by default (matches the reference) */}
      <Collapsible open={open} onOpenChange={setOpen} className="md:hidden border-b border-white/10 py-3">
        <CollapsibleTrigger className="w-full flex items-center justify-between text-left">
          <span className="font-semibold">{title}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 text-sm opacity-80 space-y-1.5">{children}</CollapsibleContent>
      </Collapsible>

      {/* Desktop: always visible column */}
      <div className="hidden md:block text-sm">
        <h4 className="font-semibold mb-3">{title}</h4>
        <div className="space-y-1.5 opacity-80">{children}</div>
      </div>
    </>
  );
}

export default function CorretorFooterEletronicos({ corretor, language, currency, filterMetadata, filters, onFiltersChange }: FooterProps) {
  const { appearance } = useStorefrontTheme();
  const chromeStyle = { backgroundColor: appearance.header_bg_color, color: appearance.header_text_color };
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isWhatsAppLinkMode = corretor.whatsapp_mode === 'link';
  const whatsappMessage = isWhatsAppLinkMode ? '' : generateWhatsAppMessage(language, corretor.name);
  const whatsappContactValue = isWhatsAppLinkMode ? corretor.whatsapp_link : corretor.whatsapp;
  const whatsappUrl = whatsappContactValue ? getWhatsAppContactUrl(corretor, whatsappMessage) : '';
  const hasWhatsApp = !!whatsappUrl && whatsappUrl !== '#';
  const instagramUrl = corretor.instagram ? `https://instagram.com/${corretor.instagram}` : null;
  const categories: string[] = filterMetadata?.categories || [];

  return (
    <>
      <footer className="mt-16" style={chromeStyle}>
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-col items-center text-center gap-3 mb-8">
            <h3 className="font-bold text-xl">{corretor.name}</h3>
            {(appearance.footer_tagline || corretor.bio) && (
              <p className="text-sm opacity-70 max-w-md">{appearance.footer_tagline || corretor.bio}</p>
            )}
            {(instagramUrl || hasWhatsApp) && (
              <div className="flex items-center gap-4 mt-1">
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100" aria-label="Instagram">
                    <InstagramIcon />
                  </a>
                )}
                {hasWhatsApp && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100" aria-label="WhatsApp">
                    <WhatsAppIcon />
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10">
            {appearance.footer_categories_enabled && categories.length > 0 && (
              <FooterSection title="Categorias">
                {categories.slice(0, 8).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, category })}
                    className="block text-left hover:opacity-100"
                  >
                    {category}
                  </button>
                ))}
              </FooterSection>
            )}

            {appearance.footer_contact_enabled && (
            <FooterSection title="Atendimento">
              {hasWhatsApp && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-100">
                  <Phone className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {corretor.email && (
                <a href={`mailto:${corretor.email}`} className="flex items-center gap-2 hover:opacity-100">
                  <Mail className="h-4 w-4" /> {corretor.email}
                </a>
              )}
              {corretor.location_url && (
                <a href={corretor.location_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-100">
                  <MapPin className="h-4 w-4" /> Ver localização
                </a>
              )}
            </FooterSection>
            )}

            {appearance.footer_payment_enabled && currency === 'BRL' && (
              <FooterSection title="Formas de pagamento">
                <div className="space-y-4 pt-1">
                  {/* No extra bg-white wrapper here: these badge images already carry
                      their own light background baked in, not a transparent one. */}
                  <div className="flex flex-wrap items-center gap-3">
                    {PAYMENT_LOGOS.map(({ src, alt, className }) => (
                      <img key={alt} src={src} alt={alt} className={cn(className, 'w-auto object-contain rounded')} loading="lazy" />
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2 opacity-70">Selos de segurança</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {SECURITY_LOGOS.map(({ src, alt, className }) => (
                        <img key={alt} src={src} alt={alt} className={cn(className, 'w-auto object-contain rounded')} loading="lazy" />
                      ))}
                    </div>
                  </div>
                </div>
              </FooterSection>
            )}
          </div>
        </div>

        {appearance.footer_credit_enabled && (
          <div className="border-t border-white/10">
            <div className="container mx-auto px-4 py-4 text-xs opacity-60 text-center">
              {corretor.name} — Catálogo online por VitrineTurbo
            </div>
          </div>
        )}
      </footer>

      <div className="fixed bottom-5 right-5 flex flex-col items-center gap-2 z-40">
        {showScrollTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="h-10 w-10 rounded-full bg-neutral-900 text-white flex items-center justify-center shadow-lg hover:bg-neutral-700"
            aria-label="Voltar ao topo"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 w-11 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white flex items-center justify-center shadow-lg"
            aria-label="Instagram"
          >
            <InstagramIcon />
          </a>
        )}
        {hasWhatsApp && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 w-11 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg"
            aria-label="WhatsApp"
          >
            <WhatsAppIcon />
          </a>
        )}
      </div>
    </>
  );
}
