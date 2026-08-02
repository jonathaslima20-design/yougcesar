import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Loader } from 'lucide-react';
import AffiliateSidebar from '@/components/affiliate/AffiliateSidebar';
import { useAffiliateAuth } from '@/contexts/AffiliateAuthContext';

export default function AffiliateLayout() {
  const location = useLocation();
  const { affiliate, loading } = useAffiliateAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!affiliate) {
    return <Navigate to="/afiliado/entrar" state={{ from: location.pathname }} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <AffiliateSidebar />
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
