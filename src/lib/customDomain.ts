// Shared with the inline script in index.html (kept duplicated there since it
// runs before any module loads) — update both if this list changes.
const KNOWN_HOSTS = [
  'vitrineturbo.com', 'www.vitrineturbo.com',
  'vitrineturbo.com.br', 'www.vitrineturbo.com.br',
  'localhost', '127.0.0.1',
];

export function isCustomDomainHostname(hostname: string): boolean {
  if (KNOWN_HOSTS.includes(hostname)) return false;
  if (hostname.endsWith('.netlify.app')) return false;
  if (hostname.endsWith('.vercel.app')) return false;
  if (hostname.endsWith('.bolt.host')) return false;
  return true;
}
