// La CSP de las páginas públicas (RUNBOOK §4zzz-csp; aprobada por Iván el 23-11).
//
// Obligatoria desde el 23-11 (antes, del 20-11, solo informe: §4zzz-segF): un
// <script> que no venga de klendar.app o de los tres sitios de abajo no se
// ejecuta, ni uno en línea ni un `onclick=`. Así, un XSS futuro en una ficha
// (un nombre o una descripción mal escapados) no puede leer la sesión del
// admin, que comparte origen con lo público.
//
// - `script-src`: klendar.app; Turnstile (`challenges.cloudflare.com`, el
//   reto anti-robots); Mapbox (`api.mapbox.com`, mapbox-gl.js de los mapas) y
//   el contador de Cloudflare Web Analytics (`static.cloudflareinsights.com`,
//   beacon.min.js). Sin 'unsafe-inline' ni 'unsafe-eval'.
// - `worker-src 'self' blob:`: el mapa de Mapbox monta su worker desde un blob.
// - `base-uri`, `object-src` y `frame-ancestors`, como antes.
// - Nada de `style-src`, `connect-src`, `img-src` ni `default-src`: lo
//   importante son los scripts; los estilos en línea (`style=`, `<style>`) se
//   siguen usando en muchas páginas (propuesta aparte en el RUNBOOK).
//
// La misma en `/*` de `_headers` (lo estático) y en functions/_middleware.js
// (lo que pintan las Functions); tools/revseg_check.mjs y tools/csp_check.mjs
// comprueban que son iguales. Para añadir un sitio de scripts: aquí y en
// `_headers` (las dos líneas iguales), y en las zonas con sesión si también
// lo cargan (admin, panel, «Tu cuenta», que tienen la suya, más estricta).
//
// El nonce: Cloudflare mete en cada página un <script> en línea suyo (las
// «JavaScript detections» del Bot Fight Mode, que no se pueden apagar en ese
// modo) y, si la CSP trae un `nonce`, se lo pone. El middleware añade uno
// nuevo en cada respuesta (`conNonce`) y nunca está en nuestro HTML: lo que
// escriba un atacante en la página no lo sabe. Las zonas con sesión llevan
// `no-transform` y Cloudflare no les mete nada: van sin nonce.
export const CSP_PUBLICA = "script-src 'self' https://challenges.cloudflare.com https://api.mapbox.com https://static.cloudflareinsights.com; worker-src 'self' blob:; base-uri 'self'; object-src 'none'; frame-ancestors 'none'";

/** La del widget (`/widget/<id>`): solo sus scripts y se deja enmarcar en
 * cualquier web (es para eso). */
export const CSP_WIDGET = "script-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors *";

/** La del admin (admin.klendar.app, §4zzz-admindom): la misma que `/admin` y
 * `/admin/*` en `_headers` (tools/admin_dominio_check.mjs lo mira). Sin
 * Mapbox ni WebSocket (no los usa), nada en línea, sin dejarse enmarcar. */
export const CSP_ADMIN = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*.supabase.co; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'";

/** Las cabeceras de las páginas del admin en su host (`/` y `/carta`), que el
 * middleware reescribe a `/admin…` por dentro: las de `_headers` van por ruta
 * y no les llegan. */
export const CABECERAS_ADMIN = {
  'content-security-policy': CSP_ADMIN,
  'cache-control': 'no-store, no-transform',
  'x-robots-tag': 'noindex, nofollow',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

/** Un nonce nuevo: 16 bytes al azar en base64. */
export function nonceNuevo() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

/** La CSP con `'nonce-…'` en `script-src` (si lo tiene y aún sin nonce). */
export function conNonce(csp, nonce) {
  if (!csp || !nonce || /'nonce-/.test(csp)) return csp;
  return csp.replace(/(^|;\s*)script-src\s([^;]*)/, (_, pre, fuentes) => `${pre}script-src ${fuentes.trim()} 'nonce-${nonce}'`);
}
