import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { ProfileSettings } from '@/components/dashboard/ProfileSettings';
import { StorefrontSettings } from '@/components/dashboard/StorefrontSettings';
import { usePlatformThemeSettings } from '@/hooks/usePlatformThemeSettings';
import { canUseEletronicosTheme } from '@/lib/platformThemeSettings';
import { StorefrontThemeSettings } from '@/components/dashboard/StorefrontThemeSettings';
import { StorefrontThemeCustomizeSettings } from '@/components/dashboard/StorefrontThemeCustomizeSettings';
import TrackingSettingsContent from '@/components/dashboard/TrackingSettingsContent';
import CheckoutSettingsContent from '@/components/dashboard/CheckoutSettingsContent';
import ShippingConnectorsSection from '@/components/dashboard/ShippingConnectorsSection';
import PaymentSettingsContent from '@/components/dashboard/PaymentSettingsContent';
import InventorySettingsContent from '@/components/dashboard/InventorySettingsContent';
import IntegrationsSettingsContent from '@/components/dashboard/IntegrationsSettingsContent';
import { CustomDomainSettings } from '@/components/dashboard/CustomDomainSettings';
import { usePlatformPaymentsEnabled } from '@/hooks/usePlatformPaymentsEnabled';
import { useAuth } from '@/contexts/AuthContext';
import { STOREFRONT_THEME_OPTIONS, type StorefrontThemeId } from '@/lib/appearanceDefaults';
import { cn } from '@/lib/utils';

const SETTINGS_TABS = ['profile', 'theme', 'theme-customize', 'storefront', 'checkout', 'shipping', 'payment', 'inventory', 'tracking', 'domain', 'integrations'] as const;

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const { user } = useAuth();
  const { enabled: paymentsEnabled, loading: paymentsLoading } = usePlatformPaymentsEnabled(user?.id);
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && (SETTINGS_TABS as readonly string[]).includes(tabFromUrl) ? tabFromUrl : 'profile'
  );
  const themeFromUrl = searchParams.get('theme');
  const [customizeThemeId, setCustomizeThemeId] = useState<StorefrontThemeId>(
    themeFromUrl === 'eletronicos' ? 'eletronicos' : 'padrao'
  );
  // A hidden theme can't be opened by URL either, except by admins.
  const { settings: platformThemeSettings } = usePlatformThemeSettings();
  const canCustomizeEletronicos = canUseEletronicosTheme(platformThemeSettings, user?.id) || user?.role === 'admin';
  const effectiveCustomizeThemeId: StorefrontThemeId =
    customizeThemeId === 'eletronicos' && !canCustomizeEletronicos ? 'padrao' : customizeThemeId;
  // "Personalizar <tema>" isn't a persistent tab in the bar — it only shows up,
  // right after "Tema", while it's the active tab (opened via the picker's
  // "Personalizar" button) and disappears once you navigate elsewhere.
  const visibleTabs = SETTINGS_TABS.filter(
    (tab) => tab !== 'theme-customize' && (tab !== 'payment' || (!paymentsLoading && paymentsEnabled))
  );

  const openCustomize = (themeId: StorefrontThemeId) => {
    setCustomizeThemeId(themeId);
    setActiveTab('theme-customize');
    setSearchParams({ tab: 'theme-customize', theme: themeId });
  };

  const goToThemeTab = () => {
    setActiveTab('theme');
    setSearchParams({ tab: 'theme' });
  };

  useEffect(() => {
    if (!paymentsLoading && activeTab === 'payment' && !paymentsEnabled) {
      setActiveTab('profile');
    }
  }, [paymentsLoading, paymentsEnabled, activeTab]);

  return (
    <div className="min-h-screen bg-background">
      <div className={cn(
        "container mx-auto px-4 sm:px-6 py-4 sm:py-6",
        activeTab === 'theme' || activeTab === 'theme-customize' ? 'max-w-7xl' : 'max-w-5xl'
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
              {visibleTabs.flatMap((tab) => {
                const labels: Record<string, string> = {
                  profile: 'Perfil',
                  theme: 'Tema',
                  storefront: 'Vitrine',
                  checkout: 'Regras de Pedido',
                  shipping: 'Frete',
                  payment: 'Pagamento',
                  inventory: 'Estoque',
                  tracking: 'Rastreamento',
                  domain: 'Domínio',
                  integrations: 'Integrações',
                };
                // "Personalizar <tema>" only shows up right after "Tema", and only while
                // it's the active tab — it's not a persistent bar item. It renders as a
                // single breadcrumb unit ("Tema / Personalizar Eletrônicos") nested inside
                // the same tab cell, not as a separate tab beside it, so "Tema" still reads
                // as the active section.
                if (tab === 'theme' && activeTab === 'theme-customize') {
                  return [
                    <div
                      key="theme-customize"
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium relative whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={goToThemeTab}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Tema
                      </button>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-foreground">
                        Personalizar {STOREFRONT_THEME_OPTIONS.find((t) => t.value === effectiveCustomizeThemeId)?.label}
                      </span>
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                    </div>,
                  ];
                }

                return [
                  <button
                    key={tab}
                    onClick={() => tab === 'theme' ? goToThemeTab() : setActiveTab(tab)}
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
                  </button>,
                ];
              })}
            </div>

            {/* Content */}
            <div>
              {activeTab === 'profile' && <ProfileSettings />}
              {activeTab === 'theme' && <StorefrontThemeSettings onCustomize={openCustomize} />}
              {activeTab === 'theme-customize' && (
                <StorefrontThemeCustomizeSettings themeId={effectiveCustomizeThemeId} onBack={goToThemeTab} />
              )}
              {activeTab === 'storefront' && <StorefrontSettings />}
              {activeTab === 'checkout' && <CheckoutSettingsContent />}
              {activeTab === 'shipping' && <ShippingConnectorsSection />}
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
