import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ArrowRight, BookOpen, Rocket, Package, ShoppingCart, Gift, ChartBar as BarChart2, CreditCard, Users, Zap, CircleAlert as AlertCircle, FileText, TrendingUp, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { HelpLayout } from '@/components/help/HelpLayout';

interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  article_count: number;
}

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  view_count: number;
  category?: { name: string; slug: string };
}

const iconMap: Record<string, React.ElementType> = {
  Rocket, Package, ShoppingCart, Gift, BarChart2,
  CreditCard, Users, Zap, AlertCircle, FileText, TrendingUp,
};

export default function HelpCenterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [featuredArticles, setFeaturedArticles] = useState<HelpArticle[]>([]);
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (searchQuery.trim()) performSearch(searchQuery);
    else setSearchResults([]);
  }, [searchQuery]);

  const loadData = async () => {
    try {
      const [catRes, featRes] = await Promise.all([
        supabase
          .from('help_categories')
          .select('*, help_articles(id)')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('help_articles')
          .select('id, title, slug, excerpt, view_count, category:help_categories(name, slug)')
          .eq('is_published', true)
          .eq('is_featured', true)
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      setCategories(
        (catRes.data || []).map(c => ({ ...c, article_count: c.help_articles?.length || 0 }))
      );
      setFeaturedArticles(featRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('help_articles')
        .select('id, title, slug, excerpt, view_count, category:help_categories(name, slug)')
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
    if (q.trim()) navigate(`/help?q=${encodeURIComponent(q)}`, { replace: true });
    else navigate('/help', { replace: true });
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

  const showSearch = searchQuery.trim().length > 0;

  return (
    <HelpLayout onSearch={handleSearch} searchQuery={searchQuery}>
      <div className="max-w-4xl mx-auto px-6 py-10">
        {showSearch ? (
          /* ── Search Results ── */
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-semibold">
                {searching ? 'Buscando...' : `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''} para "${searchQuery}"`}
              </h1>
              <button
                onClick={() => handleSearch('')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar busca
              </button>
            </div>

            {searching && (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              </div>
            )}

            {!searching && searchResults.length === 0 && (
              <div className="text-center py-16">
                <Search size={40} className="mx-auto text-muted-foreground mb-4 opacity-40" />
                <h2 className="text-lg font-medium mb-2">Nenhum artigo encontrado</h2>
                <p className="text-muted-foreground text-sm">
                  Tente palavras diferentes ou navegue pelas categorias no menu lateral.
                </p>
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map(article => (
                  <Link
                    key={article.id}
                    to={`/help/category/${article.category?.slug}/${article.slug}`}
                    className="block p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/40 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {article.category && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {article.category.name}
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium text-sm group-hover:text-primary transition-colors leading-snug">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {article.excerpt}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={14} className="flex-shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Home ── */
          <div className="space-y-12">
            {/* Hero */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <BookOpen size={16} className="text-primary-foreground" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">VitrineTurbo</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3">Central de Ajuda</h1>
              <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
                Tudo que você precisa para criar, gerenciar e crescer sua vitrine digital.
                Use o menu lateral para navegar ou a busca para encontrar um tópico específico.
              </p>

              {/* Inline search for mobile / quick access */}
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
            </div>

            {/* Categories grid */}
            <section>
              <h2 className="text-base font-semibold mb-4 text-foreground">Navegar por categoria</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.map(category => {
                  const Icon = iconMap[category.icon] || FileText;
                  return (
                    <Link
                      key={category.id}
                      to={`/help/category/${category.slug}`}
                      className="group flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-all"
                    >
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors mt-0.5">
                        <Icon size={15} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm group-hover:text-primary transition-colors leading-tight">
                            {category.name}
                          </span>
                          <ArrowRight size={13} className="flex-shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {category.description}
                        </p>
                        <span className="text-[11px] text-muted-foreground mt-1.5 block">
                          {category.article_count} {category.article_count === 1 ? 'artigo' : 'artigos'}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Featured articles */}
            {featuredArticles.length > 0 && (
              <section>
                <h2 className="text-base font-semibold mb-4 text-foreground">Artigos essenciais</h2>
                <div className="space-y-1.5">
                  {featuredArticles.map(article => (
                    <Link
                      key={article.id}
                      to={`/help/category/${article.category?.slug}/${article.slug}`}
                      className="group flex items-center justify-between gap-3 px-4 py-3 rounded-lg hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium group-hover:text-primary transition-colors leading-snug block truncate">
                            {article.title}
                          </span>
                          {article.category && (
                            <span className="text-[11px] text-muted-foreground">{article.category.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {article.view_count > 0 && (
                          <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Eye size={11} />
                            {article.view_count}
                          </span>
                        )}
                        <ArrowRight size={13} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Quick start section */}
            <section className="rounded-xl border border-border bg-muted/20 p-6">
              <h2 className="text-base font-semibold mb-1">Começando do zero?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Siga nossa trilha de primeiros passos e configure sua vitrine em menos de 30 minutos.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/help/category/primeiros-passos/criando-sua-conta"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Rocket size={13} />
                  Criar minha conta
                </Link>
                <Link
                  to="/help/category/primeiros-passos/configurando-perfil-loja"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  Configurar o perfil
                </Link>
                <Link
                  to="/help/category/primeiros-passos/publicando-primeiros-produtos"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  Publicar produtos
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </HelpLayout>
  );
}
