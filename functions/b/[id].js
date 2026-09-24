import { esc, html, isUuid, pickLang, render, rpc, rpcAll } from '../_lib/page.js';
import { BASE, offerCard, openInApp, publicPage } from '../_lib/public.js';

// /b/<id>: la ficha del negocio con todo lo que tiene publicado.
//
// Sirve para dos cosas: que alguien que llega por un enlace vea que el sitio
// existe y qué ofrece, y que el propio negocio tenga una página decente que
// enseñar (muchos no tienen web). Lo que se ve aquí es lo mismo que en la app.

export async function onRequestGet({ request, params }) {
  const lang = pickLang(request);
  const path = `/b/${params.id}`;
  const en = lang === 'en';
  if (!isUuid(params.id)) return html(render({ lang, path, kind: 'b', notFound: true }), 404, 'no-store');
  const b = await rpc('business_profile', { p_id: params.id });
  if (!b || !b.name) return html(render({ lang, path, kind: 'b', notFound: true }), 404, 'no-store');
  const offers = await rpcAll('business_offers', { p_id: params.id });

  const S = en
    ? {
        now: 'On right now', soon: 'Coming up', none: 'Nothing published right now. It changes often — take a look in the app.',
        open: 'Follow in the app', note: 'Free app. You get a heads-up when this business publishes something.',
        verified: 'Verified business', since: 'On Klendar since', redeemed: 'redemptions validated',
        contact: 'Contact', hours: 'Opening hours', about: 'About',
      }
    : {
        now: 'Ahora mismo', soon: 'Próximamente', none: 'Ahora mismo no hay nada publicado. Suele cambiar: échale un ojo en la app.',
        open: 'Seguir en la app', note: 'App gratuita. Te avisa cuando este negocio publica algo.',
        verified: 'Negocio verificado', since: 'En Klendar desde', redeemed: 'canjes validados',
        contact: 'Contacto', hours: 'Horario', about: 'Sobre el negocio',
      };

  const flash = offers.filter((o) => o.kind === 'flash_offer');
  const events = offers.filter((o) => o.kind !== 'flash_offer');
  const where = [b.address, b.city].filter(Boolean).join(', ');
  const since = b.member_since
    ? new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { timeZone: 'Europe/Madrid', month: 'long', year: 'numeric' })
        .format(new Date(b.member_since))
    : '';
  const maps = b.lat ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}` : null;

  const body = `
  <p class="crumbs"><a href="/">Klendar</a>${b.city ? ` · <a href="/agenda/${encodeURIComponent(String(b.city).toLowerCase())}/">${esc(b.city)}</a>` : ''}</p>
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
        ${b.menu_url ? `<div><span>📋</span><span><a href="${esc(b.menu_url)}" rel="nofollow noopener" target="_blank">${en ? 'Menu' : 'Carta'}</a></span></div>` : ''}
      </div>
    </aside>
    <div class="d-body">
      ${b.description ? `<h2>${S.about}</h2><p>${esc(b.description).replace(/\n/g, '<br>')}</p>` : ''}
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
