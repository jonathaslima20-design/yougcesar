import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useStorefrontAppearance } from '@/hooks/useStorefrontAppearance';
import { useSystemAppearance } from '@/hooks/useSystemAppearance';
import {
  StorefrontAppearance,
  StorefrontThemeId,
  DEFAULT_APPEARANCE,
  getRadiusPx,
  getShadowCss,
  getSpacingValue,
  getFontSizeScale,
  loadGoogleFont,
} from '@/lib/appearanceDefaults';

interface StorefrontThemeContextValue {
  appearance: StorefrontAppearance;
  isActive: boolean;
  sfStyles: React.CSSProperties | undefined;
  // Layout/template choice. Unlike `appearance` (colors/typography), this is
  // never gated by plan — every store can pick a storefront theme for free.
  themeId: StorefrontThemeId;
}

const StorefrontThemeContext = createContext<StorefrontThemeContextValue>({
  appearance: DEFAULT_APPEARANCE,
  isActive: false,
  sfStyles: undefined,
  themeId: 'padrao',
});

export function useStorefrontTheme() {
  return useContext(StorefrontThemeContext);
}

interface StorefrontThemeProviderProps {
  userId: string | undefined;
  isPaidPlan: boolean;
  preloadedAppearance?: StorefrontAppearance | null;
  children: ReactNode;
}

function buildSfStyles(app: StorefrontAppearance): React.CSSProperties {
  return {
    '--sf-bg': app.bg_color,
    '--sf-text': app.text_color,
    '--sf-heading': app.heading_color,
    '--sf-button-bg': app.button_bg_color,
    '--sf-button-text': app.button_text_color,
    '--sf-accent': app.accent_color,
    '--sf-card-bg': app.card_bg_color,
    '--sf-card-border': app.card_border_color,
    '--sf-badge-bg': app.badge_bg_color,
    '--sf-badge-text': app.badge_text_color,
    '--sf-icon': app.icon_color,
    '--sf-muted': app.muted_text_color,
    '--sf-border': app.border_color,
    '--sf-radius-card': getRadiusPx(app.card_border_radius),
    '--sf-radius-btn': getRadiusPx(app.button_border_radius),
    '--sf-radius-img': getRadiusPx(app.image_border_radius),
    '--sf-shadow': getShadowCss(app.card_shadow),
    '--sf-gap': getSpacingValue(app.card_gap, 'gap'),
    '--sf-spacing': getSpacingValue(app.section_spacing, 'section'),
    '--sf-font': `'${app.font_family}', sans-serif`,
    '--sf-font-heading': `'${app.heading_font_family}', sans-serif`,
    '--sf-font-scale': getFontSizeScale(app.font_size_base),
    backgroundColor: app.bg_color,
    color: app.text_color,
    fontFamily: `'${app.font_family}', sans-serif`,
  } as React.CSSProperties;
}

export function StorefrontThemeProvider({ userId, isPaidPlan, preloadedAppearance, children }: StorefrontThemeProviderProps) {
  const { appearance: userAppearance, isCustomized, loading: userLoading } = useStorefrontAppearance(
    userId,
    isPaidPlan ? preloadedAppearance : undefined
  );
  const { appearance: systemAppearance, loading: systemLoading } = useSystemAppearance();

  const hasUserTheme = isCustomized && isPaidPlan && userAppearance.is_active;
  const activeAppearance = hasUserTheme ? userAppearance : systemAppearance;
  const isActive = hasUserTheme || (!systemLoading && systemAppearance.is_active);

  const hasPreloaded = !!preloadedAppearance && isPaidPlan && preloadedAppearance.is_active;
  const themeReady = hasPreloaded || (!userLoading && !systemLoading);
  const [revealed, setRevealed] = useState(hasPreloaded);

  useEffect(() => {
    if (themeReady) {
      requestAnimationFrame(() => setRevealed(true));
    }
  }, [themeReady]);

  useEffect(() => {
    if (isActive) {
      loadGoogleFont(activeAppearance.font_family);
      loadGoogleFont(activeAppearance.heading_font_family);
    }
  }, [isActive, activeAppearance.font_family, activeAppearance.heading_font_family]);

  const sfStyles = useMemo<React.CSSProperties | undefined>(() => {
    if (!isActive) return undefined;
    return buildSfStyles(activeAppearance);
  }, [isActive, activeAppearance]);

  // themeId comes straight from the user's own row, regardless of plan/isActive —
  // layout choice is free for every store, unlike the color customization above.
  const themeId = userAppearance.theme_id || 'padrao';
  // `.sf-themed`/`.storefront-default` carry ~150 !important color overrides in
  // index.css written only for the "padrao" theme's own markup (e.g. `footer`,
  // `.text-muted-foreground`). They're scoped with `.theme-padrao` so a second
  // theme's own components (which reuse plain Tailwind classes too) don't get
  // silently recolored by them — see the CorretorHeaderEletronicos/footer bug.
  const themeScopeClass = `theme-${themeId}`;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(themeScopeClass);
    return () => {
      root.classList.remove(themeScopeClass);
    };
  }, [themeScopeClass]);

  useEffect(() => {
    if (isActive && sfStyles) {
      const root = document.documentElement;
      root.classList.add('sf-themed');
      const vars = sfStyles as Record<string, string>;
      const appliedKeys: string[] = [];
      for (const key of Object.keys(vars)) {
        if (key.startsWith('--sf-')) {
          root.style.setProperty(key, vars[key]);
          appliedKeys.push(key);
        }
      }

      root.setAttribute('data-footer-logo-mode', activeAppearance.footer_logo_mode);
      root.setAttribute('data-footer-logo-format', activeAppearance.footer_logo_format ?? 'rectangular');
      if (activeAppearance.custom_logo_url) {
        root.setAttribute('data-custom-logo-url', activeAppearance.custom_logo_url);
      } else {
        root.removeAttribute('data-custom-logo-url');
      }

      return () => {
        root.classList.remove('sf-themed');
        appliedKeys.forEach(k => root.style.removeProperty(k));
        root.removeAttribute('data-footer-logo-mode');
        root.removeAttribute('data-footer-logo-format');
        root.removeAttribute('data-custom-logo-url');
      };
    }
  }, [isActive, sfStyles, activeAppearance.footer_logo_mode, activeAppearance.footer_logo_format, activeAppearance.custom_logo_url]);

  const value = useMemo(
    () => ({ appearance: activeAppearance, isActive, sfStyles, themeId }),
    [activeAppearance, isActive, sfStyles, themeId]
  );

  return (
    <StorefrontThemeContext.Provider value={value}>
      <div
        className={cn(isActive ? 'sf-themed' : 'storefront-default', themeScopeClass)}
        style={{
          ...sfStyles,
          opacity: revealed ? 1 : 0,
          transition: 'opacity 150ms ease-in',
        }}
      >
        {children}
      </div>
    </StorefrontThemeContext.Provider>
  );
}
