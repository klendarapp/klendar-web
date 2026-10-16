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
//    caché de Cloudflare (ver EN_CACHE).
//
// Lo estático que no necesita nada de esto (assets, legales, landing…) ni
// pasa por aquí: lo saca `_routes.json` (cada paso por una Function cuenta
// en el límite de CPU del plan gratis, 10 ms; ver RUNBOOK §3f).
const INTERNO = /^\/(tools\/|README\.md$|build_[\w-]*\.py$|[\w-]+\.py$|__pycache__\/|node_modules\/|\.(?!well-known\/))/i;

const SEGURIDAD = {
  // Siempre HTTPS, aunque alguien escriba http:// (un año; también www).
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  // Lo mínimo que no rompe nada: sin <base> ajeno, sin plugins y sin iframes
  // de fuera (igual que X-Frame-Options). El widget trae la suya.
  'content-security-policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
};

// Páginas públicas, iguales para todo el mundo (dependen solo de la
// dirección, nunca del idioma del navegador ni de una sesión): se guardan en
// la caché del centro de datos de Cloudflare para que mil visitas, un bot o
// la vista previa de WhatsApp no las vuelvan a pintar. Solo si la página se
// declara `public` con `s-maxage`, y como mucho su `max-age` (lo que ya puede
// tardar el navegador en ver un cambio): una publicación agotada o editada
// no se ve más vieja que antes. Lo privado (`private, no-store`: lo abierto
// con un enlace de RRPP, etc.) nunca entra.
const EN_CACHE = /^\/(en\/)?(o|b|a|agenda|whats-on|hoy|today|con-ninos|kids|coleccion|collection|explorar|explore|descubre|discover|partidos|matches|grupos|groups|sorteos|giveaways|sorteo|giveaway|cartel|poster|historia|story|widget|m)\/|^\/sitemap-[a-z]+\.xml$/;

/** Segundos que se puede guardar en el borde (0: no se guarda). */
function segundosEnCache(res) {
  if (res.status !== 200 || res.headers.has('set-cookie') || res.headers.has('vary')) return 0;
  const cc = (res.headers.get('cache-control') || '').toLowerCase();
  if (!/\bpublic\b/.test(cc) || /\b(private|no-store|no-cache)\b/.test(cc)) return 0;
  const s = Number((/\bs-maxage=(\d+)/.exec(cc) || [])[1] || 0);
  const m = Number((/(?:^|[\s,])max-age=(\d+)/.exec(cc) || [])[1] || 0);
  return Math.min(s, m);
}

async function deLaCache(ctx, url, head) {
  const cache = globalThis.caches?.default;
  const clave = new Request(url.toString(), { method: 'GET' });
  if (cache) {
    try {
      const guardada = await cache.match(clave);
      if (guardada) return guardada;
    } catch { /* sin caché: se pinta */ }
  }
  const res = head
    ? await ctx.next(new Request(ctx.request.url, { method: 'GET', headers: ctx.request.headers }))
    : await ctx.next();
  const ttl = cache ? segundosEnCache(res) : 0;
  if (ttl > 0) {
    const copia = new Response(res.clone().body, res);
    copia.headers.set('cache-control', `public, max-age=${ttl}`);
    // Lo que se guarda caduca a los `ttl` s; lo que recibe el navegador no cambia.
    const guardar = cache.put(clave, copia).catch(() => {});
    if (typeof ctx.waitUntil === 'function') ctx.waitUntil(guardar);
  }
  return res;
}

// La ruta tal y como la sirve Cloudflare: decodificada y sin barras dobles
// (`/%52EADME.md` o `//tools/…` se colaban por delante de INTERNO).
const rutaReal = (pathname) => {
  let ruta = pathname;
  try { ruta = decodeURIComponent(pathname); } catch { /* se queda como venía */ }
  return ruta.replace(/\/{2,}/g, '/');
};

export async function onRequest(ctx) {
  const { pathname, searchParams } = new URL(ctx.request.url);
  if (INTERNO.test(pathname) || INTERNO.test(rutaReal(pathname))) {
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
    });
  }

  const head = ctx.request.method === 'HEAD';
  const res = (head || ctx.request.method === 'GET') && EN_CACHE.test(pathname)
    ? await deLaCache(ctx, new URL(ctx.request.url), head)
    : head
      ? await ctx.next(new Request(ctx.request.url, { method: 'GET', headers: ctx.request.headers }))
      : await ctx.next();

  const cabeceras = new Headers(res.headers);
  for (const [k, v] of Object.entries(SEGURIDAD)) if (!cabeceras.has(k)) cabeceras.set(k, v);
  // El widget se incrusta en webs de negocios; el resto no se deja enmarcar.
  if (!pathname.startsWith('/widget/') && !cabeceras.has('x-frame-options')) cabeceras.set('x-frame-options', 'DENY');
  if (!cabeceras.has('permissions-policy')) {
    // La ficha abierta desde el QR del local (`?visita=`) mira si estás en
    // el local para darte el sello: solo entonces puede pedir la ubicación.
    const desdeQr = /^\/(en\/)?b\//.test(pathname) && searchParams.has('visita');
    const ubicacion = desdeQr || /^\/(explorar|descubre|partidos|grupos|sorteos|en\/explore|en\/discover|en\/matches|en\/groups|en\/giveaways|app|panel)\//.test(pathname) ? '(self)' : '()';
    cabeceras.set('permissions-policy', `geolocation=${ubicacion}, camera=${pathname.startsWith('/panel/') ? '(self)' : '()'}, microphone=()`);
  }
  // 5. Zonas con sesión (Tu cuenta, panel, admin): sin el contador de
  //    Cloudflare. `no-transform` no basta: Pages lo mete igual en el HTML
  //    estático (comprobado en producción, 2026-09-30), la CSP lo tendría que
  //    bloquear y la consola se llenaría de avisos. Se quita aquí.
  const conSesion = /^\/(app|panel|admin|tv)\//.test(pathname);
  if (!head && conSesion && typeof HTMLRewriter === 'function' && /text\/html/i.test(cabeceras.get('content-type') || '')) {
    cabeceras.delete('content-length'); // el cuerpo cambia de tamaño
    const limpio = new HTMLRewriter()
      .on('script[src*="cloudflareinsights.com"]', { element: (el) => el.remove() })
      .transform(new Response(res.body, { status: res.status, statusText: res.statusText, headers: cabeceras }));
    return limpio;
  }
  return new Response(head ? null : res.body, { status: res.status, statusText: res.statusText, headers: cabeceras });
}
