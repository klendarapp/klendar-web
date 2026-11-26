// Pasa por aquí toda petición a la web.
//
// 1. Lo que vive en el repo pero no es de la web (los scripts que generan
//    las páginas, tools/, el README, ficheros ocultos como .gitignore o
//    .claude/) da 404: Cloudflare Pages publica la carpeta entera. Menos
//    /.well-known/, que lo necesitan los enlaces de la app (App Links).
// 2. Las páginas que se pintan al vuelo (fichas, Explorar, agenda) llevan las
//    mismas cabeceras de seguridad que las estáticas: `_headers` solo se
//    aplica a los ficheros, no a lo que devuelven las funciones.
// 3. HEAD responde como GET (sin cuerpo): las funciones solo tienen GET y los
//    comprobadores de enlaces y algunos buscadores preguntan con HEAD.
// 4. Las páginas públicas que se pintan al vuelo se guardan un rato en la
//    caché de Cloudflare (ver `_lib/cache.js`).
//
// Lo estático que no necesita nada de esto (assets, legales, landing…) ni
// pasa por aquí: lo saca `_routes.json` (cada paso por una Function cuenta
// en el límite de CPU del plan gratis, 10 ms; ver RUNBOOK §3f).
import { direccionBuena } from './_lib/direccion.js';
import { EN_CACHE, desdeLaCache, sinRastreo } from './_lib/cache.js';
import { CABECERAS_ADMIN, CABECERAS_PANEL, CSP_PUBLICA, conNonce, nonceNuevo } from './_lib/csp.js';
import { decideHost, esHostAdmin } from './_lib/admin.js';
import { politicaPermisos } from './_lib/permisos.js';

const INTERNO = /^\/(tools\/|README\.md$|build_[\w-]*\.py$|[\w-]+\.py$|__pycache__\/|node_modules\/|\.(?!well-known\/))/i;

const SEGURIDAD = {
  // Siempre HTTPS, aunque alguien escriba http:// (un año; también www).
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  // CSP de scripts obligatoria (§4zzz-csp; antes, solo informe): solo los
  // scripts de klendar.app, Turnstile, Mapbox y el contador de Cloudflare;
  // nada en línea. Sin <base> ajeno, sin plugins y sin iframes de fuera
  // (igual que X-Frame-Options). La misma que `/*` en `_headers`
  // (_lib/csp.js). El widget trae la suya.
  'content-security-policy': CSP_PUBLICA,
};

// Páginas públicas, iguales para todo el mundo (dependen solo de la
// dirección, nunca del idioma del navegador ni de una sesión): se guardan en
// la caché del centro de datos de Cloudflare para que mil visitas, un bot o
// la vista previa de WhatsApp no las vuelvan a pintar ni llamen a la base.
// Qué se guarda, cuánto y qué nunca: `_lib/cache.js` (EN_CACHE).

// «Tu cuenta» dejó esta dirección el 5-11 y no se redirige: la 404 normal de la
// web. Hace falta decirlo aquí porque Pages sigue sirviendo una semana lo que se
// borra de un despliegue, si alguien lo pidió antes (comprobado en klendar.app:
// `Cache-Control: public, s-maxage=604800` y `x-robots-tag: noindex`). Se puede
// quitar pasada esa semana, cuando la dirección sea un 404 por sí sola.
const DIRECCION_VIEJA = /^\/app(\/|$)/;

// La ruta tal y como la sirve Cloudflare: decodificada y sin barras dobles
// (`/%52EADME.md` o `//tools/…` se colaban por delante de INTERNO).
const rutaReal = (pathname) => {
  let ruta = pathname;
  try { ruta = decodeURIComponent(pathname); } catch { /* se queda como venía */ }
  return ruta.replace(/\/{2,}/g, '/');
};

// 0. Direcciones sin barra al final (Iván, 2026-11-11): ver _lib/direccion.js.

// Una página pública de las que se guardan en el borde (_lib/cache.js), sin
// los parámetros de rastreo (`sinRastreo`): la misma clave y la misma página
// con `?utm_…` o `?fbclid=…` que sin ellos.
function publica(ctx, head) {
  const limpia = sinRastreo(new URL(ctx.request.url));
  const rq = limpia ? new Request(limpia.toString(), ctx.request) : ctx.request;
  return desdeLaCache(ctx, limpia || new URL(ctx.request.url), head, () => (head
    ? ctx.next(new Request(rq.url, { method: 'GET', headers: rq.headers }))
    : limpia ? ctx.next(rq) : ctx.next()));
}

export async function onRequest(ctx) {
  const { pathname } = new URL(ctx.request.url);
  if (INTERNO.test(pathname) || INTERNO.test(rutaReal(pathname))) {
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
    });
  }

  let host = null;
  if (ctx.request.method === 'GET' || ctx.request.method === 'HEAD') {
    const url = new URL(ctx.request.url);
    const buena = direccionBuena(url.pathname);
    // 0-bis. El admin vive en la raíz de admin.klendar.app (§4zzz-admindom,
    //   _lib/admin.js): allí `/`, las rutas de sus apartados (`/semanas`,
    //   `/negocios/<id>`…, §4zzz-adminlimpio) y `/carta` se reescriben a sus
    //   ficheros de `/admin/…` (más abajo) y lo demás va a klendar.app; `/admin…`, en los
    //   dos hosts, da la 404 normal (las direcciones viejas no redirigen).
    //   El panel, igual (§4zzz-panellimpio, _lib/panel.js): `/panel` y
    //   `/panel/<pantalla>…` se reescriben a `panel.html`; sus JS y su CSS
    //   siguen su camino; lo que no es una pantalla, la 404 normal.
    host = decideHost(url, buena);
    if (host?.salto) {
      return new Response(null, {
        status: 301,
        headers: {
          location: host.salto, 'cache-control': 'public, max-age=86400', ...SEGURIDAD,
          ...(esHostAdmin(url.hostname) ? { 'x-robots-tag': 'noindex, nofollow' } : {}),
        },
      });
    }
    const apex = url.hostname === 'www.klendar.app';
    if (!host && (buena !== url.pathname || apex)) {
      const destino = (apex ? 'https://klendar.app' : url.origin) + buena + url.search;
      return new Response(null, {
        status: 301,
        headers: { location: destino, 'cache-control': 'public, max-age=86400', ...SEGURIDAD },
      });
    }
  }

  const head = ctx.request.method === 'HEAD';
  // El admin en su host (el fichero de `/admin…`) y las pantallas del panel
  // (`panel.html`), sin cambiar la dirección.
  const zonaAdmin = Boolean(host?.reescribe);
  const res = DIRECCION_VIEJA.test(rutaReal(pathname)) || host?.noExiste
    ? await ctx.env.ASSETS.fetch(new URL('/esta-direccion-no-existe/', ctx.request.url))
    : zonaAdmin
      ? await ctx.env.ASSETS.fetch(new URL(host.reescribe, ctx.request.url))
      : (head || ctx.request.method === 'GET') && EN_CACHE.test(pathname)
        ? await publica(ctx, head)
        : head
          ? await ctx.next(new Request(ctx.request.url, { method: 'GET', headers: ctx.request.headers }))
          : await ctx.next();

  const cabeceras = new Headers(res.headers);
  for (const [k, v] of Object.entries(SEGURIDAD)) if (!cabeceras.has(k)) cabeceras.set(k, v);
  // La de solo informe ya no se usa (§4zzz-csp): fuera, venga de donde venga.
  cabeceras.delete('content-security-policy-report-only');
  // El admin (en su host) y el panel: cabeceras propias aquí (lo reescrito no
  // lleva las de `_headers` de su ruta); «Tu cuenta» y la tele, las suyas.
  if (zonaAdmin) {
    for (const [k, v] of Object.entries(host.zona === 'panel' ? CABECERAS_PANEL : CABECERAS_ADMIN)) cabeceras.set(k, v);
  }
  const conSesion = zonaAdmin || /^\/(cuenta|panel|tv)(\/|$)/.test(pathname);
  // 6. Las páginas públicas (también las estáticas, que pasan por aquí desde
  //    el 23-11 solo para esto) llevan un nonce nuevo en `script-src` en cada
  //    respuesta: Cloudflare se lo pone al <script> en línea que mete él
  //    (Bot Fight Mode) y la CSP no lo bloquea. Nuestro HTML nunca lo lleva.
  //    Las zonas con sesión van con `no-transform` (Cloudflare no les mete
  //    nada) y con su CSP de `_headers`, tal cual. Ver _lib/csp.js.
  if (!head && !conSesion && /text\/html/i.test(cabeceras.get('content-type') || '')) {
    const csp = cabeceras.get('content-security-policy');
    if (csp && /(^|;)\s*script-src\s/.test(csp)) cabeceras.set('content-security-policy', conNonce(csp, nonceNuevo()));
  }
  // El widget se incrusta en webs de negocios; el resto no se deja enmarcar.
  if (!pathname.startsWith('/widget/') && !cabeceras.has('x-frame-options')) cabeceras.set('x-frame-options', 'DENY');
  // Dónde se puede usar la ubicación y la cámara (solo klendar.app, sin
  // iframes): _lib/permisos.js.
  if (!cabeceras.has('permissions-policy')) cabeceras.set('permissions-policy', politicaPermisos(pathname));
  // 5. Zonas con sesión (Tu cuenta, panel, admin): sin el contador de
  //    Cloudflare. `no-transform` no basta: Pages lo mete igual en el HTML
  //    estático (comprobado en producción, 2026-09-30), la CSP lo tendría que
  //    bloquear y la consola se llenaría de avisos. Se quita aquí.
  if (!head && conSesion && typeof HTMLRewriter === 'function' && /text\/html/i.test(cabeceras.get('content-type') || '')) {
    cabeceras.delete('content-length'); // el cuerpo cambia de tamaño
    const limpio = new HTMLRewriter()
      .on('script[src*="cloudflareinsights.com"]', { element: (el) => el.remove() })
      .transform(new Response(res.body, { status: res.status, statusText: res.statusText, headers: cabeceras }));
    return limpio;
  }
  return new Response(head ? null : res.body, { status: res.status, statusText: res.statusText, headers: cabeceras });
}
