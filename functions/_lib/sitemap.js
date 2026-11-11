// Piezas comunes de los sitemaps dinámicos (agenda, artistas y negocios).
import { BASE } from './public.js';

const NL = String.fromCharCode(10);
const CABECERA = { 'content-type': 'application/xml; charset=utf-8' };

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

/** Lo que lleva un sitemap que se queda sin nada: Google Search Console da
 * «Falta la etiqueta XML» con un <urlset> vacío (sitemap-artistas.xml, sin
 * artistas con fechas en prod, 11-11). Con al menos una URL buena y de lo
 * suyo no hay error: la agenda para los de agenda y artistas, Explorar para
 * el de negocios. */
export const RESPALDO = {
  agenda: ['/agenda', '/en/whats-on'],
  negocios: ['/explorar', '/en/explore'],
};

/** El sitemap entero; sin nada, el respaldo ([es, en]) para que no esté vacío. */
export const urlset = (urls, cache, respaldo = RESPALDO.agenda) => new Response([
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...(urls.length ? urls : [urlPar(`${BASE}${respaldo[0]}`, `${BASE}${respaldo[1]}`, { freq: 'daily', prio: '0.5' })]),
  '</urlset>',
  '',
].join(NL), { headers: { ...CABECERA, 'cache-control': cache } });

/** Mientras la web enseña los datos de prueba de dev: nada que indexar, solo
 * el respaldo (un sitemap vacío da error en Search Console). */
export const sitemapVacio = (respaldo = RESPALDO.agenda) => urlset([], 'public, max-age=3600', respaldo);
