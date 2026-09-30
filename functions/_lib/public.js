// Piezas comunes de las páginas públicas (/o/, /b/, /agenda/).
//
// La idea: que una oferta, un negocio o la agenda de una ciudad se puedan
// leer enteros en el navegador, sin app y sin cuenta. Canjear sigue siendo
// cosa de la app (el QR es de un solo uso y lo valida el negocio), pero lo
// que hay, cuándo y dónde se lee aquí. Eso es lo que Google indexa y lo que
// se le puede enseñar a un ayuntamiento o a un bar que aún no se fía.

import KZ from '../../assets/zona.js';
import { BackendDown, CONTADOR, datosDePrueba, erroresScript, esc, html, isUuid, rows } from './page.js';

import { siteFooter, siteHeader } from './chrome.js';

export const BASE = 'https://klendar.app';

export const money = (cents, currency = 'EUR', lang = 'es') =>
  cents == null
    ? ''
    : (cents / 100).toLocaleString(lang === 'en' ? 'en-IE' : 'es-ES', {
        style: 'currency',
        currency,
      });

// Cada fecha va en la hora del negocio (Canarias, una menos que la
// península). `tz` es su zona; sin ella, Madrid. Ver `assets/zona.js`.
const loc = (lang) => (lang === 'en' ? 'en-GB' : 'es-ES');

/** La zona de una fila (negocio o publicación): la que traiga o la de sus
 *  coordenadas. */
export const zonaDe = (fila) => KZ.de(fila);

/** «sábado 4 de octubre, 11:00» */
export const fmtLong = (iso, lang = 'es', tz) => KZ.fmt(iso, tz, loc(lang), {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
});

/** «mié 24 sept» */
export const fmtDay = (iso, lang = 'es', tz) => KZ.fmt(iso, tz, loc(lang), {
  weekday: 'short', day: 'numeric', month: 'short',
});

export const fmtTime = (iso, lang = 'es', tz) => KZ.fmt(iso, tz, loc(lang), {
  hour: '2-digit', minute: '2-digit',
});

/** ¿Mismo día en la zona del negocio? */
export const sameDay = (a, b, tz) => !!a && !!b && KZ.dia(a, tz) === KZ.dia(b, tz);

/** El final de una franja: solo la hora si acaba el mismo día; si no, con el
 *  día delante («dom 27 sept 10:57»). Como `Formatters.timeRange` en la app. */
export function fmtEnd(startIso, endIso, lang = 'es', tz) {
  if (!endIso) return '';
  return sameDay(startIso, endIso, tz)
    ? fmtTime(endIso, lang, tz)
    : `${fmtDay(endIso, lang, tz)} ${fmtTime(endIso, lang, tz)}`;
}

/** La zona y la dirección (`slug`) de cada negocio de una lista que no las
 *  trae (la agenda de una ciudad, una publicación): `businesses` se puede
 *  leer sin cuenta. Si no contesta, la página sale igual, con la hora de
 *  Madrid y los enlaces por id (que llevan a la misma ficha). */
export async function datosDeNegocios(ids) {
  const unicos = [...new Set((ids || []).filter(isUuid))].slice(0, 100);
  const zonas = new Map();
  const slugs = new Map();
  if (!unicos.length) return { zonas, slugs };
  try {
    const filas = await rows('businesses', `select=id,time_zone,slug&id=in.(${unicos.join(',')})`);
    for (const f of filas) {
      if (KZ.valida(f.time_zone)) zonas.set(f.id, f.time_zone);
      if (isSlug(f.slug)) slugs.set(f.id, f.slug);
    }
  } catch { /* sin datos: Madrid y enlaces por id */ }
  return { zonas, slugs };
}

export const zonasDeNegocios = async (ids) => (await datosDeNegocios(ids)).zonas;

/** La dirección con nombre de un negocio (`cafe-central-madrid`), o null. */
export const slugDe = async (id) => (await datosDeNegocios([id])).slugs.get(id) || null;

/** Una dirección de negocio bien formada: minúsculas, números y guiones. */
export const isSlug = (s) => typeof s === 'string' && s.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

/** La ficha de un negocio: /b/cafe-central-madrid (o /b/<id> si aún no se
 *  sabe su dirección; la web la manda a la buena con un 301). */
export const bizPath = (lang, slugOrId) => `${lang === 'en' ? '/en' : ''}/b/${encodeURIComponent(slugOrId || '')}`;

/** Datos estructurados listos para el <head>. */
export const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/** Migas para Google: [[nombre, ruta], …] → BreadcrumbList. */
export const breadcrumbLd = (migas) => ({
  '@type': 'BreadcrumbList',
  itemListElement: migas.map(([name, path], i) => ({
    '@type': 'ListItem', position: i + 1, name, item: `${BASE}${path}`,
  })),
});

/** Una página de listado (agenda, hoy, categoría) como la entiende Google:
 *  la página, su lista y sus migas, en un solo bloque. */
export const listingLd = ({ lang, path, name, description, city, items, migas }) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage', '@id': `${BASE}${path}`, url: `${BASE}${path}`, name, description,
      inLanguage: lang === 'en' ? 'en' : 'es',
      isPartOf: { '@type': 'WebSite', name: 'Klendar', url: `${BASE}/` },
      about: city ? { '@type': 'City', name: city } : undefined,
      mainEntity: items.length
        ? {
            '@type': 'ItemList', numberOfItems: items.length,
            itemListElement: items.slice(0, 30).map((o, i) => ({
              '@type': 'ListItem', position: i + 1, url: `${BASE}${lang === 'en' ? '/en' : ''}/o/${o.id}`, name: o.title,
            })),
          }
        : undefined,
    },
    breadcrumbLd(migas),
  ],
});

/** Una ciudad en la URL: /agenda/madrid/, /hoy/santa%20cruz%20de%20tenerife/. */
export const citySeg = (c) => encodeURIComponent(String(c || '').toLowerCase());

/** Un trozo de la dirección, decodificado; `null` si viene mal codificado
 * (`/agenda/%E0%A4%A/`): `decodeURIComponent` lanza y la página daba 500. */
export function decodeSeg(s) {
  try { return decodeURIComponent(s || ''); } catch { return null; }
}

/** El beneficio en una etiqueta: «−20 %», «2x1», «12 €». */
export function benefit(d, priceCents, currency, lang = 'es') {
  if (d) {
    if (d.type === 'percent') return `−${d.value} %`;
    if (d.type === 'fixed') {
      return money(Math.round(Number(d.value) * 100), d.currency || currency, lang);
    }
    if (d.type === '2x1') return '2x1';
    if (d.type === 'free') return lang === 'en' ? 'Free' : 'Gratis';
    // «Segunda unidad al 50 %» lo escribe el negocio: se enseña tal cual, sin
    // traducciones inventadas.
    if (d.type === 'other' && d.value) return String(d.value);
  }
  return priceCents == null ? '' : money(priceCents, currency, lang);
}

/** Precio anterior tachado (obligatorio cuando se anuncia una rebaja). */
export const priorPrice = (d, lang = 'es') =>
  d?.compare_at_cents ? money(d.compare_at_cents, d.currency || 'EUR', lang) : '';

export const isVideo = (u) => /\.(mp4|mov|webm)(\?|$)/i.test(u || '');

/** Para la vista previa de WhatsApp o Google hace falta una imagen fija. */
export const firstPhoto = (images) => (images || []).find((u) => !isVideo(u)) || null;

/**
 * Una pieza de la galería: foto o vídeo.
 *
 * El vídeo no arranca solo (en una página que se abre desde un enlace, un
 * vídeo que suena de golpe es lo peor que te puede pasar) y usa la primera
 * foto de portada mientras no se toca. Empieza en silencio, como en la app;
 * el altavoz del reproductor le pone el sonido (y en el móvil, las teclas de
 * volumen del propio navegador).
 */
export function media(url, poster, primera = false) {
  if (!isVideo(url)) return imgGaleria(url, primera);
  // Sin foto de portada, «#t=0.1» hace que el navegador enseñe el primer
  // fotograma en vez de un rectángulo negro.
  return `<video src="${esc(url)}${poster ? '' : '#t=0.1'}" ${poster ? `poster="${esc(poster)}"` : ''}
    controls playsinline preload="metadata" muted></video>`;
}

/** Una foto de galería. La primera es lo más grande que se ve al abrir la
 *  página (el LCP): se pide ya y con prioridad. Las demás, al acercarse. El
 *  tamaño lo pone el CSS (aspect-ratio), así que no mueve nada al cargar. */
export const imgGaleria = (url, primera = false) => (primera
  ? `<img src="${esc(url)}" alt="" fetchpriority="high">`
  : `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">`);

/** Dónde vive la cartelera en cada idioma. En inglés «agenda» es el orden
 * del día de una reunión, no lo que hay esta semana en la ciudad. */
export const agendaBase = (lang) => (lang === 'en' ? '/en/whats-on' : '/agenda');

/** «Qué hacer hoy en <ciudad>»: /hoy/madrid/ y /en/today/madrid/. */
export const todayBase = (lang) => (lang === 'en' ? '/en/today' : '/hoy');

/**
 * Los enlaces entre las páginas de entrada de una ciudad: hoy, la semana y
 * cada categoría con algo publicado. Van en las tres, para que quien llega
 * de Google a una encuentre las otras (y Google también). `actual` marca la
 * que se está viendo: 'hoy', 'semana' o el slug de la categoría.
 */
export function cityLinks(lang, rawCity, city, cats, actual) {
  const en = lang === 'en';
  const c = citySeg(rawCity);
  const nombre = (k) => (en ? k?.names?.en : k?.names?.es) || k?.slug || '';
  const chip = (href, label, on) => `<a class="chip${on ? ' on' : ''}" href="${esc(href)}"${on ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  return `<nav class="filters" aria-label="${esc(city)}"><div class="frow">
    ${chip(`${todayBase(lang)}/${c}/`, en ? `Today in ${city}` : `Hoy en ${city}`, actual === 'hoy')}
    ${chip(`${agendaBase(lang)}/${c}/`, en ? 'This week' : 'Esta semana', actual === 'semana')}
    ${(cats || []).filter((k) => k?.slug).map((k) => chip(`${agendaBase(lang)}/${c}/${encodeURIComponent(k.slug)}/`, nombre(k), actual === k.slug)).join('')}
  </div></nav>`;
}

/** Donde vive cada seccion en cada idioma. */
export const exploreBase = (lang) => (lang === 'en' ? '/en/explore' : '/explorar');
export const collectionBase = (lang) => (lang === 'en' ? '/en/collection' : '/coleccion');

/** La misma página en el otro idioma: /o/x ⇄ /en/o/x, /agenda/x ⇄ /en/whats-on/x,
 * /hoy/x ⇄ /en/today/x. */
export const altPath = (path, lang) =>
  lang === 'en'
    ? (path
        .replace(/^\/en\/whats-on/, '/agenda')
        .replace(/^\/en\/today/, '/hoy')
        .replace(/^\/en\/explore/, '/explorar')
        .replace(/^\/en\/collection/, '/coleccion')
        .replace(/^\/en\/friend\//, '/amigo/')
        .replace(/^\/en/, '') || '/')
    : `/en${path
        .replace(/^\/agenda/, '/whats-on')
        .replace(/^\/hoy/, '/today')
        .replace(/^\/explorar/, '/explore')
        .replace(/^\/coleccion/, '/collection')
        .replace(/^\/amigo\//, '/friend/')}`;

/**
 * Página pública completa: cabecera del sitio, contenido y pie sencillo.
 *
 * Sin salto automático a la app (eso hacía imposible leer nada desde el
 * móvil); el botón de abrir sigue estando, bien visible. El idioma lo manda
 * la URL, no el navegador: así se puede enlazar la versión inglesa y Google
 * indexa las dos.
 */
// `contador: false` en las páginas cuya dirección lleva un código personal
// (baja de correos, enlace de amigo): así ese código no llega a Cloudflare Web
// Analytics, que apunta la ruta de cada visita.
export function publicPage({ lang, path, title, description, head = '', body, image, contador = true }) {
  const en = lang === 'en';
  const S = en
    ? { how: 'How it works', biz: 'Businesses', sup: 'Support', agenda: "What's on", exp: 'Explore' }
    : { how: 'Cómo funciona', biz: 'Negocios', sup: 'Soporte', agenda: 'Agenda local', exp: 'Explorar' };
  const og = image || `${BASE}/assets/og.png`;
  // Con los datos de prueba de dev, ninguna página con datos se indexa (y
  // se quita el «index, follow» que traiga, para no mandar dos órdenes).
  const cabeza = datosDePrueba()
    ? `<meta name="robots" content="noindex, follow">\n${head.replace(/<meta name="robots"[^>]*>\s*/g, '')}`
    : head;
  const es = en ? altPath(path, 'en') : path;
  const enPath = en ? path : altPath(path, 'es');
  // La foto grande de la página (la de la vista previa) suele ser lo que más
  // tarda en pintarse: se abre ya la conexión con su servidor.
  let origen = '';
  try { origen = image ? new URL(image).origin : ''; } catch { /* sin foto */ }
  const preconectar = origen && origen !== BASE ? `<link rel="preconnect" href="${esc(origen)}">
` : '';
  // «Planes con amigos»: con sesión, qué amigos van a cada publicación de la
  // página y, en una ficha, «Vas» y las invitaciones. Solo carga Supabase si
  // hay una sesión guardada (ver /assets/amigos.js). También pone en activo
  // «Añadir a favoritos» y «Guardar en Planes» si ya lo tienes.
  // `data-autor`: reseñas, que se esconden si quien mira ha bloqueado a quien
  // las escribió.
  const conAmigos = /\sdata-(o|fav|plan|autor)="|id="amigos-ficha"/.test(body);
  return `<!doctype html>
<html lang="${en ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${erroresScript()}
<title>${esc(title)} · Klendar</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${BASE}${esc(path)}">
<link rel="alternate" hreflang="es" href="${BASE}${esc(es)}">
<link rel="alternate" hreflang="en" href="${BASE}${esc(enPath)}">
<link rel="alternate" hreflang="x-default" href="${BASE}${esc(es)}">
<meta property="og:site_name" content="Klendar">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:url" content="${BASE}${esc(path)}">
<meta property="og:locale" content="${en ? 'en_GB' : 'es_ES'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(og)}">
<meta name="theme-color" content="#0A0A0A">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96.png"><link rel="manifest" href="/site.webmanifest">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
${preconectar}<link rel="preload" href="/assets/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/sora-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css?v=20261009">
<link rel="stylesheet" href="/assets/public.css?v=24">
${cabeza}
</head>
<body>
${siteHeader(lang, esc(es), esc(enPath))}
<main class="pub wrap" id="contenido">${body}</main>
${siteFooter(lang)}
${conAmigos ? `<script src="/assets/amigos.js?v=6" defer data-lang="${en ? 'en' : 'es'}"></script>
` : ''}${/class="detail"/.test(body) ? `<script src="/assets/barra.js?v=2" defer></script>
` : ''}${contador ? CONTADOR : ''}
</body></html>`;
}

/** Botón grande para abrir la publicación en la app. */
export function openInApp(path, label = 'Abrir en la app', cls = 'pill accent big') {
  // La app entiende /o/<id>, no /en/o/<id>.
  const deep = path.replace(/^\/en/, '');
  const intent = `intent://klendar.app${deep}#Intent;scheme=https;package=app.klendar;S.browser_fallback_url=${encodeURIComponent(BASE + '/')};end`;
  return `<a class="${cls}" id="open" data-web="${BASE}${esc(deep)}" href="${esc(intent)}">${esc(label)}</a>
<script>(function(){var a=document.getElementById('open');if(!a)return;if(!/Android/i.test(navigator.userAgent||''))a.remove();})();</script>`;
}

/** Tarjeta de publicación para listados (negocio y agenda). `tz` es la zona
 *  de su negocio; si no se da, la de sus coordenadas. */
export function offerCard(o, lang = 'es', tz = KZ.de(o)) {
  const en = lang === 'en';
  const img = firstPhoto(o.images);
  const ini = o.redeem_start_at || o.starts_at;
  // El mismo formato corto para eventos y ofertas: «jue, 1 oct · 20:00».
  const when = o.kind === 'future_event'
    ? `${fmtDay(o.event_at || o.starts_at, lang, tz)} · ${fmtTime(o.event_at || o.starts_at, lang, tz)}`
    : `${fmtDay(ini, lang, tz)} · ${fmtTime(ini, lang, tz)} – ${fmtEnd(ini, o.redeem_end_at, lang, tz)}`;
  const tag = benefit(o.discount, o.price_cents, o.currency, lang);
  const prior = priorPrice(o.discount, lang);
  // `data-o`: /assets/amigos.js le añade qué amigos van (con sesión).
  return `<a class="ocard" href="${en ? '/en' : ''}/o/${esc(o.id)}" data-o="${esc(o.id)}">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" width="96" height="78">` : '<span class="ph">✦</span>'}
    <span class="ocard-body">
      <b>${esc(o.title)}</b>
      <span class="muted">${esc(o.business_name || '')}${o.address ? ` · ${esc(o.address)}` : ''}</span>
      <span class="ocard-meta">
        ${tag ? `<span class="tag">${esc(tag)}</span>` : ''}
        ${prior ? `<s class="muted">${esc(prior)}</s>` : ''}
        <span class="muted">${esc(when)}</span>
      </span>
    </span>
  </a>`;
}

/** Cuando el servidor no contesta: decirlo claro y no mentir con un 404.
 *
 * Va con 503 y `Retry-After` para que los buscadores vuelvan luego en vez de
 * quedarse con una página vacía, y con `noindex` por si acaso.
 */
export function serviceDown(lang, path) {
  const en = lang === 'en';
  const S = en
    ? {
        title: "We couldn't load this",
        body: "It's not your fault: something on our side isn't responding right now. "
          + 'Try again in a minute.',
        again: 'Try again',
        home: 'Go to Klendar',
      }
    : {
        title: 'No hemos podido cargar esto',
        body: 'No es culpa tuya: algo de lo nuestro no está respondiendo ahora mismo. '
          + 'Prueba otra vez en un minuto.',
        again: 'Probar otra vez',
        home: 'Ir a Klendar',
      };
  return publicPage({
    lang,
    path,
    title: S.title,
    description: S.body,
    head: '<meta name="robots" content="noindex">',
    body: `
  <h1>${esc(S.title)}</h1>
  <p class="muted" style="max-width:560px">${esc(S.body)}</p>
  <p><a class="pill accent" href="${esc(path)}">${esc(S.again)}</a>
     <a class="pill" href="/${en ? 'en/' : ''}">${esc(S.home)}</a></p>`,
  });
}

/** Envuelve una página pública: si el servidor no contesta, se dice.
 *
 * Va con 503 y `Retry-After` para que un buscador vuelva luego en vez de
 * quedarse con una página vacía, y con `noindex` por si acaso.
 */
export async function guard(lang, path, trabajo) {
  try {
    return await trabajo();
  } catch (e) {
    if (!(e instanceof BackendDown)) throw e;
    console.error('backend caído:', e.message);
    return html(serviceDown(lang, path), 503, 'no-store');
  }
}
