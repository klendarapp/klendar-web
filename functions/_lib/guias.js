// Guías de temporada (migración 20261283800000 de la app): «Navidad en
// Málaga», «Semana Santa», «Feria de Agosto»…
//
// /guia/<slug> y /en/guide/<slug>: portada, texto, sitio y fechas, y las
// publicaciones vivas de la guía con los filtros normales (¿Cuándo? y el
// tipo, en la dirección: `?cuando=finde&tipo=eventos` / `?when=weekend&type=events`).
// Pública, con OG (la portada) e indexable; con filtros, noindex con la
// canónica sin ellos. Fuera de fechas (o archivada): «Esta guía ha
// terminado» y a Descubre, con 200 y noindex (el año siguiente vuelve a la
// misma dirección). Una que no existe: 404.
//
// Lo mismo que la app (`lib/features/guides/`): mismos textos, mismos
// filtros, el mismo orden (lo que empieza antes, primero).

import { esc, html, rpc, rpcAll } from './page.js';
import { BASE, breadcrumbLd, discoverBase, ldScript, publicPage } from './public.js';
import { rejilla } from './tarjeta.js';
import { notFound } from './views.js';

export const guiaBase = (lang) => (lang === 'en' ? '/en/guide' : '/guia');
export const guiaPath = (lang, slug) => `${guiaBase(lang)}/${encodeURIComponent(slug)}`;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const T = (en) => (en
  ? {
      badge: 'Guide', open: 'See the guide', ended: 'This guide has ended',
      endedBody: "See what's on near you today in Discover.", goDiscover: 'Go to Discover',
      soon: (d) => `Starts on ${d}`, empty: 'Nothing here yet',
      emptyBody: 'Businesses are filling it up: come back in a few days or remove a filter.',
      when: 'When?', type: 'Type', any: 'Any time', today: 'Today', tomorrow: 'Tomorrow',
      weekend: 'This weekend', next10: 'Next 10 days', all: 'All', offers: 'Flash offers', events: 'Events',
      plans: (n) => (n === 1 ? '1 plan' : `${n} plans`),
      desc: (place, dates) => `Klendar seasonal guide${place ? ` in ${place}` : ''}${dates ? `: ${dates}` : ''}.`,
      share: 'Share',
    }
  : {
      badge: 'Guía', open: 'Ver la guía', ended: 'Esta guía ha terminado',
      endedBody: 'Mira lo que hay hoy cerca de ti en Descubre.', goDiscover: 'Ir a Descubre',
      soon: (d) => `Empieza el ${d}`, empty: 'Aún no hay nada aquí',
      emptyBody: 'Los negocios la van llenando: vuelve en unos días o quita algún filtro.',
      when: '¿Cuándo?', type: 'Tipo', any: 'Cuando sea', today: 'Hoy', tomorrow: 'Mañana',
      weekend: 'Este finde', next10: 'Próximos 10 días', all: 'Todo', offers: 'Ofertas flash', events: 'Eventos',
      plans: (n) => (n === 1 ? '1 plan' : `${n} planes`),
      desc: (place, dates) => `Guía de temporada de Klendar${place ? ` en ${place}` : ''}${dates ? `: ${dates}` : ''}.`,
      share: 'Compartir',
    });
export const textosGuia = (lang) => T(lang === 'en');

// ¿Cuándo? y el tipo, en la dirección de cada idioma → lo que pide la base.
const CUANDO = {
  es: { hoy: 'today', manana: 'tomorrow', finde: 'weekend', '10dias': 'next10' },
  en: { today: 'today', tomorrow: 'tomorrow', weekend: 'weekend', next10: 'next10' },
};
const TIPO = { es: { ofertas: 'flash_offer', eventos: 'future_event' }, en: { offers: 'flash_offer', events: 'future_event' } };

/** El texto en el idioma de la página (el que escribió administración; si
 *  no hay inglés, el español). */
export const deIdioma = (m, en) => (m && typeof m === 'object' ? (en ? m.en || m.es : m.es || m.en) : '') || '';

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
</style>`;
export { GUIA_CSS };

/** La franja de la guía de tu ciudad, encima de Descubre (web): sobria, sin
 *  coral. '' si no hay. */
export function bannerGuia(g, lang) {
  if (!g?.slug || !SLUG.test(g.slug)) return '';
  const en = lang === 'en';
  const S = T(en);
  const foto = /^https:\/\//.test(g.cover_url || '') ? g.cover_url : '';
  const meta = [g.place_name, fechasGuia(g, lang), g.count > 0 ? S.plans(g.count) : ''].filter(Boolean).join(' · ');
  return `${GUIA_CSS}<a class="guia-banner${foto ? '' : ' sin-foto'}" href="${esc(guiaPath(lang, g.slug))}" data-guia="${esc(g.slug)}">
  ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" decoding="async">` : ''}
  <span class="gb-t"><span class="guia-eti">${esc(S.badge)}</span><b>${esc(deIdioma(g.title, en) || g.slug)}</b>
  ${meta ? `<span class="gb-m">${esc(meta)}</span>` : ''}<span class="gb-btn">${esc(S.open)} →</span></span></a>`;
}

/** /guia/<slug>, /en/guide/<slug>. */
export async function guiaPage(rawSlug, url, lang) {
  const en = lang === 'en';
  const S = T(en);
  let slug = '';
  try { slug = decodeURIComponent(String(rawSlug || '')).replace(/\/+$/, '').toLowerCase(); } catch { slug = ''; }
  const path = guiaPath(lang, slug);
  if (!SLUG.test(slug)) return notFound(lang, path, 'o');
  const g = await rpc('guide_info', { p_slug: slug });
  if (!g || !g.id) return notFound(lang, path, 'o');

  const titulo = deIdioma(g.title, en) || slug;
  const texto = deIdioma(g.text, en);
  const fechas = fechasGuia(g, lang);
  const meta = [g.place_name, fechas].filter(Boolean).join(' · ');
  const foto = /^https:\/\//.test(g.cover_url || '') ? g.cover_url : undefined;
  const description = (texto || S.desc(g.place_name, fechas)).replace(/\s+/g, ' ').slice(0, 200);
  const migas = [['Klendar', en ? '/en' : '/'], [titulo, path]];
  const cabecera = `
  <p class="crumbs"><a href="${en ? '/en' : '/'}">Klendar</a> · <a href="${discoverBase(lang)}">${en ? 'Discover' : 'Descubre'}</a></p>
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

  const q = url.searchParams;
  const L = en ? 'en' : 'es';
  const cuandoUrl = q.get(en ? 'when' : 'cuando') || '';
  const tipoUrl = q.get(en ? 'type' : 'tipo') || '';
  const when = CUANDO[L][cuandoUrl] || null;
  const kind = TIPO[L][tipoUrl] || null;
  const filtrado = Boolean(when || kind);
  const res = await rpc('guide_offers', {
    p_slug: slug, p_filters: { ...(when ? { when } : {}), ...(kind ? { kind } : {}) }, p_lat: null, p_lng: null, p_limit: 60, p_offset: 0,
  });
  const items = res?.items || [];

  const enlace = (c, t) => {
    const p = new URLSearchParams();
    if (c) p.set(en ? 'when' : 'cuando', c);
    if (t) p.set(en ? 'type' : 'tipo', t);
    const s = p.toString();
    return s ? `${path}?${s}` : path;
  };
  const chip = (href, label, on) => `<a class="chip${on ? ' on' : ''}" href="${esc(href)}"${on ? ' aria-current="true"' : ''} rel="nofollow">${esc(label)}</a>`;
  const cuandos = en
    ? [['', S.any], ['today', S.today], ['tomorrow', S.tomorrow], ['weekend', S.weekend], ['next10', S.next10]]
    : [['', S.any], ['hoy', S.today], ['manana', S.tomorrow], ['finde', S.weekend], ['10dias', S.next10]];
  const tipos = en ? [['', S.all], ['offers', S.offers], ['events', S.events]] : [['', S.all], ['ofertas', S.offers], ['eventos', S.events]];
  const cuandoOk = when ? cuandoUrl : '';
  const tipoOk = kind ? tipoUrl : '';
  const filtros = `<nav class="filters" aria-label="${esc(S.when)}">
    <div class="frow"><span class="flabel">${esc(S.when)}</span>${cuandos.map(([k, n]) => chip(enlace(k, tipoOk), n, k === cuandoOk)).join('')}</div>
    <div class="frow"><span class="flabel">${esc(S.type)}</span>${tipos.map(([k, n]) => chip(enlace(cuandoOk, k), n, k === tipoOk)).join('')}</div>
  </nav>`;

  const body = `${cabecera}
  ${filtros}
  ${items.length
    ? rejilla(items, lang, { primera: !foto, h: 'h2' })
    : `<section class="vacio"><h2>${esc(S.empty)}</h2><p>${esc(S.emptyBody)}</p>
    <div class="vacio-botones"><a class="pill" href="${discoverBase(lang)}">${esc(S.goDiscover)}</a></div></section>`}`;

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

  return html(publicPage({
    lang, path, body, title: titulo, description, image: foto || items.find((o) => o.images?.[0])?.images?.[0],
    head: `${GUIA_CSS}
${filtrado || !items.length ? '<meta name="robots" content="noindex, follow">\n' : ''}${ldScript(jsonLd)}`,
  }), 200, 'public, max-age=120, s-maxage=300');
}

/** Para el sitemap: las guías vivas o por empezar. */
export const guiasParaSitemap = () => rpcAll('public_guides', {}).catch(() => []);
