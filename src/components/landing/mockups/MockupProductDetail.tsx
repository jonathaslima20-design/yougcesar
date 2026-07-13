import { useState } from 'react';

interface ProductDetailConfig {
  product_image_url?: string;
  product_images?: string[];
  product_title?: string;
  product_description?: string;
  price?: number;
  discount_price?: number | null;
  discount_badge?: string;
  color_options?: string[];
  size_options?: string[];
  button_text?: string;
  button_color?: string;
  seller_avatar_url?: string;
  seller_name?: string;
}

export function MockupProductDetail({ config }: { config: ProductDetailConfig }) {
  const buttonColor = config.button_color || '#0f172a';
  const hasDiscount = config.discount_price && config.discount_price < (config.price || 0);

  const allImages: (string | null)[] = (() => {
    const imgs: (string | null)[] = [null, null, null, null];
    if (config.product_images && config.product_images.length > 0) {
      config.product_images.slice(0, 4).forEach((url, i) => { imgs[i] = url || null; });
    } else if (config.product_image_url) {
      imgs[0] = config.product_image_url;
    }
    return imgs;
  })();

  const firstValidIndex = allImages.findIndex(img => !!img);
  const [selectedIndex, setSelectedIndex] = useState(firstValidIndex >= 0 ? firstValidIndex : 0);

  const mainImage = allImages[selectedIndex] || allImages.find(img => !!img) || null;

  return (
    <div className="w-full relative bg-white">
      <div style={{ width: 393 }}>
        {/* Back button area */}
        <div className="px-4 py-4">
          <div className="flex items-center text-gray-600">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Voltar para vitrine</span>
          </div>
        </div>

        {/* Main content section */}
        <section className="px-4">
          {/* Badges row */}
          <div className="flex gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
              Categoria
            </span>
            {hasDiscount && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">
                {config.discount_badge || `-${Math.round(((config.price! - config.discount_price!) / config.price!) * 100)}% OFF`}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900">
            {config.product_title || 'Nome do Produto'}
          </h1>

          {/* Price section */}
          <div className="mt-6 mb-8">
            {hasDiscount ? (
              <div className="space-y-2">
                <div className="text-lg text-gray-400 line-through">
                  R$ {(config.price || 0).toFixed(2).replace('.', ',')}
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  R$ {config.discount_price!.toFixed(2).replace('.', ',')}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-3xl font-bold text-gray-900">
                  R$ {(config.price || 0).toFixed(2).replace('.', ',')}
                </div>
              </div>
            )}
          </div>

          {/* Image Gallery */}
          <div className="mb-8">
            <div className="aspect-square overflow-hidden rounded-lg relative bg-gray-100">
              {mainImage ? (
                <img src={mainImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <svg className="h-16 w-16 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              )}

              {/* Discount badge on image */}
              {hasDiscount && config.discount_badge && (
                <div className="absolute top-3 left-3">
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-md font-bold">
                    {config.discount_badge}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail row */}
            <div className="grid grid-cols-12 gap-4 mt-4">
              {[0, 1, 2, 3].map(i => {
                const thumbImg = allImages[i];
                const isSelected = i === selectedIndex;
                return (
                  <div key={i} className="col-span-3" onClick={() => thumbImg && setSelectedIndex(i)} style={{ cursor: thumbImg ? 'pointer' : 'default' }}>
                    <div className={`aspect-[4/3] overflow-hidden rounded-lg border-2 ${
                      isSelected && thumbImg ? 'border-gray-900 shadow-md' : 'border-transparent'
                    }`}>
                      {thumbImg ? (
                        <img src={thumbImg} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color selector */}
          {config.color_options && config.color_options.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Cores Disponiveis</h3>
              <div className="flex flex-wrap gap-3">
                {config.color_options.map((color, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white"
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm capitalize text-gray-900">
                      {getColorName(color)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Size selector */}
          {config.size_options && config.size_options.length > 0 && (
            <div className="space-y-3 mt-6">
              <h3 className="text-lg font-semibold text-gray-900">Tamanhos Disponiveis</h3>
              <div className="flex flex-wrap gap-3">
                {config.size_options.map((size, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-center w-12 h-12 rounded-full border-2 shadow-sm ${
                      i === 0 ? 'border-gray-900 bg-white' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-900">{size}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA Button */}
          <div className="mt-8">
            <div
              className="w-full h-11 rounded-md flex items-center justify-center text-sm font-medium text-white"
              style={{ backgroundColor: buttonColor }}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              {config.button_text || 'Adicionar ao Carrinho'}
            </div>
          </div>

          {/* Description section */}
          {config.product_description && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Descrição</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                {config.product_description}
              </p>
            </div>
          )}

          {/* Seller info */}
          {config.seller_name && (
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                {config.seller_avatar_url ? (
                  <img src={config.seller_avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-gray-500">
                    {config.seller_name[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{config.seller_name}</p>
                <p className="text-xs text-gray-500">Vendedor</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function getColorName(hex: string): string {
  const map: Record<string, string> = {
    '#000000': 'preto', '#ffffff': 'branco', '#ff0000': 'vermelho',
    '#00ff00': 'verde', '#0000ff': 'azul', '#1e40af': 'azul',
    '#dc2626': 'vermelho', '#f59e0b': 'amarelo', '#10b981': 'verde',
  };
  return map[hex.toLowerCase()] || hex;
}
