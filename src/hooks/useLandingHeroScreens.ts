import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface HeroConfig {
  animation_type: 'slide' | 'fade' | 'scale';
  slide_interval_ms: number;
  mockup_shadow: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  mockup_scale: number;
  mockup_gap: number;
  autoplay: boolean;
  pause_on_hover: boolean;
}

export interface HeroScreen {
  id: string;
  display_order: number;
  is_active: boolean;
  label: string;
  screen_type: 'storefront' | 'product_detail' | 'dashboard' | 'my_products' | 'custom';
  config: Record<string, any>;
  scroll_y: number;
}

const DEFAULT_CONFIG: HeroConfig = {
  animation_type: 'slide',
  slide_interval_ms: 5000,
  mockup_shadow: 'lg',
  mockup_scale: 1.0,
  mockup_gap: 40,
  autoplay: true,
  pause_on_hover: true,
};

export function useLandingHeroScreens() {
  const [config, setConfig] = useState<HeroConfig>(DEFAULT_CONFIG);
  const [screens, setScreens] = useState<HeroScreen[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const [configRes, screensRes] = await Promise.all([
          supabase.from('landing_hero_config').select('*').eq('id', 1).maybeSingle(),
          supabase.from('landing_hero_screens').select('*').eq('is_active', true).order('display_order', { ascending: true }),
        ]);

        if (configRes.data) {
          setConfig({
            animation_type: configRes.data.animation_type,
            slide_interval_ms: configRes.data.slide_interval_ms,
            mockup_shadow: configRes.data.mockup_shadow,
            mockup_scale: configRes.data.mockup_scale,
            mockup_gap: configRes.data.mockup_gap,
            autoplay: configRes.data.autoplay,
            pause_on_hover: configRes.data.pause_on_hover,
          });
        }

        if (screensRes.data && screensRes.data.length > 0) {
          setScreens(screensRes.data);
        }
      } catch (err) {
        console.error('Failed to load landing hero data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetch();
  }, []);

  return { config, screens, isLoading };
}
