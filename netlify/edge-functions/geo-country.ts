import type { Context } from "https://edge.netlify.com";

/**
 * Devolve o país detectado por geolocalização de IP (nativo do Netlify),
 * usado pelo frontend para decidir provedor de pagamento (src/lib/billing/provider.ts)
 * e moeda no cadastro/checkout. Fallback 'BR' se a geolocalização não estiver
 * disponível — nunca deve travar o funil.
 */
export default async (_req: Request, context: Context) => {
  const country = context.geo?.country?.code ?? "BR";

  return new Response(JSON.stringify({ country }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
