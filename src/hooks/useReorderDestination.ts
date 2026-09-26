import { useCheckoutSettingsForStore } from '@/hooks/useCheckoutSettings';

// Where "Comprar de novo" / "Repetir pedido" should land after the items are in
// the cart: straight into the online checkout (address -> payment) when the store
// takes online payments, otherwise the storefront, where the WhatsApp order is
// finalized from the cart modal. Uses the same settings hook as the storefront so
// the payments test-account gating stays consistent.
export function useReorderDestination(store: { id: string; slug: string } | null): {
  destination: string | null;
  isCheckout: boolean;
} {
  const { settings } = useCheckoutSettingsForStore(store?.id);
  if (!store) return { destination: null, isCheckout: false };
  return settings.onlinePaymentEnabled
    ? { destination: `/${store.slug}/pedido/endereco`, isCheckout: true }
    : { destination: `/${store.slug}`, isCheckout: false };
}
