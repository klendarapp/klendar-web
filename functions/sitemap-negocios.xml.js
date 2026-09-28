import { configure, datosDePrueba, rows } from './_lib/page.js';
import { BASE, isSlug } from './_lib/public.js';
import { sitemapVacio, urlPar, urlset } from './_lib/sitemap.js';

// Sitemap de las fichas de negocio (/b/<dirección> y /en/b/<dirección>).
//
// Solo los negocios que cualquiera puede ver (activos y verificados: lo que
// deja leer la base sin cuenta) y ninguno +18, cuya ficha va con noindex.
// Van por su dirección con nombre, que es la URL canónica; la de /b/<id>
// redirige a ella.

const POR_PAGINA = 1000;
const MAXIMO = 20000; // muy por debajo de las 50 000 URL de un sitemap (van dos por negocio)

export async function onRequestGet(ctx) {
  configure(ctx.env);
  // Con los datos de prueba de dev, nada que indexar (ver datosDePrueba).
  if (datosDePrueba()) return sitemapVacio();

  const negocios = [];
  for (let desde = 0; desde < MAXIMO; desde += POR_PAGINA) {
    const filas = await rows('businesses', 'select=slug,updated_at'
      + '&is_active=eq.true&verification_status=eq.verified&adults_only=eq.false'
      + `&order=created_at.asc,id.asc&offset=${desde}&limit=${POR_PAGINA}`);
    negocios.push(...filas);
    if (filas.length < POR_PAGINA) break;
  }

  const urls = negocios.filter((b) => isSlug(b.slug)).map((b) => urlPar(
    `${BASE}/b/${b.slug}`,
    `${BASE}/en/b/${b.slug}`,
    { lastmod: String(b.updated_at || '').slice(0, 10) || undefined, freq: 'weekly', prio: '0.6' },
  ));

  return urlset(urls, 'public, max-age=3600, s-maxage=21600');
}
