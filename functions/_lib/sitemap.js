// Piezas comunes de los sitemaps dinámicos (agenda y negocios).

const NL = String.fromCharCode(10);
const CABECERA = { 'content-type': 'application/xml; charset=utf-8' };

/** Mientras la web enseña los datos de prueba de dev: un sitemap sin nada. */
export const sitemapVacio = () => new Response(
  `<?xml version="1.0" encoding="UTF-8"?>${NL}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>${NL}`,
  { headers: { ...CABECERA, 'cache-control': 'public, max-age=3600' } },
);

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** La misma página en español y en inglés: dos <url>, enlazadas con hreflang. */
export function urlPar(es, en, { lastmod, freq = 'daily', prio = '0.5' } = {}) {
  const alt = [
    `    <xhtml:link rel="alternate" hreflang="es" href="${xml(es)}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${xml(en)}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xml(es)}"/>`,
  ].join(NL);
  return [es, en].map((loc) => [
    '  <url>',
    `    <loc>${xml(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    `    <changefreq>${freq}</changefreq>`,
    `    <priority>${prio}</priority>`,
    alt,
    '  </url>',
  ].filter(Boolean).join(NL)).join(NL);
}

/** El sitemap entero. */
export const urlset = (urls, cache) => new Response([
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...urls,
  '</urlset>',
  '',
].join(NL), { headers: { ...CABECERA, 'cache-control': cache } });
