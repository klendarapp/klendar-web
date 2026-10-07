/* Panel del negocio de Klendar (web).
   Lo mismo que hace la app, pero desde el ordenador: publicar, ver cómo va,
   validar códigos en la puerta y llevar el equipo. Todo pasa por las mismas
   RPC y políticas RLS que la app; la clave de aquí es pública por diseño. */
'use strict';

// El proyecto al que apuntamos viene de `config.js` (un solo sitio para
// cambiar dev por producción). Si faltara, no se inventa nada: se avisa.
const ENV = globalThis.KLENDAR_ENV || {};
const SUPABASE_URL = ENV.url;
const SUPABASE_KEY = ENV.key;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  document.body.innerHTML = '<p style="padding:24px">Falta la configuración '
    + '(<code>/config.js</code>). Avisa a soporte.</p>';
  throw new Error('sin configuración');
}
const APP_URL = 'https://klendar.app';
const BUCKET = 'business-images';
// PKCE y los enlaces de los correos (el de confirmar el alta de negocio
// vuelve aquí): /assets/acceso.js.
const sb = window.KL_SUPABASE();

// ── Utilidades ──────────────────────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Iconos de Material Symbols, como en «Tu cuenta» y en la app (no emojis).
const ms = (name) => `<span class="ms" aria-hidden="true">${name}</span>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOC = () => (I18N.lang === 'en' ? 'en-GB' : 'es-ES');
// Publicar, el plan y la ficha son de propietarios y encargados; el personal
// valida códigos. La base lo hace cumplir igual: esto solo evita botones que
// no van a funcionar.
/** Segundos que dura un vídeo elegido (0 si el navegador no lo sabe leer). */
const duracion = (file) => new Promise((ok) => {
  const v = document.createElement('video');
  const url = URL.createObjectURL(file);
  v.preload = 'metadata';
  v.onloadedmetadata = () => { URL.revokeObjectURL(url); ok(v.duration || 0); };
  v.onerror = () => { URL.revokeObjectURL(url); ok(0); };
  v.src = url;
});

// Las publicaciones guardan fotos y vídeos en la misma lista.
const esVideo = (u) => /\.(mp4|mov|webm)(\?|$)/i.test(u || '');
const primeraFoto = (lista) => (lista || []).find((u) => !esVideo(u)) || null;

const gestiona = () => ['owner', 'manager'].includes(BIZ?.role);
const pausado = () => !!BIZ?.paused_until && new Date(BIZ.paused_until) > new Date();
// ── La hora, la del negocio ─────────────────────────────────────────────────
// Una oferta de 18:00 es a las 18:00 del local, abra quien abra el panel (un
// encargado de viaje, un portátil con la hora de fábrica en UTC…). Canarias
// va una hora por detrás de la península: cada negocio lleva su zona
// (`businesses.time_zone`, o la de sus coordenadas; ver /assets/zona.js). Se
// enseña y se escribe en esa hora, con su cambio de horario, y a la base va
// el instante exacto. `TZ` cambia al elegir otro local (`preparaNegocio`).
const KZ = globalThis.KlendarZona;
// La tarjeta de una publicación, la misma que ve la gente en la web y en la
// app (/assets/tarjeta.js): «Tus publicaciones», el calendario y la vista
// previa del formulario la pintan con ella.
const KT = globalThis.KlendarTarjeta;
let TZ = KZ.MADRID;
/** Año, mes, día, hora y minuto que marca el reloj del negocio en ese instante. */
const partesNegocio = (d) => KZ.partes(d, TZ);
/** «Mañana» (o dentro de `dias`) en el negocio, a esa hora de allí. */
const enDiasNegocio = (dias, h, min = 0) => KZ.enDias(TZ, dias, h, min);
// Horas siempre con dos cifras («07:12»): `timeStyle: 'short'` en español da «7:12».
const fmtDate = (s) => s ? new Date(s).toLocaleString(LOC(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—';
const fmtHora = (s) => new Date(s).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', timeZone: TZ });
// El mismo idioma que las fechas y los números: «2,50 €» / «€2.50».
const fmtMoney = (c, cur = 'EUR') => (c == null ? '—' : (c / 100).toLocaleString(LOC(), { style: 'currency', currency: cur || 'EUR' }));
const fmtNum = (n) => (n ?? 0).toLocaleString(LOC());
const LABELS = {
  active: 'activa', draft: 'borrador', expired: 'terminada', sold_out: 'agotada', cancelled: 'cancelada',
  archived: 'archivada',
  pending: 'en revisión', approved: 'aprobada', rejected: 'rechazada',
  flash_offer: 'oferta flash', future_event: 'evento',
  owner: 'propietario', manager: 'encargado', staff: 'empleado',
  validated: 'dentro',
};
// El estado del negocio va en masculino y no es el de una publicación.
const BIZ_LABELS = { verified: 'verificado', pending: 'en revisión', rejected: 'rechazado' };
const tag = (v, cls) => v ? `<span class="tag ${cls || 'st-' + esc(v)}">${esc(I18N.t(LABELS[v] || v))}</span>` : '';
/** El estado que se enseña, como en la app: una activa cuyo final ya pasó
 * está «terminada» aunque el cron aún no la haya marcado. */
const finDe = (o) => (o.kind === 'flash_offer' ? o.redeem_end_at : (o.event_end_at || o.event_at));
const estadoVisible = (o) => (o.status === 'active' && finDe(o) && new Date(finDe(o)) < new Date() ? 'expired' : o.status);
const toast = (msg, bad = false) => {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = I18N.t(msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3500);
};
const ERRORS = {
  invalid_name: 'Pon el nombre del negocio (dos letras como mínimo).',
  invalid_location: 'Marca en el mapa dónde está el local.',
  not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
  user_not_found: 'No hay ninguna cuenta con ese correo.',
  owner_untouchable: 'Al propietario no se le cambia el rol desde aquí.',
  not_a_member: 'Esa persona ya no está en el equipo.',
  invalid_role: 'Ese rol no existe.',
  plan_limit_reached: 'Has llegado al máximo de publicaciones activas de tu plan. Espera a que termine alguna o escríbenos.',
  prior_price_required: 'Pon el precio anterior: la ley obliga a enseñarlo junto al descuento.',
  prior_price_not_lower: 'El precio anterior tiene que ser mayor que el de ahora.',
  alcohol_declaration_required: 'Di si el 2x1 incluye bebidas alcohólicas.',
  already_copied: 'Esa publicación ya estaba copiada en ese local.',
  no_targets: 'No has marcado ningún local.',
  too_many: 'Demasiados locales de una vez.',
  bad_goal: 'Los sellos para el premio tienen que estar entre 2 y 20.',
  bad_reward: 'Escribe qué premio se lleva la gente.',
  offer_not_found: 'Esa publicación ya no existe.',
  not_found: 'Eso ya no existe.',
  rate_limited: 'Vas muy rápido. Espera un momento y vuelve a probar.',
  no_2x1_alcohol: 'Di si el 2x1 incluye bebidas alcohólicas.',
  plan_no_boosts: 'Tu plan no incluye publicaciones destacadas.',
  invalid_email: 'Ese correo no parece válido.',
  already_member: 'Esa persona ya está en el equipo. Su papel se cambia en la lista.',
  bad_menu: 'La carta tiene algo mal escrito. Revisa los precios y los nombres.',
  too_many_sections: 'Demasiadas secciones en la carta.',
  sold_out: 'Aforo completo: ya han entrado todas las plazas.',
  code_expired: 'El código ha caducado: pide que generen otro.',
  code_cancelled: 'Reserva anulada: este código ya no vale.',
  already_validated: 'Ese código ya se usó.',
  invalid_code: 'Ese código no existe.',
  auth_required: 'Tu sesión ha caducado. Vuelve a entrar para continuar.',
  invalid_reply: 'Escribe al menos 2 caracteres.',
  offer_archived: 'Una publicación archivada no se vuelve a publicar: crea otra a partir de ella.',
  // Lugar propio (20261101100000).
  venue_too_far: 'Ese sitio está a más de 200 km de tu local: revisa la dirección.',
  venue_location_required: 'Marca el sitio en el mapa.',
  // Edad y suspensión (20261028100000).
  adult_required: 'Para esto hace falta tener 18 años y la fecha de nacimiento en el perfil.',
  min_age_16: 'Para entrar en el equipo de un negocio hace falta tener 16 años.',
  team_has_minors: 'Hay alguien en el equipo menor de 18 años (o sin fecha de nacimiento en su perfil). Quítalo del equipo antes de marcar el negocio como +18.',
  paused_by_klendar: 'Klendar ha pausado este negocio y no se puede abrir desde aquí. Si tienes dudas, escríbenos a info@klendar.app.',
  account_suspended: 'Tu cuenta está suspendida: no puedes publicar ni cambiar nada del negocio. Si crees que es un error, escribe a info@klendar.app.',
  member_suspended: 'Esa cuenta está suspendida y no puede entrar en un equipo.',
  // Lo que devuelve Storage al subir una foto.
  'Payload too large': 'Esa foto pesa demasiado. Prueba con otra más pequeña.',
  'maximum allowed size': 'Esa foto pesa demasiado. Prueba con otra más pequeña.',
  'mime type': 'Ese archivo no es una foto. Prueba con una JPG o PNG.',
};

/** El error tal y como se lo enseñamos a quien lleva el negocio.
 *
 * Los códigos conocidos tienen su frase; lo que viene de Postgres (permisos,
 * claves repetidas, columnas) no se enseña crudo: no dice nada útil y asusta.
 */
function friendly(msg) {
  const m = String(msg || '');
  if (ERRORS[m]) return ERRORS[m];
  // Los más largos primero: «too_many_sections» antes que «too_many».
  for (const codigo of Object.keys(ERRORS).sort((a, b) => b.length - a.length)) {
    if (m.includes(codigo)) return ERRORS[codigo];
  }
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) {
    return 'No hay conexión. Revisa tu internet y vuelve a probar.';
  }
  // Lo que ya viene escrito para la persona (nuestras frases, en español) se
  // enseña tal cual; lo demás (Postgres, Storage, un código sin traducir) no.
  if (Object.values(ERRORS).includes(m) || /[áéíóúñ¿¡]/i.test(m)) return m;
  return 'No se ha podido guardar. Si vuelve a pasar, escríbenos a info@klendar.app.';
}
/** El token público de Mapbox (lo da la web; vacío si no hay): sin él no
 * hay mapa ni búsqueda de direcciones y se marca el punto de otra forma. */
let MAPBOX_TOKEN = null;
async function tokenMapbox() {
  if (MAPBOX_TOKEN !== null) return MAPBOX_TOKEN;
  try {
    const r = await fetch('/api/mapbox-token');
    MAPBOX_TOKEN = r.ok ? (await r.json()).token || '' : '';
  } catch { MAPBOX_TOKEN = ''; }
  return MAPBOX_TOKEN;
}

/** Una dirección → punto, calle y ciudad (para rellenar el formulario). */
async function buscaDireccion(texto) {
  const token = await tokenMapbox();
  if (!token || !String(texto).trim()) return null;
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(texto)}.json?limit=1&country=es&language=es&types=address,poi,place&access_token=${token}`);
    if (!r.ok) return null;
    const f = (await r.json()).features?.[0];
    return f ? lugarDe(f) : null;
  } catch { return null; }
}
/** Un punto del mapa → la calle y la ciudad que hay ahí. */
async function direccionDe(lat, lng) {
  const token = await tokenMapbox();
  if (!token) return null;
  try {
    // Sin filtrar por tipo: en un pueblo o en una carretera puede no haber
    // «dirección» y aun así hay que sacar la ciudad. El primero es el más
    // concreto (calle y número si los hay); la ciudad sale de su contexto.
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?language=es&access_token=${token}`);
    if (!r.ok) return null;
    const f = (await r.json()).features?.[0];
    return f ? lugarDe(f) : null;
  } catch { return null; }
}
function lugarDe(f) {
  const ctx = f.context || [];
  const ciudad = (ctx.find((c) => String(c.id).startsWith('place.')) || (String(f.id).startsWith('place.') ? f : null))?.text || '';
  const calle = f.place_type?.includes('address') ? [f.text, f.address].filter(Boolean).join(' ') : (f.place_type?.includes('poi') ? f.properties?.address || f.text : '');
  return { lng: f.center[0], lat: f.center[1], address: calle, city: ciudad, label: f.place_name || '' };
}

// ── Diseños de publicación (docs/DISENOS_PUBLICACION.md en la app) ─────────
/** Diseños, en el orden del selector: valor y nombre. */
const PLANTILLAS = [['glass', 'Clásica'], ['photo', 'Foto grande'], ['poster', 'Cartel'], ['bold', 'A todo color'], ['minimal', 'Minimal']];
const PLANTILLA_AYUDA = {
  glass: 'La foto de fondo y todo en un panel de cristal.',
  photo: 'La foto o el vídeo mandan: los datos van pequeños, abajo.',
  poster: 'Como un cartel: el título enorme y la fecha arriba. Ideal para eventos.',
  bold: 'Un panel del color de tu marca.',
  minimal: 'Sobria: panel liso y el color solo en el precio.',
};
/** Paleta de 16 colores con texto encima que pasa AA (igual que la app). */
const PALETA = [
  ['#FF4D6D', 'Coral'], ['#E5484D', 'Rojo'], ['#FF8A3D', 'Naranja'], ['#F5B041', 'Ámbar'],
  ['#C2410C', 'Teja'], ['#34D399', 'Menta'], ['#15803D', 'Verde'], ['#0F766E', 'Verde azulado'],
  ['#0EA5E9', 'Azul cielo'], ['#2563EB', 'Azul'], ['#1E3A8A', 'Azul marino'], ['#6D28D9', 'Morado'],
  ['#E879F9', 'Orquídea'], ['#BE185D', 'Frambuesa'], ['#E7D7B8', 'Arena'], ['#111827', 'Negro'],
];
const hexDe = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
/** El color con el texto encima legible (AA): si ni la tinta ni el blanco
 * llegan a 4,5:1, se aclara u oscurece en pasos de 1/25. El de la tarjeta
 * (`/assets/tarjeta.js`): el mismo que `color_seguro` en la base y
 * `OfferStyle.safeAccent` en la app. */
const colorSeguro = (hex) => KT.colorSeguro(hex);
/** Los colores con más presencia del logo (32×32, sin grises ni blancos):
 * lo mismo que `dominantColors` en la app. Vacío si no se puede leer. */
async function coloresDelLogo(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
  const lienzo = document.createElement('canvas');
  lienzo.width = 32; lienzo.height = 32;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 32, 32);
  const px = ctx.getImageData(0, 0, 32, 32).data;
  const N = 24;
  const peso = new Array(N).fill(0); const sr = new Array(N).fill(0); const sg = new Array(N).fill(0); const sb2 = new Array(N).fill(0);
  for (let i = 0; i + 3 < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
    const max = Math.max(r, g, b) / 255; const min = Math.min(r, g, b) / 255;
    const luz = (max + min) / 2;
    const d = max - min;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * luz - 1));
    if (luz > 0.92 || luz < 0.08 || sat < 0.25) continue;
    let tono;
    const [R, G, B] = [r / 255, g / 255, b / 255];
    if (max === R) tono = 60 * (((G - B) / d) % 6);
    else if (max === G) tono = 60 * ((B - R) / d + 2);
    else tono = 60 * ((R - G) / d + 4);
    if (tono < 0) tono += 360;
    const k = Math.floor(tono / 360 * N) % N;
    peso[k] += sat; sr[k] += r * sat; sg[k] += g * sat; sb2[k] += b * sat;
  }
  const orden = [...Array(N).keys()].sort((a, b) => peso[b] - peso[a]);
  const out = []; const cajas = [];
  for (const k of orden) {
    if (peso[k] <= 0 || out.length >= 3) break;
    if (cajas.some((c) => Math.abs(c - k) <= 1 || Math.abs(c - k) >= N - 1)) continue;
    cajas.push(k);
    out.push(hexDe(Math.round(sr[k] / peso[k]), Math.round(sg[k] / peso[k]), Math.round(sb2[k] / peso[k])));
  }
  return out;
}

/** { plataforma, dominio } de un enlace de entradas (o null): el botón dirá
 * «Entradas en DICE». La lista de la tarjeta, la misma que la app
 * (`ticket_platforms.dart`). */
const plataformaEntradas = (url) => KT.plataformaEntradas(url);

/** Metros entre dos puntos. */
function metrosEntre(a, b) {
  const rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Mapbox GL se carga solo cuando hace falta un mapa (pesa lo suyo). */
let MAPBOX_GL = null;
function cargaMapbox() {
  if (!MAPBOX_GL) {
    MAPBOX_GL = new Promise((ok, ko) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';
      document.head.append(css);
      const js = document.createElement('script');
      js.src = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js';
      js.onload = () => ok(window.mapboxgl);
      js.onerror = () => { MAPBOX_GL = null; ko(new Error('mapbox')); };
      document.head.append(js);
    });
  }
  return MAPBOX_GL;
}

/** Un mapa con una chincheta que se arrastra (o se pone con un clic).
 * Devuelve { mueve(punto) } o null si no hay mapa (sin token o sin red): el
 * formulario sigue funcionando con la dirección escrita. */
async function mapaPunto(caja, punto, alMover) {
  const token = await tokenMapbox();
  let gl = null;
  if (token) { try { gl = await cargaMapbox(); } catch { gl = null; } }
  if (!gl) {
    caja.classList.add('sin-mapa');
    caja.innerHTML = '<p class="muted">El mapa no se puede cargar ahora mismo. Escribe la dirección y pulsa «Buscar en el mapa»: la localizamos igual.</p>';
    return null;
  }
  gl.accessToken = token;
  const hay = punto && punto.lat != null;
  const centro = hay ? [punto.lng, punto.lat] : [-3.7038, 40.4168];
  const mapa = new gl.Map({ container: caja, style: 'mapbox://styles/mapbox/streets-v12', center: centro, zoom: hay ? 16 : 5, cooperativeGestures: true,
    // Sin métricas de uso para Mapbox (lo que se puede apagar; las cargas de
    // mapa las cuenta igual, para la factura).
    performanceMetricsCollection: false, collectResourceTiming: false });
  mapa.addControl(new gl.NavigationControl({ showCompass: false }));
  const chincheta = new gl.Marker({ draggable: true, color: '#FF4D6D' }).setLngLat(centro);
  if (hay) chincheta.addTo(mapa);
  const avisa = () => { const p = chincheta.getLngLat(); alMover({ lat: p.lat, lng: p.lng }); };
  chincheta.on('dragend', avisa);
  mapa.on('click', (e) => { chincheta.setLngLat(e.lngLat).addTo(mapa); avisa(); });
  return {
    mueve(p, zoom = 17) {
      chincheta.setLngLat([p.lng, p.lat]).addTo(mapa);
      mapa.flyTo({ center: [p.lng, p.lat], zoom });
    },
  };
}

/** Lector de QR con la cámara del navegador.
 *
 * Chrome y Android traen `BarcodeDetector`; Safari y Firefox no, y para
 * ellos se carga jsQR (solo entonces). Devuelve la función para apagar la
 * cámara, que se llama también al cambiar de pantalla. */
let JSQR = null;
function cargaJsQR() {
  if (!JSQR) {
    JSQR = new Promise((ok, ko) => {
      const js = document.createElement('script');
      // jsQR 1.4.0, servido desde klendar.app (mismo archivo que el de npm).
      js.src = '/assets/vendor/jsqr-1.4.0.js';
      js.integrity = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';
      js.onload = () => ok(window.jsQR);
      js.onerror = () => { JSQR = null; ko(new Error('jsqr')); };
      document.head.append(js);
    });
  }
  return JSQR;
}
let PARA_CAMARA = null;
function paraCamara() { if (PARA_CAMARA) { PARA_CAMARA(); PARA_CAMARA = null; } }
async function escanerQR(video, alLeer) {
  paraCamara();
  const flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  video.srcObject = flujo;
  video.setAttribute('playsinline', '');
  await video.play();
  let detector = null;
  if ('BarcodeDetector' in window) {
    try {
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      if (formatos.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch { detector = null; }
  }
  const jsqr = detector ? null : await cargaJsQR();
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  let vivo = true;
  let ultimo = '';
  let pausa = 0;
  const vuelta = async () => {
    if (!vivo) return;
    if (video.readyState >= 2 && Date.now() > pausa) {
      let texto = null;
      try {
        if (detector) {
          texto = (await detector.detect(video))[0]?.rawValue || null;
        } else {
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w && h) {
            lienzo.width = w; lienzo.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            texto = jsqr(ctx.getImageData(0, 0, w, h).data, w, h)?.data || null;
          }
        }
      } catch { texto = null; }
      // El mismo QR delante de la cámara no se valida veinte veces.
      if (texto && texto !== ultimo) {
        ultimo = texto;
        pausa = Date.now() + 2500;
        alLeer(texto);
      }
    }
    setTimeout(vuelta, 200);
  };
  vuelta();
  PARA_CAMARA = () => {
    vivo = false;
    flujo.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  return PARA_CAMARA;
}

/** Las fotos que caben: los mismos topes que la app (carta 8, galería 12,
 * publicación 6). Si se eligen más, se dice cuántas se quedan fuera en vez de
 * perderlas en silencio. */
const TOPE = { carta: 8, galeria: 12, publicacion: 6 };
const topeLleno = (max) => bi(`Ya tienes ${max}, el máximo. Quita alguna para poner otra.`, `You already have ${max}, the maximum. Remove one to add another.`);
const topeHasta = (max) => bi(`Hasta ${max} fotos.`, `Up to ${max} photos.`);
function caben(archivos, hay, max) {
  const lista = [...archivos];
  const hueco = Math.max(0, max - hay);
  if (lista.length > hueco) {
    toast(hueco
      ? bi(`Caben ${hueco} más (el máximo son ${max}). Las demás no se han subido.`,
        `Only ${hueco} more fit (${max} at most). The rest weren't uploaded.`)
      : topeLleno(max), true);
  }
  return lista.slice(0, hueco);
}

/** «−20 %», «2x1», «Gratis»… lo que hay que leer de un vistazo. */
function etiquetaDescuento(d) {
  if (!d) return '';
  if (d.type === 'percent') return `−${d.value} %`;
  if (d.type === 'fixed') return fmtMoney(Math.round(Number(d.value) * 100));
  if (d.type === '2x1') return '2x1';
  if (d.type === 'free') return 'Gratis';
  if (d.type === 'other' && d.value) return String(d.value);
  return d.label || d.text || '';
}

async function rpc(fn, args = {}) {
  let res;
  try {
    res = await sb.rpc(fn, args);
  } catch (e) {
    throw new Error(friendly(e?.message));
  }
  // Nunca el texto de Postgres tal cual: el código, si lo hay, se traduce.
  if (res.error) throw Object.assign(new Error(friendly(res.error.message)), { clave: res.error.message });
  return res.data;
}

/** Fecha para <input type="datetime-local">: la hora del negocio, sin zona. */
const toLocalInput = (iso) => KZ.aInput(iso, TZ);
/** Lo escrito en un datetime-local se lee como hora del negocio (no la del
 * ordenador) y se devuelve el instante en ISO. */
const fromLocalInput = (v) => KZ.deInput(v, TZ);

// Modal sencillo (mismo patrón que el panel de administración).
function modal({ title, intro, html = '', fields = [], submit = 'Guardar', danger = false, cancel = 'Cancelar' }) {
  return new Promise((resolve) => {
    const d = $('#modal');
    const field = (f) => {
      if (f.type === 'select') return `<label class="f"><span>${esc(f.label)}</span><select name="${f.name}">${f.options.map((o) => `<option value="${esc(o[0])}" ${o[0] == f.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
      if (f.type === 'checkbox') return `<label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
      const extra = `${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} ${f.min ? `min="${esc(f.min)}"` : ''} ${f.max ? `max="${esc(f.max)}"` : ''}`;
      const help = f.help ? `<small class="muted">${esc(f.help)}</small>` : '';
      if (f.type === 'textarea') return `<label class="f"><span>${esc(f.label)}</span><textarea name="${f.name}" rows="${f.rows || 5}" ${extra}>${esc(f.value ?? '')}</textarea>${help}</label>`;
      return `<label class="f"><span>${esc(f.label)}</span><input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${extra}>${help}</label>`;
    };
    d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${intro ? `<p class="muted" style="margin:0">${intro}</p>` : ''}
      ${fields.map(field).join('')}
      ${html}
      <div class="foot">${cancel ? `<button type="button" class="btn ghost" data-cancel>${esc(cancel)}</button>` : ''}<button type="submit" class="btn ${danger ? 'bad' : 'primary'}">${esc(submit)}</button></div></form>`;
    const form = $('form', d);
    const close = (v) => { d.close(); resolve(v); };
    const c = $('[data-cancel]', d);
    if (c) c.onclick = () => close(null);
    d.oncancel = (e) => { e.preventDefault(); close(null); };
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form); const out = {};
      for (const f of fields) out[f.name] = f.type === 'checkbox' ? form.elements[f.name].checked : (fd.get(f.name) ?? '').toString().trim();
      close(out);
    };
    d.showModal();
  });
}
const confirmDlg = (title, text, opts = {}) => modal({ title, intro: text, submit: opts.submit || 'Confirmar', danger: opts.danger }).then((v) => v !== null);

function downloadCsv(name, rows, cols) {
  const lines = [cols.map((c) => c[1]), ...rows.map((r) => cols.map((c) => {
    const v = typeof c[0] === 'function' ? c[0](r) : r[c[0]];
    if (v == null) return '';
    const t = String(v);
    return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
  }))];
  const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${name}-${KZ.hoy(TZ)}.csv`;
  a.click();
}

function table({ cols, rows, empty = 'Nada por aquí.' }) {
  if (!rows.length) return `<div class="tbl-wrap"><div class="empty">${esc(empty)}</div></div>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th ${c.num ? 'class="num"' : ''}>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr data-i="${i}">${cols.map((c) => `<td ${c.num ? 'class="num"' : ''}${c.h ? ` data-label="${esc(I18N.t(c.h))}"` : ''}>${c.r(r, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/** Un texto con negritas o datos dentro, que no se puede traducir trozo a trozo. */
const bi = (es, en) => (I18N.lang === 'en' ? en : es);
const helpBox = (title, body) => `<details class="help"><summary>${esc(title)}</summary>${body}</details>`;

// ── Sesión y negocio activo ─────────────────────────────────────────────────
const insecure = location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
if (insecure) {
  document.body.innerHTML = '<div class="login"><h2>Conexión no segura</h2><p class="muted">Este panel solo funciona por HTTPS: <a href="https://klendar.app/panel/">https://klendar.app/panel/</a>.</p></div>';
  throw new Error('insecure');
}

let ME = null;
let BIZ = null;          // negocio activo
let BIZZES = [];         // todos los del usuario
let CATS = [];

/** Lo que `my_businesses` no trae del negocio activo: su zona horaria (para
 * todas las fechas del panel) y el motivo de rechazo en inglés. Se lee al
 * entrar y cada vez que se cambia de local; si falla, se deduce de las
 * coordenadas y, sin ellas, Madrid. */
async function preparaNegocio() {
  if (!BIZ) { TZ = KZ.MADRID; return; }
  if (!KZ.valida(BIZ.time_zone)) {
    try {
      const { data } = await sb.from('businesses').select('time_zone, rejection_reason_en').eq('id', BIZ.id).maybeSingle();
      if (data) Object.assign(BIZ, data);
    } catch { /* se prueba abajo */ }
  }
  if (!KZ.valida(BIZ.time_zone)) {
    try {
      const fila = await rpc('business_profile', { p_id: BIZ.id });
      const perfil = Array.isArray(fila) ? fila[0] : fila;
      if (perfil) BIZ.time_zone = KZ.de(perfil);
    } catch { /* Madrid */ }
  }
  TZ = KZ.de(BIZ);
  // «Antes de cerrar» en el menú: se sabe al momento, sin esperar.
  ANTES = null;
  const negocio = BIZ.id;
  rpc('before_closing_setup', { p_business: negocio })
    .then((r) => { if (BIZ?.id === negocio) { ANTES = r; if (ME) renderNav(currentRoute()[0]); } })
    .catch(() => {});
  // «Partidos que pones» en el menú: si es de su gremio o ya pone alguno.
  PARTIDOS_NAV = null;
  rpc('business_broadcast_week', { p_business: negocio, p_days: 1, p_lang: I18N.lang })
    .then((r) => { if (BIZ?.id === negocio) { PARTIDOS_NAV = r; if (ME) renderNav(currentRoute()[0]); } })
    .catch(() => {});
}
/** Lo de «Antes de cerrar» del negocio (`before_closing_setup`). */
let ANTES = null;
/** Si «Partidos que pones» sale en el menú (`business_broadcast_week`). */
let PARTIDOS_NAV = null;

/** A dónde volver después de entrar o de aceptar los términos: la página del
 * panel con lo que traía (el código de un QR escaneado sin sesión, «Crear a
 * partir de esta», ampliar una oferta, el día del calendario…) y nada más.
 * El hash puede traer de todo (un `#access_token=…` de un enlace de acceso)
 * y viajaba entero en `?volver=`: solo pasan las pantallas del panel y los
 * parámetros de esta lista, cada uno con su forma. Siempre dentro de /panel/. */
const VUELTA_PARAMS = {
  biz: /^[0-9a-f-]{36}$/i,
  code: /^[0-9a-f]{8,64}$/i,
  from: /^[0-9a-f-]{36}$/i,
  repeat: /^1$/,
  extend: /^[0-9a-f-]{36}$/i,
  estado: /^[a-z_]{1,20}$/,
  dia: /^\d{4}-\d{2}-\d{2}$/,
  idea: /^(1|before_closing)$/,
  partido: /^[0-9a-f-]{36}$/i,
  editar: /^1$/,
};
function rutaDeVuelta() {
  const [h, q] = location.hash.split('?');
  const pagina = (/^#\/([a-z0-9-]{1,30})(\/[A-Za-z0-9-]{1,40}){0,2}$/.exec(h || '') || [])[1];
  // rrpp.js, series.js, partidos.js, sorteos.js y grupos.js se cargan después: sus pantallas también valen.
  const conocida = pagina && (Object.hasOwn(PAGES, pagina) || ['rrpp', 'series', 'partidos', 'sorteos', 'grupos'].includes(pagina));
  let hash = '';
  if (conocida) {
    const dentro = new URLSearchParams(q || '');
    const fuera = new URLSearchParams();
    for (const [k, re] of Object.entries(VUELTA_PARAMS)) {
      const val = dentro.get(k);
      if (val && re.test(val)) fuera.set(k, val);
    }
    const resto = fuera.toString();
    hash = h + (resto ? `?${resto}` : '');
  }
  const alta = new URLSearchParams(location.search).has('alta') ? '?alta=1' : '';
  return `/panel/${alta}${hash}`;
}

/** Los códigos guardados sin conexión son de quien tenía la sesión: al salir
 * se olvidan (si no, los mandaría la siguiente persona que entre aquí). */
function olvidaColas() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('klendar.cola.')) localStorage.removeItem(k);
    }
    // Qué negocio llevabas: tampoco se queda para quien entre después.
    localStorage.removeItem('klendar.biz');
  } catch { /* sin permisos */ }
}

async function boot() {
  await window.KL_ENLACE(sb);
  const { data: { session } } = await sb.auth.getSession();
  // Sin sesión, el aviso de un enlace que no ha servido lo da «Tu cuenta».
  if (!session) return showLogin();
  ME = session.user;
  const aviso = window.KL_ENLACE.aviso(I18N.lang);
  if (aviso) toast(aviso, true);
  // Quien entró con Google y aún no ha aceptado los términos ni dicho su
  // edad lo hace primero en «Tu cuenta», y vuelve aquí. Igual si los aceptó
  // en una versión anterior a la vigente («Hemos actualizado los términos…»).
  try {
    const c = await rpc('my_consents');
    if (!c) { await sb.auth.signOut({ scope: 'local' }).catch(() => {}); return showLogin(); }
    // Y sin nombre (entró con un código por correo): «¿Cómo te llamas?».
    if (!c.terms_accepted_at || c.terms_outdated === true
        || (c.has_display_name === false && !c.name_asked_at)) {
      location.href = `/app/?volver=${encodeURIComponent(rutaDeVuelta())}#/ultimo-paso`;
      return;
    }
  } catch { /* sin red: no se bloquea */ }
  $('#who').textContent = ME.email || ME.phone || '';
  $('#app').hidden = false;

  try {
    BIZZES = await rpc('my_businesses');
  } catch (e) {
    // La pantalla de error, centrada (`.vacio`, como en la app).
    $('#view').innerHTML = `<section class="vacio"><h2>${esc(I18N.t('Algo ha fallado'))}</h2><p>${esc(friendly(e.message))}</p><div class="vacio-botones"><button class="btn primary" data-recargar>${esc(I18N.t('Reintentar'))}</button></div></section>`;
    $('[data-recargar]', $('#view')).onclick = () => location.reload();
    return;
  }
  // Quien llega del registro de negocio trae ?alta=1: se limpia la dirección.
  if (new URLSearchParams(location.search).has('alta')) {
    history.replaceState(null, '', `${location.pathname}${BIZZES.length ? '' : '#/alta'}`);
  }
  if (!BIZZES.length) return noBusiness();
  const saved = localStorage.getItem('klendar.biz');
  // ?biz= (desde un aviso de otro de tus locales) manda sobre el último usado.
  const pedido = new URLSearchParams(location.hash.split('?')[1] || '').get('biz');
  BIZ = BIZZES.find((b) => b.id === pedido) || BIZZES.find((b) => b.id === saved) || BIZZES[0];
  if (pedido && BIZ.id === pedido) localStorage.setItem('klendar.biz', BIZ.id);
  await preparaNegocio();
  renderBizPicker();
  // Todas las columnas: `category_group` (el grupo del selector de
  // categorías) solo existe con la migración 20261114100000.
  try { CATS = (await sb.from('categories').select('*').order('position')).data || []; } catch { CATS = []; }
  route();
}
/** Sin sesión: a la pantalla de entrar de siempre (la de «Tu cuenta»), que
 * devuelve aquí, a la misma página del panel, al entrar. Una sola cuenta y
 * una sola forma de entrar, como en la app. */
function showLogin() {
  ME = null;
  const aqui = rutaDeVuelta();
  location.replace(`/app/?destino=${encodeURIComponent(aqui)}#/entrar`);
}
async function noBusiness() {
  $('#nav').innerHTML = '';
  $('.bizpick').hidden = true;
  $('#bizTop').hidden = true;
  const v = $('#view');
  try {
    await PAGES.alta(v);
    sinDobleEnvio(v);
    I18N.translate(v);
  } catch (e) {
    v.innerHTML = `<section class="vacio"><h2>Algo ha fallado</h2><p>${esc(friendly(e.message))}</p><div class="vacio-botones"><button class="btn primary" data-recargar>Reintentar</button></div></section>`;
    $('[data-recargar]', v).onclick = () => location.reload();
    I18N.translate(v);
  }
}
/** El selector de local: en la barra lateral y, en el móvil, arriba (donde
 * la app pone «Nails & Co ▾»). Tus locales y, al final, «Nuevo negocio» (el
 * alta). Recuerda el último usado (`klendar.biz`). */
function renderBizPicker() {
  const opciones = BIZZES.map((b) => `<option value="${esc(b.id)}" ${b.id === BIZ.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')
    + `<option value="__nuevo">${esc(bi('+ Nuevo negocio', '+ New business'))}</option>`;
  for (const sel of $$('#bizSelect, #bizTop')) {
    sel.innerHTML = opciones;
    sel.hidden = false;
    sel.onchange = async () => {
      const elegido = sel.value;
      if (elegido === '__nuevo') {
        sel.value = BIZ.id;
        location.hash = '#/alta';
        return;
      }
      if (!await puedeSalir()) { sel.value = BIZ.id; return; }
      BIZ = BIZZES.find((b) => b.id === elegido);
      localStorage.setItem('klendar.biz', BIZ.id);
      for (const otro of $$('#bizSelect, #bizTop')) otro.value = BIZ.id;
      await preparaNegocio();
      const [pag, param] = currentRoute();
      if (param) { location.hash = `#/${pag}`; return; }
      route();
    };
  }
}

let saliendo = false;
$('#logout').onclick = async (e) => {
  e.preventDefault();
  if (!await puedeSalir()) return;
  saliendo = true;
  olvidaColas();
  await sb.auth.signOut({ scope: 'local' }); // solo este navegador
  location.href = '/';
};
sb.auth.onAuthStateChange((ev) => {
  // También si se sale desde otra pestaña o desde «Tu cuenta».
  if (ev === 'SIGNED_OUT') olvidaColas();
  if (ev === 'SIGNED_OUT' && !saliendo) showLogin();
  // Un enlace de «he olvidado la contraseña» antiguo que traiga aquí: la
  // contraseña nueva se pone en «Tu cuenta» y se vuelve al panel.
  if (ev === 'PASSWORD_RECOVERY') location.href = '/app/?destino=%2Fpanel%2F#/nueva-clave';
});
$('#menuBtn').onclick = () => abreMenu(!$('#side').classList.contains('open'));
$('#menuCerrar').onclick = () => abreMenu(false);

// ── Idioma ──────────────────────────────────────────────────────────────────
// El panel se escribió en español; la versión inglesa se pinta encima (ver
// i18n.js). Lo que no esté traducido se queda en español, nunca en blanco.
I18N.pickers(['#lang', '#langSide']);
I18N.translate(document.body);
if (I18N.lang === 'en') document.title = 'Klendar · Business dashboard';

// ── Navegación ──────────────────────────────────────────────────────────────
// Iconos que no están en la fuente recortada del panel (Material Symbols,
// solo los que ya se usaban): en SVG, con los trazos de Material.
const SVG = {
  calendario: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z',
  izq: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  der: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
  salir: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  cerrar: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  vista: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  rejilla: 'M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z',
  lista: 'M3 5h2v2H3V5zm4 0h14v2H7V5zM3 11h2v2H3v-2zm4 0h14v2H7v-2zm-4 6h2v2H3v-2zm4 0h14v2H7v-2z',
  // Series y repeticiones (event_repeat; no está en la fuente recortada).
  repite: 'M21 12V6c0-1.1-.9-2-2-2h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h7v-2H5V10h14v2h2zm-5.36 8c.43 1.45 1.77 2.5 3.36 2.5 1.93 0 3.5-1.57 3.5-3.5s-1.57-3.5-3.5-3.5c-.95 0-1.82.38-2.45 1H18v2h-4v-4h2v1.4c.9-.87 2.13-1.4 3.5-1.4 2.76 0 5 2.24 5 5s-2.24 5-5 5c-2.42 0-4.44-1.72-4.9-4h1.54z',
  // «Antes de cerrar» (shopping_bag).
  bolsa: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z',
  // «Partidos que pones» (sports_soccer).
  partido: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 3.3 1.35-.95c1.82.56 3.37 1.76 4.38 3.34l-.39 1.34-1.35.46L13 6.7V5.3zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34c1.01-1.57 2.56-2.77 4.38-3.34zM7.08 17.11l-1.14.1C4.73 15.81 4 13.99 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34-.78 1.37zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11-.7 1.48zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54L14.27 15zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21z',
  // RRPP (record_voice_over).
  // «Poner en la tele» (tv; no está en la fuente recortada).
  tele: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
  // Sorteos (confirmation_number) y Grupos y empresas (groups).
  sorteo: 'M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-2-1.46c-1.19.69-2 1.99-2 3.46s.81 2.77 2 3.46V18H4v-2.54c1.19-.69 2-1.99 2-3.46 0-1.48-.8-2.77-1.99-3.46L4 6h16v2.54zM11 15h2v2h-2zm0-4h2v2h-2zm0-4h2v2h-2z',
  grupos: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  rrpp: 'M9 13c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 8c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4zm6 5H3v-.99C3.2 18.29 6.3 17 9 17s5.8 1.29 6 2v1zM15.08 7.05c.84 1.18.84 2.71 0 3.89l1.68 1.69c2.02-2.02 2.02-5.07 0-7.27l-1.68 1.69zM20.07 2l-1.63 1.63c2.77 3.02 2.77 7.56 0 10.74L20.07 16c3.9-3.89 3.91-9.95 0-14z',
};
const svg = (n, s = 20) => `<svg class="ms svg" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${SVG[n]}"/></svg>`;
const icono = (n) => (SVG[n] ? svg(n) : ms(n));

// El menú, con los grupos de «Mi negocio» en la app: lo de todos los días
// arriba; Publicar (Publicaciones, Series y repeticiones, Novedades),
// Clientes (Tarjetas de sellos, Regalo de cumpleaños, Avisar a mis
// clientes, Reseñas), RRPP, Tu local (Carta, Cartel del local, Poner en la
// tele, Días cerrados, Equipo) y Cifras (Informe); y abajo la ficha (con darse de
// baja dentro, solo el propietario) y la ayuda.
// `en` dice qué pantallas cuentan como esa entrada (para marcarla).
const NAV = [
  [null, [
    ['resumen', 'dashboard', 'Resumen'],
    ['calendario', 'calendario', 'Calendario'],
    ['validar', 'qr_code_scanner', 'Validar códigos'],
  ]],
  ['Publicar', [
    ['publicaciones', 'bolt', 'Publicaciones', ['asistentes', 'cartel']],
    // Lo que sobra del día, en dos toques (gremios de comida o si ya ha
    // publicado alguna: `before_closing_setup` → suggested).
    ['antes-de-cerrar', 'bolsa', 'Antes de cerrar'],
    ['series', 'repite', 'Series y repeticiones'],
    // Los partidos que pone el bar (gremios de bar, restaurante… o si ya ha
    // marcado alguno: `business_broadcast_week` → suggested).
    ['partidos', 'partido', 'Partidos que pones'],
    ['novedades', 'campaign', 'Novedades'],
  ]],
  ['Clientes', [
    ['sellos', 'loyalty', 'Tarjetas de sellos'],
    // Bonos pagados en el local (panel/bonos.js): el personal los ve para
    // venderlos; crear y pausar es de propietario y encargado.
    ['bonos', 'redeem', 'Bonos'],
    // Sorteos y Grupos y empresas (panel/sorteos.js y panel/grupos.js; tanda
    // C): los sorteos los ve todo el equipo; los grupos, solo quien gestiona.
    ['sorteos', 'sorteo', 'Sorteos'],
    ['grupos', 'grupos', 'Grupos y empresas'],
    ['cumpleanos', 'cake', 'Regalo de cumpleaños'],
    ['mensajes', 'notifications_active', 'Avisar a mis clientes'],
    ['resenas', 'reviews', 'Reseñas'],
  ]],
  ['RRPP', [
    ['rrpp', 'rrpp', 'RRPP'],
  ]],
  ['Tu local', [
    ['carta', 'restaurant_menu', 'Carta'],
    ['cartel-local', 'qr_code_2', 'Cartel del local'],
    ['tele', 'tele', 'Poner en la tele'],
    ['cerrados', 'event_busy', 'Días cerrados'],
    ['equipo', 'group', 'Equipo'],
  ]],
  ['Cifras', [
    ['informe', 'bar_chart', 'Informe'],
  ]],
  ['Tu negocio', [
    // «Dar de baja el negocio» está en la «Zona delicada» de «Tu ficha».
    ['ficha', 'storefront', 'Tu ficha', ['baja']],
    ['ayuda', 'help', 'Ayuda'],
  ]],
];
/** Las cuatro de todos los días, abajo en el móvil (como las pestañas de la
 * app); «Más» abre el menú entero. */
const BARRA = ['resumen', 'publicaciones', 'calendario', 'validar'];
const visibleEnMenu = (k) => (gestiona() || !SOLO_GESTION.includes(k)) && (k !== 'baja' || esPropietario())
  && (k !== 'antes-de-cerrar' || !!ANTES?.suggested)
  && (k !== 'partidos' || !!PARTIDOS_NAV?.suggested);
const marcada = (current, n) => current === n[0] || (n[3] || []).includes(current);
function renderNav(current) {
  let g = 0;
  $('#nav').innerHTML = NAV.map(([titulo, items]) => {
    const vis = items.filter((n) => visibleEnMenu(n[0]));
    if (!vis.length) return '';
    const id = `navg${g++}`;
    return `<div class="nav-grupo" ${titulo ? `role="group" aria-labelledby="${id}"` : ''}>
      ${titulo ? `<p class="group" id="${id}">${esc(titulo)}</p>` : ''}
      ${vis.map((n) => `<a class="nav ${marcada(current, n) ? 'on' : ''}" href="#/${n[0]}"${marcada(current, n) ? ' aria-current="page"' : ''}>${icono(n[1])}<span>${esc(n[2])}</span></a>`).join('')}
    </div>`;
  }).join('');
  I18N.translate($('#nav'));
  const todas = NAV.flatMap(([, items]) => items);
  const enBarra = BARRA.some((k) => marcada(current, todas.find((n) => n[0] === k)));
  $('#tabbar').innerHTML = BARRA.map((k) => todas.find((n) => n[0] === k)).map((n) =>
    `<a href="#/${n[0]}" class="${marcada(current, n) ? 'on' : ''}"${marcada(current, n) ? ' aria-current="page"' : ''}>${icono(n[1])}<span>${esc(n[2] === 'Validar códigos' ? 'Validar' : n[2])}</span></a>`).join('')
    + `<button type="button" id="masBtn" class="${enBarra ? '' : 'on'}" aria-expanded="false" aria-controls="side">${ms('more_horiz')}<span>${esc(I18N.t('Más'))}</span></button>`;
  I18N.translate($('#tabbar'));
  $('#masBtn').onclick = () => abreMenu(true);
}

// El menú en el móvil: un cajón que se abre con «Más» (o «Menú» arriba), se
// cierra con Escape, al pulsar fuera o con su botón, y devuelve el foco.
let VUELTA_MENU = null;
function abreMenu(abrir) {
  const side = $('#side');
  if (abrir) {
    VUELTA_MENU = document.activeElement;
    side.classList.add('open');
    document.body.classList.add('con-menu');
    $$('#menuBtn, #masBtn').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    ($('a.nav.on', side) || $('a.nav', side))?.focus();
  } else if (side.classList.contains('open')) {
    side.classList.remove('open');
    document.body.classList.remove('con-menu');
    $$('#menuBtn, #masBtn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (VUELTA_MENU?.isConnected) VUELTA_MENU.focus();
    VUELTA_MENU = null;
  }
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abreMenu(false); });
document.addEventListener('click', (e) => {
  const side = $('#side');
  if (side.classList.contains('open') && !side.contains(e.target) && !e.target.closest('#menuBtn, #masBtn')) abreMenu(false);
});
const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'resumen').split('/');
const PAGES = {};
// Cada pintada lleva su número: si mientras carga una se pide otra (cambiar
// de negocio y de pantalla seguido), lo que termine tarde no pisa ni saca
// errores sobre la nueva.
let RUTA_N = 0;
/** Un formulario no se manda dos veces: mientras trabaja, sus botones de
 * enviar se bloquean. Se aplica solo a los formularios de cada pantalla. */
function sinDobleEnvio(caja) {
  for (const form of caja.querySelectorAll('form')) {
    const original = form.onsubmit;
    if (!original || form.dataset.unaVez) continue;
    form.dataset.unaVez = '1';
    let ocupado = false;
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (ocupado) return;
      ocupado = true;
      const botones = [...form.querySelectorAll('button[type=submit], button:not([type])')];
      botones.forEach((b) => { b.disabled = true; });
      try { await original.call(form, e); } finally {
        ocupado = false;
        botones.forEach((b) => { b.disabled = false; });
      }
    };
  }
}

// Lo que no es de un empleado: solo propietario y encargados (como la app).
// «Regalo de cumpleaños» no está: el personal lo ve, en solo lectura.
const SOLO_GESTION = ['sellos', 'carta', 'novedades', 'mensajes', 'ficha', 'cerrados', 'equipo', 'cartel-local', 'tele', 'rrpp', 'antes-de-cerrar', 'grupos'];

// ── Salir con cambios sin guardar ───────────────────────────────────────────
// Una vista con cambios se apunta aquí: si se va a otra pantalla, se vuelve
// a la de antes y se pregunta. `dentro(hash)` dice qué rutas no cuentan como
// salir (los pasos del alta entre sí).
let GUARDA = null;
let HASH_ANTES = location.hash;
async function confirmaSalir() {
  return confirmDlg(I18N.t('¿Salir sin guardar?'), I18N.t('Hay cambios que todavía no has guardado.'),
    { submit: I18N.t('Salir sin guardar'), danger: true });
}
window.addEventListener('beforeunload', (e) => {
  if (GUARDA && GUARDA.sucia()) { e.preventDefault(); e.returnValue = ''; }
});
/** El enrutador pregunta aquí antes de pintar otra pantalla. */
async function puedeSalir() {
  const destino = location.hash;
  if (!GUARDA || !GUARDA.sucia() || (GUARDA.dentro && GUARDA.dentro(destino))) { HASH_ANTES = destino; return true; }
  // Se vuelve a la pantalla de antes sin pintarla otra vez y se pregunta.
  history.replaceState(null, '', HASH_ANTES || '#/resumen');
  if (!(await confirmaSalir())) return false;
  GUARDA = null;
  HASH_ANTES = destino;
  history.replaceState(null, '', destino);
  return true;
}

async function route() {
  paraCamara();
  GUARDA = null;
  if (!ME) return;
  if (!BIZ) return noBusiness();
  const n = ++RUTA_N;
  // Con la barra de abajo del móvil, que el formulario de publicación esconde.
  document.body.classList.remove('con-barra-pub');
  let [page, param] = currentRoute();
  if (!gestiona() && SOLO_GESTION.includes(page)) page = 'resumen';
  renderNav(page);
  // Al ir a otra pantalla desde el menú del móvil, el cajón se cierra y el
  // foco pasa a la pantalla nueva (no al botón que lo abrió).
  VUELTA_MENU = null;
  abreMenu(false);
  // Cada pintada va en su propia caja: si una vieja termina tarde, escribe
  // en una caja que ya no está en la página y no se ve.
  const v = document.createElement('div');
  v.innerHTML = '<div class="loading">Cargando…</div>';
  $('#view').replaceChildren(v);
  try {
    await (PAGES[page] || PAGES.resumen)(v, param);
    if (n === RUTA_N) {
      sinDobleEnvio(v); I18N.translate(v);
      // Cambiar de pantalla con el teclado o un lector de pantalla: el foco va
      // al título de la nueva (si no, se queda en un enlace que ya no está).
      if (FOCO_AL_TITULO) {
        FOCO_AL_TITULO = false;
        const h1 = $('h1', v);
        if (h1 && !v.contains(document.activeElement)) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); scrollTo(0, 0); }
      }
    }
  } catch (e) {
    if (n !== RUTA_N) return;
    console.error(e);
    // «Reintentar» vuelve a pintar la pantalla, sin recargar todo el panel.
    v.innerHTML = `<section class="vacio"><h2>Algo ha fallado</h2><p>${esc(friendly(e?.message))}</p><div class="vacio-botones"><button class="btn primary" type="button" data-reintentar>Reintentar</button></div></section>`;
    $('[data-reintentar]', v).onclick = () => route();
    I18N.translate(v);
  }
}
let FOCO_AL_TITULO = false;
window.addEventListener('hashchange', async () => {
  if (!(await puedeSalir())) return;
  FOCO_AL_TITULO = true; route();
});

// El alta (`#/alta/1…3`) y «Tu ficha» (`#/ficha/…`) están en ficha.js.

// ── Resumen ─────────────────────────────────────────────────────────────────
/** En revisión o rechazado: qué pasa y cómo escribirnos, como en la app. Si
 * lo rechazamos, el motivo (en inglés si el admin lo escribió). */
function avisoVerificacion() {
  const rechazado = BIZ.verification_status === 'rejected';
  const motivo = (I18N.lang === 'en' && BIZ.rejection_reason_en) || BIZ.rejection_reason || '';
  const en = I18N.lang === 'en';
  const asunto = encodeURIComponent(en ? 'Klendar · my business verification' : 'Klendar · verificación de mi negocio');
  const cuerpo = encodeURIComponent(en ? `Business: ${BIZ.id}` : `Negocio: ${BIZ.id}`);
  return `<div class="help"><b>${esc(I18N.t(rechazado ? 'Tu negocio está rechazado.' : 'Tu negocio está en revisión.'))}</b>
    ${rechazado
      ? (motivo ? `<span>${esc(I18N.t('Motivo:'))}</span> <span>${esc(motivo)}</span>` : esc(I18N.t('No hemos podido verificar el negocio. Escríbenos a info@klendar.app.')))
      : esc(I18N.t('Estamos revisando tu negocio; normalmente tardamos 24–48 h. Mientras tanto puedes preparar la ficha y tus publicaciones: se harán públicas al verificarlo. Si pasan más de 48 h sin noticias, escríbenos.'))}
    <p style="margin:8px 0 0"><a class="btn sm" href="mailto:info@klendar.app?subject=${asunto}&body=${cuerpo}">${ms('mail')}${esc(I18N.t('Escribir a soporte'))}</a>
      ${rechazado && gestiona() ? `<button class="btn sm primary" type="button" id="otra-revision">${ms('check')}${esc(I18N.t('Pedir otra revisión'))}</button>` : ''}</p></div>`;
}

/** Administración lo ha marcado como cerrado de verdad (`business_closure_state`). */
function avisoCerrado() {
  const en = I18N.lang === 'en';
  const asunto = encodeURIComponent(en ? 'Klendar · my business has not closed' : 'Klendar · mi negocio no ha cerrado');
  const cuerpo = encodeURIComponent(en ? `Business: ${BIZ.id}` : `Negocio: ${BIZ.id}`);
  return `<div class="help"><b>${esc(I18N.t('Hemos marcado tu negocio como cerrado.'))}</b>
    ${esc(I18N.t('Ya no aparece en Klendar y sus publicaciones se han cancelado. Si es un error o vuelve a abrir, escríbenos.'))}
    <p style="margin:8px 0 0"><a class="btn sm" href="mailto:info@klendar.app?subject=${asunto}&body=${cuerpo}">${ms('mail')}${esc(I18N.t('Escribir a soporte'))}</a></p></div>`;
}

/** «Pedir otra revisión»: tras corregir lo del rechazo, otra vez a la cola
 * del admin, con lo que ha cambiado si lo cuenta (`request_business_review`). */
async function pideOtraRevision(boton) {
  const r = await modal({
    title: 'Pedir otra revisión',
    intro: esc(I18N.t('Cuando hayas corregido lo que te dijimos, pídenos que lo miremos otra vez. Si quieres, cuéntanos qué has cambiado. Normalmente contestamos en 24–48 h.')),
    fields: [{ name: 'note', label: 'Qué has corregido (opcional)', type: 'textarea', rows: 3, maxlength: 500 }],
    submit: 'Pedir la revisión',
  });
  if (!r) return;
  boton.disabled = true;
  try {
    const res = await rpc('request_business_review', { p_business: BIZ.id, p_note: r.note || null });
    toast(I18N.t(res?.ok ? 'Hecho: tu negocio vuelve a estar en revisión' : 'Tu negocio ya no está rechazado.'));
    await recargaNegocios();
    route();
  } catch (e) {
    toast(e.message, true);
    boton.disabled = false;
  }
}

PAGES.resumen = async (v) => {
  const [stats, offers, sub, cerradoDeVerdad] = await Promise.all([
    rpc('business_stats', { p_id: BIZ.id }),
    rpc('my_business_offers', { p_id: BIZ.id }),
    rpc('my_subscription', { p_business: BIZ.id }).catch(() => null),
    rpc('business_closure_state', { p_ref: BIZ.id }).catch(() => null),
  ]);
  const pending = offers.filter((o) => o.status === 'active');
  const s = stats || {};
  // Primeros pasos: recién aprobado y sin nada publicado. Lo mismo que en la
  // app; desaparece al publicar.
  const primeros = gestiona() && BIZ.verification_status === 'verified' && !offers.length;
  const ficha = primeros
    ? (await sb.from('businesses').select('logo_url, cover_image_url, gallery').eq('id', BIZ.id).maybeSingle()).data || {}
    : {};
  const conFotos = !!ficha.logo_url && (!!ficha.cover_image_url || (ficha.gallery || []).length > 0);
  const paso = (n, hecho, titulo, pista, href, attrs = '') => `<a class="paso${hecho ? ' hecho' : ''}" ${hecho ? '' : `href="${href}" ${attrs}`}>
      <span class="n">${hecho ? ms('check') : n}</span><span><b>${titulo}</b>${pista && !hecho ? `<small>${pista}</small>` : ''}</span>${hecho ? '' : ms('chevron_right')}</a>`;
  v.innerHTML = `
    <div class="page-head"><h1>${esc(BIZ.name)}</h1><span class="tag st-${esc(BIZ.verification_status)}">${esc(BIZ_LABELS[BIZ.verification_status] || BIZ.verification_status)}</span><span class="spacer"></span>
      <a class="btn sm ghost" href="${APP_URL}/b/${esc(BIZ.id)}" target="_blank" rel="noopener">Ver ficha pública ↗</a></div>
    ${cerradoDeVerdad ? avisoCerrado() : ''}
    ${BIZ.verification_status !== 'verified' ? avisoVerificacion() : ''}
    ${primeros ? `<div class="card primeros"><h2>Primeros pasos</h2>
      <p class="muted" style="margin:0 0 8px">Tres cosas y tu negocio está listo para que la gente lo encuentre.</p>
      ${paso(1, conFotos, 'Pon tu logo y una foto', '', '#/ficha/fotos')}
      ${paso(2, false, 'Publica tu primera oferta', 'Te la dejamos casi hecha: cambia el precio y la hora.', '#/publicaciones/nueva-flash?idea=1')}
      ${paso(3, false, 'Cuéntalo en tus redes', '', '#', 'data-compartir')}
    </div>` : ''}
    <!-- Publicar y validar, en coral los dos (como «Crear» y «Validar
         códigos» arriba del todo en «Mi negocio» de la app). -->
    <div class="quick">
      ${gestiona() ? `<button class="primary" data-go="nueva-flash"><span class="ic ms" aria-hidden="true">bolt</span>Nueva oferta flash<small>Canjeable con QR durante unas horas</small></button>
      <button data-go="nuevo-evento"><span class="ic ms" aria-hidden="true">event</span>Nuevo evento<small>Con fecha, aforo y reserva de plaza</small></button>` : ''}
      <button class="primary" data-go="validar"><span class="ic ms" aria-hidden="true">qr_code_scanner</span>Validar códigos<small>Con la cámara o escribiendo el código</small></button>
    </div>
    <div id="aforoCaja"></div>
    <div class="card" style="margin-top:14px"><h2>Cómo va</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(s.views_30d)}</b><span>Vistas (30 días)</span></div>
        <div class="kpi"><b>${fmtNum(s.redemptions_30d)}</b><span>Canjes (30 días)</span></div>
        <div class="kpi"><b>${fmtNum(s.favorites)}</b><span>Favoritos</span></div>
        <div class="kpi"><b>${s.ratings ? `${Number(s.rating).toLocaleString(LOC(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${s.ratings})` : '—'}</b><span>Valoración</span></div>
        <div class="kpi"><b>${fmtNum(pending.length)}</b><span>Publicaciones activas</span></div>
      </div>
    </div>
    ${cerradoIndef() ? `<div class="card pausa"><div>
        <h2 style="margin:0">Cerrado hasta nuevo aviso</h2>
        <p class="muted" style="margin:4px 0 0">${esPropietario()
          ? esc(I18N.t('Ahora mismo no se ve nada de tu negocio. Lo abres de nuevo cuando quieras.'))
          : esc(I18N.t('Solo el propietario puede abrirlo de nuevo.'))}</p></div>
        ${esPropietario() ? '<a class="btn primary" href="#/baja">Abrir de nuevo</a>' : ''}</div>`
    : gestiona() && BIZ.verification_status === 'verified' ? `<div class="card pausa"><div>
        <h2 style="margin:0">Cerrado por hoy</h2>
        <p class="muted" style="margin:4px 0 0">${pausado()
          ? esc(I18N.t('Ahora mismo no se ve nada de tu negocio. Mañana vuelve a verse solo.'))
          : esc(I18N.t('Si hoy no puedes atender, esconde todo de una vez. Mañana vuelve a verse solo.'))}</p></div>
        <button class="btn ${pausado() ? 'primary' : ''}" id="pausa">${pausado() ? 'Abrir de nuevo' : 'Cerrar por hoy'}</button></div>` : ''}
    ${sub && gestiona() ? planCard(sub) : ''}
    <div class="card"><h2>Klendar en tu web</h2>
      <p class="muted" style="margin:0 0 8px">Pega esta línea donde quieras que salga lo que tienes publicado. Se actualiza solo: no tienes que tocar nada más.</p>
      <pre id="wcode" class="code">&lt;script src="https://klendar.app/widget.js" data-klendar="${esc(BIZ.id)}"&gt;&lt;/script&gt;</pre>
      <p style="margin:8px 0 0"><button class="btn sm" id="wcopy">Copiar</button>
        <a class="btn sm" href="https://klendar.app/widget/${esc(BIZ.id)}" target="_blank" rel="noopener">Ver cómo queda</a></p></div>
    <div class="card"><h2>Últimas publicaciones</h2>${table({
      cols: [
        { h: 'Publicación', r: (o) => `<b class="title" translate="no">${esc(o.title)}</b><span class="sub">${esc(I18N.t(LABELS[o.kind]))} · ${fmtDate(o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at)}${etiquetaAudiencia(o)}</span>` },
        { h: 'Estado', r: (o) => etiquetaEstado(o) },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
        { h: 'Canjes', num: true, r: (o) => fmtNum(o.redemptions_count) },
        { h: '', r: (o) => `<a class="btn sm" href="#/publicaciones/${esc(o.id)}">Abrir</a>` },
      ],
      rows: offers.slice(0, 8),
      empty: 'Todavía no has publicado nada.',
    })}</div>
    ${esPropietario() ? '' : `<div class="card"><h2>Salir del equipo</h2>
      <p class="muted" style="margin:0 0 10px">Dejarás de ver este panel y de validar sus códigos. Avisaremos al propietario.</p>
      <button class="btn bad ghost" type="button" id="salir-equipo">Salir del equipo</button></div>`}`;
  const otra = $('#otra-revision', v);
  if (otra) otra.onclick = () => pideOtraRevision(otra);
  pintaAforo($('#aforoCaja', v));
  const salirEq = $('#salir-equipo', v);
  if (salirEq) {
    salirEq.onclick = async () => {
      if (salirEq.disabled) return;
      salirEq.disabled = true;
      try { await salirDelEquipo(); } catch (e) { toast(e.message, true); }
      salirEq.disabled = false;
    };
  }
  const wcopy = $('#wcopy', v);
  if (wcopy) {
    wcopy.onclick = async () => {
      try { await navigator.clipboard.writeText($('#wcode', v).textContent); } catch { toast('No se ha podido copiar', true); return; }
      wcopy.textContent = I18N.t('Copiado');
      setTimeout(() => { wcopy.textContent = I18N.t('Copiar'); }, 1500);
    };
  }
  $$('[data-go]', v).forEach((b) => {
    b.onclick = () => {
      const g = b.dataset.go;
      location.hash = g === 'validar' ? '#/validar'
        : g === 'nueva-flash' ? '#/publicaciones/nueva-flash' : '#/publicaciones/nuevo-evento';
    };
  });
  const pausa = $('#pausa', v);
  if (pausa) {
    pausa.onclick = async () => {
      // Hasta las 5 de la mañana: mañana abre solo (lo mismo que la app).
      // Las 5 del negocio, no las del ordenador desde el que se pulsa.
      const hasta = enDiasNegocio(1, 5);
      const cerrar = !pausado();
      if (pausa.disabled) return;
      pausa.disabled = true;
      try {
        await rpc('set_business_pause', { p_business: BIZ.id, p_until: cerrar ? hasta.toISOString() : null });
        BIZ.paused_until = cerrar ? hasta.toISOString() : null;
        toast(cerrar ? 'Cerrado por hoy' : 'Abierto de nuevo'); route();
      } catch (e) { toast(friendly(e.message), true); pausa.disabled = false; }
    };
  }
  const compartir = $('[data-compartir]', v);
  if (compartir) {
    compartir.onclick = async (e) => {
      e.preventDefault();
      const url = `${APP_URL}/b/${BIZ.id}`;
      const text = I18N.lang === 'en' ? `${BIZ.name} is on Klendar: ${url}` : `${BIZ.name} está en Klendar: ${url}`;
      if (navigator.share) {
        try { await navigator.share({ title: BIZ.name, text }); } catch { /* cancelado */ }
        return;
      }
      try { await navigator.clipboard.writeText(text); } catch { toast('No se ha podido copiar', true); return; }
      toast('Enlace copiado: pégalo en tus redes');
    };
  }
};

/** «¿Hay sitio ahora?» en el resumen: tres botones iguales (Tranquilo ·
 * Animado · Lleno), lo marcado y cuándo, y «Quitar». Cualquiera del equipo;
 * solo si el negocio lo ha activado en «Cómo es tu local». Como `CrowdPanel`
 * en la app. */
async function pintaAforo(caja, estado = null) {
  if (!caja) return;
  const KMa = window.KlendarMarcas;
  let st = estado;
  if (!st) {
    try { st = await rpc('business_crowd_status', { p_business: BIZ.id }); } catch { st = null; }
  }
  if (!KMa || !st || !st.enabled) { caja.innerHTML = ''; return; }
  const M = KMa.t(I18N.lang);
  // Cerrado, lo marcado en las últimas 2 horas también sale marcado: se
  // verá al abrir (si no, el botón parecía no hacer nada). Como la app.
  const reciente = st.set_at && Date.now() - new Date(st.set_at).getTime() < 2 * 3600 * 1000;
  const actual = st.live || (!st.open_now && reciente) ? st.level : null;
  const linea = !st.open_now ? bi('Ahora estás cerrado: no se ve hasta que abras.', "You're closed now: it won't show until you open.")
    : actual && st.set_at ? bi(`Marcado ${KMa.hace(st.set_at, 'es')}. Se quita solo a las 2 horas.`, `Set ${KMa.hace(st.set_at, 'en')}. Clears itself after 2 hours.`)
      : st.level ? bi('Lo último que marcaste ya no se ve: ha pasado más de 2 horas.', "What you last set no longer shows: it's been over 2 hours.")
        : bi('Sin marcar: en tu ficha no sale nada.', 'Not set: nothing shows on your page.');
  caja.innerHTML = `<div class="card aforo"><div class="aforo-cab"><h2>${esc(M.crowdTitle)}</h2>
      ${st.level ? `<button type="button" class="linkbtn" data-aforo="">${esc(bi('Quitar', 'Clear'))}</button>` : ''}</div>
    <div class="aforo-botones" role="group" aria-label="${esc(M.crowdTitle)}">
      ${KMa.CROWD.map((l) => `<button type="button" class="btn${actual === l ? ' on' : ''}" data-aforo="${l}" aria-pressed="${actual === l}">${esc(M.crowd[l])}</button>`).join('')}
    </div>
    <p class="muted" style="margin:8px 0 0">${esc(linea)}</p></div>`;
  $$('[data-aforo]', caja).forEach((b) => {
    b.onclick = async () => {
      const nivel = b.dataset.aforo || null;
      $$('[data-aforo]', caja).forEach((x) => { x.disabled = true; });
      try {
        const nuevo = await rpc('set_business_crowd', { p_business: BIZ.id, p_level: nivel });
        toast(nivel ? bi(`Marcado: ${M.crowd[nivel]}`, `Set: ${M.crowd[nivel]}`) : bi('Quitado', 'Cleared'));
        pintaAforo(caja, nuevo);
      } catch (e) {
        toast(friendly(e.message), true);
        $$('[data-aforo]', caja).forEach((x) => { x.disabled = false; });
      }
    };
  });
}

// ── Publicaciones ───────────────────────────────────────────────────────────
PAGES.publicaciones = async (v, param) => {
  if (!gestiona() && (param === 'nueva-flash' || param === 'nuevo-evento')) {
    v.innerHTML = '<div class="card"><p style="margin:0">Publicar es cosa de quien lleva el negocio. Tú puedes <a class="link" href="#/validar">validar códigos</a>.</p></div>';
    I18N.translate(v);
    return;
  }
  // «Crear a partir de esta» (?from=) y «Repetir mañana» (?from=&repeat=1),
  // como en la app.
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const desde = q.get('from') ? { from: q.get('from'), repeat: q.get('repeat') === '1' } : null;
  if (q.get('rrpp') === '1') { const d = desde || {}; d.rrpp = true; return offerForm(v, null, param === 'nuevo-evento' ? 'future_event' : 'flash_offer', d.from ? d : { rrpp: true }); }
  if (param === 'nueva-flash') return offerForm(v, null, 'flash_offer', desde);
  if (param === 'nuevo-evento') return offerForm(v, null, 'future_event', desde);
  if (param) return offerForm(v, param);

  const [offersRaw, otros] = await Promise.all([
    rpc('my_business_offers', { p_id: BIZ.id }),
    rpc('my_publishable_businesses', { p_except: BIZ.id }).catch(() => []),
    portadaNegocio(),
  ]);
  const offers = offersRaw || [];
  OTROS_LOCALES = otros || [];
  v.innerHTML = `
    <div class="page-head"><h1>Publicaciones</h1><span class="spacer"></span>
      ${gestiona() ? `<a class="btn sm" href="#/publicaciones/nueva-flash">${ms('bolt')}Nueva oferta flash</a>
      <a class="btn sm" href="#/publicaciones/nuevo-evento">${ms('event')}Nuevo evento</a>` : ''}
      <button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Oferta o evento?', bi('<p><b>Oferta flash</b>: algo que se canjea hoy, con cuenta atrás y aforo («café + tostada 2,50 € hasta mediodía»). <b>Evento</b>: algo con fecha, que se guarda en la agenda y puede admitir reserva de plaza.</p>',
      '<p><b>Flash offer</b>: something redeemed today, with a countdown and a limit (“coffee + toast €2.50 until noon”). <b>Event</b>: something with a date, which people save to their agenda and where people can reserve a place.</p>'))}
    <div class="pubs-barra"><div id="filtroArch"></div><div id="vistaSw"></div></div>
    <div id="list"></div>
    <div id="rules"></div>`;
  // Las archivadas (se borraron con canjes validados) no salen en «Todas»:
  // solo con el filtro «Archivadas», para ver sus cifras o crear otra a
  // partir de ellas. No se editan ni se vuelven a publicar.
  const archivadas = offers.filter((o) => o.status === 'archived');
  // Filtro por estado (como en la app: activa, programada, borrador, en
  // revisión, agotada, terminada, archivada) y la vista: las tarjetas que verá
  // la gente o la lista de siempre (más densa). La vista se recuerda.
  const qf = new URLSearchParams(location.hash.split('?')[1] || '').get('estado');
  let filtro = FILTROS_PUB.some(([k]) => k === qf) ? qf : 'todas';
  let vista = 'tarjetas';
  try { vista = localStorage.getItem('klendar.panel.vista') === 'lista' ? 'lista' : 'tarjetas'; } catch { /* sin permisos */ }

  // Lo que se repite solo vive en «Series y repeticiones» (panel/series.js):
  // aquí, solo cuántas hay y el enlace.
  const renderRules = async () => {
    const reglas = (await rpc('my_offer_rules', { p_business: BIZ.id })) || [];
    if (!$('#rules')) return;
    $('#rules').innerHTML = reglas.length ? `<p class="muted small">${esc(bi(`${reglas.length === 1 ? '1 publicación se repite sola' : `${reglas.length} publicaciones se repiten solas`}: las ves en «Series y repeticiones».`,
      `${reglas.length === 1 ? '1 publication repeats' : `${reglas.length} publications repeat`} automatically: see them in “Series and repeats”.`))} <a class="link" href="#/series">${esc(bi('Abrir', 'Open'))}</a></p>` : '';
  };

  async function repetirDialogo(offerId) {
    const o = offers.find((x) => x.id === offerId) || {};
    const evento = o.kind === 'future_event';
    const ini = evento ? o.event_at : o.redeem_start_at;
    const fin = evento ? o.event_end_at : o.redeem_end_at;
    const hIni = ini ? partesNegocio(new Date(ini)) : null;
    const diaIni = ini ? new Date(new Date(ini).toLocaleString('en-US', { timeZone: TZ })).getDay() : null;
    const durIni = ini && fin ? Math.round((new Date(fin) - new Date(ini)) / 6e4) : null;
    const durOpts = [['60', '1 hora'], ['120', '2 horas'], ['180', '3 horas'], ['240', '4 horas'], ['480', 'Toda la tarde (8 h)']];
    if (durIni && durIni >= 15 && durIni <= 1440 && !durOpts.some((d) => Number(d[0]) === durIni)) {
      durOpts.push([String(durIni), `${Math.round(durIni / 6) / 10} h`]);
      durOpts.sort((a, b) => Number(a[0]) - Number(b[0]));
    }
    const r = await modal({
      title: 'Repetir cada semana',
      intro: evento
        ? bi(`«${esc(o.title || '')}» se publicará sola una semana antes de cada fecha, a la misma hora, con su aforo y sus reservas. Puedes pausarla cuando quieras.`,
          `“${esc(o.title || '')}” will be posted automatically a week before each date, at the same time, with its capacity and bookings. You can pause it whenever you like.`)
        : bi(`«${esc(o.title || '')}» se publicará sola los días y la hora que elijas, con su cuenta atrás y su aforo. Puedes pausarla cuando quieras.`,
          `“${esc(o.title || '')}” will be posted on its own on the days and at the time you choose, with its countdown and its limit. You can pause it whenever you like.`),
      submit: 'Crear la repetición',
      // Cualquier combinación de días, como en la app (de lunes a domingo).
      fields: [
        ...[[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']]
          .map(([d, n]) => ({ name: `d${d}`, type: 'checkbox', label: n, value: evento && diaIni != null ? d === diaIni : d >= 1 && d <= 5 })),
        { name: 'hora', type: 'time', label: '¿A qué hora empieza?', required: true,
          value: hIni ? `${String(hIni.h).padStart(2, '0')}:${String(hIni.min).padStart(2, '0')}` : '17:00' },
        { name: 'duracion', type: 'select', label: '¿Cuánto dura?', value: durIni && durOpts.some((d) => Number(d[0]) === durIni) ? String(durIni) : '120', options: durOpts },
      ],
    });
    if (!r) return;
    const dias = [0, 1, 2, 3, 4, 5, 6].filter((d) => r[`d${d}`]);
    if (!dias.length) { toast('Marca al menos un día.', true); return; }
    try {
      await rpc('save_offer_rule', {
        p_business: BIZ.id, p_offer: offerId, p_weekdays: dias,
        p_start_time: r.hora, p_duration_min: Number(r.duracion),
      });
      toast('Se repetirá sola');
      renderRules();
    } catch (e) { toast(friendly(e.message), true); }
  }

  const render = () => {
    // Un botón por estado que tenga alguna (las archivadas, solo aquí).
    const cuenta = (k) => offers.filter((o) => enFiltro(o, k)).length;
    const chips = FILTROS_PUB.filter(([k]) => k === 'todas' || cuenta(k) > 0);
    if (!chips.some(([k]) => k === filtro)) filtro = 'todas';
    $('#filtroArch').innerHTML = chips.length > 1 ? `<div class="pills" role="group" aria-label="${esc(I18N.t('Filtrar por estado'))}">
      ${chips.map(([k, nombre]) => `<button type="button" data-filtro="${k}" class="${filtro === k ? 'on' : ''}" aria-pressed="${filtro === k}" translate="no">${esc(nombre)} <span class="n">${fmtNum(cuenta(k))}</span></button>`).join('')}
    </div>${filtro === 'archivada' ? `<p class="hint" style="margin:10px 0 0">${esc(I18N.t('Se borraron con canjes validados: ya no se ven en ninguna parte, pero siguen contando en el Informe.'))}</p>` : ''}` : '';
    $$('[data-filtro]', $('#filtroArch')).forEach((b) => {
      b.onclick = () => { filtro = b.dataset.filtro; render(); $(`[data-filtro="${filtro}"]`, $('#filtroArch'))?.focus(); };
    });
    $('#vistaSw').innerHTML = offers.length ? `<div class="pills vista-sw" role="group" aria-label="${esc(I18N.t('Cómo verlas'))}">
      <button type="button" data-vista="tarjetas" class="${vista === 'tarjetas' ? 'on' : ''}" aria-pressed="${vista === 'tarjetas'}">${svg('rejilla', 18)}${esc(I18N.t('Tarjetas'))}</button>
      <button type="button" data-vista="lista" class="${vista === 'lista' ? 'on' : ''}" aria-pressed="${vista === 'lista'}">${svg('lista', 18)}${esc(I18N.t('Lista'))}</button></div>` : '';
    $$('[data-vista]', $('#vistaSw')).forEach((b) => {
      b.onclick = () => {
        vista = b.dataset.vista;
        try { localStorage.setItem('klendar.panel.vista', vista); } catch { /* sin permisos */ }
        render(); $(`[data-vista="${vista}"]`, $('#vistaSw'))?.focus();
      };
    });
    const filas = offers.filter((o) => enFiltro(o, filtro));
    $('#list').innerHTML = !offers.length
      ? `<div class="card sin-pubs"><h2>${esc(I18N.t('Todavía no has publicado nada.'))}</h2>
          <p class="muted">${esc(I18N.t('Lo que publiques sale aquí con la misma tarjeta que verá la gente, con su estado y sus cifras.'))}</p>
          ${gestiona() ? `<p class="actions" style="margin:12px 0 0"><a class="btn primary" href="#/publicaciones/nueva-flash">${ms('bolt')}${esc(I18N.t('Nueva oferta flash'))}</a>
          <a class="btn" href="#/publicaciones/nuevo-evento">${ms('event')}${esc(I18N.t('Nuevo evento'))}</a></p>` : ''}</div>`
      : vista === 'lista' ? tablaPublicaciones(filas) : tarjetasPublicaciones(filas);
    activaVideos($('#list'));
    $$('[data-act]', $('#list')).forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.id;
        try {
          if (b.dataset.act === 'serie') {
            await serieDialogo(offers.find((x) => x.id === id) || { id });
            return;
          }
          if (b.dataset.act === 'repeat') {
            await repetirDialogo(id);
            return;
          }
          if (b.dataset.act === 'extend') {
            await ampliarDialogo(offers.find((x) => x.id === id));
            return;
          }
          if (b.dataset.act === 'stats') {
            await cifrasDialogo(offers.find((x) => x.id === id));
            return;
          }
          if (b.dataset.act === 'locales') {
            await localesDialogo(id);
            return;
          }
          if (b.dataset.act === 'delete') {
            // Con canjes validados la base no la borra: la archiva (los canjes
            // son del negocio y cuentan en el Informe). Se dice antes.
            const conCanjes = (offers.find((x) => x.id === id)?.redemptions_count || 0) > 0;
            if (!await confirmDlg('Borrar publicación', conCanjes
              ? 'Tiene canjes validados, así que no se borra: se archiva. Deja de verse, sigue contando en el Informe y puedes crear otra a partir de ella.'
              : 'Se borra para siempre, junto con sus estadísticas. Si solo quieres que deje de verse, púlsale a «Pausar».', { danger: true, submit: 'Borrar' })) return;
            const { error } = await sb.from('offers').delete().eq('id', id);
            if (error) {
              // Con gente que tiene reserva la base no deja borrar (perdería su
              // código sin enterarse): se ofrece cancelarla y avisarles.
              if (!String(error.message).includes('offer_has_reservations')) throw error;
              if (!await confirmDlg('Hay gente con reserva', 'No se puede borrar mientras alguien tenga reserva: perdería su código sin enterarse. Si la cancelas, anulamos las reservas y avisamos a cada persona.', { danger: true, submit: 'Cancelar publicación' })) return;
              const r = await rpc('cancel_offer', { p_offer: id });
              if (!r?.ok) throw new Error(r?.error || 'unknown');
              const en = I18N.lang === 'en';
              toast(r.notified === 1
                ? (en ? 'Publication cancelled. We told the person who had booked.' : 'Publicación cancelada. Hemos avisado a la persona que tenía reserva.')
                : r.notified > 1
                  ? (en ? `Publication cancelled. We told the ${r.notified} people who had booked.` : `Publicación cancelada. Hemos avisado a las ${r.notified} personas con reserva.`)
                  : (en ? 'Publication cancelled.' : 'Publicación cancelada.'));
              route();
              return;
            }
            if (conCanjes) { toast('Archivada'); route(); return; }
          } else {
            // Pausar con gente que tiene reserva o código: la base les avisa;
            // el negocio lo sabe antes.
            const o = offers.find((x) => x.id === id);
            if (b.dataset.act === 'pause' && o?.pending_count > 0
              && !await confirmaAvisos(o.pending_count, o.kind === 'future_event', ['pausa'], bi('¿Pausar la publicación?', 'Pause the publication?'), 'Pausar')) return;
            const { error } = await sb.from('offers').update({ status: b.dataset.act === 'pause' ? 'draft' : 'active' }).eq('id', id);
            if (error) throw error;
          }
          toast('Hecho');
          route();
        } catch (e) { toast(friendly(e.message), true); }
      };
    });
  };
  $('#csv').onclick = () => downloadCsv(`klendar-${BIZ.name}`, offers, [
    ['title', 'publicación'], [(o) => I18N.t(LABELS[o.kind]), 'tipo'], [(o) => I18N.t(LABELS[estadoVisible(o)]), 'estado'],
    ['views', 'vistas'], ['redemptions_count', 'canjes'], ['max_redemptions', 'aforo'], [(o) => plazasOcupadas(o), 'plazas ocupadas'],
    [(o) => o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at, 'cuándo'],
  ]);
  render();
  if (gestiona()) renderRules().catch((e) => toast(friendly(e.message), true));
  // Desde el aviso «tu oferta termina en 1 h» (Tu cuenta → notificaciones).
  const qx = new URLSearchParams(location.hash.split('?')[1] || '');
  const aAmpliar = qx.get('extend') && offers.find((x) => x.id === qx.get('extend'));
  if (aAmpliar) {
    history.replaceState(null, '', `${location.pathname}#/publicaciones`);
    ampliarDialogo(aAmpliar);
  }
};

/** Quién ve una publicación (`offers.audience`), las mismas palabras que la
 * app. «Todo el mundo» es lo normal y no lleva etiqueta. */
const AUDIENCIAS = [
  ['all', 'Todo el mundo'],
  ['favorites', 'Solo quien tiene tu negocio en favoritos'],
  ['customers', 'Solo clientes con sellos en alguna de tus tarjetas'],
  // Solo por el enlace o el QR de un RRPP (panel/rrpp.js).
  ['promoters', bi('Solo con el enlace de un RRPP', "Only through a promoter's link")],
];
const etiquetaAudiencia = (o) => (o?.audience === 'favorites' ? ` <span class="tag dim">${esc(I18N.t('Para favoritos'))}</span>`
  : o?.audience === 'customers' ? ` <span class="tag dim">${esc(I18N.t('Para clientes'))}</span>`
    : o?.audience === 'promoters' ? ` <span class="tag rrpp-tag">${esc(bi('Oferta de RRPP', 'Promoter offer'))}</span>` : '');

/** Plazas ocupadas (personas) de una publicación con aforo: lo que dice la
 * base (`seats_left`, según guarde plaza o vaya por orden de llegada) o, con
 * una respuesta antigua, la cuenta de códigos. */
function plazasOcupadas(o) {
  if (o.max_redemptions == null) return null;
  if (o.seats_left != null) return Math.max(0, o.max_redemptions - o.seats_left);
  return o.redemptions_count + (o.holds_seats === false ? 0 : (o.pending_count || 0));
}
const plazasTxt = (o, n) => `${fmtNum(n)}/${fmtNum(o.max_redemptions)}`;

// ── La tarjeta que verá la gente, en el panel ──────────────────────────────
/** La portada del local (la tarjeta la usa si la publicación no trae fotos,
 * como la base). Se lee una vez por negocio. */
async function portadaNegocio() {
  if (BIZ._portada !== undefined) return BIZ._portada;
  try {
    const { data } = await sb.from('businesses').select('cover_image_url').eq('id', BIZ.id).maybeSingle();
    BIZ._portada = data?.cover_image_url || null;
  } catch { BIZ._portada = null; }
  return BIZ._portada;
}
/** Una fila de `my_business_offers` con lo que la tarjeta pública saca del
 * negocio (nombre, logo y portada). */
const conNegocio = (o) => ({ ...o, business_name: BIZ.name, business_logo: BIZ.logo, business_cover: BIZ._portada || null });
/** La tarjeta, en el idioma del panel y en la hora del local. Va dentro de
 * `.tjv` (los estilos de /assets/tarjeta.css) y con `translate="no"`: ya sale
 * en su idioma y el título lo ha escrito el negocio. */
const tarjetaPanel = (o, opts = {}) => KT.tarjeta(conNegocio(o), I18N.lang === 'en' ? 'en' : 'es', { tz: TZ, h: 'h2', ...opts });
/** A dónde lleva la tarjeta de una publicación: a editarla o, a quien no
 * publica (o si está archivada), a su ficha. Una oferta de RRPP no tiene
 * ficha pública (sin el enlace de un RRPP no se abre): a la sección RRPP,
 * con sus enlaces, o se queda en Publicaciones. */
const hrefPub = (o) => (gestiona() && o.status !== 'archived' ? `#/publicaciones/${o.id}`
  : o.audience !== 'promoters' ? `/o/${o.id}`
    : gestiona() ? '#/rrpp' : '#/publicaciones');
/** Los vídeos de las tarjetas: el primer fotograma (o la portada) y, si
 * `mover`, en marcha y en silencio (nunca con «reducir movimiento»). */
function activaVideos(caja, mover = false) {
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const vid of $$('video[data-src]', caja)) {
    if (!vid.getAttribute('src')) vid.setAttribute('src', vid.dataset.src);
    vid.muted = true;
    if (mover && !quieto) vid.play?.().catch(() => { /* se queda la portada */ });
  }
}

/** El estado de una publicación, uno solo y en el orden de la app
 * (`business_dashboard_screen`): archivada, rechazada, en revisión, borrador
 * (o programada, si tiene hora de publicarse), cancelada, terminada, agotada
 * y activa. */
function estadoPub(o) {
  if (o.status === 'archived') return 'archivada';
  if (o.moderation_status === 'rejected') return 'rechazada';
  if (o.moderation_status === 'pending') return 'revision';
  if (o.status === 'draft') return o.publish_at && new Date(o.publish_at) > new Date() ? 'programada' : 'borrador';
  if (o.status === 'cancelled') return 'cancelada';
  if (estadoVisible(o) === 'expired') return 'terminada';
  if (o.status === 'sold_out' || (o.seats_left != null && o.seats_left <= 0)) return 'agotada';
  return 'activa';
}
/** Estado → [nombre, clase de la etiqueta]. Las mismas palabras que la app. */
const ESTADOS_PUB = {
  activa: [bi('Activa', 'Active'), 'st-active'],
  programada: [bi('Programada', 'Scheduled'), 'st-scheduled'],
  borrador: [bi('Borrador', 'Draft'), 'st-draft'],
  revision: [bi('En revisión', 'In review'), 'st-pending'],
  rechazada: [bi('Rechazada', 'Rejected'), 'st-rejected'],
  agotada: [bi('Agotada', 'Sold out'), 'st-sold_out'],
  terminada: [bi('Terminada', 'Ended'), 'st-expired'],
  cancelada: [bi('Cancelada', 'Cancelled'), 'st-cancelled'],
  archivada: [bi('Archivada', 'Archived'), 'st-archived'],
};
/** Los filtros de «Tus publicaciones»: [clave, nombre]. */
const FILTROS_PUB = [
  ['todas', bi('Todas', 'All')],
  ['activa', bi('Activas', 'Active')],
  ['programada', bi('Programadas', 'Scheduled')],
  ['borrador', bi('Borradores', 'Drafts')],
  ['revision', bi('En revisión', 'In review')],
  ['rechazada', bi('Rechazadas', 'Rejected')],
  ['agotada', bi('Agotadas', 'Sold out')],
  ['terminada', bi('Terminadas', 'Ended')],
  ['archivada', bi('Archivadas', 'Archived')],
];
const enFiltro = (o, k) => (k === 'todas' ? o.status !== 'archived'
  : k === 'terminada' ? ['terminada', 'cancelada'].includes(estadoPub(o)) : estadoPub(o) === k);
const etiquetaEstado = (o) => {
  const [nombre, cls] = ESTADOS_PUB[estadoPub(o)];
  const cuando = estadoPub(o) === 'programada' ? ` · ${fmtDate(o.publish_at)}` : '';
  return `<span class="tag ${cls}" translate="no">${esc(nombre)}${esc(cuando)}</span>`;
};
/** Las cifras de un vistazo: vistas, canjes, plazas, reservas y lista de espera. */
function cifrasRapidas(o) {
  const v = o.views || 0;
  const c = o.redemptions_count || 0;
  const partes = [
    esc(bi(`${fmtNum(v)} ${v === 1 ? 'vista' : 'vistas'}`, `${fmtNum(v)} ${v === 1 ? 'view' : 'views'}`)),
    esc(bi(`${fmtNum(c)} ${c === 1 ? 'canje' : 'canjes'}`, `${fmtNum(c)} ${c === 1 ? 'redemption' : 'redemptions'}`)),
  ];
  if (o.max_redemptions != null) partes.push(esc(bi(`${plazasTxt(o, plazasOcupadas(o))} plazas`, `${plazasTxt(o, plazasOcupadas(o))} places`)));
  if (o.kind === 'future_event' && o.reservations_enabled && o.reserved_seats) partes.push(esc(bi(`${fmtNum(o.reserved_seats)} ${o.reserved_seats === 1 ? 'reservada' : 'reservadas'}`, `${fmtNum(o.reserved_seats)} reserved`)));
  if (o.waitlist_count) partes.push(esc(bi(`${fmtNum(o.waitlist_count)} en lista de espera`, `${fmtNum(o.waitlist_count)} on the waiting list`)));
  if (o.views >= 20 && o.redemptions_count) {
    const c = (o.redemptions_count / o.views * 100).toLocaleString(LOC(), { maximumFractionDigits: 1 });
    partes.push(esc(bi(`${c} % de conversión`, `${c}% conversion`)));
  }
  return `<p class="pub-cifras" translate="no">${partes.join('<span aria-hidden="true"> · </span>')}</p>`;
}
/** Las acciones de una publicación (las mismas en las tarjetas y en la lista). */
function accionesPub(o) {
  const crear = `#/publicaciones/${o.kind === 'flash_offer' ? 'nueva-flash' : 'nuevo-evento'}?from=${esc(o.id)}`;
  const asistentes = o.kind === 'future_event' && o.reservations_enabled ? `<a class="btn sm ghost" href="#/asistentes/${esc(o.id)}">Asistentes</a>` : '';
  // Archivada: solo sus cifras y, a quien publica, crear otra igual.
  if (o.status === 'archived') {
    return `<div class="actions"><button type="button" class="btn sm ghost" data-act="stats" data-id="${esc(o.id)}">Cifras</button>${gestiona() ? `<a class="btn sm ghost" href="${crear}">Crear a partir de esta</a>` : ''}</div>`;
  }
  if (!gestiona()) return `<div class="actions"><button type="button" class="btn sm ghost" data-act="stats" data-id="${esc(o.id)}">Cifras</button>${asistentes}</div>`;
  return `<div class="actions">
    <a class="btn sm" href="#/publicaciones/${esc(o.id)}">Editar</a>
    <button type="button" class="btn sm ghost" data-act="stats" data-id="${esc(o.id)}">Cifras</button>
    ${asistentes}
    ${estadoVisible(o) === 'active' ? `<button type="button" class="btn sm ghost" data-act="pause" data-id="${esc(o.id)}">Pausar</button>` : o.status === 'draft' ? `<button type="button" class="btn sm ghost" data-act="activate" data-id="${esc(o.id)}">Activar</button>` : ''}
    <details class="mas"><summary class="btn sm ghost">Más</summary><div class="mas-menu">
      <a href="${crear}">Crear a partir de esta</a>
      ${o.kind === 'flash_offer' && o.status === 'active' && new Date(o.redeem_end_at) > new Date() ? `<button type="button" data-act="extend" data-id="${esc(o.id)}">Ampliar 1 h</button>` : ''}
      ${o.status === 'sold_out' || estadoVisible(o) === 'expired' ? `<a href="${crear}&repeat=1">${o.kind === 'flash_offer' ? 'Repetir mañana' : 'Repetir'}</a>` : ''}
      <button type="button" data-act="repeat" data-id="${esc(o.id)}">Repetir cada semana…</button>
      ${o.status !== 'cancelled' ? `<button type="button" data-act="serie" data-id="${esc(o.id)}">${esc(bi('Serie…', 'Series…'))}</button>` : ''}
      ${OTROS_LOCALES.length ? `<button type="button" data-act="locales" data-id="${esc(o.id)}">Publicar en otros locales…</button>` : ''}
      ${o.audience === 'promoters' ? '' : `<a href="${I18N.lang === 'en' ? '/en/poster/' : '/cartel/'}${esc(o.id)}" target="_blank" rel="noopener">Cartel para imprimir</a>`}
      <button type="button" class="bad" data-act="delete" data-id="${esc(o.id)}">Borrar</button>
    </div></details>
  </div>`;
}
/** «Tus publicaciones» en tarjetas: la misma que verá la gente y, debajo,
 * su estado, sus cifras y lo que se puede hacer con ella. Pulsar la tarjeta
 * la edita (o, a quien no publica, abre su ficha). */
const tarjetasPublicaciones = (rows) => `<div class="pubs">${rows.map((o) => `
  <div class="pub-item pub-${estadoPub(o)}">
    <div class="tjv" translate="no">${tarjetaPanel(o, { href: hrefPub(o) })}</div>
    <div class="pub-meta">
      <p class="pub-estado">${etiquetaEstado(o)}${etiquetaAudiencia(o)}${o.adults_only ? ' <span class="tag dim">+18</span>' : ''}</p>
      ${cifrasRapidas(o)}
      ${accionesPub(o)}
    </div>
  </div>`).join('')}</div>`;
/** La lista de siempre (más densa), con las mismas acciones. */
const tablaPublicaciones = (rows) => table({
  cols: [
    { h: 'Publicación', r: (o) => `${primeraFoto(o.images) ? `<img class="thumb" src="${esc(primeraFoto(o.images))}" alt="" loading="lazy">` : `<span class="ph">${ms((o.images || []).some(esVideo) ? 'play_circle' : o.kind === 'flash_offer' ? 'bolt' : 'event')}</span>`}<b class="title" translate="no">${esc(o.title)}</b><span class="sub">${esc(I18N.t(LABELS[o.kind]))} · ${fmtDate(o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at)}${etiquetaAudiencia(o)}</span>` },
    { h: 'Estado', r: (o) => etiquetaEstado(o) },
    { h: 'Plazas', r: (o) => o.max_redemptions == null ? '—' : `<span data-plazas="${esc(o.id)}">${plazasTxt(o, plazasOcupadas(o))}</span>` },
    { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
    { h: 'Canjes', num: true, r: (o) => fmtNum(o.redemptions_count) },
    { h: '', r: (o) => accionesPub(o) },
  ],
  rows,
  empty: 'Ninguna con este filtro.',
});

/** Antes de un cambio que avisa a quien ya tiene reserva o código (fechas,
 * pausa, +18): la base les manda la notificación al guardar; el negocio lo
 * decide sabiéndolo, como con la bajada de precio. `n`: códigos vivos
 * (`offer_pending_codes` / `pending_count`); `motivos`: fechas | pausa | adultos.
 * Devuelve true si sigue adelante. */
async function confirmaAvisos(n, evento, motivos, titulo, boton) {
  const quien = evento
    ? bi(n === 1 ? '1 persona con reserva recibirá un aviso.' : `${n} personas con reserva recibirán un aviso.`,
      n === 1 ? '1 person with a booking will be notified.' : `${n} people with a booking will be notified.`)
    : bi(n === 1 ? '1 persona con código recibirá un aviso.' : `${n} personas con código recibirán un aviso.`,
      n === 1 ? '1 person with a code will be notified.' : `${n} people with a code will be notified.`);
  const QUE = evento ? {
    fechas: bi('Les avisamos del cambio de fecha; su reserva sigue valiendo y la pueden anular.',
      "We'll tell them about the new date; their booking is still valid and they can cancel it."),
    pausa: bi('Su reserva sigue valiendo; les avisamos de que está en pausa.',
      "Their booking is still valid; we'll tell them it's paused."),
    adultos: bi('Las reservas de quien no sea mayor de edad se anulan y se les avisa; al resto, que en la puerta pueden pedirle el DNI.',
      "Bookings from anyone under 18 are cancelled and they're notified; everyone else is told they may be asked for ID at the door."),
  } : {
    fechas: bi('Les avisamos del cambio de fecha; su código sigue valiendo y lo pueden anular.',
      "We'll tell them about the new date; their code is still valid and they can cancel it."),
    pausa: bi('Su código sigue valiendo; les avisamos de que está en pausa.',
      "Their code is still valid; we'll tell them it's paused."),
    adultos: bi('Los códigos de quien no sea mayor de edad se anulan y se les avisa; al resto, que en la puerta pueden pedirle el DNI.',
      "Codes from anyone under 18 are cancelled and they're notified; everyone else is told they may be asked for ID at the door."),
  };
  const html = `<p style="margin:0"><b>${esc(quien)}</b></p>${motivos.map((m) => `<p class="muted" style="margin:0">${esc(QUE[m])}</p>`).join('')}`;
  return (await modal({ title: titulo, html, submit: boton })) !== null;
}

/** «Ampliar 1 h»: con la hora nueva a la vista, como en la app. */
async function ampliarDialogo(o) {
  if (!o || !o.redeem_end_at) return;
  const hm = fmtHora;
  const nueva = new Date(new Date(o.redeem_end_at).getTime() + 36e5);
  const en = I18N.lang === 'en';
  if (!await confirmDlg(en ? 'Extend by an hour?' : '¿Ampliar una hora?',
    esc(en ? `“${o.title}” will end at ${hm(nueva)}. Anyone who already has a code can use it until then.`
      : `«${o.title}» terminará a las ${hm(nueva)}. Quien ya tenga su código lo podrá usar hasta entonces.`),
    { submit: 'Ampliar 1 h' })) return;
  const r = await rpc('extend_offer', { p_offer: o.id, p_minutes: 60 }).catch((e) => ({ ok: false, error: e.message }));
  if (!r?.ok) {
    toast(r?.error === 'already_over' ? 'Esa oferta ya ha terminado. Puedes repetirla mañana.'
      : r?.error === 'too_long' ? 'Una oferta flash dura como mucho 24 h. Para más, crea un evento o repítela otro día.'
        : r?.error === 'not_authorized' ? ERRORS.not_authorized : 'No se ha podido guardar', true);
    return;
  }
  toast(en ? `Extended until ${hm(r.redeem_end_at)}` : `Ampliada hasta las ${hm(r.redeem_end_at)}`);
  route();
}

/** «Cifras» de una publicación: los últimos 14 días, cómo va frente a las
 * demás del negocio y, en eventos con reserva, la asistencia. Lo mismo que la
 * hoja de estadísticas de la app. */
async function cifrasDialogo(o) {
  if (!o) return;
  const [dias, bench, asis] = await Promise.all([
    rpc('offer_daily_stats', { p_offer: o.id, p_days: 14 }).catch(() => []),
    rpc('offer_benchmark', { p_offer: o.id }).catch(() => null),
    o.kind === 'future_event' && o.reservations_enabled
      ? rpc('offer_attendance', { p_offer: o.id }).catch(() => null) : Promise.resolve(null),
  ]);
  const d = dias || [];
  const vistas = d.reduce((a, x) => a + (x.views || 0), 0);
  const canjes = d.reduce((a, x) => a + (x.redemptions || 0), 0);
  const conv = vistas ? `${(canjes / vistas * 100).toFixed(1).replace('.', I18N.lang === 'en' ? '.' : ',')} %` : '—';
  const max = Math.max(1, ...d.map((x) => x.views || 0));
  // `day` es una fecha sin hora («2026-09-27»): se lee tal cual, sin zona.
  const dia = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00Z`).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  let comparativa = '';
  if (bench && bench.conversion != null && bench.business_avg && bench.compared_with >= 2) {
    const delta = Math.round(((bench.conversion - bench.business_avg) / bench.business_avg) * 100);
    const en = I18N.lang === 'en';
    comparativa = delta >= 0
      ? (en ? `Doing ${delta}% better than your average.` : `Va un ${delta} % mejor que tu media.`)
      : (en ? `Doing ${-delta}% below your average.` : `Va un ${-delta} % por debajo de tu media.`);
  }
  const hora = bench?.best_hours?.[0]?.hour;
  const pad = (n) => String(n).padStart(2, '0');
  const html = `
    <div class="kpis">
      <div class="kpi"><b>${fmtNum(vistas)}</b><span>Vistas</span></div>
      <div class="kpi"><b>${fmtNum(canjes)}</b><span>Canjes</span></div>
      <div class="kpi"><b>${conv}</b><span>Conversión</span></div>
    </div>
    <h3 style="margin:6px 0 0">Últimos 14 días</h3>
    ${vistas ? `<div class="spark">${d.map((x) => `<i title="${esc(dia(x.day))}: ${x.views} · ${x.redemptions}" style="height:${Math.round((x.views / max) * 100)}%"><u style="height:${x.views ? Math.round((x.redemptions / Math.max(x.views, 1)) * 100) : 0}%"></u></i>`).join('')}</div>`
      : '<p class="muted" style="margin:0">Todavía nadie la ha visto. En cuanto lleguen visitas y canjes, los verás aquí día a día.</p>'}
    ${comparativa ? `<p style="margin:0">${esc(comparativa)}</p>` : ''}
    ${hora != null ? `<p class="muted" style="margin:0">${I18N.lang === 'en'
      ? `Your busiest time for redemptions is ${pad(hora)}:00–${pad((hora + 1) % 24)}:00.`
      : `Donde más te canjean es entre las ${pad(hora)}:00 y las ${pad((hora + 1) % 24)}:00.`}</p>` : ''}
    ${asis ? `<h3 style="margin:6px 0 0">Asistencia</h3>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(asis.reserved)}</b><span>Reservas</span></div>
        <div class="kpi"><b>${fmtNum(asis.attended)}</b><span>Han entrado</span></div>
        ${asis.expected_cents ? `<div class="kpi"><b>${fmtMoney(asis.expected_cents)}</b><span>Si viene todo el mundo</span></div>` : ''}
      </div>
      <p class="muted" style="margin:0">${asis.waitlist ? `${fmtNum(asis.waitlist)} ${I18N.lang === 'en' ? 'on the waiting list' : 'en lista de espera'} · ` : ''}${esc(I18N.t('El cobro es tuyo, en la puerta: aquí solo contamos plazas a precio de tarifa.'))}</p>` : ''}
    ${vistas ? '<p style="margin:0"><button type="button" class="btn sm" data-csvdia>Exportar CSV</button></p>' : ''}`;
  const abierto = modal({ title: o.title, html, submit: 'Cerrar', cancel: '' });
  I18N.translate($('#modal'));
  const csv = $('#modal [data-csvdia]');
  if (csv) {
    csv.onclick = () => downloadCsv(`klendar-${o.title}-diario`, d, [
      [(x) => String(x.day).slice(0, 10), 'día'], ['views', 'vistas'], ['redemptions', 'canjes'],
    ]);
  }
  await abierto;
}

/** Los otros locales que lleva quien ha entrado. Se llena al abrir
 * Publicaciones; si solo tienes uno, el botón ni aparece. */
let OTROS_LOCALES = [];

/** «En otros locales…»: copiar la misma publicación a los que elijas.
 *
 * Cada copia es una publicación de verdad, con la dirección de su local, sus
 * códigos y sus cifras. El QR de la calle Mayor no puede valer en la
 * sucursal de al lado. */
async function localesDialogo(offerId) {
  const r = await modal({
    title: 'Publicar también en…',
    intro: 'Se crea una copia en cada local que marques, con su dirección y su propio código. Las cifras de cada uno van por separado.',
    fields: OTROS_LOCALES.map((b) => ({
      name: `b_${b.id}`,
      type: 'checkbox',
      value: false,
      label: [b.name, b.address, b.city].filter(Boolean).join(' · ')
        + (b.verification_status !== 'verified' ? bi(' (sin verificar todavía)', ' (not verified yet)') : ''),
    })),
    submit: 'Copiar',
  });
  if (!r) return;
  const elegidos = OTROS_LOCALES.map((b) => b.id).filter((id) => r[`b_${id}`]);
  if (!elegidos.length) return;

  const res = await rpc('copy_offer_to_businesses', { p_offer: offerId, p_businesses: elegidos })
    .catch((e) => ({ ok: false, error: e.message }));
  if (!res?.ok) { toast(res?.error ? friendly(res.error) : 'No se ha podido copiar', true); return; }

  const fallos = res.failed || [];
  if (res.copies && !fallos.length) {
    toast(res.copies === 1 ? 'Copiada en 1 local' : bi(`Copiada en ${res.copies} locales`, `Copied to ${res.copies} venues`));
  } else if (res.copies) {
    toast(bi(`Copiada en ${res.copies}; ${fallos.length} no se han podido`, `Copied to ${res.copies}; ${fallos.length} failed`), true);
  } else {
    // El caso más común y el más útil de explicar: una publicación vieja con
    // un −X % a la que le falta el precio anterior que exige la ley.
    const motivo = fallos[0]?.error || '';
    toast(motivo === 'prior_price_required'
      ? 'Añade el precio anterior a la publicación antes de copiarla'
      : motivo === 'already_copied' ? 'Ya estaba copiada en ese local'
        : 'No se ha podido copiar', true);
  }
  route();
}

/** «¿Para niños?» → `offers.for_kids`: null (como el local), true o false.
 * Con +18 nunca true. */
const forKids = (adultos, valor) => (valor === 'no' ? false : valor === 'si' && !adultos ? true : null);

/** Formulario de publicación (nueva o existente). */
async function offerForm(v, id, kindDefault, desde = null) {
  // Un empleado valida códigos, no publica (como en la app).
  if (!gestiona()) {
    v.innerHTML = `<div class="card"><p class="muted" style="margin:0">${esc(I18N.t('Solo el propietario y los encargados pueden crear o editar publicaciones.'))}</p></div>`;
    return;
  }
  let o = { kind: kindDefault || 'flash_offer', max_per_user: 1, code_ttl_minutes: 5, images: [], status: 'active',
    ...(desde?.rrpp ? { audience: 'promoters' } : {}) };
  // La vista previa usa la portada del local si la publicación no trae fotos.
  await portadaNegocio();
  if (id) {
    const all = await rpc('my_business_offers', { p_id: BIZ.id });
    o = all.find((x) => x.id === id) || o;
  } else if (!desde?.from) {
    // Como la app: una oferta flash empieza ya y dura 3 h; un evento, mañana
    // a las 20:00. Se cambia en un momento; un formulario en blanco frena.
    // Desde el calendario (?dia=AAAA-MM-DD), ese día: la oferta a las 18:00
    // (o ya, si es hoy) y el evento a las 20:00, en la hora del local.
    const ahora = new Date(); ahora.setSeconds(0, 0);
    const pedido = (/[?&]dia=(\d{4}-\d{2}-\d{2})\b/.exec(location.hash) || [])[1];
    const enDia = pedido && pedido > KZ.hoy(TZ) ? pedido.split('-').map(Number) : null;
    if (o.kind === 'flash_offer') {
      const ini = enDia ? KZ.instante(TZ, enDia[0], enDia[1], enDia[2], 18) : ahora;
      o.redeem_start_at = ini.toISOString();
      o.redeem_end_at = new Date(ini.getTime() + 3 * 36e5).toISOString();
    } else {
      o.event_at = (enDia ? KZ.instante(TZ, enDia[0], enDia[1], enDia[2], 20) : enDiasNegocio(pedido === KZ.hoy(TZ) ? 0 : 1, 20)).toISOString();
    }
  }
  if (!id && desde?.from) {
    // Nueva, rellena con otra: textos, fotos, precio, aforo y diseño. Las
    // fechas no (siempre cambian), salvo «Repetir mañana»: a la misma hora.
    const all = await rpc('my_business_offers', { p_id: BIZ.id });
    const src = all.find((x) => x.id === desde.from);
    if (src) {
      o = { ...src, id: undefined, status: 'active', publish_at: null };
      if (desde.repeat && src.kind === 'flash_offer' && src.redeem_start_at) {
        // Mañana (de hoy) a la misma hora del negocio y con la misma duración.
        const ini = new Date(src.redeem_start_at);
        const dura = src.redeem_end_at ? new Date(src.redeem_end_at) - ini : 3 * 36e5;
        const hora = partesNegocio(ini);
        const nuevo = enDiasNegocio(1, hora.h, hora.min);
        o.redeem_start_at = nuevo.toISOString();
        o.redeem_end_at = new Date(nuevo.getTime() + dura).toISOString();
      } else {
        o.redeem_start_at = null; o.redeem_end_at = null; o.event_at = null; o.event_end_at = null;
      }
      if (desde.rrpp) o.audience = 'promoters';
    }
  }
  // «Oferta para el partido» (Partidos que pones, `?partido=<id>`): la oferta
  // flash ya rellena con el partido, de 30 min antes al final de la emisión.
  // Al guardarla se une a él (`set_business_broadcast_offer`).
  const partidoId = !id && !desde?.from ? (/[?&]partido=([0-9a-f-]{36})(?:&|$)/i.exec(location.hash) || [])[1] : null;
  const partido = partidoId ? await rpc('broadcast_basic', { p_broadcast: partidoId, p_lang: I18N.lang }).catch(() => null) : null;
  if (partido?.id) {
    const SPx = globalThis.KlendarEmisiones.t(I18N.lang);
    o.kind = 'flash_offer';
    o.title = SPx.offerTitle(partido.title).slice(0, 90);
    o.description = SPx.offerDesc;
    const ini = new Date(Math.max(Date.now(), new Date(partido.starts_at).getTime() - 30 * 6e4));
    ini.setSeconds(0, 0);
    o.redeem_start_at = ini.toISOString();
    o.redeem_end_at = partido.ends_at || new Date(new Date(partido.starts_at).getTime() + 2 * 36e5).toISOString();
  }
  // «¿Para niños?» y «¿Bajo techo o al aire libre?» no vienen en
  // `my_business_offers`: se leen de la publicación al editarla o al crear
  // otra a partir de ella (la copia los conserva).
  const origenLugar = id || desde?.from;
  if (origenLugar) {
    // Y lo de RRPP (para qué RRPP, plazas y hasta cuándo vale el código).
    const { data: lugarPlan } = await sb.from('offers')
      .select('for_kids, setting, promoter_scope, promoter_quota, promoter_code_until, promoter_code_hours, solo_friendly, charity, kid_ages, card_requirements, listen_url')
      .eq('id', origenLugar).maybeSingle();
    if (lugarPlan) Object.assign(o, lugarPlan);
  }
  // «Solo con el enlace de un RRPP»: los RRPP del negocio y los elegidos.
  const datosRrpp = await rrppFormularioCarga(origenLugar, o);
  const rrppHtml = rrppFormularioHtml(o, datosRrpp);
  // Crear a partir de una fecha de una serie: la nueva sigue en ella (se
  // puede quitar). Quien la sigue recibirá un aviso cuando se publique.
  const serieCopia = !id && desde?.from
    ? (await seriesDeNegocio()).find((s) => s.status === 'active' && (s.offer_ids || []).includes(desde.from)) || null
    : null;
  let kind = o.kind === 'future_event' ? 'future_event' : 'flash_offer';
  const isFlash = () => kind === 'flash_offer';
  const disc = o.discount || {};
  // «Ideas» (las de su gremio, generadas desde la app en ideas.js; solo en
  // una nueva en blanco) y «Tus plantillas» (lo que el negocio ha guardado).
  let ideas = [];
  const [{ data: yo }, { data: tpl }] = await Promise.all([
    !id && !desde ? sb.from('businesses').select('category_id').eq('id', BIZ.id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from('offer_templates').select('id, name, data, updated_at').eq('business_id', BIZ.id).order('updated_at', { ascending: false }),
  ]);
  if (!id && !desde) {
    const slug = CATS.find((c) => c.id === yo?.category_id)?.slug;
    const IDEAS = window.KLENDAR_IDEAS || { general: [], bySlug: {} };
    ideas = (IDEAS.bySlug[slug] || IDEAS.general).filter((t) => t.kind === kind);
  }
  // La del partido ya viene rellena: sin ideas encima.
  if (partido?.id) ideas = [];
  let guardadas = tpl || [];
  const en = I18N.lang === 'en';
  document.body.classList.add('con-barra-pub');
  // En vivo: lo que estaba publicado se edita con «Guardar cambios».
  const enVivo = !!id && o.status === 'active';
  let programada = id && o.status === 'draft' && o.publish_at ? o.publish_at : null;

  const titulo = () => (kind === 'future_event'
    ? (id ? I18N.t('Editar evento') : desde?.rrpp ? bi('Nuevo evento para RRPP', 'New event for promoters') : I18N.t('Nuevo evento'))
    : (id ? I18N.t('Editar oferta flash') : desde?.rrpp ? bi('Nueva oferta para RRPP', 'New offer for promoters') : I18N.t('Nueva oferta flash')));
  // Una elección en píldoras (radio): la marcada en tinta, como en la app.
  const elige = (name, opciones, actual, etiqueta) => `<div class="elige" role="radiogroup" aria-label="${esc(etiqueta)}">${opciones.map(([val, txt]) =>
    `<label><input type="radio" name="${name}" value="${esc(val)}" ${String(actual ?? '') === String(val) ? 'checked' : ''}><span>${esc(txt)}</span></label>`).join('')}</div>`;
  const ayuda = (temas) => helpBox(I18N.t('¿Cómo funciona?'), temas.map(([h, t]) => `<p><b>${esc(h)}</b><br>${esc(t)}</p>`).join(''));
  const bloque = (bid, tit, cuerpo) => `<details class="bloque" id="${bid}"><summary><span class="b-tit">${esc(tit)}</span><span class="b-res" id="${bid}Res"></span></summary><div class="b-cuerpo">${cuerpo}</div></details>`;
  const kidsVal = o.for_kids === true ? 'si' : o.for_kids === false ? 'no' : '';
  // Marcas (tanda A): varias a la vez, en píldoras como `elige`.
  const KMp = window.KlendarMarcas;
  const MK = KMp.t(I18N.lang);
  const eligeVarios = (name, opciones, actuales, etiqueta) => `<div class="elige" role="group" aria-label="${esc(etiqueta)}">${opciones.map(([val, txt]) =>
    `<label><input type="checkbox" name="${name}" value="${esc(val)}" ${(actuales || []).includes(val) ? 'checked' : ''}><span>${esc(txt)}</span></label>`).join('')}</div>`;

  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/publicaciones">← Volver</a><h1 id="pubTitulo">${esc(titulo())}</h1><span class="spacer"></span>
      <details class="mas tpl-menu"><summary class="btn sm ghost">Tus plantillas</summary>
        <div class="mas-menu" role="menu">
          <button type="button" role="menuitem" id="usarTpl">Usar una plantilla…</button>
          <button type="button" role="menuitem" id="saveTpl">Guardar como plantilla…</button>
          <button type="button" role="menuitem" id="borraTpl">Borrar plantillas…</button>
        </div></details></div>
    <p class="tipo-linea"><span id="tipoPregunta"></span> <button type="button" class="linkbtn" id="cambiaTipo"></button></p>
    <div class="pub-editor">
    <form class="card pub-form" id="form" novalidate>
      <input type="hidden" name="kind" value="${kind}">
      ${ideas.length ? `<div class="ideas" id="ideas"><p class="etq">Ideas</p>
        <div class="ideas-fila">${ideas.map((t, i) => `<button type="button" class="btn sm" data-idea="${i}">${esc(en ? t.en : t.es)}</button>`).join('')}</div>
        <p class="hint">Toca una y cámbiala a tu gusto.</p></div>` : ''}
      <label class="f"><span>Título</span><input name="title" value="${esc(o.title || '')}" required maxlength="90" placeholder="${kind === 'future_event' ? 'Concierto de jazz' : 'Café + tostada 2,50 €'}"></label>
      <label class="f"><span>Descripción <small>(opcional)</small></span><textarea name="description" rows="3" maxlength="600" placeholder="${esc(I18N.t('Qué incluye, cómo es…'))}">${esc(o.description || '')}</textarea></label>
      <div class="bl-fila"><p class="etq">Fotos y vídeo</p>
        <div class="photos" id="photos"></div>
        <p class="hint">La primera es la portada; muévelas con las flechas. Sin fotos, se usa la del local.</p></div>
      <fieldset class="f plano" id="cuando"><legend id="cuandoTit"></legend>
        <div class="dos">
          <label class="f"><span id="iniTxt"></span><input type="datetime-local" name="start" value="${toLocalInput(o.kind === 'future_event' ? o.event_at : o.redeem_start_at)}" required></label>
          <label class="f"><span id="finTxt"></span><input type="datetime-local" name="end" value="${toLocalInput(o.kind === 'future_event' ? o.event_end_at : o.redeem_end_at)}"></label>
        </div>
        <p class="hint" id="finAuto" hidden></p>
        <p class="hint">${TZ === KZ.CANARIAS ? 'Las fechas y horas son las de Canarias, donde está tu local.' : 'Las fechas y horas son las de la península (hora de Madrid), donde está tu local.'}</p>
      </fieldset>
      <fieldset class="f plano" id="descuento"><legend>Descuento</legend>
        ${elige('discount_type', [['', I18N.t('Sin descuento')], ['percent', '%'], ['fixed', I18N.t('Precio fijo')], ['2x1', '2x1'], ['free', I18N.t('Gratis')], ['other', I18N.t('Otro')]], disc.type || '', I18N.t('Descuento'))}
        <div class="dos" id="descFila">
          <label class="f" id="valorRow"><span class="sr">Valor del descuento</span><input name="discount_value" value="${esc(disc.value ?? '')}" aria-label="${esc(I18N.t('Valor del descuento'))}"></label>
          <label class="f" id="antesRow"><span class="sr">Precio anterior</span><input name="prior_price" inputmode="decimal" value="${disc.compare_at_cents != null ? (disc.compare_at_cents / 100).toFixed(2).replace('.', ',') : ''}" placeholder="${esc(I18N.t('Precio anterior (€)'))}" aria-label="${esc(I18N.t('Precio anterior'))}"></label>
        </div>
        <p class="hint" id="antesAyuda">El más bajo de los últimos 30 días.</p>
        <div id="alcRow" class="bl-fila">
          <p class="etq">¿Incluye bebidas alcohólicas?</p>
          ${elige('alcohol', [['no', I18N.t('No lleva alcohol')], ['yes', I18N.t('Sí, lleva alcohol')]], disc.alcohol === true ? 'yes' : disc.alcohol === false ? 'no' : '', I18N.t('¿Incluye bebidas alcohólicas?'))}
          <p class="hint" id="alcAyuda">Solo la verán mayores de 18. Comprueba que tu comunidad lo permite.</p>
        </div>
      </fieldset>
      <label class="f"><span>Precio <small>(opcional)</small></span><input name="price" inputmode="decimal" value="${o.price_cents == null ? '' : (o.price_cents / 100).toFixed(2).replace('.', ',')}" placeholder="12,00"></label>
      <label class="f" id="entradasRow"><span>Enlace de entradas <small>(opcional)</small></span><input name="external_url" value="${esc(o.external_url || '')}" placeholder="https://"></label>
      <p class="hint" id="entradasAyuda" hidden></p>
      ${ayuda([
        [I18N.t('Oferta flash'), I18N.t('Canjeable con QR durante una ventana de tiempo. Ideal para huecos de última hora.')],
        [I18N.t('Evento'), I18N.t('Con fecha y hora. Puede tener precio y enlace para entradas.')],
        [I18N.t('Precio anterior'), I18N.t('Obligatorio al anunciar una rebaja: tiene que ser el precio más bajo que hayas tenido en los últimos 30 días.')],
        [I18N.t('¿Incluye bebidas alcohólicas?'), I18N.t('Hay que responder: varias comunidades prohíben el 2x1 en bebidas alcohólicas y la sanción es para el negocio. Si el 2x1 es de comida, refrescos o servicios, marca «No lleva alcohol».')],
        [I18N.t('Programar publicación'), I18N.t('Un borrador no lo ve nadie hasta que lo publiques. «Programar» lo deja en borrador y lo publica solo a la hora que elijas (hasta 60 días).')],
      ])}

      ${bloque('bAspecto', I18N.t('Aspecto del anuncio'), `
        <p class="hint" style="margin:0 0 10px">Así se verá en Descubre y en la ficha.
          <button type="button" class="linkbtn solo-movil" id="irPrevia">Ver la vista previa</button></p>
        <div class="estilo">
          <div class="estilo-opc">
            <p class="etq">Diseño</p>
            <div class="pills" id="plantillasEstilo" role="group" aria-label="${esc(I18N.t('Diseño'))}"></div>
            <p class="hint" id="plantillaAyuda" style="margin:8px 0 0"></p>
            <p class="etq" style="margin-top:14px">Color</p>
            <div class="colores" id="colores" role="group" aria-label="${esc(I18N.t('Color'))}"></div>
            <div class="marca" id="marcaPanel" hidden>
              <p class="hint" style="margin:0 0 6px"><b>Color de tu marca</b></p>
              <div class="marca-fila">
                <input type="color" id="marcaColor" aria-label="${esc(I18N.t('Color de tu marca'))}">
                <input id="marcaHex" maxlength="7" placeholder="#1E79D1" aria-label="${esc(I18N.t('Código del color'))}" spellcheck="false">
                ${BIZ.logo ? `<button class="btn sm" type="button" id="marcaLogo">${esc(I18N.t('Sacar del logo'))}</button>` : ''}
              </div>
              <div class="colores" id="marcaSugeridos" style="margin-top:8px"></div>
              <p class="hint" id="marcaNota" style="margin:6px 0 0"></p>
            </div>
          </div>
        </div>`)}

      ${bloque('bPlazas', I18N.t('Plazas y código'), `
        <label class="f"><span>Aforo / unidades</span><input name="max_redemptions" type="number" min="1" value="${o.max_redemptions ?? ''}" placeholder="${esc(I18N.t('Vacío = sin límite'))}"></label>
        <div id="plazasRow" class="bl-fila">
          <p class="etq">Cómo se llenan las plazas</p>
          ${elige('holds_seats', [['si', I18N.t('El código guarda la plaza')], ['no', I18N.t('Por orden de llegada')]], o.holds_seats === false ? 'no' : 'si', I18N.t('Cómo se llenan las plazas'))}
          <p class="hint" id="plazasAyuda"></p>
        </div>
        <p class="hint" id="esperaNota">Si se llena, la gente puede apuntarse a la lista de espera.</p>
        <div id="reservaRow" class="bl-fila">
          <label class="opcion"><input type="checkbox" name="reservations_enabled" ${o.reservations_enabled ? 'checked' : ''}><span><b>Reserva de plaza (sin pago)</b><br><small class="muted">Reservan desde la app y enseñan el código en la puerta.</small></span></label>
          <label class="f" id="seatsRow"><span>Plazas por persona <small>(con un mismo código)</small></span><select name="max_seats">
            ${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${Number(o.max_seats || 1) === n ? 'selected' : ''}>${n === 1 ? esc(I18N.t('1 (solo quien reserva)')) : esc(bi(`${n} personas`, `${n} people`))}</option>`).join('')}</select></label>
        </div>
        ${rrppHtml.codigo}
        <div id="ttlRow" class="bl-fila">
          <p class="etq">¿Cuánto vale el código?</p>
          ${elige('code_ttl_minutes', [[5, I18N.t('5 minutos')], [30, I18N.t('30 minutos')], [180, I18N.t('3 horas')], [1440, I18N.t('1 día')], ['', I18N.t('Sin caducidad')]], o.code_ttl_minutes ?? '', I18N.t('¿Cuánto vale el código?'))}
          <p class="hint">Desde que la persona lo consigue.</p>
        </div>
        <label class="f" id="porPersonaRow"><span>Canjes por persona</span><input name="max_per_user" type="number" min="1" max="20" value="${o.max_per_user ?? 1}"></label>
        ${ayuda([
          [I18N.t('El código guarda la plaza'), I18N.t('Quien tiene código tiene sitio. Para talleres, cenas o mesas. Si alguien no va y no anula, su plaza se queda sin usar.')],
          [I18N.t('Por orden de llegada'), I18N.t('El código no guarda sitio: cuentan los que entran. Para conciertos o fiestas, donde siempre falla alguien. Cuando se llena, los que lleguen después ya no pasan.')],
          [I18N.t('Lista de espera'), I18N.t('Cuando se acaban las plazas, la gente puede apuntarse. Si se libera una, avisamos por orden y cada persona tiene un rato para cogerla (30 minutos en una oferta flash, 2 horas en un evento).')],
          [I18N.t('Reserva de plaza (sin pago)'), I18N.t('La gente reserva desde la app y enseña su código en la puerta. Si el evento se paga, se cobra allí como siempre. A un evento no se va solo: con un mismo código se reservan varias plazas.')],
          [I18N.t('¿Cuánto vale el código?'), I18N.t('Desde que la persona lo genera. Para una oferta de barra, pocos minutos; para una entrada que se guarda hasta el día del evento, «sin caducidad».')],
          [I18N.t('Canjes por persona'), I18N.t('Cada canje genera un código QR de un solo uso. Sube el número si quieres que la misma persona pueda repetir (por ejemplo, un café al día).')],
        ])}`)}

      ${bloque('bMas', I18N.t('Más opciones'), `
        <label class="opcion bl-fila" id="antesRow"><input type="checkbox" name="before_closing" ${o.style?.badge === 'before_closing' ? 'checked' : ''}><span><b>Antes de cerrar</b><br><small class="muted">Lo que te sobra del día, con descuento y para recoger hasta el cierre. Sale con su sello y en el filtro «Antes de cerrar».</small></span></label>
        <fieldset class="f full filtro-sellos"><legend>Quién la ve</legend>
          ${AUDIENCIAS.map(([k, t]) => `<label class="opcion"><input type="radio" name="audience" value="${k}" ${(o.audience || 'all') === k ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
          <p class="hint" id="audAyuda" ${['all', 'promoters'].includes(o.audience || 'all') ? 'hidden' : ''}>Los demás ven que es exclusiva, sin el beneficio.</p>
          ${rrppHtml.quien}
        </fieldset>
        <div class="bl-fila">
          <p class="etq">${esc(MK.cardTitle)}</p>
          ${eligeVarios('card_requirements', KMp.CARDS.map((c) => [c, MK.card[c]]), o.card_requirements, MK.cardTitle)}
          <p class="hint">${esc(MK.cardHint)}</p>
        </div>
        <fieldset class="f full lugar plano"><legend>Dónde</legend>
          <label class="opcion"><input type="checkbox" name="venue_on" ${o.venue_address ? 'checked' : ''}><span>Es en otro sitio</span></label>
          <p class="hint" id="lugarAyuda"></p>
          <div id="lugarCampos" class="form-grid" ${o.venue_address ? '' : 'hidden'}>
            <label class="f"><span>Nombre del sitio <small>(opcional)</small></span><input name="venue_name" maxlength="80" value="${esc(o.venue_name || '')}" placeholder="Ej.: Sala Clamores"></label>
            <label class="f"><span>Dirección del sitio</span><input name="venue_address" maxlength="160" value="${esc(o.venue_address || '')}" placeholder="Calle, número y ciudad"></label>
            <div class="full" id="lugarMapaCaja">
              <p style="margin:0 0 8px"><button class="btn sm" type="button" id="buscarLugar">${ms('location_on')}Buscar en el mapa</button>
                <span class="muted" id="lugarTxt"></span></p>
              <div class="mapa" id="mapaLugar"></div>
            </div>
          </div>
        </fieldset>
        <div class="bl-fila"><p class="etq">Categoría</p><div data-cat-oferta></div></div>
        <div id="ninosRow" class="bl-fila">
          <p class="etq">¿Para niños?</p>
          ${elige('for_kids', [['', I18N.t('Como el local')], ['si', I18N.t('Apto para niños')], ['no', I18N.t('No apto para niños')]], kidsVal, I18N.t('¿Para niños?'))}
          <div id="edadRow" ${kidsVal === 'si' ? '' : 'hidden'}>
            <p class="etq" style="margin-top:12px">${esc(MK.kidAgesTitle)}</p>
            ${eligeVarios('kid_ages', KMp.KID_AGES.map(([id, r]) => [id, MK.kidAge(r)]), o.kid_ages, MK.kidAgesTitle)}
            <p class="hint">${esc(MK.kidAgesHint)}</p>
          </div>
        </div>
        <div class="bl-fila">
          <p class="etq">¿Bajo techo o al aire libre?</p>
          ${elige('setting', [['', I18N.t('Como el local')], ['indoor', I18N.t('Bajo techo')], ['outdoor', I18N.t('Al aire libre')], ['both', I18N.t('Las dos cosas')]], ['indoor', 'outdoor', 'both'].includes(o.setting) ? o.setting : '', I18N.t('¿Bajo techo o al aire libre?'))}
          <p class="hint">Solo si es distinto de tu local.</p>
        </div>
        <label class="opcion bl-fila"><input type="checkbox" name="solo_friendly" ${o.solo_friendly ? 'checked' : ''}><span><b>${esc(MK.solo)}</b><br><small class="muted">${esc(MK.soloHint)}</small></span></label>
        <label class="opcion bl-fila" id="solidarioRow"><input type="checkbox" name="charity" ${o.charity ? 'checked' : ''}><span><b>${esc(MK.charity)}</b><br><small class="muted">${esc(MK.charityHint)}</small></span></label>
        <label class="opcion bl-fila"><input type="checkbox" name="adults_only" ${o.adults_only ? 'checked' : ''}><span><b>Solo para mayores de 18</b><br><small class="muted">Si menciona alcohol, se marca +18 solo y se revisa antes de salir.</small></span></label>
        <label class="f bl-fila" id="escuchaRow"><span>${esc(MK.listenField)}</span><input name="listen_url" type="url" inputmode="url" maxlength="300" autocomplete="off" spellcheck="false" placeholder="https://open.spotify.com/…" value="${esc(o.listen_url || '')}">
          <small class="hint" id="escuchaAyuda">${esc(MK.listenHint)}</small></label>
        <label class="f bl-fila"><span>Condiciones <small>(letra pequeña)</small></span><textarea name="terms" rows="2" maxlength="300" placeholder="${esc(I18N.t('Ej. Solo en el local. No acumulable.'))}">${esc(o.terms || '')}</textarea></label>
        ${serieCopia ? `<label class="opcion bl-fila"><input type="checkbox" name="keep_series" checked><span>${esc(bi(`Forma parte de la serie «${serieCopia.name}»`, `Part of the “${serieCopia.name}” series`))}<br><small class="muted">${esc(bi('Quien la sigue recibirá un aviso cuando se publique.', 'Its followers will be notified when it goes live.'))}</small></span></label>` : ''}
        ${ayuda([
          [I18N.t('Quién la ve'), I18N.t('Solo la ven ellos. Si a otra persona le llega el enlace, la ficha dice que es exclusiva y cómo conseguirla, sin enseñar el beneficio.')],
          [bi('Solo con el enlace de un RRPP', "Only through a promoter's link"), bi('No sale en Descubre, Explorar ni en tu ficha: solo la ve quien entra por el enlace o el QR de uno de tus RRPP.', "It doesn't appear in Discover, Explore or on your page: only people who come in through one of your promoters' links or QR codes can see it.")],
          [I18N.t('¿Para niños?'), I18N.t('Solo si este plan es distinto de tu local (p. ej. un taller infantil o un concierto en el patio).')],
          [MK.cardTitle, MK.cardHint],
          [MK.solo, MK.soloHint],
          [MK.charity, MK.charityHint],
          [MK.listenTitle, MK.listenHint],
          [I18N.t('Solo para mayores de 18'), I18N.t('Si el texto menciona bebidas alcohólicas se marca +18 automáticamente y se revisa antes de publicarse (normalmente en menos de 24 h). La publicidad de tabaco, vapeo o apuestas no está permitida.')],
        ])}`)}

      ${rrppHtml.resumen}

      <div class="barra-pub" id="barraPub">
        <p class="programada" id="programadaTxt" hidden><span id="programadaCuando"></span> <button type="button" class="linkbtn" id="quitaProg">Quitar</button></p>
        <div class="err" id="formErr" role="alert"></div>
        <div class="barra-botones">
          <button type="button" class="btn" id="btnBorrador"></button>
          <div class="pub-grupo">
            <button type="button" class="btn primary" id="btnPublicar"></button>
            <div class="menu-pub" id="menuPub" role="menu" hidden>
              <button type="button" role="menuitem" id="pubAhora">Publicar ahora</button>
              <button type="button" role="menuitem" id="pubProgramar"></button>
            </div>
          </div>
        </div>
      </div>
    </form>
    <aside class="pub-prev" aria-labelledby="prevTitulo">
      <h2 id="prevTitulo" tabindex="-1">Vista previa</h2>
      <p class="hint">Así la verá la gente. Cambia al momento con lo que escribas.</p>
      <div class="pills prev-sw" role="group" aria-label="${esc(I18N.t('Dónde se ve'))}">
        <button type="button" class="on" aria-pressed="true" data-prev="grande">Descubre</button>
        <button type="button" aria-pressed="false" data-prev="fila">En la agenda</button>
      </div>
      <div class="tjv prev-tarjeta" id="vistaPrevia" translate="no" inert></div>
      <div id="prevEntradas" translate="no"></div>
      <p class="hint" id="prevNota"></p>
    </aside>
    </div>`;

  const campo = (n) => $(`[name=${n}]`, v);
  /** El valor de un campo o de un grupo de píldoras (radio). */
  const val = (n) => {
    const marcado = $(`[name=${n}]:checked`, v);
    if (marcado) return marcado.value;
    const el = campo(n);
    return el && el.type !== 'radio' ? el.value : '';
  };
  const pon = (n, x) => {
    const els = $$(`[name=${n}]`, v);
    if (!els.length) return;
    if (els[0].type === 'radio') els.forEach((r) => { r.checked = r.value === String(x ?? ''); });
    else els[0].value = x ?? '';
  };

  // ── Categoría (el selector de toda la web; vacía = la del negocio) ──────
  KlendarCategorias.campo($('[data-cat-oferta]', v), {
    cats: CATS, multiple: false, lang: I18N.lang, nombre: 'category_id', titulo: I18N.t('Categoría'),
    vacio: I18N.t('La de tu negocio'), elegidas: o.category_id ? [o.category_id] : [],
    alCambiar: () => { resumenes(); },
  });

  // ── El tipo: en el título, y aquí se corrige ────────────────────────────
  const pintaTipo = () => {
    $('#pubTitulo', v).textContent = titulo();
    $('#tipoPregunta', v).textContent = isFlash() ? I18N.t('¿Era un evento?') : I18N.t('¿Era una oferta flash?');
    $('#cambiaTipo', v).textContent = isFlash() ? I18N.t('Cambiar a evento') : I18N.t('Cambiar a oferta flash');
  };
  $('#cambiaTipo', v).onclick = () => {
    kind = isFlash() ? 'future_event' : 'flash_offer';
    campo('kind').value = kind;
    if (kind === 'future_event') {
      pon('end', '');
    } else if (!campo('end').value && campo('start').value) {
      const ini = fromLocalInput(campo('start').value);
      if (ini) pon('end', toLocalInput(new Date(new Date(ini).getTime() + 3 * 36e5).toISOString()));
    }
    pintaTipo(); syncKind(); pintaPrevia(); resumenes(); pintaFinAuto();
  };

  // Lo que solo tiene sentido en un tipo u otro se enseña y se esconde.
  const syncKind = () => {
    const flash = isFlash();
    const conReserva = !flash && campo('reservations_enabled').checked;
    const conCodigo = flash || conReserva;
    const deRrpp = (val('audience') || 'all') === 'promoters';
    const conAforo = !!String(campo('max_redemptions').value || '').trim();
    $('#entradasRow', v).hidden = flash;
    $('#solidarioRow', v).hidden = flash;
    $('#escuchaRow', v).hidden = flash;
    if (flash) $('#entradasAyuda', v).hidden = true; else pintaEntradas();
    $('#reservaRow', v).hidden = flash;
    $('#seatsRow', v).hidden = !conReserva;
    $('#ttlRow', v).hidden = !conCodigo || deRrpp;
    $('#porPersonaRow', v).hidden = !flash;
    // «Antes de cerrar»: solo en una oferta flash para todo el mundo.
    $('#antesRow', v).hidden = !flash || deRrpp;
    $('#plazasRow', v).hidden = !conAforo || !conCodigo;
    $('#esperaNota', v).hidden = !conAforo || !conCodigo;
    $('#cuandoTit', v).textContent = flash ? I18N.t('Cuándo se puede canjear') : I18N.t('Cuándo');
    $('#iniTxt', v).textContent = flash ? I18N.t('Empieza') : I18N.t('Fecha y hora');
    $('#finTxt', v).textContent = flash ? I18N.t('Termina') : I18N.t('Termina (opcional)');
    $('#plazasAyuda', v).textContent = val('holds_seats') === 'no'
      ? I18N.t('Entran los primeros en llegar.') : I18N.t('Quien tiene código tiene sitio.');
  };
  campo('reservations_enabled').addEventListener('change', () => {
    // Una reserva de evento se guarda hasta el día: con los 5 minutos de las
    // ofertas flash (lo que viene marcado), la plaza se perdía al rato de
    // reservarla. Lo mismo que la app.
    if (campo('reservations_enabled').checked && val('code_ttl_minutes') === '5') pon('code_ttl_minutes', '');
    syncKind();
  });
  campo('max_redemptions').addEventListener('input', syncKind);
  $$('[name=holds_seats], [name=audience]', v).forEach((r) => r.addEventListener('change', syncKind));

  // Un evento sin hora de fin termina al cierre del local (o 6 horas después
  // si ese día no tiene horario): se dice, con la misma cuenta que la base.
  let finAutoClave = null;
  const pintaFinAuto = async () => {
    const caja = $('#finAuto', v);
    const ini = fromLocalInput(campo('start').value);
    const clave = !isFlash() && !campo('end').value && ini ? `${ini}|${lugar.activo()}` : null;
    if (clave === finAutoClave) return;
    finAutoClave = clave;
    if (!clave) { caja.hidden = true; return; }
    let r = null;
    try { r = await rpc('event_default_end', { p_business: BIZ.id, p_at: ini, p_elsewhere: lugar.activo() }); } catch { r = null; }
    if (clave !== finAutoClave) return;
    if (!r?.ends_at) { caja.hidden = true; return; }
    const h = KZ.fmt(r.ends_at, TZ, LOC(), { hour: 'numeric', minute: '2-digit' });
    caja.textContent = r.at_close
      ? bi(`Termina: al cierre del local (${h})`, `Ends: when your place closes (${h})`)
      : bi(`Termina: 6 horas después de empezar (${h})`, `Ends: 6 hours after it starts (${h})`);
    caja.hidden = false;
  };
  for (const n of ['start', 'end', 'venue_on']) campo(n).addEventListener('change', () => pintaFinAuto());

  // Una publicación +18 no es para niños: la pregunta no se hace.
  const syncNinos = () => {
    $('#ninosRow', v).hidden = campo('adults_only').checked;
    $('#edadRow', v).hidden = val('for_kids') !== 'si';
  };
  campo('adults_only').addEventListener('change', syncNinos);
  $$('[name=for_kids]', v).forEach((r) => r.addEventListener('change', syncNinos));
  // «Escúchalo antes»: qué dirá el botón, o por qué no vale.
  const pintaEscucha = () => {
    const raw = String(campo('listen_url').value || '').trim();
    const s = raw ? KMp.servicio(KMp.normaliza(raw)) : null;
    const ayuda = $('#escuchaAyuda', v);
    ayuda.textContent = !raw ? MK.listenHint : s ? MK.listenWillSay(MK.listenOn(s.nombre)) : MK.listenInvalid;
    ayuda.classList.toggle('err-txt', !!raw && !s);
  };
  campo('listen_url').addEventListener('input', pintaEscucha);
  pintaEscucha();

  // El descuento: el valor (si lo lleva), el precio anterior (rebajas) y la
  // pregunta del alcohol (2x1).
  const syncDiscount = () => {
    const t = val('discount_type');
    const conValor = ['percent', 'fixed', 'free', 'other'].includes(t);
    const rebaja = ['percent', 'fixed'].includes(t);
    $('#descFila', v).hidden = !conValor;
    $('#antesRow', v).hidden = !rebaja;
    $('#antesAyuda', v).hidden = !rebaja;
    $('#alcRow', v).hidden = t !== '2x1';
    $('#alcAyuda', v).hidden = val('alcohol') !== 'yes';
    const ph = {
      percent: I18N.t('Porcentaje, ej. 20'), fixed: I18N.t('Precio en euros, ej. 6'),
      free: I18N.t('¿Qué es gratis? ej. tapa, entrada'), other: I18N.t('Escríbelo tú: «2ª unidad −50 %», «Menú 9,90»…'),
    }[t] || '';
    campo('discount_value').placeholder = ph;
    campo('discount_value').setAttribute('inputmode', ['percent', 'fixed'].includes(t) ? 'decimal' : 'text');
    campo('discount_value').maxLength = t === 'other' ? 24 : 40;
  };
  $$('[name=discount_type], [name=alcohol]', v).forEach((r) => r.addEventListener('change', syncDiscount));
  // La ayuda de «Quién la ve» solo hace falta si no es para todo el mundo.
  $$('[name=audience]', v).forEach((r) => {
    r.addEventListener('change', () => { $('#audAyuda', v).hidden = ['all', 'promoters'].includes(val('audience') || 'all'); });
  });
  rrppFormularioEngancha(v);

  // Fotos
  let images = [...(o.images || [])];
  // La vista previa del diseño se define más abajo; las fotos la repintan.
  let pintaEstilo = () => {};
  const isVideo = (u) => /\.(mp4|mov|webm)(\?|$)/i.test(u);
  const renderPhotos = () => {
    // El orden manda: la primera es la portada. Se mueve con las flechas.
    $('#photos').innerHTML = images.map((u, i) => `
      <div class="ph-item">
        ${isVideo(u) ? `<div class="ph-video"><video src="${esc(u)}#t=0.1" muted playsinline preload="metadata"></video><span>▶</span></div>` : `<img src="${esc(u)}" alt="">`}
        ${i === 0 ? '<span class="ph-cover">Portada</span>' : ''}
        <button class="rm" type="button" data-i="${i}" title="Quitar">×</button>
        <div class="ph-move">
          <button type="button" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''} title="Mover antes">←</button>
          <button type="button" data-mv="${i}:1" ${i === images.length - 1 ? 'disabled' : ''} title="Mover después">→</button>
        </div>
      </div>`).join('')
      // Con el tope lleno no se ofrece añadir (como la app).
      + (images.length < TOPE.publicacion
        ? `<label class="add">+ Añadir foto o vídeo<input type="file" accept="image/*,video/mp4,video/quicktime" multiple></label>`
        : `<p class="hint">${esc(topeLleno(TOPE.publicacion))}</p>`);
    I18N.translate($('#photos'));
    $$('#photos .rm').forEach((b) => { b.onclick = () => { images.splice(+b.dataset.i, 1); renderPhotos(); }; });
    pintaEstilo();
    $$('#photos [data-mv]').forEach((b) => {
      b.onclick = () => {
        const [i, d] = b.dataset.mv.split(':').map(Number);
        const j = i + d;
        if (j < 0 || j >= images.length) return;
        [images[i], images[j]] = [images[j], images[i]];
        renderPhotos();
      };
    });
    const subir = $('#photos input[type=file]');
    if (subir) subir.onchange = async (e) => {
      for (const elegido of caben(e.target.files, images.length, TOPE.publicacion)) {
        const video = /^video\//.test(elegido.type);
        // Las fotos, reducidas como en la app; los vídeos, tal cual.
        const file = video ? elegido : await KFotos.reduce(elegido, KFotos.TAM.foto);
        const max = video ? 60 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > max) { toast(video ? 'Ese vídeo pesa más de 60 MB.' : 'Esa foto pesa más de 5 MB.', true); continue; }
        // Como en la app: vídeos de menos de 45 segundos.
        if (video && (await duracion(file)) > 45.5) { toast('Ese vídeo dura más de 45 segundos. Recórtalo y vuelve a subirlo.', true); continue; }
        const ext = video ? 'mp4' : (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${BIZ.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (error) { toast(friendly(error.message), true); continue; }
        images.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      renderPhotos();
    };
  };

  // ── Lugar propio: «Es en otro sitio» (docs/DISENOS_PUBLICACION.md §5) ────
  const lugar = {
    punto: o.venue_address && o.venue_lat != null ? { lat: o.venue_lat, lng: o.venue_lng } : null,
    mapa: null,
    perfil: null,
    activo: () => campo('venue_on').checked,
  };
  const pintaLugar = async () => {
    const on = lugar.activo();
    $('#lugarCampos', v).hidden = !on;
    if (!lugar.perfil) {
      try {
        const fila = await rpc('business_profile', { p_id: BIZ.id });
        lugar.perfil = (Array.isArray(fila) ? fila[0] : fila) || {};
      } catch { lugar.perfil = {}; }
    }
    const casa = lugar.perfil;
    const dirCasa = [casa.address, casa.city].filter(Boolean).join(', ');
    $('#lugarAyuda', v).textContent = on
      ? I18N.t('Una sala, un parque, otro local… La distancia, el mapa y «Cómo llegar» llevarán ahí.')
      : (dirCasa ? bi(`En tu local: ${dirCasa}`, `At your place: ${dirCasa}`) : '');
    const txt = $('#lugarTxt', v);
    if (lugar.punto && casa.lat != null) {
      const m = metrosEntre({ lat: casa.lat, lng: casa.lng }, lugar.punto);
      const d = m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', I18N.lang === 'en' ? '.' : ',')} km`;
      txt.textContent = bi(`A ${d} de tu local. Si no es exacto, arrastra la chincheta.`, `${d} from your place. If it's not exact, drag the pin.`);
    } else {
      txt.textContent = I18N.t('Marca el sitio en el mapa.');
    }
    // El mapa solo con el bloque abierto: cerrado no tiene tamaño.
    if (on && !lugar.mapa && $('#bMas', v).open) {
      lugar.mapa = await mapaPunto($('#mapaLugar', v), lugar.punto, async (p) => {
        lugar.punto = p;
        const el = campo('venue_address');
        // Lo que vino del mapa se vuelve a rellenar; lo escrito a mano, no.
        if (!el.value.trim() || el.dataset.auto === el.value) {
          const d = await direccionDe(p.lat, p.lng);
          const linea = d ? [d.address, d.city].filter(Boolean).join(', ') : '';
          if (linea) { el.value = linea; el.dataset.auto = linea; }
        }
        pintaLugar(); pintaEstilo(); resumenes();
      }) || { mueve() {} };
      if (!lugar.punto && casa.lat != null) lugar.mapa.mueve({ lat: casa.lat, lng: casa.lng }, 14);
    }
  };
  lugar.pon = (x) => {
    campo('venue_on').checked = !!x;
    pon('venue_name', x?.name || '');
    pon('venue_address', x?.address || '');
    lugar.punto = x && x.lat != null ? { lat: x.lat, lng: x.lng } : null;
    if (lugar.punto) lugar.mapa?.mueve(lugar.punto);
    pintaLugar();
  };
  campo('venue_on').onchange = () => { pintaLugar(); pintaEstilo(); };
  $('#bMas', v).addEventListener('toggle', () => { if ($('#bMas', v).open) pintaLugar(); });
  $('#buscarLugar', v).onclick = async () => {
    const q = String(campo('venue_address').value || '').trim() || String(campo('venue_name').value || '').trim();
    if (!q) { toast('Escribe primero la dirección del sitio.', true); return; }
    const d = await buscaDireccion(q);
    if (!d) { toast('No encontramos esa dirección. Prueba a escribirla de otra forma o marca el punto en el mapa.', true); return; }
    lugar.punto = { lat: d.lat, lng: d.lng };
    lugar.mapa?.mueve(lugar.punto);
    pintaLugar(); pintaEstilo();
  };

  // ── Botón de entradas: lo que dirá ──────────────────────────────────────
  function pintaEntradas() {
    const p = plataformaEntradas(campo('external_url').value);
    const ayudaE = $('#entradasAyuda', v);
    ayudaE.hidden = !p || isFlash();
    if (!p) return;
    const etiqueta = p.plataforma ? bi(`Entradas en ${p.plataforma}`, `Tickets on ${p.plataforma}`)
      : bi(`Conseguir entradas (${p.dominio})`, `Get tickets (${p.dominio})`);
    ayudaE.textContent = bi(`El botón dirá: ${etiqueta}`, `The button will say: ${etiqueta}`);
  }
  campo('external_url').addEventListener('input', pintaEntradas);

  // ── Diseño del anuncio (los mismos diseños y colores que la app) ─────────
  // El estilo viene de la base (lo escribe cualquiera del equipo que
  // gestione): solo diseños conocidos y un color #rrggbb, que va dentro de
  // un atributo `style`.
  const limpiaEstilo = (s2) => ({
    template: PLANTILLAS.some(([k]) => k === s2?.template) ? s2.template : 'glass',
    accent: colorSeguro(s2?.accent),
    // «Antes de cerrar»: el sello va en el aspecto (`style.badge`).
    before_closing: s2?.badge === 'before_closing',
  });
  let estilo = limpiaEstilo(o.style);
  /** Lo que se guarda en `offers.style`: el sello solo en una oferta flash. */
  const estiloJson = () => ({
    template: estilo.template,
    ...(estilo.accent ? { accent: estilo.accent } : {}),
    ...(estilo.before_closing && kind === 'flash_offer' ? { badge: 'before_closing' } : {}),
  });
  const enPaleta = (c) => PALETA.some(([h]) => h === c);
  // ── Vista previa: la tarjeta de verdad (/assets/tarjeta.js), con lo que
  // hay escrito ahora mismo. A la derecha en el escritorio (fija al bajar) y
  // debajo en el móvil. Dos formas: la tarjeta grande de Descubre y la fila de
  // la agenda. Es una copia de lo que ya dice el formulario: `inert` (ni foco
  // ni lector de pantalla).
  let formaPrevia = 'grande';
  const datosPrevia = () => {
    const f = new FormData($('#form'));
    const evento = kind === 'future_event';
    const tituloP = String(f.get('title') || '').trim() || (I18N.lang === 'en'
      ? (evento ? 'Your event title' : 'Your offer title')
      : (evento ? 'El título de tu evento' : 'El título de tu oferta'));
    const dt = val('discount_type');
    const dv = String(f.get('discount_value') || '').trim();
    const num = (x) => { const n = parseFloat(String(x || '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    const precio = num(f.get('price'));
    const antes = num(f.get('prior_price'));
    const ini = fromLocalInput(f.get('start'));
    const fin = fromLocalInput(f.get('end'));
    const aforo = Number(f.get('max_redemptions')) || null;
    // Plazas que quedan: las de verdad si ya existe; si es nueva, todas.
    const ocupadas = !id ? 0 : o.max_redemptions != null ? (plazasOcupadas(o) || 0)
      : (o.redemptions_count || 0) + (o.holds_seats === false ? 0 : (o.pending_count || 0));
    return {
      id: o.id || 'vista-previa',
      kind,
      title: tituloP,
      description: String(f.get('description') || '').trim(),
      discount: dt ? {
        type: dt,
        value: dt === 'other' ? dv : (dv ? (num(dv) ?? dv) : null),
        currency: 'EUR',
        ...(antes && ['percent', 'fixed'].includes(dt) ? { compare_at_cents: Math.round(antes * 100) } : {}),
      } : null,
      price_cents: precio == null ? null : Math.round(precio * 100),
      currency: 'EUR',
      redeem_start_at: evento ? null : ini,
      redeem_end_at: evento ? null : fin,
      event_at: evento ? ini : null,
      event_end_at: evento ? fin : null,
      images,
      style: estiloJson(),
      venue_name: lugar.activo() ? String(f.get('venue_name') || '').trim() || null : null,
      venue_address: lugar.activo() ? String(f.get('venue_address') || '').trim() || null : null,
      external_url: evento ? String(f.get('external_url') || '').trim() || null : null,
      seats_left: aforo ? Math.max(0, aforo - ocupadas) : null,
      status: 'active',
    };
  };
  function pintaPrevia() {
    const caja = $('#vistaPrevia', v);
    if (!caja) return;
    const d = datosPrevia();
    const html = formaPrevia === 'fila'
      ? `<div class="tj-filas">${tarjetaPanel(d, { forma: 'fila', h: 'h3', href: '#' })}</div>`
      : tarjetaPanel(d, { desc: true, h: 'h3', href: '#' });
    // La foto o el vídeo no se vuelven a cargar con cada letra: si no han
    // cambiado, se queda el mismo (el vídeo sigue por donde iba).
    const firma = JSON.stringify([formaPrevia, d.kind, images, BIZ._portada]);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const viejo = $('.tj-media', caja);
    if (viejo && caja.dataset.firma === firma) $('.tj-media', tmp)?.replaceWith(viejo);
    caja.replaceChildren(...tmp.childNodes);
    if (caja.dataset.firma !== firma) { caja.dataset.firma = firma; activaVideos(caja, true); }
    // El botón de entradas de la ficha (DISENOS_PUBLICACION.md §6).
    const p = d.external_url ? plataformaEntradas(d.external_url) : null;
    $('#prevEntradas', v).innerHTML = p ? `<p class="hint" style="margin:12px 0 6px">${esc(I18N.t('En la ficha, el botón de entradas'))}:</p>
      <span class="prev-boton">${esc(p.plataforma ? bi(`Entradas en ${p.plataforma}`, `Tickets on ${p.plataforma}`) : bi('Conseguir entradas', 'Get tickets'))}${p.plataforma ? '' : `<small>${esc(p.dominio)}</small>`}</span>` : '';
    $('#prevNota', v).textContent = !images.length && !BIZ._portada
      ? I18N.t('Sin fotos se usa la portada de tu local. Añade una foto para que se vea mejor.')
      : !images.length ? I18N.t('Sin fotos se usa la portada de tu local.') : '';
  }
  $$('[data-prev]', v).forEach((b) => {
    b.onclick = () => {
      formaPrevia = b.dataset.prev;
      $$('[data-prev]', v).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      pintaPrevia();
    };
  });
  $('#irPrevia', v).onclick = () => {
    const h = $('#prevTitulo', v);
    h.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    h.focus({ preventScroll: true });
  };
  pintaEstilo = () => {
    const acento = estilo.accent || '#FF4D6D';
    pintaPrevia();
    $('#plantillasEstilo', v).innerHTML = PLANTILLAS.map(([k2, n]) =>
      `<button type="button" class="${estilo.template === k2 ? 'on' : ''}" aria-pressed="${estilo.template === k2}" data-plantilla="${k2}">${esc(I18N.t(n))}</button>`).join('');
    $('#plantillaAyuda', v).textContent = I18N.t(PLANTILLA_AYUDA[estilo.template]);
    const marca = !!estilo.accent && !enPaleta(estilo.accent);
    $('#colores', v).innerHTML = PALETA.map(([c, n], i) =>
      `<button type="button" class="color ${!marca && acento === c ? 'on' : ''}" aria-pressed="${!marca && acento === c}" data-color="${i === 0 ? '' : c}" style="background:${c}" aria-label="${esc(I18N.t(n))}" title="${esc(I18N.t(n))}"></button>`).join('')
      + `<button type="button" class="color marca-btn ${marca ? 'on' : ''}" aria-pressed="${marca}" data-marca="1" ${marca ? `style="background:${acento}"` : ''} aria-label="${esc(I18N.t('Color de tu marca'))}" title="${esc(I18N.t('Color de tu marca'))}">${marca ? '' : ms('edit')}</button>`;
    // Al elegir, el botón se vuelve a pintar: el foco sigue en él.
    $$('[data-plantilla]', v).forEach((b) => { b.onclick = () => { estilo.template = b.dataset.plantilla; pintaEstilo(); $(`[data-plantilla="${estilo.template}"]`, v)?.focus(); }; });
    $$('[data-color]', v).forEach((b) => { b.onclick = () => { const c = b.dataset.color; estilo.accent = c || null; $('#marcaPanel', v).hidden = true; pintaEstilo(); $(`[data-color="${c}"]`, v)?.focus(); }; });
    $('[data-marca]', v).onclick = () => {
      const panel = $('#marcaPanel', v);
      panel.hidden = !panel.hidden;
      if (!panel.hidden) pintaMarca(estilo.accent && !enPaleta(estilo.accent) ? estilo.accent : '#1E79D1', true);
    };
    resumenes();
  };
  // Color de la marca: el selector del navegador, el código o el logo. Se
  // corrige para que el texto encima se lea (y se dice).
  const pintaMarca = (hex, aplicar) => {
    const seguro = colorSeguro(hex);
    if (!seguro) { $('#marcaNota', v).textContent = I18N.t('Escribe un color como #1E79D1'); return; }
    $('#marcaColor', v).value = seguro.toLowerCase();
    if (document.activeElement !== $('#marcaHex', v)) $('#marcaHex', v).value = seguro;
    $('#marcaNota', v).textContent = seguro !== hex.toUpperCase().replace(/^([^#])/, '#$1')
      ? I18N.t('Lo hemos ajustado un poco para que el texto encima se lea bien.') : '';
    if (aplicar) { estilo.accent = seguro; pintaEstilo(); }
  };
  $('#marcaColor', v).addEventListener('input', (e) => pintaMarca(e.target.value, true));
  $('#marcaHex', v).addEventListener('input', (e) => {
    const t = e.target.value.trim();
    if (/^#?[0-9a-f]{6}$/i.test(t)) pintaMarca(t.startsWith('#') ? t : `#${t}`, true);
  });
  const botonLogo = $('#marcaLogo', v);
  if (botonLogo) {
    botonLogo.onclick = async () => {
      botonLogo.disabled = true;
      let colores = [];
      try { colores = await coloresDelLogo(BIZ.logo); } catch { colores = []; }
      botonLogo.disabled = false;
      const caja = $('#marcaSugeridos', v);
      if (!colores.length) {
        caja.innerHTML = '';
        $('#marcaNota', v).textContent = I18N.t('No hemos encontrado un color en tu logo. Elígelo a mano.');
        return;
      }
      caja.innerHTML = colores.map((c) => `<button type="button" class="color" data-sugerido="${c}" style="background:${c}" aria-label="${c}" title="${c}"></button>`).join('');
      $$('[data-sugerido]', caja).forEach((b) => { b.onclick = () => pintaMarca(b.dataset.sugerido, true); });
      pintaMarca(colores[0], true);
    };
  }

  // ── Lo que dice cada bloque cerrado (como la app) ───────────────────────
  function resumenes() {
    const t = (s) => esc(s);
    const nombreDiseno = I18N.t((PLANTILLAS.find(([k]) => k === estilo.template) || PLANTILLAS[0])[1]);
    const color = estilo.accent && !enPaleta(estilo.accent) ? I18N.t('Color de tu marca')
      : I18N.t((PALETA.find(([h]) => h === (estilo.accent || '#FF4D6D')) || PALETA[0])[1]);
    $('#bAspectoRes', v).innerHTML = t(`${nombreDiseno} · ${color}`);

    const flash = isFlash();
    const reserva = !flash && campo('reservations_enabled').checked;
    const rrpp = (val('audience') || 'all') === 'promoters';
    const cap = Number(campo('max_redemptions').value) || null;
    const ttl = val('code_ttl_minutes');
    const ttlTxt = { 5: bi('5 minutos', '5 minutes'), 30: bi('30 minutos', '30 minutes'), 180: bi('3 horas', '3 hours'), 1440: bi('1 día', '1 day') }[ttl] || `${ttl} min`;
    const porPersona = Number(campo('max_per_user').value) || 1;
    const asientos = Number(campo('max_seats').value) || 1;
    const cupo = rrpp && !$('[name=rrpp_sin_limite]', v)?.checked ? Number($('[name=promoter_quota]', v)?.value) || null : null;
    const validez = $('[name=rrpp_validez]:checked', v)?.value || 'siempre';
    const horas = Number($('[name=promoter_code_hours]', v)?.value) || 3;
    const hasta = String($('[name=promoter_code_until]', v)?.value || '01:00').replace(/^0(\d)/, '$1');
    $('#bPlazasRes', v).innerHTML = t([
      cap ? bi(cap === 1 ? '1 plaza' : `${cap} plazas`, cap === 1 ? '1 place' : `${cap} places`) : bi('Sin límite', 'No limit'),
      ...(flash ? [] : [reserva ? bi('con reserva', 'with reservations') : bi('sin reserva', 'no reservations')]),
      ...(cupo ? [bi(cupo === 1 ? '1 persona por RRPP' : `${cupo} personas por RRPP`, cupo === 1 ? '1 person per promoter' : `${cupo} people per promoter`)] : []),
      ...(rrpp ? [validez === 'hasta' ? bi(`el código vale hasta las ${hasta}`, `the code lasts until ${hasta}`)
        : validez === 'horas' ? bi(horas === 1 ? 'el código vale 1 hora' : `el código vale ${horas} horas`, horas === 1 ? 'the code lasts 1 hour' : `the code lasts ${horas} hours`)
          : bi('el código vale hasta el final', 'the code lasts until the end')]
        : (flash || reserva) ? [ttl === '' ? bi('el código no caduca', "the code doesn't expire") : bi(`el código vale ${ttlTxt}`, `the code lasts ${ttlTxt}`)] : []),
      ...(flash ? [bi(porPersona === 1 ? '1 por persona' : `hasta ${porPersona} por persona`, porPersona === 1 ? '1 per person' : `up to ${porPersona} per person`)] : []),
      ...(reserva ? [bi(asientos === 1 ? '1 plaza por código' : `hasta ${asientos} plazas por código`, asientos === 1 ? '1 place per code' : `up to ${asientos} places per code`)] : []),
    ].join(' · '));

    const aud = val('audience') || 'all';
    const sitio = String(campo('venue_name').value || '').trim();
    const adultos = campo('adults_only').checked;
    const ninos = val('for_kids');
    const set = val('setting');
    $('#bMasRes', v).innerHTML = t([
      ...(isFlash() && estilo.before_closing ? [bi('Antes de cerrar', 'Before closing')] : []),
      { all: bi('Para todo el mundo', 'For everyone'), favorites: bi('Solo favoritos', 'Favourites only'), customers: bi('Solo clientes', 'Customers only'), promoters: bi('Solo RRPP', 'Promoters only') }[aud],
      !lugar.activo() ? bi('en tu local', 'at your place') : sitio || bi('en otro sitio', 'somewhere else'),
      ...(adultos ? ['+18'] : []),
      ...(!adultos && ninos === 'si' ? [bi('apto para niños', 'child-friendly')] : []),
      ...(!adultos && ninos === 'no' ? [bi('no apto para niños', 'not for children')] : []),
      ...({ indoor: [bi('bajo techo', 'indoor')], outdoor: [bi('al aire libre', 'outdoors')], both: [bi('bajo techo / al aire libre', 'indoor / outdoors')] }[set] || []),
      ...($$('[name=card_requirements]:checked', v).length ? [bi('con carné', 'with ID')] : []),
      ...(campo('solo_friendly').checked ? [bi('ideal para ir solo', 'good for going solo')] : []),
      ...(!flash && campo('charity').checked ? [bi('solidario', 'charity')] : []),
      ...(!flash && String(campo('listen_url').value || '').trim() ? [bi('para escuchar antes', 'listen first')] : []),
      ...(String(campo('terms').value || '').trim() ? [bi('con condiciones', 'with terms')] : []),
      ...(serieCopia && campo('keep_series')?.checked ? [bi(`en la serie «${serieCopia.name}»`, `in the “${serieCopia.name}” series`)] : []),
    ].join(' · '));
  }

  // Cualquier cambio del formulario se ve al momento en la tarjeta y en los
  // resúmenes.
  campo('before_closing').addEventListener('change', () => { estilo.before_closing = campo('before_closing').checked; });
  $('#form').addEventListener('input', () => { pintaPrevia(); resumenes(); });
  $('#form').addEventListener('change', () => { pintaPrevia(); resumenes(); });

  // ── Ideas y «Tus plantillas» ────────────────────────────────────────────
  const precioTxt = (x) => (x == null || x === '' ? '' : String(x).replace('.', ','));
  const aplicarIdea = (t) => {
    pon('title', en ? t.en : t.es);
    const desc = en ? t.descEn : t.descEs;
    if (desc) pon('description', desc);
    pon('discount_type', t.discount === 'none' ? '' : t.discount);
    pon('discount_value', precioTxt(t.value));
    const cond = en ? t.termsEn : t.termsEs;
    if (cond) pon('terms', cond);
    if (t.seats) pon('max_redemptions', t.seats);
    // «Antes de cerrar»: con su sello y hasta el cierre del local.
    estilo.before_closing = !!t.beforeClosing && t.kind === 'flash_offer';
    campo('before_closing').checked = estilo.before_closing;
    if (t.kind === 'flash_offer') {
      const ahora = new Date();
      pon('start', toLocalInput(ahora.toISOString()));
      pon('end', toLocalInput(new Date(ahora.getTime() + t.hours * 3600e3).toISOString()));
      if (t.beforeClosing) {
        rpc('event_default_end', { p_business: BIZ.id, p_at: ahora.toISOString(), p_elsewhere: false })
          .then((r) => { if (r?.at_close && r.ends_at && v.isConnected) { pon('end', toLocalInput(r.ends_at)); pintaPrevia(); resumenes(); } })
          .catch(() => {});
      }
    }
    syncKind(); syncDiscount(); pintaPrevia(); resumenes();
  };
  // Lo que guarda la app como plantilla (offer_templates.data): todo menos
  // fechas y estado. Mismo formato en los dos lados.
  const aplicarGuardada = (t) => {
    const d = t.data || {};
    kind = d.kind === 'future_event' ? 'future_event' : 'flash_offer';
    pon('kind', kind);
    pon('title', d.title); pon('description', d.description); pon('terms', d.terms);
    pon('price', d.price); pon('external_url', d.external_url);
    pon('max_redemptions', d.max_redemptions); pon('max_per_user', d.max_per_user || 1);
    pon('holds_seats', d.holds_seats === false ? 'no' : 'si');
    pon('code_ttl_minutes', d.code_ttl_minutes ?? '');
    campo('adults_only').checked = !!d.adults_only;
    campo('reservations_enabled').checked = !!d.reservations_enabled;
    pon('for_kids', d.for_kids === true ? 'si' : d.for_kids === false ? 'no' : '');
    pon('setting', ['indoor', 'outdoor', 'both'].includes(d.setting) ? d.setting : '');
    campo('solo_friendly').checked = !!d.solo_friendly;
    campo('charity').checked = !!d.charity;
    $$('[name=card_requirements]', v).forEach((c) => { c.checked = (d.card_requirements || []).includes(c.value); });
    $$('[name=kid_ages]', v).forEach((c) => { c.checked = (d.kid_ages || []).includes(c.value); });
    pon('listen_url', d.listen_url || '');
    syncNinos(); pintaEscucha();
    const ds = d.discount || {};
    pon('discount_type', ds.type || '');
    pon('discount_value', ds.type === 'other' ? ds.value : precioTxt(ds.value));
    pon('prior_price', ds.compare_at_cents != null ? (ds.compare_at_cents / 100).toFixed(2).replace('.', ',') : '');
    pon('alcohol', ds.alcohol === true ? 'yes' : ds.alcohol === false ? 'no' : '');
    images = [...(d.images || [])];
    if (d.style) estilo = limpiaEstilo(d.style);
    campo('before_closing').checked = !!estilo.before_closing;
    lugar.pon(d.venue_address ? { name: d.venue_name, address: d.venue_address, lat: d.venue_lat, lng: d.venue_lng } : null);
    renderPhotos(); pintaTipo(); syncKind(); syncDiscount(); pintaEstilo();
  };
  $$('[data-idea]', v).forEach((b) => { b.onclick = () => { aplicarIdea(ideas[+b.dataset.idea]); toast('Idea aplicada: repasa precio y hora'); }; });
  const cierraMenuTpl = () => { const d = $('.tpl-menu', v); if (d) d.open = false; };
  $('#usarTpl', v).onclick = async () => {
    cierraMenuTpl();
    if (!guardadas.length) {
      await modal({ title: I18N.t('Tus plantillas'), intro: esc(I18N.t('Todavía no has guardado ninguna. Rellena una publicación y guárdala como plantilla: la próxima vez la lanzas en dos toques.')), submit: I18N.t('Entendido'), cancel: '' });
      return;
    }
    const r = await modal({ title: I18N.t('Usar una plantilla'), submit: I18N.t('Usar'),
      fields: [{ name: 't', label: I18N.t('Plantilla'), type: 'select', value: '0', options: guardadas.map((t, i) => [String(i), t.name]) }] });
    if (!r) return;
    aplicarGuardada(guardadas[+r.t]);
    toast('Plantilla aplicada: repasa precio y hora');
  };
  $('#borraTpl', v).onclick = async () => {
    cierraMenuTpl();
    if (!guardadas.length) { toast(I18N.t('Todavía no has guardado ninguna.')); return; }
    const r = await modal({
      title: 'Borrar plantillas',
      intro: esc(I18N.t('Marca las que ya no uses. Las publicaciones hechas con ellas no cambian.')),
      fields: guardadas.map((t, i) => ({ name: `t${i}`, type: 'checkbox', label: t.name, value: false })),
      submit: 'Borrar', danger: true,
    });
    if (!r) return;
    const ids = guardadas.filter((_, i) => r[`t${i}`]).map((t) => t.id);
    if (!ids.length) return;
    const { error } = await sb.from('offer_templates').delete().in('id', ids);
    if (error) { toast(friendly(error.message), true); return; }
    guardadas = guardadas.filter((t) => !ids.includes(t.id));
    toast(ids.length === 1 ? 'Plantilla borrada' : 'Plantillas borradas');
  };

  $('#saveTpl', v).onclick = async () => {
    cierraMenuTpl();
    const f = new FormData($('#form'));
    const title = String(f.get('title') || '').trim();
    if (!title) { toast('Pon al menos el título antes de guardarla.', true); return; }
    const r = await modal({ title: 'Guardar como plantilla', fields: [{ name: 'name', label: 'Nombre de la plantilla', value: title, required: true, maxlength: 60 }] });
    if (!r || !r.name) return;
    const dType = val('discount_type');
    const dVal = String(f.get('discount_value') || '').trim();
    const priorRaw = String(f.get('prior_price') || '').replace(',', '.');
    const data = {
      kind,
      title,
      description: String(f.get('description') || '').trim() || null,
      terms: String(f.get('terms') || '').trim() || null,
      discount: dType ? {
        type: dType,
        value: dType === 'other' || dType === 'free' ? (dVal || null) : (dVal ? Number(dVal.replace(',', '.')) : null),
        ...(dType === 'fixed' ? { currency: 'EUR' } : {}),
        ...(priorRaw && ['percent', 'fixed'].includes(dType) ? { compare_at_cents: Math.round(parseFloat(priorRaw) * 100) } : {}),
        ...(dType === '2x1' && val('alcohol') ? { alcohol: val('alcohol') === 'yes' } : {}),
      } : null,
      price: String(f.get('price') || '').trim(),
      external_url: String(f.get('external_url') || '').trim() || null,
      max_redemptions: String(f.get('max_redemptions') || '').trim() || null,
      holds_seats: val('holds_seats') !== 'no',
      max_per_user: Number(f.get('max_per_user') || 1),
      adults_only: campo('adults_only').checked,
      for_kids: forKids(campo('adults_only').checked, val('for_kids')),
      setting: val('setting') || null,
      ...marcasDe(),
      style: estiloJson(),
      code_ttl_minutes: val('code_ttl_minutes') ? Number(val('code_ttl_minutes')) : null,
      reservations_enabled: kind !== 'flash_offer' && campo('reservations_enabled').checked,
      images,
      ...(lugar.activo() ? {
        venue_name: String(f.get('venue_name') || '').trim() || null,
        venue_address: String(f.get('venue_address') || '').trim() || null,
        venue_lat: lugar.punto?.lat ?? null,
        venue_lng: lugar.punto?.lng ?? null,
      } : {}),
    };
    try {
      await rpc('save_offer_template', { p_business: BIZ.id, p_name: r.name, p_data: data });
      const { data: tpl2 } = await sb.from('offer_templates').select('id, name, data, updated_at').eq('business_id', BIZ.id).order('updated_at', { ascending: false });
      guardadas = tpl2 || guardadas;
      toast('Plantilla guardada');
    } catch (err) { toast(friendly(err.message), true); }
  };

  // Las marcas, como las guarda la app: la edad solo con «Apto para niños»;
  // «Solidario» y «Escúchalo antes», solo en eventos (la base lo exige).
  const marcasDe = () => {
    const evento = kind === 'future_event';
    const raw = String(campo('listen_url').value || '').trim();
    return {
      solo_friendly: campo('solo_friendly').checked,
      card_requirements: $$('[name=card_requirements]:checked', v).map((c) => c.value).sort(),
      kid_ages: !campo('adults_only').checked && val('for_kids') === 'si' ? $$('[name=kid_ages]:checked', v).map((c) => c.value).sort() : [],
      charity: evento && campo('charity').checked,
      listen_url: evento && raw ? KMp.normaliza(raw) : null,
    };
  };

  // ── Errores: el bloque se abre solo y lleva hasta el campo ───────────────
  const limpiaErrores = () => {
    $('#formErr', v).textContent = '';
    $$('.err-campo', v).forEach((x) => x.remove());
    $$('[aria-invalid]', v).forEach((x) => x.removeAttribute('aria-invalid'));
  };
  const fallo = (el, texto) => {
    $('#formErr', v).textContent = texto;
    if (!el) return;
    const bloqueEl = el.closest('details.bloque');
    if (bloqueEl && !bloqueEl.open) bloqueEl.open = true;
    const caja = el.closest('label.f, fieldset, .bl-fila') || el.parentElement;
    const p = document.createElement('p');
    p.className = 'err-campo';
    p.textContent = texto;
    caja.appendChild(p);
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.setAttribute('aria-invalid', 'true');
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: suave ? 'smooth' : 'auto' });
    el.focus({ preventScroll: true });
  };

  // ── Guardar: borrador, publicar ya o programada ─────────────────────────
  const guarda = async ({ publicar, alas = null }) => {
    limpiaErrores();
    const f = new FormData($('#form'));
    const flash = kind === 'flash_offer';
    // Mismas reglas que la app (y que la base), en el orden del formulario.
    if (String(f.get('title') || '').trim().length < 3) {
      fallo(campo('title'), I18N.t('El título necesita al menos 3 caracteres.')); return;
    }
    // 8 · Fechas con sentido, como el selector de la app (de ayer a un año).
    {
      const ini0 = fromLocalInput(f.get('start'));
      const antes0 = id && toLocalInput(o.kind === 'future_event' ? o.event_at : o.redeem_start_at) === f.get('start');
      if (ini0 && !antes0 && (new Date(ini0) < Date.now() - 864e5 || new Date(ini0) > Date.now() + 365 * 864e5)) {
        fallo(campo('start'), I18N.t('La fecha tiene que estar entre ayer y dentro de un año.')); return;
      }
    }
    const iniF = fromLocalInput(f.get('start'));
    const finF = fromLocalInput(f.get('end'));
    if (!iniF || (flash && !finF)) {
      fallo(!iniF ? campo('start') : campo('end'), I18N.t('Falta cuándo: elige el inicio (y el final, si es una oferta flash).')); return;
    }
    if (finF && new Date(finF) <= new Date(iniF)) {
      fallo(campo('end'), I18N.t('El fin debe ser posterior al inicio.')); return;
    }
    const dType = val('discount_type');
    if (dType === 'other' && String(f.get('discount_value') || '').trim().length > 24) {
      fallo(campo('discount_value'), I18N.t('El descuento «Otro» cabe en 24 caracteres («2ª unidad −50 %»).')); return;
    }
    const priorRaw = (f.get('prior_price') || '').toString().replace(',', '.');
    const prior = priorRaw ? Math.round(parseFloat(priorRaw) * 100) : null;
    if (['percent', 'fixed'].includes(dType) && !prior) {
      fallo(campo('prior_price'), I18N.t('Pon el precio anterior: la ley obliga a enseñarlo junto al descuento.')); return;
    }
    // El 2x1 obliga a declarar si hay alcohol: por el texto no se sabe
    // («2x1 en bebidas» no dice nada) y la multa se la lleva el negocio.
    const alcohol = val('alcohol');
    if (dType === '2x1' && !alcohol) {
      fallo($('[name=alcohol]', v), I18N.t('Di si el 2x1 incluye bebidas alcohólicas.')); return;
    }
    // De RRPP: para qué RRPP, plazas y hasta cuándo vale (panel/rrpp.js).
    const audiencia = val('audience') || 'all';
    const rrpp = audiencia === 'promoters' ? rrppFormularioLee(v) : null;
    if (rrpp?.error) { fallo(rrpp.el, rrpp.error); return; }
    if (lugar.activo()) {
      if (String(f.get('venue_address') || '').trim().length < 5) {
        fallo(campo('venue_address'), I18N.t('Escribe la dirección del sitio.')); return;
      }
      if (!lugar.punto) {
        fallo($('#buscarLugar', v), I18N.t('Marca el sitio en el mapa.')); return;
      }
    }
    if (kind === 'future_event' && String(campo('listen_url').value || '').trim()
      && !KMp.servicio(KMp.normaliza(campo('listen_url').value))) {
      fallo(campo('listen_url'), MK.listenInvalid); return;
    }
    if (alas && new Date(alas) <= new Date()) { toast(I18N.t('La hora de publicación tiene que ser futura.'), true); return; }
    if (alas && new Date(alas) > Date.now() + 60 * 864e5) { toast(I18N.t('Se puede dejar programada como mucho a 60 días.'), true); return; }
    // Programada para cuando ya habría terminado: saldría caducada (como la app).
    const acaba = finF || (flash ? null : iniF);
    if (alas && acaba && new Date(alas) >= new Date(acaba)) { toast(I18N.t('Se publicaría cuando ya ha terminado: cambia las fechas o la hora de publicar.'), true); return; }
    const price = (f.get('price') || '').toString().replace(',', '.');
    const dValue = (f.get('discount_value') || '').toString().replace(',', '.');
    // Bajar el precio con códigos sin usar no es gratis: quien los tenga
    // pagará el nuevo. El negocio lo decide sabiéndolo.
    const newCents = price ? Math.round(parseFloat(price) * 100) : null;
    if (id && o.price_cents != null && newCents != null && newCents < o.price_cents) {
      let codes = 0;
      try { codes = await rpc('offer_pending_codes', { p_offer: id }); } catch (e2) { $('#formErr').textContent = I18N.t(friendly(e2.message)); return; }
      // El diálogo del panel (no el `confirm` del navegador, que no se
      // traduce ni se parece a nada de Klendar).
      const antes = fmtMoney(o.price_cents);
      const ahora = fmtMoney(newCents);
      if (codes > 0 && !await confirmDlg(bi('¿Bajar el precio?', 'Lower the price?'), esc(bi(
        `Hay ${codes} ${codes === 1 ? 'código' : 'códigos'} sin usar de ${antes}. Si lo dejas en ${ahora}, esas personas pagarán ${ahora} en el local. A quien ya canjeó no se le avisa.`,
        `There ${codes === 1 ? 'is 1 unused code' : `are ${codes} unused codes`} at ${antes}. If you change it to ${ahora}, those people will pay ${ahora} at the venue. People who have already redeemed won't be notified.`)),
      { submit: bi('Bajar el precio', 'Lower the price') })) {
        return;
      }
    }

    const reservas = !flash && campo('reservations_enabled').checked;
    const data = {
      business_id: BIZ.id,
      kind,
      title: f.get('title'),
      description: f.get('description') || null,
      terms: f.get('terms') || null,
      category_id: f.get('category_id') || null,
      external_url: flash ? null : (f.get('external_url') || null),
      price_cents: newCents,
      currency: 'EUR',
      discount: dType ? {
        type: dType,
        // «Otro» es texto libre: «2ª unidad −50 %», «Menú 9,90».
        value: dType === 'other'
          ? ((f.get('discount_value') || '').toString().trim() || null)
          : (dValue ? Number(dValue) : null),
        currency: 'EUR',
        ...(prior ? { compare_at_cents: prior } : {}),
        ...(dType === '2x1' ? { alcohol: alcohol === 'yes' } : {}),
      } : null,
      redeem_start_at: flash ? iniF : null,
      redeem_end_at: flash ? finF : null,
      event_at: flash ? null : iniF,
      event_end_at: flash ? null : finF,
      max_redemptions: f.get('max_redemptions') ? Number(f.get('max_redemptions')) : null,
      holds_seats: val('holds_seats') !== 'no',
      max_per_user: Number(f.get('max_per_user') || 1),
      code_ttl_minutes: val('code_ttl_minutes') ? Number(val('code_ttl_minutes')) : null,
      reservations_enabled: reservas,
      max_seats: reservas ? Number(f.get('max_seats') || 1) : 1,
      adults_only: campo('adults_only').checked,
      // null = como el local. Una +18 nunca se marca como apta para niños.
      for_kids: forKids(campo('adults_only').checked, val('for_kids')),
      setting: val('setting') || null,
      ...marcasDe(),
      audience: audiencia,
      // Las columnas de RRPP: las suyas o, si deja de serlo, las de siempre.
      ...(rrpp ? rrpp.cols : o.audience === 'promoters' ? RRPP_COLUMNAS_FUERA : {}),
      // Borrador, salvo que ya estuviera terminada, agotada o cancelada (se
      // queda así; editarla no la saca del cajón).
      status: alas ? 'draft' : (publicar ? 'active'
        : (id && ['expired', 'sold_out', 'cancelled'].includes(o.status) ? o.status : 'draft')),
      publish_at: alas,
      style: estiloJson(),
      // Sin sitio propio, la base pone el punto del negocio.
      venue_name: lugar.activo() ? (String(f.get('venue_name') || '').trim() || null) : null,
      venue_address: lugar.activo() ? (String(f.get('venue_address') || '').trim() || null) : null,
      ...(lugar.activo() && lugar.punto ? { location: `SRID=4326;POINT(${lugar.punto.lng} ${lugar.punto.lat})` } : {}),
    };
    // Cambios que la base avisa a quien ya tiene reserva o código (la misma
    // regla que `offers_codes_follow`): cuándo es (alargar el final no
    // cuenta), pausarla o marcarla +18. Se dice antes de guardar.
    if (id && !['cancelled', 'archived'].includes(data.status)) {
      const min = (s) => (s ? Math.floor(new Date(s).getTime() / 6e4) : null);
      const evento = data.kind === 'future_event';
      const fechas = data.kind !== o.kind || (evento
        ? min(data.event_at) !== min(o.event_at)
          || min(data.event_end_at || data.event_at) < min(o.event_end_at || o.event_at)
        : min(data.redeem_start_at) !== min(o.redeem_start_at)
          || min(data.redeem_end_at) < min(o.redeem_end_at));
      const motivos = [
        ...(fechas ? ['fechas'] : []),
        ...(data.status === 'draft' && ['active', 'sold_out'].includes(o.status) ? ['pausa'] : []),
        ...(data.adults_only && !o.adults_only ? ['adultos'] : []),
      ];
      if (motivos.length) {
        let vivos = 0;
        try { vivos = await rpc('offer_pending_codes', { p_offer: id }); } catch (e2) { $('#formErr').textContent = I18N.t(friendly(e2.message)); return; }
        if (vivos > 0 && !await confirmaAvisos(vivos, evento, motivos, bi('¿Guardar los cambios?', 'Save the changes?'), 'Guardar cambios')) return;
      }
    }
    try {
      let offerId = id;
      if (id) {
        const { error } = await sb.from('offers').update(data).eq('id', id);
        if (error) throw error;
        const { error: eFotos } = await sb.from('offer_images').delete().eq('offer_id', id);
        if (eFotos) throw eFotos;
      } else {
        if (serieCopia && campo('keep_series')?.checked) data.series_id = serieCopia.id;
        const { data: row, error } = await sb.from('offers').insert(data).select('id').single();
        if (error) throw error;
        offerId = row.id;
      }
      if (images.length) {
        const { error: eFotos2 } = await sb.from('offer_images').insert(images.map((url, i) => ({ offer_id: offerId, url, position: i })));
        if (eFotos2) throw eFotos2;
      }
      if (rrpp?.cols.promoter_scope === 'some') await rrppGuardaElegidos(offerId, rrpp.ids);
      // La del partido: unida a él (y el partido, marcado «Lo ponemos»).
      if (partido?.id) {
        const unida = await rpc('set_business_broadcast_offer', { p_business: BIZ.id, p_broadcast: partido.id, p_offer: offerId }).catch((e3) => ({ ok: false, error: e3.message }));
        if (unida?.ok === false) toast(friendly(unida.error), true);
      }
      toast(alas ? bi(`Programada: se publica el ${fmtProgramada(alas)}`, `Scheduled: goes live on ${fmtProgramada(alas)}`)
        : data.status === 'active' ? (enVivo ? I18N.t('Cambios guardados') : I18N.t('Publicada'))
          : I18N.t('Guardada en borrador'));
      // Guardado: ya no hay nada que perder al salir.
      GUARDA = null;
      location.hash = partido?.id ? '#/partidos' : '#/publicaciones';
    } catch (err) {
      // El aforo no baja de lo ya reservado o usado: la base dice cuánto es.
      const msg = String(err.message || '');
      const ocupadas = /capacity_below_reserved:(\d+)/.exec(msg);
      if (ocupadas) {
        fallo(campo('max_redemptions'), bi(`No puedes bajar el aforo a menos de ${ocupadas[1]}: ya hay ${ocupadas[1]} plazas reservadas o usadas.`,
          `You can't lower the capacity below ${ocupadas[1]}: ${ocupadas[1]} places are already reserved or used.`));
      } else if (/venue_too_far/.test(msg)) {
        fallo(campo('venue_address'), I18N.t(friendly(msg)));
      } else {
        $('#formErr').textContent = I18N.t(friendly(msg));
      }
    }
  };
  // Intro en un campo no publica: se decide con la barra de abajo.
  $('#form').onsubmit = (e) => e.preventDefault();

  // ── La barra: «Guardar borrador» y «Publicar ▾» (ahora o programada) ─────
  const fmtProgramada = (iso) => KZ.fmt(iso, TZ, LOC(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  // Un guardado a la vez: los botones de la barra se apagan mientras tanto.
  let ocupado = false;
  const ocupa = async (trabajo) => {
    if (ocupado) return;
    ocupado = true;
    const botones = $$('#barraPub button', v);
    botones.forEach((b) => { b.disabled = true; });
    try { await trabajo(); } finally {
      ocupado = false;
      botones.forEach((b) => { b.disabled = false; });
    }
  };
  const menu = $('#menuPub', v);
  const botonPub = $('#btnPublicar', v);
  const abreMenuPub = (abrir) => {
    menu.hidden = !abrir;
    botonPub.setAttribute('aria-expanded', String(abrir));
    if (abrir) $('button', menu).focus();
  };
  const pintaBarra = () => {
    $('#btnBorrador', v).textContent = enVivo ? I18N.t('Pasar a borrador') : programada ? I18N.t('Guardar') : I18N.t('Guardar borrador');
    $('#programadaTxt', v).hidden = enVivo || !programada;
    if (programada) $('#programadaCuando', v).textContent = bi(`Se publica el ${fmtProgramada(programada)}`, `Goes live on ${fmtProgramada(programada)}`);
    if (enVivo) {
      botonPub.textContent = I18N.t('Guardar cambios');
      botonPub.removeAttribute('aria-haspopup');
      botonPub.removeAttribute('aria-expanded');
    } else {
      botonPub.innerHTML = `${esc(I18N.t('Publicar'))} <span aria-hidden="true">▾</span>`;
      botonPub.setAttribute('aria-haspopup', 'menu');
      botonPub.setAttribute('aria-expanded', 'false');
      $('#pubProgramar', v).textContent = programada ? I18N.t('Cambiar la hora…') : I18N.t('Programar…');
    }
  };
  $('#btnBorrador', v).onclick = (e) => ocupa(() => (programada && !enVivo
    ? guarda({ publicar: true, alas: programada })
    : guarda({ publicar: false })));
  botonPub.onclick = (e) => {
    if (enVivo) { ocupa(() => guarda({ publicar: true })); return; }
    abreMenuPub(menu.hidden);
  };
  $('#pubAhora', v).onclick = () => { abreMenuPub(false); ocupa(() => guarda({ publicar: true })); };
  $('#pubProgramar', v).onclick = async () => {
    abreMenuPub(false);
    const r = await modal({
      title: I18N.t('Programar publicación'),
      intro: esc(I18N.t('Se guarda en borrador y se publica sola a esa hora.')),
      fields: [{ name: 'cuando', label: I18N.t('Día y hora'), type: 'datetime-local', required: true, value: toLocalInput(programada || new Date(Date.now() + 36e5).toISOString()) }],
      submit: I18N.t('Programar'),
    });
    if (!r?.cuando) return;
    const alas = fromLocalInput(r.cuando);
    if (!alas || new Date(alas) <= new Date()) { toast(I18N.t('La hora de publicación tiene que ser futura.'), true); return; }
    if (new Date(alas) > Date.now() + 60 * 864e5) { toast(I18N.t('Se puede dejar programada como mucho a 60 días.'), true); return; }
    programada = alas;
    pintaBarra();
    ocupa(() => guarda({ publicar: true, alas }));
  };
  $('#quitaProg', v).onclick = () => { programada = null; pintaBarra(); };
  // El menú se cierra con Escape o al tocar fuera.
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { abreMenuPub(false); botonPub.focus(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = $$('button', menu);
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    }
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.pub-grupo')) abreMenuPub(false); });

  renderPhotos();
  pintaLugar();
  pintaEntradas();
  pintaTipo();
  syncKind();
  syncDiscount();
  syncNinos();
  pintaEstilo();
  pintaBarra();
  pintaFinAuto();
  // La del partido vuelve a «Partidos que pones».
  if (partido?.id) { const atras = $('.page-head a.btn', v); if (atras) atras.setAttribute('href', '#/partidos'); }
  // Desde «Primeros pasos»: ya rellena con la primera de su gremio.
  if (!id && /[?&]idea=1\b/.test(location.hash) && ideas.length) aplicarIdea(ideas[0]);
  // Desde «Antes de cerrar» la primera vez: con esa idea (aunque su gremio
  // no la tenga).
  if (!id && /[?&]idea=before_closing\b/.test(location.hash)) {
    const IDEAS = window.KLENDAR_IDEAS || { general: [], bySlug: {} };
    const idea = ideas.find((t) => t.beforeClosing)
      || Object.values(IDEAS.bySlug).flat().find((t) => t.beforeClosing);
    if (idea) aplicarIdea(idea);
  }

  // ── Cambios sin guardar: se pregunta al salir (y al cerrar la pestaña) ───
  const estado = () => JSON.stringify([[...new FormData($('#form')).entries()], images, estilo, lugar.punto, kind, programada]);
  const foto = estado();
  GUARDA = { sucia: () => v.isConnected && estado() !== foto };
}

// ── Calendario ──────────────────────────────────────────────────────────────
// El mes con lo que tiene el negocio (puntos como en Explorar: eventos en
// coral, ofertas flash en ámbar) y, al lado (debajo en el móvil), lo del día
// elegido con la misma fila que la agenda de la web, su estado y «Crear este
// día». Todo en la hora del local. #/calendario/AAAA-MM-DD abre ese día.
// Cuenta todo lo que no está archivado: también borradores y programadas
// (el negocio planifica con ellas), cada una con su etiqueta.
const dosCifras = (n) => String(n).padStart(2, '0');
const sumaMes = (mes, n) => { const [y, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${dosCifras(d.getUTCMonth() + 1)}`; };
const inicioPub = (o) => (o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at);

PAGES.calendario = async (v, param) => {
  const [offersRaw] = await Promise.all([rpc('my_business_offers', { p_id: BIZ.id }), portadaNegocio()]);
  const offers = (offersRaw || []).filter((o) => o.status !== 'archived' && inicioPub(o));
  const hoy = KZ.hoy(TZ);
  let dia = /^\d{4}-\d{2}-\d{2}$/.test(param || '') ? param : hoy;
  let mes = dia.slice(0, 7);
  const porDia = new Map();
  for (const o of offers) {
    const d = KZ.dia(inicioPub(o), TZ);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d).push(o);
  }
  for (const l of porDia.values()) l.sort((a, b) => String(inicioPub(a)).localeCompare(String(inicioPub(b))));
  const loc = LOC();
  const largo = (iso) => KZ.fmt(`${iso}T12:00:00Z`, 'UTC', loc, { weekday: 'long', day: 'numeric', month: 'long' });
  const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const rel = (iso) => (iso === hoy ? I18N.t('Hoy') : iso === KZ.hoy(TZ, 1) ? I18N.t('Mañana') : '');
  const semana = [...Array(7)].map((_, i) => KZ.fmt(`2026-10-${dosCifras(5 + i)}T12:00:00Z`, 'UTC', loc, { weekday: 'short' }).replace('.', ''));
  const cuantas = (n) => bi(n === 1 ? '1 publicación' : `${fmtNum(n)} publicaciones`, n === 1 ? '1 publication' : `${fmtNum(n)} publications`);

  v.innerHTML = `
    <div class="page-head"><h1>Calendario</h1><span class="spacer"></span>
      <button type="button" class="btn sm ghost" id="calHoy">Hoy</button></div>
    <div class="calendario tjv" id="cal"></div>`;

  const pinta = (enfocar) => {
    const [y, m] = mes.split('-').map(Number);
    const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const hueco = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
    const titulo = mayus(KZ.fmt(`${mes}-15T12:00:00Z`, 'UTC', loc, { month: 'long', year: 'numeric' }));
    const celdas = [];
    for (let i = 0; i < hueco; i++) celdas.push('<span class="cal-dia vacio-dia" aria-hidden="true"></span>');
    for (let d = 1; d <= diasMes; d++) {
      const iso = `${mes}-${dosCifras(d)}`;
      const lista = porDia.get(iso) || [];
      const ev = lista.some((o) => o.kind !== 'flash_offer');
      const fl = lista.some((o) => o.kind === 'flash_offer');
      const puntos = lista.length ? `<span class="cal-puntos" aria-hidden="true">${ev ? '<i class="pe"></i>' : ''}${fl ? '<i class="pf"></i>' : ''}</span>` : '';
      const cls = `cal-dia${iso === hoy ? ' hoy' : ''}${iso === dia ? ' sel' : ''}${iso < hoy ? ' pasado' : ''}`;
      const etiqueta = `${largo(iso)}: ${lista.length ? cuantas(lista.length) : bi('nada', 'nothing')}`;
      celdas.push(`<a class="${cls}" href="#/calendario/${iso}" data-dia="${iso}" aria-label="${esc(etiqueta)}"${iso === dia ? ' aria-current="date"' : ''}>${d}${puntos}</a>`);
    }
    const delDia = porDia.get(dia) || [];
    const proximo = delDia.length ? null : [...porDia.keys()].sort().find((k) => k > dia);
    const crear = gestiona() ? `<div class="actions cal-crear">
        <a class="btn sm" href="#/publicaciones/nueva-flash?dia=${dia}">${ms('bolt')}${esc(I18N.t('Oferta flash este día'))}</a>
        <a class="btn sm" href="#/publicaciones/nuevo-evento?dia=${dia}">${ms('event')}${esc(I18N.t('Evento este día'))}</a></div>` : '';
    $('#cal', v).innerHTML = `
      <section class="cal-mes" aria-labelledby="calTitulo">
        <div class="cal-cab">
          <button type="button" class="cal-nav" data-mes="-1" aria-label="${esc(I18N.t('Mes anterior'))}">${svg('izq', 22)}</button>
          <h2 id="calTitulo" aria-live="polite">${esc(titulo)}</h2>
          <button type="button" class="cal-nav" data-mes="1" aria-label="${esc(I18N.t('Mes siguiente'))}">${svg('der', 22)}</button>
        </div>
        <div class="cal-rejilla">
          ${semana.map((w) => `<span class="cal-sem" aria-hidden="true">${esc(w)}</span>`).join('')}
          ${celdas.join('')}
        </div>
        <p class="cal-leyenda"><span><i class="pe"></i>${esc(I18N.t('Eventos'))}</span><span><i class="pf"></i>${esc(I18N.t('Ofertas flash'))}</span></p>
      </section>
      <section class="cal-lista" id="calDia" aria-labelledby="diaTitulo">
        <div class="cal-lista-cab">
          <h2 id="diaTitulo" tabindex="-1">${esc(rel(dia) ? `${rel(dia)} · ${largo(dia)}` : mayus(largo(dia)))}</h2>
          <span class="muted">${esc(cuantas(delDia.length))}</span>
        </div>
        ${delDia.length
          ? `<div class="tj-filas">${delDia.map((o) => `<div class="cal-item">${tarjetaPanel(o, { forma: 'fila', h: 'h3', href: hrefPub(o) })}<p class="cal-item-estado">${estadoPub(o) === 'activa' ? '' : etiquetaEstado(o)}</p></div>`).join('')}</div>`
          : `<p class="muted cal-nada">${esc(I18N.t(dia < hoy ? 'Ese día no tuviste nada publicado.' : 'Aún no tienes nada para ese día.'))}${proximo ? `<br><a href="#/calendario/${proximo}" data-dia="${proximo}">${esc(bi(`Lo siguiente: ${rel(proximo) || largo(proximo)}`, `Next up: ${rel(proximo) || largo(proximo)}`))} →</a>` : ''}</p>`}
        ${dia >= hoy ? crear : ''}
      </section>`;
    I18N.translate($('#cal', v));
    activaVideos($('#cal', v));
    $$('[data-dia]', v).forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        dia = a.dataset.dia;
        mes = dia.slice(0, 7);
        // Sin «hashchange»: no se vuelve a pedir nada, pero el enlace vale.
        history.replaceState(null, '', `${location.pathname}${location.search}#/calendario/${dia}`);
        pinta('dia');
      };
    });
    $$('[data-mes]', v).forEach((b) => {
      b.onclick = () => { mes = sumaMes(mes, Number(b.dataset.mes)); pinta(`mes${b.dataset.mes}`); };
    });
    // Tras elegir un día, el foco va a su lista (en el móvil está debajo);
    // tras cambiar de mes, se queda en la flecha.
    if (enfocar === 'dia') {
      const h = $('#diaTitulo', v);
      h.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 900px)').matches) h.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (enfocar?.startsWith('mes')) {
      $(`[data-mes="${enfocar.slice(3)}"]`, v)?.focus();
    }
  };
  $('#calHoy', v).onclick = () => { dia = hoy; mes = hoy.slice(0, 7); history.replaceState(null, '', `${location.pathname}${location.search}#/calendario/${dia}`); pinta('dia'); };
  pinta();
};

// ── Antes de cerrar ─────────────────────────────────────────────────────────
// Lo que sobra del día, con descuento y pagando en el local (migración
// 20261121100000). La primera vez, el formulario con la idea «Antes de
// cerrar»; después, en dos toques con lo de la última vez ya puesto
// (cambiar las bolsas o la hora es opcional). Y el recordatorio diario,
// apagado de serie. Lo mismo que la hoja de «Mi negocio» en la app.
PAGES['antes-de-cerrar'] = async (v) => {
  let s = await rpc('before_closing_setup', { p_business: BIZ.id });
  ANTES = s;
  if (!s?.last) {
    location.replace('#/publicaciones/nueva-flash?idea=before_closing');
    return;
  }
  const u = s.last;
  const hora = (iso) => new Date(iso).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  const bolsasTxt = (n) => bi(n === 1 ? '1 bolsa' : `${n} bolsas`, n === 1 ? '1 bag' : `${n} bags`);
  const quedanTxt = (n) => (n === 0 ? bi('Agotado', 'Sold out') : bi(n === 1 ? 'Queda 1 bolsa' : `Quedan ${n} bolsas`, n === 1 ? '1 bag left' : `${n} bags left`));
  const trato = u.discount ? I18N.t(etiquetaDescuento(u.discount)) : (u.price_cents != null ? fmtMoney(u.price_cents, u.currency) : '');
  let bolsas = Math.max(1, Math.min(500, u.seats || 6));
  const ventana = () => (s.window.at_close
    ? bi(`De ${hora(s.window.from)} al cierre (${hora(s.window.until)})`, `From ${hora(s.window.from)} until closing (${hora(s.window.until)})`)
    : bi(`De ${hora(s.window.from)} a ${hora(s.window.until)}`, `From ${hora(s.window.from)} to ${hora(s.window.until)}`));
  v.innerHTML = `
    <div class="page-head"><h1>Antes de cerrar</h1></div>
    <p class="muted" style="margin:-6px 0 14px">${esc(bi('Lo que te ha sobrado hoy, con lo de la última vez ya puesto. Se paga en el local.',
      'What you have left today, with last time’s details already filled in. People pay at the venue.'))}</p>
    ${s.live ? `<div class="scan-result warn">${ms('info')}${esc(bi(`Ya tienes una publicada: ${quedanTxt(s.live.seats_left ?? 0).toLowerCase()}, hasta las ${hora(s.live.until)}.`,
      `You already have one live: ${quedanTxt(s.live.seats_left ?? 0)}, until ${hora(s.live.until)}.`))}</div>` : ''}
    <div class="card antes">
      <div class="antes-ultima">
        ${u.image ? `<img src="${esc(u.image)}" alt="" loading="lazy">` : `<span class="antes-ic">${svg('bolsa', 26)}</span>`}
        <div><b>${esc(u.title)}</b>${trato ? `<span class="antes-trato">${esc(trato)}</span>` : ''}${u.terms ? `<small class="muted">${esc(u.terms)}</small>` : ''}</div>
      </div>
      <div class="antes-fila">
        <span class="etq">${esc(bi('Bolsas', 'Bags'))}</span>
        <button class="btn sm" type="button" data-bolsas="-1" aria-label="${esc(bi('Una bolsa menos', 'One bag fewer'))}">−</button>
        <output id="bolsas" aria-live="polite">${esc(bolsasTxt(bolsas))}</output>
        <button class="btn sm" type="button" data-bolsas="1" aria-label="${esc(bi('Una bolsa más', 'One more bag'))}">+</button>
      </div>
      <label class="f"><span>${esc(bi('Recogida desde', 'Pick-up from'))}</span><input type="time" id="desde" value="${esc(hhmm(s.window.from))}"></label>
      <p class="hint" id="ventana">${esc(ventana())}</p>
      <button class="btn primary grande" type="button" id="publicaAntes">${esc(I18N.t('Publicar'))}</button>
      <p style="margin:10px 0 0;text-align:center"><a class="link" href="#/publicaciones/nueva-flash?from=${esc(u.id)}">${esc(bi('Cambiar más cosas', 'Change more details'))}</a></p>
    </div>
    <div class="card"><h2>${esc(bi('Recordármelo cada día', 'Remind me every day'))}</h2>
      <label class="opcion"><input type="checkbox" id="recOn" ${s.reminder_at ? 'checked' : ''}><span id="recTxt"></span></label>
      <label class="f" style="max-width:200px"><span>${esc(bi('Hora', 'Time'))}</span><input type="time" id="recHora" min="06:00" max="23:00" value="${esc(s.reminder_at || u.from_time || '20:00')}"></label>
      <p class="hint">${esc(bi('Llega a quien puede publicar (propietario y encargados), si ese día no está cerrado y aún no has publicado la de hoy.',
        'It goes to whoever can post (owner and managers), unless you’re closed that day or have already posted today’s.'))}</p>
    </div>`;
  const pintaRec = () => {
    $('#recTxt', v).textContent = s.reminder_at
      ? bi(`A las ${s.reminder_at}: «¿Te ha sobrado algo hoy?»`, `At ${s.reminder_at}: “Anything left over today?”`)
      : bi('Apagado. Te avisamos a la hora que elijas.', 'Off. We’ll remind you at the time you choose.');
  };
  pintaRec();
  $$('[data-bolsas]', v).forEach((b) => {
    b.onclick = () => {
      bolsas = Math.max(1, Math.min(500, bolsas + Number(b.dataset.bolsas)));
      $('#bolsas', v).textContent = bolsasTxt(bolsas);
    };
  });
  $('#desde', v).onchange = async () => {
    const [h, m] = String($('#desde', v).value || '').split(':').map(Number);
    if (!Number.isFinite(h)) return;
    const [y, mo, d] = KZ.hoy(TZ).split('-').map(Number);
    const desde = KZ.instante(TZ, y, mo, d, h, m || 0);
    try {
      s = await rpc('before_closing_setup', { p_business: BIZ.id, p_from: desde.toISOString() });
      $('#ventana', v).textContent = ventana();
    } catch (e) { toast(friendly(e.message), true); }
  };
  $('#publicaAntes', v).onclick = async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const r = await rpc('publish_before_closing', { p_business: BIZ.id, p_seats: bolsas, p_from: s.window.from });
      if (!r?.ok) {
        toast(r?.error === 'invalid_window' ? bi('A esa hora ya no da tiempo: elige una hora antes del cierre.',
          'It’s too late for that time: choose a time before closing.') : friendly(r?.error), true);
        return;
      }
      toast(bi('Publicada: ya sale en Descubre con el sello «Antes de cerrar».', 'Posted: it’s on Discover now with the “Before closing” badge.'));
      location.hash = '#/publicaciones';
    } catch (err) {
      toast(friendly(err.message), true);
    } finally { b.disabled = false; }
  };
  const guardaRec = async () => {
    const on = $('#recOn', v).checked;
    try {
      const r = await rpc('set_before_closing_reminder', { p_business: BIZ.id, p_at: on ? $('#recHora', v).value : null });
      if (!r?.ok) { toast(r?.error === 'invalid_time' ? bi('Elige una hora entre las 6:00 y las 23:00.', 'Choose a time between 6:00 and 23:00.') : friendly(r?.error), true); $('#recOn', v).checked = !!s.reminder_at; return; }
      s.reminder_at = r.reminder_at || null;
      pintaRec();
    } catch (err) { toast(friendly(err.message), true); }
  };
  $('#recOn', v).onchange = guardaRec;
  $('#recHora', v).onchange = () => { if ($('#recOn', v).checked) guardaRec(); };
};

// ── Validar códigos ─────────────────────────────────────────────────────────
/** Por qué no se ha podido validar un código, dicho para la puerta. Lo usan
 * el escáner y «Dar entrada» en Asistentes. */
const ERR_VALIDAR = {
  invalid_code: 'Ese código no existe.',
  not_authorized: 'Ese código no es de tus negocios.',
  already_validated: 'Ese código ya se usó.',
  code_expired: 'El código ha caducado: pide que generen otro.',
  // Anulada por quien reservó o al cancelar el evento: su plaza ya no es suya.
  code_cancelled: 'Reserva anulada: este código ya no vale.',
  sold_out: 'Aforo completo: ya han entrado todas las plazas.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento.',
  // Escaneado sin conexión y enviado tarde (la base acepta hasta 24 h).
  scan_too_old: 'Se escaneó hace más de 24 horas: ya no se puede validar.',
  offer_cancelled: 'Esta publicación está cancelada: el código ya no vale.',
  offer_removed: 'Klendar ha retirado esta publicación: el código ya no vale.',
  business_inactive: 'Tu negocio está desactivado: no se pueden validar códigos. Escríbenos a info@klendar.app.',
  account_suspended: 'Tu cuenta está suspendida: no puedes validar códigos. Si crees que es un error, escribe a info@klendar.app.',
  // Validar desde «Buscar en las listas de esta noche» (door_validate).
  not_on_list: 'Ese código no está en las listas de esta noche.',
};

/** Por qué no vale un código. Si es de un local en el que no trabajas, cuál
 * («Este código es de Bar X, no de tus negocios»), como en la app. */
function textoErrorValidar(res) {
  if (res.error === 'not_authorized' && res.business_name) {
    return bi(`Este código es de ${res.business_name}, no de tus negocios.`,
      `This code is from ${res.business_name}, not from your businesses.`);
  }
  return I18N.t(ERR_VALIDAR[res.error] || friendly(res.error));
}

/** Pasa el panel a otro de tus locales (como el selector de arriba, que
 * también lo recuerda para la próxima vez). */
function cambiaDeLocal(id) {
  const sel = $('#bizSelect');
  if (!sel || !BIZZES.some((b) => b.id === id) || BIZ?.id === id) return;
  sel.value = id;
  sel.dispatchEvent(new Event('change'));
}

/** Qué hay que dar (como `codeDealParts` en la app), en dos trozos: lo que
 * se aplica («−25 % · 3,00 €», «2x1», «Gratis», «12,00 €»; en un premio o un
 * regalo, el premio) y el precio de antes («en vez de 4,00 €»), que va
 * debajo. */
function partesDelCanje(r) {
  if (r.kind === 'stamp_reward' || r.kind === 'birthday_gift') return [r.offer_title || '', ''];
  const cur = r.currency || 'EUR';
  const pagar = r.pay_cents != null ? fmtMoney(r.pay_cents, cur) : '';
  const antes = r.compare_at_cents != null ? fmtMoney(r.compare_at_cents, cur) : '';
  const enVez = antes && antes !== pagar ? bi(`en vez de ${antes}`, `instead of ${antes}`) : '';
  const d = r.discount;
  if (!d) return [r.price_cents != null ? fmtMoney(r.price_cents, cur) : pagar, ''];
  const et = I18N.t(etiquetaDescuento(d));
  if (d.type === 'percent') return [pagar ? `${et} · ${pagar}` : et, pagar ? enVez : ''];
  if (d.type === 'fixed') return [et, enVez];
  return [et, ''];
}

/** «20:14» si es de hoy (en la hora del negocio); si no, con el día. */
function horaCodigo(iso) {
  if (!iso) return '';
  const f = new Date(iso);
  const dia = (x) => x.toLocaleDateString('en-CA', { timeZone: TZ });
  const hora = f.toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  return dia(f) === dia(new Date()) ? hora
    : `${f.toLocaleDateString(LOC(), { day: 'numeric', month: 'short', timeZone: TZ })}, ${hora}`;
}

/** Lo que hay que saber de un código en la puerta, de un vistazo aunque haya
 * varias ofertas a la vez: la publicación en grande (foto y tipo), qué hay
 * que dar (en coral, solo si vale), plazas, condiciones y quién. Igual que
 * `CodeDetailsView` en la app. `estado`: ok | ready | bad. */
function tarjetaCodigo(r, estado) {
  const ajeno = r.error === 'not_authorized';
  const tipo = r.kind === 'stamp_reward' ? I18N.t('Tarjeta de sellos')
    : r.kind === 'birthday_gift' ? bi('Regalo de cumpleaños', 'Birthday gift')
      : r.offer_kind === 'future_event' ? I18N.t('Evento') : r.offer_kind ? I18N.t('Oferta flash') : '';
  const titulo = r.kind === 'stamp_reward' && r.card_name ? bi(`Premio de «${r.card_name}»`, `Reward from “${r.card_name}”`)
    : r.kind === 'birthday_gift' ? bi('Regalo de cumpleaños', 'Birthday gift') : (r.offer_title || '');
  const icono = r.kind === 'stamp_reward' ? 'loyalty' : r.kind === 'birthday_gift' ? 'cake'
    : r.offer_kind === 'future_event' ? 'event' : 'redeem';
  const foto = r.offer_image ? `<img src="${esc(r.offer_image)}" alt="" loading="lazy">` : `<span class="cod-ic">${ms(icono)}</span>`;
  const [dar, antes] = ajeno ? ['', ''] : partesDelCanje(r);
  const lineas = [];
  if (r.user_name) {
    lineas.push(`${ms('person')}<b>${esc(r.user_name)}</b>${r.obtained_at
      ? ` · ${esc(bi('lo consiguió', 'got it'))}: ${esc(horaCodigo(r.obtained_at))}` : ''}`);
  }
  // De otro de tus locales (validar no pide negocio: el código dice de cuál
  // es). Lo de un local ajeno ya va en el título.
  if (!ajeno && r.business_id && BIZ && r.business_id !== BIZ.id && BIZZES.some((b) => b.id === r.business_id)) {
    lineas.push(ms('storefront') + esc(bi(`Es de ${r.business_name || ''}, otro de tus locales: sale en sus «Últimos validados».`,
      `It's from ${r.business_name || ''}, another of your venues: it shows in its “Recently validated”.`))
      + ` <button class="btn sm ghost" type="button" data-otro-local="${esc(r.business_id)}">${esc(bi(`Ir a ${r.business_name || ''}`, `Go to ${r.business_name || ''}`))}</button>`);
  }
  if (r.validated_at && estado !== 'ready') {
    lineas.push(ms('check_circle') + esc(`${bi('Se validó', 'Validated')}: ${horaCodigo(r.validated_at)}${r.validated_by_name
      ? ` · ${bi('por', 'by')} ${r.validated_by_name}` : ''}`));
  }
  if (r.error === 'code_expired' && r.expires_at) {
    lineas.push(ms('timer_off') + esc(`${bi('Caducó', 'Expired')}: ${horaCodigo(r.expires_at)}`));
  }
  const plazas = (r.seats || 1) > 1 && !ajeno;
  // De la lista de un RRPP: bien a la vista, debajo del título.
  const nombreRrpp = r.promoter_name || I18N.t('Usuario de Klendar');
  const rrpp = !ajeno && (r.promoter_id || r.promoter_name)
    ? `<p class="cod-rrpp">${ms('person')}<span>${esc(bi(`Lista de ${nombreRrpp}`, `${nombreRrpp}'s list`))}${r.promoter_off_offer
      ? `<small>${esc(bi('fuera de su oferta', 'outside their offer'))}</small>` : ''}</span></p>` : '';
  const tipoRrpp = r.promoter_offer && !ajeno ? bi('Oferta de RRPP', 'Promoter offer') : '';
  // Con carné: «Pide el carné de estudiante», bien visible (lo comprueba el
  // local; la app no puede). Como `CardAskBanner` en la app.
  const KMc = window.KlendarMarcas;
  const docs = KMc && !ajeno && estado !== 'bad' ? KMc.documentos(r.card_requirements, I18N.lang) : '';
  const carne = docs ? `<p class="cod-carne" role="status">${ms('school')}<b>${esc(KMc.t(I18N.lang).cardAsk(docs))}</b></p>` : '';
  return `<div class="codigo-card ${estado}">
    <div class="cod-top">${foto}<div class="cod-cab">
      ${tipo || r.business_name ? `<span class="cod-tipo">${esc([tipo, tipoRrpp, r.business_name].filter(Boolean).join(' · '))}</span>` : ''}
      <h2 class="cod-titulo">${esc(titulo)}</h2></div></div>
    ${rrpp}
    ${carne}
    ${dar ? `<p class="cod-label">${esc(estado === 'bad' ? bi('Era para', 'It was for') : bi('Aplicar al cliente', 'Apply to the customer'))}</p>
      <p class="cod-dar">${esc(dar)}</p>
      ${antes ? `<p class="cod-antes">${esc(antes)}</p>` : ''}` : ''}
    ${r.price_kept && !ajeno ? `<p class="cod-linea">${ms('lock_clock')}${esc(bi('Se mantiene el precio de cuando lo consiguió: hoy está más caro.',
      'They keep the price from when they got it: it costs more today.'))}</p>` : ''}
    ${plazas ? `<p class="cod-plazas">${esc(bi(`Entran ${r.seats} personas`, `${r.seats} people come in`))}</p>` : ''}
    ${r.terms && !ajeno ? `<p class="cod-cond">${esc(bi('Condiciones', 'Conditions'))}: ${esc(r.terms)}</p>` : ''}
    ${lineas.map((l) => `<p class="cod-linea">${l}</p>`).join('')}
  </div>`;
}

/** De dónde sale un código validado: la publicación, una tarjeta de sellos o
 * el regalo de cumpleaños (`business_recent_validations`, `business_report`). */
const queValidado = (r) => (r.kind === 'stamp_reward'
  ? `${I18N.t('Tarjeta de sellos')}${r.detail ? ` «${r.detail}»` : ''}`
  : r.kind === 'birthday_gift' ? I18N.t('Regalo de cumpleaños')
    : I18N.t(r.kind === 'future_event' ? 'Evento' : 'Oferta flash'));
/** «sin conexión»: se escaneó sin red y se validó después, a la hora del
 * escaneo (`offline` en `business_recent_validations` y `business_report`). */
const etiquetaSinConexion = (r) => (r.offline ? ` <span class="tag dim">${esc(bi('sin conexión', 'offline'))}</span>` : '');
/** Quién lo usó: su nombre, «Usuario de Klendar» sin nombre o «Cuenta
 * eliminada» si ya no tiene cuenta (el canje se queda, sin nadie detrás). */
const personaValidada = (r) => (r.deleted_account ? I18N.t('Cuenta eliminada') : (r.person || I18N.t('Usuario de Klendar')));

// ── Importe del ticket y «Cuánto te ha traído Klendar» ───────────────────
// Lo que paga la persona al canjear (opcional): lo apunta cualquiera del
// equipo al validar o después en «Últimos validados», durante 24 h
// (`set_redemption_ticket`, migración 20261121100000). Igual que la app.
const ERR_TICKET = {
  invalid_amount: 'Escribe un importe, por ejemplo 12,50.',
  ticket_too_late: 'Han pasado más de 24 horas: ya no se puede cambiar.',
  not_validated: 'Ese código aún no está validado.',
};
/** «12,50», «12.50», «12 €» → céntimos; null si no es un importe. */
const centimosTicket = (txt) => {
  const t = String(txt || '').replace(/[\s€]|EUR/gi, '').replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  const c = Math.round(parseFloat(t) * 100);
  return c > 0 && c <= 10000000 ? c : null;
};
const textoTicket = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', I18N.lang === 'en' ? '.' : ','));
/** Euros enteros para los totales: «1143 €». */
const eurosEnteros = (c, cur = 'EUR') => Math.round((c || 0) / 100)
  .toLocaleString(LOC(), { style: 'currency', currency: cur || 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
/** Guarda (o quita, vacío) el importe del ticket de [code]. Devuelve
 * {ok, ticket_cents} o {ok:false, error}. */
async function guardaTicket(code, texto) {
  const vacio = !String(texto || '').trim();
  const cents = vacio ? null : centimosTicket(texto);
  if (!vacio && cents == null) return { ok: false, error: 'invalid_amount' };
  try {
    return await rpc('set_redemption_ticket', { p_code: code, p_cents: cents });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
/** El campo pequeño «Importe del ticket (opcional)» bajo un código recién
 * validado. No es un paso más: se puede dejar en blanco. */
function cajaTicket(caja, code, inicial = null) {
  caja.innerHTML = `<div class="ticket-caja">
    <label class="f"><span>${esc(I18N.t('Importe del ticket (opcional)'))}</span>
      <span class="ticket-fila"><input class="ticket-in" inputmode="decimal" autocomplete="off" placeholder="12,50" value="${esc(textoTicket(inicial))}"><span aria-hidden="true">€</span>
      <button class="btn sm" type="button">${esc(I18N.t('Guardar el importe'))}</button></span></label>
    <p class="hint ticket-msg" aria-live="polite">${esc(I18N.t('Lo que ha pagado en total. Afina «Cuánto te ha traído Klendar».'))}</p></div>`;
  const input = $('.ticket-in', caja);
  const msg = $('.ticket-msg', caja);
  const guarda = async () => {
    const r = await guardaTicket(code, input.value);
    msg.classList.toggle('err', !r?.ok);
    msg.textContent = r?.ok
      ? I18N.t(r.ticket_cents == null ? 'Importe quitado' : 'Importe guardado')
      : I18N.t(ERR_TICKET[r?.error] || friendly(r?.error));
    if (r?.ok && $('#recent')) $('#recent').dispatchEvent(new Event('recargar'));
  };
  $('button', caja).onclick = guarda;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); guarda(); } });
}

PAGES.validar = async (v) => {
  v.innerHTML = `
    <div class="page-head"><h1>Validar códigos</h1></div>
    ${helpBox('¿Cómo funciona?', `<p>Escanea el QR con la cámara (la del móvil o la del portátil) o escribe el código que la persona tiene debajo del QR. Cada código vale una vez: al validarlo queda marcado y el aforo baja.</p><p>Si es una reserva para varios, te decimos cuántas personas entran con ese código.</p><p>${bi('Con el <b>QR de cliente</b> de alguien ves sus bonos de tu negocio: puedes cargarle uno o descontar un uso.', 'With someone’s <b>customer QR code</b> you see their passes from your business: you can add one or use one.')}</p>`)}
    <div class="scan-box">
      <button class="btn" id="camara" type="button">${ms('photo_camera')}Escanear con la cámara</button>
      <div class="camara" id="camara-caja" hidden><video id="video" muted playsinline></video><span class="mira" aria-hidden="true"></span></div>
      <input id="code" placeholder="Código o enlace del QR" autocomplete="off" autofocus>
      <button class="btn primary" id="go">Validar</button>
      <div id="result" aria-live="assertive"></div>
      <div id="cola"></div>
    </div>
    <div id="puertaRrpp"></div>
    <div class="card" style="margin-top:18px"><h2>Últimos validados</h2>
      <p class="muted" style="margin:0 0 10px">${esc(I18N.t('Durante 24 horas puedes apuntar o corregir el importe del ticket de cada canje.'))}</p>
      <div id="recent"></div></div>`;

  // ── Sin conexión: los códigos se guardan y se validan al volver la red ──
  // (como en la app). Se guardan por negocio en este navegador.
  const COLA = `klendar.cola.${BIZ.id}`;
  const leeCola = () => { try { return JSON.parse(localStorage.getItem(COLA) || '[]'); } catch { return []; } };
  const guardaCola = (c) => { try { localStorage.setItem(COLA, JSON.stringify(c)); } catch { /* sin espacio */ } };
  const pintaCola = () => {
    const c = leeCola();
    const caja = $('#cola');
    if (!caja) return; // ya estás en otra pantalla
    caja.innerHTML = c.length ? `<div class="scan-result warn">${ms('cloud_off')}${esc(I18N.lang === 'en'
      ? `${c.length} code(s) waiting for a connection`
      : `${c.length} código(s) esperando conexión`)}<small>${esc(I18N.t('Se validará solo en cuanto vuelva la cobertura.'))}</small>
      <button class="btn sm" id="enviaCola" type="button">${esc(I18N.t('Enviar ahora'))}</button></div>` : '';
    const b = $('#enviaCola');
    if (b) b.onclick = () => enviaCola();
  };
  // `rpc` ya lo trae traducido («No hay conexión…»); se mira también el crudo.
  const sinRed = (msg) => !navigator.onLine || /fetch|network|NetworkError|Load failed|No hay conexión/i.test(String(msg || ''));
  let enviando = false;
  const enviaCola = async () => {
    const c = leeCola();
    if (!c.length || enviando || !navigator.onLine) return;
    enviando = true;
    let ok = 0; let mal = 0; const quedan = [];
    for (const item of c) {
      try {
        // Con la hora del escaneo: la base lo acepta si valía entonces (hasta
        // 24 h antes). Las entradas viejas, sin hora, van como siempre.
        const r = await rpc('validate_redemption', item.at
          ? { p_code: item.code, p_scanned_at: item.at } : { p_code: item.code });
        if (r?.ok) ok++; else mal++;
      } catch (e) {
        if (sinRed(e.message)) quedan.push(item); else mal++;
      }
    }
    guardaCola(quedan);
    enviando = false;
    pintaCola();
    if (ok || mal) {
      toast(I18N.lang === 'en' ? `Pending codes sent: ${ok} valid, ${mal} rejected.`
        : `Pendientes enviados: ${ok} validados, ${mal} rechazados.`, mal > 0);
      if ($('#recent')) loadRecent();
    }
  };
  // Un solo oyente aunque se entre varias veces en esta pantalla.
  window.removeEventListener('online', window.KL_ENVIA_COLA || (() => {}));
  window.KL_ENVIA_COLA = enviaCola;
  window.addEventListener('online', enviaCola);

  // Todo lo que se valida aquí, de la publicación que sea (antes solo las 5
  // más recientes): también premios de sellos y regalos de cumpleaños. Lo
  // mismo que «Canjes validados» del informe, en la app y aquí.
  const loadRecent = async () => {
    const rows = await rpc('business_recent_validations', { p_business: BIZ.id, p_limit: 15 }).catch(() => []);
    const caja = $('#recent');
    if (!caja) return; // ya estás en otra pantalla
    caja.innerHTML = table({
      cols: [
        { h: 'Cuándo', r: (r) => fmtDate(r.at) },
        { h: 'Qué', r: (r) => `<b class="title">${esc(r.title)}</b><span class="sub">${esc(queValidado(r))}${etiquetaSinConexion(r)}</span>` },
        { h: 'Persona', r: (r) => `${esc(personaValidada(r))}${r.promoter_name ? `<span class="sub">${rrppListaDe(r)}</span>` : ''}` },
        // El ticket (24 h para apuntarlo o corregirlo) o, si no, lo estimado.
        { h: 'Ticket', r: (r) => {
          const editable = r.ticket_until && new Date(r.ticket_until) > new Date();
          const valor = r.ticket_cents != null ? `<b>${esc(fmtMoney(r.ticket_cents, r.currency))}</b>`
            : r.estimate_cents != null ? `<span class="muted">${esc(bi('Estimado', 'Estimated'))}: ${esc(fmtMoney(r.estimate_cents, r.currency))}</span>` : '';
          const boton = editable ? `<button class="btn sm ghost" type="button" data-ticket="${esc(r.code)}" data-cents="${r.ticket_cents ?? ''}">${esc(I18N.t(r.ticket_cents != null ? 'Cambiar' : 'Añadir ticket'))}</button>` : '';
          return `<span class="ticket-celda">${valor}${valor && boton ? ' ' : ''}${boton}</span>`;
        } },
      ],
      rows: rows || [],
      empty: 'Todavía no has validado ningún código.',
    });
    // Apuntar o corregir el ticket ahí mismo.
    $$('[data-ticket]', caja).forEach((b) => {
      b.onclick = () => {
        const celda = b.closest('.ticket-celda');
        cajaTicket(celda, b.dataset.ticket, b.dataset.cents ? Number(b.dataset.cents) : null);
        $('.ticket-in', celda)?.focus();
      };
    });
  };

  let validando = false;
  const validate = async () => {
    if (validando) return;
    const raw = $('#code').value.trim();
    if (!raw) return;
    validando = true;
    $('#go').disabled = true;
    try { await validaUno(raw); } finally { validando = false; $('#go').disabled = false; }
  };
  const validaUno = async (raw) => {
    // El QR de cliente (bonos): sus bonos, para cargar uno o descontar un
    // uso (panel/bonos.js). Necesita red: no va a la cola.
    if (await bonoCliente($('#result'), raw)) { $('#code').value = ''; return; }
    // Tecleado se ve en grupos de cuatro («0882 7EC7 …»): fuera espacios y guiones.
    const code = raw.includes('/r/') ? raw.split('/r/').pop().split(/[?#]/)[0] : raw.replace(/[\s-]/g, '');
    const aLaCola = () => {
      const c = leeCola();
      if (!c.some((x) => x.code === code)) c.push({ code, at: new Date().toISOString() });
      guardaCola(c);
      $('#result').innerHTML = `<div class="scan-result warn">${ms('cloud_off')}${esc(I18N.t('Sin conexión: código guardado'))}<small>${esc(I18N.t('Se validará solo en cuanto vuelva la cobertura.'))}</small></div>`;
      $('#code').value = '';
      pintaCola();
    };
    if (!navigator.onLine) { aLaCola(); return; }
    try {
      const res = await rpc('validate_redemption', { p_code: code });
      pintaResultado({ ...res, code_input: code }, res.ok ? 'ok' : 'bad');
      if (res.ok) {
        if (navigator.vibrate) navigator.vibrate(120);
        $('#code').value = '';
        loadRecent();
      } else if (navigator.vibrate) {
        navigator.vibrate([60, 60, 60]);
      }
    } catch (e) {
      if (sinRed(e.message)) aLaCola(); else toast(friendly(e.message), true);
    }
  };
  /** Arriba, el estado (verde: aplicar; ámbar: sin validar todavía; rojo: no
   * vale); debajo, qué código es. En la vista previa, el botón «Validar». */
  const pintaResultado = (res, estado) => {
    const cab = estado === 'ok' ? `${ms('check_circle')}${esc(I18N.t('Validado'))}`
      : estado === 'ready' ? `${ms('qr_code_2')}${esc(bi('Código sin usar', 'Unused code'))}<small>${esc(bi(
        'Todavía no está validado. Compruébalo y pulsa «Validar».', 'It hasn’t been validated yet. Check it and tap “Validate”.'))}</small>`
        : `${ms('cancel')}${esc(textoErrorValidar(res))}${!res.offer_title && res.validated_at
          ? `<small>${esc(bi('Se validó el', 'Validated on'))} ${esc(fmtDate(res.validated_at))}</small>` : ''}`;
    $('#result').innerHTML = `<div class="scan-result ${estado === 'ready' ? 'warn' : estado}">${cab}</div>
      ${res.offer_title ? tarjetaCodigo(res, estado) : ''}
      ${estado === 'ready' ? `<button class="btn primary grande" id="validaYa" type="button">${ms('check')}${esc(I18N.t('Validar'))}</button>` : ''}
      <div id="ticketVal"></div>`;
    // Recién validado el código de una publicación: el importe del ticket.
    if (estado === 'ok' && (res.kind || 'offer') === 'offer' && res.code_input) cajaTicket($('#ticketVal'), res.code_input);
    const b = $('#validaYa');
    if (b) b.onclick = () => { $('#code').value = res.code_input || $('#code').value; validate(); };
    const otro = $('[data-otro-local]', $('#result'));
    if (otro) otro.onclick = () => cambiaDeLocal(otro.dataset.otroLocal);
  };
  // Desde el enlace del código: primero se mira, sin validar (un enlace
  // tocado sin querer, o abierto por el propio cliente, ya no lo gasta).
  const mira = async (code) => {
    try {
      const res = await rpc('redemption_preview', { p_code: code });
      pintaResultado({ ...res, code_input: code }, res.ok ? 'ready' : 'bad');
    } catch (e) {
      toast(friendly(e.message), true);
    }
  };
  $('#go').onclick = validate;
  $('#recent').addEventListener('recargar', () => loadRecent());
  // Las listas de los RRPP de esta noche (panel/rrpp.js): validar desde la
  // fila es lo mismo que el escáner.
  rrppPuerta($('#puertaRrpp'), (res) => {
    pintaResultado(res, res.ok ? 'ok' : 'bad');
    if (res.ok) { if (navigator.vibrate) navigator.vibrate(120); loadRecent(); }
    $('#result')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  pintaCola();
  enviaCola();
  $('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') validate(); });
  // Desde klendar.app/r/<código> (el QR escaneado con la cámara del móvil,
  // sin la app): el código llega puesto y se enseña qué es; se valida con el
  // botón «Validar». La cámara de aquí sí valida directamente.
  const desdeQr = new URLSearchParams(location.hash.split('?')[1] || '').get('code');
  // Desde klendar.app/c/<…> (el QR de cliente leído con la cámara del móvil):
  // sus bonos, al momento.
  const cliente = new URLSearchParams(location.hash.split('?')[1] || '').get('cliente');
  if (cliente && bonoToken(cliente)) {
    history.replaceState(null, '', `${location.pathname}#/validar`);
    bonoCliente($('#result'), cliente);
  }
  if (desdeQr && /^[0-9a-f]{8,64}$/i.test(desdeQr)) {
    $('#code').value = desdeQr;
    history.replaceState(null, '', `${location.pathname}#/validar`);
    mira(desdeQr);
  }

  // Cámara: encender y apagar con el mismo botón.
  const boton = $('#camara');
  if (!navigator.mediaDevices?.getUserMedia) {
    boton.hidden = true;
  } else {
    boton.onclick = async () => {
      if (PARA_CAMARA) {
        paraCamara();
        $('#camara-caja').hidden = true;
        boton.innerHTML = ms('photo_camera') + esc(I18N.t('Escanear con la cámara'));
        return;
      }
      try {
        $('#camara-caja').hidden = false;
        boton.textContent = I18N.t('Parar la cámara');
        await escanerQR($('#video'), (texto) => {
          $('#code').value = texto;
          validate();
        });
      } catch (e) {
        paraCamara();
        $('#camara-caja').hidden = true;
        boton.innerHTML = ms('photo_camera') + esc(I18N.t('Escanear con la cámara'));
        toast(e && e.name === 'NotAllowedError'
          ? 'Sin permiso para la cámara. Actívalo en el candado de la barra de direcciones.'
          : e && e.name === 'NotFoundError' ? 'No encontramos ninguna cámara en este dispositivo.'
            : 'No se ha podido abrir la cámara. Escribe el código a mano.', true);
      }
    };
  }
  await loadRecent();
};

// ── Asistentes de un evento ─────────────────────────────────────────────────
PAGES.asistentes = async (v, offerId) => {
  // Sin evento (enlace cortado o escrito a mano): a Publicaciones, no a un error.
  if (!offerId) { location.hash = '#/publicaciones'; return; }
  const [offers, list] = await Promise.all([
    rpc('my_business_offers', { p_id: BIZ.id }),
    rpc('offer_attendees', { p_offer: offerId }),
  ]);
  const offer = offers.find((o) => o.id === offerId);
  const plazas = (a) => Math.max(1, Number(a.seats) || 1);
  const dentro = list.filter((a) => a.status === 'validated');
  // En la puerta se cuentan personas, no códigos: un código vale por todas
  // las plazas que reservó.
  const personasDentro = dentro.reduce((n, a) => n + plazas(a), 0);
  const personas = list.filter((a) => a.status !== 'cancelled' && a.status !== 'expired').reduce((n, a) => n + plazas(a), 0);
  // Los mismos nombres que la app: Dentro, Reservada, Caducada (y Anulada,
  // si quien reservó dijo «Ya no voy»).
  const estado = (a) => (a.status === 'validated' ? '<span class="tag ok">Dentro</span>'
    : a.status === 'expired' ? '<span class="tag dim">Caducada</span>'
      : a.status === 'cancelled' ? '<span class="tag dim">Anulada</span>'
        : '<span class="tag st-pending">Reservada</span>');
  const ESTADO_CSV = { validated: 'dentro', expired: 'caducada', cancelled: 'anulada', pending: 'reservada' };
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/publicaciones">← Volver</a><h1>Asistentes</h1><span class="spacer"></span>
      <button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    <div class="card"><h2>${esc(offer?.title || '')}</h2>
      <p class="muted" style="margin:0">${esc(bi(
        `${fmtNum(dentro.length)} de ${fmtNum(list.length)} han entrado · ${fmtNum(personasDentro)} de ${fmtNum(personas)} ${personas === 1 ? 'persona' : 'personas'}${offer?.max_redemptions ? ` · aforo ${fmtNum(offer.max_redemptions)}` : ''}`,
        `${fmtNum(dentro.length)} of ${fmtNum(list.length)} checked in · ${fmtNum(personasDentro)} of ${fmtNum(personas)} ${personas === 1 ? 'person' : 'people'}${offer?.max_redemptions ? ` · capacity ${fmtNum(offer.max_redemptions)}` : ''}`))}</p></div>
    <div class="toolbar"><input id="q" class="grow" placeholder="Buscar por nombre o código"></div>
    <div id="list"></div>`;
  const render = () => {
    const q = $('#q', v).value.trim().toLowerCase();
    // El código se busca como se lee («0882 7EC7»), con o sin espacios.
    const qc = q.replace(/\s/g, '');
    const rows = list.filter((a) => !q || (a.user_name || '').toLowerCase().includes(q) || a.code.toLowerCase().includes(qc));
    $('#list', v).innerHTML = table({
      cols: [
        { h: 'Persona', r: (a) => `<b class="title">${esc(a.user_name || I18N.t('Invitada'))}</b><span class="sub mono">${esc(a.code.slice(0, 8).toUpperCase())}</span>${a.promoter_name ? `<span class="sub">${rrppListaDe(a)}</span>` : ''}` },
        { h: 'Plazas', num: true, r: (a) => fmtNum(plazas(a)) },
        { h: 'Estado', r: estado },
        { h: 'Reservó', r: (a) => fmtDate(a.created_at) },
        { h: 'Entró', r: (a) => fmtDate(a.validated_at) },
        { h: '', r: (a) => a.status === 'pending' ? `<button class="btn sm" data-code="${esc(a.code)}">Dar entrada</button>` : '' },
      ],
      rows,
      empty: 'Todavía no hay nadie apuntado.',
    });
    I18N.translate($('#list', v));
    $$('#list [data-code]', v).forEach((b) => {
      b.onclick = async () => {
        if (b.disabled) return;
        b.disabled = true;
        const a = list.find((x) => x.code === b.dataset.code) || {};
        const nombre = a.user_name || I18N.t('Invitada');
        try {
          // Lo mismo que el escáner: las cifras cuadran igual.
          const res = await rpc('validate_redemption', { p_code: b.dataset.code });
          if (!res?.ok) { toast(textoErrorValidar(res || {}), true); b.disabled = false; return; }
          toast(bi(`${nombre} ha entrado`, `${nombre} is in`));
          route();
        } catch (e) { toast(friendly(e.message), true); b.disabled = false; }
      };
    });
  };
  $('#q', v).oninput = render;
  $('#csv', v).onclick = () => downloadCsv(`asistentes-${offer?.title || ''}`, list, [
    ['user_name', 'nombre'], ['code', 'código'], [(a) => plazas(a), 'plazas'], [(a) => ESTADO_CSV[a.status] || a.status, 'estado'],
    ['created_at', 'reservó'], ['validated_at', 'entró'],
    ['promoter_name', bi('lista de RRPP', 'promoter list')],
    [(a) => (a.promoter_off_offer ? bi('sí', 'yes') : ''), bi('fuera de su oferta', 'outside their offer')],
  ]);
  render();
};

// ── Tarjetas de sellos ──────────────────────────────────────────────────────
// Hasta cinco por local, cada una con su nombre, su meta, su premio y lo que
// da sello. Lo mismo que «Tarjetas de sellos» en la app, con las mismas
// funciones de la base y las mismas palabras.
//   #/sellos            la lista
//   #/sellos/nueva      crear una
//   #/sellos/<id>       cómo va y quién la lleva (añadir, quitar, premio, a 0)
//   #/sellos/<id>/editar
const FILTROS_SELLO = [
  ['all', 'Todas las publicaciones'],
  ['flash_offer', 'Solo ofertas flash'],
  ['future_event', 'Solo eventos'],
  ['categories', 'Ciertas categorías'],
  ['offers', 'Ciertas publicaciones'],
];
const nombreCategoria = (k) => k?.names?.[I18N.lang] || k?.names?.es || k?.slug || '';
const ERR_SELLOS = {
  bad_name: 'Ponle un nombre (de 2 a 40 letras).',
  name_taken: 'Ya tienes una tarjeta con ese nombre.',
  bad_reward: 'Escribe el premio (sé concreto: «un café con leche gratis»).',
  no_categories: 'Elige al menos una categoría.',
  no_offers: 'Elige al menos una publicación.',
  not_enough_stamps: 'Le faltan sellos para el premio.',
  no_stamps: 'No tiene sellos que quitar.',
  unknown_person: 'Solo se pueden poner sellos a quien ya ha canjeado algo en tu negocio.',
  bad_amount: 'De 1 a 20 sellos cada vez.',
};
const errSellos = (code) => I18N.t(ERR_SELLOS[code] || friendly(code));

/** Qué da sello, dicho como lo ve la gente en su tarjeta; y, si también
 * sella por visita con el QR del local, dicho. */
function filtroSellos(c, offers = []) {
  const base = filtroSellosBase(c, offers);
  return c.by_visit ? `${base} · ${I18N.t('También por visita con el QR del local')}` : base;
}
/** «De ellos: 60 por canje · 30 por visita · 6 a mano», como la app. */
const origenSellos = (c) => bi(
  `De ellos: ${fmtNum(c.stamps_redemption || 0)} por canje · ${fmtNum(c.stamps_visit || 0)} por visita · ${fmtNum(c.stamps_manual || 0)} a mano`,
  `Of those: ${fmtNum(c.stamps_redemption || 0)} from redemptions · ${fmtNum(c.stamps_visit || 0)} from visits · ${fmtNum(c.stamps_manual || 0)} by hand`);
function filtroSellosBase(c, offers = []) {
  if (c.applies_to === 'flash_offer') return I18N.t('Solo cuentan las ofertas flash');
  if (c.applies_to === 'future_event') return I18N.t('Solo cuentan los eventos');
  if (c.applies_to === 'categories' || c.applies_to === 'offers') {
    const nombres = c.applies_to === 'categories'
      ? CATS.filter((k) => (c.category_ids || []).includes(k.id)).map(nombreCategoria)
      : offers.filter((o) => (c.offer_ids || []).includes(o.id)).map((o) => o.title);
    if (!nombres.length) {
      return I18N.t(c.applies_to === 'categories' ? 'Solo cuentan algunas categorías' : 'Solo cuentan algunas publicaciones');
    }
    const resto = nombres.length - 3;
    const lista = nombres.slice(0, 3).join(', ') + (resto > 0 ? bi(` y ${resto} más`, ` and ${resto} more`) : '');
    return bi(`Solo cuentan: ${lista}`, `Only these count: ${lista}`);
  }
  return I18N.t('Cuentan todas las publicaciones');
}
const estadoTarjeta = (c) => (c.review ? tag('pending')
  : `<span class="tag ${c.is_active ? 'ok' : 'dim'}">${esc(I18N.t(c.is_active ? 'Encendida' : 'Apagada'))}</span>`);
const metaPremio = (c) => bi(`${c.goal} sellos · ${c.reward}`, `${c.goal} stamps · ${c.reward}`);
const sellosDe = (n, meta) => bi(`${n} de ${meta} sellos`, `${n} of ${meta} stamps`);
const premiosTxt = (p) => [
  sellosDe(p.stamps, p.goal),
  p.rewards_pending ? bi(p.rewards_pending === 1 ? '1 premio por recoger' : `${p.rewards_pending} premios por recoger`,
    p.rewards_pending === 1 ? '1 reward to collect' : `${p.rewards_pending} rewards to collect`) : '',
  p.rewards_given ? bi(p.rewards_given === 1 ? '1 premio entregado' : `${p.rewards_given} premios entregados`,
    p.rewards_given === 1 ? '1 reward handed over' : `${p.rewards_given} rewards handed over`) : '',
].filter(Boolean).join(' · ');
/** «Laura añadió 2 sellos · 4 oct, 19:30». */
function cambioTxt(ch) {
  const quien = ch.by || bi('Alguien del equipo', 'Someone on the team');
  const n = ch.amount;
  const que = {
    add: bi(`${quien} añadió ${n === 1 ? '1 sello' : `${n} sellos`}`, `${quien} added ${n === 1 ? '1 stamp' : `${n} stamps`}`),
    remove: bi(`${quien} quitó ${n === 1 ? '1 sello' : `${n} sellos`}`, `${quien} removed ${n === 1 ? '1 stamp' : `${n} stamps`}`),
    reset: bi(`${quien} la puso a 0`, `${quien} reset it to 0`),
    reward: bi(`${quien} entregó el premio`, `${quien} handed over the reward`),
  }[ch.action] || '';
  return ch.at ? `${que} · ${fmtDate(ch.at)}` : que;
}
const huecos = (n, meta) => `<div class="huecos" role="img" aria-label="${esc(`${n} / ${meta}`)}">${Array.from({ length: meta }, (_, i) => `<span class="${i < n ? 'lleno' : ''}"></span>`).join('')}</div>`;

PAGES.sellos = async (v, param) => {
  const extra = currentRoute()[2];
  if (param === 'nueva') return tarjetaForm(v, null);
  if (param && extra === 'editar') return tarjetaForm(v, param);
  if (param) return tarjetaClientes(v, param);

  const d = await rpc('business_stamp_cards', { p_business: BIZ.id });
  if (d?.ok === false) throw new Error(friendly(d.error));
  const cards = d.cards || [];
  const lleno = cards.length >= (d.max || 5);
  v.innerHTML = `
    <div class="page-head"><h1>Tarjetas de sellos</h1><span class="spacer"></span>
      <a class="btn sm ghost" href="#/cartel-local">Imprimir el cartel del local</a>
      <button class="btn sm primary" type="button" id="nueva" ${lleno ? 'disabled' : ''}>Nueva tarjeta</button></div>
    ${helpBox('¿Cómo funciona?', bi(`<p>Cada tarjeta tiene su meta, su premio y lo que da sello: todas las publicaciones, solo las ofertas flash, solo los eventos, ciertas categorías o ciertas publicaciones. Cuando validas un código, <b>cada tarjeta encendida que encaje da su sello</b>, como mucho uno al día por persona y tarjeta.</p>
      <p>Si marcas <b>«También por visita con el QR del local»</b>, quien escanee el cartel del local en tu negocio se lleva además un sello, con el mismo tope de uno al día.</p>
      <p>El premio es otro código que validas igual, o lo entregas tú desde la lista de clientes de la tarjeta, donde también puedes añadir o quitar sellos y ponerla a 0. Si apagas una tarjeta, <b>nadie pierde los sellos que tiene</b>.</p>`,
      `<p>Each card has its goal, its reward and what earns a stamp: all publications, flash offers only, events only, certain categories or certain publications. When you validate a code, <b>every card that is on and matches gives its stamp</b>, one a day per person and card at most.</p>
      <p>If you tick <b>“Also per visit with the venue QR code”</b>, whoever scans the venue poster at your place also gets a stamp, with the same limit of one a day.</p>
      <p>The reward is another code you validate the same way, or you hand it over yourself from the card's customer list, where you can also add or remove stamps and reset it to 0. If you turn a card off, <b>nobody loses the stamps they have</b>.</p>`))}
    ${lleno ? `<p class="muted">${esc(bi(`Ya tienes ${d.max}, el máximo. Borra o cambia alguna para crear otra.`, `You already have ${d.max}, the maximum. Delete or change one to create another.`))}</p>` : ''}
    ${cards.length ? cards.map((c) => `
      <a class="card tarjeta-sellos" href="#/sellos/${esc(c.id)}">
        <div class="ts-top"><h2>${esc(c.name)}</h2>${estadoTarjeta(c)}<span class="ms" aria-hidden="true">chevron_right</span></div>
        <p class="ts-meta"><b>${esc(metaPremio(c))}</b></p>
        <p class="muted">${esc(filtroSellos(c, d.offers))}</p>
        ${c.stamps ? `<p class="muted">${esc(origenSellos(c))}</p>` : ''}
        <p class="muted">${esc(bi(
          `${c.people === 0 ? 'Nadie con sellos ahora' : c.people === 1 ? '1 persona con sellos' : `${fmtNum(c.people)} personas con sellos`} · ${c.rewards_given === 0 ? 'ningún premio entregado' : c.rewards_given === 1 ? '1 premio entregado' : `${fmtNum(c.rewards_given)} premios entregados`}`,
          `${c.people === 0 ? 'Nobody with stamps now' : c.people === 1 ? '1 person with stamps' : `${fmtNum(c.people)} people with stamps`} · ${c.rewards_given === 0 ? 'no rewards handed over' : c.rewards_given === 1 ? '1 reward handed over' : `${fmtNum(c.rewards_given)} rewards handed over`}`))}</p>
        ${c.people_old_goal > 0 ? `<p class="muted">${esc(bi(
          `${c.people_old_goal === 1 ? '1 persona sigue' : `${fmtNum(c.people_old_goal)} personas siguen`} con una meta anterior, más baja, hasta su premio.`,
          `${c.people_old_goal === 1 ? '1 person keeps' : `${fmtNum(c.people_old_goal)} people keep`} an earlier, lower goal until their reward.`))}</p>` : ''}
      </a>`).join('')
    : `<div class="empty"><b>${esc(I18N.t('Todavía no tienes ninguna tarjeta'))}</b><br>${esc(bi(`Crea la primera: «al décimo café, uno gratis». Puedes tener hasta ${d.max || 5}, cada una con lo suyo.`, `Create the first one: “the tenth coffee is on us”. You can have up to ${d.max || 5}, each with its own rules.`))}</div>`}`;
  $('#nueva', v).onclick = () => { location.hash = '#/sellos/nueva'; };
};

/** Crear (id null) o cambiar una tarjeta. */
async function tarjetaForm(v, id) {
  const d = await rpc('business_stamp_cards', { p_business: BIZ.id });
  if (d?.ok === false) throw new Error(friendly(d.error));
  const c = id ? (d.cards || []).find((x) => x.id === id) : null;
  if (id && !c) { location.hash = '#/sellos'; return; }
  // Nombre o premio que esperan revisión (lenguaje ofensivo): se enseña lo
  // último que se escribió y lo que sigue en uso mientras tanto.
  const rev = c?.review || null;
  const ofertas = d.offers || [];
  const filtro = c?.applies_to || 'all';
  const cats = new Set(c?.category_ids || []);
  const offs = new Set(c?.offer_ids || []);
  v.innerHTML = `
    <p class="crumbs"><a href="#/sellos">${esc(I18N.t('Tarjetas de sellos'))}</a>${c ? ` · <a href="#/sellos/${esc(c.id)}">${esc(c.name)}</a>` : ''}</p>
    <div class="page-head"><h1>${c ? 'Editar tarjeta' : 'Nueva tarjeta'}</h1></div>
    <form id="f" class="form" novalidate>
      ${rev?.paused ? `<div class="full scan-result warn">${esc(I18N.t('En revisión: la tarjeta empieza cuando la revisemos, porque puede contener lenguaje ofensivo. Normalmente en menos de 24 h.'))}</div>` : ''}
      <label class="f full"><span>Nombre</span>
        <input name="name" maxlength="40" required placeholder="Cafés" value="${esc(rev?.name || c?.name || '')}">
        <small class="muted">Lo ve la gente: «Cafés», «Menús», «Manicuras»…</small></label>
      ${rev?.name && !rev.paused ? `<div class="full">${revisionTexto(rev.name, c.name)}</div>` : ''}
      <label class="f"><span>Sellos para el premio</span><select name="goal">
        ${Array.from({ length: 19 }, (_, i) => i + 2).map((n) => `<option value="${n}" ${Number(c?.goal || 10) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <small class="muted" id="metaAyuda" role="status" hidden></small></label>
      <label class="f full"><span>Premio</span>
        <input name="reward" maxlength="80" required placeholder="Un café con leche gratis" value="${esc(rev?.reward || c?.reward || '')}"></label>
      ${rev?.reward && !rev.paused ? `<div class="full">${revisionTexto(rev.reward, c.reward)}</div>` : ''}
      <fieldset class="f full filtro-sellos"><legend>¿Qué da sello?</legend>
        ${FILTROS_SELLO.map(([k, t]) => `<label class="opcion"><input type="radio" name="applies_to" value="${k}" ${filtro === k ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
      </fieldset>
      <div class="f full" id="cats" ${filtro === 'categories' ? '' : 'hidden'}>
        <div class="pills">${CATS.map((k) => `<button type="button" data-cat="${esc(k.id)}" class="${cats.has(k.id) ? 'on' : ''}" aria-pressed="${cats.has(k.id)}">${esc(nombreCategoria(k))}</button>`).join('')}</div>
      </div>
      <div class="f full" id="offs" ${filtro === 'offers' ? '' : 'hidden'}>
        ${ofertas.length ? `<p class="hint">Si una se repite cada semana, cuentan también las de las semanas siguientes.</p>
          ${ofertas.map((o) => `<label class="opcion"><input type="checkbox" data-off="${esc(o.id)}" ${offs.has(o.id) ? 'checked' : ''}><span>${esc(o.title)} <small class="muted">${esc(I18N.t(o.kind === 'future_event' ? 'Evento' : 'Oferta flash'))}${o.repeats ? ` · ${esc(I18N.t('Se repite cada semana'))}` : ''}</small></span></label>`).join('')}`
        : `<p class="hint">Todavía no tienes publicaciones. Publica alguna y vuelve, o elige otra opción.</p>`}
      </div>
      <label class="f full" style="grid-template-columns:auto 1fr;align-items:center">
        <input type="checkbox" name="by_visit" ${c?.by_visit ? 'checked' : ''}>
        <span>También por visita con el QR del local <small class="muted">Quien escanee el cartel del local en tu negocio se lleva un sello, como mucho uno al día.</small></span></label>
      <label class="f full" style="grid-template-columns:auto 1fr;align-items:center">
        <input type="checkbox" name="is_active" ${!c || (rev?.paused ? rev.activate : c.is_active) ? 'checked' : ''}>
        <span>Encendida <small class="muted">Si la apagas, no se dan sellos nuevos, pero nadie pierde los suyos.</small></span></label>
      <div class="full"><button class="btn primary" type="submit">${c ? 'Guardar' : 'Crear la tarjeta'}</button> <span id="msg" class="muted" role="status"></span></div>
      ${c ? '<div class="full"><button class="btn bad ghost" type="button" id="borrar">Borrar la tarjeta</button></div>' : ''}
    </form>`;

  const f = $('#f', v);
  // Cambiar la meta con gente a medias: si sube, cada uno conserva la suya
  // hasta su premio; si baja, vale ya para todos y se les avisa. Se explica
  // debajo del campo antes de guardar.
  const metaAyuda = () => {
    const caja = $('#metaAyuda', v);
    const nueva = Number(f.elements.goal.value);
    const n = c?.people || 0;
    if (!c || !n || nueva === c.goal) { caja.hidden = true; return; }
    caja.hidden = false;
    caja.textContent = nueva > c.goal
      ? bi(`${n === 1 ? 'La persona que ya tiene sellos sigue' : `Las ${n} personas que ya tienen sellos siguen`} con su meta de ${c.goal} hasta conseguir el premio; la nueva vale para las que empiecen desde ahora.`,
        `${n === 1 ? 'The person who already has stamps keeps' : `The ${n} people who already have stamps keep`} their goal of ${c.goal} until they get the reward; the new one applies to anyone who starts from now on.`)
      : bi(`Se aplica ya a ${n === 1 ? 'la persona que tiene sellos, y le avisamos' : `las ${n} personas que tienen sellos, y les avisamos`}.`,
        `It applies straight away to ${n === 1 ? 'the person who has stamps, and we’ll let them know' : `the ${n} people who have stamps, and we’ll let them know`}.`);
  };
  f.elements.goal.addEventListener('change', metaAyuda);
  $$('[name=applies_to]', v).forEach((r) => {
    r.onchange = () => {
      $('#cats', v).hidden = r.value !== 'categories' || !r.checked;
      $('#offs', v).hidden = r.value !== 'offers' || !r.checked;
    };
  });
  $$('[data-cat]', v).forEach((b) => {
    b.onclick = () => {
      const on = !cats.has(b.dataset.cat);
      if (on) cats.add(b.dataset.cat); else cats.delete(b.dataset.cat);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    };
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('#msg', v);
    const nombre = f.elements.name.value.trim();
    const premio = f.elements.reward.value.trim();
    const aplica = (f.querySelector('[name=applies_to]:checked') || {}).value || 'all';
    const elegidas = $$('[data-off]', v).filter((x) => x.checked).map((x) => x.dataset.off);
    const fallo = nombre.length < 2 ? 'bad_name' : premio.length < 3 ? 'bad_reward'
      : aplica === 'categories' && !cats.size ? 'no_categories'
      : aplica === 'offers' && !elegidas.length ? 'no_offers' : null;
    if (fallo) { msg.textContent = errSellos(fallo); return; }
    const r = await rpc('save_stamp_card', {
      p_business: BIZ.id,
      p_card: c?.id || null,
      p_name: nombre,
      p_goal: Number(f.elements.goal.value),
      p_reward: premio,
      p_active: f.elements.is_active.checked,
      p_applies_to: aplica,
      p_category_ids: aplica === 'categories' ? [...cats] : [],
      p_offer_ids: aplica === 'offers' ? elegidas : [],
      p_by_visit: f.elements.by_visit.checked,
    }).catch((err) => ({ ok: false, error: err.message }));
    if (!r?.ok) { msg.textContent = r?.error === 'too_many_cards' ? I18N.t('Ya tienes 5, el máximo.') : errSellos(r?.error); return; }
    // Lo que ha pasado con la meta de quien ya tenía sellos.
    const meta = r.kept_goal > 0
      ? bi(` ${r.kept_goal === 1 ? '1 persona sigue' : `${r.kept_goal} personas siguen`} con su meta anterior hasta conseguir el premio.`,
        ` ${r.kept_goal === 1 ? '1 person keeps' : `${r.kept_goal} people keep`} their previous goal until they get the reward.`)
      : r.notified > 0
        ? bi(` Hemos avisado de la nueva meta a ${r.notified === 1 ? '1 persona' : `${r.notified} personas`}.`,
          ` We’ve told ${r.notified === 1 ? '1 person' : `${r.notified} people`} about the new goal.`)
        : '';
    toast(r.status === 'review' ? I18N.t(EN_REVISION_USO) + meta : meta ? bi('Guardado.', 'Saved.') + meta : 'Guardado');
    location.hash = `#/sellos/${r.card.id}`;
  };
  const borrar = $('#borrar', v);
  if (borrar) {
    borrar.onclick = async () => {
      if (!await confirmDlg(bi(`¿Borrar «${c.name}»?`, `Delete “${c.name}”?`),
        esc(I18N.t('Deja de verse en la app y en la web. Los premios ya entregados se quedan en el historial.')),
        { danger: true, submit: 'Borrar' })) return;
      const r = await rpc('delete_stamp_card', { p_card: c.id }).catch((err) => ({ ok: false, error: err.message }));
      if (r?.ok) { toast('Tarjeta borrada'); location.hash = '#/sellos'; return; }
      if (r?.error === 'card_in_use') {
        const n = r.people || 1;
        await modal({
          title: 'Borrar la tarjeta',
          intro: esc(bi(`${n === 1 ? '1 persona tiene' : `${n} personas tienen`} sellos o un premio sin recoger en esta tarjeta. Apágala, o ponlas a 0 antes de borrarla.`,
            `${n === 1 ? '1 person has' : `${n} people have`} stamps or an uncollected reward on this card. Turn it off, or reset them to 0 before deleting it.`)),
          submit: 'Listo', cancel: null,
        });
        return;
      }
      toast(errSellos(r?.error), true);
    };
  }
}

/** Una tarjeta por dentro: cómo va, quién la lleva y lo que se hace a mano. */
async function tarjetaClientes(v, id) {
  const [d, todas] = await Promise.all([
    rpc('stamp_card_customers', { p_card: id }),
    rpc('business_stamp_cards', { p_business: BIZ.id }).catch(() => null),
  ]);
  if (d?.ok === false) {
    if (d.error === 'not_authorized') { location.hash = '#/sellos'; return; }
    throw new Error(friendly(d.error));
  }
  const c = (todas?.cards || []).find((x) => x.id === id) || d.card;
  // Cada persona con su meta: quien empezó antes de subirla conserva la suya
  // (`stamp_card_customers` la trae; si no, la de la tarjeta).
  const gente = (d.customers || []).map((p) => ({ ...p, goal: p.goal || c.goal }));
  let elegido = null;   // la persona abierta
  let q = '';

  v.innerHTML = `
    <p class="crumbs"><a href="#/sellos">${esc(I18N.t('Tarjetas de sellos'))}</a></p>
    <div class="page-head"><h1>${esc(c.name)}</h1>${estadoTarjeta(c)}<span class="spacer"></span>
      <a class="btn sm ghost" href="#/sellos/${esc(c.id)}/editar">Editar</a></div>
    <p><b>${esc(metaPremio(c))}</b><br><span class="muted">${esc(filtroSellos(c, todas?.offers || []))}</span></p>
    <div id="cifras"></div>
    <div id="persona"></div>
    <div class="card"><div class="page-head" style="margin:0 0 10px"><h2 style="margin:0">Clientes</h2><span class="spacer"></span>
        <button class="btn sm primary" type="button" id="anadir">Añadir a alguien</button></div>
      <div id="buscaNuevos" hidden>
        <p class="hint">Gente que ya ha canjeado algo en tu negocio. Búscala por su nombre y ponle su primer sello.</p>
        <input type="search" id="qNuevos" placeholder="Buscar por nombre" aria-label="Buscar por nombre">
        <div id="nuevos"></div>
      </div>
      ${gente.length > 6 ? '<input type="search" id="qGente" placeholder="Buscar por nombre" aria-label="Buscar por nombre" style="margin-bottom:10px">' : ''}
      <div id="gente"></div>
    </div>`;

  const pintaGente = () => {
    const lista = q ? gente.filter((p) => (p.name || '').toLowerCase().includes(q)) : gente;
    $('#gente', v).innerHTML = !gente.length
      ? `<p class="muted">${esc(I18N.t('Todavía nadie tiene sellos en esta tarjeta. Caen solos al validar códigos, o ponlos tú con «Añadir a alguien».'))}</p>`
      : !lista.length ? `<p class="muted">${esc(I18N.t('Nadie con ese nombre.'))}</p>`
      : table({
        cols: [
          { h: 'Persona', r: (p) => `<b class="title">${esc(p.name || I18N.t('Sin nombre'))}</b><span class="sub">${esc(p.changes?.[0] ? cambioTxt(p.changes[0]) : '')}</span>` },
          { h: 'Sellos', r: (p) => esc(premiosTxt(p)) },
          { h: '', r: (p) => `<button class="btn sm ghost" type="button" data-abre="${esc(p.user_id)}">${esc(I18N.t('Gestionar'))}</button>` },
        ],
        rows: lista,
      });
    $$('[data-abre]', v).forEach((b) => {
      b.onclick = () => { elegido = gente.find((p) => p.user_id === b.dataset.abre); pintaPersona(); };
    });
  };

  // Las cifras de arriba también cambian al poner o quitar sellos a mano.
  const pintaCifras = () => {
    const caja = $('#cifras', v);
    if (!caja) return;
    caja.innerHTML = `<div class="kpis" style="margin-bottom:14px">
      <div class="kpi"><b>${fmtNum(c.people)}</b><span>Con sellos ahora</span></div>
      <div class="kpi"><b>${fmtNum(c.stamps)}</b><span>Sellos dados</span></div>
      <div class="kpi"><b>${fmtNum(c.rewards_given)}</b><span>Premios entregados</span></div>
      <div class="kpi"><b>${fmtNum(c.rewards_pending)}</b><span>Premios por recoger</span></div>
    </div>
    ${c.stamps ? `<p class="muted" style="margin-top:-6px">${esc(origenSellos(c))}</p>` : ''}`;
    I18N.translate(caja);
  };
  pintaCifras();

  const recarga = async () => {
    const [n, t] = await Promise.all([
      rpc('stamp_card_customers', { p_card: id }).catch(() => null),
      rpc('business_stamp_cards', { p_business: BIZ.id }).catch(() => null),
    ]);
    const nueva = (t?.cards || []).find((x) => x.id === id);
    if (nueva) { Object.assign(c, nueva); pintaCifras(); }
    if (!n?.ok) return;
    gente.splice(0, gente.length, ...(n.customers || []).map((p) => ({ ...p, goal: p.goal || c.goal })));
    if (elegido) elegido = gente.find((p) => p.user_id === elegido.user_id) || elegido;
    pintaGente();
    pintaPersona();
  };

  const accion = async (fn, args, hecho) => {
    const r = await rpc(fn, args).catch((err) => ({ ok: false, error: err.message }));
    if (!r?.ok) { toast(errSellos(r?.error), true); return; }
    toast(hecho);
    if (elegido && typeof r.stamps === 'number') elegido = { ...elegido, stamps: r.stamps };
    await recarga();
  };

  function pintaPersona() {
    const caja = $('#persona', v);
    if (!elegido) { caja.innerHTML = ''; return; }
    const p = elegido;
    const nombre = p.name || I18N.t('Sin nombre');
    // Su meta (puede ser una anterior, más baja, si la tarjeta la subió).
    const meta = p.goal || c.goal;
    const puedeDar = p.stamps >= meta || p.rewards_pending > 0;
    caja.innerHTML = `<div class="card persona-sellos">
      <div class="page-head" style="margin:0"><h2 style="margin:0">${esc(nombre)}</h2><span class="spacer"></span>
        <button class="btn sm ghost" type="button" id="cierra">${esc(I18N.t('Cerrar'))}</button></div>
      ${huecos(p.stamps, meta)}
      <p><b>${esc(premiosTxt({ ...p, goal: meta }))}</b></p>
      <form id="fp" class="form persona-form">
        <label class="f"><span>¿Cuántos sellos?</span><input name="n" type="number" min="1" max="20" value="1" inputmode="numeric"></label>
        <div class="f full dos-botones">
          <button class="btn" type="button" id="quita" ${p.stamps ? '' : 'disabled'}>Quitar</button>
          <button class="btn" type="button" id="pone">Añadir</button>
        </div>
        <div class="f full"><button class="btn primary" type="button" id="da" ${puedeDar ? '' : 'disabled'}>Entregar el premio</button></div>
        <div class="f full"><button class="linkbtn peligro" type="button" id="cero" ${p.stamps ? '' : 'disabled'}>Poner a 0</button></div>
      </form>
      <h3>Cambios a mano</h3>
      ${p.changes?.length ? `<ul class="cambios">${p.changes.map((ch) => `<li>${esc(cambioTxt(ch))}</li>`).join('')}</ul>` : `<p class="muted">${esc(I18N.t('Nadie ha cambiado esta tarjeta a mano.'))}</p>`}
    </div>`;
    I18N.translate(caja);
    const cuantos = () => Math.min(20, Math.max(1, Math.round(Number($('#fp [name=n]', v).value) || 1)));
    $('#cierra', v).onclick = () => { elegido = null; pintaPersona(); };
    $('#pone', v).onclick = () => {
      const n = cuantos();
      accion('adjust_stamps', { p_card: c.id, p_user: p.user_id, p_delta: n }, bi(n === 1 ? 'Sello añadido' : `${n} sellos añadidos`, n === 1 ? 'Stamp added' : `${n} stamps added`));
    };
    $('#quita', v).onclick = async () => {
      const n = Math.min(cuantos(), p.stamps);
      if (!await confirmDlg(bi(`¿Quitar ${n === 1 ? '1 sello' : `${n} sellos`} a ${nombre}?`, `Remove ${n === 1 ? '1 stamp' : `${n} stamps`} from ${nombre}?`),
        esc(I18N.t('Queda apuntado quién lo ha hecho y cuándo.')), { danger: true, submit: 'Quitar' })) return;
      accion('adjust_stamps', { p_card: c.id, p_user: p.user_id, p_delta: -n }, bi(n === 1 ? 'Sello quitado' : `${n} sellos quitados`, n === 1 ? 'Stamp removed' : `${n} stamps removed`));
    };
    $('#da', v).onclick = async () => {
      if (!await confirmDlg(bi(`¿Entregar el premio a ${nombre}?`, `Hand over the reward to ${nombre}?`),
        esc(p.rewards_pending
          ? bi(`«${c.reward}». Ya lo había pedido: su código queda canjeado.`, `“${c.reward}”. They had already claimed it: their code is marked as redeemed.`)
          : bi(`«${c.reward}». Se gastan ${meta} sellos y queda apuntado como entregado.`, `“${c.reward}”. ${meta} stamps are used and it is recorded as handed over.`)),
        { submit: 'Entregar' })) return;
      accion('give_stamp_reward', { p_card: c.id, p_user: p.user_id }, 'Premio entregado');
    };
    $('#cero', v).onclick = async () => {
      if (!await confirmDlg(bi(`¿Poner a 0 la tarjeta de ${nombre}?`, `Reset ${nombre}’s card to 0?`),
        esc(bi(`${p.stamps === 1 ? 'Se le quita su sello.' : `Se le quitan sus ${p.stamps} sellos.`} Un premio ya pedido y sin recoger no se toca. Queda apuntado quién lo ha hecho y cuándo.`,
          `${p.stamps === 1 ? 'Their stamp is removed.' : `Their ${p.stamps} stamps are removed.`} A reward already claimed and not collected is kept. Who did it and when is recorded.`)),
        { danger: true, submit: 'Poner a 0' })) return;
      accion('reset_stamps', { p_card: c.id, p_user: p.user_id }, 'Tarjeta a 0');
    };
    caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Añadir a alguien: quien ya ha canjeado algo aquí y aún no está.
  let turno = 0;
  let espera = null;
  const buscaNuevos = async () => {
    const n = ++turno;
    const r = await rpc('stamp_card_candidates', { p_card: id, p_q: $('#qNuevos', v).value.trim() }).catch(() => null);
    if (n !== turno) return;
    const lista = r?.people || [];
    $('#nuevos', v).innerHTML = lista.length
      ? `<ul class="nuevos">${lista.map((p) => `<li><button class="linkbtn" type="button" data-nuevo="${esc(p.user_id)}">${esc(p.name || I18N.t('Sin nombre'))}</button>${p.last_visit ? ` <small class="muted">${esc(bi('Último canje: ', 'Last redemption: ') + fmtDate(p.last_visit))}</small>` : ''}</li>`).join('')}</ul>`
      : `<p class="muted">${esc(I18N.t($('#qNuevos', v).value.trim() ? 'Nadie con ese nombre ha canjeado nada aquí todavía.' : 'Todavía no hay nadie más que haya canjeado algo en tu negocio.'))}</p>`;
    $$('[data-nuevo]', v).forEach((b) => {
      b.onclick = () => {
        const p = lista.find((x) => x.user_id === b.dataset.nuevo);
        elegido = { user_id: p.user_id, name: p.name, stamps: 0, rewards_pending: 0, rewards_given: 0, changes: [] };
        $('#buscaNuevos', v).hidden = true;
        pintaPersona();
      };
    });
  };
  $('#anadir', v).onclick = () => {
    const caja = $('#buscaNuevos', v);
    caja.hidden = !caja.hidden;
    if (!caja.hidden) { $('#qNuevos', v).focus(); buscaNuevos(); }
  };
  $('#qNuevos', v).oninput = () => { clearTimeout(espera); espera = setTimeout(buscaNuevos, 300); };
  const qg = $('#qGente', v);
  if (qg) qg.oninput = () => { q = qg.value.trim().toLowerCase(); pintaGente(); };
  pintaGente();
}

// Los catorce del Reglamento 1169/2011. Se declara lo que haya, no se
// adivina: equivocarse aquí puede mandar a alguien al hospital.
const ALERGENOS = [
  ['gluten', 'Gluten'], ['crustaceos', 'Crustáceos'], ['huevos', 'Huevos'],
  ['pescado', 'Pescado'], ['cacahuetes', 'Cacahuetes'], ['soja', 'Soja'],
  ['lacteos', 'Lácteos'], ['frutos_cascara', 'Frutos de cáscara'],
  ['apio', 'Apio'], ['mostaza', 'Mostaza'], ['sesamo', 'Sésamo'],
  ['sulfitos', 'Sulfitos'], ['altramuces', 'Altramuces'], ['moluscos', 'Moluscos'],
];
const nombreAlergeno = (k) => (ALERGENOS.find((a) => a[0] === k) || [k, k])[1];

/** Lo que va en la carta según el gremio (glosario): comida y bebida →
 * plato; tiendas, discotecas, música, librerías, mercados, panaderías,
 * heladerías, gastronomía y «Otros» → producto; el resto → servicio. Lo mismo
 * que `menuItemKind` en la app. */
const palabraCarta = (slug) => (['restaurant', 'cafe', 'bar'].includes(slug) ? 'dish'
  : (!slug || ['shop', 'nightclub', 'music', 'books', 'market', 'bakery', 'icecream', 'gourmet', 'other'].includes(slug)) ? 'product' : 'service');
const TEXTOS_CARTA = {
  dish: { add: 'Añadir plato', edit: 'Editar plato', col: 'Plato', ej: 'Tortilla de patata', sus: ['sus platos', 'its dishes'] },
  service: { add: 'Añadir servicio', edit: 'Editar servicio', col: 'Servicio', ej: '', sus: ['sus servicios', 'its services'] },
  product: { add: 'Añadir producto', edit: 'Editar producto', col: 'Producto', ej: '', sus: ['sus productos', 'its products'] },
};

PAGES.carta = async (v) => {
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  const ficha = await sb.from('businesses')
    .select('menu_url, menu_images, category_id').eq('id', BIZ.id).maybeSingle();
  const tc = TEXTOS_CARTA[palabraCarta(CATS.find((c) => c.id === ficha.data?.category_id)?.slug)];
  let carta = await rpc('business_menu', { p_business: BIZ.id }).catch(() => []);
  let enlace = ficha.data?.menu_url || '';
  let fotos = ficha.data?.menu_images || [];
  let sucia = false;

  // El enlace y las fotos se guardan en la ficha; la carta escrita, en su
  // propia tabla. Se guarda todo junto para que sea un solo botón.
  // Por `update_business`, como el resto de la ficha: la tabla no se escribe
  // directamente (antes, a un encargado no se le guardaba y no decía nada).
  const guardaFicha = () => rpc('update_business', {
    p_id: BIZ.id, p_patch: { menu_url: enlace.trim(), menu_images: fotos },
  });

  // Un solo envío a la vez: el botón se bloquea mientras guarda (un segundo
  // clic mandaba la carta dos veces) y sigue bloqueado aunque se repinte.
  // Lo que se toque mientras tanto no se da por guardado.
  let guardando = false;
  const estadoCarta = () => JSON.stringify({ enlace: enlace.trim(), fotos, carta });
  const guardar = async () => {
    if (guardando) return;
    guardando = true;
    const enviado = estadoCarta();
    const boton = $('#save', v);
    if (boton) { boton.disabled = true; boton.textContent = I18N.t('Guardando…'); }
    let ok = false;
    try {
      await guardaFicha();
      const r = await rpc('save_business_menu', { p_business: BIZ.id, p_menu: JSON.parse(enviado).carta })
        .catch((e) => ({ ok: false, error: e.message }));
      ok = !!r?.ok;
      if (ok) { sucia = estadoCarta() !== enviado; toast('Carta guardada'); }
      else toast(r?.error ? friendly(r.error) : 'No se ha podido guardar', true);
    } catch (e) {
      toast(friendly(e.message), true);
    } finally {
      guardando = false;
      if (v.isConnected) {
        if (ok) pinta();
        else {
          // Sin repintar: lo escrito sigue ahí para volver a probar.
          const b = $('#save', v);
          if (b) { b.disabled = !sucia; b.textContent = I18N.t('Guardar la carta'); }
        }
      }
    }
  };

  const pinta = () => {
    v.innerHTML = `
      <div class="page-head"><h1>Carta</h1><span class="spacer"></span>
        ${canManage ? `<button class="btn sm" id="add-sec">Añadir sección</button>
        <button class="btn sm primary" id="save" ${sucia && !guardando ? '' : 'disabled'}>${guardando ? 'Guardando…' : 'Guardar la carta'}</button>` : ''}</div>
      ${helpBox('Tú eliges cómo ponerla', bi('<p>Tres maneras, y puedes usar las que quieras a la vez: <b>escribirla</b> aquí, subir <b>fotos</b> de la carta de papel o poner un <b>enlace</b> a tu web o a un PDF.</p><p>Escribirla es lo que mejor se lee en el móvil, se puede buscar y la lee un lector de pantalla; si la escribes, es lo primero que se ve y las fotos y el enlace se quedan debajo. Si no te apetece, con una foto vas servido.</p><p>Los <b>alérgenos</b> son los catorce que obliga a declarar el Reglamento 1169/2011. Pon solo los que sepas seguro: aquí equivocarse no es una errata.</p>',
        '<p>Three ways, and you can use as many as you like at once: <b>type it</b> here, upload <b>photos</b> of the paper menu or add a <b>link</b> to your website or a PDF.</p><p>Typing it is what reads best on a phone, it can be searched and screen readers can read it; if you type it, it is shown first and the photos and the link go below. If you would rather not, a photo is enough.</p><p>The <b>allergens</b> are the fourteen that Regulation (EU) 1169/2011 requires you to declare. Only mark the ones you are sure about: a mistake here is not just a typo.</p>'))}

      <div class="card"><h2>Un enlace o un PDF</h2>
        <p class="muted" style="margin:0 0 8px">Si tu carta ya está en tu web o en un PDF, con pegar la dirección vale.</p>
        <label class="f"><span>Dirección</span>
          <input id="menu-url" type="url" value="${esc(enlace)}" placeholder="https://tubar.com/carta" ${canManage ? '' : 'disabled'}></label></div>

      <div class="card"><h2>Fotos de la carta</h2>
        <p class="muted" style="margin:0 0 8px">La de la pizarra o la de papel, tal cual. Se ven en tu ficha, una debajo de otra.</p>
        <div id="menu-fotos" class="thumbs">${fotos.map((u, i) => `
          <div class="thumb"><img src="${esc(u)}" alt="">
            ${canManage ? `<button class="btn sm bad ghost" data-foto-del="${i}">Quitar</button>` : ''}</div>`).join('')}
        </div>
        ${canManage ? (fotos.length < TOPE.carta
          ? `<p style="margin:10px 0 0"><label class="btn sm">${esc(I18N.t('Añadir fotos'))}<input type="file" id="menu-file" accept="image/*" multiple hidden></label> <span class="muted small">${esc(topeHasta(TOPE.carta))}</span></p>`
          : `<p class="muted" style="margin:10px 0 0">${esc(topeLleno(TOPE.carta))}</p>`) : ''}</div>
      <h2 style="margin:24px 0 8px">Escrita</h2>
      ${carta.length ? carta.map((sec, si) => `
        <div class="card">
          <h2 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(sec.name)}
            ${canManage ? `<span class="spacer"></span>
              <button class="btn sm ghost" data-sec-up="${si}">↑</button>
              <button class="btn sm ghost" data-sec-down="${si}">↓</button>
              <button class="btn sm ghost" data-sec-edit="${si}">Renombrar</button>
              <button class="btn sm bad ghost" data-sec-del="${si}">Borrar</button>` : ''}</h2>
          ${table({
            cols: [
              { h: tc.col, r: (it) => `${it.image_url ? `<img class="thumb" src="${esc(it.image_url)}" alt="" loading="lazy">` : ''}<b class="title">${esc(it.name)}</b>${it.description ? `<span class="sub">${esc(it.description)}</span>` : ''}` },
              { h: 'Alérgenos', r: (it) => (it.allergens || []).length
                ? (it.allergens || []).map((a) => `<span class="tag">${esc(nombreAlergeno(a))}</span>`).join(' ')
                : '<span class="muted">—</span>' },
              { h: 'Precio', num: true, r: (it) => it.price_cents == null ? '—' : fmtMoney(it.price_cents) },
              { h: '', r: (it, ii) => canManage ? `<div class="actions">
                  <button class="btn sm ghost" data-item-photo="${si}:${ii}">${it.image_url ? 'Cambiar foto' : 'Poner foto'}</button>
                  ${it.image_url ? `<button class="btn sm ghost" data-item-nophoto="${si}:${ii}">Quitar foto</button>` : ''}
                  <button class="btn sm ghost" data-item-edit="${si}:${ii}">Editar</button>
                  <button class="btn sm bad ghost" data-item-del="${si}:${ii}">Borrar</button></div>` : '' },
            ],
            rows: sec.items || [],
            empty: 'Esta sección está vacía.',
          })}
          ${canManage ? `<p style="margin:10px 0 0"><button class="btn sm" data-item-add="${si}">${esc(I18N.t(tc.add))}</button></p>` : ''}
        </div>`).join('')
        : `<div class="card"><p class="muted" style="margin:0"><span>Todavía no has escrito la carta.</span> ${canManage ? '<span>Empieza por una sección: «Para picar», «Bocadillos», «Bebidas»…</span>' : ''}</p></div>`}
      ${sucia ? '<p class="muted">Hay cambios sin guardar.</p>' : ''}`;

    if (!canManage) return;
    $('#save', v).onclick = guardar;
    $('#menu-url', v).oninput = (e) => {
      enlace = e.target.value;
      if (!sucia) { sucia = true; $('#save', v).disabled = guardando; }
    };
    $$('[data-foto-del]', v).forEach((b) => { b.onclick = () => {
      fotos.splice(+b.dataset.fotoDel, 1); sucia = true; pinta();
    }; });
    const file = $('#menu-file', v);
    if (file) file.onchange = async (e) => {
      for (const elegida of caben(e.target.files, fotos.length, TOPE.carta)) {
        const f = await KFotos.reduce(elegida, KFotos.TAM.foto);
        if (f.size > 5 * 1024 * 1024) { toast('Esa foto pesa más de 5 MB.', true); continue; }
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${BIZ.id}/carta-${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
        if (error) { toast(friendly(error.message), true); continue; }
        fotos = [...fotos, sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl];
      }
      sucia = true; pinta();
    };
    $('#add-sec', v).onclick = async () => {
      const r = await modal({ title: 'Nueva sección', fields: [{ name: 'name', label: 'Nombre', required: true, placeholder: 'Para picar', maxlength: 60 }] });
      if (!r?.name) return;
      carta = [...carta, { name: r.name, items: [] }];
      sucia = true; pinta();
    };
    $$('[data-sec-edit]', v).forEach((b) => { b.onclick = async () => {
      const i = +b.dataset.secEdit;
      const r = await modal({ title: 'Renombrar sección', fields: [{ name: 'name', label: 'Nombre', value: carta[i].name, required: true, maxlength: 60 }] });
      if (!r?.name) return;
      carta[i].name = r.name; sucia = true; pinta();
    }; });
    $$('[data-sec-del]', v).forEach((b) => { b.onclick = async () => {
      const i = +b.dataset.secDel;
      if (!await confirmDlg('Borrar sección', bi(`Se quita «${esc(carta[i].name)}» con ${tc.sus[0]}. No se guarda hasta que le des a «Guardar la carta».`, `“${esc(carta[i].name)}” and ${tc.sus[1]} are removed. Nothing is saved until you press “Save the menu”.`), { danger: true, submit: 'Borrar' })) return;
      carta.splice(i, 1); sucia = true; pinta();
    }; });
    $$('[data-sec-up]', v).forEach((b) => { b.onclick = () => {
      const i = +b.dataset.secUp;
      if (i === 0) return;
      [carta[i - 1], carta[i]] = [carta[i], carta[i - 1]]; sucia = true; pinta();
    }; });
    $$('[data-sec-down]', v).forEach((b) => { b.onclick = () => {
      const i = +b.dataset.secDown;
      if (i >= carta.length - 1) return;
      [carta[i + 1], carta[i]] = [carta[i], carta[i + 1]]; sucia = true; pinta();
    }; });

    const editaPlato = async (si, ii) => {
      const it = ii == null ? { allergens: [] } : carta[si].items[ii];
      const r = await modal({
        title: ii == null ? tc.add : tc.edit,
        fields: [
          { name: 'name', label: 'Nombre', value: it.name, required: true, placeholder: tc.ej, maxlength: 80 },
          { name: 'description', label: 'Descripción (opcional)', value: it.description || '', maxlength: 200 },
          { name: 'price', label: 'Precio (€)', value: it.price_cents == null ? '' : (it.price_cents / 100).toFixed(2).replace('.', ',') },
          ...ALERGENOS.map((a) => ({
            name: `a_${a[0]}`, type: 'checkbox', label: a[1],
            value: (it.allergens || []).includes(a[0]),
          })),
        ],
      });
      if (!r?.name) return;
      const precio = String(r.price || '').replace(',', '.').trim();
      const plato = {
        name: r.name,
        description: r.description || null,
        price_cents: precio === '' ? null : Math.round(parseFloat(precio) * 100),
        allergens: ALERGENOS.filter((a) => r[`a_${a[0]}`]).map((a) => a[0]),
        image_url: it.image_url || null,
        is_available: true,
      };
      if (Number.isNaN(plato.price_cents)) plato.price_cents = null;
      if (ii == null) carta[si].items = [...(carta[si].items || []), plato];
      else carta[si].items[ii] = { ...it, ...plato };
      sucia = true; pinta();
    };
    $$('[data-item-add]', v).forEach((b) => { b.onclick = () => editaPlato(+b.dataset.itemAdd, null); });
    $$('[data-item-edit]', v).forEach((b) => { b.onclick = () => {
      const [si, ii] = b.dataset.itemEdit.split(':').map(Number);
      editaPlato(si, ii);
    }; });
    // La foto se sube al momento; el resto de la carta se guarda al final.
    $$('[data-item-photo]', v).forEach((b) => { b.onclick = () => {
      const [si, ii] = b.dataset.itemPhoto.split(':').map(Number);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        if (!input.files?.[0]) return;
        const f = await KFotos.reduce(input.files[0], KFotos.TAM.plato);
        if (f.size > 5 * 1024 * 1024) { toast('Esa foto pesa más de 5 MB.', true); return; }
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${BIZ.id}/plato-${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
        if (error) { toast(friendly(error.message), true); return; }
        carta[si].items[ii].image_url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        sucia = true; pinta();
      };
      input.click();
    }; });
    $$('[data-item-nophoto]', v).forEach((b) => { b.onclick = () => {
      const [si, ii] = b.dataset.itemNophoto.split(':').map(Number);
      carta[si].items[ii].image_url = null; sucia = true; pinta();
    }; });
    $$('[data-item-del]', v).forEach((b) => { b.onclick = () => {
      const [si, ii] = b.dataset.itemDel.split(':').map(Number);
      carta[si].items.splice(ii, 1); sucia = true; pinta();
    }; });
  };

  pinta();
};

PAGES.cartel = async (v, offerId) => {
  const todas = await rpc('my_business_offers', { p_id: BIZ.id });
  const o = (todas || []).find((x) => x.id === offerId);
  // Una oferta de RRPP no tiene cartel: sin el enlace de un RRPP, su QR no
  // la abriría (cada RRPP tiene el suyo en «RRPP»).
  if (!o || o.audience === 'promoters') { location.hash = o ? '#/rrpp' : '#/publicaciones'; return; }
  const url = `https://klendar.app/o/${o.id}`;

  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/publicaciones">← Publicaciones</a>
      <span class="spacer"></span><button class="btn sm primary" id="print">Imprimir</button></div>
    ${helpBox('¿Para qué sirve?', '<p>Un folio para la puerta, la barra o el escaparate. Quien pase, apunta con la cámara del móvil y le sale tu publicación; si no tiene la app, la ve igual en la web.</p><p>Imprímelo en blanco y negro si quieres: el código se lee igual.</p>')}
    <div class="cartel" id="cartel">
      <div class="cartel-top">KLENDAR</div>
      <h2>${esc(o.title)}</h2>
      ${o.discount || o.price_cents != null ? `<p class="cartel-precio">${esc(o.discount ? etiquetaDescuento(o.discount) : fmtMoney(o.price_cents))}</p>` : ''}
      <div id="qr" class="cartel-qr"></div>
      <p class="cartel-pie"><b>${esc(BIZ.name)}</b><br>Apunta con la cámara del móvil</p>
      <p class="cartel-url">${esc(url)}</p>
    </div>`;

  // El QR se dibuja aquí mismo, sin mandar la dirección a ningún sitio.
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#qr', v).innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
  $('#print', v).onclick = () => window.print();
};

// ── El cartel del local ─────────────────────────────────────────────────────
// Un folio con el QR del local (klendar.app/v/<código>): quien lo escanea ve
// tu ficha y, si alguna tarjeta de sellos lo tiene activado, se lleva un
// sello por visita. Se imprime en la web (`/cartel/local/<código>`), en A4 o
// cuatro por folio para las mesas. Lo mismo que «Cartel del local» en la app.
PAGES['cartel-local'] = async (v) => {
  const d = await rpc('business_visit_qr', { p_business: BIZ.id });
  if (d?.ok === false) throw new Error(friendly(d.error));
  const base = I18N.lang === 'en' ? '/en/poster/venue/' : '/cartel/local/';
  const url = `https://klendar.app/v/${d.token}`;
  const tarjetas = d.visit_cards || [];
  const nombres = tarjetas.map((c) => c.name).join(', ');
  const n = d.visit_stamps_30d || 0;
  v.innerHTML = `
    <p class="crumbs"><a href="#/ficha">${esc(I18N.t('Tu ficha'))}</a> · <a href="#/sellos">${esc(I18N.t('Tarjetas de sellos'))}</a></p>
    <div class="page-head"><h1>Cartel del local</h1></div>
    ${helpBox('¿Para qué sirve?', bi('<p>Para la barra, la puerta o las mesas. Quien lo escanea con la cámara del móvil ve tu ficha: carta, fotos, publicaciones y reseñas. Desde ahí puede añadirte a favoritos.</p><p>Si una tarjeta de sellos tiene activado <b>«También por visita con el QR del local»</b>, además se lleva un sello, como mucho uno al día. Para eso comprobamos que está en tu local con la ubicación de su móvil (no la guardamos).</p>',
      '<p>For the counter, the door or the tables. Whoever scans it with their phone camera sees your profile: menu, photos, publications and reviews. From there they can add you to their favourites.</p><p>If a stamp card has <b>“Also per visit with the venue QR code”</b> turned on, they also get a stamp, one a day at most. To do that we check they are at your place with their phone’s location (we don’t store it).</p>'))}
    <div class="card cartel-local">
      <div id="qr" class="cl-qr" role="img" aria-label="QR ${esc(url)}"></div>
      <div class="cl-txt">
        <p><b>${esc(tarjetas.length ? bi(`Sellan por visita: ${nombres}`, `Stamp per visit: ${nombres}`)
          : I18N.t('Ninguna tarjeta de sellos da sello por visita, así que el cartel solo invita a ver tu ficha. Actívalo al crear o editar una tarjeta.'))}</b></p>
        ${tarjetas.length ? `<p class="muted">${esc(bi(
          n === 0 ? 'Ningún sello por visita en los últimos 30 días' : n === 1 ? '1 sello por visita en los últimos 30 días' : `${fmtNum(n)} sellos por visita en los últimos 30 días`,
          n === 0 ? 'No stamps from visits in the last 30 days' : n === 1 ? '1 stamp from visits in the last 30 days' : `${fmtNum(n)} stamps from visits in the last 30 days`))}</p>` : ''}
        <p class="acciones">
          <a class="btn primary" href="${base}${esc(d.token)}" target="_blank" rel="noopener">Imprimir en A4</a>
          <a class="btn" href="${base}${esc(d.token)}?mesa=1" target="_blank" rel="noopener">Imprimir tamaño mesa</a>
        </p>
        <p class="hint">Tamaño mesa: cuatro por folio, para recortar y poner en las mesas.</p>
        <p class="cartel-url">${esc(url)}</p>
      </div>
    </div>
    ${d.can_change ? `<div class="card">
      <h2 style="margin-top:0">Cambiar el QR</h2>
      <p class="muted">Si alguien lo usa sin venir (por ejemplo, con una foto del cartel), cámbialo: el cartel impreso deja de dar sellos al momento y tendrás que imprimir el nuevo.</p>
      <button class="btn bad ghost" type="button" id="cambiar">Cambiar el QR</button>
    </div>` : ''}`;

  // El QR se dibuja aquí mismo, sin mandar la dirección a ningún sitio.
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#qr', v).innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });

  const cambiar = $('#cambiar', v);
  if (cambiar) {
    cambiar.onclick = async () => {
      if (!await confirmDlg(I18N.t('¿Cambiar el QR del local?'),
        esc(I18N.t('El cartel que tienes impreso dejará de valer al momento y tendrás que imprimir el nuevo. Hazlo si alguien lo usa sin venir (por ejemplo, con una foto del cartel).')),
        { danger: true, submit: 'Cambiar' })) return;
      const r = await rpc('rotate_visit_qr', { p_business: BIZ.id }).catch((err) => ({ ok: false, error: err.message }));
      if (!r?.ok) { toast(friendly(r?.error), true); return; }
      toast('QR cambiado. Imprime el cartel nuevo.');
      route();
    };
  }
};

// ── Poner en la tele ────────────────────────────────────────────────────────
// «Klendar en la tele del local»: klendar.app/tv abierto en la tele enseña un
// código de 6 cifras (y un QR a klendar.app/tv/enlazar/<código>, que trae
// aquí con `?codigo=`). Al escribirlo, esa tele queda enlazada a este local
// y enseña sus publicaciones activas. Desvincular la deja al momento sin
// nada. Lo mismo que «Poner en la tele» en «Mi negocio» de la app.
const ERR_TELE = {
  code_not_found: 'Ese código no existe o ha caducado. Mira el que sale ahora en la tele.',
  too_many_screens: 'Ya tienes 10 teles enlazadas. Desvincula alguna para enlazar otra.',
  rate_limited: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  forbidden: 'Solo el propietario o un encargado pueden enlazar teles.',
  invalid_seconds: 'Elige 8, 12, 20 o 30 segundos.',
  name_too_long: 'El nombre puede tener 40 caracteres como mucho.',
};
const haceTele = (iso) => {
  if (!iso) return I18N.t('Aún no se ha conectado');
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 60) return bi(`Vista por última vez hace ${Math.max(1, min)} min`, `Last seen ${Math.max(1, min)} min ago`);
  const h = Math.round(min / 60);
  if (h < 48) return bi(`Vista por última vez hace ${h} h`, `Last seen ${h} h ago`);
  return bi(`Vista por última vez el ${fmtDate(iso)}`, `Last seen on ${fmtDate(iso)}`);
};
PAGES.tele = async (v) => {
  const codigo = (new URLSearchParams(location.hash.split('?')[1] || '').get('codigo') || '').replace(/\D/g, '').slice(0, 6);
  const [lista, sitio] = await Promise.all([
    rpc('tv_screens_list', { p_business: BIZ.id }),
    rpc('business_crowd_status', { p_business: BIZ.id }).catch(() => null),
  ]);
  if (lista?.ok === false) throw new Error(I18N.t(ERR_TELE[lista.error] || 'No se ha podido cargar. Prueba otra vez.'));
  const teles = lista?.screens || [];
  v.innerHTML = `
    <div class="page-head"><h1>Poner en la tele</h1></div>
    ${helpBox('¿Cómo funciona?', bi(
    '<p>Abre <b>klendar.app/tv</b> en el navegador de la tele (o en un Chromecast o un Fire TV). Saldrá un código de 6 cifras: escríbelo aquí o escanea el QR con la cámara del móvil.</p><p>La tele enseña tus publicaciones activas a pantalla completa, con su diseño y la cuenta atrás de las ofertas flash, y un QR para que la gente las consiga o te añada a favoritos. Cambia sola y se actualiza sola cuando publicas algo o termina. Sin publicaciones, enseña tu logo. No enseña ofertas de RRPP, ni exclusivas, ni nada +18 si tu local no es +18.</p><p>La tele no entra con tu cuenta: solo puede enseñar lo público de tu local. Si la cambias de sitio o la vendes, desvincúlala aquí.</p>',
    '<p>Open <b>klendar.app/tv</b> in the TV’s browser (or on a Chromecast or Fire TV). A 6-digit code will appear: type it in here or scan the QR code with your phone camera.</p><p>The TV shows your active publications full screen, with their design and the flash offer countdown, plus a QR code so people can get them or add you to their favourites. It moves on by itself and updates itself when you publish something or it ends. With nothing published, it shows your logo. It never shows promoter offers, exclusives or anything 18+ unless your place is 18+.</p><p>The TV doesn’t log in with your account: it can only show what’s public about your place. If you move it or sell it, unlink it here.</p>'))}
    <div class="card">
      <h2 style="margin-top:0">Enlazar una tele</h2>
      <!-- Como la app: solo el código; el nombre («Tele 1») se cambia en Ajustes. -->
      <form id="enlazar" class="form" autocomplete="off">
        <label class="f"><span>Código de la tele</span><input name="code" inputmode="numeric" maxlength="7" placeholder="123 456" value="${esc(codigo)}" required aria-describedby="teleAyuda"></label>
        <p class="hint full" id="teleAyuda">${esc(I18N.t('El que sale en la tele al abrir klendar.app/tv. Cambia cada 10 minutos.'))}</p>
        <div class="full"><button class="btn primary" type="submit">Enlazar</button> <span id="msg" class="err" role="alert"></span></div>
      </form>
    </div>
    <div class="card">
      <h2 style="margin-top:0">Tus teles</h2>
      ${teles.length ? `<ul class="teles">${teles.map((t, i) => `<li class="tele">
        <span class="tele-ic">${svg('tele', 24)}</span>
        <div class="tele-txt"><b>${esc(t.name)}</b>
          <span class="muted small">${t.online ? `<span class="tele-on">${esc(I18N.t('Conectada ahora'))}</span>` : esc(haceTele(t.last_seen_at))} · ${esc(bi(`Cambia cada ${t.seconds} s`, `Changes every ${t.seconds} s`))}</span></div>
        <span class="actions"><button class="btn sm" type="button" data-ajustes="${i}">Ajustes</button><button class="btn sm" type="button" data-quitar="${i}">Desvincular</button></span>
      </li>`).join('')}</ul>` : `<p class="muted" style="margin:0">${esc(I18N.t('Todavía no has enlazado ninguna tele.'))}</p>`}
    </div>`;

  const f = $('#enlazar', v);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('#msg', f);
    msg.textContent = '';
    const code = String(f.elements.code.value || '').replace(/\D/g, '');
    if (code.length !== 6) { msg.textContent = I18N.t('Escribe las 6 cifras que salen en la tele.'); f.elements.code.focus(); return; }
    const r = await rpc('tv_pair_claim', { p_code: code, p_business: BIZ.id, p_name: null })
      .catch((err) => ({ ok: false, error: err.message }));
    if (!r?.ok) { msg.textContent = I18N.t(ERR_TELE[r?.error] || friendly(r?.error)); return; }
    toast(I18N.t('¡Listo! La tele ya enseña tus publicaciones.'));
    // Sin `?codigo=` en la dirección: si se recarga, no vuelve a probarlo.
    if (location.hash.includes('?')) history.replaceState(null, '', '#/tele');
    route();
  };

  $$('[data-quitar]', v).forEach((b) => { b.onclick = async () => {
    const t = teles[+b.dataset.quitar];
    if (!(await confirmDlg(bi(`¿Desvincular «${t.name}»?`, `Unlink “${t.name}”?`),
      esc(I18N.t('La tele dejará de enseñar tus publicaciones al momento y volverá a enseñar un código.')),
      { submit: 'Desvincular', danger: true }))) return;
    const r = await rpc('tv_unlink', { p_screen: t.id }).catch(() => null);
    if (!r?.ok) { toast(I18N.t(ERR_TELE[r?.error] || 'No se ha podido guardar'), true); return; }
    toast(I18N.t('Tele desvinculada')); route();
  }; });

  $$('[data-ajustes]', v).forEach((b) => { b.onclick = async () => {
    const t = teles[+b.dataset.ajustes];
    const campos = [
      { name: 'name', label: 'Nombre', value: t.name, maxlength: 40, required: true },
      { name: 'seconds', label: 'Cambia cada', type: 'select', value: String(t.seconds), options: [8, 12, 20, 30].map((n) => [String(n), `${n} s`]) },
    ];
    // «¿Hay sitio ahora?» solo si el local lo usa (Tu ficha → Cómo es tu local).
    if (sitio?.enabled) campos.push({ name: 'crowd', label: I18N.t('Enseñar «¿Hay sitio ahora?»'), type: 'checkbox', value: t.show_crowd });
    const d = await modal({ title: I18N.t('Ajustes de la tele'), fields: campos });
    if (!d) return;
    const r = await rpc('tv_screen_update', {
      p_screen: t.id, p_name: d.name, p_seconds: Number(d.seconds), p_show_crowd: sitio?.enabled ? !!d.crowd : null,
    }).catch(() => null);
    if (!r?.ok) { toast(I18N.t(ERR_TELE[r?.error] || 'No se ha podido guardar'), true); return; }
    toast('Guardado'); route();
  }; });
};

PAGES.novedades = async (v) => {
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  const { data: posts } = await sb.from('business_posts')
    .select('id, body, image_url, created_at, moderation_status')
    .eq('business_id', BIZ.id).order('created_at', { ascending: false }).limit(50);

  const escribe = async (post) => {
    const foto = `<label class="f"><span>${esc(I18N.t('Foto'))} <small>(${esc(I18N.t('opcional'))})</small></span><input type="file" name="foto" accept="image/*"></label>
      ${post?.image_url ? `<label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="quitaFoto"><span>${esc(I18N.t('Quitar la foto que tiene'))}</span></label>` : ''}`;
    const abierto = modal({
      title: post ? 'Editar novedad' : 'Nueva novedad',
      intro: 'Una nota corta que sale en tu ficha: «hoy hay pulpo», «cerramos el lunes por obras», «ya tenemos terraza».',
      fields: [{ name: 'body', label: 'Qué cuentas', type: 'textarea', value: post?.body || '', maxlength: 1000 }],
      html: foto,
      submit: post ? 'Guardar' : 'Publicar',
    });
    I18N.translate($('#modal'));
    const campoFoto = $('#modal [name=foto]');
    const campoQuita = $('#modal [name=quitaFoto]');
    const r = await abierto;
    if (!r) return;
    const elegida = campoFoto?.files?.[0];
    const texto = (r.body || '').trim();
    // Texto, foto o las dos cosas (como en la app); vacía del todo, no.
    if (!texto && !elegida && !(post?.image_url && !campoQuita?.checked)) {
      toast('Escribe algo o añade una foto.', true); return;
    }
    try {
      let image = post ? post.image_url : null;
      if (campoQuita?.checked) image = null;
      if (elegida) {
        const archivo = await KFotos.reduce(elegida, KFotos.TAM.foto);
        if (archivo.size > 5 * 1024 * 1024) { toast('Esa foto pesa más de 5 MB.', true); return; }
        const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${BIZ.id}/posts/${crypto.randomUUID()}.${ext}`;
        const { error: up } = await sb.storage.from(BUCKET).upload(path, archivo, { contentType: archivo.type });
        if (up) throw new Error(up.message);
        image = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const fila = { body: texto || null, image_url: image };
      const { data: guardada, error } = post
        ? await sb.from('business_posts').update(fila).eq('id', post.id).select('moderation_status').single()
        : await sb.from('business_posts').insert({ business_id: BIZ.id, ...fila }).select('moderation_status').single();
      if (error) throw new Error(error.message);
      // Con lenguaje ofensivo no se publica hasta revisarla (como en la app).
      toast(guardada?.moderation_status === 'pending'
        ? 'Lo revisamos antes de publicarlo porque puede contener lenguaje ofensivo. Normalmente en menos de 24 h.'
        : 'Hecho'); route();
    } catch (e) { toast(friendly(e.message), true); }
  };

  v.innerHTML = `
    <div class="page-head"><h1>Novedades</h1><span class="spacer"></span>
      ${canManage ? '<button class="btn sm primary" id="nueva">Nueva novedad</button>' : ''}</div>
    ${helpBox('¿Qué es una novedad?', bi('<p>Una nota corta en tu ficha, sin cuenta atrás ni código: «hoy hay pulpo», «cerramos el lunes», «ya tenemos terraza». Para algo que se canjea, usa una <b>publicación</b>.</p><p>Quien te tenga en favoritos recibe una notificación (como mucho una al día por negocio, para no cansar).</p>',
      '<p>A short note on your page, with no countdown or code: “octopus today”, “closed on Monday”, “the terrace is open”. For something people redeem, use a <b>publication</b>.</p><p>People who have you in their favourites get a notification (at most one a day per business, so it doesn\'t get tiring).</p>'))}
    ${table({
      cols: [
        { h: 'Novedad', r: (p) => `${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}" alt="" loading="lazy">` : ''}<span class="title">${esc(p.body || '')}</span>${p.moderation_status === 'pending' ? ' <span class="tag st-pending">En revisión</span>' : ''}` },
        { h: 'Cuándo', r: (p) => fmtDate(p.created_at) },
        { h: '', r: (p) => canManage ? `<div class="actions">
            <button class="btn sm ghost" data-edit="${esc(p.id)}">Editar</button>
            <button class="btn sm bad ghost" data-del="${esc(p.id)}">Borrar</button></div>` : '' },
      ],
      rows: posts || [],
      empty: 'Todavía no has contado nada.',
    })}`;

  if (!canManage) return;
  $('#nueva', v).onclick = () => escribe(null);
  $$('[data-edit]', v).forEach((b) => { b.onclick = () => escribe((posts || []).find((p) => p.id === b.dataset.edit)); });
  $$('[data-del]', v).forEach((b) => { b.onclick = async () => {
    if (!await confirmDlg('Borrar novedad', 'Desaparece de tu ficha. No se puede deshacer.', { danger: true, submit: 'Borrar' })) return;
    const { error } = await sb.from('business_posts').delete().eq('id', b.dataset.del);
    if (error) { toast(friendly(error.message), true); return; }
    toast('Borrada'); route();
  }; });
};

/** «Tu plan»: lo mismo que la tarjeta del panel en la app. */
function planCard(sub) {
  const en = I18N.lang === 'en';
  const name = sub.plan_names?.[I18N.lang] || sub.plan_names?.es || sub.plan_slug || '';
  const free = sub.plan_slug === 'free';
  const trial = sub.status === 'trial';
  const until = sub.period_end
    ? new Date(sub.period_end).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '';
  const estado = trial && until
    ? (en ? `Everything included until ${until}, no card and no automatic renewal. While your city is launching, it stays free.`
      : `Prueba con todo hasta el ${until}, sin tarjeta y sin renovación automática. Mientras tu ciudad arranca, sigues gratis.`)
    : free ? (en ? 'Free while your city is launching, with no limit on publications. We\u2019ll give you a month\u2019s notice before charging.'
      : 'Gratis mientras tu ciudad arranca, sin límite de publicaciones. Te avisaremos con un mes de antelación antes de cobrar.')
      : (en ? `${fmtMoney(sub.price_cents)} per month, no sales commission.` : `${fmtMoney(sub.price_cents)} al mes, sin comisiones por venta.`);
  const usadas = sub.active_offers ?? 0;
  const uso = sub.max_active_offers == null
    ? (en ? `${usadas} active publication${usadas === 1 ? '' : 's'} · unlimited`
      : `${usadas} ${usadas === 1 ? 'publicación activa' : 'publicaciones activas'} · sin límite`)
    : (en ? `${usadas} of ${sub.max_active_offers} active publications` : `${usadas} de ${sub.max_active_offers} publicaciones activas`);
  const asunto = encodeURIComponent(en ? 'Change of plan' : 'Cambio de plan');
  const cuerpo = encodeURIComponent(`${en ? 'Business' : 'Negocio'}: ${BIZ.id}`);
  return `<div class="card"><h2>${ms('workspace_premium')} ${esc(en ? `${name} plan` : `Plan ${name}`)}${trial ? ` <span class="tag st-trial">${en ? 'TRIAL' : 'PRUEBA'}</span>` : ''}</h2>
    <p class="muted" style="margin:0 0 6px">${esc(estado)}</p>
    <p style="margin:0 0 12px">${esc(uso)}</p>
    <a class="btn sm" href="mailto:info@klendar.app?subject=${asunto}&body=${cuerpo}">${esc(free || trial ? (en ? 'Ask about the plan' : 'Preguntar por el plan') : (en ? 'Change plan or payment method' : 'Cambiar plan o forma de pago'))}</a></div>`;
}

PAGES.equipo = async (v) => {
  const [team, invites] = await Promise.all([
    rpc('business_team', { p_id: BIZ.id }),
    rpc('business_invites_list', { p_business_id: BIZ.id }).catch(() => []),
  ]);
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  v.innerHTML = `
    <div class="page-head"><h1>Equipo</h1><span class="spacer"></span>
      ${canManage ? '<button class="btn sm primary" id="add">Añadir a alguien</button>' : ''}</div>
    ${helpBox('¿Quién puede qué?', bi('<p><b>Empleado</b>: valida códigos QR. <b>Encargado</b>: además publica, edita la ficha y lleva el equipo. <b>Propietario</b>: todo; no se le puede cambiar el rol desde aquí.</p>',
      '<p><b>Staff</b>: validates QR codes. <b>Manager</b>: also publishes, edits the business page and runs the team. <b>Owner</b>: everything; their role can\'t be changed from here.</p>'))}
    <div id="list"></div>
    ${invites.length ? `<div class="card" style="margin-top:14px"><h2>Invitaciones pendientes</h2>
      <p class="muted">Aún no han contestado. Caducan a los 14 días y puedes cancelarlas.</p>
      ${table({ cols: [
        { h: 'Correo', r: (i) => esc(i.email) },
        { h: 'Rol', r: (i) => tag(i.role) },
        { h: 'Fecha de invitación', r: (i) => fmtDate(i.created_at) },
        { h: 'Caduca', r: (i) => (i.expires_at ? fmtDate(i.expires_at) : '—') },
        { h: '', r: (i) => canManage ? `<button class="btn sm ghost" data-cancel="${esc(i.id)}">Cancelar</button>` : '' },
      ], rows: invites })}</div>` : ''}`;
  $('#list').innerHTML = table({
    cols: [
      { h: 'Persona', r: (m) => `<b class="title">${esc(m.display_name || m.email || '')}</b><span class="sub">${esc(m.email || '')}</span>` },
      { h: 'Rol', r: (m) => tag(m.role) },
      { h: '', r: (m) => canManage && m.role !== 'owner' ? `<div class="actions">
          <button class="btn sm ghost" data-role="${m.role === 'manager' ? 'staff' : 'manager'}" data-user="${esc(m.user_id)}">${m.role === 'manager' ? 'Hacer empleado' : 'Hacer encargado'}</button>
          <button class="btn sm ghost" data-remove="${esc(m.user_id)}">Quitar</button></div>` : '' },
    ],
    rows: team,
  });
  if (canManage) {
    $('#add').onclick = async () => {
      const r = await modal({
        title: 'Añadir a alguien al equipo',
        intro: esc(I18N.t('Le llega una invitación (en la app y por correo) que tiene que aceptar. Si aún no tiene cuenta, la verá al crearla con ese correo. Caduca a los 14 días. Tiene que tener 16 años (18 si tu negocio es +18).')),
        fields: [
          { name: 'email', label: 'Correo', type: 'email', required: true },
          { name: 'role', label: 'Rol', type: 'select', value: 'staff', options: [['staff', 'Empleado'], ['manager', 'Encargado']] },
        ],
        submit: 'Añadir',
      });
      if (!r) return;
      try {
        const res = await rpc('add_business_member', { p_business_id: BIZ.id, p_email: r.email, p_role: r.role });
        if (!res.ok) { toast(friendly(res.error), true); return; }
        // Siempre es una invitación que la persona acepta (antes, con cuenta,
        // entraba sin que se le preguntara).
        toast(res.invited ? 'Invitación enviada: entrará en el equipo cuando la acepte' : 'Añadido al equipo');
        route();
      } catch (e) { toast(friendly(e.message), true); }
    };
    $$('[data-role]', v).forEach((b) => {
      b.onclick = async () => {
        try {
          const res = await rpc('set_business_member_role', { p_business_id: BIZ.id, p_user_id: b.dataset.user, p_role: b.dataset.role });
          if (!res.ok) { toast(friendly(res.error), true); return; }
          toast('Rol cambiado'); route();
        } catch (e) { toast(friendly(e.message), true); }
      };
    });
    $$('[data-remove]', v).forEach((b) => {
      b.onclick = async () => {
        if (!await confirmDlg('Quitar del equipo', 'Dejará de poder validar códigos y de ver el panel.', { danger: true, submit: 'Quitar' })) return;
        try {
          const res = await rpc('remove_business_member', { p_business_id: BIZ.id, p_user_id: b.dataset.remove });
          if (res && res.ok === false) { toast(friendly(res.error), true); return; }
          toast('Fuera del equipo'); route();
        } catch (e) { toast(friendly(e.message), true); }
      };
    });
    $$('[data-cancel]', v).forEach((b) => {
      b.onclick = async () => {
        const { error } = await sb.from('business_invites').delete().eq('id', b.dataset.cancel);
        if (error) { toast(friendly(error.message), true); return; }
        toast('Invitación cancelada'); route();
      };
    });
  }
};

// Cuánta gente viene de cerca y cuánta de lejos. Nunca un punto en un mapa
// —sería señalar dónde vive un cliente—, y a partir de cinco personas: con
// dos datos se adivina quién es quién.
function audienciaHtml(aud) {
  if (!aud) return '';
  const tramos = aud.buckets || [];
  if (!tramos.length) {
    return aud.people
      ? `<div class="card"><h2>De dónde viene tu gente</h2><p class="muted" style="margin:0">${bi(`Todavía son pocas personas (${fmtNum(aud.people)}) para enseñarlo sin señalar a nadie. A partir de cinco aparece aquí.`, `Still too few people (${fmtNum(aud.people)}) to show this without pointing anyone out. It shows up from five.`)}</p></div>`
      : '';
  }
  const total = tramos.reduce((a, b) => a + b.n, 0) || 1;
  return `<div class="card"><h2>De dónde viene tu gente</h2>
    <div class="bars">${tramos.map((t) => `
      <div class="bar"><span class="bl">${esc(t.bucket)}</span>
        <span class="bt"><i style="width:${Math.round((t.n / total) * 100)}%"></i></span>
        <span class="bn">${fmtNum(t.n)}</span></div>`).join('')}</div>
    <p class="muted small" style="margin:10px 0 0">${esc(bi(`Distancia entre tu local y el último sitio conocido de quien ha canjeado algo, de ${fmtNum(aud.people)} persona(s). Es aproximado y nunca se enseña dónde está nadie.`,
      `Distance between your place and the last known location of people who redeemed something (${fmtNum(aud.people)} ${aud.people === 1 ? 'person' : 'people'}). It's approximate and never shows where anyone is.`))}</p>
  </div>`;
}

// ── Avisar a mis clientes ───────────────────────────────────────────────────
// Un mensaje corto que llega como notificación a quien tiene el negocio en
// favoritos (y, si se quiere, a quien tiene sellos en sus tarjetas). Uno por
// semana y local. Lo mismo que la pantalla de la app, con las mismas
// funciones de la base: `business_message_info` y `send_business_message`.
// Solo propietario y encargado (la base contesta `not_authorized` al resto).
const ERR_MENSAJE = {
  not_authorized: 'Solo el propietario o un encargado pueden enviar mensajes.',
  not_verified: 'Tu negocio tiene que estar verificado para enviar mensajes.',
  title_length: 'El título tiene que tener entre 3 y 60 caracteres.',
  body_length: 'El mensaje tiene que tener entre 5 y 240 caracteres.',
  bad_offer: 'Esa publicación ya no está activa.',
  no_recipients: 'Ahora mismo no le llegaría a nadie.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento.',
};
/** «lunes 5 de octubre, 18:30» / “Monday 5 October, 18:30”, en la hora del
 * negocio (Intl pone «lunes, 5…» y “… at 18:30”: se arma a mano). */
const diaYHora = (iso, tz) => `${KZ.fmt(iso, tz, LOC(), { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')}, ${KZ.fmt(iso, tz, LOC(), { hour: '2-digit', minute: '2-digit' })}`;
const personasTxt = (n) => bi(n === 1 ? '1 persona' : `${fmtNum(n)} personas`, n === 1 ? '1 person' : `${fmtNum(n)} people`);

PAGES.mensajes = async (v) => {
  const info = await rpc('business_message_info', { p_business: BIZ.id });
  if (info?.ok === false) throw new Error(I18N.t(ERR_MENSAJE[info.error] || friendly(info.error)));
  const tz = KZ.valida(info.time_zone) ? info.time_zone : TZ;
  const offers = info.offers || [];
  const hist = info.history || [];
  const estado = !info.verified ? `<div class="scan-result warn">${esc(I18N.t('Tu negocio tiene que estar verificado para enviar mensajes.'))}</div>`
    : info.can_send ? `<div class="scan-result ok">${ms('check_circle')}${esc(I18N.t('Puedes enviar uno esta semana.'))}</div>`
      : `<div class="scan-result warn">${esc(bi(`El siguiente lo podrás enviar el ${diaYHora(info.next_at, tz)}.`, `You can send the next one on ${diaYHora(info.next_at, tz)}.`))}</div>`;
  const ESTADOS = { sent: ['ok', 'Enviado'], review: ['warn', 'En revisión'], rejected: ['bad', 'No enviado'] };

  v.innerHTML = `
    <div class="page-head"><h1>Avisar a mis clientes</h1></div>
    <p class="muted" style="max-width:640px">Un mensaje corto que llega como notificación a quien tiene tu negocio en favoritos. Uno por semana.</p>
    <div style="max-width:820px;margin:0 0 18px">${estado}</div>
    <div id="msgHecho" style="max-width:820px" aria-live="polite"></div>
    <form id="f" class="form" novalidate>
      <label class="f full"><span>Título</span>
        <input name="titulo" maxlength="60" placeholder="Ej.: Hoy, croquetas caseras" autocomplete="off">
        <small class="hint" data-cuenta="titulo" aria-live="polite">0/60</small></label>
      <label class="f full"><span>Mensaje</span>
        <textarea name="mensaje" maxlength="240" rows="3" placeholder="Ej.: Acaban de salir del horno. Hasta las 16:00 o hasta que se acaben."></textarea>
        <small class="hint" data-cuenta="mensaje" aria-live="polite">0/240</small></label>
      <label class="f full"><span>Enlazar una publicación (opcional)</span><select name="oferta">
        <option value="">Ninguna</option>
        ${offers.map((o) => `<option value="${esc(o.id)}">${esc(o.title)} · ${esc(I18N.t(LABELS[o.kind] || ''))}${o.starts_at ? ` · ${esc(fmtDate(o.starts_at))}` : ''}</option>`).join('')}
      </select></label>
      <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="clientes"><span>Enviarlo también a quien tiene sellos en tus tarjetas</span></label>
      <p class="full" style="margin:0"><b id="recuento"></b></p>
      <p class="hint full">Respetamos las horas de silencio de cada persona y a quien ha apagado estos mensajes.</p>
      <div class="full"><button class="btn primary" type="submit" ${info.can_send ? '' : 'disabled'}>Vista previa</button></div>
      <p class="err full" id="msgErr" role="alert"></p>
    </form>
    <div class="card"><h2>Enviados</h2>
      ${hist.length ? hist.map((m) => {
        const [cls, txt] = ESTADOS[m.status] || ['dim', m.status];
        return `<div class="mensaje-hist">
          <p><b>${esc(m.title)}</b> <span class="tag ${cls}">${esc(I18N.t(txt))}</span></p>
          <p>${esc(m.body)}</p>
          <p class="muted small">${esc(fmtDate(m.sent_at || m.created_at))}${m.status === 'sent' ? ` · ${esc(personasTxt(m.recipients || 0))}` : ''}${m.author_name ? ` · ${esc(m.author_name)}` : ''}</p>
          ${m.offer_title ? `<p class="muted small">${esc(bi(`Con enlace a «${m.offer_title}»`, `Linking to “${m.offer_title}”`))}</p>` : ''}
          ${m.status === 'rejected' && m.rejection_reason ? `<p class="muted small">${esc(bi(`Motivo: ${m.rejection_reason}`, `Reason: ${m.rejection_reason}`))}</p>` : ''}
        </div>`;
      }).join('') : '<p class="muted" style="margin:0">Aún no has enviado ninguno.</p>'}
    </div>`;

  const f = $('#f', v);
  // Cuántos lo recibirían: solo favoritos o también clientes; si el negocio
  // es +18 o la publicación enlazada lo es, solo mayores de edad.
  const cuantos = () => {
    const o = offers.find((x) => x.id === f.elements.oferta.value);
    const adultos = !!info.adults_only || !!o?.adults_only;
    const conClientes = f.elements.clientes.checked;
    return Number(conClientes
      ? (adultos ? info.with_customers_adults : info.with_customers)
      : (adultos ? info.favorites_adults : info.favorites)) || 0;
  };
  const pintaRecuento = () => {
    const n = cuantos();
    $('#recuento', v).textContent = n === 0 ? I18N.t('Ahora mismo no le llegaría a nadie.')
      : bi(n === 1 ? 'Lo recibirá 1 persona' : `Lo recibirán ${fmtNum(n)} personas`, n === 1 ? '1 person will get it' : `${fmtNum(n)} people will get it`);
  };
  const pintaCuentas = () => {
    for (const el of $$('[data-cuenta]', v)) {
      const campo = f.elements[el.dataset.cuenta];
      el.textContent = `${campo.value.length}/${campo.maxLength}`;
    }
  };
  f.elements.titulo.addEventListener('input', pintaCuentas);
  f.elements.mensaje.addEventListener('input', pintaCuentas);
  f.elements.oferta.onchange = pintaRecuento;
  f.elements.clientes.onchange = pintaRecuento;
  pintaRecuento();

  const error = (clave, datos) => {
    $('#msgErr', v).textContent = clave === 'too_soon' && datos?.next_at
      ? bi(`Ya has enviado uno esta semana. El siguiente, el ${diaYHora(datos.next_at, tz)}.`, `You've already sent one this week. The next one, on ${diaYHora(datos.next_at, tz)}.`)
      : I18N.t(ERR_MENSAJE[clave] || friendly(clave));
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    $('#msgErr', v).textContent = '';
    const titulo = f.elements.titulo.value.replace(/\s+/g, ' ').trim();
    const cuerpo = f.elements.mensaje.value.trim();
    // Las mismas reglas que la base (y la app), antes de enseñar nada.
    if (titulo.length < 3 || titulo.length > 60) { error('title_length'); return; }
    if (cuerpo.length < 5 || cuerpo.length > 240) { error('body_length'); return; }
    const n = cuantos();
    if (!n) { error('no_recipients'); return; }
    // La vista previa: la notificación tal cual llegará al móvil, y desde
    // aquí se envía (o se vuelve a editar).
    const enviar = await modal({
      title: 'Así llegará',
      html: `<div class="noti-prev">
          <img src="/assets/icon-192.png" alt="" width="36" height="36">
          <div><p class="noti-app">Klendar</p>
            <p class="noti-t">${esc(`${info.business_name || BIZ.name}: ${titulo}`)}</p>
            <p class="noti-b">${esc(cuerpo)}</p></div>
        </div>`,
      submit: bi(n === 1 ? 'Enviar a 1 persona' : `Enviar a ${fmtNum(n)} personas`, n === 1 ? 'Send to 1 person' : `Send to ${fmtNum(n)} people`),
      cancel: 'Seguir editando',
    });
    if (!enviar) return;
    let r;
    try {
      r = await rpc('send_business_message', {
        p_business: BIZ.id,
        p_title: titulo,
        p_body: cuerpo,
        p_offer: f.elements.oferta.value || null,
        p_include_customers: f.elements.clientes.checked,
      });
    } catch (err) { toast(friendly(err.message), true); return; }
    if (!r?.ok) { error(r?.error, r); return; }
    // Hecho: se vuelve a pintar (estado de la semana e historial al día) y
    // arriba se dice qué ha pasado.
    const hecho = r.status === 'review'
      ? `<div class="scan-result warn">${esc(I18N.t((r.flags || []).includes('offensive')
        ? 'Lo revisamos antes de enviarlo porque puede contener lenguaje ofensivo. Normalmente en menos de 24 h.'
        : 'Lo revisamos antes de enviarlo porque menciona alcohol, tabaco o apuestas. Normalmente en menos de 24 h.'))}</div>`
      : `<div class="scan-result ok">${ms('check_circle')}${esc(bi(r.recipients === 1 ? 'Mensaje enviado a 1 persona.' : `Mensaje enviado a ${fmtNum(r.recipients || 0)} personas.`,
        r.recipients === 1 ? 'Message sent to 1 person.' : `Message sent to ${fmtNum(r.recipients || 0)} people.`))}</div>`;
    await route();
    const caja = $('#msgHecho');
    if (caja) { caja.innerHTML = hecho; caja.style.marginBottom = '18px'; }
  };
};

// ── Regalo de cumpleaños ────────────────────────────────────────────────────
// El día de su cumpleaños, quien tiene el negocio en favoritos recibe una
// notificación y un código de regalo. Lo ve todo el equipo; lo cambian el
// propietario y el encargado (el resto, en solo lectura).
const ERR_REGALO = {
  not_authorized: 'Solo el propietario o un encargado pueden cambiarlo.',
  gift_length: 'Escribe el regalo (de 3 a 80 caracteres).',
  days_range: 'Elige cuántos días vale.',
  flagged: 'El regalo no puede ser tabaco ni apuestas.',
};
/** Lenguaje ofensivo en el regalo o en una tarjeta de sellos: el texto nuevo
 * espera revisión y mientras sigue el que había (como en la app). */
const EN_REVISION_USO = 'Lo revisamos antes de usarlo porque puede contener lenguaje ofensivo. Normalmente en menos de 24 h.';
const revisionTexto = (nuevo, actual) => `<div class="scan-result warn">${esc(actual
  ? bi(`En revisión: «${nuevo}». Mientras, sigue «${actual}».`, `In review: “${nuevo}”. Until then, “${actual}” stays.`)
  : bi(`En revisión: «${nuevo}». No se usa hasta que lo revisemos.`, `In review: “${nuevo}”. It won't be used until we've reviewed it.`))}</div>`;
const revisionRegalo = (pendiente, actual) => (pendiente ? revisionTexto(pendiente, actual) : '');

PAGES.cumpleanos = async (v) => {
  const d = await rpc('business_birthday_gift', { p_business: BIZ.id });
  if (d?.ok === false) throw new Error(I18N.t(ERR_REGALO[d.error] || friendly(d.error)));
  const edita = !!d.can_edit;
  const dias = [1, 3, 7, 14, 30];
  if (d.valid_days && !dias.includes(d.valid_days)) dias.push(d.valid_days);
  dias.sort((a, b) => a - b);
  const n = d.given_this_year || 0;
  const m = d.redeemed_this_year || 0;
  const alcance = d.reachable || 0;
  const ro = edita ? '' : 'disabled';
  v.innerHTML = `
    <div class="page-head"><h1>Regalo de cumpleaños</h1></div>
    <p class="muted" style="max-width:640px">El día de su cumpleaños, quien tiene tu negocio en favoritos recibe una notificación y un código de regalo que validas como cualquier otro.</p>
    ${edita ? '' : '<div class="help" style="max-width:820px">Solo el propietario o un encargado pueden cambiarlo.</div>'}
    <form id="f" class="form" novalidate>
      <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="activo" ${d.enabled ? 'checked' : ''} ${ro}><span>Dar un regalo de cumpleaños</span></label>
      <label class="f full"><span>Qué regalas</span>
        <input name="regalo" maxlength="80" placeholder="Ej.: Un postre gratis" value="${esc(d.pending_gift || d.gift || '')}" autocomplete="off" ${ro}></label>
      <div class="full" id="regaloRevision">${revisionRegalo(d.pending_gift, d.gift)}</div>
      <label class="f"><span>Cuántos días vale</span><select name="dias" ${ro}>
        ${dias.map((x) => `<option value="${x}" ${Number(d.valid_days) === x ? 'selected' : ''}>${esc(bi(x === 1 ? '1 día' : `${x} días`, x === 1 ? '1 day' : `${x} days`))}</option>`).join('')}</select></label>
      <p class="hint full">Uno al año por persona. Llega a partir de las 9:00 del día de su cumpleaños, en la hora de tu negocio.</p>
      <p class="hint full" id="alcohol" ${d.adults_only ? '' : 'hidden'}>Menciona alcohol: solo lo recibirán mayores de edad.</p>
      ${edita ? '<div class="full"><button class="btn primary" type="submit">Guardar</button></div>' : ''}
      <p class="err full" id="regaloErr" role="alert"></p>
    </form>
    <div class="card">
      <p style="margin:0">${esc(bi(`Este año: ${n === 1 ? '1 regalo' : `${fmtNum(n)} regalos`} · ${m === 1 ? '1 canjeado' : `${fmtNum(m)} canjeados`}`,
        `This year: ${n === 1 ? '1 gift' : `${fmtNum(n)} gifts`} · ${fmtNum(m)} redeemed`))}</p>
      <p class="muted" style="margin:6px 0 0">${esc(bi(alcance === 1 ? 'Puede llegar a 1 persona a lo largo del año.' : `Puede llegar a ${fmtNum(alcance)} personas a lo largo del año.`,
        alcance === 1 ? 'It can reach 1 person over the year.' : `It can reach ${fmtNum(alcance)} people over the year.`))}</p>
    </div>`;
  if (!edita) return;
  const f = $('#f', v);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#regaloErr', v);
    err.textContent = '';
    const activo = f.elements.activo.checked;
    const regalo = f.elements.regalo.value.replace(/\s+/g, ' ').trim();
    // Las mismas reglas que la base: encendido o con texto, de 3 a 80.
    if ((activo || regalo) && (regalo.length < 3 || regalo.length > 80)) { err.textContent = I18N.t(ERR_REGALO.gift_length); return; }
    const r = await rpc('save_birthday_gift', {
      p_business: BIZ.id, p_enabled: activo, p_gift: regalo || null, p_valid_days: Number(f.elements.dias.value),
    }).catch((x) => ({ ok: false, error: x.message }));
    if (!r?.ok) { err.textContent = I18N.t(ERR_REGALO[r?.error] || friendly(r?.error)); return; }
    $('#alcohol', v).hidden = !r.adults_only;
    // Con lenguaje ofensivo espera revisión y sigue el anterior.
    if (r.status === 'review') {
      $('#regaloRevision', v).innerHTML = revisionRegalo(regalo, d.gift);
      toast(EN_REVISION_USO);
    } else {
      d.gift = regalo || null;
      $('#regaloRevision', v).innerHTML = '';
      toast('Guardado');
    }
  };
};

// ── Informe ─────────────────────────────────────────────────────────────────
// Todo junto y exportable: es lo que el negocio le pasa a su gestor y lo que
// mira cuando quiere saber si esto le sirve para algo. Un empleado solo ve
// las cifras: ni la lista de canjes (código y quién validó) ni los CSV; la
// base tampoco se los manda (`aggregate_only`, migración 20261113100000).
PAGES.informe = async (v, param) => {
  const days = Number(param) || 30;
  const [r, aud] = await Promise.all([
    rpc('business_report', { p_id: BIZ.id, p_days: days }).then((x) => x || {}),
    rpc('business_audience', { p_id: BIZ.id, p_days: days }).catch(() => null),
  ]);
  const t = r.totals || {};
  const pct = (a, b) => (!b ? '—' : Math.round((a * 100) / b) + ' %');
  const hours = r.by_hour || [];
  const best = hours.slice().sort((a, b) => b.redeemed - a.redeemed)[0];
  const maxDay = Math.max(1, ...(r.daily || []).map((d) => Math.max(d.views, d.codes)));

  // «Cuánto te ha traído Klendar»: al menos tantos euros en tantas visitas.
  const visitas = (n) => bi(n === 1 ? '1 visita' : `${fmtNum(n)} visitas`, n === 1 ? '1 visit' : `${fmtNum(n)} visits`);
  const conTicket = t.brought_with_ticket > 0
    ? ` (${bi(`${fmtNum(t.brought_with_ticket)} con ticket real`, `${fmtNum(t.brought_with_ticket)} with a real receipt`)})` : '';
  const cifraTrajo = eurosEnteros(t.brought_cents, t.currency);
  // Bonos vendidos en el local: ya suman en `brought_cents`, una vez, con su
  // precio (los usos no suman).
  const pases = t.passes || {};
  const pasesTxt = pases.sold > 0 ? bi(pases.sold === 1 ? '1 bono vendido' : `${fmtNum(pases.sold)} bonos vendidos`, pases.sold === 1 ? '1 pass sold' : `${fmtNum(pases.sold)} passes sold`) : '';
  const pasesFrase = pases.sold > 0 ? bi(` Incluye ${pasesTxt} en tu local (${eurosEnteros(pases.sold_cents, t.currency)}).`, ` Includes ${pasesTxt} at your venue (${eurosEnteros(pases.sold_cents, t.currency)}).`) : '';
  const grande = (t.brought_visits > 0 && t.brought_priced > 0) || pases.sold > 0;
  const fraseTrajo = !t.brought_visits ? (pases.sold > 0 ? bi(`Has vendido ${pasesTxt} por ${eurosEnteros(pases.sold_cents, t.currency)} en tu local.`, `You've sold ${pasesTxt} for ${eurosEnteros(pases.sold_cents, t.currency)} at your venue.`)
    : bi('Cuando valides códigos, aquí verás lo que te traen tus ofertas.', 'When you validate codes, you’ll see here what your offers bring in.'))
    : !t.brought_priced ? bi(`Tus ofertas trajeron ${visitas(t.brought_visits)}. Ninguna tenía precio, así que no sumamos euros.`, `Your offers brought in ${visitas(t.brought_visits)}. None had a price, so we don’t add up euros.`)
      : bi(`Tus ofertas trajeron al menos ${cifraTrajo}${conTicket} en ${visitas(t.brought_visits)}.`, `Your offers brought in at least ${cifraTrajo}${conTicket} from ${visitas(t.brought_visits)}.`);
  const fraseTrajoTodo = t.brought_visits ? fraseTrajo + pasesFrase : fraseTrajo;
  const comoTrajo = helpBox(I18N.t('¿Cómo se calcula?'), bi(
    '<p>Por cada código validado sumamos el precio de la oferta por persona (el que tenía cuando la persona consiguió el código) por las plazas.</p><p>Si alguien del equipo apunta el importe del ticket al validar, o después en «Últimos validados», usamos ese importe en lugar de la estimación.</p><p>Las ofertas sin precio (gratis o solo un descuento) cuentan como visitas, pero no suman euros. Cada código validado es una visita, aunque entren varias personas con él.</p><p>Por eso es un mínimo: lo que la gente gasta además, o en otras visitas, no lo vemos.</p><p>Los bonos que vendes en tu local suman una vez, al venderlos, con el precio que has puesto; cada uso no suma.</p>',
    '<p>For each validated code we add the offer’s price per person (the one it had when the person got the code) times the number of places.</p><p>If someone on the team enters the receipt total when validating, or later in “Recently validated”, we use that amount instead of the estimate.</p><p>Offers without a price (free or just a discount) count as visits but don’t add euros. Each validated code is one visit, even if several people come in with it.</p><p>That’s why it’s a minimum: we can’t see what people spend on top of that, or on other visits.</p><p>Passes you sell at your venue count once, when you sell them, at the price you set; uses don’t add anything.</p>'));

  v.innerHTML = `
    <div class="page-head"><h1>Informe</h1><span class="spacer"></span>
      ${[7, 30, 90, 365].map((d) => `<a class="btn sm ${d === days ? '' : 'ghost'}" href="#/informe/${d}">${d === 365 ? bi('1 año', '1 year') : bi(`${d} días`, `${d} days`)}</a>`).join(' ')}
    </div>
    <div class="card trajo"><h2>Cuánto te ha traído Klendar</h2>
      ${grande ? `<p class="trajo-min">${esc(bi('Al menos', 'At least'))}</p><p class="trajo-cifra">${esc(cifraTrajo)}</p>` : ''}
      <p class="${grande ? 'muted' : ''}" style="margin:4px 0 10px">${esc(fraseTrajoTodo)}</p>
      ${comoTrajo}
    </div>

    <div class="card"><h2>El periodo en cuatro cifras</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(t.views)}</b><span>Vistas</span></div>
        <div class="kpi"><b>${fmtNum(t.codes)}</b><span>Códigos generados</span></div>
        <div class="kpi"><b>${fmtNum(t.redeemed)}</b><span>Canjes validados</span></div>
        <div class="kpi"><b>${pct(t.redeemed, t.codes)}</b><span>De código a canje</span></div>
      </div>
      <p class="muted" style="margin:10px 0 0">${bi(`<b>${fmtNum(t.unused)}</b> ${t.unused === 1 ? 'código se quedó' : 'códigos se quedaron'} sin usar.${best ? ` La hora a la que más se canjea es a las <b>${String(best.hour).padStart(2, '0')}:00</b>.` : ''}`, `<b>${fmtNum(t.unused)}</b> ${t.unused === 1 ? 'code was' : 'codes were'} never used.${best ? ` The busiest redemption hour is <b>${String(best.hour).padStart(2, '0')}:00</b>.` : ''}`)}</p>
      ${t.offline > 0 ? `<p class="muted" style="margin:4px 0 0">${esc(bi(`${fmtNum(t.offline)} ${t.offline === 1 ? 'validado' : 'validados'} sin conexión (a la hora en que se escanearon).`,
        `${fmtNum(t.offline)} validated offline (at the time they were scanned).`))}</p>` : ''}
    </div>

    <div class="card"><h2>Día a día</h2>
      <div class="spark">${(r.daily || []).map((d) => `<i title="${d.day}: ${d.views} ${bi('vistas', 'views')}, ${d.redeemed} ${bi('canjes', 'redemptions')}" style="height:${Math.round((d.views / maxDay) * 100)}%"><u style="height:${d.views ? Math.round((d.redeemed / Math.max(d.views, 1)) * 100) : 0}%"></u></i>`).join('')}</div>
      <p class="muted" style="margin:8px 0 0">Cada barra es un día: la altura son las vistas y la parte rellena, los canjes.</p>
    </div>

    ${audienciaHtml(aud)}

    ${pases.sold || pases.uses || pases.active ? `<div class="card"><h2>Bonos</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(pases.sold)}</b><span>Bonos vendidos</span></div>
        <div class="kpi"><b>${fmtNum(pases.uses)}</b><span>Usos</span></div>
        <div class="kpi"><b>${fmtNum(pases.active)}</b><span>Bonos activos</span></div>
      </div></div>` : ''}

    ${await informeSeriesHtml()}

    <div class="card"><h2>Por publicación</h2>${gestiona() ? '<div class="actions" style="margin-bottom:10px"><button class="btn sm" id="csvOffers">Descargar CSV</button></div>' : ''}
      ${table({
        cols: [
          { h: 'Publicación', r: (o) => `<b class="title">${esc(o.title)}</b><span class="sub">${esc(LABELS[o.kind] || o.kind)} · ${fmtDate(o.starts_at)}${o.status === 'archived' ? ` ${tag('archived')}` : ''}</span>` },
          { h: 'Precio', num: true, r: (o) => fmtMoney(o.price_cents, o.currency) },
          { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
          { h: 'Códigos', num: true, r: (o) => fmtNum(o.codes) },
          { h: 'Canjes', num: true, r: (o) => fmtNum(o.redeemed) },
          { h: 'Ha traído', num: true, r: (o) => (o.brought_cents ? esc(eurosEnteros(o.brought_cents, o.currency)) : '—') },
          { h: 'Plazas libres', num: true, r: (o) => (o.max_redemptions == null ? '—' : `${o.seats_left}/${o.max_redemptions}`) },
        ],
        rows: r.offers || [],
        empty: 'No hay publicaciones en este periodo.',
      })}
    </div>

    ${!gestiona() ? `<div class="card"><h2>Canjes validados</h2><p class="muted" style="margin:0">${esc(bi(
      'Ves las cifras del negocio. La lista de canjes, con quién validó cada uno, y la descarga en CSV son solo para el propietario y los encargados.',
      'You can see the business’s figures. The list of redemptions, with who validated each one, and the CSV download are only for the owner and managers.'))}</p></div>` : `
    <div class="card"><h2>Canjes validados</h2><div class="actions" style="margin-bottom:10px"><button class="btn sm" id="csvRed">Descargar CSV</button></div>
      <p class="muted" style="margin:0 0 10px">Cada línea es un código validado en el local, con quién lo validó. Sirve de justificante.</p>
      ${table({
        cols: [
          { h: 'Cuándo', r: (x) => fmtDate(x.at) },
          { h: 'Qué', r: (x) => `<b class="title">${esc(x.title)}</b><span class="sub">${esc(queValidado(x))}${etiquetaSinConexion(x)}</span>` },
          { h: 'Código', r: (x) => `<code>${esc(x.code)}</code>` },
        { h: 'Plazas', num: true, r: (x) => fmtNum(x.seats || 1) },
          // Lo que se pagó por plaza: el precio de cuando se consiguió el
          // código si luego subió.
          { h: 'Precio', num: true, r: (x) => (x.paid_cents == null ? '—' : fmtMoney(x.paid_cents, x.currency)) },
          // El importe del ticket, si alguien del equipo lo apuntó.
          { h: 'Ticket', num: true, r: (x) => (x.ticket_cents == null ? '—' : fmtMoney(x.ticket_cents, x.currency)) },
          { h: 'Validado por', r: (x) => esc(x.by) },
        ],
        rows: r.redemptions || [],
        empty: 'Todavía no se ha validado ningún código en este periodo.',
      })}
    </div>`}`;

  if (!gestiona()) return;
  $('#csvOffers').onclick = () => downloadCsv(`informe-${BIZ.name}`, r.offers || [], [
    ['title', 'Publicación'], ['kind', 'Tipo'], ['starts_at', 'Fecha'],
    [(o) => (o.price_cents == null ? '' : (o.price_cents / 100).toFixed(2)), 'Precio'],
    ['views', 'Vistas'], ['codes', 'Códigos'], ['redeemed', 'Canjes'],
    [(o) => ((o.brought_cents || 0) / 100).toFixed(2), 'Ha traído al menos (€)'],
    ['max_redemptions', 'Aforo'], ['seats_left', 'Plazas libres'],
  ]);
  $('#csvRed').onclick = () => downloadCsv(`canjes-${BIZ.name}`, r.redemptions || [], [
    ['at', 'Fecha y hora'], [(x) => queValidado(x), 'Tipo'], ['title', 'Qué'], ['code', 'Código'], [(x) => x.seats ?? 1, 'Plazas'],
    [(x) => (x.paid_cents == null ? '' : (x.paid_cents / 100).toFixed(2)), 'Precio'],
    [(x) => (x.ticket_cents == null ? '' : (x.ticket_cents / 100).toFixed(2)), 'Ticket'], ['by', 'Validado por'],
    [(x) => (x.offline ? bi('sí', 'yes') : ''), 'Sin conexión'],
  ]);
};

// ── Reseñas ─────────────────────────────────────────────────────────────────
// Las reseñas del negocio, para contestarlas. Lo mismo que «Reseñas» en la
// app: la respuesta se ve debajo, para todo el mundo, y a quien escribió le
// llega una notificación la primera vez.
const estrellas = (n) => `<span class="stars" aria-label="${n}/5">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>`;
PAGES.resenas = async (v) => {
  const lista = await rpc('business_reviews', { p_id: BIZ.id, p_limit: 50 });
  const media = lista.length ? lista.reduce((s, r) => s + r.rating, 0) / lista.length : 0;
  const sin = lista.filter((r) => !r.reply).length;
  const media1 = media.toFixed(1).replace('.', I18N.lang === 'en' ? '.' : ',');
  v.innerHTML = `
    <div class="page-head"><h1>Reseñas</h1><span class="spacer"></span>
      <a class="btn sm ghost" href="${APP_URL}/b/${esc(BIZ.id)}#resenas" target="_blank" rel="noopener">Ver en tu ficha ↗</a></div>
    ${helpBox('¿Para qué contestar?', '<p>Una reseña mala contestada con educación pesa mucho menos que una sin contestar, y una buena con un «gracias» anima a volver. La respuesta se ve debajo de la reseña, en la app y en la web, y a quien la escribió le llega una notificación.</p><p>Puedes cambiarla cuando quieras. Si la dejas vacía, se borra.</p>')}
    ${lista.length ? `<div class="card resumen-resenas">${estrellas(Math.round(media))}
      <b>${esc(I18N.lang === 'en' ? `${media1} average · ${lista.length} review${lista.length === 1 ? '' : 's'}` : `${media1} de media · ${lista.length} reseña${lista.length === 1 ? '' : 's'}`)}</b>
      <span class="spacer"></span>${sin ? `<span class="tag st-pending">${esc(I18N.lang === 'en' ? `${sin} unanswered` : `${sin} sin responder`)}</span>` : ''}</div>` : ''}
    ${lista.length ? `<div class="resenas-panel">${lista.map((r, i) => `<article class="card">
        <header><span class="av">${r.avatar_url ? `<img src="${esc(r.avatar_url)}" alt="">` : esc((r.display_name || 'U').trim().charAt(0).toUpperCase())}</span>
          <span><b>${esc(r.display_name || 'Usuario de Klendar')}</b><small class="muted">${esc(fmtDate(r.created_at))}</small></span>${estrellas(r.rating)}</header>
        ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
        ${r.photo_url ? `<img class="foto" src="${esc(r.photo_url)}" alt="" loading="lazy">` : ''}
        ${r.reply ? `<div class="respuesta"><b>Respuesta de <span>${esc(BIZ.name)}</span></b>${r.reply_at ? `<small class="muted"> · ${esc(fmtDate(r.reply_at))}</small>` : ''}<p>${esc(r.reply).replace(/\n/g, '<br>')}</p></div>` : ''}
        ${r.reply_pending ? `<div class="respuesta"><b>Tu respuesta, en revisión</b> <span class="tag st-pending">En revisión</span><p>${esc(r.reply_pending).replace(/\n/g, '<br>')}</p></div>` : ''}
        ${gestiona() ? `<div class="pie"><button class="btn sm" data-resp="${i}">${ms(r.reply ? 'edit' : 'reply')}${r.reply ? 'Editar respuesta' : 'Responder'}</button></div>` : ''}
      </article>`).join('')}</div>`
    : '<div class="card"><p class="muted" style="margin:0">Todavía no tienes reseñas. Llegan cuando la gente canjea y vuelve a contarlo.</p></div>'}`;

  $$('[data-resp]', v).forEach((b) => { b.onclick = async () => {
    const r = lista[+b.dataset.resp];
    const out = await modal({
      title: 'Responder a la reseña',
      intro: esc(I18N.t('Se ve debajo de la reseña, para todo el mundo. A quien la escribió le llega una notificación.')),
      fields: [{ name: 'reply', label: 'Tu respuesta', type: 'textarea', value: r.reply || '', maxlength: 500, rows: 6,
        placeholder: 'Gracias por venir. Nos alegra que…' }],
      submit: 'Publicar',
    });
    if (!out) return;
    const texto = out.reply.trim();
    if (texto === (r.reply || '')) return;
    if (!texto && !(await confirmDlg('Borrar la respuesta', '', { submit: 'Borrar', danger: true }))) return;
    if (texto && texto.length < 2) { toast('Escribe al menos 2 caracteres.', true); return; }
    const res = await rpc('reply_to_review', { p_review: r.id, p_reply: texto }).catch((e) => ({ ok: false, error: e.message }));
    if (!res?.ok) {
      toast(res?.error === 'invalid_reply' ? 'Escribe al menos 2 caracteres.'
        : res?.error === 'not_authorized' ? ERRORS.not_authorized : 'No se ha podido guardar', true);
      return;
    }
    toast(res.status === 'review' ? 'Lo revisamos antes de publicarlo porque puede contener lenguaje ofensivo. Normalmente en menos de 24 h.'
      : texto ? 'Respuesta publicada' : 'Respuesta borrada');
    route();
  }; });
};

// ── Días cerrados ───────────────────────────────────────────────────────────
// Vacaciones, festivos, obras. Mientras dura uno no se ve nada del negocio
// (como «Cerrado por hoy» en la app) y la ficha dice hasta cuándo.
const diaLargo = (iso) => new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
// «Del 12 al 13 de octubre» si es el mismo mes; si no, cada día con su mes.
const diaSolo = (iso) => String(Number(iso.slice(8, 10)));
const rangoDias = (a, b) => (a.slice(0, 7) === b.slice(0, 7) ? [diaSolo(a), diaLargo(b)] : [diaLargo(a), diaLargo(b)]);
const hoyNegocio = () => KZ.hoy(TZ);
const ERR_CIERRE = {
  too_long: 'Como mucho tres meses seguidos.',
  too_many: 'Ya tienes 12 cierres por delante. Quita alguno antes.',
  in_the_past: 'Esas fechas ya han pasado.',
  invalid_range: 'El último día no puede ser antes que el primero.',
  not_authorized: ERRORS.not_authorized,
};
PAGES.cerrados = async (v) => {
  const lista = await rpc('business_closures', { p_business: BIZ.id });
  const hoy = hoyNegocio();
  // Como el selector de la app: hasta un año por delante.
  const maxDia = new Date(Date.parse(`${hoy}T00:00:00Z`) + 366 * 864e5).toISOString().slice(0, 10);
  const tramo = (c) => (c.starts_on === c.ends_on
    ? (I18N.lang === 'en' ? `On ${diaLargo(c.starts_on)}` : `El ${diaLargo(c.starts_on)}`)
    : (([a, b]) => (I18N.lang === 'en' ? `From ${a} to ${b}` : `Del ${a} al ${b}`))(rangoDias(c.starts_on, c.ends_on)));
  v.innerHTML = `
    <div class="page-head"><h1>Días cerrados</h1></div>
    ${helpBox('¿Cómo funciona?', '<p>Vacaciones, festivos, obras. Esos días no se ve nada de tu negocio, como con «Cerrado por hoy», y tu ficha dice hasta cuándo cierras. Al acabar, todo vuelve a verse solo.</p><p>Como mucho tres meses seguidos y doce cierres por delante.</p>')}
    <div class="card"><h2>Por delante</h2>${table({
      cols: [
        { h: 'Días', r: (c) => `<b class="title">${esc(tramo(c))}</b>${c.starts_on <= hoy && hoy <= c.ends_on ? ` ${tag('Ahora', 'st-pending')}` : ''}` },
        { h: 'Motivo', r: (c) => esc(c.reason || '—') },
        ...(gestiona() ? [{ h: '', r: (c, i) => `<span class="actions"><button class="btn sm ghost" data-del="${i}">${ms('delete')}Quitar</button></span>` }] : []),
      ],
      rows: lista,
      empty: 'No tienes días cerrados por delante.',
    })}</div>
    ${gestiona() ? `<div class="card"><h2>Añadir días cerrados</h2>
      <form id="f" class="form">
        <label class="f"><span>Primer día</span><input type="date" name="from" required min="${hoy}" max="${maxDia}"></label>
        <label class="f"><span>Último día</span><input type="date" name="to" required min="${hoy}" max="${maxDia}"></label>
        <label class="f full"><span>Motivo <small>(opcional)</small></span><input name="reason" maxlength="60" placeholder="Vacaciones"></label>
        <div class="full"><button class="btn primary" type="submit">Añadir días cerrados</button> <span id="msg" class="err"></span></div>
      </form></div>` : ''}`;

  $$('[data-del]', v).forEach((b) => { b.onclick = async () => {
    const c = lista[+b.dataset.del];
    if (!(await confirmDlg('¿Quitar estos días cerrados?', I18N.t('Tus publicaciones vuelven a verse esos días.'), { submit: 'Quitar', danger: true }))) return;
    const r = await rpc('delete_business_closure', { p_id: c.id }).catch(() => null);
    if (!r?.ok) { toast(ERR_CIERRE[r?.error] || 'No se ha podido guardar', true); return; }
    toast('Días cerrados quitados'); route();
  }; });
  const f = $('#f', v);
  if (!f) return;
  // El último día, por defecto el primero (un festivo suelto).
  $('[name=from]', f).onchange = (e) => {
    const to = $('[name=to]', f);
    to.min = e.target.value || hoy;
    if (!to.value || to.value < e.target.value) to.value = e.target.value;
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const reason = String(d.reason || '').trim();
    const msg = $('#msg', f);
    msg.textContent = '';
    if (reason.length === 1) { msg.textContent = I18N.t('Escribe al menos 2 caracteres.'); return; }
    const dias = (new Date(d.to) - new Date(d.from)) / 864e5;
    if (dias < 0) { msg.textContent = I18N.t(ERR_CIERRE.invalid_range); return; }
    if (dias > 92) { msg.textContent = I18N.t(ERR_CIERRE.too_long); return; }
    if (d.from < hoy || d.to > maxDia) { msg.textContent = I18N.t('Elige días entre hoy y dentro de un año.'); return; }
    const r = await rpc('save_business_closure', { p_business: BIZ.id, p_starts: d.from, p_ends: d.to, p_reason: reason }).catch(() => null);
    if (!r?.ok) { msg.textContent = I18N.t(ERR_CIERRE[r?.error] || 'No se ha podido guardar'); return; }
    toast('Días cerrados guardados'); route();
  };
};

// ── Ayuda ───────────────────────────────────────────────────────────────────
PAGES.ayuda = async (v) => {
  v.innerHTML = `
    <div class="page-head"><h1>Ayuda</h1></div>
    <div class="card"><h2>Qué puedes hacer aquí</h2>
      <p>Este panel hace lo mismo que la app, desde el ordenador o desde el navegador del móvil: dar de alta el negocio, publicar ofertas y eventos, ver cómo van, validar códigos en la puerta y llevar el equipo.</p>
      <p class="muted">Para validar, escanea el QR con la cámara (la del móvil o la del portátil) o escribe el código que la persona tiene debajo del QR.</p></div>
    <div class="grid2">
      <div class="card"><h3>Una oferta que funciona</h3><ul style="margin:0;padding-left:18px">
        <li>Título corto y concreto, con el precio dentro.</li>
        <li>Ventana realista: lo que de verdad puedes servir.</li>
        <li>Aforo si hay stock limitado; así nadie se lleva un chasco.</li>
        <li>Foto propia, luz natural, sin texto encima.</li></ul></div>
      <div class="card"><h3>Un evento que se llena</h3><ul style="margin:0;padding-left:18px">
        <li>Publícalo con días de antelación: la gente lo guarda en su agenda.</li>
        <li>Activa la reserva de plaza si quieres saber cuánta gente viene.</li>
        <li>Pon el código «sin caducidad» para que valga como entrada.</li>
        <li>El día del evento, usa «Asistentes» para dar entrada.</li></ul></div>
    </div>
    <div class="card"><h2>Preguntas frecuentes</h2>
      <p class="muted">Lo que más nos preguntan los negocios (y la gente), con buscador. Lo mismo que en la app, en «Mi negocio» → Ayuda.</p>
      <p style="margin:8px 0 0"><a class="btn sm" href="${I18N.lang === 'en' ? '/en/faq/' : '/preguntas/'}#negocios">${ms('help')}${esc(I18N.t('Ver las preguntas frecuentes'))}</a></p></div>
    <div class="card"><h2>¿Algo no cuadra?</h2><p class="muted" style="margin:0">Escríbenos a <a class="link" href="mailto:info@klendar.app">info@klendar.app</a> y lo miramos.</p></div>`;
};

// ── Dar de baja el negocio ──────────────────────────────────────────────────
// Solo el propietario, de menos a más: descargar los datos, cerrar hasta
// nuevo aviso, cancelar la suscripción, traspasarlo y eliminarlo. La base lo
// vuelve a comprobar todo (migración 20261025100000). Lo mismo que «Dar de
// baja el negocio» en la app.

/** Cerrado hasta nuevo aviso: la base guarda esa pausa sin fin como
 * `paused_until` = 9999-12-31 (así lo esconde todo lo que ya escondía
 * «Cerrado por hoy»). */
const cerradoIndef = () => !!BIZ?.paused_until && new Date(BIZ.paused_until).getUTCFullYear() >= 9000;
const esPropietario = () => BIZ?.role === 'owner';
const diaLargoFecha = (iso) => (iso ? new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)) : '');

const ERR_BAJA = {
  already_cancelled: 'Ya estaba cancelada.',
  not_member: 'Esa persona ya no está en tu equipo.',
  self: 'Elige a otra persona del equipo.',
  not_found: 'Ya no está: puede que haya caducado.',
  expired: 'Ya no está: puede que haya caducado.',
  owner: 'El propietario no sale del equipo: traspasa el negocio o dalo de baja.',
  not_owner: 'Solo el propietario puede dar de baja el negocio.',
  reauth_required: 'Por seguridad, vuelve a confirmar que eres tú.',
  adult_required: 'Para ser propietario de un negocio hace falta tener 18 años y la fecha de nacimiento en el perfil. Esa persona aún no lo cumple.',
};
const errBaja = (codigo) => I18N.t(ERR_BAJA[codigo] || friendly(codigo));
/** Llama y, si la base dice `{ ok: false, error }` (o lanza un código que
 * conocemos), lo convierte en un error con su frase. */
async function rpcOk(fn, args) {
  let r;
  try {
    r = await rpc(fn, args);
  } catch (e) {
    const clave = String(e?.clave || '');
    const k = Object.keys(ERR_BAJA).sort((x, y) => y.length - x.length).find((x) => clave.includes(x));
    throw k ? new Error(errBaja(k)) : e;
  }
  if (r && r.ok === false) throw new Error(errBaja(r.error));
  return r;
}

/** «Confirma que eres tú» (contraseña o código de 6 cifras al correo) antes
 * de traspasar o eliminar el negocio, como en la app y «Tu cuenta». La lógica
 * está en /assets/identidad.js. Devuelve true si queda confirmado. */
async function confirmaIdentidad() {
  let id = null;
  try { id = await window.KL_IDENTIDAD?.(sb); } catch { id = null; }
  if (!id) { toast('No se ha podido. Vuelve a probar.', true); return false; }
  let tieneClave = true;
  try {
    const m = await rpc('my_auth_methods');
    if (typeof m?.has_password === 'boolean') tieneClave = m.has_password;
  } catch { tieneClave = (ME?.identities || []).some((i) => i.provider === 'email'); }
  const lang = I18N.lang === 'en' ? 'en' : 'es';
  return new Promise((resolve) => {
    const d = $('#modal');
    let conCodigo = !tieneClave;
    let enviado = false;
    let terminado = false;
    const acaba = async (ok) => {
      if (terminado) return;
      terminado = true;
      d.close();
      await id.cerrar();
      resolve(ok);
    };
    const correo = esc(id.email);
    const pinta = () => {
      d.innerHTML = `<form method="dialog" novalidate><h2>Confirma que eres tú</h2>
        ${!conCodigo ? `<p class="muted" style="margin:0">Por seguridad, escribe tu contraseña actual.</p>
          <label class="f"><span>Contraseña actual</span><input name="clave" type="password" autocomplete="current-password"></label>`
        : !enviado ? `<p class="muted" style="margin:0">${bi(`Te mandaremos un código de 6 cifras a <b>${correo}</b>.`, `We'll email a 6-digit code to <b>${correo}</b>.`)}</p>`
        : `<p class="muted" style="margin:0">${bi(`Escribe el código de 6 cifras que te hemos mandado a <b>${correo}</b>.`, `Enter the 6-digit code we've sent to <b>${correo}</b>.`)}</p>
          <label class="f"><span>Código</span><input name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label>`}
        <p class="err" role="alert" style="margin:0"></p>
        <p style="margin:0">${!conCodigo ? '<button type="button" class="btn sm ghost" data-modo="codigo">Prefiero un código por correo</button>' : ''}
          ${conCodigo && enviado ? '<button type="button" class="btn sm ghost" data-reenvio>Enviar otro código</button>' : ''}
          ${conCodigo && tieneClave ? '<button type="button" class="btn sm ghost" data-modo="clave">Usar mi contraseña</button>' : ''}</p>
        <div class="foot"><button type="button" class="btn ghost" data-cancel>Cancelar</button>
          <button type="submit" class="btn primary">${conCodigo && !enviado ? 'Enviarme el código' : 'Seguir'}</button></div></form>`;
      I18N.translate(d);
      const form = $('form', d);
      const err = $('.err', d);
      const falla = (e, clave) => {
        const mala = clave && (e?.code === 'invalid_credentials' || /invalid login credentials/i.test(e?.message || ''));
        err.textContent = mala ? I18N.t('La contraseña no es correcta.') : window.KL_AUTH_ERROR(e, lang);
      };
      $('[data-cancel]', d).onclick = () => acaba(false);
      $$('[data-modo]', d).forEach((b) => { b.onclick = () => { conCodigo = b.dataset.modo === 'codigo'; pinta(); }; });
      const reenvio = $('[data-reenvio]', d);
      if (reenvio) {
        reenvio.onclick = async () => {
          reenvio.disabled = true;
          try { await id.mandarCodigo(); toast('Te hemos mandado otro código.'); } catch (e) { falla(e); }
          setTimeout(() => { reenvio.disabled = false; }, 60000);
        };
      }
      form.onsubmit = async (e) => {
        e.preventDefault();
        err.textContent = '';
        const boton = $('button[type=submit]', form);
        boton.disabled = true;
        try {
          if (!conCodigo) {
            const clave = form.elements.clave.value;
            if (!clave) { err.textContent = I18N.t('Obligatorio'); return; }
            try { await id.conClave(clave); } catch (x) { falla(x, true); return; }
            await acaba(true);
          } else if (!enviado) {
            try { await id.mandarCodigo(); } catch (x) { falla(x); return; }
            enviado = true;
            pinta();
          } else {
            const codigo = form.elements.codigo.value.replace(/\D/g, '');
            if (!/^\d{6}$/.test(codigo)) { err.textContent = I18N.t('Son 6 cifras.'); return; }
            try { await id.conCodigo(codigo); } catch (x) { falla(x); return; }
            await acaba(true);
          }
        } finally { boton.disabled = false; }
      };
      ($('input', form) || $('button[type=submit]', form))?.focus();
    };
    d.oncancel = (e) => { e.preventDefault(); acaba(false); };
    pinta();
    d.showModal();
  });
}

/** Descargar los datos del negocio: todo en JSON, o las publicaciones con
 * sus cifras en CSV (para una hoja de cálculo). Sin datos de los clientes. */
async function descargaDatos(formato) {
  const datos = await rpc('business_export', { p_business: BIZ.id });
  const nombre = (BIZ.name || 'klendar').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'klendar';
  if (formato === 'json') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
    a.download = `klendar-${nombre}-${bi('datos', 'data')}-${KZ.hoy(TZ)}.json`;
    a.click();
    return;
  }
  const tipos = { flash_offer: I18N.t('Oferta flash'), future_event: I18N.t('Evento') };
  downloadCsv(`klendar-${nombre}-${bi('publicaciones', 'publications')}`, datos.publications || [], [
    ['title', I18N.t('Publicación')],
    [(p) => tipos[p.kind] || p.kind, I18N.t('Tipo')],
    [(p) => I18N.t(LABELS[p.status] || p.status), I18N.t('Estado')],
    [(p) => fmtDate(p.created_at), I18N.t('Creada')],
    [(p) => (p.starts_at ? fmtDate(p.starts_at) : ''), I18N.t('Inicio')],
    [(p) => (p.ends_at ? fmtDate(p.ends_at) : ''), I18N.t('Fin')],
    [(p) => (p.price_cents == null ? '' : (p.price_cents / 100).toFixed(2)), I18N.t('Precio (€)')],
    ['views', I18N.t('Vistas')],
    ['codes', I18N.t('Códigos')],
    ['redeemed', I18N.t('Canjes')],
    [(p) => p.max_redemptions ?? '', I18N.t('Aforo')],
    [(p) => ((p.brought_cents || 0) / 100).toFixed(2), I18N.t('Ha traído al menos (€)')],
    [(p) => p.tickets ?? '', I18N.t('Con ticket')],
    [(p) => (p.before_closing ? bi('sí', 'yes') : ''), I18N.t('Antes de cerrar')],
  ]);
}

/** La tarjeta de «Descargar los datos del negocio» (en la ficha, aquí y al
 * eliminar). Dos botones del mismo ancho. */
const tarjetaDescarga = () => `<div class="card"><h2>Descargar los datos del negocio</h2>
  <p class="muted" style="margin:0 0 10px">Tu ficha, las publicaciones con sus cifras, el informe por meses, las tarjetas de sellos (sin datos de los clientes), las reseñas y los pagos. En JSON va todo; en CSV, las publicaciones para abrirlas en una hoja de cálculo.</p>
  <div class="dos-botones"><button class="btn" type="button" data-descarga="json">JSON</button>
    <button class="btn" type="button" data-descarga="csv">CSV</button></div></div>`;
function activaDescarga(v) {
  $$('[data-descarga]', v).forEach((b) => {
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true;
      try { await descargaDatos(b.dataset.descarga); } catch (e) { toast(friendly(e.message), true); }
      b.disabled = false;
    };
  });
}

/** Al cambiar algo, `my_businesses` trae el estado nuevo (cerrado, rol…). */
async function recargaNegocios() {
  try {
    BIZZES = await rpc('my_businesses');
    BIZ = BIZZES.find((b) => b.id === BIZ.id) || BIZ;
  } catch { /* se queda como estaba */ }
}

PAGES.baja = async (v, param) => {
  if (!esPropietario()) {
    v.innerHTML = `<div class="page-head"><h1>Dar de baja el negocio</h1></div>
      <div class="card"><p style="margin:0">Solo el propietario puede dar de baja el negocio.</p></div>`;
    return;
  }
  if (param === 'eliminar') return eliminarNegocio(v);
  const s = await rpc('business_account_status', { p_business: BIZ.id });
  const sub = s.subscription || {};
  const can = s.cancellation;
  const tr = s.transfer;
  const estadoSub = can
    ? (can.effective_on ? bi(`Cancelada: todo sigue hasta el ${diaLargoFecha(can.effective_on)}.`, `Cancelled: everything carries on until ${diaLargoFecha(can.effective_on)}.`) : I18N.t('Cancelada: no se empezará a cobrar.'))
    : !sub.period_end ? I18N.t('Ahora no pagas nada.')
    : sub.status === 'trial' ? bi(`Prueba gratis hasta el ${diaLargoFecha(sub.period_end)}.`, `Free trial until ${diaLargoFecha(sub.period_end)}.`)
    : bi(`Pagada hasta el ${diaLargoFecha(sub.period_end)}.`, `Paid until ${diaLargoFecha(sub.period_end)}.`);
  v.innerHTML = `
    <div class="page-head"><h1>Dar de baja el negocio</h1><span class="spacer"></span><a class="btn sm ghost" href="#/ficha">← Tu ficha</a></div>
    <p class="muted" style="margin:0 0 14px">Lo que puedes hacer si dejas de usar Klendar, de menos a más. Solo lo ve el propietario.</p>
    ${tarjetaDescarga()}
    <div class="card"><h2>Cerrar hasta nuevo aviso</h2>
      <p class="muted" style="margin:0 0 10px">Nadie verá tu ficha ni tus publicaciones en Descubre, el mapa o la búsqueda; quien tenga el enlace verá «Cerrado temporalmente». Lo abres de nuevo cuando quieras. Cerrar no cancela la suscripción.</p>
      ${s.closed_since ? `<p style="margin:0 0 10px"><b>${esc(I18N.t('Cerrado hasta nuevo aviso'))}</b> · ${esc(bi(`Desde el ${diaLargoFecha(s.closed_since)}. No se ve nada de tu negocio.`, `Since ${diaLargoFecha(s.closed_since)}. Nothing from your business is showing.`))}</p>
        <button class="btn primary" type="button" data-accion="abrir">Abrir de nuevo</button>`
        : '<button class="btn" type="button" data-accion="cerrar">Cerrar hasta nuevo aviso</button>'}</div>
    <div class="card"><h2>Suscripción</h2>
      <p class="muted" style="margin:0 0 10px">El negocio sigue igual hasta el final de lo pagado; después no se renueva. Te mandamos un correo de confirmación.</p>
      <p style="margin:0 0 10px"><b>${esc(estadoSub)}</b></p>
      ${can ? '<button class="btn" type="button" data-accion="deshacer">Deshacer la cancelación</button>'
        : '<button class="btn" type="button" data-accion="cancelar">Cancelar la suscripción</button>'}</div>
    <div class="card"><h2>Traspasar el negocio</h2>
      <p class="muted" style="margin:0 0 10px">Pasa a ser de otra persona de tu equipo, que tiene que aceptarlo. Tú puedes quedarte como encargado o salir.</p>
      ${tr ? `<p style="margin:0 0 10px"><b>${esc(bi(`Esperando a que ${tr.to_name} lo acepte (caduca el ${diaLargoFecha(tr.expires_at)}).`, `Waiting for ${tr.to_name} to accept (expires on ${diaLargoFecha(tr.expires_at)}).`))}</b></p>
        <button class="btn" type="button" data-accion="no-traspaso">Cancelar el traspaso</button>`
        : '<button class="btn" type="button" data-accion="traspaso">Elegir a quién</button>'}</div>
    <div class="card"><h2>Eliminar el negocio</h2>
      <p class="muted" style="margin:0 0 10px">Para siempre: la ficha, las publicaciones, las tarjetas de sellos y el equipo. Avisamos a quien tenga algo pendiente.</p>
      <a class="btn bad" href="#/baja/eliminar">Eliminar el negocio</a></div>`;
  activaDescarga(v);
  const hecho = async (msg) => { toast(msg); await recargaNegocios(); route(); };
  const acciones = {
    async cerrar() {
      const vivas = s.live_reservations || 0;
      const texto = esc(bi(`${BIZ.name} dejará de verse en Klendar hasta que lo abras de nuevo.`, `${BIZ.name} will stop showing on Klendar until you reopen it.`))
        + (vivas ? `<br><br>${esc(bi(vivas === 1 ? 'Hay 1 reserva o código sin usar: sigue valiendo. Si no vas a atenderlo, cancela esa publicación.' : `Hay ${vivas} reservas o códigos sin usar: siguen valiendo. Si no vas a atenderlos, cancela esas publicaciones.`,
          vivas === 1 ? "There is 1 unused booking or code: it's still valid. If you won't honour it, cancel that publication." : `There are ${vivas} unused bookings or codes: they're still valid. If you won't honour them, cancel those publications.`))}` : '');
      if (!await confirmDlg(I18N.t('¿Cerrar hasta nuevo aviso?'), texto, { submit: I18N.t('Cerrar') })) return;
      await rpcOk('set_business_closed', { p_business: BIZ.id, p_closed: true });
      await hecho('Cerrado hasta nuevo aviso');
    },
    async abrir() {
      await rpcOk('set_business_closed', { p_business: BIZ.id, p_closed: false });
      await hecho('Abierto de nuevo');
    },
    async cancelar() {
      const fin = sub.period_end;
      const intro = esc(!fin ? I18N.t('Ahora no pagas nada, así que no cambia nada: solo que no empezaremos a cobrarte cuando acabe el periodo gratis. Puedes deshacerlo cuando quieras.')
        : sub.status === 'trial' ? bi(`La prueba gratis sigue hasta el ${diaLargoFecha(fin)}; después no pasará a ser de pago. Puedes deshacerlo antes.`, `The free trial carries on until ${diaLargoFecha(fin)}; afterwards it won't become a paid plan. You can undo it before then.`)
        : bi(`Todo sigue igual hasta el ${diaLargoFecha(fin)}; desde ese día no se renueva y no se te cobra nada más. Puedes deshacerlo antes.`, `Everything stays the same until ${diaLargoFecha(fin)}; from that day it won't renew and you won't be charged again. You can undo it before then.`));
      const r = await modal({
        title: I18N.t('¿Cancelar la suscripción?'), intro,
        fields: [{ name: 'reason', type: 'textarea', rows: 3, maxlength: 500, label: I18N.t('¿Nos cuentas por qué? (opcional)') }],
        submit: I18N.t('Cancelar la suscripción'), cancel: I18N.t('Mantenerla'),
      });
      if (r === null) return;
      await rpcOk('cancel_my_subscription', { p_business: BIZ.id, p_reason: r.reason || null });
      await hecho('Suscripción cancelada. Te hemos mandado un correo.');
    },
    async deshacer() {
      await rpcOk('undo_subscription_cancellation', { p_business: BIZ.id });
      await hecho('Cancelación deshecha');
    },
    async traspaso() {
      const team = (await rpc('business_team', { p_id: BIZ.id })).filter((m) => m.user_id !== ME.id);
      if (!team.length) { toast('Primero invita a esa persona a tu equipo, en Equipo.', true); return; }
      const nombre = (m) => m.display_name || m.email || '';
      const r = await modal({
        title: I18N.t('¿A quién se lo traspasas?'),
        intro: esc(I18N.t('Si lo acepta, el negocio pasa a ser suyo: lo gestiona todo, también la suscripción y los datos de facturación. Tendrá 14 días para aceptarlo; hasta entonces, todo sigue igual.')),
        fields: [
          { name: 'to', type: 'select', label: I18N.t('Persona del equipo'), options: team.map((m) => [m.user_id, `${nombre(m)} · ${I18N.t(LABELS[m.role] || m.role)}`]) },
          { name: 'stay', type: 'checkbox', label: I18N.t('Seguir en el equipo como encargado'), value: true },
        ],
        submit: I18N.t('Enviar el traspaso'),
      });
      if (r === null) return;
      // Ceder el negocio es como eliminarlo: la base pide identidad reciente.
      if (!await confirmaIdentidad()) return;
      await rpcOk('offer_business_transfer', { p_business: BIZ.id, p_to: r.to, p_stay: !!r.stay });
      const quien = nombre(team.find((m) => m.user_id === r.to) || {});
      await hecho(bi(`Traspaso enviado a ${quien}`, `Handover sent to ${quien}`));
    },
    async 'no-traspaso'() {
      await rpcOk('cancel_business_transfer', { p_business: BIZ.id });
      await hecho('Traspaso cancelado');
    },
  };
  $$('[data-accion]', v).forEach((b) => {
    b.onclick = async () => {
      if (b.disabled) return;
      b.disabled = true;
      try { await acciones[b.dataset.accion](); } catch (e) { toast(e.message, true); }
      b.disabled = false;
    };
  });
};

/** «Eliminar el negocio»: lo que se pierde, guardar los datos antes y el
 * botón, que pide «Confirma que eres tú». */
async function eliminarNegocio(v) {
  const s = await rpc('business_deletion_summary', { p_business: BIZ.id });
  const filas = [
    ['event', 'Reservas para eventos que aún no han pasado', s.reservations],
    ['qr_code_2', 'Códigos sin usar', s.codes],
    ['cake', 'Regalos de cumpleaños sin usar', s.birthday_gifts],
    ['loyalty', 'Clientes con sellos o un premio sin canjear', s.stamp_customers],
    ['redeem', 'Clientes con bonos sin gastar (tienes que cumplirlos)', s.pass_customers || 0],
    ['person', 'Personas que lo tienen en favoritos', s.favorites],
    ['reviews', 'Reseñas', s.reviews],
    ['bolt', 'Publicaciones', s.publications],
    ['group', 'Personas del equipo', s.team],
  ];
  v.innerHTML = `
    <div class="page-head"><h1>Eliminar el negocio</h1><span class="spacer"></span><a class="btn sm ghost" href="#/baja">← Dar de baja el negocio</a></div>
    <div class="card"><p style="margin:0 0 10px"><b>${esc(bi(`Esto es lo que se pierde al eliminar ${BIZ.name}. No se puede deshacer.`, `This is what's lost when you delete ${BIZ.name}. It can't be undone.`))}</b></p>
      ${table({ cols: [
        { h: 'Qué', r: (f) => `${ms(f[0])} ${esc(I18N.t(f[1]))}` },
        { h: 'Cuántos', num: true, r: (f) => fmtNum(f[2]) },
      ], rows: filas })}
      <p class="muted" style="margin:12px 0 0">Al eliminarlo anulamos las reservas y los códigos sin usar y avisamos a cada persona; también a quien tiene sellos, un premio o un regalo, y a tu equipo. Solo guardamos los datos de facturación el tiempo que obliga la ley.</p>
      ${s.paid_until ? `<p style="margin:10px 0 0"><b>${esc(bi(`Tienes pagado hasta el ${diaLargoFecha(s.paid_until)}. Si tienes dudas sobre lo pagado, escríbenos antes.`, `You've paid until ${diaLargoFecha(s.paid_until)}. If you have questions about what you've paid, write to us first.`))}</b></p>` : ''}
      <p class="muted" style="margin:10px 0 0">${bi('¿Solo quieres parar un tiempo? Mejor <a class="link" href="#/baja">cierra hasta nuevo aviso</a>.', 'Just want a break? <a class="link" href="#/baja">Close until further notice</a> instead.')}</p></div>
    ${tarjetaDescarga().replace('<h2>Descargar los datos del negocio</h2>', '<h2>Antes, guarda tus datos</h2>')}
    <div class="card"><label class="f" style="grid-template-columns:auto 1fr;align-items:center;margin:0 0 12px">
        <input type="checkbox" id="entiendo"><span>Entiendo que no se puede deshacer</span></label>
      <button class="btn bad" type="button" id="eliminar" disabled>Eliminar el negocio</button></div>`;
  activaDescarga(v);
  const boton = $('#eliminar', v);
  $('#entiendo', v).onchange = (e) => { boton.disabled = !e.target.checked; };
  boton.onclick = async () => {
    if (!await confirmDlg(bi(`¿Eliminar ${BIZ.name}?`, `Delete ${BIZ.name}?`),
      esc(I18N.t('Se borra para siempre y avisamos a las personas afectadas. Después te pediremos que confirmes que eres tú.')),
      { submit: I18N.t('Eliminar el negocio'), danger: true })) return;
    if (!await confirmaIdentidad()) return;
    boton.disabled = true;
    try {
      await rpcOk('delete_my_business', { p_business: BIZ.id });
    } catch (e) {
      toast(e.message, true);
      boton.disabled = false;
      return;
    }
    const nombre = BIZ.name;
    localStorage.removeItem('klendar.biz');
    BIZZES = await rpc('my_businesses').catch(() => []);
    BIZ = BIZZES[0] || null;
    toast(bi(`${nombre} se ha eliminado`, `${nombre} has been deleted`));
    if (!BIZ) { noBusiness(); return; }
    await preparaNegocio();
    renderBizPicker();
    location.hash = '#/resumen';
  };
}

/** «Salir del equipo» para quien no es propietario. Avisa al propietario la
 * base. */
async function salirDelEquipo() {
  if (!await confirmDlg(bi(`¿Salir del equipo de ${BIZ.name}?`, `Leave the ${BIZ.name} team?`),
    esc(I18N.t('Dejarás de ver su panel y de validar sus códigos. Avisaremos al propietario. Para volver, tendrán que invitarte otra vez.')),
    { submit: I18N.t('Salir del equipo'), danger: true })) return;
  await rpcOk('leave_business', { p_business: BIZ.id });
  const nombre = BIZ.name;
  localStorage.removeItem('klendar.biz');
  BIZZES = await rpc('my_businesses').catch(() => []);
  BIZ = BIZZES[0] || null;
  toast(bi(`Has salido del equipo de ${nombre}`, `You've left the ${nombre} team`));
  if (!BIZ) { noBusiness(); return; }
  await preparaNegocio();
  renderBizPicker();
  if (location.hash === '#/resumen') route(); else location.hash = '#/resumen';
}

boot();
