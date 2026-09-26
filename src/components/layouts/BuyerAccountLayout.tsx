import { Link, Outlet } from 'react-router-dom';
import { Loader } from 'lucide-react';
import BuyerAccountSidebar from '@/components/layouts/BuyerAccountSidebar';
import BuyerAccountHeader from '@/components/layouts/BuyerAccountHeader';
import { BuyerStoreProvider, useBuyerStore } from '@/contexts/BuyerStoreContext';

// Shared chrome for every /:slug/conta/* page (Pedidos, detalhe de pedido,
// Endereços, Perfil) — mirrors DashboardLayout's role for the merchant
// dashboard, so the buyer account area gets the same sidebar+header shell
// instead of each page rebuilding its own nav. The area is always scoped to
// the store in the URL (see BuyerStoreContext).
function BuyerAccountShell() {
  const { store, loading, notFound, loadFailed, retry } = useBuyerStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-center px-4">
        <p className="text-muted-foreground">Não foi possível carregar sua conta agora.</p>
        <button onClick={retry} className="text-sm text-primary hover:underline py-2">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-center px-4">
        <p className="text-muted-foreground">Loja não encontrada.</p>
        <Link to="/" className="text-sm text-primary hover:underline">
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <BuyerAccountSidebar />
      <div className="flex-1 flex flex-col">
        <BuyerAccountHeader />
        <main className="flex-1 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function BuyerAccountLayout() {
  return (
    <BuyerStoreProvider>
      <BuyerAccountShell />
    </BuyerStoreProvider>
  );
}
