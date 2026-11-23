// Los carteles para imprimir: el de una publicación (abajo, «Imprimir
// cartel»), el del local, los de mesa, el de la cola y el de «Te aviso
// cuando esté listo». La pegatina de escaparate está en `pegatina.js`.
//
// El de una publicación es público porque la publicación ya lo es: así lo abre igual el negocio
// desde la app, desde el panel o desde cualquier ordenador con impresora,
// sin tener que entrar. El QR se dibuja en el navegador.
//
// Una oferta de RRPP solo se abre con el enlace de un RRPP: sin él no hay
// cartel (su QR llevaría a una ficha que no se abre; el panel y la app no lo
// ofrecen); con `?rp=<código>` válido, el QR lleva ese `?rp=` y la página es
// privada (sin buscadores ni caché compartida).

import { textoCarta, tipoCartaDe } from './carta.js';
import { erroresScript, esc, html, isUuid, rpc } from './page.js';
import { zonaDe } from './public.js';
import { notFound } from './views.js';
import { NOMBRE_IDIOMA, TP, diaCorto, diaLargo, dinero, hora, idiomaCartel, webDe } from './cartel_idiomas.js';
import KR from '../../assets/rrpp-enlace.js';
import KZ from '../../assets/zona.js';

/** La versión de /assets/cartel.js (el QR y «Imprimir» de los carteles). */
export const CARTEL_JS_V = '20261123a';

// Sora y Manrope, las de toda la web (assets/site.css), servidas desde
// klendar.app: el cartel no pide nada a Google Fonts.
export const FUENTES = `@font-face { font-family: Manrope; font-style: normal; font-weight: 400 800; font-display: swap;
  src: url(/assets/fonts/manrope-latin.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: Manrope; font-style: normal; font-weight: 400 800; font-display: swap;
  src: url(/assets/fonts/manrope-latin-ext.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: Sora; font-style: normal; font-weight: 600 800; font-display: swap;
  src: url(/assets/fonts/sora-latin.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: Sora; font-style: normal; font-weight: 600 800; font-display: swap;
  src: url(/assets/fonts/sora-latin-ext.woff2) format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }`;

// ── El cartel de una publicación («Imprimir cartel», §4zzz-cartel) ──────────
// Un A4 (o A3) sobrio: la marca, el local, el título, el beneficio en coral
// (lo único de color), cuándo, un QR grande a su ficha y una línea de qué
// hacer («Escanea y consigue tu código» / «… y reserva tu plaza»). Todo en
// unidades del folio (`cqw`): en pantalla se ve la miniatura y al imprimir
// sale a su tamaño, en una sola hoja. En blanco y negro se lee igual: tinta
// sobre blanco y el coral pasa a un gris medio con el texto en tinta.
//
// Sin cartel (la página lo dice): una exclusiva (para favoritos o clientes:
// para todo el mundo no tiene sentido) y lo que ya no se ve (terminada,
// borrador, +18 sin entrar…: `offer_detail` no la da y sale «Esta
// publicación ya no está»). La app y el panel tampoco ofrecen el botón ahí.

const TAMANOS = { a4: { w: 210, h: 297, nombre: 'A4' }, a3: { w: 297, h: 420, nombre: 'A3' } };

/** El símbolo «Pulso» en su cuadrado de tinta (anillo coral, aguja blanca):
 * el de la app y el kit (`docs/kit/kit.py`, `simbolo(caja=True)`). */
export const SIMBOLO = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="16" fill="#0A0A0A"/><path d="M32 14A18 18 0 1 1 14.88 26.44" fill="none" stroke="#FF4D6D" stroke-width="6" stroke-linecap="round"/><path d="M32 32V23" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="32" r="4" fill="#fff"/></svg>';
/** Sin cuadrado: el anillo coral y la aguja del color del texto (sobre tinta, blanca). */
export const SIMBOLO_SUELTO = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 6.8A25.2 25.2 0 1 1 8.03 24.21" fill="none" stroke="#FF4D6D" stroke-width="8.4" stroke-linecap="round"/><path d="M32 32V19.4" stroke="currentColor" stroke-width="5.6" stroke-linecap="round"/><circle cx="32" cy="32" r="5.6" fill="currentColor"/></svg>';
const IC_CAL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5.5 5h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3.5 10h17M8.5 3v4M15.5 3v4"/></svg>';
const IC_SITIO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/** La barra de arriba (solo en pantalla) y lo común de las páginas de
 * imprimir: tamaño, idioma e «Imprimir». La comparte la pegatina. */
export const CSS_BARRA = `
  :root { color-scheme: light dark; --fondo: #F2F2F2; --txt: #0A0A0A; --txt2: #545454; --chip: #FFFFFF; --borde: #D4D4D4; }
  @media (prefers-color-scheme: dark) { :root { --fondo: #0F0F0F; --txt: #F5F5F5; --txt2: #BDBDBD; --chip: #1E1E1E; --borde: #3A3A3A; } }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: var(--fondo); font-family: Manrope, system-ui, sans-serif; color: var(--txt); }
  .barra { max-width: 760px; margin: 0 auto; padding: 16px 16px 12px; display: grid; gap: 12px; }
  .barra h1 { font-family: Sora, Manrope, sans-serif; font-size: 20px; line-height: 1.2; margin: 0; letter-spacing: -.01em; }
  .barra p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--txt2); }
  .ops { display: flex; flex-wrap: wrap; gap: 10px 12px; align-items: center; }
  .grupo { display: inline-flex; flex-wrap: wrap; gap: 4px; background: var(--chip); border: 1px solid var(--borde); border-radius: 22px; padding: 3px; }
  .grupo a { font-weight: 700; font-size: 14px; color: var(--txt); text-decoration: none; padding: 9px 14px; border-radius: 999px; min-height: 40px; display: inline-flex; align-items: center; }
  .grupo a[aria-current] { background: var(--txt); color: var(--fondo); }
  .idioma { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 14px; font-weight: 600; }
  .idioma select, .idioma button { font: inherit; font-weight: 700; color: var(--txt); background: var(--chip); border: 1px solid var(--borde); border-radius: 999px; padding: 9px 12px; min-height: 40px; }
  .imprimir { font: inherit; font-weight: 800; border: 0; border-radius: 999px; padding: 12px 24px; min-height: 44px;
    background: #FF4D6D; color: #0A0A0A; cursor: pointer; margin-left: auto; }
  :focus-visible { outline: 3px solid #FF4D6D; outline-offset: 2px; }
  .grupo a:focus-visible, .imprimir:focus-visible, .idioma select:focus-visible { outline-color: var(--txt); }
  .js .solo-sin-js { display: none; }
  .vista { padding: 4px 16px 40px; display: grid; justify-items: center; gap: 18px; }
  .aviso { max-width: 520px; margin: 48px auto; padding: 24px; background: var(--chip); border: 1px solid var(--borde); border-radius: 18px; }
  .aviso h1 { font-family: Sora, Manrope, sans-serif; font-size: 22px; margin: 0 0 8px; }
  .aviso p { margin: 0 0 14px; line-height: 1.5; color: var(--txt2); }
  .aviso a { color: var(--txt); font-weight: 700; }
  @media (max-width: 520px) { .imprimir { width: 100%; margin-left: 0; } }
  @media print { body { background: #fff; } .barra { display: none !important; } .vista { padding: 0; display: block; } }`;

/** El selector de idioma: un formulario normal (sin JS, con «Cambiar»;
 * con JS, cambia al elegir). Conserva lo demás de la dirección. */
export function selectorIdioma(S, lang, nombres, ocultos = {}) {
  const campos = Object.entries(ocultos).filter(([, v]) => v).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  return `<form class="idioma" method="get" data-cambia>${campos}
    <label for="lang">${esc(S.language)}</label>
    <select id="lang" name="lang">${Object.entries(nombres).map(([k, n]) => `<option value="${k}" lang="${k}"${k === lang ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <button type="submit" class="solo-sin-js">${esc(S.change)}</button></form>`;
}

/** «Sábado, 28 de noviembre · 18:00 – 20:00» (en la hora del negocio). */
function cuandoDe(o, lang) {
  const tz = zonaDe(o);
  const flash = o.kind === 'flash_offer';
  const ini = flash ? o.redeem_start_at : o.event_at;
  const fin = flash ? o.redeem_end_at : o.event_end_at;
  if (!ini) return '';
  const desde = `${diaLargo(ini, lang, tz)} · ${hora(ini, lang, tz)}`;
  if (!fin) return desde;
  return KZ.dia(ini, tz) === KZ.dia(fin, tz)
    ? `${desde} – ${hora(fin, lang, tz)}`
    : `${desde} – ${diaCorto(fin, lang, tz)} ${hora(fin, lang, tz)}`;
}

/** El beneficio grande («−20 %», «2x1», «Gratis», «12 €») y, si hay rebaja
 * anunciada, el precio de antes (obligatorio enseñarlo). */
function beneficioDe(o, S, lang) {
  const d = o.discount || null;
  let tag = '';
  if (d?.type === 'percent' && d.value) tag = `−${d.value} %`;
  else if (d?.type === 'fixed' && d.value) tag = `−${dinero(Math.round(Number(d.value) * 100), d.currency || o.currency, lang)}`;
  else if (d?.type === '2x1') tag = '2x1';
  else if (d?.type === 'free') tag = S.free;
  else if (d?.type === 'other' && d.value) tag = String(d.value);
  else if (o.price_cents != null) tag = o.price_cents === 0 ? S.free : dinero(o.price_cents, o.currency, lang);
  const antes = d?.compare_at_cents ? dinero(d.compare_at_cents, d.currency || o.currency || 'EUR', lang) : '';
  return { tag, antes };
}

/** Qué hacer al escanear. */
function accionDe(o, S) {
  if (o.kind === 'flash_offer') return S.code;
  if (o.reservations_enabled) return S.seat;
  if (o.external_url) return S.ticket;
  return S.info;
}

/** El título más grande cuanto más corto (cabe en tres o cuatro líneas). */
const claseTitulo = (t) => { const n = [...String(t || '')].length; return n <= 18 ? 't1' : n <= 34 ? 't2' : n <= 56 ? 't3' : 't4'; };

/** Una página sin cartel, que dice por qué. */
export const avisoCartel = (lang, titulo, texto, volver) => html(`<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(titulo)} · Klendar</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><style>${FUENTES}</style><style>${CSS_BARRA}</style></head>
<body><main class="aviso"><h1>${esc(titulo)}</h1><p>${esc(texto)}</p>${volver ? `<p><a href="${esc(volver)}">${esc(volver.replace(/^https:\/\//, ''))}</a></p>` : ''}</main></body></html>`, 200, 'no-store');

/**
 * El cartel de la publicación [id]. [ruta]: 'es' o 'en' (de la dirección);
 * [q]: los parámetros (`lang`, `tam` = a4 | a3).
 */
export async function posterPage(id, ruta, rpRaw = '', q = new URLSearchParams()) {
  const lang = idiomaCartel(q.get('lang'), ruta);
  const S = TP[lang];
  const web = webDe(lang);
  const tam = TAMANOS[q.get('tam') === 'a3' ? 'a3' : 'a4'];
  const rp = KR.codigoValido(rpRaw);
  const o = isUuid(id) ? await rpc('offer_detail', { p_id: id, p_rp: rp || null }) : null;
  const prom = o && rp && o.promoter && o.promoter.code ? o.promoter : null;
  const aqui = `${ruta === 'en' ? '/en/poster' : '/cartel'}/${id}`;
  // Si ya no existe (o es de RRPP y no hay enlace), la misma página que su
  // ficha: con cabecera y algo que hacer.
  if (!o || (o.audience === 'promoters' && !prom)) return notFound(web, aqui, 'o');
  const ficha = `https://klendar.app${web === 'en' ? '/en' : ''}/o/${o.id}`;
  if (o.audience === 'favorites' || o.audience === 'customers') return avisoCartel(lang, S.noTitle, S.noExclusive, ficha);
  if (!o.title) return notFound(web, aqui, 'o');

  const rpQ = prom ? `?rp=${encodeURIComponent(prom.code)}` : '';
  const url = `${ficha}${rpQ}`;
  const { tag, antes } = beneficioDe(o, S, lang);
  const cuando = cuandoDe(o, lang);
  const sitio = o.venue_name
    ? [o.venue_name, direccionCorta(o.venue_address, '')].filter(Boolean).join(' · ')
    : direccionCorta(o.business_address, o.business_city);
  const base = `${ruta === 'en' ? '/en/poster' : '/cartel'}/${encodeURIComponent(o.id)}`;
  const enlace = (t) => {
    const p = new URLSearchParams();
    if (prom) p.set('rp', prom.code);
    if (lang !== ruta) p.set('lang', lang);
    if (t !== 'a4') p.set('tam', t);
    const s = p.toString();
    return `${base}${s ? `?${s}` : ''}`;
  };
  const tamanos = `<nav class="grupo" aria-label="${esc(S.size)}">${Object.entries(TAMANOS).map(([k, t]) =>
    `<a href="${esc(enlace(k))}"${t === tam ? ' aria-current="page"' : ''}>${t.nombre}</a>`).join('')}</nav>`;
  const tipo = o.kind === 'flash_offer' ? S.offer : S.event;
  const logo = o.business_logo ? `<img class="logo" src="${esc(o.business_logo)}" alt="" width="64" height="64">` : '';

  const res = html(`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${erroresScript()}
${rpQ ? '<meta name="robots" content="noindex, nofollow">\n<meta name="referrer" content="no-referrer">' : '<meta name="robots" content="noindex">'}
<title>${esc(S.title)} · ${esc(o.title)} · Klendar</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96.png"><link rel="manifest" href="/site.webmanifest">
<style>${FUENTES}</style>
<style>${CSS_BARRA}
  .folio { background: #fff; color: #0A0A0A; width: min(640px, calc(100vw - 32px)); aspect-ratio: ${tam.w} / ${tam.h};
    border-radius: 14px; box-shadow: 0 24px 60px -30px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.06); overflow: hidden;
    container-type: inline-size; }
  /* Dentro (las medidas en cqw son del folio: en el propio contenedor serían de la ventana). */
  .pliego { height: 100%; display: flex; flex-direction: column; padding: 7cqw 8cqw 5.4cqw; }
  .pliego > *, .qrb > * { flex-shrink: 0; }
  .cab { display: flex; align-items: center; justify-content: space-between; gap: 3cqw; }
  .marca { display: inline-flex; align-items: center; gap: 1.6cqw; font-family: Sora, sans-serif; font-weight: 800; font-size: 3.6cqw; letter-spacing: -.035em; }
  .marca svg { width: 5.4cqw; height: 5.4cqw; display: block; }
  .tipo { font-weight: 800; font-size: 2.2cqw; letter-spacing: .14em; text-transform: uppercase; color: #404040;
    border: .28cqw solid #D4D4D4; border-radius: 999px; padding: .9cqw 2.4cqw; }
  .local { display: flex; align-items: center; gap: 2cqw; margin: 4.4cqw 0 2cqw; font-weight: 700; font-size: 3.4cqw; line-height: 1.2; color: #404040; }
  .local .logo { width: 5.6cqw; height: 5.6cqw; border-radius: 50%; object-fit: cover; background: #F0F0F0; flex: none; }
  .titulo { font-family: Sora, sans-serif; font-weight: 800; line-height: 1.04; letter-spacing: -.035em; margin: 0;
    text-wrap: balance; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; }
  .t1 { font-size: 10.4cqw; } .t2 { font-size: 8.2cqw; } .t3 { font-size: 6.6cqw; } .t4 { font-size: 5.3cqw; }
  .ben { display: flex; align-items: center; flex-wrap: wrap; gap: 1.2cqw 3cqw; margin: 3.4cqw 0 0; }
  .precio { font-family: Sora, sans-serif; font-weight: 800; font-size: 6.8cqw; line-height: 1; letter-spacing: -.02em;
    background: #FF4D6D; color: #0A0A0A; border-radius: 999px; padding: 1.7cqw 4.4cqw 1.9cqw; }
  .antes { font-size: 3.2cqw; font-weight: 600; color: #404040; }
  .antes s { text-decoration-thickness: .3cqw; }
  .cuando, .sitio { display: flex; align-items: flex-start; gap: 1.8cqw; margin: 3.4cqw 0 0; font-weight: 700; font-size: 3.5cqw; line-height: 1.3; }
  .sitio { margin-top: 1.4cqw; font-weight: 600; font-size: 3cqw; color: #404040; }
  .cuando svg, .sitio svg { width: 1.2em; height: 1.2em; flex: none; margin-top: .02em; }
  /* El QR, lo más grande que quepa (40 % del ancho, unos 84 mm en A4): si el título es muy largo, encoge (nunca por debajo de 28). */
  .qrb { flex: 1 1 auto; min-height: 0; padding-top: 3cqw; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; }
  .qrb > .qr { width: 40cqw; flex: 0 1 40cqw; min-height: 28cqw; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .accion { font-family: Sora, sans-serif; font-weight: 800; font-size: 4.6cqw; line-height: 1.15; letter-spacing: -.02em; margin: 3cqw 0 1cqw; max-width: 78cqw; text-wrap: balance; }
  .apunta { font-weight: 600; font-size: 2.7cqw; color: #5C5C5C; margin: 0; }
  .pie { display: flex; justify-content: center; align-items: center; gap: 1.2cqw; margin: 3.2cqw 0 0; padding-top: 2.6cqw; border-top: .25cqw solid #E4E4E4;
    font-family: Sora, sans-serif; font-weight: 700; font-size: 2.5cqw; color: #0A0A0A; }
  .pie svg { width: 3.2cqw; height: 3.2cqw; }
  @page { size: ${tam.nombre}; margin: 0; }
  @media print {
    .folio { width: ${tam.w}mm; height: ${tam.h}mm; aspect-ratio: auto; border-radius: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<header class="barra">
  <h1>${esc(S.title)} · ${tam.nombre}</h1>
  <p>${esc(S.help)} ${esc(S.hint.replace('{size}', tam.nombre))}</p>
  <div class="ops">${tamanos}${selectorIdioma(S, lang, NOMBRE_IDIOMA, { tam: tam === TAMANOS.a3 ? 'a3' : '', rp: prom ? prom.code : '' })}
    <button type="button" class="imprimir" data-imprimir>${esc(S.print)}</button></div>
</header>
<div class="vista">
<main class="folio" lang="${lang}"><div class="pliego">
  <div class="cab"><span class="marca">${SIMBOLO}<span>Klendar</span></span><span class="tipo">${esc(tipo)}</span></div>
  ${o.business_name ? `<p class="local">${logo}<span>${esc(o.business_name)}</span></p>` : ''}
  <h2 class="titulo ${claseTitulo(o.title)}">${esc(o.title)}</h2>
  ${tag ? `<p class="ben"><span class="precio">${esc(tag)}</span>${antes ? `<span class="antes">${esc(S.before)} <s>${esc(antes)}</s></span>` : ''}</p>` : ''}
  ${cuando ? `<p class="cuando">${IC_CAL}<span>${esc(cuando)}</span></p>` : ''}
  ${sitio ? `<p class="sitio">${IC_SITIO}<span>${esc(sitio)}</span></p>` : ''}
  <div class="qrb">
    <div class="qr" role="img" aria-label="QR: ${esc(url)}" data-qr="${esc(url)}" data-nivel="M"></div>
    <p class="accion">${esc(accionDe(o, S))}</p>
    <p class="apunta">${esc(S.point)}</p>
  </div>
  <p class="pie">${SIMBOLO}<span>klendar.app</span></p>
</div></main>
</div>
<script src="/assets/vendor/qrcode.js?v=1" defer></script>
<script src="/assets/cartel.js?v=${CARTEL_JS_V}" defer></script>
</body>
</html>`, 200, rpQ ? 'private, no-store' : undefined);
  if (rpQ) res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
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
    // Una entidad (`?agenda=1`): «Sigue nuestra agenda», sin dirección ni sellos.
    agendaTitle: 'Cartel «Sigue nuestra agenda»', agendaHead: 'Sigue nuestra agenda',
    agendaScan: 'Escanea para ver todo lo que organizamos y seguirnos',
    agendaHelp: 'Para el tablón de anuncios, la entrada o tus actividades. Se imprime igual en blanco y negro.',
  },
  en: {
    lang: 'en', title: 'Venue poster', point: 'Point your phone camera here', print: 'Print',
    scan: 'Scan to see our menu and everything we offer',
    scanStamps: 'Scan to see our menu and everything we offer, and get a stamp on every visit',
    a4: 'A4 sheet', table: 'Table size',
    help: 'For the counter, the door or the tables. It prints fine in black and white.',
    helpTable: 'Four per sheet: cut along the lines and put them on the tables.',
    changed: 'This poster no longer works', changedBody: 'The venue has changed its QR code. Print the new poster from the dashboard or the app.',
    agendaTitle: '“Follow our events” poster', agendaHead: 'Follow our events',
    agendaScan: 'Scan to see everything we organise and follow us',
    agendaHelp: 'For the notice board, the entrance or your activities. It prints fine in black and white.',
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

export async function venuePosterPage(token, lang, mesa, agenda = false) {
  const S = TV[lang === 'en' ? 'en' : 'es'];
  const base = lang === 'en' ? '/en/poster/venue' : '/cartel/local';
  const valido = /^[A-Za-z0-9_-]{16}$/.test(token || '');
  const info = valido ? await rpc('visit_qr_info', { p_token: token }) : null;
  if (info?.error === 'token_changed') {
    return html(`${CABEZA(S, S.changed)}
<link rel="stylesheet" href="/assets/site.css?v=20261119a11y2">
</head>
<body><main class="open"><div class="card" style="max-width:460px;margin:60px auto;padding:24px;text-align:center">
<h1>${esc(S.changed)}</h1><p class="muted">${esc(info.business_name || '')}</p><p>${esc(S.changedBody)}</p>
</div></main></body></html>`, 410, 'no-store');
  }
  const b = info?.ok ? info.business : null;
  if (!b?.name) return notFound(S.lang, `${base}/${token}`, 'b');

  const url = `https://klendar.app/v/${token}`;
  if (agenda) {
    // Una entidad (ayuntamiento, asociación…): sin local, sin dirección ni
    // sellos; el QR lleva a su ficha con todo lo que publica.
    const q = (m) => `?agenda=1${m ? '&mesa=1' : ''}`;
    const navA = `<nav aria-label="${esc(S.agendaTitle)}"><a href="${base}/${esc(token)}${q(false)}"${mesa ? '' : ' aria-current="page"'}>${esc(S.a4)}</a><a href="${base}/${esc(token)}${q(true)}"${mesa ? ' aria-current="page"' : ''}>${esc(S.table)}</a></nav>`;
    return paginaCartel({
      S, b: { ...b, address: '', city: '' }, url, mesa, nav: navA, titulo: `${S.agendaTitle} · ${b.name}`,
      que: S.agendaHead, invita: S.agendaScan, ayuda: mesa ? S.helpTable : S.agendaHelp,
    });
  }
  const sellos = (info.visit_cards || []).length > 0;
  // «… nuestra carta…», «… nuestros servicios…» según su tipo (Iván, 18-11).
  const tipo = await tipoCartaDe(b.id);
  const nuestra = (s) => s.replace(textoCarta('nuestra', 'menu', lang), textoCarta('nuestra', tipo, lang));
  const nav = `<nav aria-label="${esc(S.title)}"><a href="${base}/${esc(token)}"${mesa ? '' : ' aria-current="page"'}>${esc(S.a4)}</a><a href="${base}/${esc(token)}?mesa=1"${mesa ? ' aria-current="page"' : ''}>${esc(S.table)}</a></nav>`;
  return paginaCartel({
    S, b, url, mesa, nav, titulo: `${S.title} · ${b.name}`,
    invita: nuestra(sellos ? S.scanStamps : S.scan), ayuda: mesa ? S.helpTable : S.help,
  });
}

/** El folio (o los cuatro de «Tamaño mesa») con logo, nombre, `que` (una
 * línea encima de la invitación: «Cola virtual»), la invitación, el QR, la
 * dirección corta y klendar.app; arriba, la barra con la ayuda, `nav` y
 * «Imprimir». Lo comparten el cartel del local y el de la cola. */
function paginaCartel({ S, b, url, mesa = false, nav = '', titulo, que = '', queIcono = '', invita, ayuda, numeros = [], notas = [], marca = 'klendar.app' }) {
  const dir = direccionCorta(b.address, b.city);
  const logo = b.logo_url || '';
  const cartel = (num = '') => `
    <section class="cartel">
      ${num ? `<p class="num">${esc(num)}</p>` : ''}
      ${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : ''}
      <h1>${esc(b.name)}</h1>
      ${que ? `<p class="que">${queIcono}${esc(que)}</p>` : ''}
      <p class="invita">${esc(invita)}</p>
      <div class="qr" role="img" aria-label="QR ${esc(url)}" data-qr="${esc(url)}" data-nivel="M"></div>
      ${notas.length ? `<div class="bajo-qr"><p class="apunta">${esc(S.point)}</p>${notas.map((n) => `<p class="nota">${esc(n)}</p>`).join('')}</div>`
    : `<p class="apunta">${esc(S.point)}</p>`}
      ${dir ? `<p class="dir">${esc(dir)}</p>` : ''}
      <p class="marca"><img src="/assets/symbol.png" alt=""> ${esc(marca)}</p>
    </section>`;

  return html(`${CABEZA(S, titulo)}
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
  .cartel .que .ic-wifi { width: 1.1em; height: 1.1em; vertical-align: -0.15em; margin-right: .3em; }
  .cartel .num { font-weight: 800; font-size: 2.2cqw; letter-spacing: .06em; text-transform: uppercase; margin: 0 0 1cqw; }
  .cartel .que { font-family: Sora, sans-serif; font-weight: 800; font-size: 4.4cqw; letter-spacing: .04em; text-transform: uppercase; margin: 0 0 1.8cqw; }
  .cartel .invita { font-weight: 600; font-size: 3.6cqw; line-height: 1.3; margin: 0; max-width: 80%; }
  .mesa .cartel .invita { font-size: 1.8cqw; }
  .mesa .cartel .que { font-size: 2.6cqw; margin-bottom: .9cqw; }
  .cartel .qr { width: 52cqw; margin: auto 0 2.6cqw; }
  .mesa .cartel .qr { width: 26cqw; margin-bottom: 1.3cqw; }
  .cartel .qr svg { width: 100%; height: auto; display: block; }
  .cartel .apunta { font-weight: 700; font-size: 3.3cqw; margin: 0 0 auto; }
  .cartel .bajo-qr { margin: 0 0 auto; }
  .cartel .bajo-qr .apunta { margin: 0 0 1.2cqw; }
  .cartel .nota { font-weight: 600; font-size: 2.8cqw; line-height: 1.3; margin: 0 0 .4cqw; }
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
    .folio { width: 210mm; height: 297mm; aspect-ratio: auto; box-shadow: none; border-radius: 0; margin: 0; break-after: page; }
    .folio:last-of-type { break-after: auto; }
  }
</style>
</head>
<body>
<div class="barra">
  <p>${esc(ayuda)}</p>
  ${nav}
  <button type="button" data-imprimir>${esc(S.print)}</button>
</div>
${numeros.length
    ? Array.from({ length: Math.ceil(numeros.length / 4) }, (_, i) =>
        `<main class="folio mesa">${numeros.slice(i * 4, i * 4 + 4).map((n) => cartel(n)).join('')}</main>`).join('')
    : `<main class="folio${mesa ? ' mesa' : ''}">${mesa ? cartel().repeat(4) : cartel()}</main>`}
<script src="/assets/vendor/qrcode.js?v=1" defer></script>
<script src="/assets/cartel.js?v=${CARTEL_JS_V}" defer></script>
</body>
</html>`, 200, 'no-store');
}

// ── Los carteles de mesa (QR de mesa con el wifi) ──────────────────────────
// Cuatro por folio, para recortar, con «📶 Wifi gratis · Escanea aquí» o, sin
// wifi, «Ofertas y carta · Escanea aquí», el QR (klendar.app/m/<código>: sin
// la contraseña), el nombre del local y, con `?mesas=12`, «Mesa 1»…«Mesa 12»
// (tres folios). Si el local ha cambiado el enlace, «Este cartel ya no vale».
// Lo abre el panel o la app («Wifi para clientes»). Se imprime o se guarda
// en PDF desde el navegador.

const TM = {
  es: {
    lang: 'es', title: 'Carteles de mesa', point: 'Apunta con la cámara del móvil', print: 'Imprimir',
    wifi: 'Wifi gratis', menu: 'Ofertas y carta', scan: 'Escanea aquí', table: 'Mesa',
    help: 'Cuatro por folio: recórtalos por las líneas y ponlos en las mesas. Se imprimen igual en blanco y negro.',
    changed: 'Este cartel ya no vale', changedBody: 'El local ha cambiado el enlace de sus carteles de mesa. Imprime los nuevos desde el panel o desde la app.',
  },
  en: {
    lang: 'en', title: 'Table cards', point: 'Point your phone camera here', print: 'Print',
    wifi: 'Free Wi-Fi', menu: 'Offers and menu', scan: 'Scan here', table: 'Table',
    help: 'Four per sheet: cut along the lines and put them on the tables. They print fine in black and white.',
    changed: 'This card no longer works', changedBody: 'The venue has changed the link on its table cards. Print the new ones from the dashboard or the app.',
  },
};

export async function tablePosterPage(token, lang, mesas) {
  const S = TM[lang === 'en' ? 'en' : 'es'];
  const valido = /^[A-Za-z0-9_-]{16}$/.test(token || '');
  const info = valido ? await rpc('table_qr_info', { p_token: token }) : null;
  if (info?.error === 'token_changed') {
    return html(`${CABEZA(S, S.changed)}
<link rel="stylesheet" href="/assets/site.css?v=20261119a11y2">
</head>
<body><main class="open"><div class="card" style="max-width:460px;margin:60px auto;padding:24px;text-align:center">
<h1>${esc(S.changed)}</h1><p class="muted">${esc(info.business_name || '')}</p><p>${esc(S.changedBody)}</p>
</div></main></body></html>`, 410, 'no-store');
  }
  const b = info?.ok ? info.business : null;
  if (!b?.name) return notFound(S.lang, `${lang === 'en' ? '/en/poster/table' : '/cartel/mesa'}/${token}`, 'b');
  const n = Math.min(Math.max(parseInt(mesas, 10) || 0, 0), 200);
  // «Ofertas y carta» o «Ofertas y servicios»… según su tipo (Iván, 18-11).
  const tipo = info.has_wifi ? 'menu' : await tipoCartaDe(b.id);
  const numeros = n > 0 ? Array.from({ length: n }, (_, i) => `${S.table} ${i + 1}`) : ['', '', '', ''];
  return paginaCartel({
    S, b, url: `https://klendar.app/m/${token}`, mesa: true, titulo: `${S.title} · ${b.name}`,
    que: info.has_wifi ? S.wifi : textoCarta('mesa', tipo, lang), invita: S.scan, ayuda: S.help, numeros,
    // En blanco y negro, como el resto del cartel (nada de emojis de color).
    queIcono: info.has_wifi ? '<svg class="ic-wifi" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>' : '',
  });
}

// ── El cartel de la cola virtual ────────────────────────────────────────────
// «Cartel para la puerta»: el mismo folio que el del local (solo A4), con
// «Cola virtual» y un QR a klendar.app/cola/<código> (la página elige el
// idioma del navegador). Se abre con el código en la dirección, que es el
// mismo que va impreso en la puerta. Si el local lo ha cambiado, «Este cartel
// ya no funciona».

const TQ = {
  es: {
    lang: 'es', title: 'Cartel para la puerta', point: 'Apunta con la cámara del móvil', print: 'Imprimir',
    que: 'Cola virtual',
    scan: 'Escanea para coger número. Te avisamos en el móvil cuando te toque.',
    help: 'Para la puerta. Se imprime igual en blanco y negro.',
    changed: 'Este cartel ya no funciona',
    changedBody: 'El local ha cambiado el código del cartel. Imprime el nuevo desde el panel o desde la app.',
    cuenta: 'Hace falta una cuenta de Klendar (gratis).',
    sinMovil: '¿Sin móvil? Pregunta en la puerta.',
  },
  en: {
    lang: 'en', title: 'Poster for the door', point: 'Point your phone camera here', print: 'Print',
    que: 'Virtual queue',
    scan: "Scan to get a number. We'll let you know on your phone when it's your turn.",
    help: 'For the door. It prints fine in black and white.',
    changed: 'This poster no longer works',
    changedBody: 'The venue has changed the poster code. Print the new one from the dashboard or the app.',
    cuenta: 'You need a Klendar account (free).',
    sinMovil: 'No phone? Ask at the door.',
  },
};

export async function queuePosterPage(code, lang) {
  const S = TQ[lang === 'en' ? 'en' : 'es'];
  const valido = /^[A-Za-z0-9_-]{16}$/.test(code || '');
  const info = valido ? await rpc('queue_info', { p_code: code }) : null;
  const b = info?.ok === true ? info.business : null;
  if (!b?.name) {
    return html(`${CABEZA(S, S.changed)}
<link rel="stylesheet" href="/assets/site.css?v=20261119a11y2">
</head>
<body><main class="open"><section class="vacio" style="max-width:460px;margin:60px auto;padding:24px">
<h1>${esc(S.changed)}</h1><p>${esc(S.changedBody)}</p>
</section></main></body></html>`, valido ? 410 : 404, 'no-store');
  }
  return paginaCartel({
    S, b, url: `https://klendar.app/cola/${code}`, titulo: `${S.title} · ${b.name}`,
    que: S.que, invita: S.scan, ayuda: S.help,
    // Que se sepa antes de escanear (como la app): hace falta cuenta, sin
    // móvil se pregunta en la puerta, y la dirección escrita.
    notas: [S.cuenta, S.sinMovil], marca: `klendar.app/cola/${code}`,
  });
}

// ── El cartel de «Te aviso cuando esté listo» ───────────────────────────────
// «Cartel para el mostrador»: el mismo folio que el de la cola (solo A4), con
// «Te aviso cuando esté listo» y un QR a klendar.app/listo/<código>. Cartel
// propio y no el de la cola: va en otro sitio (el mostrador, no la puerta),
// dice otra cosa y su código se cambia por separado.

const TL = {
  es: {
    lang: 'es', title: 'Cartel para el mostrador', point: 'Apunta con la cámara del móvil', print: 'Imprimir',
    que: 'Te aviso cuando esté listo',
    scan: '¿Has pedido? Escanea y te avisamos en el móvil cuando esté listo.',
    help: 'Para el mostrador. Se imprime igual en blanco y negro.',
    changed: 'Este cartel ya no funciona',
    changedBody: 'El local ha cambiado el código del cartel. Imprime el nuevo desde el panel o desde la app.',
  },
  en: {
    lang: 'en', title: 'Poster for the counter', point: 'Point your phone camera here', print: 'Print',
    que: 'Ready alert',
    scan: 'Ordered? Scan and we’ll tell you on your phone when it’s ready.',
    help: 'For the counter. It prints fine in black and white.',
    changed: 'This poster no longer works',
    changedBody: 'The venue has changed the poster code. Print the new one from the dashboard or the app.',
  },
};

export async function ordersPosterPage(code, lang) {
  const S = TL[lang === 'en' ? 'en' : 'es'];
  const valido = /^[A-Za-z0-9_-]{16}$/.test(code || '');
  const info = valido ? await rpc('orders_info', { p_code: code }) : null;
  const b = info?.ok === true ? info.business : null;
  if (!b?.name) {
    return html(`${CABEZA(S, S.changed)}
<link rel="stylesheet" href="/assets/site.css?v=20261119a11y2">
</head>
<body><main class="open"><section class="vacio" style="max-width:460px;margin:60px auto;padding:24px">
<h1>${esc(S.changed)}</h1><p>${esc(S.changedBody)}</p>
</section></main></body></html>`, valido ? 410 : 404, 'no-store');
  }
  return paginaCartel({
    S, b, url: `https://klendar.app/listo/${code}`, titulo: `${S.title} · ${b.name}`,
    que: S.que, invita: S.scan, ayuda: S.help,
  });
}
