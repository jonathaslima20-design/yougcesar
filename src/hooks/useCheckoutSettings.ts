import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CheckoutSettings, PaymentMethodConfig, DeliveryOption, MinimumPurchaseConfig, ShippingInsuranceConfig, SuperFreteConfig } from '@/types';

const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'pix', name: 'PIX', enabled: false },
  { id: 'credit_card', name: 'Cartão de Crédito', enabled: false },
  { id: 'debit_card', name: 'Cartão de Débito', enabled: false },
  { id: 'cash', name: 'Dinheiro', enabled: false },
  { id: 'bank_transfer', name: 'Transferência Bancária', enabled: false },
];

const DEFAULT_MINIMUM_PURCHASE: MinimumPurchaseConfig = {
  enabled: false,
  type: 'value',
  value: 0,
};

const DEFAULT_SHIPPING_INSURANCE: ShippingInsuranceConfig = {
  enabled: false,
  percentageRate: 0,
};

const DEFAULT_SUPER_FRETE: SuperFreteConfig = {
  enabled: false,
  serviceIds: [],
};

const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  deliveryOptions: [],
  requirePaymentMethod: true,
  requireDeliveryOption: true,
  cartEnabled: true,
  minimumPurchase: DEFAULT_MINIMUM_PURCHASE,
  checkoutMode: 'whatsapp',
  shippingInsurance: DEFAULT_SHIPPING_INSURANCE,
  superFrete: DEFAULT_SUPER_FRETE,
};

interface UseCheckoutSettingsReturn {
  settings: CheckoutSettings;
  loading: boolean;
  saving: boolean;
  updateSettings: (settings: CheckoutSettings) => Promise<void>;
  insuranceGateEnabled: boolean;
}

export function useCheckoutSettings(): UseCheckoutSettingsReturn {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CheckoutSettings>(DEFAULT_CHECKOUT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('user_storefront_settings')
        .select('id, settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setSettingsId(data.id);
        if (data.settings?.checkout) {
          setSettings({
            paymentMethods: data.settings.checkout.paymentMethods ?? DEFAULT_PAYMENT_METHODS,
            deliveryOptions: data.settings.checkout.deliveryOptions ?? [],
            requirePaymentMethod: data.settings.checkout.requirePaymentMethod ?? true,
            requireDeliveryOption: data.settings.checkout.requireDeliveryOption ?? true,
            cartEnabled: data.settings.checkout.cartEnabled ?? true,
            minimumPurchase: data.settings.checkout.minimumPurchase ?? DEFAULT_MINIMUM_PURCHASE,
            checkoutMode: data.settings.checkout.checkoutMode ?? 'whatsapp',
            shippingInsurance: data.settings.checkout.shippingInsurance ?? DEFAULT_SHIPPING_INSURANCE,
            superFrete: data.settings.checkout.superFrete ?? DEFAULT_SUPER_FRETE,
          });
        }
      }
      setLoading(false);
    };

    fetchSettings();
  }, [user?.id]);

  const updateSettings = useCallback(async (newSettings: CheckoutSettings) => {
    if (!user?.id) return;
    setSaving(true);

    try {
      if (settingsId) {
        const { data: current } = await supabase
          .from('user_storefront_settings')
          .select('settings')
          .eq('id', settingsId)
          .maybeSingle();

        const updatedSettings = {
          ...(current?.settings || {}),
          checkout: newSettings,
        };

        const { error } = await supabase
          .from('user_storefront_settings')
          .update({ settings: updatedSettings })
          .eq('id', settingsId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('user_storefront_settings')
          .insert({
            user_id: user.id,
            settings: { checkout: newSettings },
          })
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (data) setSettingsId(data.id);
      }

      setSettings(newSettings);
    } finally {
      setSaving(false);
    }
  }, [user?.id, settingsId]);

  return { settings, loading, saving, updateSettings, insuranceGateEnabled: !!user?.insurance_enabled };
}

export function useCheckoutSettingsForStore(storeOwnerId: string | undefined) {
  const [settings, setSettings] = useState<CheckoutSettings>(DEFAULT_CHECKOUT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeOwnerId) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      const [{ data, error }, { data: platformSettings }, { data: storeOwner }] = await Promise.all([
        supabase
          .from('user_storefront_settings')
          .select('settings')
          .eq('user_id', storeOwnerId)
          .maybeSingle(),
        supabase
          .from('platform_payment_settings')
          .select('online_payments_enabled')
          .maybeSingle(),
        supabase
          .from('users')
          .select('payments_test_override, insurance_enabled')
          .eq('id', storeOwnerId)
          .maybeSingle(),
      ]);

      // Platform-wide kill switch: if online payments are disabled for the
      // whole app, every store falls back to WhatsApp-only checkout
      // regardless of what that merchant configured for themselves — unless
      // this specific merchant has an admin-granted test override, used to
      // finish and validate the feature on one real account at a time.
      const paymentsEnabledForStore =
        (platformSettings?.online_payments_enabled ?? false) || !!storeOwner?.payments_test_override;

      if (!error && data?.settings?.checkout) {
        const storeCheckoutMode = data.settings.checkout.checkoutMode ?? 'whatsapp';
        const rawShippingInsurance = data.settings.checkout.shippingInsurance ?? DEFAULT_SHIPPING_INSURANCE;
        setSettings({
          paymentMethods: data.settings.checkout.paymentMethods ?? DEFAULT_PAYMENT_METHODS,
          deliveryOptions: data.settings.checkout.deliveryOptions ?? [],
          requirePaymentMethod: data.settings.checkout.requirePaymentMethod ?? true,
          requireDeliveryOption: data.settings.checkout.requireDeliveryOption ?? true,
          cartEnabled: data.settings.checkout.cartEnabled ?? true,
          minimumPurchase: data.settings.checkout.minimumPurchase ?? DEFAULT_MINIMUM_PURCHASE,
          checkoutMode: paymentsEnabledForStore ? storeCheckoutMode : 'whatsapp',
          // Admin gate: never leak a stale insurance opt-in to buyers if the
          // merchant's access was revoked after they configured a rate.
          shippingInsurance: storeOwner?.insurance_enabled ? rawShippingInsurance : DEFAULT_SHIPPING_INSURANCE,
          // No admin gate needed here (unlike insurance) — merchant-shipping-quote
          // always re-verifies is_active server-side regardless of this value.
          superFrete: data.settings.checkout.superFrete ?? DEFAULT_SUPER_FRETE,
        });
      }
      setLoading(false);
    };

    fetchSettings();
  }, [storeOwnerId]);

  return { settings, loading };
}
