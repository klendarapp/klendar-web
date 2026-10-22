// Artistas en la web pública (tanda C; migración 20261205100000_artistas de
// la app): la página de un artista (/a/<slug>, /en/a/<slug>) con sus
// próximas fechas en cualquier local, «Actúa: DJ Nano ›» en la ficha de un
// evento, la sección «Artistas» de la búsqueda de Explorar y la lista
// «Próximas fechas» (también la de un organizador sin local fijo en /b/).
//
// Como el resto de páginas públicas: se pinta en el servidor y va sin
// JavaScript. «Seguir» lleva a «Tu cuenta» (`#/artistas?seguir=<id>`); con
// una sesión guardada, /assets/seguir.js lo hace sin salir de la página
// (lo mismo que «Seguir a un equipo» de «Dónde ver el partido»).

import { esc, html, rpc, rpcAll, isUuid } from './page.js';
import KA from '../../assets/artistas.js';
import { BASE, bizPath, breadcrumbLd, ldScript, publicPage } from './public.js';
import { seguirScript } from './partidos.js';

/** Dónde vive la página de un artista (igual en los dos idiomas, con /en). */
export const artistaPath = (lang, slug) => `${lang === 'en' ? '/en' : ''}/a/${encodeURIComponent(slug || '')}`;
const ofertaPath = (lang, id) => `${lang === 'en' ? '/en' : ''}/o/${encodeURIComponent(id)}`;
const cuentaBase = (lang) => (lang === 'en' ? '/app/?lang=en' : '/app/');
/** «Seguir» sin sesión: a «Tu cuenta», que lo hace al entrar. */
const seguirHref = (lang, a) => `${cuentaBase(lang)}#/artistas?seguir=${encodeURIComponent(a.id)}&nombre=${encodeURIComponent(a.name || '')}`;

/** Los estilos de estas piezas (página del artista, «Actúa», fechas). */
export const ARTISTAS_CSS = '<link rel="stylesheet" href="/assets/artistas.css?v=1">';
/** Los textos (para /assets/seguir.js) van antes que el script de seguir. */
const scripts = (lang) => `<script src="/assets/zona.js?v=2" defer></script>
<script src="/assets/artistas.js?v=3" defer></script>
${seguirScript(lang)}`;

const CHEVRON = '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>';

/** La foto (o la inicial) de un artista. */
const foto = (a, tam, cls = 'art-foto') => (KA.seguro(a.photo_url)
  ? `<img class="${cls}" src="${esc(a.photo_url)}" alt="" width="${tam}" height="${tam}" loading="lazy" decoding="async">`
  : `<span class="${cls} ph" aria-hidden="true">${esc(KA.inicial(a.name))}</span>`);

/**
 * «Próximas fechas»: una fila por fecha («sáb 12 oct · 23:30», el título y
 * «Sala Sol · Madrid»), a su ficha. `items`: filas como las de `artist_page`
 * (`offer_id, title, starts_at, time_zone, venue_name, venue_address,
 * business_name, city`). `conNegocio`: el local que la publica debajo del
 * sitio (en la página de un artista; en la de un organizador sobra).
 */
export function listaFechas(items, lang, { conNegocio = true } = {}) {
  return `<ul class="fechas-lista">${items.map((d) => {
    const w = KA.donde(d);
    const lugar = [w.sitio, w.ciudad].filter(Boolean).join(' · ');
    const quien = conNegocio && d.business_name && d.business_name !== w.sitio ? d.business_name : '';
    return `<li><a href="${esc(ofertaPath(lang, d.offer_id))}">
      <span class="fecha-cuando">${KA.cuando(d.starts_at, d.time_zone, lang).split(' · ').map((x, i) => (i ? `<span>${esc(x)}</span>` : `<b>${esc(x)}</b>`)).join('')}</span>
      <span class="fecha-t"><b>${esc(d.title)}</b>${lugar ? `<small class="muted">${esc(lugar)}</small>` : ''}${quien ? `<small class="muted">${esc(quien)}</small>` : ''}</span>
      <span class="fecha-ir">${CHEVRON}</span></a></li>`;
  }).join('')}</ul>`;
}

/** Un evento para los datos estructurados. */
const eventoLd = (d, lang, artista) => {
  const w = KA.donde(d);
  return {
    '@type': 'Event', name: d.title, url: `${BASE}${ofertaPath(lang, d.offer_id)}`,
    startDate: d.starts_at, endDate: d.ends_at || undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: KA.seguro(d.image) || undefined,
    location: { '@type': 'Place', name: w.sitio || d.business_name, address: d.venue_address || d.city || undefined },
    organizer: d.business_name ? { '@type': 'Organization', name: d.business_name, url: `${BASE}${bizPath(lang, d.business_slug || d.business_id)}` } : undefined,
    performer: artista ? { '@type': 'PerformingGroup', name: artista.name, url: `${BASE}${artistaPath(lang, artista.slug)}` } : undefined,
  };
};

function noEsta(lang, path) {
  const en = lang === 'en';
  const S = KA.t(lang);
  const explorar = en ? '/en/explore/' : '/explorar/';
  return html(publicPage({
    lang, path, title: S.gone, description: S.goneText,
    head: `<meta name="robots" content="noindex">\n${ARTISTAS_CSS}`,
    body: `<p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <section class="vacio">
    <h1>${esc(S.gone)}</h1>
    <p>${esc(S.goneText)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${explorar}">${esc(en ? 'Explore' : 'Explorar')}</a></div>
  </section>`,
  }), 404, 'no-store');
}

/** /a/<slug>: la página de un artista. Una dirección vieja (o de uno
 *  fusionado, o el id) lleva con un 301 a la buena; oculto o inexistente, 404. */
export async function artistaPage(rawSlug, url, lang) {
  const en = lang === 'en';
  const S = KA.t(lang);
  let raw = '';
  try { raw = decodeURIComponent(String(rawSlug || '')); } catch { raw = ''; }
  const pedido = raw.toLowerCase();
  if (!isUuid(pedido) && !KA.esSlug(pedido)) return noEsta(lang, artistaPath(lang, raw));
  const a = await rpc('artist_page', { p_slug: pedido, p_lat: null, p_lng: null });
  if (!a || !a.id || !a.slug) return noEsta(lang, artistaPath(lang, raw));
  if (a.slug !== raw) {
    return new Response(null, { status: 301, headers: { location: artistaPath(lang, a.slug) + url.search, 'cache-control': 'public, max-age=300' } });
  }
  const path = artistaPath(lang, a.slug);
  const fechas = (Array.isArray(a.dates) ? a.dates : []).filter((d) => isUuid(d.offer_id));
  const enlaces = KA.enlaces(a.links);
  const bio = String(a.bio || '').trim();

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · ${esc(S.artists)}</p>
  <div class="art-cab">
    ${foto(a, 112)}
    <div class="art-cab-t">
      <p class="eyebrow">${esc(S.artist)}</p>
      <h1>${esc(a.name)}</h1>
      <div class="art-seguir"><a class="pill" href="${esc(seguirHref(lang, a))}" rel="nofollow"
        data-seguir-artista="${esc(a.id)}" data-nombre="${esc(a.name)}" data-si="${esc(S.following)}" data-no="${esc(S.follow)}" aria-pressed="false">${esc(S.follow)}</a></div>
    </div>
  </div>
  ${bio ? `<p class="art-bio">${esc(bio).replace(/\n/g, '<br>')}</p>` : ''}
  ${enlaces.length ? `<nav class="art-enlaces" aria-label="${esc(S.linksTitle)}">${enlaces.map(([, n, u]) => `<a class="pill" href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(n)}</a>`).join('')}</nav>` : ''}
  <h2 class="art-h">${esc(S.upcoming)}</h2>
  ${fechas.length
    ? listaFechas(fechas, lang)
    : `<div class="art-sin-fechas"><p><b>${esc(S.noDates)}</b></p><p class="muted">${esc(S.weTell)}</p></div>`}`;

  const description = (bio || S.pageDesc(a.name)).replace(/\s+/g, ' ').slice(0, 200);
  const migas = [['Klendar', en ? '/en/' : '/'], [a.name, path]];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'PerformingGroup', '@id': `${BASE}/a/${a.slug}#artista`, name: a.name, url: `${BASE}${path}`,
        description: bio || undefined, image: KA.seguro(a.photo_url) || undefined,
        sameAs: enlaces.length ? enlaces.map(([, , u]) => u) : undefined,
        event: fechas.length ? fechas.slice(0, 20).map((d) => eventoLd(d, lang, null)) : undefined,
      },
      breadcrumbLd(migas),
    ],
  };
  return html(publicPage({
    lang, path, body, title: S.pageTitle(a.name), description,
    image: KA.seguro(a.photo_url) || undefined,
    head: `${ARTISTAS_CSS}
${ldScript(jsonLd)}
${scripts(lang)}`,
  }), 200, 'public, max-age=120, s-maxage=300');
}

/** «Actúa: DJ Nano ›» / «Actúan: DJ Nano, Rosalía» en la ficha de un evento
 *  (`offer_artists_of`). '' si no hay nadie. */
export async function actuaEnOferta(offerId, lang) {
  let lista = [];
  try { lista = await rpcAll('offer_artists_of', { p_offer: offerId }); } catch { return { html: '', lista: [] }; }
  lista = lista.filter((a) => a && !a.hidden && KA.esSlug(a.slug) && a.name);
  if (!lista.length) return { html: '', lista };
  const S = KA.t(lang);
  const html1 = lista.length === 1
    ? `<a class="actua" href="${esc(artistaPath(lang, lista[0].slug))}"><span class="muted">${esc(S.performing(1))}</span> <b>${esc(lista[0].name)}</b>${CHEVRON}</a>`
    : `<p class="actua"><span class="muted">${esc(S.performing(lista.length))}</span> ${lista.map((a) => `<a href="${esc(artistaPath(lang, a.slug))}">${esc(a.name)}</a>`).join(', ')}</p>`;
  return { html: html1, lista };
}

/** Los artistas de un evento para su `Event` en los datos estructurados. */
export const performersLd = (lista, lang) => (lista.length
  ? lista.map((a) => ({ '@type': 'PerformingGroup', name: a.name, url: `${BASE}${artistaPath(lang, a.slug)}` }))
  : undefined);

/** «Artistas» en la búsqueda de Explorar: como mucho 4 que encajan, cada uno
 *  a su página. '' si no hay. */
export async function artistasEnBusqueda({ q, lang }) {
  if (String(q || '').trim().length < 2) return '';
  let lista = [];
  try { lista = await rpcAll('artist_search', { p_q: q, p_limit: 4 }); } catch { return ''; }
  lista = lista.filter((a) => a && KA.esSlug(a.slug));
  if (!lista.length) return '';
  const S = KA.t(lang);
  return `<section class="seccion-negocios seccion-artistas" aria-labelledby="secArt">
      <div class="seccion-cab"><h2 id="secArt">${esc(S.artists)}</h2></div>
      <div class="nlist">${lista.map((a) => `<a class="ncard" href="${esc(artistaPath(lang, a.slug))}">
        ${foto(a, 64, '')}
        <span class="ncard-body"><b>${esc(a.name)}</b><span class="muted">${esc(Number(a.upcoming) > 0 ? S.dates(Number(a.upcoming)) : S.noNext)}</span></span>
        <span class="ncard-ir" aria-hidden="true">${CHEVRON}</span></a>`).join('')}</div>
    </section>`;
}
