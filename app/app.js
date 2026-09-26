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
const LOC = EN ? 'en-GB' : 'es-ES';
const sb = supabase.createClient(window.KLENDAR_ENV.url, window.KLENDAR_ENV.key);

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

// ── Formatos ──────────────────────────────────────────────────────────────
// El código para leerlo o dictarlo, de cuatro en cuatro («0882 7EC7 …»),
// igual que en la app. Al validarlo se aceptan con o sin espacios.
const codigoLegible = (c) => String(c || '').toUpperCase().replace(/(.{4})(?=.)/g, '$1 ');
const money = (c, cur = 'EUR') => (c == null ? '' : (c / 100).toLocaleString(LOC, { style: 'currency', currency: cur || 'EUR' }));
const fecha = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) => {
  if (!iso) return '';
  try { return new Intl.DateTimeFormat(LOC, { timeZone: 'Europe/Madrid', ...opts }).format(new Date(iso)); } catch { return ''; }
};
function beneficio(d, precio, moneda) {
  if (d?.type === 'percent') return `−${d.value} %`;
  if (d?.type === 'fixed') return money(Math.round(Number(d.value) * 100), moneda);
  if (d?.type === '2x1') return '2x1';
  if (d?.type === 'free') return t('Gratis');
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
  const falla = (clave) => Object.assign(new Error(amable(clave)), { clave: String(clave || '') });
  if (res.error) throw falla(res.error.message);
  const d = res.data;
  if (d && typeof d === 'object' && !Array.isArray(d) && d.ok === false) throw falla(d.error);
  return d;
}

/** El mismo patrón de correo que la app (AuthForm.email). */
const CORREO_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// ── Sesión ────────────────────────────────────────────────────────────────
let YO = null;
async function sesion() {
  const { data } = await sb.auth.getSession();
  YO = data.session?.user || null;
  return YO;
}
sb.auth.onAuthStateChange((_ev, s) => { YO = s?.user || null; });

function exigeSesion(ruta) {
  if (YO) return true;
  location.hash = `#/entrar?siguiente=${encodeURIComponent(ruta)}`;
  return false;
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
      if (error) toast(amable(error.message), true);
    };
  });
}

// ── Un último paso: términos y edad ───────────────────────────────────────
// Quien entra con Google no pasa por el alta: sin esto no constaba que
// aceptase los términos ni sabíamos si tiene 14 años. Se pregunta una vez.
let CONSENTIMIENTO = { id: null, ok: true, fecha: true };
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
      CONSENTIMIENTO = { id: YO.id, ok: Boolean(c.terms_accepted_at), fecha: c.has_birth_date !== false };
    } catch { CONSENTIMIENTO = { id: YO.id, ok: true, fecha: true }; } // sin red: no se bloquea
  }
  return !CONSENTIMIENTO.ok;
}

// ── Rutas ─────────────────────────────────────────────────────────────────
const RUTAS = {};
function rutaActual() {
  const h = location.hash.replace(/^#\/?/, '');
  const [camino, qs] = h.split('?');
  const partes = camino.split('/').filter(Boolean);
  return { partes, params: new URLSearchParams(qs || ''), crudo: h };
}

async function navegar() {
  await sesion();
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
    view.innerHTML = `<h1>${esc(t(yaEsTuyo ? 'Ya lo tienes' : 'Algo ha fallado'))}</h1>
      <p class="muted">${esc(e.message || amable(''))}</p>
      <p>${yaEsTuyo ? `<a class="pill accent" href="#/codigos">${esc(t('Tus códigos'))}</a> ` : ''}
        <a class="pill${yaEsTuyo ? '' : ' accent'}" href="#/">${esc(t('Volver'))}</a></p>`;
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

// ── Inicio ────────────────────────────────────────────────────────────────
/** Un icono de Material Symbols: los mismos que la app. */
const ic = (nombre) => `<span class="ms" aria-hidden="true">${nombre}</span>`;

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
  const nombre = YO.user_metadata?.display_name || (YO.email || '').split('@')[0];
  const foto = YO.user_metadata?.avatar_url;
  const negocios = await llamar('my_businesses', {}).catch(() => []);
  const tieneNegocio = Array.isArray(negocios) && negocios.length > 0;
  pinta(`
    <h1 class="titulo-pagina">${esc(t('Tu cuenta'))}</h1>
    <a class="perfil" href="#/ajustes">
      <span class="avatar">${foto ? `<img src="${esc(foto)}" alt="">` : esc((nombre || '?').charAt(0).toUpperCase())}</span>
      <span class="perfil-t"><b>${esc(nombre)}</b><small>${esc(YO.email || '')}</small><em>${esc(t('Editar perfil'))}</em></span>
      ${ic('chevron_right')}
    </a>

    <div class="rapidos">
      <a class="rapido" href="#/planes">${ic('bookmark')}<b>${esc(t('Tus planes'))}</b></a>
      <a class="rapido" href="#/codigos">${ic('qr_code_2')}<b>${esc(t('Tus códigos'))}</b></a>
      <a class="rapido" href="#/favoritos">${ic('favorite')}<b>${esc(t('Favoritos'))}</b></a>
      <a class="rapido" href="#/sellos">${ic('local_activity')}<b>${esc(t('Tarjetas de sellos'))}</b></a>
      <a class="rapido" href="#/notificaciones">${ic('notifications')}<b>${esc(t('Notificaciones'))}</b><span class="badge-n" id="sin-leer" hidden></span></a>
      <a class="rapido" href="${pre}/explorar/">${ic('explore')}<b>${esc(t('Explorar'))}</b></a>
    </div>

    ${tieneNegocio ? `
      <h2 class="seccion-t">${esc(t('Negocio'))}</h2>
      <div class="lista">
        ${fila({ href: '/panel/', icono: 'storefront', titulo: t('Mi negocio'), detalle: t('Publicaciones, estadísticas, equipo') })}
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
  $('#salir').onclick = async () => {
    await sb.auth.signOut();
    toast(t('Has cerrado sesión'));
    vuelve('');
  };
};

// ── Entrar ────────────────────────────────────────────────────────────────
RUTAS.entrar = async (_p, params) => {
  const siguiente = params.get('siguiente') || '';
  if (YO) return vuelve(siguiente);
  pinta(`
    <h1>${esc(t('Entra en Klendar'))}</h1>
    <p class="muted">${esc(t('Con la misma cuenta que en la app. Para mirar no hace falta: solo para guardar planes, tener favoritos y conseguir códigos.'))}</p>
    <form id="f" class="formu" novalidate>
      <label>${esc(t('Correo'))}<input name="email" type="email" autocomplete="username" required></label>
      <label>${esc(t('Contraseña'))}<input name="password" type="password" autocomplete="current-password" required></label>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Entrar'))}</button>
    </form>
    <p><button class="linkbtn" id="otp">${esc(t('Entrar con un código por correo'))}</button></p>
    <p><a href="#/recuperar">${esc(t('He olvidado la contraseña'))}</a></p>
    <p class="muted">${esc(t('¿No tienes cuenta?'))} <a href="#/registro${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}">${esc(t('Regístrate'))}</a></p>
    <div id="google" class="google-hueco"></div>`);
  botonGoogle(siguiente);

  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = String(f.get('email') || '').trim();
    const password = String(f.get('password') || '');
    if (!email || !password) { $('#err').textContent = t('Escribe tu correo y tu contraseña.'); return; }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { $('#err').textContent = amable(error.message); return; }
    toast(t('Dentro'));
    vuelve(siguiente);
  };

  $('#otp').onclick = () => { location.hash = `#/codigo-correo${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}`; };
};

// ── Entrar con un código por correo ───────────────────────────────────────
RUTAS['codigo-correo'] = async (_p, params) => {
  const siguiente = params.get('siguiente') || '';
  pinta(`
    <h1>${esc(t('Entra con un código'))}</h1>
    <p class="muted">${esc(t('Te mandamos un código de seis cifras a tu correo. Sin contraseñas.'))}</p>
    <form id="f1" class="formu">
      <label>${esc(t('Correo'))}<input name="email" type="email" autocomplete="username" required></label>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Mandarme el código'))}</button>
    </form>
    <form id="f2" class="formu" hidden>
      <label>${esc(t('Código'))}<input name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
      <p id="err2" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Entrar'))}</button>
    </form>`);
  let correo = '';
  $('#f1').onsubmit = async (e) => {
    e.preventDefault();
    correo = String(new FormData(e.target).get('email') || '').trim();
    if (!correo) return;
    const { error } = await sb.auth.signInWithOtp({ email: correo, options: { shouldCreateUser: true } });
    if (error) { $('#err').textContent = amable(error.message); return; }
    $('#f1').hidden = true;
    $('#f2').hidden = false;
    toast(t('Te hemos mandado el código'));
  };
  $('#f2').onsubmit = async (e) => {
    e.preventDefault();
    const token = String(new FormData(e.target).get('token') || '').trim();
    const { error } = await sb.auth.verifyOtp({ email: correo, token, type: 'email' });
    if (error) { $('#err2').textContent = t('Ese código no vale o ha caducado.'); return; }
    toast(t('Dentro'));
    vuelve(siguiente);
  };
};

// ── Registrarse ───────────────────────────────────────────────────────────
// Lo mismo que pide la app: nombre, fecha de nacimiento (14 años o más),
// aceptar los términos y, aparte y sin marcar, las comunicaciones.
// ── Entrar con el teléfono (SMS) ──────────────────────────────────────────
// Lo mismo que la app: prefijo, número, código de seis cifras. Si es la
// primera vez, se crea la cuenta y luego se piden edad y términos.
RUTAS.movil = async (_p, params) => {
  const siguiente = params.get('siguiente') || '';
  const destino = params.get('destino') || '';
  const PREFIJOS = ['+34', '+351', '+33', '+44', '+39', '+49'];
  pinta(`
    <h1>${esc(t('Entrar con el teléfono'))}</h1>
    <p class="muted">${esc(t('Te mandamos un código por SMS. Sin contraseñas.'))}</p>
    <form id="f1" class="formu" novalidate>
      <div class="fila-tel">
        <label>${esc(t('País'))}<select name="prefijo">${PREFIJOS.map((x) => `<option>${x}</option>`).join('')}</select></label>
        <label>${esc(t('Número de teléfono'))}<input name="numero" type="tel" inputmode="tel" autocomplete="tel-national" required></label>
      </div>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Enviarme el código'))}</button>
      <p class="muted" style="font-size:13px">${esc(t('Si es tu primera vez, se creará tu cuenta al entrar. Al continuar aceptas los términos y la política de privacidad.'))}</p>
    </form>
    <form id="f2" class="formu" hidden>
      <p class="muted" id="enviado"></p>
      <label>${esc(t('Código'))}<input name="token" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
      <p id="err2" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Entrar'))}</button>
      <p><button type="button" class="linkbtn" id="otro">${esc(t('Cambiar de número'))}</button></p>
    </form>`);
  let telefono = '';
  $('#f1').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const numero = String(f.get('numero') || '').replace(/[\s.-]/g, '');
    if (!/^\d{6,12}$/.test(numero)) { $('#err').textContent = t('Escribe un número válido'); return; }
    telefono = `${f.get('prefijo')}${numero}`;
    const { error } = await sb.auth.signInWithOtp({ phone: telefono });
    if (error) { $('#err').textContent = amable(error.message); return; }
    $('#f1').hidden = true; $('#f2').hidden = false;
    $('#enviado').textContent = t('Te hemos enviado un SMS a') + ' ' + telefono;
  };
  $('#otro').onclick = () => { $('#f2').hidden = true; $('#f1').hidden = false; };
  $('#f2').onsubmit = async (e) => {
    e.preventDefault();
    const token = String(new FormData(e.target).get('token') || '').trim();
    const { error } = await sb.auth.verifyOtp({ phone: telefono, token, type: 'sms' });
    if (error) { $('#err2').textContent = t('Ese código no vale o ha caducado.'); return; }
    toast(t('Dentro'));
    if (destino && destino.startsWith('/')) { location.href = destino; return; }
    vuelve(siguiente);
  };
};

RUTAS.registro = async (_p, params) => {
  const siguiente = params.get('siguiente') || '';
  // Desde «Acceso para negocios»: al terminar, al alta del negocio.
  const negocio = params.get('para') === 'negocio';
  const destino = negocio ? `${location.origin}/panel/?alta=1` : `${location.origin}/app/`;
  pinta(`
    <h1>${esc(t(negocio ? 'Crea tu cuenta de negocio' : 'Crea tu cuenta'))}</h1>
    <p class="muted">${esc(t(negocio
      ? 'Primero tu cuenta personal (la misma para la web y la app). Justo después das de alta tu negocio.'
      : 'Es la misma cuenta para la web y para la app.'))}</p>
    <form id="f" class="formu" novalidate>
      <label>${esc(t('Nombre'))}<input name="name" autocomplete="name" maxlength="40" required></label>
      <label>${esc(t('Correo'))}<input name="email" type="email" autocomplete="email" required></label>
      <label>${esc(t('Contraseña'))} <small>${esc(t('(8 caracteres o más)'))}</small><input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>${esc(t('Repite la contraseña'))}<input name="password2" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>${esc(t('Fecha de nacimiento'))}<input name="birth" type="date" required></label>
      <label class="check"><input type="checkbox" name="terms" required>
        <span>${t('He leído y acepto los <a href="/terminos/" target="_blank">términos</a> y la <a href="/privacidad/" target="_blank">privacidad</a>.')}</span></label>
      <label class="check"><input type="checkbox" name="marketing">
        <span>${esc(t('Quiero recibir novedades de Klendar (opcional).'))}</span></label>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Crear la cuenta'))}</button>
    </form>
    <p class="muted">${esc(t('¿Ya tienes cuenta?'))} <a href="#/entrar${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}">${esc(t('Entra'))}</a></p>
    <div id="google" class="google-hueco"></div>`);
  botonGoogle(negocio ? '' : siguiente, negocio ? '/panel/?alta=1' : '/app/');

  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const nombre = String(f.get('name') || '').trim();
    const email = String(f.get('email') || '').trim();
    const password = String(f.get('password') || '');
    const nac = String(f.get('birth') || '');
    const err = $('#err');
    if (!nombre || !email) { err.textContent = t('Faltan tu nombre o tu correo.'); return; }
    // Las mismas comprobaciones que la app (AuthForm).
    if (!CORREO_OK.test(email)) { err.textContent = t('Ese correo no parece válido.'); return; }
    if (password.length < 8) { err.textContent = t('La contraseña tiene que tener al menos 8 caracteres.'); return; }
    if (password !== String(f.get('password2') || '')) { err.textContent = t('Las contraseñas no coinciden.'); return; }
    if (!nac) { err.textContent = t('Pon tu fecha de nacimiento.'); return; }
    const d = new Date(`${nac}T12:00:00`);
    const hoy = new Date();
    let edad = hoy.getFullYear() - d.getFullYear();
    if (hoy.getMonth() < d.getMonth() || (hoy.getMonth() === d.getMonth() && hoy.getDate() < d.getDate())) edad -= 1;
    if (edad < 14) { err.textContent = t('Para usar Klendar hay que tener 14 años o más.'); return; }
    if (!f.get('terms')) { err.textContent = t('Tienes que aceptar los términos y la privacidad.'); return; }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: destino,
        data: {
          display_name: nombre,
          birth_date: nac,
          terms_accepted: true,
          terms_version: '2026-09',
          marketing_consent: Boolean(f.get('marketing')),
          user_type: 'user',
          locale: EN ? 'en' : 'es',
        },
      },
    });
    if (error) { err.textContent = amable(error.message); return; }
    if (!data.session) {
      // El correo lleva enlace y código: el código sirve si lo abres en otro
      // dispositivo (el ordenador aquí, el correo en el móvil).
      pinta(`<h1>${esc(t('Mira tu correo'))}</h1>
        <p class="muted">${esc(t('Te hemos mandado un enlace para confirmar la cuenta. Ábrelo y ya puedes entrar.'))}</p>
        <form id="fc" class="formu" novalidate>
          <label>${esc(t('O escribe aquí el código de 6 cifras del correo'))}
            <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"></label>
          <p id="errc" class="err" role="alert"></p>
          <button class="pill accent" type="submit">${esc(t('Confirmar'))}</button>
        </form>
        <p class="muted">${esc(t('¿No te llega? Mira en spam o en «Promociones».'))} <a href="#/entrar">${esc(t('Ir a entrar'))}</a></p>`);
      I18N.translate(view);
      $('#fc').onsubmit = async (ev) => {
        ev.preventDefault();
        const code = String(new FormData(ev.target).get('code') || '').replace(/\D/g, '');
        if (code.length !== 6) { $('#errc').textContent = t('Son 6 cifras.'); return; }
        const r = await sb.auth.verifyOtp({ email, token: code, type: 'signup' });
        if (r.error) { $('#errc').textContent = t('Ese código no vale o ha caducado.'); return; }
        toast(t('Cuenta confirmada'));
        if (negocio) location.href = '/panel/?alta=1'; else vuelve(siguiente);
      };
      return;
    }
    toast(t('Cuenta creada'));
    if (negocio) { location.href = '/panel/?alta=1'; return; }
    vuelve(siguiente);
  };
};

// ── Recuperar la contraseña ───────────────────────────────────────────────
RUTAS.recuperar = async () => {
  pinta(`
    <h1>${esc(t('Recupera tu contraseña'))}</h1>
    <p class="muted">${esc(t('Te mandamos un enlace para poner una nueva.'))}</p>
    <form id="f" class="formu">
      <label>${esc(t('Correo'))}<input name="email" type="email" autocomplete="username" required></label>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Mandarme el enlace'))}</button>
    </form>`);
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const email = String(new FormData(e.target).get('email') || '').trim();
    if (!email) return;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/app/#/nueva-clave` });
    // Se dice lo mismo exista o no la cuenta: no damos pistas de quién está.
    if (error && !/rate/i.test(error.message)) console.warn(error.message);
    pinta(`<h1>${esc(t('Mira tu correo'))}</h1>
      <p class="muted">${esc(t('Si hay una cuenta con ese correo, te llegará un enlace en un momento.'))}</p>`);
    I18N.translate(view);
  };
};

RUTAS['nueva-clave'] = async () => {
  if (!YO) return RUTAS.recuperar();
  pinta(`
    <h1>${esc(t('Pon una contraseña nueva'))}</h1>
    <form id="f" class="formu">
      <label>${esc(t('Contraseña nueva'))}<input name="p1" type="password" autocomplete="new-password" minlength="8" required></label>
      <label>${esc(t('Repítela'))}<input name="p2" type="password" autocomplete="new-password" minlength="8" required></label>
      <p id="err" class="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t('Guardar'))}</button>
    </form>`);
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const p1 = String(f.get('p1') || '');
    if (p1.length < 8) { $('#err').textContent = t('La contraseña tiene que tener al menos 8 caracteres.'); return; }
    if (p1 !== String(f.get('p2') || '')) { $('#err').textContent = t('Las contraseñas no coinciden.'); return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) { $('#err').textContent = amable(error.message); return; }
    toast(t('Contraseña guardada'));
    vuelve('');
  };
};

// ── Tarjeta de publicación, como en la agenda ─────────────────────────────
function tarjeta(o) {
  const img = (o.images || []).find((u) => !/\.(mp4|mov|webm)(\?|$)/i.test(u));
  // Si acaba otro día, el final lleva también el día (como en la app).
  const mismoDia = fecha(o.redeem_start_at, { day: 'numeric', month: 'numeric' }) === fecha(o.redeem_end_at, { day: 'numeric', month: 'numeric' });
  const cuando = o.kind === 'future_event' ? fecha(o.event_at)
    : `${fecha(o.redeem_start_at)} – ${mismoDia ? fecha(o.redeem_end_at, { hour: '2-digit', minute: '2-digit' }) : fecha(o.redeem_end_at)}`;
  const tag = beneficio(o.discount, o.price_cents, o.currency);
  return `<a class="ocard" href="${pre}/o/${esc(o.id)}">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
    <span class="ocard-body"><b>${esc(o.title)}</b>
      <span class="muted">${esc(o.business_name || '')}</span>
      <span class="ocard-meta">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="muted">${esc(cuando)}</span></span>
    </span></a>`;
}

// ── Tus planes ────────────────────────────────────────────────────────────
RUTAS.planes = async () => {
  if (!exigeSesion('planes')) return;
  const lista = await llamar('my_saved_offers', {});
  const ahora = Date.now();
  const fin = (o) => new Date(o.event_at || o.redeem_end_at || o.redeem_start_at || 0).getTime();
  const proximos = (lista || []).filter((o) => fin(o) >= ahora);
  const pasados = (lista || []).filter((o) => fin(o) < ahora);
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Tus planes'))}</h1>
    ${proximos.length
    ? `<div class="olist">${proximos.map(tarjeta).join('')}</div>`
    : `<p class="empty">${esc(pasados.length
      ? t('No tienes nada próximo guardado.')
      : t('Todavía no has guardado nada. Cuando algo te guste, dale a «Guardar» y lo tendrás aquí.'))}</p>`}
    ${pasados.length ? `<h2>${esc(t('Ya pasaron'))}</h2><div class="olist pasado">${pasados.map(tarjeta).join('')}</div>` : ''}
    <p><a class="pill" href="${pre}/explorar/">${esc(t('Buscar planes'))}</a></p>`);
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
    history.replaceState(null, '', `#/${deshacer}`);
    navegar();
  });
}

RUTAS.guardar = async ([id]) => {
  if (!exigeSesion(`guardar/${id}`)) return;
  const guardado = await llamar('toggle_saved_offer', { p_offer: id });
  hecho({
    titulo: guardado ? t('Guardado en tus planes') : t('Quitado de tus planes'),
    texto: guardado ? t('Te avisamos si baja de precio y, si es un evento, antes de que empiece.') : '',
    volver: `${pre}/o/${encodeURIComponent(id)}`, volverTxt: t('Volver a la publicación'),
    lista: '#/planes', listaTxt: t('Ver tus planes'),
    deshacer: `guardar/${id}`,
  });
};

// ── Tus sitios (favoritos) ────────────────────────────────────────────────
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
            ${b.active_flash ? `<span class="tag">${esc(t('ofertas ahora'))}: ${b.active_flash}</span>` : ''}
            ${b.upcoming_events ? `<span class="muted">${esc(t('eventos'))}: ${b.upcoming_events}</span>` : ''}
          </span></span></a>`).join('')}</div>`
    : `<p class="empty">${esc(t('Todavía no tienes favoritos. En la ficha de un negocio, dale a «Añadir a favoritos» y te avisaremos cuando publique.'))}</p>`}`);
};

RUTAS.seguir = async ([id]) => {
  if (!exigeSesion(`seguir/${id}`)) return;
  const sigue = await llamar('toggle_favorite', { p_business_id: id });
  hecho({
    titulo: sigue ? t('Añadido a favoritos') : t('Quitado de favoritos'),
    texto: sigue ? t('Te avisamos cuando publique algo nuevo.') : '',
    volver: `${pre}/b/${encodeURIComponent(id)}`, volverTxt: t('Volver al sitio'),
    lista: '#/favoritos', listaTxt: t('Ver tus favoritos'),
    deshacer: `seguir/${id}`,
  });
};

// ── Tus códigos ───────────────────────────────────────────────────────────
RUTAS.codigos = async () => {
  if (!exigeSesion('codigos')) return;
  const lista = await llamar('my_redemptions', {});
  const vivo = (r) => r.status === 'pending' && new Date(r.expires_at).getTime() > Date.now();
  const estado = (r) => (r.status === 'validated' ? t('Canjeado')
    : vivo(r) ? t('Listo para usar') : r.status === 'cancelled' ? t('Anulado') : t('Caducado'));
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Tus códigos'))}</h1>
    ${(lista || []).length ? `<div class="olist">${lista.map((r) => `
      <a class="ocard" href="${vivo(r) ? `#/codigo/${esc(r.offer_id)}` : r.status === 'validated' ? `#/recibo/${esc(r.id)}` : `${pre}/o/${esc(r.offer_id)}`}">
        ${r.business_logo ? `<img src="${esc(r.business_logo)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
        <span class="ocard-body"><b>${esc(r.offer_title)}</b>
          <span class="muted">${esc(r.business_name)} · ${esc(fecha(r.validated_at || (r.status === 'pending' && r.event_at) || r.created_at))}</span>
          <span class="ocard-meta"><span class="tag${vivo(r) ? '' : ' off'}">${esc(estado(r))}</span>
            ${r.status === 'validated' ? `<span class="muted">${esc(t('Ver recibo'))} →</span>` : ''}</span>
        </span></a>`).join('')}</div>`
    : `<p class="empty">${esc(t('Todavía no tienes códigos. Cuando consigas el código de una oferta o reserves plaza en un evento, lo tendrás aquí.'))}</p>`}`);
};

// ── El código, para enseñar en la barra ───────────────────────────────────
RUTAS.codigo = async ([id], params) => {
  if (!exigeSesion(`codigo/${id}${params.toString() ? `?${params}` : ''}`)) return;
  const plazas = Math.max(1, Math.min(10, parseInt(params.get('plazas') || '1', 10) || 1));
  const tk = await llamar('start_redemption', { p_offer_id: id, p_seats: plazas });
  const url = `https://klendar.app/r/${tk.code}`;
  const caduca = new Date(tk.expires_at);
  const largo = caduca.getTime() - Date.now() > 3600 * 1000;
  pinta(`
    <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
    <div class="ticket">
      <p class="muted">${esc(tk.business_name || '')}</p>
      <h1>${esc(tk.offer_title || '')}</h1>
      ${(tk.seats || 1) > 1 ? `<p class="muted"><b>${tk.seats} ${esc(t('plazas'))}</b></p>` : ''}
      ${beneficio(tk.discount, tk.price_cents, tk.currency) ? `<p><span class="tag grande">${esc(beneficio(tk.discount, tk.price_cents, tk.currency))}</span></p>` : ''}
      ${(tk.seats || 1) > 1 && !tk.discount && tk.price_cents != null
        ? `<p class="muted">${esc(EN
          ? `${money(tk.price_cents, tk.currency)} each · ${money(tk.price_cents * tk.seats, tk.currency)} in total`
          : `${money(tk.price_cents, tk.currency)} por persona · ${money(tk.price_cents * tk.seats, tk.currency)} en total`)}</p>` : ''}
      <div class="qr" id="qr" role="img" aria-label="${esc(t('Código QR para que el negocio valide tu canje'))}"></div>
      <p class="codigo">${esc(codigoLegible(tk.code))}</p>
      <p class="muted" id="cuenta"></p>
      <p class="muted">${esc(t('Enséñalo en el sitio. Si no pueden escanearlo, que escriban el código de debajo.'))}</p>
      ${largo ? `<p><button class="pill" id="anular" type="button">${esc(t('Ya no voy: anular la reserva'))}</button></p>` : ''}
    </div>`);
  // «Ya no voy»: las plazas quedan libres y la lista de espera se entera.
  $('#anular')?.addEventListener('click', async () => {
    if (!confirm(t('Tus plazas quedan libres para otra persona y este código deja de valer. ¿Anular la reserva?'))) return;
    try {
      const r = await llamar('cancel_redemption', { p_code: tk.code });
      toast(r?.ok ? t('Reserva anulada. Gracias por dejar el sitio libre.') : t('Esta reserva ya no se podía anular (se usó o ha caducado).'), !r?.ok);
      if (r?.ok) vuelve('codigos');
    } catch (e) { toast(amable(e.message), true); }
  });
  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });

  // La cuenta atrás, o hasta cuándo vale si queda más de una hora.
  const pintaCuenta = () => {
    const el = $('#cuenta');
    if (!el) { clearInterval(pintaCuenta.i); return; }
    const falta = caduca.getTime() - Date.now();
    if (falta <= 0) { el.textContent = t('Ha caducado. Vuelve a la publicación y pide otro.'); clearInterval(pintaCuenta.i); return; }
    if (largo) { el.textContent = `${t('Vale hasta el')} ${fecha(tk.expires_at)}`; return; }
    const m = Math.floor(falta / 60000);
    const s = Math.floor((falta % 60000) / 1000);
    el.textContent = `${t('Caduca en')} ${m}:${String(s).padStart(2, '0')}`;
  };
  pintaCuenta();
  pintaCuenta.i = setInterval(pintaCuenta, 1000);
};

// ── Reservar plaza: primero «¿para cuántos?» si el evento deja varias ─────
RUTAS.reservar = async ([id]) => {
  if (!exigeSesion(`reservar/${id}`)) return;
  const fila = await llamar('offer_detail', { p_id: id });
  const o = Array.isArray(fila) ? fila[0] : fila;
  if (!o) { pinta(`<p class="empty">${esc(t('Esa publicación ya no existe.'))}</p>`); return; }
  const tope = Math.max(1, Math.min(o.max_seats || 1, o.seats_left == null ? 10 : o.seats_left));
  if (tope <= 1) { location.replace(`#/codigo/${encodeURIComponent(id)}`); return; }
  pinta(`
    <p class="crumbs"><a href="${pre}/o/${esc(id)}">${esc(o.title)}</a></p>
    <h1>${esc(t('¿Para cuántos?'))}</h1>
    <p class="muted">${esc(t('El código vale por todas las plazas: lo enseñas una vez en la puerta.'))}</p>
    <div class="hub">${Array.from({ length: tope }, (_, i) => i + 1).map((n) => `
      <a class="hub-i" href="#/codigo/${esc(id)}?plazas=${n}"><b>${n === 1 ? esc(t('Solo yo')) : `${n} ${esc(t('personas'))}`}</b></a>`).join('')}
    </div>`);
};

// ── Lista de espera de algo agotado ───────────────────────────────────────
RUTAS.espera = async ([id]) => {
  if (!exigeSesion(`espera/${id}`)) return;
  const dentro = await llamar('toggle_waitlist', { p_offer: id });
  hecho({
    titulo: dentro ? t('Estás en la lista de espera') : t('Ya no estás en la lista de espera'),
    texto: dentro ? t('Te avisamos si se libera una plaza') : '',
    volver: `${pre}/o/${encodeURIComponent(id)}`, volverTxt: t('Volver a la publicación'),
    lista: '#/', listaTxt: t('Tu cuenta'),
    deshacer: `espera/${id}`,
  });
};

// ── El recibo de un canje ─────────────────────────────────────────────────
RUTAS.recibo = async ([id]) => {
  if (!exigeSesion(`recibo/${id}`)) return;
  const lista = await llamar('my_redemptions', {});
  const r = (lista || []).find((x) => x.id === id);
  if (!r) { pinta(`<p class="empty">${esc(t('Ese recibo no está.'))}</p>`); return; }
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
        <dt>${esc(t('Cuándo'))}</dt><dd>${esc(fecha(r.validated_at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</dd>
        <dt>${esc(t('Código'))}</dt><dd><code>${esc(codigoLegible(r.code))}</code></dd>
      </dl>
      <p class="muted">${esc(t('Esto no es una factura: el cobro lo hace el negocio. Es el resguardo de que usaste este código.'))}</p>
    </div>
    <p><button class="pill" id="imprimir">${esc(t('Imprimir o guardar en PDF'))}</button></p>`);
  $('#imprimir').onclick = () => window.print();
};

// ── Tarjetas de sellos ────────────────────────────────────────────────────
RUTAS.sellos = async () => {
  if (!exigeSesion('sellos')) return;
  const lista = await llamar('my_stamp_cards', {});
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Tarjetas de sellos'))}</h1>
    ${(lista || []).length ? lista.map((c) => `
      <div class="sello">
        <h2><a href="${pre}/b/${esc(c.business_id)}">${esc(c.business_name)}</a></h2>
        <div class="huecos" aria-label="${esc(`${c.stamps} / ${c.goal}`)}">${Array.from({ length: c.goal }, (_, i) => `<span class="${i < c.stamps ? 'lleno' : ''}"></span>`).join('')}</div>
        <p>${esc(t('Premio'))}: <b>${esc(c.reward)}</b></p>
        <p class="muted">${c.pending_code || c.stamps >= c.goal ? esc(t('¡Te toca premio!')) : esc(c.goal - c.stamps === 1 ? t('Te falta 1 sello') : `${t('Te faltan')} ${c.goal - c.stamps} ${t('sellos')}`)}</p>
        ${!c.is_active ? `<p class="muted">${esc(t('En pausa: ahora mismo no se dan sellos nuevos. Los tuyos siguen aquí.'))}</p>` : ''}
        ${c.pending_code || c.stamps >= c.goal ? `<button class="pill accent" data-premio="${esc(c.id)}" data-reward="${esc(c.reward)}">${esc(c.pending_code ? t('Ver el código') : t('Pedir el premio'))}</button>` : ''}
      </div>`).join('')
    : `<p class="empty">${esc(t('Todavía no tienes ninguna. Se abren solas: canjea algo en un sitio que tenga tarjeta y ahí tendrás tu primer sello.'))}</p>`}`);

  $$('[data-premio]').forEach((b) => { b.onclick = async () => {
    try {
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
    } catch (e) { toast(e.message, true); }
  }; });
};

// ── Arranque ──────────────────────────────────────────────────────────────
// Espera a que carguen también las rutas de cuenta.js.
addEventListener('DOMContentLoaded', navegar);
