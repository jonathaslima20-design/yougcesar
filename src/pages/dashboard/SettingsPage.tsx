import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { ProfileSettings } from '@/components/dashboard/ProfileSettings';
import { StorefrontSettings } from '@/components/dashboard/StorefrontSettings';
import { AppearanceSettings } from '@/components/dashboard/AppearanceSettings';
import TrackingSettingsContent from '@/components/dashboard/TrackingSettingsContent';
import CheckoutSettingsContent from '@/components/dashboard/CheckoutSettingsContent';
import PaymentSettingsContent from '@/components/dashboard/PaymentSettingsContent';
import InventorySettingsContent from '@/components/dashboard/InventorySettingsContent';
import IntegrationsSettingsContent from '@/components/dashboard/IntegrationsSettingsContent';
import { CustomDomainSettings } from '@/components/dashboard/CustomDomainSettings';
import { usePlatformPaymentsEnabled } from '@/hooks/usePlatformPaymentsEnabled';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const SETTINGS_TABS = ['profile', 'appearance', 'storefront', 'checkout', 'payment', 'inventory', 'tracking', 'domain', 'integrations'] as const;

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const { user } = useAuth();
  const { enabled: paymentsEnabled, loading: paymentsLoading } = usePlatformPaymentsEnabled(user?.id);
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && (SETTINGS_TABS as readonly string[]).includes(tabFromUrl) ? tabFromUrl : 'profile'
  );
  const visibleTabs = SETTINGS_TABS.filter(
    (tab) => tab !== 'payment' || (!paymentsLoading && paymentsEnabled)
  );

  useEffect(() => {
    if (!paymentsLoading && activeTab === 'payment' && !paymentsEnabled) {
      setActiveTab('profile');
    }
  }, [paymentsLoading, paymentsEnabled, activeTab]);

  return (
    <div className="min-h-screen bg-background">
      <div className={cn(
        "container mx-auto px-4 sm:px-6 py-4 sm:py-6",
        activeTab === 'appearance' ? 'max-w-7xl' : 'max-w-5xl'
      )}>
        <Card className="border shadow-sm">
          <div className="p-4 sm:p-8">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
              <h1 className="text-xl sm:text-2xl font-semibold mb-1">Configurações</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Gerencie suas informações pessoais e configurações da vitrine
              </p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 sm:gap-4 border-b mb-6 sm:mb-8">
              {visibleTabs.map((tab) => {
                const labels: Record<string, string> = {
                  profile: 'Perfil',
                  appearance: 'Aparência',
                  storefront: 'Vitrine',
                  checkout: 'Regras de Pedido',
                  payment: 'Pagamento',
                  inventory: 'Estoque',
                  tracking: 'Rastreamento',
                  domain: 'Domínio',
                  integrations: 'Integrações',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-3 sm:px-4 py-3 text-sm font-medium transition-all relative whitespace-nowrap',
                      activeTab === tab
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {labels[tab]}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div>
              {activeTab === 'profile' && <ProfileSettings />}
              {activeTab === 'appearance' && <AppearanceSettings />}
              {activeTab === 'storefront' && <StorefrontSettings />}
              {activeTab === 'checkout' && <CheckoutSettingsContent />}
              {activeTab === 'payment' && <PaymentSettingsContent />}
              {activeTab === 'inventory' && <InventorySettingsContent />}
              {activeTab === 'tracking' && <TrackingSettingsContent />}
              {activeTab === 'domain' && <CustomDomainSettings />}
              {activeTab === 'integrations' && <IntegrationsSettingsContent />}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
