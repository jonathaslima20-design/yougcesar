import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://vitrineturbo.com.br';

interface PageSEO {
  title: string;
  description: string;
}

const PAGE_SEO: Record<string, PageSEO> = {
  '/': {
    title: 'VitrineTurbo: Catálogo Digital para WhatsApp | Venda Mais Sem Taxa',
    description: 'Crie seu catálogo digital profissional e compartilhe pelo WhatsApp. Mais de 3.000 lojas ativas, plano grátis, sem taxa sobre vendas. Comece agora.',
  },
  '/planos': {
    title: 'Planos e Preços | VitrineTurbo — Catálogo Digital Grátis',
    description: 'Compare os planos do VitrineTurbo: Free, Trimestral, Semestral e Anual. Produtos ilimitados, domínio próprio, API REST e zero taxa sobre vendas.',
  },
  '/funcionalidades': {
    title: 'Funcionalidades | Catálogo Digital com WhatsApp, Estoque e Pedidos',
    description: 'Conheça todas as funcionalidades do VitrineTurbo: catálogo digital, controle de estoque, gestão de pedidos, cupons de desconto, domínio próprio e API REST.',
  },
  '/integracoes': {
    title: 'Integrações | VitrineTurbo — API REST, Bling, Tiny e ERPs',
    description: 'Integre o VitrineTurbo com Bling, Tiny e outros ERPs via API REST completa. Sincronize produtos, estoque e pedidos automaticamente.',
  },
  '/faq': {
    title: 'Perguntas Frequentes | VitrineTurbo — Dúvidas sobre a Plataforma',
    description: 'Tire suas dúvidas sobre o VitrineTurbo: planos, pagamentos, domínio próprio, controle de estoque, cupons, API e programa de indicações.',
  },
};

function setMetaContent(selector: string, content: string) {
  const el = document.querySelector(selector) as HTMLMetaElement | null;
  if (el) {
    el.setAttribute('content', content);
  }
}

function setCanonical(href: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (link) {
    link.href = href;
  } else {
    link = document.createElement('link');
    link.rel = 'canonical';
    link.href = href;
    document.head.appendChild(link);
  }
}

export function usePageSEO() {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = PAGE_SEO[pathname];
    if (!seo) return;

    document.title = seo.title;
    setMetaContent('meta[name="description"]', seo.description);
    setMetaContent('meta[property="og:title"]', seo.title);
    setMetaContent('meta[property="og:description"]', seo.description);
    setMetaContent('meta[property="og:url"]', `${BASE_URL}${pathname === '/' ? '' : pathname}`);
    setMetaContent('meta[name="twitter:title"]', seo.title);
    setMetaContent('meta[name="twitter:description"]', seo.description);
    setCanonical(`${BASE_URL}${pathname === '/' ? '/' : pathname}`);
  }, [pathname]);
}
