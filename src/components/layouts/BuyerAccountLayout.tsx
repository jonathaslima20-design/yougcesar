import { Outlet } from 'react-router-dom';
import BuyerAccountSidebar from '@/components/layouts/BuyerAccountSidebar';
import BuyerAccountHeader from '@/components/layouts/BuyerAccountHeader';

// Shared chrome for every /conta/* page (Pedidos, detalhe de pedido,
// Endereços, Perfil) — mirrors DashboardLayout's role for the merchant
// dashboard, so the buyer account area gets the same sidebar+header shell
// instead of each page rebuilding its own nav.
export default function BuyerAccountLayout() {
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
