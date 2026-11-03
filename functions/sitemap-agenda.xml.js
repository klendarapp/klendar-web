import { configure, datosDePrueba, rpcAll } from './_lib/page.js';
import { BASE } from './_lib/public.js';
import { sitemapVacio, urlPar, urlset } from './_lib/sitemap.js';

// Sitemap de las páginas de entrada de cada municipio (con su slug sin
// tildes, `public_cities`; las variantes y las direcciones de antes dan 301 a
// esta, así que solo sale la buena): su agenda de la semana,
// «qué hacer hoy», «planes con niños», cada categoría con algo publicado y las colecciones. Es
// dinámico porque las ciudades aparecen solas: en cuanto un negocio publica
// en un sitio nuevo, esas páginas existen. Las fichas de negocio van en
// `sitemap-negocios.xml`.

export async function onRequestGet(ctx) {
  configure(ctx.env);
  // Con los datos de prueba de dev, nada que indexar (ver datosDePrueba).
  if (datosDePrueba()) return sitemapVacio();
  // Todo de una vez (`public_sitemap_places`, migración 20261260100060 de la
  // app): cada municipio con sus categorías con algo y si hay planes con
  // niños. Antes era una llamada por municipio y, con el plan gratis de
  // Cloudflare (50 subpeticiones), fallaba entero a partir de unos 48
  // (revisión del 3-11-2026, 5.5). Si la base aún no la tiene (prod antes
  // de su migración), lo de antes, con un tope para no pasarse.
  const [lugares, collections] = await Promise.all([
    rpcAll('public_sitemap_places', {}).then((l) => ({ l }), async () => {
      const cities = (await rpcAll('public_cities', {})).filter((c) => c.city).slice(0, 40);
      const l = await Promise.all(cities.map(async (c) => ({
        city: c.city, slug: c.slug, kids: true,
        cats: (await rpcAll('public_categories', { p_city: c.slug || c.city }).catch(() => [])).map((k) => k.slug),
      })));
      return { l };
    }),
    rpcAll('public_collections', {}),
  ]);
  const cities = lugares.l.filter((c) => c && c.city);
  const today = new Date().toISOString().slice(0, 10);

  // Cada ciudad, en español y en inglés, enlazadas entre sí con hreflang:
  // la semana, el «hoy» y, si hay algo para ir con niños, esa página (sin
  // nada sería una página vacía).
  const urls = cities.flatMap((c) => {
    const slug = encodeURIComponent(String(c.slug || c.city).toLowerCase());
    return [
      urlPar(`${BASE}/agenda/${slug}/`, `${BASE}/en/whats-on/${slug}/`, { lastmod: today, freq: 'daily', prio: '0.7' }),
      urlPar(`${BASE}/hoy/${slug}/`, `${BASE}/en/today/${slug}/`, { lastmod: today, freq: 'daily', prio: '0.7' }),
      ...(c.kids === false ? [] : [urlPar(`${BASE}/con-ninos/${slug}/`, `${BASE}/en/kids/${slug}/`, { lastmod: today, freq: 'daily', prio: '0.6' })]),
    ];
  });

  // Cada categoria que hoy tiene algo en cada ciudad: es lo que la gente
  // busca («peluquerias en Madrid») y se llena sola.
  const catUrls = cities.flatMap((c) => {
    const slug = encodeURIComponent(String(c.slug || c.city).toLowerCase());
    return (Array.isArray(c.cats) ? c.cats : []).filter(Boolean).map((k) => urlPar(
      `${BASE}/agenda/${slug}/${encodeURIComponent(k)}/`,
      `${BASE}/en/whats-on/${slug}/${encodeURIComponent(k)}/`,
      { lastmod: today, freq: 'daily', prio: '0.6' },
    ));
  });

  const colUrls = collections.map((k) => urlPar(
    `${BASE}/coleccion/${encodeURIComponent(k.slug)}/`,
    `${BASE}/en/collection/${encodeURIComponent(k.slug)}/`,
    { lastmod: today, freq: 'daily', prio: '0.6' },
  ));

  return urlset([...urls, ...catUrls, ...colUrls], 'public, max-age=3600, s-maxage=21600');
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
