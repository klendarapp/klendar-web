import { configure, datosDePrueba, rpcAll } from './_lib/page.js';
import { BASE } from './_lib/public.js';
import { sitemapVacio, urlPar, urlset } from './_lib/sitemap.js';
import KA from '../assets/artistas.js';

// Sitemap de las páginas de artista (/a/<dirección> y /en/a/<dirección>).
//
// Solo los artistas que se ven (ni ocultos ni fusionados) y con alguna fecha
// pública viva: lo que da la base sin cuenta (`public_artist_slugs`). Van
// por su dirección con nombre, que es la URL canónica; una vieja redirige.

const MAXIMO = 20000; // muy por debajo de las 50 000 URL de un sitemap (van dos por artista)

export async function onRequestGet(ctx) {
  configure(ctx.env);
  // Con los datos de prueba de dev, nada que indexar (ver datosDePrueba).
  if (datosDePrueba()) return sitemapVacio();

  const artistas = await rpcAll('public_artist_slugs', { p_limit: MAXIMO });
  const urls = artistas.filter((a) => KA.esSlug(a?.slug)).map((a) => urlPar(
    `${BASE}/a/${a.slug}`,
    `${BASE}/en/a/${a.slug}`,
    { lastmod: String(a.updated_at || '').slice(0, 10) || undefined, freq: 'weekly', prio: '0.5' },
  ));

  return urlset(urls, 'public, max-age=3600, s-maxage=21600');
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
