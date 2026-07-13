import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useSubscriptionModal } from '@/contexts/SubscriptionModalContext';

export default function DashboardLayout() {
  const location = useLocation();
  const { openModal } = useSubscriptionModal();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const handler = () => openModal(false);
    window.addEventListener('open-subscription-modal', handler);
    return () => window.removeEventListener('open-subscription-modal', handler);
  }, [openModal]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
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