import { getErpConfig } from '@/lib/merchantErp';
import IntegrationProviderGrid from './IntegrationProviderGrid';
import OlistIntegrationSection from './OlistIntegrationSection';

const CONNECTOR_COMPONENTS: Record<string, () => JSX.Element> = {
  olist: OlistIntegrationSection,
};

export default function ErpConnectorsSection() {
  return (
    <IntegrationProviderGrid
      category="erp"
      connectorComponents={CONNECTOR_COMPONENTS}
      fetchConnectedSlugs={async () => {
        const { config } = await getErpConfig().catch(() => ({ config: null }));
        return { olist: !!config?.connected };
      }}
      heading="ERPs e sistemas de gestão"
      description="Conecte um sistema pronto para sincronizar estoque e produtos automaticamente."
      emptyMessage="Nenhuma integração disponível no momento."
    />
  );
}
