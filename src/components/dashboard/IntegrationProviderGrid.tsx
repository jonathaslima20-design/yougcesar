import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader as Loader2, ArrowLeft, ChevronRight, Boxes } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

interface IntegrationProvider {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
}

interface IntegrationProviderGridProps {
  category: 'erp' | 'shipping';
  // Which provider cards actually have a working configuration screen behind
  // them. An admin can publish a provider's card (name/logo) before its
  // connector is built — clicking one of those shows "em breve" instead of a
  // broken screen. Add the slug here only once its detail component exists.
  connectorComponents: Record<string, () => JSX.Element>;
  // Resolves which of the implemented slugs are currently connected, for the
  // grid's status badge. Runs in parallel with the providers query, same
  // shape as ErpConnectorsSection's original getErpConfig() call.
  fetchConnectedSlugs: () => Promise<Record<string, boolean>>;
  heading: string;
  description: string;
  emptyMessage: string;
}

export default function IntegrationProviderGrid({
  category,
  connectorComponents,
  fetchConnectedSlugs,
  heading,
  description,
  emptyMessage,
}: IntegrationProviderGridProps) {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: providerRows, error }, connectedMap] = await Promise.all([
        supabase
          .from('integration_providers')
          .select('id, slug, name, description, logo_url')
          .eq('is_enabled', true)
          .eq('category', category)
          .order('sort_order', { ascending: true }),
        fetchConnectedSlugs().catch(() => ({})),
      ]);
      if (error) throw error;
      setProviders(providerRows || []);
      setConnected(connectedMap || {});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar integrações');
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setSelectedSlug(null);
    loadData();
  }

  function handleSelect(provider: IntegrationProvider) {
    if (!connectorComponents[provider.slug]) {
      toast.info(`${provider.name} ainda não está disponível para configuração.`);
      return;
    }
    setSelectedSlug(provider.slug);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedSlug && connectorComponents[selectedSlug]) {
    const DetailComponent = connectorComponents[selectedSlug];
    return (
      <div className="space-y-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar
        </Button>
        <DetailComponent />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium mb-1">{heading}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {providers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {providers.map((provider) => {
            const isImplemented = !!connectorComponents[provider.slug];
            const isConnected = !!connected[provider.slug];
            return (
              <Card
                key={provider.id}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all overflow-hidden group"
                onClick={() => handleSelect(provider)}
              >
                <div className="aspect-[16/9] bg-muted/40 border-b flex items-center justify-center overflow-hidden">
                  {provider.logo_url ? (
                    <img
                      src={provider.logo_url}
                      alt={provider.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Boxes className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <CardContent className="p-3.5 space-y-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{provider.name}</p>
                    {provider.description && (
                      <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    {!isImplemented ? (
                      <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                    ) : (
                      <Badge
                        variant={isConnected ? 'default' : 'outline'}
                        className={`text-[10px] ${isConnected ? 'bg-green-500 text-white' : ''}`}
                      >
                        {isConnected ? 'Conectado' : 'Não conectado'}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
