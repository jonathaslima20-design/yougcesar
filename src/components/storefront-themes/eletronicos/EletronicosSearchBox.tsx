import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCurrencyI18n } from '@/lib/i18n';
import { getResizedImageUrl } from '@/lib/imageUrl';
import { suggestProducts, suggestCategories, type CatalogRow } from '@/components/storefront-themes/eletronicos/eletronicosCatalog';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter / the search button: run the full search. */
  onSubmit: () => void;
  rows: CatalogRow[];
  categories: string[];
  onPickCategory: (category: string) => void;
  productHref: (product: { id: string; slug?: string | null }) => string;
  currency: string;
  language: string;
  buttonStyle: { backgroundColor: string; color: string };
  inputClassName?: string;
  buttonClassName?: string;
  autoFocus?: boolean;
}

/**
 * Search field with instant suggestions (products + categories) drawn from the
 * lightweight catalog summary — no request per keystroke, and accent-insensitive
 * ("camera" finds "Câmera"). Enter still runs the full server-side search.
 */
export default function EletronicosSearchBox({
  value, onChange, onSubmit, rows, categories, onPickCategory, productHref, currency, language,
  buttonStyle, inputClassName, buttonClassName, autoFocus,
}: SearchBoxProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 120);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const query = debounced.trim();
  const products = useMemo(() => (query.length >= 2 ? suggestProducts(rows, query) : []), [rows, query]);
  const matchedCategories = useMemo(() => (query.length >= 2 ? suggestCategories(categories, query) : []), [categories, query]);
  const showList = open && query.length >= 2 && (products.length > 0 || matchedCategories.length > 0);

  // Flat list for keyboard navigation: categories first, then products.
  const items = [
    ...matchedCategories.map((c) => ({ type: 'category' as const, key: `c-${c}`, category: c })),
    ...products.map((p) => ({ type: 'product' as const, key: `p-${p.id}`, product: p })),
  ];

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && showList) {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter') {
      const item = showList && active >= 0 ? items[active] : null;
      setOpen(false);
      if (item?.type === 'category') {
        onPickCategory(item.category);
      } else if (item?.type === 'product') {
        navigate(productHref(item.product));
      } else {
        onSubmit();
      }
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="O que deseja procurar?"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          onSubmit();
        }}
        className={cn('absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded hover:opacity-90', buttonClassName)}
        style={buttonStyle}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
      </button>

      {showList && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-background text-foreground shadow-lg overflow-hidden"
        >
          {matchedCategories.map((category, i) => (
            <button
              key={category}
              type="button"
              role="option"
              aria-selected={active === i}
              onClick={() => {
                setOpen(false);
                onPickCategory(category);
              }}
              className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted', active === i && 'bg-muted')}
            >
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <span>Ver tudo em <strong>{category}</strong></span>
            </button>
          ))}
          {products.map((product, i) => {
            const index = matchedCategories.length + i;
            return (
              <Link
                key={product.id}
                to={productHref(product)}
                role="option"
                aria-selected={active === index}
                onClick={() => setOpen(false)}
                className={cn('flex items-center gap-3 px-3 py-2 hover:bg-muted', active === index && 'bg-muted')}
              >
                <span className="h-10 w-10 shrink-0 rounded border bg-white overflow-hidden">
                  {product.image && (
                    <img src={getResizedImageUrl(product.image, 96)} alt="" className="h-full w-full object-contain" loading="lazy" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate">{product.title}</span>
                  {product.displayPrice > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {formatCurrencyI18n(product.displayPrice, currency as any, language as any)}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
