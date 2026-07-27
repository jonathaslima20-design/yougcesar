import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import ProductCategoriesManager from '@/components/dashboard/ProductCategoriesManager';

export default function CategoriesPage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl page-title">Categorias</h1>
        <p className="text-muted-foreground">Organize seus produtos em categorias</p>
      </div>

      <Link
        to="/dashboard/settings?tab=storefront&subtab=organization"
        className="flex items-center justify-between gap-3 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors max-w-2xl"
      >
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm">
            Quer reordenar ou ocultar categorias na vitrine? Acesse{' '}
            <span className="font-medium">Configurações → Vitrine → Organização</span>
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>

      <ProductCategoriesManager />
    </div>
  );
}
