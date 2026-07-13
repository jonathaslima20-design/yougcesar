import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { HelpLayout } from '@/components/help/HelpLayout';
import { Rocket, Package, ShoppingCart, Gift, ChartBar as BarChart2, CreditCard, Users, Zap, CircleAlert as AlertCircle, TrendingUp, Settings } from 'lucide-react';

interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  slug: string;
}

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  view_count: number;
  helpful_count: number;
  created_at: string;
}

const iconMap: Record<string, React.ElementType> = {
  Rocket, Package, ShoppingCart, Gift, BarChart2,
  CreditCard, Users, Zap, AlertCircle, FileText, TrendingUp, Settings,
};

export default function HelpCategoryPage() {
  const { categorySlug } = useParams();
  const [category, setCategory] = useState<HelpCategory | null>(null);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (categorySlug) loadCategoryData();
  }, [categorySlug]);

  const loadCategoryData = async () => {
    try {
      const { data: categoryData } = await supabase
        .from('help_categories')
        .select('*')
        .eq('slug', categorySlug)
        .eq('is_active', true)
        .maybeSingle();

      if (!categoryData) return;
      setCategory(categoryData);

      const { data: articlesData } = await supabase
        .from('help_articles')
        .select('id, title, slug, excerpt, view_count, helpful_count, created_at')
        .eq('category_id', categoryData.id)
        .eq('is_published', true)
        .order('created_at', { ascending: true });

      setArticles(articlesData || []);
    } finally {
      setLoading(false);
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

  if (!category) {
    return (
      <HelpLayout>
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h1 className="text-xl font-bold mb-3">Categoria não encontrada</h1>
          <Link to="/help" className="text-sm text-primary hover:underline">
            ← Voltar para Central de Ajuda
          </Link>
        </div>
      </HelpLayout>
    );
  }

  const Icon = iconMap[category.icon] || FileText;

  return (
    <HelpLayout>
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
          <Link to="/help" className="hover:text-foreground transition-colors">Central de Ajuda</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{category.name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start gap-4 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1.5">{category.name}</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{category.description}</p>
          </div>
        </div>

        {/* Articles list */}
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={36} className="mx-auto text-muted-foreground mb-4 opacity-30" />
            <p className="text-muted-foreground text-sm">Nenhum artigo publicado nesta categoria ainda.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground mb-3">
              {articles.length} {articles.length === 1 ? 'artigo' : 'artigos'}
            </p>
            {articles.map((article, index) => (
              <Link
                key={article.id}
                to={`/help/category/${categorySlug}/${article.slug}`}
                className="group flex items-start justify-between gap-4 px-4 py-3.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-all"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xs text-muted-foreground font-mono flex-shrink-0 mt-0.5 w-5 text-right">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium group-hover:text-primary transition-colors leading-snug mb-1">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {article.excerpt}
                      </p>
                    )}
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  className="flex-shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </HelpLayout>
  );
}
