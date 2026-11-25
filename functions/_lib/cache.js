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
//    cookie de la edad (`klendar_18`): esas se pintan siempre. Tampoco una
//    guía que se pinta con la zona aproximada de la conexión de quien pide
//    (`conexion.js`; la página es suya).
//  - Descubre y Explorar (Iván, 23-11; RUNBOOK §4zzz-explorar): 3 min y 2 más
//    servidas viejas. «Cerca de mí» va como la celda de 5 km en la dirección
//    (assets/celda.js), así que ya es una clave como otra. Con la zona de la
//    conexión o la cookie de la edad, la página dice `private` al navegador
//    y `x-klendar-borde: s-maxage=N` a esta caché, que la guarda con la celda
//    de esa zona (`celdaDeConexion`, la misma que usa la página) y la
//    respuesta a la edad («0» o «1») en la clave. Nada más de quien mira: ni
//    su IP, ni su punto, ni su sesión.
//  - La clave: la dirección entera (ruta, idioma —va en la ruta, `/en/…`— y
//    consulta) más `VERSION` (y lo de arriba en Descubre y Explorar). Para
//    tirar todo lo guardado sin entrar en Cloudflare, cambiar `VERSION` y subir.
//  - Cabecera `x-klendar-cache`: HIT, STALE (vieja, ya se está pintando la
//    nueva), MISS (pintada ahora) o BYPASS (no se mira la caché).
//
// La caché es de cada centro de datos de Cloudflare (no global) y solo existe
// en el dominio de verdad (klendar.app), no en *.pages.dev ni en local.

import { dependeDeLaConexion } from './explore.js';
import { celdaDeConexion, zonaDeConexion } from './conexion.js';
import { celdaDeUrl } from './celda_zona.js';

// v4 (23-11, §4zzz-csp): lo guardado antes llevaba <script> en línea, que la
// CSP nueva ya no deja correr; con la clave nueva no se sirve.
export const VERSION = 'v4';

// Las páginas públicas que pasan por aquí.
export const EN_CACHE = /^\/(en\/)?(o|b|a|agenda|whats-on|hoy|today|con-ninos|kids|ofertas|deals|provincia|province|coleccion|collection|explorar|explore|descubre|discover|guia|guide|partidos|matches|grupos|groups|sorteos|giveaways|sorteo|giveaway|cartel|poster|historia|story|widget|m)(\/|$)|^\/sitemap-[a-z]+\.xml$/;

// Cuánto más se puede servir algo caducado mientras se pinta lo nuevo (s).
const RESERVA = [
  [/^\/(en\/)?o\//, 600],
  [/^\/(en\/)?(sorteo|giveaway|sorteos|giveaways)(\/|$)/, 600],
  [/^\/(en\/)?(explorar|explore|descubre|discover)(\/|$)/, 120],
  [/^\/(en\/)?(partidos|matches)(\/|$)/, 1800],
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

const EXPLORA_O_DESCUBRE = /^\/(en\/)?(explorar|explore|descubre|discover)$/;
/** La respuesta a «¿Tienes 18 años o más?» de la cookie («0», «1») o null. */
const edadDe = (request) => ((/(?:^|;\s*)klendar_18=([01])(?![0-9])/.exec(request.headers.get('cookie') || '') || [])[1] || null);

/** ¿Se puede mirar la caché para esta petición? ([url]: en Descubre y
 * Explorar la cookie de la edad no lo impide: va en la clave.) */
export function peticionGuardable(request, url = null) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const h = request.headers;
  if (h.has('authorization') || h.has('x-klendar-sesion')) return false;
  if (/(?:^|;\s*)klendar_18=/.test(h.get('cookie') || '')) {
    return Boolean(url && EXPLORA_O_DESCUBRE.test(url.pathname) && edadDe(request));
  }
  return true;
}

/** ¿La página sale con la zona de la conexión de quien la pide y no se puede
 * guardar? (Una guía sin municipio; Descubre y Explorar van con su celda en
 * la clave: `extraDeClave`.) */
export function conZonaPropia(url, request) {
  const p = url.pathname;
  const guiaSinSitio = /^\/(en\/)?(guia|guide)\/[^/]+$/.test(p) && !conPuntoEnUrl(url.searchParams);
  if (!guiaSinSitio) return false;
  return zonaDeConexion(request) !== null;
}

/** Lo que, además de la dirección, cambia la página de Descubre y Explorar:
 * la celda de la zona de la conexión (sin celda, ciudad ni «Todas» en la
 * dirección) y la respuesta a la edad. Va en la clave; nada más de quien
 * mira. Fuera de esas dos páginas, nada. */
export function extraDeClave(url, request) {
  if (!EXPLORA_O_DESCUBRE.test(url.pathname)) return {};
  const extra = {};
  if (dependeDeLaConexion(url.searchParams)) {
    const c = celdaDeConexion(request);
    if (c) extra.zona = c;
  }
  const edad = edadDe(request);
  if (edad) extra.edad = edad;
  return extra;
}

// La zona en la dirección: la celda de «Cerca de mí» (o un `?lat=&lng=` de
// antes, que la guía manda a su celda con un 301). _lib/celda_zona.js.
const conPuntoEnUrl = (qs) => Boolean(celdaDeUrl(qs));

/** { frescos, reserva } en segundos para guardar esta respuesta, o null. */
export function tiempos(pathname, res) {
  if (![200, 404, 301, 308].includes(res.status) || res.headers.has('set-cookie')) return null;
  // `x-klendar-borde: s-maxage=N` (Descubre y Explorar con la zona de la
  // conexión o la cookie de la edad): privada para el navegador, pero esta
  // caché la guarda con eso en la clave (`extraDeClave`). Solo en esas dos.
  const borde = EXPLORA_O_DESCUBRE.test(pathname) ? (res.headers.get('x-klendar-borde') || '').toLowerCase() : '';
  const vary = (res.headers.get('vary') || '').toLowerCase().split(',').map((v) => v.trim()).filter(Boolean);
  // `Vary: Cookie`: la única cookie que cambia algo es la de la edad, y con
  // ella no se llega aquí (o va en la clave). Cualquier otra (la IP, una
  // sesión), fuera.
  if (!borde && vary.some((v) => v !== 'cookie' && v !== 'accept-encoding')) return null;
  const cc = borde || (res.headers.get('cache-control') || '').toLowerCase();
  if (!borde && (!/\bpublic\b/.test(cc) || /\b(private|no-store|no-cache)\b/.test(cc))) return null;
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

const claveDe = (url, extra = {}) => {
  const u = new URL(url.toString());
  u.hash = '';
  u.searchParams.append('__borde', VERSION);
  if (extra.zona) u.searchParams.append('__zona', extra.zona);
  if (extra.edad) u.searchParams.append('__18', extra.edad);
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
  h.delete('x-klendar-borde');
  h.set('x-klendar-cache', estado);
  return new Response(head ? null : guardada.body, { status: guardada.status, statusText: guardada.statusText, headers: h });
}

/** Guarda `res` (si se puede) y devuelve la que va al navegador. */
function guarda(ctx, cache, clave, pathname, res, estado) {
  const t = tiempos(pathname, res);
  const fuera = new Response(res.body, res);
  fuera.headers.set('x-klendar-cache', estado);
  const borde = fuera.headers.get('x-klendar-borde');
  fuera.headers.delete('x-klendar-borde');
  if (!t) return { res: fuera, promesa: null };
  const [paraNavegador, paraGuardar] = fuera.body ? fuera.body.tee() : [null, null];
  const salida = new Response(paraNavegador, fuera);
  const copia = new Response(paraGuardar, fuera);
  copia.headers.delete('x-klendar-cache');
  if (borde) copia.headers.set('x-klendar-borde', borde);
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
  if (!cache || !peticionGuardable(ctx.request, url) || conZonaPropia(url, ctx.request)) {
    const res = await pinta();
    const fuera = new Response(res.body, res);
    fuera.headers.delete('x-klendar-borde');
    if (cache) fuera.headers.set('x-klendar-cache', 'BYPASS');
    return fuera;
  }
  const clave = claveDe(url, extraDeClave(url, ctx.request));
  let guardada = null;
  try { guardada = await cache.match(clave); } catch { /* sin caché: se pinta */ }
  if (guardada) {
    const en = Number(guardada.headers.get('x-klendar-en')) || 0;
    const edad = (Date.now() - en) / 1000;
    const t = tiempos(url.pathname, new Response(null, {
      status: guardada.status,
      headers: {
        'cache-control': guardada.headers.get('x-klendar-cc') || '', vary: guardada.headers.get('x-klendar-vary') || '',
        ...(guardada.headers.has('x-klendar-borde') ? { 'x-klendar-borde': guardada.headers.get('x-klendar-borde') } : {}),
      },
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
