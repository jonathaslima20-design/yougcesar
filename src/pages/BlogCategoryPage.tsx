import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, FileText, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  view_count: number;
  published_at: string | null;
  created_at: string;
}

export default function BlogCategoryPage() {
  const { categorySlug } = useParams();
  const [category, setCategory] = useState<BlogCategory | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (categorySlug) loadCategoryData();
  }, [categorySlug]);

  useEffect(() => {
    if (category) document.title = `${category.name} | Blog VitrineTurbo`;
  }, [category]);

  const loadCategoryData = async () => {
    setLoading(true);
    try {
      const { data: categoryData } = await supabase
        .from('blog_categories')
        .select('*')
        .eq('slug', categorySlug)
        .eq('is_active', true)
        .maybeSingle();

      if (!categoryData) return;
      setCategory(categoryData);

      const { data: postsData } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, view_count, published_at, created_at')
        .eq('category_id', categoryData.id)
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      setPosts(postsData || []);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-xl font-bold mb-3">Categoria não encontrada</h1>
        <Link to="/blog" className="text-sm text-primary hover:underline">← Voltar para o Blog</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
        <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{category.name}</span>
      </nav>

      <div className="mb-10">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft size={13} />
          Todos os artigos
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{category.name}</h1>
        {category.description && <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">{category.description}</p>}
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={36} className="mx-auto text-muted-foreground mb-4 opacity-30" />
          <p className="text-muted-foreground text-sm">Nenhum artigo publicado nesta categoria ainda.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {posts.map(post => (
            <Link
              key={post.id}
              to={`/blog/${post.slug}`}
              className="group flex flex-col rounded-lg border border-border overflow-hidden hover:border-primary/30 hover:bg-muted/30 transition-all"
            >
              {post.cover_image_url && (
                <img src={post.cover_image_url} alt={post.title} className="w-full aspect-video object-cover" />
              )}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-sm font-medium group-hover:text-primary transition-colors leading-snug mb-1.5">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">{post.excerpt}</p>
                )}
                <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
                  {post.view_count > 0 && (
                    <span className="inline-flex items-center gap-1"><Eye size={11} />{post.view_count}</span>
                  )}
                  <ArrowRight size={13} className="ml-auto text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
