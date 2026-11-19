import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

// Route pages are lazy-loaded; suspending here keeps the surrounding layout
// (sidebar, header, footer) on screen while the page's chunk downloads.
export default function RouteOutlet() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}
