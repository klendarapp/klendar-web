// El cartel para imprimir de una publicación: un folio con el título, el
// precio o el descuento y un QR que lleva a su ficha.
//
// Es público porque la publicación ya lo es: así lo abre igual el negocio
// desde la app, desde el panel o desde cualquier ordenador con impresora,
// sin tener que entrar. El QR se dibuja en el navegador.

import { esc, html, isUuid, rpc } from './page.js';
import { benefit, fmtDay, fmtEnd, fmtTime, zonaDe } from './public.js';
import { notFound } from './views.js';

const T = {
  es: {
    lang: 'es', path: '', title: 'Cartel', scan: 'Apunta con la cámara del móvil', print: 'Imprimir',
    help: 'Un folio para la puerta, la barra o el escaparate. Se imprime igual en blanco y negro.',
  },
  en: {
    lang: 'en', path: '/en', title: 'Poster', scan: 'Point your phone camera here', print: 'Print',
    help: 'One sheet for the door, the bar or the window. Black and white prints fine.',
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
<meta name="robots" content="noindex">
<title>${esc(S.title)} · ${esc(o.title)} · Klendar</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96.png"><link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Manrope:wght@500;700&display=swap" rel="stylesheet">
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
