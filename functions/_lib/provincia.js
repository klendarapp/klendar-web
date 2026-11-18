// Las páginas de entrada para los buscadores que faltaban (Iván, 18-11: «que
// las páginas de negocios y eventos salgan en las búsquedas de Málaga»):
//
//  - «Ofertas en <municipio>» (/ofertas/malaga, /en/deals/malaga): las
//    ofertas vivas de un municipio (2x1, menús, descuentos que duran unas
//    horas). Es lo que se busca («ofertas Málaga hoy») y no lo daba ninguna
//    página: la agenda mezcla eventos y la de hoy, todo.
//  - «Planes en la provincia de <provincia>» (/provincia/malaga,
//    /en/province/malaga): los municipios de la provincia con algo, con
//    cuántos planes tiene cada uno, y lo de hoy en los que más tienen.
//
// Las dos se indexan solo con contenido suficiente (umbrales de `_lib/seo.js`,
// los mismos que el sitemap) y van a la caché del borde como las demás
// (`_lib/cache.js`, EN_CACHE). Sin la función `public_seo_places` (prod antes
// de su migración), «Ofertas» mira lo que enseña y la provincia no existe (404).

import { esc, html, rpc, rpcAll } from './page.js';
import {
  BASE, agendaBase, breadcrumbLd, cityLinks, citySeg, decodeSeg, exploreBase, firstPhoto, kidsBase, ldScript, listingLd,
  ofertasBase, provinciaBase, publicPage, todayBase,
} from './public.js';
import { rejilla } from './tarjeta.js';
import { paginaDeMunicipio } from './municipios.js';
import { notFound } from './views.js';
import {
  lugarSeo, lugaresSeo, municipioConContenido, ofertasConContenido, provinciaConContenido, provincias, slugProvincia,
} from './seo.js';

const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'));
const portada = (items) => items.map((o) => firstPhoto(o.images)).find(Boolean);

// ── Ofertas en un municipio ────────────────────────────────────────────────
export async function ofertasPage(rawCity, lang) {
  const en = lang === 'en';
  const dec = decodeSeg(rawCity);
  if (dec == null) return notFound(lang, ofertasBase(lang), 'c');
  let raw = dec.replace(/[/]+$/, '');
  const path = `${ofertasBase(lang)}/${citySeg(raw)}`;
  if (!raw || raw.length > 60) return notFound(lang, path, 'c');
  const mun = await paginaDeMunicipio(raw, lang, path, (x) => `${ofertasBase(lang)}/${encodeURIComponent(x)}`);
  if (mun.respuesta) return mun.respuesta;
  raw = mun.pCity;

  const [res, cats, lugar] = await Promise.all([
    rpc('public_explore', { p_city: raw, p_kind: 'flash_offer', p_limit: 60 }),
    rpcAll('public_categories', { p_city: raw }).catch(() => []),
    lugarSeo(raw),
  ]);
  const items = res?.items || [];
  // Lo que no es un municipio y no tiene nada: mal escrito (404).
  if (!items.length && !mun.nombre && !lugar.n) return notFound(lang, path, 'c');
  const city = mun.nombre || PRETTY(items[0]?.city || raw);

  const S = en
    ? {
        h1: `Deals in ${city}`,
        title: `Deals in ${city} today: 2-for-1s, set menus and discounts`,
        lead: `Offers with a countdown from bars, restaurants, shops and venues in ${city}: 2-for-1s, set menus and discounts that last a few hours. Each one is redeemed with a single-use code, here on the website or in the app.`,
        desc: (n) => `${n} ${n === 1 ? 'deal' : 'deals'} live now in ${city}: offers with a countdown from local businesses. No account needed to browse.`,
        none: `No deals live in ${city} right now. Businesses publish them every day, often for just a few hours.`,
        agenda: "What's on", week: `The whole week in ${city}`, today: `Today in ${city}`, explore: 'Explore with filters',
        deals: 'Deals',
      }
    : {
        h1: `Ofertas en ${city}`,
        title: `Ofertas en ${city} hoy: 2x1, menús y descuentos`,
        lead: `Ofertas con cuenta atrás de los bares, restaurantes, tiendas y locales de ${city}: 2x1, menús y descuentos que duran unas horas. Cada una se canjea con un código de un solo uso, aquí en la web o en la app.`,
        desc: (n) => `${n} ${n === 1 ? 'oferta' : 'ofertas'} ahora en ${city}: ofertas con cuenta atrás de los negocios de la ciudad. Sin cuenta para mirar.`,
        none: `Ahora no hay ofertas en ${city}. Los negocios las publican cada día, a menudo solo para unas horas.`,
        agenda: 'Agenda', week: `Toda la semana en ${city}`, today: `Hoy en ${city}`, explore: 'Explorar con filtros',
        deals: 'Ofertas',
      };

  const c = citySeg(raw);
  const body = `
  <p class="crumbs"><a href="${en ? '/en' : '/'}">Klendar</a> · <a href="${agendaBase(lang)}">${S.agenda}</a> · <a href="${agendaBase(lang)}/${c}">${esc(city)}</a></p>
  <h1>${esc(S.h1)}</h1>
  <p class="muted" style="max-width:640px">${esc(S.lead)}</p>
  ${cityLinks(lang, raw, city, cats, 'ofertas')}
  ${items.length ? rejilla(items, lang, { primera: true, h: 'h2' }) : `<p class="empty">${esc(S.none)}</p>`}
  <p style="margin-top:22px"><a class="pill accent" href="${todayBase(lang)}/${c}">${esc(S.today)}</a>
     <a class="pill" href="${agendaBase(lang)}/${c}">${esc(S.week)}</a>
     <a class="pill" href="${exploreBase(lang)}?${en ? 'city' : 'ciudad'}=${encodeURIComponent(raw)}&amp;${en ? 'type=offers' : 'tipo=ofertas'}">${esc(S.explore)}</a></p>`;

  const description = items.length ? S.desc(items.length) : S.none;
  const indexable = ofertasConContenido(lugar, items.length);
  const jsonLd = listingLd({
    lang, path, name: S.h1, description, city, items,
    migas: [['Klendar', en ? '/en' : '/'], [S.agenda, agendaBase(lang)], [city, `${agendaBase(lang)}/${c}`], [S.deals, path]],
  });
  return html(publicPage({
    lang, actual: 'explorar', path, body, title: S.title, description, image: portada(items),
    head: indexable ? ldScript(jsonLd) : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=600');
}

// ── Una provincia ──────────────────────────────────────────────────────────
// Lo de hoy, de los municipios que más tienen (una llamada por municipio, como
// mucho estos: el plan gratis de Cloudflare corta a las 50 subpeticiones).
const MUNICIPIOS_HOY = 4;
const POR_MUNICIPIO = 8;

export async function provinciaPage(rawSlug, lang) {
  const en = lang === 'en';
  const dec = decodeSeg(rawSlug);
  const slug = (dec || '').replace(/[/]+$/, '').toLowerCase();
  const path = `${provinciaBase(lang)}/${encodeURIComponent(slug)}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return notFound(lang, path, 'c');
  const { lugares, completa } = await lugaresSeo();
  const p = completa ? provincias(lugares).find((x) => slugProvincia(x.name) === slug) : null;
  if (!p) return notFound(lang, path, 'c');
  const nombre = p.name;
  const indexables = p.lugares.filter(municipioConContenido);
  const top = [...indexables].sort((a, b) => b.n - a.n).slice(0, MUNICIPIOS_HOY);
  const hoy = await Promise.all(top.map((l) => rpc('public_explore', { p_city: l.slug || l.city, p_filters: { when: 'today' }, p_limit: POR_MUNICIPIO })
    .then((r) => ({ l, items: r?.items || [] })).catch(() => ({ l, items: [] }))));
  const conHoy = hoy.filter((x) => x.items.length);
  const negocios = p.lugares.reduce((s, l) => s + (l.businesses || 0), 0);

  const S = en
    ? {
        h1: `Things to do in the province of ${nombre}`,
        title: `Things to do in the province of ${nombre}: events and deals by town`,
        lead: (n, m) => `${n} ${n === 1 ? 'plan' : 'plans'} published in ${m} ${m === 1 ? 'town' : 'towns'} of the province of ${nombre}: offers with a countdown and events from local businesses. No account needed to browse.`,
        today: (c) => `Today in ${c}`, seeAll: (c) => `Everything today in ${c}`,
        towns: 'Towns with something on', plans: (n) => (n === 1 ? '1 plan' : `${n} plans`),
        places: (n) => (n === 1 ? '1 place' : `${n} places`),
        noneToday: 'Nothing more for today. Pick a town to see the rest of the week.',
        agenda: "What's on", biz: 'List your business',
        note: 'Updated as businesses publish. Each town has its own page for today, the week, deals and plans with kids.',
      }
    : {
        h1: `Planes en la provincia de ${nombre}`,
        title: `Planes en la provincia de ${nombre}: qué hacer y ofertas por municipio`,
        lead: (n, m) => `${n} ${n === 1 ? 'plan publicado' : 'planes publicados'} en ${m} ${m === 1 ? 'municipio' : 'municipios'} de la provincia de ${nombre}: ofertas con cuenta atrás y eventos de los negocios. Sin cuenta para mirar.`,
        today: (c) => `Hoy en ${c}`, seeAll: (c) => `Todo lo de hoy en ${c}`,
        towns: 'Municipios con planes', plans: (n) => (n === 1 ? '1 plan' : `${n} planes`),
        places: (n) => (n === 1 ? '1 sitio' : `${n} sitios`),
        noneToday: 'Para hoy ya no queda nada más. Elige un municipio para ver el resto de la semana.',
        agenda: 'Agenda', biz: 'Publicar mi negocio',
        note: 'Se actualiza según van publicando los negocios. Cada municipio tiene su página de hoy, de la semana, de ofertas y de planes con niños.',
      };
  const conPlanes = p.lugares.filter((l) => l.n > 0).sort((a, b) => b.n - a.n || String(a.city).localeCompare(String(b.city), 'es'));
  const seg = (l) => citySeg(l.slug || l.city);
  const body = `
  <p class="crumbs"><a href="${en ? '/en' : '/'}">Klendar</a> · <a href="${agendaBase(lang)}">${S.agenda}</a></p>
  <h1>${esc(S.h1)}</h1>
  <p class="muted" style="max-width:640px">${esc(S.lead(p.n, conPlanes.length))}</p>
  <section class="daygroup"><h2>${esc(S.towns)}</h2>
    <div class="cities">${conPlanes.map((l) => `<a href="${todayBase(lang)}/${seg(l)}">${esc(l.city)} <span class="muted">${esc(S.plans(l.n))}</span></a>`).join('')}</div>
  </section>
  ${conHoy.map(({ l, items }) => `<section class="daygroup"><h2>${esc(S.today(l.city))}</h2>
    ${rejilla(items, lang, { primera: l === conHoy[0].l, h: 'h3' })}
    <p><a href="${todayBase(lang)}/${seg(l)}">${esc(S.seeAll(l.city))} →</a>${ofertasConContenido(l) ? ` · <a href="${ofertasBase(lang)}/${seg(l)}">${esc(en ? `Deals in ${l.city}` : `Ofertas en ${l.city}`)}</a>` : ''}${l.kids ? ` · <a href="${kidsBase(lang)}/${seg(l)}">${esc(en ? 'With kids' : 'Con niños')}</a>` : ''}</p>
  </section>`).join('')}
  ${conHoy.length ? '' : `<p class="empty">${esc(S.noneToday)}</p>`}
  <p class="muted" style="font-size:13px">${esc(S.note)}${negocios ? ` ${esc(S.places(negocios))}.` : ''}</p>
  <p><a class="pill" href="${en ? '/en/for-business' : '/para-negocios'}">${esc(S.biz)}</a></p>`;

  const description = S.lead(p.n, conPlanes.length).slice(0, 200);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': `${BASE}${path}`, url: `${BASE}${path}`, name: S.h1, description,
        inLanguage: en ? 'en' : 'es',
        isPartOf: { '@type': 'WebSite', name: 'Klendar', url: `${BASE}/` },
        about: { '@type': 'AdministrativeArea', name: nombre, containedInPlace: { '@type': 'Country', name: en ? 'Spain' : 'España' } },
        mainEntity: {
          '@type': 'ItemList', numberOfItems: conPlanes.length,
          itemListElement: conPlanes.slice(0, 50).map((l, i) => ({
            '@type': 'ListItem', position: i + 1, name: l.city, url: `${BASE}${todayBase(lang)}/${seg(l)}`,
          })),
        },
      },
      breadcrumbLd([['Klendar', en ? '/en' : '/'], [S.agenda, agendaBase(lang)], [S.h1, path]]),
    ],
  };
  return html(publicPage({
    lang, actual: 'explorar', path, body, title: S.title, description,
    image: conHoy.flatMap((x) => x.items).map((o) => firstPhoto(o.images)).find(Boolean),
    head: provinciaConContenido(p) ? ldScript(jsonLd) : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=600, s-maxage=900');
}
