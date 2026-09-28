import { useState } from 'react';
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
  Percent,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EletronicosFiltersPanel from '@/components/storefront-themes/eletronicos/EletronicosFiltersPanel';
import { cn, getInitials, getWhatsAppContactUrl } from '@/lib/utils';
import { generateWhatsAppMessage } from '@/lib/i18n';
import { trackWhatsAppClick, STOREFRONT_UUID } from '@/lib/tracking';
import { useCart } from '@/contexts/CartContext';
import { useBuyerAuth } from '@/contexts/BuyerAuthContext';
import { useAffiliateWhatsAppOverride } from '@/hooks/useAffiliateWhatsAppOverride';
import CartModal from '@/components/corretor/CartModal';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

type CategoryNavProps = Pick<StorefrontPageBodyProps, 'filterMetadata' | 'filters' | 'onFiltersChange'> & {
  onOpenAllFilters: () => void;
};

function useCategoryNav({ filterMetadata, filters, onFiltersChange }: Pick<StorefrontPageBodyProps, 'filterMetadata' | 'filters' | 'onFiltersChange'>) {
  const categories: string[] = filterMetadata?.categories || [];
  const activeCategory = filters?.category && filters.category !== 'todos' ? filters.category : null;
  const selectCategory = (category: string | null) => onFiltersChange({ ...filters, category: category || 'todos' });
  return { categories, activeCategory, selectCategory };
}

// "Todas Categorias" opens the single, full filter panel (status/gender/category/
// brand/sizes/condition/price — same one ProductSearch already builds elsewhere in
// the app) instead of just resetting the category — there's only one filter entry
// point in this theme, not a category shortcut plus a separate duplicate filter bar.
function CategoryNavBar({ filterMetadata, filters, onFiltersChange, onOpenAllFilters }: CategoryNavProps) {
  const { categories, activeCategory, selectCategory } = useCategoryNav({ filterMetadata, filters, onFiltersChange });
  const offersCategory = categories.find((c) => c.toLowerCase().includes('oferta'));

  return (
    <nav className="hidden md:block bg-neutral-900 text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-8 overflow-x-auto py-2 text-sm">
          <button
            type="button"
            onClick={onOpenAllFilters}
            className={cn(
              'shrink-0 flex flex-col items-center gap-0.5 font-semibold leading-tight transition-opacity',
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

          <button
            type="button"
            onClick={() => offersCategory && selectCategory(offersCategory)}
            className="shrink-0 ml-auto flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 rounded-full px-4 py-2 font-medium whitespace-nowrap transition-colors"
          >
            <Percent className="h-4 w-4" />
            Ofertas Especiais
          </button>
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
export default function CorretorHeaderEletronicos(props: StorefrontPageBodyProps) {
  const {
    corretor, cartEnabled, onlineSalesEnabled, filterMetadata, filters, onFiltersChange, language,
    allProducts, settings, sizeTypeMapping, currency,
  } = props;
  const { cart } = useCart();
  const { customer } = useBuyerAuth();
  const [showCart, setShowCart] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const submitSearch = () => {
    onFiltersChange({ ...filters, query: searchValue });
    setShowMobileSearch(false);
  };

  const AccountMenu = onlineSalesEnabled ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 text-inherit">
          <UserRound className="h-5 w-5" />
          <ChevronDown className="h-3 w-3 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
          <DropdownMenuItem asChild>
            <Link to={loginLink} className="flex items-center gap-2 cursor-pointer">
              <UserRound className="h-4 w-4" /> Entrar
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div>
      {whatsappUrl && whatsappUrl !== '#' && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleWhatsAppClick}
          className="block bg-neutral-900 text-white text-center text-xs py-1.5 hover:underline"
        >
          Fale com a gente pelo WhatsApp
        </a>
      )}

      {/* Mobile: single dark bar, like the reference collapses to at small widths */}
      <header className="md:hidden bg-neutral-900 text-white">
        <div className="px-3 py-2.5 flex items-center gap-3">
          <button aria-label="Categorias e filtros" onClick={() => setDrawerOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          <button aria-label="Buscar" onClick={() => setShowMobileSearch((v) => !v)}>
            {showMobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>

          <Link to={`/${corretor.slug}`} className="flex-1 flex items-center justify-center">
            <Avatar className="h-11 w-11 rounded-md">
              <AvatarImage src={corretor.avatar_url} alt={corretor.name} className="object-cover" />
              <AvatarFallback className="rounded-md text-sm">{getInitials(corretor.name)}</AvatarFallback>
            </Avatar>
          </Link>

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
            <div className="relative">
              <Input
                autoFocus
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                placeholder="O que deseja procurar?"
                className="pr-11 rounded-md h-9 bg-white text-foreground"
              />
              <button
                type="button"
                onClick={submitSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-8 flex items-center justify-center rounded bg-neutral-700 text-white"
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Desktop: whole header chrome (logo/search/icons + category bar) is dark, one
          continuous block — matches the reference exactly (not split white/black). */}
      <header className="hidden md:block bg-neutral-900 text-white">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link to={`/${corretor.slug}`} className="shrink-0">
            <Avatar className="h-16 w-16 rounded-lg">
              <AvatarImage src={corretor.avatar_url} alt={corretor.name} className="object-cover" />
              <AvatarFallback className="rounded-lg text-lg">{getInitials(corretor.name)}</AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1 max-w-xl mx-auto">
            <div className="relative">
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                placeholder="O que deseja procurar?"
                className="pr-11 rounded-md h-10 bg-white text-foreground border-0"
              />
              <button
                type="button"
                onClick={submitSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-9 flex items-center justify-center rounded bg-neutral-900 text-white hover:bg-neutral-700"
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto text-sm shrink-0">
            {onlineSalesEnabled && (
              <div className="flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4" />
                <span className="flex flex-col items-start leading-tight text-xs">
                  <span className="opacity-70">Precisa de Ajuda?</span>
                  <span className="font-semibold">Atendimento</span>
                </span>
              </div>
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
        onOpenAllFilters={() => setDrawerOpen(true)}
      />

      {/* Single filter entry point for this theme: hamburger (mobile) and "Todas
          Categorias" (desktop) both open this same panel — no separate duplicate
          search/filters bar in the product listing (see showSearchBar={false} in
          CorretorPageEletronicos.tsx). */}
      <EletronicosFiltersPanel
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        allProducts={allProducts}
        filterMetadata={filterMetadata}
        currency={currency}
        language={language}
        settings={settings}
        sizeTypeMapping={sizeTypeMapping}
        filters={filters}
        onFiltersChange={onFiltersChange}
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
