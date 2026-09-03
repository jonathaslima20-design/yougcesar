import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { BuyerAuthProvider } from '@/contexts/BuyerAuthContext';
import { AffiliateAuthProvider } from '@/contexts/AffiliateAuthContext';
import { AffiliateNotificationProvider } from '@/contexts/AffiliateNotificationContext';
import { BuyerNotificationProvider } from '@/contexts/BuyerNotificationContext';
import { CartProvider } from '@/contexts/CartContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { SubscriptionModalProvider } from '@/contexts/SubscriptionModalContext';
import { CorretorPageStateProvider } from '@/contexts/CorretorPageStateContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { PromotionalOffersProvider } from '@/contexts/PromotionalOffersContext';
import { useCustomDomain } from '@/contexts/CustomDomainContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState, Suspense } from 'react';
import { CircleAlert as AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SessionManager from '@/components/auth/SessionManager';
import MetaPixel from '@/components/MetaPixel';
import GtmSnippet from '@/components/GtmSnippet';
import GoogleAdsSnippet from '@/components/GoogleAdsSnippet';
import FloatingWhatsAppButton from '@/components/FloatingWhatsAppButton';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import { OfferDisplayManager } from '@/components/offers/OfferDisplayManager';
import { captureAttributionParams } from '@/lib/attribution';

// Layouts
import PublicLayout from '@/components/layouts/PublicLayout';
import LocaleLayout from '@/components/layouts/LocaleLayout';
import { LOCALE_PATH_PREFIXES } from '@/i18n/config';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import AdminLayout from '@/components/layouts/AdminLayout';
import BuyerAccountLayout from '@/components/layouts/BuyerAccountLayout';

// Public Pages
import LandingPage from '@/pages/LandingPage.tsx';
import PlansSharePage from '@/pages/PlansSharePage.tsx';
import LoginPage from '@/pages/LoginPage.tsx';
import RegisterPage from '@/pages/RegisterPage.tsx';
import AuthCallbackPage from '@/pages/AuthCallbackPage.tsx';
import CompleteProfilePage from '@/pages/CompleteProfilePage.tsx';
import CorretorPage from '@/pages/CorretorPage.tsx';
import ProductDetailsPage from '@/pages/ProductDetailsPage.tsx';
import HelpCenterPage from '@/pages/HelpCenterPage.tsx';
import HelpCategoryPage from '@/pages/HelpCategoryPage.tsx';
import HelpArticlePage from '@/pages/HelpArticlePage.tsx';
import BlogPage from '@/pages/BlogPage.tsx';
import BlogCategoryPage from '@/pages/BlogCategoryPage.tsx';
import BlogPostPage from '@/pages/BlogPostPage.tsx';
import PillarPage from '@/pages/PillarPage.tsx';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage.tsx';
import CookiesPolicyPage from '@/pages/CookiesPolicyPage.tsx';
import TermsOfUsePage from '@/pages/TermsOfUsePage.tsx';
import DataDeletionPage from '@/pages/DataDeletionPage.tsx';
import ReferralTermsPage from '@/pages/ReferralTermsPage.tsx';
import BuyerLoginPage from '@/pages/buyer/BuyerLoginPage.tsx';
import AffiliateLoginPage from '@/pages/affiliate/AffiliateLoginPage.tsx';
import AffiliateLayout from '@/pages/affiliate/AffiliateLayout.tsx';
import AffiliateDashboardPage from '@/pages/affiliate/AffiliateDashboardPage.tsx';
import AffiliateReportsPage from '@/pages/affiliate/AffiliateReportsPage.tsx';
import AffiliateCatalogPage from '@/pages/affiliate/AffiliateCatalogPage.tsx';
import AffiliateProfilePage from '@/pages/affiliate/AffiliateProfilePage.tsx';
import BuyerRegisterPage from '@/pages/buyer/BuyerRegisterPage.tsx';
import BuyerOrdersPage from '@/pages/buyer/BuyerOrdersPage.tsx';
import BuyerAuthCallbackPage from '@/pages/buyer/BuyerAuthCallbackPage.tsx';
import BuyerProfilePage from '@/pages/buyer/BuyerProfilePage.tsx';
import BuyerAddressesPage from '@/pages/buyer/BuyerAddressesPage.tsx';
import BuyerOrderDetailPage from '@/pages/buyer/BuyerOrderDetailPage.tsx';
import BuyerFavoritesPage from '@/pages/buyer/BuyerFavoritesPage.tsx';
import BuyerCouponsPage from '@/pages/buyer/BuyerCouponsPage.tsx';
import OrderPaymentPage from '@/pages/storefront/OrderPaymentPage.tsx';
import CheckoutAddressPage from '@/pages/storefront/CheckoutAddressPage.tsx';

// Dashboard Pages
import DashboardPage from '@/pages/dashboard/DashboardPage.tsx';
import ReportsPage from '@/pages/dashboard/ReportsPage.tsx';
import SettingsPage from '@/pages/dashboard/SettingsPage.tsx';
import OlistCallbackPage from '@/pages/dashboard/OlistCallbackPage.tsx';
import ListingsPage from '@/pages/dashboard/ListingsPage.tsx';
import CreateProductPage from '@/pages/dashboard/CreateProductPage.tsx';
import EditProductPage from '@/pages/dashboard/EditProductPage.tsx';
import CategoriesPage from '@/pages/dashboard/CategoriesPage.tsx';
import ReferralPage from '@/pages/dashboard/ReferralPage.tsx';
import NotificationsPage from '@/pages/dashboard/NotificationsPage.tsx';
import OrdersPage from '@/pages/dashboard/OrdersPage.tsx';
import StockMovementsPage from '@/pages/dashboard/StockMovementsPage.tsx';
import InventoryOverviewPage from '@/pages/dashboard/InventoryOverviewPage.tsx';
import CheckoutPage from '@/pages/dashboard/CheckoutPage.tsx';
import AccountPage from '@/pages/dashboard/AccountPage.tsx';
import CouponsPage from '@/pages/dashboard/CouponsPage.tsx';
import AffiliatesPage from '@/pages/dashboard/AffiliatesPage.tsx';

// Admin Pages
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage.tsx';
import FinancialPage from '@/pages/admin/FinancialPage.tsx';
import UsersManagementPage from '@/pages/admin/UsersManagementPage.tsx';
import UserDetailPage from '@/pages/admin/UserDetailPage.tsx';
import CreateUserPage from '@/pages/admin/CreateUserPage.tsx';
import AdminSettingsPage from '@/pages/admin/SettingsPage.tsx';
import NetlifyIntegrationPage from '@/pages/admin/NetlifyIntegrationPage.tsx';
import IntegrationProvidersPage from '@/pages/admin/IntegrationProvidersPage.tsx';
import SubscriptionPlansPage from '@/pages/admin/SubscriptionPlansPage.tsx';
import ReferralManagementPage from '@/pages/admin/ReferralManagementPage.tsx';
import PartnerManagementPage from '@/pages/admin/PartnerManagementPage.tsx';
import HelpManagementPage from '@/pages/admin/HelpManagementPage.tsx';
import BlogManagementPage from '@/pages/admin/BlogManagementPage.tsx';
import { OrphanedFilesPage } from '@/pages/admin/OrphanedFilesPage.tsx';
import BannerClientsPage from '@/pages/admin/BannerClientsPage.tsx';
import MercadoPagoPage from '@/pages/admin/MercadoPagoPage.tsx';
import StripePage from '@/pages/admin/StripePage.tsx';
import LegalCenterPage from '@/pages/admin/LegalCenterPage.tsx';
import PrivacyRequestsPage from '@/pages/admin/PrivacyRequestsPage.tsx';
import LandingHeroPage from '@/pages/admin/LandingHeroPage.tsx';
import LandingTestimonialsPage from '@/pages/admin/LandingTestimonialsPage.tsx';
import SystemAppearancePage from '@/pages/admin/SystemAppearancePage.tsx';
import LinkPreviewPage from '@/pages/admin/LinkPreviewPage.tsx';
import OffersManagementPage from '@/pages/admin/OffersManagementPage.tsx';
import OfferEditorPage from '@/pages/admin/OfferEditorPage.tsx';
import OfferAnalyticsPage from '@/pages/admin/OfferAnalyticsPage.tsx';
import NotificationSettingsPage from '@/pages/admin/NotificationSettingsPage.tsx';
import AdminTrackingPage from '@/pages/admin/TrackingPage.tsx';
import AffiliateTeaserMonitoringPage from '@/pages/admin/AffiliateTeaserMonitoringPage.tsx';

// Partners Pages
import PartnersDashboardPage from '@/pages/partners/PartnersDashboardPage.tsx';
import PartnersUsersPage from '@/pages/partners/PartnersUsersPage.tsx';
import PartnersCreateUserPage from '@/pages/partners/PartnersCreateUserPage.tsx';
import PartnersUserDetailPage from '@/pages/partners/PartnersUserDetailPage.tsx';
import PartnersReferralPage from '@/pages/partners/PartnersReferralPage.tsx';
import PartnersCommissionsPage from '@/pages/partners/PartnersCommissionsPage.tsx';
import PartnersHelpPage from '@/pages/partners/PartnersHelpPage.tsx';
import PartnersLoginPage from '@/pages/partners/PartnersLoginPage.tsx';
import PartnersLayout from '@/components/layouts/PartnersLayout';

// Route Guards
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoute from '@/components/AdminRoute';
import PartnerRoute from '@/components/PartnerRoute';

import { usePageSEO } from '@/hooks/usePageSEO';

// The 5 public-funnel pages, mounted twice under AppContent's <Routes> (once under
// /:lang for es/en/pt, once unprefixed for pt-BR) so the URLs share the same page
// components without duplicating JSX. See src/components/layouts/LocaleLayout.tsx.
function funnelRoutes() {
  return (
    <>
      <Route index element={<LandingPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="planos" element={<PlansSharePage />} />
      <Route path="completar-cadastro" element={<CompleteProfilePage />} />
    </>
  );
}

function AppContent() {
  const { isLoaded } = useTheme();
  const { isCustomDomain, slug: customDomainSlug, loading: customDomainLoading } = useCustomDomain();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  usePageSEO();

  // Capture ad/campaign attribution params (utm_*, gclid, fbclid) as soon as the app loads,
  // so they're available at signup time regardless of which page the user landed on.
  useEffect(() => {
    captureAttributionParams(window.location.search);
  }, []);

  // Error boundary effect
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      
      if (event.error?.message?.includes('Supabase') || 
          event.error?.message?.includes('VITE_SUPABASE')) {
        setHasError(true);
        setErrorMessage(event.error.message);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      if (event.reason?.message?.includes('Supabase') || 
          event.reason?.message?.includes('VITE_SUPABASE')) {
        setHasError(true);
        setErrorMessage(event.reason.message);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Erro de Configuração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-line">
                {errorMessage}
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2 text-sm">
              <p><strong>Ambiente:</strong> {import.meta.env.MODE}</p>
              <p><strong>Variáveis encontradas:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                {Object.keys(import.meta.env)
                  .filter(key => key.startsWith('VITE_'))
                  .map(key => (
                    <li key={key}>
                      {key}: {import.meta.env[key] ? '✅ Configurada' : '❌ Não encontrada'}
                    </li>
                  ))}
              </ul>
            </div>
            
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (customDomainLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <SessionManager />
      <MetaPixel />
      <GtmSnippet />
      <GoogleAdsSnippet />
      <Routes>
        {/* Custom Domain Routes - when accessed via user's own domain */}
        {isCustomDomain && customDomainSlug && (
          <Route element={<PublicLayout />}>
            <Route path="/" element={<CorretorPage customDomainSlug={customDomainSlug} />} />
            <Route path="/produtos/:productId" element={<ProductDetailsPage customDomainSlug={customDomainSlug} />} />
          </Route>
        )}

        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          {/* Public funnel (landing/login/register/planos/completar-cadastro), localized:
              /es, /en, /pt prefixes plus the unprefixed default (pt-BR). Never shown on
              a merchant's custom domain — that's a different product surface. */}
          {!isCustomDomain && (
            <>
              {LOCALE_PATH_PREFIXES.map((prefix) => (
                <Route key={prefix} path={`/${prefix}`} element={<LocaleLayout lang={prefix} />}>
                  {funnelRoutes()}
                </Route>
              ))}
              <Route element={<LocaleLayout />}>{funnelRoutes()}</Route>
            </>
          )}
          <Route path="/partners/login" element={<PartnersLoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Buyer Account Routes (customer login, separate from merchant auth) */}
          <Route path="/conta/entrar" element={<BuyerLoginPage />} />
          <Route path="/conta/cadastro" element={<BuyerRegisterPage />} />
          <Route path="/conta/auth/callback" element={<BuyerAuthCallbackPage />} />
          <Route element={<BuyerAccountLayout />}>
            <Route path="/conta/pedidos" element={<BuyerOrdersPage />} />
            <Route path="/conta/pedidos/:orderId" element={<BuyerOrderDetailPage />} />
            <Route path="/conta/favoritos" element={<BuyerFavoritesPage />} />
            <Route path="/conta/cupons" element={<BuyerCouponsPage />} />
            <Route path="/conta/enderecos" element={<BuyerAddressesPage />} />
            <Route path="/conta/perfil" element={<BuyerProfilePage />} />
          </Route>

          {/* Affiliate login (separate from merchant and buyer auth) */}
          <Route path="/afiliado/entrar" element={<AffiliateLoginPage />} />

          {/* Blog Routes */}
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/categoria/:categorySlug" element={<BlogCategoryPage />} />
          <Route path="/blog/:postSlug" element={<BlogPostPage />} />

          {/* Pillar SEO Landing Pages */}
          <Route path="/catalogo-digital-gratis" element={<PillarPage slug="catalogo-digital-gratis" />} />
          <Route path="/catalogo-para-whatsapp" element={<PillarPage slug="catalogo-para-whatsapp" />} />
          <Route path="/loja-virtual-sem-taxa" element={<PillarPage slug="loja-virtual-sem-taxa" />} />
          <Route path="/dominio-proprio" element={<PillarPage slug="dominio-proprio" />} />

          {/* Help Center Routes */}
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/help/category/:categorySlug" element={<HelpCategoryPage />} />
          <Route path="/help/category/:categorySlug/:articleSlug" element={<HelpArticlePage />} />

          {/* Legal Pages */}
          <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
          <Route path="/politica-de-cookies" element={<CookiesPolicyPage />} />
          <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
          <Route path="/termos-indicacoes" element={<ReferralTermsPage />} />
          <Route path="/excluir-minha-conta" element={<DataDeletionPage />} />
        </Route>

        {/* Affiliate Panel Routes (own sidebar layout, own auth guard via AffiliateLayout) */}
        <Route element={<AffiliateLayout />}>
          <Route path="/afiliado/painel" element={<AffiliateDashboardPage />} />
          <Route path="/afiliado/relatorios" element={<AffiliateReportsPage />} />
          <Route path="/afiliado/catalogo" element={<AffiliateCatalogPage />} />
          <Route path="/afiliado/perfil" element={<AffiliateProfilePage />} />
        </Route>

        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard/settings/integrations/olist/callback" element={<OlistCallbackPage />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/reports" element={<ReportsPage />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route path="/dashboard/listings" element={<ListingsPage />} />
            <Route path="/dashboard/products/new" element={<CreateProductPage />} />
            <Route path="/dashboard/products/:id/edit" element={<EditProductPage />} />
            <Route path="/dashboard/categories" element={<CategoriesPage />} />
            <Route path="/dashboard/referral" element={<ReferralPage />} />
            <Route path="/dashboard/orders" element={<OrdersPage />} />
            <Route path="/dashboard/coupons" element={<CouponsPage />} />
            <Route path="/dashboard/affiliates" element={<AffiliatesPage />} />
            <Route path="/dashboard/sales" element={<Navigate to="/dashboard/orders" replace />} />
            <Route path="/dashboard/inventory" element={<InventoryOverviewPage />} />
            <Route path="/dashboard/inventory/settings" element={<Navigate to="/dashboard/settings?tab=inventory" replace />} />
            <Route path="/dashboard/stock-movements" element={<StockMovementsPage />} />
            <Route path="/dashboard/checkout" element={<CheckoutPage />} />
            <Route path="/dashboard/account" element={<AccountPage />} />
            <Route path="/dashboard/notifications" element={<NotificationsPage />} />
            <Route path="/dashboard/integrations" element={<Navigate to="/dashboard/settings?tab=integrations" replace />} />
          </Route>
        </Route>

        {/* Protected Admin Routes */}
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/plans" element={<SubscriptionPlansPage />} />
            <Route path="/admin/users" element={<UsersManagementPage />} />
            <Route path="/admin/users/new" element={<CreateUserPage />} />
            <Route path="/admin/users/:userId" element={<UserDetailPage />} />
            <Route path="/admin/referrals" element={<ReferralManagementPage />} />
            <Route path="/admin/partners" element={<PartnerManagementPage />} />
            <Route path="/admin/orphaned-files" element={<OrphanedFilesPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/notifications" element={<NotificationSettingsPage />} />
            <Route path="/admin/tracking" element={<AdminTrackingPage />} />
            <Route path="/admin/monitoring" element={<AffiliateTeaserMonitoringPage />} />
            <Route path="/admin/netlify" element={<NetlifyIntegrationPage />} />
            <Route path="/admin/integrations" element={<IntegrationProvidersPage />} />
            <Route path="/admin/help" element={<HelpManagementPage />} />
            <Route path="/admin/blog" element={<BlogManagementPage />} />
            <Route path="/admin/mercadopago" element={<MercadoPagoPage />} />
            <Route path="/admin/stripe" element={<StripePage />} />
            <Route path="/admin/banner-clients" element={<BannerClientsPage />} />
            <Route path="/admin/legal" element={<LegalCenterPage />} />
            <Route path="/admin/privacy-requests" element={<PrivacyRequestsPage />} />
            <Route path="/admin/landing-hero" element={<LandingHeroPage />} />
            <Route path="/admin/landing-testimonials" element={<LandingTestimonialsPage />} />
            <Route path="/admin/system-appearance" element={<SystemAppearancePage />} />
            <Route path="/admin/link-previews" element={<LinkPreviewPage />} />
            <Route path="/admin/offers" element={<OffersManagementPage />} />
            <Route path="/admin/offers/new" element={<OfferEditorPage />} />
            <Route path="/admin/offers/:offerId" element={<OfferEditorPage />} />
            <Route path="/admin/offers/:offerId/analytics" element={<OfferAnalyticsPage />} />
          </Route>
        </Route>

        {/* Protected Partners Routes (VitrineTurbo Partners) */}
        <Route element={<PartnerRoute />}>
          <Route element={<PartnersLayout />}>
            <Route path="/partners" element={<PartnersDashboardPage />} />
            <Route path="/partners/users" element={<PartnersUsersPage />} />
            <Route path="/partners/users/new" element={<PartnersCreateUserPage />} />
            <Route path="/partners/users/:id" element={<PartnersUserDetailPage />} />
            <Route path="/partners/referral" element={<PartnersReferralPage />} />
            <Route path="/partners/commissions" element={<PartnersCommissionsPage />} />
            <Route path="/partners/help" element={<PartnersHelpPage />} />
          </Route>
        </Route>

        {/* Corretor Public Profile Routes - MUST be last to avoid catching /admin, /dashboard, etc. */}
        <Route element={<PublicLayout />}>
          <Route path="/:slug" element={<CorretorPage />} />
          {/* Affiliate storefront link: /{storeSlug}/{affiliateSlug} (e.g. /sneakerhouse/taina) —
              same CorretorPage, attribution resolved from the 2nd path segment instead of ?aff=. */}
          <Route path="/:slug/:affiliateSlug" element={<CorretorPage />} />
          <Route path="/:slug/produtos/:productId" element={<ProductDetailsPage />} />
          <Route path="/:slug/pedido/endereco" element={<CheckoutAddressPage />} />
          <Route path="/:slug/pedido/:orderId/pagamento" element={<OrderPaymentPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <BuyerAuthProvider>
            <AffiliateAuthProvider>
              <AffiliateNotificationProvider>
                <BuyerNotificationProvider>
                  <NotificationProvider>
                    <SubscriptionModalProvider>
                      <PromotionalOffersProvider>
                        <CartProvider>
                          <FavoritesProvider>
                            <CorretorPageStateProvider>
                              <AppContent />
                              <OfferDisplayManager />
                              <Toaster />
                              <FloatingWhatsAppButton />
                              <CookieConsentBanner />
                            </CorretorPageStateProvider>
                          </FavoritesProvider>
                        </CartProvider>
                      </PromotionalOffersProvider>
                    </SubscriptionModalProvider>
                  </NotificationProvider>
                </BuyerNotificationProvider>
              </AffiliateNotificationProvider>
            </AffiliateAuthProvider>
          </BuyerAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}