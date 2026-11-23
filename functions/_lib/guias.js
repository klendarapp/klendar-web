// Guías de temporada generales (migraciones 20261283800000 y 20261283900000
// de la app): UNA guía («Navidad») que cada sitio llena con sus planes; se
// ve «Navidad en Málaga» según dónde se mira («… en {sitio}», que el admin
// puede apagar).
//
// /guia/<slug> (y /en/guide/<slug>): portada, texto y fechas, lo de la zona
// del visitante (la elegida, `?lat=&lng=&km=` como Descubre, o la de su
// conexión) y «Elige tu sitio» (los municipios con planes). `?ciudad=<m>`
// lleva con un 301 a la página del municipio.
// /guia/<slug>/<municipio>: lo de ese municipio, «Navidad en Málaga»,
// indexable y en el sitemap (lo que trae gente desde Google). Un municipio
// sin planes: 404 con noindex.
// Con filtros (¿Cuándo? y el tipo: `?cuando=finde&tipo=eventos` /
// `?when=weekend&type=events`), noindex con la canónica sin ellos. Fuera de
// fechas (o archivada): «Esta guía ha terminado» y a Descubre, con 200 y
// noindex (el año siguiente vuelve a la misma dirección). Una que no
// existe: 404.
//
// Lo mismo que la app (`lib/features/guides/`): mismos textos, mismos
// filtros, el mismo orden (lo que empieza antes, primero).

import { esc, html, rpc, rpcAll } from './page.js';
import { zonaDeConexion } from './conexion.js';
import { BASE, breadcrumbLd, discoverBase, ldScript, publicPage } from './public.js';
import { rejilla } from './tarjeta.js';
import { notFound } from './views.js';

export const guiaBase = (lang) => (lang === 'en' ? '/en/guide' : '/guia');
export const guiaPath = (lang, slug, muni = '') => `${guiaBase(lang)}/${encodeURIComponent(slug)}${muni ? `/${encodeURIComponent(muni)}` : ''}`;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RADIO_ZONA_M = 25000;

const T = (en) => (en
  ? {
      badge: 'Guide', open: 'See the guide', ended: 'This guide has ended',
      endedBody: "See what's on near you today in Discover.", goDiscover: 'Go to Discover',
      soon: (d) => `Starts on ${d}`, empty: 'Nothing here yet',
      emptyBody: 'Businesses are filling it up: come back in a few days or remove a filter.',
      when: 'When?', type: 'Type', any: 'Any time', today: 'Today', tomorrow: 'Tomorrow',
      weekend: 'This weekend', next10: 'Next 10 days', offers: 'Offers', events: 'Events',
      plans: (n) => (n === 1 ? '1 plan' : `${n} plans`),
      desc: (place, dates) => `Klendar seasonal guide${place ? ` in ${place}` : ''}${dates ? `: ${dates}` : ''}.`,
      titleIn: (t, p) => `${t} in ${p}`, pick: 'Pick your place', more: 'More places', go: 'See',
      noZone: 'Pick your place to see what is on there.',
      nothingHereBody: 'Look at other places or come back in a few days.',
    }
  : {
      badge: 'Guía', open: 'Ver la guía', ended: 'Esta guía ha terminado',
      endedBody: 'Mira lo que hay hoy cerca de ti en Descubre.', goDiscover: 'Ir a Descubre',
      soon: (d) => `Empieza el ${d}`, empty: 'Aún no hay nada aquí',
      emptyBody: 'Los negocios la van llenando: vuelve en unos días o quita algún filtro.',
      when: '¿Cuándo?', type: 'Tipo', any: 'Cuando sea', today: 'Hoy', tomorrow: 'Mañana',
      weekend: 'Este finde', next10: 'Próximos 10 días', offers: 'Ofertas', events: 'Eventos',
      plans: (n) => (n === 1 ? '1 plan' : `${n} planes`),
      desc: (place, dates) => `Guía de temporada de Klendar${place ? ` en ${place}` : ''}${dates ? `: ${dates}` : ''}.`,
      titleIn: (t, p) => `${t} en ${p}`, pick: 'Elige tu sitio', more: 'Más sitios', go: 'Ver',
      noZone: 'Elige tu sitio para ver lo que hay allí.',
      nothingHereBody: 'Mira otros sitios o vuelve en unos días.',
    });
// ¿Cuándo? y el tipo, en la dirección de cada idioma → lo que pide la base.
const CUANDO = {
  es: { hoy: 'today', manana: 'tomorrow', finde: 'weekend', '10dias': 'next10' },
  en: { today: 'today', tomorrow: 'tomorrow', weekend: 'weekend', next10: 'next10' },
};
const TIPO = { es: { ofertas: 'flash_offer', eventos: 'future_event' }, en: { offers: 'flash_offer', events: 'future_event' } };

/** El texto en el idioma de la página (el que escribió administración; si
 *  no hay inglés, el español). */
export const deIdioma = (m, en) => (m && typeof m === 'object' ? (en ? m.en || m.es : m.es || m.en) : '') || '';

/** «Navidad en Málaga» (con el sitio, si la guía lo admite) o «Navidad». */
export function tituloGuia(g, lang, sitio = g?.place_name) {
  const S = T(lang === 'en');
  const t = deIdioma(g?.title, lang === 'en') || g?.slug || '';
  return g?.title_place !== false && sitio ? S.titleIn(t, sitio) : t;
}

/** «1 dic – 6 ene» (los días de la guía, sin hora: tal cual). */
export function fechasGuia(g, lang) {
  if (!g?.starts_on || !g?.ends_on) return '';
  const f = (d) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${String(d).slice(0, 10)}T12:00:00Z`)).replace('.', '');
  return `${f(g.starts_on)} – ${f(g.ends_on)}`;
}

const diaLargo = (d, lang) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  .format(new Date(`${String(d).slice(0, 10)}T12:00:00Z`));

const GUIA_CSS = `<style>
.guia-cab{display:grid;gap:10px;margin:6px 0 14px}
.guia-portada{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:16px;background:var(--surface-2,#1f1f1f);display:block}
.guia-eti{display:inline-flex;align-items:center;gap:6px;border:1px solid currentColor;border-radius:999px;padding:2px 10px;font-size:13px;opacity:.85;width:max-content}
.guia-meta{color:var(--muted,#9a9a9a);margin:0}
.guia-texto{max-width:680px;margin:0;font-size:17px;line-height:1.5}
.guia-pronto{font-weight:600;margin:0}
.guia-banner{position:relative;display:block;border-radius:20px;overflow:hidden;min-height:200px;margin:0 0 16px;color:#fff;text-decoration:none;background:var(--surface-2,#1f1f1f)}
.guia-banner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.guia-banner::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.2) 20%,rgba(0,0,0,.8))}
.guia-banner .gb-t{position:relative;z-index:1;display:grid;gap:6px;padding:20px;align-content:end;min-height:200px;box-sizing:border-box}
.guia-banner .gb-t b{font-size:24px;line-height:1.2}
.guia-banner .gb-m{opacity:.8}
.guia-banner .gb-btn{display:inline-flex;align-items:center;gap:6px;width:max-content;background:#fff;color:#000;border-radius:999px;padding:10px 16px;font-weight:600;margin-top:6px}
.guia-banner.sin-foto{color:inherit}.guia-banner.sin-foto::after{display:none}
.guia-banner.sin-foto .gb-btn{background:transparent;color:inherit;border:1px solid currentColor}
.guia-sitios{margin:18px 0;display:grid;gap:10px}
.guia-sitios .frow{flex-wrap:wrap}
.guia-sitios form{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.guia-sitios select{min-height:40px;border-radius:999px;padding:0 14px;max-width:100%}
</style>`;
export { GUIA_CSS };

/** La franja de la guía, encima de Descubre (web): sobria, sin coral. Lleva
 *  a la guía con la misma zona que Descubre (`donde`: `?ciudad=…` o
 *  `?lat=&lng=&km=`). '' si no hay. */
export function bannerGuia(g, lang, donde = '') {
  if (!g?.slug || !SLUG.test(g.slug)) return '';
  const en = lang === 'en';
  const S = T(en);
  const foto = /^https:\/\//.test(g.cover_url || '') ? g.cover_url : '';
  const meta = [g.title_place === false ? g.place_name : '', fechasGuia(g, lang), g.count > 0 ? S.plans(g.count) : ''].filter(Boolean).join(' · ');
  return `${GUIA_CSS}<a class="guia-banner${foto ? '' : ' sin-foto'}" href="${esc(guiaPath(lang, g.slug) + (donde || ''))}" data-guia="${esc(g.slug)}">
  ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" decoding="async">` : ''}
  <span class="gb-t"><span class="guia-eti">${esc(S.badge)}</span><b>${esc(tituloGuia(g, lang))}</b>
  ${meta ? `<span class="gb-m">${esc(meta)}</span>` : ''}<span class="gb-btn">${esc(S.open)} →</span></span></a>`;
}

const dec = (x) => { try { return decodeURIComponent(String(x || '')).replace(/\/+$/, '').toLowerCase(); } catch { return ''; } };

/** /guia/<slug>[/<municipio>], /en/guide/<slug>[/<municipio>]. */
export async function guiaPage(rawSlug, rawMuni, url, lang, request = null) {
  const en = lang === 'en';
  const S = T(en);
  const slug = dec(rawSlug);
  const muniSlug = rawMuni == null ? '' : dec(rawMuni);
  const path = guiaPath(lang, slug, muniSlug);
  if (!SLUG.test(slug) || (rawMuni != null && !SLUG.test(muniSlug))) return notFound(lang, path, 'o');
  const q = url.searchParams;

  const [g, sitios] = await Promise.all([
    rpc('guide_info', { p_slug: slug, p_lat: null, p_lng: null, p_city: null }),
    rpcAll('guide_places', { p_slug: slug, p_limit: 500 }).catch(() => []),
  ]);
  if (!g || !g.id) return notFound(lang, path, 'o');
  const lista = (sitios || []).filter((m) => SLUG.test(m?.slug || ''));
  const elegido = muniSlug ? lista.find((m) => m.slug === muniSlug) || null : null;
  // Un municipio sin planes (o que no existe): sin página.
  if (muniSlug && !elegido) return notFound(lang, path, 'o');
  // «Elige tu sitio» sin JavaScript: `?ciudad=` → la página del municipio.
  const pedida = dec(q.get('ciudad') || q.get('city'));
  if (!muniSlug && pedida && lista.some((m) => m.slug === pedida)) {
    return new Response(null, { status: 301, headers: { location: guiaPath(lang, slug, pedida), 'cache-control': 'public, max-age=300' } });
  }
  // La zona, sin municipio: la de Descubre (`?lat=&lng=&km=`) o la conexión.
  const lat = Number.parseFloat(q.get('lat') || '');
  const lng = Number.parseFloat(q.get('lng') || '');
  const km = Math.min(100, Math.max(1, Number.parseInt(q.get('km') || '', 10) || RADIO_ZONA_M / 1000));
  const puntoUrl = !muniSlug && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const conexion = !muniSlug && !puntoUrl ? zonaDeConexion(request) : null;
  const punto = puntoUrl ? { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 } : conexion;
  const radio = puntoUrl ? km * 1000 : RADIO_ZONA_M;
  let sitio = elegido?.name || null;
  if (!sitio && punto) {
    const gz = await rpc('guide_info', { p_slug: slug, p_lat: punto.lat, p_lng: punto.lng, p_city: null }).catch(() => null);
    sitio = gz?.place_name || null;
  }

  const titulo = tituloGuia(g, lang, sitio);
  const general = tituloGuia(g, lang, null);
  const texto = deIdioma(g.text, en);
  const fechas = fechasGuia(g, lang);
  const meta = [g.title_place === false ? sitio : '', fechas].filter(Boolean).join(' · ');
  const foto = /^https:\/\//.test(g.cover_url || '') ? g.cover_url : undefined;
  const description = (texto || S.desc(sitio || g.scope_name, fechas)).replace(/\s+/g, ' ').slice(0, 200);
  const migas = [['Klendar', en ? '/en' : '/'], [general, guiaPath(lang, slug)], ...(elegido ? [[titulo, path]] : [])];
  const cabecera = `
  <p class="crumbs"><a href="${en ? '/en' : '/'}">Klendar</a> · <a href="${discoverBase(lang)}">${en ? 'Discover' : 'Descubre'}</a>${elegido ? ` · <a href="${esc(guiaPath(lang, slug))}">${esc(general)}</a>` : ''}</p>
  <div class="guia-cab">
    ${foto ? `<img class="guia-portada" src="${esc(foto)}" alt="" fetchpriority="high" decoding="async">` : ''}
    <span class="guia-eti">${esc(S.badge)}</span>
    <h1>${esc(titulo)}</h1>
    ${meta ? `<p class="guia-meta">${esc(meta)}</p>` : ''}
    ${g.status === 'soon' && g.starts_on ? `<p class="guia-pronto">${esc(S.soon(diaLargo(g.starts_on, lang)))}</p>` : ''}
    ${texto ? `<p class="guia-texto">${esc(texto)}</p>` : ''}
  </div>`;

  // Terminada o archivada: lo dice y lleva a Descubre (coral: el botón
  // principal de la página).
  if (g.status === 'ended') {
    return html(publicPage({
      lang, path, title: titulo, description: S.ended, image: foto,
      head: `<meta name="robots" content="noindex, follow">\n${GUIA_CSS}`,
      body: `${cabecera}
  <section class="vacio"><h2>${esc(S.ended)}</h2><p>${esc(S.endedBody)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${discoverBase(lang)}">${esc(S.goDiscover)}</a></div></section>`,
    }), 200, 'public, max-age=300, s-maxage=900');
  }

  const L = en ? 'en' : 'es';
  const cuandoUrl = q.get(en ? 'when' : 'cuando') || '';
  // El tipo, de varios a la vez y sin «Todo» (§4zzz-chips): los pulsados en
  // orden fijo (ofertas, eventos); a la base, uno solo o nada (los dos o
  // ninguno = todo). El `?tipo=todos` de antes no cuenta.
  const tiposUrl = q.getAll(en ? 'type' : 'tipo').flatMap((v) => String(v).split(','));
  const tiposOk = Object.keys(TIPO[L]).filter((k) => tiposUrl.includes(k));
  const when = CUANDO[L][cuandoUrl] || null;
  const kind = tiposOk.length === 1 ? TIPO[L][tiposOk[0]] : null;
  const filtrado = Boolean(when || tiposOk.length);
  const zona = Boolean(elegido || punto);
  const res = zona
    ? await rpc('guide_offers', {
      p_slug: slug,
      p_filters: { ...(when ? { when } : {}), ...(kind ? { kind } : {}), ...(elegido ? { municipality: elegido.code } : { radius_m: radio }) },
      p_lat: punto?.lat ?? null, p_lng: punto?.lng ?? null, p_limit: 60, p_offset: 0,
    })
    : { items: [] };
  const items = res?.items || [];

  // Al cambiar un filtro se conserva la zona elegida en la dirección.
  const enlace = (c, t) => {
    const p = new URLSearchParams();
    if (puntoUrl) { p.set('lat', String(punto.lat)); p.set('lng', String(punto.lng)); p.set('km', String(km)); }
    if (c) p.set(en ? 'when' : 'cuando', c);
    for (const x of Object.keys(TIPO[L]).filter((k) => t.includes(k))) p.append(en ? 'type' : 'tipo', x);
    const s = p.toString();
    return s ? `${path}?${s}` : path;
  };
  const chip = (href, label, on) => `<a class="chip${on ? ' on' : ''}" href="${esc(href)}"${on ? ' aria-current="true"' : ''} rel="nofollow">${esc(label)}</a>`;
  const cuandos = en
    ? [['', S.any], ['today', S.today], ['tomorrow', S.tomorrow], ['weekend', S.weekend], ['next10', S.next10]]
    : [['', S.any], ['hoy', S.today], ['manana', S.tomorrow], ['finde', S.weekend], ['10dias', S.next10]];
  const tipos = en ? [['offers', S.offers], ['events', S.events]] : [['ofertas', S.offers], ['eventos', S.events]];
  const cuandoOk = when ? cuandoUrl : '';
  // Un chip del tipo se pulsa y se suelta (el lector dice «pulsado»).
  const chipTipo = (k, n) => {
    const on = tiposOk.includes(k);
    const otros = on ? tiposOk.filter((x) => x !== k) : [...tiposOk, k];
    return `<a class="chip${on ? ' on' : ''}" href="${esc(enlace(cuandoOk, otros))}" role="button" aria-pressed="${on}" rel="nofollow">${esc(n)}</a>`;
  };
  const filtros = zona ? `<nav class="filters" aria-label="${esc(S.when)}">
    <div class="frow"><span class="flabel">${esc(S.when)}</span>${cuandos.map(([k, n]) => chip(enlace(k, tiposOk), n, k === cuandoOk)).join('')}</div>
    <div class="frow"><span class="flabel">${esc(S.type)}</span>${tipos.map(([k, n]) => chipTipo(k, n)).join('')}</div>
  </nav>` : '';

  // «Elige tu sitio»: los municipios con planes (los primeros a la vista y
  // todos en el desplegable; sin JavaScript, el formulario va a `?ciudad=`).
  const selector = lista.length ? `<section class="guia-sitios" aria-labelledby="guiaSitios">
    <h2 id="guiaSitios">${esc(S.pick)}</h2>
    <div class="frow">${lista.slice(0, 12).map((m) => `<a class="chip${elegido?.code === m.code ? ' on' : ''}" href="${esc(guiaPath(lang, slug, m.slug))}">${esc(m.name)} · ${esc(String(m.count))}</a>`).join('')}</div>
    ${lista.length > 12 ? `<form method="get" action="${esc(guiaPath(lang, slug))}"><label class="flabel" for="guiaSitio">${esc(S.more)}</label>
      <select id="guiaSitio" name="${en ? 'city' : 'ciudad'}">${lista.map((m) => `<option value="${esc(m.slug)}"${elegido?.code === m.code ? ' selected' : ''}>${esc(m.name)}${m.province && m.province !== m.name ? ` (${esc(m.province)})` : ''} · ${esc(String(m.count))}</option>`).join('')}</select>
      <button class="pill" type="submit">${esc(S.go)}</button></form>` : ''}
  </section>` : '';

  const vacio = `<section class="vacio"><h2>${esc(S.empty)}</h2><p>${esc(zona ? S.nothingHereBody : (lista.length ? S.noZone : S.emptyBody))}</p>
    <div class="vacio-botones"><a class="pill" href="${discoverBase(lang)}">${esc(S.goDiscover)}</a></div></section>`;
  const body = `${cabecera}
  ${filtros}
  ${items.length ? rejilla(items, lang, { primera: !foto, h: 'h2' }) : vacio}
  ${selector}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', name: titulo, description, url: `${BASE}${path}`, image: foto,
        inLanguage: en ? 'en' : 'es',
        mainEntity: items.length ? {
          '@type': 'ItemList', numberOfItems: items.length,
          itemListElement: items.slice(0, 30).map((o, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}${en ? '/en' : ''}/o/${o.id}`, name: o.title })),
        } : undefined,
      },
      breadcrumbLd(migas),
    ],
  };

  // Con la zona del visitante (su punto o su conexión) no va a ninguna caché
  // compartida; la del municipio y la general sin zona, sí.
  const r = html(publicPage({
    lang, path, body, title: titulo, description, image: foto || items.find((o) => o.images?.[0])?.images?.[0],
    head: `${GUIA_CSS}
${filtrado || puntoUrl ? '<meta name="robots" content="noindex, follow">\n' : ''}${ldScript(jsonLd)}`,
  }), 200, punto ? 'private, max-age=0' : 'public, max-age=120, s-maxage=300');
  if (conexion) r.headers.set('vary', 'CF-Connecting-IP');
  return r;
}

/** Para el sitemap: las guías vivas o por empezar y sus municipios con planes. */
export const guiasParaSitemap = () => rpcAll('public_guides', {}).catch(() => []);
export const sitiosDeGuia = (slug) => rpcAll('guide_places', { p_slug: slug, p_limit: 2000 }).catch(() => []);
