// El cartel para imprimir de una publicación: un folio con el título, el
// precio o el descuento y un QR que lleva a su ficha.
//
// Es público porque la publicación ya lo es: así lo abre igual el negocio
// desde la app, desde el panel o desde cualquier ordenador con impresora,
// sin tener que entrar. El QR se dibuja en el navegador.

import { erroresScript, esc, html, isUuid, rpc } from './page.js';
import { benefit, fmtDay, fmtEnd, fmtTime, zonaDe } from './public.js';
import { notFound } from './views.js';

// Sora y Manrope, las de toda la web (assets/site.css), servidas desde
// klendar.app: el cartel no pide nada a Google Fonts.
const FUENTES = `@font-face { font-family: Manrope; font-style: normal; font-weight: 400 800; font-display: swap;
  src: url(/assets/fonts/manrope-latin.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: Manrope; font-style: normal; font-weight: 400 800; font-display: swap;
  src: url(/assets/fonts/manrope-latin-ext.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: Sora; font-style: normal; font-weight: 600 800; font-display: swap;
  src: url(/assets/fonts/sora-latin.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: Sora; font-style: normal; font-weight: 600 800; font-display: swap;
  src: url(/assets/fonts/sora-latin-ext.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }`;

const T = {
  es: {
    lang: 'es', path: '', title: 'Cartel', scan: 'Apunta con la cámara del móvil', print: 'Imprimir',
    help: 'Un folio para la puerta, la barra o el escaparate. Se imprime igual en blanco y negro.',
  },
  en: {
    lang: 'en', path: '/en', title: 'Poster', scan: 'Point your phone camera here', print: 'Print',
    help: 'One sheet for the door, the bar or the window. It prints fine in black and white.',
  },
};

export async function posterPage(id, lang) {
  const S = T[lang === 'en' ? 'en' : 'es'];
  const o = isUuid(id) ? await rpc('offer_detail', { p_id: id }) : null;
  // Si ya no existe, la misma página que su ficha: con cabecera y algo que hacer.
  if (!o || !o.title) return notFound(S.lang, `${S.path}/${S.lang === 'en' ? 'poster' : 'cartel'}/${id}`, 'o');
  const url = `https://klendar.app${S.path}/o/${o.id}`;
  const tag = benefit(o.discount, o.price_cents, o.currency, S.lang);
  // Cuándo: en un cartel pegado en la puerta es lo primero que se pregunta.
  const tz = zonaDe(o);
  const ini = o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at;
  const cuando = !ini ? '' : o.kind === 'flash_offer' && o.redeem_end_at
    ? `${fmtDay(ini, S.lang, tz)} · ${fmtTime(ini, S.lang, tz)} – ${fmtEnd(ini, o.redeem_end_at, S.lang, tz)}`
    : `${fmtDay(ini, S.lang, tz)} · ${fmtTime(ini, S.lang, tz)}`;
  return html(`<!doctype html>
<html lang="${S.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${erroresScript()}
<meta name="robots" content="noindex">
<title>${esc(S.title)} · ${esc(o.title)} · Klendar</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96.png"><link rel="manifest" href="/site.webmanifest">
<style>${FUENTES}</style>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #F5F5F5; font-family: Manrope, system-ui, sans-serif; color: #0A0A0A; }
  .barra { max-width: 640px; margin: 0 auto; padding: 16px; display: flex; gap: 12px; align-items: center; }
  .barra p { margin: 0; flex: 1; font-size: 14px; color: #636363; }
  .barra button { font: inherit; font-weight: 700; border: 0; border-radius: 999px; padding: 12px 22px;
    background: #FF4D6D; color: #0A0A0A; cursor: pointer; }
  .folio { background: #fff; max-width: 640px; margin: 0 auto 32px; padding: 48px 32px; text-align: center;
    border-radius: 18px; box-shadow: 0 20px 60px -30px rgba(10,10,10,.35); }
  .marca { font-family: Sora, sans-serif; font-weight: 800; letter-spacing: .18em; font-size: 14px; color: #0A0A0A; }
  h1 { font-family: Sora, sans-serif; font-size: clamp(28px, 7vw, 44px); line-height: 1.1; margin: 18px 0 10px; }
  .precio { display: inline-block; background: #FF4D6D; font-family: Sora, sans-serif; font-weight: 800;
    font-size: 26px; padding: 8px 20px; border-radius: 999px; margin: 4px 0 24px; }
  .negocio { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
  .cuando { font-size: 16px; color: #0A0A0A; margin: 0 0 22px; }
  #qr { width: min(300px, 70vw); margin: 0 auto; }
  #qr svg { width: 100%; height: auto; display: block; }
  .pie { font-size: 18px; font-weight: 700; margin: 22px 0 4px; }
  .url { font-size: 12px; color: #636363; word-break: break-all; margin: 0; }
  @page { size: A4; margin: 12mm; }
  @media print {
    body { background: #fff; }
    .barra { display: none; }
    .folio { box-shadow: none; border-radius: 0; max-width: none; margin: 0; padding: 30mm 12mm; }
  }
</style>
</head>
<body>
<div class="barra"><p>${esc(S.help)}</p><button onclick="print()">${esc(S.print)}</button></div>
<main class="folio">
  <div class="marca">KLENDAR</div>
  <h1>${esc(o.title)}</h1>
  ${tag ? `<div class="precio">${esc(tag)}</div>` : ''}
  ${o.business_name ? `<p class="negocio">${esc(o.business_name)}</p>` : ''}
  ${cuando ? `<p class="cuando">${esc(cuando)}</p>` : ''}
  <div id="qr" role="img" aria-label="QR ${esc(url)}"></div>
  <p class="pie">${esc(S.scan)}</p>
  <p class="url">${esc(url)}</p>
</main>
<script src="/assets/vendor/qrcode.js?v=1"></script>
<script>
  var q = qrcode(0, 'M'); q.addData(${JSON.stringify(url)}); q.make();
  document.getElementById('qr').innerHTML = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
</script>
</body>
</html>`);
}

// ── El cartel del local ─────────────────────────────────────────────────────
// Un folio con el logo, el nombre, el QR del local y la dirección corta, para
// la barra, la puerta o las mesas. El QR (klendar.app/v/<código>) abre la
// ficha del negocio y, si alguna tarjeta de sellos lo tiene activado, da un
// sello por visita. «Tamaño mesa»: cuatro iguales en el mismo folio, para
// recortar. El mismo cartel que la app («Cartel del local»).
//
// Se abre con el código en la dirección (`/cartel/local/<código>`), que es
// el mismo que va impreso en la pared: no descubre nada que no esté ya a la
// vista. Quien lo imprime lo abre desde el panel o desde la app.

const TV = {
  es: {
    lang: 'es', title: 'Cartel del local', point: 'Apunta con la cámara del móvil', print: 'Imprimir',
    scan: 'Escanea para ver nuestra carta y todo lo que tenemos',
    scanStamps: 'Escanea para ver nuestra carta y todo lo que tenemos, y llévate un sello en cada visita',
    a4: 'Folio A4', table: 'Tamaño mesa',
    help: 'Para la barra, la puerta o las mesas. Se imprime igual en blanco y negro.',
    helpTable: 'Cuatro por folio: recórtalos por las líneas y ponlos en las mesas.',
    changed: 'Este cartel ya no vale', changedBody: 'El local ha cambiado su QR. Imprime el cartel nuevo desde el panel o desde la app.',
  },
  en: {
    lang: 'en', title: 'Venue poster', point: 'Point your phone camera here', print: 'Print',
    scan: 'Scan to see our menu and everything we offer',
    scanStamps: 'Scan to see our menu and everything we offer, and get a stamp on every visit',
    a4: 'A4 sheet', table: 'Table size',
    help: 'For the counter, the door or the tables. It prints fine in black and white.',
    helpTable: 'Four per sheet: cut along the lines and put them on the tables.',
    changed: 'This poster no longer works', changedBody: 'The venue has changed its QR code. Print the new poster from the dashboard or the app.',
  },
};

/** «Calle Mayor 12, Madrid»: lo primero de la dirección y la ciudad (sin
 * repetirla). Lo mismo que la app. */
export function direccionCorta(address, city) {
  const calle = String(address || '').split(',')[0].trim();
  const c = String(city || '').trim();
  if (!calle) return c;
  if (!c || calle.toLowerCase().includes(c.toLowerCase())) return calle;
  return `${calle}, ${c}`;
}

const CABEZA = (S, titulo) => `<!doctype html>
<html lang="${S.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${erroresScript()}
<meta name="robots" content="noindex">
<title>${esc(titulo)} · Klendar</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96.png"><link rel="manifest" href="/site.webmanifest">
<style>${FUENTES}</style>`;

export async function venuePosterPage(token, lang, mesa) {
  const S = TV[lang === 'en' ? 'en' : 'es'];
  const base = lang === 'en' ? '/en/poster/venue' : '/cartel/local';
  const valido = /^[A-Za-z0-9_-]{16}$/.test(token || '');
  const info = valido ? await rpc('visit_qr_info', { p_token: token }) : null;
  if (info?.error === 'token_changed') {
    return html(`${CABEZA(S, S.changed)}
<link rel="stylesheet" href="/assets/site.css?v=20261011">
</head>
<body><main class="open"><div class="card" style="max-width:460px;margin:60px auto;padding:24px;text-align:center">
<h1>${esc(S.changed)}</h1><p class="muted">${esc(info.business_name || '')}</p><p>${esc(S.changedBody)}</p>
</div></main></body></html>`, 410, 'no-store');
  }
  const b = info?.ok ? info.business : null;
  if (!b?.name) return notFound(S.lang, `${base}/${token}`, 'b');

  const url = `https://klendar.app/v/${token}`;
  const sellos = (info.visit_cards || []).length > 0;
  const dir = direccionCorta(b.address, b.city);
  const cartel = `
    <section class="cartel">
      ${b.logo_url ? `<img class="logo" src="${esc(b.logo_url)}" alt="">` : ''}
      <h1>${esc(b.name)}</h1>
      <p class="invita">${esc(sellos ? S.scanStamps : S.scan)}</p>
      <div class="qr" role="img" aria-label="QR ${esc(url)}"></div>
      <p class="apunta">${esc(S.point)}</p>
      ${dir ? `<p class="dir">${esc(dir)}</p>` : ''}
      <p class="marca"><img src="/assets/symbol.png" alt=""> klendar.app</p>
    </section>`;

  return html(`${CABEZA(S, `${S.title} · ${b.name}`)}
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #F5F5F5; font-family: Manrope, system-ui, sans-serif; color: #0A0A0A; }
  .barra { max-width: 640px; margin: 0 auto; padding: 16px; display: flex; flex-wrap: wrap; gap: 10px 12px; align-items: center; }
  .barra p { margin: 0; flex: 1 1 260px; font-size: 14px; color: #636363; }
  .barra nav { display: flex; gap: 4px; background: #fff; border-radius: 999px; padding: 3px; }
  .barra nav a { font-weight: 700; font-size: 14px; color: #0A0A0A; text-decoration: none; padding: 8px 14px; border-radius: 999px; }
  .barra nav a[aria-current] { background: #0A0A0A; color: #fff; }
  .barra button { font: inherit; font-weight: 700; border: 0; border-radius: 999px; padding: 12px 22px;
    background: #FF4D6D; color: #0A0A0A; cursor: pointer; }
  .folio { background: #fff; width: min(640px, calc(100vw - 32px)); aspect-ratio: 210 / 297; margin: 0 auto 32px;
    border-radius: 18px; box-shadow: 0 20px 60px -30px rgba(10,10,10,.35); display: grid; overflow: hidden; container-type: inline-size; }
  .folio.mesa { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
  .mesa .cartel { outline: 1px dashed #BDBDBD; outline-offset: -0.5px; }
  .cartel { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8cqw 6cqw 5cqw; min-height: 0; }
  .mesa .cartel { padding: 4cqw 3cqw 2.5cqw; }
  .cartel .logo { width: 14cqw; height: 14cqw; border-radius: 50%; object-fit: cover; background: #F0F0F0; margin-bottom: 2.6cqw; }
  .mesa .cartel .logo { width: 7cqw; height: 7cqw; margin-bottom: 1.3cqw; }
  .cartel h1 { font-family: Sora, sans-serif; font-weight: 800; font-size: 7cqw; line-height: 1.1; letter-spacing: -.02em; margin: 0 0 2.2cqw; }
  .mesa .cartel h1 { font-size: 3.5cqw; margin-bottom: 1.1cqw; }
  .cartel .invita { font-weight: 600; font-size: 3.6cqw; line-height: 1.3; margin: 0; max-width: 80%; }
  .mesa .cartel .invita { font-size: 1.8cqw; }
  .cartel .qr { width: 52cqw; margin: auto 0 2.6cqw; }
  .mesa .cartel .qr { width: 26cqw; margin-bottom: 1.3cqw; }
  .cartel .qr svg { width: 100%; height: auto; display: block; }
  .cartel .apunta { font-weight: 700; font-size: 3.3cqw; margin: 0 0 auto; }
  .mesa .cartel .apunta { font-size: 1.65cqw; }
  .cartel .dir { font-size: 2.9cqw; color: #636363; margin: 3cqw 0 1.4cqw; }
  .mesa .cartel .dir { font-size: 1.45cqw; margin: 1.5cqw 0 .7cqw; }
  .cartel .marca { font-family: Sora, sans-serif; font-weight: 700; font-size: 2.6cqw; margin: 0; display: flex; align-items: center; gap: 1.2cqw; }
  .mesa .cartel .marca { font-size: 1.3cqw; gap: .6cqw; }
  .cartel .marca img { width: 3.8cqw; height: 3.8cqw; }
  .mesa .cartel .marca img { width: 1.9cqw; height: 1.9cqw; }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; }
    .barra { display: none; }
    .folio { width: 210mm; height: 297mm; aspect-ratio: auto; box-shadow: none; border-radius: 0; margin: 0; }
  }
</style>
</head>
<body>
<div class="barra">
  <p>${esc(mesa ? S.helpTable : S.help)}</p>
  <nav aria-label="${esc(S.title)}"><a href="${base}/${esc(token)}"${mesa ? '' : ' aria-current="page"'}>${esc(S.a4)}</a><a href="${base}/${esc(token)}?mesa=1"${mesa ? ' aria-current="page"' : ''}>${esc(S.table)}</a></nav>
  <button onclick="print()">${esc(S.print)}</button>
</div>
<main class="folio${mesa ? ' mesa' : ''}">${mesa ? cartel.repeat(4) : cartel}</main>
<script src="/assets/vendor/qrcode.js?v=1"></script>
<script>
  var q = qrcode(0, 'M'); q.addData(${JSON.stringify(url)}); q.make();
  var svg = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  document.querySelectorAll('.qr').forEach(function (el) { el.innerHTML = svg; });
</script>
</body>
</html>`, 200, 'no-store');
}
