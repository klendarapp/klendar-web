import { esc, html, isUuid, pickLang, render, rpc } from '../_lib/page.js';
import {
  BASE, benefit, firstPhoto, fmtLong, fmtTime, money, openInApp, priorPrice, publicPage,
} from '../_lib/public.js';

// /o/<id>: la publicación entera, legible en el navegador.
//
// Antes esto era una tarjeta que saltaba a la app a los 400 ms: quien no la
// tenía no llegaba a leer nada. Ahora la página cuenta lo que hay, cuándo,
// dónde y con qué condiciones; canjear sigue siendo cosa de la app, porque el
// código es de un solo uso y lo valida el negocio en el mostrador.

export async function onRequestGet({ request, params }) {
  const lang = pickLang(request);
  const path = `/o/${params.id}`;
  const en = lang === 'en';
  if (!isUuid(params.id)) return html(render({ lang, path, kind: 'o', notFound: true }), 404, 'no-store');
  const o = await rpc('offer_detail', { p_id: params.id });
  if (!o) return html(render({ lang, path, kind: 'o', notFound: true }), 404, 'no-store');

  const flash = o.kind === 'flash_offer';
  const soldOut = o.status === 'sold_out' || (o.seats_left != null && o.seats_left <= 0);
  const over = new Date(o.redeem_end_at || o.event_end_at || o.event_at || 0) < new Date();
  const availability = soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
  const tag = benefit(o.discount, o.price_cents, o.currency);
  const prior = priorPrice(o.discount);
  const photos = (o.images || []).filter((u) => !/\.(mp4|mov|webm)(\?|$)/i.test(u)).slice(0, 4);
  const cover = firstPhoto(o.images);
  const where = [o.business_address, o.business_city].filter(Boolean).join(', ');

  const S = en
    ? {
        when: 'When', redeem: 'Redemption window', where: 'Where', seats: 'Places left',
        terms: 'Conditions', about: 'What it is', biz: 'The business',
        open: soldOut ? 'Join the waiting list' : (flash ? 'Get the code in the app' : 'Reserve in the app'),
        note: 'Free app. The code is single-use and the business validates it on the spot.',
        soldOut: 'Sold out', over: 'Finished', more: 'Everything from',
        prior: 'Lowest price in the last 30 days',
      }
    : {
        when: 'Cuándo', redeem: 'Se canjea', where: 'Dónde', seats: 'Plazas libres',
        terms: 'Condiciones', about: 'Qué es', biz: 'El negocio',
        open: soldOut ? 'Apuntarme a la lista de espera' : (flash ? 'Conseguir el código en la app' : 'Reservar en la app'),
        note: 'App gratuita. El código es de un solo uso y lo valida el negocio en el momento.',
        soldOut: 'Agotado', over: 'Terminado', more: 'Todo lo de',
        prior: 'Precio más bajo de los últimos 30 días',
      };

  const when = flash
    ? `${fmtLong(o.redeem_start_at, lang)} – ${fmtTime(o.redeem_end_at, lang)}`
    : fmtLong(o.event_at, lang) + (o.event_end_at ? ` – ${fmtTime(o.event_end_at, lang)}` : '');

  // El beneficio ya sale en grande debajo: en las etiquetas solo va si es un
  // descuento (ahí la etiqueta dice algo que el precio solo no dice).
  const badges = [
    over ? `<span class="badge off">${S.over}</span>` : '',
    !over && soldOut ? `<span class="badge off">${S.soldOut}</span>` : '',
    o.discount && tag ? `<span class="badge hot">${esc(tag)}</span>` : '',
    o.is_trending ? `<span class="badge">${en ? 'Popular' : 'Con tirón'}</span>` : '',
    o.adults_only ? '<span class="badge">+18</span>' : '',
  ].filter(Boolean).join('');

  const body = `
  <p class="crumbs"><a href="/">Klendar</a> · <a href="/b/${esc(o.business_id)}">${esc(o.business_name)}</a></p>
  <div class="detail">
    <div class="d-head">
      ${photos.length ? `<div class="gallery${photos.length === 1 ? ' solo' : ''}">${photos.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}
      ${badges ? `<div class="badges" style="margin-top:18px">${badges}</div>` : ''}
      <h1>${esc(o.title)}</h1>
      <p class="muted">${esc(o.business_name)}${where ? ` · ${esc(where)}` : ''}</p>
      ${tag || o.price_cents != null ? `<div class="price">
        <b>${esc(tag || money(o.price_cents, o.currency))}</b>
        ${prior ? `<s>${esc(prior)}</s><span class="rule">${S.prior}</span>` : ''}
      </div>` : ''}
    </div>
    <aside class="side">
      <dl>
        <div><dt>${flash ? S.redeem : S.when}</dt><dd>${esc(when)}</dd></div>
        ${where ? `<div><dt>${S.where}</dt><dd>${esc(where)}</dd></div>` : ''}
        ${o.seats_left != null && !soldOut ? `<div><dt>${S.seats}</dt><dd>${o.seats_left}</dd></div>` : ''}
      </dl>
      ${over ? '' : openInApp(path, S.open)}
      <p class="note">${S.note}</p>
    </aside>
    <div class="d-body">
      ${o.description ? `<h2>${S.about}</h2><p>${esc(o.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${o.terms ? `<h2>${S.terms}</h2><p class="muted">${esc(o.terms).replace(/\n/g, '<br>')}</p>` : ''}
      <h2>${S.biz}</h2>
      <p>${esc(o.business_name)}${o.business_rating && o.business_ratings ? ` · ★ ${Number(o.business_rating).toFixed(1)} (${o.business_ratings})` : ''}</p>
      <p><a href="/b/${esc(o.business_id)}">${S.more} ${esc(o.business_name)} →</a></p>
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
