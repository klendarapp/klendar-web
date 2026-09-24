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

/** El vídeo se ve en la app; en la web se enseña la primera foto. */
export const firstPhoto = (images) =>
  (images || []).find((u) => !/\.(mp4|mov|webm)(\?|$)/i.test(u)) || null;

/**
 * Página pública completa: cabecera del sitio, contenido y pie sencillo.
 * Sin salto automático a la app (eso hacía imposible leer nada desde el
 * móvil); el botón de abrir sigue estando, bien visible.
 */
export function publicPage({ lang, path, title, description, head = '', body, image }) {
  const en = lang === 'en';
  const S = en
    ? { how: 'How it works', biz: 'Businesses', sup: 'Support', app: 'Open in the app' }
    : { how: 'Cómo funciona', biz: 'Negocios', sup: 'Soporte', app: 'Abrir en la app' };
  const og = image || `${BASE}/assets/og.png`;
  return `<!doctype html>
<html lang="${en ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Klendar</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${BASE}${esc(path)}">
<meta property="og:site_name" content="Klendar">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:url" content="${BASE}${esc(path)}">
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
<link rel="stylesheet" href="/assets/public.css?v=1">
${head}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><img src="/assets/symbol.png" alt=""> Klendar</a>
  <nav class="main">
    <a href="${en ? '/en/#how-it-works' : '/#como'}">${S.how}</a>
    <a href="${en ? '/en/business-terms/' : '/negocios/'}">${S.biz}</a>
    <a href="${en ? '/en/support/' : '/soporte/'}">${S.sup}</a>
  </nav>
</div></header>
<main class="pub wrap">${body}</main>
<footer class="pub-foot"><div class="wrap">
  <p>© ${new Date().getFullYear()} Klendar · <a href="/privacidad/">Privacidad</a> · <a href="/terminos/">Términos</a> · <a href="/soporte/">Soporte</a></p>
</div></footer>
</body></html>`;
}

/** Botón grande para abrir la publicación en la app. */
export function openInApp(path, label = 'Abrir en la app') {
  const intent = `intent://klendar.app${path}#Intent;scheme=https;package=app.klendar;S.browser_fallback_url=${encodeURIComponent(BASE + '/')};end`;
  return `<a class="pill accent big" id="open" data-web="${BASE}${esc(path)}" href="${esc(intent)}">${esc(label)}</a>
<script>(function(){var a=document.getElementById('open');if(!a)return;if(!/Android/i.test(navigator.userAgent||''))a.href=a.getAttribute('data-web');})();</script>`;
}

/** Tarjeta de publicación para listados (negocio y agenda). */
export function offerCard(o, lang = 'es') {
  const img = firstPhoto(o.images);
  const when = o.kind === 'future_event'
    ? fmtLong(o.event_at || o.starts_at, lang)
    : `${fmtDay(o.redeem_start_at || o.starts_at, lang)} · ${fmtTime(o.redeem_start_at || o.starts_at, lang)}–${fmtTime(o.redeem_end_at, lang)}`;
  const tag = benefit(o.discount, o.price_cents, o.currency);
  const prior = priorPrice(o.discount);
  return `<a class="ocard" href="/o/${esc(o.id)}">
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
