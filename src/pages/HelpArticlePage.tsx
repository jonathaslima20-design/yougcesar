import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, Share2, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { HelpLayout } from '@/components/help/HelpLayout';

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  tags: string[];
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; slug: string };
}

interface NavArticle {
  title: string;
  slug: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function extractHeadings(content: string) {
  const headings: { level: number; text: string; id: string }[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        id: slugify(match[2].trim()),
      });
    }
  }
  return headings;
}

export default function HelpArticlePage() {
  const { categorySlug, articleSlug } = useParams();
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [prevArticle, setPrevArticle] = useState<NavArticle | null>(null);
  const [nextArticle, setNextArticle] = useState<NavArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'not_helpful' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (articleSlug) loadArticle();
  }, [articleSlug]);

  const headings = useMemo(() => {
    if (!article) return [];
    return extractHeadings(article.content);
  }, [article]);

  const loadArticle = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('help_articles')
        .select('*, category:help_categories(id, name, slug)')
        .eq('slug', articleSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (!data) return;
      setArticle(data);
      trackView(data.id);
      loadSiblingArticles(data.category?.id, data.id);
    } finally {
      setLoading(false);
    }
  };

  const trackView = async (articleId: string) => {
    try {
      await supabase.from('help_article_views').insert({
        article_id: articleId,
        user_agent: navigator.userAgent,
      });
    } catch { /* silent */ }
  };

  const loadSiblingArticles = async (categoryId: string | undefined, currentId: string) => {
    if (!categoryId) return;
    const { data } = await supabase
      .from('help_articles')
      .select('id, title, slug')
      .eq('category_id', categoryId)
      .eq('is_published', true)
      .order('created_at', { ascending: true });

    if (!data) return;
    const idx = data.findIndex(a => a.id === currentId);
    setPrevArticle(idx > 0 ? data[idx - 1] : null);
    setNextArticle(idx < data.length - 1 ? data[idx + 1] : null);
  };

  const submitFeedback = async () => {
    if (!article || !feedbackGiven) return;
    try {
      await supabase.from('help_article_feedback').insert({
        article_id: article.id,
        is_helpful: feedbackGiven === 'helpful',
        feedback_text: feedbackText.trim() || null,
      });

      // Update counters
      const field = feedbackGiven === 'helpful' ? 'helpful_count' : 'not_helpful_count';
      await supabase
        .from('help_articles')
        .update({ [field]: (article[field as keyof HelpArticle] as number) + 1 })
        .eq('id', article.id);

      setFeedbackSubmitted(true);
    } catch {
      toast.error('Erro ao enviar feedback. Tente novamente.');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  if (loading) {
    return (
      <HelpLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </HelpLayout>
    );
  }

  if (!article) {
    return (
      <HelpLayout>
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h1 className="text-xl font-bold mb-3">Artigo não encontrado</h1>
          <Link to="/help" className="text-sm text-primary hover:underline">
            ← Voltar para Central de Ajuda
          </Link>
        </div>
      </HelpLayout>
    );
  }

  return (
    <HelpLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex gap-10">
          {/* Main article content */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
              <Link to="/help" className="hover:text-foreground transition-colors">Central de Ajuda</Link>
              <span>/</span>
              {article.category && (
                <>
                  <Link
                    to={`/help/category/${article.category.slug}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {article.category.name}
                  </Link>
                  <span>/</span>
                </>
              )}
              <span className="text-foreground font-medium truncate max-w-[200px]">{article.title}</span>
            </nav>

            {/* Article header */}
            <div className="mb-8">
              {article.category && (
                <Link
                  to={`/help/category/${article.category.slug}`}
                  className="inline-block text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-full mb-3 transition-colors"
                >
                  {article.category.name}
                </Link>
              )}
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-3">
                {article.title}
              </h1>
              {article.excerpt && (
                <p className="text-muted-foreground text-base leading-relaxed">
                  {article.excerpt}
                </p>
              )}
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copiado!' : 'Copiar link'}
                </button>
                {typeof window !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={() => navigator.share?.({ title: article.title, url: window.location.href })}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Share2 size={13} />
                    Compartilhar
                  </button>
                )}
              </div>
            </div>

            {/* Markdown content */}
            <div className="prose prose-neutral dark:prose-invert max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-h1:text-2xl prose-h1:mt-10 prose-h1:mb-4
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
              prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-3
              prose-strong:text-foreground prose-strong:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-code:text-[13px] prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:text-sm
              prose-blockquote:border-l-primary/50 prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:not-italic prose-blockquote:text-muted-foreground
              prose-table:text-sm prose-th:bg-muted prose-th:font-semibold
              prose-ul:my-3 prose-li:my-1 prose-li:text-muted-foreground
              prose-ol:my-3
              prose-hr:border-border
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => {
                    const id = slugify(String(children));
                    return <h2 id={id}>{children}</h2>;
                  },
                  h3: ({ children }) => {
                    const id = slugify(String(children));
                    return <h3 id={id}>{children}</h3>;
                  },
                  a: ({ href, children }) => {
                    const isInternal = href?.startsWith('/');
                    if (isInternal) {
                      return <Link to={href!}>{children}</Link>;
                    }
                    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                  },
                }}
              >
                {article.content}
              </ReactMarkdown>
            </div>

            {/* Tags */}
            {article.tags?.length > 0 && (
              <div className="mt-10 pt-8 border-t border-border">
                <div className="flex flex-wrap gap-1.5">
                  {article.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            <div className="mt-10 pt-8 border-t border-border">
              {feedbackSubmitted ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check size={15} className="text-green-500" />
                  Obrigado pelo seu feedback! Isso nos ajuda a melhorar.
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-3">Esta página foi útil?</p>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setFeedbackGiven('helpful')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-all ${
                        feedbackGiven === 'helpful'
                          ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                          : 'border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ThumbsUp size={13} />
                      Sim, foi útil
                    </button>
                    <button
                      onClick={() => setFeedbackGiven('not_helpful')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-all ${
                        feedbackGiven === 'not_helpful'
                          ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                          : 'border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ThumbsDown size={13} />
                      Não ajudou
                    </button>
                  </div>

                  {feedbackGiven && (
                    <div className="space-y-2">
                      <textarea
                        value={feedbackText}
                        onChange={e => setFeedbackText(e.target.value)}
                        placeholder={
                          feedbackGiven === 'helpful'
                            ? 'O que mais você achou útil? (opcional)'
                            : 'O que poderia ser melhorado? (opcional)'
                        }
                        rows={3}
                        className="w-full max-w-md text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground"
                      />
                      <div>
                        <button
                          onClick={submitFeedback}
                          className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          Enviar feedback
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Prev / Next navigation */}
            {(prevArticle || nextArticle) && (
              <div className="mt-10 pt-8 border-t border-border flex items-center justify-between gap-4">
                {prevArticle ? (
                  <Link
                    to={`/help/category/${categorySlug}/${prevArticle.slug}`}
                    className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1"
                  >
                    <ArrowLeft size={14} className="flex-shrink-0 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="truncate">{prevArticle.title}</span>
                  </Link>
                ) : <div />}

                {nextArticle ? (
                  <Link
                    to={`/help/category/${categorySlug}/${nextArticle.slug}`}
                    className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1 justify-end text-right"
                  >
                    <span className="truncate">{nextArticle.title}</span>
                    <ArrowRight size={14} className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                ) : <div />}
              </div>
            )}
          </div>

          {/* Table of Contents — desktop only */}
          {headings.length > 1 && (
            <aside className="hidden xl:block w-52 flex-shrink-0">
              <div className="sticky top-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Neste artigo
                </p>
                <nav className="space-y-1">
                  {headings.map(h => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={`block text-xs text-muted-foreground hover:text-foreground transition-colors leading-snug py-0.5 ${
                        h.level === 3 ? 'pl-3' : ''
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </div>
    </HelpLayout>
  );
}
