import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Eye, ArrowLeft, Share2, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  tags: string[];
  view_count: number;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  published_at: string | null;
  category?: { id: string; name: string; slug: string } | null;
}

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
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
  for (const line of content.split('\n')) {
    const match = line.match(/^(#{1,3})\s+(.+)/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim(), id: slugify(match[2].trim()) });
    }
  }
  return headings;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function BlogPostPage() {
  const { postSlug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (postSlug) loadPost();
  }, [postSlug]);

  useEffect(() => {
    if (!post) return;
    document.title = post.meta_title || `${post.title} | Blog VitrineTurbo`;
    const descTag = document.querySelector('meta[name="description"]');
    const description = post.meta_description || post.excerpt || '';
    if (descTag && description) descTag.setAttribute('content', description);
  }, [post]);

  const headings = useMemo(() => (post ? extractHeadings(post.content) : []), [post]);

  const loadPost = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('blog_posts')
        .select('*, category:blog_categories(id, name, slug)')
        .eq('slug', postSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (!data) return;
      setPost(data);
      supabase.rpc('increment_blog_post_view', { post_id: data.id }).then(() => {});
      loadRelated(data.category?.id, data.id);
    } finally {
      setLoading(false);
    }
  };

  const loadRelated = async (categoryId: string | undefined, currentId: string) => {
    if (!categoryId) return;
    const { data } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url')
      .eq('category_id', categoryId)
      .eq('is_published', true)
      .neq('id', currentId)
      .order('published_at', { ascending: false })
      .limit(3);
    setRelated(data || []);
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
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-xl font-bold mb-3">Artigo não encontrado</h1>
        <Link to="/blog" className="text-sm text-primary hover:underline">
          ← Voltar para o Blog
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex gap-10">
        <div className="flex-1 min-w-0">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
            <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <span>/</span>
            {post.category && (
              <>
                <Link to={`/blog/categoria/${post.category.slug}`} className="hover:text-foreground transition-colors">
                  {post.category.name}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-foreground font-medium truncate max-w-[200px]">{post.title}</span>
          </nav>

          <div className="mb-8">
            {post.category && (
              <Link
                to={`/blog/categoria/${post.category.slug}`}
                className="inline-block text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded-full mb-3 transition-colors"
              >
                {post.category.name}
              </Link>
            )}
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight mb-3">{post.title}</h1>
            {post.excerpt && <p className="text-muted-foreground text-base leading-relaxed">{post.excerpt}</p>}

            <div className="flex flex-wrap items-center gap-4 mt-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={13} />
                {formatDate(post.published_at || post.created_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye size={13} />
                {post.view_count} {post.view_count === 1 ? 'leitura' : 'leituras'}
              </span>
              <button onClick={handleCopy} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              {typeof window !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={() => navigator.share?.({ title: post.title, url: window.location.href })}
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <Share2 size={13} />
                  Compartilhar
                </button>
              )}
            </div>
          </div>

          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full aspect-video object-cover rounded-xl mb-8 border border-border"
            />
          )}

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
            prose-img:rounded-lg
            prose-hr:border-border
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => <h2 id={slugify(String(children))}>{children}</h2>,
                h3: ({ children }) => <h3 id={slugify(String(children))}>{children}</h3>,
                a: ({ href, children }) =>
                  href?.startsWith('/') ? <Link to={href}>{children}</Link> : (
                    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                  ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {post.tags?.length > 0 && (
            <div className="mt-10 pt-8 border-t border-border">
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map(tag => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10 pt-8 border-t border-border">
            <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={14} />
              Voltar para o Blog
            </Link>
          </div>

          {related.length > 0 && (
            <div className="mt-10 pt-8 border-t border-border">
              <h2 className="text-base font-semibold mb-4">Continue lendo</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map(r => (
                  <Link key={r.id} to={`/blog/${r.slug}`} className="group block">
                    {r.cover_image_url && (
                      <img src={r.cover_image_url} alt={r.title} className="w-full aspect-video object-cover rounded-lg border border-border mb-2" />
                    )}
                    <h3 className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{r.title}</h3>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {headings.length > 1 && (
          <aside className="hidden xl:block w-52 flex-shrink-0">
            <div className="sticky top-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Neste artigo</p>
              <nav className="space-y-1">
                {headings.map(h => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className={`block text-xs text-muted-foreground hover:text-foreground transition-colors leading-snug py-0.5 ${h.level === 3 ? 'pl-3' : ''}`}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>
    </article>
  );
}
