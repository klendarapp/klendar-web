// Enlaces de la ficha («Reservar», «Pedir a domicilio», «Pedir en el local»
// y uno libre con su nombre) y archivos de la carta (fotos y PDF). Lo mismo
// que la app (`lib/features/business/domain/business_links.dart`) y la base
// (migración 20261210100000: `set_business_links`, `business_links`,
// `log_business_link_tap`, `set_menu_files`).
//
// - Solo https, con la misma expresión que la base (`external_link_url_ok`).
//   Lo escrito sin https:// se completa (y http:// pasa a https://), como
//   «Escúchalo antes».
// - Servicios que se reconocen por el dominio (TheFork, Glovo…): un
//   monograma sobrio (la inicial en un cuadradito redondeado, en tinta). Sin
//   logotipos de marca.
// - Si hay dos del mismo tipo, el botón lleva el servicio o el dominio:
//   «Pedir a domicilio · Glovo».
//
// Sirve igual para el navegador (script clásico: deja `KlendarEnlaces` en
// `window`) y para las Pages Functions (`import KE from
// '../../assets/enlaces.js'`), como assets/marcas.js. En la ficha pública,
// cargado con `data-url`, `data-key` y `data-biz`, además cuenta los toques
// (`[data-toque]`) con `log_business_link_tap`, sin esperar la respuesta.
(function () {
  'use strict';
  // «Tu cuenta» y el panel, en un idioma sin tabla propia (catalán, francés…):
  // la española, pasada por el diccionario que ha cargado /assets/i18n.js.
  const klBi = (x, lang) => (lang === 'en' ? x.en : globalThis.KL_TABLA ? globalThis.KL_TABLA(x.es, lang) : x.es);
  const klLoc = (lang) => (globalThis.KL_LOCALE ? globalThis.KL_LOCALE(lang) : lang === 'en' ? 'en-GB' : 'es-ES');

  const URL_OK = /^https:\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(:[0-9]{2,5})?([/?#][^\s]*)?$/i;
  const MAX_ENLACES = 8;
  const TIPOS = ['book', 'delivery', 'order', 'other'];
  // Archivos de la carta (`menu_file_limits()` en la base).
  const MAX_ARCHIVOS = 12;
  const MAX_BYTES = 10 * 1024 * 1024;
  const MAX_TOTAL = 40 * 1024 * 1024;

  const T = {
    es: {
      book: 'Reservar', delivery: 'Pedir a domicilio', order: 'Pedir en el local', other: 'Otro (con su nombre)',
      fuera: 'Se abre fuera de Klendar', en: (a, s) => `${a} en ${s}`,
      pdf: 'Ver carta completa (PDF)', carta: 'Ver carta completa',
    },
    en: {
      book: 'Book', delivery: 'Order delivery', order: 'Order at the venue', other: 'Other (with its own name)',
      fuera: 'Opens outside Klendar', en: (a, s) => `${a} on ${s}`,
      pdf: 'See full menu (PDF)', carta: 'See full menu',
    },
  };
  const t = (lang) => klBi(T, lang);

  // Iconos de Material (los mismos que la app: event_available,
  // delivery_dining, room_service, link, picture_as_pdf, open_in_new), en SVG.
  const D = {
    book: 'M18.98 3H18V0.98H15.98V3H8.02V0.98H6V3H5.02C3.89 3 3 3.89 3 5.02V18.98C3 20.11 3.89 21 5.02 21H18.98C20.11 21 21 20.11 21 18.98V5.02C21 3.89 20.11 3 18.98 3ZM18.98 18.98H5.02V9H18.98V18.98ZM5.02 6.98V5.02H18.98V6.98H5.02ZM10.55 17.44 16.5 11.53 15.42 10.45 10.55 15.33 8.44 13.22 7.41 14.3 10.55 17.44Z',
    delivery: 'M18.98 6.98C18.98 5.91 18.09 5.02 17.02 5.02H14.02V6.98H17.02V9.66L13.5 14.02H9.98V9H6C3.8 9 2.02 10.78 2.02 12.98V15.98H3.98C3.98 17.67 5.34 18.98 6.98 18.98C8.67 18.98 9.98 17.67 9.98 15.98H14.48L18.98 10.36V6.98ZM3.98 14.02V12.98C3.98 11.91 4.92 11.02 6 11.02H8.02V14.02H3.98ZM6.98 17.02C6.47 17.02 6 16.55 6 15.98H8.02C8.02 16.55 7.55 17.02 6.98 17.02ZM5.02 6H9.98V8.02H5.02V6ZM18.98 12.98C17.34 12.98 15.98 14.34 15.98 15.98C15.98 17.67 17.34 18.98 18.98 18.98C20.67 18.98 21.98 17.67 21.98 15.98C21.98 14.34 20.67 12.98 18.98 12.98ZM18.98 17.02C18.47 17.02 18 16.55 18 15.98C18 15.47 18.47 15 18.98 15C19.55 15 20.02 15.47 20.02 15.98C20.02 16.55 19.55 17.02 18.98 17.02Z',
    order: 'M18.98 17.02H2.02V18.98H21.98V17.02H18.98ZM21 15.98C20.72 11.95 17.77 8.58 13.83 7.78C13.92 7.55 14.02 7.27 14.02 6.98C14.02 5.91 13.08 5.02 12 5.02C10.92 5.02 9.98 5.91 9.98 6.98C9.98 7.27 10.08 7.55 10.17 7.78C6.23 8.58 3.28 11.95 3 15.98H21ZM12 9.56C14.95 9.56 17.48 11.39 18.52 13.97H5.48C6.52 11.39 9.05 9.56 12 9.56Z',
    other: 'M17.02 6.98H12.98V9H17.02C18.66 9 20.02 10.36 20.02 12C20.02 13.64 18.66 15 17.02 15H12.98V17.02H17.02C19.78 17.02 21.98 14.77 21.98 12C21.98 9.23 19.78 6.98 17.02 6.98ZM11.02 15H6.98C5.34 15 3.98 13.64 3.98 12C3.98 10.36 5.34 9 6.98 9H11.02V6.98H6.98C4.22 6.98 2.02 9.23 2.02 12C2.02 14.77 4.22 17.02 6.98 17.02H11.02V15ZM8.02 11.02H15.98V12.98H8.02V11.02Z',
    pdf: 'M20.02 2.02H8.02C6.89 2.02 6 2.91 6 3.98V15.98C6 17.11 6.89 18 8.02 18H20.02C21.09 18 21.98 17.11 21.98 15.98V3.98C21.98 2.91 21.09 2.02 20.02 2.02ZM20.02 15.98H8.02V3.98H20.02V15.98ZM3.98 6H2.02V20.02C2.02 21.09 2.91 21.98 3.98 21.98H18V20.02H3.98V6ZM15.98 12V9C15.98 8.44 15.56 8.02 15 8.02H12.98V12.98H15C15.56 12.98 15.98 12.56 15.98 12ZM14.02 9H15V12H14.02V9ZM18 11.02H18.98V9.98H18V9H18.98V8.02H17.02V12.98H18V11.02ZM9.98 11.02H11.02C11.53 11.02 12 10.55 12 9.98V9C12 8.44 11.53 8.02 11.02 8.02H9V12.98H9.98V11.02ZM9.98 9H11.02V9.98H9.98V9Z',
    fuera: 'M18.98 18.98H5.02V5.02H12V3H5.02C3.89 3 3 3.89 3 5.02V18.98C3 20.11 3.89 21 5.02 21H18.98C20.11 21 21 20.11 21 18.98V12H18.98V18.98ZM14.02 3V5.02H17.58L7.78 14.81L9.19 16.22L18.98 6.42V9.98H21V3H14.02Z',
  };

  // Servicios que se reconocen: [nombre, marcas del dominio]. La misma lista
  // que `LinkService` en la app.
  const SERVICIOS = [
    ['TheFork', ['thefork', 'eltenedor']], ['CoverManager', ['covermanager']], ['Booksy', ['booksy']],
    ['Treatwell', ['treatwell']], ['Fresha', ['fresha']], ['OpenTable', ['opentable']],
    ['SevenRooms', ['sevenrooms']], ['Restoo', ['restoo']], ['Glovo', ['glovoapp']],
    ['Just Eat', ['just-eat', 'justeat']], ['Uber Eats', ['ubereats']], ['Deliveroo', ['deliveroo']],
  ];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  /** Lo escrito, arreglado: sin espacios alrededor y con https://. No dice si vale. */
  function normaliza(v) {
    let s = String(v || '').trim();
    if (!s) return '';
    if (/^http:\/\//i.test(s)) s = `https://${s.slice(7)}`;
    if (!/^https:\/\//i.test(s)) s = `https://${s}`;
    return s;
  }
  /** Lo que acepta la base (`external_link_url_ok`). */
  const urlOk = (u) => {
    const s = String(u || '');
    return s.length >= 12 && s.length <= 500 && !/\s/.test(s) && URL_OK.test(s);
  };

  /** El dominio, en minúsculas y sin «www.». */
  function host(url) {
    const m = /^https?:\/\/([^/:?#]+)/i.exec(String(url || ''));
    const h = m ? m[1].toLowerCase() : '';
    return h.startsWith('www.') ? h.slice(4) : h;
  }

  /** El servicio de un enlace ({ nombre, inicial }) o null. La «marca» es la
   * penúltima etiqueta del dominio, o la antepenúltima si la penúltima es
   * `co` o `com` (`just-eat.co.uk`). */
  function servicio(url) {
    const partes = host(url).split('.');
    if (partes.length < 2) return null;
    let marca = partes[partes.length - 2];
    if ((marca === 'co' || marca === 'com') && partes.length >= 3) marca = partes[partes.length - 3];
    const s = SERVICIOS.find(([, marcas]) => marcas.includes(marca));
    return s ? { nombre: s[0], inicial: s[0].charAt(0) } : null;
  }

  /** «Reservar», «Pedir a domicilio»…; el libre, su nombre. */
  const nombreTipo = (kind, lang) => t(lang)[kind] || '';
  const base = (l, lang) => (l.kind === 'other' ? (String(l.label || '').trim() || host(l.url)) : nombreTipo(l.kind, lang));

  /** Los textos de los botones, en orden: si hay dos del mismo tipo, con el
   * servicio o el dominio detrás («Pedir a domicilio · Glovo»). */
  function etiquetas(links, lang) {
    const n = {};
    for (const l of links) n[l.kind] = (n[l.kind] || 0) + 1;
    return links.map((l) => {
      const b = base(l, lang);
      if (l.kind === 'other' || n[l.kind] < 2) return b;
      const s = servicio(l.url);
      return `${b} · ${s ? s.nombre : host(l.url)}`;
    });
  }

  /** Para el lector de pantalla: «Reservar en TheFork. Se abre fuera de Klendar». */
  function accesible(l, etiqueta, lang) {
    const s = servicio(l.url);
    const que = s && l.kind !== 'other' ? t(lang).en(base(l, lang), s.nombre) : etiqueta;
    return `${que}. ${t(lang).fuera}`;
  }

  /** Solo los que se entienden (tipo conocido y dirección buena), en orden. */
  const limpia = (links) => (Array.isArray(links) ? links : [])
    .filter((l) => l && TIPOS.includes(l.kind) && urlOk(l.url))
    .slice(0, MAX_ENLACES);

  /** Lo que diría la base de un enlace: '' si vale o el código de error. */
  function error(l) {
    if (!TIPOS.includes(l.kind)) return 'invalid_link_kind';
    if (!urlOk(l.url)) return 'invalid_link_url';
    if (l.kind === 'other') {
      const n = String(l.label || '').trim().replace(/\s+/g, ' ').length;
      if (n < 2 || n > 30) return 'invalid_link_label';
    }
    return '';
  }

  const svg = (d, size, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
  /** El monograma de un servicio: la inicial en un cuadradito redondeado, en tinta. */
  const monograma = (s, size = 18) => `<svg class="ic monograma" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="16.6" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor" style="font-family:inherit">${esc(s.inicial)}</text></svg>`;
  /** El icono de un enlace: el del servicio si se reconoce; si no, el del tipo. */
  function icono(l, size = 18) {
    const s = servicio(l.url);
    return s ? monograma(s, size) : svg(D[l.kind] || D.other, size);
  }
  const iconoTipo = (kind, size = 18) => svg(D[kind] || D.other, size);
  const iconoPdf = (size = 22) => svg(D.pdf, size);
  const iconoFuera = (size = 18) => svg(D.fuera, size);

  /** «820 KB», «1,4 MB» (como la app). */
  function tamano(bytes, lang) {
    const b = Number(bytes) || 0;
    if (b <= 0) return '';
    if (b < 1024 * 1024) return `${Math.ceil(b / 1024)} KB`;
    const mb = (Math.round((b / (1024 * 1024)) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `${lang === 'en' ? mb : mb.replace('.', ',')} MB`;
  }

  const FUERA = 'target="_blank" rel="noopener noreferrer nofollow"';

  /** Los botones de la ficha pública: todos iguales y neutros, en el orden
   * guardado, abren fuera y cuentan el toque. */
  function botones(links, lang) {
    const buenos = limpia(links);
    if (!buenos.length) return '';
    const et = etiquetas(buenos, lang);
    return buenos.map((l, i) => `<a class="pill enlace-neg" href="${esc(l.url)}" ${FUERA} data-toque aria-label="${esc(accesible(l, et[i], lang))}">${icono(l, 18)}<span>${esc(et[i])}</span></a>`).join('');
  }

  /** Una fila de la carta que abre fuera: un PDF («Ver carta completa
   * (PDF)», su nombre y tamaño) o el «Enlace a la carta». */
  function filaCarta(url, lang, { pdf = false, nombre = '', bytes = 0 } = {}) {
    const titulo = pdf ? t(lang).pdf : t(lang).carta;
    const detalle = pdf ? [String(nombre || '').trim(), tamano(bytes, lang)].filter(Boolean).join(' · ') : host(url);
    return `<a class="carta-archivo" href="${esc(url)}" ${FUERA} data-toque aria-label="${esc(`${titulo}${detalle ? `, ${detalle}` : ''}. ${t(lang).fuera}`)}">${pdf ? iconoPdf(22) : svg(D.other, 22)}<span><b>${esc(titulo)}</b>${detalle ? `<small>${esc(detalle)}</small>` : ''}</span>${iconoFuera(18)}</a>`;
  }

  const KlendarEnlaces = {
    URL_OK, MAX_ENLACES, TIPOS, MAX_ARCHIVOS, MAX_BYTES, MAX_TOTAL, SERVICIOS,
    t, normaliza, urlOk, host, servicio, nombreTipo, etiquetas, accesible, limpia, error,
    icono, iconoTipo, iconoPdf, iconoFuera, monograma, tamano, botones, filaCarta,
  };
  globalThis.KlendarEnlaces = KlendarEnlaces;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarEnlaces;

  // ── En la ficha pública: contar los toques ────────────────────────────────
  if (typeof document === 'undefined') return;
  const yo = document.currentScript;
  const URL_SB = yo && yo.getAttribute('data-url');
  const KEY = yo && yo.getAttribute('data-key');
  const BIZ = yo && yo.getAttribute('data-biz');
  if (!URL_SB || !KEY || !/^[0-9a-f-]{36}$/i.test(BIZ || '')) return;
  const ref = (URL_SB.match(/^https:\/\/([a-z0-9]+)\./) || [])[1];
  // Con la sesión de «Tu cuenta», si la hay y no ha caducado: así el equipo
  // del negocio no cuenta (lo decide la base).
  function token() {
    try {
      const s = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) || 'null');
      if (s && s.access_token && Number(s.expires_at || 0) > Date.now() / 1000 + 30) return s.access_token;
    } catch (e) { /* sin almacenamiento */ }
    return null;
  }
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[data-toque]') : null;
    if (!a || !a.href) return;
    const tk = token();
    try {
      fetch(`${URL_SB}/rest/v1/rpc/log_business_link_tap`, {
        method: 'POST', keepalive: true,
        headers: { apikey: KEY, 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
        body: JSON.stringify({ p_business: BIZ, p_url: a.getAttribute('href') }),
      }).catch(() => {});
    } catch (x) { /* sin red: no pasa nada */ }
  }, true);
})();
