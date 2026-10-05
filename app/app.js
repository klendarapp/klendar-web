/* «Tu cuenta» en la web: lo mismo que la app, desde cualquier navegador.
 *
 * Una sola página con rutas en el `#`: entrar, registrarse, planes
 * guardados, favoritos, códigos (con su QR para enseñar en la barra) y
 * recibos. Todo pasa por las mismas funciones de la base que usa la app,
 * así que una cuenta es la misma en los dos sitios y lo que guardas en uno
 * aparece en el otro.
 *
 * Está pensada para el móvil primero: quien la use muchas veces será alguien
 * que no quiere instalarse nada y abre el enlace desde el navegador.
 */
'use strict';

const I18N = makeI18N(APP_EN);
const t = I18N.t;
const EN = I18N.lang === 'en';
// El «Cargando…» del HTML, mientras llega la primera pantalla.
I18N.translate(document.getElementById('view'));
const LOC = EN ? 'en-GB' : 'es-ES';
// PKCE y los enlaces de los correos: /assets/acceso.js. El enlace (si lo
// hay) se canjea al cargar, antes de mirar la sesión.
const sb = window.KL_SUPABASE();
const ENLACE = window.KL_ENLACE(sb);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const view = $('#view');

// ── Idioma: solo queda la cabecera y el pie que tocan ─────────────────────
// Se quitan del documento los del otro idioma (no basta con ocultarlos: el
// menú del móvil va por un id y habría dos iguales).
for (const el of $$(`[data-only="${EN ? 'es' : 'en'}"]`)) el.remove();
for (const el of $$(`[data-only="${EN ? 'en' : 'es'}"]`)) el.hidden = false;
for (const a of $$('.lang a[data-lang]')) {
  a.addEventListener('click', () => {
    try { localStorage.setItem('klendar_lang', a.dataset.lang); } catch { /* sin permisos */ }
  });
}
document.documentElement.lang = EN ? 'en' : 'es';
document.title = `${t('Tu cuenta')} · Klendar`;

// ── Formatos ──────────────────────────────────────────────────────────────
// El código para leerlo o dictarlo, de cuatro en cuatro («0882 7EC7 …»),
// igual que en la app. Al validarlo se aceptan con o sin espacios.
const codigoLegible = (c) => String(c || '').toUpperCase().replace(/(.{4})(?=.)/g, '$1 ');
const money = (c, cur = 'EUR') => (c == null ? '' : (c / 100).toLocaleString(LOC, { style: 'currency', currency: cur || 'EUR' }));
// Las horas de un código o de un plan, en la del negocio (Canarias va una
// por detrás de la península; ver /assets/zona.js). `tz` es su zona; sin
// ella, Madrid.
const KZ = globalThis.KlendarZona;
const fecha = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, tz) => {
  if (!iso) return '';
  if (KZ) return KZ.fmt(iso, tz, LOC, opts);
  try { return new Intl.DateTimeFormat(LOC, { timeZone: 'Europe/Madrid', ...opts }).format(new Date(iso)); } catch { return ''; }
};
/** Zona de cada negocio, por id. Las listas de «Tu cuenta» no traen
 * coordenadas, pero `businesses.time_zone` se puede leer: una consulta por
 * lista y lo que ya se sabe no se vuelve a pedir. Devuelve `fila → zona`. */
const ZONAS = new Map();
async function zonasDe(filas) {
  const faltan = [...new Set((filas || []).map((f) => f?.business_id).filter(Boolean))].filter((id) => !ZONAS.has(id));
  if (faltan.length && KZ) {
    try {
      const { data } = await sb.from('businesses').select('id, time_zone').in('id', faltan);
      for (const f of data || []) if (KZ.valida(f.time_zone)) ZONAS.set(f.id, f.time_zone);
    } catch { /* sin red: Madrid */ }
  }
  return (fila) => ZONAS.get(fila?.business_id) || (KZ ? KZ.de(fila) : undefined);
}
function beneficio(d, precio, moneda) {
  if (d?.type === 'percent') return `−${d.value} %`;
  if (d?.type === 'fixed') return money(Math.round(Number(d.value) * 100), moneda);
  if (d?.type === '2x1') return '2x1';
  if (d?.type === 'free') return t('Gratis');
  // «Otro»: la app y el panel lo guardan en value.
  if (d?.type === 'other' && d.value) return String(d.value);
  if (d?.label) return d.label;
  if (precio === 0) return t('Gratis');
  return precio != null ? money(precio, moneda) : '';
}
const pre = EN ? '/en' : '';

// ── Avisos y errores, en cristiano ────────────────────────────────────────
function toast(msg, malo = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast${malo ? ' bad' : ''}`;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, malo ? 6000 : 3500);
}

/** Lo que devuelve la base, contado para quien usa la app, no para quien la
 * programa. Lo que no se conoce no se enseña crudo. */
const ERRORES = {
  'Invalid login credentials': 'El correo o la contraseña no coinciden.',
  'Email not confirmed': 'Todavía no has confirmado tu correo. Mira tu bandeja de entrada (y el spam).',
  'User already registered': 'Ya hay una cuenta con ese correo. Prueba a entrar.',
  'Password should be at least': 'La contraseña tiene que tener al menos 8 caracteres.',
  'rate limit': 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
  not_authenticated: 'Tienes que entrar en tu cuenta.',
  reauth_required: 'Por seguridad, vuelve a confirmar que eres tú.',
  owns_business: 'Eres propietario de un negocio: dalo de baja o traspásalo antes de eliminar la cuenta.',
  image_not_allowed: 'Esa foto no se puede usar. Súbela desde Klendar.',
  offensive_name: 'Ese nombre no está permitido: no puede tener insultos ni palabras malsonantes. Elige otro.',
  offer_not_found: 'Esa publicación ya no existe.',
  not_redeemable: 'Esta publicación no se canjea con código.',
  offer_not_active: 'Esta publicación ya no está activa.',
  not_started: 'Todavía no ha empezado. Vuelve a la hora que dice.',
  outside_window: 'Ahora mismo está fuera de su horario.',
  adults_only: 'Esta publicación es solo para mayores de 18.',
  already_redeemed: 'Ya la has canjeado.',
  sold_out: 'Se han acabado las plazas.',
  not_enough_seats: 'Ya no quedan tantas plazas. Prueba con menos.',
  rate_limited: 'Vas muy rápido. Espera un momento y vuelve a probar.',
  not_enough_stamps: 'Todavía te faltan sellos para el premio.',
};
/** Un error de acceso (entrar, registrarse, códigos) dicho como en la app. */
const errAuth = (error) => window.KL_AUTH_ERROR(error, EN ? 'en' : 'es');

/** La comprobación anti-robots antes de pedir nada a Supabase Auth
 * (`KL_CAPTCHA`, en assets/auth-errors.js). Sin clave en el entorno no hace
 * nada. Devuelve `{ token }` o `{ error }` para enseñarlo como los demás. */
async function sinRobots() {
  try { return { token: await window.KL_CAPTCHA?.() }; } catch (e) { return { error: e }; }
}

function amable(msg) {
  const m = String(msg || '');
  for (const [k, v] of Object.entries(ERRORES)) {
    if (m === k || m.includes(k)) return t(v);
  }
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) {
    return t('No hay conexión. Revisa tu internet y vuelve a probar.');
  }
  return t('Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.');
}

/** Llama a una función de la base y lanza con un mensaje entendible. */
async function llamar(fn, args = {}) {
  let res;
  try {
    res = await sb.rpc(fn, args);
  } catch (e) {
    throw new Error(amable(e.message));
  }
  // `datos`: lo demás que manda la base con el error (p. ej. de qué negocio
  // es una exclusiva), para las pantallas que lo cuentan con nombre.
  const falla = (clave, datos = null) => Object.assign(new Error(amable(clave)), { clave: String(clave || ''), datos });
  if (res.error) throw falla(res.error.message);
  const d = res.data;
  if (d && typeof d === 'object' && !Array.isArray(d) && d.ok === false) throw falla(d.error, d);
  return d;
}

/** El mismo patrón de correo que la app (AuthForm.email). */
const CORREO_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// ── Sesión ────────────────────────────────────────────────────────────────
let YO = null;
/** Se llegó por el enlace de «¿Has olvidado la contraseña?»: la contraseña
 * nueva no pide la vieja (el enlace ya demuestra que eres tú). */
let RECUPERANDO = false;
async function sesion() {
  await ENLACE;
  const { data } = await sb.auth.getSession();
  YO = data.session?.user || null;
  return YO;
}
sb.auth.onAuthStateChange((ev, s) => {
  YO = s?.user || null;
  // «Sigue usándola»: la base lo apunta como mucho una vez por hora (así no
  // le llega «vuelve, tu barrio se mueve» a quien entra a diario).
  if (s && (ev === 'INITIAL_SESSION' || ev === 'SIGNED_IN')) sb.rpc('mark_seen').then(() => {}, () => {});
  // La cabecera (Entrar ↔ tu inicial), sin esperar a cambiar de página.
  if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') setTimeout(() => window.KL_CABECERA?.(), 0);
  // El enlace de «he olvidado la contraseña» abre sesión y trae aquí; Supabase
  // se come la ruta (#/nueva-clave), así que se lleva a mano.
  if (ev === 'PASSWORD_RECOVERY') { RECUPERANDO = true; location.hash = '#/nueva-clave'; }
  // Los códigos que el panel guardó sin conexión eran de esta sesión.
  if (ev === 'SIGNED_OUT') {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        // Y los códigos guardados para cuando no hay cobertura (por persona).
        if (k && (k.startsWith('klendar.cola.') || k.startsWith('klendar.codigos.'))) localStorage.removeItem(k);
      }
      localStorage.removeItem('klendar.biz');
    } catch { /* sin permisos */ }
  }
});

function exigeSesion(ruta) {
  if (YO) return true;
  location.hash = `#/entrar?siguiente=${encodeURIComponent(ruta)}`;
  return false;
}

// ── Acciones que llegan por enlace ────────────────────────────────────────
// Las rutas que hacen algo (guardar, seguir, «Voy», lista de espera, sacar un
// código o reservar plazas) solo actúan solas si vienen de un botón de esta
// web: la ficha pública y la propia cuenta dejan una marca en sessionStorage
// al pulsarlo (assets/cabecera.js). Un enlace abierto desde fuera (un chat,
// otra web, `#/entrar?siguiente=…`) no la trae: primero se dice qué va a
// pasar y se pide confirmar, como en /r/.
const INTENCION = 'klendar.intencion';
function marcaIntencion(ruta) {
  try { sessionStorage.setItem(INTENCION, JSON.stringify({ r: ruta, t: Date.now() })); } catch { /* sin almacenamiento */ }
}
/** ¿Se pulsó en esta web el botón de esta ruta hace poco? Se gasta al mirarla. */
function hayIntencion(ruta) {
  try {
    const m = JSON.parse(sessionStorage.getItem(INTENCION) || 'null');
    if (!m || m.r !== ruta) return false;
    sessionStorage.removeItem(INTENCION);
    return Date.now() - m.t < 15 * 60 * 1000;
  } catch { return false; }
}
/** Con marca, sigue sin preguntar; sin ella, pinta qué va a pasar y espera
 * al botón. Cancelar vuelve a la ficha (y la promesa se queda sin cumplir). */
async function confirmaEnlace(ruta, { titulo, que, texto, boton, volver }) {
  if (hayIntencion(ruta)) return true;
  return new Promise((sigue) => {
    pinta(`
      <div class="ticket">
        <h1>${esc(titulo)}</h1>
        ${que ? `<p><b>${esc(que)}</b></p>` : ''}
        ${texto ? `<p class="muted">${esc(texto)}</p>` : ''}
        <p class="acciones">
          <button type="button" class="pill accent" id="confirmaEnlace">${esc(boton)}</button>
          <a class="pill" href="${esc(volver)}">${esc(t('Cancelar'))}</a>
        </p>
      </div>`);
    I18N.translate(view);
    $('#confirmaEnlace').addEventListener('click', () => sigue(true), { once: true });
  });
}
/** El título (y el local) de una publicación para la pantalla de confirmar.
 * `rp`: el código del enlace de un RRPP (una de RRPP solo se abre con él). */
async function queOferta(id, rp = '') {
  try {
    const fila = await llamar('offer_detail', { p_id: id, p_rp: rp || null });
    const o = Array.isArray(fila) ? fila[0] : fila;
    return o ? [o.title, o.business_name].filter(Boolean).join(' · ') : '';
  } catch { return ''; }
}

// ── Entrar con Google ─────────────────────────────────────────────────────
// Solo se ofrece si el proyecto de Supabase tiene Google activo (en dev no
// lo está): un botón que no funciona es peor que ninguno.
/** Qué formas de entrar tiene activas el proyecto (Google, Apple, SMS). Se
 * pregunta una vez. Así un botón solo aparece cuando de verdad funciona, y el
 * día que se active en Supabase sale solo, sin tocar la web. */
let PROVEEDORES = null;
async function proveedores() {
  if (PROVEEDORES === null) {
    try {
      const r = await fetch(`${window.KLENDAR_ENV.url}/auth/v1/settings`, { headers: { apikey: window.KLENDAR_ENV.key } });
      PROVEEDORES = r.ok ? ((await r.json()).external || {}) : {};
    } catch { PROVEEDORES = {}; }
  }
  return PROVEEDORES;
}
const LOGO_GOOGLE = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const LOGO_APPLE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.54 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.74 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.14.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.3-3.51zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.21z"/></svg>';

/** Pinta en `#google` las otras formas de entrar que estén activas (Google,
 * Apple, teléfono). `siguiente` es la ruta a la que volver; `destino`, la
 * página de vuelta (el panel, por ejemplo). Las mismas que la app. */
async function botonGoogle(siguiente, destino = '/app/') {
  const hueco = $('#google');
  if (!hueco) return;
  const ext = await proveedores();
  const botones = [];
  if (ext.google) botones.push(`<button class="pill google" type="button" data-prov="google">${LOGO_GOOGLE} ${esc(t('Continuar con Google'))}</button>`);
  if (ext.apple) botones.push(`<button class="pill google" type="button" data-prov="apple">${LOGO_APPLE} ${esc(t('Continuar con Apple'))}</button>`);
  if (ext.phone) botones.push(`<a class="pill google" href="#/movil${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}${destino !== '/app/' ? `${siguiente ? '&' : '?'}destino=${encodeURIComponent(destino)}` : ''}">${esc(t('Entrar con el teléfono'))}</a>`);
  if (!botones.length) return;
  hueco.innerHTML = `<div class="acciones">${botones.join('')}</div>
    <p class="muted" style="font-size:13px">${esc(t('Si es tu primera vez, se crea tu cuenta y te pediremos tu fecha de nacimiento y que aceptes los términos.'))}</p>`;
  $$('[data-prov]', hueco).forEach((b) => {
    b.onclick = async () => {
      const vuelta = new URL(destino, location.origin);
      if (siguiente) vuelta.searchParams.set('siguiente', siguiente);
      const { error } = await sb.auth.signInWithOAuth({ provider: b.dataset.prov, options: { redirectTo: vuelta.toString() } });
      if (error) toast(errAuth(error), true);
    };
  });
}

// ── Un último paso: términos y edad ───────────────────────────────────────
// Quien entra con Google no pasa por el alta: sin esto no constaba que
// aceptase los términos ni sabíamos si tiene 14 años. Se pregunta una vez.
// Y si aceptó una versión anterior a la vigente, se le vuelve a pedir
// («Hemos actualizado los términos y la privacidad»).
// La versión vigente la decide la base (`app_config.terms`, `my_consents`
// → `terms_current` / `terms_outdated`), que además guarda siempre esa al
// registrarse o aceptar. Esta constante es solo el respaldo que se manda.
const TERMINOS_VERSION = '2026-09-29';
// `nombre`: falta el nombre y no ha dicho «Ahora no» (se pregunta «¿Cómo te
// llamas?», como en la app); `alta`: aún se está creando la cuenta (sin
// términos o sin fecha), y entonces el nombre es obligatorio.
const SIN_PASOS = { id: null, ok: true, fecha: true, nueva: false, vigente: null, nombre: false, alta: false };
let CONSENTIMIENTO = { ...SIN_PASOS };
async function faltaConsentimiento() {
  if (!YO) return false;
  if (CONSENTIMIENTO.id !== YO.id) {
    try {
      const c = await llamar('my_consents', {});
      if (!c) {
        // La cuenta ya no existe (borrada desde otro sitio): se sale sin más.
        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
        YO = null;
        return false;
      }
      CONSENTIMIENTO = {
        id: YO.id,
        ok: Boolean(c.terms_accepted_at) && c.terms_outdated !== true,
        fecha: c.has_birth_date !== false,
        // Ya los aceptó una vez: lo que falta es aceptar la versión nueva.
        nueva: Boolean(c.terms_accepted_at) && c.terms_outdated === true,
        vigente: c.terms_current || null,
        // Sin nombre (entró con un código, o Apple no lo dio): «¿Cómo te llamas?».
        nombre: c.has_display_name === false && !c.name_asked_at,
        alta: !c.terms_accepted_at || c.has_birth_date === false,
      };
    } catch { CONSENTIMIENTO = { ...SIN_PASOS, id: YO.id }; } // sin red: no se bloquea
  }
  // Sin fecha de nacimiento tampoco: quien entra con un código por correo
  // acepta los términos al continuar, pero la edad mínima (14) hay que
  // comprobarla igual (como en la app).
  return !CONSENTIMIENTO.ok || !CONSENTIMIENTO.fecha || CONSENTIMIENTO.nombre;
}

// ── Rutas ─────────────────────────────────────────────────────────────────
const RUTAS = {};
function rutaActual() {
  const h = location.hash.replace(/^#\/?/, '');
  const [camino, qs] = h.split('?');
  const partes = camino.split('/').filter(Boolean);
  return { partes, params: new URLSearchParams(qs || ''), crudo: h };
}

/** Lo que sigue vivo mientras se ve una pantalla (vigilar si validan el
 * código, cuentas atrás…). Se apaga al cambiar de pantalla. */
let AL_SALIR = [];
const alSalir = (fn) => { AL_SALIR.push(fn); };
function apagaPantalla() {
  const lista = AL_SALIR;
  AL_SALIR = [];
  for (const fn of lista) { try { fn(); } catch { /* ya estaba apagado */ } }
}

async function navegar() {
  apagaPantalla();
  await sesion();
  // Un enlace del correo que no ha servido (caducado, ya usado…), aquí o en
  // el panel antes de mandar a entrar: se dice una vez.
  const aviso = window.KL_ENLACE.aviso(EN ? 'en' : 'es');
  if (aviso) toast(aviso, true);
  // Vuelta de Google (o de un enlace de correo): «?siguiente=» dice adónde.
  const q = new URLSearchParams(location.search);
  if (YO && q.has('siguiente')) {
    const sig = q.get('siguiente') || '';
    q.delete('siguiente');
    history.replaceState(null, '', `${location.pathname}${q.toString() ? `?${q}` : ''}#/${sig}`);
  }
  let { partes, params, crudo } = rutaActual();
  if (partes[0] !== 'ultimo-paso' && await faltaConsentimiento()) {
    ({ partes, params, crudo } = { partes: ['ultimo-paso'], params: new URLSearchParams({ siguiente: crudo }), crudo });
  }
  const nombre = partes[0] || '';
  const pagina = RUTAS[nombre] || RUTAS[''];
  window.scrollTo(0, 0);
  try {
    await pagina(partes.slice(1), params, crudo);
  } catch (e) {
    console.error(e);
    // Si ya lo canjeaste, lo útil es llevarte a tus códigos, no a un error.
    const yaEsTuyo = /already_redeemed|max_per_user/.test(e.clave || '');
    view.innerHTML = pantallaVacia({
      icono: yaEsTuyo ? 'qr_code_2' : 'refresh',
      titulo: t(yaEsTuyo ? 'Ya lo tienes' : 'Algo ha fallado'),
      texto: e.message || amable(''),
      h: 'h1',
      botones: yaEsTuyo
        ? `<a class="pill accent" href="#/codigos">${esc(t('Tus códigos'))}</a>
           <a class="pill" href="#/">${esc(t('Volver'))}</a>`
        : `<button type="button" class="pill accent" id="reintentar">${esc(t('Reintentar'))}</button>
           <a class="pill" href="#/">${esc(t('Volver'))}</a>`,
    });
    $('#reintentar')?.addEventListener('click', () => navegar());
  }
  I18N.translate(view);
}
addEventListener('hashchange', navegar);
// Un enlace a la ruta en la que ya estás no dispara «hashchange»: se repinta a mano.
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[href^="#/"]');
  if (!a || ev.defaultPrevented || a.getAttribute('href') !== location.hash) return;
  ev.preventDefault();
  navegar();
});

const pinta = (html) => { view.innerHTML = html; };
/** Ir a otra ruta. Si ya estás en ella, el navegador no avisa del cambio:
 * se vuelve a pintar a mano (si no, al entrar se quedaba el formulario). */
const vuelve = (siguiente) => {
  const destino = siguiente ? `#/${siguiente}` : '#/';
  if (location.hash === destino || (destino === '#/' && !location.hash)) navegar();
  else location.hash = destino;
};

/** Hay una sola pantalla de entrar para todo (también para el panel de
 * negocios): quien llega desde el panel trae `?destino=/panel/…` y vuelve
 * allí al entrar. Solo rutas propias. */
const destinoTrasEntrar = () => rutaInterna(new URLSearchParams(location.search).get('destino'));

/** Una dirección de vuelta (`?destino=`, `?volver=`) de esta misma web y sin
 * datos: `/panel/` o `/app/`, como mucho `?lang=`/`?alta=` y una ruta del
 * hash (`#/validar`, `#/publicaciones/<id>`, `?biz=<id>`). Otra web, `//…`,
 * tokens o correos en el hash: fuera. '' = no hay a dónde volver. */
function rutaInterna(v) {
  const s = String(v || '');
  if (!/^\/(panel|app)\//.test(s)) return '';
  let u;
  try { u = new URL(s, location.origin); } catch { return ''; }
  if (u.origin !== location.origin || !/^\/(panel|app)\/$/.test(u.pathname)) return '';
  const q = new URLSearchParams();
  for (const k of ['lang', 'alta']) {
    const x = u.searchParams.get(k);
    if (x != null && /^[a-z0-9]{1,5}$/i.test(x)) q.set(k, x);
  }
  const [h, hq] = u.hash.split('?');
  const biz = new URLSearchParams(hq || '').get('biz');
  const hash = /^#\/[a-z0-9-]{1,30}(\/[A-Za-z0-9-]{1,40}){0,2}$/.test(h || '')
    ? h + (biz && /^[0-9a-f-]{36}$/i.test(biz) ? `?biz=${biz}` : '')
    : '';
  return `${u.pathname}${q.toString() ? `?${q}` : ''}${hash}`;
}
const vieneDelPanel = () => destinoTrasEntrar().startsWith('/panel/');
const trasEntrar = (siguiente) => {
  const d = destinoTrasEntrar();
  if (d) { location.href = d; return; }
  vuelve(siguiente);
};

// ── Inicio ────────────────────────────────────────────────────────────────
/** Un icono de Material Symbols: los mismos que la app. */
const ic = (nombre) => `<span class="ms" aria-hidden="true">${nombre}</span>`;

/** Pantalla vacía o de error que ocupa la página (docs/GLOSARIO.md de la
 * app, «Aspecto»): icono, título (encabezado), texto y botones, todo
 * centrado (`.vacio` en site.css). `botones`: HTML de `.pill` (el principal,
 * `accent`), uno debajo de otro y del ancho del más largo. Los textos llegan
 * ya traducidos. Dentro de una lista o una sección con más cosas, `.empty`. */
/** El botón de salida de una página que no se puede enseñar. */
const botonTuCuenta = () => `<a class="pill accent" href="#/">${esc(t('Tu cuenta'))}</a>`;

const pantallaVacia = ({ icono = '', titulo, texto = '', botones = '', h = 'h2' }) => `
  <section class="vacio">
    ${icono ? `<span class="vacio-ic">${ic(icono)}</span>` : ''}
    <${h}>${esc(titulo)}</${h}>
    ${texto ? `<p>${esc(texto)}</p>` : ''}
    ${botones ? `<div class="vacio-botones">${botones}</div>` : ''}
  </section>`;

/** Una fila de lista como las de la app: icono, título, detalle y flecha. */
const fila = ({ href, icono, titulo, detalle, fuera = false, id = '' }) => `
  <a class="fila" href="${esc(href)}"${fuera ? ' target="_blank" rel="noopener"' : ''}${id ? ` id="${id}"` : ''}>
    ${ic(icono)}
    <span class="fila-t"><b>${esc(titulo)}</b>${detalle ? `<small>${esc(detalle)}</small>` : ''}</span>
    ${ic(fuera ? 'open_in_new' : 'chevron_right')}
  </a>`;

// La misma disposición que la pestaña Cuenta de la app: quién eres arriba,
// lo que más se usa a un toque y lo demás agrupado. Lo irreversible (eliminar
// la cuenta) vive en Ajustes.
RUTAS[''] = async () => {
  if (!YO) return RUTAS.entrar([], new URLSearchParams());
  const foto = YO.user_metadata?.avatar_url;
  const [negocios, invitaciones, delPerfil, rolesRrpp] = await Promise.all([
    llamar('my_businesses', {}).catch(() => []),
    // Un negocio te ha invitado a su equipo (o te ofrece ser su
    // propietario, o ser su RRPP): se contesta desde aquí.
    Promise.all([
      llamar('my_team_invites', {}).catch(() => []),
      llamar('my_business_transfers', {}).catch(() => []),
      llamar('my_promoter_invites', {}).catch(() => []),
    ]).then(([a, b, c]) => ({ equipo: [...(a || []), ...(b || [])], rrpp: c || [] })),
    // El de su perfil, que es lo que ven los demás (Google y Apple no lo
    // dejan en `display_name` de la cuenta).
    nombrePublico(),
    // Los locales en los que eres RRPP (la sección sale solo si hay alguno).
    llamar('my_promoter_roles', {}).catch(() => []),
  ]);
  // Sin nombre, lo mismo que ven los demás (nunca el correo). Sin red, el
  // de la cuenta.
  const nombre = (delPerfil === undefined ? (YO.user_metadata?.display_name || '').trim() : delPerfil)
    || t('Usuario de Klendar');
  const tieneNegocio = Array.isArray(negocios) && negocios.length > 0;
  const nInv = invitaciones.equipo.length + invitaciones.rrpp.length;
  // Solo de equipo (o traspasos): como siempre; con alguna de RRPP, «Tienes
  // una invitación» a secas.
  const textoInv = !invitaciones.rrpp.length
    ? (nInv === 1 ? t('Tienes una invitación de equipo') : (EN ? `You have ${nInv} team invitations` : `Tienes ${nInv} invitaciones de equipo`))
    : (nInv === 1 ? t('Tienes una invitación') : (EN ? `You have ${nInv} invitations` : `Tienes ${nInv} invitaciones`));
  pinta(`
    <h1 class="titulo-pagina">${esc(t('Tu cuenta'))}</h1>
    <a class="perfil" href="#/ajustes">
      <span class="avatar">${foto ? `<img src="${esc(foto)}" alt="">` : esc((nombre || '?').charAt(0).toUpperCase())}</span>
      <span class="perfil-t"><b>${esc(nombre)}</b><small>${esc(YO.email || '')}</small><em>${esc(t('Editar perfil'))}</em></span>
      ${ic('chevron_right')}
    </a>

    <div id="aviso-correo"></div>

    ${nInv ? `<a class="invitacion inv-equipo" href="#/invitaciones">
        <span class="inv-ic">${ic('group_add')}</span>
        <span class="fila-t"><b>${esc(textoInv)}</b>
          <small>${esc(t('Acéptala o recházala'))}</small></span>
        ${ic('chevron_right')}
      </a>` : ''}

    <div class="rapidos">
      <a class="rapido" href="#/planes">${ic('bookmark')}<b>${esc(t('Tus planes'))}</b></a>
      <a class="rapido" href="#/codigos">${ic('qr_code_2')}<b>${esc(t('Tus códigos'))}</b></a>
      <a class="rapido" href="#/favoritos">${ic('favorite')}<b>${esc(t('Favoritos'))}</b></a>
      <a class="rapido" href="#/sellos">${ic('local_activity')}<b>${esc(t('Tarjetas de sellos'))}</b></a>
      <a class="rapido" href="#/notificaciones">${ic('notifications')}<b>${esc(t('Notificaciones'))}</b><span class="badge-n" id="sin-leer" hidden></span></a>
      <a class="rapido" href="${EN ? '/en/explore/' : '/explorar/'}">${ic('explore')}<b>${esc(t('Explorar'))}</b></a>
    </div>

    <div class="lista lista-amigos">
      ${fila({ href: '#/amigos', icono: 'group', titulo: t('Amigos'), detalle: t('Tu enlace de amigo, tu QR y tu lista') })}
    </div>

    ${rrppPortadaHtml(rolesRrpp)}

    ${tieneNegocio ? `
      <h2 class="seccion-t">${esc(t('Negocio'))}</h2>
      <div class="lista">
        ${fila({ href: '/panel/', icono: 'storefront', titulo: t('Mi negocio'), detalle: t('Publicaciones, informe, equipo') })}
        ${fila({ href: '/panel/#/validar', icono: 'qr_code_scanner', titulo: t('Validar códigos'), detalle: t('Escanea los códigos de tus clientes') })}
      </div>` : `
      <a class="invitacion" href="/panel/">
        <span class="inv-ic">${ic('storefront')}</span>
        <span class="fila-t"><b>${esc(t('¿Quieres registrar tu negocio?'))}</b>
          <small>${esc(t('Publica ofertas y eventos, valida canjes y sigue tus cifras. Prueba gratis de 30 días.'))}</small></span>
        ${ic('chevron_right')}
      </a>`}

    <h2 class="seccion-t">${esc(t('Preferencias'))}</h2>
    <div class="lista">
      ${fila({ href: '#/alertas', icono: 'add_alert', titulo: t('Avísame si…'), detalle: t('Que te avisemos cuando salga algo que te interesa cerca') })}
      ${fila({ href: '#/series', icono: 'notifications', titulo: EN ? 'Series you follow' : 'Series que sigues', detalle: EN ? "We'll tell you about each new date" : 'Te avisamos de cada fecha nueva' })}
      ${fila({ href: '#/ajustes', icono: 'tune', titulo: t('Ajustes'), detalle: t('Idioma, notificaciones, privacidad y cuenta') })}
    </div>

    <h2 class="seccion-t">${esc(t('Ayuda'))}</h2>
    <div class="lista">
      ${fila({ href: '#/sugerencias', icono: 'lightbulb', titulo: t('Sugerencias y mejoras'), detalle: t('Cuéntanos qué cambiarías o qué falla') })}
      ${fila({ href: 'mailto:info@klendar.app', icono: 'mail', titulo: t('Contacto y soporte'), detalle: 'info@klendar.app' })}
      ${fila({ href: EN ? '/en/terms/' : '/terminos/', icono: 'description', titulo: t('Términos de uso'), fuera: true })}
      ${fila({ href: EN ? '/en/privacy/' : '/privacidad/', icono: 'privacy_tip', titulo: t('Política de privacidad'), fuera: true })}
    </div>

    <button class="pill ancho" id="salir">${ic('logout')} ${esc(t('Cerrar sesión'))}</button>`);
  pintaSinLeer();
  // Su correo nos devuelve los mensajes: que lo revise o lo cambie.
  correoAvisoPortada($('#aviso-correo'));
  $('#salir').onclick = async () => {
    await sb.auth.signOut({ scope: 'local' }); // solo este navegador, como la app
    toast(t('Has cerrado sesión'));
    vuelve('');
  };
};

// ── Formularios de acceso: como la app ────────────────────────────────────
// El error de cada campo va debajo de él (y se quita al corregirlo), el
// botón se bloquea mientras se espera y los textos son los de la app
// (AuthForm): «Obligatorio», «Ese correo no parece válido»…
const VALIDA = {
  requerido: (v) => (String(v).trim() ? null : t('Obligatorio')),
  correo: (v) => (!String(v).trim() ? t('Obligatorio')
    : CORREO_OK.test(String(v).trim()) ? null : t('Ese correo no parece válido')),
  clave: (v) => (!v ? t('Obligatorio') : v.length < 8 ? t('Mínimo 8 caracteres') : null),
  // 14 años (LOPDGDD art. 7), como AuthForm.birthDate.
  // Como el selector de la app: de hace 110 años a hoy (y 14 como mínimo).
  nacimiento: (v) => (!v ? t('Obligatorio')
    : !/^\d{4}-\d{2}-\d{2}$/.test(v) || edadDe(v) > 110 || v > hoyISO() ? t('Revisa la fecha')
    : edadDe(v) < 14 ? (EN ? 'You need to be at least 14 to use Klendar' : 'Necesitas tener al menos 14 años para usar Klendar') : null),
  terminos: (v) => (v ? null : t('Tienes que aceptar los términos y la política de privacidad.')),
};

/** Hoy (fecha local) como AAAA-MM-DD, y el tope de edad de los selectores. */
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const LIMITES_NACIMIENTO = () => `min="${new Date().getFullYear() - 110}-01-01" max="${hoyISO()}"`;

/** Años cumplidos a día de hoy de una fecha AAAA-MM-DD. */
function edadDe(nac) {
  const d = new Date(`${nac}T12:00:00`);
  const hoy = new Date();
  let edad = hoy.getFullYear() - d.getFullYear();
  if (hoy.getMonth() < d.getMonth() || (hoy.getMonth() === d.getMonth() && hoy.getDate() < d.getDate())) edad -= 1;
  return edad;
}

/** La casilla de términos, igual en el alta y en «un último paso». */
const casillaTerminos = () => `<label class="check"><input type="checkbox" name="terms" required>
  <span>${esc(t('He leído y acepto los'))} <a href="${EN ? '/en/terms/' : '/terminos/'}" target="_blank">${esc(t('Términos de uso'))}</a>
    ${esc(t('y la'))} <a href="${EN ? '/en/privacy/' : '/privacidad/'}" target="_blank">${esc(t('Política de privacidad'))}</a></span></label>
  <label class="check"><input type="checkbox" name="marketing">
  <span>${esc(t('Quiero recibir novedades y ofertas destacadas por correo (opcional).'))}</span></label>`;

function errorCampo(el, msg) {
  const label = el.closest('label') || el.parentElement;
  const id = `err-${el.name}`;
  let s = document.getElementById(id);
  label.classList.toggle('con-error', Boolean(msg));
  if (!msg) {
    s?.remove();
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
    return;
  }
  if (!s) {
    s = document.createElement('small');
    s.className = 'err-campo';
    s.id = id;
    if (label.classList.contains('check')) label.insertAdjacentElement('afterend', s);
    else label.appendChild(s);
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => errorCampo(el, null), { once: true });
  }
  s.textContent = msg;
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', id);
}

/** `reglas`: { nombreDelCampo: (valor, form) => mensaje | null }. */
function validaForm(form, reglas) {
  let primero = null;
  for (const [nombre, regla] of Object.entries(reglas)) {
    const el = form.elements[nombre];
    if (!el) continue;
    const msg = regla(el.type === 'checkbox' ? el.checked : el.value, form);
    errorCampo(el, msg);
    if (msg && !primero) primero = el;
  }
  primero?.focus();
  return !primero;
}

/** El diálogo de confirmar, como el de la app (confirmDialog): título,
 * explicación, «Cancelar» y la acción, en rojo si no tiene vuelta atrás.
 * Devuelve true solo si se confirma. */
function confirma({ titulo, texto = '', lista = [], pie = '', aceptar, peligro = false, cancelar = t('Cancelar') }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    d.setAttribute('aria-labelledby', 'dialogo-t');
    d.innerHTML = `<h2 id="dialogo-t">${esc(titulo)}</h2>
      ${texto ? `<p class="muted">${esc(texto)}</p>` : ''}
      ${lista.length ? `<ul class="dialogo-lista">${lista.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${pie ? `<p class="muted">${esc(pie)}</p>` : ''}
      <div class="dialogo-botones">
        <button type="button" class="pill" value="no">${esc(cancelar)}</button>
        <button type="button" class="pill ${peligro ? 'peligro-lleno' : 'accent'}" value="si">${esc(aceptar)}</button>
      </div>`;
    document.body.appendChild(d);
    let ok = false;
    d.querySelectorAll('button').forEach((b) => { b.onclick = () => { ok = b.value === 'si'; d.close(); }; });
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // fuera del cuadro, cancela
    d.addEventListener('close', () => { d.remove(); resolve(ok); });
    d.showModal();
    d.querySelector('button[value=no]').focus();
  });
}

/** «Confirma que eres tú» antes de cambiar la contraseña o eliminar la
 * cuenta, como la app (confirmIdentity): la contraseña actual o, si la cuenta
 * no tiene (entró con Google o Apple), un código de 6 cifras al correo. Quien
 * tiene contraseña puede pedir también el código: las cuentas creadas con un
 * código llevan por dentro una contraseña que la persona no conoce. La lógica
 * está en assets/identidad.js. Devuelve la comprobación hecha (hay que
 * llamar a `cerrar()` al acabar) o null si se cancela. */
async function confirmaIdentidad() {
  let id = null;
  try { id = await window.KL_IDENTIDAD?.(sb); } catch { id = null; }
  if (!id) { toast(amable(''), true); return null; }
  let tieneClave = true;
  try {
    const m = await llamar('my_auth_methods', {});
    if (typeof m?.has_password === 'boolean') tieneClave = m.has_password;
  } catch { tieneClave = (YO?.identities || []).some((i) => i.provider === 'email'); }

  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialogo identidad';
    d.setAttribute('aria-labelledby', 'identidad-t');
    let conCodigo = !tieneClave;
    let enviado = false;
    let hecho = false;
    const correo = esc(id.email);
    const pinta1 = () => {
      d.innerHTML = `<h2 id="identidad-t">${esc(t('Confirma que eres tú'))}</h2>
        <form class="formu" novalidate>
          ${!conCodigo ? `<p class="muted">${esc(t('Por seguridad, escribe tu contraseña actual.'))}</p>
            <label>${esc(t('Contraseña actual'))}<input name="clave" type="password" autocomplete="current-password"></label>`
          : !enviado ? `<p class="muted">${EN ? `We'll email a 6-digit code to <b>${correo}</b>.` : `Te mandaremos un código de 6 cifras a <b>${correo}</b>.`}</p>`
          : `<p class="muted">${EN ? `Enter the 6-digit code we've sent to <b>${correo}</b>.` : `Escribe el código de 6 cifras que te hemos mandado a <b>${correo}</b>.`}</p>
            <label>${esc(t('Código'))}<input name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label>`}
          <p class="err" role="alert"></p>
          <div class="acciones">
            ${!conCodigo ? `<button type="button" class="pill" data-modo="codigo">${esc(t('Prefiero un código por correo'))}</button>` : ''}
            ${conCodigo && enviado ? `<button type="button" class="pill" data-reenvio>${esc(t('Enviar otro código'))}</button>` : ''}
            ${conCodigo && tieneClave ? `<button type="button" class="pill" data-modo="clave">${esc(t('Usar mi contraseña'))}</button>` : ''}
          </div>
          <div class="dialogo-botones">
            <button type="button" class="pill" value="no">${esc(t('Cancelar'))}</button>
            <button type="submit" class="pill accent">${esc(conCodigo && !enviado ? (EN ? 'Email me the code' : 'Enviarme el código') : t('Seguir'))}</button>
          </div>
        </form>`;
      const form = d.querySelector('form');
      const err = d.querySelector('.err');
      const falla = (e, clave) => {
        const invalida = clave && (e?.code === 'invalid_credentials' || /invalid login credentials/i.test(e?.message || ''));
        err.textContent = invalida ? t('La contraseña no es correcta.') : errAuth(e);
      };
      d.querySelector('button[value=no]').onclick = () => d.close();
      d.querySelectorAll('[data-modo]').forEach((b) => { b.onclick = () => { conCodigo = b.dataset.modo === 'codigo'; pinta1(); }; });
      const reenv = d.querySelector('[data-reenvio]');
      if (reenv) {
        // Recién mandado: la cuenta atrás de 60 s empieza ya.
        reenvio(reenv, async () => {
          try { await id.mandarCodigo(); return true; } catch (e) { falla(e); return false; }
        })();
      }
      form.onsubmit = (e) => {
        e.preventDefault();
        err.textContent = '';
        const boton = form.querySelector('button[type=submit]');
        if (!conCodigo) {
          if (!validaForm(form, { clave: VALIDA.requerido })) return;
          ocupado(boton, async () => {
            try { await id.conClave(form.elements.clave.value); } catch (x) { falla(x, true); return; }
            hecho = true;
            d.close();
          });
        } else if (!enviado) {
          ocupado(boton, async () => {
            try { await id.mandarCodigo(); } catch (x) { falla(x); return; }
            enviado = true;
            pinta1();
          });
        } else {
          const codigo = form.elements.codigo.value.replace(/\D/g, '');
          if (!/^\d{6}$/.test(codigo)) { errorCampo(form.elements.codigo, t('Son 6 cifras.')); return; }
          ocupado(boton, async () => {
            try { await id.conCodigo(codigo); } catch (x) { falla(x); return; }
            hecho = true;
            d.close();
          });
        }
      };
      (form.querySelector('input') || form.querySelector('button[type=submit]'))?.focus();
    };
    document.body.appendChild(d);
    d.addEventListener('close', async () => {
      d.remove();
      if (!hecho) await id.cerrar();
      resolve(hecho ? id : null);
    });
    pinta1();
    d.showModal();
    (d.querySelector('input') || d.querySelector('button[type=submit]'))?.focus();
  });
}

/** Un botón que se bloquea mientras trabaja, para no mandar dos veces. */
async function ocupado(boton, trabajo) {
  if (boton.disabled) return;
  const antes = boton.textContent;
  boton.disabled = true;
  boton.textContent = t('Un momento…');
  try { await trabajo(); } catch (e) { toast(e.message || amable(''), true); } finally {
    if (boton.isConnected) { boton.disabled = false; boton.textContent = antes; }
  }
}

/** «Enviar otro código» con su cuenta atrás de 60 s, como la app. */
function reenvio(boton, enviar) {
  let i = null;
  const arranca = () => {
    let falta = 60;
    boton.disabled = true;
    const pinta1 = () => {
      boton.textContent = falta > 0
        ? (EN ? `You can ask for another in ${falta} s` : `Puedes pedir otro en ${falta} s`)
        : t('Enviar otro código');
      boton.disabled = falta > 0;
    };
    pinta1();
    clearInterval(i);
    i = setInterval(() => { falta -= 1; pinta1(); if (falta <= 0) clearInterval(i); }, 1000);
  };
  boton.onclick = async () => { if (await enviar()) arranca(); };
  return arranca;
}

/** Lo que manda la app al crear la cuenta con un código (el texto legal de
 * debajo dice que al continuar se aceptan los términos). */
const DATOS_ALTA = () => ({ terms_accepted: true, terms_version: TERMINOS_VERSION, user_type: 'user', locale: EN ? 'en' : 'es' });
const conSiguiente = (ruta, siguiente) => `#/${ruta}${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}`;
const legalCodigo = () => `<p class="muted pie-form">${esc(t('Si es tu primera vez, se creará tu cuenta al entrar. Al continuar aceptas los términos y la política de privacidad.'))}
  <a href="${EN ? '/en/terms/' : '/terminos/'}" target="_blank">${esc(t('Términos de uso'))}</a> ·
  <a href="${EN ? '/en/privacy/' : '/privacidad/'}" target="_blank">${esc(t('Política de privacidad'))}</a></p>`;

// ── Entrar ────────────────────────────────────────────────────────────────
RUTAS.entrar = async (_p, params) => {
  const siguiente = params.get('siguiente') || '';
  if (YO) return trasEntrar(siguiente);
  const panel = vieneDelPanel();
  pinta(`
    <h1>${esc(t(panel ? 'Entra en tu panel' : 'Hola de nuevo'))}</h1>
    <p class="muted">${esc(t(panel
      ? 'Con la misma cuenta que usas en la app. Si tu negocio todavía no está dado de alta, entra y lo das de alta en un momento.'
      : 'Para guardar planes, tener favoritos y conseguir códigos.'))}</p>
    <form id="f" class="formu" novalidate>
      <label>${esc(t('Correo electrónico'))}<input name="email" type="email" autocomplete="username" required></label>
      <label>${esc(t('Contraseña'))}<input name="password" type="password" autocomplete="current-password" required></label>
      <p class="derecha"><a href="#/recuperar">${esc(t('¿Has olvidado la contraseña?'))}</a></p>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Entrar'))}</button>
    </form>
    <div class="alternativas">
      <a class="pill" href="${conSiguiente('codigo-correo', siguiente)}">${esc(t('Entrar con un código por correo'))}</a>
    </div>
    <div id="google" class="google-hueco"></div>
    <p class="muted">${esc(t('¿No tienes cuenta?'))} <a href="${panel ? '#/registro?para=negocio' : conSiguiente('registro', siguiente)}">${esc(t('Crear cuenta'))}</a></p>
    ${panel ? '' : `<p class="muted pie-form">${esc(t('¿Llevas un negocio? Es la misma cuenta: entra y ve a tu panel desde «Mi negocio».'))}</p>`}`);
  botonGoogle(siguiente, destinoTrasEntrar() || '/app/');

  $('#f').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    $('#err').textContent = '';
    if (!validaForm(form, { email: VALIDA.correo, password: (v) => (v ? null : t('Obligatorio')) })) return;
    ocupado(form.querySelector('button[type=submit]'), async () => {
      const robot = await sinRobots();
      if (robot.error) { $('#err').textContent = errAuth(robot.error); return; }
      const { error } = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value, options: { captchaToken: robot.token } });
      if (error) { $('#err').textContent = errAuth(error); return; }
      toast(t('Dentro'));
      trasEntrar(siguiente);
    });
  };
};

// ── Entrar con un código por correo ───────────────────────────────────────
RUTAS['codigo-correo'] = async (_p, params) => {
  const siguiente = params.get('siguiente') || '';
  pinta(`
    <h1>${esc(t('Entrar sin contraseña'))}</h1>
    <p class="muted" id="sub">${esc(t('Te mandamos un código al correo. Sin contraseñas que recordar.'))}</p>
    <form id="f1" class="formu" novalidate>
      <label>${esc(t('Correo electrónico'))}<input name="email" type="email" autocomplete="username" required></label>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(EN ? 'Email me the code' : 'Enviarme el código')}</button>
      ${legalCodigo()}
    </form>
    <form id="f2" class="formu" novalidate hidden>
      <label>${esc(t('Código'))}<input name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
      <p class="muted">${esc(t('En ese correo también hay un botón: si lo abres en este dispositivo, entras directamente.'))}</p>
      <p id="err2" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Entrar'))}</button>
      <div class="acciones">
        <button type="button" class="pill" id="otro">${esc(t('Enviar otro código'))}</button>
        <button type="button" class="pill" id="cambia">${esc(t('Cambiar de correo'))}</button>
      </div>
    </form>`);
  let correo = '';
  const manda = async () => {
    const robot = await sinRobots();
    if (robot.error) { ($('#f2').hidden ? $('#err') : $('#err2')).textContent = errAuth(robot.error); return false; }
    const { error } = await sb.auth.signInWithOtp({
      email: correo,
      options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/app/`, data: DATOS_ALTA(), captchaToken: robot.token },
    });
    if (error) { ($('#f2').hidden ? $('#err') : $('#err2')).textContent = errAuth(error); return false; }
    return true;
  };
  const cuentaAtras = reenvio($('#otro'), manda);
  $('#f1').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    $('#err').textContent = '';
    if (!validaForm(form, { email: VALIDA.correo })) return;
    correo = form.email.value.trim();
    ocupado(form.querySelector('button[type=submit]'), async () => {
      if (!(await manda())) return;
      $('#f1').hidden = true;
      $('#f2').hidden = false;
      $('#sub').textContent = EN ? `We wrote to ${correo}` : `Te hemos escrito a ${correo}`;
      $('#f2').token.focus();
      cuentaAtras();
    });
  };
  $('#cambia').onclick = () => {
    $('#f2').hidden = true; $('#f1').hidden = false;
    $('#sub').textContent = t('Te mandamos un código al correo. Sin contraseñas que recordar.');
  };
  $('#f2').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    $('#err2').textContent = '';
    const token = form.token.value.replace(/\D/g, '');
    if (!/^\d{6}$/.test(token)) { errorCampo(form.token, t('Son 6 cifras.')); return; }
    ocupado(form.querySelector('button[type=submit]'), async () => {
      const { error } = await sb.auth.verifyOtp({ email: correo, token, type: 'email' });
      if (error) { $('#err2').textContent = errAuth(error); return; }
      toast(t('Dentro'));
      trasEntrar(siguiente);
    });
  };
};

// ── Entrar con el teléfono (SMS) ──────────────────────────────────────────
// Lo mismo que la app: prefijo, número, código de seis cifras. Si es la
// primera vez, se crea la cuenta y luego se piden edad y términos.
RUTAS.movil = async (_p, params) => {
  const siguiente = params.get('siguiente') || '';
  // `destino` en la ruta: enlaces antiguos del panel (#/movil?destino=…).
  const pedido = params.get('destino') || '';
  const destino = rutaInterna(pedido) || destinoTrasEntrar();
  // Con el SMS apagado en Supabase, un enlace antiguo a #/movil llevaría a un
  // formulario que siempre falla: mejor la pantalla de entrar.
  if (!(await proveedores()).phone) return RUTAS.entrar(_p, params);
  const PREFIJOS = ['+34', '+351', '+33', '+44', '+39', '+49'];
  pinta(`
    <h1>${esc(t('Entrar con el teléfono'))}</h1>
    <p class="muted" id="sub">${esc(t('Te mandamos un código por SMS. Sin contraseñas.'))}</p>
    <form id="f1" class="formu" novalidate>
      <div class="fila-tel">
        <label>${esc(t('País'))}<select name="prefijo">${PREFIJOS.map((x) => `<option>${x}</option>`).join('')}</select></label>
        <label>${esc(t('Número de teléfono'))}<input name="numero" type="tel" inputmode="tel" autocomplete="tel-national" required></label>
      </div>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Enviarme el código'))}</button>
      ${legalCodigo()}
    </form>
    <form id="f2" class="formu" novalidate hidden>
      <label>${esc(t('Código'))}<input name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
      <p id="err2" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Entrar'))}</button>
      <div class="acciones">
        <button type="button" class="pill" id="otro">${esc(t('Enviar otro código'))}</button>
        <button type="button" class="pill" id="cambia">${esc(t('Cambiar de número'))}</button>
      </div>
    </form>`);
  let telefono = '';
  const manda = async () => {
    const robot = await sinRobots();
    if (robot.error) { ($('#f2').hidden ? $('#err') : $('#err2')).textContent = errAuth(robot.error); return false; }
    const { error } = await sb.auth.signInWithOtp({ phone: telefono, options: { data: DATOS_ALTA(), captchaToken: robot.token } });
    if (error) { ($('#f2').hidden ? $('#err') : $('#err2')).textContent = errAuth(error); return false; }
    return true;
  };
  const cuentaAtras = reenvio($('#otro'), manda);
  $('#f1').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    $('#err').textContent = '';
    const numero = form.numero.value.replace(/[\s.-]/g, '');
    if (!validaForm(form, { numero: () => (/^\d{6,12}$/.test(numero) ? null : t('Escribe un número válido')) })) return;
    telefono = `${form.prefijo.value}${numero}`;
    ocupado(form.querySelector('button[type=submit]'), async () => {
      if (!(await manda())) return;
      $('#f1').hidden = true; $('#f2').hidden = false;
      $('#sub').textContent = EN ? `We sent a text to ${telefono}` : `Te hemos enviado un SMS a ${telefono}`;
      $('#f2').token.focus();
      cuentaAtras();
    });
  };
  $('#cambia').onclick = () => {
    $('#f2').hidden = true; $('#f1').hidden = false;
    $('#sub').textContent = t('Te mandamos un código por SMS. Sin contraseñas.');
  };
  $('#f2').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    $('#err2').textContent = '';
    const token = form.token.value.replace(/\D/g, '');
    if (!/^\d{6}$/.test(token)) { errorCampo(form.token, t('Son 6 cifras.')); return; }
    ocupado(form.querySelector('button[type=submit]'), async () => {
      const { error } = await sb.auth.verifyOtp({ phone: telefono, token, type: 'sms' });
      if (error) { $('#err2').textContent = errAuth(error); return; }
      toast(t('Dentro'));
      if (destino) { location.href = destino; return; }
      vuelve(siguiente);
    });
  };
};

// ── Registrarse ───────────────────────────────────────────────────────────
// Lo mismo que pide la app: nombre, fecha de nacimiento (14 años o más),
// términos y, aparte, si quiere novedades.
RUTAS.registro = async (_p, params) => {
  const siguiente = params.get('siguiente') || '';
  // Desde «Acceso para negocios»: al terminar, al alta del negocio.
  const negocio = params.get('para') === 'negocio';
  const destino = negocio ? `${location.origin}/panel/?alta=1` : `${location.origin}/app/`;
  pinta(`
    <h1>${esc(t(negocio ? 'Crea tu cuenta de negocio' : 'Crea tu cuenta'))}</h1>
    <p class="muted">${esc(t(negocio
      ? 'Primero tu cuenta personal (la misma para la web y la app). Justo después das de alta tu negocio.'
      : 'Un minuto y estás dentro. Es la misma cuenta para la web y para la app.'))}</p>
    <form id="f" class="formu" novalidate>
      <label>${esc(t('Nombre'))}<input name="name" autocomplete="name" maxlength="40" required></label>
      <label>${esc(t('Correo electrónico'))}<input name="email" type="email" autocomplete="email" required></label>
      <label>${esc(t('Contraseña'))}<input name="password" type="password" autocomplete="new-password" minlength="8" required>
        <small>${esc(t('Mínimo 8 caracteres'))}</small></label>
      <label>${esc(t('Repite la contraseña'))}<input name="password2" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>${esc(t('Fecha de nacimiento'))}<input name="birth" type="date" ${LIMITES_NACIMIENTO()} required>
        <small>${esc(t('Solo para mostrarte ofertas adecuadas a tu edad.'))}</small></label>
      ${casillaTerminos()}
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Crear cuenta'))}</button>
    </form>
    <div id="google" class="google-hueco"></div>
    <p class="muted">${esc(t('¿Ya tienes cuenta?'))} <a href="${conSiguiente('entrar', siguiente)}">${esc(t('Entra'))}</a></p>`);
  botonGoogle(negocio ? '' : siguiente, negocio ? '/panel/?alta=1' : '/app/');

  $('#f').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    const err = $('#err');
    err.textContent = '';
    // Las mismas comprobaciones que la app (AuthForm).
    const ok = validaForm(form, {
      name: VALIDA.requerido,
      email: VALIDA.correo,
      password: VALIDA.clave,
      password2: (v, f) => VALIDA.clave(v) || (v !== f.password.value ? t('Las contraseñas no coinciden') : null),
      birth: VALIDA.nacimiento,
      terms: VALIDA.terminos,
    });
    if (!ok) return;
    const email = form.email.value.trim();
    const nac = form.birth.value;
    ocupado(form.querySelector('button[type=submit]'), async () => {
      // El nombre se ve en reseñas y amigos: sin insultos ni palabrotas (la
      // base lo dejaría vacío). Sin conexión se da por bueno.
      let nombreOk = true;
      try {
        const { data: sirve } = await sb.rpc('display_name_allowed', { p_name: form.elements.name.value.trim() });
        nombreOk = sirve !== false;
      } catch { /* sin conexión: lo mira la base al crear la cuenta */ }
      if (!nombreOk) { err.textContent = t('Ese nombre no está permitido: no puede tener insultos ni palabras malsonantes. Elige otro.'); return; }
      const robot = await sinRobots();
      if (robot.error) { $('#err').textContent = errAuth(robot.error); return; }
      const { data, error } = await sb.auth.signUp({
        email,
        password: form.password.value,
        options: {
          captchaToken: robot.token,
          emailRedirectTo: destino,
          data: {
            display_name: form.elements.name.value.trim(),
            birth_date: nac,
            terms_accepted: true,
            terms_version: TERMINOS_VERSION,
            marketing_consent: form.marketing.checked,
            user_type: 'user',
            locale: EN ? 'en' : 'es',
          },
        },
      });
      if (error) { err.textContent = errAuth(error); return; }
      if (!data.session) {
        // El correo lleva enlace y código: el código sirve si lo abres en otro
        // dispositivo (el ordenador aquí, el correo en el móvil).
        pinta(`<h1>${esc(t('Revisa tu correo'))}</h1>
          <p class="muted">${esc(EN ? `We've sent a link to ${email} to confirm your account.` : `Te hemos enviado un enlace a ${email} para confirmar tu cuenta.`)}</p>
          <form id="fc" class="formu" novalidate>
            <label>${esc(t('O escribe aquí el código de 6 cifras del correo'))}
              <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"></label>
            <p id="errc" class="err" role="alert"></p>
            <button class="pill accent" type="submit">${esc(t('Confirmar'))}</button>
          </form>
          <p class="muted">${esc(t('¿No te llega? Mira en spam o en «Promociones».'))} <a href="#/entrar">${esc(t('Ir a entrar'))}</a></p>`);
        I18N.translate(view);
        $('#fc').onsubmit = (ev) => {
          ev.preventDefault();
          const fc = ev.target;
          $('#errc').textContent = '';
          const code = fc.code.value.replace(/\D/g, '');
          if (!/^\d{6}$/.test(code)) { errorCampo(fc.code, t('Son 6 cifras.')); return; }
          ocupado(fc.querySelector('button[type=submit]'), async () => {
            const r = await sb.auth.verifyOtp({ email, token: code, type: 'signup' });
            if (r.error) { $('#errc').textContent = errAuth(r.error); return; }
            toast(t('Cuenta confirmada'));
            if (negocio) location.href = '/panel/?alta=1'; else vuelve(siguiente);
          });
        };
        return;
      }
      toast(t('Cuenta creada'));
      if (negocio) { location.href = '/panel/?alta=1'; return; }
      vuelve(siguiente);
    });
  };
};

// ── Recuperar la contraseña ───────────────────────────────────────────────
RUTAS.recuperar = async () => {
  pinta(`
    <h1>${esc(t('Recuperar contraseña'))}</h1>
    <p class="muted">${esc(t('Te enviamos un enlace para crear una nueva.'))}</p>
    <form id="f" class="formu" novalidate>
      <label>${esc(t('Correo electrónico'))}<input name="email" type="email" autocomplete="username" required></label>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Enviar enlace'))}</button>
    </form>`);
  $('#f').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    $('#err').textContent = '';
    if (!validaForm(form, { email: VALIDA.correo })) return;
    const email = form.email.value.trim();
    ocupado(form.querySelector('button[type=submit]'), async () => {
      const robot = await sinRobots();
      if (robot.error) { $('#err').textContent = errAuth(robot.error); return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/app/#/nueva-clave`, captchaToken: robot.token });
      // Se dice lo mismo exista o no la cuenta (Supabase no da pistas de quién
      // está); sí se avisa si no hay red o si se ha pedido demasiadas veces.
      if (error) { $('#err').textContent = errAuth(error); return; }
      pinta(`<h1>${esc(t('Enlace enviado'))}</h1>
        <p class="muted">${esc(EN ? `If ${email} has an account, it'll get an email in a few seconds. Check spam too.`
          : `Si ${email} tiene cuenta, recibirá un correo en unos segundos. Mira también en spam.`)}</p>
        <p><a class="pill" href="#/entrar">${esc(t('Ir a entrar'))}</a></p>`);
      I18N.translate(view);
    });
  };
};

RUTAS['nueva-clave'] = async (_p, params) => {
  if (!YO) return RUTAS.recuperar();
  // Desde Ajustes («Formas de entrar») se vuelve allí al guardar.
  const siguiente = /^[a-z-]+$/.test(params?.get('siguiente') || '') ? params.get('siguiente') : '';
  // Por el enlace de recuperación (aquí, o desde el panel o el admin, que
  // traen la sesión recién abierta) no se pide la contraseña vieja. Desde
  // Ajustes, o sin venir de ese enlace, primero «Confirma que eres tú».
  const recuperando = siguiente !== 'ajustes'
    && (RECUPERANDO || await window.KL_IDENTIDAD?.reciente(sb, ['recovery', 'otp', 'magiclink'], 600));
  pinta(`
    <h1>${esc(t('Nueva contraseña'))}</h1>
    <p class="muted">${esc(t('Elige una que no uses en otros sitios.'))}</p>
    <form id="f" class="formu" novalidate>
      <label>${esc(t('Contraseña'))}<input name="p1" type="password" autocomplete="new-password" minlength="8" required>
        <small>${esc(t('Mínimo 8 caracteres'))}</small></label>
      <label>${esc(t('Repite la contraseña'))}<input name="p2" type="password" autocomplete="new-password" minlength="8" required></label>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Guardar contraseña'))}</button>
    </form>`);
  $('#f').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    $('#err').textContent = '';
    const ok = validaForm(form, {
      p1: VALIDA.clave,
      p2: (v, f) => VALIDA.clave(v) || (v !== f.p1.value ? t('Las contraseñas no coinciden') : null),
    });
    if (!ok) return;
    ocupado(form.querySelector('button[type=submit]'), async () => {
      if (recuperando) {
        const { error } = await sb.auth.updateUser({ password: form.p1.value });
        if (error) { $('#err').textContent = errAuth(error); return; }
      } else {
        const id = await confirmaIdentidad();
        if (!id) return;
        try {
          await id.cambiarClave(form.p1.value);
        } catch (x) {
          $('#err').textContent = errAuth(x);
          return;
        } finally {
          await id.cerrar();
        }
      }
      RECUPERANDO = false;
      toast(t(siguiente ? 'Contraseña guardada' : 'Contraseña actualizada'));
      // Desde el panel de negocios se vuelve al panel; desde el admin, a su
      // pantalla de entrar (tiene su propia sesión: ver admin.js).
      const pedido = new URLSearchParams(location.search).get('destino');
      const destino = rutaInterna(pedido) || (pedido === '/admin/' ? '/admin/' : '');
      if (destino) { location.href = destino; return; }
      vuelve(siguiente);
    });
  };
};

// ── Tarjeta de publicación, como en la agenda ─────────────────────────────
/** «Para favoritos» / «Para clientes»: una publicación que solo ve quien
 * tiene el negocio en favoritos o sellos en sus tarjetas. */
const etiquetaExclusiva = (aud) => (aud === 'favorites' ? t('Para favoritos') : aud === 'customers' ? t('Para clientes') : '');

/** Una exclusiva que no es para ti (al pedir el código o reservar): de
 * quién es, qué hace falta y el botón para conseguirlo, como en la app. */
function pintaExclusiva(aud, negocioId, negocio) {
  const fav = aud !== 'customers';
  const n = negocio || '';
  pinta(`
    <div class="ticket">
      <p class="hecho-ic" aria-hidden="true">${ic('lock')}</p>
      <h1>${esc(fav
        ? (EN ? `Exclusive for people who have ${n} in their favourites` : `Exclusiva para quien tiene ${n} en favoritos`)
        : (EN ? `Exclusive for ${n}'s customers` : `Exclusiva para clientes de ${n}`))}</h1>
      <p class="muted">${esc(fav
        ? (EN ? `This offer is only for people who have ${n} in their favourites.` : `Esta oferta es solo para quien tiene ${n} en favoritos.`)
        : (EN ? `This offer is only for customers with stamps from ${n}.` : `Esta oferta es solo para clientes con sellos de ${n}.`))}</p>
      ${fav ? '' : `<p class="muted">${esc(t('Es para quien tiene sellos en alguna de sus tarjetas. Consigue el primero canjeando una de sus ofertas o con el QR del local.'))}</p>`}
      <p class="acciones">
        ${negocioId ? (fav
          ? `<a class="pill accent" href="#/seguir/${esc(negocioId)}">${ic('favorite')} ${esc(t('Añadir a favoritos'))}</a>`
          : `<a class="pill accent" href="${pre}/b/${esc(negocioId)}">${ic('storefront')} ${esc(t('Ver el negocio'))}</a>`) : ''}
        <a class="pill" href="#/">${esc(t('Volver'))}</a>
      </p>
    </div>`);
}

function tarjeta(o, tz) {
  const img = (o.images || []).find((u) => !/\.(mp4|mov|webm)(\?|$)/i.test(u));
  // Si acaba otro día, el final lleva también el día (como en la app).
  const diaMes = { day: 'numeric', month: 'numeric' };
  const mismoDia = fecha(o.redeem_start_at, diaMes, tz) === fecha(o.redeem_end_at, diaMes, tz);
  const cuando = o.kind === 'future_event' ? fecha(o.event_at, undefined, tz)
    : `${fecha(o.redeem_start_at, undefined, tz)} – ${mismoDia ? fecha(o.redeem_end_at, { hour: '2-digit', minute: '2-digit' }, tz) : fecha(o.redeem_end_at, undefined, tz)}`;
  const tag = beneficio(o.discount, o.price_cents, o.currency);
  const exclusiva = etiquetaExclusiva(o.audience);
  return `<a class="ocard" href="${pre}/o/${esc(o.id)}">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
    <span class="ocard-body"><b>${esc(o.title)}</b>
      <span class="muted">${esc(o.business_name || '')}</span>
      <span class="ocard-meta">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}${exclusiva ? `<span class="tag off">${esc(exclusiva)}</span>` : ''}<span class="muted">${esc(cuando)}</span></span>
    </span></a>`;
}

// ── Tus planes ────────────────────────────────────────────────────────────
// Como «Planes» en la app (my_plans_screen): lo guardado y lo canjeado en
// tres bloques. «En curso»: los códigos vivos (pedidos y sin caducar).
// «Próximos»: lo guardado que aún no ha pasado. «Pasados»: los canjes hechos
// y lo guardado que ya pasó, de lo más reciente a lo más antiguo.
/** Cuándo «pasa» algo guardado: un evento, a su hora; una oferta, al acabar
 * el canje. Sin fecha, se da por próximo (como la app). */
const momentoPlan = (o) => {
  const iso = o.kind === 'future_event' ? o.event_at : o.redeem_end_at;
  return iso ? new Date(iso).getTime() : null;
};
RUTAS.planes = async () => {
  if (!exigeSesion('planes')) return;
  // Las mismas dos funciones que la app. Si fallan los canjes, se enseña lo
  // guardado igualmente (la app hace lo mismo).
  const [guardados, canjes, series] = await Promise.all([
    llamar('my_saved_offers', {}),
    llamar('my_redemptions', {}).catch(() => []),
    llamar('my_followed_series', {}).catch(() => []),
  ]);
  // «Sigues 2 series», arriba (sin series, nada), como la app.
  const nSeries = (series || []).length;
  const filaSeries = nSeries ? `<div class="lista">${fila({ href: '#/series', icono: 'notifications',
    titulo: EN ? (nSeries === 1 ? 'You follow 1 series' : `You follow ${nSeries} series`) : (nSeries === 1 ? 'Sigues 1 serie' : `Sigues ${nSeries} series`) })}</div>` : '';
  const saved = guardados || [];
  const reds = canjes || [];
  const zona = await zonasDe([...saved, ...reds]);
  const ahora = Date.now();
  const pasado = (o) => { const m = momentoPlan(o); return m != null && m < ahora; };
  const enCurso = reds.filter((r) => r.status === 'pending' && new Date(r.expires_at).getTime() > ahora);
  const proximos = saved.filter((o) => !pasado(o));
  const pasados = [
    ...reds.filter((r) => r.status === 'validated')
      .map((r) => ({ cuando: new Date(r.validated_at || r.created_at).getTime(), html: filaCanje(r, zona(r)) })),
    ...saved.filter(pasado).map((o) => ({ cuando: momentoPlan(o), html: tarjeta(o, zona(o)) })),
  ].sort((a, b) => b.cuando - a.cuando);

  const explorar = `<p><a class="pill" href="${EN ? '/en/explore/' : '/explorar/'}">${esc(t('Buscar planes'))}</a></p>`;
  if (!enCurso.length && !proximos.length && !pasados.length) {
    pinta(`
      <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
      <h1>${esc(t('Tus planes'))}</h1>
      ${filaSeries}
      ${pantallaVacia({
        icono: 'bookmark',
        titulo: t('Aún no tienes planes'),
        texto: t('Cuando algo te guste, dale a «Guardar» y lo tendrás aquí. Tus canjes también aparecerán.'),
        botones: `<a class="pill accent" href="${EN ? '/en/explore/' : '/explorar/'}">${esc(t('Buscar planes'))}</a>`,
      })}`);
    return;
  }
  const bloque = (titulo, filas, clase = '') => (filas.length
    ? `<h2 class="seccion-t">${esc(titulo)}</h2><div class="olist${clase}">${filas.join('')}</div>` : '');
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Tus planes'))}</h1>
    ${filaSeries}
    ${bloque(t('En curso'), enCurso.map((r) => filaCanje(r, zona(r))))}
    ${bloque(t('Próximos'), proximos.map((o) => tarjeta(o, zona(o))))}
    ${bloque(t('Pasados'), pasados.map((p) => p.html), ' pasado')}
    ${explorar}`);
};

/** Guardar, seguir y la lista de espera cambian algo y te lo confirman aquí
 * mismo (si volviéramos a la ficha al momento, el aviso se perdería). La
 * dirección pasa a la lista, para que recargar no deshaga lo hecho. */
function hecho({ titulo, texto, volver, volverTxt, lista, listaTxt, deshacer }) {
  pinta(`
    <div class="ticket">
      <p class="hecho-ic" aria-hidden="true">✓</p>
      <h1>${esc(titulo)}</h1>
      ${texto ? `<p class="muted">${esc(texto)}</p>` : ''}
      <p class="acciones">
        <a class="pill accent" href="${esc(volver)}">${esc(volverTxt)}</a>
        <a class="pill" href="${esc(lista)}">${esc(listaTxt)}</a>
      </p>
      ${deshacer ? `<p><a href="#/${esc(deshacer)}" data-deshacer>${esc(t('Deshacer'))}</a></p>` : ''}
    </div>`);
  history.replaceState(null, '', lista);
  I18N.translate(view);
  if (!deshacer) return;
  // «Deshacer» vuelve a llamar a la misma ruta aunque la dirección ya sea otra.
  $('[data-deshacer]').addEventListener('click', (ev) => {
    ev.preventDefault();
    marcaIntencion(deshacer);
    history.replaceState(null, '', `#/${deshacer}`);
    navegar();
  });
}

/** «Añadir» o «quitar» con funciones que alternan: primero se mira cómo
 * está, y solo se cambia si hace falta. La ficha pública no sabe quién la
 * mira y siempre ofrece «Guardar»; antes, si ya lo tenías, lo quitaba. */
async function ponOQuita(tablaNombre, campo, id, quitar, alternar) {
  const { data, error } = await sb.from(tablaNombre).select(campo).eq(campo, id).eq('user_id', YO.id).limit(1);
  if (error) throw Object.assign(new Error(amable(error.message)), { clave: error.message });
  const ya = Array.isArray(data) && data.length > 0;
  if (ya === !quitar) return { puesto: ya, yaEstaba: true };
  return { puesto: await alternar(), yaEstaba: false };
}

RUTAS.guardar = async ([id], params, crudo) => {
  if (!exigeSesion(`guardar/${id}`)) return;
  const quitar = params?.get('quitar') === '1';
  if (!(await confirmaEnlace(crudo, {
    titulo: t(quitar ? '¿Quitar de tus planes?' : '¿Guardar en tus planes?'), que: await queOferta(id),
    boton: t(quitar ? 'Quitar' : 'Guardar'), volver: `${pre}/o/${encodeURIComponent(id)}`,
  }))) return;
  const { puesto: guardado, yaEstaba } = await ponOQuita('saved_offers', 'offer_id', id, quitar,
    () => llamar('toggle_saved_offer', { p_offer: id }));
  hecho({
    titulo: guardado ? t(yaEstaba ? 'Ya estaba en tus planes' : 'Guardado en tus planes') : t('Quitado de tus planes'),
    texto: guardado ? t('Te avisamos si baja de precio y, si es un evento, antes de que empiece.') : '',
    volver: `${pre}/o/${encodeURIComponent(id)}`, volverTxt: t('Volver a la publicación'),
    lista: '#/planes', listaTxt: t('Ver tus planes'),
    deshacer: `guardar/${id}${guardado ? '?quitar=1' : ''}`,
  });
};

// ── Tus sitios (favoritos) ────────────────────────────────────────────────
// «1 oferta activa» / «3 ofertas activas», como en la app.
const cuantas = (n, es, en) => { const [uno, varios] = EN ? en : es; return n === 1 ? uno : `${n} ${varios}`; };

RUTAS.favoritos = async () => {
  if (!exigeSesion('favoritos')) return;
  const lista = await llamar('my_favorites', {});
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Favoritos'))}</h1>
    ${(lista || []).length ? `<div class="olist">${lista.map((b) => `
      <a class="ocard" href="${pre}/b/${esc(b.id)}">
        ${b.logo ? `<img src="${esc(b.logo)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
        <span class="ocard-body"><b>${esc(b.name)}</b>
          <span class="muted">${esc(b.city || '')}</span>
          <span class="ocard-meta">
            ${b.active_flash ? `<span class="tag">${esc(cuantas(b.active_flash, ['1 oferta activa', 'ofertas activas'], ['1 active offer', 'active offers']))}</span>` : ''}
            ${b.upcoming_events ? `<span class="muted">${esc(cuantas(b.upcoming_events, ['1 evento próximo', 'eventos próximos'], ['1 upcoming event', 'upcoming events']))}</span>` : ''}
            ${!b.active_flash && !b.upcoming_events ? `<span class="muted">${esc(EN ? 'Nothing new right now' : 'Sin novedades ahora mismo')}</span>` : ''}
          </span></span></a>`).join('')}</div>`
    : pantallaVacia({
      icono: 'favorite',
      titulo: t('Aún no tienes favoritos'),
      texto: t('En la ficha de un negocio, dale a «Añadir a favoritos» y te avisaremos cuando publique.'),
      botones: `<a class="pill accent" href="${EN ? '/en/explore/' : '/explorar/'}">${esc(t('Buscar planes'))}</a>`,
    })}`);
};

RUTAS.seguir = async ([id], params, crudo) => {
  if (!exigeSesion(`seguir/${id}`)) return;
  const quitar = params?.get('quitar') === '1';
  if (!(await confirmaEnlace(crudo, {
    titulo: t(quitar ? '¿Quitar de favoritos?' : '¿Añadir a favoritos?'),
    que: await sb.from('businesses').select('name').eq('id', id).maybeSingle().then((r) => r.data?.name || '', () => ''),
    boton: t(quitar ? 'Quitar' : 'Añadir'), volver: `${pre}/b/${encodeURIComponent(id)}`,
  }))) return;
  const { puesto: sigue, yaEstaba } = await ponOQuita('favorites', 'business_id', id, quitar,
    () => llamar('toggle_favorite', { p_business_id: id }));
  hecho({
    titulo: sigue ? t(yaEstaba ? 'Ya estaba en tus favoritos' : 'Añadido a favoritos') : t('Quitado de favoritos'),
    texto: sigue ? t('Te avisamos cuando publique algo nuevo.') : '',
    volver: `${pre}/b/${encodeURIComponent(id)}`, volverTxt: t('Volver al sitio'),
    lista: '#/favoritos', listaTxt: t('Ver tus favoritos'),
    deshacer: `seguir/${id}${sigue ? '?quitar=1' : ''}`,
  });
};

// ── Tus códigos ───────────────────────────────────────────────────────────
/** Un código o un canje en una lista (Tus códigos y Tus planes), como el
 * RedemptionTile de la app: uno vivo vuelve a su QR, uno usado enseña el
 * recibo y el resto, la publicación. `tz`: la zona del negocio. */
function filaCanje(r, tz) {
  const vivo = r.status === 'pending' && new Date(r.expires_at).getTime() > Date.now();
  const estado = r.status === 'validated' ? t('Canjeado')
    : vivo ? t('Código activo') : r.status === 'cancelled' ? t('Anulado') : t('Caducado');
  const destino = vivo ? `#/codigo/${esc(r.offer_id)}` : r.status === 'validated' ? `#/recibo/${esc(r.id)}` : `${pre}/o/${esc(r.offer_id)}`;
  return `
    <a class="ocard" href="${destino}">
      ${r.business_logo ? `<img src="${esc(r.business_logo)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
      <span class="ocard-body"><b>${esc(r.offer_title)}</b>
        <span class="muted">${esc(r.business_name)} · ${esc(fecha(r.validated_at || (r.status === 'pending' && r.event_at) || r.created_at, undefined, tz))}</span>
        <span class="ocard-meta"><span class="tag${vivo ? '' : ' off'}">${esc(estado)}</span>
          ${r.status === 'validated' ? `<span class="muted">${esc(t('Ver recibo'))} →</span>` : ''}</span>
      </span></a>`;
}

// ── Códigos guardados para cuando no hay cobertura ────────────────────────
// En la puerta de un local o en un sótano no siempre hay red, y «Tu código»
// siempre lo pedía a la base. Los vivos que se ven (al sacarlo y en «Tus
// códigos») se guardan en este navegador, por persona, y si no hay red se
// enseña el guardado: el QR vale igual en el local. Al cerrar sesión se
// borran (onAuthStateChange, arriba).
const claveCodigos = () => (YO ? `klendar.codigos.${YO.id}` : null);
function codigosGuardados() {
  try {
    const m = JSON.parse(localStorage.getItem(claveCodigos()) || '{}');
    return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
  } catch { return {}; }
}
/** Guarda los códigos vivos de `filas` (start_redemption o my_redemptions),
 * uno por publicación. `todos`: la lista entera de la base, que sustituye a
 * lo guardado (lo usado o anulado desaparece). */
function recuerdaCodigos(filas, todos = false) {
  const clave = claveCodigos();
  if (!clave) return;
  const ahora = Date.now();
  const m = todos ? {} : codigosGuardados();
  for (const r of filas) {
    if (!r?.offer_id || !r.code || !(new Date(r.expires_at).getTime() > ahora)) continue;
    m[r.offer_id] = {
      offer_id: r.offer_id, code: r.code, offer_title: r.offer_title || '', business_name: r.business_name || '',
      expires_at: r.expires_at, seats: r.seats || 1, discount: r.discount || null,
      price_cents: r.price_cents ?? null, currency: r.currency || 'EUR', tz: r.tz || null,
    };
  }
  // Lo caducado no se guarda.
  for (const [k, v] of Object.entries(m)) if (!(new Date(v.expires_at).getTime() > ahora)) delete m[k];
  try { localStorage.setItem(clave, JSON.stringify(m)); } catch { /* sin espacio o sin permisos */ }
}
function olvidaCodigo(offerId) {
  const m = codigosGuardados();
  if (!m[offerId]) return;
  delete m[offerId];
  try { localStorage.setItem(claveCodigos(), JSON.stringify(m)); } catch { /* sin permisos */ }
}
/** El guardado de esa publicación, si sigue vivo. */
function codigoGuardado(offerId) {
  const g = codigosGuardados()[offerId];
  return g && new Date(g.expires_at).getTime() > Date.now() ? g : null;
}
/** ¿El fallo es por no tener red? `llamar` trae la clave cruda de Supabase
 * («Failed to fetch») o, si lanzó, el texto ya traducido. */
const sinRedCuenta = (e) => navigator.onLine === false
  || /Failed to fetch|NetworkError|network|Load failed/i.test(`${e?.clave || ''} ${e?.message || ''}`)
  || e?.message === t('No hay conexión. Revisa tu internet y vuelve a probar.');
/** El ticket del código guardado, sin red: el mismo QR, sin «anular» (que
 * necesita la base). */
function pintaCodigoGuardado(g) {
  const benef = beneficio(g.discount, g.price_cents, g.currency);
  pinta(`
    <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
    <div class="ticket">
      <p class="aviso-inv">${esc(t('Sin conexión: este es tu código guardado. Vale igual en el local.'))}</p>
      <p class="muted">${esc(g.business_name || '')}</p>
      <h1>${esc(g.offer_title || '')}</h1>
      ${(g.seats || 1) > 1 ? `<p class="muted"><b>${g.seats} ${esc(t('plazas'))}</b></p>` : ''}
      ${benef ? `<p><span class="tag grande">${esc(benef)}</span></p>` : ''}
      <div class="qr" id="qr" role="img" aria-label="${esc(t('Código QR para que el negocio valide tu canje'))}"></div>
      <p><button type="button" class="codigo copiar" id="copiar" aria-label="${esc(t('Copiar el código'))}">${esc(codigoLegible(g.code))} ${ic('content_copy')}</button></p>
      <p class="muted">${esc(t('Vale hasta el'))} ${esc(fecha(g.expires_at, undefined, g.tz || undefined))}</p>
      <p class="muted">${esc(t('Enséñalo en el sitio. Si no pueden escanearlo, que escriban el código de debajo.'))}</p>
    </div>`);
  $('#copiar')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(g.code); toast(t('Código copiado')); } catch { toast(t('No se ha podido copiar'), true); }
  });
  const qr = window.qrcode(0, 'M');
  qr.addData(`https://klendar.app/r/${g.code}`);
  qr.make();
  $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

RUTAS.codigos = async () => {
  if (!exigeSesion('codigos')) return;
  // Los regalos de cumpleaños van aparte y arriba; si fallan, los códigos
  // salen igual.
  const [lista, regalos, premios] = await Promise.all([
    llamar('my_redemptions', {}),
    llamar('my_birthday_gifts', {}).catch(() => []),
    // Los premios de las tarjetas de sellos, también aparte.
    llamar('my_stamp_rewards', {}).catch(() => []),
  ]);
  const zona = await zonasDe(lista);
  // Los vivos, guardados para enseñarlos sin cobertura (y fuera los demás).
  recuerdaCodigos((lista || []).filter((r) => r.status === 'pending')
    .map((r) => ({ ...r, tz: zona(r) })), true);
  const conRegalos = Array.isArray(regalos) && regalos.length > 0;
  const conPremios = Array.isArray(premios) && premios.length > 0;
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Tus códigos'))}</h1>
    ${conRegalos ? `<h2 class="seccion-t">${esc(t('Regalos de cumpleaños'))}</h2>
      <div class="olist">${regalos.map(filaRegalo).join('')}</div>` : ''}
    ${conPremios ? `<h2 class="seccion-t">${esc(t('Premios de tarjetas de sellos'))}</h2>
      <div class="olist">${premios.map(filaPremio).join('')}</div>` : ''}
    ${conRegalos || conPremios ? `<h2 class="seccion-t">${esc(t('Tus códigos'))}</h2>` : ''}
    ${(lista || []).length ? `<div class="olist">${lista.map((r) => filaCanje(r, zona(r))).join('')}</div>`
    : conRegalos || conPremios
      ? `<p class="empty">${esc(t('Todavía no tienes códigos. Cuando consigas el código de una oferta o reserves plaza en un evento, lo tendrás aquí.'))}</p>`
      : pantallaVacia({
        icono: 'qr_code_2',
        titulo: t('Todavía no tienes códigos'),
        texto: t('Cuando consigas el código de una oferta o reserves plaza en un evento, lo tendrás aquí.'),
        botones: `<a class="pill accent" href="${EN ? '/en/explore/' : '/explorar/'}">${esc(t('Buscar planes'))}</a>`,
      })}`);
};

/** Un premio de tarjeta de sellos en «Tus códigos»: pendiente lleva a
 * «Tarjetas de sellos», donde está su código; si no, solo se ve. */
function filaPremio(p) {
  const vivo = p.status === 'pending' && !!p.code;
  const estado = p.status === 'validated'
    ? (p.source === 'manual' ? t('Entregado en el local') : t('Canjeado'))
    : vivo ? t('Código activo') : t('Caducado');
  const cuando = fecha(p.validated_at || p.created_at, undefined, p.time_zone || undefined);
  const dentro = `
      ${p.business_logo ? `<img src="${esc(p.business_logo)}" alt="" loading="lazy">` : `<span class="ph">${ic('local_activity')}</span>`}
      <span class="ocard-body"><b>${esc(p.reward)}</b>
        <span class="muted">${esc(`${p.card_name} · ${p.business_name} · ${cuando}`)}</span>
        <span class="ocard-meta"><span class="tag${vivo ? '' : ' off'}">${esc(estado)}</span></span>
      </span>`;
  return vivo ? `<a class="ocard" href="#/sellos">${dentro}</a>` : `<div class="ocard">${dentro}</div>`;
}

// ── Regalos de cumpleaños ─────────────────────────────────────────────────
/** El último día que vale un regalo: `expires_at` es el final de ese día
 * (medianoche del siguiente), así que se escribe un segundo antes. En la
 * zona del negocio: «5 de octubre». */
const ultimoDiaRegalo = (g) => (g?.expires_at
  ? fecha(new Date(new Date(g.expires_at).getTime() - 1000).toISOString(), { day: 'numeric', month: 'long' }, g.time_zone || undefined)
  : '');
/** Un regalo en «Tus códigos»: vivo abre su QR; usado o caducado, solo se ve. */
function filaRegalo(g) {
  const vivo = g.status === 'pending' && !!g.code;
  const estado = g.status === 'validated' ? t('Canjeado') : vivo ? t('Código activo') : t('Caducado');
  const dentro = `
      ${g.business_logo ? `<img src="${esc(g.business_logo)}" alt="" loading="lazy">` : `<span class="ph">${ic('cake')}</span>`}
      <span class="ocard-body"><b>${esc(g.gift)}</b>
        <span class="muted">${esc(EN ? `From ${g.business_name} · valid until ${ultimoDiaRegalo(g)}` : `De ${g.business_name} · vale hasta el ${ultimoDiaRegalo(g)}`)}</span>
        <span class="ocard-meta"><span class="tag${vivo ? '' : ' off'}">${esc(estado)}</span></span>
      </span>`;
  return vivo ? `<a class="ocard" href="#/regalo/${esc(g.id)}">${dentro}</a>` : `<div class="ocard">${dentro}</div>`;
}

/** El regalo, para enseñarlo en el sitio: como el premio de la tarjeta de
 * sellos. La tabla de regalos no se puede leer desde aquí (ni Realtime), así
 * que para enterarse de que lo han validado se vuelve a preguntar a
 * `my_birthday_gifts` cada pocos segundos. */
RUTAS.regalo = async ([id]) => {
  if (!exigeSesion(`regalo/${id}`)) return;
  const lista = await llamar('my_birthday_gifts', {});
  const g = (lista || []).find((x) => x.id === id);
  if (!g) { pinta(pantallaVacia({ icono: 'cake', titulo: t('Ese regalo no está.'), h: 'h1', botones: `<a class="pill accent" href="#/codigos">${esc(t('Tus códigos'))}</a>` })); return; }
  const tz = g.time_zone || undefined;
  if (g.status === 'validated') {
    pintaCanjeado({ titulo: g.gift, negocio: g.business_name, at: g.validated_at, tz });
    return;
  }
  if (!g.code) {
    pinta(`
      <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
      <div class="ticket">
        <p class="muted">${esc(EN ? `A gift from ${g.business_name}` : `Un regalo de ${g.business_name}`)}</p>
        <h1>${esc(g.gift)}</h1>
        <p><span class="tag off">${esc(t('Caducado'))}</span></p>
      </div>`);
    return;
  }
  const qr = window.qrcode(0, 'M');
  qr.addData(`https://klendar.app/r/${g.code}`);
  qr.make();
  pinta(`
    <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
    <div class="ticket">
      <p class="hecho-ic" aria-hidden="true">${ic('cake')}</p>
      <h1>${esc(t('¡Feliz cumpleaños!'))}</h1>
      <p class="muted">${esc(EN ? `A gift from ${g.business_name}` : `Un regalo de ${g.business_name}`)}</p>
      <p><span class="tag grande">${esc(g.gift)}</span></p>
      <div class="qr" role="img" aria-label="${esc(t('Código QR para que el negocio valide tu canje'))}">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div>
      <p><button type="button" class="codigo copiar" id="copiar" aria-label="${esc(t('Copiar el código'))}">${esc(codigoLegible(g.code))} ${ic('content_copy')}</button></p>
      <p class="muted">${esc(EN ? `Show it at the place until ${ultimoDiaRegalo(g)}. It works once.` : `Enséñalo en el sitio hasta el ${ultimoDiaRegalo(g)}. Vale una vez.`)}</p>
    </div>`);
  $('#copiar')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(g.code); toast(t('Código copiado')); } catch { toast(t('No se ha podido copiar'), true); }
  });
  const sondeo = setInterval(async () => {
    try {
      const ahora = ((await llamar('my_birthday_gifts', {})) || []).find((x) => x.id === id);
      if (ahora?.status !== 'validated') return;
      clearInterval(sondeo);
      pintaCanjeado({ titulo: g.gift, negocio: g.business_name, at: ahora.validated_at, tz });
    } catch { /* sin red: se vuelve a mirar */ }
  }, 6000);
  alSalir(() => clearInterval(sondeo));
};

// ── El código, para enseñar en la barra ───────────────────────────────────
/** Avisa en cuanto el negocio valida `code`: Supabase Realtime (la fila es
 * tuya, así que la política deja verla) y, por si el canal no llega, un
 * vistazo cada 5 s. Lo mismo que hace la app (watchValidation). Devuelve la
 * función que lo apaga. */
function vigilaCanje(code, alValidar, tabla = 'redemptions') {
  let hecho = false;
  let sondeo = null;
  let canal = null;
  const apaga = () => {
    clearInterval(sondeo);
    if (canal) sb.removeChannel(canal).catch(() => {});
  };
  const avisa = (fila) => {
    if (hecho || fila?.status !== 'validated') return;
    hecho = true;
    apaga();
    alValidar(fila.validated_at || new Date().toISOString());
  };
  canal = sb.channel(`redemption:${code}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: tabla, filter: `code=eq.${code}` },
      (payload) => avisa(payload.new))
    .subscribe();
  const mira = async () => {
    try {
      const { data } = await sb.from(tabla).select('status, validated_at').eq('code', code).maybeSingle();
      avisa(data);
    } catch { /* sin red: se vuelve a mirar en 5 s */ }
  };
  sondeo = setInterval(mira, 5000);
  mira();
  return apaga;
}

/** El negocio ya lo ha validado: la confirmación grande, como en la app. */
function pintaCanjeado({ titulo, negocio, benef, at, volver = '#/codigos', tz }) {
  const hora = fecha(at, { hour: '2-digit', minute: '2-digit' }, tz);
  pinta(`
    <div class="ticket canjeado" role="status">
      <p class="hecho-ic" aria-hidden="true">✓</p>
      <h1>${esc(t('¡Canjeado!'))}</h1>
      <p><b>${esc(titulo || '')}</b></p>
      ${negocio ? `<p class="muted">${esc(negocio)}</p>` : ''}
      ${benef ? `<p><span class="tag grande">${esc(benef)}</span></p>` : ''}
      <p class="muted">${esc(EN ? `Validated at ${hora}` : `Validado a las ${hora}`)}</p>
      <p class="muted">${esc(t('El negocio ya lo ha registrado. Disfrútalo y, si quieres, deja una reseña luego.'))}</p>
      <p><a class="pill accent" href="${esc(volver)}">${esc(t('Listo'))}</a></p>
    </div>`);
  I18N.translate(view);
  if (navigator.vibrate) navigator.vibrate(120);
}

RUTAS.codigo = async ([id], params, crudo) => {
  // `?rp=` se queda en la ruta si antes hay que entrar o crear la cuenta.
  if (!exigeSesion(`codigo/${id}${params.toString() ? `?${params}` : ''}`)) return;
  const plazas = Math.max(1, Math.min(10, parseInt(params.get('plazas') || '1', 10) || 1));
  // Llegada desde el enlace de un RRPP (app/rrpp.js): cuenta para su lista.
  const rp = rrppDeParams(params);
  const conRp = rp ? `?rp=${rp}` : '';
  // Sin red y con el código guardado: se enseña ya (no se pide nada a la base,
  // así que no hace falta confirmar nada).
  const guardado = codigoGuardado(id);
  if (navigator.onLine === false && guardado) { pintaCodigoGuardado(guardado); return; }
  // Abierto desde fuera, no se saca el código (ni se reservan plazas) sin
  // pulsar: si ya lo tienes, el botón te lo enseña igual.
  if (!(await confirmaEnlace(crudo, {
    titulo: t(plazas > 1 ? '¿Reservar plazas?' : '¿Sacar tu código?'), que: await queOferta(id, rp),
    texto: plazas > 1 ? (EN ? `For ${plazas} people. The code is valid for all the places.` : `Para ${plazas} personas. El código vale por todas las plazas.`) : '',
    boton: t(plazas > 1 ? 'Reservar' : 'Sacar el código'), volver: `${pre}/o/${encodeURIComponent(id)}${conRp}`,
  }))) return;
  // La zona del negocio, para «vale hasta el…» y la hora del canje.
  let tk;
  let tz;
  try {
    [tk, tz] = await Promise.all([
      llamar('start_redemption', { p_offer_id: id, p_seats: plazas, p_rp: rp || null }),
      llamar('offer_tz', { p_offer: id }).catch(() => null),
    ]);
  } catch (e) {
    // Exclusiva para favoritos o clientes y no es tu caso: se dice de quién
    // es y cómo conseguirla, no un error suelto.
    if (e.clave === 'audience_only') {
      pintaExclusiva(e.datos?.audience, e.datos?.business_id, e.datos?.business_name);
      return;
    }
    // De RRPP (solo con su enlace, sin plazas en su lista, ya es tarde, es
    // tu propio enlace o eres del equipo): se cuenta en su pantalla.
    if (await rrppErrorCodigo(e, id, rp)) return;
    // Sin red: el guardado, si lo hay y no ha caducado; si no, el error.
    const g = sinRedCuenta(e) ? codigoGuardado(id) : null;
    if (g) { pintaCodigoGuardado(g); return; }
    throw e;
  }
  recuerdaCodigos([{ ...tk, offer_id: id, tz }]);
  const url = `https://klendar.app/r/${tk.code}`;
  const caduca = new Date(tk.expires_at);
  const largo = caduca.getTime() - Date.now() > 3600 * 1000;
  const benef = beneficio(tk.discount, tk.price_cents, tk.currency);
  pinta(`
    <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
    <div class="ticket">
      <p class="muted">${esc(tk.business_name || '')}</p>
      <h1>${esc(tk.offer_title || '')}</h1>
      ${tk.promoter_name ? `<p class="muted">${esc(EN ? `${tk.promoter_name}'s list` : `Lista de ${tk.promoter_name}`)}</p>` : ''}
      ${(tk.seats || 1) > 1 ? `<p class="muted"><b>${tk.seats} ${esc(t('plazas'))}</b></p>` : ''}
      ${benef ? `<p><span class="tag grande">${esc(benef)}</span></p>` : ''}
      ${tk.price_kept ? `<p class="muted">${esc(t('Mantienes el precio de cuando lo conseguiste.'))}</p>` : ''}
      ${(tk.seats || 1) > 1 && !tk.discount && tk.price_cents != null
        ? `<p class="muted">${esc(EN
          ? `${money(tk.price_cents, tk.currency)} each · ${money(tk.price_cents * tk.seats, tk.currency)} in total`
          : `${money(tk.price_cents, tk.currency)} por persona · ${money(tk.price_cents * tk.seats, tk.currency)} en total`)}</p>` : ''}
      <div class="qr" id="qr" role="img" aria-label="${esc(t('Código QR para que el negocio valide tu canje'))}"></div>
      <p><button type="button" class="codigo copiar" id="copiar" aria-label="${esc(t('Copiar el código'))}">${esc(codigoLegible(tk.code))} ${ic('content_copy')}</button></p>
      <p class="muted" id="cuenta" aria-live="polite"></p>
      <div id="caducado" hidden>
        <p><b>${esc(t('El código ha caducado'))}</b></p>
        <p><button class="pill accent" id="otro-codigo" type="button">${ic('refresh')} ${esc(t('Generar otro código'))}</button></p>
      </div>
      <p class="muted" id="instrucciones">${esc(t('Enséñalo en el sitio. Si no pueden escanearlo, que escriban el código de debajo.'))}</p>
      ${largo ? `<p><button class="pill" id="anular" type="button">${esc(t('Ya no voy: anular la reserva'))}</button></p>` : ''}
    </div>`);
  // El código de debajo del QR se copia de un toque (como en la app).
  $('#copiar')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(tk.code); toast(t('Código copiado')); } catch { toast(t('No se ha podido copiar'), true); }
  });
  // «Ya no voy»: las plazas quedan libres y la lista de espera se entera.
  $('#anular')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    if (boton.disabled) return;
    if (!(await confirma({
      titulo: t('¿Anular la reserva?'),
      texto: t('Tus plazas quedan libres para otra persona y este código deja de valer. Si cambias de idea, puedes volver a reservar mientras quede sitio.'),
      aceptar: t('Anular'),
      cancelar: t('Mantenerla'),
      peligro: true,
    }))) return;
    boton.disabled = true;
    try {
      await llamar('cancel_redemption', { p_code: tk.code });
      olvidaCodigo(id);
      toast(t('Reserva anulada. Gracias por dejar el sitio libre.'));
      vuelve('codigos');
    } catch (e) {
      // `llamar` ya trae el texto traducido; «not_pending» tiene el suyo.
      toast(e.clave === 'not_pending' ? t('Esta reserva ya no se podía anular (se usó o ha caducado).') : e.message, true);
      if (boton.isConnected) boton.disabled = false;
    }
  });
  // Caducado: se pide otro a la base (start_redemption da uno nuevo) sin
  // salir de aquí, como el botón de la app.
  $('#otro-codigo').addEventListener('click', () => navegar());
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });

  // En cuanto el negocio lo valida, esta pantalla se entera sola.
  alSalir(vigilaCanje(tk.code, (at) => {
    olvidaCodigo(id); // ya está usado: no se enseña sin red
    pintaCanjeado({ titulo: tk.offer_title, negocio: tk.business_name, benef, at, tz });
  }));

  // La cuenta atrás, o hasta cuándo vale si queda más de una hora. Un código
  // largo (una entrada para el sábado) se mira cada 30 s, como en la app.
  let reloj = null;
  const pintaCuenta = () => {
    const el = $('#cuenta');
    if (!el) { clearInterval(reloj); return; }
    const falta = caduca.getTime() - Date.now();
    if (falta <= 0) {
      el.textContent = '';
      $('#qr')?.classList.add('caducado');
      $('#caducado').hidden = false;
      $('#instrucciones').hidden = true;
      $('#anular')?.remove();
      clearInterval(reloj);
      return;
    }
    if (falta >= 3600 * 1000) { el.textContent = `${t('Vale hasta el')} ${fecha(tk.expires_at, undefined, tz)}`; return; }
    const m = Math.floor(falta / 60000);
    const s = Math.floor((falta % 60000) / 1000);
    el.textContent = `${t('Válido durante')} ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  reloj = setInterval(pintaCuenta, largo ? 30000 : 1000);
  alSalir(() => clearInterval(reloj));
  pintaCuenta();
};

// ── Reservar plaza: primero «¿para cuántos?» si el evento deja varias ─────
RUTAS.reservar = async ([id], params) => {
  const rp = rrppDeParams(params);
  const conRp = rp ? `?rp=${rp}` : '';
  if (!exigeSesion(`reservar/${id}${conRp}`)) return;
  const fila = await llamar('offer_detail', { p_id: id, p_rp: rp || null });
  const o = Array.isArray(fila) ? fila[0] : fila;
  if (!o) { pinta(pantallaVacia({ icono: 'explore', titulo: t('Esa publicación ya no existe.'), h: 'h1', botones: `<a class="pill accent" href="${EN ? '/en/explore/' : '/explorar/'}">${esc(t('Buscar planes'))}</a>` })); return; }
  if (o.locked) { pintaExclusiva(o.audience, o.business_id, o.business_name); return; }
  const tope = Math.max(1, Math.min(o.max_seats || 1, o.seats_left == null ? 10 : o.seats_left));
  if (tope <= 1) {
    // Venía del botón «Reservar» de la ficha: el código no vuelve a preguntar.
    if (hayIntencion(`reservar/${id}${conRp}`)) marcaIntencion(`codigo/${encodeURIComponent(id)}${conRp}`);
    location.replace(`#/codigo/${encodeURIComponent(id)}${conRp}`);
    return;
  }
  pinta(`
    <p class="crumbs"><a href="${pre}/o/${esc(id)}${conRp}">${esc(o.title)}</a></p>
    <h1>${esc(t('¿Para cuántos?'))}</h1>
    <p class="muted">${esc(t('El código vale por todas las plazas: lo enseñas una vez en la puerta.'))}</p>
    <div class="hub">${Array.from({ length: tope }, (_, i) => i + 1).map((n) => `
      <a class="hub-i" href="#/codigo/${esc(id)}?plazas=${n}${rp ? `&rp=${rp}` : ''}"><b>${n === 1 ? esc(t('Solo yo')) : `${n} ${esc(t('personas'))}`}</b></a>`).join('')}
    </div>`);
};

// ── Lista de espera de algo agotado ───────────────────────────────────────
RUTAS.espera = async ([id], params, crudo) => {
  if (!exigeSesion(`espera/${id}`)) return;
  const quitar = params?.get('quitar') === '1';
  if (!(await confirmaEnlace(crudo, {
    titulo: t(quitar ? '¿Salir de la lista de espera?' : '¿Apuntarte a la lista de espera?'), que: await queOferta(id),
    boton: t(quitar ? 'Salir' : 'Apuntarme'), volver: `${pre}/o/${encodeURIComponent(id)}`,
  }))) return;
  // La ficha pública va en caché y no sabe quién mira: a quien ya tiene
  // plaza (su código vivo) le ofrece la lista de espera de algo agotado. No
  // hace cola: va a su entrada, como «Mi entrada» en la app.
  if (!quitar) {
    const mios = await llamar('my_redemptions', {}).catch(() => []);
    if ((mios || []).some((r) => r.offer_id === id && r.status === 'pending'
        && new Date(r.expires_at).getTime() > Date.now())) {
      marcaIntencion(`codigo/${encodeURIComponent(id)}`);
      location.replace(`#/codigo/${encodeURIComponent(id)}`);
      return;
    }
  }
  // Dónde estás de verdad: con dos avisos gastados ya no se vuelve a entrar;
  // si ya te avisamos, hasta cuándo tienes.
  const antes = await llamar('my_waitlist_status', { p_offer: id }).catch(() => null);
  if (!quitar && antes?.state === 'exhausted') {
    hecho({
      titulo: t('Ya no estás en la lista de espera'),
      texto: t('Te avisamos dos veces y no llegaste a coger plaza, así que ya no estás en la lista de espera.'),
      volver: `${pre}/o/${encodeURIComponent(id)}`, volverTxt: t('Volver a la publicación'),
      lista: '#/', listaTxt: t('Tu cuenta'),
    });
    return;
  }
  const { puesto: dentro } = await ponOQuita('offer_waitlist', 'offer_id', id, quitar,
    () => llamar('toggle_waitlist', { p_offer: id }));
  const hora = antes?.notified_until
    ? new Date(antes.notified_until).toLocaleTimeString(EN ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
  const estado = !dentro ? ''
    : antes?.state === 'notified' && hora
      ? (antes.notices >= 2
        ? (EN ? `Last notice: a place is free and you have until ${hora} to take it.` : `Último aviso: hay una plaza libre y tienes hasta las ${hora} para cogerla.`)
        : (EN ? `We’ve told you a place is free: you have until ${hora} to take it. If it’s gone, you go back on the list.`
          : `Te hemos avisado de una plaza libre: tienes hasta las ${hora} para cogerla. Si ya no queda, vuelves a la lista.`))
      : antes?.state === 'waiting' && antes.notices > 0
        ? t('Sigues en la lista de espera. Ya te avisamos una vez; te queda un aviso más.')
        : t('Te avisamos si se libera una plaza');
  hecho({
    titulo: dentro ? t('Estás en la lista de espera') : t('Ya no estás en la lista de espera'),
    texto: estado,
    volver: `${pre}/o/${encodeURIComponent(id)}`, volverTxt: t('Volver a la publicación'),
    lista: '#/', listaTxt: t('Tu cuenta'),
    deshacer: `espera/${id}${dentro ? '?quitar=1' : ''}`,
  });
};

// ── El recibo de un canje ─────────────────────────────────────────────────
RUTAS.recibo = async ([id]) => {
  if (!exigeSesion(`recibo/${id}`)) return;
  const lista = await llamar('my_redemptions', {});
  const r = (lista || []).find((x) => x.id === id);
  if (!r) { pinta(pantallaVacia({ icono: 'description', titulo: t('Ese recibo no está.'), h: 'h1', botones: `<a class="pill accent" href="#/codigos">${esc(t('Tus códigos'))}</a>` })); return; }
  const tz = (await zonasDe([r]))(r);
  const lugar = [r.business_address, r.business_city].filter(Boolean).join(' · ');
  const benef = beneficio(r.discount, r.price_cents, r.currency);
  pinta(`
    <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
    <h1>${esc(t('Recibo'))}</h1>
    <div class="recibo">
      <h2>${esc(r.business_name)}</h2>
      ${lugar ? `<p class="muted">${esc(lugar)}</p>` : ''}
      <dl>
        <dt>${esc(t('Qué'))}</dt><dd>${esc(r.offer_title)}</dd>
        ${benef ? `<dt>${esc(t('Beneficio'))}</dt><dd>${esc(benef)}</dd>` : ''}
        ${(r.seats || 1) > 1 ? `<dt>${esc(t('Plazas'))}</dt><dd>${r.seats}</dd>` : ''}
        <dt>${esc(t('Cuándo'))}</dt><dd>${esc(fecha(r.validated_at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }, tz))}</dd>
        <dt>${esc(t('Código'))}</dt><dd><code>${esc(codigoLegible(r.code))}</code></dd>
      </dl>
      <p class="muted">${esc(t('Esto no es una factura: el cobro lo hace el negocio. Es el resguardo de que usaste este código.'))}</p>
    </div>
    <p><button class="pill" id="imprimir">${esc(t('Imprimir o guardar en PDF'))}</button></p>`);
  $('#imprimir').onclick = () => window.print();
};

// ── Tarjetas de sellos ────────────────────────────────────────────────────
/** Qué da sello en una tarjeta, con las mismas palabras que la app; y, si
 * también sella por visita con el QR del local, dicho. */
function queSella(c) {
  const base = queSellaBase(c);
  return c.by_visit ? `${base} · ${t('También por visita con el QR del local')}` : base;
}
function queSellaBase(c) {
  if (c.applies_to === 'flash_offer') return t('Solo cuentan las ofertas flash');
  if (c.applies_to === 'future_event') return t('Solo cuentan los eventos');
  if (c.applies_to === 'categories' || c.applies_to === 'offers') {
    const nombres = c.applies_to === 'categories'
      ? (c.category_names || []).map((n) => (EN ? n.en : n.es) || n.es || '').filter(Boolean)
      : (c.offer_titles || []);
    if (!nombres.length) return t(c.applies_to === 'categories' ? 'Solo cuentan algunas categorías' : 'Solo cuentan algunas publicaciones');
    const resto = nombres.length - 3;
    const lista = nombres.slice(0, 3).join(', ') + (resto > 0 ? (EN ? ` and ${resto} more` : ` y ${resto} más`) : '');
    return EN ? `Only these count: ${lista}` : `Solo cuentan: ${lista}`;
  }
  return t('Cuentan todas las publicaciones');
}

RUTAS.sellos = async () => {
  if (!exigeSesion('sellos')) return;
  const lista = await llamar('my_stamp_cards', {});
  await zonasDe(lista); // la hora del canje, en la del negocio
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Tarjetas de sellos'))}</h1>
    ${(lista || []).length ? lista.map((c) => `
      <div class="sello">
        <p class="sello-negocio"><a href="${pre}/b/${esc(c.business_id)}">${esc(c.business_name)}</a></p>
        <h2>${esc(c.name || t('Tarjeta de sellos'))}</h2>
        <p class="muted sello-filtro">${esc(queSella(c))}</p>
        <div class="huecos" aria-label="${esc(`${c.stamps} / ${c.goal}`)}">${Array.from({ length: c.goal }, (_, i) => `<span class="${i < c.stamps ? 'lleno' : ''}"></span>`).join('')}</div>
        <p>${esc(t('Premio'))}: <b>${esc(c.reward)}</b></p>
        <p class="muted">${c.pending_code || c.stamps >= c.goal ? esc(t('¡Te toca premio!')) : esc(c.goal - c.stamps === 1 ? t('Te falta 1 sello') : (EN ? `${c.goal - c.stamps} stamps to go` : `Te faltan ${c.goal - c.stamps} sellos`))}</p>
        ${c.card_goal != null && c.card_goal !== c.goal ? `<p class="muted">${esc(EN
          ? `Your goal is ${c.goal}; for your next cards it's ${c.card_goal}.`
          : `Tu meta es ${c.goal}; para las próximas tarjetas, ${c.card_goal}.`)}</p>` : ''}
        ${!c.is_active ? `<p class="muted">${esc(t('En pausa: ahora mismo no se dan sellos nuevos. Los tuyos siguen aquí.'))}</p>` : ''}
        ${c.pending_code || c.stamps >= c.goal ? `<button class="pill accent" data-premio="${esc(c.id)}" data-reward="${esc(c.reward)}" data-negocio="${esc(c.business_name)}" data-biz="${esc(c.business_id)}">${esc(c.pending_code ? t('Ver el código') : t('Pedir el premio'))}</button>` : ''}
      </div>`).join('')
    : pantallaVacia({
      icono: 'local_activity',
      titulo: t('Todavía no tienes ninguna'),
      texto: t('Se abren solas con tu primer sello: canjea algo en un sitio que tenga tarjeta o escanea el QR del local.'),
    })}`);

  $$('[data-premio]').forEach((b) => { b.onclick = () => ocupado(b, async () => {
    const r = await llamar('claim_stamp_reward', { p_card: b.dataset.premio });
    const qr = window.qrcode(0, 'M');
    qr.addData(`https://klendar.app/r/${r.code}`);
    qr.make();
    pinta(`
      <p class="crumbs"><a href="#/sellos">${esc(t('Tarjetas de sellos'))}</a></p>
      <div class="ticket">
        <p class="muted">${esc(t('Tu premio'))}</p>
        <h1>${esc(r.reward || b.dataset.reward)}</h1>
        <div class="qr">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div>
        <p class="codigo">${esc(codigoLegible(r.code))}</p>
        <p class="muted">${esc(t('Enséñalo en el sitio. Vale una vez.'))}</p>
      </div>`);
    I18N.translate(view);
    // Igual que un código de oferta: al validarlo en el local, se ve aquí.
    alSalir(vigilaCanje(r.code, (at) => pintaCanjeado({
      titulo: r.reward || b.dataset.reward, negocio: b.dataset.negocio, at, volver: '#/sellos', tz: ZONAS.get(b.dataset.biz),
    }), 'stamp_rewards'));
  }); });
};

// ── El QR del local ───────────────────────────────────────────────────────
/** Vuelta de «Entra para llevarte el sello de hoy» (la ficha abierta desde
 * el QR del local): ya con sesión, otra vez a la ficha, que da el sello
 * (ver /assets/visita.js). */
RUTAS.visita = async ([token]) => {
  if (!/^[A-Za-z0-9_-]{16}$/.test(token || '')) { vuelve(''); return; }
  if (!exigeSesion(`visita/${token}`)) return;
  location.replace(`/v/${encodeURIComponent(token)}`);
};

// ── Series («Micro abierto de los jueves») ────────────────────────────────
// Lo mismo que la app (migración 20261107100000_series): desde la ficha
// (`/o/<id>` → `#/serie/<id>`) se sigue la serie; quien la sigue recibe un
// aviso con cada fecha nueva y, si quiere, cada fecha va a sus planes.
// «Series que sigues» (`#/series`) con dejar de seguir.

/** «los jueves», «lunes, miércoles»…: los días de una regla (0 = domingo),
 * lunes primero, como la app. */
function diasSerie(dias) {
  const s = new Set(dias || []);
  if (s.size === 7) return EN ? 'every day' : 'todos los días';
  if (s.size === 5 && [1, 2, 3, 4, 5].every((d) => s.has(d))) return EN ? 'Monday to Friday' : 'de lunes a viernes';
  if (s.size === 2 && s.has(0) && s.has(6)) return EN ? 'weekends' : 'los fines de semana';
  // 7 de enero de 2024 fue domingo: sumando días salen todos en orden.
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.has(d))
    .map((d) => new Date(2024, 0, 7 + d).toLocaleDateString(LOC, { weekday: 'long' })).join(', ');
}
/** «Se repite: jueves a las 21:00» (si sale de una regla). */
const repiteSerie = (x) => (x?.weekdays?.length && x.start_time
  ? (EN ? `Repeats: ${diasSerie(x.weekdays)} at ${x.start_time}` : `Se repite: ${diasSerie(x.weekdays)} a las ${x.start_time}`) : '');
const masFechas = (n) => (EN
  ? (n === 0 ? 'No more dates posted yet' : n === 1 ? '1 more date posted' : `${n} more dates posted`)
  : (n === 0 ? 'Por ahora no hay más fechas publicadas' : n === 1 ? '1 fecha más publicada' : `${n} fechas más publicadas`));
const textoGuardadas = (n) => (EN
  ? (n === 0 ? 'Each new date will go to your plans.' : n === 1 ? "We've saved 1 date to your plans; new ones will go there too." : `We've saved ${n} dates to your plans; new ones will go there too.`)
  : (n === 0 ? 'Cada fecha nueva irá a tus planes.' : n === 1 ? 'Hemos guardado 1 fecha en tus planes; las nuevas también irán.' : `Hemos guardado ${n} fechas en tus planes; las nuevas también irán.`));
const errorSerie = (e) => (e?.clave === 'too_many'
  ? (EN ? "You're following too many series. Unfollow one to follow this one." : 'Sigues demasiadas series. Deja alguna para seguir esta.')
  : e?.message || amable(''));

/** «Seguir la serie» desde la ficha de una de sus fechas. No hace nada solo:
 * enseña la serie y el botón (con la casilla «Añadir cada fecha a mis
 * planes»), así que no hace falta la marca de los enlaces. */
RUTAS.serie = async ([id]) => {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) { vuelve(''); return; }
  if (!exigeSesion(`serie/${id}`)) return;
  const s = await llamar('offer_series_info', { p_offer: id });
  const ficha = `${pre}/o/${encodeURIComponent(id)}`;
  if (!s) {
    pinta(pantallaVacia({
      icono: 'refresh',
      titulo: EN ? 'This series is no longer available' : 'Esta serie ya no está disponible',
      texto: EN ? 'It may have ended, or this publication is no longer visible.' : 'Puede que haya terminado o que esta publicación ya no se vea.',
      h: 'h1',
      botones: `<a class="pill accent" href="#/series">${esc(EN ? 'Series you follow' : 'Series que sigues')}</a>
        <a class="pill" href="${esc(ficha)}">${esc(EN ? 'Back to the publication' : 'Volver a la publicación')}</a>`,
    }));
    return;
  }
  const datos = [s.business_name, repiteSerie(s), masFechas(s.upcoming || 0)].filter(Boolean).join(' · ');
  const cabeza = `
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a> · <a href="#/series">${esc(EN ? 'Series you follow' : 'Series que sigues')}</a></p>
    <div class="ticket">
      <p class="muted">${esc(EN ? 'Part of a series' : 'Forma parte de una serie')}</p>
      <h1>${esc(s.name)}</h1>
      <p class="muted">${esc(datos)}</p>`;
  const auto = (marcado) => `<form class="formu" id="f-serie" novalidate>
      <label class="check"><input type="checkbox" name="auto"${marcado ? ' checked' : ''}>
        <span><b>${esc(EN ? 'Add each date to my plans' : 'Añadir cada fecha a mis planes')}</b><br><small>${esc(EN ? "They're saved to Plans automatically, including the ones already posted." : 'Se guardan solas en Planes, también las que ya están publicadas.')}</small></span></label>
    </form>`;
  if (s.is_member) {
    pinta(`${cabeza}
      <p>${esc(EN ? "You're on this business's team: series notifications don't go to the team." : 'Eres del equipo de este negocio: los avisos de la serie no van al equipo.')}</p>
      <p class="acciones"><a class="pill accent" href="${esc(ficha)}">${esc(EN ? 'Back to the publication' : 'Volver a la publicación')}</a></p></div>`);
    return;
  }
  if (!s.following) {
    pinta(`${cabeza}
      <p>${esc(EN ? "We'll let you know when the next date is posted." : 'Te avisamos cuando se publique la siguiente fecha.')}</p>
      ${auto(false)}
      <p class="acciones">
        <button type="button" class="pill accent" id="seguir-serie">${ic('notifications')} ${esc(EN ? 'Follow the series' : 'Seguir la serie')}</button>
        <a class="pill" href="${esc(ficha)}">${esc(t('Cancelar'))}</a>
      </p></div>`);
    $('#seguir-serie').addEventListener('click', (ev) => ocupado(ev.currentTarget, async () => {
      const conPlanes = $('#f-serie').elements.auto.checked;
      try {
        const r = await llamar('follow_series', { p_offer: id, p_auto_plan: conPlanes });
        hecho({
          titulo: EN ? "You're following the series" : 'Sigues la serie',
          texto: conPlanes ? textoGuardadas(r?.saved || 0)
            : (EN ? "We'll let you know about each new date." : 'Te avisaremos de cada fecha nueva.'),
          volver: ficha, volverTxt: EN ? 'Back to the publication' : 'Volver a la publicación',
          lista: '#/series', listaTxt: EN ? 'Series you follow' : 'Series que sigues',
        });
      } catch (e) { toast(errorSerie(e), true); }
    }));
    return;
  }
  // Ya la sigue: el interruptor y «Dejar de seguir».
  pinta(`${cabeza}
    <p><b>${ic('notifications')} ${esc(EN ? "You're following the series" : 'Sigues la serie')}</b></p>
    ${auto(s.auto_plan)}
    <p class="acciones">
      <a class="pill accent" href="${esc(ficha)}">${esc(EN ? 'Back to the publication' : 'Volver a la publicación')}</a>
      <button type="button" class="pill" id="dejar-serie">${esc(EN ? 'Unfollow' : 'Dejar de seguir')}</button>
    </p></div>`);
  enganchaSerie(s.series_id, s.name, $('#f-serie').elements.auto, $('#dejar-serie'), () => vuelve(`serie/${id}`));
};

/** El interruptor «Añadir cada fecha a mis planes» y «Dejar de seguir» de
 * una serie (en su página y en la lista). */
function enganchaSerie(serie, nombre, caja, boton, trasDejar) {
  caja.addEventListener('change', async () => {
    caja.disabled = true;
    try {
      const r = await llamar('set_series_auto_plan', { p_series: serie, p_on: caja.checked });
      toast(caja.checked ? textoGuardadas(r?.saved || 0)
        : (EN ? "New dates won't go to your plans automatically any more." : 'Las fechas nuevas ya no irán solas a tus planes.'));
    } catch (e) { caja.checked = !caja.checked; toast(errorSerie(e), true); }
    caja.disabled = false;
  });
  boton.addEventListener('click', async () => {
    const ok = await confirma({
      titulo: EN ? `Unfollow “${nombre}”?` : `¿Dejar de seguir «${nombre}»?`,
      texto: EN ? "We won't tell you about new dates. Anything already in your plans stays there."
        : 'No te avisaremos de las fechas nuevas. Lo que ya está en tus planes se queda.',
      aceptar: EN ? 'Unfollow' : 'Dejar de seguir', peligro: true,
    });
    if (!ok) return;
    try {
      await llamar('unfollow_series', { p_series: serie });
      toast(EN ? "You're no longer following the series." : 'Ya no sigues la serie.');
      trasDejar();
    } catch (e) { toast(errorSerie(e), true); }
  });
}

/** «Series que sigues». */
RUTAS.series = async () => {
  if (!exigeSesion('series')) return;
  const lista = (await llamar('my_followed_series', {})) || [];
  const titulo = EN ? 'Series you follow' : 'Series que sigues';
  if (!lista.length) {
    pinta(`
      <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
      <h1>${esc(titulo)}</h1>
      ${pantallaVacia({
        icono: 'notifications',
        titulo: EN ? "You're not following any series yet" : 'Aún no sigues ninguna serie',
        texto: EN ? "On the page of something that repeats (“Thursday open mic”), tap “Follow the series” and we'll let you know about each new date."
          : 'En la ficha de algo que se repite («Micro abierto de los jueves»), toca «Seguir la serie» y te avisamos de cada fecha nueva.',
        botones: `<a class="pill accent" href="${EN ? '/en/explore/' : '/explorar/'}">${esc(t('Buscar planes'))}</a>`,
      })}`);
    return;
  }
  const zona = await zonasDe(lista.map((x) => ({ business_id: x.business_id })));
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(titulo)}</h1>
    <div class="lista series-lista">${lista.map((x, i) => {
      const n = x.next;
      const cuando = n?.starts_at ? fecha(n.starts_at, undefined, zona({ business_id: x.business_id })) : '';
      const proxima = n
        ? `<div class="lista">${fila({ href: `${pre}/o/${n.offer_id}`, icono: 'explore', titulo: EN ? `Next: ${cuando || n.title}` : `Próxima: ${cuando || n.title}`, detalle: cuando ? n.title : '' })}</div>`
        : `<p class="muted">${esc(EN ? 'No dates posted yet' : 'Por ahora no hay fechas publicadas')}</p>`;
      return `<section class="bloque serie" data-i="${i}">
        <h2>${esc(x.name)}</h2>
        <p class="muted">${esc([x.business_name, repiteSerie(x)].filter(Boolean).join(' · '))}</p>
        ${proxima}
        <form class="formu" novalidate><label class="check"><input type="checkbox" name="auto"${x.auto_plan ? ' checked' : ''}>
          <span><b>${esc(EN ? 'Add each date to my plans' : 'Añadir cada fecha a mis planes')}</b></span></label></form>
        <p><button type="button" class="pill" data-dejar>${esc(EN ? 'Unfollow' : 'Dejar de seguir')}</button></p>
      </section>`;
    }).join('')}</div>`);
  $$('.serie').forEach((sec) => {
    const x = lista[Number(sec.dataset.i)];
    enganchaSerie(x.series_id, x.name, $('input[name=auto]', sec), $('[data-dejar]', sec), () => RUTAS.series());
  });
};

// ── Arranque ──────────────────────────────────────────────────────────────
// Espera a que carguen también las rutas de cuenta.js.
addEventListener('DOMContentLoaded', navegar);
// Se ha entrado o confirmado la cuenta con el enlace del correo.
ENLACE.then((r) => {
  if (r.tipo === 'signup') toast(t('Cuenta confirmada'));
  else if (r.tipo === 'magiclink' || r.tipo === 'email') toast(t('Dentro'));
  // Cambio de correo: el primer enlace confirma uno de los dos correos; el
  // segundo lo termina (y abre la sesión con el correo nuevo).
  else if (r.tipo === 'email_change') {
    toast(r.sesion ? t('Listo: tu correo ya está cambiado') : t('Confirmado desde este correo. Falta confirmarlo también desde el otro.'));
  }
});
