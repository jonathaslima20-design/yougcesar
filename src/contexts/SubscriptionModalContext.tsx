import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { LimitReason } from '@/types';

export interface OfferDiscountInfo {
  offer_id: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  offer_title: string;
}

// Enriched variant used only for the "boas-vindas" offer fused into the forced
// plan-selection modal (never the dismissible overlay flow above): carries the
// visual/countdown info SubscriptionModal needs to render it inline.
export interface SignupOfferInfo extends OfferDiscountInfo {
  subtitulo: string;
  cor_destaque: string;
  cor_fundo: string;
  mostrar_contador: boolean;
  deadline: string | null;
  planos_aplicaveis: string[] | null;
}

interface SubscriptionModalContextType {
  isOpen: boolean;
  isForced: boolean;
  limitReason: LimitReason;
  offerDiscount: OfferDiscountInfo | null;
  signupOffer: SignupOfferInfo | null;
  openModal: (forced?: boolean, reason?: LimitReason) => void;
  openModalWithOffer: (offer: OfferDiscountInfo) => void;
  openForcedModalWithOffer: (offer: SignupOfferInfo) => void;
  clearSignupOffer: () => void;
  closeModal: () => void;
  forceClose: () => void;
  setForced: (forced: boolean) => void;
}

const SubscriptionModalContext = createContext<SubscriptionModalContextType | undefined>(undefined);

export function SubscriptionModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isForced, setIsForced] = useState(false);
  const [limitReason, setLimitReason] = useState<LimitReason>(null);
  const [offerDiscount, setOfferDiscount] = useState<OfferDiscountInfo | null>(null);
  const [signupOffer, setSignupOffer] = useState<SignupOfferInfo | null>(null);

  const isForcedRef = useRef(false);

  const openModal = useCallback((forced = false, reason: LimitReason = null) => {
    isForcedRef.current = forced;
    setIsOpen(true);
    setIsForced(forced);
    setLimitReason(reason);
  }, []);

  const openModalWithOffer = useCallback((offer: OfferDiscountInfo) => {
    setOfferDiscount(offer);
    setIsOpen(true);
    setIsForced(false);
    setLimitReason(null);
  }, []);

  // Distinct from openModalWithOffer above: this keeps isForced=true, so the
  // signup discount banner never doubles as a way to unlock the mandatory
  // plan-selection gate for users without an active plan.
  const openForcedModalWithOffer = useCallback((offer: SignupOfferInfo) => {
    isForcedRef.current = true;
    setSignupOffer(offer);
    setIsOpen(true);
    setIsForced(true);
    setLimitReason(null);
  }, []);

  const clearSignupOffer = useCallback(() => {
    setSignupOffer(null);
  }, []);

  // Deliberately does NOT clear signupOffer: this also runs when navigating to
  // checkout (SubscriptionModal calls onOpenChange(false) on "Assinar Agora"),
  // and the offer/countdown must still be there if the user comes back without
  // completing payment. It's cleared only when it actually expires
  // (clearSignupOffer) or the user gets an active plan (forceClose).
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setLimitReason(null);
    setOfferDiscount(null);
  }, []);

  const forceClose = useCallback(() => {
    isForcedRef.current = false;
    setIsForced(false);
    setIsOpen(false);
    setLimitReason(null);
    setOfferDiscount(null);
    setSignupOffer(null);
  }, []);

  const setForcedState = useCallback((forced: boolean) => {
    isForcedRef.current = forced;
    setIsForced(forced);
  }, []);

  const value = {
    isOpen,
    isForced,
    limitReason,
    offerDiscount,
    signupOffer,
    openModal,
    openModalWithOffer,
    openForcedModalWithOffer,
    clearSignupOffer,
    closeModal,
    forceClose,
    setForced: setForcedState,
  };

  return (
    <SubscriptionModalContext.Provider value={value}>
      {children}
    </SubscriptionModalContext.Provider>
  );
}

export function useSubscriptionModal() {
  const context = useContext(SubscriptionModalContext);
  if (context === undefined) {
    throw new Error('useSubscriptionModal must be used within SubscriptionModalProvider');
  }
  return context;
}
