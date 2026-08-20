import { useEffect } from 'react';

export function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    const observed = new WeakSet<Element>();
    const observeAll = () => {
      document.querySelectorAll('.reveal').forEach((el) => {
        if (!observed.has(el)) {
          observed.add(el);
          observer.observe(el);
        }
      });
    };
    observeAll();
    let debounceId: number | undefined;
    const mutation = new MutationObserver(() => {
      if (debounceId !== undefined) return;
      debounceId = window.setTimeout(() => {
        debounceId = undefined;
        observeAll();
      }, 150);
    });
    mutation.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
      if (debounceId !== undefined) window.clearTimeout(debounceId);
    };
  }, []);
}
