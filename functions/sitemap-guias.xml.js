import { configure, datosDePrueba } from './_lib/page.js';
import { BASE } from './_lib/public.js';
import { sitemapVacio, urlPar, urlset } from './_lib/sitemap.js';
import { guiasParaSitemap } from './_lib/guias.js';

// Sitemap de las guías de temporada (/guia/<slug> y /en/guide/<slug>): las
// vivas y las que están por empezar (`public_guides`). Una terminada sale
// sola (su página dice que ha terminado, con noindex).

export async function onRequestGet(ctx) {
  configure(ctx.env);
  // Con los datos de prueba de dev, nada que indexar (ver datosDePrueba).
  if (datosDePrueba()) return sitemapVacio();
  const guias = await guiasParaSitemap();
  const urls = (guias || []).filter((g) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(g?.slug || '')).map((g) => urlPar(
    `${BASE}/guia/${g.slug}`,
    `${BASE}/en/guide/${g.slug}`,
    { freq: 'daily', prio: '0.7' },
  ));
  return urlset(urls, 'public, max-age=3600, s-maxage=21600');
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
