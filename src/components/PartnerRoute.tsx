import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth/simpleAuth';

export default function PartnerRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const isSimpleAuth = isAuthenticated();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isSimpleAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'partner') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
