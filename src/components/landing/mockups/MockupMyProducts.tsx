interface MyProductItem {
  title: string;
  image_url: string;
  price: number;
  views_count: number;
  status: 'visible' | 'hidden';
  stock_qty: number;
}

interface MyProductsConfig {
  page_title?: string;
  product_count?: number;
  view_mode?: 'grid' | 'list';
  products?: MyProductItem[];
}

export function MockupMyProducts({ config }: { config: MyProductsConfig }) {
  const products = config.products || [];
  const viewMode = config.view_mode || 'grid';

  return (
    <div className="w-full relative bg-gray-50">
      <div style={{ width: 393 }}>
        <div className="px-4 py-6 space-y-4">
          {/* Header - exact ListingsHeader structure */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {config.page_title || 'Meus Produtos'}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {config.product_count || products.length} produto(s) cadastrado(s)
                </p>
              </div>
              <div className="h-8 px-3 rounded-md bg-gray-900 text-white text-xs flex items-center gap-1.5 font-medium shadow-sm">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Novo Produto
              </div>
            </div>

            {/* Toolbar - exact view toggle + reorder */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* View mode toggle - exact bg-muted/60 rounded-lg p-0.5 */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200/50">
                <button className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'
                }`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'
                }`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Reorder button */}
              <div className="h-8 px-3 rounded-md border border-gray-200 bg-white text-xs flex items-center gap-1.5 text-gray-700 font-medium">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="22" /><path d="M17 7l-5-5-5 5M7 17l5 5 5-5" />
                </svg>
                Reordenar
              </div>
            </div>
          </div>

          {/* Search bar - exact pl-9 h-9 structure */}
          <div className="relative max-w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <div className="w-full h-9 pl-9 rounded-md border border-gray-200 bg-white flex items-center">
              <span className="text-sm text-gray-400">Buscar por nome, categoria ou marca...</span>
            </div>
          </div>

          {/* Filter pills - exact rounded-full px-3 py-1 text-xs */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-900 text-white shadow-sm">
              Todos
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200/50">
              Visiveis
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200/50">
              Ocultos
            </span>
          </div>

          {/* Product Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3">
              {products.slice(0, 6).map((product, i) => (
                <GridProductCard key={i} product={product} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {products.slice(0, 5).map((product, i) => (
                <ListProductRow key={i} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GridProductCard({ product }: { product: MyProductItem }) {
  const isVisible = product.status === 'visible';

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden ${!isVisible ? 'opacity-60' : ''}`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-white">
        {product.image_url ? (
          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <span className="text-gray-400 text-[10px]">Sem imagem</span>
          </div>
        )}

        {/* Checkbox top-left */}
        <div className="absolute top-2 left-2 z-10">
          <div className="h-4 w-4 rounded border-2 border-gray-300 bg-white/95" />
        </div>

        {/* Hidden overlay */}
        {!isVisible && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5 space-y-1.5">
        {/* Title */}
        <h3 className="font-semibold text-[11px] leading-tight line-clamp-2 text-gray-900">
          {product.title}
        </h3>

        {/* Price */}
        <div className="text-xs font-bold" style={{ color: '#0f172a' }}>
          R$ {product.price.toFixed(2).replace('.', ',')}
        </div>

        {/* Analytics */}
        {(product.views_count > 0 || product.stock_qty >= 0) && (
          <div className="flex items-center gap-2.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-0.5">
              {/* Eye icon */}
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              {product.views_count}
            </span>
            <span className="flex items-center gap-0.5">
              {/* MessageCircle icon */}
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              {product.stock_qty}
            </span>
          </div>
        )}

        {/* Footer: visibility badge + toggle */}
        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
          <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${
            isVisible
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {isVisible ? (
              <>
                <svg className="h-2.5 w-2.5 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Visivel
              </>
            ) : (
              <>
                <svg className="h-2.5 w-2.5 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                Oculto
              </>
            )}
          </span>
          {/* Toggle switch */}
          <div
            className="relative inline-flex items-center rounded-full transition-colors"
            style={{
              width: 28, height: 16,
              backgroundColor: isVisible ? '#10b981' : '#d1d5db',
            }}
          >
            <div
              className="absolute rounded-full bg-white shadow-sm transition-transform"
              style={{
                width: 12, height: 12,
                transform: isVisible ? 'translateX(14px)' : 'translateX(2px)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ListProductRow({ product }: { product: MyProductItem }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white ${
      product.status === 'hidden' ? 'opacity-60' : ''
    }`}>
      {/* Checkbox */}
      <div className="h-4 w-4 rounded border border-gray-300 bg-white shrink-0" />

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 shrink-0">
        {product.image_url ? (
          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-gray-900 truncate">{product.title}</h3>
        <p className="text-xs text-gray-500">R$ {product.price.toFixed(2).replace('.', ',')}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
          </svg>
          {product.views_count}
        </span>
        <span>{product.stock_qty} un.</span>
      </div>

      {/* More button */}
      <div className="shrink-0">
        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </div>
    </div>
  );
}
