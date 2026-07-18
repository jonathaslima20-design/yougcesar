import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PILLAR_PAGES } from '@/data/pillarPages';

interface RelatedPost {
  slug: string;
  title: string;
  excerpt: string | null;
}

export default function PillarPage({ slug }: { slug: string }) {
  const data = PILLAR_PAGES[slug];
  const [related, setRelated] = useState<RelatedPost[]>([]);

  useEffect(() => {
    if (!data) return;
    document.title = `${data.h1} | VitrineTurbo`;
    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute('content', data.metaDescription);

    supabase
      .from('blog_posts')
      .select('slug, title, excerpt')
      .in('slug', data.relatedSlugs)
      .eq('is_published', true)
      .then(({ data: posts }) => {
        if (!posts) return;
        const ordered = data.relatedSlugs
          .map(slug => posts.find(p => p.slug === slug))
          .filter((p): p is RelatedPost => Boolean(p));
        setRelated(ordered);
      });
  }, [data]);

  if (!data) return <Navigate to="/" replace />;

  return (
    <div className="bg-white">
      <section className="relative pt-36 pb-24 lg:pt-44 lg:pb-28 overflow-hidden bg-white">
        <div className="grid-bg" />
        <div className="relative max-w-5xl mx-auto px-6 lg:px-10 text-center">
          <div className="stagger">
            <div className="inline-flex items-center gap-2 border hairline bg-white rounded-full px-3 py-1.5 mx-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono-label uppercase text-[11px] text-ink-700">{data.kicker}</span>
            </div>
            <h1 className="font-display font-semibold text-[36px] sm:text-[52px] lg:text-[64px] leading-[1.05] tracking-[-0.035em] text-ink-900 mt-6 text-wrap-balance">
              {data.h1}
            </h1>
            <p className="text-ink-500 text-[16px] lg:text-[19px] max-w-2xl mx-auto mt-6 leading-[1.55]">
              {data.subhead}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link to="/register" className="btn-primary rounded-full px-7 py-4 font-display font-medium text-[15px] inline-flex items-center gap-2">
                {data.ctaLabel}
                <ArrowRight size={16} />
              </Link>
              <Link to="/" className="btn-ghost rounded-full px-7 py-4 font-display font-medium text-[15px] inline-flex items-center gap-2">
                Conhecer a Plataforma
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
              {['+3.000 lojas ativas', '0% taxas em vendas', 'Plano free inicial'].map(label => (
                <div key={label} className="inline-flex items-center gap-1.5 border hairline bg-white rounded-full px-3 py-1.5">
                  <span className="font-mono-label uppercase text-[11px] text-ink-700">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 border-t hairline bg-surface">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="grid sm:grid-cols-2 gap-4">
            {data.features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border hairline bg-white p-6 lg:p-7">
                <div className="w-9 h-9 rounded-lg border hairline bg-surface flex items-center justify-center">
                  <Icon size={18} className="text-ink-900" strokeWidth={2} />
                </div>
                <h3 className="font-display font-semibold text-[18px] text-ink-900 tracking-[-0.02em] mt-5">
                  {title}
                </h3>
                <p className="text-ink-500 text-[14px] leading-relaxed mt-2">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="py-20 lg:py-24 border-t hairline">
          <div className="max-w-6xl mx-auto px-6 lg:px-10">
            <div className="font-mono-label uppercase text-[11px] text-ink-500">/ leia também</div>
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              {related.map(post => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group block rounded-xl border hairline p-5 hover:border-ink-400 transition-colors"
                >
                  <h3 className="font-display font-medium text-[15px] text-ink-900 leading-snug group-hover:text-ink-700">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-ink-500 text-[13px] leading-relaxed mt-2 line-clamp-2">{post.excerpt}</p>
                  )}
                  <span className="inline-flex items-center gap-1 text-[12px] font-mono-label uppercase text-ink-700 mt-3">
                    Ler artigo <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 lg:py-24 bg-ink-900">
        <div className="max-w-3xl mx-auto px-6 lg:px-10 text-center">
          <h2 className="font-display font-semibold text-[28px] sm:text-[36px] leading-[1.1] tracking-[-0.03em] text-white">
            Comece agora, de graça.
          </h2>
          <p className="text-ink-300 text-[15px] mt-4">
            Sem cartão de crédito. Sem taxa sobre vendas. Cancele quando quiser.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 font-display font-medium text-[15px] bg-white text-ink-900 hover:bg-ink-100 transition-colors"
          >
            {data.ctaLabel}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
