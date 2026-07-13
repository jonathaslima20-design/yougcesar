import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Link2, RefreshCw, Save, Globe, Gift, CircleHelp as HelpCircle, Store, Package, Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LinkPreviewConfig {
  id: string;
  page_type: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  og_site_name: string;
  og_type: string;
  twitter_card_type: string;
  is_active: boolean;
  placeholders_hint: string | null;
}

const PAGE_TYPE_META: Record<string, { label: string; description: string; icon: typeof Globe; exampleUrl: string }> = {
  landing: {
    label: 'Landing Page',
    description: 'Preview quando o link principal vitrineturbo.com e compartilhado',
    icon: Globe,
    exampleUrl: 'https://vitrineturbo.com/',
  },
  referral: {
    label: 'Links de Indicacao',
    description: 'Preview dos links de indicacao (?ref=CODIGO) compartilhados por afiliados',
    icon: Gift,
    exampleUrl: 'https://vitrineturbo.com/?ref=VT3K8MX',
  },
  help_center: {
    label: 'Central de Ajuda',
    description: 'Preview quando links da central de ajuda sao compartilhados',
    icon: HelpCircle,
    exampleUrl: 'https://vitrineturbo.com/help',
  },
  corretor_default: {
    label: 'Vitrine (Padrao)',
    description: 'Template padrao para vitrines de usuarios sem avatar ou bio personalizada',
    icon: Store,
    exampleUrl: 'https://vitrineturbo.com/nome-da-loja',
  },
  product_default: {
    label: 'Produto (Padrao)',
    description: 'Template padrao para paginas de produto sem imagem destacada',
    icon: Package,
    exampleUrl: 'https://vitrineturbo.com/loja/produtos/123',
  },
};

export default function LinkPreviewPage() {
  const [configs, setConfigs] = useState<LinkPreviewConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('link_preview_configs')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setConfigs(data || []);
    } catch (err) {
      console.error('Error fetching link preview configs:', err);
      toast.error('Erro ao carregar configuracoes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleSave = async (config: LinkPreviewConfig) => {
    setSaving(config.page_type);
    try {
      const { error } = await supabase
        .from('link_preview_configs')
        .update({
          og_title: config.og_title,
          og_description: config.og_description,
          og_image_url: config.og_image_url,
          og_site_name: config.og_site_name,
          og_type: config.og_type,
          twitter_card_type: config.twitter_card_type,
          is_active: config.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);
      if (error) throw error;
      toast.success(`Preview "${PAGE_TYPE_META[config.page_type]?.label}" salvo com sucesso`);
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Erro ao salvar configuracao');
    } finally {
      setSaving(null);
    }
  };

  const updateConfig = (pageType: string, field: keyof LinkPreviewConfig, value: string | boolean) => {
    setConfigs(prev => prev.map(c =>
      c.page_type === pageType ? { ...c, [field]: value } : c
    ));
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title flex items-center gap-2">
            <Link2 className="h-7 w-7" />
            Previews de Links
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure como os links do sistema aparecem quando compartilhados no WhatsApp, Facebook, Twitter e outras redes sociais.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchConfigs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue={configs[0]?.page_type || 'landing'} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {configs.map(config => {
            const meta = PAGE_TYPE_META[config.page_type];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <TabsTrigger key={config.page_type} value={config.page_type} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{meta.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {configs.map(config => {
          const meta = PAGE_TYPE_META[config.page_type];
          if (!meta) return null;
          return (
            <TabsContent key={config.page_type} value={config.page_type}>
              <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
                <ConfigForm
                  config={config}
                  meta={meta}
                  saving={saving === config.page_type}
                  onUpdate={(field, value) => updateConfig(config.page_type, field, value)}
                  onSave={() => handleSave(config)}
                />
                <LinkPreviewSimulator config={config} exampleUrl={meta.exampleUrl} />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function ConfigForm({
  config,
  meta,
  saving,
  onUpdate,
  onSave,
}: {
  config: LinkPreviewConfig;
  meta: { label: string; description: string; exampleUrl: string };
  saving: boolean;
  onUpdate: (field: keyof LinkPreviewConfig, value: string | boolean) => void;
  onSave: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{meta.label}</CardTitle>
            <CardDescription>{meta.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`active-${config.page_type}`} className="text-xs text-muted-foreground">
              {config.is_active ? 'Ativo' : 'Inativo'}
            </Label>
            <Switch
              id={`active-${config.page_type}`}
              checked={config.is_active}
              onCheckedChange={(v) => onUpdate('is_active', v)}
            />
          </div>
        </div>
        {config.placeholders_hint && (
          <Badge variant="outline" className="text-xs font-normal mt-2 w-fit">
            {config.placeholders_hint}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>
            Titulo (og:title)
            <span className="text-xs text-muted-foreground ml-2">
              {config.og_title.length}/70 caracteres
            </span>
          </Label>
          <Input
            value={config.og_title}
            onChange={(e) => onUpdate('og_title', e.target.value)}
            placeholder="Titulo do link preview"
            maxLength={120}
          />
          {config.og_title.length > 60 && (
            <p className="text-xs text-amber-600">Titulos acima de 60 caracteres podem ser cortados em algumas plataformas</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Descricao (og:description)
            <span className="text-xs text-muted-foreground ml-2">
              {config.og_description.length}/200 caracteres
            </span>
          </Label>
          <Textarea
            value={config.og_description}
            onChange={(e) => onUpdate('og_description', e.target.value)}
            placeholder="Descricao que aparece abaixo do titulo no preview"
            rows={3}
            maxLength={300}
          />
          {config.og_description.length > 155 && (
            <p className="text-xs text-amber-600">Descricoes acima de 155 caracteres podem ser cortadas</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>URL da Imagem (og:image)</Label>
          <Input
            value={config.og_image_url}
            onChange={(e) => onUpdate('og_image_url', e.target.value)}
            placeholder="https://... (recomendado 1200x630px)"
          />
          <p className="text-xs text-muted-foreground">
            Deixe vazio para usar imagens automaticas (avatar do usuario ou foto do produto).
            Tamanho recomendado: 1200x630 pixels.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Site Name</Label>
            <Input
              value={config.og_site_name}
              onChange={(e) => onUpdate('og_site_name', e.target.value)}
              placeholder="VitrineTurbo"
            />
          </div>
          <div className="space-y-2">
            <Label>OG Type</Label>
            <Select value={config.og_type} onValueChange={(v) => onUpdate('og_type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website">website</SelectItem>
                <SelectItem value="article">article</SelectItem>
                <SelectItem value="profile">profile</SelectItem>
                <SelectItem value="product">product</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Twitter Card</Label>
            <Select value={config.twitter_card_type} onValueChange={(v) => onUpdate('twitter_card_type', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">summary</SelectItem>
                <SelectItem value="summary_large_image">summary_large_image</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alteracoes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LinkPreviewSimulator({ config, exampleUrl }: { config: LinkPreviewConfig; exampleUrl: string }) {
  const displayTitle = config.og_title
    .replace('{nome_indicador}', 'Maria Silva')
    .replace('{codigo}', 'VT3K8MX')
    .replace('{nome_loja}', 'Moda Fashion')
    .replace('{nome_produto}', 'Camiseta Preta G')
    .replace('{preco}', 'R$ 59,90');

  const displayDescription = config.og_description
    .replace('{nome_indicador}', 'Maria Silva')
    .replace('{codigo}', 'VT3K8MX')
    .replace('{nome_loja}', 'Moda Fashion')
    .replace('{nome_produto}', 'Camiseta Preta G')
    .replace('{preco}', 'R$ 59,90')
    .replace('{descricao_produto}', 'Camiseta premium 100% algodao, confortavel e estilosa.');

  const displayImage = config.og_image_url || 'https://ikvwygqmlqhsyqmpgaoz.supabase.co/storage/v1/object/public/public/logos/flat-icon-vitrine.png';

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + '...' : text;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-3">Simulacao de Preview</h3>
        {!config.is_active && (
          <Badge variant="outline" className="text-xs mb-3 border-amber-300 text-amber-600">
            Inativo - usando valores padrao do sistema
          </Badge>
        )}
      </div>

      {/* WhatsApp style preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WhatsApp</p>
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
          {displayImage && (
            <div className="w-full h-[140px] bg-muted flex items-center justify-center overflow-hidden">
              <img
                src={displayImage}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <div className="p-3 border-t bg-[#f0f0f0]">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">
              {new URL(exampleUrl).hostname}
            </p>
            <p className="text-[13px] font-semibold text-gray-900 leading-tight">
              {truncate(displayTitle, 65)}
            </p>
            <p className="text-[12px] text-gray-600 mt-0.5 leading-snug">
              {truncate(displayDescription, 100)}
            </p>
          </div>
        </div>
      </div>

      {/* Facebook style preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Facebook</p>
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
          {displayImage && (
            <div className="w-full h-[160px] bg-muted flex items-center justify-center overflow-hidden">
              <img
                src={displayImage}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <div className="p-3 border-t bg-[#f2f3f5]">
            <p className="text-[11px] text-gray-500 uppercase">
              {new URL(exampleUrl).hostname}
            </p>
            <p className="text-[14px] font-semibold text-[#1d2129] leading-tight mt-0.5">
              {truncate(displayTitle, 60)}
            </p>
            <p className="text-[12px] text-gray-600 mt-0.5 leading-snug">
              {truncate(displayDescription, 155)}
            </p>
          </div>
        </div>
      </div>

      {/* Twitter/X style preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Twitter / X</p>
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          {displayImage && config.twitter_card_type === 'summary_large_image' && (
            <div className="w-full h-[140px] bg-muted overflow-hidden">
              <img
                src={displayImage}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <div className="p-3 flex gap-3">
            {config.twitter_card_type === 'summary' && displayImage && (
              <div className="w-[90px] h-[90px] rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                <img
                  src={displayImage}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-gray-900 leading-tight truncate">
                {truncate(displayTitle, 70)}
              </p>
              <p className="text-[12px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                {truncate(displayDescription, 120)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {new URL(exampleUrl).hostname}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
