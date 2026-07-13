import { X, Percent, Tag } from 'lucide-react';
import type { PromotionalOffer } from '../../types/offers';
import { OfferCountdown } from './OfferCountdown';

interface OfferFullscreenProps {
  offer: PromotionalOffer;
  onDismiss: () => void;
  onAccept: () => void;
}

export function OfferFullscreen({ offer, onDismiss, onAccept }: OfferFullscreenProps) {
  const handleCTAClick = () => {
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} />
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 font-sans"
        style={{ backgroundColor: offer.cor_fundo, color: offer.cor_texto }}
      >
        {offer.imagem_url && (
          <div className="relative h-48 w-full overflow-hidden">
            <img
              src={offer.imagem_url}
              alt={offer.titulo}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
          </div>
        )}

        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 space-y-4">
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

          <h2 className="text-2xl font-bold leading-tight">{offer.titulo}</h2>

          {offer.subtitulo && (
            <p className="text-lg opacity-80">{offer.subtitulo}</p>
          )}

          {offer.mostrar_contador && offer.data_fim && (
            <div className="flex justify-center py-2">
              <OfferCountdown dataFim={offer.data_fim} corDestaque={offer.cor_destaque} />
            </div>
          )}

          {offer.descricao && (
            <p className="text-sm opacity-70 leading-relaxed">{offer.descricao}</p>
          )}

          <button
            onClick={handleCTAClick}
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-white text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
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
  );
}
