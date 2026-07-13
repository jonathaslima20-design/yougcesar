import { useState, useEffect } from 'react';
import { Search, X, CircleCheck as CheckCircle, Circle as XCircle, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { OfferFullscreen } from '@/components/offers/OfferFullscreen';
import { OfferModalCentral } from '@/components/offers/OfferModalCentral';
import { OfferBannerTop } from '@/components/offers/OfferBannerTop';
import { OfferSlidePanel } from '@/components/offers/OfferSlidePanel';
import type { OfferFormData } from '@/types/offers';
import type { PromotionalOffer } from '@/types/offers';

interface Props {
  form: OfferFormData;
  onClose: () => void;
}

interface SimUser {
  id: string;
  name: string;
  email: string;
  plan_status: string;
  billing_cycle: string;
  created_at: string;
  subscription_plan_name?: string;
  subscription_end_date?: string;
}

export function OfferPreviewSimulator({ form, onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<SimUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SimUser | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('users')
        .select('id, name, email, plan_status, billing_cycle, created_at, subscription_plan_name, subscription_end_date')
        .neq('role', 'admin')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10);
      setUsers(data || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const mockOffer: PromotionalOffer = {
    id: 'preview',
    titulo: form.titulo || 'Titulo da Oferta',
    subtitulo: form.subtitulo,
    descricao: form.descricao,
    tipo_oferta: form.tipo_oferta,
    imagem_url: form.imagem_url,
    desconto_percentual: form.desconto_percentual,
    desconto_valor_fixo: form.desconto_valor_fixo,
    cupom_id: form.cupom_id,
    plano_alvo_id: form.plano_alvo_id,
    url_destino: form.url_destino,
    botao_texto: form.botao_texto,
    botao_cor: form.botao_cor,
    cor_fundo: form.cor_fundo,
    cor_texto: form.cor_texto,
    cor_destaque: form.cor_destaque,
    template: form.template,
    prioridade: form.prioridade,
    is_active: true,
    data_inicio: form.data_inicio,
    data_fim: form.data_fim,
    is_parceiro: form.is_parceiro,
    parceiro_nome: form.parceiro_nome,
    parceiro_logo_url: form.parceiro_logo_url,
    tracking_params: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const getUserContext = (user: SimUser) => {
    const now = new Date();
    const created = new Date(user.created_at);
    const diasCadastro = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    const endDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
    const diasAteVencimento = endDate ? Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    return { diasCadastro, diasAteVencimento };
  };

  return (
    <>
      <Dialog open={!showFullPreview} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Simular Oferta como Usuario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar usuario por nome ou email..."
                className="pl-10"
              />
            </div>

            {searching && <p className="text-sm text-muted-foreground">Buscando...</p>}

            {users.length > 0 && !selectedUser && (
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted text-left transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {u.plan_status || 'free'}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-3">
                    <UserIcon className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{selectedUser.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedUser(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground">Plano</p>
                    <p className="font-semibold text-sm">{selectedUser.plan_status || 'free'}</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground">Ciclo</p>
                    <p className="font-semibold text-sm">{selectedUser.billing_cycle || '-'}</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground">Dias Cadastro</p>
                    <p className="font-semibold text-sm">{getUserContext(selectedUser).diasCadastro}</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-xs text-muted-foreground">Dias p/ Vencer</p>
                    <p className="font-semibold text-sm">{getUserContext(selectedUser).diasAteVencimento ?? 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-emerald-800 dark:text-emerald-200">
                    Este usuario veria a oferta no template "{form.template}"
                  </span>
                </div>

                <Button onClick={() => setShowFullPreview(true)} className="w-full gap-2">
                  Ver Preview Completo
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showFullPreview && (
        <div className="fixed inset-0 z-[99999]">
          <div className="absolute top-4 left-4 z-[999999]">
            <Button
              onClick={() => { setShowFullPreview(false); onClose(); }}
              variant="secondary"
              size="sm"
              className="shadow-lg gap-1.5"
            >
              <X className="w-4 h-4" />
              Fechar Preview
            </Button>
          </div>

          {form.template === 'fullscreen' && (
            <OfferFullscreen offer={mockOffer} onDismiss={() => setShowFullPreview(false)} onAccept={() => setShowFullPreview(false)} />
          )}
          {form.template === 'modal_central' && (
            <OfferModalCentral offer={mockOffer} onDismiss={() => setShowFullPreview(false)} onAccept={() => setShowFullPreview(false)} open={true} />
          )}
          {form.template === 'banner_topo' && (
            <div className="pt-16">
              <OfferBannerTop offer={mockOffer} onDismiss={() => setShowFullPreview(false)} onAccept={() => setShowFullPreview(false)} />
            </div>
          )}
          {form.template === 'slide_lateral' && (
            <OfferSlidePanel offer={mockOffer} onDismiss={() => setShowFullPreview(false)} onAccept={() => setShowFullPreview(false)} open={true} />
          )}
        </div>
      )}
    </>
  );
}
