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
const fmtDate = (s) => s ? new Date(s).toLocaleString(LOC(), { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtMoney = (c) => (c == null ? '—' : (c / 100).toLocaleString(I18N.lang === 'en' ? 'en-IE' : 'es-ES', { style: 'currency', currency: 'EUR' }));
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
const tag = (v, cls) => v ? `<span class="tag ${cls || 'st-' + esc(v)}">${esc(LABELS[v] || v)}</span>` : '';
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
  plan_limit_reached: 'Has llegado al límite de publicaciones activas de tu plan.',
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
  auth_required: 'Tu sesión ha caducado. Vuelve a entrar para continuar.',
};

/** El error tal y como se lo enseñamos a quien lleva el negocio.
 *
 * Los códigos conocidos tienen su frase; lo que viene de Postgres (permisos,
 * claves repetidas, columnas) no se enseña crudo: no dice nada útil y asusta.
 */
function friendly(msg) {
  const m = String(msg || '');
  for (const [codigo, texto] of Object.entries(ERRORS)) {
    if (m === codigo || m.includes(codigo)) return texto;
  }
  if (/row-level security|permission denied|violates|duplicate key|column |relation |JWT|invalid input syntax/i.test(m)) {
    return 'No se ha podido guardar. Si vuelve a pasar, escríbenos a info@klendar.app.';
  }
  return m || 'No se ha podido hacer.';
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
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&types=address&language=es&access_token=${token}`);
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
  const mapa = new gl.Map({ container: caja, style: 'mapbox://styles/mapbox/streets-v12', center: centro, zoom: hay ? 16 : 5, cooperativeGestures: true });
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

/** «−20 %», «2x1», «Gratis»… lo que hay que leer de un vistazo. */
function etiquetaDescuento(d) {
  if (!d) return '';
  if (d.type === 'percent') return `−${d.value} %`;
  if (d.type === 'fixed') return fmtMoney(Math.round(Number(d.value) * 100));
  if (d.type === '2x1') return '2x1';
  if (d.type === 'free') return 'Gratis';
  return d.label || d.text || '';
}

async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(ERRORS[error.message] || error.message);
  return data;
}

/** Fecha para <input type="datetime-local"> (hora local, sin zona). */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

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
    return v == null ? '' : String(v);
  }))];
  const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
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

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  ME = session.user;
  // Quien entró con Google y aún no ha aceptado los términos ni dicho su
  // edad lo hace primero en «Tu cuenta», y vuelve aquí.
  try {
    const c = await rpc('my_consents');
    if (!c) { await sb.auth.signOut({ scope: 'local' }).catch(() => {}); return showLogin(); }
    if (!c.terms_accepted_at) {
      location.href = `/app/?volver=${encodeURIComponent(`/panel/${location.search}${location.hash}`)}#/ultimo-paso`;
      return;
    }
  } catch { /* sin red: no se bloquea */ }
  $('#who').textContent = ME.email || ME.phone || '';
  $('#login').hidden = true; $('#app').hidden = false;

  BIZZES = await rpc('my_businesses');
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
  renderBizPicker();
  try { CATS = (await sb.from('categories').select('id, slug, names, position').order('position')).data || []; } catch { CATS = []; }
  route();
}
function showLogin() { $('#login').hidden = false; $('#app').hidden = true; ME = null; }
async function noBusiness() {
  $('#nav').innerHTML = '';
  $('.bizpick').hidden = true;
  const v = $('#view');
  try {
    await PAGES.alta(v);
    I18N.translate(v);
  } catch (e) {
    v.innerHTML = `<div class="card"><h2>Algo ha fallado</h2><p class="err">${esc(friendly(e.message))}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
  }
}
function renderBizPicker() {
  $('#bizSelect').innerHTML = BIZZES.map((b) => `<option value="${esc(b.id)}" ${b.id === BIZ.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  $('#bizSelect').onchange = () => {
    BIZ = BIZZES.find((b) => b.id === $('#bizSelect').value);
    localStorage.setItem('klendar.biz', BIZ.id);
    route();
  };
}

// Entrar: los mismos mensajes que la app y que «Tu cuenta» (assets/auth-errors.js).
const errAuth = (error) => window.KL_AUTH_ERROR(error, I18N.lang);
/** Bloquea el botón mientras se espera, para no mandar dos veces. */
async function esperando(boton, trabajo) {
  if (boton.disabled) return;
  boton.disabled = true;
  try { await trabajo(); } finally { boton.disabled = false; }
}
$('#doLogin').onclick = () => {
  $('#loginErr').textContent = '';
  if (!KL_VALIDA.correoYClave(I18N.lang, $('#email'), $('#password'))) return;
  esperando($('#doLogin'), async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
    if (error) { $('#loginErr').textContent = errAuth(error); return; }
    boot();
  });
};
$('#doReset').onclick = () => {
  $('#loginErr').textContent = '';
  KL_CAMPO($('#password'), null);
  if (!KL_VALIDA.correoYClave(I18N.lang, $('#email'))) return;
  esperando($('#doReset'), async () => {
    // La contraseña nueva se pone en «Tu cuenta» (la misma pantalla que para
    // todo el mundo) y al guardarla se vuelve aquí.
    const { error } = await sb.auth.resetPasswordForEmail($('#email').value.trim(),
      { redirectTo: `${location.origin}/app/?destino=%2Fpanel%2F#/nueva-clave` });
    if (error) { $('#loginErr').textContent = errAuth(error); return; }
    toast(I18N.lang === 'en'
      ? `If ${$('#email').value.trim()} has an account, it'll get an email in a few seconds. Check spam too.`
      : `Si ${$('#email').value.trim()} tiene cuenta, recibirá un correo en unos segundos. Mira también en spam.`);
  });
};
$('#password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#doLogin').click(); });

// Google, Apple y teléfono: solo los que el proyecto tenga activos (el día
// que se enciendan en Supabase aparecen solos). Los mismos que la app.
(async () => {
  let ext = {};
  try {
    const r = await fetch(`${window.KLENDAR_ENV.url}/auth/v1/settings`, { headers: { apikey: window.KLENDAR_ENV.key } });
    if (r.ok) ext = (await r.json()).external || {};
  } catch { return; }
  for (const prov of ['google', 'apple']) {
    const b = $(`#do${prov === 'google' ? 'Google' : 'Apple'}`);
    if (!ext[prov] || !b) continue;
    b.hidden = false;
    b.onclick = async () => {
      const { error } = await sb.auth.signInWithOAuth({ provider: prov, options: { redirectTo: `${location.origin}/panel/` } });
      if (error) $('#loginErr').textContent = errAuth(error);
    };
  }
  if (ext.phone && $('#doPhone')) $('#doPhone').hidden = false;
})();
$('#logout').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); showLogin(); };
sb.auth.onAuthStateChange((ev) => {
  if (ev === 'SIGNED_OUT') showLogin();
  // Un enlace de «he olvidado la contraseña» antiguo que traiga aquí: la
  // contraseña nueva se pone en «Tu cuenta» y se vuelve al panel.
  if (ev === 'PASSWORD_RECOVERY') location.href = '/app/?destino=%2Fpanel%2F#/nueva-clave';
});
$('#menuBtn').onclick = () => $('#side').classList.toggle('open');

// ── Idioma ──────────────────────────────────────────────────────────────────
// El panel se escribió en español; la versión inglesa se pinta encima (ver
// i18n.js). Lo que no esté traducido se queda en español, nunca en blanco.
I18N.pickers(['#lang', '#langLogin', '#langSide']);
I18N.translate(document.body);

// ── Navegación ──────────────────────────────────────────────────────────────
const NAV = [
  ['resumen', 'dashboard', 'Resumen'],
  ['publicaciones', 'bolt', 'Publicaciones'],
  ['validar', 'qr_code_scanner', 'Validar códigos'],
  ['informe', 'bar_chart', 'Informe'],
  ['resenas', 'reviews', 'Reseñas'],
  ['sellos', 'loyalty', 'Tarjeta de sellos'],
  ['carta', 'restaurant_menu', 'Carta'],
  ['novedades', 'campaign', 'Novedades'],
  ['ficha', 'storefront', 'Tu ficha'],
  ['cerrados', 'event_busy', 'Días cerrados'],
  ['equipo', 'group', 'Equipo'],
  ['ayuda', 'help', 'Ayuda'],
];
function renderNav(current) {
  $('#nav').innerHTML = NAV.map((n) => `<a class="nav ${current === n[0] ? 'on' : ''}" href="#/${n[0]}">${ms(n[1])}${n[2]}</a>`).join('');
  I18N.translate($('#nav'));
}
const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'resumen').split('/');
const PAGES = {};
// Cada pintada lleva su número: si mientras carga una se pide otra (cambiar
// de negocio y de pantalla seguido), lo que termine tarde no pisa ni saca
// errores sobre la nueva.
let RUTA_N = 0;
async function route() {
  paraCamara();
  if (!ME) return;
  if (!BIZ) return noBusiness();
  const n = ++RUTA_N;
  const [page, param] = currentRoute();
  renderNav(page);
  $('#side').classList.remove('open');
  // Cada pintada va en su propia caja: si una vieja termina tarde, escribe
  // en una caja que ya no está en la página y no se ve.
  const v = document.createElement('div');
  v.innerHTML = '<div class="loading">Cargando…</div>';
  $('#view').replaceChildren(v);
  try {
    await (PAGES[page] || PAGES.resumen)(v, param);
    if (n === RUTA_N) I18N.translate(v);
  } catch (e) {
    if (n !== RUTA_N) return;
    v.innerHTML = `<div class="card"><h2>Algo ha fallado</h2><p class="err">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
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
          <button class="btn sm ghost" type="button" id="aqui">Estoy en el local</button>
          <span class="muted" id="punto-txt">Marca dónde está la puerta: la gente te encuentra por la distancia.</span></p>
        <div class="mapa" id="mapa"></div>
      </div>
      <label class="f"><span>Teléfono</span><input name="phone" maxlength="20" inputmode="tel"></label>
      <label class="f"><span>Web</span><input name="website" type="url" placeholder="https://"></label>
      <label class="f"><span>Correo de contacto</span><input name="contact_email" type="email" value="${esc(ME.email || '')}"></label>
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
  const marca = async (p, rellenar) => {
    punto = { lat: p.lat, lng: p.lng };
    txt.textContent = I18N.t('Ubicación marcada. Si no es exacta, arrastra la chincheta.');
    if (rellenar) {
      const d = await direccionDe(p.lat, p.lng);
      if (d) {
        if (!f.address.value.trim() && d.address) f.address.value = d.address;
        if (!f.city.value.trim() && d.city) f.city.value = d.city;
      }
    }
  };
  const mapa = await mapaPunto($('#mapa', v), null, (p) => marca(p, true));

  $('#buscar', v).onclick = async () => {
    const q = [f.address.value, f.city.value].map((x) => x.trim()).filter(Boolean).join(', ');
    if (!q) { toast('Escribe primero la dirección y la ciudad.', true); return; }
    const d = await buscaDireccion(q);
    if (!d) { toast('No encontramos esa dirección. Prueba a escribirla de otra forma o marca el punto en el mapa.', true); return; }
    if (!f.city.value.trim() && d.city) f.city.value = d.city;
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
    if (String(d.name || '').trim().length < 2) { err.textContent = I18N.t('Pon el nombre del negocio.'); return; }
    if (!d.category_id) { err.textContent = I18N.t('Elige una categoría.'); return; }
    if (!String(d.address || '').trim() || !String(d.city || '').trim()) { err.textContent = I18N.t('Faltan la dirección o la ciudad.'); return; }
    if (!punto) {
      // Sin chincheta: se intenta con la dirección escrita.
      const b = await buscaDireccion(`${d.address}, ${d.city}`);
      if (!b) { err.textContent = I18N.t('Marca en el mapa dónde está el local (o pulsa «Buscar en el mapa»).'); return; }
      punto = { lat: b.lat, lng: b.lng };
    }
    if (!f.terms.checked) { err.textContent = I18N.t('Tienes que aceptar las condiciones para negocios.'); return; }
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
    ${BIZ.verification_status !== 'verified' ? `<div class="help"><b>${esc(bi(`Tu negocio está ${BIZ_LABELS[BIZ.verification_status] || BIZ.verification_status}.`, `Your business is ${I18N.t(BIZ_LABELS[BIZ.verification_status] || BIZ.verification_status)}.`))}</b> ${esc(I18N.t('Mientras tanto puedes preparar publicaciones en borrador; se verán en cuanto te verifiquemos.'))}</div>` : ''}
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
        <div class="kpi accent"><b>${fmtNum(s.redemptions_30d)}</b><span>Canjes (30 días)</span></div>
        <div class="kpi"><b>${fmtNum(s.favorites)}</b><span>Favoritos</span></div>
        <div class="kpi"><b>${s.ratings ? `${Number(s.rating).toFixed(1).replace('.', ',')} (${s.ratings})` : '—'}</b><span>Valoración</span></div>
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
        { h: 'Publicación', r: (o) => `<b class="title">${esc(o.title)}</b><span class="sub">${esc(LABELS[o.kind])} · ${fmtDate(o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at)}</span>` },
        { h: 'Estado', r: (o) => tag(o.status) + (o.moderation_status === 'pending' ? ' ' + tag('pending') : '') },
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
      await navigator.clipboard.writeText($('#wcode', v).textContent);
      wcopy.textContent = 'Copiado';
      setTimeout(() => { wcopy.textContent = 'Copiar'; }, 1500);
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
      const hasta = new Date(); hasta.setDate(hasta.getDate() + 1); hasta.setHours(5, 0, 0, 0);
      const cerrar = !pausado();
      try {
        await rpc('set_business_pause', { p_business: BIZ.id, p_until: cerrar ? hasta.toISOString() : null });
        BIZ.paused_until = cerrar ? hasta.toISOString() : null;
        toast(cerrar ? 'Cerrado por hoy' : 'Abierto de nuevo'); route();
      } catch (e) { toast(friendly(e.message), true); }
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
      await navigator.clipboard.writeText(text);
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
      ${gestiona() ? `<a class="btn sm" href="#/publicaciones/nueva-flash">${ms('bolt')}Nueva oferta</a>
      <a class="btn sm" href="#/publicaciones/nuevo-evento">${ms('event')}Nuevo evento</a>` : ''}
      <button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Oferta o evento?', bi('<p><b>Oferta flash</b>: algo que se canjea hoy, con cuenta atrás y aforo («café + tostada 2,50 € hasta mediodía»). <b>Evento</b>: algo con fecha, que se guarda en la agenda y puede admitir reserva de plaza.</p>',
      '<p><b>Flash offer</b>: something redeemed today, with a countdown and a limit (“coffee + toast €2.50 until noon”). <b>Event</b>: something with a date, which people save to their agenda and which can take seat reservations.</p>'))}
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
          { h: 'Publicación', r: (x) => `<b class="title">${esc(x.title || '—')}</b><span class="sub">${fmtNum(x.published)} publicada(s)</span>` },
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
      intro: `«${esc(o.title || '')}» se publicará sola los días y la hora que elijas, con su cuenta atrás y su aforo. Puedes pausarla cuando quieras.`,
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
        { h: 'Publicación', r: (o) => `${primeraFoto(o.images) ? `<img class="thumb" src="${esc(primeraFoto(o.images))}" alt="" loading="lazy">` : `<span class="ph">${ms((o.images || []).some(esVideo) ? 'play_circle' : o.kind === 'flash_offer' ? 'bolt' : 'event')}</span>`}<b class="title">${esc(o.title)}</b><span class="sub">${esc(LABELS[o.kind])} · ${fmtDate(o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at)}</span>` },
        { h: 'Estado', r: (o) => tag(o.status) + (o.moderation_status === 'pending' ? ' ' + tag('pending') : '') + (o.publish_at ? ` <span class="tag dim">programada ${esc(fmtDate(o.publish_at))}</span>` : '') },
        { h: 'Plazas', r: (o) => o.max_redemptions == null ? '—' : `${fmtNum(o.redemptions_count + (o.pending_count || 0))}/${fmtNum(o.max_redemptions)}` },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
        { h: 'Canjes', num: true, r: (o) => fmtNum(o.redemptions_count) },
        { h: '', r: (o) => !gestiona()
          ? `<div class="actions"><button class="btn sm ghost" data-act="stats" data-id="${esc(o.id)}">Cifras</button>${o.kind === 'future_event' && o.reservations_enabled ? `<a class="btn sm ghost" href="#/asistentes/${esc(o.id)}">Asistentes</a>` : ''}</div>`
          : `<div class="actions">
            <a class="btn sm" href="#/publicaciones/${esc(o.id)}">Editar</a>
            <button class="btn sm ghost" data-act="stats" data-id="${esc(o.id)}">Cifras</button>
            ${o.kind === 'future_event' && o.reservations_enabled ? `<a class="btn sm ghost" href="#/asistentes/${esc(o.id)}">Asistentes</a>` : ''}
            <button class="btn sm ghost" data-act="${o.status === 'active' ? 'pause' : 'activate'}" data-id="${esc(o.id)}">${o.status === 'active' ? 'Pausar' : 'Activar'}</button>
            <details class="mas"><summary class="btn sm ghost">Más</summary><div class="mas-menu">
              <a href="#/publicaciones/${o.kind === 'flash_offer' ? 'nueva-flash' : 'nuevo-evento'}?from=${esc(o.id)}">Crear a partir de esta</a>
              ${o.kind === 'flash_offer' && o.status === 'active' && new Date(o.redeem_end_at) > new Date() ? `<button type="button" data-act="extend" data-id="${esc(o.id)}">Ampliar 1 h</button>` : ''}
              ${o.kind === 'flash_offer' ? `<a href="#/publicaciones/nueva-flash?from=${esc(o.id)}&repeat=1">Repetir mañana</a>
              <button type="button" data-act="repeat" data-id="${esc(o.id)}">Repetir cada semana…</button>` : ''}
              ${OTROS_LOCALES.length ? `<button type="button" data-act="locales" data-id="${esc(o.id)}">En otros locales…</button>` : ''}
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
            await sb.from('offers').delete().eq('id', id);
          } else {
            await sb.from('offers').update({ status: b.dataset.act === 'pause' ? 'draft' : 'active' }).eq('id', id);
          }
          toast('Hecho');
          route();
        } catch (e) { toast(friendly(e.message), true); }
      };
    });
  };
  $('#csv').onclick = () => downloadCsv(`klendar-${BIZ.name}`, offers, [
    ['title', 'publicación'], [(o) => LABELS[o.kind], 'tipo'], [(o) => LABELS[o.status], 'estado'],
    ['views', 'vistas'], ['redemptions_count', 'canjes'], ['max_redemptions', 'aforo'],
    [(o) => o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at, 'cuándo'],
  ]);
  render();
  renderRules();
  // Desde el aviso «tu oferta termina en 1 h» (Tu cuenta → notificaciones).
  const qx = new URLSearchParams(location.hash.split('?')[1] || '');
  const aAmpliar = qx.get('extend') && offers.find((x) => x.id === qx.get('extend'));
  if (aAmpliar) {
    history.replaceState(null, '', `${location.pathname}#/publicaciones`);
    ampliarDialogo(aAmpliar);
  }
};

/** «Ampliar 1 h»: con la hora nueva a la vista, como en la app. */
async function ampliarDialogo(o) {
  if (!o || !o.redeem_end_at) return;
  const hm = (d) => new Date(d).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' });
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
  const dia = (s) => new Date(s).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' });
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
      <div class="kpi accent"><b>${fmtNum(canjes)}</b><span>Canjes</span></div>
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
        + (b.verification_status !== 'verified' ? ' (sin verificar todavía)' : ''),
    })),
    submit: 'Copiar',
  });
  if (!r) return;
  const elegidos = OTROS_LOCALES.map((b) => b.id).filter((id) => r[`b_${id}`]);
  if (!elegidos.length) return;

  const res = await rpc('copy_offer_to_businesses', { p_offer: offerId, p_businesses: elegidos })
    .catch((e) => ({ ok: false, error: e.message }));
  if (!res?.ok) { toast(res?.error || 'No se ha podido copiar', true); return; }

  const fallos = res.failed || [];
  if (res.copies && !fallos.length) {
    toast(res.copies === 1 ? 'Copiada en 1 local' : `Copiada en ${res.copies} locales`);
  } else if (res.copies) {
    toast(`Copiada en ${res.copies}; ${fallos.length} no se han podido`, true);
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
      const m = new Date(ahora); m.setDate(m.getDate() + 1); m.setHours(20, 0, 0, 0);
      o.event_at = m.toISOString();
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
        // Mañana (de hoy) a la misma hora y con la misma duración.
        const ini = new Date(src.redeem_start_at);
        const dura = src.redeem_end_at ? new Date(src.redeem_end_at) - ini : 3 * 36e5;
        const nuevo = new Date();
        nuevo.setDate(nuevo.getDate() + 1);
        nuevo.setHours(ini.getHours(), ini.getMinutes(), 0, 0);
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
          ${CATS.map((c) => `<option value="${esc(c.id)}" ${o.category_id === c.id ? 'selected' : ''}>${esc(c.names?.es || c.names?.en || '')}</option>`).join('')}</select></label>
        <label class="f"><span>Empieza</span><input type="datetime-local" name="start" value="${toLocalInput(o.kind === 'future_event' ? o.event_at : o.redeem_start_at)}" required></label>
        <label class="f"><span>Termina</span><input type="datetime-local" name="end" value="${toLocalInput(o.kind === 'future_event' ? o.event_end_at : o.redeem_end_at)}"></label>
        <label class="f"><span>Precio (opcional)</span><input name="price" inputmode="decimal" value="${o.price_cents == null ? '' : (o.price_cents / 100).toFixed(2).replace('.', ',')}" placeholder="12,00"></label>
        <label class="f"><span>Aforo / unidades</span><input name="max_redemptions" type="number" min="1" value="${o.max_redemptions ?? ''}" placeholder="vacío = sin límite"></label>
        <label class="f"><span>Descuento</span><select name="discount_type">
          ${[['', 'Sin descuento'], ['percent', 'Porcentaje'], ['fixed', 'Precio fijo'], ['2x1', '2x1'], ['free', 'Gratis'], ['other', 'Otro (lo escribes tú)']].map((d) => `<option value="${d[0]}" ${disc.type === d[0] ? 'selected' : ''}>${d[1]}</option>`).join('')}</select></label>
        <label class="f"><span>Valor del descuento</span><input name="discount_value" value="${esc(disc.value ?? '')}" placeholder="20"></label>
        <label class="f full"><span>Precio anterior <small>(obligatorio si pones un % o un precio rebajado; ha de ser el más bajo de los últimos 30 días)</small></span><input name="prior_price" inputmode="decimal" value="${disc.compare_at_cents != null ? (disc.compare_at_cents / 100).toFixed(2).replace('.', ',') : ''}" placeholder="12,00"></label>
        <label class="f full" id="alcRow" hidden><span>¿El 2x1 incluye bebidas alcohólicas? <small>(hay que responder; si dices que sí, la publicación solo la verán mayores de 18 y tendrás que comprobar que tu comunidad lo permite: la sanción sería para tu negocio)</small></span><select name="alcohol">
          ${[['', 'Elige una opción'], ['no', 'No lleva alcohol'], ['yes', 'Sí, lleva alcohol']].map((a) => `<option value="${a[0]}" ${(disc.alcohol === true ? 'yes' : disc.alcohol === false ? 'no' : '') === a[0] ? 'selected' : ''}>${a[1]}</option>`).join('')}</select></label>
        <label class="f"><span>¿Cuánto vale el código QR?</span><select name="code_ttl_minutes">
          ${[[5, '5 minutos'], [30, '30 minutos'], [180, '3 horas'], [1440, '1 día'], ['', 'Sin caducidad']].map((t) => `<option value="${t[0]}" ${String(o.code_ttl_minutes ?? '') === String(t[0]) ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></label>
        <label class="f"><span>Canjes por persona</span><input name="max_per_user" type="number" min="1" max="20" value="${o.max_per_user ?? 1}"></label>
        <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="reservations_enabled" ${o.reservations_enabled ? 'checked' : ''}><span>${bi('Evento con <b>reserva de plaza</b> (sin pago): la gente reserva desde la app y enseña su código en la puerta', 'Event with <b>seat reservation</b> (no payment): people book from the app and show their code at the door')}</span></label>
        <label class="f" id="seatsRow" hidden><span>Plazas por persona <small>(a un evento no se va solo; un código vale por todas)</small></span><select name="max_seats">
          ${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${Number(o.max_seats || 1) === n ? 'selected' : ''}>${n === 1 ? '1 (solo quien reserva)' : n + ' personas'}</option>`).join('')}</select></label>
        <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="adults_only" ${o.adults_only ? 'checked' : ''}><span>Solo para mayores de 18</span></label>
        <label class="f full"><span>Condiciones (letra pequeña)</span><textarea name="terms" maxlength="300">${esc(o.terms || '')}</textarea></label>
        <label class="f full"><span>Enlace externo (entradas, reservas…)</span><input name="external_url" value="${esc(o.external_url || '')}" placeholder="https://"></label>
      </div>
      <h3 style="margin-top:16px">Fotos y vídeo</h3>
      <p class="hint">La primera es la portada; muévelas con las flechas. Si no pones ninguna, se usa la foto del local. Los vídeos se ven al abrir la publicación (en el feed van las fotos).</p>
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
        <button class="btn primary" type="submit">${id ? 'Guardar cambios' : 'Publicar'}</button>
        <button class="btn" type="button" id="saveTpl">Guardar como plantilla</button>
        <label class="f" style="grid-template-columns:auto 1fr;align-items:center;margin:0"><input type="checkbox" name="publish" ${o.status !== 'draft' ? 'checked' : ''}><span>Publicar ahora (desactívalo para dejarlo en borrador)</span></label>
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
  $('[name=reservations_enabled]', v).onchange = syncKind;
  syncKind();

  // La pregunta del alcohol solo aparece si el descuento es un 2x1.
  const syncDiscount = () => {
    $('#alcRow', v).hidden = $('[name=discount_type]', v).value !== '2x1';
  };
  $('[name=discount_type]', v).onchange = syncDiscount;
  syncDiscount();

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
      + `<label class="add">+ Añadir foto o vídeo<input type="file" accept="image/*,video/mp4,video/quicktime" multiple></label>`;
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
    $('#photos input[type=file]').onchange = async (e) => {
      const hueco = Math.max(0, 6 - images.length);
      if (!hueco) { toast('Como mucho 6 fotos o vídeos por publicación.', true); return; }
      for (const file of [...e.target.files].slice(0, hueco)) {
        const video = /^video\//.test(file.type);
        const max = video ? 60 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > max) { toast(video ? 'Ese vídeo pesa más de 60 MB.' : 'Esa foto pesa más de 5 MB.', true); continue; }
        // Como en la app: vídeos de menos de 45 segundos.
        if (video && (await duracion(file)) > 45.5) { toast('Ese vídeo dura más de 45 segundos. Recórtalo y vuelve a subirlo.', true); continue; }
        const ext = video ? 'mp4' : (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${BIZ.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (error) { toast(error.message, true); continue; }
        images.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      renderPhotos();
    };
  };
  renderPhotos();

  // ── Diseño del anuncio (las mismas plantillas y colores que la app) ──────
  const PLANTILLAS = [['glass', 'Cristal'], ['bold', 'Color'], ['poster', 'Póster'], ['minimal', 'Limpio']];
  const COLORES = ['#FF4D6D', '#F5B041', '#0EA5E9', '#7C5CFF', '#34D399', '#FF8A3D', '#E879F9', '#111827'];
  let estilo = { template: o.style?.template || 'glass', accent: o.style?.accent || null };
  const claro = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const l = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * l(n >> 16 & 255) + 0.7152 * l(n >> 8 & 255) + 0.0722 * l(n & 255) > 0.45;
  };
  pintaEstilo = () => {
    const acento = estilo.accent || '#FF4D6D';
    const sobre = claro(acento) ? '#0A0A0A' : '#FFFFFF';
    const f = new FormData($('#form'));
    const titulo = String(f.get('title') || '').trim() || (I18N.lang === 'en' ? 'Your publication' : 'Tu publicación');
    const dt = String(f.get('discount_type') || '');
    const dv = String(f.get('discount_value') || '').trim();
    const precioTxt = String(f.get('price') || '').trim();
    const etiqueta = dt ? etiquetaDescuento({ type: dt, value: dt === 'other' ? dv : Number(dv.replace(',', '.')) || dv })
      : precioTxt ? fmtMoney(Math.round(parseFloat(precioTxt.replace(',', '.')) * 100)) : '';
    const foto = images.find((u) => !isVideo(u));
    const t = estilo.template;
    $('#estiloPrev', v).innerHTML = `
      <div class="ep ep-${t}" style="--ac:${acento};--on:${sobre};${foto ? `background-image:url('${esc(foto)}')` : ''}">
        <div class="ep-panel">
          <b class="ep-biz">${esc(BIZ.name)}</b>
          <span class="ep-title">${esc(titulo)}</span>
          ${etiqueta ? `<span class="ep-tag">${esc(etiqueta)}</span>` : ''}
          <span class="ep-cta">${esc(I18N.lang === 'en' ? 'Get the code' : 'Conseguir el código')}</span>
        </div>
      </div>`;
    $('#plantillasEstilo', v).innerHTML = PLANTILLAS.map(([k, n]) =>
      `<button type="button" class="${estilo.template === k ? 'on' : ''}" data-plantilla="${k}">${esc(I18N.t(n))}</button>`).join('');
    $('#colores', v).innerHTML = COLORES.map((c, i) =>
      `<button type="button" class="color ${(estilo.accent || '#FF4D6D') === c ? 'on' : ''}" data-color="${i === 0 ? '' : c}" style="background:${c}" aria-label="${c}"></button>`).join('');
    $$('[data-plantilla]', v).forEach((b) => { b.onclick = () => { estilo.template = b.dataset.plantilla; pintaEstilo(); }; });
    $$('[data-color]', v).forEach((b) => { b.onclick = () => { estilo.accent = b.dataset.color || null; pintaEstilo(); }; });
  };
  $('#form').addEventListener('input', (e) => {
    if (['title', 'price', 'discount_type', 'discount_value'].includes(e.target.name)) pintaEstilo();
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
    pon('code_ttl_minutes', d.code_ttl_minutes ?? '');
    campo('adults_only').checked = !!d.adults_only;
    campo('reservations_enabled').checked = !!d.reservations_enabled;
    const ds = d.discount || {};
    pon('discount_type', ds.type || '');
    pon('discount_value', ds.type === 'other' ? ds.value : precioTxt(ds.value));
    pon('prior_price', ds.compare_at_cents != null ? (ds.compare_at_cents / 100).toFixed(2).replace('.', ',') : '');
    pon('alcohol', ds.alcohol === true ? 'yes' : ds.alcohol === false ? 'no' : '');
    images = [...(d.images || [])];
    if (d.style) estilo = { template: d.style.template || 'glass', accent: d.style.accent || null };
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
    const price = (f.get('price') || '').toString().replace(',', '.');
    const dType = f.get('discount_type');
    const dValue = (f.get('discount_value') || '').toString().replace(',', '.');
    const priorRaw = (f.get('prior_price') || '').toString().replace(',', '.');
    const prior = priorRaw ? Math.round(parseFloat(priorRaw) * 100) : null;
    if (['percent', 'fixed'].includes(dType) && !prior) {
      $('#formErr').textContent = 'Pon el precio anterior: la ley obliga a enseñarlo junto al descuento.';
      return;
    }
    // El 2x1 obliga a declarar si hay alcohol: por el texto no se sabe
    // («2x1 en bebidas» no dice nada) y la multa se la lleva el negocio.
    const alcohol = f.get('alcohol');
    if (dType === '2x1' && !alcohol) {
      $('#formErr').textContent = 'Di si el 2x1 incluye bebidas alcohólicas.';
      return;
    }
    // Bajar el precio con códigos sin usar no es gratis: quien los tenga
    // pagará el nuevo. El negocio lo decide sabiéndolo.
    const newCents = price ? Math.round(parseFloat(price) * 100) : null;
    if (id && o.price_cents != null && newCents != null && newCents < o.price_cents) {
      const codes = await rpc('offer_pending_codes', { p_offer: id });
      const eur = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';
      if (codes > 0 && !confirm(
        `Hay ${codes} código(s) sin usar de ${eur(o.price_cents)}. Si lo dejas en `
        + `${eur(newCents)}, esas personas pagarán ${eur(newCents)} en el local. `
        + 'A quien ya canjeó no se le avisa.')) {
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
      external_url: f.get('external_url') || null,
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
      max_per_user: Number(f.get('max_per_user') || 1),
      code_ttl_minutes: f.get('code_ttl_minutes') ? Number(f.get('code_ttl_minutes')) : null,
      reservations_enabled: !flash && $('[name=reservations_enabled]').checked,
      max_seats: !flash && $('[name=reservations_enabled]').checked
        ? Number(f.get('max_seats') || 1) : 1,
      adults_only: $('[name=adults_only]').checked,
      status: programada ? 'draft' : ($('[name=publish]').checked ? 'active' : 'draft'),
      publish_at: programada,
      style: { template: estilo.template, ...(estilo.accent ? { accent: estilo.accent } : {}) },
    };
    if (flash && (!data.redeem_start_at || !data.redeem_end_at)) {
      $('#formErr').textContent = 'Una oferta flash necesita principio y fin.'; return;
    }
    if (flash && new Date(data.redeem_end_at) <= new Date(data.redeem_start_at)) {
      $('#formErr').textContent = 'El fin tiene que ser posterior al principio.'; return;
    }
    try {
      let offerId = id;
      if (id) {
        const { error } = await sb.from('offers').update(data).eq('id', id);
        if (error) throw error;
        await sb.from('offer_images').delete().eq('offer_id', id);
      } else {
        const { data: row, error } = await sb.from('offers').insert(data).select('id').single();
        if (error) throw error;
        offerId = row.id;
      }
      if (images.length) {
        await sb.from('offer_images').insert(images.map((url, i) => ({ offer_id: offerId, url, position: i })));
      }
      toast(id ? 'Cambios guardados' : 'Publicado');
      location.hash = '#/publicaciones';
    } catch (err) {
      $('#formErr').textContent = friendly(err.message);
    }
  };
}

// ── Validar códigos ─────────────────────────────────────────────────────────
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
  const sinRed = (msg) => !navigator.onLine || /fetch|network|NetworkError|Load failed/i.test(String(msg || ''));
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

  const validate = async () => {
    const raw = $('#code').value.trim();
    if (!raw) return;
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
      if (res.ok) {
        const personas = (res.seats || 1) > 1
          ? `<b class="plazas">${I18N.lang === 'en' ? `${res.seats} people come in` : `Entran ${res.seats} personas`}</b>` : '';
        const premio = res.kind === 'stamp_reward' ? `<small>${ms('redeem')}${esc(I18N.t('Premio de la tarjeta de sellos'))}</small>` : '';
        $('#result').innerHTML = `<div class="scan-result ok">${ms('check_circle')}${esc(I18N.t('Validado'))} · ${esc(res.offer_title || '')}${personas}${premio}<small>${esc(res.user_name || '')}</small></div>`;
        if (navigator.vibrate) navigator.vibrate(120);
        $('#code').value = '';
        loadRecent();
      } else {
        const msgs = {
          invalid_code: 'Ese código no existe.',
          not_authorized: 'Ese código no es de tu negocio.',
          already_validated: 'Ese código ya se usó.',
          code_expired: 'El código ha caducado: pide que generen otro.',
          rate_limited: 'Demasiados intentos seguidos. Espera un momento.',
        };
        $('#result').innerHTML = `<div class="scan-result bad">${ms('cancel')}${esc(I18N.t(msgs[res.error] || friendly(res.error)))}${res.validated_at ? `<small>${esc(I18N.t('Se validó el'))} ${esc(fmtDate(res.validated_at))}${(res.seats || 1) > 1 ? ` · ${res.seats} ${esc(I18N.t('personas'))}` : ''}</small>` : ''}</div>`;
        if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
      }
    } catch (e) {
      if (sinRed(e.message)) aLaCola(); else toast(friendly(e.message), true);
    }
  };
  $('#go').onclick = validate;
  pintaCola();
  enviaCola();
  $('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') validate(); });
  // Desde klendar.app/r/<código> (el QR escaneado con la cámara del móvil,
  // sin la app): el código llega puesto y se valida al momento.
  const desdeQr = new URLSearchParams(location.hash.split('?')[1] || '').get('code');
  if (desdeQr && /^[0-9a-f]{8,64}$/i.test(desdeQr)) {
    $('#code').value = desdeQr;
    history.replaceState(null, '', `${location.pathname}#/validar`);
    validate();
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
  const offers = await rpc('my_business_offers', { p_id: BIZ.id });
  const offer = offers.find((o) => o.id === offerId);
  const list = await rpc('offer_attendees', { p_offer: offerId });
  const inside = list.filter((a) => a.status === 'validated').length;
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/publicaciones">← Volver</a><h1>Asistentes</h1><span class="spacer"></span>
      <button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    <div class="card"><h2>${esc(offer?.title || '')}</h2>
      <p class="muted" style="margin:0">${fmtNum(inside)} de ${fmtNum(list.length)} han entrado${offer?.max_redemptions ? ` · aforo ${fmtNum(offer.max_redemptions)}` : ''}</p></div>
    <div class="toolbar"><input id="q" class="grow" placeholder="Buscar por nombre o código"></div>
    <div id="list"></div>`;
  const render = () => {
    const q = $('#q').value.trim().toLowerCase();
    const rows = list.filter((a) => !q || (a.user_name || '').toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
    $('#list').innerHTML = table({
      cols: [
        { h: 'Persona', r: (a) => `<b class="title">${esc(a.user_name || 'Invitada')}</b><span class="sub mono">${esc(a.code.slice(0, 8).toUpperCase())}</span>` },
        { h: 'Estado', r: (a) => a.status === 'validated' ? tag('validated', 'ok') : a.status === 'expired' ? tag('expired', 'dim') : tag('pending') },
        { h: 'Reservó', r: (a) => fmtDate(a.created_at) },
        { h: 'Entró', r: (a) => fmtDate(a.validated_at) },
        { h: '', r: (a) => a.status === 'pending' ? `<button class="btn sm primary" data-code="${esc(a.code)}">Dar entrada</button>` : '' },
      ],
      rows,
      empty: 'Todavía no hay nadie apuntado.',
    });
    $$('#list [data-code]').forEach((b) => {
      b.onclick = async () => {
        try {
          const res = await rpc('validate_redemption', { p_code: b.dataset.code });
          if (!res.ok) { toast(res.error, true); return; }
          toast('Dentro');
          route();
        } catch (e) { toast(friendly(e.message), true); }
      };
    });
  };
  $('#q').oninput = render;
  $('#csv').onclick = () => downloadCsv(`asistentes-${offer?.title || ''}`, list, [
    ['user_name', 'nombre'], ['code', 'código'], ['status', 'estado'], ['created_at', 'reservó'], ['validated_at', 'entró'],
  ]);
  render();
};

// ── Equipo ──────────────────────────────────────────────────────────────────
PAGES.sellos = async (v) => {
  const info = await rpc('business_stamp_card', { p_business: BIZ.id });
  const c = info?.card || null;
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  const meta = Number(c?.goal || 10);

  v.innerHTML = `
    <div class="page-head"><h1>Tarjeta de sellos</h1></div>
    ${helpBox('¿Cómo funciona?', bi(`<p>La de toda la vida, la de cartón, pero sin cartón: cada vez que validas un código de esta persona, cae un sello. Al llegar a la meta, se lleva el premio, y el premio es otro código que validas igual que los demás.</p>
      <p>Como mucho <b>un sello al día por persona</b>, para que no valga con pedir tres cafés seguidos. Si la apagas, dejas de dar sellos nuevos, pero <b>nadie pierde los que tiene</b>: al encenderla otra vez siguen ahí.</p>`,
      `<p>The classic loyalty card, without the cardboard: every time you validate a code from this person, they get a stamp. When they reach the goal they get the reward, and the reward is another code you validate like any other.</p>
      <p>At most <b>one stamp a day per person</b>, so three coffees in a row don't count three times. If you switch it off you stop giving new stamps, but <b>nobody loses the ones they have</b>: they are still there when you switch it back on.</p>`))}

    <div class="card"><h2>${c ? 'Tu tarjeta' : 'Enciende tu tarjeta'}</h2>
      <form id="f" class="form">
        <label class="f"><span>Sellos para el premio</span><select name="goal" ${canManage ? '' : 'disabled'}>
          ${Array.from({ length: 19 }, (_, i) => i + 2).map((n) => `<option value="${n}" ${meta === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="f full"><span>Premio <small>(lo que se lleva; sé concreto)</small></span>
          <input name="reward" maxlength="80" required placeholder="Un café con leche gratis" value="${esc(c?.reward || '')}" ${canManage ? '' : 'disabled'}></label>
        <label class="f full" style="grid-template-columns:auto 1fr;align-items:center">
          <input type="checkbox" name="is_active" ${c === null || c.is_active ? 'checked' : ''} ${canManage ? '' : 'disabled'}>
          <span>Encendida: se dan sellos nuevos</span></label>
        ${canManage ? '<div class="full"><button class="btn primary" type="submit">Guardar</button> <span id="msg" class="muted"></span></div>' : ''}
      </form></div>

    ${c ? `<div class="card"><h2>Cómo va</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(info.people)}</b><span>Con sellos ahora</span></div>
        <div class="kpi"><b>${fmtNum(info.stamps)}</b><span>Sellos dados</span></div>
        <div class="kpi"><b>${fmtNum(info.rewards_given)}</b><span>Premios entregados</span></div>
        <div class="kpi"><b>${fmtNum(info.rewards_pending)}</b><span>Premios por recoger</span></div>
      </div></div>` : ''}`;

  if (!canManage) return;
  $('#f', v).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (String(f.get('reward') || '').trim().length < 3) {
      $('#msg', v).textContent = I18N.t('Escribe el premio (sé concreto: «un café con leche gratis»).');
      return;
    }
    const r = await rpc('set_stamp_card', {
      p_business: BIZ.id,
      p_goal: Number(f.get('goal')),
      p_reward: String(f.get('reward') || '').trim(),
      p_active: $('[name=is_active]', v).checked,
    }).catch(() => null);
    $('#msg', v).textContent = r?.ok ? 'Guardado' : 'No se ha podido guardar';
    if (r?.ok) setTimeout(() => route(), 600);
  };
};

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
  const guardaFicha = async () => {
    const { error } = await sb.from('businesses')
      .update({ menu_url: enlace.trim() || null, menu_images: fotos })
      .eq('id', BIZ.id);
    if (error) throw new Error(error.message);
  };

  const guardar = async () => {
    try {
      await guardaFicha();
    } catch (e) { toast(friendly(e.message), true); return; }
    const r = await rpc('save_business_menu', { p_business: BIZ.id, p_menu: carta })
      .catch((e) => ({ ok: false, error: e.message }));
    if (r?.ok) { sucia = false; toast('Carta guardada'); pinta(); }
    else toast(r?.error || 'No se ha podido guardar', true);
  };

  const pinta = () => {
    v.innerHTML = `
      <div class="page-head"><h1>Carta</h1><span class="spacer"></span>
        ${canManage ? `<button class="btn sm" id="add-sec">Añadir sección</button>
        <button class="btn sm primary" id="save" ${sucia ? '' : 'disabled'}>Guardar la carta</button>` : ''}</div>
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
        ${canManage ? '<p style="margin:10px 0 0"><input type="file" id="menu-file" accept="image/*" multiple></p>' : ''}</div>
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
                  <button class="btn sm bad ghost" data-item-del="${si}:${ii}">Quitar</button></div>` : '' },
            ],
            rows: sec.items || [],
            empty: 'Esta sección está vacía.',
          })}
          ${canManage ? `<p style="margin:10px 0 0"><button class="btn sm" data-item-add="${si}">Añadir plato</button></p>` : ''}
        </div>`).join('')
        : `<div class="card"><p class="muted" style="margin:0">Todavía no has escrito la carta. ${canManage ? 'Empieza por una sección: «Para picar», «Bocadillos», «Bebidas»…' : ''}</p></div>`}
      ${sucia ? '<p class="muted">Hay cambios sin guardar.</p>' : ''}`;

    if (!canManage) return;
    $('#save', v).onclick = guardar;
    $('#menu-url', v).oninput = (e) => {
      enlace = e.target.value;
      if (!sucia) { sucia = true; $('#save', v).disabled = false; }
    };
    $$('[data-foto-del]', v).forEach((b) => { b.onclick = () => {
      fotos.splice(+b.dataset.fotoDel, 1); sucia = true; pinta();
    }; });
    const file = $('#menu-file', v);
    if (file) file.onchange = async (e) => {
      for (const f of [...e.target.files].slice(0, 6)) {
        if (f.size > 5 * 1024 * 1024) { toast('Esa foto pesa más de 5 MB.', true); continue; }
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${BIZ.id}/carta-${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
        if (error) { toast(error.message, true); continue; }
        fotos = [...fotos, sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl];
      }
      sucia = true; pinta();
    };
    $('#add-sec', v).onclick = async () => {
      const r = await modal({ title: 'Nueva sección', fields: [{ name: 'name', label: 'Nombre', required: true, placeholder: 'Para picar' }] });
      if (!r?.name) return;
      carta = [...carta, { name: r.name, items: [] }];
      sucia = true; pinta();
    };
    $$('[data-sec-edit]', v).forEach((b) => { b.onclick = async () => {
      const i = +b.dataset.secEdit;
      const r = await modal({ title: 'Renombrar sección', fields: [{ name: 'name', label: 'Nombre', value: carta[i].name, required: true }] });
      if (!r?.name) return;
      carta[i].name = r.name; sucia = true; pinta();
    }; });
    $$('[data-sec-del]', v).forEach((b) => { b.onclick = async () => {
      const i = +b.dataset.secDel;
      if (!await confirmDlg('Borrar sección', `Se quita «${carta[i].name}» con sus platos. No se guarda hasta que le des a «Guardar la carta».`, { danger: true, submit: 'Borrar' })) return;
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
          { name: 'name', label: 'Nombre', value: it.name, required: true, placeholder: 'Tortilla de patata' },
          { name: 'description', label: 'Descripción (opcional)', value: it.description || '' },
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
        const f = input.files?.[0];
        if (!f) return;
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
    <div class="page-head"><a class="btn sm" href="#/publicaciones">← Publicaciones</a>
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

PAGES.novedades = async (v) => {
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  const { data: posts } = await sb.from('business_posts')
    .select('id, body, image_url, created_at')
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
    const archivo = campoFoto?.files?.[0];
    const texto = (r.body || '').trim();
    // Texto, foto o las dos cosas (como en la app); vacía del todo, no.
    if (!texto && !archivo && !(post?.image_url && !campoQuita?.checked)) {
      toast('Escribe algo o añade una foto.', true); return;
    }
    try {
      let image = post ? post.image_url : null;
      if (campoQuita?.checked) image = null;
      if (archivo) {
        if (archivo.size > 5 * 1024 * 1024) { toast('Esa foto pesa más de 5 MB.', true); return; }
        const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${BIZ.id}/posts/${crypto.randomUUID()}.${ext}`;
        const { error: up } = await sb.storage.from(BUCKET).upload(path, archivo, { contentType: archivo.type });
        if (up) throw new Error(up.message);
        image = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const fila = { body: texto || null, image_url: image };
      const { error } = post
        ? await sb.from('business_posts').update(fila).eq('id', post.id)
        : await sb.from('business_posts').insert({ business_id: BIZ.id, ...fila });
      if (error) throw new Error(error.message);
      toast('Hecho'); route();
    } catch (e) { toast(friendly(e.message), true); }
  };

  v.innerHTML = `
    <div class="page-head"><h1>Novedades</h1><span class="spacer"></span>
      ${canManage ? '<button class="btn sm primary" id="nueva">Nueva novedad</button>' : ''}</div>
    ${helpBox('¿Qué es una novedad?', bi('<p>Una nota corta en tu ficha, sin cuenta atrás ni código: «hoy hay pulpo», «cerramos el lunes», «ya tenemos terraza». Para algo que se canjea, usa una <b>publicación</b>.</p><p>Quien te tenga en favoritos recibe una notificación (como mucho una al día por negocio, para no cansar).</p>',
      '<p>A short note on your page, with no countdown or code: “octopus today”, “closed on Monday”, “the terrace is open”. For something people redeem, use a <b>publication</b>.</p><p>People who have you in their favourites get a notification (at most one a day per business, so it doesn\'t get tiring).</p>'))}
    ${table({
      cols: [
        { h: 'Novedad', r: (p) => `${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}" alt="" loading="lazy">` : ''}<span class="title">${esc(p.body || '')}</span>` },
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
    ? new Date(sub.period_end).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const estado = trial && until
    ? (en ? `Free trial with every feature until ${until}. Then the Free plan unless you subscribe.`
      : `Prueba gratuita con todas las funciones hasta el ${until}. Después, plan Gratis salvo que contrates uno.`)
    : free ? (en ? 'No cost. Up to 2 active publications at a time.' : 'Sin coste. Hasta 2 publicaciones activas a la vez.')
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
    <a class="btn sm" href="mailto:info@klendar.app?subject=${asunto}&body=${cuerpo}">${esc(free ? (en ? 'Upgrade plan' : 'Mejorar plan') : (en ? 'Change plan or payment method' : 'Cambiar plan o forma de pago'))}</a></div>`;
}

PAGES.ficha = async (v) => {
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  const [{ data: b }, cats] = await Promise.all([
    sb.from('businesses').select('*').eq('id', BIZ.id).maybeSingle(),
    sb.from('categories').select('id, slug, names, position').order('position', { ascending: true })
      .then(({ data }) => data || []),
  ]);
  if (!b) { v.innerHTML = '<div class="card">No hemos podido cargar tu ficha.</div>'; return; }

  const redes = b.social_links || {};
  const horas = b.opening_hours || {};
  let logo = b.logo_url || '';
  let portada = b.cover_image_url || '';
  let galeria = b.gallery || [];

  const pinta = () => {
    v.innerHTML = `
      <div class="page-head"><h1>Tu ficha</h1><span class="spacer"></span>
        <a class="btn sm" href="https://klendar.app/b/${esc(BIZ.id)}" target="_blank" rel="noopener">Ver cómo se ve ↗</a></div>
      ${helpBox('¿Qué es esto?', bi('<p>Lo que ve la gente cuando entra en tu negocio: el nombre, de qué va, dónde estás, cómo llamarte y tus horarios. Es la misma ficha que editas desde la app.</p><p>La <b>dirección</b> se busca en el mapa al guardar. Si el punto no queda donde debe, arrastra la chincheta en «Ubicación en el mapa».</p>',
      '<p>What people see when they open your business: the name, what you do, where you are, how to call you and your opening hours. It is the same page you edit from the app.</p><p>The <b>address</b> is looked up on the map when you save. If the pin is not in the right place, drag it in “Location on the map”.</p>'))}
      <form id="f" class="form">
        <label class="f"><span>Nombre</span><input name="name" value="${esc(b.name || '')}" required maxlength="80" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Categoría</span><select name="category_id" ${canManage ? '' : 'disabled'}>
          ${(cats || []).map((c) => `<option value="${esc(c.id)}" ${c.id === b.category_id ? 'selected' : ''}>${esc(c.names?.es || c.slug)}</option>`).join('')}</select></label>
        <label class="f full"><span>De qué va <small>(dos líneas bastan)</small></span><textarea name="description" maxlength="500" ${canManage ? '' : 'disabled'}>${esc(b.description || '')}</textarea></label>
        <label class="f"><span>Dirección</span><input name="address" value="${esc(b.address || '')}" maxlength="120" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Ciudad</span><input name="city" value="${esc(b.city || '')}" maxlength="60" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Teléfono</span><input name="phone" value="${esc(b.phone || '')}" maxlength="20" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Web</span><input name="website" type="url" value="${esc(b.website || '')}" ${canManage ? '' : 'disabled'}></label>
        <label class="f"><span>Correo de contacto</span><input name="contact_email" type="email" value="${esc(b.contact_email || '')}" ${canManage ? '' : 'disabled'}></label>
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
        <p style="margin:10px 0 0"><button class="btn primary sm" id="g-punto" disabled>Guardar la ubicación</button> <span class="muted" id="msgp"></span></p></div>` : ''}

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
        ${canManage ? '<p style="margin:10px 0 0"><button class="btn sm" data-img="gallery">Añadir fotos</button></p>' : ''}</div>`;

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
          $('#g-punto', v).disabled = true;
          $('#msgp', v).textContent = I18N.t('Guardada');
          toast('Ubicación guardada');
        } catch (err) { toast(friendly(err.message), true); }
      };
    })();

    $('#f', v).onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
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
        else toast('No hemos encontrado esa dirección en el mapa; ajústala desde la app.', true);
      }
      try {
        await rpc('update_business', { p_id: BIZ.id, p_patch: patch });
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
        for (const f of [...input.files].slice(0, que === 'gallery' ? 6 : 1)) {
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
      '<p><b>Staff</b>: validates QR codes. <b>Manager</b>: also publishes, edits the business page and runs the team. <b>Owner</b>: everything; their role cannot be changed from here.</p>'))}
    <div id="list"></div>
    ${invites.length ? `<div class="card" style="margin-top:14px"><h2>Invitaciones pendientes</h2>
      <p class="muted">Todavía no tienen cuenta en Klendar. Entran solas al registrarse con ese correo.</p>
      ${table({ cols: [
        { h: 'Correo', r: (i) => esc(i.email) },
        { h: 'Rol', r: (i) => tag(i.role) },
        { h: 'Invitada', r: (i) => fmtDate(i.created_at) },
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
        intro: esc(I18N.t('Si aún no tiene cuenta en Klendar, le mandamos un correo con la invitación y entra al equipo en cuanto se registre con esa dirección.')),
        fields: [
          { name: 'email', label: 'Correo', type: 'email', required: true },
          { name: 'role', label: 'Rol', type: 'select', value: 'staff', options: [['staff', 'Empleado'], ['manager', 'Encargado']] },
        ],
        submit: 'Añadir',
      });
      if (!r) return;
      try {
        const res = await rpc('add_business_member', { p_business_id: BIZ.id, p_email: r.email, p_role: r.role });
        if (!res.ok) { toast(ERRORS[res.error] || res.error, true); return; }
        toast(res.invited ? 'Invitación enviada: le hemos mandado un correo' : 'Añadido al equipo');
        route();
      } catch (e) { toast(friendly(e.message), true); }
    };
    $$('[data-role]', v).forEach((b) => {
      b.onclick = async () => {
        const res = await rpc('set_business_member_role', { p_business_id: BIZ.id, p_user_id: b.dataset.user, p_role: b.dataset.role });
        if (!res.ok) { toast(ERRORS[res.error] || res.error, true); return; }
        toast('Rol cambiado'); route();
      };
    });
    $$('[data-remove]', v).forEach((b) => {
      b.onclick = async () => {
        if (!await confirmDlg('Quitar del equipo', 'Dejará de poder validar códigos y de ver el panel.', { danger: true, submit: 'Quitar' })) return;
        await rpc('remove_business_member', { p_business_id: BIZ.id, p_user_id: b.dataset.remove });
        toast('Fuera del equipo'); route();
      };
    });
    $$('[data-cancel]', v).forEach((b) => {
      b.onclick = async () => {
        await sb.from('business_invites').delete().eq('id', b.dataset.cancel);
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
      ? `<div class="card"><h2>De dónde viene tu gente</h2><p class="muted" style="margin:0">Todavía son pocas personas (${fmtNum(aud.people)}) para enseñarlo sin señalar a nadie. A partir de cinco aparece aquí.</p></div>`
      : '';
  }
  const total = tramos.reduce((a, b) => a + b.n, 0) || 1;
  return `<div class="card"><h2>De dónde viene tu gente</h2>
    <div class="bars">${tramos.map((t) => `
      <div class="bar"><span class="bl">${esc(t.bucket)}</span>
        <span class="bt"><i style="width:${Math.round((t.n / total) * 100)}%"></i></span>
        <span class="bn">${fmtNum(t.n)}</span></div>`).join('')}</div>
    <p class="muted small" style="margin:10px 0 0">${esc(bi(`Distancia entre tu local y el último sitio conocido de quien ha canjeado algo, de ${fmtNum(aud.people)} persona(s). Es aproximado y nunca se enseña dónde está nadie.`,
      `Distance between your place and the last known location of people who redeemed something (${fmtNum(aud.people)} ${aud.people === 1 ? 'person' : 'people'}). It is approximate and never shows where anyone is.`))}</p>
  </div>`;
}

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
  const eur = (c) => (c == null ? '—' : (c / 100).toFixed(2).replace('.', ',') + ' €');
  const pct = (a, b) => (!b ? '—' : Math.round((a * 100) / b) + ' %');
  const hours = r.by_hour || [];
  const best = hours.slice().sort((a, b) => b.redeemed - a.redeemed)[0];
  const maxDay = Math.max(1, ...(r.daily || []).map((d) => Math.max(d.views, d.codes)));

  v.innerHTML = `
    <div class="page-head"><h1>Informe</h1><span class="spacer"></span>
      ${[7, 30, 90, 365].map((d) => `<a class="btn sm ${d === days ? '' : 'ghost'}" href="#/informe/${d}">${d === 365 ? '1 año' : d + ' días'}</a>`).join(' ')}
    </div>
    <div class="card"><h2>El periodo en cuatro cifras</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(t.views)}</b><span>Vistas</span></div>
        <div class="kpi"><b>${fmtNum(t.codes)}</b><span>Códigos generados</span></div>
        <div class="kpi accent"><b>${fmtNum(t.redeemed)}</b><span>Canjes validados</span></div>
        <div class="kpi"><b>${pct(t.redeemed, t.codes)}</b><span>De código a canje</span></div>
      </div>
      <p class="muted" style="margin:10px 0 0"><b>${fmtNum(t.unused)}</b> código(s) se quedaron sin usar.${best ? ` La hora a la que más se canjea es a las <b>${best.hour}:00</b>.` : ''}</p>
    </div>

    <div class="card"><h2>Día a día</h2>
      <div class="spark">${(r.daily || []).map((d) => `<i title="${d.day}: ${d.views} vistas, ${d.redeemed} canjes" style="height:${Math.round((d.views / maxDay) * 100)}%"><u style="height:${d.views ? Math.round((d.redeemed / Math.max(d.views, 1)) * 100) : 0}%"></u></i>`).join('')}</div>
      <p class="muted" style="margin:8px 0 0">Cada barra es un día: la altura son las vistas y la parte de color, los canjes.</p>
    </div>

    ${audienciaHtml(aud)}

    <div class="card"><h2>Por publicación</h2><div class="actions" style="margin-bottom:10px"><button class="btn sm" id="csvOffers">Descargar CSV</button></div>
      ${table({
        cols: [
          { h: 'Publicación', r: (o) => `<b class="title">${esc(o.title)}</b><span class="sub">${esc(LABELS[o.kind] || o.kind)} · ${fmtDate(o.starts_at)}</span>` },
          { h: 'Precio', r: (o) => eur(o.price_cents) },
          { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
          { h: 'Códigos', num: true, r: (o) => fmtNum(o.codes) },
          { h: 'Canjes', num: true, r: (o) => fmtNum(o.redeemed) },
          { h: 'Aforo', num: true, r: (o) => (o.max_redemptions == null ? '—' : `${o.seats_left}/${o.max_redemptions}`) },
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
    ['at', 'Fecha y hora'], ['title', 'Publicación'], ['code', 'Código'], [(x) => x.seats ?? 1, 'Plazas'], ['by', 'Validado por'],
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
          <span><b>${esc(r.display_name || 'Usuario')}</b><small class="muted">${esc(fmtDate(r.created_at))}</small></span>${estrellas(r.rating)}</header>
        ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
        ${r.photo_url ? `<img class="foto" src="${esc(r.photo_url)}" alt="" loading="lazy">` : ''}
        ${r.reply ? `<div class="respuesta"><b>Respuesta de <span>${esc(BIZ.name)}</span></b>${r.reply_at ? `<small class="muted"> · ${esc(fmtDate(r.reply_at))}</small>` : ''}<p>${esc(r.reply).replace(/\n/g, '<br>')}</p></div>` : ''}
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
    if (!texto && !(await confirmDlg('Borrar la respuesta', '', { submit: 'Quitar', danger: true }))) return;
    if (texto && texto.length < 2) { toast('Escribe al menos 2 caracteres.', true); return; }
    const res = await rpc('reply_to_review', { p_review: r.id, p_reply: texto }).catch((e) => ({ ok: false, error: e.message }));
    if (!res?.ok) {
      toast(res?.error === 'invalid_reply' ? 'Escribe al menos 2 caracteres.'
        : res?.error === 'not_authorized' ? ERRORS.not_authorized : 'No se ha podido guardar', true);
      return;
    }
    toast(texto ? 'Respuesta publicada' : 'Respuesta borrada');
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
const hoyMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const ERR_CIERRE = {
  too_long: 'Como mucho tres meses seguidos.',
  too_many: 'Ya tienes 12 cierres por delante. Quita alguno antes.',
  in_the_past: 'Esas fechas ya han pasado.',
  invalid_range: 'El último día no puede ser antes que el primero.',
  not_authorized: ERRORS.not_authorized,
};
PAGES.cerrados = async (v) => {
  const lista = await rpc('business_closures', { p_business: BIZ.id });
  const hoy = hoyMadrid();
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
        ...(gestiona() ? [{ h: '', r: (c, i) => `<span class="actions"><button class="btn sm" data-del="${i}">${ms('delete')}Quitar</button></span>` }] : []),
      ],
      rows: lista,
      empty: 'No tienes días cerrados por delante.',
    })}</div>
    ${gestiona() ? `<div class="card"><h2>Añadir días cerrados</h2>
      <form id="f" class="form">
        <label class="f"><span>Primer día</span><input type="date" name="from" required min="${hoy}"></label>
        <label class="f"><span>Último día</span><input type="date" name="to" required min="${hoy}"></label>
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
