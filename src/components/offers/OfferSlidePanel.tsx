import { X, Percent, Tag } from 'lucide-react';
import type { PromotionalOffer } from '../../types/offers';
import { OfferCountdown } from './OfferCountdown';

interface OfferSlidePanelProps {
  offer: PromotionalOffer;
  onDismiss: () => void;
  onAccept: () => void;
  open: boolean;
}

export function OfferSlidePanel({ offer, onDismiss, onAccept, open }: OfferSlidePanelProps) {
  const handleCTAClick = () => {
    onAccept();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/30" onClick={onDismiss} />
      <div
        className="fixed top-0 right-0 bottom-0 z-[9999] w-full max-w-sm shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto font-sans"
        style={{ backgroundColor: offer.cor_fundo, color: offer.cor_texto }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-black/10">
            <span className="text-xs font-medium uppercase tracking-wider opacity-60">
              Oferta Especial
            </span>
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-md opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {offer.imagem_url && (
            <div className="relative h-44 w-full overflow-hidden">
              <img
                src={offer.imagem_url}
                alt={offer.titulo}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
            </div>
          )}

          <div className="p-6 space-y-5 flex-1">
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

            <div className="space-y-2">
              <h2 className="text-xl font-bold leading-tight">{offer.titulo}</h2>
              {offer.subtitulo && (
                <p className="text-base opacity-80">{offer.subtitulo}</p>
              )}
            </div>

            {offer.mostrar_contador && offer.data_fim && (
              <div className="flex justify-center">
                <OfferCountdown dataFim={offer.data_fim} corDestaque={offer.cor_destaque} />
              </div>
            )}

            {offer.descricao && (
              <p className="text-sm opacity-70 leading-relaxed">{offer.descricao}</p>
            )}
          </div>

          <div className="p-6 space-y-3 border-t border-black/10">
            <button
              onClick={handleCTAClick}
              className="w-full py-3.5 px-5 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md"
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
      </div>
    </>
  );
}
