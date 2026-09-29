import { Link } from 'react-router-dom';

interface ProductBreadcrumbEletronicosProps {
  homeHref: string;
  category: string | null;
  productTitle: string;
}

export default function ProductBreadcrumbEletronicos({ homeHref, category, productTitle }: ProductBreadcrumbEletronicosProps) {
  return (
    <div className="border-b bg-background">
      <div className="container mx-auto px-4 py-3">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground overflow-hidden">
          {/* `state` marks the destination entry so CorretorPage's restoration flow
              (scroll position + active filters, saved when the shopper left the
              listing for this product) kicks in — without it, "voltar" always
              dropped them back at a blank top-of-page listing. */}
          <Link to={homeHref} state={{ from: 'product-detail' }} className="hover:text-foreground hover:underline shrink-0">
            Home
          </Link>
          {category && (
            <>
              <span className="shrink-0">/</span>
              <Link
                to={`${homeHref}?category=${encodeURIComponent(category)}`}
                state={{ from: 'product-detail' }}
                className="hover:text-foreground hover:underline shrink-0"
              >
                {category}
              </Link>
            </>
          )}
          <span className="shrink-0">/</span>
          <span className="text-foreground font-medium truncate">{productTitle}</span>
        </nav>
      </div>
    </div>
  );
}
