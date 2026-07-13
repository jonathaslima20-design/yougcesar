import { useEffect, useState } from 'react';
import { Save, Tag, Loader as Loader2, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, ExternalLink, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';

type SaveState = 'idle' | 'saving' | 'success' | 'error';

const GTM_PATTERN = /^GTM-[A-Z0-9]+$/;
const GOOGLE_ADS_TAG_PATTERN = /^AW-[0-9]+$/;

interface TrackingConfig {
  gtm_container_id: string;
  google_ads_tag_id: string;
  google_ads_enabled: boolean;
  google_ads_cadastro_id: string;
  google_ads_checkout_id: string;
  google_ads_purchase_id: string;
}

export default function AdminTrackingPage() {
  const [gtmId, setGtmId] = useState('');
  const [googleAdsTagId, setGoogleAdsTagId] = useState('');
  const [googleAdsEnabled, setGoogleAdsEnabled] = useState(false);
  const [googleAdsCadastroId, setGoogleAdsCadastroId] = useState('');
  const [googleAdsCheckoutId, setGoogleAdsCheckoutId] = useState('');
  const [googleAdsPurchaseId, setGoogleAdsPurchaseId] = useState('');

  const [gtmSaveState, setGtmSaveState] = useState<SaveState>('idle');
  const [googleAdsSaveState, setGoogleAdsSaveState] = useState<SaveState>('idle');
  const [loading, setLoading] = useState(true);
  const [gtmError, setGtmError] = useState('');
  const [googleAdsError, setGoogleAdsError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('landing_tracking_config')
        .select('gtm_container_id, google_ads_tag_id, google_ads_enabled, google_ads_cadastro_id, google_ads_checkout_id, google_ads_purchase_id')
        .maybeSingle();

      if (data) {
        if (data.gtm_container_id) setGtmId(data.gtm_container_id);
        if (data.google_ads_tag_id) setGoogleAdsTagId(data.google_ads_tag_id);
        setGoogleAdsEnabled(data.google_ads_enabled ?? false);
        if (data.google_ads_cadastro_id) setGoogleAdsCadastroId(data.google_ads_cadastro_id);
        if (data.google_ads_checkout_id) setGoogleAdsCheckoutId(data.google_ads_checkout_id);
        if (data.google_ads_purchase_id) setGoogleAdsPurchaseId(data.google_ads_purchase_id);
      }
      setLoading(false);
    })();
  }, []);

  async function handleSaveGtm() {
    const trimmed = gtmId.trim();
    if (trimmed && !GTM_PATTERN.test(trimmed)) {
      setGtmError('Formato inválido. Use o padrão GTM-XXXXXXX.');
      return;
    }
    setGtmError('');
    setGtmSaveState('saving');
    const { error } = await supabase
      .from('landing_tracking_config')
      .upsert({ id: 1, gtm_container_id: trimmed || null }, { onConflict: 'id' });

    if (error) {
      setGtmSaveState('error');
    } else {
      setGtmSaveState('success');
      setTimeout(() => setGtmSaveState('idle'), 3000);
    }
  }

  async function handleSaveGoogleAds() {
    const trimmedTag = googleAdsTagId.trim();
    if (trimmedTag && !GOOGLE_ADS_TAG_PATTERN.test(trimmedTag)) {
      setGoogleAdsError('Formato inválido. Use o padrão AW-XXXXXXXXXX.');
      return;
    }
    setGoogleAdsError('');
    setGoogleAdsSaveState('saving');
    const { error } = await supabase
      .from('landing_tracking_config')
      .upsert(
        {
          id: 1,
          google_ads_tag_id: trimmedTag || '',
          google_ads_enabled: googleAdsEnabled,
          google_ads_cadastro_id: googleAdsCadastroId.trim() || '',
          google_ads_checkout_id: googleAdsCheckoutId.trim() || '',
          google_ads_purchase_id: googleAdsPurchaseId.trim() || '',
        },
        { onConflict: 'id' }
      );

    if (error) {
      setGoogleAdsSaveState('error');
    } else {
      setGoogleAdsSaveState('success');
      setTimeout(() => setGoogleAdsSaveState('idle'), 3000);
    }
  }

  function SaveFeedback({ state }: { state: SaveState }) {
    if (state === 'success') {
      return (
        <span className="text-sm text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4" />
          Salvo com sucesso
        </span>
      );
    }
    if (state === 'error') {
      return (
        <span className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          Erro ao salvar
        </span>
      );
    }
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações de Rastreamento</h1>
        <p className="text-muted-foreground mt-1">
          Configure as integrações de rastreamento para o site público do VitrineTurbo.
        </p>
      </div>

      {/* GTM Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4" />
            Google Tag Manager
          </CardTitle>
          <CardDescription>
            O snippet GTM será injetado automaticamente em todas as páginas públicas quando um
            Container ID válido estiver configurado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="gtm-id">Container ID</Label>
                <Input
                  id="gtm-id"
                  placeholder="GTM-XXXXXXX"
                  value={gtmId}
                  onChange={(e) => { setGtmId(e.target.value); setGtmError(''); setGtmSaveState('idle'); }}
                  className={gtmError ? 'border-destructive' : ''}
                />
                {gtmError && (
                  <p className="text-destructive text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {gtmError}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Encontre o Container ID no painel do{' '}
                  <a
                    href="https://tagmanager.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 inline-flex items-center gap-0.5"
                  >
                    Google Tag Manager
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  . Deixe em branco para desativar.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={handleSaveGtm}
                  disabled={gtmSaveState === 'saving'}
                  className="gap-2"
                >
                  {gtmSaveState === 'saving' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
                <SaveFeedback state={gtmSaveState} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Google Ads Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Google Ads
          </CardTitle>
          <CardDescription>
            Configure a tag de conversão do Google Ads para rastrear cadastros, inícios de
            checkout e assinaturas pagas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Ativar Tag do Google Ads</p>
                  <p className="text-xs text-muted-foreground">
                    Injeta o script base do Google Ads em todas as páginas públicas.
                  </p>
                </div>
                <Switch
                  checked={googleAdsEnabled}
                  onCheckedChange={(v) => { setGoogleAdsEnabled(v); setGoogleAdsSaveState('idle'); }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gads-tag-id">ID da Tag do Google Ads</Label>
                <Input
                  id="gads-tag-id"
                  placeholder="AW-XXXXXXXXXX"
                  value={googleAdsTagId}
                  onChange={(e) => { setGoogleAdsTagId(e.target.value); setGoogleAdsError(''); setGoogleAdsSaveState('idle'); }}
                  className={googleAdsError ? 'border-destructive' : ''}
                />
                {googleAdsError && (
                  <p className="text-destructive text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {googleAdsError}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Encontre o ID no{' '}
                  <a
                    href="https://ads.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 inline-flex items-center gap-0.5"
                  >
                    Google Ads
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {' '}em Ferramentas → Conversões. Ex: AW-1234567890
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <p className="text-sm font-medium text-muted-foreground">IDs de Conversão</p>

                <div className="space-y-1.5">
                  <Label htmlFor="gads-cadastro-id">Cadastro Free</Label>
                  <Input
                    id="gads-cadastro-id"
                    placeholder="AbCdEfGhIjKlMnOp"
                    value={googleAdsCadastroId}
                    onChange={(e) => { setGoogleAdsCadastroId(e.target.value); setGoogleAdsSaveState('idle'); }}
                  />
                  <p className="text-muted-foreground text-xs">
                    Disparado quando um usuário conclui o cadastro gratuito.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gads-checkout-id">Início de Checkout</Label>
                  <Input
                    id="gads-checkout-id"
                    placeholder="AbCdEfGhIjKlMnOp"
                    value={googleAdsCheckoutId}
                    onChange={(e) => { setGoogleAdsCheckoutId(e.target.value); setGoogleAdsSaveState('idle'); }}
                  />
                  <p className="text-muted-foreground text-xs">
                    Disparado quando o usuário clica em "Assinar Agora" e inicia o checkout.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gads-purchase-id">Assinatura Paga</Label>
                  <Input
                    id="gads-purchase-id"
                    placeholder="AbCdEfGhIjKlMnOp"
                    value={googleAdsPurchaseId}
                    onChange={(e) => { setGoogleAdsPurchaseId(e.target.value); setGoogleAdsSaveState('idle'); }}
                  />
                  <p className="text-muted-foreground text-xs">
                    Disparado quando o pagamento é confirmado pelo MercadoPago.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={handleSaveGoogleAds}
                  disabled={googleAdsSaveState === 'saving'}
                  className="gap-2"
                >
                  {googleAdsSaveState === 'saving' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Google Ads
                </Button>
                <SaveFeedback state={googleAdsSaveState} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
