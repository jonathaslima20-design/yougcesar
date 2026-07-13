import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useSubscriptionModal } from './SubscriptionModalContext';
import { supabase } from '../lib/supabase';
import type { PromotionalOffer, OfferDisplayConfig, OfferTrigger } from '../types/offers';
import {
  fetchUserEligibleOffers,
  fetchOfferDisplayConfigs,
  fetchUserOfferImpressions,
  trackImpression,
  updateAssignmentStatus,
  evaluateTargetingRules,
  OFFER_PUSH_CHANNEL,
  type OfferPushPayload,
} from '../lib/offerService';

interface OfferQueueItem {
  offer: PromotionalOffer;
  config: OfferDisplayConfig | null;
  source: 'manual' | 'auto';
}

interface PromotionalOffersContextType {
  currentOffer: OfferQueueItem | null;
  dismissOffer: () => void;
  acceptOffer: () => void;
  triggerOfferCheck: (trigger: OfferTrigger) => void;
  hasOffers: boolean;
}

const PromotionalOffersContext = createContext<PromotionalOffersContextType>({
  currentOffer: null,
  dismissOffer: () => {},
  acceptOffer: () => {},
  triggerOfferCheck: () => {},
  hasOffers: false,
});

const BLOCKED_PATH_PREFIXES = ['/dashboard/checkout', '/login', '/register'];

function isPathBlocked(pathname: string): boolean {
  return BLOCKED_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function usePromotionalOffers() {
  return useContext(PromotionalOffersContext);
}

export function PromotionalOffersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModalWithOffer } = useSubscriptionModal();
  const [offerQueue, setOfferQueue] = useState<OfferQueueItem[]>([]);
  const [currentOffer, setCurrentOffer] = useState<OfferQueueItem | null>(null);
  const [forceShowPushed, setForceShowPushed] = useState(false);
  const [, setDisplayConfigs] = useState<OfferDisplayConfig[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const lastDisplayTimeRef = useRef<Map<string, number>>(new Map());
  const displayCountRef = useRef<Map<string, number>>(new Map());
  const lastLoadedFingerprintRef = useRef<string | null>(null);
  const prevPathnameRef = useRef<string>(location.pathname);
  const delayedTriggerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  // Reset session timer when user authenticates (login/registration)
  useEffect(() => {
    const currentUserId = user?.id || null;
    if (currentUserId && currentUserId !== prevUserIdRef.current) {
      sessionStartRef.current = Date.now();
    }
    prevUserIdRef.current = currentUserId;
  }, [user?.id]);

  const loadEligibleOffers = useCallback(async () => {
    if (!user || user.role === 'admin') return;

    // Referred users cannot receive promotional offers
    if (user.referred_by) {
      setOfferQueue([]);
      return;
    }

    try {
      const offers = await fetchUserEligibleOffers(user.id);
      if (offers.length === 0) {
        setOfferQueue([]);
        return;
      }

      const offerIds = offers.map(o => o.id);
      const [configs, impressions] = await Promise.all([
        fetchOfferDisplayConfigs(offerIds),
        fetchUserOfferImpressions(user.id, offerIds),
      ]);

      setDisplayConfigs(configs);

      const { data: rules } = await supabase
        .from('offer_targeting_rules')
        .select('*')
        .in('offer_id', offerIds);

      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diasCadastro = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const userContext = {
        plan_status: user.plan_status || 'free',
        dias_cadastro: diasCadastro,
        qtd_produtos: productCount || 0,
        billing_cycle: user.billing_cycle || '',
        dias_ate_vencimento: user.subscription_end_date
          ? Math.floor((new Date(user.subscription_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : undefined,
        plano_nome: user.subscription_plan_name || '',
      };

      const { data: assignments } = await supabase
        .from('offer_user_assignments')
        .select('offer_id, status')
        .eq('user_id', user.id)
        .in('offer_id', offerIds);

      const assignedActiveOfferIds = new Set(
        (assignments || [])
          .filter(a => a.status === 'pendente' || a.status === 'visualizada')
          .map(a => a.offer_id)
      );

      const eligible: OfferQueueItem[] = [];
      for (const offer of offers) {
        const offerRules = (rules || []).filter(r => r.offer_id === offer.id);
        const config = configs.find(c => c.offer_id === offer.id) || null;
        const isManual = assignedActiveOfferIds.has(offer.id);

        if (!isManual && offerRules.length > 0) {
          const passes = evaluateTargetingRules(offerRules, userContext);
          if (!passes) continue;
        } else if (!isManual && offerRules.length === 0) {
          continue;
        }

        const offerImpressions = impressions.filter(i => i.offer_id === offer.id);
        const displayCount = offerImpressions.filter(i => i.action === 'exibida').length;
        const hasConverted = offerImpressions.some(i => i.action === 'convertida');
        const hasDismissed = offerImpressions.some(i => i.action === 'fechada');

        if (hasConverted) continue;

        if (config) {
          if (config.max_exibicoes_por_usuario > 0 && displayCount >= config.max_exibicoes_por_usuario) continue;

          if (config.intervalo_horas_entre_exibicoes > 0 && offerImpressions.length > 0) {
            const lastDisplay = new Date(offerImpressions[0].created_at);
            const hoursSinceLastDisplay = (now.getTime() - lastDisplay.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastDisplay < config.intervalo_horas_entre_exibicoes) continue;
          }
        }

        if (!isManual && hasDismissed && !config) continue;

        eligible.push({
          offer,
          config,
          source: isManual ? 'manual' : 'auto',
        });
      }

      setOfferQueue(eligible);
    } catch (err) {
      console.error('Failed to load promotional offers:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role === 'admin') {
      setOfferQueue([]);
      setCurrentOffer(null);
      lastLoadedFingerprintRef.current = null;
      return;
    }

    const fingerprint = `${user.id}:${user.plan_status || 'free'}`;
    if (lastLoadedFingerprintRef.current === fingerprint) return;
    lastLoadedFingerprintRef.current = fingerprint;
    loadEligibleOffers();
  }, [user, loadEligibleOffers]);

  // Realtime: react to assignment INSERT/UPDATE and offer UPDATE
  useEffect(() => {
    if (!user || user.role === 'admin') return;

    const channel = supabase
      .channel(`offer_assignments_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'offer_user_assignments',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadEligibleOffers();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'offer_user_assignments',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadEligibleOffers();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'promotional_offers',
      }, (payload) => {
        const newRow = payload.new as PromotionalOffer | undefined;
        if (currentOffer && newRow && newRow.id === currentOffer.offer.id && !newRow.is_active) {
          setCurrentOffer(null);
          setOfferQueue(prev => prev.filter(item => item.offer.id !== newRow.id));
          return;
        }
        loadEligibleOffers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadEligibleOffers, currentOffer]);

  // Broadcast channel: admin "send now" push — fetch the specific offer and show immediately
  useEffect(() => {
    if (!user || user.role === 'admin') return;

    const channel = supabase
      .channel(OFFER_PUSH_CHANNEL)
      .on('broadcast', { event: 'new_offer' }, async ({ payload }) => {
        const data = payload as OfferPushPayload;
        if (!data?.user_ids?.includes(user.id) || !data?.offer_id) return;

        // Fetch the pushed offer directly by ID (bypasses is_active filter)
        const { data: offer } = await supabase
          .from('promotional_offers')
          .select('*')
          .eq('id', data.offer_id)
          .maybeSingle();

        if (!offer) return;

        const pushedItem: OfferQueueItem = { offer, config: null, source: 'manual' };

        // Fetch display config if available
        const { data: configs } = await supabase
          .from('offer_display_config')
          .select('*')
          .eq('offer_id', offer.id)
          .maybeSingle();

        if (configs) pushedItem.config = configs;

        setOfferQueue(prev => {
          const without = prev.filter(item => item.offer.id !== offer.id);
          return [pushedItem, ...without];
        });

        setTimeout(() => {
          setForceShowPushed(true);
        }, 200);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const triggerOfferCheck = useCallback((trigger: OfferTrigger) => {
    if (currentOffer) return;
    if (isPathBlocked(location.pathname)) return;

    const now = Date.now();
    const sessionMinutes = (now - sessionStartRef.current) / (1000 * 60);

    const eligible = offerQueue.filter(item => {
      const config = item.config;
      if (!config) return trigger === 'ao_entrar';

      if (config.gatilho_acao !== trigger) return false;

      if (config.exibir_apos_minutos_navegando > 0 && sessionMinutes < config.exibir_apos_minutos_navegando) {
        return false;
      }

      const lastDisplay = lastDisplayTimeRef.current.get(item.offer.id);
      if (lastDisplay && config.intervalo_horas_entre_exibicoes > 0) {
        const hoursSince = (now - lastDisplay) / (1000 * 60 * 60);
        if (hoursSince < config.intervalo_horas_entre_exibicoes) return false;
      }

      const count = displayCountRef.current.get(item.offer.id) || 0;
      if (config.max_exibicoes_por_usuario > 0 && count >= config.max_exibicoes_por_usuario) {
        return false;
      }

      return true;
    });

    if (eligible.length > 0) {
      const next = eligible[0];
      setCurrentOffer(next);
      lastDisplayTimeRef.current.set(next.offer.id, now);
      displayCountRef.current.set(next.offer.id, (displayCountRef.current.get(next.offer.id) || 0) + 1);

      if (user) {
        trackImpression(next.offer.id, user.id, 'exibida', { trigger, page: location.pathname });
        updateAssignmentStatus(next.offer.id, user.id, 'visualizada');
      }
    }
  }, [currentOffer, offerQueue, user, location.pathname]);

  // Re-load offers when navigating from a blocked path (register/login) to dashboard
  useEffect(() => {
    const prevBlocked = isPathBlocked(prevPathnameRef.current);
    const currentBlocked = isPathBlocked(location.pathname);
    prevPathnameRef.current = location.pathname;

    if (prevBlocked && !currentBlocked && user && user.role !== 'admin') {
      const fingerprint = `${user.id}:${user.plan_status || 'free'}`;
      lastLoadedFingerprintRef.current = null;
      loadEligibleOffers().then(() => {
        lastLoadedFingerprintRef.current = fingerprint;
      });
    }
  }, [location.pathname, user, loadEligibleOffers]);

  // Auto-trigger when arriving on a non-blocked page, with delayed retry for time-gated offers
  useEffect(() => {
    if (offerQueue.length === 0 || currentOffer) return;
    if (isPathBlocked(location.pathname)) return;

    const timer = setTimeout(() => {
      triggerOfferCheck('ao_entrar');

      // If no offer was shown, check if any are waiting on exibir_apos_minutos_navegando
      const now = Date.now();
      const sessionMinutes = (now - sessionStartRef.current) / (1000 * 60);

      let minWaitMs = Infinity;
      for (const item of offerQueue) {
        const config = item.config;
        if (!config || config.gatilho_acao !== 'ao_entrar') continue;
        if (config.exibir_apos_minutos_navegando > 0 && sessionMinutes < config.exibir_apos_minutos_navegando) {
          const remainingMs = (config.exibir_apos_minutos_navegando - sessionMinutes) * 60 * 1000;
          if (remainingMs < minWaitMs) minWaitMs = remainingMs;
        }
      }

      if (minWaitMs < Infinity && minWaitMs > 0) {
        if (delayedTriggerRef.current) clearTimeout(delayedTriggerRef.current);
        delayedTriggerRef.current = setTimeout(() => {
          triggerOfferCheck('ao_entrar');
          delayedTriggerRef.current = null;
        }, minWaitMs + 100);
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (delayedTriggerRef.current) {
        clearTimeout(delayedTriggerRef.current);
        delayedTriggerRef.current = null;
      }
    };
  }, [offerQueue, currentOffer, triggerOfferCheck, location.pathname]);

  // Immediately show offer when admin sends a real-time push
  useEffect(() => {
    if (!forceShowPushed || currentOffer || offerQueue.length === 0) return;
    if (isPathBlocked(location.pathname)) return;
    setForceShowPushed(false);
    triggerOfferCheck('ao_entrar');
  }, [forceShowPushed, currentOffer, offerQueue, triggerOfferCheck, location.pathname]);

  const dismissOffer = useCallback(() => {
    if (!currentOffer || !user) return;
    trackImpression(currentOffer.offer.id, user.id, 'fechada', { page: location.pathname });
    updateAssignmentStatus(currentOffer.offer.id, user.id, 'dispensada');
    setOfferQueue(prev => prev.filter(item => item.offer.id !== currentOffer.offer.id));
    setCurrentOffer(null);
  }, [currentOffer, user, location.pathname]);

  const acceptOffer = useCallback(() => {
    if (!currentOffer || !user) return;
    const offer = currentOffer.offer;
    trackImpression(offer.id, user.id, 'clicada', { page: location.pathname });
    updateAssignmentStatus(offer.id, user.id, 'aceita');
    setOfferQueue(prev => prev.filter(item => item.offer.id !== offer.id));
    setCurrentOffer(null);

    const hasDiscount =
      (offer.desconto_percentual && offer.desconto_percentual > 0) ||
      (offer.desconto_valor_fixo && offer.desconto_valor_fixo > 0) ||
      !!offer.cupom_id;

    if (hasDiscount || offer.plano_alvo_id) {
      if (offer.plano_alvo_id) {
        const params = new URLSearchParams();
        params.set('offer_id', offer.id);
        params.set('plan', offer.plano_alvo_id);
        navigate(`/dashboard/checkout?${params.toString()}`);
      } else {
        let discType: 'percent' | 'fixed' = 'percent';
        let discValue = 0;
        if (offer.desconto_percentual && offer.desconto_percentual > 0) {
          discType = 'percent';
          discValue = offer.desconto_percentual;
        } else if (offer.desconto_valor_fixo && offer.desconto_valor_fixo > 0) {
          discType = 'fixed';
          discValue = offer.desconto_valor_fixo;
        }
        openModalWithOffer({
          offer_id: offer.id,
          discount_type: discType,
          discount_value: discValue,
          offer_title: offer.titulo || 'Oferta Exclusiva',
        });
      }
      return;
    }

    if (offer.url_destino) {
      if (offer.url_destino.startsWith('http://') || offer.url_destino.startsWith('https://')) {
        window.location.href = offer.url_destino;
      } else {
        navigate(offer.url_destino);
      }
    }
  }, [currentOffer, user, location.pathname, navigate, openModalWithOffer]);

  return (
    <PromotionalOffersContext.Provider value={{
      currentOffer,
      dismissOffer,
      acceptOffer,
      triggerOfferCheck,
      hasOffers: offerQueue.length > 0,
    }}>
      {children}
    </PromotionalOffersContext.Provider>
  );
}
