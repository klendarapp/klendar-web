// klendar.app/cola/<código> y /en/queue/<código>: la página pública de la
// cola virtual de un local (la dirección del QR del «Cartel para la puerta»).
// La pinta `assets/cola.js` (el mismo código en el servidor y en el
// navegador); aquí se pide `queue_info` sin sesión y se envuelve en la página
// de siempre.
//
// La dirección lleva el código del cartel: ni buscadores (`noindex` en la
// etiqueta y en la cabecera), ni canonical ni hreflang, ni caché compartida,
// ni contador de visitas. Con una sesión de «Tu cuenta» guardada, la etiqueta
// del <head> lleva directamente al turno en vivo (`/cuenta/cola/<código>`).

import { esc, html, rpc, supabasePublic } from './page.js';
import { publicPage } from './public.js';
import KC from '../../assets/cola.js';

export const COLA_JS_V = 5;

const HEAD = `<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<style>
.cola-pub { max-width: 560px; margin: 0 auto; padding: 4px 0 32px; }
.cola-cab { display: flex; gap: 14px; align-items: center; margin: 8px 0 18px; min-width: 0; }
.cola-cab > div { min-width: 0; }
.cola-cab h1 { margin: 2px 0; font-size: clamp(26px, 7vw, 34px); line-height: 1.15; overflow-wrap: anywhere; }
.cola-cab p { margin: 0; }
.cola-logo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: none; background: var(--soft); }
.cola-kicker { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); }
.cola-vacio .cola-kicker { margin-bottom: 4px; }
.cola-estado { text-align: center; border: 1px solid var(--glass-border); background: var(--glass); border-radius: 24px; padding: 24px 18px; }
.cola-estado h2 { margin: 0 0 6px; font-size: 22px; }
.cola-estado p { margin: 0 0 6px; }
.cola-cuantos { font-family: var(--display); font-size: 28px; font-weight: 800; line-height: 1.2; letter-spacing: -.02em; }
.cola-estado .vacio-botones { margin-top: 18px; }
.cola-estado .cola-ayuda { font-size: 14px; margin: 14px auto 0; max-width: 40ch; }
.cola-estado .cola-mayores { font-weight: 700; margin: 12px 0 0; }
</style>`;

export async function queuePublicPage(rawCode, lang) {
  const en = lang === 'en';
  const code = KC.codigoValido(rawCode);
  const path = `${en ? '/en/queue' : '/cola'}/${code || encodeURIComponent(String(rawCode || '').slice(0, 32))}`;
  const info = code ? await rpc('queue_info', { p_code: code }) : null;
  const vale = info?.ok === true && !!info.business;
  const sp = supabasePublic();
  const S = KC.T[en ? 'en' : 'es'];
  const descripcion = !vale ? S.badBody
    : info.unavailable ? S.unavailableBody(info.business.name || '')
      : !info.queue ? (info.ended_today ? S.endedBody(info.business.name || '') : S.noneBody(info.business.name || ''))
        : info.queue.status !== 'open' ? S.closedBody
          : S.waiting(Number(info.queue.waiting_people ?? info.queue.waiting) || 0);
  const body = `
  <div id="cola-pub" class="cola-pub" data-code="${esc(code)}" data-estado="${vale ? 'ok' : 'bad'}">${KC.cuerpo(info, lang, code)}</div>
  ${vale ? `<script src="/assets/cola.js?v=${COLA_JS_V}" defer data-lang="${en ? 'en' : 'es'}" data-url="${esc(sp.url)}" data-key="${esc(sp.key)}"></script>` : ''}`;
  const res = html(publicPage({
    lang,
    path,
    title: KC.titulo(info, lang),
    description: descripcion,
    image: vale && /^https:\/\//.test(info.business.logo_url || '') ? info.business.logo_url : null,
    // Con sesión, al turno en vivo antes de pintar nada.
    head: `${HEAD}${code && vale ? `\n${KC.saltoConSesion(lang, code, new URL(sp.url).hostname.split('.')[0])}` : ''}`,
    body,
    contador: false,
    privada: true,
    // El idioma lo elige la persona: «ES» lleva a /cola/<código>?lang=es
    // (si no, el navegador inglés volvería a mandar al inglés).
    consulta: '?lang=es',
    bodyClass: 'cola-pagina',
  }), vale ? 200 : 404, 'private, no-store');
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}

// ── La pantalla de la puerta (`/cola/<código>?pantalla=1`) ───────────────────
// Para una tele o una tablet en la entrada: los números avisados (el último,
// grande) y los siguientes, sin nombres (`queue_screen`, sin sesión), y el QR
// para coger número. Se vuelve a pedir cada 5 s. Oscura y a pantalla
// completa: se lee de lejos.

const TP = {
  es: {
    title: 'Pantalla de la cola', now: 'Ahora', next: 'Siguientes', none: 'Nadie esperando',
    closed: 'La cola está cerrada', noQueue: 'Hoy no hay cola virtual', join: 'Escanea para coger número',
    bad: 'Este cartel ya no funciona', wait: (m) => (m <= 1 ? 'Espera aproximada: 1 min' : `Espera aproximada: unos ${m} min`),
  },
  en: {
    title: 'Queue screen', now: 'Now', next: 'Next', none: 'Nobody waiting',
    closed: 'The queue is closed', noQueue: 'No virtual queue today', join: 'Scan to get a number',
    bad: 'This poster no longer works', wait: (m) => (m <= 1 ? 'Approximate wait: 1 min' : `Approximate wait: about ${m} min`),
  },
};

export async function queueScreenPage(rawCode, lang) {
  const en = lang === 'en';
  const S = TP[en ? 'en' : 'es'];
  const code = KC.codigoValido(rawCode);
  const info = code ? await rpc('queue_screen', { p_code: code }) : null;
  const vale = info?.ok === true && !!info.business;
  const sp = supabasePublic();
  const joinUrl = `https://klendar.app${en ? '/en/queue' : '/cola'}/${code}`;
  return html(`<!doctype html>
<html lang="${en ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${esc(S.title)} · ${esc(info?.business?.name || 'Klendar')}</title>
<link rel="stylesheet" href="/assets/site.css?v=20261112movil">
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; background: #0A0A0A; color: #FFFFFF; font-family: Manrope, system-ui, sans-serif; }
  .pantalla { min-height: 100%; box-sizing: border-box; display: grid; grid-template-columns: 1fr auto; gap: 4vw; padding: 4vw 5vw; align-items: center; }
  .pantalla h1 { font-family: Sora, sans-serif; font-weight: 800; font-size: clamp(22px, 3.2vw, 48px); margin: 0 0 3vw; }
  .et { font-weight: 700; font-size: clamp(16px, 2.2vw, 34px); letter-spacing: .06em; text-transform: uppercase; color: #BDBDBD; margin: 0; }
  .ahora { font-family: Sora, sans-serif; font-weight: 800; font-size: clamp(64px, 16vw, 260px); line-height: 1; letter-spacing: -.03em; margin: .5vw 0 2vw; }
  .ahora small { font-size: .35em; letter-spacing: 0; color: #BDBDBD; margin-left: .3em; }
  .sig { font-family: Sora, sans-serif; font-weight: 700; font-size: clamp(28px, 5vw, 80px); margin: .5vw 0 1.5vw; }
  .espera, .vacia { font-size: clamp(16px, 2vw, 30px); color: #BDBDBD; margin: 0; }
  .lado { text-align: center; background: #FFFFFF; color: #0A0A0A; border-radius: 24px; padding: 2vw; width: clamp(160px, 22vw, 360px); }
  .lado .qr svg { width: 100%; height: auto; display: block; }
  .lado p { font-weight: 700; font-size: clamp(14px, 1.6vw, 24px); margin: 1vw 0 0; }
  @media (max-aspect-ratio: 1/1) { .pantalla { grid-template-columns: 1fr; } .lado { margin: 0 auto; } }
</style>
</head>
<body>
<main class="pantalla" id="pantalla" data-code="${esc(code)}">
  <div id="numeros">${vale ? '' : `<h1>${esc(S.bad)}</h1>`}</div>
  ${vale && !info.unavailable ? `<aside class="lado"><div class="qr" role="img" aria-label="QR ${esc(joinUrl)}"></div><p>${esc(S.join)}</p></aside>` : ''}
</main>
${vale ? `<script src="/assets/vendor/qrcode.js?v=1"></script>
<script>
(function () {
  var S = ${JSON.stringify({ ...S, wait: undefined })};
  var esperaTxt = ${en ? `function (m) { return m <= 1 ? 'Approximate wait: 1 min' : 'Approximate wait: about ' + m + ' min'; }` : `function (m) { return m <= 1 ? 'Espera aproximada: 1 min' : 'Espera aproximada: unos ' + m + ' min'; }`};
  var qr = qrcode(0, 'M'); qr.addData(${JSON.stringify(joinUrl)}); qr.make();
  var caja = document.querySelector('.lado .qr'); if (caja) caja.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var pre = ${JSON.stringify(en ? 'No. ' : 'Nº ')};
  function pinta(d) {
    var b = (d && d.business) || {}; var q = d && d.queue;
    var h = '<h1>' + esc(b.name) + '</h1>';
    if (!q) h += '<p class="vacia">' + esc(S.noQueue) + '</p>';
    else {
      var llam = q.called || [];
      h += '<p class="et">' + esc(S.now) + '</p>';
      h += llam.length ? '<p class="ahora">' + esc(pre + llam[0]) + (llam.length > 1 ? '<small>' + esc(llam.slice(1, 4).map(function (n) { return pre + n; }).join(' · ')) + '</small>' : '') + '</p>' : '<p class="ahora">—</p>';
      h += '<p class="et">' + esc(S.next) + '</p>';
      h += (q.next || []).length ? '<p class="sig">' + esc(q.next.map(function (n) { return pre + n; }).join(' · ')) + '</p>' : '<p class="vacia">' + esc(S.none) + '</p>';
      if (q.status !== 'open') h += '<p class="espera">' + esc(S.closed) + '</p>';
      else if (q.wait_minutes != null && (q.next || []).length) h += '<p class="espera">' + esc(esperaTxt(q.wait_minutes < 15 ? q.wait_minutes : Math.floor((q.wait_minutes + 2) / 5) * 5)) + '</p>';
    }
    document.getElementById('numeros').innerHTML = h;
  }
  pinta(${JSON.stringify(info)});
  setInterval(function () {
    fetch(${JSON.stringify(`${sp.url}/rest/v1/rpc/queue_screen`)}, {
      method: 'POST',
      headers: { apikey: ${JSON.stringify(sp.key)}, Authorization: 'Bearer ' + ${JSON.stringify(sp.key)}, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: ${JSON.stringify(code)} }),
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.ok) pinta(d); }).catch(function () {});
  }, 5000);
})();
</script>` : ''}
</body>
</html>`, vale ? 200 : 404, 'private, no-store');
}
