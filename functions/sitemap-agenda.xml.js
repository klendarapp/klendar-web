import { configure, rpcAll } from './_lib/page.js';
import { BASE } from './_lib/public.js';

// Sitemap de las agendas por ciudad. Es dinámico porque las ciudades aparecen
// solas: en cuanto un negocio publica en un sitio nuevo, esa agenda existe.

export async function onRequestGet(ctx) {
  configure(ctx.env);
  const cities = (await rpcAll('public_cities', {})).filter((c) => c.city);
  const today = new Date().toISOString().slice(0, 10);
  // Cada ciudad, en español y en inglés, enlazadas entre sí con hreflang.
  const urls = cities.map((c) => {
    const slug = encodeURIComponent(String(c.city).toLowerCase());
    const alt = (es, en) => `
    <xhtml:link rel="alternate" hreflang="es" href="${es}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${es}"/>`;
    const es = `${BASE}/agenda/${slug}/`;
    const en = `${BASE}/en/whats-on/${slug}/`;
    return [es, en].map((loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>${alt(es, en)}
  </url>`).join('\n');
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=21600' },
  });
}
