import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface InventorySettings {
  inventoryEnabled: boolean;
  showStockOnStorefront: boolean;
  autoDeductStock: boolean;
  blockZeroStock: boolean;
  reservationMinutes: number;
  loading: boolean;
}

export function useInventoryEnabled(): InventorySettings {
  const { user } = useAuth();
  const [settings, setSettings] = useState<InventorySettings>({
    inventoryEnabled: false,
    showStockOnStorefront: false,
    autoDeductStock: true,
    blockZeroStock: false,
    reservationMinutes: 15,
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setSettings({
        inventoryEnabled: false,
        showStockOnStorefront: false,
        autoDeductStock: true,
        blockZeroStock: false,
        reservationMinutes: 15,
        loading: false,
      });
      return;
    }

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data?.settings) {
        setSettings({
          inventoryEnabled: data.settings.enableInventory ?? false,
          showStockOnStorefront: data.settings.showStockOnStorefront ?? false,
          autoDeductStock: data.settings.autoDeductStock ?? true,
          blockZeroStock: data.settings.blockZeroStock ?? false,
          reservationMinutes: data.settings.reservationMinutes ?? 15,
          loading: false,
        });
      } else {
        setSettings(prev => ({ ...prev, loading: false }));
      }
    };

    fetchSettings();
  }, [user?.id]);

  return settings;
}

export function useInventoryEnabledForStore(storeOwnerId: string | undefined) {
  const [settings, setSettings] = useState<InventorySettings>({
    inventoryEnabled: false,
    showStockOnStorefront: false,
    autoDeductStock: true,
    blockZeroStock: false,
    reservationMinutes: 15,
    loading: true,
  });

  useEffect(() => {
    if (!storeOwnerId) {
      setSettings(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('user_storefront_settings')
        .select('settings')
        .eq('user_id', storeOwnerId)
        .maybeSingle();

      if (!error && data?.settings) {
        setSettings({
          inventoryEnabled: data.settings.enableInventory ?? false,
          showStockOnStorefront: data.settings.showStockOnStorefront ?? false,
          autoDeductStock: data.settings.autoDeductStock ?? true,
          blockZeroStock: data.settings.blockZeroStock ?? false,
          reservationMinutes: data.settings.reservationMinutes ?? 15,
          loading: false,
        });
      } else {
        setSettings(prev => ({ ...prev, loading: false }));
      }
    };

    fetchSettings();
  }, [storeOwnerId]);

  return settings;
}
