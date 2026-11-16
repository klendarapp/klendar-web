import { configure, datosDePrueba } from './_lib/page.js';
import { BASE } from './_lib/public.js';
import { sitemapVacio, urlPar, urlset } from './_lib/sitemap.js';
import { guiasParaSitemap, sitiosDeGuia } from './_lib/guias.js';

// Sitemap de las guías de temporada: cada guía viva o por empezar
// (`public_guides`; /guia/<slug> y /en/guide/<slug>) y, sobre todo, una
// página por municipio con planes (`guide_places`; /guia/<slug>/<municipio>):
// «Navidad en Málaga» es lo que se busca en Google. Una terminada sale sola
// (su página dice que ha terminado, con noindex).

export async function onRequestGet(ctx) {
  configure(ctx.env);
  // Con los datos de prueba de dev, nada que indexar (ver datosDePrueba).
  if (datosDePrueba()) return sitemapVacio();
  const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const guias = (await guiasParaSitemap() || []).filter((g) => SLUG.test(g?.slug || ''));
  const urls = [];
  for (const g of guias.slice(0, 20)) {
    urls.push(urlPar(`${BASE}/guia/${g.slug}`, `${BASE}/en/guide/${g.slug}`, { freq: 'daily', prio: '0.6' }));
    for (const m of (await sitiosDeGuia(g.slug) || []).filter((x) => SLUG.test(x?.slug || ''))) {
      urls.push(urlPar(`${BASE}/guia/${g.slug}/${m.slug}`, `${BASE}/en/guide/${g.slug}/${m.slug}`, { freq: 'daily', prio: '0.7' }));
    }
  }
  return urlset(urls, 'public, max-age=3600, s-maxage=21600');
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
