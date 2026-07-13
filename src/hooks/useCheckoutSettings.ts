import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CheckoutSettings, PaymentMethodConfig, DeliveryOption } from '@/types';

const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'pix', name: 'PIX', enabled: false },
  { id: 'credit_card', name: 'Cartão de Crédito', enabled: false },
  { id: 'debit_card', name: 'Cartão de Débito', enabled: false },
  { id: 'cash', name: 'Dinheiro', enabled: false },
  { id: 'bank_transfer', name: 'Transferência Bancária', enabled: false },
];

const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  deliveryOptions: [],
  requirePaymentMethod: true,
  requireDeliveryOption: true,
  cartEnabled: true,
};

interface UseCheckoutSettingsReturn {
  settings: CheckoutSettings;
  loading: boolean;
  saving: boolean;
  updateSettings: (settings: CheckoutSettings) => Promise<void>;
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

  return { settings, loading, saving, updateSettings };
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
      const { data, error } = await supabase
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', storeOwnerId)
        .maybeSingle();

      if (!error && data?.settings?.checkout) {
        setSettings({
          paymentMethods: data.settings.checkout.paymentMethods ?? DEFAULT_PAYMENT_METHODS,
          deliveryOptions: data.settings.checkout.deliveryOptions ?? [],
          requirePaymentMethod: data.settings.checkout.requirePaymentMethod ?? true,
          requireDeliveryOption: data.settings.checkout.requireDeliveryOption ?? true,
          cartEnabled: data.settings.checkout.cartEnabled ?? true,
        });
      }
      setLoading(false);
    };

    fetchSettings();
  }, [storeOwnerId]);

  return { settings, loading };
}
