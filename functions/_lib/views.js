// Las tres páginas públicas, en los dos idiomas.
//
// Cada una vive en dos URLs (`/o/<id>` y `/en/o/<id>`) que enlazan entre sí
// con hreflang. El idioma lo manda la ruta, no el navegador: así se puede
// mandar el enlace inglés a quien toque y Google indexa las dos.
//
// Se pueden leer enteras sin app y sin cuenta. Lo que necesita cuenta
// (guardar, seguir, pedir el código, opinar, denunciar) lleva a «Tu cuenta»
// (/app/), que hace lo mismo que la app desde el navegador.

import { esc, fmtWhen, html, isUuid, rpc, rpcAll, rows, supabasePublic } from './page.js';
import KZ from '../../assets/zona.js';
import { decodeSeg,
  agendaBase, BASE, benefit, bizPath, breadcrumbLd, cityLinks, citySeg, datosDeNegocios, exploreBase,
  carrusel, firstPhoto, fmtEnd, fmtLong, isSlug, isVideo, ldScript, listingLd, miniatura, miniaturas, money, openInApp,
  historiaBoton, priorPrice, publicPage, slugDe, todayBase, zonaDe,
} from './public.js';
import { cuandoCorto, plataformaEntradas, rejilla } from './tarjeta.js';

// Iconos de Material (los mismos que la app), en SVG: las páginas públicas
// no cargan la fuente de iconos.
const PATHS = {
  lugar: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  telefono: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  web: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  carta: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
  correo: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  redes: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
  pdf: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  cerrado: 'M9.31 17l2.44-2.44L14.19 17l1.06-1.06-2.44-2.44 2.44-2.44L14.19 10l-2.44 2.44L9.31 10l-1.06 1.06 2.44 2.44-2.44 2.44L9.31 17zM19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z',
  negocio: 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
  candado: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  regalo: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z',
  // «Voy» (check_circle) e «Invitar a un amigo» (group_add), como en la app.
  voy: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  invitar: 'M8 10H5V7H3v3H0v2h3v3h2v-3h3v-2zm10 1c1.66 0 2.99-1.34 2.99-3S19.66 5 18 5c-.32 0-.63.05-.91.14.57.81.9 1.79.9 2.86s-.34 2.04-.9 2.86c.28.09.59.14.91.14zm-5 0c1.66 0 2.99-1.34 2.99-3S14.66 5 13 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm6.62 2.16c.83.73 1.38 1.66 1.38 2.84v2h3v-2c0-1.54-2.37-2.49-4.38-2.84zM13 13c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3z',
  // «Forma parte de una serie» (event_repeat).
  serie: 'M21 12V6c0-1.1-.9-2-2-2h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h7v-2H5V10h14v2h2zm-5.36 8c.43 1.45 1.77 2.5 3.36 2.5 1.93 0 3.5-1.57 3.5-3.5s-1.57-3.5-3.5-3.5c-.95 0-1.82.38-2.45 1H18V18h-4v-4h1.5v1.43c.9-.88 2.14-1.43 3.5-1.43 2.76 0 5 2.24 5 5s-2.24 5-5 5c-2.42 0-4.44-1.72-4.9-4h1.54z',
  resena: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 14v-2.47l6.88-6.88c.2-.2.51-.2.71 0l1.77 1.77c.2.2.2.51 0 .71L8.47 14H6zm12 0h-7.5l2-2H18v2z',
};
const icono = (n, size = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${PATHS[n]}"/></svg>`;

const pre = (lang) => (lang === 'en' ? '/en' : '');
/** «Tu cuenta» en el idioma de la ficha (la cabecera ya lo hace así). */
const cuenta = (lang) => (lang === 'en' ? '/app/?lang=en' : '/app/');
/** Solo enlaces web: lo que escribe un negocio no puede ser un javascript:. */
// «4,0» en español y «4.0» en inglés, como la app.
const nota = (r, lang) => Number(r).toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const seguro = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
/** Una publicación que ya acabó o se borró, o un negocio que ya no está: con
 * la cabecera y el pie de siempre y algo que hacer, no una página suelta.
 * Centrada, como toda pantalla vacía o de error (`.vacio`). */
export const notFound = (lang, path, kind) => {
  const en = lang === 'en';
  const S = en
    ? {
        o: ['This publication is no longer here', 'It may have ended or been removed by the business. There is probably something else on nearby.'],
        b: ["This business isn't on Klendar", 'The link may be wrong or the business may no longer be here.'],
        c: ["We couldn't find that city", 'Have a look at the list of cities with something on.'],
        a: ['This link no longer works', 'They may have changed it. Ask them for the new one.'],
        exp: "See what's on now", agenda: "What's on",
      }
    : {
        o: ['Esta publicación ya no está', 'Puede que haya terminado o que el negocio la haya quitado. Seguro que hay otra cosa cerca.'],
        b: ['Este negocio no está en Klendar', 'Puede que el enlace esté mal o que el negocio ya no esté.'],
        c: ['No encontramos esa ciudad', 'Mira la lista de ciudades con algo publicado.'],
        a: ['Este enlace ya no vale', 'Puede que lo haya cambiado. Pídele el nuevo.'],
        exp: 'Ver qué hay ahora', agenda: 'Agenda local',
      };
  const [titulo, texto] = S[kind] || S.o;
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <section class="vacio">
    <h1>${esc(titulo)}</h1>
    <p>${esc(texto)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a>
      <a class="pill" href="${agendaBase(lang)}/">${esc(S.agenda)}</a></div>
  </section>`;
  return html(publicPage({
    lang, path, body, title: titulo, description: texto, head: '<meta name="robots" content="noindex">',
  }), 404, 'no-store');
};

/** Un negocio que administración ha marcado como cerrado de verdad
 * (`business_closure_state`, por id o por cualquiera de sus direcciones con
 * nombre): «Este negocio ha cerrado», con 410 para que los buscadores lo
 * quiten. null si no es eso (y la ficha sigue con su «no está»). */
async function cerradoPage(lang, ref, path) {
  let c = null;
  try { c = await rpc('business_closure_state', { p_ref: ref }); } catch { c = null; }
  if (!c || !c.name) return null;
  const en = lang === 'en';
  const titulo = en ? 'This business has closed' : 'Este negocio ha cerrado';
  const texto = en
    ? `We've been told that ${c.name} has closed, so it's no longer on Klendar.`
    : `Nos han confirmado que ${c.name} ha cerrado, así que ya no está en Klendar.`;
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <section class="vacio">
    <h1>${esc(titulo)}</h1>
    <p>${esc(texto)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${exploreBase(lang)}/">${esc(en ? "See what's on now" : 'Ver qué hay ahora')}</a>
      <a class="pill" href="${agendaBase(lang)}/">${esc(en ? "What's on" : 'Agenda local')}</a></div>
  </section>`;
  return html(publicPage({
    lang, path, body, title: titulo, description: texto, head: '<meta name="robots" content="noindex">',
  }), 410, 'public, max-age=300');
}

// ── Publicación ────────────────────────────────────────────────────────────
/**
 * Traducción automática para quien la tiene encendida («Tu cuenta» →
 * Ajustes): `/assets/traducir.js` no hace nada (ni pide nada) si no. Se le
 * dice qué pedir (`offer:<id>`, `business:<id>`, `menu:<id>`); el texto lo
 * saca el servidor. Lo traducible lleva `data-tr` y el aviso «Traducido
 * automáticamente · Ver original», `data-tr-nota`.
 */
function traducir(lang, ...pedir) {
  const sp = supabasePublic();
  return `<script src="/assets/traducir.js?v=1" defer data-url="${esc(sp.url)}" data-key="${esc(sp.key)}" data-lang="${lang === 'en' ? 'en' : 'es'}" data-pedir="${esc(pedir.filter(Boolean).join(' '))}"></script>`;
}

export async function offerPage(id, lang) {
  const path = `${pre(lang)}/o/${id}`;
  const en = lang === 'en';
  if (!isUuid(id)) return notFound(lang, path, 'o');
  const o = await rpc('offer_detail', { p_id: id });
  if (!o) return notFound(lang, path, 'o');
  // La ficha del negocio, por su dirección con nombre.
  const bHref = bizPath(lang, (await slugDe(o.business_id)) || o.business_id);
  // Exclusiva para favoritos o clientes: la web pública va siempre sin
  // sesión, así que aquí siempre llega bloqueada (sin título, beneficio ni
  // fotos). Se dice qué es, de quién y cómo conseguirla.
  if (o.locked) return lockedOfferPage(o, lang, path, bHref);
  // La serie de la que forma parte («Seguir la serie»), si tiene. Sin la
  // función (o sin red), la ficha sale igual.
  const serie = await rpc('offer_series_info', { p_offer: id }).catch(() => null);

  const flash = o.kind === 'flash_offer';
  const soldOut = o.status === 'sold_out' || (o.seats_left != null && o.seats_left <= 0);
  // Un evento sin hora de fin sigue abierto 6 h (lo mismo que dura su código).
  const fin = o.redeem_end_at || o.event_end_at
    || (o.event_at ? new Date(new Date(o.event_at).getTime() + 6 * 3600e3).toISOString() : 0);
  const over = new Date(fin || 0) < new Date();
  const noEmpezada = flash && o.redeem_start_at && new Date(o.redeem_start_at) > new Date();
  const availability = soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
  const tag = benefit(o.discount, o.price_cents, o.currency, lang);
  const prior = priorPrice(o.discount, lang);
  const cover = firstPhoto(o.images);
  const pieces = (o.images || []).slice(0, 8);
  const where = [o.business_address, o.business_city].filter(Boolean).join(', ');
  // Las horas, las del sitio: en Canarias, una menos que en la península.
  const tz = zonaDe(o);

  const S = en
    ? {
        when: 'When', redeem: 'Redemption window', where: 'Where', seats: 'Places left',
        terms: 'Conditions', about: 'About', biz: 'The business',
        open: 'Open in the app', report: 'Report this publication',
        code: 'Get the code', notYet: 'Not available yet', reserve: 'Reserve a place', wait: 'Join the waiting list', save: 'Save to Plans',
        going: "I'm going", invite: 'Invite a friend',
        byCode: 'Getting the code counts as going.', byReservation: 'Reserving a place counts as going.',
        later: 'Not sure yet? Save it to Plans.',
        note: 'From here or from the app, with the same account. The code is single-use and the business validates it on the spot.',
        soldOut: 'Sold out', over: 'Ended', more: 'Everything from', hot: 'Trending',
        prior: 'Lowest price in the last 30 days', canary: 'Canary Islands time',
      }
    : {
        when: 'Cuándo', redeem: 'Se canjea', where: 'Dónde', seats: 'Plazas libres',
        terms: 'Condiciones', about: 'Qué es', biz: 'El negocio',
        open: 'Abrir en la app', report: 'Denunciar esta publicación',
        code: 'Conseguir el código', notYet: 'Aún no disponible', reserve: 'Reservar plaza', wait: 'Apuntarme a la lista de espera', save: 'Guardar en Planes',
        going: 'Voy', invite: 'Invitar a un amigo',
        byCode: 'Conseguir el código ya cuenta como que vas.', byReservation: 'Reservar plaza ya cuenta como que vas.',
        later: 'Si aún no lo tienes claro, guárdalo en Planes.',
        note: 'Desde aquí o desde la app, con la misma cuenta. El código es de un solo uso y lo valida el negocio en el momento.',
        soldOut: 'Agotado', over: 'Terminado', more: 'Todo lo de', hot: 'Con tirón',
        prior: 'Precio más bajo de los últimos 30 días', canary: 'hora de Canarias',
      };

  const when = flash
    ? `${fmtLong(o.redeem_start_at, lang, tz)} – ${fmtEnd(o.redeem_start_at, o.redeem_end_at, lang, tz)}`
    : fmtLong(o.event_at, lang, tz) + (o.event_end_at ? ` – ${fmtEnd(o.event_at, o.event_end_at, lang, tz)}` : '');

  // El beneficio sale en su píldora (coral), junto a cuándo: aquí, el estado.
  const badges = [
    over ? `<span class="badge off">${S.over}</span>` : '',
    !over && soldOut ? `<span class="badge off">${S.soldOut}</span>` : '',
    o.is_trending ? `<span class="badge">${S.hot}</span>` : '',
    o.adults_only ? '<span class="badge">+18</span>' : '',
  ].filter(Boolean).join('');

  // La misma jerarquía que la ficha de la app: la foto o el vídeo en grande;
  // el tipo, el título y el negocio; el precio o el descuento y cuándo; quién
  // va; el botón; y luego qué es, las condiciones y dónde.
  const precioTxt = tag || (o.price_cents != null ? money(o.price_cents, o.currency, lang) : '');
  const logo = o.business_logo && /^https:\/\//.test(o.business_logo)
    ? `<img src="${esc(o.business_logo)}" alt="" width="44" height="44" loading="lazy" decoding="async">`
    : `<span class="fn-ph" aria-hidden="true">${esc((o.business_name || '·').charAt(0).toUpperCase())}</span>`;
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${esc(bHref)}">${esc(o.business_name)}</a></p>
  <div class="detail ficha${pieces.length ? '' : ' sin-media'}">
    ${carrusel(pieces, { titulo: o.title, lang })}
    <div class="d-head">
      <div class="badges"><span class="badge">${esc(flash ? (en ? 'Flash offer' : 'Oferta flash') : (en ? 'Event' : 'Evento'))}</span>${badges}</div>
      <h1 data-tr="offer:${esc(o.id)}:title">${esc(o.title)}</h1>
      <p data-tr-nota="offer:" hidden></p>
      <a class="ficha-negocio" href="${esc(bHref)}"${Number.isFinite(o.lat) && Number.isFinite(o.lng) ? ` data-lat="${Number(o.lat).toFixed(5)}" data-lng="${Number(o.lng).toFixed(5)}"` : ''}>${logo}
        <span><b>${esc(o.business_name)}</b><span class="muted">${o.business_rating && o.business_ratings ? `<span class="stars-mini" aria-hidden="true">★</span> ${nota(o.business_rating, lang)} (${o.business_ratings})` : esc(o.business_city || '')}<span class="tj-dist" hidden></span></span></span>
        <svg class="ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></a>
      <p class="ficha-datos">
        ${precioTxt ? `<span class="precio-pill">${esc(precioTxt)}</span>` : ''}
        ${prior ? `<s class="muted">${esc(prior)}</s>` : ''}
        <span class="dato-chip${flash ? ' oferta' : ''}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="${flash ? 'M7 2v11h3v9l7-12h-4l4-8z' : 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z'}"/></svg>${esc(cuandoCorto(o, lang, tz))}</span>
        ${o.seats_left != null && !soldOut && !over ? `<span class="dato-chip">${esc(en ? (o.seats_left === 1 ? '1 place left' : `${o.seats_left} places left`) : (o.seats_left === 1 ? 'Queda 1 plaza' : `Quedan ${o.seats_left} plazas`))}</span>` : ''}
      </p>
      ${prior ? `<p class="rule">${S.prior}</p>` : ''}
      ${over ? '' : '<p class="quien-va" id="quien-va" hidden></p>'}
    </div>
    <aside class="side">
      ${over ? '' : '<div class="invita" id="invita" hidden></div>'}
      <dl>
        <div><dt>${flash ? S.redeem : S.when}</dt><dd>${esc(when)}${tz === KZ.CANARIAS ? ` <small class="muted">(${S.canary})</small>` : ''}</dd>
          ${flash && !over && !soldOut && o.redeem_end_at ? `<dd id="cuenta" hidden style="color:var(--accent-text);font-weight:800" data-ini="${esc(o.redeem_start_at || '')}" data-fin="${esc(o.redeem_end_at)}"></dd>` : ''}</div>
        ${where ? `<div><dt>${S.where}</dt><dd>${esc(where)}</dd></div>` : ''}
        ${o.seats_left != null && !soldOut ? `<div><dt>${S.seats}</dt><dd>${o.seats_left}${o.holds_seats === false ? ` · ${en ? 'first come, first served' : 'por orden de llegada'}` : ''}</dd></div>` : ''}
      </dl>
      ${over ? '' : (() => {
        // Lo mismo que el botón grande de la app, pero sin salir de la web.
        const id = encodeURIComponent(o.id);
        // Un solo botón de acción. Con código o reserva, conseguirlo ya
        // cuenta como «vas» (no hay «Voy» aparte). Sin código: con entradas
        // fuera, conseguirlas manda y «Voy» queda discreto junto a «Invitar a
        // un amigo»; sin ellas, «Voy» es el botón principal.
        const conCodigo = flash || !!o.reservations_enabled;
        const entradas = !conCodigo && seguro(o.external_url);
        const voy = (clase) => `<a class="${clase}" id="voy" href="${cuenta(lang)}#/voy/${id}" rel="nofollow">${icono('voy', 16)} <span>${S.going}</span></a>`;
        const principal = soldOut ? `<a class="pill accent big" href="${cuenta(lang)}#/espera/${id}">${S.wait}</a>`
          : noEmpezada ? `<span class="pill accent big" aria-disabled="true" style="opacity:.55">${S.notYet}</span>`
          : flash ? `<a class="pill accent big" href="${cuenta(lang)}#/codigo/${id}">${S.code}</a>`
            : o.reservations_enabled ? `<a class="pill accent big" href="${cuenta(lang)}#/reservar/${id}">${S.reserve}</a>`
              : entradas ? (() => {
                // Como la app: «Entradas en DICE» si es una plataforma conocida;
                // si no, «Conseguir entradas» con el dominio debajo.
                const pl = plataformaEntradas(o.external_url);
                const txt = pl?.plataforma ? (en ? `Tickets on ${pl.plataforma}` : `Entradas en ${pl.plataforma}`) : (en ? 'Get tickets' : 'Conseguir entradas');
                const sub = !pl?.plataforma && pl?.dominio ? `<small style="display:block;font-weight:500;opacity:.8">${esc(pl.dominio)}</small>` : '';
                return `<a class="pill accent big" href="${esc(entradas)}" rel="nofollow noopener" target="_blank" aria-label="${esc(txt)}${en ? ' (opens outside Klendar)' : ' (se abre fuera de Klendar)'}">${esc(txt)}${sub}</a>`;
              })()
                : voy('pill accent big');
        // «Voy» e «Invitar a un amigo»: la página va en caché y no sabe quién
        // la mira; si ya vas, lo pinta el navegador (/assets/amigos.js).
        return `${principal}
          <p class="acciones amigos-acc" id="amigos-ficha" data-offer="${esc(o.id)}"${conCodigo ? ` data-codigo="${flash ? 'codigo' : 'reservar'}"` : ''}>
            ${entradas ? voy('pill') : ''}
            <a class="pill" href="${cuenta(lang)}#/invitar/${id}" rel="nofollow">${icono('invitar', 16)} ${S.invite}</a></p>
          <p class="note" id="voy-auto" hidden></p>
          ${conCodigo ? `<p class="note" id="voy-pista">${flash ? S.byCode : S.byReservation} ${S.later}</p>` : ''}
          <p class="acciones"><a class="pill" data-plan="${id}" href="${cuenta(lang)}#/guardar/${id}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg> <span>${S.save}</span></a>
            ${openInApp(path, S.open, 'pill ghost')}</p>
          <p class="acciones">${historiaBoton(lang, 'o', o.id)}</p>`;
      })()}
      ${serieFicha(serie, o.id, lang)}
      <p class="note">${S.note}</p>
    </aside>
    <div class="d-body">
      ${o.description ? `<h2>${S.about}</h2><p data-tr="offer:${esc(o.id)}:description">${esc(o.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${o.terms ? `<h2>${S.terms}</h2><p class="muted" data-tr="offer:${esc(o.id)}:terms">${esc(o.terms).replace(/\n/g, '<br>')}</p>` : ''}
      ${where ? `<h2>${S.where}</h2>
      <p class="info-linea">${icono('lugar')}<span>${o.lat ? `<a href="${esc(`https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`)}" rel="nofollow noopener" target="_blank">${esc(where)}</a>` : esc(where)}</span></p>` : ''}
      <h2>${S.biz}</h2>
      <p>${esc(o.business_name)}${o.business_rating && o.business_ratings ? ` · ★ ${nota(o.business_rating, lang)} (${o.business_ratings})` : ''}</p>
      <p><a href="${esc(bHref)}">${S.more} ${esc(o.business_name)} →</a></p>
      <p class="denuncia-pie"><a href="${cuenta(lang)}#/denunciar/offer/${encodeURIComponent(o.id)}" rel="nofollow">${S.report}</a></p>
    </div>
  </div>`;

  const description = [tag, flash ? when : fmtLong(o.event_at, lang, tz), o.business_name, o.business_city]
    .filter(Boolean).join(' · ').slice(0, 200);

  const jsonLd = flash
    ? {
        '@context': 'https://schema.org', '@type': 'Offer', name: o.title, description: o.description || undefined,
        url: `${BASE}${path}`, image: cover || undefined, validFrom: o.redeem_start_at, validThrough: o.redeem_end_at,
        offeredBy: { '@type': 'LocalBusiness', name: o.business_name, url: `${BASE}${bHref}`, address: where || undefined },
        price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : undefined,
        priceCurrency: o.price_cents != null ? (o.currency || 'EUR') : undefined,
        availability,
      }
    : {
        '@context': 'https://schema.org', '@type': 'Event', name: o.title, description: o.description || undefined,
        url: `${BASE}${path}`, image: cover || undefined, startDate: o.event_at, endDate: o.event_end_at || undefined,
        eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: o.business_name, url: `${BASE}${bHref}`, address: where || undefined },
        organizer: { '@type': 'Organization', name: o.business_name, url: `${BASE}${bHref}` },
        offers: o.reservations_enabled
          ? {
              '@type': 'Offer', url: `${BASE}${path}`, availability,
              price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : '0',
              priceCurrency: o.currency || 'EUR',
            }
          : undefined,
      };

  // La vista cuenta para el negocio (panel e informe), como en la app. Solo
  // desde un navegador de verdad y una vez por sesión: los robots de Google o
  // de WhatsApp no ejecutan esto.
  // La cuenta atrás, como en la app («Quedan 1 h 31 min»). Se calcula en el
  // navegador: la página va en caché y una hora escrita aquí saldría vieja.
  const cuentaAtras = `<script>(function(){var el=document.getElementById('cuenta');if(!el)return;
var ini=Date.parse(el.dataset.ini)||0,fin=Date.parse(el.dataset.fin);
function dur(ms){var m=Math.floor(ms/60000);if(m>=1440)return Math.floor(m/1440)+' d';if(m>=60)return Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':'');return Math.max(1,m)+' min';}
function tic(){var n=Date.now();if(n>=fin){el.textContent=${JSON.stringify(S.over)};return;}
el.textContent=n<ini?${JSON.stringify(en ? 'Starts in ' : 'Empieza en ')}+dur(ini-n):${en ? "dur(fin-n)+' left'" : "'Quedan '+dur(fin-n)"};el.hidden=false;setTimeout(tic,30000);}tic();})();</script>`;
  const sp = supabasePublic();
  // Cuenta la visita para las estadísticas del negocio. Sin guardar nada en el
  // navegador (ni cookies ni sessionStorage): la base ya no cuenta dos veces a
  // la misma persona en 30 minutos (`offer_views_dedupe`).
  const vista = `<script>(function(){try{if(navigator.webdriver)return;fetch(${JSON.stringify(sp.url + '/rest/v1/offer_views')},{method:'POST',keepalive:true,headers:{apikey:${JSON.stringify(sp.key)},Authorization:'Bearer '+${JSON.stringify(sp.key)},'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({offer_id:'${o.id}'})});}catch(e){}})();</script>`;

  return html(publicPage({
    lang, path, image: cover, body: body + cuentaAtras + vista,
    title: `${o.title} · ${o.business_name}`,
    description,
    head: `${traducir(lang, `offer:${o.id}`)}
<meta name="robots" content="${o.adults_only ? 'noindex' : 'index, follow'}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  }));
}

/** Días de una regla (0 = domingo), lunes primero: «jueves», «lunes, miércoles». */
function diasSerie(dias, en) {
  const s = new Set(dias || []);
  if (s.size === 7) return en ? 'every day' : 'todos los días';
  if (s.size === 5 && [1, 2, 3, 4, 5].every((d) => s.has(d))) return en ? 'Monday to Friday' : 'de lunes a viernes';
  if (s.size === 2 && s.has(0) && s.has(6)) return en ? 'weekends' : 'los fines de semana';
  const fmt = new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { weekday: 'long', timeZone: 'UTC' });
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.has(d)).map((d) => fmt.format(Date.UTC(2024, 0, 7 + d))).join(', ');
}

/**
 * «Forma parte de una serie»: el nombre, cuándo se repite (si sale de una
 * regla), cuántas fechas más hay y «Seguir la serie», que lleva a «Tu
 * cuenta» (la página va en caché y no sabe quién mira: allí se ve si ya la
 * sigues y lo de «Añadir cada fecha a mis planes»). Como la app.
 */
function serieFicha(s, offerId, lang) {
  if (!s || !s.series_id || !s.name) return '';
  const en = lang === 'en';
  const n = Number(s.upcoming) || 0;
  const detalle = [
    s.weekdays?.length && s.start_time && s.rule_active !== false
      ? (en ? `Repeats: ${diasSerie(s.weekdays, en)} at ${s.start_time}` : `Se repite: ${diasSerie(s.weekdays, en)} a las ${s.start_time}`)
      : '',
    en ? (n === 0 ? 'No more dates posted yet' : n === 1 ? '1 more date posted' : `${n} more dates posted`)
      : (n === 0 ? 'Por ahora no hay más fechas publicadas' : n === 1 ? '1 fecha más publicada' : `${n} fechas más publicadas`),
  ].filter(Boolean).join(' · ');
  return `<div class="serie-ficha">
        <p class="info-linea">${icono('serie')}<span><small class="muted">${en ? 'Part of a series' : 'Forma parte de una serie'}</small><br><b>${esc(s.name)}</b><br><small class="muted">${esc(detalle)}</small></span></p>
        <p class="acciones"><a class="pill" href="${cuenta(lang)}#/serie/${encodeURIComponent(offerId)}" rel="nofollow">${en ? 'Follow the series' : 'Seguir la serie'}</a></p>
        <p class="note">${en ? "We'll let you know when the next date is posted." : 'Te avisamos cuando se publique la siguiente fecha.'}</p>
      </div>`;
}

/**
 * La ficha de una exclusiva que quien mira no puede ver: el tipo y cuándo,
 * de qué negocio y cómo conseguirla (favoritos → añadir a favoritos desde
 * «Tu cuenta»; clientes → la ficha del negocio). Sin beneficio, sin fotos de
 * la oferta, sin JSON-LD y fuera de Google: no hay nada que indexar.
 */
function lockedOfferPage(o, lang, path, bHref) {
  const en = lang === 'en';
  const fav = o.audience !== 'customers';
  const n = o.business_name || '';
  const tz = zonaDe(o);
  const flash = o.kind === 'flash_offer';
  const S = en
    ? {
        page: `Exclusive publication · ${n}`,
        kind: flash ? 'Flash offer' : 'Event', redeem: 'Redemption window', when: 'When',
        title: fav ? `Exclusive for people who have ${n} in their favourites` : `Exclusive for ${n}'s customers`,
        text: fav ? `Add ${n} to your favourites to see it and get it.`
          : "It's for people with stamps on one of their cards. Get your first one by redeeming one of their offers or with the venue QR code.",
        btn: fav ? 'Add to favourites' : 'See the business',
        note: fav ? "If it's already in your favourites, open it in the app or log in."
          : 'If you already have stamps, open it in the app or log in.',
        open: 'Open in the app', code: 'Get the code', reserve: 'Reserve a place', canary: 'Canary Islands time',
      }
    : {
        page: `Publicación exclusiva · ${n}`,
        kind: flash ? 'Oferta flash' : 'Evento', redeem: 'Se canjea', when: 'Cuándo',
        title: fav ? `Exclusiva para quien tiene ${n} en favoritos` : `Exclusiva para clientes de ${n}`,
        text: fav ? `Añade ${n} a favoritos para verla y conseguirla.`
          : 'Es para quien tiene sellos en alguna de sus tarjetas. Consigue el primero canjeando una de sus ofertas o con el QR del local.',
        btn: fav ? 'Añadir a favoritos' : 'Ver el negocio',
        note: fav ? 'Si ya lo tienes en favoritos, ábrela en la app o entra con tu cuenta.'
          : 'Si ya tienes sellos, ábrela en la app o entra con tu cuenta.',
        open: 'Abrir en la app', code: 'Conseguir el código', reserve: 'Reservar plaza', canary: 'hora de Canarias',
      };
  const when = flash
    ? `${fmtLong(o.redeem_start_at, lang, tz)} – ${fmtEnd(o.redeem_start_at, o.redeem_end_at, lang, tz)}`
    : fmtLong(o.event_at, lang, tz) + (o.event_end_at ? ` – ${fmtEnd(o.event_at, o.event_end_at, lang, tz)}` : '');
  const where = [o.business_address, o.business_city].filter(Boolean).join(', ');
  // «…o entra con tu cuenta»: el mismo botón que una ficha normal, en
  // «Tu cuenta». Pide entrar si hace falta y allí la base ya sabe quién mira:
  // a quien le toca le da el código; a quien no, le dice por qué.
  const accion = flash ? [`#/codigo/${encodeURIComponent(o.id)}`, S.code]
    : o.reservations_enabled ? [`#/reservar/${encodeURIComponent(o.id)}`, S.reserve] : null;
  const boton = fav
    ? `<a class="pill accent big" href="${cuenta(lang)}#/seguir/${encodeURIComponent(o.business_id)}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3 1.6-1.8 3-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg> ${esc(S.btn)}</a>`
    : `<a class="pill accent big" href="${esc(bHref)}">${icono('negocio', 16)} ${esc(S.btn)}</a>`;
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${esc(bHref)}">${esc(n)}</a></p>
  <div class="detail ficha${o.business_cover ? '' : ' sin-media'}">
    ${o.business_cover ? carrusel([o.business_cover], { titulo: n, forma: 'negocio', lang }) : ''}
    <div class="d-head">
      <div class="badges"><span class="badge">${esc(S.kind)}</span>${o.adults_only ? '<span class="badge">+18</span>' : ''}</div>
      <h1>${esc(S.title)}</h1>
      <p class="muted">${esc(n)}${where ? ` · ${esc(where)}` : ''}</p>
      <p>${esc(S.text)}</p>
    </div>
    <aside class="side">
      <dl>
        <div><dt>${flash ? S.redeem : S.when}</dt><dd>${esc(when)}${tz === KZ.CANARIAS ? ` <small class="muted">(${S.canary})</small>` : ''}</dd></div>
      </dl>
      ${boton}
      <p class="acciones">${accion ? `<a class="pill" href="${cuenta(lang)}${accion[0]}" rel="nofollow">${esc(accion[1])}</a>` : ''}
        ${openInApp(path, S.open, 'pill ghost')}</p>
      <p class="note">${esc(S.note)}</p>
    </aside>
  </div>`;
  return html(publicPage({
    lang, path, body, image: o.business_cover || o.business_logo,
    title: S.page, description: `${S.title}. ${S.text}`.slice(0, 200),
    head: '<meta name="robots" content="noindex">',
  }));
}

// ── Negocio ────────────────────────────────────────────────────────────────
/** Redirección permanente dentro de la web (relativa: vale igual en local). */
const movida = (to) => new Response(null, {
  status: 301, headers: { location: to, 'cache-control': 'public, max-age=3600, s-maxage=3600' },
});

/** Qué da sello en una tarjeta: las mismas palabras que la app y «Tu cuenta». */
function queSellaFicha(c, S, en) {
  if (c.applies_to === 'flash_offer') return S.stampsFlash;
  if (c.applies_to === 'future_event') return S.stampsEvents;
  if (c.applies_to === 'categories' || c.applies_to === 'offers') {
    const nombres = c.applies_to === 'categories'
      ? (c.category_names || []).map((n) => (en ? n.en : n.es) || n.es || '').filter(Boolean)
      : (c.offer_titles || []);
    if (!nombres.length) return c.applies_to === 'categories' ? S.stampsSomeCats : S.stampsSomeOffers;
    const lista = nombres.slice(0, 3).join(', ');
    return S.stampsOnly(nombres.length > 3 ? S.stampsMore(lista, nombres.length - 3) : lista);
  }
  return S.stampsAll;
}
/** Las fotos y vídeos de una reseña (`media`, hasta 6, en su orden;
 * klendar/docs/RESENAS_MEDIOS.md): miniaturas que abren el visor (con
 * carrusel y sonido), como en la app. Lo que está en revisión no sale (la
 * ficha va sin sesión). Sin `media` (antes de 20261104100000), la foto única. */
function resenaMedios(r, lang) {
  const urls = Array.isArray(r.media)
    ? r.media.filter((m) => m && !m.in_review).map((m) => ({
        url: m.url, kind: m.kind, poster_url: m.poster_url, duration_ms: m.duration_ms,
        // En el visor, «Denunciar» esa foto o ese vídeo solo.
        denuncia: isUuid(m.id) ? `${cuenta(lang)}#/denunciar/review_media/${m.id}` : null,
      }))
    : (r.photo_url ? [r.photo_url] : []);
  return miniaturas(urls, { grupo: `resena-${r.id}`, lang, clase: 'miniaturas resena-medios' });
}

/** Lo de arriba y, si la tarjeta también sella por visita, dicho. */
// Los catorce alérgenos, con la clave que guarda la carta y su nombre en cada
// idioma (los mismos que el panel y la app); una clave desconocida sale tal cual.
const ALERGENOS = {
  gluten: ['Gluten', 'Gluten'], crustaceos: ['Crustáceos', 'Crustaceans'], huevos: ['Huevos', 'Eggs'],
  pescado: ['Pescado', 'Fish'], cacahuetes: ['Cacahuetes', 'Peanuts'], soja: ['Soja', 'Soy'],
  lacteos: ['Lácteos', 'Milk'], frutos_cascara: ['Frutos de cáscara', 'Tree nuts'], apio: ['Apio', 'Celery'],
  mostaza: ['Mostaza', 'Mustard'], sesamo: ['Sésamo', 'Sesame'], sulfitos: ['Sulfitos', 'Sulphites'],
  altramuces: ['Altramuces', 'Lupin'], moluscos: ['Moluscos', 'Molluscs'],
};
const nombreAlergeno = (k, en) => (ALERGENOS[k] ? ALERGENOS[k][en ? 1 : 0] : String(k).replace(/_/g, ' '));
const queSellaTarjeta = (c, S, en) => (c.by_visit ? `${queSellaFicha(c, S, en)} · ${S.stampsByVisit}` : queSellaFicha(c, S, en));

/**
 * La ficha de un negocio: `/b/cafe-central-madrid`.
 *
 * `/b/<id>` (los enlaces de antes, los QR impresos, la app) lleva a la de la
 * dirección con nombre con un 301, y una dirección vieja (el negocio cambió
 * de nombre) a la actual: una sola URL por negocio para Google.
 */
export async function businessPage(param, lang, search = '') {
  const en = lang === 'en';
  const raw = String(param || '');
  let id = raw;
  let slug = null;
  if (isUuid(raw)) {
    slug = await slugDe(raw);
    if (slug) return movida(bizPath(lang, slug) + search);
  } else {
    const limpio = raw.toLowerCase();
    if (!isSlug(limpio)) return notFound(lang, bizPath(lang, raw), 'b');
    const r = await rpc('resolve_business_slug', { p_slug: limpio });
    if (!r?.id) return (await cerradoPage(lang, limpio, bizPath(lang, limpio))) || notFound(lang, bizPath(lang, limpio), 'b');
    if (r.slug !== raw) return movida(bizPath(lang, r.slug) + search);
    id = r.id;
    slug = r.slug;
  }
  const path = bizPath(lang, slug || id);
  if (!isUuid(id)) return notFound(lang, path, 'b');
  const b = await rpc('business_profile', { p_id: id });
  if (!b || !b.name) return (await cerradoPage(lang, id, path)) || notFound(lang, path, 'b');
  // «Clientes verificados»: solo las reseñas de quien ha canjeado algo aquí
  // (`?resenas=verificadas`, el mismo filtro que la app).
  const soloVerificadas = new URLSearchParams(search).get('resenas') === 'verificadas';
  const [offers, sellos, carta, opiniones, novedades, cierres, nVerificadas] = await Promise.all([
    rpcAll('business_offers', { p_id: id }),
    rpcAll('stamp_cards_of', { p_business: id }).catch(() => []), // opcional: sin ella, la ficha sale igual
    rpcAll('business_menu', { p_business: id }),
    rpcAll('business_reviews', { p_id: id, p_limit: 12, ...(soloVerificadas ? { p_verified_only: true } : {}) }),
    rows('business_posts', `select=id,body,image_url,created_at&business_id=eq.${id}&order=created_at.desc&limit=6`),
    rpcAll('business_closures', { p_business: id }),
    rpc('business_verified_review_count', { p_id: id }).then((n) => Number(n) || 0).catch(() => 0),
  ]);

  const S = en
    ? {
        now: 'On right now', soon: 'Coming up',
        none: 'Nothing published right now. It changes often — take a look in the app.',
        open: 'Add to favourites', note: "From here or from the app, with the same account. We'll let you know when this business posts something.",
        verified: 'Verified business', since: 'On Klendar since', redeemed: (n) => (n === 1 ? '1 redemption validated' : `${n} redemptions validated`),
        about: 'About', menu: 'Menu',
        stamps: 'Stamp card', allergens: 'Allergens',
        menuNote: 'Allergens as declared by the business. If you have an allergy, ask at the venue.',
        stampsMany: 'Stamp cards',
        stampsBody: (n, r) => `${n} stamps: “${r}”`,
        stampsNote: 'Each redemption that counts earns a stamp (at most one a day per card), and the app keeps count.',
        stampsAll: 'Every publication counts', stampsFlash: 'Only flash offers count', stampsEvents: 'Only events count',
        stampsSomeCats: 'Only some categories count', stampsSomeOffers: 'Only some publications count',
        stampsOnly: (l) => `Only these count: ${l}`, stampsMore: (l, n) => `${l} and ${n} more`,
        stampsByVisit: 'Also per visit with the venue QR code',
        stampsNoteVisit: 'Each redemption that counts earns a stamp, and so does scanning the venue QR code when the card says so: at most one a day per card. The app keeps count.',
        hours: 'Opening hours', closed: 'Closed', today: 'today',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        news: 'News', reviews: 'Reviews', write: 'Write a review', noReviews: 'No reviews yet. Been here? Be the first.',
        user: 'Klendar user', report: 'Report', block: 'Block', reportBiz: 'Report this business', menuPhotos: 'Photos of the menu', menuPdf: 'Menu (PDF)',
        verifiedCustomer: 'Verified customer',
        verifiedWhat: "They've redeemed something at this business with Klendar: an offer, an event, a stamp reward or a birthday gift. We check it against the redemptions validated at the venue.",
        howReviews: 'How reviews work', allReviews: 'All',
        verifiedReviews: (n) => `Verified customers (${n})`, noVerified: 'No reviews from verified customers yet.',
        claim: 'Is this your business?',
        replyFrom: (n) => `Reply from ${n}`,
        closedToday: 'Closed today', closedUntil: (d) => `Closed until ${d}`,
        closedTemp: 'Temporarily closed', closedTempBody: "This business has closed for a while and isn't posting anything right now.",
        closingDay: (d) => `Closing on ${d}`, closing: (a, b) => `Closing from ${a} to ${b}`,
        moreIn: (c) => `More in ${c}:`, cityToday: 'things to do today', cityWeek: 'this week',
        hiddenFav: (n) => (n === 1 ? "There's 1 exclusive publication for people who have it in their favourites."
          : `There are ${n} exclusive publications for people who have it in their favourites.`),
        hiddenCust: (n) => (n === 1 ? "There's 1 exclusive publication for their customers with stamps."
          : `There are ${n} exclusive publications for their customers with stamps.`),
        birthday: 'Birthday gift for people who have it in their favourites',
      }
    : {
        now: 'Ahora mismo', soon: 'Próximamente',
        none: 'Ahora mismo no hay nada publicado. Suele cambiar: échale un ojo en la app.',
        open: 'Añadir a favoritos', note: 'Desde aquí o desde la app, con la misma cuenta. Te avisamos cuando este negocio publique algo.',
        verified: 'Negocio verificado', since: 'En Klendar desde', redeemed: (n) => (n === 1 ? '1 canje validado' : `${n} canjes validados`),
        about: 'Sobre el negocio', menu: 'Carta',
        stamps: 'Tarjeta de sellos', allergens: 'Alérgenos',
        menuNote: 'Los alérgenos son los que declara el negocio. Si tienes alergia, pregunta en el sitio.',
        stampsMany: 'Tarjetas de sellos',
        stampsBody: (n, r) => `${n} sellos: «${r}»`,
        stampsNote: 'Cada canje que cuenta deja un sello, como mucho uno al día por tarjeta, y la app lleva la cuenta.',
        stampsAll: 'Cuentan todas las publicaciones', stampsFlash: 'Solo cuentan las ofertas flash', stampsEvents: 'Solo cuentan los eventos',
        stampsSomeCats: 'Solo cuentan algunas categorías', stampsSomeOffers: 'Solo cuentan algunas publicaciones',
        stampsOnly: (l) => `Solo cuentan: ${l}`, stampsMore: (l, n) => `${l} y ${n} más`,
        stampsByVisit: 'También por visita con el QR del local',
        stampsNoteVisit: 'Cada canje que cuenta deja un sello, y también escanear el QR del local si la tarjeta lo dice: como mucho uno al día por tarjeta. La app lleva la cuenta.',
        hours: 'Horario', closed: 'Cerrado', today: 'hoy',
        days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
        news: 'Novedades', reviews: 'Reseñas', write: 'Escribir una reseña', noReviews: 'Todavía no hay reseñas. ¿Has estado? Sé la primera persona.',
        user: 'Usuario de Klendar', report: 'Denunciar', block: 'Bloquear', reportBiz: 'Denunciar este negocio', menuPhotos: 'Fotos de la carta', menuPdf: 'Carta (PDF)',
        verifiedCustomer: 'Cliente verificado',
        verifiedWhat: 'Ha canjeado algo en este negocio con Klendar: una oferta, un evento, un premio de sellos o un regalo de cumpleaños. Lo comprobamos con los canjes validados en el local.',
        howReviews: 'Cómo funcionan las reseñas', allReviews: 'Todas',
        verifiedReviews: (n) => `Clientes verificados (${n})`, noVerified: 'Aún no hay reseñas de clientes verificados.',
        claim: '¿Es tu negocio?',
        replyFrom: (n) => `Respuesta de ${n}`,
        closedToday: 'Cerrado hoy', closedUntil: (d) => `Cerrado hasta el ${d}`,
        closedTemp: 'Cerrado temporalmente', closedTempBody: 'Este negocio ha cerrado por un tiempo y ahora no publica nada.',
        closingDay: (d) => `Cerrará el ${d}`, closing: (a, b) => `Cerrará del ${a} al ${b}`,
        moreIn: (c) => `Más en ${c}:`, cityToday: 'qué hacer hoy', cityWeek: 'esta semana',
        hiddenFav: (n) => (n === 1 ? 'Hay 1 publicación exclusiva para quien lo tiene en favoritos.'
          : `Hay ${n} publicaciones exclusivas para quien lo tiene en favoritos.`),
        hiddenCust: (n) => (n === 1 ? 'Hay 1 publicación exclusiva para sus clientes con sellos.'
          : `Hay ${n} publicaciones exclusivas para sus clientes con sellos.`),
        birthday: 'Regalo de cumpleaños para quien lo tiene en favoritos',
      };

  const flash = offers.filter((o) => o.kind === 'flash_offer');
  const events = offers.filter((o) => o.kind !== 'flash_offer');
  // Lo que la ficha no enseña a quien mira sin sesión: las exclusivas para
  // favoritos o clientes (solo cuántas hay) y el regalo de cumpleaños. Es la
  // razón para añadirlo a favoritos, así que se dice.
  const nFav = Number(b.hidden_for_favorites) || 0;
  const nCli = Number(b.hidden_for_customers) || 0;
  const exclusivas = [
    nFav > 0 ? `<p class="exclusiva">${icono('candado')}<span>${esc(S.hiddenFav(nFav))}</span></p>` : '',
    nCli > 0 ? `<p class="exclusiva">${icono('candado')}<span>${esc(S.hiddenCust(nCli))}</span></p>` : '',
    b.birthday_gift ? `<p class="exclusiva">${icono('regalo')}<span>${esc(S.birthday)}</span></p>` : '',
  ].join('');
  const where = [b.address, b.city].filter(Boolean).join(', ');
  // Todo lo de la ficha, en la hora del negocio (Canarias, una menos).
  const tz = zonaDe(b);

  // Días cerrados (vacaciones, festivos): el que está en curso o, si cae en
  // el próximo mes, el siguiente. Igual que en la app. Fechas de calendario,
  // sin hora: se comparan como texto AAAA-MM-DD con el hoy del negocio.
  const cierre = (() => {
    // Cerrado hasta nuevo aviso (desde «Dar de baja el negocio»): manda sobre
    // los días cerrados.
    if (b.closed_indefinitely) {
      return `<p class="cierre ahora">${icono('cerrado', 18)}<span><b>${esc(S.closedTemp)}</b> · ${esc(S.closedTempBody)}</span></p>`;
    }
    const c = cierres[0];
    if (!c) return '';
    const hoyIso = KZ.hoy(tz);
    const dia = (iso) => new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(`${iso}T00:00:00Z`));
    const ahora = c.starts_on <= hoyIso && hoyIso <= c.ends_on;
    const dias = (new Date(`${c.starts_on}T00:00:00Z`) - new Date(`${hoyIso}T00:00:00Z`)) / 864e5;
    if (!ahora && dias > 30) return '';
    const txt = ahora
      ? (c.ends_on === hoyIso ? S.closedToday : S.closedUntil(dia(c.ends_on)))
      : (c.starts_on === c.ends_on ? S.closingDay(dia(c.starts_on))
        // «Del 12 al 13 de octubre» si es el mismo mes.
        : S.closing(c.starts_on.slice(0, 7) === c.ends_on.slice(0, 7) ? String(Number(c.starts_on.slice(8, 10))) : dia(c.starts_on), dia(c.ends_on)));
    return `<p class="cierre${ahora ? ' ahora' : ''}">${icono('cerrado', 18)}<span><b>${esc(txt)}</b>${c.reason ? ` · ${esc(c.reason)}` : ''}</span></p>`;
  })();

  // Horario: {"1": [["09:00","14:00"], …], …, "7": []} (1 = lunes). Hoy, en
  // la hora del negocio, va marcado.
  const horas = b.opening_hours && typeof b.opening_hours === 'object' ? b.opening_hours : null;
  const hoy = KZ.diaSemana(tz);
  const horario = horas && Object.keys(horas).length
    ? `<table class="horario">${[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const tramos = Array.isArray(horas[d]) ? horas[d] : (Array.isArray(horas[String(d)]) ? horas[String(d)] : []);
        const txt = tramos.length ? tramos.map((t) => `${esc(t[0])}–${esc(t[1])}`).join(', ') : S.closed;
        return `<tr${d === hoy ? ' class="hoy"' : ''}><th>${S.days[d - 1]}${d === hoy ? ` <small>(${S.today})</small>` : ''}</th><td>${txt}</td></tr>`;
      }).join('')}</table>`
    : '';

  // Redes: el negocio puede guardar el @ o el enlace entero.
  const redUrl = (red, v) => {
    const val = String(v || '').trim();
    if (/^https?:\/\//.test(val)) return val;
    const h = val.replace(/^@/, '');
    return { instagram: `https://instagram.com/${h}`, tiktok: `https://tiktok.com/@${h}`,
      facebook: `https://facebook.com/${h}`, x: `https://x.com/${h}`, twitter: `https://x.com/${h}`,
      youtube: `https://youtube.com/@${h}` }[red] || `https://${val}`;
  };
  const redNombre = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', x: 'X', twitter: 'X', youtube: 'YouTube' };
  const redes = Object.entries(b.social || {})
    .filter(([k, v]) => k !== 'web' && typeof v === 'string' && v.trim())
    .map(([k, v]) => `<a href="${esc(redUrl(k, v))}" rel="nofollow noopener" target="_blank">${esc(redNombre[k] || k)}</a>`);

  const fotosCarta = (b.menu_images || []).filter((u) => typeof u === 'string' && seguro(u));
  const galeria = (b.gallery || []).filter((u) => typeof u === 'string' && u);
  const estrellas = (n) => `<span class="stars" aria-label="${n}/5">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>`;
  const since = KZ.fmt(b.member_since, tz, en ? 'en-GB' : 'es-ES', { month: 'long', year: 'numeric' });
  const maps = b.lat ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}` : null;
  const city = b.city ? `${agendaBase(lang)}/${citySeg(b.city)}/` : null;
  const cityToday = b.city ? `${todayBase(lang)}/${citySeg(b.city)}/` : null;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a>${city ? ` · <a href="${city}">${esc(b.city)}</a>` : ''}</p>
  <div class="detail negocio${b.cover || galeria.length ? '' : ' sin-media'}">
    ${carrusel([b.cover, ...galeria].filter(Boolean), { titulo: b.name, forma: 'negocio', lang })}
    <div class="d-head">
      <div class="neg-id">
        ${b.logo && /^https:\/\//.test(b.logo) ? `<img class="neg-logo" src="${esc(b.logo)}" alt="" width="88" height="88">` : `<span class="neg-logo" aria-hidden="true">${esc((b.name || '·').charAt(0).toUpperCase())}</span>`}
        <div><h1>${esc(b.name)}</h1>
          <p class="muted"${b.lat ? ` data-lat="${Number(b.lat).toFixed(5)}" data-lng="${Number(b.lng).toFixed(5)}"` : ''}>${esc(b.city || '')}<span class="tj-dist" hidden></span></p></div>
      </div>
      ${where ? `<a class="neg-dir" href="${esc(maps || '#')}" rel="nofollow noopener" target="_blank">${icono('lugar')}<span>${esc(b.address || where)}</span><svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></a>` : ''}
      ${b.rating && b.ratings ? `<p class="neg-nota"><a href="#resenas"><span class="stars-mini" aria-hidden="true">★</span> ${nota(b.rating, lang)} · ${esc(en ? (b.ratings === 1 ? '1 review' : `${b.ratings} reviews`) : (b.ratings === 1 ? '1 reseña' : `${b.ratings} reseñas`))}</a></p>` : ''}
      <div class="badges">
        ${b.is_verified ? `<span class="badge ok">✓ ${S.verified}</span>` : ''}
        ${b.redemptions_total ? `<span class="badge">${esc(S.redeemed(Number(b.redemptions_total)))}</span>` : ''}
        ${since ? `<span class="badge">${S.since} ${esc(since)}</span>` : ''}
      </div>
      ${cierre}
      <nav class="neg-secciones" aria-label="${esc(b.name)}">
        ${flash.length ? `<a class="chip" href="#ahora">${esc(S.now)} <span class="muted">${flash.length}</span></a>` : ''}
        ${events.length ? `<a class="chip" href="#proximamente">${esc(S.soon)} <span class="muted">${events.length}</span></a>` : ''}
        ${novedades.length ? `<a class="chip" href="#novedades">${esc(S.news)}</a>` : ''}
        ${carta.length || fotosCarta.length ? `<a class="chip" href="#carta">${esc(S.menu)}</a>` : ''}
        <a class="chip" href="#resenas">${esc(S.reviews)}</a>
      </nav>
    </div>
    <aside class="side">
      <a class="pill accent big" data-fav="${esc(b.id)}" href="${cuenta(lang)}#/seguir/${encodeURIComponent(b.id)}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3 1.6-1.8 3-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg> <span>${S.open}</span></a>
      <p class="note" style="margin-bottom:16px">${S.note}</p>
      <p class="acciones" style="margin:0 0 16px">${historiaBoton(lang, 'b', slug || b.id)}</p>
      <div class="info">
        ${where ? `<div><span>${icono('lugar')}</span><span>${maps ? `<a href="${esc(maps)}" rel="nofollow noopener" target="_blank">${esc(where)}</a>` : esc(where)}</span></div>` : ''}
        ${b.phone ? `<div><span>${icono('telefono')}</span><span><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></span></div>` : ''}
        ${seguro(b.website) ? `<div><span>${icono('web')}</span><span><a href="${esc(seguro(b.website))}" rel="nofollow noopener" target="_blank">${esc(String(b.website).replace(/^https?:\/\//, ''))}</a></span></div>` : ''}
        ${seguro(b.menu_url) ? `<div><span>${icono('carta')}</span><span><a href="${esc(seguro(b.menu_url))}" rel="nofollow noopener" target="_blank">${S.menu}</a></span></div>` : ''}
        ${b.contact_email ? `<div><span>${icono('correo')}</span><span><a href="mailto:${esc(b.contact_email)}">${esc(b.contact_email)}</a></span></div>` : ''}
        ${redes.length ? `<div><span>${icono('redes')}</span><span>${redes.join(' · ')}</span></div>` : ''}
      </div>
      ${horario ? `<h2 class="side-h">${S.hours}</h2><p class="estado-hoy" hidden data-horario="${esc(JSON.stringify(horas))}" data-cierres="${esc(JSON.stringify(cierres.map((c) => ({ starts_on: c.starts_on, ends_on: c.ends_on }))))}" data-tz="${esc(tz)}" data-lang="${en ? 'en' : 'es'}"></p>${horario}` : ''}
    </aside>
    <div class="d-body">
      ${b.description ? `<h2>${S.about}</h2><p data-tr="business:${esc(b.id)}:description">${esc(b.description).replace(/\n/g, '<br>')}</p>
      <p data-tr-nota="business:" hidden></p>` : ''}
      ${flash.length ? `<h2 id="ahora">${S.now}</h2>${rejilla(flash, lang, { tz, sinNegocio: true, galeria: true })}` : ''}
      ${events.length ? `<h2 id="proximamente">${S.soon}</h2>${rejilla(events, lang, { tz, sinNegocio: true, galeria: true })}` : ''}
      ${offers.length ? '' : `<p class="empty">${S.none}</p>`}
      ${exclusivas}
      ${sellos.length ? `<h2>${sellos.length > 1 ? S.stampsMany : S.stamps}</h2>
        ${sellos.map((c) => `<p class="callout"><b>${esc(c.name)}</b> · ${esc(S.stampsBody(c.goal, c.reward))}<br><small>${esc(queSellaTarjeta(c, S, en))}</small></p>`).join('')}
        <p class="muted">${esc(sellos.some((c) => c.by_visit) ? S.stampsNoteVisit : S.stampsNote)}</p>` : ''}
      ${carta.length ? `<h2 id="carta">${S.menu}</h2>
        <p data-tr-nota="menu_" hidden></p>
        <div class="menu">${carta.map((sec, si) => `<section>
          <h3${isUuid(sec.id) ? ` data-tr="menu_section:${sec.id}:name"` : ''}>${esc(sec.name)}</h3>
          <ul>${(sec.items || []).map((it, ii) => `<li>
            ${seguro(it.image_url) ? miniatura(seguro(it.image_url), { grupo: `plato-${si}-${ii}`, clase: 'dish', etiqueta: it.name, lang, ancho: 56, alto: 56 }) : ''}
            <span class="plato"><b${isUuid(it.id) ? ` data-tr="menu_item:${it.id}:name"` : ''}>${esc(it.name)}</b>${it.description ? `<small${isUuid(it.id) ? ` data-tr="menu_item:${it.id}:description"` : ''}>${esc(it.description)}</small>` : ''}
            ${(it.allergens || []).length ? `<small class="alg">${S.allergens}: ${it.allergens.map((a) => esc(nombreAlergeno(a, en))).join(', ')}</small>` : ''}</span>
            <span class="price">${it.price_cents == null ? '' : esc(money(it.price_cents, 'EUR', lang))}</span>
          </li>`).join('')}</ul>
        </section>`).join('')}</div>
        <p class="note">${esc(S.menuNote)}</p>` : ''}
      ${fotosCarta.length ? `${carta.length ? '' : `<h2 id="carta">${S.menu}</h2>`}
        <div class="carta-fotos">${fotosCarta.filter((u) => /\.pdf($|\?)/i.test(u))
          .map((u) => `<a class="pill" href="${esc(u)}" target="_blank" rel="noopener">${icono('pdf', 16)} ${S.menuPdf}</a>`).join('')}${(() => {
          // Las fotos se ven juntas en el visor, como en la app.
          const fotos = fotosCarta.filter((u) => !/\.pdf($|\?)/i.test(u));
          return fotos.map((u, i) => miniatura(u, { grupo: 'carta', i, n: fotos.length, clase: 'carta-foto', etiqueta: S.menuPhotos, lang, ancho: 300, alto: 400 })).join('');
        })()}</div>` : ''}
      ${novedades.length ? `<h2 id="novedades">${S.news}</h2>
        <p data-tr-nota="post:" hidden></p>
        <div class="novedades">${novedades.map((p) => `<article${isUuid(p.id) ? ` id="novedad-${p.id}"` : ''}>
          <p class="muted">${esc(fmtWhen(p.created_at, lang, tz))}</p>
          ${p.body ? `<p${isUuid(p.id) ? ` data-tr="post:${p.id}:body"` : ''}>${esc(p.body).replace(/\n/g, '<br>')}</p>` : ''}
          ${p.image_url ? miniatura(p.image_url, { grupo: `novedad-${p.id}`, clase: 'nov-media', etiqueta: S.news, lang, ancho: 900, alto: 600 }) : ''}
          <a class="denuncia" href="${cuenta(lang)}#/denunciar/post/${encodeURIComponent(p.id)}" rel="nofollow">${S.report}</a>
        </article>`).join('')}</div>` : ''}
      <h2 id="resenas">${S.reviews}${b.rating && b.ratings ? ` <small class="muted">★ ${nota(b.rating, lang)} (${b.ratings})</small>` : ''}</h2>
      <p><a class="pill" href="${cuenta(lang)}#/opinar/${encodeURIComponent(b.id)}">${icono('resena', 16)} ${S.write}</a></p>
      ${nVerificadas > 0 || soloVerificadas ? `<nav class="filtro-resenas" aria-label="${esc(S.reviews)}">
        <a class="pill${soloVerificadas ? '' : ' on'}" href="${path}#resenas"${soloVerificadas ? '' : ' aria-current="true"'}>${S.allReviews}</a>
        <a class="pill${soloVerificadas ? ' on' : ''}" href="${path}?resenas=verificadas#resenas" rel="nofollow"${soloVerificadas ? ' aria-current="true"' : ''}>${esc(S.verifiedReviews(nVerificadas))}</a>
      </nav>` : ''}
      ${opiniones.length ? `<div class="resenas">${opiniones.map((r) => `<article${isUuid(r.id) ? ` id="resena-${r.id}"` : ''}${isUuid(r.user_id) ? ` data-autor="${r.user_id}"` : ''}>
          <header>${r.avatar_url ? `<img class="av" src="${esc(r.avatar_url)}" alt="" loading="lazy">` : `<span class="av">${esc((r.display_name || S.user).trim().charAt(0).toUpperCase())}</span>`}
            <span><b>${esc(r.display_name || S.user)}</b><small class="muted">${esc(fmtWhen(r.created_at, lang, tz))}</small></span>
            ${estrellas(Math.max(0, Math.min(5, r.rating | 0)))}</header>
          ${r.verified ? `<details class="verificado"><summary>${icono('voy', 15)}<span>${S.verifiedCustomer}</span></summary>
            <p>${esc(S.verifiedWhat)} <a href="${en ? '/en/community-guidelines/' : '/normas/'}#resenas">${S.howReviews}</a></p></details>` : ''}
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
          ${resenaMedios(r, lang)}
          ${r.reply ? `<div class="respuesta"><header>${icono('negocio', 16)}<b>${esc(S.replyFrom(b.name))}</b>${r.reply_at ? `<small class="muted">${esc(fmtWhen(r.reply_at, lang, tz))}</small>` : ''}</header>
            <p>${esc(r.reply).replace(/\n/g, '<br>')}</p></div>` : ''}
          <a class="denuncia" href="${cuenta(lang)}#/denunciar/review/${encodeURIComponent(r.id)}" rel="nofollow">${S.report}</a>${isUuid(r.user_id) ? ` · <a class="denuncia" href="${cuenta(lang)}#/bloquear/${r.user_id}" rel="nofollow">${S.block}</a>` : ''}
        </article>`).join('')}</div>` : `<p class="empty">${soloVerificadas ? S.noVerified : S.noReviews}</p>`}
      ${b.city ? `<p class="muted">${esc(S.moreIn(b.city))} <a href="${cityToday}">${esc(S.cityToday)}</a> · <a href="${city}">${esc(S.cityWeek)}</a></p>` : ''}
      <p class="denuncia-pie"><a href="${cuenta(lang)}#/reclamar/${encodeURIComponent(b.id)}" rel="nofollow">${S.claim}</a> · <a href="${cuenta(lang)}#/denunciar/business/${encodeURIComponent(b.id)}" rel="nofollow">${S.reportBiz}</a></p>
    </div>
  </div>`;

  const bits = [];
  if (b.rating && b.ratings) bits.push(`★ ${nota(b.rating, lang)} (${b.ratings})`);
  const uno = (n, es1, esN, en1, enN) => `${n} ${n === 1 ? (en ? en1 : es1) : (en ? enN : esN)}`;
  if (flash.length) bits.push(`${uno(flash.length, 'oferta flash', 'ofertas flash', 'flash offer', 'flash offers')} ${en ? 'now' : 'ahora'}`);
  if (events.length) bits.push(uno(events.length, 'evento', 'eventos', 'event', 'events'));
  if (where) bits.push(where);
  const description = `${bits.join(' · ')}${b.description ? ` — ${b.description}` : ''}`.slice(0, 200);

  const negocioLd = {
    '@type': 'LocalBusiness', '@id': `${BASE}/b/${slug || id}#negocio`, name: b.name, description: b.description || undefined,
    url: `${BASE}${path}`, image: b.cover || b.logo || undefined, telephone: b.phone || undefined,
    address: where
      ? { '@type': 'PostalAddress', streetAddress: b.address || undefined, addressLocality: b.city || undefined, addressCountry: 'ES' }
      : undefined,
    geo: b.lat ? { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } : undefined,
    aggregateRating: b.rating && b.ratings
      ? { '@type': 'AggregateRating', ratingValue: Number(b.rating).toFixed(1), reviewCount: b.ratings }
      : undefined,
    sameAs: seguro(b.website) ? [b.website] : undefined,
  };
  const migas = [['Klendar', en ? '/en/' : '/']];
  if (city) migas.push([b.city, city]);
  migas.push([b.name, path]);
  const jsonLd = { '@context': 'https://schema.org', '@graph': [negocioLd, breadcrumbLd(migas)] };

  // En el título, la ciudad: «Café Central · Madrid» es lo que se busca (si
  // el nombre ya la lleva, «FitBox Madrid», no se repite).
  const plano = (t) => String(t || '').normalize('NFD').replace(/[^a-zA-Z0-9]+/g, ' ').toLowerCase().trim();
  const conCiudad = b.city && !` ${plano(b.name)} `.includes(` ${plano(b.city)} `);
  // Abierta desde el QR del local (`/v/<código>` trae `?visita=`): si el
  // local da sellos por visita, el sello de hoy y un aviso encima de la
  // ficha. Lo hace el navegador, con la sesión de «Tu cuenta».
  const visita = new URLSearchParams(search).get('visita') || '';
  const conVisita = /^[A-Za-z0-9_-]{16}$/.test(visita)
    ? `<script src="/assets/vendor/supabase-js-2.117.2.js" integrity="sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok" crossorigin="anonymous" defer></script>
<script src="/config.js?v=3" defer></script>
<script src="/assets/visita.js?v=3" defer data-token="${esc(visita)}" data-lang="${en ? 'en' : 'es'}"></script>`
    : '';
  return html(publicPage({
    lang, path, body, title: conCiudad ? `${b.name} · ${b.city}` : b.name, description, image: b.cover || b.logo,
    head: `<meta name="robots" content="${b.adults_only || conVisita || b.closed_indefinitely ? 'noindex' : 'index, follow'}">
${ldScript(jsonLd)}${horario ? '\n<script src="/assets/zona.js?v=1" defer></script>\n<script src="/assets/horario.js?v=1" defer></script>' : ''}${conVisita ? `\n${conVisita}` : ''}
${traducir(lang, `business:${b.id}`, carta.length ? `menu:${b.id}` : '')}`,
  }), 200, conVisita ? 'no-store' : undefined);
}

// ── Agenda de una ciudad ───────────────────────────────────────────────────
const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'));

export async function agendaPage(rawCity, lang) {
  const en = lang === 'en';
  // Mal codificada: «esa ciudad no está» (404), no un 500.
  const dec = decodeSeg(rawCity);
  if (dec == null) return notFound(lang, `${agendaBase(lang)}/`, 'c');
  const raw = dec.replace(/[/]+$/, '');
  const path = `${agendaBase(lang)}/${citySeg(raw)}/`;
  if (!raw || raw.length > 60) return notFound(lang, path, 'c');

  const [offers, negocios, cats] = await Promise.all([
    rpcAll('public_city_agenda', { p_city: raw, p_limit: 60 }),
    rpc('public_businesses', { p_city: raw, p_limit: 12 }),
    rpcAll('public_categories', { p_city: raw }),
  ]);
  const city = PRETTY(offers[0]?.city || negocios?.items?.[0]?.city || raw);
  // La agenda no trae coordenadas: la zona de cada negocio se lee aparte.
  // Cada tarjeta va en la hora de su negocio; los días, en la de la ciudad
  // (la de la mayoría de sus negocios).
  const { zonas } = await datosDeNegocios(offers.map((o) => o.business_id));
  const tzDe = (o) => zonas.get(o.business_id) || zonaDe(o);
  const tzCiudad = KZ.comun(offers.map(tzDe));

  const S = en
    ? {
        h1: `Things to do in ${city} this week`,
        title: `Things to do in ${city} this week: events and deals`,
        desc: (n) => `${n} events and deals in ${city} over the next few days: flash offers with a countdown and local events. No account needed to browse.`,
        lead: 'Flash offers and local events for the next few days. No account needed to browse; to get a code, log in here on the website or in the app.',
        none: `Nothing published in ${city} yet. If you run a business here, you can be the first.`,
        biz: 'List your business', all: 'Other cities', app: 'Create a free account', agenda: "What's on",
        days: 'Days', places: 'Places in this city', explore: 'Explore everything',
        note: "Updated as businesses publish. Times are each business's local time.",
      }
    : {
        h1: `Qué hacer en ${city} esta semana`,
        title: `Qué hacer en ${city} esta semana: planes y ofertas`,
        desc: (n) => `${n} planes y ofertas en ${city} para los próximos días: ofertas flash con cuenta atrás y eventos de los negocios de la ciudad. Sin cuenta para mirar.`,
        lead: 'Ofertas flash y planes de los próximos días. Para mirar no hace falta cuenta; para conseguir el código, entra aquí en la web o en la app.',
        none: `Todavía no hay nada publicado en ${city}. Si tienes un negocio aquí, puedes ser el primero.`,
        biz: 'Publicar mi negocio', all: 'Otras ciudades', app: 'Crear cuenta gratis', agenda: 'Agenda',
        days: 'Días', places: 'Negocios de esta ciudad', explore: 'Explorar todo',
        note: 'Se actualiza según van publicando los negocios. Horas locales de cada negocio.',
      };

  // Agrupado por día: una agenda se lee por días, no por relevancia. Lo que
  // empezó antes y sigue en marcha (una oferta flash de anoche que dura
  // hasta hoy) va en «Hoy», no bajo un día que ya pasó.
  const hoy = KZ.hoy(tzCiudad);
  const manana = KZ.hoy(tzCiudad, 1);
  const days = new Map();
  for (const o of offers) {
    const dia = KZ.dia(o.starts_at, tzCiudad);
    const key = dia < hoy ? hoy : dia;
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(o);
  }
  const orden = [...days.keys()].sort();
  const rel = (iso) => (iso === hoy ? (en ? 'Today' : 'Hoy') : iso === manana ? (en ? 'Tomorrow' : 'Mañana') : '');
  // `iso` es un día sin hora («2026-10-03»): se escribe tal cual, en UTC.
  const dayTitle = (iso) => {
    const d = KZ.fmt(`${iso}T12:00:00Z`, 'UTC', en ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return rel(iso) ? `${rel(iso)} · ${d}` : d;
  };
  // Para los botones de arriba: «vie 26», que caben varios en una línea.
  const shortDay = (iso) => rel(iso) || KZ.fmt(`${iso}T12:00:00Z`, 'UTC', en ? 'en-GB' : 'es-ES', {
    weekday: 'short', day: 'numeric',
  });

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a></p>
  <h1>${esc(S.h1)}</h1>
  <p class="muted" style="max-width:620px">${esc(S.lead)}</p>
  ${cityLinks(lang, raw, city, cats, 'semana')}
  ${days.size > 1 ? `<div class="filters"><div class="frow"><span class="flabel">${esc(S.days)}</span>
    ${orden.map((iso) => `<a class="chip" href="#d${iso}">${esc(shortDay(iso))}</a>`).join('')}
  </div></div>` : ''}
  ${offers.length
    ? orden.map((iso) => [iso, days.get(iso)]).map(([iso, list]) => `<section class="daygroup" id="d${iso}">
        <h2>${esc(dayTitle(iso))}</h2>
        ${rejilla(list, lang, { tzDe, primera: iso === orden[0] })}
      </section>`).join('')
    : `<p class="empty">${esc(S.none)}</p>`}
  ${placesBlock(negocios, lang, S.places)}
  <p class="muted" style="font-size:13px">${esc(S.note)}</p>
  <p><a class="pill accent" href="${exploreBase(lang)}/?${en ? 'city' : 'ciudad'}=${encodeURIComponent(city)}">${S.explore}</a>
     <a class="pill" href="${cuenta(lang)}#/registro" data-sin-sesion>${S.app}</a>
     <a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${S.biz}</a></p>
  <p><a href="${agendaBase(lang)}/">${S.all} →</a></p>`;

  const description = offers.length ? S.desc(offers.length) : S.none;
  const jsonLd = offers.length
    ? listingLd({
        lang, path, name: S.h1, description, city, items: offers,
        migas: [['Klendar', en ? '/en/' : '/'], [S.agenda, `${agendaBase(lang)}/`], [city, path]],
      })
    : null;

  return html(publicPage({
    lang, actual: 'explorar', path, body,
    title: S.title,
    description,
    image: offers.map((o) => (o.images || []).find((u) => !isVideo(u))).find(Boolean),
    head: jsonLd ? ldScript(jsonLd) : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}

/** «Negocios de esta ciudad»: enlaces a sus fichas, por su dirección con nombre. */
function placesBlock(negocios, lang, titulo) {
  const items = negocios?.items || [];
  if (!items.length) return '';
  return `<section class="daygroup">
    <h2>${esc(titulo)}</h2>
    <div class="cities">${items.map((b) => `<a href="${esc(bizPath(lang, b.slug || b.id))}">${esc(b.name)}${b.live ? ` <span class="muted">${b.live}</span>` : ''}</a>`).join('')}</div>
  </section>`;
}

// ── Hoy en una ciudad ──────────────────────────────────────────────────────
/**
 * «Qué hacer hoy en Madrid»: lo que se busca con el móvil en la mano. Lo que
 * está en marcha ahora mismo, lo que empieza más tarde y, para que la página
 * nunca se quede en blanco, un adelanto de mañana. Enlaza con la semana y
 * con cada categoría de la ciudad.
 */
export async function todayPage(rawCity, lang) {
  const en = lang === 'en';
  const dec = decodeSeg(rawCity);
  if (dec == null) return notFound(lang, `${todayBase(lang)}/`, 'c');
  const raw = dec.replace(/[/]+$/, '');
  const path = `${todayBase(lang)}/${citySeg(raw)}/`;
  if (!raw || raw.length > 60) return notFound(lang, path, 'c');

  const [hoyRes, mananaRes, cats, negocios] = await Promise.all([
    rpc('public_explore', { p_city: raw, p_filters: { when: 'today' }, p_limit: 60 }),
    rpc('public_explore', { p_city: raw, p_filters: { when: 'tomorrow' }, p_limit: 6 }),
    rpcAll('public_categories', { p_city: raw }),
    rpc('public_businesses', { p_city: raw, p_limit: 12 }),
  ]);
  const hoyItems = hoyRes?.items || [];
  const mananaItems = mananaRes?.items || [];
  const lugares = negocios?.items || [];
  // Una ciudad sin nada de nada (mal escrita, o donde aún no hay negocios).
  if (!hoyItems.length && !mananaItems.length && !lugares.length) return notFound(lang, path, 'c');

  const city = PRETTY(hoyItems[0]?.city || mananaItems[0]?.city || lugares[0]?.city || raw);
  const tzCiudad = KZ.comun([...hoyItems, ...mananaItems].map((o) => zonaDe(o)));
  const fecha = KZ.fmt(`${KZ.hoy(tzCiudad)}T12:00:00Z`, 'UTC', en ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const ya = Date.now();
  const empezado = (o) => new Date(o.starts_at || 0).getTime() <= ya;
  const ahora = hoyItems.filter(empezado);
  const luego = hoyItems.filter((o) => !empezado(o));

  const S = en
    ? {
        h1: `Things to do in ${city} today`,
        title: `Things to do in ${city} today: events and deals`,
        desc: (n) => `${n} ${n === 1 ? 'plan' : 'plans'} for today in ${city}: flash offers with a countdown and local events, live right now or later today. No account needed to browse.`,
        descNone: `Nothing more for today in ${city}. Here's what's coming up tomorrow and the places in the city.`,
        lead: (f) => `Today is ${f}. What's on right now and later today at local businesses. Times are local.`,
        now: 'On right now', later: 'Later today', tomorrow: 'Tomorrow',
        none: 'Nothing more published for today. Have a look at tomorrow or the rest of the week.',
        places: 'Places in this city', week: `The whole week in ${city}`, agenda: "What's on", today: 'Today',
        explore: 'Explore with filters', biz: 'List your business',
      }
    : {
        h1: `Qué hacer hoy en ${city}`,
        title: `Qué hacer hoy en ${city}: planes y ofertas de hoy`,
        desc: (n) => `${n} ${n === 1 ? 'plan' : 'planes'} para hoy en ${city}: ofertas flash con cuenta atrás y eventos de los negocios de la ciudad, ahora mismo o más tarde. Sin cuenta para mirar.`,
        descNone: `Hoy ya no queda nada más en ${city}. Aquí tienes lo de mañana y los negocios de la ciudad.`,
        lead: (f) => `Hoy es ${f}. Lo que hay ahora mismo y lo que empieza más tarde en los negocios de la ciudad. Horas locales.`,
        now: 'Ahora mismo', later: 'Más tarde, hoy', tomorrow: 'Mañana',
        none: 'Para hoy ya no hay nada más publicado. Mira lo de mañana o el resto de la semana.',
        places: 'Negocios de esta ciudad', week: `Toda la semana en ${city}`, agenda: 'Agenda', today: 'Hoy',
        explore: 'Explorar con filtros', biz: 'Publicar mi negocio',
      };

  const bloque = (titulo, items) => (items.length
    ? `<section class="daygroup"><h2>${esc(titulo)}</h2>
        ${rejilla(items, lang)}</section>`
    : '');

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a> · <a href="${agendaBase(lang)}/${citySeg(raw)}/">${esc(city)}</a></p>
  <h1>${esc(S.h1)}</h1>
  <p class="muted" style="max-width:620px">${esc(S.lead(fecha))}</p>
  ${cityLinks(lang, raw, city, cats, 'hoy')}
  ${bloque(S.now, ahora)}
  ${bloque(S.later, luego)}
  ${hoyItems.length ? '' : `<p class="empty">${esc(S.none)}</p>`}
  ${bloque(S.tomorrow, mananaItems)}
  ${placesBlock(negocios, lang, S.places)}
  <p><a class="pill accent" href="${agendaBase(lang)}/${citySeg(raw)}/">${esc(S.week)}</a>
     <a class="pill" href="${exploreBase(lang)}/?${en ? 'city' : 'ciudad'}=${encodeURIComponent(city)}&amp;${en ? 'when=today' : 'cuando=hoy'}">${esc(S.explore)}</a>
     <a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${esc(S.biz)}</a></p>`;

  const description = hoyItems.length ? S.desc(hoyItems.length) : S.descNone;
  const jsonLd = listingLd({
    lang, path, name: S.h1, description, city, items: hoyItems,
    migas: [['Klendar', en ? '/en/' : '/'], [S.agenda, `${agendaBase(lang)}/`], [city, `${agendaBase(lang)}/${citySeg(raw)}/`], [S.today, path]],
  });

  return html(publicPage({
    lang, actual: 'explorar', path, body,
    title: S.title,
    description,
    image: [...hoyItems, ...mananaItems].map((o) => firstPhoto(o.images)).find(Boolean),
    // Un día sin nada no se desindexa: mañana vuelve a haber, y la página
    // sigue teniendo lo de mañana y los negocios de la ciudad.
    head: ldScript(jsonLd),
  }), 200, 'public, max-age=300, s-maxage=600');
}

// ── Índice de ciudades ─────────────────────────────────────────────────────
export async function citiesPage(lang) {
  const en = lang === 'en';
  const cities = (await rpcAll('public_cities', {})).filter((c) => c.city);

  const S = en
    ? {
        h1: "What's on near you",
        lead: 'Flash offers and plans for the next few days, city by city. No account needed.',
        none: 'No city has anything published yet.', biz: 'List your business',
        today: 'Things to do today', todayIn: (c) => `Today in ${c}`,
      }
    : {
        h1: 'Agenda local',
        lead: 'Lo que hay en cada ciudad: ofertas flash y planes de los próximos días. No hace falta cuenta.',
        none: 'Todavía no hay ninguna ciudad con publicaciones.', biz: 'Publicar mi negocio',
        today: 'Qué hacer hoy', todayIn: (c) => `Hoy en ${c}`,
      };

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <h1>${S.h1}</h1>
  <p class="muted" style="max-width:620px">${S.lead}</p>
  ${cities.length
    ? `<div class="cities">${cities.map((c) => `<a href="${agendaBase(lang)}/${citySeg(c.city)}/">${esc(c.city)} <span class="muted">${c.n}</span></a>`).join('')}</div>
    <h2>${S.today}</h2>
    <div class="cities">${cities.map((c) => `<a href="${todayBase(lang)}/${citySeg(c.city)}/">${esc(S.todayIn(c.city))}</a>`).join('')}</div>`
    : `<p class="empty">${S.none}</p>`}
  <p><a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${S.biz}</a></p>`;

  return html(publicPage({
    lang, actual: 'explorar', path: `${agendaBase(lang)}/`, body, title: S.h1, description: S.lead,
  }), 200, 'public, max-age=600, s-maxage=1800');
}

// ── Enlace de amigo ────────────────────────────────────────────────────────
/**
 * klendar.app/amigo/<código> (y /en/friend/<código>): el enlace de amigo que
 * alguien comparte. Con la app instalada lo abre la app; si no, llega aquí.
 * La página es pública, así que no dice de quién es: eso se ve al entrar en
 * «Tu cuenta» (`#/amigo/<código>`), que pregunta a la base con tu sesión y
 * deja aceptar. Ni se indexa ni se guarda en caché.
 */
export function friendLinkPage(code, lang) {
  const en = lang === 'en';
  const path = en ? `/en/friend/${code}` : `/amigo/${code}`;
  if (!/^[A-Za-z0-9_-]{16}$/.test(code || '')) return notFound(lang, path, 'a');
  const S = en
    ? {
        title: "You've been invited to be friends on Klendar",
        text: 'Someone has sent you their friend link. Log in with your account to see who it is and accept.',
        web: 'Continue on the web', app: 'Open in the app',
      }
    : {
        title: 'Te han invitado a ser amigos en Klendar',
        text: 'Alguien te ha mandado su enlace de amigo. Entra con tu cuenta para ver quién es y aceptar.',
        web: 'Seguir en la web', app: 'Abrir en la app',
      };
  const body = `
  <div class="amigo-pub">
    <p class="amigo-pub-ic" aria-hidden="true">${icono('invitar', 34)}</p>
    <h1>${esc(S.title)}</h1>
    <p class="muted">${esc(S.text)}</p>
    <p class="acciones">
      <a class="pill accent big" href="${cuenta(lang)}#/amigo/${esc(code)}" rel="nofollow">${esc(S.web)}</a>
      ${openInApp(`/amigo/${code}`, S.app, 'pill big')}
    </p>
  </div>`;
  const res = html(publicPage({
    contador: false,
    lang, path, body, title: S.title, description: S.text,
    head: '<meta name="robots" content="noindex, nofollow">\n<meta name="referrer" content="no-referrer">',
  }), 200, 'no-store');
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}
