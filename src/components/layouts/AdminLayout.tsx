import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function AdminLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <AdminSidebar
        mobileOpen={mobileMenuOpen}
        onMobileToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      <div className="flex-1 flex flex-col">
        <AdminHeader />
        <motion.main
          className="flex-1 w-full"
          key={location.pathname}
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
