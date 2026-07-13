import { usePromotionalOffers } from '../../contexts/PromotionalOffersContext';
import { OfferFullscreen } from './OfferFullscreen';
import { OfferModalCentral } from './OfferModalCentral';
import { OfferBannerTop } from './OfferBannerTop';
import { OfferSlidePanel } from './OfferSlidePanel';

export function OfferDisplayManager() {
  const { currentOffer, dismissOffer, acceptOffer } = usePromotionalOffers();

  if (!currentOffer) return null;

  const { offer } = currentOffer;

  switch (offer.template) {
    case 'fullscreen':
      return <OfferFullscreen offer={offer} onDismiss={dismissOffer} onAccept={acceptOffer} />;
    case 'modal_central':
      return <OfferModalCentral offer={offer} onDismiss={dismissOffer} onAccept={acceptOffer} open={true} />;
    case 'banner_topo':
      return <OfferBannerTop offer={offer} onDismiss={dismissOffer} onAccept={acceptOffer} />;
    case 'slide_lateral':
      return <OfferSlidePanel offer={offer} onDismiss={dismissOffer} onAccept={acceptOffer} open={true} />;
    default:
      return <OfferModalCentral offer={offer} onDismiss={dismissOffer} onAccept={acceptOffer} open={true} />;
  }
}
