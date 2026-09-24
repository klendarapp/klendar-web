import { rpcAll } from './_lib/page.js';
import { BASE } from './_lib/public.js';

// Sitemap de las agendas por ciudad. Es dinámico porque las ciudades aparecen
// solas: en cuanto un negocio publica en un sitio nuevo, esa agenda existe.

export async function onRequestGet() {
  const cities = (await rpcAll('public_cities', {})).filter((c) => c.city);
  const today = new Date().toISOString().slice(0, 10);
  const urls = cities.map((c) => `  <url>
    <loc>${BASE}/agenda/${encodeURIComponent(String(c.city).toLowerCase())}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=21600' },
  });
}
