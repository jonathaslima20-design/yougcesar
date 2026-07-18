import type { Context } from "https://edge.netlify.com";

const BASE_URL = "https://vitrineturbo.com.br";

const pages = [
  { path: "/", priority: "1.0" },
  { path: "/blog", priority: "0.7" },
  { path: "/register", priority: "0.6" },
  { path: "/help", priority: "0.6" },
  { path: "/login", priority: "0.3" },
  { path: "/politica-de-privacidade", priority: "0.2" },
  { path: "/politica-de-cookies", priority: "0.2" },
  { path: "/termos-de-uso", priority: "0.2" },
  { path: "/termos-indicacoes", priority: "0.2" },
];

interface BlogPostRow {
  slug: string;
  updated_at: string;
}

interface BlogCategoryRow {
  slug: string;
  updated_at: string;
}

async function fetchBlogUrls(supabaseUrl: string, supabaseKey: string) {
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" };

  const [postsRes, categoriesRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/blog_posts?is_published=eq.true&select=slug,updated_at`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/blog_categories?is_active=eq.true&select=slug,updated_at`, { headers }),
  ]);

  const posts: BlogPostRow[] = postsRes.ok ? await postsRes.json() : [];
  const categories: BlogCategoryRow[] = categoriesRes.ok ? await categoriesRes.json() : [];

  return [
    ...posts.map(p => ({ path: `/blog/${p.slug}`, priority: "0.6", lastmod: p.updated_at })),
    ...categories.map(c => ({ path: `/blog/categoria/${c.slug}`, priority: "0.5", lastmod: c.updated_at })),
  ];
}

export default async function handler(_req: Request, ctx: Context): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];

  const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL") || ctx.site.env.get("VITE_SUPABASE_URL");
  const supabaseKey = Deno.env.get("VITE_SUPABASE_ANON_KEY") || ctx.site.env.get("VITE_SUPABASE_ANON_KEY");

  const dynamicUrls = supabaseUrl && supabaseKey
    ? await fetchBlogUrls(supabaseUrl, supabaseKey).catch(() => [])
    : [];

  const allUrls = [
    ...pages.map(p => ({ ...p, lastmod: today })),
    ...dynamicUrls.map(u => ({ ...u, lastmod: u.lastmod ? u.lastmod.split("T")[0] : today })),
  ];

  const urls = allUrls
    .map(
      ({ path, priority, lastmod }) => `
  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
