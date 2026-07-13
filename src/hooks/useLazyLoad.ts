import { useEffect, useRef, useState } from 'react';

interface UseLazyLoadProps {
  onIntersect: () => void;
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

interface UseLazyLoadReturn {
  ref: React.RefObject<HTMLDivElement>;
  isIntersecting: boolean;
}

export function useLazyLoad({
  onIntersect,
  threshold = 0.1,
  rootMargin = '100px',
  enabled = true,
}: UseLazyLoadProps): UseLazyLoadReturn {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!enabled || !ref.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting) {
          onIntersect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [enabled, onIntersect, threshold, rootMargin]);

  return { ref, isIntersecting };
}
