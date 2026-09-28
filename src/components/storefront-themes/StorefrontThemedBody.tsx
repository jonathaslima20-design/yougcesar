import { useStorefrontTheme } from '@/contexts/StorefrontThemeContext';
import CorretorPageDefault from '@/components/storefront-themes/padrao/CorretorPageDefault';
import CorretorPageEletronicos from '@/components/storefront-themes/eletronicos/CorretorPageEletronicos';
import type { StorefrontPageBodyProps } from '@/components/storefront-themes/types';

/**
 * Must be rendered inside <StorefrontThemeProvider> so useStorefrontTheme()
 * resolves the store's chosen theme_id. Add new themes to this map — CorretorPage.tsx
 * never needs to change when a theme is added.
 */
const STOREFRONT_HOME_THEMES: Record<string, (props: StorefrontPageBodyProps) => JSX.Element> = {
  padrao: CorretorPageDefault,
  eletronicos: CorretorPageEletronicos,
};

export default function StorefrontThemedBody(props: StorefrontPageBodyProps) {
  const { themeId } = useStorefrontTheme();
  const ThemeComponent = STOREFRONT_HOME_THEMES[themeId] || CorretorPageDefault;
  return <ThemeComponent {...props} />;
}
