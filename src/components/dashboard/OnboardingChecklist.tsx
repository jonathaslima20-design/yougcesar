import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionModal } from '@/contexts/SubscriptionModalContext';
import { useOnboarding, type OnboardingStepId } from '@/hooks/useOnboarding';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  User,
  Package,
  Eye,
  Share2,
  Check,
  ChevronDown,
  ChevronUp,
  Rocket,
  Crown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STEP_ICONS: Record<OnboardingStepId, typeof User> = {
  profile: User,
  first_product: Package,
  view_storefront: Eye,
  share: Share2,
  upgrade: Crown,
};

export function OnboardingChecklist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openModal } = useSubscriptionModal();
  const {
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
  } = useOnboarding();

  const [showConfetti, setShowConfetti] = useState(false);
  const [prevPracticalDone, setPrevPracticalDone] = useState(false);

  useEffect(() => {
    if (allPracticalStepsDone && !prevPracticalDone) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
    setPrevPracticalDone(allPracticalStepsDone);
  }, [allPracticalStepsDone, prevPracticalDone]);

  if (loading || !isVisible) return null;

  const handleStepAction = async (stepId: OnboardingStepId) => {
    switch (stepId) {
      case 'profile':
        navigate('/dashboard/settings');
        break;

      case 'first_product':
        navigate('/dashboard/products/new');
        break;

      case 'view_storefront': {
        if (!user?.slug) {
          navigate('/dashboard/settings');
          return;
        }
        const storeUrl = user.custom_domain
          ? `https://${user.custom_domain}`
          : `https://vitrineturbo.com/${user.slug}`;
        window.open(storeUrl, '_blank');
        await completeStep('view_storefront');
        break;
      }

      case 'share': {
        if (!user?.slug) {
          navigate('/dashboard/settings');
          return;
        }
        const shareUrl = user.custom_domain
          ? `https://${user.custom_domain}`
          : `https://vitrineturbo.com/${user.slug}`;
        const message = encodeURIComponent(
          `Olá! Acesse meu catálogo digital: ${shareUrl}`
        );
        window.open(`https://wa.me/?text=${message}`, '_blank');
        await completeStep('share');
        break;
      }

      case 'upgrade':
        openModal(false);
        await completeStep('upgrade');
        break;
    }
  };

  const currentStepIndex = steps.findIndex(s => !s.completed);

  return (
    <div className="relative">
      {showConfetti && <ConfettiOverlay />}

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">Primeiros Passos</h3>
              <p className="text-xs text-muted-foreground">
                {completedCount} de {totalSteps} concluídos ({progressPercent}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleDismissed}
              title={isDismissed ? 'Expandir' : 'Minimizar'}
            >
              {isDismissed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 sm:px-5 pb-2">
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Steps list */}
        <AnimatePresence initial={false}>
          {!isDismissed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              {allPracticalStepsDone && (
                <div className="mx-4 sm:mx-5 mb-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm font-medium text-primary text-center">
                    Parabéns! Você concluiu todos os passos.
                  </p>
                </div>
              )}

              <div className="px-4 sm:px-5 pb-4 space-y-1.5">
                {steps.map((step, index) => {
                  const Icon = STEP_ICONS[step.id];
                  const isCurrent = index === currentStepIndex;

                  return (
                    <motion.div
                      key={step.id}
                      layout
                      className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                        step.completed
                          ? 'opacity-60'
                          : isCurrent
                          ? 'bg-muted/80 ring-1 ring-border'
                          : ''
                      }`}
                    >
                      {/* Check circle */}
                      <div
                        className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                          step.completed
                            ? 'bg-primary text-primary-foreground'
                            : 'border-2 border-muted-foreground/30'
                        }`}
                      >
                        {step.completed ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium leading-tight ${
                            step.completed ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                          {step.description}
                        </p>
                      </div>

                      {/* Action button */}
                      {step.completed ? (
                        <span className="flex-shrink-0 text-xs font-medium text-primary whitespace-nowrap">
                          Concluído
                        </span>
                      ) : (
                        <Button
                          variant={step.id === 'upgrade' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-shrink-0 text-xs h-8"
                          onClick={() => handleStepAction(step.id)}
                        >
                          <Icon className="h-3.5 w-3.5 mr-1.5" />
                          <span className="hidden sm:inline">{step.actionLabel}</span>
                          <span className="sm:hidden">
                            {step.id === 'upgrade' ? 'Planos' : 'Fazer'}
                          </span>
                        </Button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ConfettiOverlay() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 2,
    size: 6 + Math.random() * 6,
    color: ['#0ea5e9', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'][
      Math.floor(Math.random() * 6)
    ],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 rounded-xl">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -10, x: `${p.x}%`, opacity: 1, scale: 1 }}
          animate={{ y: '110%', opacity: 0, scale: 0.5, rotate: 360 }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeIn',
          }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}
