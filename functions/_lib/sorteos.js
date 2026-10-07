// «Sorteos» en la web pública (tanda C; migración 20261208100001_sorteos de
// la app): la lista (/sorteos/, /en/giveaways/), la página de cada sorteo
// (/sorteo/<id>, /en/giveaway/<id>), sus bases legales (/sorteo/<id>/bases,
// /en/giveaway/<id>/rules) y la tarjeta de la ficha del negocio. Lo mismo
// que la app (especificación de la tanda C).
//
// Las páginas van en caché y no saben quién mira: se pinta lo de todo el
// mundo (el botón «Participar», que sin sesión lleva a «Tu cuenta»,
// `#/sorteo/<id>`). Con una sesión guardada en este navegador,
// /assets/sorteo.js pide el sorteo con ella y pone lo tuyo («Participas · tu
// número es el 37», «¡Has ganado!»…), participa, lo deja, acepta o renuncia
// sin salir de la página, y en la lista marca en los que participas y pinta
// «En los que participas». «Comprobar el resultado» lo calcula el navegador
// (`crypto.subtle`, /assets/textos-sorteos.js).
//
// Quien llega desde la imagen para historias (`?ref=stories`) cuenta para el
// negocio (`log_ref_visit`, con el id del negocio: ver `desdeHistorias` en
// public.js).

import { esc, html, isUuid, rows, rpc, rpcAll, supabasePublic } from './page.js';
import KS from '../../assets/textos-sorteos.js';
import KZ from '../../assets/zona.js';
import { BASE, bizPath, breadcrumbLd, carrusel, historiaBoton, ldScript, publicPage } from './public.js';
import { recuperaZona, zonaMenu } from './partidos.js';
import { MENU_JS, masMenu } from './views.js';
import { GRUPOS_CSS } from './grupos.js';

/** Dónde vive cada página en cada idioma. */
export const sorteosBase = (lang) => (lang === 'en' ? '/en/giveaways' : '/sorteos');
export const sorteoPath = (lang, id) => `${lang === 'en' ? '/en/giveaway' : '/sorteo'}/${id}`;
export const basesPath = (lang, id) => `${sorteoPath(lang, id)}/${lang === 'en' ? 'rules' : 'bases'}`;
const cuentaBase = (lang) => (lang === 'en' ? '/app/?lang=en' : '/app/');

// Una papeleta (confirmation_number de Material Icons, Apache 2.0).
const SVG_SORTEO = 'M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-2-1.46c-1.19.69-2 1.99-2 3.46s.81 2.77 2 3.46V18H4v-2.54c1.19-.69 2-1.99 2-3.46 0-1.48-.8-2.77-1.99-3.46L4 6h16v2.54zM11 15h2v2h-2zm0-4h2v2h-2zm0-4h2v2h-2z';
export const icSorteo = (s = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${SVG_SORTEO}"/></svg>`;
const SVG_COMPARTIR = 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z';
const svg = (d, s = 16) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;

const https = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : '');
const zonaDe = (g) => KZ.zona(g?.business?.time_zone || KZ.porCoordenadas(g?.business?.lat, g?.business?.lng) || KZ.MADRID);

/** Lo personal lo pone el navegador (solo con sesión). */
const sorteoScript = (lang) => {
  const sp = supabasePublic();
  return `<script src="/assets/textos-sorteos.js?v=1" defer></script>
<script src="/assets/sorteo.js?v=1" defer data-url="${esc(sp.url)}" data-key="${esc(sp.key)}" data-lang="${lang === 'en' ? 'en' : 'es'}"></script>`;
};

// ── La zona (como «Dónde ver el partido» y «Grupos y empresas») ────────────
const CLAVES = { es: { city: 'ciudad', mine: 'mios' }, en: { city: 'city', mine: 'mine' } };
const plano = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const redondea = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);
const posUrl = (x) => redondea(Number(x)).toFixed(3);
function leeEstado(qs) {
  const lat = redondea(Number.parseFloat(qs.get('lat') || ''));
  const lng = redondea(Number.parseFloat(qs.get('lng') || ''));
  const cerca = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const km = Number.parseInt(qs.get('km') || '', 10);
  return {
    city: cerca ? '' : (qs.get('ciudad') || qs.get('city') || '').slice(0, 60),
    cerca, lat: cerca ? lat : null, lng: cerca ? lng : null,
    km: [10, 25].includes(km) ? km : 10,
    mine: qs.get('mios') === '1' || qs.get('mine') === '1',
  };
}
function query(e, lang) {
  const K = CLAVES[lang === 'en' ? 'en' : 'es'];
  const p = new URLSearchParams();
  if (e.cerca) { p.set('lat', posUrl(e.lat)); p.set('lng', posUrl(e.lng)); } else if (e.city) p.set(K.city, e.city);
  if (e.km && e.km !== 10) p.set('km', String(e.km));
  if (e.mine) p.set(K.mine, '1');
  return p.toString();
}
const conQs = (path, qs) => (qs ? `${path}?${qs}` : path);

/** Una tarjeta de la lista: logo, negocio, «Sorteo» + premio, cuándo
 * termina, cuántos participan y (con sesión) «Participas · nº 37». La misma
 * que pinta /assets/sorteo.js en «En los que participas». */
export function tarjetaSorteo(g, lang) {
  const S = KS.t(lang);
  const b = g.business || {};
  const logo = https(b.logo_url) ? `<img src="${esc(b.logo_url)}" alt="" width="56" height="56" loading="lazy" decoding="async">`
    : `<span class="ph" aria-hidden="true">${esc((b.name || '·').charAt(0).toUpperCase())}</span>`;
  return `<a class="sorteo-tj" href="${esc(sorteoPath(lang, g.id))}" data-sorteo="${esc(g.id)}">
      ${logo}
      <span class="sorteo-tj-t">
        <small class="muted">${esc(b.name || '')}</small>
        <b><span class="sorteo-tj-ante">${esc(S.word)}</span> ${esc(g.prize)}</b>
        <small class="muted">${esc(S.endsOn(KS.cuando(g.ends_at, lang, zonaDe(g))))} · ${esc(S.entrants(Number(g.entries) || 0))}</small>
        <small class="sorteo-tj-yo" hidden></small>
      </span>
      <span class="sorteo-tj-ir" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></span>
    </a>`;
}

// ── La lista ───────────────────────────────────────────────────────────────
export async function sorteosPage(url, lang) {
  const en = lang === 'en';
  const S = KS.t(lang);
  const base = sorteosBase(lang);
  const e = leeEstado(url.searchParams);
  const [ciudades, ciudadesK] = await Promise.all([
    rpcAll('public_cities', {}),
    rows('cities', 'select=id,name,lat,lng&order=position.asc').catch(() => []),
  ]);
  let origen = null;
  if (e.cerca) origen = { lat: e.lat, lng: e.lng };
  else if (e.city) {
    const c = (ciudadesK || []).find((x) => x.id === plano(e.city) || plano(x.name) === plano(e.city));
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) origen = { lat: c.lat, lng: c.lng };
  }
  const lista = e.mine ? [] : await rpcAll('giveaways_near', {
    p_lat: origen ? origen.lat : null, p_lng: origen ? origen.lng : null, p_radius_m: e.km * 1000,
    p_city: !origen && e.city ? e.city : null, p_limit: 60,
  });
  const link = (cambios) => {
    const b = { ...e, ...cambios };
    if (b.cerca === false) { b.lat = null; b.lng = null; }
    return conQs(`${base}/`, query(b, lang));
  };
  const seg = `<nav class="seg-pub" aria-label="${esc(S.title)}">
      <a href="${esc(link({ mine: false }))}"${e.mine ? '' : ' aria-current="page"'}>${esc(S.segNear)}</a>
      <a href="${esc(link({ mine: true }))}" rel="nofollow"${e.mine ? ' aria-current="page"' : ''}>${esc(S.segMine)}</a>
    </nav>`;
  const barra = e.mine ? '' : `<div class="barra-filtros">${zonaMenu(e, lang, ciudades, link)}</div>
  <p id="cercaErr" class="aviso-error" role="alert" hidden></p>`;

  let cuerpo;
  if (e.mine) {
    // Lo pinta /assets/sorteo.js con tu sesión; sin ella, a entrar.
    cuerpo = `<div id="mis-sorteos" data-vacio-t="${esc(S.emptyMine)}" data-vacio-p="${esc(S.emptyMineText)}" data-cerca="${esc(link({ mine: false }))}" data-cerca-t="${esc(S.seeNear)}">
      <section class="vacio">
        <span class="vacio-ic" aria-hidden="true">${icSorteo(30)}</span>
        <h2>${esc(S.segMine)}</h2>
        <p>${esc(S.loginMine)}</p>
        <div class="vacio-botones"><a class="pill accent" href="${esc(`${cuentaBase(lang)}#/entrar?siguiente=sorteos`)}">${esc(S.login)}</a>
          <a class="pill" href="${esc(link({ mine: false }))}">${esc(S.seeNear)}</a></div>
      </section></div>`;
  } else if (lista.length) {
    cuerpo = `<div class="sorteos-lista" id="sorteos-lista">${lista.map((g) => tarjetaSorteo(g, lang)).join('')}</div>`;
  } else {
    const ampliar = origen && e.km < 25 ? `<a class="pill accent" href="${esc(link({ km: 25 }))}">${esc(en ? 'Widen to 25 km' : 'Ampliar a 25 km')}</a>` : '';
    const todas = e.city || e.cerca ? `<a class="pill${ampliar ? '' : ' accent'}" href="${esc(link({ city: '', cerca: false, km: 10 }))}">${esc(S.seeAll)}</a>` : '';
    cuerpo = `<section class="vacio">
      <span class="vacio-ic" aria-hidden="true">${icSorteo(30)}</span>
      <h2>${esc(S.empty)}</h2>
      <p>${esc(S.emptyText)}</p>
      ${ampliar || todas ? `<div class="vacio-botones">${ampliar}${todas}</div>` : `<div class="vacio-botones"><a class="pill accent" href="${en ? '/en/explore/' : '/explorar/'}">${en ? 'Explore' : 'Explorar'}</a></div>`}
    </section>`;
  }

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${en ? '/en/explore/' : '/explorar/'}">${en ? 'Explore' : 'Explorar'}</a></p>
  <div class="exp-cab cab-pagina"><div><h1>${esc(S.title)}</h1>
    <p class="muted exp-lead">${esc(S.lead)}</p></div></div>
  ${seg}
  ${barra}
  ${cuerpo}`;
  const filtrada = Boolean(e.city || e.cerca || e.mine || e.km !== 10);
  const migas = [['Klendar', en ? '/en/' : '/'], [S.title, `${base}/`]];
  return html(publicPage({
    lang,
    path: `${base}/`,
    title: S.title,
    description: S.lead,
    body,
    actual: 'explorar',
    head: `${GRUPOS_CSS}
${e.mine ? '' : recuperaZona()}
${filtrada ? '<meta name="robots" content="noindex, follow">' : ldScript({ '@context': 'https://schema.org', ...breadcrumbLd(migas) })}
${sorteoScript(lang)}`,
    contador: !e.cerca,
  }), 200, e.mine ? 'public, max-age=300' : 'public, max-age=120, s-maxage=300');
}

// ── La página de un sorteo ─────────────────────────────────────────────────
function noEsta(lang, path) {
  const en = lang === 'en';
  const S = KS.t(lang);
  return html(publicPage({
    lang, path, title: S.notHere, description: S.notHereText, head: `<meta name="robots" content="noindex">\n${GRUPOS_CSS}`,
    actual: 'explorar',
    body: `<p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${sorteosBase(lang)}/">${esc(S.title)}</a></p>
  <section class="vacio">
    <span class="vacio-ic" aria-hidden="true">${icSorteo(30)}</span>
    <h1>${esc(S.notHere)}</h1>
    <p>${esc(S.notHereText)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${sorteosBase(lang)}/">${esc(S.title)}</a></div>
  </section>`,
  }), 404, 'no-store');
}

/** Lo que va en la caja del botón para quien mira sin sesión (o mientras
 * /assets/sorteo.js pide lo suyo). */
export function accionPublica(g, lang) {
  const S = KS.t(lang);
  const estado = g.status === 'cancelled' ? esc(S.cancelled(g.cancel_reason || ''))
    : g.status === 'drawn' ? `<b>${esc(S.ended)}</b>`
      : KS.terminado(g) ? `<b>${esc(S.drawing)}</b>` : '';
  // El botón principal es siempre el mismo elemento (/assets/barra.js lo
  // copia abajo en el móvil): sin él, oculto.
  return `<div class="sorteo-estado" id="sorteo-estado"${estado ? '' : ' hidden'}>${estado}</div>
    <a class="pill accent big" id="sorteo-boton" data-sorteo-entrar href="${esc(`${cuentaBase(lang)}#/sorteo/${g.id}`)}" rel="nofollow"${estado ? ' hidden' : ''}>${esc(g.requires_favorite ? S.enterFav : S.enter)}</a>
    <div class="sorteo-extra" id="sorteo-extra">${estado ? '' : `<p class="note">${esc(S.free)}</p>`}</div>`;
}

export async function sorteoPage(rawId, url, lang) {
  const en = lang === 'en';
  const S = KS.t(lang);
  const id = String(rawId || '').toLowerCase();
  if (!isUuid(id)) return noEsta(lang, sorteoPath(lang, rawId));
  const path = sorteoPath(lang, id);
  const g = await rpc('giveaway_detail', { p_id: id });
  if (!g || !g.id) return noEsta(lang, path);
  const b = g.business || {};
  const tz = zonaDe(g);
  const bHref = bizPath(lang, b.slug || b.id);
  const logo = https(b.logo_url) ? `<img src="${esc(b.logo_url)}" alt="" width="44" height="44" loading="lazy" decoding="async">`
    : `<span class="fn-ph" aria-hidden="true">${esc((b.name || '·').charAt(0).toUpperCase())}</span>`;
  const datos = [
    g.prize_value_cents != null ? S.value(KS.dinero(g.prize_value_cents, lang)) : '',
    S.winners(Number(g.winners) || 1, Number(g.backups) || 0),
    S.endsOn(KS.cuando(g.ends_at, lang, tz, true)),
    S.entrants(Number(g.entries) || 0),
    g.requires_favorite ? S.requirement(b.name || '') : '',
    g.adults_only ? S.adults : '',
  ].filter(Boolean);
  const denunciar = `${cuentaBase(lang)}#/denunciar/business/${encodeURIComponent(b.id || '')}?detalle=${encodeURIComponent(S.reportDetail(g.prize))}`;
  const drawn = g.status === 'drawn';
  const verificable = `<section class="sorteo-ver" aria-labelledby="verT">
      <h2 id="verT">${esc(S.verTitle)}</h2>
      <p class="muted">${esc(S.verText)}</p>
      <dl class="sorteo-ver-datos">
        <div><dt>${esc(S.hash)}</dt><dd><code>${esc(g.seed_hash || '')}</code></dd></div>
        ${drawn ? `<div><dt>${esc(S.seed)}</dt><dd><code>${esc(g.seed || '')}</code></dd></div>` : ''}
      </dl>
      ${drawn ? `<ul class="sorteo-ver-lista">
        <li>${esc(S.entries(Number(g.entries_total) || 0))}</li>
        <li>${esc(KS.anulados(g, lang))}</li>
        <li>${esc(KS.salidos(g, lang))}</li>
      </ul>
      <p><button type="button" class="pill" id="sorteo-comprobar" hidden>${esc(S.check)}</button></p>
      <p class="sorteo-ver-res" id="sorteo-ver-res" role="status" aria-live="polite"></p>
      <script type="application/json" id="sorteo-ver-datos">${JSON.stringify({
    seed: g.seed, seed_hash: g.seed_hash, entries_total: g.entries_total, void_numbers: g.void_numbers || [], picked_numbers: g.picked_numbers || [],
  }).replace(/</g, '\\u003c')}</script>` : ''}
      <details class="sorteo-como"><summary>${esc(S.how)}</summary><p>${esc(S.howText)}</p></details>
    </section>`;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${sorteosBase(lang)}/">${esc(S.title)}</a></p>
  <div class="detail ficha sorteo${https(b.cover_image_url) ? '' : ' sin-media'}" data-equipo-biz="${esc(b.id || '')}" data-ref-negocio="${esc(b.id || '')}">
    ${https(b.cover_image_url) ? carrusel([b.cover_image_url], { titulo: b.name, forma: 'negocio', lang }) : ''}
    <div class="d-head">
      <div class="d-top"><div class="badges"><span class="badge">${esc(S.eyebrow)}</span>${g.adults_only ? `<span class="badge">${esc(S.adults)}</span>` : ''}</div>
      ${masMenu([`<a class="mas-peligro" data-solo-publico href="${esc(denunciar)}" rel="nofollow">${esc(S.report)}</a>`], lang)}</div>
      <h1>${esc(g.prize)}</h1>
      <a class="ficha-negocio" href="${esc(bHref)}">${logo}
        <span><b>${esc(`${S.by} ${b.name || ''}`)}</b><span class="muted">${esc(b.city || '')}</span></span>
        <svg class="ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></a>
      ${g.description ? `<p class="sorteo-desc">${esc(g.description).replace(/\n/g, '<br>')}</p>` : ''}
      <ul class="sorteo-datos">${datos.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
    </div>
    <aside class="side">
      <div class="sorteo-accion" id="sorteo-accion" data-id="${esc(g.id)}" data-tz="${esc(tz)}">${accionPublica(g, lang)}</div>
      <p class="acciones sorteo-compartir">
        <button type="button" class="pill" id="sorteo-compartir" data-url="${esc(`${BASE}${path}`)}" data-titulo="${esc(`${S.word}: ${g.prize}`)}" data-copiado="${esc(S.copied)}">${svg(SVG_COMPARTIR)} <span>${esc(S.share)}</span></button>
        ${g.status === 'active' && !KS.terminado(g) ? historiaBoton(lang, 's', g.id) : ''}
      </p>
      <p class="sorteo-bases"><a href="${esc(basesPath(lang, g.id))}">${esc(S.rules)}</a></p>
    </aside>
    <div class="d-body">
      ${g.terms ? `<details class="sorteo-condiciones"><summary>${esc(S.terms)}</summary><p>${esc(g.terms).replace(/\n/g, '<br>')}</p></details>` : ''}
      ${verificable}
    </div>
  </div>`;

  const description = [S.endsOn(KS.cuando(g.ends_at, lang, tz, true)), S.winners(Number(g.winners) || 1, Number(g.backups) || 0), S.free]
    .join(' · ');
  const migas = [['Klendar', en ? '/en/' : '/'], [S.title, `${sorteosBase(lang)}/`], [g.prize, path]];
  return html(publicPage({
    lang,
    path,
    title: `${S.word}: ${g.prize} · ${b.name || ''}`,
    description,
    image: https(b.cover_image_url) || https(b.logo_url) || undefined,
    body: body + MENU_JS,
    actual: 'explorar',
    head: `${GRUPOS_CSS}
${g.status === 'active' && !g.adults_only ? ldScript({ '@context': 'https://schema.org', ...breadcrumbLd(migas) }) : '<meta name="robots" content="noindex, follow">'}
${sorteoScript(lang)}`,
  }), 200, 'public, max-age=60, s-maxage=120');
}

// ── Las bases legales ─────────────────────────────────────────────────────
export async function basesPage(rawId, lang) {
  const en = lang === 'en';
  const S = KS.t(lang);
  const id = String(rawId || '').toLowerCase();
  if (!isUuid(id)) return noEsta(lang, basesPath(lang, rawId));
  const path = basesPath(lang, id);
  const d = await rpc('giveaway_bases', { p_id: id, p_lang: en ? 'en' : 'es' });
  if (!d || !d.id || !Array.isArray(d.sections)) return noEsta(lang, path);
  const fechaAct = d.updated_at ? KS.dia(d.updated_at, lang) : '';
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${esc(sorteoPath(lang, id))}">${esc(d.prize || S.word)}</a></p>
  <article class="doc sorteo-bases-doc">
    <h1>${esc(d.title || S.rulesTitle)}</h1>
    ${fechaAct ? `<p class="muted">${esc(S.updated(fechaAct))}</p>` : ''}
    ${d.sections.map((s) => `<h2>${esc(s.title)}</h2>
    ${String(s.body || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}`).join('')}
    <p class="note">${esc(S.rulesNote)}</p>
    <p><a class="pill" href="${esc(sorteoPath(lang, id))}">← ${esc(S.back)}</a></p>
  </article>`;
  return html(publicPage({
    lang, path, title: d.title || S.rulesTitle, description: `${S.rulesTitle}: ${d.prize || ''} · ${d.business || ''}`,
    body, head: `<meta name="robots" content="noindex, follow">\n${GRUPOS_CSS}`,
  }), 200, 'public, max-age=300, s-maxage=600');
}

// ── En la ficha del negocio ───────────────────────────────────────────────
/** Una tarjeta por sorteo abierto: «Sorteo: <premio> · termina el 14 de
 * octubre». '' si no hay. */
export function sorteosEnFicha(lista, lang) {
  const S = KS.t(lang);
  const abiertos = (lista || []).filter((g) => g && isUuid(g.id) && g.status === 'active' && !KS.terminado(g));
  if (!abiertos.length) return '';
  return `<div class="sorteos-ficha" id="sorteos">${abiertos.map((g) => `<a class="sorteo-ficha" href="${esc(sorteoPath(lang, g.id))}">
      ${icSorteo(22)}<span><b>${esc(S.cardLine(g.prize, KS.dia(g.ends_at, lang, zonaDe(g))))}</b>
      <small class="muted">${esc(S.entrants(Number(g.entries) || 0))}</small></span>
      <svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></a>`).join('')}</div>`;
}

/** Para el sitemap: los sorteos abiertos (todos; los +18 no). */
export async function sorteosAbiertos() {
  const l = await rpcAll('giveaways_near', { p_lat: null, p_lng: null, p_radius_m: null, p_city: null, p_limit: 200 });
  return l.filter((g) => isUuid(g.id) && !g.adults_only);
}

