import { Quote } from 'lucide-react';
import { useLandingTestimonials } from '@/hooks/useLandingTestimonials';

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="max-w-3xl reveal">
      <div className="font-mono-label uppercase text-[11px] text-ink-500">{kicker}</div>
      <h2 className="font-display font-semibold text-[36px] sm:text-[48px] lg:text-[64px] leading-[1.05] tracking-[-0.035em] text-ink-900 mt-4">
        {title}
      </h2>
    </div>
  );
}

export default function LandingTestimonials() {
  const { testimonials, isLoading } = useLandingTestimonials();

  if (isLoading || testimonials.length === 0) return null;

  return (
    <section className="py-24 lg:py-32 bg-surface border-t hairline">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <SectionHeading kicker="/ resultados" title="Quem usa, vende mais" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14">
          {testimonials.map((t) => {
            const initials = t.author_name
              .split(' ')
              .slice(0, 2)
              .map((w) => w.charAt(0).toUpperCase())
              .join('');

            return (
              <div
                key={t.id}
                className="reveal card-hover rounded-2xl border hairline bg-white p-6 lg:p-7 flex flex-col"
              >
                <Quote size={20} className="text-ink-300" strokeWidth={2} />
                <p className="text-[15px] text-ink-700 leading-[1.5] mt-4 flex-1">
                  {t.quote}
                </p>
                <div className="flex items-center gap-3 mt-6 pt-6 border-t hairline">
                  <div className="h-11 w-11 rounded-full overflow-hidden bg-surface border hairline flex items-center justify-center flex-shrink-0">
                    {t.avatar_url ? (
                      <img
                        src={t.avatar_url}
                        alt={t.author_name}
                        width={44}
                        height={44}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-display font-semibold text-[13px] text-ink-500">{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-ink-900 truncate">{t.author_name}</div>
                    <div className="text-[12px] text-ink-400 truncate">{t.store_name}</div>
                  </div>
                  {t.result_value && (
                    <div className="text-right flex-shrink-0">
                      <div className="font-display font-semibold text-[18px] text-emerald-600 leading-none">{t.result_value}</div>
                      {t.result_label && (
                        <div className="text-[10px] text-ink-400 mt-1">{t.result_label}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
