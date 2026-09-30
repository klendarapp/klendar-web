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
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
/** Una dirección escrita → su punto en el mapa (Mapbox).
 *
 * Si no hay token o no se encuentra, se devuelve null y la ficha se guarda
 * igual: mejor una dirección sin punto que no poder guardar. */
let MAPBOX_TOKEN = null;
async function tokenMapbox() {
  if (MAPBOX_TOKEN !== null) return MAPBOX_TOKEN;
  try {
    const r = await fetch('/api/mapbox-token');
    MAPBOX_TOKEN = r.ok ? (await r.json()).token || '' : '';
  } catch { MAPBOX_TOKEN = ''; }
  return MAPBOX_TOKEN;
}

async function geocodifica(texto) {
  const token = await tokenMapbox();
  if (!token || !String(texto).trim()) return null;
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(texto)}.json?limit=1&country=es&language=es&access_token=${token}`);
    if (!r.ok) return null;
    const j = await r.json();
    const c = j.features?.[0]?.center;
    return Array.isArray(c) ? { lng: c[0], lat: c[1] } : null;
  } catch { return null; }
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
      js.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
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
}

/** A dónde volver después de entrar o de aceptar los términos: la página del
 * panel y nada más. El hash puede traer de todo (un `#access_token=…` de un
 * enlace de acceso, un código escrito…) y viajaba entero en `?volver=`. */
function rutaDeVuelta() {
  const [h, q] = location.hash.split('?');
  const biz = new URLSearchParams(q || '').get('biz');
  const hash = /^#\/[a-z0-9-]{1,30}(\/[A-Za-z0-9-]{1,40}){0,2}$/.test(h || '')
    ? h + (biz && /^[0-9a-f-]{36}$/i.test(biz) ? `?biz=${biz}` : '')
    : '';
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
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  ME = session.user;
  // Quien entró con Google y aún no ha aceptado los términos ni dicho su
  // edad lo hace primero en «Tu cuenta», y vuelve aquí. Igual si los aceptó
  // en una versión anterior a la vigente («Hemos actualizado los términos…»).
  try {
    const c = await rpc('my_consents');
    if (!c) { await sb.auth.signOut({ scope: 'local' }).catch(() => {}); return showLogin(); }
    if (!c.terms_accepted_at || c.terms_outdated === true) {
      location.href = `/app/?volver=${encodeURIComponent(rutaDeVuelta())}#/ultimo-paso`;
      return;
    }
  } catch { /* sin red: no se bloquea */ }
  $('#who').textContent = ME.email || ME.phone || '';
  $('#app').hidden = false;

  try {
    BIZZES = await rpc('my_businesses');
  } catch (e) {
    $('#view').innerHTML = `<div class="card"><h2>${esc(I18N.t('Algo ha fallado'))}</h2><p class="err">${esc(friendly(e.message))}</p><button class="btn" data-recargar>${esc(I18N.t('Reintentar'))}</button></div>`;
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
  try { CATS = (await sb.from('categories').select('id, slug, names, position').order('position')).data || []; } catch { CATS = []; }
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
  const v = $('#view');
  try {
    await PAGES.alta(v);
    sinDobleEnvio(v);
    I18N.translate(v);
  } catch (e) {
    v.innerHTML = `<div class="card"><h2>Algo ha fallado</h2><p class="err">${esc(friendly(e.message))}</p><button class="btn" data-recargar>Reintentar</button></div>`;
    $('[data-recargar]', v).onclick = () => location.reload();
    I18N.translate(v);
  }
}
function renderBizPicker() {
  $('#bizSelect').innerHTML = BIZZES.map((b) => `<option value="${esc(b.id)}" ${b.id === BIZ.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  $('#bizSelect').onchange = async () => {
    BIZ = BIZZES.find((b) => b.id === $('#bizSelect').value);
    localStorage.setItem('klendar.biz', BIZ.id);
    await preparaNegocio();
    const [pag, param] = currentRoute();
    if (param) { location.hash = `#/${pag}`; return; }
    route();
  };
}

let saliendo = false;
$('#logout').onclick = async (e) => {
  e.preventDefault();
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
$('#menuBtn').onclick = () => $('#side').classList.toggle('open');

// ── Idioma ──────────────────────────────────────────────────────────────────
// El panel se escribió en español; la versión inglesa se pinta encima (ver
// i18n.js). Lo que no esté traducido se queda en español, nunca en blanco.
I18N.pickers(['#lang', '#langSide']);
I18N.translate(document.body);
if (I18N.lang === 'en') document.title = 'Klendar · Business dashboard';

// ── Navegación ──────────────────────────────────────────────────────────────
const NAV = [
  ['resumen', 'dashboard', 'Resumen'],
  ['publicaciones', 'bolt', 'Publicaciones'],
  ['validar', 'qr_code_scanner', 'Validar códigos'],
  ['informe', 'bar_chart', 'Informe'],
  ['resenas', 'reviews', 'Reseñas'],
  ['sellos', 'loyalty', 'Tarjetas de sellos'],
  ['carta', 'restaurant_menu', 'Carta'],
  ['novedades', 'campaign', 'Novedades'],
  ['mensajes', 'notifications_active', 'Avisar a mis clientes'],
  ['cumpleanos', 'cake', 'Regalo de cumpleaños'],
  ['ficha', 'storefront', 'Tu ficha'],
  ['cerrados', 'event_busy', 'Días cerrados'],
  ['equipo', 'group', 'Equipo'],
  ['ayuda', 'help', 'Ayuda'],
];
function renderNav(current) {
  $('#nav').innerHTML = NAV.filter((n) => gestiona() || !SOLO_GESTION.includes(n[0])).map((n) => `<a class="nav ${current === n[0] ? 'on' : ''}" href="#/${n[0]}">${ms(n[1])}${n[2]}</a>`).join('');
  I18N.translate($('#nav'));
}
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
const SOLO_GESTION = ['sellos', 'carta', 'novedades', 'mensajes', 'ficha', 'cerrados', 'equipo', 'cartel-local'];

async function route() {
  paraCamara();
  if (!ME) return;
  if (!BIZ) return noBusiness();
  const n = ++RUTA_N;
  let [page, param] = currentRoute();
  if (!gestiona() && SOLO_GESTION.includes(page)) page = 'resumen';
  renderNav(page);
  $('#side').classList.remove('open');
  // Cada pintada va en su propia caja: si una vieja termina tarde, escribe
  // en una caja que ya no está en la página y no se ve.
  const v = document.createElement('div');
  v.innerHTML = '<div class="loading">Cargando…</div>';
  $('#view').replaceChildren(v);
  try {
    await (PAGES[page] || PAGES.resumen)(v, param);
    if (n === RUTA_N) { sinDobleEnvio(v); I18N.translate(v); }
  } catch (e) {
    if (n !== RUTA_N) return;
    console.error(e);
    // «Reintentar» vuelve a pintar la pantalla, sin recargar todo el panel.
    v.innerHTML = `<div class="card"><h2>Algo ha fallado</h2><p class="err">${esc(friendly(e?.message))}</p><button class="btn" type="button" data-reintentar>Reintentar</button></div>`;
    $('[data-reintentar]', v).onclick = () => route();
    I18N.translate(v);
  }
}
window.addEventListener('hashchange', route);

// ── Alta de un negocio (el primero o uno más) ──────────────────────────────
PAGES.alta = async (v) => {
  const cats = CATS.length ? CATS
    : ((await sb.from('categories').select('id, slug, names, position').order('position')).data || []);
  const otro = BIZZES.length > 0;
  let punto = null;

  v.innerHTML = `
    <div class="page-head"><h1>${otro ? 'Dar de alta otro local' : 'Da de alta tu negocio'}</h1></div>
    ${otro ? '' : `<div class="help"><b>Bienvenido/a.</b> Cuéntanos sobre tu negocio: lo revisamos antes de hacerlo público (normalmente en 24-48 h). Mientras, ya puedes preparar publicaciones.
      <br><span class="muted">¿Te han invitado al equipo de un negocio? Entonces no hace falta: entra con el mismo correo con el que te invitaron y aparecerá solo.</span></div>`}
    <form id="alta" class="form" novalidate>
      <label class="f"><span>Nombre del negocio *</span><input name="name" maxlength="80" required placeholder="Ej. La Taberna del Gato"></label>
      <label class="f"><span>Categoría *</span><select name="category_id" required>
        <option value="">Elige una…</option>
        ${cats.map((c) => `<option value="${esc(c.id)}">${esc(c.names?.[I18N.lang] || c.names?.es || c.slug)}</option>`).join('')}</select></label>
      <label class="f full"><span>De qué va <small>(¿qué ofrece tu negocio? ¿qué lo hace especial?)</small></span><textarea name="description" maxlength="500"></textarea></label>
      <label class="f"><span>Dirección *</span><input name="address" maxlength="120" required placeholder="Calle y número"></label>
      <label class="f"><span>Ciudad *</span><input name="city" maxlength="60" required></label>
      <div class="full">
        <p style="margin:0 0 8px"><button class="btn sm" type="button" id="buscar">${ms('location_on')}Buscar en el mapa</button>
          <button class="btn sm" type="button" id="aqui">Estoy en el local</button>
          <span class="muted" id="punto-txt">Marca dónde está la puerta: la gente te encuentra por la distancia.</span></p>
        <div class="mapa" id="mapa"></div>
      </div>
      <label class="f"><span>Teléfono</span><input name="phone" maxlength="20" inputmode="tel"></label>
      <label class="f"><span>Web</span><input name="website" type="url" placeholder="https://"></label>
      <label class="f"><span>Correo de contacto <small>(lo ven los clientes: mejor uno del negocio que el tuyo personal)</small></span><input name="contact_email" type="email" maxlength="254" placeholder="hola@tunegocio.com"></label>
      <label class="f"><span>NIF / CIF <small>(para la verificación; no se publica)</small></span><input name="tax_id" maxlength="20"></label>
      <label class="f full" style="grid-template-columns:auto 1fr;align-items:start">
        <input type="checkbox" name="adults_only">
        <span>Solo para mayores de 18 <small class="muted">Si lo que publicas menciona alcohol, se marca +18 solo y se revisa antes de salir. La publicidad de tabaco, vapeo o apuestas no está permitida.</small></span></label>
      <label class="f full" style="grid-template-columns:auto 1fr;align-items:start">
        <input type="checkbox" name="terms" required>
        <span>Acepto las <a href="${APP_URL}/negocios/" target="_blank" rel="noopener">condiciones para negocios</a> *</span></label>
      <div class="full"><button class="btn primary" type="submit" id="enviar">Enviar solicitud</button> <span id="err" class="err"></span></div>
    </form>`;

  const f = $('#alta', v);
  const txt = $('#punto-txt', v);
  // Lo que se rellena solo desde el mapa se vuelve a rellenar cada vez que
  // se mueve la chincheta o se usa «Estoy en el local»; lo escrito a mano no
  // se toca nunca.
  const autoRellena = (campo, valor) => {
    const el = f.elements[campo];
    if (!valor || !el) return;
    if (!el.value.trim() || el.dataset.auto === el.value) {
      el.value = valor;
      el.dataset.auto = valor;
      KL_CAMPO(el, null);
    }
  };
  const marca = async (p, rellenar) => {
    punto = { lat: p.lat, lng: p.lng };
    txt.textContent = I18N.t('Ubicación marcada. Si no es exacta, arrastra la chincheta.');
    if (rellenar) {
      const d = await direccionDe(p.lat, p.lng);
      if (d) {
        autoRellena('address', d.address);
        autoRellena('city', d.city);
      }
    }
  };
  const mapa = await mapaPunto($('#mapa', v), null, (p) => marca(p, true));

  $('#buscar', v).onclick = async () => {
    const q = [f.address.value, f.city.value].map((x) => x.trim()).filter(Boolean).join(', ');
    if (!q) { toast('Escribe primero la dirección y la ciudad.', true); return; }
    const d = await buscaDireccion(q);
    if (!d) { toast('No encontramos esa dirección. Prueba a escribirla de otra forma o marca el punto en el mapa.', true); return; }
    autoRellena('city', d.city);
    mapa?.mueve(d);
    marca(d, false);
  };
  $('#aqui', v).onclick = () => {
    if (!navigator.geolocation) { toast('Este navegador no deja saber dónde estás.', true); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      mapa?.mueve(p);
      marca(p, true);
    }, () => toast('No hemos podido saber dónde estás. Revisa el permiso de ubicación del navegador.', true),
    { enableHighAccuracy: true, timeout: 12000 });
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#err', v);
    err.textContent = '';
    const d = Object.fromEntries(new FormData(f));
    // Como la app: «Obligatorio» debajo de cada campo que falta.
    const obligatorio = KL_VALIDA.MSG[I18N.lang === 'en' ? 'en' : 'es'].obligatorio;
    const faltan = [
      ['name', String(d.name || '').trim().length < 2],
      ['category_id', !d.category_id],
      ['address', !String(d.address || '').trim()],
      ['city', !String(d.city || '').trim()],
    ];
    for (const [campo, falta] of faltan) KL_CAMPO(f.elements[campo], falta ? obligatorio : null);
    const primero = faltan.find(([, falta]) => falta);
    if (primero) { f.elements[primero[0]].focus(); return; }
    if (!punto) {
      // Sin chincheta: se intenta con la dirección escrita.
      const b = await buscaDireccion(`${d.address}, ${d.city}`);
      if (!b) { err.textContent = I18N.t('Marca en el mapa dónde está el local (o pulsa «Buscar en el mapa»).'); return; }
      punto = { lat: b.lat, lng: b.lng };
    }
    KL_CAMPO(f.terms, f.terms.checked ? null : I18N.t('Tienes que aceptar las condiciones para negocios.'));
    if (!f.terms.checked) { f.terms.focus(); return; }
    const boton = $('#enviar', v);
    boton.disabled = true;
    try {
      const id = await rpc('register_business', {
        p_name: String(d.name).trim(), p_category_id: d.category_id,
        p_lat: punto.lat, p_lng: punto.lng,
        p_address: String(d.address).trim(), p_city: String(d.city).trim(),
        p_description: String(d.description || '').trim() || null,
        p_phone: String(d.phone || '').trim() || null,
        p_website: String(d.website || '').trim() || null,
        p_tax_id: String(d.tax_id || '').trim() || null,
        p_contact_email: String(d.contact_email || '').trim() || null,
        p_adults_only: f.adults_only.checked,
      });
      BIZZES = await rpc('my_businesses');
      BIZ = BIZZES.find((b) => b.id === id) || BIZZES[0];
      localStorage.setItem('klendar.biz', BIZ.id);
      // Recién dado de alta: su zona sale del punto marcado en el mapa.
      if (BIZ.id === id) BIZ.time_zone = KZ.porCoordenadas(punto.lat, punto.lng);
      await preparaNegocio();
      $('.bizpick').hidden = false;
      renderBizPicker();
      if (!CATS.length) CATS = cats;
      toast('Solicitud enviada. Ahora completa la ficha: logo, portada y horarios.');
      // Si ya estaba en #/ficha no hay «hashchange»: se pinta a mano (y solo
      // entonces, para no pintarla dos veces).
      if (location.hash === '#/ficha') route(); else location.hash = '#/ficha';
    } catch (e2) {
      err.textContent = I18N.t(friendly(e2.message));
      boton.disabled = false;
    }
  };
};

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
    <p style="margin:8px 0 0"><a class="btn sm" href="mailto:info@klendar.app?subject=${asunto}&body=${cuerpo}">${ms('mail')}${esc(I18N.t('Escribir a soporte'))}</a></p></div>`;
}

PAGES.resumen = async (v) => {
  const [stats, offers, sub] = await Promise.all([
    rpc('business_stats', { p_id: BIZ.id }),
    rpc('my_business_offers', { p_id: BIZ.id }),
    rpc('my_subscription', { p_business: BIZ.id }).catch(() => null),
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
    ${BIZ.verification_status !== 'verified' ? avisoVerificacion() : ''}
    ${primeros ? `<div class="card primeros"><h2>Primeros pasos</h2>
      <p class="muted" style="margin:0 0 8px">Tres cosas y tu negocio está listo para que la gente lo encuentre.</p>
      ${paso(1, conFotos, 'Pon tu logo y una foto', '', '#/ficha')}
      ${paso(2, false, 'Publica tu primera oferta', 'Te la dejamos casi hecha: cambia el precio y la hora.', '#/publicaciones/nueva-flash?idea=1')}
      ${paso(3, false, 'Cuéntalo en tus redes', '', '#', 'data-compartir')}
    </div>` : ''}
    <div class="quick">
      ${gestiona() ? `<button class="primary" data-go="nueva-flash"><span class="ic ms" aria-hidden="true">bolt</span>Nueva oferta flash<small>Canjeable con QR durante unas horas</small></button>
      <button data-go="nuevo-evento"><span class="ic ms" aria-hidden="true">event</span>Nuevo evento<small>Con fecha, aforo y reserva de plaza</small></button>` : ''}
      <button ${gestiona() ? '' : 'class="primary" '}data-go="validar"><span class="ic ms" aria-hidden="true">qr_code_scanner</span>Validar un código<small>Con la cámara o escribiendo el código</small></button>
    </div>
    <div class="card" style="margin-top:14px"><h2>Cómo va</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(s.views_30d)}</b><span>Vistas (30 días)</span></div>
        <div class="kpi"><b>${fmtNum(s.redemptions_30d)}</b><span>Canjes (30 días)</span></div>
        <div class="kpi"><b>${fmtNum(s.favorites)}</b><span>Favoritos</span></div>
        <div class="kpi"><b>${s.ratings ? `${Number(s.rating).toLocaleString(LOC(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${s.ratings})` : '—'}</b><span>Valoración</span></div>
        <div class="kpi"><b>${fmtNum(pending.length)}</b><span>Publicaciones activas</span></div>
      </div>
    </div>
    ${gestiona() && BIZ.verification_status === 'verified' ? `<div class="card pausa"><div>
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
        { h: 'Publicación', r: (o) => `<b class="title">${esc(o.title)}</b><span class="sub">${esc(I18N.t(LABELS[o.kind]))} · ${fmtDate(o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at)}${etiquetaAudiencia(o)}</span>` },
        { h: 'Estado', r: (o) => tag(estadoVisible(o)) + (o.moderation_status === 'pending' || o.moderation_status === 'rejected' ? ' ' + tag(o.moderation_status) : '') },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
        { h: 'Canjes', num: true, r: (o) => fmtNum(o.redemptions_count) },
        { h: '', r: (o) => `<a class="btn sm" href="#/publicaciones/${esc(o.id)}">Abrir</a>` },
      ],
      rows: offers.slice(0, 8),
      empty: 'Todavía no has publicado nada.',
    })}</div>`;
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
  if (param === 'nueva-flash') return offerForm(v, null, 'flash_offer', desde);
  if (param === 'nuevo-evento') return offerForm(v, null, 'future_event', desde);
  if (param) return offerForm(v, param);

  const [offers, otros] = await Promise.all([
    rpc('my_business_offers', { p_id: BIZ.id }),
    rpc('my_publishable_businesses', { p_except: BIZ.id }).catch(() => []),
  ]);
  OTROS_LOCALES = otros || [];
  v.innerHTML = `
    <div class="page-head"><h1>Publicaciones</h1><span class="spacer"></span>
      ${gestiona() ? `<a class="btn sm" href="#/publicaciones/nueva-flash">${ms('bolt')}Nueva oferta flash</a>
      <a class="btn sm" href="#/publicaciones/nuevo-evento">${ms('event')}Nuevo evento</a>` : ''}
      <button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Oferta o evento?', bi('<p><b>Oferta flash</b>: algo que se canjea hoy, con cuenta atrás y aforo («café + tostada 2,50 € hasta mediodía»). <b>Evento</b>: algo con fecha, que se guarda en la agenda y puede admitir reserva de plaza.</p>',
      '<p><b>Flash offer</b>: something redeemed today, with a countdown and a limit (“coffee + toast €2.50 until noon”). <b>Event</b>: something with a date, which people save to their agenda and where people can reserve a place.</p>'))}
    <div id="list"></div>
    <div id="rules"></div>`;
  const DIAS = I18N.lang === 'en'
    ? ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
    : ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

  // Las reglas que publican solas. Se crean desde una publicación que ya
  // existe («repetir esta cada martes»), no desde un formulario en blanco:
  // nadie quiere escribirlo todo dos veces.
  const renderRules = async () => {
    const reglas = (await rpc('my_offer_rules', { p_business: BIZ.id })) || [];
    if (!reglas.length) { $('#rules').innerHTML = ''; return; }
    $('#rules').innerHTML = `<div class="card"><h2>Se repiten solas</h2>
      <p class="muted" style="margin:0 0 10px">Cada una se publica sola a su hora. Si la de la semana pasada sigue activa, esa semana se salta: no se apilan.</p>
      ${table({
        cols: [
          { h: 'Publicación', r: (x) => `<b class="title">${esc(x.title || '—')}</b><span class="sub">${esc(bi(`${fmtNum(x.published)} ${x.published === 1 ? 'publicada' : 'publicadas'}`, `${fmtNum(x.published)} published`))}</span>` },
          { h: 'Cuándo', r: (x) => `${x.weekdays.map((d) => DIAS[d]).join(', ')} ${I18N.lang === 'en' ? 'at' : 'a las'} ${esc(x.start_time)}` },
          { h: 'Dura', r: (x) => `${Math.round(x.duration_min / 60 * 10) / 10} h` },
          { h: 'Estado', r: (x) => tag(x.is_active ? 'active' : 'draft') },
          { h: '', r: (x) => `<div class="actions">
              <button class="btn sm ghost" data-rule="${x.is_active ? 'pause' : 'resume'}" data-id="${esc(x.id)}">${x.is_active ? 'Pausar' : 'Reanudar'}</button>
              <button class="btn sm ghost" data-rule="delete" data-id="${esc(x.id)}">Quitar</button>
            </div>` },
        ],
        rows: reglas,
        empty: 'Ninguna.',
      })}</div>`;
    $$('[data-rule]', $('#rules')).forEach((b) => {
      b.onclick = async () => {
        try {
          if (b.dataset.rule === 'delete') {
            if (!await confirmDlg('Quitar la repetición', 'Dejará de publicarse sola. Lo que ya se publicó se queda como está.', { danger: true, submit: 'Quitar' })) return;
            await rpc('delete_offer_rule', { p_id: b.dataset.id });
            toast('Quitada');
          } else {
            await rpc('set_offer_rule_active', { p_id: b.dataset.id, p_active: b.dataset.rule === 'resume' });
            toast('Guardado');
          }
          renderRules();
        } catch (e) { toast(friendly(e.message), true); }
      };
    });
  };

  async function repetirDialogo(offerId) {
    const o = offers.find((x) => x.id === offerId) || {};
    const r = await modal({
      title: 'Repetir cada semana',
      intro: bi(`«${esc(o.title || '')}» se publicará sola los días y la hora que elijas, con su cuenta atrás y su aforo. Puedes pausarla cuando quieras.`,
        `“${esc(o.title || '')}” will be posted on its own on the days and at the time you choose, with its countdown and its limit. You can pause it whenever you like.`),
      submit: 'Crear la repetición',
      // Cualquier combinación de días, como en la app (de lunes a domingo).
      fields: [
        ...[[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']]
          .map(([d, n]) => ({ name: `d${d}`, type: 'checkbox', label: n, value: d >= 1 && d <= 5 })),
        { name: 'hora', type: 'time', label: '¿A qué hora empieza?', value: '17:00', required: true },
        { name: 'duracion', type: 'select', label: '¿Cuánto dura?', value: '120', options: [
          ['60', '1 hora'], ['120', '2 horas'], ['180', '3 horas'], ['240', '4 horas'], ['480', 'Toda la tarde (8 h)'],
        ] },
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
    $('#list').innerHTML = table({
      cols: [
        { h: 'Publicación', r: (o) => `${primeraFoto(o.images) ? `<img class="thumb" src="${esc(primeraFoto(o.images))}" alt="" loading="lazy">` : `<span class="ph">${ms((o.images || []).some(esVideo) ? 'play_circle' : o.kind === 'flash_offer' ? 'bolt' : 'event')}</span>`}<b class="title">${esc(o.title)}</b><span class="sub">${esc(I18N.t(LABELS[o.kind]))} · ${fmtDate(o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at)}${etiquetaAudiencia(o)}</span>` },
        { h: 'Estado', r: (o) => tag(estadoVisible(o)) + (o.moderation_status === 'pending' || o.moderation_status === 'rejected' ? ' ' + tag(o.moderation_status) : '') + (o.publish_at ? ` <span class="tag dim">${esc(bi('programada', 'scheduled'))} ${esc(fmtDate(o.publish_at))}</span>` : '') },
        { h: 'Plazas', r: (o) => o.max_redemptions == null ? '—' : `<span data-plazas="${esc(o.id)}">${plazasTxt(o, plazasOcupadas(o))}</span>` },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
        { h: 'Canjes', num: true, r: (o) => fmtNum(o.redemptions_count) },
        { h: '', r: (o) => !gestiona()
          ? `<div class="actions"><button class="btn sm ghost" data-act="stats" data-id="${esc(o.id)}">Cifras</button>${o.kind === 'future_event' && o.reservations_enabled ? `<a class="btn sm ghost" href="#/asistentes/${esc(o.id)}">Asistentes</a>` : ''}</div>`
          : `<div class="actions">
            <a class="btn sm" href="#/publicaciones/${esc(o.id)}">Editar</a>
            <button class="btn sm ghost" data-act="stats" data-id="${esc(o.id)}">Cifras</button>
            ${o.kind === 'future_event' && o.reservations_enabled ? `<a class="btn sm ghost" href="#/asistentes/${esc(o.id)}">Asistentes</a>` : ''}
            ${estadoVisible(o) === 'active' ? `<button class="btn sm ghost" data-act="pause" data-id="${esc(o.id)}">Pausar</button>` : o.status === 'draft' ? `<button class="btn sm ghost" data-act="activate" data-id="${esc(o.id)}">Activar</button>` : ''}
            <details class="mas"><summary class="btn sm ghost">Más</summary><div class="mas-menu">
              <a href="#/publicaciones/${o.kind === 'flash_offer' ? 'nueva-flash' : 'nuevo-evento'}?from=${esc(o.id)}">Crear a partir de esta</a>
              ${o.kind === 'flash_offer' && o.status === 'active' && new Date(o.redeem_end_at) > new Date() ? `<button type="button" data-act="extend" data-id="${esc(o.id)}">Ampliar 1 h</button>` : ''}
              ${o.status === 'sold_out' || estadoVisible(o) === 'expired' ? `<a href="#/publicaciones/${o.kind === 'flash_offer' ? 'nueva-flash' : 'nuevo-evento'}?from=${esc(o.id)}&repeat=1">${o.kind === 'flash_offer' ? 'Repetir mañana' : 'Repetir'}</a>` : ''}
              ${o.kind === 'flash_offer' ? `<button type="button" data-act="repeat" data-id="${esc(o.id)}">Repetir cada semana…</button>` : ''}
              ${OTROS_LOCALES.length ? `<button type="button" data-act="locales" data-id="${esc(o.id)}">Publicar en otros locales…</button>` : ''}
              <a href="${I18N.lang === 'en' ? '/en/poster/' : '/cartel/'}${esc(o.id)}" target="_blank" rel="noopener">Cartel para imprimir</a>
              <button type="button" class="bad" data-act="delete" data-id="${esc(o.id)}">Borrar</button>
            </div></details>
          </div>` },
      ],
      rows: offers,
      empty: 'Todavía no has publicado nada.',
    });
    $$('[data-act]', $('#list')).forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.id;
        try {
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
            if (!await confirmDlg('Borrar publicación', 'Se borra para siempre, junto con sus estadísticas. Si solo quieres que deje de verse, púlsale a «Pausar».', { danger: true, submit: 'Borrar' })) return;
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
          } else {
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
];
const etiquetaAudiencia = (o) => (o?.audience === 'favorites' ? ` <span class="tag dim">${esc(I18N.t('Para favoritos'))}</span>`
  : o?.audience === 'customers' ? ` <span class="tag dim">${esc(I18N.t('Para clientes'))}</span>` : '');

/** Plazas ocupadas (personas) de una publicación con aforo: lo que dice la
 * base (`seats_left`, según guarde plaza o vaya por orden de llegada) o, con
 * una respuesta antigua, la cuenta de códigos. */
function plazasOcupadas(o) {
  if (o.max_redemptions == null) return null;
  if (o.seats_left != null) return Math.max(0, o.max_redemptions - o.seats_left);
  return o.redemptions_count + (o.holds_seats === false ? 0 : (o.pending_count || 0));
}
const plazasTxt = (o, n) => `${fmtNum(n)}/${fmtNum(o.max_redemptions)}`;

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

/** Formulario de publicación (nueva o existente). */
async function offerForm(v, id, kindDefault, desde = null) {
  // Un empleado valida códigos, no publica (como en la app).
  if (!gestiona()) {
    v.innerHTML = `<div class="card"><p class="muted" style="margin:0">${esc(I18N.t('Solo el propietario y los encargados pueden crear o editar publicaciones.'))}</p></div>`;
    return;
  }
  let o = { kind: kindDefault || 'flash_offer', max_per_user: 1, code_ttl_minutes: 5, images: [], status: 'active' };
  if (id) {
    const all = await rpc('my_business_offers', { p_id: BIZ.id });
    o = all.find((x) => x.id === id) || o;
  } else if (!desde) {
    // Como la app: una oferta flash empieza ya y dura 3 h; un evento, mañana
    // a las 20:00. Se cambia en un momento; un formulario en blanco frena.
    const ahora = new Date(); ahora.setSeconds(0, 0);
    if (o.kind === 'flash_offer') {
      o.redeem_start_at = ahora.toISOString();
      o.redeem_end_at = new Date(ahora.getTime() + 3 * 36e5).toISOString();
    } else {
      o.event_at = enDiasNegocio(1, 20).toISOString();
    }
  }
  if (!id && desde) {
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
      kindDefault = src.kind;
    }
  }
  const isFlash = () => $('[name=kind]', v).value === 'flash_offer';
  const disc = o.discount || {};
  // Plantillas, como en la app: las de su gremio (mismas ideas, generadas
  // desde la app en ideas.js) y las que el negocio ha guardado.
  let ideas = [];
  let guardadas = [];
  if (!id && !desde) {
    const [{ data: yo }, { data: tpl }] = await Promise.all([
      sb.from('businesses').select('category_id').eq('id', BIZ.id).maybeSingle(),
      sb.from('offer_templates').select('id, name, data, updated_at').eq('business_id', BIZ.id).order('updated_at', { ascending: false }),
    ]);
    const slug = CATS.find((c) => c.id === yo?.category_id)?.slug;
    const IDEAS = window.KLENDAR_IDEAS || { general: [], bySlug: {} };
    ideas = (IDEAS.bySlug[slug] || IDEAS.general).filter((t) => t.kind === o.kind);
    guardadas = tpl || [];
  }
  const en = I18N.lang === 'en';
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/publicaciones">← Volver</a><h1>${id ? 'Editar publicación' : desde?.repeat ? 'Repetir mañana' : desde ? 'A partir de otra publicación' : (kindDefault === 'future_event' ? 'Nuevo evento' : 'Nueva oferta flash')}</h1></div>
    ${ideas.length || guardadas.length ? `<div class="card plantillas" id="plantillas">
      ${guardadas.length ? `<h2>Tus plantillas</h2>
        <div class="acciones">${guardadas.map((t, i) => `<button type="button" class="btn sm" data-tpl="${i}">${esc(t.name)}</button>`).join('')}</div>
        <p style="margin:8px 0 0"><button type="button" class="linkbtn" id="borraTpl">Borrar plantillas…</button></p>` : ''}
      ${ideas.length ? `<h2 ${guardadas.length ? 'style="margin-top:14px"' : ''}>Plantillas</h2>
        <p class="hint" style="margin:0 0 10px">Lo que suele funcionar en tu tipo de negocio. Rellena el formulario; luego lo cambias a tu gusto.</p>
        <div class="acciones">${ideas.map((t, i) => `<button type="button" class="btn sm" data-idea="${i}">${esc(en ? t.en : t.es)}</button>`).join('')}</div>` : ''}
    </div>` : ''}
    <form class="card" id="form">
      <div class="form-grid">
        <label class="f full"><span>Título</span><input name="title" value="${esc(o.title || '')}" required maxlength="90" placeholder="${kindDefault === 'future_event' ? 'Concierto de jazz' : 'Café + tostada 2,50 €'}"></label>
        <label class="f full"><span>Descripción</span><textarea name="description" maxlength="600">${esc(o.description || '')}</textarea></label>
        <label class="f"><span>Tipo</span><select name="kind">
          <option value="flash_offer" ${o.kind === 'flash_offer' ? 'selected' : ''}>Oferta flash</option>
          <option value="future_event" ${o.kind === 'future_event' ? 'selected' : ''}>Evento</option></select></label>
        <label class="f"><span>Categoría</span><select name="category_id"><option value="">La del negocio</option>
          ${CATS.map((c) => `<option value="${esc(c.id)}" ${o.category_id === c.id ? 'selected' : ''}>${esc(c.names?.[I18N.lang] || c.names?.es || '')}</option>`).join('')}</select></label>
        <label class="f"><span>Empieza</span><input type="datetime-local" name="start" value="${toLocalInput(o.kind === 'future_event' ? o.event_at : o.redeem_start_at)}" required></label>
        <label class="f"><span>Termina</span><input type="datetime-local" name="end" value="${toLocalInput(o.kind === 'future_event' ? o.event_end_at : o.redeem_end_at)}"></label>
        <label class="f"><span>Precio (opcional)</span><input name="price" inputmode="decimal" value="${o.price_cents == null ? '' : (o.price_cents / 100).toFixed(2).replace('.', ',')}" placeholder="12,00"></label>
        <label class="f"><span>Aforo / unidades</span><input name="max_redemptions" type="number" min="1" value="${o.max_redemptions ?? ''}" placeholder="vacío = sin límite"></label>
        <label class="f" id="plazasRow" hidden><span>Cómo se llenan las plazas <small id="plazasAyuda"></small></span><select name="holds_seats">
          <option value="si" ${o.holds_seats === false ? '' : 'selected'}>El código guarda la plaza</option>
          <option value="no" ${o.holds_seats === false ? 'selected' : ''}>Por orden de llegada</option></select></label>
        <label class="f"><span>Descuento</span><select name="discount_type">
          ${[['', 'Sin descuento'], ['percent', 'Porcentaje'], ['fixed', 'Precio fijo'], ['2x1', '2x1'], ['free', 'Gratis'], ['other', 'Otro (lo escribes tú)']].map((d) => `<option value="${d[0]}" ${disc.type === d[0] ? 'selected' : ''}>${d[1]}</option>`).join('')}</select></label>
        <label class="f"><span>Valor del descuento</span><input name="discount_value" value="${esc(disc.value ?? '')}" placeholder="20"></label>
        <label class="f full"><span>Precio anterior <small>(obligatorio si pones un % o un precio rebajado; ha de ser el más bajo de los últimos 30 días)</small></span><input name="prior_price" inputmode="decimal" value="${disc.compare_at_cents != null ? (disc.compare_at_cents / 100).toFixed(2).replace('.', ',') : ''}" placeholder="12,00"></label>
        <label class="f full" id="alcRow" hidden><span>¿El 2x1 incluye bebidas alcohólicas? <small>(hay que responder; si dices que sí, la publicación solo la verán mayores de 18 y tendrás que comprobar que tu comunidad lo permite: la sanción sería para tu negocio)</small></span><select name="alcohol">
          ${[['', 'Elige una opción'], ['no', 'No lleva alcohol'], ['yes', 'Sí, lleva alcohol']].map((a) => `<option value="${a[0]}" ${(disc.alcohol === true ? 'yes' : disc.alcohol === false ? 'no' : '') === a[0] ? 'selected' : ''}>${a[1]}</option>`).join('')}</select></label>
        <label class="f"><span>¿Cuánto vale el código QR?</span><select name="code_ttl_minutes">
          ${[[5, '5 minutos'], [30, '30 minutos'], [180, '3 horas'], [1440, '1 día'], ['', 'Sin caducidad']].map((t) => `<option value="${t[0]}" ${String(o.code_ttl_minutes ?? '') === String(t[0]) ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></label>
        <label class="f"><span>Canjes por persona</span><input name="max_per_user" type="number" min="1" max="20" value="${o.max_per_user ?? 1}"></label>
        <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="reservations_enabled" ${o.reservations_enabled ? 'checked' : ''}><span>${bi('Evento con <b>reserva de plaza</b> (sin pago): la gente reserva desde la app y enseña su código en la puerta', 'Event where people <b>reserve a place</b> (no payment): they reserve from the app and show their code at the door')}</span></label>
        <label class="f" id="seatsRow" hidden><span>Plazas por persona <small>(a un evento no se va solo; un código vale por todas)</small></span><select name="max_seats">
          ${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${Number(o.max_seats || 1) === n ? 'selected' : ''}>${n === 1 ? esc(I18N.t('1 (solo quien reserva)')) : esc(bi(`${n} personas`, `${n} people`))}</option>`).join('')}</select></label>
        <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="adults_only" ${o.adults_only ? 'checked' : ''}><span>Solo para mayores de 18</span></label>
        <fieldset class="f full filtro-sellos"><legend>Quién la ve</legend>
          ${AUDIENCIAS.map(([k, t]) => `<label class="opcion"><input type="radio" name="audience" value="${k}" ${(o.audience || 'all') === k ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
          <p class="hint" id="audAyuda" ${(o.audience || 'all') === 'all' ? 'hidden' : ''}>Solo la ven ellos. Si a otra persona le llega el enlace, la ficha dice que es exclusiva y cómo conseguirla, sin enseñar el beneficio.</p>
        </fieldset>
        <label class="f full"><span>Condiciones (letra pequeña)</span><textarea name="terms" maxlength="300">${esc(o.terms || '')}</textarea></label>
        <label class="f full"><span>Enlace externo (entradas, reservas…)</span><input name="external_url" value="${esc(o.external_url || '')}" placeholder="https://"></label>
      </div>
      <p class="hint">${TZ === KZ.CANARIAS ? 'Las fechas y horas son las de Canarias, donde está tu local.' : 'Las fechas y horas son las de la península (hora de Madrid), donde está tu local.'}</p>
      <h3 style="margin-top:16px">Fotos y vídeo</h3>
      <p class="hint">Hasta 6 fotos o vídeos. La primera es la portada; muévelas con las flechas. Si no pones ninguna, se usa la foto del local. Los vídeos se ven al abrir la publicación (en el feed van las fotos).</p>
      <div class="photos" id="photos"></div>
      <h3 style="margin-top:18px">Diseño del anuncio</h3>
      <p class="hint">Así se verá en Descubre. Elige la plantilla y el color que mejor casen con tu marca.</p>
      <div class="estilo">
        <div class="estilo-prev" id="estiloPrev" aria-hidden="true"></div>
        <div class="estilo-opc">
          <div class="pills" id="plantillasEstilo"></div>
          <p class="hint" style="margin:14px 0 6px">Color de tu marca</p>
          <div class="colores" id="colores"></div>
        </div>
      </div>
      <div class="actions" style="margin-top:18px">
        <button class="btn primary" type="submit" id="enviarPub">${id ? 'Guardar cambios' : 'Publicar'}</button>
        <button class="btn" type="button" id="saveTpl">Guardar como plantilla</button>
        <label class="f" style="grid-template-columns:auto 1fr;align-items:center;margin:0"><input type="checkbox" name="publish" ${o.status === 'active' ? 'checked' : ''}><span>Publicar ahora (desactívalo para dejarlo en borrador)</span></label>
      </div>
      <label class="f" style="margin-top:12px;max-width:360px"><span>O publicarla sola más tarde <small>(opcional)</small></span><input type="datetime-local" name="publish_at" value="${toLocalInput(o.publish_at)}"></label>
      <p class="hint">Se guarda en borrador y se publica sola a esa hora (para dejar preparada la del lunes el viernes).</p>
      <div class="err" id="formErr"></div>
    </form>`;

  // Lo que solo tiene sentido en un tipo u otro se enseña y se esconde.
  const syncKind = () => {
    const flash = $('[name=kind]', v).value === 'flash_offer';
    const resRow = $('[name=reservations_enabled]', v).closest('label');
    resRow.style.display = flash ? 'none' : '';
    $('[name=external_url]', v).closest('label').style.display = flash ? 'none' : '';
    // Solo tiene sentido si hay reserva: en una oferta de barra, cada uno
    // enseña la suya.
    const conReserva = !flash && $('[name=reservations_enabled]', v).checked;
    $('#seatsRow', v).hidden = !conReserva;
    $('[name=end]', v).closest('label').querySelector('span').textContent =
      flash ? 'Termina (obligatorio)' : 'Termina (opcional)';
    $('[name=start]', v).closest('label').querySelector('span').textContent =
      flash ? 'Empieza' : 'Día y hora del evento';
  };
  $('[name=kind]', v).onchange = syncKind;
  // Una nueva sin «Publicar ahora» se queda en borrador (o se programa): el
  // botón lo dice, para que nadie crea que ya está publicada.
  if (!id) {
    const syncEnviar = () => {
      const programada = !!$('[name=publish_at]', v).value;
      $('#enviarPub', v).textContent = programada ? 'Programar' : $('[name=publish]', v).checked ? 'Publicar' : 'Guardar borrador';
    };
    $('[name=publish]', v).addEventListener('change', syncEnviar);
    $('[name=publish_at]', v).addEventListener('input', syncEnviar);
    syncEnviar();
  }
  $('[name=reservations_enabled]', v).onchange = () => {
    // Una reserva de evento se guarda hasta el día: con los 5 minutos de las
    // ofertas flash (lo que viene marcado), la plaza se perdía al rato de
    // reservarla. Lo mismo que la app.
    const ttl = $('[name=code_ttl_minutes]', v);
    if ($('[name=reservations_enabled]', v).checked && ttl.value === '5') ttl.value = '';
    syncKind();
  };
  // Con aforo: si el código guarda la plaza o se entra por orden de llegada.
  const syncPlazas = () => {
    $('#plazasRow', v).hidden = !String($('[name=max_redemptions]', v).value || '').trim();
    $('#plazasAyuda', v).textContent = I18N.t($('[name=holds_seats]', v).value === 'no'
      ? '(no guarda sitio: cuentan los que entran; cuando se llena, los que lleguen después ya no pasan)'
      : '(quien tiene código tiene sitio; si no va y no anula, su plaza se queda sin usar)');
  };
  $('[name=max_redemptions]', v).addEventListener('input', syncPlazas);
  $('[name=holds_seats]', v).onchange = syncPlazas;
  syncPlazas();
  syncKind();

  // La pregunta del alcohol solo aparece si el descuento es un 2x1.
  const syncDiscount = () => {
    $('#alcRow', v).hidden = $('[name=discount_type]', v).value !== '2x1';
  };
  $('[name=discount_type]', v).onchange = syncDiscount;
  syncDiscount();
  // La ayuda de «Quién la ve» solo hace falta si no es para todo el mundo.
  $$('[name=audience]', v).forEach((r) => {
    r.onchange = () => { $('#audAyuda', v).hidden = ($('[name=audience]:checked', v)?.value || 'all') === 'all'; };
  });

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
  renderPhotos();

  // ── Diseño del anuncio (las mismas plantillas y colores que la app) ──────
  const PLANTILLAS = [['glass', 'Cristal'], ['bold', 'Color'], ['poster', 'Póster'], ['minimal', 'Limpio']];
  const COLORES = ['#FF4D6D', '#F5B041', '#0EA5E9', '#7C5CFF', '#34D399', '#FF8A3D', '#E879F9', '#111827'];
  // El estilo viene de la base (lo escribe cualquiera del equipo que
  // gestione): solo plantillas conocidas y un color #rrggbb, que va dentro
  // de un atributo `style`.
  const limpiaEstilo = (s) => ({
    template: PLANTILLAS.some(([k]) => k === s?.template) ? s.template : 'glass',
    accent: /^#[0-9a-f]{6}$/i.test(String(s?.accent || '')) ? s.accent : null,
  });
  let estilo = limpiaEstilo(o.style);
  // Tinta sobre el color si su luminancia pasa de 0,186 (donde la tinta ya
  // contrasta más que el blanco), como `OfferStyle.onAccent` en la app.
  const claro = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const l = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * l(n >> 16 & 255) + 0.7152 * l(n >> 8 & 255) + 0.0722 * l(n & 255) > 0.186;
  };
  pintaEstilo = () => {
    const acento = estilo.accent || '#FF4D6D';
    const sobre = claro(acento) ? '#0A0A0A' : '#FFFFFF';
    const f = new FormData($('#form'));
    const evento = String(f.get('kind') || kindDefault) === 'future_event';
    const titulo = String(f.get('title') || '').trim() || (I18N.lang === 'en'
      ? (evento ? 'Your event title' : 'Your offer title')
      : (evento ? 'El título de tu evento' : 'El título de tu oferta'));
    const dt = String(f.get('discount_type') || '');
    const dv = String(f.get('discount_value') || '').trim();
    const precioTxt = String(f.get('price') || '').trim();
    const etiqueta = dt ? etiquetaDescuento({ type: dt, value: dt === 'other' ? dv : Number(dv.replace(',', '.')) || dv })
      : precioTxt ? fmtMoney(Math.round(parseFloat(precioTxt.replace(',', '.')) * 100)) : '';
    const foto = images.find((u) => !isVideo(u));
    const t = estilo.template;
    $('#estiloPrev', v).innerHTML = `
      <div class="ep ep-${t}" style="--ac:${acento};--on:${sobre}">
        <div class="ep-panel">
          <b class="ep-biz">${esc(BIZ.name)}</b>
          <span class="ep-title">${esc(titulo)}</span>
          ${etiqueta ? `<span class="ep-tag">${esc(etiqueta)}</span>` : ''}
          <span class="ep-cta">${esc(I18N.lang === 'en' ? 'Get the code' : 'Conseguir el código')}</span>
        </div>
      </div>`;
    // La foto va por el DOM, no dentro del atributo: una comilla en la
    // dirección cerraba el `url('…')` (el escape HTML se deshace antes de
    // leer el CSS). Solo https.
    if (foto && /^https:\/\//i.test(foto)) $('.ep', $('#estiloPrev', v)).style.backgroundImage = `url(${JSON.stringify(foto)})`;
    $('#plantillasEstilo', v).innerHTML = PLANTILLAS.map(([k, n]) =>
      `<button type="button" class="${estilo.template === k ? 'on' : ''}" data-plantilla="${k}">${esc(I18N.t(n))}</button>`).join('');
    $('#colores', v).innerHTML = COLORES.map((c, i) =>
      `<button type="button" class="color ${(estilo.accent || '#FF4D6D') === c ? 'on' : ''}" data-color="${i === 0 ? '' : c}" style="background:${c}" aria-label="${c}"></button>`).join('');
    $$('[data-plantilla]', v).forEach((b) => { b.onclick = () => { estilo.template = b.dataset.plantilla; pintaEstilo(); }; });
    $$('[data-color]', v).forEach((b) => { b.onclick = () => { estilo.accent = b.dataset.color || null; pintaEstilo(); }; });
  };
  $('#form').addEventListener('input', (e) => {
    if (['title', 'kind', 'price', 'discount_type', 'discount_value'].includes(e.target.name)) pintaEstilo();
  });
  pintaEstilo();

  // ── Plantillas ──────────────────────────────────────────────────────────
  const campo = (n) => $(`[name=${n}]`, v);
  const pon = (n, val) => { const el = campo(n); if (el) el.value = val ?? ''; };
  const precioTxt = (x) => (x == null || x === '' ? '' : String(x).replace('.', ','));
  const aplicarIdea = (t) => {
    pon('title', en ? t.en : t.es);
    const desc = en ? t.descEn : t.descEs;
    if (desc) pon('description', desc);
    pon('discount_type', t.discount === 'none' ? '' : t.discount);
    pon('discount_value', precioTxt(t.value));
    if (t.kind === 'flash_offer') {
      const ahora = new Date();
      pon('start', toLocalInput(ahora.toISOString()));
      pon('end', toLocalInput(new Date(ahora.getTime() + t.hours * 3600e3).toISOString()));
    }
    syncDiscount();
  };
  // Lo que guarda la app como plantilla (offer_templates.data): todo menos
  // fechas y estado. Mismo formato en los dos lados.
  const aplicarGuardada = (t) => {
    const d = t.data || {};
    pon('kind', d.kind === 'future_event' ? 'future_event' : 'flash_offer');
    pon('title', d.title); pon('description', d.description); pon('terms', d.terms);
    pon('price', d.price); pon('external_url', d.external_url);
    pon('max_redemptions', d.max_redemptions); pon('max_per_user', d.max_per_user || 1);
    pon('holds_seats', d.holds_seats === false ? 'no' : 'si');
    pon('code_ttl_minutes', d.code_ttl_minutes ?? '');
    campo('adults_only').checked = !!d.adults_only;
    campo('reservations_enabled').checked = !!d.reservations_enabled;
    const ds = d.discount || {};
    pon('discount_type', ds.type || '');
    pon('discount_value', ds.type === 'other' ? ds.value : precioTxt(ds.value));
    pon('prior_price', ds.compare_at_cents != null ? (ds.compare_at_cents / 100).toFixed(2).replace('.', ',') : '');
    pon('alcohol', ds.alcohol === true ? 'yes' : ds.alcohol === false ? 'no' : '');
    images = [...(d.images || [])];
    if (d.style) estilo = limpiaEstilo(d.style);
    renderPhotos(); syncKind(); syncDiscount(); pintaEstilo();
  };
  $$('[data-idea]', v).forEach((b) => { b.onclick = () => { aplicarIdea(ideas[+b.dataset.idea]); toast('Plantilla aplicada: repasa precio y hora'); }; });
  const borraTpl = $('#borraTpl', v);
  if (borraTpl) {
    borraTpl.onclick = async () => {
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
      toast(ids.length === 1 ? 'Plantilla borrada' : 'Plantillas borradas');
      route();
    };
  }
  $$('[data-tpl]', v).forEach((b) => { b.onclick = () => { aplicarGuardada(guardadas[+b.dataset.tpl]); toast('Plantilla aplicada: repasa precio y hora'); }; });
  // Desde «Primeros pasos»: ya rellena con la primera de su gremio.
  if (!id && /[?&]idea=1\b/.test(location.hash) && ideas.length) aplicarIdea(ideas[0]);

  $('#saveTpl', v).onclick = async () => {
    const f = new FormData($('#form'));
    const title = String(f.get('title') || '').trim();
    if (!title) { toast('Pon al menos el título antes de guardarla.', true); return; }
    const r = await modal({ title: 'Guardar como plantilla', fields: [{ name: 'name', label: 'Nombre de la plantilla', value: title, required: true, maxlength: 60 }] });
    if (!r || !r.name) return;
    const dType = f.get('discount_type');
    const dVal = String(f.get('discount_value') || '').trim();
    const priorRaw = String(f.get('prior_price') || '').replace(',', '.');
    const data = {
      kind: f.get('kind'),
      title,
      description: String(f.get('description') || '').trim() || null,
      terms: String(f.get('terms') || '').trim() || null,
      discount: dType ? {
        type: dType,
        value: dType === 'other' || dType === 'free' ? (dVal || null) : (dVal ? Number(dVal.replace(',', '.')) : null),
        ...(dType === 'fixed' ? { currency: 'EUR' } : {}),
        ...(priorRaw && ['percent', 'fixed'].includes(dType) ? { compare_at_cents: Math.round(parseFloat(priorRaw) * 100) } : {}),
        ...(dType === '2x1' && f.get('alcohol') ? { alcohol: f.get('alcohol') === 'yes' } : {}),
      } : null,
      price: String(f.get('price') || '').trim(),
      external_url: String(f.get('external_url') || '').trim() || null,
      max_redemptions: String(f.get('max_redemptions') || '').trim() || null,
      holds_seats: f.get('holds_seats') !== 'no',
      max_per_user: Number(f.get('max_per_user') || 1),
      adults_only: campo('adults_only').checked,
      style: { template: estilo.template, ...(estilo.accent ? { accent: estilo.accent } : {}) },
      code_ttl_minutes: f.get('code_ttl_minutes') ? Number(f.get('code_ttl_minutes')) : null,
      reservations_enabled: f.get('kind') !== 'flash_offer' && campo('reservations_enabled').checked,
      images,
    };
    try {
      await rpc('save_offer_template', { p_business: BIZ.id, p_name: r.name, p_data: data });
      toast('Plantilla guardada');
    } catch (err) { toast(friendly(err.message), true); }
  };

  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    $('#formErr').textContent = '';
    const f = new FormData($('#form'));
    const flash = f.get('kind') === 'flash_offer';
    // Mismas reglas que la app (y que la base).
    if (String(f.get('title') || '').trim().length < 3) {
      $('#formErr').textContent = I18N.t('El título necesita al menos 3 caracteres.'); return;
    }
    if (f.get('discount_type') === 'other' && String(f.get('discount_value') || '').trim().length > 24) {
      $('#formErr').textContent = I18N.t('El descuento «Otro» cabe en 24 caracteres («2ª unidad −50 %»).'); return;
    }
    const programada = fromLocalInput(f.get('publish_at'));
    if (programada && new Date(programada) <= new Date()) {
      $('#formErr').textContent = I18N.t('La hora de publicación tiene que ser futura.'); return;
    }
    if (programada && new Date(programada) > Date.now() + 60 * 864e5) {
      $('#formErr').textContent = I18N.t('Se puede dejar programada como mucho a 60 días.'); return;
    }
    // 8 · Fechas con sentido, como el selector de la app (de ayer a un año).
    {
      const ini0 = fromLocalInput(f.get('start'));
      const antes0 = id && toLocalInput(o.kind === 'future_event' ? o.event_at : o.redeem_start_at) === f.get('start');
      if (ini0 && !antes0 && (new Date(ini0) < Date.now() - 864e5 || new Date(ini0) > Date.now() + 365 * 864e5)) {
        $('#formErr').textContent = I18N.t('La fecha tiene que estar entre ayer y dentro de un año.'); return;
      }
    }
    const price = (f.get('price') || '').toString().replace(',', '.');
    const dType = f.get('discount_type');
    const dValue = (f.get('discount_value') || '').toString().replace(',', '.');
    const priorRaw = (f.get('prior_price') || '').toString().replace(',', '.');
    const prior = priorRaw ? Math.round(parseFloat(priorRaw) * 100) : null;
    if (['percent', 'fixed'].includes(dType) && !prior) {
      $('#formErr').textContent = I18N.t('Pon el precio anterior: la ley obliga a enseñarlo junto al descuento.');
      return;
    }
    // El 2x1 obliga a declarar si hay alcohol: por el texto no se sabe
    // («2x1 en bebidas» no dice nada) y la multa se la lleva el negocio.
    const alcohol = f.get('alcohol');
    if (dType === '2x1' && !alcohol) {
      $('#formErr').textContent = I18N.t('Di si el 2x1 incluye bebidas alcohólicas.');
      return;
    }
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

    const data = {
      business_id: BIZ.id,
      kind: f.get('kind'),
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
      redeem_start_at: flash ? fromLocalInput(f.get('start')) : null,
      redeem_end_at: flash ? fromLocalInput(f.get('end')) : null,
      event_at: flash ? null : fromLocalInput(f.get('start')),
      event_end_at: flash ? null : fromLocalInput(f.get('end')),
      max_redemptions: f.get('max_redemptions') ? Number(f.get('max_redemptions')) : null,
      holds_seats: f.get('holds_seats') !== 'no',
      max_per_user: Number(f.get('max_per_user') || 1),
      code_ttl_minutes: f.get('code_ttl_minutes') ? Number(f.get('code_ttl_minutes')) : null,
      reservations_enabled: !flash && $('[name=reservations_enabled]').checked,
      max_seats: !flash && $('[name=reservations_enabled]').checked
        ? Number(f.get('max_seats') || 1) : 1,
      adults_only: $('[name=adults_only]').checked,
      audience: f.get('audience') || 'all',
      // Sin marcar: borrador, salvo que ya estuviera terminada, agotada o
      // cancelada (se queda así; editarla no la saca del cajón).
      status: programada ? 'draft' : ($('[name=publish]').checked ? 'active'
        : (id && ['expired', 'sold_out', 'cancelled'].includes(o.status) ? o.status : 'draft')),
      publish_at: programada,
      style: { template: estilo.template, ...(estilo.accent ? { accent: estilo.accent } : {}) },
    };
    // Los mismos avisos que la app.
    if (flash ? (!data.redeem_start_at || !data.redeem_end_at) : !data.event_at) {
      $('#formErr').textContent = I18N.t('Falta cuándo: elige el inicio (y el final, si es una oferta flash).'); return;
    }
    const [ini, fin] = flash ? [data.redeem_start_at, data.redeem_end_at] : [data.event_at, data.event_end_at];
    if (fin && new Date(fin) <= new Date(ini)) {
      $('#formErr').textContent = I18N.t('El fin debe ser posterior al inicio.'); return;
    }
    try {
      let offerId = id;
      if (id) {
        const { error } = await sb.from('offers').update(data).eq('id', id);
        if (error) throw error;
        const { error: eFotos } = await sb.from('offer_images').delete().eq('offer_id', id);
        if (eFotos) throw eFotos;
      } else {
        const { data: row, error } = await sb.from('offers').insert(data).select('id').single();
        if (error) throw error;
        offerId = row.id;
      }
      if (images.length) {
        const { error: eFotos2 } = await sb.from('offer_images').insert(images.map((url, i) => ({ offer_id: offerId, url, position: i })));
        if (eFotos2) throw eFotos2;
      }
      toast(id ? 'Cambios guardados' : 'Publicado');
      location.hash = '#/publicaciones';
    } catch (err) {
      $('#formErr').textContent = I18N.t(friendly(err.message));
    }
  };
}

// ── Validar códigos ─────────────────────────────────────────────────────────
/** Por qué no se ha podido validar un código, dicho para la puerta. Lo usan
 * el escáner y «Dar entrada» en Asistentes. */
const ERR_VALIDAR = {
  invalid_code: 'Ese código no existe.',
  not_authorized: 'Ese código no es de tu negocio.',
  already_validated: 'Ese código ya se usó.',
  code_expired: 'El código ha caducado: pide que generen otro.',
  // Anulada por quien reservó o al cancelar el evento: su plaza ya no es suya.
  code_cancelled: 'Reserva anulada: este código ya no vale.',
  sold_out: 'Aforo completo: ya han entrado todas las plazas.',
  rate_limited: 'Demasiados intentos seguidos. Espera un momento.',
};

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
  if (ajeno && r.business_name) {
    lineas.push(ms('storefront') + esc(bi(`Es de ${r.business_name}, no de tu negocio.`, `It belongs to ${r.business_name}, not your business.`)));
  }
  if (r.validated_at && estado !== 'ready') {
    lineas.push(ms('check_circle') + esc(`${bi('Se validó', 'Validated')}: ${horaCodigo(r.validated_at)}${r.validated_by_name
      ? ` · ${bi('por', 'by')} ${r.validated_by_name}` : ''}`));
  }
  if (r.error === 'code_expired' && r.expires_at) {
    lineas.push(ms('timer_off') + esc(`${bi('Caducó', 'Expired')}: ${horaCodigo(r.expires_at)}`));
  }
  const plazas = (r.seats || 1) > 1 && !ajeno;
  return `<div class="codigo-card ${estado}">
    <div class="cod-top">${foto}<div class="cod-cab">
      ${tipo || r.business_name ? `<span class="cod-tipo">${esc([tipo, r.business_name].filter(Boolean).join(' · '))}</span>` : ''}
      <h2 class="cod-titulo">${esc(titulo)}</h2></div></div>
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

PAGES.validar = async (v) => {
  v.innerHTML = `
    <div class="page-head"><h1>Validar códigos</h1></div>
    ${helpBox('¿Cómo funciona?', '<p>Escanea el QR con la cámara (la del móvil o la del portátil) o escribe el código que la persona tiene debajo del QR. Cada código vale una vez: al validarlo queda marcado y el aforo baja.</p><p>Si es una reserva para varios, te decimos cuántas personas entran con ese código.</p>')}
    <div class="scan-box">
      <button class="btn" id="camara" type="button">${ms('photo_camera')}Escanear con la cámara</button>
      <div class="camara" id="camara-caja" hidden><video id="video" muted playsinline></video><span class="mira" aria-hidden="true"></span></div>
      <input id="code" placeholder="Código o enlace del QR" autocomplete="off" autofocus>
      <button class="btn primary" id="go">Validar</button>
      <div id="result" aria-live="assertive"></div>
      <div id="cola"></div>
    </div>
    <div class="card" style="margin-top:18px"><h2>Últimos validados</h2><div id="recent"></div></div>`;

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
        const r = await rpc('validate_redemption', { p_code: item.code });
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

  const loadRecent = async () => {
    const offers = await rpc('my_business_offers', { p_id: BIZ.id });
    const rows = [];
    for (const o of offers.slice(0, 5)) {
      const att = await rpc('offer_attendees', { p_offer: o.id }).catch(() => []);
      att.filter((a) => a.status === 'validated').slice(0, 5).forEach((a) => rows.push({ ...a, offer: o.title }));
    }
    rows.sort((a, b) => new Date(b.validated_at) - new Date(a.validated_at));
    $('#recent').innerHTML = table({
      cols: [
        { h: 'Cuándo', r: (r) => fmtDate(r.validated_at) },
        { h: 'Publicación', r: (r) => esc(r.offer) },
        { h: 'Persona', r: (r) => esc(r.user_name || 'Invitada') },
      ],
      rows: rows.slice(0, 15),
      empty: 'Todavía no has validado ningún código.',
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
      pintaResultado(res, res.ok ? 'ok' : 'bad');
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
        : `${ms('cancel')}${esc(I18N.t(ERR_VALIDAR[res.error] || friendly(res.error)))}${!res.offer_title && res.validated_at
          ? `<small>${esc(bi('Se validó el', 'Validated on'))} ${esc(fmtDate(res.validated_at))}</small>` : ''}`;
    $('#result').innerHTML = `<div class="scan-result ${estado === 'ready' ? 'warn' : estado}">${cab}</div>
      ${res.offer_title ? tarjetaCodigo(res, estado) : ''}
      ${estado === 'ready' ? `<button class="btn primary grande" id="validaYa" type="button">${ms('check')}${esc(I18N.t('Validar'))}</button>` : ''}`;
    const b = $('#validaYa');
    if (b) b.onclick = () => { $('#code').value = res.code_input || $('#code').value; validate(); };
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
  pintaCola();
  enviaCola();
  $('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') validate(); });
  // Desde klendar.app/r/<código> (el QR escaneado con la cámara del móvil,
  // sin la app): el código llega puesto y se enseña qué es; se valida con el
  // botón «Validar». La cámara de aquí sí valida directamente.
  const desdeQr = new URLSearchParams(location.hash.split('?')[1] || '').get('code');
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
        { h: 'Persona', r: (a) => `<b class="title">${esc(a.user_name || I18N.t('Invitada'))}</b><span class="sub mono">${esc(a.code.slice(0, 8).toUpperCase())}</span>` },
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
          if (!res?.ok) { toast(ERR_VALIDAR[res?.error] || friendly(res?.error), true); b.disabled = false; return; }
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
const estadoTarjeta = (c) => `<span class="tag ${c.is_active ? 'ok' : 'dim'}">${esc(I18N.t(c.is_active ? 'Encendida' : 'Apagada'))}</span>`;
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
  const ofertas = d.offers || [];
  const filtro = c?.applies_to || 'all';
  const cats = new Set(c?.category_ids || []);
  const offs = new Set(c?.offer_ids || []);
  v.innerHTML = `
    <p class="crumbs"><a href="#/sellos">${esc(I18N.t('Tarjetas de sellos'))}</a>${c ? ` · <a href="#/sellos/${esc(c.id)}">${esc(c.name)}</a>` : ''}</p>
    <div class="page-head"><h1>${c ? 'Editar tarjeta' : 'Nueva tarjeta'}</h1></div>
    <form id="f" class="form" novalidate>
      <label class="f full"><span>Nombre</span>
        <input name="name" maxlength="40" required placeholder="Cafés" value="${esc(c?.name || '')}">
        <small class="muted">Lo ve la gente: «Cafés», «Menús», «Manicuras»…</small></label>
      <label class="f"><span>Sellos para el premio</span><select name="goal">
        ${Array.from({ length: 19 }, (_, i) => i + 2).map((n) => `<option value="${n}" ${Number(c?.goal || 10) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f full"><span>Premio</span>
        <input name="reward" maxlength="80" required placeholder="Un café con leche gratis" value="${esc(c?.reward || '')}"></label>
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
        <input type="checkbox" name="is_active" ${!c || c.is_active ? 'checked' : ''}>
        <span>Encendida <small class="muted">Si la apagas, no se dan sellos nuevos, pero nadie pierde los suyos.</small></span></label>
      <div class="full"><button class="btn primary" type="submit">${c ? 'Guardar' : 'Crear la tarjeta'}</button> <span id="msg" class="muted" role="status"></span></div>
      ${c ? '<div class="full"><button class="btn bad ghost" type="button" id="borrar">Borrar la tarjeta</button></div>' : ''}
    </form>`;

  const f = $('#f', v);
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
    toast('Guardado');
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
  const gente = (d.customers || []).map((p) => ({ ...p, goal: c.goal }));
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
    gente.splice(0, gente.length, ...(n.customers || []).map((p) => ({ ...p, goal: c.goal })));
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
    const puedeDar = p.stamps >= c.goal || p.rewards_pending > 0;
    caja.innerHTML = `<div class="card persona-sellos">
      <div class="page-head" style="margin:0"><h2 style="margin:0">${esc(nombre)}</h2><span class="spacer"></span>
        <button class="btn sm ghost" type="button" id="cierra">${esc(I18N.t('Cerrar'))}</button></div>
      ${huecos(p.stamps, c.goal)}
      <p><b>${esc(premiosTxt({ ...p, goal: c.goal }))}</b></p>
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
          : bi(`«${c.reward}». Se gastan ${c.goal} sellos y queda apuntado como entregado.`, `“${c.reward}”. ${c.goal} stamps are used and it is recorded as handed over.`)),
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

PAGES.carta = async (v) => {
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  const ficha = await sb.from('businesses')
    .select('menu_url, menu_images').eq('id', BIZ.id).maybeSingle();
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
              { h: 'Plato', r: (it) => `${it.image_url ? `<img class="thumb" src="${esc(it.image_url)}" alt="" loading="lazy">` : ''}<b class="title">${esc(it.name)}</b>${it.description ? `<span class="sub">${esc(it.description)}</span>` : ''}` },
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
          ${canManage ? `<p style="margin:10px 0 0"><button class="btn sm" data-item-add="${si}">Añadir plato</button></p>` : ''}
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
      if (!await confirmDlg('Borrar sección', bi(`Se quita «${esc(carta[i].name)}» con sus platos. No se guarda hasta que le des a «Guardar la carta».`, `“${esc(carta[i].name)}” and its dishes are removed. Nothing is saved until you press “Save the menu”.`), { danger: true, submit: 'Borrar' })) return;
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
        title: ii == null ? 'Nuevo plato' : 'Editar plato',
        fields: [
          { name: 'name', label: 'Nombre', value: it.name, required: true, placeholder: 'Tortilla de patata', maxlength: 80 },
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

const SEMANA = [
  [1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'],
  [5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo'],
];

/** «09:00-14:00, 17:00-21:00» ⇄ [["09:00","14:00"],["17:00","21:00"]].
 *
 * Es el mismo formato que guarda la app; escribirlo a mano es más rápido que
 * pelearse con catorce desplegables, y lo que no se entienda se ignora en vez
 * de romper el horario entero. */
const horarioATexto = (tramos) => (tramos || []).map((t) => `${t[0]}-${t[1]}`).join(', ');
const textoAHorario = (txt) => String(txt || '').split(',')
  .map((x) => x.trim()).filter(Boolean)
  .map((x) => x.split('-').map((y) => y.trim()))
  .filter((p) => p.length === 2 && /^\d{1,2}:\d{2}$/.test(p[0]) && /^\d{1,2}:\d{2}$/.test(p[1]))
  .map((p) => p.map((y) => (y.length === 4 ? '0' + y : y)));

PAGES.cartel = async (v, offerId) => {
  const todas = await rpc('my_business_offers', { p_id: BIZ.id });
  const o = (todas || []).find((x) => x.id === offerId);
  if (!o) { location.hash = '#/publicaciones'; return; }
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

PAGES.ficha = async (v) => {
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  // El NIF no se puede leer de la tabla (no es público): lo da
  // `business_private` a quien gestiona.
  const [{ data: b }, cats, privado] = await Promise.all([
    sb.from('businesses').select('id, name, description, category_id, address, city, phone, website, contact_email, social_links, logo_url, cover_image_url, gallery, opening_hours, adults_only, verification_status, rejection_reason, is_active, paused_until').eq('id', BIZ.id).maybeSingle(),
    sb.from('categories').select('id, slug, names, position').order('position', { ascending: true })
      .then(({ data }) => data || []),
    canManage ? rpc('business_private', { p_id: BIZ.id }).catch(() => null) : null,
  ]);
  if (!b) { v.innerHTML = '<div class="card">No hemos podido cargar tu ficha.</div>'; return; }
  b.tax_id = privado?.tax_id || '';

  const redes = b.social_links || {};
  const horas = b.opening_hours || {};
  let logo = b.logo_url || '';
  let portada = b.cover_image_url || '';
  let galeria = b.gallery || [];

  const pinta = () => {
    v.innerHTML = `
      <div class="page-head"><h1>Tu ficha</h1><span class="spacer"></span>
        <a class="btn sm ghost" href="#/cartel-local">Imprimir el cartel del local</a>
        <a class="btn sm" href="https://klendar.app/b/${esc(BIZ.id)}" target="_blank" rel="noopener">Ver cómo se ve ↗</a></div>
      ${helpBox('¿Qué es esto?', bi('<p>Lo que ve la gente cuando entra en tu negocio: el nombre, de qué va, dónde estás, cómo llamarte y tus horarios. Es la misma ficha que editas desde la app.</p><p>La <b>dirección</b> se busca en el mapa al guardar. Si el punto no queda donde debe, arrastra la chincheta en «Ubicación en el mapa».</p>',
      '<p>What people see when they open your business: the name, what you do, where you are, how to call you and your opening hours. It\'s the same page you edit from the app.</p><p>The <b>address</b> is looked up on the map when you save. If the pin isn\'t in the right place, drag it in “Location on the map”.</p>'))}
      <form id="f" class="form" novalidate>
        <label class="f"><span>Nombre *</span><input name="name" value="${esc(b.name || '')}" required maxlength="80" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Categoría</span><select name="category_id" ${canManage ? '' : 'disabled'}>
          ${(cats || []).map((c) => `<option value="${esc(c.id)}" ${c.id === b.category_id ? 'selected' : ''}>${esc(c.names?.[I18N.lang] || c.names?.es || c.slug)}</option>`).join('')}</select></label>
        <label class="f full"><span>De qué va <small>(dos líneas bastan)</small></span><textarea name="description" maxlength="500" ${canManage ? '' : 'disabled'}>${esc(b.description || '')}</textarea></label>
        <label class="f"><span>Dirección *</span><input name="address" value="${esc(b.address || '')}" maxlength="120" required ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Ciudad *</span><input name="city" value="${esc(b.city || '')}" maxlength="60" required ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Teléfono</span><input name="phone" value="${esc(b.phone || '')}" maxlength="20" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Web</span><input name="website" type="url" value="${esc(b.website || '')}" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Correo de contacto <small>(lo ven los clientes: mejor uno del negocio que el tuyo personal)</small></span><input name="contact_email" type="email" maxlength="254" placeholder="hola@tunegocio.com" value="${esc(b.contact_email || '')}" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>NIF/CIF</span><input name="tax_id" value="${esc(b.tax_id || '')}" maxlength="20" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Instagram</span><input name="instagram" value="${esc(redes.instagram || '')}" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>TikTok</span><input name="tiktok" value="${esc(redes.tiktok || '')}" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Facebook</span><input name="facebook" value="${esc(redes.facebook || '')}" ${canManage ? '' : 'disabled'}></label>
        <label class="f full" style="grid-template-columns:auto 1fr;align-items:center">
          <input type="checkbox" name="adults_only" ${b.adults_only ? 'checked' : ''} ${canManage ? '' : 'disabled'}>
          <span>Solo para mayores de 18 (todo lo que publiques quedará marcado)</span></label>
        ${canManage ? '<div class="full"><button class="btn primary" type="submit">Guardar la ficha</button> <span id="msg" class="muted"></span></div>' : ''}
      </form>

      ${canManage ? `<div class="card"><h2>Ubicación en el mapa</h2>
        <p class="muted" style="margin:0 0 10px">Es lo que usa la app para decir a qué distancia estás. Arrastra la chincheta hasta la puerta y guarda.</p>
        <div class="mapa" id="mapa-ficha"></div>
        <p style="margin:10px 0 0"><button class="btn sm" id="g-punto" disabled>Guardar la ubicación</button> <span class="muted" id="msgp"></span></p></div>` : ''}

      <div class="card"><h2>Horarios</h2>
        <p class="muted" style="margin:0 0 10px">Escribe los tramos como «09:00-14:00, 17:00-21:00». Déjalo vacío el día que cierres.</p>
        <form id="h" class="form">
          ${SEMANA.map(([n, nombre]) => `<label class="f"><span>${nombre}</span>
            <input name="d${n}" value="${esc(horarioATexto(horas[String(n)]))}" placeholder="09:00-14:00, 17:00-21:00" ${canManage ? '' : 'disabled'}></label>`).join('')}
          ${canManage ? '<div class="full"><button class="btn primary" type="submit">Guardar horarios</button> <span id="msgh" class="muted"></span></div>' : ''}
        </form></div>

      <div class="card"><h2>Imágenes</h2>
        <p class="muted" style="margin:0 0 10px">${bi('El <b>logo</b> sale redondo y pequeño; la <b>portada</b>, ancha arriba del todo. La galería son fotos del sitio.', 'The <b>logo</b> is shown small and round; the <b>cover</b>, wide at the very top. The gallery is photos of the place.')}</p>
        <div class="thumbs">
          <div class="thumb"><img src="${esc(logo || '/assets/symbol.png')}" alt="">
            ${canManage ? '<button class="btn sm" data-img="logo">Cambiar logo</button>' : ''}</div>
          <div class="thumb"><img src="${esc(portada || '/assets/og.png')}" alt="">
            ${canManage ? '<button class="btn sm" data-img="cover">Cambiar portada</button>' : ''}</div>
        </div>
        <h3 style="margin:16px 0 8px">Galería</h3>
        <div class="thumbs">${galeria.map((u, i) => `<div class="thumb"><img src="${esc(u)}" alt="">
          ${canManage ? `<button class="btn sm bad ghost" data-gal-del="${i}">Quitar</button>` : ''}</div>`).join('')}</div>
        ${canManage ? (galeria.length < TOPE.galeria
          ? `<p style="margin:10px 0 0"><button class="btn sm" data-img="gallery">Añadir fotos</button> <span class="muted small">${esc(topeHasta(TOPE.galeria))}</span></p>`
          : `<p class="muted" style="margin:10px 0 0">${esc(topeLleno(TOPE.galeria))}</p>`) : ''}</div>`;

    if (!canManage) return;

    // El mapa de la ficha: el punto de ahora, y guardar si se mueve.
    (async () => {
      const perfil = await rpc('business_profile', { p_id: BIZ.id }).catch(() => null);
      const actual = Array.isArray(perfil) ? perfil[0] : perfil;
      let nuevo = null;
      const caja = $('#mapa-ficha', v);
      if (!caja || caja.dataset.listo) return;
      caja.dataset.listo = '1';
      await mapaPunto(caja, actual && actual.lat != null ? { lat: actual.lat, lng: actual.lng } : null, (p) => {
        nuevo = p;
        $('#g-punto', v).disabled = false;
        $('#msgp', v).textContent = I18N.t('Sin guardar');
      });
      $('#g-punto', v).onclick = async () => {
        if (!nuevo) return;
        try {
          await rpc('update_business', { p_id: BIZ.id, p_patch: { lat: nuevo.lat, lng: nuevo.lng } });
          // Otro sitio puede ser otra zona (la base la recalcula igual).
          BIZ.time_zone = KZ.porCoordenadas(nuevo.lat, nuevo.lng); TZ = KZ.de(BIZ);
          $('#g-punto', v).disabled = true;
          $('#msgp', v).textContent = I18N.t('Guardada');
          toast('Ubicación guardada');
        } catch (err) { toast(friendly(err.message), true); }
      };
    })();

    $('#f', v).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      // Lo mismo que la app (y que el alta): nombre de dos letras o más, y
      // dirección y ciudad obligatorias; «Obligatorio» debajo de cada campo.
      const obligatorio = KL_VALIDA.MSG[I18N.lang === 'en' ? 'en' : 'es'].obligatorio;
      const faltan = [
        ['name', String(f.get('name') || '').trim().length < 2],
        ['address', !String(f.get('address') || '').trim()],
        ['city', !String(f.get('city') || '').trim()],
      ];
      for (const [campo, falta] of faltan) KL_CAMPO(e.target.elements[campo], falta ? obligatorio : null);
      const primero = faltan.find(([, falta]) => falta);
      if (primero) { e.target.elements[primero[0]].focus(); return; }
      const patch = {
        name: String(f.get('name') || '').trim(),
        category_id: f.get('category_id') || null,
        description: String(f.get('description') || '').trim(),
        address: String(f.get('address') || '').trim(),
        city: String(f.get('city') || '').trim(),
        phone: String(f.get('phone') || '').trim(),
        website: String(f.get('website') || '').trim(),
        contact_email: String(f.get('contact_email') || '').trim(),
        tax_id: String(f.get('tax_id') || '').trim(),
        social_links: {
          instagram: String(f.get('instagram') || '').trim(),
          tiktok: String(f.get('tiktok') || '').trim(),
          facebook: String(f.get('facebook') || '').trim(),
        },
        adults_only: $('[name=adults_only]', v).checked,
      };
      // Si la dirección ha cambiado, se busca el punto en el mapa.
      if (patch.address && patch.address !== (b.address || '')) {
        const punto = await geocodifica(`${patch.address}, ${patch.city || ''}`);
        if (punto) { patch.lat = punto.lat; patch.lng = punto.lng; }
        else toast('No hemos encontrado esa dirección en el mapa: arrastra la chincheta en «Ubicación en el mapa».', true);
      }
      try {
        await rpc('update_business', { p_id: BIZ.id, p_patch: patch });
        // El nombre nuevo, ya en el selector de locales y en el resumen; y la
        // zona, si la dirección nueva ha movido el punto.
        BIZ.name = patch.name;
        if (patch.lat != null) { BIZ.time_zone = KZ.porCoordenadas(patch.lat, patch.lng); TZ = KZ.de(BIZ); }
        renderBizPicker();
        $('#msg', v).textContent = 'Guardada';
        toast('Ficha guardada');
      } catch (err) { toast(friendly(err.message), true); }
    };

    $('#h', v).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const nuevo = {};
      for (const [n] of SEMANA) nuevo[String(n)] = textoAHorario(f.get(`d${n}`));
      try {
        await rpc('update_business', { p_id: BIZ.id, p_patch: { opening_hours: nuevo } });
        $('#msgh', v).textContent = 'Guardados';
        toast('Horarios guardados');
      } catch (err) { toast(friendly(err.message), true); }
    };

    $$('[data-img]', v).forEach((btn) => { btn.onclick = () => {
      const que = btn.dataset.img;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = que === 'gallery';
      input.onchange = async () => {
        const nuevas = [];
        const elegidas = que === 'gallery' ? caben(input.files, galeria.length, TOPE.galeria) : [...input.files].slice(0, 1);
        for (const elegida of elegidas) {
          const f = await KFotos.reduce(elegida, que === 'logo' ? KFotos.TAM.logo : KFotos.TAM.foto);
          if (f.size > 5 * 1024 * 1024) { toast('Esa foto pesa más de 5 MB.', true); continue; }
          const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `${BIZ.id}/${que}-${crypto.randomUUID()}.${ext}`;
          const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
          if (error) { toast(friendly(error.message), true); continue; }
          nuevas.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
        }
        if (!nuevas.length) return;
        const patch = que === 'logo' ? { logo_url: nuevas[0] }
          : que === 'cover' ? { cover_image_url: nuevas[0] }
            : { gallery: [...galeria, ...nuevas] };
        try {
          await rpc('update_business', { p_id: BIZ.id, p_patch: patch });
          if (que === 'logo') logo = nuevas[0];
          else if (que === 'cover') portada = nuevas[0];
          else galeria = [...galeria, ...nuevas];
          toast('Guardado'); pinta();
        } catch (err) { toast(friendly(err.message), true); }
      };
      input.click();
    }; });

    $$('[data-gal-del]', v).forEach((btn) => { btn.onclick = async () => {
      const i = +btn.dataset.galDel;
      const siguiente = galeria.filter((_, j) => j !== i);
      try {
        await rpc('update_business', { p_id: BIZ.id, p_patch: { gallery: siguiente } });
        galeria = siguiente; toast('Quitada'); pinta();
      } catch (err) { toast(friendly(err.message), true); }
    }; });
  };

  pinta();
};

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
        intro: esc(I18N.t('Le llega una invitación (en la app y por correo) que tiene que aceptar. Si aún no tiene cuenta, la verá al crearla con ese correo. Caduca a los 14 días.')),
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
        <input name="regalo" maxlength="80" placeholder="Ej.: Un postre gratis" value="${esc(d.gift || '')}" autocomplete="off" ${ro}></label>
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
    toast('Guardado');
  };
};

// ── Informe ─────────────────────────────────────────────────────────────────
// Todo junto y exportable: es lo que el negocio le pasa a su gestor y lo que
// mira cuando quiere saber si esto le sirve para algo.
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

  v.innerHTML = `
    <div class="page-head"><h1>Informe</h1><span class="spacer"></span>
      ${[7, 30, 90, 365].map((d) => `<a class="btn sm ${d === days ? '' : 'ghost'}" href="#/informe/${d}">${d === 365 ? bi('1 año', '1 year') : bi(`${d} días`, `${d} days`)}</a>`).join(' ')}
    </div>
    <div class="card"><h2>El periodo en cuatro cifras</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(t.views)}</b><span>Vistas</span></div>
        <div class="kpi"><b>${fmtNum(t.codes)}</b><span>Códigos generados</span></div>
        <div class="kpi"><b>${fmtNum(t.redeemed)}</b><span>Canjes validados</span></div>
        <div class="kpi"><b>${pct(t.redeemed, t.codes)}</b><span>De código a canje</span></div>
      </div>
      <p class="muted" style="margin:10px 0 0">${bi(`<b>${fmtNum(t.unused)}</b> ${t.unused === 1 ? 'código se quedó' : 'códigos se quedaron'} sin usar.${best ? ` La hora a la que más se canjea es a las <b>${String(best.hour).padStart(2, '0')}:00</b>.` : ''}`, `<b>${fmtNum(t.unused)}</b> ${t.unused === 1 ? 'code was' : 'codes were'} never used.${best ? ` The busiest redemption hour is <b>${String(best.hour).padStart(2, '0')}:00</b>.` : ''}`)}</p>
    </div>

    <div class="card"><h2>Día a día</h2>
      <div class="spark">${(r.daily || []).map((d) => `<i title="${d.day}: ${d.views} ${bi('vistas', 'views')}, ${d.redeemed} ${bi('canjes', 'redemptions')}" style="height:${Math.round((d.views / maxDay) * 100)}%"><u style="height:${d.views ? Math.round((d.redeemed / Math.max(d.views, 1)) * 100) : 0}%"></u></i>`).join('')}</div>
      <p class="muted" style="margin:8px 0 0">Cada barra es un día: la altura son las vistas y la parte rellena, los canjes.</p>
    </div>

    ${audienciaHtml(aud)}

    <div class="card"><h2>Por publicación</h2><div class="actions" style="margin-bottom:10px"><button class="btn sm" id="csvOffers">Descargar CSV</button></div>
      ${table({
        cols: [
          { h: 'Publicación', r: (o) => `<b class="title">${esc(o.title)}</b><span class="sub">${esc(LABELS[o.kind] || o.kind)} · ${fmtDate(o.starts_at)}</span>` },
          { h: 'Precio', num: true, r: (o) => fmtMoney(o.price_cents, o.currency) },
          { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
          { h: 'Códigos', num: true, r: (o) => fmtNum(o.codes) },
          { h: 'Canjes', num: true, r: (o) => fmtNum(o.redeemed) },
          { h: 'Plazas libres', num: true, r: (o) => (o.max_redemptions == null ? '—' : `${o.seats_left}/${o.max_redemptions}`) },
        ],
        rows: r.offers || [],
        empty: 'No hay publicaciones en este periodo.',
      })}
    </div>

    <div class="card"><h2>Canjes validados</h2><div class="actions" style="margin-bottom:10px"><button class="btn sm" id="csvRed">Descargar CSV</button></div>
      <p class="muted" style="margin:0 0 10px">Cada línea es un código validado en el local, con quién lo validó. Sirve de justificante.</p>
      ${table({
        cols: [
          { h: 'Cuándo', r: (x) => fmtDate(x.at) },
          { h: 'Publicación', r: (x) => esc(x.title) },
          { h: 'Código', r: (x) => `<code>${esc(x.code)}</code>` },
        { h: 'Plazas', num: true, r: (x) => fmtNum(x.seats || 1) },
          // Lo que se pagó por plaza: el precio de cuando se consiguió el
          // código si luego subió.
          { h: 'Precio', num: true, r: (x) => (x.paid_cents == null ? '—' : fmtMoney(x.paid_cents, x.currency)) },
          { h: 'Validado por', r: (x) => esc(x.by) },
        ],
        rows: r.redemptions || [],
        empty: 'Todavía no se ha validado ningún código en este periodo.',
      })}
    </div>`;

  $('#csvOffers').onclick = () => downloadCsv(`informe-${BIZ.name}`, r.offers || [], [
    ['title', 'Publicación'], ['kind', 'Tipo'], ['starts_at', 'Fecha'],
    [(o) => (o.price_cents == null ? '' : (o.price_cents / 100).toFixed(2)), 'Precio'],
    ['views', 'Vistas'], ['codes', 'Códigos'], ['redeemed', 'Canjes'],
    ['max_redemptions', 'Aforo'], ['seats_left', 'Plazas libres'],
  ]);
  $('#csvRed').onclick = () => downloadCsv(`canjes-${BIZ.name}`, r.redemptions || [], [
    ['at', 'Fecha y hora'], ['title', 'Publicación'], ['code', 'Código'], [(x) => x.seats ?? 1, 'Plazas'],
    [(x) => (x.paid_cents == null ? '' : (x.paid_cents / 100).toFixed(2)), 'Precio'], ['by', 'Validado por'],
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
    <div class="card"><h2>¿Algo no cuadra?</h2><p class="muted" style="margin:0">Escríbenos a <a class="link" href="mailto:info@klendar.app">info@klendar.app</a> y lo miramos.</p></div>`;
};

boot();
