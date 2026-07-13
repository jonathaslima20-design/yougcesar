import type { Context } from "https://edge.netlify.com";

const BASE_URL = "https://vitrineturbo.com.br";

const pages = [
  { path: "/", priority: "1.0" },
  { path: "/planos", priority: "0.8" },
  { path: "/funcionalidades", priority: "0.8" },
  { path: "/integracoes", priority: "0.8" },
  { path: "/faq", priority: "0.8" },
];

export default async function handler(_req: Request, _ctx: Context): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];

  const urls = pages
    .map(
      ({ path, priority }) => `
  <url>
    <loc>${BASE_URL}${path}</loc>
    <lastmod>${today}</lastmod>
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
