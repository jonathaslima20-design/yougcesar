import { useEffect, useState, useCallback } from 'react';
import { Save, Code as Code2, ChartBar as BarChart3, Loader as Loader2, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Eye, EyeOff, ExternalLink, Server, Globe, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';

interface TrackingConfig {
  meta_pixel_id: string;
  google_tag_id: string;
  meta_capi_token: string;
  meta_capi_enabled: boolean;
  meta_pixel_enabled: boolean;
  meta_test_event_code: string;
  meta_domain_verification: string;
}

type SaveState = 'idle' | 'saving' | 'success' | 'error';

export default function SettingsPage() {
  const [config, setConfig] = useState<TrackingConfig>({
    meta_pixel_id: '',
    google_tag_id: '',
    meta_capi_token: '',
    meta_capi_enabled: false,
    meta_pixel_enabled: false,
    meta_test_event_code: '',
    meta_domain_verification: '',
  });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [pixelIdError, setPixelIdError] = useState('');
  const [capiTestResult, setCapiTestResult] = useState<any>(null);
  const [capiTesting, setCapiTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('landing_tracking_config')
        .select('meta_pixel_id, google_tag_id, meta_capi_token, meta_capi_enabled, meta_pixel_enabled, meta_test_event_code, meta_domain_verification')
        .maybeSingle();
      if (data) {
        setConfig({
          meta_pixel_id: data.meta_pixel_id || '',
          google_tag_id: data.google_tag_id || '',
          meta_capi_token: data.meta_capi_token || '',
          meta_capi_enabled: data.meta_capi_enabled || false,
          meta_pixel_enabled: data.meta_pixel_enabled || false,
          meta_test_event_code: data.meta_test_event_code || '',
          meta_domain_verification: data.meta_domain_verification || '',
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleTestCapi = useCallback(async () => {
    setCapiTesting(true);
    setCapiTestResult(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/meta-capi?test=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
      });
      const json = await res.json();
      setCapiTestResult(json);
    } catch (e: any) {
      setCapiTestResult({ ok: false, error: e.message });
    } finally {
      setCapiTesting(false);
    }
  }, []);

  const handleSave = async () => {
    if (config.meta_pixel_id && !/^\d+$/.test(config.meta_pixel_id)) {
      setPixelIdError('O Pixel ID deve conter apenas números');
      return;
    }
    setPixelIdError('');
    setSaveState('saving');
    setErrorMsg('');
    const { error } = await supabase
      .from('landing_tracking_config')
      .upsert({ id: 1, ...config, updated_at: new Date().toISOString() });
    if (error) {
      setErrorMsg(error.message);
      setSaveState('error');
    } else {
      setSaveState('success');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerencie as configurações globais da plataforma</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Code2 className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Rastreamento da Landing Page</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Configure os pixels e tags de rastreamento exibidos na página pública
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando configurações...</span>
            </div>
          ) : (
            <>
              {/* Google Tag */}
              <div className="space-y-2">
                <Label htmlFor="google-tag" className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4 text-[#E37400]" />
                  Google Tag ID
                </Label>
                <Input
                  id="google-tag"
                  placeholder="Ex: GTM-XXXXXXX ou G-XXXXXXXXXX"
                  value={config.google_tag_id}
                  onChange={(e) => setConfig((c) => ({ ...c, google_tag_id: e.target.value.trim() }))}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Aceita formato <span className="font-mono">GTM-XXXXXXX</span> (Google Tag Manager) ou{' '}
                  <span className="font-mono">G-XXXXXXXXXX</span> (Google Analytics 4).
                </p>
              </div>

              <Separator />

              {/* Meta Pixel Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#0866FF] text-white text-[10px] font-bold leading-none select-none">f</span>
                  <span className="text-sm font-semibold">Meta Pixel & API de Conversões</span>
                </div>

                {/* Pixel ID */}
                <div className="space-y-2">
                  <Label htmlFor="meta-pixel" className="text-sm font-medium">
                    Pixel ID do Meta
                  </Label>
                  <Input
                    id="meta-pixel"
                    placeholder="Ex: 1234567890123456"
                    value={config.meta_pixel_id}
                    onChange={(e) => {
                      setConfig((c) => ({ ...c, meta_pixel_id: e.target.value.trim() }));
                      setPixelIdError('');
                    }}
                    className="font-mono text-sm"
                  />
                  {pixelIdError && (
                    <p className="text-xs text-destructive">{pixelIdError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Encontre seu Pixel ID em{' '}
                    <a
                      href="https://business.facebook.com/events_manager"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      Gerenciador de Eventos <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>

                {/* Pixel Enabled Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Ativar Meta Pixel (browser)</Label>
                    <p className="text-xs text-muted-foreground">
                      Injeta o script do pixel no frontend para rastreamento client-side
                    </p>
                  </div>
                  <Switch
                    checked={config.meta_pixel_enabled}
                    onCheckedChange={(checked) => setConfig((c) => ({ ...c, meta_pixel_enabled: checked }))}
                  />
                </div>

                <Separator className="my-2" />

                {/* CAPI Token */}
                <div className="space-y-2">
                  <Label htmlFor="capi-token" className="flex items-center gap-2 text-sm font-medium">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    Token de Acesso da API de Conversões
                  </Label>
                  <div className="relative">
                    <Input
                      id="capi-token"
                      type={showToken ? 'text' : 'password'}
                      placeholder="Token gerado no Gerenciador de Eventos"
                      value={config.meta_capi_token}
                      onChange={(e) => setConfig((c) => ({ ...c, meta_capi_token: e.target.value.trim() }))}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O token nunca é exposto no frontend. Usado apenas no servidor para eventos server-side.
                  </p>
                </div>

                {/* CAPI Enabled Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Ativar API de Conversões (servidor)</Label>
                    <p className="text-xs text-muted-foreground">
                      Envia eventos server-side para o Meta (não é bloqueado por ad blockers)
                    </p>
                  </div>
                  <Switch
                    checked={config.meta_capi_enabled}
                    onCheckedChange={(checked) => setConfig((c) => ({ ...c, meta_capi_enabled: checked }))}
                  />
                </div>

                {/* Test Event Code */}
                <div className="space-y-2">
                  <Label htmlFor="test-event-code" className="text-sm font-medium">
                    Código de Teste de Eventos (opcional)
                  </Label>
                  <Input
                    id="test-event-code"
                    placeholder="Ex: TEST12345"
                    value={config.meta_test_event_code}
                    onChange={(e) => setConfig((c) => ({ ...c, meta_test_event_code: e.target.value.trim() }))}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use a aba "Testar eventos" no Gerenciador de Eventos para validar antes de ativar em produção.
                  </p>
                </div>

                {/* CAPI Test Button */}
                <div className="rounded-lg border border-dashed p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Testar API de Conversões</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestCapi}
                      disabled={capiTesting}
                    >
                      {capiTesting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                      {capiTesting ? 'Testando...' : 'Enviar evento de teste'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Envia um PageView de teste para a CAPI do Meta. Salve as configurações antes de testar.
                  </p>
                  {capiTestResult && (
                    <pre className="mt-2 p-3 rounded-md bg-muted text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
                      {JSON.stringify(capiTestResult, null, 2)}
                    </pre>
                  )}
                </div>

                <Separator className="my-2" />

                {/* Domain Verification */}
                <div className="space-y-2">
                  <Label htmlFor="domain-verification" className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    Meta Tag de Verificação de Domínio
                  </Label>
                  <Input
                    id="domain-verification"
                    placeholder="Ex: abcdef1234567890abcdef1234567890"
                    value={config.meta_domain_verification}
                    onChange={(e) => setConfig((c) => ({ ...c, meta_domain_verification: e.target.value.trim() }))}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas o valor (content) da tag. Será injetado como{' '}
                    <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
                      {'<meta name="facebook-domain-verification" content="..." />'}
                    </code>{' '}
                    no head da landing page.{' '}
                    <a
                      href="https://business.facebook.com/settings/owned-domains"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      Verificar domínio <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>

              {saveState === 'error' && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{errorMsg || 'Erro ao salvar. Tente novamente.'}</span>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={saveState === 'saving'}
                className="w-full sm:w-auto"
              >
                {saveState === 'saving' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {saveState === 'success' && <CheckCircle2 className="h-4 w-4 mr-2" />}
                {(saveState === 'idle' || saveState === 'error') && <Save className="h-4 w-4 mr-2" />}
                {saveState === 'saving' ? 'Salvando...' : saveState === 'success' ? 'Salvo!' : 'Salvar configurações'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
