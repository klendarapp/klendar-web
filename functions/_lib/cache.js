// La caché del borde de Cloudflare para las páginas públicas que se pintan al
// vuelo (rendimiento, Iván, 18-11). La usa `functions/_middleware.js`.
//
// Por qué: prod (cómputo MICRO) iba saturada y casi todo eran visitas de
// robots a páginas públicas que llaman a la base en cada visita (Explorar y
// Descubre, de 8 a 15 llamadas cada una). Antes ya había caché, pero casi no
// servía: guardaba lo de su `max-age` (60–120 s), Explorar y Descubre llevaban
// `Vary: Cookie` (y lo que lleva `Vary` no se guardaba), Descubre y Explorar
// sin ciudad eran privadas para todos (también para los robots) y los 404 no
// se guardaban.
//
// Ahora:
//  - Se guarda lo que la página declara `public` con `s-maxage`, durante su
//    `s-maxage` (5–15 min; en `html()` de page.js, 300 s), y después se sigue
//    sirviendo hasta `RESERVA` mientras se pinta de nuevo por detrás
//    (`waitUntil`): «stale-while-revalidate» a mano (la Cache API no lo hace).
//    Lo que recibe el navegador no cambia (su `Cache-Control` de siempre).
//  - Las fichas de oferta, menos (5 min y 10 de reserva): se agotan y cambian.
//  - 404 de lo que no existe: 2 min, sin reserva (frena a los robots que
//    prueban ids). Redirecciones 301/308 públicas: hasta 1 h.
//  - Nunca: lo privado o `no-store`, con `Set-Cookie`, 5xx, 302, POST, ni
//    nada pedido con sesión (`Authorization`, `x-klendar-sesion`) o con la
//    cookie de la edad (`klendar_18`): esas se pintan siempre. Tampoco
//    Descubre, Explorar ni una guía que se pintan con la zona aproximada de la
//    conexión de quien pide (`conexion.js`; la página es suya).
//  - La clave: la dirección entera (ruta, idioma —va en la ruta, `/en/…`— y
//    consulta) más `VERSION`. Para tirar todo lo guardado sin entrar en
//    Cloudflare, cambiar `VERSION` y subir.
//  - Cabecera `x-klendar-cache`: HIT, STALE (vieja, ya se está pintando la
//    nueva), MISS (pintada ahora) o BYPASS (no se mira la caché).
//
// La caché es de cada centro de datos de Cloudflare (no global) y solo existe
// en el dominio de verdad (klendar.app), no en *.pages.dev ni en local.

import { dependeDeLaConexion } from './explore.js';
import { zonaDeConexion } from './conexion.js';

export const VERSION = 'v2';

// Las páginas públicas que pasan por aquí.
export const EN_CACHE = /^\/(en\/)?(o|b|a|agenda|whats-on|hoy|today|con-ninos|kids|ofertas|deals|provincia|province|coleccion|collection|explorar|explore|descubre|discover|guia|guide|partidos|matches|grupos|groups|sorteos|giveaways|sorteo|giveaway|cartel|poster|historia|story|widget|m)(\/|$)|^\/sitemap-[a-z]+\.xml$/;

// Cuánto más se puede servir algo caducado mientras se pinta lo nuevo (s).
const RESERVA = [
  [/^\/(en\/)?o\//, 600],
  [/^\/(en\/)?(sorteo|giveaway|sorteos|giveaways)(\/|$)/, 600],
  [/^\/(en\/)?(explorar|explore|descubre|discover|partidos|matches)(\/|$)/, 1800],
  [/^\/sitemap-/, 86400],
];
const RESERVA_DE_SERIE = 3600;
// Las fichas de oferta, como mucho 5 min frescas (se agotan, cambian de hora).
const MAX_OFERTA = 300;
const MAX_404 = 120;
const MAX_REDIRECCION = 3600;
// Una recarga a mano (`Cache-Control: no-cache`, «tirar para actualizar»)
// pinta de nuevo, pero no más de una vez cada 30 s por dirección.
const RECARGA_MIN = 30;

/** ¿Se puede mirar la caché para esta petición? */
export function peticionGuardable(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const h = request.headers;
  if (h.has('authorization') || h.has('x-klendar-sesion')) return false;
  if (/(?:^|;\s*)klendar_18=/.test(h.get('cookie') || '')) return false;
  return true;
}

/** ¿La página sale con la zona de la conexión de quien la pide? */
export function conZonaPropia(url, request) {
  const p = url.pathname;
  const exploraODescubre = /^\/(en\/)?(explorar|explore|descubre|discover)$/.test(p);
  const guiaSinSitio = /^\/(en\/)?(guia|guide)\/[^/]+$/.test(p) && !conPuntoEnUrl(url.searchParams);
  if (!exploraODescubre && !guiaSinSitio) return false;
  if (exploraODescubre && !dependeDeLaConexion(url.searchParams)) return false;
  return zonaDeConexion(request) !== null;
}

const conPuntoEnUrl = (qs) => {
  const lat = Number.parseFloat(qs.get('lat') || '');
  const lng = Number.parseFloat(qs.get('lng') || '');
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
};

/** { frescos, reserva } en segundos para guardar esta respuesta, o null. */
export function tiempos(pathname, res) {
  if (![200, 404, 301, 308].includes(res.status) || res.headers.has('set-cookie')) return null;
  const vary = (res.headers.get('vary') || '').toLowerCase().split(',').map((v) => v.trim()).filter(Boolean);
  // `Vary: Cookie`: la única cookie que cambia algo es la de la edad, y con
  // ella no se llega aquí. Cualquier otra (la IP, una sesión), fuera.
  if (vary.some((v) => v !== 'cookie' && v !== 'accept-encoding')) return null;
  const cc = (res.headers.get('cache-control') || '').toLowerCase();
  if (!/\bpublic\b/.test(cc) || /\b(private|no-store|no-cache)\b/.test(cc)) return null;
  let frescos = Number((/\bs-maxage=(\d+)/.exec(cc) || [])[1] || 0);
  if (!(frescos > 0)) return null;
  if (res.status === 404) return { frescos: Math.min(frescos, MAX_404), reserva: 0 };
  if (res.status !== 200) return { frescos: Math.min(frescos, MAX_REDIRECCION), reserva: 0 };
  if (/^\/(en\/)?o\//.test(pathname)) frescos = Math.min(frescos, MAX_OFERTA);
  const reserva = (RESERVA.find(([re]) => re.test(pathname)) || [null, RESERVA_DE_SERIE])[1];
  // Lo que se pide que dure muy poco (el QR de una mesa, 30 s) tampoco se
  // sirve viejo mucho más.
  return { frescos, reserva: Math.min(reserva, frescos * 4) };
}

const claveDe = (url) => {
  const u = new URL(url.toString());
  u.hash = '';
  u.searchParams.append('__borde', VERSION);
  return new Request(u.toString(), { method: 'GET' });
};

// Lo que ya se está pintando de nuevo en esta copia (para no pintarlo dos veces).
const pintando = new Set();

/** La respuesta para el navegador a partir de la guardada. */
function paraElNavegador(guardada, estado, head) {
  const h = new Headers(guardada.headers);
  const cc = h.get('x-klendar-cc');
  if (cc) h.set('cache-control', cc); else h.delete('cache-control');
  const vary = h.get('x-klendar-vary');
  if (vary) h.set('vary', vary);
  h.delete('x-klendar-cc');
  h.delete('x-klendar-vary');
  h.delete('x-klendar-en');
  h.set('x-klendar-cache', estado);
  return new Response(head ? null : guardada.body, { status: guardada.status, statusText: guardada.statusText, headers: h });
}

/** Guarda `res` (si se puede) y devuelve la que va al navegador. */
function guarda(ctx, cache, clave, pathname, res, estado) {
  const t = tiempos(pathname, res);
  const fuera = new Response(res.body, res);
  fuera.headers.set('x-klendar-cache', estado);
  if (!t) return { res: fuera, promesa: null };
  const [paraNavegador, paraGuardar] = fuera.body ? fuera.body.tee() : [null, null];
  const salida = new Response(paraNavegador, fuera);
  const copia = new Response(paraGuardar, fuera);
  copia.headers.delete('x-klendar-cache');
  copia.headers.set('x-klendar-cc', res.headers.get('cache-control') || '');
  // `Vary` aparte: la cookie de la edad ya se mira antes (`peticionGuardable`)
  // y la Cache API de Cloudflare no se lleva bien con él.
  if (copia.headers.has('vary')) { copia.headers.set('x-klendar-vary', copia.headers.get('vary')); copia.headers.delete('vary'); }
  copia.headers.set('x-klendar-en', String(Date.now()));
  // La Cache API la borra sola pasado frescos + reserva.
  copia.headers.set('cache-control', `public, max-age=${t.frescos + t.reserva}`);
  const promesa = cache.put(clave, copia).catch(() => {});
  return { res: salida, promesa };
}

/**
 * La página desde la caché del borde, o pintada (`pinta()`, que llama a
 * `ctx.next()`: solo se puede llamar una vez por petición) y guardada.
 */
export async function desdeLaCache(ctx, url, head, pinta) {
  const cache = globalThis.caches?.default;
  const espera = (p) => { if (p && typeof ctx.waitUntil === 'function') ctx.waitUntil(p); };
  if (!cache || !peticionGuardable(ctx.request) || conZonaPropia(url, ctx.request)) {
    const res = await pinta();
    const fuera = new Response(res.body, res);
    if (cache) fuera.headers.set('x-klendar-cache', 'BYPASS');
    return fuera;
  }
  const clave = claveDe(url);
  let guardada = null;
  try { guardada = await cache.match(clave); } catch { /* sin caché: se pinta */ }
  if (guardada) {
    const en = Number(guardada.headers.get('x-klendar-en')) || 0;
    const edad = (Date.now() - en) / 1000;
    const t = tiempos(url.pathname, new Response(null, {
      status: guardada.status,
      headers: { 'cache-control': guardada.headers.get('x-klendar-cc') || '', vary: guardada.headers.get('x-klendar-vary') || '' },
    }));
    const recarga = /\bno-cache\b/i.test(ctx.request.headers.get('cache-control') || '') && edad > RECARGA_MIN;
    if (t && !recarga && edad >= 0 && edad <= t.frescos) return paraElNavegador(guardada, 'HIT', head);
    if (t && !recarga && edad >= 0 && edad <= t.frescos + t.reserva) {
      // Vieja pero aún en reserva: sale ya y la nueva se pinta por detrás.
      const k = clave.url;
      if (!pintando.has(k)) {
        pintando.add(k);
        espera((async () => {
          try {
            const nueva = await pinta();
            const { res, promesa } = guarda(ctx, cache, clave, url.pathname, nueva, 'MISS');
            await Promise.all([promesa, res.body ? res.body.cancel().catch(() => {}) : null]);
          } catch { /* se queda la vieja */ } finally { pintando.delete(k); }
        })());
      }
      return paraElNavegador(guardada, 'STALE', head);
    }
    // Más vieja que la reserva (o recarga a mano): se pinta ahora.
    if (guardada.body) guardada.body.cancel().catch(() => {});
  }
  const { res, promesa } = guarda(ctx, cache, clave, url.pathname, await pinta(), 'MISS');
  espera(promesa);
  return res;
}
