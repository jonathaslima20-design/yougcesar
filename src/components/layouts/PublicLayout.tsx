import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { scrollCoordinator } from '@/lib/scrollCoordinator';
import { stripLocalePrefix } from '@/i18n/stripLocalePrefix';

const MARKETING_PATH_PREFIXES = [
  '/planos',
  '/blog',
  '/help',
  '/catalogo-digital-gratis',
  '/catalogo-para-whatsapp',
  '/loja-virtual-sem-taxa',
  '/dominio-proprio',
  '/politica-de-privacidade',
  '/politica-de-cookies',
  '/termos-de-uso',
  '/termos-indicacoes',
  '/excluir-minha-conta',
  '/completar-cadastro',
];

export default function PublicLayout() {
  const location = useLocation();
  const { rest: pathnameWithoutLocale } = stripLocalePrefix(location.pathname);

  useEffect(() => {
    const isReturningFromProduct = (location.state as any)?.from === 'product-detail';
    const isRestoringScroll = scrollCoordinator.isScrollRestorationInProgress();

    if (!isReturningFromProduct && !isRestoringScroll) {
      window.scrollTo(0, 0);
    }
  }, [location.state]);

  // Only hide Footer on auth pages
  const hideFooter = ['/', '/login', '/register', '/reset-password'].includes(pathnameWithoutLocale);
  // Buyer account pages and the checkout flow (address + payment) don't need the VitrineTurbo branding pushed on the buyer
  const hideFooterLogo = location.pathname.startsWith('/conta/') || /^\/[^/]+\/conta(\/|$)/.test(location.pathname) || /\/pedido\/(endereco|[^/]+\/pagamento)$/.test(location.pathname);

  // Blog is VitrineTurbo marketing content: only surface it in the footer on the
  // platform's own pages. Everything else this layout wraps (storefronts, custom
  // domains, buyer account, checkout) is the buyer's environment and must not send
  // them off to the platform's blog.
  const showBlogLink = MARKETING_PATH_PREFIXES.some(
    (prefix) => pathnameWithoutLocale === prefix || pathnameWithoutLocale.startsWith(`${prefix}/`)
  );

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <motion.main 
        className="flex-1"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        key={location.pathname}
      >
        <Outlet />
      </motion.main>
      {!hideFooter && <Footer hideLogo={hideFooterLogo} hideBlogLink={!showBlogLink} />}
    </div>
  );
}