declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export function trackGoogleAdsCadastro(tagId: string, conversionId: string) {
  if (!tagId || !conversionId) return;
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'conversion', {
    send_to: `${tagId}/${conversionId}`,
    value: 0,
    currency: 'BRL',
  });
}

export function trackGoogleAdsCheckout(tagId: string, conversionId: string) {
  if (!tagId || !conversionId) return;
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'conversion', {
    send_to: `${tagId}/${conversionId}`,
    value: 0,
    currency: 'BRL',
  });
}

export function trackGoogleAdsPurchase(
  tagId: string,
  conversionId: string,
  value: number,
  transactionId: string
) {
  if (!tagId || !conversionId) return;
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', 'conversion', {
    send_to: `${tagId}/${conversionId}`,
    value,
    currency: 'BRL',
    transaction_id: transactionId,
  });
}
