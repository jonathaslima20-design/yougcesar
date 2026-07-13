import { X, Percent, Tag, Clock } from 'lucide-react';
import type { OfferFormData } from '@/types/offers';

interface Props {
  form: OfferFormData;
}

const PHONE_W = 264;
const PHONE_H = 500;
const CARD_W = 380;
const SCALE = PHONE_W / CARD_W;

export function OfferLivePreview({ form }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Preview ao Vivo
        </h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {form.template === 'fullscreen' && 'Tela Cheia'}
          {form.template === 'modal_central' && 'Modal'}
          {form.template === 'banner_topo' && 'Banner'}
          {form.template === 'slide_lateral' && 'Slide'}
        </span>
      </div>

      {/* Phone frame */}
      <div className="relative mx-auto" style={{ width: 280 }}>
        <div className="rounded-[2.5rem] border-[8px] border-zinc-800 dark:border-zinc-700 bg-zinc-900 overflow-hidden shadow-xl">
          {/* Status bar */}
          <div className="h-6 bg-zinc-900 flex items-center justify-center">
            <div className="w-16 h-4 bg-zinc-800 rounded-full" />
          </div>

          {/* Screen */}
          <div
            className="relative bg-gray-100 dark:bg-gray-900 overflow-hidden"
            style={{ width: PHONE_W, height: PHONE_H }}
          >
            {/* Simulated app background */}
            <div className="p-3 space-y-2">
              <div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded" />
              <div className="h-20 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" />
              <div className="h-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" />
              <div className="h-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" />
            </div>

            {/* Offer overlay — same styles as real components, scaled to fit */}
            {form.template === 'banner_topo' ? (
              <BannerPreview form={form} />
            ) : (
              <OverlayPreview form={form} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BannerPreview({ form }: { form: OfferFormData }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 overflow-hidden"
      style={{ backgroundColor: form.cor_fundo, color: form.cor_texto }}
    >
      <div
        style={{
          transformOrigin: 'top left',
          transform: `scale(${SCALE})`,
          width: CARD_W,
        }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          {(form.desconto_percentual > 0 || form.desconto_valor_fixo > 0) && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold shrink-0"
              style={{ backgroundColor: form.cor_destaque, color: '#fff' }}
            >
              {form.desconto_percentual > 0 ? (
                <><Percent className="w-3 h-3" />{form.desconto_percentual}%</>
              ) : (
                <><Tag className="w-3 h-3" />R${form.desconto_valor_fixo}</>
              )}
            </span>
          )}
          <span className="font-semibold text-sm truncate flex-1">
            {form.titulo || 'Titulo da oferta'}
          </span>
          <span
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white shrink-0"
            style={{ backgroundColor: form.botao_cor }}
          >
            {form.botao_texto || 'Ver oferta'}
          </span>
          <X className="w-4 h-4 opacity-60 shrink-0" />
        </div>
      </div>
    </div>
  );
}

function OverlayPreview({ form }: { form: OfferFormData }) {
  const isSlide = form.template === 'slide_lateral';

  if (isSlide) {
    return (
      <div className="absolute inset-0 bg-black/30">
        <div
          className="absolute top-0 right-0 bottom-0 overflow-hidden"
          style={{
            width: PHONE_W * 0.65,
            backgroundColor: form.cor_fundo,
            color: form.cor_texto,
          }}
        >
          <div
            style={{
              transformOrigin: 'top right',
              transform: `scale(${SCALE})`,
              width: CARD_W * 0.65,
              height: '100%',
            }}
          >
            <SlideCardInner form={form} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-3">
      <div
        style={{
          transformOrigin: 'top center',
          transform: `scale(${SCALE})`,
          width: CARD_W,
        }}
      >
        <ModalCardInner form={form} />
      </div>
    </div>
  );
}

function ModalCardInner({ form }: { form: OfferFormData }) {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden shadow-2xl font-sans"
      style={{ backgroundColor: form.cor_fundo, color: form.cor_texto }}
    >
      {form.imagem_url && (
        <div className="relative h-40 w-full overflow-hidden">
          <img src={form.imagem_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
        </div>
      )}

      <div className="p-6 space-y-4">
        {(form.desconto_percentual > 0 || form.desconto_valor_fixo > 0) && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
            style={{ backgroundColor: form.cor_destaque, color: '#fff' }}
          >
            {form.desconto_percentual > 0 ? (
              <><Percent className="w-3.5 h-3.5" />{form.desconto_percentual}% OFF</>
            ) : (
              <><Tag className="w-3.5 h-3.5" />R$ {form.desconto_valor_fixo.toFixed(2)} OFF</>
            )}
          </div>
        )}

        <h2 className="text-xl font-bold leading-tight">
          {form.titulo || 'Titulo da oferta'}
        </h2>

        {form.subtitulo && (
          <p className="text-base opacity-80">{form.subtitulo}</p>
        )}

        {form.mostrar_contador && form.data_fim && (
          <div className="flex items-center justify-center gap-1.5 py-1">
            <Clock className="w-4 h-4" style={{ color: form.cor_destaque }} />
            <span className="text-sm font-semibold" style={{ color: form.cor_destaque }}>
              Termina em 2d 14:30:00
            </span>
          </div>
        )}

        {form.descricao && (
          <p className="text-sm opacity-70 leading-relaxed">{form.descricao}</p>
        )}

        <div className="space-y-2 pt-2">
          <div
            className="w-full py-3 px-5 rounded-xl font-semibold text-white text-center shadow-md"
            style={{ backgroundColor: form.botao_cor }}
          >
            {form.botao_texto || 'Aproveitar Oferta'}
          </div>
          <p className="text-center text-sm opacity-40">Agora nao, obrigado</p>
        </div>
      </div>
    </div>
  );
}

function SlideCardInner({ form }: { form: OfferFormData }) {
  return (
    <div
      className="h-full flex flex-col shadow-2xl font-sans"
      style={{ backgroundColor: form.cor_fundo, color: form.cor_texto }}
    >
      <div className="flex items-center justify-between p-4 border-b border-black/10">
        <span className="text-xs font-medium uppercase tracking-wider opacity-60">
          Oferta Especial
        </span>
        <X className="w-5 h-5 opacity-60" />
      </div>

      {form.imagem_url && (
        <div className="relative h-36 w-full overflow-hidden">
          <img src={form.imagem_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
        </div>
      )}

      <div className="p-6 space-y-4 flex-1">
        {(form.desconto_percentual > 0 || form.desconto_valor_fixo > 0) && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
            style={{ backgroundColor: form.cor_destaque, color: '#fff' }}
          >
            {form.desconto_percentual > 0 ? (
              <><Percent className="w-3.5 h-3.5" />{form.desconto_percentual}% OFF</>
            ) : (
              <><Tag className="w-3.5 h-3.5" />R$ {form.desconto_valor_fixo.toFixed(2)} OFF</>
            )}
          </div>
        )}
        <h2 className="text-xl font-bold leading-tight">
          {form.titulo || 'Titulo da oferta'}
        </h2>
        {form.subtitulo && (
          <p className="text-base opacity-80">{form.subtitulo}</p>
        )}
        {form.descricao && (
          <p className="text-sm opacity-70 leading-relaxed">{form.descricao}</p>
        )}
      </div>

      <div className="p-6 space-y-3 border-t border-black/10">
        <div
          className="w-full py-3.5 px-5 rounded-xl font-semibold text-white text-center shadow-md"
          style={{ backgroundColor: form.botao_cor }}
        >
          {form.botao_texto || 'Aproveitar Oferta'}
        </div>
        <p className="text-center text-sm opacity-40">Agora nao, obrigado</p>
      </div>
    </div>
  );
}
