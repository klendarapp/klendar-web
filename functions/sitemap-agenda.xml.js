import { configure, datosDePrueba, rpcAll } from './_lib/page.js';
import { BASE } from './_lib/public.js';
import { sitemapVacio, urlPar, urlset } from './_lib/sitemap.js';

// Sitemap de las páginas de entrada de cada ciudad: su agenda de la semana,
// «qué hacer hoy», cada categoría con algo publicado y las colecciones. Es
// dinámico porque las ciudades aparecen solas: en cuanto un negocio publica
// en un sitio nuevo, esas páginas existen. Las fichas de negocio van en
// `sitemap-negocios.xml`.

export async function onRequestGet(ctx) {
  configure(ctx.env);
  // Con los datos de prueba de dev, nada que indexar (ver datosDePrueba).
  if (datosDePrueba()) return sitemapVacio();
  const cities = (await rpcAll('public_cities', {})).filter((c) => c.city);
  const collections = await rpcAll('public_collections', {});
  const today = new Date().toISOString().slice(0, 10);

  // Cada ciudad, en español y en inglés, enlazadas entre sí con hreflang:
  // la semana y el «hoy».
  const urls = cities.flatMap((c) => {
    const slug = encodeURIComponent(String(c.city).toLowerCase());
    return [
      urlPar(`${BASE}/agenda/${slug}/`, `${BASE}/en/whats-on/${slug}/`, { lastmod: today, freq: 'daily', prio: '0.7' }),
      urlPar(`${BASE}/hoy/${slug}/`, `${BASE}/en/today/${slug}/`, { lastmod: today, freq: 'daily', prio: '0.7' }),
    ];
  });

  // Cada categoria que hoy tiene algo en cada ciudad: es lo que la gente
  // busca («peluquerias en Madrid») y se llena sola.
  const catUrls = (await Promise.all(cities.map(async (c) => {
    const slug = encodeURIComponent(String(c.city).toLowerCase());
    const cats = await rpcAll('public_categories', { p_city: c.city });
    return cats.map((k) => urlPar(
      `${BASE}/agenda/${slug}/${encodeURIComponent(k.slug)}/`,
      `${BASE}/en/whats-on/${slug}/${encodeURIComponent(k.slug)}/`,
      { lastmod: today, freq: 'daily', prio: '0.6' },
    ));
  }))).flat();

  const colUrls = collections.map((k) => urlPar(
    `${BASE}/coleccion/${encodeURIComponent(k.slug)}/`,
    `${BASE}/en/collection/${encodeURIComponent(k.slug)}/`,
    { lastmod: today, freq: 'daily', prio: '0.6' },
  ));

  return urlset([...urls, ...catUrls, ...colUrls], 'public, max-age=3600, s-maxage=21600');
}
