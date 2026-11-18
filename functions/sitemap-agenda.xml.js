import { configure, datosDePrueba, rpcAll } from './_lib/page.js';
import { BASE } from './_lib/public.js';
import { sitemapVacio, urlPar, urlset } from './_lib/sitemap.js';
import {
  agendaConContenido, categoriaConContenido, hoyConContenido, lugaresSeo, municipioConContenido,
  ofertasConContenido, provinciaConContenido, provincias, slugProvincia,
} from './_lib/seo.js';

// Sitemap de las páginas de entrada de cada municipio (con su slug sin
// tildes; las variantes y las direcciones de antes dan 301 a esta, así que
// solo sale la buena): su agenda de la semana, «qué hacer hoy», «planes con
// niños», «ofertas», cada categoría con algo publicado, la página de su
// provincia y las colecciones. Es dinámico porque los municipios aparecen
// solos: en cuanto un negocio publica en un sitio nuevo, esas páginas existen.
// Las fichas de negocio van en `sitemap-negocios.xml`; las de cada oferta o
// evento, en `sitemap-planes.xml`.
//
// Solo lo que la página deja indexar (los umbrales de `_lib/seo.js`, los
// mismos que miran las páginas): un municipio con uno o dos planes no sale
// (Google castiga las páginas vacías en masa). tools/seo_check.mjs comprueba
// que nada de aquí lleve noindex.

export async function onRequestGet(ctx) {
  configure(ctx.env);
  // Con los datos de prueba de dev, nada que indexar (ver datosDePrueba).
  if (datosDePrueba()) return sitemapVacio();
  // Todo de una vez (`public_seo_places`, migraciones 20261285900000 y 010 de
  // la app): cada municipio con cuántos planes, ofertas, de la semana, con
  // niños y por categoría. Sin ella (prod antes de su migración), los planes
  // de cada municipio (`public_cities`) y sus categorías y niños de
  // `public_sitemap_places` (migración 20261260100060), como antes.
  const [{ lugares, completa }, collections] = await Promise.all([lugaresSeo(), rpcAll('public_collections', {})]);
  let extra = new Map();
  if (!completa) {
    const sitios = await rpcAll('public_sitemap_places', {}).catch(() => []);
    extra = new Map(sitios.filter((c) => c && c.city).map((c) => [String(c.slug || c.city), c]));
  }
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];
  const par = (es, en, prio = '0.6') => urls.push(urlPar(`${BASE}${es}`, `${BASE}${en}`, { lastmod: today, freq: 'daily', prio }));

  for (const l of lugares.filter(municipioConContenido)) {
    const clave = String(l.slug || l.city);
    const slug = encodeURIComponent(clave.toLowerCase());
    const x = extra.get(clave) || {};
    if (hoyConContenido(l)) par(`/hoy/${slug}`, `/en/today/${slug}`, '0.7');
    if (agendaConContenido(l)) par(`/agenda/${slug}`, `/en/whats-on/${slug}`, '0.7');
    // Con niños: si hay algo para ir con niños (sin nada sería una página vacía).
    if (completa ? l.kids > 0 : x.kids !== false && x.kids !== undefined) par(`/con-ninos/${slug}`, `/en/kids/${slug}`);
    // Ofertas: solo se sabe cuántas con la función nueva.
    if (completa && ofertasConContenido(l)) par(`/ofertas/${slug}`, `/en/deals/${slug}`, '0.7');
    // Cada categoría con lo suficiente: es lo que la gente busca («bares en Málaga»).
    const cats = completa ? l.cats.map((k) => k.slug) : (Array.isArray(x.cats) ? x.cats : []);
    for (const k of cats.filter(Boolean)) {
      if (categoriaConContenido(l, k)) par(`/agenda/${slug}/${encodeURIComponent(k)}`, `/en/whats-on/${slug}/${encodeURIComponent(k)}`);
    }
  }

  // Las provincias con contenido («Planes en la provincia de Málaga»).
  if (completa) {
    for (const p of provincias(lugares).filter(provinciaConContenido)) {
      const s = slugProvincia(p.name);
      if (s) par(`/provincia/${s}`, `/en/province/${s}`, '0.7');
    }
  }

  for (const k of collections) {
    par(`/coleccion/${encodeURIComponent(k.slug)}`, `/en/collection/${encodeURIComponent(k.slug)}`);
  }

  return urlset(urls, 'public, max-age=3600, s-maxage=21600');
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
