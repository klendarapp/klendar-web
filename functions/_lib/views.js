// Las tres páginas públicas, en los dos idiomas.
//
// Cada una vive en dos URLs (`/o/<id>` y `/en/o/<id>`) que enlazan entre sí
// con hreflang. El idioma lo manda la ruta, no el navegador: así se puede
// mandar el enlace inglés a quien toque y Google indexa las dos.
//
// Se pueden leer enteras sin app y sin cuenta. Lo que necesita cuenta
// (guardar, seguir, pedir el código, opinar, denunciar) lleva a «Tu cuenta»
// (/app/), que hace lo mismo que la app desde el navegador.

import { esc, fmtWhen, html, isUuid, render, rpc, rpcAll, rows } from './page.js';
import {
  agendaBase, BASE, benefit, exploreBase, firstPhoto, fmtEnd, fmtLong, isVideo,
  media, money, offerCard, openInApp, priorPrice, publicPage,
} from './public.js';

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
  resena: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 14v-2.47l6.88-6.88c.2-.2.51-.2.71 0l1.77 1.77c.2.2.2.51 0 .71L8.47 14H6zm12 0h-7.5l2-2H18v2z',
};
const icono = (n, size = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${PATHS[n]}"/></svg>`;

const pre = (lang) => (lang === 'en' ? '/en' : '');
const notFound = (lang, path, kind) =>
  html(render({ lang, path, kind, notFound: true }), 404, 'no-store');

// ── Publicación ────────────────────────────────────────────────────────────
export async function offerPage(id, lang) {
  const path = `${pre(lang)}/o/${id}`;
  const en = lang === 'en';
  if (!isUuid(id)) return notFound(lang, path, 'o');
  const o = await rpc('offer_detail', { p_id: id });
  if (!o) return notFound(lang, path, 'o');

  const flash = o.kind === 'flash_offer';
  const soldOut = o.status === 'sold_out' || (o.seats_left != null && o.seats_left <= 0);
  const over = new Date(o.redeem_end_at || o.event_end_at || o.event_at || 0) < new Date();
  const availability = soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
  const tag = benefit(o.discount, o.price_cents, o.currency, lang);
  const prior = priorPrice(o.discount, lang);
  const cover = firstPhoto(o.images);
  const pieces = (o.images || []).slice(0, 4);
  const where = [o.business_address, o.business_city].filter(Boolean).join(', ');

  const S = en
    ? {
        when: 'When', redeem: 'Redemption window', where: 'Where', seats: 'Places left',
        terms: 'Conditions', about: 'What it is', biz: 'The business',
        open: 'Open in the app', report: 'Report this publication',
        code: 'Get the code', reserve: 'Reserve a place', wait: 'Join the waiting list', save: 'Save to Plans',
        note: 'From here or from the app, with the same account. The code is single-use and the business validates it on the spot.',
        soldOut: 'Sold out', over: 'Finished', more: 'Everything from', hot: 'Popular',
        prior: 'Lowest price in the last 30 days',
      }
    : {
        when: 'Cuándo', redeem: 'Se canjea', where: 'Dónde', seats: 'Plazas libres',
        terms: 'Condiciones', about: 'Qué es', biz: 'El negocio',
        open: 'Abrir en la app', report: 'Denunciar esta publicación',
        code: 'Conseguir el código', reserve: 'Reservar plaza', wait: 'Apuntarme a la lista de espera', save: 'Guardar en Planes',
        note: 'Desde aquí o desde la app, con la misma cuenta. El código es de un solo uso y lo valida el negocio en el momento.',
        soldOut: 'Agotado', over: 'Terminado', more: 'Todo lo de', hot: 'Con tirón',
        prior: 'Precio más bajo de los últimos 30 días',
      };

  const when = flash
    ? `${fmtLong(o.redeem_start_at, lang)} – ${fmtEnd(o.redeem_start_at, o.redeem_end_at, lang)}`
    : fmtLong(o.event_at, lang) + (o.event_end_at ? ` – ${fmtEnd(o.event_at, o.event_end_at, lang)}` : '');

  // El beneficio ya sale en grande debajo: en las etiquetas solo va si es un
  // descuento (ahí la etiqueta dice algo que el precio solo no dice).
  const badges = [
    over ? `<span class="badge off">${S.over}</span>` : '',
    !over && soldOut ? `<span class="badge off">${S.soldOut}</span>` : '',
    o.discount && tag ? `<span class="badge hot">${esc(tag)}</span>` : '',
    o.is_trending ? `<span class="badge">${S.hot}</span>` : '',
    o.adults_only ? '<span class="badge">+18</span>' : '',
  ].filter(Boolean).join('');

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${pre(lang)}/b/${esc(o.business_id)}">${esc(o.business_name)}</a></p>
  <div class="detail">
    <div class="d-head">
      ${pieces.length ? `<div class="gallery${pieces.length === 1 ? ' solo' : ''}">${pieces.map((u) => media(u, cover)).join('')}</div>` : ''}
      ${badges ? `<div class="badges" style="margin-top:18px">${badges}</div>` : ''}
      <h1>${esc(o.title)}</h1>
      <p class="muted">${esc(o.business_name)}${where ? ` · ${esc(where)}` : ''}</p>
      ${tag || o.price_cents != null ? `<div class="price">
        <b>${esc(tag || money(o.price_cents, o.currency, lang))}</b>
        ${prior ? `<s>${esc(prior)}</s><span class="rule">${S.prior}</span>` : ''}
      </div>` : ''}
    </div>
    <aside class="side">
      <dl>
        <div><dt>${flash ? S.redeem : S.when}</dt><dd>${esc(when)}</dd></div>
        ${where ? `<div><dt>${S.where}</dt><dd>${esc(where)}</dd></div>` : ''}
        ${o.seats_left != null && !soldOut ? `<div><dt>${S.seats}</dt><dd>${o.seats_left}</dd></div>` : ''}
      </dl>
      ${over ? '' : (() => {
        // Lo mismo que el botón grande de la app, pero sin salir de la web.
        const id = encodeURIComponent(o.id);
        const principal = soldOut ? `<a class="pill accent big" href="/app/#/espera/${id}">${S.wait}</a>`
          : flash ? `<a class="pill accent big" href="/app/#/codigo/${id}">${S.code}</a>`
            : o.reservations_enabled ? `<a class="pill accent big" href="/app/#/reservar/${id}">${S.reserve}</a>`
              : o.external_url ? `<a class="pill accent big" href="${esc(o.external_url)}" rel="nofollow noopener" target="_blank">${esc(o.external_url.replace(/^https?:\/\//, '').split('/')[0])}</a>`
                : '';
        return `${principal}
          <p class="acciones"><a class="pill" href="/app/#/guardar/${id}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg> ${S.save}</a>
            ${openInApp(path, S.open, 'pill ghost')}</p>`;
      })()}
      <p class="note">${S.note}</p>
    </aside>
    <div class="d-body">
      ${o.description ? `<h2>${S.about}</h2><p>${esc(o.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${o.terms ? `<h2>${S.terms}</h2><p class="muted">${esc(o.terms).replace(/\n/g, '<br>')}</p>` : ''}
      <h2>${S.biz}</h2>
      <p>${esc(o.business_name)}${o.business_rating && o.business_ratings ? ` · ★ ${Number(o.business_rating).toFixed(1)} (${o.business_ratings})` : ''}</p>
      <p><a href="${pre(lang)}/b/${esc(o.business_id)}">${S.more} ${esc(o.business_name)} →</a></p>
      <p class="denuncia-pie"><a href="/app/#/denunciar/offer/${encodeURIComponent(o.id)}" rel="nofollow">${S.report}</a></p>
    </div>
  </div>`;

  const description = [tag, flash ? when : fmtLong(o.event_at, lang), o.business_name, o.business_city]
    .filter(Boolean).join(' · ').slice(0, 200);

  const jsonLd = flash
    ? {
        '@context': 'https://schema.org', '@type': 'Offer', name: o.title, description: o.description || undefined,
        url: `${BASE}${path}`, image: cover || undefined, validFrom: o.redeem_start_at, validThrough: o.redeem_end_at,
        offeredBy: { '@type': 'LocalBusiness', name: o.business_name, address: where || undefined },
        price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : undefined,
        priceCurrency: o.price_cents != null ? (o.currency || 'EUR') : undefined,
        availability,
      }
    : {
        '@context': 'https://schema.org', '@type': 'Event', name: o.title, description: o.description || undefined,
        url: `${BASE}${path}`, image: cover || undefined, startDate: o.event_at, endDate: o.event_end_at || undefined,
        eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: o.business_name, address: where || undefined },
        organizer: { '@type': 'Organization', name: o.business_name },
        offers: o.reservations_enabled
          ? {
              '@type': 'Offer', url: `${BASE}${path}`, availability,
              price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : '0',
              priceCurrency: o.currency || 'EUR',
            }
          : undefined,
      };

  return html(publicPage({
    lang, path, image: cover, body,
    title: `${o.title} · ${o.business_name}`,
    description,
    head: `<meta name="robots" content="${o.adults_only ? 'noindex' : 'index, follow'}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  }));
}

// ── Negocio ────────────────────────────────────────────────────────────────
export async function businessPage(id, lang) {
  const path = `${pre(lang)}/b/${id}`;
  const en = lang === 'en';
  if (!isUuid(id)) return notFound(lang, path, 'b');
  const b = await rpc('business_profile', { p_id: id });
  if (!b || !b.name) return notFound(lang, path, 'b');
  const [offers, sellos, carta, opiniones, novedades, cierres] = await Promise.all([
    rpcAll('business_offers', { p_id: id }),
    rpc('stamp_card_of', { p_business: id }),
    rpcAll('business_menu', { p_business: id }),
    rpcAll('business_reviews', { p_id: id, p_limit: 12 }),
    rows('business_posts', `select=id,body,image_url,created_at&business_id=eq.${id}&order=created_at.desc&limit=6`),
    rpcAll('business_closures', { p_business: id }),
  ]);

  const S = en
    ? {
        now: 'On right now', soon: 'Coming up',
        none: 'Nothing published right now. It changes often — take a look in the app.',
        open: 'Add to favourites', note: 'From here or from the app, with the same account. We let you know when this business posts something.',
        verified: 'Verified business', since: 'On Klendar since', redeemed: 'redemptions validated',
        about: 'About', menu: 'Menu',
        stamps: 'Stamp card', allergens: 'Allergens',
        menuNote: 'Allergens as declared by the business. If you have an allergy, ask at the venue.',
        stampsBody: (n, r) => `When you get to ${n} visits: “${r}”. Every code you redeem here leaves a stamp, one a day at most, and the app keeps count.`,
        hours: 'Opening hours', closed: 'Closed', today: 'today',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        news: 'News', reviews: 'Reviews', write: 'Write a review', noReviews: 'No reviews yet. Been here? Be the first.',
        user: 'User', report: 'Report', reportBiz: 'Report this business', menuPhotos: 'Photos of the menu', menuPdf: 'Menu (PDF)',
        replyFrom: (n) => `Reply from ${n}`,
        closedToday: 'Closed today', closedUntil: (d) => `Closed until ${d}`,
        closingDay: (d) => `Closing on ${d}`, closing: (a, b) => `Closing from ${a} to ${b}`,
      }
    : {
        now: 'Ahora mismo', soon: 'Próximamente',
        none: 'Ahora mismo no hay nada publicado. Suele cambiar: échale un ojo en la app.',
        open: 'Añadir a favoritos', note: 'Desde aquí o desde la app, con la misma cuenta. Te avisamos cuando este negocio publique algo.',
        verified: 'Negocio verificado', since: 'En Klendar desde', redeemed: 'canjes validados',
        about: 'Sobre el negocio', menu: 'Carta',
        stamps: 'Tarjeta de sellos', allergens: 'Alérgenos',
        menuNote: 'Los alérgenos son los que declara el negocio. Si tienes alergia, pregunta en el sitio.',
        stampsBody: (n, r) => `Al llegar a ${n} visitas: «${r}». Cada código que canjeas aquí deja un sello, como mucho uno al día, y la app lleva la cuenta.`,
        hours: 'Horario', closed: 'Cerrado', today: 'hoy',
        days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
        news: 'Novedades', reviews: 'Reseñas', write: 'Escribir una reseña', noReviews: 'Todavía no hay reseñas. ¿Has estado? Sé la primera persona.',
        user: 'Usuario', report: 'Denunciar', reportBiz: 'Denunciar este negocio', menuPhotos: 'Fotos de la carta', menuPdf: 'Carta (PDF)',
        replyFrom: (n) => `Respuesta de ${n}`,
        closedToday: 'Cerrado hoy', closedUntil: (d) => `Cerrado hasta el ${d}`,
        closingDay: (d) => `Cerrará el ${d}`, closing: (a, b) => `Cerrará del ${a} al ${b}`,
      };

  const flash = offers.filter((o) => o.kind === 'flash_offer');
  const events = offers.filter((o) => o.kind !== 'flash_offer');
  const where = [b.address, b.city].filter(Boolean).join(', ');

  // Días cerrados (vacaciones, festivos): el que está en curso o, si cae en
  // el próximo mes, el siguiente. Igual que en la app. Fechas de calendario,
  // sin hora: se comparan como texto AAAA-MM-DD con el hoy de Madrid.
  const cierre = (() => {
    const c = cierres[0];
    if (!c) return '';
    const hoyIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
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
  // hora de Madrid, va marcado.
  const horas = b.opening_hours && typeof b.opening_hours === 'object' ? b.opening_hours : null;
  const hoy = (() => {
    const d = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(new Date());
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(d) + 1;
  })();
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

  const fotosCarta = (b.menu_images || []).filter((u) => typeof u === 'string' && u);
  const galeria = (b.gallery || []).filter((u) => typeof u === 'string' && u);
  const estrellas = (n) => `<span class="stars" aria-label="${n}/5">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>`;
  const since = b.member_since
    ? new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { timeZone: 'Europe/Madrid', month: 'long', year: 'numeric' })
        .format(new Date(b.member_since))
    : '';
  const maps = b.lat ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}` : null;
  const city = b.city
    ? `${agendaBase(lang)}/${encodeURIComponent(String(b.city).toLowerCase())}/`
    : null;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a>${city ? ` · <a href="${city}">${esc(b.city)}</a>` : ''}</p>
  <div class="detail">
    <div class="d-head">
      ${b.cover || galeria.length
        ? `<div class="gallery${galeria.length ? '' : ' solo'}">${[b.cover, ...galeria].filter(Boolean).slice(0, 7)
          .map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>`
        : ''}
      <div class="badges" style="margin-top:18px">
        ${b.is_verified ? `<span class="badge ok">✓ ${S.verified}</span>` : ''}
        ${b.rating && b.ratings ? `<span class="badge">★ ${Number(b.rating).toFixed(1)} (${b.ratings})</span>` : ''}
        ${b.redemptions_total ? `<span class="badge">${b.redemptions_total} ${S.redeemed}</span>` : ''}
        ${since ? `<span class="badge">${S.since} ${esc(since)}</span>` : ''}
      </div>
      <h1>${esc(b.name)}</h1>
      ${where ? `<p class="muted">${esc(where)}</p>` : ''}
      ${cierre}
    </div>
    <aside class="side">
      <a class="pill accent big" href="/app/#/seguir/${encodeURIComponent(b.id)}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3 1.6-1.8 3-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg> ${S.open}</a>
      <p class="note" style="margin-bottom:16px">${S.note}</p>
      <div class="info">
        ${where ? `<div><span>${icono('lugar')}</span><span>${maps ? `<a href="${esc(maps)}" rel="nofollow noopener" target="_blank">${esc(where)}</a>` : esc(where)}</span></div>` : ''}
        ${b.phone ? `<div><span>${icono('telefono')}</span><span><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></span></div>` : ''}
        ${b.website ? `<div><span>${icono('web')}</span><span><a href="${esc(b.website)}" rel="nofollow noopener" target="_blank">${esc(String(b.website).replace(/^https?:\/\//, ''))}</a></span></div>` : ''}
        ${b.menu_url ? `<div><span>${icono('carta')}</span><span><a href="${esc(b.menu_url)}" rel="nofollow noopener" target="_blank">${S.menu}</a></span></div>` : ''}
        ${b.contact_email ? `<div><span>${icono('correo')}</span><span><a href="mailto:${esc(b.contact_email)}">${esc(b.contact_email)}</a></span></div>` : ''}
        ${redes.length ? `<div><span>${icono('redes')}</span><span>${redes.join(' · ')}</span></div>` : ''}
      </div>
      ${horario ? `<h2 class="side-h">${S.hours}</h2>${horario}` : ''}
    </aside>
    <div class="d-body">
      ${b.description ? `<h2>${S.about}</h2><p>${esc(b.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${sellos?.is_active ? `<h2>${S.stamps}</h2>
        <p class="callout">${esc(S.stampsBody(sellos.goal, sellos.reward))}</p>` : ''}
      ${carta.length ? `<h2>${S.menu}</h2>
        <div class="menu">${carta.map((sec) => `<section>
          <h3>${esc(sec.name)}</h3>
          <ul>${(sec.items || []).map((it) => `<li>
            ${it.image_url ? `<img class="dish" src="${esc(it.image_url)}" alt="" loading="lazy">` : ''}
            <span><b>${esc(it.name)}</b>${it.description ? `<small>${esc(it.description)}</small>` : ''}
            ${(it.allergens || []).length ? `<small class="alg">${S.allergens}: ${it.allergens.map((a) => esc(a.replace(/_/g, ' '))).join(', ')}</small>` : ''}</span>
            <span class="price">${it.price_cents == null ? '' : esc(money(it.price_cents, 'EUR', lang))}</span>
          </li>`).join('')}</ul>
        </section>`).join('')}</div>
        <p class="note">${esc(S.menuNote)}</p>` : ''}
      ${fotosCarta.length ? `${carta.length ? '' : `<h2>${S.menu}</h2>`}
        <div class="carta-fotos">${fotosCarta.map((u) => /\.pdf($|\?)/i.test(u)
          ? `<a class="pill" href="${esc(u)}" target="_blank" rel="noopener">${icono('pdf', 16)} ${S.menuPdf}</a>`
          : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${S.menuPhotos}" loading="lazy"></a>`).join('')}</div>` : ''}
      ${flash.length ? `<h2>${S.now}</h2><div class="olist">${flash.map((o) => offerCard(o, lang)).join('')}</div>` : ''}
      ${events.length ? `<h2>${S.soon}</h2><div class="olist">${events.map((o) => offerCard(o, lang)).join('')}</div>` : ''}
      ${offers.length ? '' : `<p class="empty">${S.none}</p>`}
      ${novedades.length ? `<h2>${S.news}</h2>
        <div class="novedades">${novedades.map((p) => `<article>
          <p class="muted">${esc(fmtWhen(p.created_at, lang))}</p>
          ${p.body ? `<p>${esc(p.body).replace(/\n/g, '<br>')}</p>` : ''}
          ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : ''}
        </article>`).join('')}</div>` : ''}
      <h2 id="resenas">${S.reviews}${b.rating && b.ratings ? ` <small class="muted">★ ${Number(b.rating).toFixed(1)} (${b.ratings})</small>` : ''}</h2>
      <p><a class="pill" href="/app/#/opinar/${encodeURIComponent(b.id)}">${icono('resena', 16)} ${S.write}</a></p>
      ${opiniones.length ? `<div class="resenas">${opiniones.map((r) => `<article>
          <header>${r.avatar_url ? `<img class="av" src="${esc(r.avatar_url)}" alt="" loading="lazy">` : `<span class="av">${esc((r.display_name || S.user).trim().charAt(0).toUpperCase())}</span>`}
            <span><b>${esc(r.display_name || S.user)}</b><small class="muted">${esc(fmtWhen(r.created_at, lang))}</small></span>
            ${estrellas(Math.max(0, Math.min(5, r.rating | 0)))}</header>
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
          ${r.photo_url ? `<img class="foto" src="${esc(r.photo_url)}" alt="" loading="lazy">` : ''}
          ${r.reply ? `<div class="respuesta"><header>${icono('negocio', 16)}<b>${esc(S.replyFrom(b.name))}</b>${r.reply_at ? `<small class="muted">${esc(fmtWhen(r.reply_at, lang))}</small>` : ''}</header>
            <p>${esc(r.reply).replace(/\n/g, '<br>')}</p></div>` : ''}
          <a class="denuncia" href="/app/#/denunciar/review/${encodeURIComponent(r.id)}" rel="nofollow">${S.report}</a>
        </article>`).join('')}</div>` : `<p class="empty">${S.noReviews}</p>`}
      <p class="denuncia-pie"><a href="/app/#/denunciar/business/${encodeURIComponent(b.id)}" rel="nofollow">${S.reportBiz}</a></p>
    </div>
  </div>`;

  const bits = [];
  if (b.rating && b.ratings) bits.push(`★ ${Number(b.rating).toFixed(1)} (${b.ratings})`);
  if (flash.length) bits.push(en ? `${flash.length} flash deal(s) now` : `${flash.length} oferta(s) flash ahora`);
  if (events.length) bits.push(en ? `${events.length} event(s)` : `${events.length} evento(s)`);
  if (where) bits.push(where);
  const description = `${bits.join(' · ')}${b.description ? ` — ${b.description}` : ''}`.slice(0, 200);

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name, description: b.description || undefined,
    url: `${BASE}${path}`, image: b.cover || b.logo || undefined, telephone: b.phone || undefined,
    address: where
      ? { '@type': 'PostalAddress', streetAddress: b.address || undefined, addressLocality: b.city || undefined, addressCountry: 'ES' }
      : undefined,
    geo: b.lat ? { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } : undefined,
    aggregateRating: b.rating && b.ratings
      ? { '@type': 'AggregateRating', ratingValue: Number(b.rating).toFixed(1), reviewCount: b.ratings }
      : undefined,
    sameAs: b.website ? [b.website] : undefined,
  };

  return html(publicPage({
    lang, path, body, title: b.name, description, image: b.cover || b.logo,
    head: `<meta name="robots" content="${b.adults_only ? 'noindex' : 'index, follow'}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  }));
}

// ── Agenda de una ciudad ───────────────────────────────────────────────────
const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'));

export async function agendaPage(rawCity, lang) {
  const en = lang === 'en';
  const raw = decodeURIComponent(rawCity || '').replace(/\/+$/, '');
  const path = `${agendaBase(lang)}/${encodeURIComponent(raw.toLowerCase())}/`;
  if (!raw || raw.length > 60) return notFound(lang, path, 'o');

  const [offers, negocios] = await Promise.all([
    rpcAll('public_city_agenda', { p_city: raw, p_limit: 60 }),
    rpc('public_businesses', { p_city: raw, p_limit: 12 }),
  ]);
  const city = PRETTY(offers[0]?.city || raw);

  const S = en
    ? {
        h1: `What's on in ${city}`,
        lead: 'Flash deals and local events for the next few days. No account needed to look; the app is only for getting the code.',
        none: `Nothing published in ${city} yet. If you run a business here, you can be the first.`,
        biz: 'Publish your business', all: 'Other cities', app: 'Get the app', agenda: "What's on",
        days: 'Days', places: 'Places in this city', explore: 'Explore everything',
        note: 'Updated as businesses publish. Times are local (Europe/Madrid).',
        plans: 'plans and deals',
      }
    : {
        h1: `Qué hacer en ${city}`,
        lead: 'Ofertas flash y planes de los próximos días. Para mirar no hace falta cuenta; la app solo se usa para conseguir el código.',
        none: `Todavía no hay nada publicado en ${city}. Si tienes un negocio aquí, puedes ser el primero.`,
        biz: 'Publicar mi negocio', all: 'Otras ciudades', app: 'Descargar la app', agenda: 'Agenda',
        days: 'Días', places: 'Negocios de esta ciudad', explore: 'Explorar todo',
        note: 'Se actualiza según van publicando los negocios. Horas locales (Europe/Madrid).',
        plans: 'planes y ofertas',
      };

  // Agrupado por día: una agenda se lee por días, no por relevancia.
  const days = new Map();
  for (const o of offers) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(o.starts_at));
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(o);
  }
  const dayTitle = (iso) => new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', {
    timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${iso}T12:00:00Z`));
  // Para los botones de arriba: «vie 26», que caben varios en una línea.
  const shortDay = (iso) => new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', {
    timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric',
  }).format(new Date(`${iso}T12:00:00Z`));

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a></p>
  <h1>${esc(S.h1)}</h1>
  <p class="muted" style="max-width:620px">${esc(S.lead)}</p>
  ${days.size > 1 ? `<div class="filters"><div class="frow"><span class="flabel">${esc(S.days)}</span>
    ${[...days.keys()].map((iso) => `<a class="chip" href="#d${iso}">${esc(shortDay(iso))}</a>`).join('')}
  </div></div>` : ''}
  ${offers.length
    ? [...days.entries()].map(([iso, list]) => `<section class="daygroup" id="d${iso}">
        <h3>${esc(dayTitle(iso))}</h3>
        <div class="olist">${list.map((o) => offerCard(o, lang)).join('')}</div>
      </section>`).join('')
    : `<p class="empty">${esc(S.none)}</p>`}
  ${(negocios?.items || []).length ? `<section class="daygroup">
    <h3>${esc(S.places)}</h3>
    <div class="cities">${negocios.items.map((b) => `<a href="${en ? '/en' : ''}/b/${esc(b.id)}">${esc(b.name)}${b.live ? ` <span class="muted">${b.live}</span>` : ''}</a>`).join('')}</div>
  </section>` : ''}
  <p class="muted" style="font-size:13px">${esc(S.note)}</p>
  <p><a class="pill accent" href="/${en ? 'en/' : ''}">${S.app}</a>
     <a class="pill" href="${exploreBase(lang)}/?${en ? 'city' : 'ciudad'}=${encodeURIComponent(city)}">${S.explore}</a>
     <a class="pill" href="${en ? '/en/business-terms/' : '/negocios/'}">${S.biz}</a></p>
  <p><a href="${agendaBase(lang)}/">${S.all} →</a></p>`;

  const jsonLd = offers.length
    ? {
        '@context': 'https://schema.org', '@type': 'ItemList', name: S.h1, url: `${BASE}${path}`,
        numberOfItems: offers.length,
        itemListElement: offers.slice(0, 30).map((o, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${BASE}${pre(lang)}/o/${o.id}`, name: o.title,
        })),
      }
    : null;

  return html(publicPage({
    lang, path, body,
    title: S.h1,
    description: offers.length
      ? `${offers.length} ${S.plans} · ${city} · ${fmtLong(offers[0].starts_at, lang)}`
      : S.none,
    image: offers.map((o) => (o.images || []).find((u) => !isVideo(u))).find(Boolean),
    head: jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
      : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}

// ── Índice de ciudades ─────────────────────────────────────────────────────
export async function citiesPage(lang) {
  const en = lang === 'en';
  const cities = (await rpcAll('public_cities', {})).filter((c) => c.city);

  const S = en
    ? {
        h1: "What's on near you",
        lead: 'Flash deals and plans for the next few days, city by city. No account needed.',
        none: 'No city has anything published yet.', biz: 'Publish your business',
      }
    : {
        h1: 'Agenda local',
        lead: 'Lo que hay en cada ciudad: ofertas flash y planes de los próximos días. No hace falta cuenta.',
        none: 'Todavía no hay ninguna ciudad con publicaciones.', biz: 'Publicar mi negocio',
      };

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <h1>${S.h1}</h1>
  <p class="muted" style="max-width:620px">${S.lead}</p>
  ${cities.length
    ? `<div class="cities">${cities.map((c) => `<a href="${agendaBase(lang)}/${encodeURIComponent(String(c.city).toLowerCase())}/">${esc(c.city)} <span class="muted">${c.n}</span></a>`).join('')}</div>`
    : `<p class="empty">${S.none}</p>`}
  <p><a class="pill" href="${en ? '/en/business-terms/' : '/negocios/'}">${S.biz}</a></p>`;

  return html(publicPage({
    lang, path: `${agendaBase(lang)}/`, body, title: S.h1, description: S.lead,
  }), 200, 'public, max-age=600, s-maxage=1800');
}
