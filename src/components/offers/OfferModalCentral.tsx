import { X, Percent, Tag } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/dialog';
import type { PromotionalOffer } from '../../types/offers';
import { OfferCountdown } from './OfferCountdown';

interface OfferModalCentralProps {
  offer: PromotionalOffer;
  onDismiss: () => void;
  onAccept: () => void;
  open: boolean;
}

export function OfferModalCentral({ offer, onDismiss, onAccept, open }: OfferModalCentralProps) {
  const handleCTAClick = () => {
    onAccept();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss(); }}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-0 rounded-2xl font-sans"
        style={{ backgroundColor: offer.cor_fundo, color: offer.cor_texto }}
      >
        {offer.imagem_url && (
          <div className="relative h-40 w-full overflow-hidden">
            <img
              src={offer.imagem_url}
              alt={offer.titulo}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
          </div>
        )}

        <div className="p-6 space-y-4">
          {(offer.desconto_percentual > 0 || offer.desconto_valor_fixo > 0) && (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: offer.cor_destaque, color: '#fff' }}
            >
              {offer.desconto_percentual > 0 ? (
                <><Percent className="w-3.5 h-3.5" />{offer.desconto_percentual}% OFF</>
              ) : (
                <><Tag className="w-3.5 h-3.5" />R$ {offer.desconto_valor_fixo.toFixed(2)} OFF</>
              )}
            </div>
          )}

          <h2 className="text-xl font-bold leading-tight">{offer.titulo}</h2>

          {offer.subtitulo && (
            <p className="text-base opacity-80">{offer.subtitulo}</p>
          )}

          {offer.mostrar_contador && offer.data_fim && (
            <div className="flex justify-center py-1">
              <OfferCountdown dataFim={offer.data_fim} corDestaque={offer.cor_destaque} />
            </div>
          )}

          {offer.descricao && (
            <p className="text-sm opacity-70 leading-relaxed">{offer.descricao}</p>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={handleCTAClick}
              className="w-full py-3 px-5 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md"
              style={{ backgroundColor: offer.botao_cor }}
            >
              {offer.botao_texto}
            </button>

            <button
              onClick={onDismiss}
              className="w-full py-2 text-sm opacity-50 hover:opacity-80 transition-opacity"
            >
              Agora nao, obrigado
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
