import { getShippingCredentialsConfig } from '@/lib/merchantShipping';
import IntegrationProviderGrid from './IntegrationProviderGrid';
import ShippingIntegrationSettingsContent from './ShippingIntegrationSettingsContent';
import DeliveryOptionsSettingsContent from './DeliveryOptionsSettingsContent';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

const CONNECTOR_COMPONENTS: Record<string, () => JSX.Element> = {
  superfrete: ShippingIntegrationSettingsContent,
};

export default function ShippingConnectorsSection() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <DeliveryOptionsSettingsContent />

      {user?.shipping_test_override && (
        <>
          <Separator />

          <IntegrationProviderGrid
            category="shipping"
            connectorComponents={CONNECTOR_COMPONENTS}
            fetchConnectedSlugs={async () => {
              const { config } = await getShippingCredentialsConfig().catch(() => ({ config: null }));
              return { superfrete: !!config?.is_active };
            }}
            heading="Transportadoras"
            description="Conecte um provedor para calcular fretes automaticamente no checkout online."
            emptyMessage="Nenhuma integração de frete disponível no momento."
          />
        </>
      )}
    </div>
  );
}
