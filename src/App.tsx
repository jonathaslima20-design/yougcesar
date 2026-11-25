import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { BuyerAuthProvider } from '@/contexts/BuyerAuthContext';
import { AffiliateAuthProvider } from '@/contexts/AffiliateAuthContext';
import { AffiliateNotificationProvider } from '@/contexts/AffiliateNotificationContext';
import { BuyerNotificationProvider } from '@/contexts/BuyerNotificationContext';
import { CartProvider } from '@/contexts/CartContext';
import { SubscriptionModalProvider } from '@/contexts/SubscriptionModalContext';
import { CorretorPageStateProvider } from '@/contexts/CorretorPageStateContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { PromotionalOffersProvider } from '@/contexts/PromotionalOffersContext';
import { useCustomDomain } from '@/contexts/CustomDomainContext';
import { useTheme } from '@/contexts/ThemeContext';
import { lazy, useEffect, useState, Suspense } from 'react';
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
// Paused along with the escape attempt in main.tsx — see the note there.
// import { InAppBrowserEscapeButton } from '@/components/InAppBrowserEscapeButton';
import { OfferDisplayManager } from '@/components/offers/OfferDisplayManager';
import { captureAttributionParams } from '@/lib/attribution';

// Storefront pages, PublicLayout and LocaleLayout stay in the entry chunk: storefronts
// are where most visitors land. Everything else is split per route so a buyer opening a
// store doesn't download the merchant dashboard and admin (Netlify bills bandwidth).

// Layouts
import PublicLayout from '@/components/layouts/PublicLayout';
import LocaleLayout from '@/components/layouts/LocaleLayout';
import { LOCALE_PATH_PREFIXES } from '@/i18n/config';
const DashboardLayout = lazy(() => import('@/components/layouts/DashboardLayout'));
const AdminLayout = lazy(() => import('@/components/layouts/AdminLayout'));
const BuyerAccountLayout = lazy(() => import('@/components/layouts/BuyerAccountLayout'));

// Storefront Pages
import CorretorPage from '@/pages/CorretorPage.tsx';
import ProductDetailsPage from '@/pages/ProductDetailsPage.tsx';

// Public Pages
const LandingPage = lazy(() => import('@/pages/LandingPage.tsx'));
const PlansSharePage = lazy(() => import('@/pages/PlansSharePage.tsx'));
const LoginPage = lazy(() => import('@/pages/LoginPage.tsx'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage.tsx'));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage.tsx'));
const CompleteProfilePage = lazy(() => import('@/pages/CompleteProfilePage.tsx'));
const HelpCenterPage = lazy(() => import('@/pages/HelpCenterPage.tsx'));
const HelpCategoryPage = lazy(() => import('@/pages/HelpCategoryPage.tsx'));
const HelpArticlePage = lazy(() => import('@/pages/HelpArticlePage.tsx'));
const BlogPage = lazy(() => import('@/pages/BlogPage.tsx'));
const BlogCategoryPage = lazy(() => import('@/pages/BlogCategoryPage.tsx'));
const BlogPostPage = lazy(() => import('@/pages/BlogPostPage.tsx'));
const PillarPage = lazy(() => import('@/pages/PillarPage.tsx'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage.tsx'));
const CookiesPolicyPage = lazy(() => import('@/pages/CookiesPolicyPage.tsx'));
const TermsOfUsePage = lazy(() => import('@/pages/TermsOfUsePage.tsx'));
const DataDeletionPage = lazy(() => import('@/pages/DataDeletionPage.tsx'));
const ReferralTermsPage = lazy(() => import('@/pages/ReferralTermsPage.tsx'));
const BuyerLoginPage = lazy(() => import('@/pages/buyer/BuyerLoginPage.tsx'));
const AffiliateLoginPage = lazy(() => import('@/pages/affiliate/AffiliateLoginPage.tsx'));
const AffiliateLayout = lazy(() => import('@/pages/affiliate/AffiliateLayout.tsx'));
const AffiliateDashboardPage = lazy(() => import('@/pages/affiliate/AffiliateDashboardPage.tsx'));
const AffiliateReportsPage = lazy(() => import('@/pages/affiliate/AffiliateReportsPage.tsx'));
const AffiliateCatalogPage = lazy(() => import('@/pages/affiliate/AffiliateCatalogPage.tsx'));
const AffiliateProfilePage = lazy(() => import('@/pages/affiliate/AffiliateProfilePage.tsx'));
const BuyerRegisterPage = lazy(() => import('@/pages/buyer/BuyerRegisterPage.tsx'));
const LegacyContaRedirect = lazy(() => import('@/pages/buyer/LegacyContaRedirect'));
const BuyerOverviewPage = lazy(() => import('@/pages/buyer/BuyerOverviewPage.tsx'));
const BuyerOrdersPage = lazy(() => import('@/pages/buyer/BuyerOrdersPage.tsx'));
const BuyerAuthCallbackPage = lazy(() => import('@/pages/buyer/BuyerAuthCallbackPage.tsx'));
const BuyerProfilePage = lazy(() => import('@/pages/buyer/BuyerProfilePage.tsx'));
const BuyerAddressesPage = lazy(() => import('@/pages/buyer/BuyerAddressesPage.tsx'));
const BuyerOrderDetailPage = lazy(() => import('@/pages/buyer/BuyerOrderDetailPage.tsx'));
const BuyerCartPage = lazy(() => import('@/pages/buyer/BuyerCartPage.tsx'));
const OrderPaymentPage = lazy(() => import('@/pages/storefront/OrderPaymentPage.tsx'));
const CheckoutAddressPage = lazy(() => import('@/pages/storefront/CheckoutAddressPage.tsx'));

// Dashboard Pages
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage.tsx'));
const ReportsPage = lazy(() => import('@/pages/dashboard/ReportsPage.tsx'));
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage.tsx'));
const OlistCallbackPage = lazy(() => import('@/pages/dashboard/OlistCallbackPage.tsx'));
const MercadoPagoConnectCallbackPage = lazy(() => import('@/pages/dashboard/MercadoPagoConnectCallbackPage.tsx'));
const ListingsPage = lazy(() => import('@/pages/dashboard/ListingsPage.tsx'));
const CreateProductPage = lazy(() => import('@/pages/dashboard/CreateProductPage.tsx'));
const EditProductPage = lazy(() => import('@/pages/dashboard/EditProductPage.tsx'));
const CategoriesPage = lazy(() => import('@/pages/dashboard/CategoriesPage.tsx'));
const ReferralPage = lazy(() => import('@/pages/dashboard/ReferralPage.tsx'));
const NotificationsPage = lazy(() => import('@/pages/dashboard/NotificationsPage.tsx'));
const OrdersPage = lazy(() => import('@/pages/dashboard/OrdersPage.tsx'));
const OrderPrintPage = lazy(() => import('@/pages/dashboard/OrderPrintPage.tsx'));
const OrderListPrintPage = lazy(() => import('@/pages/dashboard/OrderListPrintPage.tsx'));
const StockMovementsPage = lazy(() => import('@/pages/dashboard/StockMovementsPage.tsx'));
const InventoryOverviewPage = lazy(() => import('@/pages/dashboard/InventoryOverviewPage.tsx'));
const CheckoutPage = lazy(() => import('@/pages/dashboard/CheckoutPage.tsx'));
const AccountPage = lazy(() => import('@/pages/dashboard/AccountPage.tsx'));
const CouponsPage = lazy(() => import('@/pages/dashboard/CouponsPage.tsx'));
const AffiliatesPage = lazy(() => import('@/pages/dashboard/AffiliatesPage.tsx'));

// Admin Pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage.tsx'));
const UsersManagementPage = lazy(() => import('@/pages/admin/UsersManagementPage.tsx'));
const UserDetailPage = lazy(() => import('@/pages/admin/UserDetailPage.tsx'));
const CreateUserPage = lazy(() => import('@/pages/admin/CreateUserPage.tsx'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/SettingsPage.tsx'));
const NetlifyIntegrationPage = lazy(() => import('@/pages/admin/NetlifyIntegrationPage.tsx'));
const IntegrationProvidersPage = lazy(() => import('@/pages/admin/IntegrationProvidersPage.tsx'));
const SubscriptionPlansPage = lazy(() => import('@/pages/admin/SubscriptionPlansPage.tsx'));
const ReferralManagementPage = lazy(() => import('@/pages/admin/ReferralManagementPage.tsx'));
const PartnerManagementPage = lazy(() => import('@/pages/admin/PartnerManagementPage.tsx'));
const HelpManagementPage = lazy(() => import('@/pages/admin/HelpManagementPage.tsx'));
const BlogManagementPage = lazy(() => import('@/pages/admin/BlogManagementPage.tsx'));
const OrphanedFilesPage = lazy(() => import('@/pages/admin/OrphanedFilesPage.tsx').then((m) => ({ default: m.OrphanedFilesPage })));
const BannerClientsPage = lazy(() => import('@/pages/admin/BannerClientsPage.tsx'));
const MercadoPagoPage = lazy(() => import('@/pages/admin/MercadoPagoPage.tsx'));
const MercadoPagoMarketplacePage = lazy(() => import('@/pages/admin/MercadoPagoMarketplacePage.tsx'));
const OnlineSalesPage = lazy(() => import('@/pages/admin/OnlineSalesPage.tsx'));
const LegalCenterPage = lazy(() => import('@/pages/admin/LegalCenterPage.tsx'));
const PrivacyRequestsPage = lazy(() => import('@/pages/admin/PrivacyRequestsPage.tsx'));
const LandingHeroPage = lazy(() => import('@/pages/admin/LandingHeroPage.tsx'));
const LandingTestimonialsPage = lazy(() => import('@/pages/admin/LandingTestimonialsPage.tsx'));
const SystemAppearancePage = lazy(() => import('@/pages/admin/SystemAppearancePage.tsx'));
const LinkPreviewPage = lazy(() => import('@/pages/admin/LinkPreviewPage.tsx'));
const OffersManagementPage = lazy(() => import('@/pages/admin/OffersManagementPage.tsx'));
const OfferEditorPage = lazy(() => import('@/pages/admin/OfferEditorPage.tsx'));
const OfferAnalyticsPage = lazy(() => import('@/pages/admin/OfferAnalyticsPage.tsx'));
const StorefrontThemesPage = lazy(() => import('@/pages/admin/StorefrontThemesPage.tsx'));
const SignupDiscountPage = lazy(() => import('@/pages/admin/SignupDiscountPage.tsx'));
const LandingCampaignsPage = lazy(() => import('@/pages/admin/LandingCampaignsPage.tsx'));
const NotificationSettingsPage = lazy(() => import('@/pages/admin/NotificationSettingsPage.tsx'));
const AdminTrackingPage = lazy(() => import('@/pages/admin/TrackingPage.tsx'));
const AffiliateTeaserMonitoringPage = lazy(() => import('@/pages/admin/AffiliateTeaserMonitoringPage.tsx'));
const LiveChatInboxPage = lazy(() => import('@/pages/admin/liveChat/LiveChatInboxPage.tsx'));
const LiveVisitorsPage = lazy(() => import('@/pages/admin/liveChat/LiveVisitorsPage.tsx'));
const LiveChatOperatorsPage = lazy(() => import('@/pages/admin/liveChat/LiveChatOperatorsPage.tsx'));
const LiveChatSettingsPage = lazy(() => import('@/pages/admin/liveChat/LiveChatSettingsPage.tsx'));
const LiveChatMetricsPage = lazy(() => import('@/pages/admin/liveChat/LiveChatMetricsPage.tsx'));
const LandingVisitsPage = lazy(() => import('@/pages/admin/liveChat/LandingVisitsPage.tsx'));

// Partners Pages
const PartnersLoginPage = lazy(() => import('@/pages/partners/PartnersLoginPage.tsx'));
const PartnersLayout = lazy(() => import('@/components/layouts/PartnersLayout'));
import PartnerAttributionTracker from '@/components/partners/PartnerAttributionTracker';
const PartnersDashboardPage = lazy(() => import('@/pages/partners/PartnersDashboardPage.tsx'));
const PartnersClientsPage = lazy(() => import('@/pages/partners/PartnersClientsPage.tsx'));
const PartnersClientDetailPage = lazy(() => import('@/pages/partners/PartnersClientDetailPage.tsx'));
const PartnersNewStorePage = lazy(() => import('@/pages/partners/PartnersNewStorePage.tsx'));
const PartnersLeadsPage = lazy(() => import('@/pages/partners/PartnersLeadsPage.tsx'));
const PartnersLinksPage = lazy(() => import('@/pages/partners/PartnersLinksPage.tsx'));
const PartnersPerformancePage = lazy(() => import('@/pages/partners/PartnersPerformancePage.tsx'));
const PartnersFinancePage = lazy(() => import('@/pages/partners/PartnersFinancePage.tsx'));
const PartnersMaterialsPage = lazy(() => import('@/pages/partners/PartnersMaterialsPage.tsx'));
const PartnersProposalPage = lazy(() => import('@/pages/partners/PartnersProposalPage.tsx'));
const PartnersAcademyPage = lazy(() => import('@/pages/partners/PartnersAcademyPage.tsx'));
const PartnersLessonPage = lazy(() => import('@/pages/partners/PartnersAcademyPage.tsx').then((m) => ({ default: m.PartnersLessonPage })));
const PartnersCertificationPage = lazy(() => import('@/pages/partners/PartnersAcademyPage.tsx').then((m) => ({ default: m.PartnersCertificationPage })));
const PartnersTeamPage = lazy(() => import('@/pages/partners/PartnersTeamPage.tsx'));
const PartnersProfilePage = lazy(() => import('@/pages/partners/PartnersProfilePage.tsx'));
const PartnersHelpPage = lazy(() => import('@/pages/partners/PartnersHelpPage.tsx'));
// Public Partners pages
const PartnersProgramPage = lazy(() => import('@/pages/partners/public/PartnersProgramPage.tsx'));
const PartnerTermsPage = lazy(() => import('@/pages/partners/public/PartnerTermsPage.tsx'));
const SpecialistsDirectoryPage = lazy(() => import('@/pages/partners/public/SpecialistsDirectoryPage.tsx').then((m) => ({ default: m.SpecialistsDirectoryPage })));
const SpecialistProfilePage = lazy(() => import('@/pages/partners/public/SpecialistsDirectoryPage.tsx').then((m) => ({ default: m.SpecialistProfilePage })));
const PartnerLinkRedirectPage = lazy(() => import('@/pages/partners/public/PartnerLinkRedirectPage.tsx'));
const InviteAcceptPage = lazy(() => import('@/pages/partners/public/InviteAcceptPage.tsx'));

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
      {!isCustomDomain && <PartnerAttributionTracker />}
      <GoogleAdsSnippet />
      <Routes>
        {/* Custom Domain Routes - when accessed via user's own domain */}
        {isCustomDomain && customDomainSlug && (
          <Route element={<PublicLayout />}>
            <Route path="/" element={<CorretorPage customDomainSlug={customDomainSlug} />} />
            {/* Affiliate storefront link on a custom domain: /{affiliateSlug} (e.g. paraguaishopexpress.com/gabi) —
                mirrors the /{storeSlug}/{affiliateSlug} path used on vitrineturbo.com. */}
            <Route path="/:affiliateSlug" element={<CorretorPage customDomainSlug={customDomainSlug} />} />
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
          {!isCustomDomain && (
            <>
              <Route path="/parceiros" element={<PartnersProgramPage />} />
              <Route path="/parceiros/termos" element={<PartnerTermsPage />} />
              <Route path="/especialistas" element={<SpecialistsDirectoryPage />} />
              <Route path="/especialistas/:slug" element={<SpecialistProfilePage />} />
              <Route path="/p/:code" element={<PartnerLinkRedirectPage />} />
              <Route path="/p/:code/:link" element={<PartnerLinkRedirectPage />} />
              <Route path="/convite/:token" element={<InviteAcceptPage />} />
            </>
          )}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Buyer Account Routes (customer login, separate from merchant auth) */}
          <Route path="/conta/entrar" element={<BuyerLoginPage />} />
          <Route path="/conta/cadastro" element={<BuyerRegisterPage />} />
          <Route path="/conta/auth/callback" element={<BuyerAuthCallbackPage />} />
          {/* Buyer area lives inside each store (/:slug/conta/*) and only ever shows that
              store's data. Old platform-wide /conta/* links are forwarded to the right store. */}
          <Route path="/:slug/conta" element={<BuyerAccountLayout />}>
            <Route index element={<BuyerOverviewPage />} />
            <Route path="pedidos" element={<BuyerOrdersPage />} />
            <Route path="pedidos/:orderId" element={<BuyerOrderDetailPage />} />
            <Route path="carrinho" element={<BuyerCartPage />} />
            <Route path="enderecos" element={<BuyerAddressesPage />} />
            <Route path="perfil" element={<BuyerProfilePage />} />
          </Route>
          <Route path="/conta/*" element={<LegacyContaRedirect />} />

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
          <Route path="/dashboard/settings/payment/mercadopago/callback" element={<MercadoPagoConnectCallbackPage />} />
          {/* Impressão de pedido: página própria, sem sidebar, aberta em nova aba */}
          <Route path="/dashboard/orders/:orderId/imprimir" element={<OrderPrintPage />} />
          <Route path="/dashboard/orders/imprimir-lista" element={<OrderListPrintPage />} />
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
            <Route path="/admin/live-chat" element={<LiveChatInboxPage />} />
            <Route path="/admin/live-chat/operators" element={<LiveChatOperatorsPage />} />
            <Route path="/admin/live-chat/settings" element={<LiveChatSettingsPage />} />
            <Route path="/admin/live-chat/metrics" element={<LiveChatMetricsPage />} />
            <Route path="/admin/live-visitors" element={<LiveVisitorsPage />} />
            <Route path="/admin/landing-visits" element={<LandingVisitsPage />} />
            <Route path="/admin/netlify" element={<NetlifyIntegrationPage />} />
            <Route path="/admin/integrations" element={<IntegrationProvidersPage />} />
            <Route path="/admin/help" element={<HelpManagementPage />} />
            <Route path="/admin/blog" element={<BlogManagementPage />} />
            <Route path="/admin/mercadopago" element={<MercadoPagoPage />} />
            <Route path="/admin/mercadopago-marketplace" element={<MercadoPagoMarketplacePage />} />
            <Route path="/admin/online-sales" element={<OnlineSalesPage />} />
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
            <Route path="/admin/storefront-themes" element={<StorefrontThemesPage />} />
            <Route path="/admin/signup-discount" element={<SignupDiscountPage />} />
            <Route path="/admin/landing-campaigns" element={<LandingCampaignsPage />} />
          </Route>
        </Route>

        {/* Protected Partners Routes (VitrineTurbo Partners) */}
        <Route element={<PartnerRoute />}>
          <Route element={<PartnersLayout />}>
            <Route path="/partners" element={<PartnersDashboardPage />} />
            <Route path="/partners/clients" element={<PartnersClientsPage />} />
            <Route path="/partners/clients/:id" element={<PartnersClientDetailPage />} />
            <Route path="/partners/new-store" element={<PartnersNewStorePage />} />
            <Route path="/partners/leads" element={<PartnersLeadsPage />} />
            <Route path="/partners/links" element={<PartnersLinksPage />} />
            <Route path="/partners/performance" element={<PartnersPerformancePage />} />
            <Route path="/partners/finance" element={<PartnersFinancePage />} />
            <Route path="/partners/materials" element={<PartnersMaterialsPage />} />
            <Route path="/partners/proposal" element={<PartnersProposalPage />} />
            <Route path="/partners/academy" element={<PartnersAcademyPage />} />
            <Route path="/partners/academy/certificacao" element={<PartnersCertificationPage />} />
            <Route path="/partners/academy/:lessonId" element={<PartnersLessonPage />} />
            <Route path="/partners/team" element={<PartnersTeamPage />} />
            <Route path="/partners/profile" element={<PartnersProfilePage />} />
            <Route path="/partners/help" element={<PartnersHelpPage />} />
            {/* Old Partners panel paths */}
            <Route path="/partners/users" element={<Navigate to="/partners/clients" replace />} />
            <Route path="/partners/users/new" element={<Navigate to="/partners/new-store" replace />} />
            <Route path="/partners/users/:id" element={<LegacyPartnerUserRedirect />} />
            <Route path="/partners/referral" element={<Navigate to="/partners/links" replace />} />
            <Route path="/partners/commissions" element={<Navigate to="/partners/finance" replace />} />
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

function LegacyPartnerUserRedirect() {
  const { id } = useParams();
  return <Navigate to={`/partners/clients/${id}`} replace />;
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
                          <CorretorPageStateProvider>
                            <AppContent />
                            <OfferDisplayManager />
                            <Toaster />
                            <FloatingWhatsAppButton />
                            <CookieConsentBanner />
                          </CorretorPageStateProvider>
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