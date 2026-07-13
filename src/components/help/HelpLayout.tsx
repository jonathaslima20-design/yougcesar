import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ChevronDown, ChevronRight, Menu, X, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { Rocket, Package, ShoppingCart, Gift, ChartBar as BarChart2, CreditCard, Users, Zap, CircleAlert as AlertCircle, FileText, Settings, TrendingUp } from 'lucide-react';

interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  articles: HelpArticleNav[];
}

interface HelpArticleNav {
  id: string;
  title: string;
  slug: string;
}

interface HelpLayoutProps {
  children: React.ReactNode;
  onSearch?: (query: string) => void;
  searchQuery?: string;
}

const iconMap: Record<string, React.ElementType> = {
  Rocket, Package, ShoppingCart, Gift, BarChart2,
  CreditCard, Users, Zap, AlertCircle, FileText,
  Settings, TrendingUp,
};

export function HelpLayout({ children, onSearch, searchQuery = '' }: HelpLayoutProps) {
  const location = useLocation();
  const [navData, setNavData] = useState<HelpCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    loadNavData();
  }, []);

  useEffect(() => {
    // Auto-expand the active category
    const pathParts = location.pathname.split('/');
    const catSlug = pathParts[3]; // /help/category/:catSlug
    if (catSlug) {
      setExpandedCategories(prev => new Set([...prev, catSlug]));
    }
  }, [location.pathname]);

  const loadNavData = async () => {
    const { data: categories } = await supabase
      .from('help_categories')
      .select('id, name, slug, icon')
      .eq('is_active', true)
      .order('display_order');

    if (!categories) return;

    const { data: articles } = await supabase
      .from('help_articles')
      .select('id, title, slug, category_id')
      .eq('is_published', true)
      .order('created_at', { ascending: true });

    const articlesByCategory: Record<string, HelpArticleNav[]> = {};
    (articles || []).forEach(a => {
      if (!articlesByCategory[a.category_id]) articlesByCategory[a.category_id] = [];
      articlesByCategory[a.category_id].push({ id: a.id, title: a.title, slug: a.slug });
    });

    setNavData(categories.map(c => ({ ...c, articles: articlesByCategory[c.id] || [] })));
  };

  const toggleCategory = (slug: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(localSearch);
  };

  const isArticleActive = (catSlug: string, articleSlug: string) => {
    return location.pathname === `/help/category/${catSlug}/${articleSlug}`;
  };

  const isCategoryActive = (catSlug: string) => {
    return location.pathname.startsWith(`/help/category/${catSlug}`);
  };

  const Sidebar = () => (
    <nav className="h-full flex flex-col">
      {/* Logo/Header */}
      <div className="px-4 py-5 border-b border-border">
        <Link to="/help" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <BookOpen size={14} className="text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
            Central de Ajuda
          </span>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-border">
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar artigos..."
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        </form>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 px-1.5">
        {navData.map(category => {
          const Icon = iconMap[category.icon] || FileText;
          const isExpanded = expandedCategories.has(category.slug);
          const isActive = isCategoryActive(category.slug);

          return (
            <div key={category.id} className="mb-0.5">
              <button
                onClick={() => toggleCategory(category.slug)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm transition-colors group ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Icon size={14} className={`flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span className="flex-1 leading-tight">{category.name}</span>
                {isExpanded
                  ? <ChevronDown size={13} className="flex-shrink-0 opacity-60" />
                  : <ChevronRight size={13} className="flex-shrink-0 opacity-60" />
                }
              </button>

              {isExpanded && category.articles.length > 0 && (
                <div className="ml-5 mt-0.5 border-l border-border pl-3 space-y-0.5">
                  {category.articles.map(article => {
                    const active = isArticleActive(category.slug, article.slug);
                    return (
                      <Link
                        key={article.id}
                        to={`/help/category/${category.slug}/${article.slug}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`block px-2 py-1.5 rounded-md text-[13px] leading-snug transition-colors ${
                          active
                            ? 'text-primary font-medium bg-primary/8'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        {article.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <Link
          to="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar ao VitrineTurbo
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 border-r border-border sticky top-0 h-screen overflow-hidden">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-background border-r border-border h-full overflow-hidden flex flex-col z-10">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <Menu size={18} />
          </button>
          <Link to="/help" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <BookOpen size={12} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">Central de Ajuda</span>
          </Link>
        </div>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
