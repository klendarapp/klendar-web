// «Compartir en historias» en la web: la imagen vertical (1080 × 1920) de una
// publicación, un negocio o una colección, con su diseño (Clásica, Foto
// grande, Cartel, Color, Minimal) y su color, el logo de Klendar y un QR con
// el enlace (`?ref=stories`, para contar cuántas visitas llegan así).
//
// La imagen se pinta en el navegador, en un <canvas> (`/assets/historia.js`):
// las Pages Functions tienen 10 ms de CPU por petición en el plan gratuito y
// ninguna librería para pintar imágenes sin compilar nada (resvg/satori en
// WebAssembly pesan megas y no caben en ese tiempo a 1080 × 1920). En el
// navegador sale igual, con las mismas letras (Sora y Manrope de la web) y
// sin coste. Esta página solo reúne los datos públicos y los botones:
// «Descargar para historias», «Compartir imagen» (Web Share con el archivo,
// en el móvil) y «Copiar enlace».
//
// La misma especificación que la app: docs/DISENOS_PUBLICACION.md §7 (repo de
// la app). Solo datos públicos: nunca nada de quien comparte.
//
// Rutas: /historia/o/<id> · /historia/b/<slug|id> · /historia/c/<slug> ·
// /historia/s/<id> (un sorteo abierto) y las
// mismas en inglés en /en/story/….
//
// Una publicación abierta con el enlace de un RRPP (`/historia/o/<id>?rp=…`,
// desde su ficha con `?rp=`): el QR y «Copiar enlace» llevan el mismo
// `?rp=`, como la app (quien llegue se apunta a esa lista). Una oferta de
// RRPP sin un enlace válido no tiene página: su imagen llevaría a una ficha
// que no se abre. Con el código en la dirección, la página es privada
// (sin buscadores, sin caché compartida y sin contador).

import { esc, html, isUuid, rows, rpc, rpcAll } from './page.js';
import {
  BASE, benefit, bizPath, collectionBase, firstPhoto, isSlug, isVideo, publicPage, slugDe, zonaDe,
} from './public.js';
import { estiloDe } from './tarjeta.js';
import { notFound } from './views.js';
import KR from '../../assets/rrpp-enlace.js';
import KS from '../../assets/textos-sorteos.js';
import KZ from '../../assets/zona.js';
import { sorteoPath } from './sorteos.js';

const T = {
  es: {
    title: 'Compartir en historias',
    lead: 'Una imagen vertical de 1080 × 1920 con el diseño de la publicación y un QR que lleva aquí. Para Instagram, WhatsApp, TikTok…',
    leadB: 'Una imagen vertical de 1080 × 1920 con tu foto, tu logo y un QR que lleva a tu ficha. Para Instagram, WhatsApp, TikTok…',
    leadC: 'Una imagen vertical de 1080 × 1920 con la colección y un QR que lleva aquí. Para Instagram, WhatsApp, TikTok…',
    leadS: 'Una imagen vertical de 1080 × 1920 con el sorteo y un QR que lleva a su página. Para Instagram, WhatsApp, TikTok…',
    download: 'Descargar para historias', share: 'Compartir imagen', copy: 'Copiar enlace', copied: 'Enlace copiado',
    how: 'En Instagram: crea una historia, elige esta imagen y añade el sticker «Enlace» con el enlace copiado.',
    preparing: 'Preparando la imagen…',
    failed: 'No hemos podido preparar la imagen. Prueba otra vez en un momento.',
    noscript: 'Para preparar la imagen hace falta JavaScript.',
    back: 'Volver', preview: 'Vista previa de la imagen para historias',
    see: 'Míralo en Klendar', organisedBy: 'Organiza: {x}', today: 'Hoy', tomorrow: 'Mañana',
    collection: 'Colección', plans: (n) => (n === 1 ? '1 plan' : `${n} planes`),
    // Estado de WhatsApp: la misma imagen, con `?ref=whatsapp`.
    tabs: 'Dónde la vas a compartir', tabStories: 'Historias', tabWa: 'Estado de WhatsApp',
    titleWa: 'Estado de WhatsApp',
    leadWa: 'La misma imagen vertical de 1080 × 1920, con un QR que lleva aquí, para tu estado de WhatsApp.',
    downloadWa: 'Descargar para tu estado',
    howWa: 'En WhatsApp: «Novedades» → «Añadir estado» → elige esta imagen. Pega en el texto el enlace («Copiar enlace»).',
  },
  en: {
    title: 'Share to stories',
    lead: 'A 1080 × 1920 portrait image with the publication’s design and a QR code that brings people here. For Instagram, WhatsApp, TikTok…',
    leadB: 'A 1080 × 1920 portrait image with your photo, your logo and a QR code to your page. For Instagram, WhatsApp, TikTok…',
    leadC: 'A 1080 × 1920 portrait image with the collection and a QR code that brings people here. For Instagram, WhatsApp, TikTok…',
    leadS: 'A 1080 × 1920 portrait image with the giveaway and a QR code to its page. For Instagram, WhatsApp, TikTok…',
    download: 'Download for stories', share: 'Share image', copy: 'Copy link', copied: 'Link copied',
    how: 'On Instagram: create a story, pick this image and add the “Link” sticker with the copied link.',
    preparing: 'Preparing the image…',
    failed: 'We couldn’t prepare the image. Try again in a moment.',
    noscript: 'Preparing the image needs JavaScript.',
    back: 'Back', preview: 'Preview of the story image',
    see: 'See it on Klendar', organisedBy: 'Organised by {x}', today: 'Today', tomorrow: 'Tomorrow',
    collection: 'Collection', plans: (n) => (n === 1 ? '1 plan' : `${n} plans`),
    tabs: 'Where you’ll share it', tabStories: 'Stories', tabWa: 'WhatsApp status',
    titleWa: 'WhatsApp status',
    leadWa: 'The same 1080 × 1920 portrait image, with a QR code that brings people here, for your WhatsApp status.',
    downloadWa: 'Download for your status',
    howWa: 'In WhatsApp: “Updates” → “Add status” → pick this image. Paste the link (“Copy link”) in the text.',
  },
};

const https = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);
const venueOf = (name, address) => {
  const n = String(name || '').trim();
  if (n) return n;
  return String(address || '').split(',')[0].trim() || null;
};

export const storyPath = (lang, kind, ref) => `${lang === 'en' ? '/en/story' : '/historia'}/${kind}/${encodeURIComponent(ref)}`;

/** La página «Compartir en historias» de [kind] (`o`, `b` o `c`). Con
 * `para = 'whatsapp'`, la misma imagen para el estado de WhatsApp: su QR y su
 * enlace llevan `?ref=whatsapp` (las visitas se cuentan con las de historias,
 * con su origen) y las instrucciones son las de WhatsApp. */
export async function storyPage(kind, ref, lang, rpRaw = '', para = '') {
  const en = lang === 'en';
  const S = T[en ? 'en' : 'es'];
  const wa = para === 'whatsapp';
  const raw = String(ref || '');
  const self = storyPath(lang, kind, raw);
  let datos = null;
  let volver = '';
  let lead = S.lead;
  // `?rp=<código>` del enlace de un RRPP, si la base dice que vale.
  let rpQ = '';

  if (kind === 'o') {
    if (!isUuid(raw)) return notFound(lang, self, 'o');
    const rp = KR.codigoValido(rpRaw);
    const o = await rpc('offer_detail', { p_id: raw, p_rp: rp || null });
    // Una exclusiva bloqueada no tiene nada que enseñar.
    if (!o || !o.title || o.locked) return notFound(lang, self, 'o');
    const prom = rp && o.promoter && o.promoter.code ? o.promoter : null;
    if (o.audience === 'promoters' && !prom) return notFound(lang, self, 'o');
    if (prom) rpQ = `?rp=${encodeURIComponent(prom.code)}`;
    const { plantilla, acento } = estiloDe(o);
    const media = (o.images || []).filter(https);
    const flash = o.kind === 'flash_offer';
    datos = {
      kind: 'offer', id: o.id, template: plantilla, accent: acento || '#FF4D6D',
      title: o.title,
      business: o.business_name || '',
      venue: o.venue_address ? venueOf(o.venue_name, o.venue_address) : null,
      logo: https(o.business_logo),
      media: media[0] || null,
      fallback: firstPhoto(media) || https(o.business_cover),
      benefit: benefit(o.discount, o.price_cents, o.currency, lang) || null,
      // El cuándo se escribe en el navegador («Hoy», «Mañana»): esta página
      // va en caché y un «Hoy» de ayer sería mentira.
      start: flash ? o.redeem_start_at : o.event_at,
      end: flash ? o.redeem_end_at : null,
      tz: zonaDe(o),
      path: `/o/${o.id}`,
    };
    volver = `${en ? '/en' : ''}/o/${o.id}${rpQ}`;
  } else if (kind === 'b') {
    let id = raw;
    let slug = null;
    if (isUuid(raw)) {
      slug = await slugDe(raw);
    } else {
      if (!isSlug(raw.toLowerCase())) return notFound(lang, self, 'b');
      const r = await rpc('resolve_business_slug', { p_slug: raw.toLowerCase() });
      if (!r?.id) return notFound(lang, self, 'b');
      id = r.id;
      slug = r.slug;
    }
    const b = await rpc('business_profile', { p_id: id });
    if (!b || !b.name) return notFound(lang, self, 'b');
    let categoria = '';
    if (b.category_id && isUuid(b.category_id)) {
      try {
        const c = (await rows('categories', `select=names&id=eq.${b.category_id}`))?.[0];
        categoria = (c?.names && (c.names[en ? 'en' : 'es'] || c.names.es)) || '';
      } catch { /* sin gremio: solo la ciudad */ }
    }
    const fotos = (b.gallery || []).filter(https);
    datos = {
      kind: 'business', id: b.id, template: 'photo', accent: '#FF4D6D',
      title: b.name,
      logo: https(b.logo),
      media: https(b.cover) || firstPhoto(fotos),
      fallback: firstPhoto(fotos),
      subtitle: [categoria, b.city].filter(Boolean).join(' · '),
      rating: b.rating && b.ratings
        ? `${Number(b.rating).toLocaleString(en ? 'en-GB' : 'es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${b.ratings})`
        : null,
      path: `/b/${slug || b.id}`,
    };
    volver = bizPath(lang, slug || b.id);
    lead = S.leadB;
  } else if (kind === 'c') {
    const slug = raw.toLowerCase();
    if (!/^[a-z0-9-]{2,60}$/.test(slug)) return notFound(lang, self, 'o');
    const [cols, res] = await Promise.all([
      rpcAll('public_collections', { p_city: null }),
      rpc('public_explore', { p_city: null, p_collection: slug, p_limit: 48 }),
    ]);
    const col = (cols || []).find((c) => c.slug === slug);
    if (!col) return notFound(lang, self, 'o');
    const pick = (m) => (m && (m[en ? 'en' : 'es'] || m.es)) || '';
    const items = res?.items || [];
    const portada = items.map((i) => firstPhoto((i.images || []).filter(https))).find(Boolean) || null;
    const total = Number(res?.total ?? items.length) || 0;
    datos = {
      kind: 'collection', id: slug, template: 'poster', accent: '#FF4D6D',
      title: pick(col.title),
      eyebrow: (total ? `${S.collection} · ${S.plans(total)}` : S.collection).toUpperCase(),
      subtitle: pick(col.subtitle),
      media: https(col.cover_url) || portada,
      fallback: portada,
      path: `/coleccion/${slug}`,
    };
    volver = `${collectionBase(lang)}/${encodeURIComponent(slug)}/`;
    lead = S.leadC;
  } else if (kind === 's') {
    // Un sorteo abierto (tanda C): antetítulo «SORTEO», el premio, «Termina
    // el …» y el negocio; el QR, a la página del sorteo (`?ref=stories`: la
    // visita cuenta para el negocio).
    if (!isUuid(raw)) return notFound(lang, self, 'o');
    const g = await rpc('giveaway_detail', { p_id: raw });
    if (!g || !g.id || g.status !== 'active' || KS.terminado(g)) return notFound(lang, self, 'o');
    const bz = g.business || {};
    const tz = KZ.zona(bz.time_zone || KZ.porCoordenadas(bz.lat, bz.lng) || KZ.MADRID);
    datos = {
      kind: 'giveaway', id: g.id, template: 'poster', accent: '#FFFFFF',
      title: g.prize,
      eyebrow: KS.t(lang).eyebrow,
      subtitle: KS.t(lang).endsOn(KS.cuando(g.ends_at, lang, tz)),
      business: bz.name || '',
      logo: https(bz.logo_url),
      media: https(bz.cover_image_url),
      fallback: null,
      path: sorteoPath(lang, g.id),
    };
    volver = sorteoPath(lang, g.id);
    lead = S.leadS;
  } else {
    return notFound(lang, self, 'o');
  }

  // El enlace del QR: siempre klendar.app (también en local), con el origen.
  datos.link = `${BASE}${datos.path}${rpQ ? `${rpQ}&` : '?'}ref=${wa ? 'whatsapp' : 'stories'}`;
  datos.display = `${new URL(BASE).host}${datos.path}`;
  datos.lang = en ? 'en' : 'es';
  datos.t = {
    see: S.see, organisedBy: S.organisedBy, today: S.today, tomorrow: S.tomorrow,
    preparing: S.preparing, failed: S.failed, copied: S.copied, preview: S.preview,
  };
  if (datos.media && isVideo(datos.media) && !datos.fallback) datos.fallback = null;
  const archivo = `klendar-${datos.kind}-${String(datos.id).replace(/[^A-Za-z0-9-]/g, '').slice(0, 40)}.png`;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${esc(volver)}">${esc(datos.title)}</a></p>
  <h1>${esc(wa ? S.titleWa : S.title)}</h1>
  <nav class="historia-para" aria-label="${esc(S.tabs)}">
    <a href="${esc(self + (rpQ || ''))}"${wa ? '' : ' aria-current="page"'}>${esc(S.tabStories)}</a>
    <a href="${esc(self + (rpQ ? `${rpQ}&` : '?') + 'para=whatsapp')}"${wa ? ' aria-current="page"' : ''}>${esc(S.tabWa)}</a>
  </nav>
  <p class="muted historia-lead">${esc(wa ? S.leadWa : lead)}</p>
  <div class="historia">
    <figure class="historia-lienzo">
      <canvas id="historia" width="1080" height="1920" role="img" aria-label="${esc(`${S.preview}: ${datos.title}`)}"></canvas>
      <p class="historia-estado" id="historia-estado" role="status">${esc(S.preparing)}</p>
      <noscript><p class="historia-estado">${esc(S.noscript)}</p></noscript>
    </figure>
    <div class="historia-acciones">
      <button type="button" class="pill accent big" id="historia-compartir" hidden disabled>${esc(S.share)}</button>
      <a class="pill accent big" id="historia-descargar" download="${esc(archivo)}" href="#" aria-disabled="true">${esc(wa ? S.downloadWa : S.download)}</a>
      <button type="button" class="pill" id="historia-copiar">${esc(S.copy)}</button>
      <p class="note">${esc(wa ? S.howWa : S.how)}</p>
      <p class="note" id="historia-aviso" role="status" aria-live="polite"></p>
      <p><a href="${esc(volver)}">← ${esc(S.back)}</a></p>
    </div>
  </div>
  <script type="application/json" id="historia-datos">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>
  <script src="/assets/zona.js?v=1" defer></script>
  <script src="/assets/vendor/qrcode.js?v=1" defer></script>
  <script src="/assets/historia.js?v=2" defer></script>`;

  const estilo = `<meta name="robots" content="noindex, follow">
<style>
  .historia-lead { max-width: 640px; }
  .historia-para { display: inline-grid; grid-template-columns: auto auto; gap: 4px; padding: 4px; margin: 4px 0 6px;
    border-radius: 999px; background: var(--glass); border: 1px solid var(--glass-border); max-width: 100%; }
  .historia-para a { display: flex; align-items: center; justify-content: center; min-height: 40px; padding: 8px 16px;
    border-radius: 999px; color: var(--ink-2); font-weight: 700; text-decoration: none; text-align: center; white-space: nowrap; }
  .historia-para a[aria-current="page"] { background: var(--ink); color: var(--surface); }
  .historia { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 28px; align-items: start; margin-top: 18px; }
  .historia-lienzo { position: relative; margin: 0; border-radius: 18px; overflow: hidden; background: #171717;
    box-shadow: 0 20px 60px -30px rgba(10,10,10,.5); aspect-ratio: 9 / 16; }
  .historia-lienzo canvas { display: block; width: 100%; height: 100%; }
  .historia-estado { position: absolute; inset: auto 0 0 0; margin: 0; padding: 14px; text-align: center; color: #fff;
    background: rgba(10,10,10,.72); font-weight: 600; }
  .historia-estado:empty { display: none; }
  .historia-acciones { display: grid; gap: 10px; justify-items: start; max-width: 420px; }
  .historia-acciones .pill { justify-content: center; }
  .historia-acciones .big { min-width: 260px; }
  #historia-descargar[aria-disabled="true"] { opacity: .55; pointer-events: none; }
  @media (max-width: 720px) {
    .historia { grid-template-columns: 1fr; }
    /* La imagen entera a la vista y los botones justo debajo. */
    .historia-lienzo { width: min(100%, 360px, calc(58svh * 9 / 16)); justify-self: center; }
    .historia-acciones { justify-items: stretch; max-width: none; }
    .historia-acciones .big { min-width: 0; }
  }
</style>`;

  if (rpQ) {
    const res = html(publicPage({
      lang,
      path: self,
      title: `${wa ? S.titleWa : S.title} · ${datos.title}`,
      description: wa ? S.leadWa : lead,
      head: estilo.replace('content="noindex, follow"', 'content="noindex, nofollow"')
        + '\n<meta name="referrer" content="no-referrer">',
      body,
      contador: false,
      privada: true,
      consulta: rpQ,
    }), 200, 'private, no-store');
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    return res;
  }
  return html(publicPage({
    lang,
    path: self,
    title: `${wa ? S.titleWa : S.title} · ${datos.title}`,
    description: wa ? S.leadWa : lead,
    head: estilo,
    body,
    contador: true,
  }), 200, 'public, max-age=60, s-maxage=300');
}
