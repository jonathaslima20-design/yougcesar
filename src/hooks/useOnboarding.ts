import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export type OnboardingStepId = 'profile' | 'first_product' | 'view_storefront' | 'share' | 'upgrade';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  completed: boolean;
  actionLabel: string;
}

interface OnboardingState {
  steps: OnboardingStep[];
  completedCount: number;
  totalSteps: number;
  progressPercent: number;
  isVisible: boolean;
  isDismissed: boolean;
  allPracticalStepsDone: boolean;
  loading: boolean;
  completeStep: (stepId: OnboardingStepId) => Promise<void>;
  toggleDismissed: () => Promise<void>;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function useOnboarding(): OnboardingState {
  const { user, refreshUser } = useAuth();
  const [productCount, setProductCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchProductCount = async () => {
      const { count, error } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!cancelled) {
        setProductCount(error ? 0 : (count ?? 0));
        setLoading(false);
      }
    };

    fetchProductCount();
    return () => { cancelled = true; };
  }, [user?.id]);

  const completedSteps = useMemo(
    () => user?.onboarding_completed_steps ?? [],
    [user?.onboarding_completed_steps]
  );

  const steps = useMemo((): OnboardingStep[] => {
    const profileDone = completedSteps.includes('profile') ||
      !!(user?.name?.trim() && user?.whatsapp?.trim() && user?.slug?.trim());

    const productDone = completedSteps.includes('first_product') ||
      (productCount !== null && productCount >= 1);

    const storefrontDone = completedSteps.includes('view_storefront') ||
      !!user?.onboarding_storefront_viewed;

    const shareDone = completedSteps.includes('share');

    const upgradeDone = completedSteps.includes('upgrade');

    return [
      {
        id: 'profile',
        title: 'Complete seu perfil',
        description: 'Preencha o nome da loja, WhatsApp e link da vitrine',
        completed: profileDone,
        actionLabel: 'Completar perfil',
      },
      {
        id: 'first_product',
        title: 'Cadastre seu primeiro produto',
        description: 'Adicione pelo menos um produto ao seu catálogo',
        completed: productDone,
        actionLabel: 'Adicionar produto',
      },
      {
        id: 'view_storefront',
        title: 'Veja sua vitrine ao vivo',
        description: 'Confira como seus clientes veem sua loja',
        completed: storefrontDone,
        actionLabel: 'Ver minha vitrine',
      },
      {
        id: 'share',
        title: 'Compartilhe com um cliente',
        description: 'Envie o link da sua vitrine pelo WhatsApp',
        completed: shareDone,
        actionLabel: 'Compartilhar via WhatsApp',
      },
      {
        id: 'upgrade',
        title: 'Desbloqueie todo o potencial',
        description: 'Aparência exclusiva, domínio próprio e produtos ilimitados',
        completed: upgradeDone,
        actionLabel: 'Ver planos',
      },
    ];
  }, [completedSteps, user, productCount]);

  // Auto-persist steps that are detected as complete but not yet saved
  useEffect(() => {
    if (!user?.id || loading) return;

    const autoDetected = steps
      .filter(s => s.completed && !completedSteps.includes(s.id))
      .map(s => s.id);

    if (autoDetected.length === 0) return;

    const newSteps = [...completedSteps, ...autoDetected];
    supabase
      .from('users')
      .update({ onboarding_completed_steps: newSteps })
      .eq('id', user.id)
      .then(() => {});
  }, [steps, completedSteps, user?.id, loading]);

  const completedCount = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const allPracticalStepsDone = steps.every(s => s.completed);

  const allStepsDone = steps.every(s => s.completed);

  const isVisible = useMemo(() => {
    if (!user) return false;
    if (user.role !== 'corretor') return false;
    if (allStepsDone) return false;

    const daysSinceCreation = (Date.now() - new Date(user.created_at).getTime());
    const isNew = daysSinceCreation <= THREE_DAYS_MS;
    const hasZeroProducts = productCount === 0;

    return isNew || hasZeroProducts;
  }, [user, productCount, allStepsDone]);

  const isDismissed = user?.onboarding_dismissed ?? false;

  const completeStep = useCallback(async (stepId: OnboardingStepId) => {
    if (!user?.id) return;
    if (completedSteps.includes(stepId)) return;

    const newSteps = [...completedSteps, stepId];

    const updateData: Record<string, unknown> = {
      onboarding_completed_steps: newSteps,
    };

    if (stepId === 'view_storefront') {
      updateData.onboarding_storefront_viewed = true;
    }

    await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    await refreshUser();
  }, [user?.id, completedSteps, refreshUser]);

  const toggleDismissed = useCallback(async () => {
    if (!user?.id) return;

    await supabase
      .from('users')
      .update({ onboarding_dismissed: !isDismissed })
      .eq('id', user.id);

    await refreshUser();
  }, [user?.id, isDismissed, refreshUser]);

  return {
    steps,
    completedCount,
    totalSteps,
    progressPercent,
    isVisible,
    isDismissed,
    allPracticalStepsDone,
    loading,
    completeStep,
    toggleDismissed,
  };
}
