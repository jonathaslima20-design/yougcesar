import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ChevronDown, ChevronUp, ShieldCheck, ChartBar as BarChart2, Settings2, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCookiePreferences,
  acceptAll,
  rejectNonEssential,
  saveCookiePreferences,
  hasUserChosen,
  type CookiePreferences,
} from '@/lib/cookieConsent';

interface CategoryConfig {
  key: keyof Omit<CookiePreferences, 'necessary' | 'savedAt'>;
  label: string;
  description: string;
  icon: React.ReactNode;
  required?: boolean;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'necessary' as never,
    label: 'Cookies Necessários',
    description:
      'Essenciais para o funcionamento da plataforma: autenticação, sessão, segurança e preferências básicas. Não podem ser desativados.',
    icon: <ShieldCheck className="h-5 w-5" />,
    required: true,
  },
  {
    key: 'analytics',
    label: 'Cookies de Analytics',
    description:
      'Nos ajudam a entender como os visitantes interagem com a plataforma, para melhorar a experiência. Os dados são agregados e anonimizados.',
    icon: <BarChart2 className="h-5 w-5" />,
  },
  {
    key: 'functional',
    label: 'Cookies de Funcionalidade',
    description:
      'Lembram suas preferências de interface (tema, idioma, layout) para oferecer uma experiência personalizada.',
    icon: <Settings2 className="h-5 w-5" />,
  },
  {
    key: 'marketing',
    label: 'Cookies de Marketing',
    description:
      'Utilizados para exibir anúncios relevantes e mensurar campanhas. Podem ser definidos por parceiros terceiros.',
    icon: <Megaphone className="h-5 w-5" />,
  },
];

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({
    analytics: false,
    functional: false,
    marketing: false,
  });

  useEffect(() => {
    if (!hasUserChosen()) {
      // Small delay so the page renders first
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function handleAcceptAll() {
    acceptAll();
    setVisible(false);
  }

  function handleRejectAll() {
    rejectNonEssential();
    setVisible(false);
  }

  function handleOpenCustomize() {
    const saved = getCookiePreferences();
    setPrefs({
      analytics: saved?.analytics ?? false,
      functional: saved?.functional ?? false,
      marketing: saved?.marketing ?? false,
    });
    setShowCustomize(true);
  }

  function handleSaveCustom() {
    saveCookiePreferences(prefs);
    setShowCustomize(false);
    setVisible(false);
  }

  function togglePref(key: 'analytics' | 'functional' | 'marketing') {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop when modal is open */}
      <AnimatePresence>
        {showCustomize && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[998] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCustomize(false)}
          />
        )}
      </AnimatePresence>

      {/* Customize Modal */}
      <AnimatePresence>
        {showCustomize && (
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-modal-title"
            className="fixed inset-x-4 top-1/2 z-[999] mx-auto max-w-lg -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: '-46%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: '-46%' }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 id="cookie-modal-title" className="text-base font-semibold text-foreground">
                Personalizar preferências de cookies
              </h2>
              <button
                onClick={() => setShowCustomize(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4 space-y-2">
              {CATEGORIES.map((cat) => {
                const isExpanded = expandedCategory === cat.key;
                const isChecked = cat.required ? true : prefs[cat.key as 'analytics' | 'functional' | 'marketing'];

                return (
                  <div key={cat.key} className="rounded-xl border border-border bg-muted/30">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="shrink-0 text-muted-foreground">{cat.icon}</span>
                      <span className="flex-1 text-sm font-medium text-foreground">{cat.label}</span>

                      {cat.required ? (
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          Sempre ativo
                        </span>
                      ) : (
                        <button
                          role="switch"
                          aria-checked={isChecked}
                          aria-label={`${isChecked ? 'Desativar' : 'Ativar'} ${cat.label}`}
                          onClick={() => togglePref(cat.key as 'analytics' | 'functional' | 'marketing')}
                          className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isChecked ? 'bg-primary' : 'bg-input'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                              isChecked ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      )}

                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} detalhes`}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                            {cat.description}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border px-6 py-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => setShowCustomize(false)}
                className="order-2 sm:order-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCustom}
                className="order-1 sm:order-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Salvar preferências
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner */}
      <AnimatePresence>
        {!showCustomize && visible && (
          <motion.div
            key="banner"
            role="region"
            aria-label="Aviso de cookies"
            className="fixed bottom-0 inset-x-0 z-[997] px-4 pb-4 sm:px-6 sm:pb-6 pointer-events-none"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3 }}
          >
            <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border bg-background shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
              <div className="px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Sua privacidade importa
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Usamos cookies para garantir o funcionamento da plataforma e, com seu consentimento, para analytics, funcionalidade e marketing. Saiba mais em nossa{' '}
                      <Link
                        to="/politica-de-cookies"
                        className="underline underline-offset-2 text-foreground hover:text-primary transition-colors"
                      >
                        Política de Cookies
                      </Link>
                      .
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={handleOpenCustomize}
                      className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Personalizar
                    </button>
                    <button
                      onClick={handleRejectAll}
                      className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={handleAcceptAll}
                      className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Aceitar todos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
