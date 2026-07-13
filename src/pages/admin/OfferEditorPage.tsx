import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Smartphone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfferEditorContent } from '@/components/admin/offers/OfferEditorContent';
import { OfferEditorDesign } from '@/components/admin/offers/OfferEditorDesign';
import { OfferEditorDiscount } from '@/components/admin/offers/OfferEditorDiscount';
import { OfferEditorTargeting } from '@/components/admin/offers/OfferEditorTargeting';
import { OfferEditorDisplay } from '@/components/admin/offers/OfferEditorDisplay';
import { OfferEditorAssignments } from '@/components/admin/offers/OfferEditorAssignments';
import { OfferLivePreview } from '@/components/admin/offers/OfferLivePreview';
import { OfferPreviewSimulator } from '@/components/admin/offers/OfferPreviewSimulator';
import { createOffer, updateOffer, fetchOfferById, saveTargetingRules, saveDisplayConfig } from '@/lib/offerService';
import { useAuth } from '@/contexts/AuthContext';
import type { OfferFormData, OfferDisplayConfigFormData, OfferTargetingRule, OfferWithConfig } from '@/types/offers';

const DEFAULT_FORM: OfferFormData = {
  titulo: '',
  subtitulo: '',
  descricao: '',
  tipo_oferta: 'upgrade',
  imagem_url: '',
  desconto_percentual: 0,
  desconto_valor_fixo: 0,
  cupom_id: null,
  plano_alvo_id: null,
  url_destino: '',
  botao_texto: 'Aproveitar Oferta',
  botao_cor: '#10b981',
  cor_fundo: '#ffffff',
  cor_texto: '#1f2937',
  cor_destaque: '#10b981',
  template: 'modal_central',
  prioridade: 0,
  data_inicio: new Date().toISOString().split('T')[0],
  data_fim: null,
  mostrar_contador: false,
  is_parceiro: false,
  parceiro_nome: null,
  parceiro_logo_url: null,
};

const DEFAULT_DISPLAY_CONFIG: OfferDisplayConfigFormData = {
  max_exibicoes_por_usuario: 3,
  intervalo_horas_entre_exibicoes: 24,
  exibir_apos_minutos_navegando: 0,
  gatilho_acao: 'ao_entrar',
  horario_inicio_exibicao: '00:00',
  horario_fim_exibicao: '23:59',
};

export default function OfferEditorPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isEditing = !!offerId && offerId !== 'new';

  const defaultTab = searchParams.get('tab') || 'conteudo';

  const [form, setForm] = useState<OfferFormData>(DEFAULT_FORM);
  const [displayConfig, setDisplayConfig] = useState<OfferDisplayConfigFormData>(DEFAULT_DISPLAY_CONFIG);
  const [targetingRules, setTargetingRules] = useState<Omit<OfferTargetingRule, 'id' | 'offer_id' | 'created_at'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  useEffect(() => {
    if (isEditing) {
      loadOffer();
    }
  }, [offerId]);

  const loadOffer = async () => {
    try {
      setLoading(true);
      const data: OfferWithConfig | null = await fetchOfferById(offerId!);
      if (!data) {
        toast.error('Oferta nao encontrada');
        navigate('/admin/offers');
        return;
      }

      setForm({
        titulo: data.titulo,
        subtitulo: data.subtitulo,
        descricao: data.descricao,
        tipo_oferta: data.tipo_oferta,
        imagem_url: data.imagem_url,
        desconto_percentual: data.desconto_percentual,
        desconto_valor_fixo: data.desconto_valor_fixo,
        cupom_id: data.cupom_id,
        plano_alvo_id: data.plano_alvo_id,
        url_destino: data.url_destino,
        botao_texto: data.botao_texto,
        botao_cor: data.botao_cor,
        cor_fundo: data.cor_fundo,
        cor_texto: data.cor_texto,
        cor_destaque: data.cor_destaque,
        template: data.template,
        prioridade: data.prioridade,
        data_inicio: data.data_inicio?.split('T')[0] || '',
        data_fim: data.data_fim?.split('T')[0] || null,
        mostrar_contador: data.mostrar_contador ?? false,
        is_parceiro: data.is_parceiro,
        parceiro_nome: data.parceiro_nome,
        parceiro_logo_url: data.parceiro_logo_url,
      });

      if (data.display_config) {
        setDisplayConfig({
          max_exibicoes_por_usuario: data.display_config.max_exibicoes_por_usuario,
          intervalo_horas_entre_exibicoes: data.display_config.intervalo_horas_entre_exibicoes,
          exibir_apos_minutos_navegando: data.display_config.exibir_apos_minutos_navegando,
          gatilho_acao: data.display_config.gatilho_acao,
          horario_inicio_exibicao: data.display_config.horario_inicio_exibicao,
          horario_fim_exibicao: data.display_config.horario_fim_exibicao,
        });
      }

      if (data.targeting_rules) {
        setTargetingRules(data.targeting_rules.map(r => ({
          grupo_logico: r.grupo_logico,
          tipo_regra: r.tipo_regra,
          operador: r.operador,
          valor: r.valor,
          valor_secundario: r.valor_secundario,
        })));
      }
    } catch (err) {
      toast.error('Erro ao carregar oferta');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (activate?: boolean) => {
    if (!form.titulo.trim()) {
      toast.error('Titulo e obrigatorio');
      return;
    }

    try {
      setSaving(true);
      let savedOfferId = offerId;

      const payload = {
        ...form,
        data_inicio: form.data_inicio ? new Date(form.data_inicio).toISOString() : new Date().toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
      };

      if (isEditing) {
        await updateOffer(offerId!, { ...payload, is_active: activate ?? undefined });
      } else {
        const created = await createOffer(payload);
        savedOfferId = created.id;
        if (activate) {
          await updateOffer(created.id, { is_active: true });
        }
      }

      if (savedOfferId) {
        await saveTargetingRules(savedOfferId, targetingRules);
        await saveDisplayConfig(savedOfferId, displayConfig);
      }

      toast.success(isEditing ? 'Oferta atualizada' : 'Oferta criada com sucesso');
      if (!isEditing && savedOfferId) {
        navigate(`/admin/offers/${savedOfferId}?tab=destinatarios`);
      } else {
        navigate('/admin/offers');
      }
    } catch (err) {
      toast.error('Erro ao salvar oferta');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (updates: Partial<OfferFormData>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="h-96 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Carregando oferta...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/offers')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">
              {isEditing ? 'Editar Oferta' : 'Nova Oferta Promocional'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure todos os detalhes da oferta e visualize o resultado em tempo real.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSimulator(true)} className="gap-1.5">
            <Eye className="w-4 h-4" />
            Simular
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" />
            Salvar Rascunho
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="gap-1.5">
            <Smartphone className="w-4 h-4" />
            Salvar e Ativar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Editor Panel */}
        <div className="xl:col-span-3">
          <Tabs defaultValue={isEditing ? defaultTab : 'conteudo'} className="space-y-4">
            <TabsList className={`grid w-full ${isEditing ? 'grid-cols-6' : 'grid-cols-5'}`}>
              <TabsTrigger value="conteudo">Conteudo</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="desconto">Desconto</TabsTrigger>
              <TabsTrigger value="segmentacao">Segmentacao</TabsTrigger>
              <TabsTrigger value="exibicao">Exibicao</TabsTrigger>
              {isEditing && (
                <TabsTrigger value="destinatarios" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Destinatarios
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="conteudo">
              <OfferEditorContent form={form} updateForm={updateForm} offerId={isEditing ? offerId : undefined} />
            </TabsContent>

            <TabsContent value="design">
              <OfferEditorDesign form={form} updateForm={updateForm} />
            </TabsContent>

            <TabsContent value="desconto">
              <OfferEditorDiscount form={form} updateForm={updateForm} />
            </TabsContent>

            <TabsContent value="segmentacao">
              <OfferEditorTargeting
                rules={targetingRules}
                setRules={setTargetingRules}
                displayConfig={displayConfig}
              />
            </TabsContent>

            <TabsContent value="exibicao">
              <OfferEditorDisplay config={displayConfig} setConfig={setDisplayConfig} />
            </TabsContent>

            {isEditing && (
              <TabsContent value="destinatarios">
                <OfferEditorAssignments offerId={offerId!} adminUserId={user?.id || ''} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Live Preview Panel */}
        <div className="xl:col-span-2">
          <div className="sticky top-6">
            <OfferLivePreview form={form} />
          </div>
        </div>
      </div>

      {showSimulator && (
        <OfferPreviewSimulator
          form={form}
          onClose={() => setShowSimulator(false)}
        />
      )}
    </div>
  );
}
