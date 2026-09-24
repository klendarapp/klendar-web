// Explorar, categorías y colecciones: la web deja de ser un folleto.
//
// Todo se pinta en el servidor y funciona sin JavaScript: un buscador que es
// un formulario GET, unos filtros que son enlaces y una lista paginada. Así
// lo lee Google, lo lee un lector de pantalla y lo lee alguien con el móvil
// en mitad de la calle.

import { esc, html, rpc, rpcAll } from './page.js';
import {
  agendaBase, BASE, collectionBase, exploreBase, isVideo, offerCard, publicPage,
} from './public.js';

const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
const CITY = (c) => encodeURIComponent(String(c || '').toLowerCase());
const POR_PAGINA = 24;

const T = (en) => en
  ? {
      exp: 'Explore', agenda: "What's on", search: 'Search', ph: 'A bar, a market, «brunch»…',
      all: 'All', allCities: 'Every city', offers: 'Flash offers', events: 'Events',
      city: 'City', cat: 'Category', kind: 'Type', clear: 'Clear filters',
      none: 'Nothing matches that. Try with fewer filters.',
      results: (n) => `${n} ${n === 1 ? 'result' : 'results'}`,
      prev: '← Previous', next: 'Next →', page: 'Page',
      lead: 'Everything live right now: flash offers and local events. No account needed to look.',
      biz: 'Publish your business', app: 'Get the app',
      catTitle: (c, city) => `${c} in ${city}`,
      catLead: (c, city) => `Flash offers and events from ${c.toLowerCase()} in ${city}, updated as businesses publish.`,
      catNone: (c, city) => `No ${c.toLowerCase()} in ${city} have anything live right now.`,
      colNone: 'This selection is empty right now. Have a look in a while.',
      inCity: 'in', everywhere: 'Everywhere',
    }
  : {
      exp: 'Explorar', agenda: 'Agenda local', search: 'Buscar', ph: 'Un bar, un mercadillo, «brunch»…',
      all: 'Todo', allCities: 'Todas las ciudades', offers: 'Ofertas flash', events: 'Eventos',
      city: 'Ciudad', cat: 'Categoría', kind: 'Tipo', clear: 'Quitar filtros',
      none: 'No hay nada con esos filtros. Prueba con menos.',
      results: (n) => `${n} ${n === 1 ? 'resultado' : 'resultados'}`,
      prev: '← Anterior', next: 'Siguiente →', page: 'Página',
      lead: 'Todo lo que hay ahora mismo: ofertas flash y planes de barrio. Para mirar no hace falta cuenta.',
      biz: 'Publicar mi negocio', app: 'Descargar la app',
      catTitle: (c, city) => `${c} en ${city}`,
      catLead: (c, city) => `Ofertas y planes de ${c.toLowerCase()} en ${city}, según van publicando los negocios.`,
      catNone: (c, city) => `Ahora mismo no hay nada de ${c.toLowerCase()} en ${city}.`,
      colNone: 'Esta selección está vacía ahora mismo. Vuelve a mirar en un rato.',
      inCity: 'en', everywhere: 'En todas partes',
    };

const catName = (c, en) => (en ? c?.names?.en : c?.names?.es) || c?.slug || '';
const colTitle = (c, en) => (en ? c?.title?.en : c?.title?.es) || c?.slug || '';
const colSub = (c, en) => (en ? c?.subtitle?.en : c?.subtitle?.es) || '';

/** Lista de publicaciones más «no hay nada» dicho en cristiano. */
const lista = (items, lang, vacio) => items.length
  ? `<div class="olist">${items.map((o) => offerCard(o, lang)).join('')}</div>`
  : `<p class="empty">${esc(vacio)}</p>`;

const portada = (items) => items.map((o) => (o.images || []).find((u) => !isVideo(u))).find(Boolean);

// ── Explorar ───────────────────────────────────────────────────────────────
export async function explorePage(url, lang) {
  const en = lang === 'en';
  const S = T(en);
  const qs = url.searchParams;
  const q = (qs.get('q') || '').slice(0, 60);
  const city = (qs.get(en ? 'city' : 'ciudad') || '').slice(0, 60);
  const cat = (qs.get(en ? 'category' : 'categoria') || '').slice(0, 40);
  const kind = (qs.get(en ? 'type' : 'tipo') || '').slice(0, 20);
  const page = Math.max(1, Math.min(50, parseInt(qs.get('p') || '1', 10) || 1));
  const filtrado = Boolean(q || city || cat || kind || page > 1);

  const [res, cities, cats] = await Promise.all([
    rpc('public_explore', {
      p_city: city || null,
      p_category: cat || null,
      p_kind: kind === 'offers' || kind === 'ofertas' ? 'flash_offer'
        : kind === 'events' || kind === 'eventos' ? 'future_event' : null,
      p_q: q || null,
      p_limit: POR_PAGINA,
      p_offset: (page - 1) * POR_PAGINA,
    }),
    rpcAll('public_cities', {}),
    rpcAll('public_categories', { p_city: city || null }),
  ]);
  const items = res?.items || [];
  const total = res?.total || 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Los filtros son enlaces: se puede compartir la URL y va sin JavaScript.
  const link = (cambios) => {
    const p = new URLSearchParams();
    const base = { q, city, cat, kind, p: 1, ...cambios };
    if (base.q) p.set('q', base.q);
    if (base.city) p.set(en ? 'city' : 'ciudad', base.city);
    if (base.cat) p.set(en ? 'category' : 'categoria', base.cat);
    if (base.kind) p.set(en ? 'type' : 'tipo', base.kind);
    if (base.p && base.p > 1) p.set('p', String(base.p));
    const s = p.toString();
    return `${exploreBase(lang)}/${s ? `?${s}` : ''}`;
  };
  const chip = (href, label, on) => `<a class="chip${on ? ' on' : ''}" href="${esc(href)}">${esc(label)}</a>`;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a></p>
  <h1>${esc(S.exp)}</h1>
  <p class="muted" style="max-width:640px">${esc(S.lead)}</p>

  <form class="finder" method="get" action="${exploreBase(lang)}/">
    <input type="search" name="q" value="${esc(q)}" placeholder="${esc(S.ph)}" aria-label="${esc(S.search)}">
    ${city ? `<input type="hidden" name="${en ? 'city' : 'ciudad'}" value="${esc(city)}">` : ''}
    ${cat ? `<input type="hidden" name="${en ? 'category' : 'categoria'}" value="${esc(cat)}">` : ''}
    ${kind ? `<input type="hidden" name="${en ? 'type' : 'tipo'}" value="${esc(kind)}">` : ''}
    <button class="pill accent" type="submit">${esc(S.search)}</button>
  </form>

  <div class="filters">
    <div class="frow"><span class="flabel">${esc(S.kind)}</span>
      ${chip(link({ kind: '' }), S.all, !kind)}
      ${chip(link({ kind: en ? 'offers' : 'ofertas' }), S.offers, kind === 'offers' || kind === 'ofertas')}
      ${chip(link({ kind: en ? 'events' : 'eventos' }), S.events, kind === 'events' || kind === 'eventos')}
    </div>
    ${cities.length > 1 ? `<div class="frow"><span class="flabel">${esc(S.city)}</span>
      ${chip(link({ city: '' }), S.allCities, !city)}
      ${cities.filter((c) => c.city).slice(0, 12).map((c) => chip(link({ city: String(c.city) }), PRETTY(c.city), city.toLowerCase() === String(c.city).toLowerCase())).join('')}
    </div>` : ''}
    ${(cats || []).length ? `<div class="frow"><span class="flabel">${esc(S.cat)}</span>
      ${chip(link({ cat: '' }), S.all, !cat)}
      ${(cats || []).map((c) => chip(link({ cat: c.slug }), `${catName(c, en)} (${c.n})`, cat === c.slug)).join('')}
    </div>` : ''}
    ${filtrado ? `<p><a class="muted" href="${exploreBase(lang)}/">${esc(S.clear)}</a></p>` : ''}
  </div>

  <p class="muted" style="margin:18px 0 8px">${esc(S.results(total))}</p>
  ${lista(items, lang, S.none)}
  ${paginas > 1 ? `<nav class="pager">
    ${page > 1 ? `<a class="pill" href="${esc(link({ p: page - 1 }))}">${esc(S.prev)}</a>` : ''}
    <span class="muted">${esc(S.page)} ${page}/${paginas}</span>
    ${page < paginas ? `<a class="pill" href="${esc(link({ p: page + 1 }))}">${esc(S.next)}</a>` : ''}
  </nav>` : ''}

  <p style="margin-top:22px"><a class="pill accent" href="/${en ? 'en/' : ''}">${esc(S.app)}</a> <a class="pill" href="${en ? '/en/business-terms/' : '/negocios/'}">${esc(S.biz)}</a></p>`;

  return html(publicPage({
    lang,
    path: `${exploreBase(lang)}/`,
    title: S.exp,
    description: S.lead,
    image: portada(items),
    body,
    // Una búsqueda concreta no aporta nada al índice de Google; la página
    // limpia sí.
    head: filtrado ? '<meta name="robots" content="noindex, follow">' : '',
  }), 200, 'public, max-age=120, s-maxage=600');
}

// ── Una categoría en una ciudad ────────────────────────────────────────────
export async function categoryPage(rawCity, rawCat, lang) {
  const en = lang === 'en';
  const S = T(en);
  const rawc = decodeURIComponent(rawCity || '').replace(/\/+$/, '');
  const slug = decodeURIComponent(rawCat || '').replace(/\/+$/, '').toLowerCase();
  const path = `${agendaBase(lang)}/${CITY(rawc)}/${encodeURIComponent(slug)}/`;

  const [res, cats] = await Promise.all([
    rpc('public_explore', { p_city: rawc, p_category: slug, p_limit: 60 }),
    rpcAll('public_categories', { p_city: rawc }),
  ]);
  const cat = (cats || []).find((c) => c.slug === slug);
  const items = res?.items || [];
  const city = PRETTY(items[0]?.city || rawc);
  const nombre = cat ? catName(cat, en) : PRETTY(slug);
  const h1 = S.catTitle(nombre, city);

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a> · <a href="${agendaBase(lang)}/${CITY(rawc)}/">${esc(city)}</a></p>
  <h1>${esc(h1)}</h1>
  <p class="muted" style="max-width:640px">${esc(S.catLead(nombre, city))}</p>
  ${(cats || []).length ? `<div class="filters"><div class="frow">
    ${(cats || []).map((c) => `<a class="chip${c.slug === slug ? ' on' : ''}" href="${agendaBase(lang)}/${CITY(rawc)}/${encodeURIComponent(c.slug)}/">${esc(catName(c, en))} <span class="muted">${c.n}</span></a>`).join('')}
  </div></div>` : ''}
  ${lista(items, lang, S.catNone(nombre, city))}
  <p style="margin-top:22px"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a> <a class="pill" href="${agendaBase(lang)}/${CITY(rawc)}/">${esc(city)}</a></p>`;

  const jsonLd = items.length ? {
    '@context': 'https://schema.org', '@type': 'ItemList', name: h1, url: `${BASE}${path}`,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 30).map((o, i) => ({
      '@type': 'ListItem', position: i + 1, url: `${BASE}${en ? '/en' : ''}/o/${o.id}`, name: o.title,
    })),
  } : null;

  return html(publicPage({
    lang, path, body, title: h1,
    description: items.length ? S.catLead(nombre, city) : S.catNone(nombre, city),
    image: portada(items),
    head: jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
      : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}

// ── Una colección ──────────────────────────────────────────────────────────
export async function collectionPage(rawSlug, rawCity, lang) {
  const en = lang === 'en';
  const S = T(en);
  const slug = decodeURIComponent(rawSlug || '').replace(/\/+$/, '').toLowerCase();
  const rawc = decodeURIComponent(rawCity || '').replace(/\/+$/, '');
  const path = `${collectionBase(lang)}/${encodeURIComponent(slug)}/${rawc ? `${CITY(rawc)}/` : ''}`;

  const [cols, res, cities] = await Promise.all([
    rpcAll('public_collections', { p_city: rawc || null }),
    rpc('public_explore', { p_city: rawc || null, p_collection: slug, p_limit: 48 }),
    rpcAll('public_cities', {}),
  ]);
  const col = (cols || []).find((c) => c.slug === slug);
  const items = res?.items || [];
  const titulo = col ? colTitle(col, en) : PRETTY(slug.replace(/-/g, ' '));
  const city = rawc ? PRETTY(items[0]?.city || rawc) : '';
  const h1 = city ? `${titulo} ${S.inCity} ${city}` : titulo;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${exploreBase(lang)}/">${esc(S.exp)}</a></p>
  <h1>${esc(h1)}</h1>
  ${col && colSub(col, en) ? `<p class="muted" style="max-width:640px">${esc(colSub(col, en))}</p>` : ''}
  ${cities.length > 1 ? `<div class="filters"><div class="frow"><span class="flabel">${esc(S.city)}</span>
    <a class="chip${rawc ? '' : ' on'}" href="${collectionBase(lang)}/${encodeURIComponent(slug)}/">${esc(S.everywhere)}</a>
    ${cities.filter((c) => c.city).slice(0, 12).map((c) => `<a class="chip${rawc.toLowerCase() === String(c.city).toLowerCase() ? ' on' : ''}" href="${collectionBase(lang)}/${encodeURIComponent(slug)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}
  </div></div>` : ''}
  ${lista(items, lang, S.colNone)}
  <p style="margin-top:22px"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a> <a class="pill" href="${agendaBase(lang)}/">${esc(S.agenda)}</a></p>`;

  return html(publicPage({
    lang, path, body, title: h1,
    description: (col && colSub(col, en)) || S.lead,
    image: portada(items),
    head: items.length ? '' : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}
