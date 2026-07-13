import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { LimitReason } from '@/types';

export interface OfferDiscountInfo {
  offer_id: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  offer_title: string;
}

interface SubscriptionModalContextType {
  isOpen: boolean;
  isForced: boolean;
  limitReason: LimitReason;
  offerDiscount: OfferDiscountInfo | null;
  openModal: (forced?: boolean, reason?: LimitReason) => void;
  openModalWithOffer: (offer: OfferDiscountInfo) => void;
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
    openModal,
    openModalWithOffer,
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
