import { LOCALE_PATH_PREFIXES, type LocalePathPrefix, isLocalePathPrefix } from './config';

const PREFIX_PATTERN = new RegExp(`^/(${LOCALE_PATH_PREFIXES.join('|')})(?=/|$)`);

export function stripLocalePrefix(pathname: string): { locale: LocalePathPrefix | null; rest: string } {
  const match = pathname.match(PREFIX_PATTERN);
  if (!match || !isLocalePathPrefix(match[1])) {
    return { locale: null, rest: pathname };
  }
  const rest = pathname.slice(match[0].length) || '/';
  return { locale: match[1], rest };
}
