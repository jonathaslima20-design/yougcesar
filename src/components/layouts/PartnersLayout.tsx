import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import PartnersSidebar from '@/components/partners/PartnersSidebar';
import PartnersHeader from '@/components/partners/PartnersHeader';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function PartnersLayout() {
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
      <PartnersSidebar
        mobileOpen={mobileMenuOpen}
        onMobileToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <PartnersHeader />
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
