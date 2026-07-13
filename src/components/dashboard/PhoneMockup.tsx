import { ShoppingCart, Phone, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import {
  type StorefrontAppearance,
  getRadiusPx,
  getShadowCss,
  getSpacingValue,
  getFontSizeScale,
  getBackgroundStyle,
} from '@/lib/appearanceDefaults';
import { formatCurrencyI18n } from '@/lib/i18n';

interface MockupProduct {
  id: string;
  name: string;
  price: number;
  discount_price: number | null;
  featured_image_url: string | null;
  short_description: string | null;
}

const PLACEHOLDER_PRODUCTS: MockupProduct[] = [
  { id: 'ph1', name: 'Produto exemplo 1', price: 99.90, discount_price: null, featured_image_url: null, short_description: 'Frete grátis' },
  { id: 'ph2', name: 'Produto exemplo 2', price: 149.90, discount_price: 119.90, featured_image_url: null, short_description: null },
  { id: 'ph3', name: 'Produto exemplo 3', price: 79.90, discount_price: null, featured_image_url: null, short_description: 'Lançamento' },
  { id: 'ph4', name: 'Produto exemplo 4', price: 199.90, discount_price: 159.90, featured_image_url: null, short_description: null },
];

interface PhoneMockupProps {
  appearance: StorefrontAppearance;
  name: string;
  bio: string;
  avatar_url: string | null;
  cover_url_mobile: string | null;
  promotional_banner_url_mobile: string | null;
  whatsapp: string | null;
  instagram: string | null;
  phone: string | null;
  location: string | null;
  products: MockupProduct[];
  categoryName: string;
}

export function PhoneMockup({
  appearance,
  name,
  bio,
  avatar_url,
  cover_url_mobile,
  promotional_banner_url_mobile,
  whatsapp,
  instagram,
  phone,
  location,
  products,
  categoryName,
}: PhoneMockupProps) {

  const cardRadius = getRadiusPx(appearance.card_border_radius);
  const imgRadius = getRadiusPx(appearance.image_border_radius);
  const shadow = getShadowCss(appearance.card_shadow);
  const sectionGap = getSpacingValue(appearance.section_spacing, 'section');
  const cardGap = getSpacingValue(appearance.card_gap, 'gap');
  const fontScale = getFontSizeScale(appearance.font_size_base);
  const bgStyle = getBackgroundStyle(appearance);
  const btnRadius = getRadiusPx(appearance.button_border_radius);

  const coverRadius = (() => {
    const map: Record<string, string> = { none: '0px', sm: '12px', md: '20px', lg: '32px', xl: '42px' };
    return map[appearance.cover_border_radius] || '0px';
  })();

  const socialButtons = [
    { icon: ShoppingCart, show: true },
    { icon: Phone, show: !!phone },
    { icon: 'whatsapp' as const, show: !!whatsapp },
    { icon: 'instagram' as const, show: !!instagram },
    { icon: MapPin, show: !!location },
  ].filter(b => b.show);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col items-center">
        {/* Phone Frame */}
        <div
          className="relative bg-black rounded-[44px] p-[10px] shadow-2xl"
          style={{ width: '290px', height: '600px' }}
        >
          {/* Dynamic Island */}
          <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-[80px] h-[22px] bg-black rounded-full z-20" />

          {/* Screen */}
          <div
            className="w-full h-full rounded-[34px] overflow-hidden relative"
            style={bgStyle}
          >
            {/* Scrollable content */}
            <div
              className="absolute inset-0 overflow-y-auto overflow-x-hidden mockup-scrollbar"
              style={{
                fontFamily: `'${appearance.font_family}', sans-serif`,
                color: appearance.text_color,
                fontSize: `${parseFloat(fontScale) * 11}px`,
                lineHeight: '1.5',
              }}
            >
            <div className="flex flex-col" style={{ minHeight: '100%', ...getBackgroundStyle(appearance) }}>
              {/* Cover Image */}
              <div className="px-2 pt-2">
                <div
                  className="relative w-full overflow-hidden"
                  style={{
                    aspectRatio: '960 / 860',
                    borderRadius: coverRadius === '0px' ? '24px' : coverRadius,
                  }}
                >
                  <img
                    src={cover_url_mobile || 'https://images.pexels.com/photos/1396132/pexels-photo-1396132.jpeg?auto=compress&cs=tinysrgb&w=600'}
                    alt="Cover"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Avatar - matches CorretorPage: border-4 border-background */}
              <div className="flex justify-center -mt-16 relative z-10">
                <div
                  className="w-[110px] h-[110px] rounded-full overflow-hidden shadow-lg"
                  style={{
                    border: `3px solid ${appearance.border_color}`,
                    backgroundColor: appearance.card_bg_color,
                  }}
                >
                  {avatar_url ? (
                    <img src={avatar_url} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: appearance.muted_text_color }}>
                      {name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Name & Bio */}
              <div className="text-center px-4 mt-2" style={{ marginBottom: '10px' }}>
                <h1
                  className="font-bold leading-tight"
                  style={{
                    fontFamily: `'${appearance.heading_font_family}', sans-serif`,
                    color: appearance.heading_color,
                    fontSize: `${parseFloat(fontScale) * 14}px`,
                  }}
                >
                  {name}
                </h1>
                <p
                  className="mt-1 line-clamp-2"
                  style={{ color: appearance.muted_text_color, fontSize: `${parseFloat(fontScale) * 9}px` }}
                >
                  {bio}
                </p>
              </div>

              {/* Social Buttons */}
              <div className="flex justify-center gap-2 px-4 mb-3">
                {socialButtons.map((btn, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-center w-9 h-9 rounded-full border transition-transform hover:scale-105"
                    style={{
                      borderColor: appearance.border_color,
                      backgroundColor: 'transparent',
                    }}
                  >
                    {btn.icon === 'whatsapp' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: appearance.icon_color }}>
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    ) : btn.icon === 'instagram' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: appearance.icon_color }}>
                        <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                      </svg>
                    ) : (
                      <btn.icon size={14} style={{ color: appearance.icon_color }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Promotional Banner */}
              {promotional_banner_url_mobile && (
                <div className="px-3 mb-3">
                  <img
                    src={promotional_banner_url_mobile}
                    alt="Banner"
                    className="w-full h-auto object-contain"
                    style={{ borderRadius: imgRadius }}
                  />
                </div>
              )}

              {/* Search Bar */}
              <div className="px-3 mb-3">
                <div className="flex gap-1.5">
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 flex-1"
                    style={{
                      backgroundColor: appearance.card_bg_color,
                      border: `1px solid ${appearance.border_color}`,
                      borderRadius: btnRadius,
                    }}
                  >
                    <Search size={10} style={{ color: appearance.muted_text_color }} />
                    <span style={{ color: appearance.muted_text_color, fontSize: `${parseFloat(fontScale) * 9}px` }}>
                      Buscar produtos...
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1 px-2 py-1.5 shrink-0"
                    style={{
                      border: `1px solid ${appearance.border_color}`,
                      borderRadius: btnRadius,
                      fontSize: `${parseFloat(fontScale) * 8}px`,
                      color: appearance.text_color,
                    }}
                  >
                    <SlidersHorizontal size={9} style={{ color: appearance.icon_color }} />
                    <span>Filtros</span>
                  </div>
                </div>
              </div>

              {/* Category Title */}
              <div className="px-3" style={{ marginBottom: cardGap }}>
                <h2
                  className="font-bold"
                  style={{
                    fontFamily: `'${appearance.heading_font_family}', sans-serif`,
                    color: appearance.heading_color,
                    fontSize: `${parseFloat(fontScale) * 12}px`,
                  }}
                >
                  {categoryName}
                </h2>
              </div>

              {/* Product Grid */}
              <div
                className="px-3 grid grid-cols-2 flex-1 content-start"
                style={{ gap: cardGap, paddingBottom: sectionGap }}
              >
                {(products.length > 0 ? products.slice(0, 4) : PLACEHOLDER_PRODUCTS).map((product) => (
                  <ProductMockupCard
                    key={product.id}
                    product={product}
                    appearance={appearance}
                    cardRadius={cardRadius}
                    imgRadius={imgRadius}
                    shadow={shadow}
                    fontScale={fontScale}
                    btnRadius={btnRadius}
                  />
                ))}
              </div>

            </div>{/* end inner flex fill */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductMockupCard({
  product,
  appearance,
  cardRadius,
  imgRadius,
  shadow,
  fontScale,
  btnRadius,
}: {
  product: MockupProduct;
  appearance: StorefrontAppearance;
  cardRadius: string;
  imgRadius: string;
  shadow: string;
  fontScale: string;
  btnRadius: string;
}) {
  const hasDiscount = product.discount_price && product.discount_price < product.price;
  const discountPercentage = hasDiscount
    ? Math.round(((product.price - product.discount_price!) / product.price) * 100)
    : 0;

  return (
    <div
      className="overflow-hidden transition-all duration-200 flex flex-col"
      style={{
        backgroundColor: appearance.card_bg_color,
        border: `1px solid ${appearance.card_border_color}`,
        borderRadius: cardRadius,
        boxShadow: shadow,
      }}
    >
      {/* Image */}
      <div className="p-1.5">
        <div
          className="relative aspect-square overflow-hidden"
          style={{
            borderRadius: imgRadius,
            border: `1px solid ${appearance.border_color}`,
          }}
        >
          {product.featured_image_url ? (
            <img
              src={product.featured_image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: appearance.border_color }}>
              <ShoppingCart size={14} style={{ color: appearance.muted_text_color }} />
            </div>
          )}
          {hasDiscount && (
            <div
              className="absolute top-1.5 right-1.5 px-1.5 py-0.5"
              style={{
                backgroundColor: '#16a34a',
                color: '#ffffff',
                borderRadius: '4px',
                fontSize: '8px',
                fontWeight: 600,
              }}
            >
              -{discountPercentage}%
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-2 pb-2 flex-1 flex flex-col">
        <p
          className="font-semibold line-clamp-2 leading-tight mb-1"
          style={{
            color: appearance.text_color,
            fontSize: `${parseFloat(fontScale) * 9}px`,
          }}
        >
          {product.name}
        </p>

        {/* Price section */}
        <div className="mt-auto">
          {hasDiscount ? (
            <div className="space-y-0.5">
              <span
                className="line-through block"
                style={{ color: appearance.muted_text_color, fontSize: `${parseFloat(fontScale) * 7}px` }}
              >
                De {formatCurrencyI18n(product.price, 'BRL', 'pt-BR')}
              </span>
              <span
                className="font-bold block"
                style={{
                  color: appearance.text_color,
                  fontSize: `${parseFloat(fontScale) * 10}px`,
                }}
              >
                por {formatCurrencyI18n(product.discount_price!, 'BRL', 'pt-BR')}
              </span>
            </div>
          ) : (
            <span
              className="font-bold"
              style={{
                color: appearance.text_color,
                fontSize: `${parseFloat(fontScale) * 10}px`,
              }}
            >
              {formatCurrencyI18n(product.price, 'BRL', 'pt-BR')}
            </span>
          )}
        </div>

        {/* Promotional phrase */}
        {product.short_description && (
          <p
            className="line-clamp-2 mt-1"
            style={{
              color: appearance.muted_text_color,
              fontSize: `${parseFloat(fontScale) * 7.5}px`,
              lineHeight: 1.3,
            }}
          >
            {product.short_description}
          </p>
        )}

        {/* Add to Cart Button */}
        <div
          className="mt-2 pt-1.5"
          style={{ borderTop: `1px solid ${appearance.border_color}` }}
        >
          <button
            className="w-full flex items-center justify-center gap-0.5 font-medium"
            style={{
              backgroundColor: appearance.button_bg_color,
              color: appearance.button_text_color,
              borderRadius: `${Math.round(parseFloat(btnRadius) * 0.5)}px`,
              fontSize: `${parseFloat(fontScale) * 7.5}px`,
              height: `${parseFloat(fontScale) * 20}px`,
            }}
          >
            <ShoppingCart style={{ width: `${parseFloat(fontScale) * 8}px`, height: `${parseFloat(fontScale) * 8}px` }} />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
