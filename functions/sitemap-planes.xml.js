import { configure, datosDePrueba, rows, rpcAll } from './_lib/page.js';
import { BASE } from './_lib/public.js';
import { RESPALDO, sitemapVacio, urlPar, urlset } from './_lib/sitemap.js';

// Sitemap de las fichas de cada oferta y evento vivos (/o/<id> y /en/o/<id>;
// Iván, 18-11: «que los eventos salgan en Google»). Antes no había: Google
// solo las encontraba por los enlaces de las agendas.
//
// Solo lo que la ficha deja indexar: vivo (sin terminar), sin +18, para todo
// el mundo (ni exclusivas ni de RRPP) y de un negocio que se puede ver (ni el
// de revisión de las tiendas ni una «Agenda pública de…»). Lo da la base de
// una vez (`public_sitemap_offers`, migración 20261285900000 de la app). Sin
// ella (prod antes de su migración), la tabla `offers` tal y como la deja leer
// sin cuenta (activas, aprobadas, sin +18, para todos y de negocios
// verificados) y aquí se quita lo terminado.
//
// Cambia a menudo: 1 h en el navegador y 1 h en el borde (y 1 día de reserva
// mientras se pinta el nuevo, `_lib/cache.js`).

const MAXIMO = 20000; // dos URL por plan: 40 000, por debajo de las 50 000 de un sitemap
const POR_PAGINA = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Un evento sin hora de fin se da por terminado a las 6 h (como la ficha).
const SEIS_HORAS = 6 * 3600e3;

/** ¿Sigue vivo? (lo mismo que mira la ficha para el noindex de «terminada»). */
function vivo(o, ahora = Date.now()) {
  const t = (x) => (x ? Date.parse(x) : NaN);
  if (o.kind === 'flash_offer') return t(o.redeem_end_at) > ahora;
  const fin = t(o.event_end_at);
  return Number.isFinite(fin) ? fin > ahora : t(o.event_at) + SEIS_HORAS > ahora;
}

async function desdeLaTabla() {
  const filas = [];
  for (let desde = 0; desde < MAXIMO; desde += POR_PAGINA) {
    const pagina = await rows('offers', 'select=id,kind,updated_at,redeem_end_at,event_at,event_end_at'
      + '&status=eq.active&moderation_status=eq.approved&audience=eq.all&adults_only=eq.false'
      + `&order=updated_at.desc,id.asc&offset=${desde}&limit=${POR_PAGINA}`);
    filas.push(...pagina);
    if (pagina.length < POR_PAGINA) break;
  }
  return filas.filter((o) => vivo(o));
}

export async function onRequestGet(ctx) {
  configure(ctx.env);
  // Con los datos de prueba de dev, nada que indexar (ver datosDePrueba).
  if (datosDePrueba()) return sitemapVacio(RESPALDO.agenda);
  const planes = await rpcAll('public_sitemap_offers', { p_limit: MAXIMO }).catch(desdeLaTabla);
  const urls = planes.filter((o) => UUID.test(o?.id || '')).map((o) => urlPar(
    `${BASE}/o/${o.id}`,
    `${BASE}/en/o/${o.id}`,
    { lastmod: String(o.updated_at || '').slice(0, 10) || undefined, freq: 'daily', prio: '0.6' },
  ));
  return urlset(urls, 'public, max-age=3600, s-maxage=3600', RESPALDO.agenda);
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
