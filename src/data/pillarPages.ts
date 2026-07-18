import { Store, MessageCircle, Wallet, Globe, Package, Tag, ShieldCheck, Zap } from 'lucide-react';

export interface PillarFeature {
  icon: typeof Store;
  title: string;
  description: string;
}

export interface PillarPageData {
  slug: string;
  kicker: string;
  h1: string;
  subhead: string;
  metaDescription: string;
  ctaLabel: string;
  features: PillarFeature[];
  relatedSlugs: string[];
}

export const PILLAR_PAGES: Record<string, PillarPageData> = {
  'catalogo-digital-gratis': {
    slug: 'catalogo-digital-gratis',
    kicker: '/ catálogo digital grátis',
    h1: 'Catálogo Digital Grátis para Vender Online',
    subhead: 'Crie seu catálogo profissional sem custo inicial, compartilhe pelo WhatsApp e comece a vender hoje — sem cartão de crédito, sem taxa por venda.',
    metaDescription: 'Crie seu catálogo digital grátis, sem taxa sobre vendas. Produtos, categorias, estoque e cupom no plano gratuito. Comece agora.',
    ctaLabel: 'Criar Catálogo Grátis',
    features: [
      { icon: Zap, title: 'Plano grátis de verdade', description: 'Sem cartão de crédito, sem período de teste que expira — o plano free é permanente enquanto você usar.' },
      { icon: Wallet, title: 'Zero taxa sobre vendas', description: 'O que você vende é seu. Nenhuma porcentagem sai do seu pedido, em nenhum plano.' },
      { icon: Package, title: 'Estoque, categorias e cupom', description: 'Recursos que catálogo genérico não tem, disponíveis desde o primeiro produto cadastrado.' },
      { icon: Globe, title: 'Domínio próprio quando crescer', description: 'Comece com o link padrão e conecte seu próprio domínio no momento que fizer sentido pro seu negócio.' },
    ],
    relatedSlugs: [
      'melhores-plataformas-catalogo-digital-gratis-2026',
      'taxa-por-venda-catalogo-digital-quanto-custa',
      'como-controlar-estoque-loja-pequena-sem-planilha',
    ],
  },
  'catalogo-para-whatsapp': {
    slug: 'catalogo-para-whatsapp',
    kicker: '/ catálogo para whatsapp',
    h1: 'Catálogo de Produtos para WhatsApp',
    subhead: 'Organize seus produtos num catálogo profissional e feche pedidos direto no WhatsApp — o canal que seu cliente já usa, sem fricção nenhuma no meio.',
    metaDescription: 'Catálogo de produtos digital feito pra vender pelo WhatsApp: categorias, estoque por variação e pedido fechando direto na conversa.',
    ctaLabel: 'Criar Meu Catálogo',
    features: [
      { icon: MessageCircle, title: 'Pedido continua no WhatsApp', description: 'O cliente navega no catálogo e fecha o pedido na mesma conversa, exatamente como já está acostumado.' },
      { icon: Package, title: 'Sem limite de 500 produtos', description: 'Cadastre quantos itens e variações precisar — sem o teto do catálogo nativo do WhatsApp Business.' },
      { icon: Tag, title: 'Categorias e busca de verdade', description: 'O cliente encontra o que quer rápido, em vez de rolar uma lista única de produtos misturados.' },
      { icon: Store, title: 'Link com a sua marca', description: 'Um endereço só seu pra compartilhar na bio, no status e em qualquer lugar — não um perfil genérico.' },
    ],
    relatedSlugs: [
      'como-criar-catalogo-no-whatsapp-business-passo-a-passo',
      'catalogo-whatsapp-vs-catalogo-digital-proprio',
      'catalogo-whatsapp-business-vs-vitrineturbo',
    ],
  },
  'loja-virtual-sem-taxa': {
    slug: 'loja-virtual-sem-taxa',
    kicker: '/ loja virtual sem taxa',
    h1: 'Loja Virtual sem Taxa sobre Vendas',
    subhead: 'Venda o quanto quiser sem entregar uma porcentagem de cada pedido. Assinatura fixa e previsível — não uma comissão que cresce junto com seu faturamento.',
    metaDescription: 'Loja virtual sem taxa sobre vendas: assinatura fixa e previsível, plano grátis pra começar. Veja quanto você deixa de pagar em taxa por venda.',
    ctaLabel: 'Vender sem Taxa',
    features: [
      { icon: Wallet, title: '0% de taxa, sempre', description: 'Em nenhum plano — free ou pago — uma porcentagem da sua venda vai pra plataforma.' },
      { icon: ShieldCheck, title: 'Mensalidade previsível', description: 'Você sabe exatamente quanto paga todo mês, independente de quanto vender.' },
      { icon: Zap, title: 'Plano grátis pra começar', description: 'Teste sem compromisso antes de decidir se quer um plano com mais recursos.' },
      { icon: Tag, title: 'Sem letra miúda', description: 'Nenhuma taxa escondida em frete, em processamento de pagamento ou em qualquer outra etapa.' },
    ],
    relatedSlugs: [
      'taxa-por-venda-catalogo-digital-quanto-custa',
      'melhores-plataformas-catalogo-digital-gratis-2026',
      'como-precificar-produtos-revenda-guia-rapido',
    ],
  },
  'dominio-proprio': {
    slug: 'dominio-proprio',
    kicker: '/ domínio próprio',
    h1: 'Catálogo Digital com Domínio Próprio',
    subhead: 'Troque o link genérico por um endereço com a cara da sua marca — mais fácil de lembrar, de divulgar em qualquer material e de passar confiança.',
    metaDescription: 'Conecte um domínio próprio ao seu catálogo digital: link com a sua marca, SSL automático e configuração em minutos.',
    ctaLabel: 'Conectar Meu Domínio',
    features: [
      { icon: Globe, title: 'Conecta em minutos', description: 'Aponte o DNS do seu domínio .com ou .com.br e o catálogo passa a responder nele.' },
      { icon: Store, title: 'Consistência de marca', description: 'O mesmo link em cartão de visita, embalagem, redes sociais e qualquer material impresso.' },
      { icon: ShieldCheck, title: 'SSL automático', description: 'Certificado de segurança configurado sem passo extra — o link abre com cadeado desde o primeiro acesso.' },
      { icon: Zap, title: 'Sem perder o que já construiu', description: 'Produtos, pedidos e histórico continuam os mesmos — só o endereço muda.' },
    ],
    relatedSlugs: [
      'como-ter-dominio-proprio-loja-online',
      'catalogo-dominio-proprio-vale-a-pena-comecando',
      'como-integrar-catalogo-bling-tiny-api',
    ],
  },
};
