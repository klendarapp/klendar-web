// Piezas comunes de las páginas públicas (/o/, /b/, /agenda/).
//
// La idea: que una oferta, un negocio o la agenda de una ciudad se puedan
// leer enteros en el navegador, sin app y sin cuenta. Canjear sigue siendo
// cosa de la app (el QR es de un solo uso y lo valida el negocio), pero lo
// que hay, cuándo y dónde se lee aquí. Eso es lo que Google indexa y lo que
// se le puede enseñar a un ayuntamiento o a un bar que aún no se fía.

import { esc } from './page.js';

export const BASE = 'https://klendar.app';

export const money = (cents, currency = 'EUR') =>
  cents == null ? '' : (cents / 100).toLocaleString('es-ES', { style: 'currency', currency });

/** «sábado 4 de octubre, 11:00» */
export function fmtLong(iso, lang = 'es') {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
      timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return ''; }
}

/** «mié 24 sept» */
export function fmtDay(iso, lang = 'es') {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
      timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short',
    }).format(new Date(iso));
  } catch { return ''; }
}

export function fmtTime(iso, lang = 'es') {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
      timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch { return ''; }
}

/** El beneficio en una etiqueta: «−20 %», «2x1», «12 €». */
export function benefit(d, priceCents, currency) {
  if (d) {
    if (d.type === 'percent') return `−${d.value} %`;
    if (d.type === 'fixed') return money(Math.round(Number(d.value) * 100), d.currency || currency);
    if (d.type === '2x1') return '2x1';
    if (d.type === 'free') return 'Gratis';
    if (d.type === 'other' && d.value) return String(d.value);
  }
  return priceCents == null ? '' : money(priceCents, currency);
}

/** Precio anterior tachado (obligatorio cuando se anuncia una rebaja). */
export const priorPrice = (d) =>
  d?.compare_at_cents ? money(d.compare_at_cents, d.currency || 'EUR') : '';

export const isVideo = (u) => /\.(mp4|mov|webm)(\?|$)/i.test(u || '');

/** Para la vista previa de WhatsApp o Google hace falta una imagen fija. */
export const firstPhoto = (images) => (images || []).find((u) => !isVideo(u)) || null;

/**
 * Una pieza de la galería: foto o vídeo.
 *
 * El vídeo no arranca solo (en una página que se abre desde un enlace, un
 * vídeo que suena de golpe es lo peor que te puede pasar) y usa la primera
 * foto de portada mientras no se toca.
 */
export function media(url, poster) {
  if (!isVideo(url)) return `<img src="${esc(url)}" alt="" loading="lazy">`;
  return `<video src="${esc(url)}" ${poster ? `poster="${esc(poster)}"` : ''}
    controls playsinline preload="metadata" muted></video>`;
}

/** La misma página en el otro idioma: /o/x ⇄ /en/o/x. */
export const altPath = (path, lang) =>
  lang === 'en' ? path.replace(/^\/en/, '') || '/' : `/en${path}`;

/**
 * Página pública completa: cabecera del sitio, contenido y pie sencillo.
 *
 * Sin salto automático a la app (eso hacía imposible leer nada desde el
 * móvil); el botón de abrir sigue estando, bien visible. El idioma lo manda
 * la URL, no el navegador: así se puede enlazar la versión inglesa y Google
 * indexa las dos.
 */
export function publicPage({ lang, path, title, description, head = '', body, image }) {
  const en = lang === 'en';
  const S = en
    ? { how: 'How it works', biz: 'Businesses', sup: 'Support', agenda: 'Local agenda' }
    : { how: 'Cómo funciona', biz: 'Negocios', sup: 'Soporte', agenda: 'Agenda local' };
  const og = image || `${BASE}/assets/og.png`;
  const es = en ? altPath(path, 'en') : path;
  const enPath = en ? path : altPath(path, 'es');
  return `<!doctype html>
<html lang="${en ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
<meta name="theme-color" content="#0B0F1A">
<link rel="icon" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/public.css?v=2">
${head}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/${en ? 'en/' : ''}"><img src="/assets/symbol.png" alt=""> Klendar</a>
  <nav class="main">
    <a href="${en ? '/en/agenda/' : '/agenda/'}">${S.agenda}</a>
    <a href="${en ? '/en/#how-it-works' : '/#como'}">${S.how}</a>
    <a href="${en ? '/en/business-terms/' : '/negocios/'}">${S.biz}</a>
    <a href="${en ? '/en/support/' : '/soporte/'}">${S.sup}</a>
    <span class="lang" aria-label="Idioma / Language">
      <a href="${esc(es)}" class="${en ? '' : 'on'}" hreflang="es">ES</a>
      <a href="${esc(enPath)}" class="${en ? 'on' : ''}" hreflang="en">EN</a>
    </span>
  </nav>
</div></header>
<main class="pub wrap">${body}</main>
<footer class="pub-foot"><div class="wrap">
  <p>© ${new Date().getFullYear()} Klendar · ${en
    ? '<a href="/en/privacy/">Privacy</a> · <a href="/en/terms/">Terms</a> · <a href="/en/support/">Support</a>'
    : '<a href="/privacidad/">Privacidad</a> · <a href="/terminos/">Términos</a> · <a href="/soporte/">Soporte</a>'}</p>
</div></footer>
</body></html>`;
}

/** Botón grande para abrir la publicación en la app. */
export function openInApp(path, label = 'Abrir en la app') {
  // La app entiende /o/<id>, no /en/o/<id>.
  const deep = path.replace(/^\/en/, '');
  const intent = `intent://klendar.app${deep}#Intent;scheme=https;package=app.klendar;S.browser_fallback_url=${encodeURIComponent(BASE + '/')};end`;
  return `<a class="pill accent big" id="open" data-web="${BASE}${esc(deep)}" href="${esc(intent)}">${esc(label)}</a>
<script>(function(){var a=document.getElementById('open');if(!a)return;if(!/Android/i.test(navigator.userAgent||''))a.href=a.getAttribute('data-web');})();</script>`;
}

/** Tarjeta de publicación para listados (negocio y agenda). */
export function offerCard(o, lang = 'es') {
  const en = lang === 'en';
  const img = firstPhoto(o.images);
  const when = o.kind === 'future_event'
    ? fmtLong(o.event_at || o.starts_at, lang)
    : `${fmtDay(o.redeem_start_at || o.starts_at, lang)} · ${fmtTime(o.redeem_start_at || o.starts_at, lang)}–${fmtTime(o.redeem_end_at, lang)}`;
  const tag = benefit(o.discount, o.price_cents, o.currency);
  const prior = priorPrice(o.discount);
  return `<a class="ocard" href="${en ? '/en' : ''}/o/${esc(o.id)}">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
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
