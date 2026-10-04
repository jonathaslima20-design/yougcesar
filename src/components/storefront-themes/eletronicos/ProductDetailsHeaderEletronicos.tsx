import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import { useCart } from '@/contexts/CartContext';
import { getInitials } from '@/lib/utils';
import type { User } from '@/types';

interface ProductDetailsHeaderEletronicosProps {
  corretor: User;
  homeHref: string;
  cartEnabled: boolean | undefined;
  onOpenCart: () => void;
}

/**
 * Slim version of CorretorHeaderEletronicos for the product detail page —
 * same dark chrome, logo and cart access, but without the full category nav
 * bar (that needs the whole catalog + filters context this page doesn't load).
 * "Home" (logo) and search both just send the shopper back into the catalog,
 * where the real nav lives.
 */
export default function ProductDetailsHeaderEletronicos({ corretor, homeHref, cartEnabled, onOpenCart }: ProductDetailsHeaderEletronicosProps) {
  const { appearance } = useStorefrontTheme();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  // On phones the logo and icons leave little room, so the placeholder gets a short form.
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsPhone(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const chromeStyle = { backgroundColor: appearance.header_bg_color, color: appearance.header_text_color };
  // Buttons always follow the header's own colors — see CorretorHeaderEletronicos.tsx.
  const buttonStyle = { backgroundColor: appearance.header_bg_color, color: appearance.header_text_color };
  const logoScale = (appearance.header_logo_scale ?? 100) / 100;
  const logoPx = `${56 * logoScale}px`;

  const submitSearch = () => {
    const query = searchValue.trim();
    navigate(query ? `${homeHref}?query=${encodeURIComponent(query)}` : homeHref);
  };

  return (
    <header style={chromeStyle}>
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        {/* `state` lets CorretorPage restore the scroll position + filters the shopper
            left behind, same as the breadcrumb's "Home" link. */}
        <Link to={homeHref} state={{ from: 'product-detail' }} className="shrink-0">
          {appearance.header_logo_url ? (
            <img src={appearance.header_logo_url} alt={corretor.name} className="object-contain" style={{ height: logoPx }} />
          ) : (
            <Avatar className="rounded-lg" style={{ height: logoPx, width: logoPx }}>
              <AvatarImage src={corretor.avatar_url} alt={corretor.name} className="object-cover" />
              <AvatarFallback className="rounded-lg">{getInitials(corretor.name)}</AvatarFallback>
            </Avatar>
          )}
        </Link>

        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder={isPhone ? 'Buscar' : 'O que deseja procurar?'}
              className="pr-11 rounded-md h-10 bg-white text-foreground border-0"
            />
            <button
              type="button"
              onClick={submitSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-9 flex items-center justify-center rounded hover:opacity-90"
              style={buttonStyle}
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>

        {cartEnabled && (
          <button type="button" className="relative shrink-0" onClick={onOpenCart} aria-label="Carrinho">
            <ShoppingCart className="h-6 w-6" />
            {cart.itemCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-primary">
                {cart.itemCount}
              </Badge>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
