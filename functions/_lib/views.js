// Las tres páginas públicas, en los dos idiomas.
//
// Cada una vive en dos URLs (`/o/<id>` y `/en/o/<id>`) que enlazan entre sí
// con hreflang. El idioma lo manda la ruta, no el navegador: así se puede
// mandar el enlace inglés a quien toque y Google indexa las dos.
//
// Se pueden leer enteras sin app y sin cuenta. Canjear sigue siendo cosa de
// la app, porque el código es de un solo uso y lo valida el negocio.

import { esc, html, isUuid, render, rpc, rpcAll } from './page.js';
import {
  agendaBase, BASE, benefit, exploreBase, firstPhoto, fmtLong, fmtTime, isVideo,
  media, money, offerCard, openInApp, priorPrice, publicPage,
} from './public.js';

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
        open: soldOut ? 'Join the waiting list' : (flash ? 'Get the code in the app' : 'Reserve in the app'),
        note: 'Free app. The code is single-use and the business validates it on the spot.',
        soldOut: 'Sold out', over: 'Finished', more: 'Everything from', hot: 'Popular',
        prior: 'Lowest price in the last 30 days',
      }
    : {
        when: 'Cuándo', redeem: 'Se canjea', where: 'Dónde', seats: 'Plazas libres',
        terms: 'Condiciones', about: 'Qué es', biz: 'El negocio',
        open: soldOut ? 'Apuntarme a la lista de espera' : (flash ? 'Conseguir el código en la app' : 'Reservar en la app'),
        note: 'App gratuita. El código es de un solo uso y lo valida el negocio en el momento.',
        soldOut: 'Agotado', over: 'Terminado', more: 'Todo lo de', hot: 'Con tirón',
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
      ${over ? '' : openInApp(path, S.open)}
      <p class="note">${S.note}</p>
    </aside>
    <div class="d-body">
      ${o.description ? `<h2>${S.about}</h2><p>${esc(o.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${o.terms ? `<h2>${S.terms}</h2><p class="muted">${esc(o.terms).replace(/\n/g, '<br>')}</p>` : ''}
      <h2>${S.biz}</h2>
      <p>${esc(o.business_name)}${o.business_rating && o.business_ratings ? ` · ★ ${Number(o.business_rating).toFixed(1)} (${o.business_ratings})` : ''}</p>
      <p><a href="${pre(lang)}/b/${esc(o.business_id)}">${S.more} ${esc(o.business_name)} →</a></p>
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
  const [offers, sellos, carta] = await Promise.all([
    rpcAll('business_offers', { p_id: id }),
    rpc('stamp_card_of', { p_business: id }),
    rpcAll('business_menu', { p_business: id }),
  ]);

  const S = en
    ? {
        now: 'On right now', soon: 'Coming up',
        none: 'Nothing published right now. It changes often — take a look in the app.',
        open: 'Follow in the app', note: 'Free app. You get a heads-up when this business publishes something.',
        verified: 'Verified business', since: 'On Klendar since', redeemed: 'redemptions validated',
        about: 'About', menu: 'Menu',
        stamps: 'Stamp card', allergens: 'Allergens',
        menuNote: 'Allergens as declared by the business. If you have an allergy, ask at the venue.',
        stampsBody: (n, r) => `When you get to ${n} visits: “${r}”. Every code you redeem here leaves a stamp, one a day at most, and the app keeps count.`,
      }
    : {
        now: 'Ahora mismo', soon: 'Próximamente',
        none: 'Ahora mismo no hay nada publicado. Suele cambiar: échale un ojo en la app.',
        open: 'Seguir en la app', note: 'App gratuita. Te avisa cuando este negocio publica algo.',
        verified: 'Negocio verificado', since: 'En Klendar desde', redeemed: 'canjes validados',
        about: 'Sobre el negocio', menu: 'Carta',
        stamps: 'Tarjeta de sellos', allergens: 'Alérgenos',
        menuNote: 'Los alérgenos son los que declara el negocio. Si tienes alergia, pregunta en el sitio.',
        stampsBody: (n, r) => `Al llegar a ${n} visitas: «${r}». Cada código que canjeas aquí deja un sello, como mucho uno al día, y la app lleva la cuenta.`,
      };

  const flash = offers.filter((o) => o.kind === 'flash_offer');
  const events = offers.filter((o) => o.kind !== 'flash_offer');
  const where = [b.address, b.city].filter(Boolean).join(', ');
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
      ${b.cover ? `<div class="gallery solo"><img src="${esc(b.cover)}" alt="" loading="lazy"></div>` : ''}
      <div class="badges" style="margin-top:18px">
        ${b.is_verified ? `<span class="badge ok">✓ ${S.verified}</span>` : ''}
        ${b.rating && b.ratings ? `<span class="badge">★ ${Number(b.rating).toFixed(1)} (${b.ratings})</span>` : ''}
        ${b.redemptions_total ? `<span class="badge">${b.redemptions_total} ${S.redeemed}</span>` : ''}
        ${since ? `<span class="badge">${S.since} ${esc(since)}</span>` : ''}
      </div>
      <h1>${esc(b.name)}</h1>
      ${where ? `<p class="muted">${esc(where)}</p>` : ''}
    </div>
    <aside class="side">
      ${openInApp(path, S.open)}
      <p class="note" style="margin-bottom:16px">${S.note}</p>
      <div class="info">
        ${where ? `<div><span>📍</span><span>${maps ? `<a href="${esc(maps)}" rel="nofollow noopener" target="_blank">${esc(where)}</a>` : esc(where)}</span></div>` : ''}
        ${b.phone ? `<div><span>📞</span><span><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></span></div>` : ''}
        ${b.website ? `<div><span>🔗</span><span><a href="${esc(b.website)}" rel="nofollow noopener" target="_blank">${esc(String(b.website).replace(/^https?:\/\//, ''))}</a></span></div>` : ''}
        ${b.menu_url ? `<div><span>📋</span><span><a href="${esc(b.menu_url)}" rel="nofollow noopener" target="_blank">${S.menu}</a></span></div>` : ''}
      </div>
    </aside>
    <div class="d-body">
      ${b.description ? `<h2>${S.about}</h2><p>${esc(b.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${sellos?.is_active ? `<h2>${S.stamps}</h2>
        <p class="callout">${esc(S.stampsBody(sellos.goal, sellos.reward))}</p>` : ''}
      ${carta.length ? `<h2>${S.menu}</h2>
        <div class="menu">${carta.map((sec) => `<section>
          <h3>${esc(sec.name)}</h3>
          <ul>${(sec.items || []).map((it) => `<li>
            <span><b>${esc(it.name)}</b>${it.description ? `<small>${esc(it.description)}</small>` : ''}
            ${(it.allergens || []).length ? `<small class="alg">${S.allergens}: ${it.allergens.map((a) => esc(a.replace(/_/g, ' '))).join(', ')}</small>` : ''}</span>
            <span class="price">${it.price_cents == null ? '' : esc(money(it.price_cents, 'EUR', lang))}</span>
          </li>`).join('')}</ul>
        </section>`).join('')}</div>
        <p class="note">${esc(S.menuNote)}</p>` : ''}
      ${flash.length ? `<h2>${S.now}</h2><div class="olist">${flash.map((o) => offerCard(o, lang)).join('')}</div>` : ''}
      ${events.length ? `<h2>${S.soon}</h2><div class="olist">${events.map((o) => offerCard(o, lang)).join('')}</div>` : ''}
      ${offers.length ? '' : `<p class="empty">${S.none}</p>`}
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
