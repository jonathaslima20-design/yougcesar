interface EletronicosBreadcrumbProps {
  category: string | null;
  searchQuery: string | null;
  onReset: () => void;
}

/**
 * Shown instead of the home-only marketing blocks (banners, benefícios, vitrine
 * de categorias, mini banners, novidades) once any filter narrows the catalog —
 * matches how a dedicated category page looks on the reference theme, without
 * actually needing a separate route: "Home" just clears the active filters.
 */
export default function EletronicosBreadcrumb({ category, searchQuery, onReset }: EletronicosBreadcrumbProps) {
  const current = searchQuery ? `Resultados para "${searchQuery}"` : category || 'Produtos filtrados';

  return (
    <div className="border-b bg-background">
      <div className="container mx-auto px-4 py-3">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <button type="button" onClick={onReset} className="hover:text-foreground hover:underline">
            Home
          </button>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{current}</span>
        </nav>
      </div>
    </div>
  );
}
