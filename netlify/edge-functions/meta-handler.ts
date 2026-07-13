import type { Context } from "https://edge.netlify.com";

interface UserProfile {
  name: string;
  slug: string;
  bio?: string;
  avatar_url?: string;
  cover_url_desktop?: string;
  cover_url_mobile?: string;
}

interface ProductProfile {
  id: string;
  title: string;
  description?: string;
  short_description?: string;
  featured_image_url?: string;
  price?: number;
  discounted_price?: number;
  is_starting_price?: boolean;
  user_id: string;
}

/**
 * Detects if the request is from a social media crawler/bot
 */
function isCrawlerUserAgent(userAgent: string): boolean {
  const crawlerPatterns = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'WhatsApp',
    'LinkedInBot',
    'Slackbot',
    'TelegramBot',
    'Discordbot',
    'SkypeUriPreview',
    'MetaInspector',
    'BingPreview',
    'GoogleBot',
    'bingbot',
    'Google-InspectionTool'
  ];

  const ua = userAgent.toLowerCase();
  return crawlerPatterns.some(pattern => ua.includes(pattern.toLowerCase()));
}

/**
 * Generates HTML with dynamic Open Graph meta tags for user profiles
 */
function generateMetaTagsHTML(profile: UserProfile, requestUrl: string, isCustomDomain = false): string {
  const title = isCustomDomain ? profile.name : `${profile.name} - VitrineTurbo`;
  const description = profile.bio || (isCustomDomain ? `Confira os produtos de ${profile.name}` : `Confira os produtos de ${profile.name} na VitrineTurbo`);
  const siteName = isCustomDomain ? profile.name : 'VitrineTurbo';

  // Prioritize avatar (logo) for storefront preview
  const imageUrl = profile.avatar_url ||
                   profile.cover_url_desktop ||
                   profile.cover_url_mobile ||
                   'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png.png';

  const canonicalUrl = requestUrl;

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="${imageUrl}" />
    <link rel="apple-touch-icon" href="${imageUrl}" />

    <!-- Primary Meta Tags -->
    <title>${title}</title>
    <meta name="title" content="${title}" />
    <meta name="description" content="${description}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:site_name" content="${siteName}" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${canonicalUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <!-- WhatsApp specific -->
    <meta property="og:image:alt" content="${profile.name}" />

    <!-- Redirect to main app for browsers -->
    <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
    <script>
      // Only redirect actual browsers, not crawlers
      if (!/bot|crawler|spider|crawling/i.test(navigator.userAgent)) {
        window.location.href = "${canonicalUrl}";
      }
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; text-align: center;">
      <img src="${imageUrl}" alt="${profile.name}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin-bottom: 20px;" />
      <h1 style="font-size: 32px; margin-bottom: 10px;">${profile.name}</h1>
      <p style="font-size: 18px; color: #666; margin-bottom: 20px;">${description}</p>
      <p style="color: #999;">Redirecionando...</p>
    </div>
  </body>
</html>`;
}

/**
 * Generates HTML with dynamic Open Graph meta tags for products
 */
function generateProductMetaTagsHTML(product: ProductProfile, profile: UserProfile, requestUrl: string, isCustomDomain = false): string {
  const title = isCustomDomain ? `${product.title} - ${profile.name}` : `${product.title} - ${profile.name} | VitrineTurbo`;
  
  // Create description from product info
  let description = product.short_description || '';
  if (!description && product.description) {
    // Extract first 160 characters from description, removing HTML tags
    description = product.description.replace(/<[^>]*>/g, '').substring(0, 160);
  }
  if (!description) {
    description = `${product.title} - Confira este produto na vitrine de ${profile.name}`;
  }
  
  // Add price information to description if available
  if (product.price) {
    const price = product.discounted_price || product.price;
    const priceText = product.is_starting_price ? `A partir de R$ ${price.toFixed(2)}` : `R$ ${price.toFixed(2)}`;
    description = `${description} - ${priceText}`;
  }

  // Prioritize product image, fallback to user avatar
  const imageUrl = product.featured_image_url ||
                   profile.avatar_url ||
                   profile.cover_url_desktop ||
                   profile.cover_url_mobile ||
                   'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png.png';

  const canonicalUrl = requestUrl;
  const siteName = isCustomDomain ? profile.name : 'VitrineTurbo';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="${imageUrl}" />
    <link rel="apple-touch-icon" href="${imageUrl}" />

    <!-- Primary Meta Tags -->
    <title>${title}</title>
    <meta name="title" content="${title}" />
    <meta name="description" content="${description}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="product" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:site_name" content="${siteName}" />

    <!-- Product specific Open Graph -->
    <meta property="product:brand" content="${profile.name}" />
    ${product.price ? `<meta property="product:price:amount" content="${(product.discounted_price || product.price).toFixed(2)}" />` : ''}
    <meta property="product:price:currency" content="BRL" />
    <meta property="product:availability" content="in stock" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${canonicalUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <!-- WhatsApp specific -->
    <meta property="og:image:alt" content="${product.title}" />

    <!-- Redirect to main app for browsers -->
    <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
    <script>
      // Only redirect actual browsers, not crawlers
      if (!/bot|crawler|spider|crawling/i.test(navigator.userAgent)) {
        window.location.href = "${canonicalUrl}";
      }
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; text-align: center;">
      <img src="${imageUrl}" alt="${product.title}" style="width: 300px; height: 300px; border-radius: 12px; object-fit: cover; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" />
      <h1 style="font-size: 28px; margin-bottom: 10px; color: #333;">${product.title}</h1>
      <p style="font-size: 16px; color: #666; margin-bottom: 15px;">${description}</p>
      <div style="font-size: 14px; color: #999; margin-bottom: 20px;">
        Vendido por <strong>${profile.name}</strong>
      </div>
      <p style="color: #999;">Redirecionando...</p>
    </div>
  </body>
</html>`;
}

interface LinkPreviewConfig {
  page_type: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  og_site_name: string;
  og_type: string;
  twitter_card_type: string;
  is_active: boolean;
}

async function fetchLinkPreviewConfig(
  supabaseUrl: string,
  supabaseKey: string,
  pageType: string
): Promise<LinkPreviewConfig | null> {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/link_preview_configs?page_type=eq.${pageType}&is_active=eq.true&select=page_type,og_title,og_description,og_image_url,og_site_name,og_type,twitter_card_type,is_active&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

function generateConfigBasedHTML(config: LinkPreviewConfig, canonicalUrl: string): string {
  const title = config.og_title;
  const description = config.og_description;
  const imageUrl = config.og_image_url || 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png';
  const siteName = config.og_site_name || 'VitrineTurbo';

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="title" content="${title}" />
    <meta name="description" content="${description}" />
    <meta property="og:type" content="${config.og_type}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="${siteName}" />
    <meta name="twitter:card" content="${config.twitter_card_type}" />
    <meta name="twitter:url" content="${canonicalUrl}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <meta property="og:image:alt" content="${title}" />
    <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
  </head>
  <body>
    <h1>${title}</h1>
    <p>${description}</p>
  </body>
</html>`;
}

/**
 * Default meta tags HTML for non-specific pages
 */
function generateDefaultMetaTagsHTML(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VitrineTurbo: Catálogo Digital para WhatsApp | Venda Mais Sem Taxa</title>
    <meta name="description" content="Crie seu catálogo digital profissional e compartilhe pelo WhatsApp. Mais de 3.000 lojas ativas, plano grátis, sem taxa sobre vendas. Comece agora." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://vitrineturbo.com.br/" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://vitrineturbo.com.br/" />
    <meta property="og:title" content="VitrineTurbo: Catálogo Digital para WhatsApp | Venda Mais Sem Taxa" />
    <meta property="og:description" content="Crie seu catálogo digital profissional e compartilhe pelo WhatsApp. Mais de 3.000 lojas ativas, plano grátis, sem taxa sobre vendas. Comece agora." />
    <meta property="og:image" content="https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="VitrineTurbo" />
    <meta property="og:locale" content="pt_BR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="VitrineTurbo: Catálogo Digital para WhatsApp | Venda Mais Sem Taxa" />
    <meta name="twitter:description" content="Crie seu catálogo digital profissional e compartilhe pelo WhatsApp. Mais de 3.000 lojas ativas, plano grátis, sem taxa sobre vendas. Comece agora." />
    <meta name="twitter:image" content="https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png.png" />
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"SoftwareApplication","name":"VitrineTurbo","description":"Plataforma completa de catálogo digital para WhatsApp com gestão de produtos, estoque, pedidos, cupons e domínio próprio. Sem taxa sobre vendas.","applicationCategory":"BusinessApplication","operatingSystem":"Web","url":"https://vitrineturbo.com.br","offers":{"@type":"AggregateOffer","lowPrice":"0","highPrice":"336","priceCurrency":"BRL","offerCount":"4"}}
    </script>
  </head>
  <body>
    <h1>VitrineTurbo</h1>
    <p>Catálogo Digital para WhatsApp</p>
  </body>
</html>`;
}

function isCustomDomainHostname(hostname: string): boolean {
  return hostname !== 'vitrineturbo.com' &&
    hostname !== 'www.vitrineturbo.com' &&
    hostname !== 'vitrineturbo.com.br' &&
    hostname !== 'www.vitrineturbo.com.br' &&
    !hostname.endsWith('.netlify.app') &&
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1';
}

interface PublicPageSEO {
  title: string;
  description: string;
  canonical: string;
}

const PUBLIC_PAGE_SEO: Record<string, PublicPageSEO> = {
  planos: {
    title: 'Planos e Preços | VitrineTurbo — Catálogo Digital Grátis',
    description: 'Compare os planos do VitrineTurbo: Free, Trimestral, Semestral e Anual. Produtos ilimitados, domínio próprio, API REST e zero taxa sobre vendas.',
    canonical: 'https://vitrineturbo.com.br/planos',
  },
  funcionalidades: {
    title: 'Funcionalidades | Catálogo Digital com WhatsApp, Estoque e Pedidos',
    description: 'Conheça todas as funcionalidades do VitrineTurbo: catálogo digital, controle de estoque, gestão de pedidos, cupons de desconto, domínio próprio e API REST.',
    canonical: 'https://vitrineturbo.com.br/funcionalidades',
  },
  integracoes: {
    title: 'Integrações | VitrineTurbo — API REST, Bling, Tiny e ERPs',
    description: 'Integre o VitrineTurbo com Bling, Tiny e outros ERPs via API REST completa. Sincronize produtos, estoque e pedidos automaticamente.',
    canonical: 'https://vitrineturbo.com.br/integracoes',
  },
  faq: {
    title: 'Perguntas Frequentes | VitrineTurbo — Dúvidas sobre a Plataforma',
    description: 'Tire suas dúvidas sobre o VitrineTurbo: planos, pagamentos, domínio próprio, controle de estoque, cupons, API e programa de indicações.',
    canonical: 'https://vitrineturbo.com.br/faq',
  },
};

function generatePublicPageHTML(seo: PublicPageSEO): string {
  const imageUrl = 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png.png';
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${seo.title}</title>
    <meta name="description" content="${seo.description}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${seo.canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${seo.canonical}" />
    <meta property="og:title" content="${seo.title}" />
    <meta property="og:description" content="${seo.description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="VitrineTurbo" />
    <meta property="og:locale" content="pt_BR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${seo.title}" />
    <meta name="twitter:description" content="${seo.description}" />
    <meta name="twitter:image" content="${imageUrl}" />
  </head>
  <body>
    <h1>${seo.title}</h1>
    <p>${seo.description}</p>
  </body>
</html>`;
}

export default async (request: Request, context: Context) => {
  const userAgent = request.headers.get('user-agent') || '';
  const url = new URL(request.url);

  console.log('🔍 Edge Function - Netlify Meta Handler Started:', {
    path: url.pathname,
    hostname: url.hostname,
    userAgent: userAgent.substring(0, 100),
    isCrawler: isCrawlerUserAgent(userAgent),
    timestamp: new Date().toISOString()
  });

  // Only process for crawlers
  if (!isCrawlerUserAgent(userAgent)) {
    console.log('⏩ Not a crawler, passing through to SPA');
    return context.next();
  }

  console.log('✅ Crawler detected - processing for meta tags');

  try {
    // Get Supabase credentials early (needed for both custom domain and slug resolution)
    let supabaseUrl = Deno.env.get('VITE_SUPABASE_URL');
    let supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY');
    if (!supabaseUrl) supabaseUrl = context.site.env.get('VITE_SUPABASE_URL');
    if (!supabaseKey) supabaseKey = context.site.env.get('VITE_SUPABASE_ANON_KEY');

    // Handle custom domain resolution
    if (isCustomDomainHostname(url.hostname) && supabaseUrl && supabaseKey) {
      console.log('🌐 Custom domain detected:', url.hostname);

      const altHostname = url.hostname.startsWith('www.')
        ? url.hostname.slice(4)
        : `www.${url.hostname}`;

      const domainResponse = await fetch(
        `${supabaseUrl}/rest/v1/custom_domains?domain=in.(${encodeURIComponent(`"${url.hostname}","${altHostname}"`)})&status=eq.active&select=user_id`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (domainResponse.ok) {
        const domains = await domainResponse.json();
        if (domains.length > 0) {
          const userId = domains[0].user_id;
          const pathSegments = url.pathname.split('/').filter(Boolean);

          // On custom domain: /produtos/:productId or / (storefront root)
          const isProductPage = pathSegments.length === 2 && pathSegments[0] === 'produtos';
          const productId = isProductPage ? pathSegments[1] : null;

          // Fetch user profile by user_id
          const profileResponse = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=name,slug,bio,avatar_url,cover_url_desktop,cover_url_mobile&limit=1`,
            {
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (profileResponse.ok) {
            const profiles = await profileResponse.json() as UserProfile[];
            if (profiles.length > 0) {
              const profile = profiles[0];

              if (isProductPage && productId) {
                // Product page on custom domain
                const productResponse = await fetch(
                  `${supabaseUrl}/rest/v1/products?id=eq.${productId}&user_id=eq.${userId}&select=id,title,description,short_description,featured_image_url,price,discounted_price,is_starting_price,user_id&limit=1`,
                  {
                    headers: {
                      'apikey': supabaseKey,
                      'Authorization': `Bearer ${supabaseKey}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );

                if (productResponse.ok) {
                  const products = await productResponse.json() as ProductProfile[];
                  if (products.length > 0) {
                    const html = generateProductMetaTagsHTML(products[0], profile, request.url, true);
                    return new Response(html, {
                      status: 200,
                      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' },
                    });
                  }
                }
              } else {
                // Storefront root on custom domain
                const html = generateMetaTagsHTML(profile, request.url, true);
                return new Response(html, {
                  status: 200,
                  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' },
                });
              }
            }
          }
        }
      }

      // If custom domain not found or any error, pass through
      console.log('⚠️ Custom domain not resolved, passing through');
      return context.next();
    }

    // Parse the URL to extract the slug (standard vitrineturbo.com flow)
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // Check for referral link: /?ref=CODE
    const refCode = url.searchParams.get('ref');
    if (refCode && pathSegments.length === 0 && supabaseUrl && supabaseKey) {
      console.log('🎁 Referral link detected:', refCode);
      const config = await fetchLinkPreviewConfig(supabaseUrl, supabaseKey, 'referral');
      if (config) {
        // Look up referrer name
        let referrerName = '';
        const referrerRes = await fetch(
          `${supabaseUrl}/rest/v1/users?referral_code=ilike.${encodeURIComponent(refCode)}&select=name&limit=1`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (referrerRes.ok) {
          const referrers = await referrerRes.json();
          if (referrers.length > 0) referrerName = referrers[0].name || '';
        }

        config.og_title = config.og_title
          .replace('{nome_indicador}', referrerName || 'Um amigo')
          .replace('{codigo}', refCode);
        config.og_description = config.og_description
          .replace('{nome_indicador}', referrerName || 'Um amigo')
          .replace('{codigo}', refCode);

        const html = generateConfigBasedHTML(config, request.url);
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' },
        });
      }
    }

    // Handle help center
    if (pathSegments.length > 0 && pathSegments[0] === 'help' && supabaseUrl && supabaseKey) {
      const config = await fetchLinkPreviewConfig(supabaseUrl, supabaseKey, 'help_center');
      if (config) {
        const html = generateConfigBasedHTML(config, request.url);
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' },
        });
      }
    }

    // Skip special paths (return landing config or default)
    if (pathSegments.length === 0 ||
        pathSegments[0] === 'login' ||
        pathSegments[0] === 'register' ||
        pathSegments[0] === 'dashboard' ||
        pathSegments[0] === 'admin' ||
        pathSegments[0] === 'help' ||
        pathSegments[0] === 'ajuda' ||
        pathSegments[0] === 'assets' ||
        pathSegments[0] === 'termos-de-uso' ||
        pathSegments[0] === 'politica-de-privacidade' ||
        pathSegments[0] === 'politica-de-cookies' ||
        pathSegments[0] === 'excluir-minha-conta' ||
        pathSegments[0] === 'termos-indicacoes' ||
        pathSegments[0] in PUBLIC_PAGE_SEO) {

      // Check for route-specific SEO pages
      if (pathSegments.length === 1 && pathSegments[0] in PUBLIC_PAGE_SEO) {
        console.log('📄 Public SEO page:', pathSegments[0]);
        const html = generatePublicPageHTML(PUBLIC_PAGE_SEO[pathSegments[0]]);
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
        });
      }

      console.log('📄 Special path, returning landing/default');
      if (supabaseUrl && supabaseKey) {
        const config = await fetchLinkPreviewConfig(supabaseUrl, supabaseKey, 'landing');
        if (config) {
          const html = generateConfigBasedHTML(config, request.url);
          return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
          });
        }
      }
      return new Response(generateDefaultMetaTagsHTML(), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    const slug = pathSegments[0];

    // Check if this is a product page: /:slug/produtos/:productId
    const isProductPage = pathSegments.length === 3 && pathSegments[1] === 'produtos';
    const productId = isProductPage ? pathSegments[2] : null;
    
    console.log('🔎 Analyzing URL:', {
      slug,
      isProductPage,
      productId: productId ? productId.substring(0, 8) + '...' : null,
      pathSegments
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return context.next();
    }

    if (isProductPage && productId) {
      // Handle product page
      console.log('🛍️ Processing product page');
      
      // First, get the product details
      const productResponse = await fetch(
        `${supabaseUrl}/rest/v1/products?id=eq.${productId}&select=id,title,description,short_description,featured_image_url,price,discounted_price,is_starting_price,user_id&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!productResponse.ok) {
        console.error('❌ Product query failed:', productResponse.status);
        return context.next();
      }

      const products = await productResponse.json() as ProductProfile[];

      if (products.length === 0) {
        console.log('⚠️ Product not found:', productId);
        return context.next();
      }

      const product = products[0];
      console.log('✅ Product found:', product.title);

      // Now get the user profile for this product
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${product.user_id}&select=name,slug,bio,avatar_url,cover_url_desktop,cover_url_mobile&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!profileResponse.ok) {
        console.error('❌ User profile query failed:', profileResponse.status);
        return context.next();
      }

      const profiles = await profileResponse.json() as UserProfile[];

      if (profiles.length === 0) {
        console.log('⚠️ User profile not found for product');
        return context.next();
      }

      const profile = profiles[0];
      console.log('✅ User profile found:', profile.name);

      // Verify that the slug matches the user's slug
      if (profile.slug !== slug) {
        console.log('⚠️ Slug mismatch - product belongs to different user');
        return context.next();
      }

      // Generate HTML with product-specific meta tags
      const html = generateProductMetaTagsHTML(product, profile, request.url);

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=600',
        },
      });

    } else {
      // Handle user profile page
      console.log('👤 Processing user profile page');
      
      // Fetch user profile from database
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/users?slug=eq.${slug}&select=name,slug,bio,avatar_url,cover_url_desktop,cover_url_mobile&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!profileResponse.ok) {
        console.error('❌ Database query failed:', profileResponse.status);
        return context.next();
      }

      const profiles = await profileResponse.json() as UserProfile[];

      if (profiles.length === 0) {
        console.log('⚠️ Profile not found for slug:', slug);
        return context.next();
      }

      const profile = profiles[0];
      console.log('✅ Profile found:', profile.name);

      // Generate HTML with user profile meta tags
      const html = generateMetaTagsHTML(profile, request.url);

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=600',
        },
      });
    }

  } catch (error) {
    console.error('❌ Error processing request:', error);
    console.error('📍 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    // Unable to process - pass to SPA
    return context.next();
  }
};

export const config = {
  path: "/*",
  excludedPath: ["/assets/*", "/api/*"],
};
