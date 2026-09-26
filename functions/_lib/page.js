// Página de enlace compartido (/o/<id>, /b/<id>) con Open Graph dinámico.
// Se ejecuta en Cloudflare Pages Functions; lee la ficha pública de Supabase
// (clave publishable, la misma que lleva la app) y devuelve la misma página
// que 404.html pero con título, descripción e imagen del contenido, para que
// WhatsApp, Telegram, X, etc. muestren una vista previa útil.

// A qué Supabase apuntamos. Lo mandan las variables de Cloudflare Pages
// (SUPABASE_URL / SUPABASE_KEY) y, si no están, se usa dev, que es lo que hay
// hoy. Igual que `/config.js` para el panel: un solo sitio que cambiar.
let CFG = {
  url: 'https://dpbbtgwxrlqlplbrtjuq.supabase.co',
  key: 'sb_publishable_gNwxFIJGW_o_lGhv3si6IQ_35xHCq30',
};

/** Dirección y clave pública de Supabase (para lo que se llama desde el navegador). */
export const supabasePublic = () => ({ ...CFG });

/** Cada petición pasa por aquí antes de tocar la base. */
export function configure(env) {
  if (env?.SUPABASE_URL && env?.SUPABASE_KEY) {
    CFG = { url: env.SUPABASE_URL, key: env.SUPABASE_KEY };
  }
}
const BASE = 'https://klendar.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const isUuid = (s) => UUID.test(s || '');

/** El servidor no ha contestado (caído, sin red, 500). No es que no exista. */
export class BackendDown extends Error {}

export async function rpc(fn, args) {
  let r;
  try {
    r = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch (e) {
    throw new BackendDown(`${fn}: ${e.message}`);
  }
  if (!r.ok) throw new BackendDown(`${fn}: ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data[0] || null : data;
}

/** Igual que `rpc`, pero para funciones que devuelven una lista. */
export async function rpcAll(fn, args) {
  let r;
  try {
    r = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: CFG.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch (e) {
    throw new BackendDown(`${fn}: ${e.message}`);
  }
  if (!r.ok) throw new BackendDown(`${fn}: ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

/** Lee filas de una tabla pública (con su RLS de lectura) por REST.
 * `query` va tal cual detrás del `?`: `select=...&business_id=eq.X`. */
export async function rows(table, query) {
  let r;
  try {
    r = await fetch(`${CFG.url}/rest/v1/${table}?${query}`, {
      headers: { apikey: CFG.key },
    });
  } catch (e) {
    throw new BackendDown(`${table}: ${e.message}`);
  }
  if (!r.ok) throw new BackendDown(`${table}: ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export function fmtWhen(iso, lang) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch { return ''; }
}

export function discountLabel(d) {
  if (!d) return '';
  if (d.type === 'percent') return `−${d.value} %`;
  if (d.type === 'amount') return `−${(d.value / 100).toFixed(2)} €`;
  if (d.type === 'fixed_price') return `${(d.value / 100).toFixed(2)} €`;
  if (d.type === 'two_for_one') return '2×1';
  return d.label || '';
}

export function render({ lang, path, kind, title, description, image, ogTitle, ogDescription, jsonLd, notFound = false }) {
  const en = lang === 'en';
  const S = en
    ? { open: 'Open in the app', gp: 'Google Play · coming soon', as: 'App Store · coming soon', home: 'Go to klendar.app', d: 'If you have the app installed it will open on its own. If not, download it and open the link again.', nf: 'Page not found', inv: 'This link is not valid.', how: 'How it works', biz: 'Businesses', sup: 'Support' }
    : { open: 'Abrir en la app', gp: 'Google Play · próximamente', as: 'App Store · próximamente', home: 'Ir a klendar.app', d: 'Si tienes la app instalada, se abrirá sola. Si no, descárgala y vuelve a abrir el enlace.', nf: 'Página no encontrada', inv: 'El enlace no es válido.', how: 'Cómo funciona', biz: 'Negocios', sup: 'Soporte' };
  const t = notFound ? S.nf : title;
  const desc = notFound ? S.inv : (description || S.d);
  const og = image || `${BASE}/assets/og.png`;
  const intent = `intent://klendar.app${path}#Intent;scheme=https;package=app.klendar;S.browser_fallback_url=${encodeURIComponent(BASE + '/')};end`;
  const head = [
    `<title>${esc(ogTitle || t)} · Klendar</title>`,
    `<meta name="description" content="${esc(ogDescription || desc)}">`,
    `<meta name="robots" content="${notFound ? 'noindex' : 'index, follow'}">`,
    `<link rel="canonical" href="${BASE}${esc(path)}">`,
    '<meta property="og:site_name" content="Klendar">',
    `<meta property="og:type" content="${kind === 'b' ? 'business.business' : 'website'}">`,
    `<meta property="og:title" content="${esc(ogTitle || t)}">`,
    `<meta property="og:description" content="${esc(ogDescription || desc)}">`,
    `<meta property="og:image" content="${esc(og)}">`,
    `<meta property="og:url" content="${BASE}${esc(path)}">`,
    `<meta property="og:locale" content="${en ? 'en_GB' : 'es_ES'}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(ogTitle || t)}">`,
    `<meta name="twitter:description" content="${esc(ogDescription || desc)}">`,
    `<meta name="twitter:image" content="${esc(og)}">`,
    jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ].join('\n');
  const hero = image && !notFound ? `<img class="hero-img" src="${esc(image)}" alt="">` : '<img class="logo" src="/assets/symbol.png" alt="Klendar">';
  const open = notFound ? '' : `<a id="open" class="pill accent" href="${esc(intent)}" data-web="${BASE}${esc(path)}">${S.open}</a>`;
  return `<!doctype html>
<html lang="${en ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<meta name="theme-color" content="#0A0A0A">
<link rel="icon" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css?v=20261003">
<style>.open .card{max-width:460px}.open .hero-img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;margin-bottom:14px}.open .meta{color:var(--ink-2);font-size:14px;margin:0 0 12px}</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><img src="/assets/symbol.png" alt=""> Klendar</a>
  <nav class="main"><a href="${en ? '/en/#how-it-works' : '/#como'}">${S.how}</a><a href="${en ? '/en/business-terms/' : '/negocios/'}">${S.biz}</a><a href="${en ? '/en/support/' : '/soporte/'}">${S.sup}</a></nav>
</div></header>
<div class="open"><div class="card">
  ${hero}
  <h1>${esc(t)}</h1>
  <p class="meta">${esc(desc)}</p>
  ${open}
  <a class="pill" href="#" aria-disabled="true">${S.gp}</a>
  <a class="pill" href="#" aria-disabled="true">${S.as}</a>
  <p style="margin-top:16px;font-size:13px"><a href="/">${S.home}</a></p>
</div></div>
<script>
(function () {
  var a = document.getElementById('open'); if (!a) return;
  var ua = navigator.userAgent || '';
  if (!/Android/i.test(ua)) a.href = a.getAttribute('data-web');
  setTimeout(function () { if (/Android|iPhone|iPad/i.test(ua)) location.href = a.href; }, 400);
})();
</script>
</body></html>`;
}

export function pickLang(request) {
  const al = request.headers.get('accept-language') || '';
  return /^en/i.test(al) ? 'en' : 'es';
}

export const html = (body, status = 200, cache = 'public, max-age=60, s-maxage=300') =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache, 'x-robots-tag': status === 404 ? 'noindex' : 'all' } });
