/** Pix parcelado is a BRL-only payment option, only available for the plans with a billing
 * cycle long enough to split (semestral = 6 months, anual = 12 months). Shared between
 * PlansSharePage.tsx (the link sent to customers on WhatsApp) and LandingPage.tsx's
 * BRLPricingSection, so the installment amounts only need updating in one place. */
export const PIX_INSTALLMENTS: Record<string, { count: number; amount: string }> = {
  semestral: { count: 6, amount: '44,00' },
  anual: { count: 12, amount: '33,00' },
};

export function parseBRLAmount(amount: string): number {
  return Number(amount.replace(/\./g, '').replace(',', '.'));
}

export function formatBRLAmount(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** wa.me link to support, pre-filled for Pix parcelado questions — used by every
 * "Saiba mais" CTA on a Pix parcelado card (landing page, WhatsApp plans page,
 * and the in-app subscription modal), since that flow is arranged manually. */
export const PIX_SUPPORT_WHATSAPP_HREF = `https://wa.me/5591982465495?text=${encodeURIComponent(
  'Gostaria de mais informações sobre o pagamento em Pix parcelado.'
)}`;
