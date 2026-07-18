import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ArrowRight, Eye, FileText, Newspaper } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  post_count: number;
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
  category?: { name: string; slug: string } | null;
}

export default function BlogPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [featured, setFeatured] = useState<BlogPost | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchResults, setSearchResults] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Blog | VitrineTurbo — Catálogo digital, WhatsApp e vendas online';
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) performSearch(searchQuery);
    else setSearchResults([]);
  }, [searchQuery]);

  const loadData = async () => {
    try {
      const [catRes, postsRes] = await Promise.all([
        supabase
          .from('blog_categories')
          .select('*, blog_posts(id)')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, cover_image_url, view_count, published_at, created_at, is_featured, category:blog_categories(name, slug)')
          .eq('is_published', true)
          .order('published_at', { ascending: false }),
      ]);

      setCategories((catRes.data || []).map((c: any) => ({ ...c, post_count: c.blog_posts?.length || 0 })));

      const allPosts = (postsRes.data || []) as (BlogPost & { is_featured: boolean })[];
      const featuredPost = allPosts.find(p => p.is_featured) || allPosts[0] || null;
      setFeatured(featuredPost);
      setPosts(featuredPost ? allPosts.filter(p => p.id !== featuredPost.id) : allPosts);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, view_count, published_at, created_at, category:blog_categories(name, slug)')
        .eq('is_published', true)
        .ilike('title', `%${q}%`)
        .order('view_count', { ascending: false })
        .limit(20);
      setSearchResults(data || []);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.trim()) navigate(`/blog?q=${encodeURIComponent(q)}`, { replace: true });
    else navigate('/blog', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const showSearch = searchQuery.trim().length > 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Newspaper size={16} className="text-primary-foreground" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">VitrineTurbo</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Blog</h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
          Guias práticos sobre catálogo digital, vendas pelo WhatsApp e gestão de loja pequena.
        </p>

        <div className="mt-5 relative max-w-lg">
          <Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar artigos..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-border bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all placeholder:text-muted-foreground"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {categories.map(c => (
              <Link
                key={c.id}
                to={`/blog/categoria/${c.slug}`}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                {c.name} <span className="opacity-60">({c.post_count})</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showSearch ? (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">
              {searching ? 'Buscando...' : `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''} para "${searchQuery}"`}
            </h2>
            <button onClick={() => handleSearch('')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Limpar busca
            </button>
          </div>

          {!searching && searchResults.length === 0 && (
            <div className="text-center py-16">
              <Search size={40} className="mx-auto text-muted-foreground mb-4 opacity-40" />
              <p className="text-muted-foreground text-sm">Nenhum artigo encontrado. Tente outra palavra-chave.</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {searchResults.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        </div>
      ) : (
        <>
          {featured && (
            <Link
              to={`/blog/${featured.slug}`}
              className="group grid md:grid-cols-2 gap-6 rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-all mb-10"
            >
              {featured.cover_image_url ? (
                <img src={featured.cover_image_url} alt={featured.title} className="w-full h-full min-h-[220px] object-cover" />
              ) : (
                <div className="w-full min-h-[220px] bg-muted flex items-center justify-center">
                  <FileText size={32} className="text-muted-foreground opacity-30" />
                </div>
              )}
              <div className="p-6 flex flex-col justify-center">
                {featured.category && (
                  <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3 w-fit">
                    {featured.category.name}
                  </span>
                )}
                <h2 className="text-xl font-bold tracking-tight leading-tight mb-2 group-hover:text-primary transition-colors">
                  {featured.title}
                </h2>
                {featured.excerpt && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">{featured.excerpt}</p>
                )}
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Ler artigo <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          )}

          {posts.length === 0 && !featured ? (
            <div className="text-center py-16">
              <FileText size={36} className="mx-auto text-muted-foreground mb-4 opacity-30" />
              <p className="text-muted-foreground text-sm">Nenhum artigo publicado ainda. Volte em breve.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map(post => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col rounded-lg border border-border overflow-hidden hover:border-primary/30 hover:bg-muted/30 transition-all"
    >
      {post.cover_image_url ? (
        <img src={post.cover_image_url} alt={post.title} className="w-full aspect-video object-cover" />
      ) : (
        <div className="w-full aspect-video bg-muted flex items-center justify-center">
          <FileText size={24} className="text-muted-foreground opacity-30" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        {post.category && (
          <span className="text-[11px] text-muted-foreground mb-1.5">{post.category.name}</span>
        )}
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
  );
}
