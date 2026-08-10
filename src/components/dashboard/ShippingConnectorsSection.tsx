import { getShippingCredentialsConfig } from '@/lib/merchantShipping';
import IntegrationProviderGrid from './IntegrationProviderGrid';
import ShippingIntegrationSettingsContent from './ShippingIntegrationSettingsContent';

const CONNECTOR_COMPONENTS: Record<string, () => JSX.Element> = {
  superfrete: ShippingIntegrationSettingsContent,
};

export default function ShippingConnectorsSection() {
  return (
    <IntegrationProviderGrid
      category="shipping"
      connectorComponents={CONNECTOR_COMPONENTS}
      fetchConnectedSlugs={async () => {
        const { config } = await getShippingCredentialsConfig().catch(() => ({ config: null }));
        return { superfrete: !!config?.is_active };
      }}
      heading="Transportadoras e cálculo de frete"
      description="Conecte um provedor para calcular fretes automaticamente no checkout."
      emptyMessage="Nenhuma integração de frete disponível no momento."
    />
  );
}
