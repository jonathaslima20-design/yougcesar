import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface LandingTestimonial {
  id: string;
  author_name: string;
  store_name: string;
  avatar_url: string | null;
  quote: string;
  result_label: string | null;
  result_value: string | null;
  display_order: number;
  is_active: boolean;
}

export function useLandingTestimonials() {
  const [testimonials, setTestimonials] = useState<LandingTestimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('landing_testimonials')
      .select('id, author_name, store_name, avatar_url, quote, result_label, result_value, display_order, is_active')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setTestimonials(data || []);
        setIsLoading(false);
      });
  }, []);

  return { testimonials, isLoading };
}
