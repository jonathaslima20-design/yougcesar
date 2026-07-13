import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Megaphone, Trash2, Copy, GripVertical, ChartBar as BarChart3, Eye, EyeOff, Pencil, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { fetchOffers, deleteOffer, toggleOfferActive, updateOfferPriorities, createOffer } from '@/lib/offerService';
import type { PromotionalOffer, OfferFormData } from '@/types/offers';

const OFFER_TYPE_LABELS: Record<string, string> = {
  upgrade: 'Upgrade',
  renovacao: 'Renovacao',
  parceiro: 'Parceiro',
  desconto_geral: 'Desconto Geral',
};

const TEMPLATE_LABELS: Record<string, string> = {
  fullscreen: 'Tela Cheia',
  modal_central: 'Modal Central',
  banner_topo: 'Banner Topo',
  slide_lateral: 'Slide Lateral',
};

function getOfferStatus(offer: PromotionalOffer): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!offer.is_active) return { label: 'Inativa', variant: 'secondary' };
  const now = new Date();
  if (offer.data_inicio && new Date(offer.data_inicio) > now) return { label: 'Agendada', variant: 'outline' };
  if (offer.data_fim && new Date(offer.data_fim) < now) return { label: 'Expirada', variant: 'destructive' };
  return { label: 'Ativa', variant: 'default' };
}

export default function OffersManagementPage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<PromotionalOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const loadOffers = async () => {
    try {
      setLoading(true);
      const data = await fetchOffers();
      setOffers(data);
    } catch (err) {
      toast.error('Erro ao carregar ofertas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await toggleOfferActive(id, active);
      setOffers(prev => prev.map(o => o.id === id ? { ...o, is_active: active } : o));
      toast.success(active ? 'Oferta ativada' : 'Oferta desativada');
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOffer(deleteTarget);
      setOffers(prev => prev.filter(o => o.id !== deleteTarget));
      toast.success('Oferta excluida');
    } catch {
      toast.error('Erro ao excluir oferta');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDuplicate = async (offer: PromotionalOffer) => {
    try {
      const formData: OfferFormData = {
        titulo: `${offer.titulo} (copia)`,
        subtitulo: offer.subtitulo,
        descricao: offer.descricao,
        tipo_oferta: offer.tipo_oferta,
        imagem_url: offer.imagem_url,
        desconto_percentual: offer.desconto_percentual,
        desconto_valor_fixo: offer.desconto_valor_fixo,
        cupom_id: offer.cupom_id,
        plano_alvo_id: offer.plano_alvo_id,
        url_destino: offer.url_destino,
        botao_texto: offer.botao_texto,
        botao_cor: offer.botao_cor,
        cor_fundo: offer.cor_fundo,
        cor_texto: offer.cor_texto,
        cor_destaque: offer.cor_destaque,
        template: offer.template,
        prioridade: offer.prioridade + 1,
        data_inicio: new Date().toISOString(),
        data_fim: offer.data_fim,
        is_parceiro: offer.is_parceiro,
        parceiro_nome: offer.parceiro_nome,
        parceiro_logo_url: offer.parceiro_logo_url,
      };
      const newOffer = await createOffer(formData);
      setOffers(prev => [...prev, newOffer]);
      toast.success('Oferta duplicada com sucesso');
    } catch {
      toast.error('Erro ao duplicar oferta');
    }
  };

  const handleDragEnd = async () => {
    if (dragItemIndex === null || dragOverIndex === null || dragItemIndex === dragOverIndex) {
      setDragItemIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...offers];
    const [moved] = reordered.splice(dragItemIndex, 1);
    reordered.splice(dragOverIndex, 0, moved);

    const updates = reordered.map((o, i) => ({ id: o.id, prioridade: i }));
    setOffers(reordered.map((o, i) => ({ ...o, prioridade: i })));
    setDragItemIndex(null);
    setDragOverIndex(null);

    try {
      await updateOfferPriorities(updates);
    } catch {
      toast.error('Erro ao reordenar');
      loadOffers();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl page-title flex items-center gap-3">
            <Megaphone className="w-7 h-7" />
            Ofertas Promocionais
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie ofertas de desconto, upgrades e promocoes para seus usuarios.
          </p>
        </div>
        <Button onClick={() => navigate('/admin/offers/new')} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Oferta
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">Nenhuma oferta criada</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            Crie sua primeira oferta promocional para engajar seus usuarios com descontos e upgrades.
          </p>
          <Button onClick={() => navigate('/admin/offers/new')} className="mt-6 gap-2">
            <Plus className="w-4 h-4" />
            Criar Primeira Oferta
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer, index) => {
            const status = getOfferStatus(offer);
            return (
              <div
                key={offer.id}
                className={`relative group rounded-xl border bg-card overflow-hidden transition-all hover:shadow-md ${
                  dragOverIndex === index ? 'ring-2 ring-primary' : ''
                } ${dragItemIndex === index ? 'opacity-50' : ''}`}
                draggable
                onDragStart={() => setDragItemIndex(index)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                onDragEnd={handleDragEnd}
              >
                <div
                  className="h-24 w-full relative"
                  style={{ backgroundColor: offer.cor_fundo }}
                >
                  {offer.imagem_url && (
                    <img src={offer.imagem_url} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-2 left-2">
                    <GripVertical className="w-4 h-4 text-white/60 cursor-grab" />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant={status.variant} className="text-[10px]">
                      {status.label}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm truncate">{offer.titulo}</h3>
                    <p className="text-xs text-muted-foreground truncate">{offer.subtitulo}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">
                      {OFFER_TYPE_LABELS[offer.tipo_oferta]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {TEMPLATE_LABELS[offer.template]}
                    </Badge>
                    {offer.desconto_percentual > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {offer.desconto_percentual}% OFF
                      </Badge>
                    )}
                    {offer.desconto_valor_fixo > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        R${offer.desconto_valor_fixo} OFF
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={offer.is_active}
                        onCheckedChange={(v) => handleToggleActive(offer.id, v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {offer.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => navigate(`/admin/offers/${offer.id}?tab=destinatarios`)}
                        title="Enviar para usuarios"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => navigate(`/admin/offers/${offer.id}/analytics`)}
                        title="Analytics"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDuplicate(offer)}
                        title="Duplicar"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => navigate(`/admin/offers/${offer.id}`)}
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteTarget(offer.id)}
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao e irreversivel. A oferta sera removida permanentemente, incluindo todas as atribuicoes e impressoes associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
