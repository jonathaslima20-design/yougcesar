import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { loadTrackingSettings, injectMetaPixel, injectGoogleAnalytics } from '@/lib/tracking';
import { logCategoryOperation, sanitizeCategoryName } from '@/lib/categoryUtils';
import { updateMetaTags, updateFavicon, getCorretorMetaTags, resetMetaTags } from '@/utils/metaTags';
import { validateSession } from '@/lib/auth/simpleAuth';
import { loadGoogleFont, type StorefrontAppearance } from '@/lib/appearanceDefaults';
import type { User } from '@/types';

const APPEARANCE_CACHE_PREFIX = 'sf-theme-';
const APPEARANCE_CACHE_TTL = 24 * 60 * 60 * 1000;

function getCachedAppearance(userId: string): StorefrontAppearance | null {
  try {
    const raw = localStorage.getItem(`${APPEARANCE_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > APPEARANCE_CACHE_TTL) {
      localStorage.removeItem(`${APPEARANCE_CACHE_PREFIX}${userId}`);
      return null;
    }
    return data as StorefrontAppearance;
  } catch {
    return null;
  }
}

function setCachedAppearance(userId: string, data: StorefrontAppearance): void {
  try {
    localStorage.setItem(
      `${APPEARANCE_CACHE_PREFIX}${userId}`,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {}
}

interface UseCorretorDataProps {
  slug: string | undefined;
}

interface UseCorretorDataReturn {
  corretor: User | null;
  loading: boolean;
  error: string | null;
  preloadedAppearance: StorefrontAppearance | null;
}

/**
 * Custom hook for loading corretor data and applying theme/tracking
 */
export function useCorretorData({ slug }: UseCorretorDataProps): UseCorretorDataReturn {
  const [corretor, setCorretor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preloadedAppearance, setPreloadedAppearance] = useState<StorefrontAppearance | null>(null);

  useEffect(() => {
    // Validate session on component mount
    validateSession();
    
    if (slug) {
      fetchCorretorData();
    }

    return () => {
      try {
        // Reset meta tags to default when leaving the storefront
        resetMetaTags();
        // Clean up theme classes when leaving the storefront
        document.documentElement.classList.remove('light', 'dark');
      } catch (e) {
        console.error('Error cleaning up styles:', e);
      }
    };
  }, [slug]);

  const fetchCorretorData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!slug) {
        setError('Usuário não encontrado');
        return;
      }
      
      logCategoryOperation('LOADING_CORRETOR_DATA', { slug });

      // Load corretor data and tracking settings in parallel
      const [corretorResult, trackingResult] = await Promise.allSettled([
        supabase
          .from('users')
          .select(`
            id,
            name,
            email,
            role,
            phone,
            whatsapp,
            country_code,
            avatar_url,
            cover_url_desktop,
            cover_url_mobile,
            promotional_banner_url_desktop,
            promotional_banner_url_mobile,
            slug,
            is_blocked,
            bio,
            instagram,
            location_url,
            theme,
            currency,
            language,
            plan_status,
            billing_cycle,
            subscription_end_date,
            referral_code
          `)
          .eq('slug', slug)
          .eq('role', 'corretor')
          .maybeSingle(),
        loadTrackingSettings(slug) // We'll get the user ID from the first query
      ]);
      
      // Handle corretor data result
      if (corretorResult.status === 'rejected' || !corretorResult.value.data) {
        const error = corretorResult.status === 'rejected' ? corretorResult.reason : corretorResult.value.error;
        logCategoryOperation('CORRETOR_NOT_FOUND', { slug, error });
        setError(`Usuário não encontrado: ${slug}`);
        return;
      }
      
      const corretorData = corretorResult.value.data;
      
      logCategoryOperation('CORRETOR_LOADED', { 
        name: corretorData.name, 
        id: corretorData.id,
        slug: corretorData.slug,
        theme: corretorData.theme,
        currency: corretorData.currency,
        language: corretorData.language
      });
      
      setCorretor(corretorData);

      // Pre-fetch storefront appearance: try cache first, then fetch in background
      const cachedAppearance = getCachedAppearance(corretorData.id);
      if (cachedAppearance) {
        setPreloadedAppearance(cachedAppearance);
        loadGoogleFont(cachedAppearance.font_family);
        loadGoogleFont(cachedAppearance.heading_font_family);
      }

      supabase
        .from('storefront_appearance')
        .select('*')
        .eq('user_id', corretorData.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const appearance = data as StorefrontAppearance;
            setPreloadedAppearance(appearance);
            setCachedAppearance(corretorData.id, appearance);
            loadGoogleFont(appearance.font_family);
            loadGoogleFont(appearance.heading_font_family);
          }
        });

      // Define current language with fallback
      const currentLanguage = corretorData.language || 'pt-BR';
      
      // Update meta tags for social media previews with correct title
      const metaConfig = getCorretorMetaTags(corretorData, currentLanguage);
      updateMetaTags(metaConfig);
      
      // Update favicon to user's avatar if available
      if (corretorData.avatar_url) {
        updateFavicon(corretorData.avatar_url);
      }
      
      document.title = metaConfig.title;
      
      // Apply corretor's theme to the storefront
      if (corretorData.theme) {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(corretorData.theme);
      }

      // Load global Meta Pixel from site settings
      try {
        const { data: siteSettings, error: siteSettingsError } = await supabase
          .from('site_settings')
          .select('setting_value')
          .eq('setting_name', 'global_meta_pixel_id')
          .maybeSingle();

        if (!siteSettingsError && siteSettings?.setting_value) {
          console.log('Injecting global Meta Pixel:', siteSettings.setting_value);
          injectMetaPixel(siteSettings.setting_value);
        }
      } catch (globalPixelError) {
        console.warn('Error loading global Meta Pixel:', globalPixelError);
        // Don't fail the page load for global pixel errors
      }

      // Handle tracking settings result (non-blocking) - only for paid plans
      if (trackingResult.status === 'fulfilled' && corretorData.plan_status === 'active') {
        const trackingSettings = trackingResult.value;

        if (trackingSettings?.meta_pixel_id) {
          injectMetaPixel(trackingSettings.meta_pixel_id);
        }

        if (trackingSettings?.ga_measurement_id) {
          injectGoogleAnalytics(trackingSettings.ga_measurement_id);
        }
      } else if (trackingResult.status === 'rejected') {
        console.warn('Error loading tracking settings:', trackingResult.reason);
      }

    } catch (err: any) {
      logCategoryOperation('FETCH_CORRETOR_ERROR', err);
      console.error('Error fetching corretor data:', err);
      setError(`Error loading seller data: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    corretor,
    loading,
    error,
    preloadedAppearance
  };
}