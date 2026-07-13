import { X, Percent, Tag } from 'lucide-react';
import type { PromotionalOffer } from '../../types/offers';
import { OfferCountdown } from './OfferCountdown';

interface OfferBannerTopProps {
  offer: PromotionalOffer;
  onDismiss: () => void;
  onAccept: () => void;
}

export function OfferBannerTop({ offer, onDismiss, onAccept }: OfferBannerTopProps) {
  const handleCTAClick = () => {
    onAccept();
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9998] animate-in slide-in-from-top duration-300 shadow-lg font-sans"
      style={{ backgroundColor: offer.cor_fundo, color: offer.cor_texto }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {(offer.desconto_percentual > 0 || offer.desconto_valor_fixo > 0) && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold shrink-0"
              style={{ backgroundColor: offer.cor_destaque, color: '#fff' }}
            >
              {offer.desconto_percentual > 0 ? (
                <><Percent className="w-3 h-3" />{offer.desconto_percentual}%</>
              ) : (
                <><Tag className="w-3 h-3" />R${offer.desconto_valor_fixo}</>
              )}
            </span>
          )}
          <span className="font-semibold text-sm truncate">{offer.titulo}</span>
          {offer.subtitulo && (
            <span className="hidden sm:inline text-sm opacity-70 truncate">{offer.subtitulo}</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {offer.mostrar_contador && offer.data_fim && (
            <OfferCountdown dataFim={offer.data_fim} corDestaque={offer.cor_destaque} compact />
          )}
          <button
            onClick={handleCTAClick}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: offer.botao_cor }}
          >
            {offer.botao_texto}
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-md opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
