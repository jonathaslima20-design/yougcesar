import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionModal } from '@/contexts/SubscriptionModalContext';
import { fetchActiveSignupDiscount } from '@/lib/signupDiscountService';

// Looks up the "desconto de boas-vindas" (Admin > Desconto de Boas-vindas) and
// pushes it into SubscriptionModalContext so SubscriptionBlocker's forced modal
// can render it. Fetched once per user per mount — the countdown expiring
// itself client-side is what makes the offer disappear, not a re-fetch.
export function useSignupOffer(shouldCheck: boolean) {
  const { user } = useAuth();
  const { openForcedModalWithOffer } = useSubscriptionModal();
  const checkedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldCheck || !user?.id) return;
    if (checkedForRef.current === user.id) return;
    checkedForRef.current = user.id;

    fetchActiveSignupDiscount({
      role: user.role,
      managed_by_partner_id: user.managed_by_partner_id,
      referred_by: user.referred_by,
      created_at: user.created_at,
    })
      .then((discount) => {
        if (!discount) return;
        openForcedModalWithOffer({
          offer_id: discount.offer_id,
          discount_type: discount.discount_type,
          discount_value: discount.discount_value,
          offer_title: discount.title,
          subtitulo: discount.subtitle,
          cor_destaque: discount.highlight_color,
          cor_fundo: discount.background_color,
          mostrar_contador: true,
          deadline: discount.deadline,
          planos_aplicaveis: discount.plan_ids,
        });
      })
      .catch((err) => console.error('Failed to load signup discount:', err));
  }, [shouldCheck, user, openForcedModalWithOffer]);
}
