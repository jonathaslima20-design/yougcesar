import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Menu,
  ShoppingCart,
  UserRound,
  ChevronDown,
  Package,
  Wallet,
  User as UserIcon,
  HelpCircle,
  X,
  LogIn,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EletronicosCategoryDrawer from '@/components/storefront-themes/eletronicos/EletronicosCategoryDrawer';
import EletronicosSearchBox from '@/components/storefront-themes/eletronicos/EletronicosSearchBox';
import type { CatalogRow } from '@/components/storefront-themes/eletronicos/eletronicosCatalog';
import { useCustomDomain } from '@/contexts/CustomDomainContext';
import { cn, getInitials, getWhatsAppContactUrl } from '@/lib/utils';
import { generateWhatsAppMessage } from '@/lib/i18n';
import { trackWhatsAppClick, STOREFRONT_UUID } from '@/lib/tracking';
import { useCart } from '@/contexts/CartContext';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useAffiliateWhatsAppOverride } from '@/hooks/useAffiliateWhatsAppOverride';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import CartModal from '@/components/corretor/CartModal';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type CategoryNavProps = Pick<StorefrontPageBodyProps, 'filterMetadata' | 'filters' | 'onFiltersChange'> & {
  onOpenAllCategories: () => void;
  navStyle: { backgroundColor: string; color: string };
};

function useCategoryNav({ filterMetadata, filters, onFiltersChange }: Pick<StorefrontPageBodyProps, 'filterMetadata' | 'filters' | 'onFiltersChange'>) {
  const categories: string[] = filterMetadata?.categories || [];
  const activeCategory = filters?.category && filters.category !== 'todos' ? filters.category : null;
  const selectCategory = (category: string | null) => onFiltersChange({ ...filters, category: category || 'todos' });
  return { categories, activeCategory, selectCategory };
}

// "Todas Categorias" opens the category list (EletronicosCategoryDrawer); the full
// filter panel is reached from that drawer and from the toolbar above the product
// grid (see CorretorPageEletronicos.tsx).
function CategoryNavBar({ filterMetadata, filters, onFiltersChange, onOpenAllCategories, navStyle }: CategoryNavProps) {
  const { categories, activeCategory, selectCategory } = useCategoryNav({ filterMetadata, filters, onFiltersChange });

  return (
    <nav className="hidden md:block" style={navStyle}>
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-8 overflow-x-auto py-2 text-sm">
          <button
            type="button"
            onClick={onOpenAllCategories}
            className={cn(
              'shrink-0 flex flex-row items-center gap-1.5 font-semibold leading-tight transition-opacity',
              !activeCategory ? 'opacity-100' : 'opacity-80 hover:opacity-100'
            )}
          >
            <Menu className="h-4 w-4" />
            Todas Categorias
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => selectCategory(category)}
              className={cn(
                'shrink-0 leading-tight transition-opacity max-w-[140px] text-center',
                activeCategory === category ? 'opacity-100 underline underline-offset-4' : 'opacity-80 hover:opacity-100'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

/**
 * Compact e-commerce header for the "Eletrônicos" theme, modeled directly on the
 * reference storefront: thin dark announcement bar, then on desktop a white logo +
 * search + help/account/cart row with a dark category nav below it; on mobile a single
 * dark bar (hamburger, search, logo, account, cart) since that's how the reference
 * collapses its header at small widths. Deliberately NOT a reuse of CorretorHeader —
 * that component's big cover+avatar layout is what makes the "padrão" theme look the
 * way it does, and reusing it here defeats the point of a visually distinct theme.
 */
export default function CorretorHeaderEletronicos(props: StorefrontPageBodyProps & { onOpenFilters: () => void; onGoHome: () => void; catalogRows: CatalogRow[] }) {
  const {
    corretor, cartEnabled, onlineSalesEnabled, filterMetadata, filters, onFiltersChange, language,
    currency, onOpenFilters, onGoHome, catalogRows,
  } = props;
  const { isCustomDomain } = useCustomDomain();
  const productHref = (id: string) => (isCustomDomain ? `/produtos/${id}` : `/${corretor.slug}/produtos/${id}`);
  const { cart } = useCart();
  const { customer } = useBuyerAuth();
  const { appearance } = useStorefrontTheme();
  const chromeStyle = { backgroundColor: appearance.header_bg_color, color: appearance.header_text_color };
  const topBarStyle = { backgroundColor: appearance.topbar_bg_color, color: appearance.topbar_text_color };
  const navStyle = { backgroundColor: appearance.nav_bg_color, color: appearance.nav_text_color };
  // Buttons always follow the header's own colors — no separate control for them
  // (removed from Personalizar Eletrônicos: one less color to keep in sync).
  const buttonStyle = { backgroundColor: appearance.header_bg_color, color: appearance.header_text_color };
  const logoScale = appearance.header_logo_scale / 100;
  const mobileLogoPx = `${44 * logoScale}px`;
  const desktopLogoPx = `${64 * logoScale}px`;
  const topBarPhrases = appearance.top_bar_phrases.length > 0
    ? appearance.top_bar_phrases
    : ['Fale com a gente pelo WhatsApp'];
  const [topBarIndex, setTopBarIndex] = useState(0);
  const [showCart, setShowCart] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(filters?.query || '');

  const loginLink = `/conta/entrar?loja=${corretor.slug}&from=${encodeURIComponent(`/${corretor.slug}/conta`)}`;

  const affiliateWhatsAppOverride = useAffiliateWhatsAppOverride(corretor.id);
  const effectiveWhatsAppContact = affiliateWhatsAppOverride || corretor;
  const isWhatsAppLinkMode = effectiveWhatsAppContact.whatsapp_mode === 'link';
  const whatsappMessage = isWhatsAppLinkMode ? '' : generateWhatsAppMessage(language, corretor.name);
  const whatsappContactValue = isWhatsAppLinkMode ? corretor.whatsapp_link : effectiveWhatsAppContact.whatsapp;
  const whatsappUrl = whatsappContactValue ? getWhatsAppContactUrl(effectiveWhatsAppContact, whatsappMessage) : '';

  const handleWhatsAppClick = async () => {
    await trackWhatsAppClick(STOREFRONT_UUID, 'product', 'header_social');
  };

  useEffect(() => {
    if (topBarPhrases.length <= 1) {
      setTopBarIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setTopBarIndex((i) => (i + 1) % topBarPhrases.length);
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topBarPhrases.length]);

  const submitSearch = () => {
    onFiltersChange({ ...filters, query: searchValue });
    setShowMobileSearch(false);
  };

  const hasHelpContact = !!whatsappUrl || !!corretor.email;
  const HelpMenuContent = (
    <DropdownMenuContent align="end" className="w-64">
      {whatsappUrl && (
        <DropdownMenuItem asChild onSelect={handleWhatsAppClick}>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 cursor-pointer">
            <MessageCircle className="h-4 w-4 mt-0.5 text-[#25D366]" />
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">Whatsapp:</span>
              <span className="font-medium">{isWhatsAppLinkMode ? 'Fale conosco' : corretor.whatsapp}</span>
            </span>
          </a>
        </DropdownMenuItem>
      )}
      {corretor.email && (
        <DropdownMenuItem asChild>
          <a href={`mailto:${corretor.email}`} className="flex items-start gap-2 cursor-pointer">
            <Mail className="h-4 w-4 mt-0.5 text-orange-500" />
            <span className="flex flex-col">
              <span className="text-xs text-muted-foreground">E-mail:</span>
              <span className="font-medium">{corretor.email}</span>
            </span>
          </a>
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );

  const AccountMenu = onlineSalesEnabled ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 text-inherit" title={customer ? 'Minha conta' : 'Entrar'} aria-label={customer ? 'Minha conta' : 'Entrar'}>
          <UserRound className="h-5 w-5" />
          <ChevronDown className="h-3 w-3 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={customer ? undefined : 'min-w-0 w-auto rounded-xl p-1.5'}>
        {customer ? (
          <>
            <DropdownMenuItem asChild>
              <Link to={`/${corretor.slug}/conta/pedidos`} className="flex items-center gap-2 cursor-pointer">
                <Package className="h-4 w-4" /> Meus pedidos
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/${corretor.slug}/conta/cashback`} className="flex items-center gap-2 cursor-pointer">
                <Wallet className="h-4 w-4" /> Meu cashback
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/${corretor.slug}/conta/perfil`} className="flex items-center gap-2 cursor-pointer">
                <UserIcon className="h-4 w-4" /> Perfil
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          // Logged out: one prominent pill button (in the theme's button colors) instead of
          // a tiny text row, so the way in is obvious.
          <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
            <Link
              to={loginLink}
              style={buttonStyle}
              className="flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium whitespace-nowrap cursor-pointer transition-opacity hover:opacity-90 focus:opacity-90"
            >
              <LogIn className="h-4 w-4" /> Entrar
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div>
      {appearance.top_bar_enabled && (
        whatsappUrl && whatsappUrl !== '#' ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            className="block text-center text-xs py-1.5 hover:underline"
            style={topBarStyle}
          >
            {topBarPhrases[topBarIndex % topBarPhrases.length]}
          </a>
        ) : (
          <div className="block text-center text-xs py-1.5" style={topBarStyle}>
            {topBarPhrases[topBarIndex % topBarPhrases.length]}
          </div>
        )
      )}

      {/* Mobile: single dark bar, like the reference collapses to at small widths */}
      <header className="md:hidden" style={chromeStyle}>
        <div className="px-3 py-2.5 flex items-center gap-3">
          <button aria-label="Categorias" onClick={() => setCategoriesOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          <button aria-label="Buscar" onClick={() => setShowMobileSearch((v) => !v)}>
            {showMobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>

          <Link
            to={`/${corretor.slug}`}
            onClick={onGoHome}
            aria-label="Ir para a página inicial da loja"
            className="flex-1 flex items-center justify-center"
          >
            {appearance.header_logo_url ? (
              <img src={appearance.header_logo_url} alt={corretor.name} className="object-contain" style={{ height: mobileLogoPx }} />
            ) : (
              <Avatar className="rounded-md" style={{ height: mobileLogoPx, width: mobileLogoPx }}>
                <AvatarImage src={corretor.avatar_url} alt={corretor.name} className="object-cover" />
                <AvatarFallback className="rounded-md text-sm">{getInitials(corretor.name)}</AvatarFallback>
              </Avatar>
            )}
          </Link>

          {onlineSalesEnabled && hasHelpContact && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Precisa de ajuda?" className="text-inherit">
                  <HelpCircle className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              {HelpMenuContent}
            </DropdownMenu>
          )}

          {AccountMenu}

          {cartEnabled && (
            <button aria-label="Carrinho" className="relative" onClick={() => setShowCart(true)}>
              <ShoppingCart className="h-5 w-5" />
              {cart.itemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[9px] bg-primary">
                  {cart.itemCount}
                </Badge>
              )}
            </button>
          )}
        </div>

        {showMobileSearch && (
          <div className="px-3 pb-3">
            <EletronicosSearchBox
              autoFocus
              value={searchValue}
              onChange={setSearchValue}
              onSubmit={submitSearch}
              rows={catalogRows}
              categories={filterMetadata?.categories || []}
              onPickCategory={(category) => {
                setShowMobileSearch(false);
                onFiltersChange({ ...filters, category });
              }}
              productHref={productHref}
              currency={currency}
              language={language}
              buttonStyle={buttonStyle}
              inputClassName="pr-11 rounded-md h-9 bg-white text-foreground"
              buttonClassName="h-7 w-8"
            />
          </div>
        )}
      </header>

      {/* Desktop: whole header chrome (logo/search/icons + category bar) is dark, one
          continuous block — matches the reference exactly (not split white/black). */}
      <header className="hidden md:block" style={chromeStyle}>
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            to={`/${corretor.slug}`}
            onClick={onGoHome}
            aria-label="Ir para a página inicial da loja"
            className="shrink-0"
          >
            {appearance.header_logo_url ? (
              <img src={appearance.header_logo_url} alt={corretor.name} className="object-contain" style={{ height: desktopLogoPx }} />
            ) : (
              <Avatar className="rounded-lg" style={{ height: desktopLogoPx, width: desktopLogoPx }}>
                <AvatarImage src={corretor.avatar_url} alt={corretor.name} className="object-cover" />
                <AvatarFallback className="rounded-lg text-lg">{getInitials(corretor.name)}</AvatarFallback>
              </Avatar>
            )}
          </Link>

          <div className="flex-1 max-w-xl mx-auto">
            <EletronicosSearchBox
              value={searchValue}
              onChange={setSearchValue}
              onSubmit={submitSearch}
              rows={catalogRows}
              categories={filterMetadata?.categories || []}
              onPickCategory={(category) => onFiltersChange({ ...filters, category })}
              productHref={productHref}
              currency={currency}
              language={language}
              buttonStyle={buttonStyle}
              inputClassName="pr-11 rounded-md h-10 bg-white text-foreground border-0"
              buttonClassName="h-8 w-9"
            />
          </div>

          <div className="flex items-center gap-4 ml-auto text-sm shrink-0">
            {onlineSalesEnabled && hasHelpContact && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-inherit" type="button">
                    <HelpCircle className="h-4 w-4" />
                    <span className="flex flex-col items-start leading-tight text-xs">
                      <span className="opacity-70">Precisa de Ajuda?</span>
                      <span className="font-semibold">Atendimento</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                {HelpMenuContent}
              </DropdownMenu>
            )}

            {onlineSalesEnabled && (
              <div className="flex items-center gap-1.5">
                {AccountMenu}
                <span className="flex flex-col items-start leading-tight text-xs">
                  <span className="opacity-70">Minha Conta</span>
                  <span className="font-semibold">{customer ? 'Minha conta' : 'Acessar'}</span>
                </span>
              </div>
            )}

            {cartEnabled && (
              <button className="relative" onClick={() => setShowCart(true)} aria-label="Carrinho">
                <ShoppingCart className="h-5 w-5" />
                {cart.itemCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-primary">
                    {cart.itemCount}
                  </Badge>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      <CategoryNavBar
        filterMetadata={filterMetadata}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onOpenAllCategories={() => setCategoriesOpen(true)}
        navStyle={navStyle}
      />

      {/* Category menu: hamburger (mobile) and "Todas Categorias" (desktop) both open
          this list. The filter panel itself now lives in CorretorPageEletronicos and is
          opened from here ("Filtros avançados") or from the toolbar above the grid. */}
      <EletronicosCategoryDrawer
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={filterMetadata?.categories || []}
        activeCategory={filters?.category && filters.category !== 'todos' ? filters.category : null}
        onSelectCategory={(category) => onFiltersChange({ ...filters, category: category || 'todos' })}
        onOpenFilters={onOpenFilters}
      />

      {cartEnabled && (
        <CartModal
          open={showCart}
          onOpenChange={setShowCart}
          corretor={corretor}
          currency={currency}
          language={language}
        />
      )}
    </div>
  );
}
