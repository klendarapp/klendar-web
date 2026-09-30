/* Panel de administración de Klendar.
   Todo pasa por RPC `admin_*` de Supabase, que comprueban is_admin() en la base
   de datos: las claves de aquí son públicas (anon/publishable). */
'use strict';

// El proyecto al que apuntamos viene de `config.js` (un solo sitio para
// cambiar dev por producción). Si faltara, no se inventa nada: se avisa.
const ENV = globalThis.KLENDAR_ENV || {};
const SUPABASE_URL = ENV.url;
const SUPABASE_KEY = ENV.key;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  document.body.innerHTML = I18N.lang === 'en'
    ? '<p style="padding:24px">The configuration is missing (<code>/config.js</code>). Tell support.</p>'
    : '<p style="padding:24px">Falta la configuración (<code>/config.js</code>). Avisa a soporte.</p>';
  throw new Error('sin configuración');
}
const APP_URL = 'https://klendar.app';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Utilidades ──────────────────────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Iconos de Material Symbols, los mismos que la app y el panel de negocios.
const ms = (name) => `<span class="ms" aria-hidden="true">${name}</span>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Enlaces que escribe un negocio (web, redes, fotos, enlace de la oferta):
// solo http(s). `esc` no para un `javascript:` en un href.
const urlSegura = (u) => (/^https?:\/\//i.test(String(u ?? '').trim()) ? String(u).trim() : '');
const enlaceExterno = (u, texto = u) => (urlSegura(u)
  ? `<a class="link" target="_blank" rel="noopener noreferrer" href="${esc(urlSegura(u))}">${esc(texto)}</a>`
  : esc(texto || '—'));
const LOC = () => (I18N.lang === 'en' ? 'en-GB' : 'es-ES');
// Las horas: las de Madrid, abra quien abra el panel (y con el ordenador en
// la hora que sea); las de un negocio o una publicación concretos, en la zona
// de ese negocio (Canarias va una por detrás; ver /assets/zona.js). `tz` es
// opcional en `fmtDate` y `fmtDay`.
const KZ = globalThis.KlendarZona;
const TZ = KZ.MADRID;
// Horas siempre con dos cifras («07:12»): `timeStyle: 'short'` en español da «7:12».
const fmtDate = (s, tz = TZ) => s ? new Date(s).toLocaleString(LOC(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: KZ.zona(tz) }) : '—';
const fmtDay = (s, tz = TZ) => s ? new Date(s).toLocaleDateString(LOC(), { dateStyle: 'medium', timeZone: KZ.zona(tz) }) : '—';
/** AAAA-MM-DD de hoy (o dentro de `dias`) en Madrid, para <input type="date">. */
const diaMadridISO = (dias = 0) => KZ.hoy(TZ, dias);
/** Un instante → «AAAA-MM-DDTHH:MM» del reloj de Madrid (datetime-local). */
const aInputMadrid = (d) => KZ.aInput(d, TZ);
/** Lo escrito en un datetime-local, leído como hora de Madrid → ISO. */
const deInputMadrid = (v) => KZ.deInput(v, TZ);
/** «Europe/Madrid» → cómo se lee en la ficha del admin. */
const zonaTxt = (tz) => `<code>${esc(tz)}</code>${tz === KZ.CANARIAS ? ` <span class="muted small">${esc(I18N.t('una hora menos que en la península'))}</span>` : ''}`;
// En el idioma del panel, como las fechas: «19,90 €» / «€19.90».
const fmtMoney = (c, cur = 'EUR') => (c == null ? '—' : (c / 100).toLocaleString(LOC(), { style: 'currency', currency: cur || 'EUR' }));
const fmtNum = (n) => (n ?? 0).toLocaleString(LOC());
const ago = (s) => {
  if (!s) return '—';
  const d = (Date.now() - new Date(s)) / 1000;
  const en = I18N.lang === 'en';
  if (d < 60) return en ? 'just now' : 'hace un momento';
  if (d < 3600) return en ? `${Math.floor(d / 60)} min ago` : `hace ${Math.floor(d / 60)} min`;
  if (d < 86400) return en ? `${Math.floor(d / 3600)} h ago` : `hace ${Math.floor(d / 3600)} h`;
  if (d < 86400 * 30) return en ? `${Math.floor(d / 86400)} d ago` : `hace ${Math.floor(d / 86400)} d`;
  return fmtDay(s);
};
const tag = (v, cls) => v ? `<span class="tag ${cls || 'st-' + esc(v)}">${esc(LABELS[v] || v)}</span>` : '';
// Una publicación rechazada en moderación está «retirada» (como en los filtros).
const modTag = (v) => (v === 'rejected' ? '<span class="tag st-rejected">retirada</span>' : tag(v));
const LABELS = {
  pending: 'pendiente', verified: 'verificado', rejected: 'rechazado', approved: 'aprobada', active: 'activa', expired: 'caducada',
  cancelled: 'cancelada', sold_out: 'agotada', draft: 'borrador', open: 'abierta', reviewing: 'en revisión', resolved: 'resuelta', dismissed: 'desestimada',
  trial: 'prueba', past_due: 'impagada', validated: 'validado', failed: 'fallido', sent: 'enviado', skipped: 'omitido',
  flash_offer: 'oferta flash', future_event: 'evento', user: 'usuario', business: 'negocio', offer: 'publicación', review: 'reseña', post: 'novedad',
  owner: 'propietario', manager: 'encargado', staff: 'empleado', free: 'Gratis', basic: 'Básico', pro: 'Pro',
  standard: 'Klendar', founder: 'Fundador', inactive: 'inactivo', banned: 'suspendido', other: 'otra cosa',
  new: 'sin leer', planned: 'la haremos', done: 'hecho', declined: 'descartada',
  suggestion: 'sugerencia', bug: 'fallo',
};
// Quién recibió una notificación enviada desde aquí, como en el formulario.
const AUDIENCIAS = { all: 'Todos los usuarios', users: 'Solo usuarios (no negocios)', business_owners: 'Propietarios y encargados de negocios', city: 'Negocios de una ciudad', ids: 'Equipo de un negocio' };
const KIND_ICON = { flash_offer: ms('bolt'), future_event: ms('event') };
const FLAGS = { alcohol: 'alcohol', tobacco: 'tabaco/vapeo', gambling: 'apuestas', offensive: 'lenguaje ofensivo' };
const flagTags = (o) => (o.moderation_flags || []).map((f) => `<span class="tag warn" title="Detectado automáticamente en el texto">${esc(FLAGS[f] || f)}</span>`).join(' ');
// Lenguaje ofensivo: qué ha encontrado (`text_offensive`) y en qué texto.
const CAT_OFENSIVA = { insult: 'insultos', profanity: 'palabras malsonantes', sexual: 'contenido sexual', hate: 'odio o discriminación', threat: 'amenazas' };
const TIPO_TEXTO = { post: 'Novedad', review: 'Reseña', reply: 'Respuesta a una reseña', business_name: 'Nombre del negocio', business_description: 'Descripción del negocio', menu: 'Carta', closure_reason: 'Motivo de días cerrados', birthday_gift: 'Regalo de cumpleaños', stamp_card_name: 'Nombre de una tarjeta de sellos', stamp_card_reward: 'Premio de una tarjeta de sellos' };
const ICONO_TEXTO = { post: 'article', review: 'chat_bubble', reply: 'reply', business_name: 'storefront', business_description: 'storefront', menu: 'restaurant_menu', closure_reason: 'event_busy', birthday_gift: 'cake', stamp_card_name: 'loyalty', stamp_card_reward: 'loyalty' };
// Qué se enseña al lado del texto para situarlo.
const CONTEXTO_TEXTO = { reply: 'Reseña', stamp_card_name: 'Tarjeta', stamp_card_reward: 'Tarjeta', closure_reason: 'Días' };
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const qs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// Cada pintada lleva su número (como `RUTA_N` en el panel). Una lectura que
// llega cuando ya se ha cambiado de pantalla no pinta nada: se corta con
// `Obsoleta` (sin mensaje, no se enseña). Lo que escribe sí termina siempre.
let RUTA_N = 0;
class Obsoleta extends Error {
  constructor() { super(''); this.obsoleta = true; }
}
const ESCRIBE = /^admin_(set|record|send|delete|upsert|resolve|review|add|remove|push_retry|save|collection_(add|remove|move)|run|update)/;
async function rpc(fn, args = {}) {
  const n = RUTA_N;
  const { data, error } = await sb.rpc(fn, args);
  if (n !== RUTA_N && !ESCRIBE.test(fn)) throw new Obsoleta();
  if (error) {
    const msg = error.message || '';
    // Suspendida y «no es administradora» llegan con el mismo código (42501):
    // se distinguen por el mensaje.
    if (msg.includes('account_suspended')) throw new Error(RPC_ERRORS.account_suspended);
    // La base pide el código (se ha vuelto obligatorio con el panel abierto):
    // se enseña la pantalla del código.
    if (msg.includes('mfa_required')) { setTimeout(boot, 0); throw new Error('Escribe el código de tu app de verificación para seguir.'); }
    if (msg.includes('not_admin')) throw new Error('Esta cuenta no es administradora.');
    // Eliminar una cuenta pide haber confirmado la contraseña hace poco.
    if (msg.includes('reauth_required')) throw new Error('Por seguridad, vuelve a confirmar que eres tú.');
    if (msg.includes('image_not_allowed')) throw new Error('Esa foto no se puede usar. Súbela desde Klendar.');
    if (/auth_required|JWT/.test(msg)) throw new Error(window.KL_AUTH_TEXT('sesion', I18N.lang));
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) throw new Error(window.KL_AUTH_TEXT('sinRed', I18N.lang));
    if (error.code === '42501') throw new Error('No tienes permiso para esto.');
    if (error.code === '23505') throw new Error('Ya existe uno con ese identificador.');
    if (RPC_ERRORS[msg]) throw new Error(RPC_ERRORS[msg]);
    // Un código sin traducir o un mensaje técnico de Postgres se apunta en la
    // consola y se dice en cristiano; un texto escrito para personas, tal cual.
    console.error(fn, error);
    if (/^[a-z0-9_]+$/.test(msg) || /violates|constraint|syntax|relation|column|function|permission denied|null value|invalid input|duplicate key/i.test(msg)) {
      throw new Error('No se ha podido completar. Prueba otra vez.');
    }
    throw new Error(msg || 'No se ha podido completar. Prueba otra vez.');
  }
  return data;
}
const RPC_ERRORS = {
  cannot_ban_admin: 'No se puede suspender a un administrador.', cannot_delete_self: 'No puedes eliminar tu propia cuenta desde aquí.',
  cannot_delete_admin: 'Quita primero los permisos de administrador.', reason_required: 'Hace falta indicar un motivo.',
  invalid_plan: 'Plan no válido.', invalid_status: 'Estado no válido.', no_subscription: 'El negocio no tiene suscripción vigente; asigna primero un plan.',
  user_not_found: 'No existe ningún usuario con ese email.', cannot_remove_self: 'No puedes quitarte a ti mismo.', last_admin: 'Tiene que quedar al menos un administrador.',
  category_in_use: 'La categoría está en uso (negocios, publicaciones o subcategorías).', slug_required: 'El identificador (slug) es obligatorio.',
  title_body_required: 'Título y texto son obligatorios.', unknown_key: 'Clave de configuración desconocida.', invalid_amount: 'Importe no válido.', invalid_period: 'El fin del periodo es anterior al inicio.',
  not_found: 'No encontrado.', invalid_type: 'Tipo de cuenta no válido.', invalid_birth_date: 'Esa fecha de nacimiento no es válida.', account_suspended: 'Tu cuenta está suspendida. Si crees que es un error, escríbenos a info@klendar.app.',
};

function toast(msg, bad = false) {
  if (!msg) return; // una respuesta de una pantalla que ya no está
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = I18N.t(msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3500);
}

// Modal genérico: campos → valores (o null si se cancela).
function modal({ title, intro, warn, fields = [], submit = 'Guardar', danger = false, confirmWord = null }) {
  return new Promise((resolve) => {
    const d = $('#modal');
    const field = (f) => {
      const id = 'f_' + f.name;
      const help = f.help ? `<small>${esc(f.help)}</small>` : '';
      if (f.type === 'select') return `<label class="f"><span>${esc(f.label)} ${help}</span><select name="${f.name}" id="${id}">${f.options.map((o) => `<option value="${esc(o[0])}" ${o[0] == f.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
      if (f.type === 'textarea') return `<label class="f"><span>${esc(f.label)} ${help}</span><textarea name="${f.name}" id="${id}" ${f.required ? 'required' : ''}>${esc(f.value ?? '')}</textarea></label>`;
      if (f.type === 'checkbox') return `<label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="${f.name}" id="${id}" ${f.value ? 'checked' : ''}><span>${esc(f.label)} ${help}</span></label>`;
      return `<label class="f"><span>${esc(f.label)} ${help}</span><input name="${f.name}" id="${id}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}></label>`;
    };
    d.innerHTML = `<form method="dialog">
      <h2>${esc(title)}</h2>
      ${intro ? `<p class="muted" style="margin:0">${intro}</p>` : ''}
      ${warn ? `<div class="warn">${warn}</div>` : ''}
      ${fields.map(field).join('')}
      ${confirmWord ? `<label class="f"><span>${I18N.lang === 'en' ? `Type <b>${esc(confirmWord)}</b> to confirm` : `Escribe <b>${esc(confirmWord)}</b> para confirmar`}</span><input name="__confirm" autocomplete="off" required></label>` : ''}
      <div class="foot"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn ${danger ? 'bad' : 'primary'}">${esc(submit)}</button></div>
    </form>`;
    const form = $('form', d);
    const close = (v) => { d.close(); resolve(v); };
    $('[data-cancel]', d).onclick = () => close(null);
    d.oncancel = (e) => { e.preventDefault(); close(null); };
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form); const out = {};
      if (confirmWord && (fd.get('__confirm') || '').trim() !== confirmWord) { toast('La palabra de confirmación no coincide.', true); return; }
      for (const f of fields) out[f.name] = f.type === 'checkbox' ? form.elements[f.name].checked : (fd.get(f.name) ?? '').toString().trim();
      close(out);
    };
    d.showModal();
    const first = $('input:not([type=checkbox]),select,textarea', d); if (first) first.focus();
  });
}
// «Confirma que eres tú» (assets/identidad.js): antes de eliminar una cuenta,
// la contraseña actual. Se comprueba con una sesión aparte y la de este
// navegador (la que pasó el segundo factor) queda confirmada 10 minutos.
// Devuelve true si se confirma.
async function confirmaIdentidad() {
  let id = null;
  try { id = await window.KL_IDENTIDAD?.(sb); } catch { id = null; }
  if (!id) { toast('No se ha podido completar. Prueba otra vez.', true); return false; }
  try {
    for (;;) {
      const r = await modal({ title: 'Confirma que eres tú', intro: esc('Por seguridad, escribe tu contraseña actual.'),
        fields: [{ name: 'clave', label: 'Contraseña actual', type: 'password', required: true }], submit: 'Seguir' });
      if (!r) return false;
      try {
        await id.conClave(r.clave);
        return true;
      } catch (e) {
        toast(e?.code === 'invalid_credentials' ? 'La contraseña no es correcta.' : errAuth(e), true);
      }
    }
  } finally {
    await id.cerrar();
  }
}
const confirmDlg = (title, text, opts = {}) => modal({ title, intro: text, submit: opts.submit || 'Confirmar', danger: opts.danger, confirmWord: opts.confirmWord, warn: opts.warn }).then((v) => v !== null);

// CSV del listado actual.
function downloadCsv(name, rows, cols) {
  const head = cols.map((c) => I18N.t(c[1]));
  const lines = [head, ...rows.map((r) => cols.map((c) => { const v = typeof c[0] === 'function' ? c[0](r) : r[c[0]]; if (v == null) return ''; const t = String(typeof v === 'object' ? JSON.stringify(v) : v); return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; }))];
  const csv = lines.map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${name}-${diaMadridISO()}.csv`; a.click();
}

// Gráfica de barras simple.
function bars(series, key, labelFn) {
  const max = Math.max(1, ...series.map((s) => s[key] || 0));
  return `<div class="chart">${series.map((s) => `<div title="${esc(labelFn ? labelFn(s) : s.day)}: ${s[key] || 0}" style="height:${Math.round((s[key] || 0) / max * 100)}%"></div>`).join('')}</div>`;
}

// Tabla + paginación.
function table({ cols, rows, onRow, empty = 'Nada por aquí.' }) {
  if (!rows.length) return `<div class="tbl-wrap"><div class="empty">${esc(empty)}</div></div>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th ${c.num ? 'class="num"' : ''}>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${onRow ? 'row' : ''}" data-i="${i}">${cols.map((c) => `<td ${c.num ? 'class="num"' : ''}>${c.r(r, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pager(state, total, onChange) {
  const pages = Math.max(1, Math.ceil(total / state.limit));
  const page = Math.floor(state.offset / state.limit) + 1;
  const html = `<div class="pager"><span><b>${fmtNum(total)}</b> ${total === 1 ? 'resultado ·' : 'resultados ·'} <span>página</span> <b>${page}</b> <span>de</span> <b>${pages}</b></span><span class="spacer"></span>
    <button class="btn sm" data-pg="prev" ${page <= 1 ? 'disabled' : ''}>← Anterior</button><button class="btn sm" data-pg="next" ${page >= pages ? 'disabled' : ''}>Siguiente →</button>
    <select data-pg="limit">${[25, 50, 100, 200].map((n) => `<option ${n === state.limit ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
  return { html, bind(root) {
    $$('[data-pg]', root).forEach((el) => {
      if (el.dataset.pg === 'limit') el.onchange = () => { state.limit = +el.value; state.offset = 0; onChange(); };
      else el.onclick = () => { state.offset = Math.max(0, state.offset + (el.dataset.pg === 'next' ? state.limit : -state.limit)); onChange(); };
    });
  } };
}
const helpBox = (title, body) => `<details class="help"><summary>${esc(title)}</summary>${body}</details>`;
const img = (url, ph = ms('storefront')) => url ? `<img class="thumb" src="${esc(url)}" alt="" loading="lazy">` : `<span class="ph">${ph}</span>`;
const appLink = (path, label = I18N.lang === 'en' ? 'View in the app' : 'Ver en la app') => `<a class="btn sm ghost" href="${APP_URL}${path}" target="_blank" rel="noopener">${label} ↗</a>`;

// ── Sesión ──────────────────────────────────────────────────────────────────
const insecure = location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
if (insecure) {
  document.body.innerHTML = I18N.lang === 'en'
    ? '<div class="login"><h2>Insecure connection</h2><p class="muted">This panel only works over HTTPS: <a href="https://klendar.app/admin/">https://klendar.app/admin/</a>.</p></div>'
    : '<div class="login"><h2>Conexión no segura</h2><p class="muted">Este panel solo funciona por HTTPS: <a href="https://klendar.app/admin/">https://klendar.app/admin/</a>.</p></div>';
  throw new Error('insecure');
}
let ME = null;
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  ME = session.user;
  $('#who').textContent = ME.email;
  // Antes del panel, la verificación en dos pasos (más abajo).
  if (!await puertaMfa()) return;
  $('#login').hidden = true; $('#mfa').hidden = true; $('#app').hidden = false;
  route();
}
function showLogin() { $('#login').hidden = false; $('#app').hidden = true; $('#mfa').hidden = true; ME = null; }
// Entrar: los mismos mensajes que la app, «Tu cuenta» y el panel
// (assets/auth-errors.js).
const errAuth = (error) => window.KL_AUTH_ERROR(error, I18N.lang);
async function esperando(boton, trabajo) {
  if (boton.disabled) return;
  boton.disabled = true;
  try { await trabajo(); } finally { boton.disabled = false; }
}
$('#doLogin').onclick = () => {
  $('#loginErr').textContent = '';
  if (!KL_VALIDA.correoYClave(I18N.lang, $('#email'), $('#password'))) return;
  esperando($('#doLogin'), async () => {
    let captchaToken;
    try { captchaToken = await window.KL_CAPTCHA?.(); } catch (e) { $('#loginErr').textContent = errAuth(e); return; }
    const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value, options: { captchaToken } });
    if (error) { $('#loginErr').textContent = errAuth(error); return; }
    boot();
  });
};
$('#doReset').onclick = () => {
  $('#loginErr').textContent = '';
  KL_CAMPO($('#password'), null);
  if (!KL_VALIDA.correoYClave(I18N.lang, $('#email'))) return;
  esperando($('#doReset'), async () => {
    let captchaToken;
    try { captchaToken = await window.KL_CAPTCHA?.(); } catch (e) { $('#loginErr').textContent = errAuth(e); return; }
    const { error } = await sb.auth.resetPasswordForEmail($('#email').value.trim(),
      { redirectTo: `${location.origin}/app/?destino=%2Fadmin%2F#/nueva-clave`, captchaToken });
    if (error) { $('#loginErr').textContent = errAuth(error); return; }
    toast(I18N.lang === 'en'
      ? `If ${$('#email').value.trim()} has an account, it'll get an email in a few seconds. Check spam too.`
      : `Si ${$('#email').value.trim()} tiene cuenta, recibirá un correo en unos segundos. Mira también en spam.`);
  });
};
$('#password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#doLogin').click(); });
$('#logout').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut({ scope: 'local' }); showLogin(); };
sb.auth.onAuthStateChange((ev) => {
  if (ev === 'SIGNED_OUT') showLogin();
  if (ev === 'PASSWORD_RECOVERY') location.href = '/app/?destino=%2Fadmin%2F#/nueva-clave';
});
$('#menuBtn').onclick = () => $('#side').classList.toggle('open');

// ── Verificación en dos pasos (TOTP) ────────────────────────────────────────
// Supabase Auth, un factor TOTP por persona (Google Authenticator, 1Password,
// Authy…). Con contraseña la sesión es «aal1»; con el código, «aal2». La base
// solo deja administrar con aal2 si `app_config.admin_require_mfa` es true
// (`admin_mfa_status` lo dice). Aunque no lo sea, a quien no lo tiene se le
// ofrece (recomendado) y a quien lo tiene se le pide el código. El aal2 dura
// lo que la sesión de Supabase en este navegador: al cerrar sesión, otra vez.
const MFA_LUEGO = 'kl_admin_mfa_luego'; // «Ahora no», hasta cerrar la pestaña
let MFA = null;

async function mfaEstado() {
  const [{ data: st, error }, { data: f, error: e2 }, { data: aal }] = await Promise.all([
    sb.rpc('admin_mfa_status'), sb.auth.mfa.listFactors(), sb.auth.mfa.getAuthenticatorAssuranceLevel()]);
  if (error || e2 || !st) return null;
  return {
    ...st,
    factor: (f?.totp || []).find((x) => x.status === 'verified') || null,
    aMedias: (f?.all || []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified'),
    nivel: aal?.currentLevel || st.aal || 'aal1',
  };
}

/** true: al panel; false: se está enseñando una pantalla de la verificación. */
async function puertaMfa() {
  try { MFA = await mfaEstado(); } catch { MFA = null; }
  // Sin red o sin ser administradora: el panel lo explica como siempre.
  if (!MFA || !MFA.admin) return true;
  if (MFA.factor && MFA.nivel !== 'aal2') { pantallaCodigo(MFA.factor); return false; }
  if (!MFA.factor) {
    let luego = false;
    try { luego = sessionStorage.getItem(MFA_LUEGO) === '1'; } catch { /* sin almacenamiento */ }
    if (MFA.required || !luego) { pantallaAlta({ obligatorio: MFA.required }); return false; }
  }
  return true;
}

function mfaError(e) {
  const c = e?.code || '';
  const m = e?.message || '';
  let t;
  if (c === 'mfa_verification_failed' || /invalid totp|invalid code/i.test(m)) t = 'Código incorrecto. Escribe el que enseña ahora la app.';
  else if (c === 'mfa_challenge_expired') t = 'El código ha caducado. Escribe el nuevo.';
  else if (/rate.?limit|too many/i.test(c + m) || c === 'mfa_verification_rejected') t = 'Demasiados intentos. Espera un minuto y vuelve a probar.';
  else if (/not_enabled/.test(c)) t = 'La verificación en dos pasos no está activada en Supabase. Avisa a soporte.';
  else if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return window.KL_AUTH_TEXT('sinRed', I18N.lang);
  else { console.error(e); t = 'No se ha podido completar. Prueba otra vez.'; }
  return I18N.t(t);
}

function pantallaMfa(html) {
  const box = $('#mfa');
  box.innerHTML = `<a class="brand" href="/"><img src="/assets/symbol.png" alt="" width="30" height="30"> Klendar <small class="muted">· admin</small></a>
    ${html}
    <button class="btn sm ghost" id="mfaSalir" type="button">Cerrar sesión</button>
    <span class="lang" id="langMfa" aria-label="Idioma / Language"></span>`;
  $('#login').hidden = true; $('#app').hidden = true; box.hidden = false;
  I18N.pickers(['#langMfa']);
  $('#mfaSalir').onclick = async () => { await sb.auth.signOut({ scope: 'local' }); showLogin(); };
  I18N.translate(box);
  return box;
}

/** El campo del código: solo cifras y, al llegar a 6, adelante. */
function campoCodigo(enviar) {
  const i = $('#mfaCode');
  i.oninput = () => { i.value = i.value.replace(/\D/g, '').slice(0, 6); if (i.value.length === 6) enviar(); };
  i.onkeydown = (e) => { if (e.key === 'Enter') enviar(); };
  i.focus();
}
const INPUT_CODIGO = '<label class="f"><span>Código de 6 cifras</span><input id="mfaCode" class="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></label><div id="mfaErr" class="err" role="alert"></div>';

function alPanel() {
  $('#mfa').hidden = true; $('#login').hidden = true; $('#app').hidden = false;
  route();
}

function pantallaCodigo(factor) {
  pantallaMfa(`<h2 style="margin:0">Verificación en dos pasos</h2>
    <p class="muted" style="margin:0">Escribe el código de 6 cifras de tu app de verificación (Google Authenticator, 1Password, Authy…).</p>
    ${INPUT_CODIGO}
    <button class="btn primary" id="mfaOk" type="button">Verificar</button>
    <p class="muted small" style="margin:0">En este navegador no te lo volveremos a pedir hasta que cierres sesión.</p>
    <details class="help"><summary>¿Has perdido el móvil?</summary><p>Pide a otro administrador que quite tu factor en Supabase (Authentication → Users → tu cuenta → quitar el factor MFA). Al volver a entrar podrás configurarlo en el móvil nuevo.</p></details>`);
  const enviar = () => esperando($('#mfaOk'), async () => {
    const code = $('#mfaCode').value.trim();
    $('#mfaErr').textContent = '';
    if (!/^\d{6}$/.test(code)) { $('#mfaErr').textContent = I18N.t('Son 6 cifras.'); return; }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) { $('#mfaErr').textContent = mfaError(error); $('#mfaCode').select(); return; }
    MFA = { ...MFA, nivel: 'aal2' };
    alPanel();
  });
  $('#mfaOk').onclick = enviar;
  campoCodigo(enviar);
}

/** Alta del factor: QR, clave para escribirla a mano y el primer código. */
// `reemplaza`: el factor de antes (cambio de móvil), que se quita solo cuando
// el nuevo ya funciona; si se cancela, se queda el de antes.
async function pantallaAlta({ obligatorio = false, cancelar = false, reemplaza = null } = {}) {
  pantallaMfa(`<h2 style="margin:0">Protege la administración</h2><div class="loading">Cargando…</div>`);
  // Un alta a medias de otra vez (se cerró la pestaña con el QR delante):
  // fuera, o Supabase no deja crear otra con el mismo nombre.
  const { data: fs } = await sb.auth.mfa.listFactors();
  for (const f of (fs?.all || []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) {
    await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  // El nombre, distinto cada vez: con un cambio de móvil conviven un momento.
  const nombre = `Klendar admin · ${aInputMadrid(new Date()).replace('T', ' ')}`;
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', issuer: 'Klendar admin', friendlyName: nombre });
  if (error) {
    pantallaMfa(`<h2 style="margin:0">Protege la administración</h2><p class="err">${esc(mfaError(error))}</p>
      <button class="btn" id="mfaOtra" type="button">Reintentar</button>`);
    $('#mfaOtra').onclick = () => pantallaAlta({ obligatorio, cancelar, reemplaza });
    return;
  }
  const clave = data.totp.secret;
  pantallaMfa(`<h2 style="margin:0">${reemplaza ? 'Cambiar de móvil o de app' : 'Protege la administración'}</h2>
    <p class="muted" style="margin:0">${reemplaza ? 'Añade Klendar en la app nueva. El código de antes sigue valiendo hasta que escribas aquí el primero de la nueva.' : obligatorio ? 'Para administrar Klendar hace falta la verificación en dos pasos: además de la contraseña, un código que cambia cada 30 segundos en tu móvil.' : 'Recomendado: con la verificación en dos pasos, además de la contraseña hace falta un código que cambia cada 30 segundos en tu móvil. Así, una contraseña robada no basta para entrar en el panel.'}</p>
    <ol class="mfa-pasos">
      <li>Abre Google Authenticator, 1Password, Authy o la app de códigos que uses.</li>
      <li>Escanea este código QR (o añade la clave a mano).</li>
      <li>Escribe aquí el código de 6 cifras que te enseña.</li>
    </ol>
    <img class="mfa-qr" id="mfaQr" alt="Código QR para tu app de verificación" width="200" height="200">
    <div class="f"><span>Clave para añadirla a mano</span>
      <span class="mfa-clave"><code id="mfaSecret"></code><button class="btn sm" id="mfaCopy" type="button">Copiar</button></span>
      <a class="link small" id="mfaUri">Abrir en la app de códigos (desde el móvil)</a></div>
    ${INPUT_CODIGO}
    <button class="btn primary" id="mfaOk" type="button">Activar</button>
    ${obligatorio ? '' : `<button class="btn ghost" id="mfaLuego" type="button">${cancelar ? 'Cancelar' : 'Ahora no'}</button>`}`);
  // El SVG del QR como imagen (propiedad, no atributo: lleva comillas dentro).
  const svg = String(data.totp.qr_code || '').replace(/^data:image\/svg\+xml;[^,]*,/, '');
  $('#mfaQr').src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  $('#mfaSecret').textContent = clave.replace(/(.{4})(?=.)/g, '$1 ');
  $('#mfaUri').href = data.totp.uri;
  $('#mfaCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(clave); toast('Clave copiada'); } catch { toast('No se ha podido copiar: selecciónala y cópiala a mano.', true); }
  };
  if ($('#mfaLuego')) {
    $('#mfaLuego').onclick = () => esperando($('#mfaLuego'), async () => {
      // El alta sin terminar no se deja colgada.
      await sb.auth.mfa.unenroll({ factorId: data.id });
      if (!reemplaza) { try { sessionStorage.setItem(MFA_LUEGO, '1'); } catch { /* sin almacenamiento */ } }
      alPanel();
    });
  }
  const enviar = () => esperando($('#mfaOk'), async () => {
    const code = $('#mfaCode').value.trim();
    $('#mfaErr').textContent = '';
    if (!/^\d{6}$/.test(code)) { $('#mfaErr').textContent = I18N.t('Son 6 cifras.'); return; }
    const { error: e } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code });
    if (e) { $('#mfaErr').textContent = mfaError(e); $('#mfaCode').select(); return; }
    try { sessionStorage.removeItem(MFA_LUEGO); } catch { /* sin almacenamiento */ }
    if (reemplaza) await sb.auth.mfa.unenroll({ factorId: reemplaza });
    MFA = await mfaEstado().catch(() => null);
    toast(reemplaza ? 'Listo: ahora vale el código del móvil nuevo' : 'Verificación en dos pasos activada');
    alPanel();
  });
  $('#mfaOk').onclick = enviar;
  campoCodigo(enviar);
}

/** Quitar el propio factor, o cambiarlo (móvil nuevo): primero el código actual. */
async function cambiarFactor(quitar) {
  const f = MFA?.factor;
  if (!f) return;
  const r = await modal({
    title: quitar ? 'Quitar la verificación en dos pasos' : 'Cambiar de móvil o de app',
    intro: I18N.t('Escribe el código que enseña ahora tu app de verificación para confirmar que eres tú.'),
    warn: quitar && MFA.required ? I18N.t('Es obligatoria para administrar: justo después tendrás que configurarla otra vez.') : '',
    fields: [{ name: 'code', label: 'Código de 6 cifras', required: true, placeholder: '123456' }],
    submit: quitar ? 'Quitar' : 'Seguir', danger: quitar,
  });
  if (!r) return;
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: r.code.replace(/\D/g, '') });
  if (error) { toast(mfaError(error), true); return; }
  // Cambiar: el de antes sigue valiendo hasta que el nuevo funcione.
  if (!quitar) { pantallaAlta({ cancelar: true, reemplaza: f.id }); return; }
  const { error: e2 } = await sb.auth.mfa.unenroll({ factorId: f.id });
  if (e2) { toast(mfaError(e2), true); return; }
  await sb.auth.refreshSession().catch(() => {});
  MFA = await mfaEstado().catch(() => null);
  if (!MFA?.required) {
    try { sessionStorage.setItem(MFA_LUEGO, '1'); } catch { /* sin almacenamiento */ }
    toast('Verificación en dos pasos quitada');
    route();
    return;
  }
  pantallaAlta({ obligatorio: true });
}

// ── Idioma ──────────────────────────────────────────────────────────────────
I18N.pickers(['#lang', '#langLogin', '#langSide']);
I18N.translate(document.body);
if (I18N.lang === 'en') document.title = 'Klendar · Administration';
// Un enlace dentro de una fila que se abre al pulsarla: va a su sitio sin
// abrir la fila (sin `onclick` en el HTML, que una CSP estricta no deja).
document.addEventListener('click', (e) => { if (e.target instanceof Element && e.target.closest('[data-sin-fila]')) e.stopPropagation(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea|select/i.test(e.target.tagName)) { const s = $('#q'); if (s) { e.preventDefault(); s.focus(); } } });

// ── Navegación ──────────────────────────────────────────────────────────────
const NAV = [
  ['group', 'Actividad'],
  ['resumen', 'dashboard', 'Resumen'], ['semanas', 'trending_up', 'Semana a semana'], ['ciudades', 'map', 'Ciudades'], ['negocios', 'storefront', 'Negocios'], ['publicaciones', 'bolt', 'Publicaciones'], ['canjes', 'confirmation_number', 'Canjes'], ['usuarios', 'person', 'Usuarios'],
  ['group', 'Moderación'],
  ['denuncias', 'flag', 'Denuncias'], ['mensajes', 'campaign', 'Mensajes a clientes'], ['resenas', 'chat_bubble', 'Reseñas y novedades'], ['sugerencias', 'lightbulb', 'Sugerencias'],
  ['group', 'Negocio'],
  ['planes', 'credit_card', 'Planes y pagos'], ['avisos', 'notifications', 'Notificaciones y push'],
  ['group', 'Sistema'],
  ['colecciones', 'auto_awesome', 'Colecciones'], ['categorias', 'category', 'Categorías'], ['configuracion', 'settings', 'Configuración'], ['errores', 'bug_report', 'Errores de la web'], ['administradores', 'shield', 'Administradores'], ['actividad', 'history', 'Registro de actividad'], ['ayuda', 'help', 'Ayuda'],
];
let BADGES = {};
let WEB_ERR = null;
function renderNav(current) {
  // (al final se traduce; la lista se arma igual en los dos idiomas)
  $('#nav').innerHTML = NAV.map((n) => n[0] === 'group' ? `<div class="group">${n[1]}</div>`
    : `<a class="nav ${current === n[0] ? 'on' : ''}" href="#/${n[0]}"><span class="ic">${ms(n[1])}</span>${n[2]}${BADGES[n[0]] ? `<span class="badge">${BADGES[n[0]]}</span>` : ''}</a>`).join('');
  I18N.translate($('#nav'));
}
async function refreshBadges(lanzar = false) {
  try {
    const k = await rpc('admin_kpis');
    let sug = 0;
    try { sug = (await rpc('admin_feedback', { p_status: 'new', p_limit: 1 })).counts?.new || 0; } catch { /* sin permisos */ }
    // Mensajes a clientes parados por la moderación automática.
    let msj = 0;
    try { msj = (await rpc('admin_business_messages', { p_status: 'review', p_limit: 1, p_offset: 0 })).pending || 0; } catch { /* sin la función */ }
    // Textos parados por lenguaje ofensivo (novedades, reseñas, respuestas, ficha y carta).
    let textos = 0;
    try { textos = (await rpc('admin_text_reviews', { p_limit: 1, p_offset: 0 })).total || 0; } catch { /* sin la función */ }
    // Errores de la web: los nuevos de las últimas 24 h (y lo demás para el Resumen).
    try { WEB_ERR = (await rpc('admin_web_errors', { p_status: 'open', p_limit: 1, p_offset: 0 })).counts || null; } catch { WEB_ERR = null; }
    BADGES = { negocios: k.businesses_pending || 0, publicaciones: k.offers_pending || 0, denuncias: k.reports_open || 0, mensajes: msj, resenas: textos, sugerencias: sug, errores: WEB_ERR?.new_24h || 0 };
    Object.keys(BADGES).forEach((x) => { if (!BADGES[x]) delete BADGES[x]; });
    renderNav(currentRoute()[0]);
    return k;
  } catch (e) {
    // Resumen necesita saber por qué ha fallado (sin red, sesión caducada…);
    // las demás pantallas solo pierden los numeritos del menú.
    if (lanzar) throw e;
    return null;
  }
}
const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'resumen').split('/');
const PAGES = {};
async function route() {
  if (!ME || !$('#mfa').hidden) return;
  const n = ++RUTA_N;
  const [page, id] = currentRoute();
  renderNav(page);
  $('#side').classList.remove('open');
  // Cada pintada en su propia caja: si una vieja termina tarde, escribe en
  // una caja que ya no está en la página.
  const v = document.createElement('div');
  v.innerHTML = '<div class="loading">Cargando…</div>';
  $('#view').replaceChildren(v);
  I18N.translate(v);
  window.scrollTo(0, 0);
  try {
    const fn = PAGES[page] || PAGES.resumen;
    await fn(v, id);
    if (n === RUTA_N) I18N.translate(v);
  } catch (e) {
    if (n !== RUTA_N || e?.obsoleta) return;
    console.error(e);
    const msg = e?.message || window.KL_AUTH_TEXT('sinRed', I18N.lang);
    // Nunca la pantalla en blanco: el error y «Reintentar».
    v.innerHTML = `<div class="card"><h2>Algo ha fallado</h2><p class="err">${esc(I18N.t(msg))}</p>${/administradora/.test(msg) ? (I18N.lang === 'en' ? '<p class="muted">Ask another administrator to add you in “Administrators”, or run this in Supabase: <code>insert into public.admin_users (user_id) select id from auth.users where email = \'your@email\'</code></p>' : '<p class="muted">Pide a otro administrador que te dé de alta en «Administradores», o ejecuta en Supabase: <code>insert into public.admin_users (user_id) select id from auth.users where email = \'tu@email\'</code></p>') : ''}
      <p style="margin:12px 0 0"><button class="btn" type="button" data-reintentar>Reintentar</button></p></div>`;
    $('[data-reintentar]', v).onclick = () => route();
    I18N.translate(v);
  }
}
window.addEventListener('hashchange', route);
// Lo que se recarga dentro de una pantalla (filtros, buscador, páginas,
// pestañas) no pasa por `route`: si falla, se dice, en vez de dejar la lista
// a medias sin explicación. Lo de pantallas que ya no están, se calla.
window.addEventListener('unhandledrejection', (ev) => {
  const e = ev.reason;
  if (e?.obsoleta) { ev.preventDefault(); return; }
  if (e instanceof Error && ME) {
    toast(e instanceof TypeError ? 'Algo ha fallado. Prueba otra vez.' : (e.message || window.KL_AUTH_TEXT('sinRed', I18N.lang)), true);
    $$('#view .loading').forEach((l) => { l.textContent = I18N.t('No se ha podido cargar. Prueba otra vez.'); });
  }
});
const go = (h) => { location.hash = h; };

// ── Resumen ─────────────────────────────────────────────────────────────────
PAGES.semanas = async (v) => {
  const [k, dormidos] = await Promise.all([
    rpc('admin_weekly_kpis', { p_weeks: 10 }),
    rpc('admin_sleeping_businesses', { p_days: 30 }),
  ]);
  const semanas = (k?.semanas || []).slice().reverse();
  const dorm = dormidos?.negocios || [];
  // La flecha compara con la semana anterior: un número suelto no dice nada.
  const delta = (fila, anterior, campo) => {
    if (!anterior) return '';
    const a = Number(anterior[campo] || 0);
    const b = Number(fila[campo] || 0);
    if (a === b) return '<span class="muted"> =</span>';
    const sube = b > a;
    const pct = a === 0 ? '' : ` ${Math.round(Math.abs((b - a) / a) * 100)} %`;
    return `<span class="${sube ? 'up' : 'down'}"> ${sube ? '▲' : '▼'}${pct}</span>`;
  };

  v.innerHTML = `
    <div class="page-head"><h1>Semana a semana</h1></div>
    ${helpBox('¿Qué miro aquí?', I18N.lang === 'en'
      ? `<p><b>People</b> means everyone who did something that week (saved, redeemed or added a favourite), which is more honest than counting who opened the app. <b>Conversion</b> is, out of every hundred publications viewed, how many were redeemed: if it drops, either what gets published isn't interesting or it's hard to redeem.</p><p><b>Active businesses</b> are the ones that published something that week. It's the number that makes or breaks an app like this: without businesses publishing, nothing else matters.</p>`
      : `<p><b>Gente</b> es quien ha hecho algo esa semana (guardar, canjear o marcar favorito), que es más honesto que contar quién abrió la app. <b>Conversión</b> es de cada cien publicaciones vistas, cuántas se canjearon: si baja, o lo que se publica no interesa o cuesta canjearlo.</p><p><b>Negocios activos</b> son los que publicaron algo esa semana. Es el número que mata una app como esta: sin negocios publicando, el resto da igual.</p>`)}
    <div class="card"><h2>Últimas semanas</h2>${table({
      cols: [
        // Solo el día: una semana no empieza a las 2:00.
        { h: 'Semana', r: (x) => new Date(`${x.semana}T00:00:00`).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }) },
        { h: 'Gente', num: true, r: (x, i) => fmtNum(x.gente) + delta(x, semanas[i + 1], 'gente') },
        { h: 'Altas', num: true, r: (x) => fmtNum(x.altas) },
        { h: 'Publicaciones', num: true, r: (x, i) => fmtNum(x.publicaciones) + delta(x, semanas[i + 1], 'publicaciones') },
        { h: 'Vistas', num: true, r: (x) => fmtNum(x.vistas) },
        { h: 'Canjes', num: true, r: (x, i) => fmtNum(x.canjes) + delta(x, semanas[i + 1], 'canjes') },
        { h: 'Conversión', num: true, r: (x) => x.conversion == null ? '—' : `${String(x.conversion).replace('.', ',')} %` },
        { h: 'Negocios activos', num: true, r: (x, i) => fmtNum(x.negocios_activos) + delta(x, semanas[i + 1], 'negocios_activos') },
        { h: 'Negocios nuevos', num: true, r: (x) => fmtNum(x.negocios_nuevos) },
      ],
      rows: semanas,
      empty: 'Todavía no hay semanas que enseñar.',
    })}</div>
    <div class="card"><h2>Negocios dormidos</h2>
      <p class="muted">Publicaron alguna vez y llevan más de un mes sin hacerlo. Esto no es un número para mirar: es la lista a la que hay que llamar.</p>
      ${table({
        cols: [
          { h: 'Negocio', r: (x) => `<b class="title">${esc(x.name)}</b><span class="sub">${esc(x.city || '')}</span>` },
          { h: 'Última publicación', r: (x) => fmtDate(x.ultima) },
          { h: 'Publicaciones', num: true, r: (x) => fmtNum(x.total) },
          { h: '', r: (x) => `<a class="btn sm" href="#/negocios/${esc(x.id)}">Abrir</a>` },
        ],
        rows: dorm,
        empty: 'Ninguno: todos han publicado este mes.',
      })}</div>`;
};

PAGES.resumen = async (v) => {
  const k = await refreshBadges(true);
  const kpi = (n, label, cls = '') => `<div class="kpi ${cls}"><b>${typeof n === 'number' ? fmtNum(n) : n}</b><span>${label}</span></div>`;
  const series = k.series || [];
  const en = I18N.lang === 'en';
  // Lo que acumula 3 o más denuncias abiertas, lo primero (Denuncias).
  let calientes = null;
  try { calientes = await rpc('admin_report_groups', { p_status: 'open', p_type: 'all', p_min_open: 3, p_limit: 5, p_offset: 0 }); } catch (e) { if (e?.obsoleta) throw e; }
  const nCal = calientes?.total || 0;
  v.innerHTML = `
    <div class="page-head"><h1>Resumen</h1><span class="spacer"></span><span class="muted">${new Date().toLocaleString(LOC(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ })}</span></div>
    ${nCal ? `<div class="card den-resumen"><h2>${ms('report')} ${en ? 'Content with 3 or more open reports' : 'Contenido con 3 o más denuncias abiertas'}</h2>
      <p class="muted" style="margin:0 0 10px">${en ? 'Several people have reported the same thing: check it first.' : 'Varias personas han denunciado lo mismo: revísalo lo primero.'}</p>
      ${calientes.rows.map((g) => `<a class="item den-caliente den-mini" href="#/denuncias/${esc(g.target_type)}/${esc(g.target_id)}">${miniDen(g.target_type, g.target)}<div style="min-width:0">
        <h3>${esc(tituloDen(g.target_type, g.target))}</h3>
        <div class="meta">${tag(g.target_type, 'dim')} ${estadoDen(g.state)} · <b>${g.open_count}</b> ${en ? 'open reports' : 'denuncias abiertas'} · ${g.people} ${en ? (g.people === 1 ? 'person' : 'people') : (g.people === 1 ? 'persona' : 'personas')}${g.target?.business && g.target_type !== 'business' ? ` · ${esc(g.target.business)}` : ''} · ${en ? 'latest' : 'última'} ${ago(g.last_at)}</div>
        <div class="den-motivos">${(g.reasons || []).map((m) => `<span class="tag ${m.reason === 'child_abuse' || m.reason === 'illegal' ? 'bad' : 'dim'}">${esc(motivoDen(m.reason))} · ${m.n}</span>`).join(' ')}</div>
      </div></a>`).join('')}
      ${nCal > calientes.rows.length ? `<p style="margin:6px 0 0"><a class="link" href="#/denuncias">${en ? `See all ${nCal}` : `Ver los ${nCal}`}</a></p>` : ''}
    </div>` : ''}
    ${(k.businesses_pending || k.offers_pending || k.reports_open || k.subs_expiring_7d || k.push_failed_7d || BADGES.sugerencias || BADGES.mensajes || BADGES.errores) ? `<div class="card"><h2>Pendiente de ti</h2><div class="actions">
      ${nCal ? `<a class="btn bad" href="#/denuncias">${ms('report')} <b>${nCal}</b> ${en ? (nCal === 1 ? 'item with 3+ open reports' : 'items with 3+ open reports') : (nCal === 1 ? 'contenido con 3 o más denuncias' : 'contenidos con 3 o más denuncias')}</a>` : ''}
      ${k.businesses_pending ? `<a class="btn" href="#/negocios?status=pending">${ms('storefront')} <b>${k.businesses_pending}</b> ${en ? (k.businesses_pending === 1 ? 'business to verify' : 'businesses to verify') : (k.businesses_pending === 1 ? 'negocio por verificar' : 'negocios por verificar')}</a>` : ''}
      ${k.offers_pending ? `<a class="btn" href="#/publicaciones?moderation=pending">${ms('bolt')} <b>${k.offers_pending}</b> ${en ? (k.offers_pending === 1 ? 'publication to moderate' : 'publications to moderate') : (k.offers_pending === 1 ? 'publicación por moderar' : 'publicaciones por moderar')}</a>` : ''}
      ${k.reports_open ? `<a class="btn" href="#/denuncias">${ms('flag')} <b>${k.reports_open}</b> ${en ? (k.reports_open === 1 ? 'open report' : 'open reports') : (k.reports_open === 1 ? 'denuncia abierta' : 'denuncias abiertas')}</a>` : ''}
      ${k.subs_expiring_7d ? `<a class="btn" href="#/planes">${ms('credit_card')} <b>${k.subs_expiring_7d}</b> ${en ? (k.subs_expiring_7d === 1 ? 'subscription expiring in 7 days' : 'subscriptions expiring in 7 days') : (k.subs_expiring_7d === 1 ? 'suscripción vence en 7 días' : 'suscripciones vencen en 7 días')}</a>` : ''}
      ${k.push_failed_7d ? `<a class="btn" href="#/avisos?tab=push">${ms('notifications')} <b>${k.push_failed_7d}</b> ${en ? (k.push_failed_7d === 1 ? 'failed push notification (7 d)' : 'failed push notifications (7 d)') : (k.push_failed_7d === 1 ? 'notificación push fallida (7 d)' : 'notificaciones push fallidas (7 d)')}</a>` : ''}
      ${BADGES.mensajes ? `<a class="btn" href="#/mensajes">${ms('campaign')} <b>${BADGES.mensajes}</b> ${en ? (BADGES.mensajes === 1 ? 'customer message to review' : 'customer messages to review') : (BADGES.mensajes === 1 ? 'mensaje a clientes por revisar' : 'mensajes a clientes por revisar')}</a>` : ''}
      ${BADGES.errores ? `<a class="btn" href="#/errores">${ms('bug_report')} <b>${BADGES.errores}</b> ${en ? (BADGES.errores === 1 ? 'new website error (24 h)' : 'new website errors (24 h)') : (BADGES.errores === 1 ? 'error nuevo en la web (24 h)' : 'errores nuevos en la web (24 h)')}</a>` : ''}
      ${BADGES.sugerencias ? `<a class="btn" href="#/sugerencias">${ms('lightbulb')} <b>${BADGES.sugerencias}</b> ${en ? (BADGES.sugerencias === 1 ? 'unread suggestion' : 'unread suggestions') : (BADGES.sugerencias === 1 ? 'sugerencia sin leer' : 'sugerencias sin leer')}</a>` : ''}
    </div></div>` : '<div class="card"><h2>Todo al día</h2><p class="muted" style="margin:0">No hay negocios por verificar, publicaciones por moderar ni denuncias abiertas.</p></div>'}
    <div class="grid2">
      <div class="card"><h2>Usuarios</h2><div class="kpis">
        ${kpi(k.users_total, 'usuarios en total')} ${kpi(k.users_7d, 'nuevos (7 d)')} ${kpi(k.users_30d, 'nuevos (30 d)')}
        ${kpi(k.dau, 'activos hoy')} ${kpi(k.wau, 'activos (7 d)')} ${kpi(k.mau, 'activos (30 d)')}
        ${kpi(k.users_business, 'cuentas de negocio')} ${kpi(k.push_tokens, 'con push activado')} ${kpi(k.users_banned, 'suspendidos', k.users_banned ? 'accent' : '')}
      </div></div>
      <div class="card"><h2>Negocios</h2><div class="kpis">
        ${kpi(k.businesses_total, 'en total')} ${kpi(k.businesses_verified, 'verificados')} ${kpi(k.businesses_pending, 'pendientes', k.businesses_pending ? 'accent' : '')}
        ${kpi(k.businesses_rejected, 'rechazados')} ${kpi(k.businesses_inactive, 'desactivados')}
      </div></div>
      <div class="card"><h2>Publicaciones y canjes</h2><div class="kpis">
        ${kpi(k.offers_active, 'activas ahora')} ${kpi(k.offers_7d, 'publicadas (7 d)')} ${kpi(k.offers_pending, 'por moderar', k.offers_pending ? 'accent' : '')} ${kpi(k.offers_rejected, 'retiradas')}
        ${kpi(k.views_7d, 'vistas (7 d)')} ${kpi(k.views_30d, 'vistas (30 d)')} ${kpi(k.redemptions_7d, 'canjes (7 d)')} ${kpi(k.redemptions_30d, 'canjes (30 d)')} ${kpi(k.redemptions_pending, 'códigos en curso')}
      </div></div>
      <div class="card"><h2>Ingresos y suscripciones</h2><div class="kpis">
        ${kpi(fmtMoney(k.revenue_month_cents), 'cobrado este mes', 'accent')} ${kpi(fmtMoney(k.revenue_30d_cents), 'cobrado (30 d)')} ${kpi(fmtMoney(k.revenue_total_cents), 'cobrado en total')}
        ${kpi(k.subs_active, 'suscripciones de pago')} ${kpi(k.subs_trial, 'en prueba')} ${kpi(k.subs_past_due, 'impagadas', k.subs_past_due ? 'accent' : '')} ${kpi(k.subs_expiring_7d, 'vencen en 7 d')}
      </div></div>
      <div class="card"><h2>Moderación</h2><div class="kpis">
        ${kpi(k.reports_open, 'denuncias abiertas', k.reports_open ? 'accent' : '')} ${kpi(k.reviews_total, 'reseñas')} ${kpi(k.reviews_7d, 'reseñas (7 d)')}
      </div></div>
      <div class="card"><h2>Notificaciones push</h2><div class="kpis">
        ${kpi(k.push_queue, 'en cola')} ${kpi(k.push_sent_7d, 'enviadas (7 d)')} ${kpi(k.push_failed_7d, 'fallidas (7 d)', k.push_failed_7d ? 'accent' : '')}
      </div></div>
      ${WEB_ERR ? `<div class="card"><h2><a class="link" href="#/errores">Errores de la web</a></h2><div class="kpis">
        ${kpi(WEB_ERR.new_24h || 0, 'errores nuevos (24 h)', WEB_ERR.new_24h ? 'accent' : '')} ${kpi(WEB_ERR.open || 0, 'sin resolver')} ${kpi(WEB_ERR.last_hour || 0, 'veces en la última hora')}
      </div></div>` : ''}
    </div>
    <div class="card"><div class="page-head" style="margin-bottom:4px"><h2 style="margin:0">Últimos 30 días</h2><span class="spacer"></span>
      <div class="chart-tabs" id="ctabs">${[['redemptions', 'Canjes'], ['views', 'Vistas'], ['offers', 'Publicaciones'], ['users', 'Altas']].map(([k2, l], i) => `<button class="${i === 0 ? 'on' : ''}" data-k="${k2}">${l}</button>`).join('')}</div></div>
      <div id="chart">${bars(series, 'redemptions', (s) => fmtDay(s.day))}</div>
      <div class="chart-legend"><span>${fmtDay(series[0]?.day)}</span><span style="margin-left:auto">${fmtDay(series[series.length - 1]?.day)}</span></div>
    </div>
    <div class="grid3">
      <div class="card"><h2>Top negocios (canjes 30 d)</h2>${(k.top_businesses || []).length ? `<ol style="margin:0;padding-left:18px">${k.top_businesses.map((b) => `<li><a class="link" href="#/negocios/${b.id}">${esc(b.name)}</a> <span class="muted">${esc(b.city || '')} · ${b.redemptions}</span></li>`).join('')}</ol>` : '<p class="muted">Aún sin canjes.</p>'}</div>
      <div class="card"><h2>Top publicaciones (30 d)</h2>${(k.top_offers || []).length ? `<ol style="margin:0;padding-left:18px">${k.top_offers.map((o) => `<li><a class="link" href="#/publicaciones/${o.id}">${esc(o.title)}</a> <span class="muted">${esc(o.business)} · ${en ? `${o.redemptions_count} ${o.redemptions_count === 1 ? 'redemption' : 'redemptions'} · ${o.views_count} ${o.views_count === 1 ? 'view' : 'views'}` : `${o.redemptions_count} ${o.redemptions_count === 1 ? 'canje' : 'canjes'} · ${o.views_count} ${o.views_count === 1 ? 'vista' : 'vistas'}`}</span></li>`).join('')}</ol>` : '<p class="muted">Nada todavía.</p>'}</div>
      <div class="card"><h2>Negocios por ciudad</h2>${(k.by_city || []).length ? `<dl class="kv" style="grid-template-columns:1fr auto">${k.by_city.map((c) => `<dt>${esc(c.city)}</dt><dd>${c.verified}/${c.businesses}</dd>`).join('')}</dl><p class="muted small" style="margin:8px 0 0">verificados / total</p>` : '<p class="muted">—</p>'}</div>
    </div>`;
  $('#ctabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('#ctabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#chart').innerHTML = bars(series, b.dataset.k, (s) => fmtDay(s.day)); };
};

// ── Negocios ────────────────────────────────────────────────────────────────
const params = () => Object.fromEntries(new URLSearchParams((location.hash.split('?')[1] || '')));
const st = { mensajes: { limit: 50, offset: 0 }, sugerencias: { limit: 50, offset: 0 }, negocios: { limit: 50, offset: 0 }, publicaciones: { limit: 50, offset: 0 }, canjes: { limit: 50, offset: 0 }, usuarios: { limit: 50, offset: 0 }, resenas: { limit: 50, offset: 0 }, posts: { limit: 50, offset: 0 }, denuncias: { limit: 50, offset: 0 }, actividad: { limit: 100, offset: 0 }, pagos: { limit: 100, offset: 0 }, subs: { limit: 100, offset: 0 }, errores: { limit: 50, offset: 0 } };

PAGES.negocios = async (v, id) => {
  if (id) return businessDetail(v, id);
  const p = params(); const s = st.negocios;
  s.status = p.status || s.status || 'all';
  v.innerHTML = `
    <div class="page-head"><h1>Negocios</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p>Here you see every registered business. <b>Pending</b> ones are new sign-ups you need to review: check that the business exists (website, phone, Google Maps) and press <b>Verify</b>; if it doesn't qualify, <b>Reject</b> it with a reason (the business gets it as a notification). Click a row to see the full business page, change the plan or record a payment.</p>` : '<p>Aquí ves todos los negocios dados de alta. Los <b>pendientes</b> son altas nuevas que tienes que revisar: comprueba que el negocio existe (web, teléfono, Google Maps) y pulsa <b>Verificar</b>; si no procede, <b>Rechazar</b> indicando el motivo (el negocio lo recibe como notificación). Pulsa en una fila para ver la ficha completa, cambiar el plan o registrar un pago.</p>')}
    <div class="toolbar">
      <input id="q" class="grow" placeholder="Buscar por nombre, ciudad, email del dueño, CIF o id…" value="${esc(s.q || '')}">
      <select id="status">${[['all', 'Todos los estados'], ['pending', 'Pendientes'], ['verified', 'Verificados'], ['rejected', 'Rechazados']].map((o) => `<option value="${o[0]}" ${s.status === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="plan">${[['all', 'Todos los planes'], ['free', 'Gratis de lanzamiento'], ['standard', 'Klendar']].map((o) => `<option value="${o[0]}" ${(s.plan || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="active">${[['', 'Activos e inactivos'], ['true', 'Solo activos'], ['false', 'Solo desactivados']].map((o) => `<option value="${o[0]}" ${(s.active ?? '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="sort">${[['created_desc', 'Más recientes'], ['created_asc', 'Más antiguos'], ['name', 'Por nombre'], ['redemptions', 'Más canjes']].map((o) => `<option value="${o[0]}" ${(s.sort || 'created_desc') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  let rows = [];
  const load = async () => {
    const r = await rpc('admin_businesses_page', { p_status: s.status, p_query: s.q || null, p_plan: s.plan || 'all', p_active: s.active === '' || s.active == null ? null : s.active === 'true', p_sort: s.sort || 'created_desc', p_limit: s.limit, p_offset: s.offset });
    rows = r.rows;
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = table({
      cols: [
        { h: 'Negocio', r: (b) => `${img(b.logo_url)}<span class="title">${esc(b.name)}<span class="sub">${esc([b.category, b.city].filter(Boolean).join(' · '))}</span></span>` },
        { h: 'Dueño', r: (b) => `${esc(b.owner_name || '—')}<span class="sub">${esc(b.owner_email || '')}</span>` },
        { h: 'Estado', r: (b) => `${tag(b.verification_status)} ${b.is_active ? '' : tag('inactive', 'st-inactive')} ${b.open_reports ? `<span class="tag bad">${ms('flag')} ${b.open_reports}</span>` : ''}` },
        { h: 'Plan', r: (b) => `${tag(b.plan_slug || 'free', 'dim')} ${b.sub_status ? tag(b.sub_status) : ''}${b.sub_period_end ? `<span class="sub">${I18N.lang === 'en' ? 'until' : 'hasta'} ${fmtDay(b.sub_period_end)}</span>` : ''}` },
        { h: 'Publicaciones', num: true, r: (b) => `${b.active_offers} <span class="muted">/ ${b.offers_count}</span>` },
        { h: 'Canjes', num: true, r: (b) => fmtNum(b.redemptions_count) },
        { h: 'Alta', r: (b) => `<span class="nowrap">${fmtDay(b.created_at)}</span>` },
      ], rows, onRow: true, empty: 'No hay negocios con esos filtros.',
    }) + pg.html;
    pg.bind($('#list'));
    $$('#list tr.row').forEach((tr) => { tr.onclick = () => go(`#/negocios/${rows[tr.dataset.i].id}`); });
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['status', 'plan', 'active', 'sort'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  $('#csv').onclick = () => downloadCsv('negocios', rows, [['id', 'id'], ['name', 'nombre'], ['category', 'categoría'], ['city', 'ciudad'], ['address', 'dirección'], ['owner_email', 'email dueño'], ['phone', 'teléfono'], ['website', 'web'], ['verification_status', 'verificación'], [(b) => b.is_active ? 'sí' : 'no', 'activo'], [(b) => b.plan_slug || 'free', 'plan'], ['sub_status', 'suscripción'], ['sub_period_end', 'fin periodo'], ['offers_count', 'publicaciones'], ['redemptions_count', 'canjes'], ['created_at', 'alta']]);
  await load();
};

async function businessDetail(v, id) {
  const d = await rpc('admin_business_detail', { p_id: id });
  const b = d.business;
  if (!b) throw new Error('Negocio no encontrado.');
  const tz = KZ.de(b);
  const cur = d.subscriptions.find((s) => ['trial', 'active', 'past_due'].includes(s.status));
  const social = b.social_links && typeof b.social_links === 'object' ? Object.entries(b.social_links).filter(([, u]) => u) : [];
  const hours = b.opening_hours && typeof b.opening_hours === 'object' ? Object.entries(b.opening_hours) : [];
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/negocios">← Negocios</a></div>
    <div class="detail-head">
      ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="">` : `<div class="ph">${ms('storefront')}</div>`}
      <div><h1>${esc(b.name)}</h1><div class="tags">${tag(b.verification_status)} ${b.is_active ? tag('active') : tag('inactive', 'st-inactive')} ${tag(cur?.plan || 'free', 'dim')} ${cur ? tag(cur.status) : ''} ${b.adults_only ? '<span class="tag bad">+18</span>' : ''}</div></div>
      <span class="spacer"></span>
      <div class="actions">
        ${b.verification_status !== 'verified' ? '<button class="btn ok" data-a="verify">✓ Verificar</button>' : ''}
        ${b.verification_status !== 'rejected' ? '<button class="btn bad" data-a="reject">Rechazar…</button>' : ''}
        <button class="btn" data-a="active">${b.is_active ? 'Desactivar' : 'Activar'}</button>
        <button class="btn" data-a="edit">Editar ficha…</button>
        <button class="btn" data-a="plan">Cambiar plan…</button>
        <button class="btn" data-a="pay">Registrar pago…</button>
        <button class="btn" data-a="notify">Enviar notificación al dueño…</button>
        ${appLink('/b/' + b.id)}
      </div>
    </div>
    ${b.rejection_reason ? `<div class="card"><b>Motivo del rechazo:</b> ${esc(b.rejection_reason)}${b.rejection_reason_en ? `<div class="muted small" style="margin-top:4px"><b>${I18N.lang === 'en' ? 'In English' : 'En inglés'}:</b> ${esc(b.rejection_reason_en)}</div>` : ''}</div>` : ''}
    <div class="grid2">
      <div class="card"><h2>Ficha</h2><dl class="kv">
        <dt>Categoría</dt><dd>${esc(b.category || '—')}</dd>
        <dt>Dirección</dt><dd>${esc([b.address, b.city].filter(Boolean).join(', ') || '—')} ${b.lat ? `· <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${b.lat},${b.lng}">mapa ↗</a>` : ''}</dd>
        <dt>Teléfono</dt><dd>${b.phone ? `<a class="link" href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : '—'}</dd>
        <dt>Email de contacto</dt><dd>${b.contact_email ? `<a class="link" href="mailto:${esc(b.contact_email)}">${esc(b.contact_email)}</a>` : '—'}</dd>
        <dt>Web</dt><dd>${b.website ? enlaceExterno(b.website) : '—'}</dd>
        <dt>Redes</dt><dd>${social.length ? social.map(([k, u]) => (urlSegura(u) ? enlaceExterno(u, k) : `${esc(k)}: ${esc(u)}`)).join(' · ') : '—'}</dd>
        <dt>CIF / NIF</dt><dd>${esc(b.tax_id || '—')}</dd>
        <dt>Dueño</dt><dd>${esc(b.owner_name || '—')} · <a class="link" href="#/usuarios/${b.owner_id}">${esc(b.owner_email || '')}</a></dd>
        <dt>Valoración</dt><dd>${b.rating_count ? `★ ${Number(b.rating_avg).toFixed(1)} (${b.rating_count})` : 'sin reseñas'}</dd>
        <dt>Alta</dt><dd>${fmtDate(b.created_at, tz)} ${b.verified_at ? `· ${I18N.lang === 'en' ? 'verified' : 'verificado'} ${fmtDate(b.verified_at, tz)}` : ''}</dd>
        <dt>Zona horaria</dt><dd>${zonaTxt(tz)}</dd>
        <dt>Horario</dt><dd>${hours.length ? hours.map(([k, val]) => `${esc(k)}: ${esc(Array.isArray(val) ? val.map((x) => Array.isArray(x) ? x.join('–') : JSON.stringify(x)).join(', ') : JSON.stringify(val))}`).join('<br>') : '—'}</dd>
        <dt>Descripción</dt><dd>${esc(b.description || '—')}</dd>
        <dt>Id</dt><dd><code>${b.id}</code></dd>
      </dl>
      ${(b.gallery || []).length ? `<h3 style="margin-top:12px">Galería</h3><div class="gallery">${b.gallery.filter(urlSegura).map((u) => `<a href="${esc(urlSegura(u))}" target="_blank" rel="noopener noreferrer"><img src="${esc(urlSegura(u))}" alt=""></a>`).join('')}</div>` : ''}
      </div>
      <div>
        <div class="card"><h2>Actividad</h2><div class="kpis">
          <div class="kpi"><b>${fmtNum(d.stats.views_30d)}</b><span>vistas (30 d)</span></div>
          <div class="kpi"><b>${fmtNum(d.stats.redemptions_30d)}</b><span>canjes (30 d)</span></div>
          <div class="kpi"><b>${fmtNum(d.stats.favorites)}</b><span>favoritos</span></div>
          <div class="kpi"><b>${d.offers.length}</b><span>publicaciones</span></div>
        </div></div>
        <div class="card"><h2>Equipo</h2>
          ${table({ cols: [
            { h: 'Persona', r: (m) => `${esc(m.display_name || '—')}<span class="sub"><a class="link" href="#/usuarios/${m.user_id}">${esc(m.email || m.user_id)}</a></span>` },
            { h: 'Rol', r: (m) => `<select data-role="${m.user_id}">${['owner', 'manager', 'staff'].map((r) => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${LABELS[r]}</option>`).join('')}</select>` },
            { h: '', r: (m) => m.role === 'owner' ? '' : `<button class="btn sm ghost" data-rm="${m.user_id}">Quitar</button>` },
          ], rows: d.members, empty: 'Sin miembros.' })}
          <div class="actions" style="margin-top:10px"><button class="btn sm" data-a="addmember">Añadir persona…</button></div>
        </div>
        <div class="card"><h2>Suscripción</h2>
          ${cur ? `<dl class="kv"><dt>Plan</dt><dd>${tag(cur.plan, 'dim')} ${tag(cur.status)} · ${fmtMoney(cur.price_cents)}/${I18N.lang === 'en' ? 'month' : 'mes'}</dd><dt>Periodo</dt><dd>${fmtDay(cur.period_start)} → ${cur.period_end ? fmtDay(cur.period_end) : (I18N.lang === 'en' ? 'no end' : 'sin fin')}</dd><dt>Forma de pago</dt><dd>${esc(cur.payment_method || '—')}</dd></dl>` : '<p class="muted">Sin suscripción vigente: cuenta como «Gratis de lanzamiento».</p>'}
          ${d.subscriptions.length > 1 ? `<details style="margin-top:8px"><summary class="muted">${I18N.lang === 'en' ? 'History' : 'Histórico'} (${d.subscriptions.length})</summary>${table({ cols: [{ h: 'Plan', r: (s) => tag(s.plan, 'dim') }, { h: 'Estado', r: (s) => tag(s.status) }, { h: 'Periodo', r: (s) => `${fmtDay(s.period_start)} → ${s.period_end ? fmtDay(s.period_end) : '—'}` }, { h: 'Pago', r: (s) => esc(s.payment_method || '') }], rows: d.subscriptions })}</details>` : ''}
          <h3 style="margin-top:12px">Pagos registrados</h3>
          ${table({ cols: [{ h: 'Fecha', r: (p) => fmtDay(p.paid_at) }, { h: 'Importe', num: true, r: (p) => fmtMoney(p.amount_cents, p.currency) }, { h: 'Método', r: (p) => esc(p.method) }, { h: 'Periodo', r: (p) => `${fmtDay(p.period_start)} → ${fmtDay(p.period_end)}` }, { h: 'Notas', r: (p) => `${esc(p.notes || '')}<span class="sub">${esc(p.recorded_by || '')}</span>` }], rows: d.payments, empty: 'Ningún pago registrado.' })}
        </div>
      </div>
    </div>
    <div class="card"><h2>${I18N.lang === 'en' ? 'Publications' : 'Publicaciones'} (${d.offers.length})</h2>
      ${table({ cols: [
        { h: 'Publicación', r: (o) => `${KIND_ICON[o.kind]} <span class="title">${esc(o.title)}</span>` },
        { h: 'Estado', r: (o) => `${tag(o.status)} ${modTag(o.moderation_status)} ${o.is_boosted ? '<span class="tag">boost</span>' : ''}` },
        { h: 'Cuándo', r: (o) => `<span class="nowrap">${fmtDate(o.kind === 'flash_offer' ? o.redeem_end_at : o.event_at, tz)}</span>` },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views_count) }, { h: 'Canjes', num: true, r: (o) => `${o.redemptions_count}${o.max_redemptions ? ` / ${o.max_redemptions}` : ''}` },
        { h: 'Creada', r: (o) => fmtDay(o.created_at, tz) },
      ], rows: d.offers, onRow: true, empty: 'Este negocio no ha publicado nada.' })}
    </div>
    <div class="grid2">
      <div class="card"><h2>${I18N.lang === 'en' ? 'Reviews' : 'Reseñas'} (${d.reviews.length})</h2>${d.reviews.length ? d.reviews.map((r) => `<div class="item" style="grid-template-columns:1fr"><div><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span> <span class="muted small">${esc(r.user_email || '')} · ${ago(r.created_at)}</span><p>${esc(r.comment || '')}</p><div class="actions"><button class="btn sm bad" data-delreview="${r.id}">Borrar…</button></div></div></div>`).join('') : '<p class="muted">Sin reseñas.</p>'}</div>
      <div class="card"><h2>${I18N.lang === 'en' ? 'News' : 'Novedades'} (${d.posts.length})</h2>${d.posts.length ? d.posts.map((p) => `<div class="item">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : `<div class="ph">${ms('article')}</div>`}<div><span class="muted small">${ago(p.created_at)}</span><p>${esc(p.body || '')}</p><div class="actions"><button class="btn sm bad" data-delpost="${p.id}">Borrar…</button></div></div></div>`).join('') : '<p class="muted">Sin novedades.</p>'}</div>
    </div>
    <div class="grid2">
      <div class="card"><h2>${I18N.lang === 'en' ? 'Related reports' : 'Denuncias relacionadas'} (${d.reports.length})</h2>${d.reports.length ? table({ cols: [{ h: 'Sobre', r: (r) => tag(r.target_type, 'dim') }, { h: 'Motivo', r: (r) => `${esc(r.reason)}<span class="sub">${esc(r.details || '')}</span>` }, { h: 'Estado', r: (r) => tag(r.status) }, { h: 'Fecha', r: (r) => fmtDay(r.created_at) }], rows: d.reports }) : '<p class="muted">Ninguna.</p>'}<p style="margin:10px 0 0"><a class="link" href="#/denuncias">Ir a denuncias →</a></p></div>
      <div class="card"><h2>Registro de cambios</h2>${auditList(d.audit)}</div>
    </div>`;
  $$('#view tr.row').forEach((tr) => { tr.onclick = () => go(`#/publicaciones/${d.offers[tr.dataset.i].id}`); });
  // Cada acción bloquea su botón (o su desplegable) mientras trabaja: un
  // doble clic no la manda dos veces.
  $$('[data-role]').forEach((sel) => { let antes = sel.value; sel.onchange = () => esperando(sel, async () => { try { await rpc('admin_set_member_role', { p_business: id, p_user: sel.dataset.role, p_role: sel.value }); antes = sel.value; toast('Rol actualizado'); } catch (e) { sel.value = antes; toast(e.message, true); } }); });
  $$('[data-rm]').forEach((btn) => { btn.onclick = () => esperando(btn, async () => { if (!await confirmDlg('Quitar del equipo', 'Esta persona dejará de poder gestionar el negocio ni validar códigos.', { danger: true, submit: 'Quitar' })) return; try { await rpc('admin_set_member_role', { p_business: id, p_user: btn.dataset.rm, p_role: null }); toast('Quitado'); route(); } catch (e) { toast(e.message, true); } }); });
  $$('[data-delreview]').forEach((btn) => { btn.onclick = () => esperando(btn, () => deleteReview(btn.dataset.delreview)); });
  $$('[data-delpost]').forEach((btn) => { btn.onclick = () => esperando(btn, () => deletePost(btn.dataset.delpost)); });
  $$('[data-a]').forEach((btn) => { btn.onclick = () => esperando(btn, () => businessAction(btn.dataset.a, b, d)); });
}

async function businessAction(a, b, d) {
  try {
    if (a === 'verify') {
      if (!await confirmDlg('Verificar negocio', I18N.lang === 'en' ? `“${esc(b.name)}” will become verified and active: its publications will appear in the app and the owner will get a notification.` : `«${esc(b.name)}» pasará a verificado y activo: sus publicaciones aparecerán en la app y el propietario recibirá una notificación.`, { submit: 'Verificar' })) return;
      await rpc('admin_set_verification', { p_id: b.id, p_status: 'verified' }); toast('Negocio verificado');
    }
    if (a === 'reject') {
      const r = await modal({ title: 'Rechazar negocio', intro: 'El propietario recibirá el motivo como notificación en la app. Sé concreto: «no encontramos el local en la dirección indicada», «faltan datos fiscales»…', fields: [
        { name: 'reason', label: 'Motivo', type: 'textarea', required: true },
        { name: 'reason_en', label: 'En inglés (opcional)', type: 'textarea', help: 'Lo recibe quien tiene la app en inglés. Si lo dejas vacío, le llega el español.' },
      ], submit: 'Rechazar', danger: true });
      if (!r) return;
      await rpc('admin_set_verification', { p_id: b.id, p_status: 'rejected', p_reason: r.reason, p_reason_en: r.reason_en || null }); toast('Negocio rechazado');
    }
    if (a === 'active') {
      if (b.is_active && !await confirmDlg('Desactivar negocio', 'El negocio y sus publicaciones dejarán de verse en la app hasta que lo actives de nuevo.', { danger: true, submit: 'Desactivar' })) return;
      await rpc('admin_set_business_active', { p_id: b.id, p_active: !b.is_active }); toast(b.is_active ? 'Negocio desactivado' : 'Negocio activado');
    }
    if (a === 'edit') {
      const cats = await rpc('admin_categories');
      const r = await modal({ title: 'Editar ficha', fields: [
        { name: 'name', label: 'Nombre', value: b.name, required: true },
        { name: 'category_id', label: 'Categoría', type: 'select', value: b.category_id || '', options: [['', '—'], ...cats.map((c) => [c.id, (c.names?.[I18N.lang] || c.names?.es || c.slug)])] },
        { name: 'description', label: 'Descripción', type: 'textarea', value: b.description },
        { name: 'address', label: 'Dirección', value: b.address }, { name: 'city', label: 'Ciudad', value: b.city },
        { name: 'phone', label: 'Teléfono', value: b.phone }, { name: 'contact_email', label: 'Email de contacto', type: 'email', value: b.contact_email },
        { name: 'website', label: 'Web', type: 'url', value: b.website }, { name: 'tax_id', label: 'CIF / NIF', value: b.tax_id },
        { name: 'lat', label: 'Latitud', value: b.lat ?? '', help: 'Solo si hay que corregir la posición en el mapa.' }, { name: 'lng', label: 'Longitud', value: b.lng ?? '' },
        { name: 'adults_only', label: 'Solo para mayores de 18', type: 'checkbox', value: b.adults_only },
      ] });
      if (!r) return;
      const patch = { ...r };
      if (!patch.lat || !patch.lng) { delete patch.lat; delete patch.lng; }
      await rpc('admin_update_business', { p_id: b.id, p_patch: patch }); toast('Ficha actualizada');
    }
    if (a === 'plan') {
      const plans = await rpc('admin_plans');
      const cur = d.subscriptions.find((s) => ['trial', 'active', 'past_due'].includes(s.status));
      const r = await modal({ title: 'Cambiar plan', intro: 'Se cierra la suscripción vigente y se abre una nueva desde hoy (queda el histórico).', fields: [
        // Los planes retirados (`is_offered` = false, p. ej. «Fundador») solo salen a quien ya lo tiene.
        { name: 'plan', label: 'Plan', type: 'select', value: cur?.plan || 'standard', options: plans.filter((p) => p.is_offered !== false || p.slug === cur?.plan).map((p) => [p.slug, `${p.names?.es || p.slug} · ${fmtMoney(p.price_cents)}/${I18N.lang === 'en' ? 'month' : 'mes'}`]) },
        { name: 'status', label: 'Estado', type: 'select', value: 'active', options: [['active', 'Activa (pagada)'], ['trial', 'Prueba gratuita'], ['past_due', 'Impagada'], ['cancelled', 'Cancelada']] },
        { name: 'period_end', label: 'Fin del periodo', type: 'date', value: cur?.period_end || '', help: 'Vacío = sin fecha de fin.' },
        { name: 'method', label: 'Forma de pago', type: 'select', value: 'transfer', options: [['transfer', 'Transferencia'], ['cash', 'Efectivo'], ['card', 'Tarjeta'], ['none', 'Ninguna']] },
      ] });
      if (!r) return;
      await rpc('admin_set_subscription', { p_business: b.id, p_plan_slug: r.plan, p_status: r.status, p_period_end: r.period_end || null, p_payment_method: r.method }); toast('Plan actualizado');
    }
    if (a === 'pay') {
      // Hoy y dentro de un mes, en días de Madrid (no en UTC).
      const today = diaMadridISO(); const [ay, am, ad] = today.split('-').map(Number);
      const next = new Date(Date.UTC(ay, am, Math.min(ad, new Date(Date.UTC(ay, am + 1, 0)).getUTCDate())));
      const r = await modal({ title: 'Registrar pago', intro: 'Anota un cobro recibido (transferencia, efectivo…). La suscripción pasa a activa y su fin se amplía hasta el fin del periodo pagado.', fields: [
        { name: 'amount', label: 'Importe (€)', type: 'number', step: '0.01', required: true, placeholder: '19,90' },
        { name: 'method', label: 'Forma de pago', type: 'select', value: 'transfer', options: [['transfer', 'Transferencia'], ['cash', 'Efectivo'], ['card', 'Tarjeta']] },
        { name: 'start', label: 'Inicio del periodo pagado', type: 'date', value: today, required: true }, { name: 'end', label: 'Fin del periodo pagado', type: 'date', value: next.toISOString().slice(0, 10), required: true },
        { name: 'notes', label: 'Notas (nº de factura, referencia…)' },
      ] });
      if (!r) return;
      await rpc('admin_record_payment', { p_business: b.id, p_amount_cents: Math.round(parseFloat(r.amount.replace(',', '.')) * 100), p_method: r.method, p_period_start: r.start, p_period_end: r.end, p_notes: r.notes || null }); toast('Pago registrado');
    }
    if (a === 'notify') {
      const r = await modal({ title: 'Notificación al equipo del negocio', intro: 'Lo reciben el propietario y los encargados como notificación (y push si la tienen activada).', fields: CAMPOS_AVISO, submit: 'Enviar' });
      if (!r) return;
      const ids = d.members.filter((m) => ['owner', 'manager'].includes(m.role)).map((m) => m.user_id);
      const n = await rpc('admin_send_notification', { p_audience: 'ids', p_user_ids: ids, ...textosAviso(r), p_route: '/my-business/' + b.id }); toast(I18N.lang === 'en' ? `Notification sent to ${n} ${n === 1 ? 'person' : 'people'}` : `Notificación enviada a ${n} ${n === 1 ? 'persona' : 'personas'}`);
    }
    if (a === 'addmember') {
      const r = await modal({ title: 'Añadir persona al equipo', intro: 'Escribe el email exacto con el que se registró.', fields: [{ name: 'email', label: 'Email del usuario', type: 'email', required: true }, { name: 'role', label: 'Rol', type: 'select', value: 'staff', options: [['staff', 'Empleado (valida códigos)'], ['manager', 'Encargado (gestiona publicaciones)'], ['owner', 'Propietario']] }], submit: 'Añadir' });
      if (!r) return;
      const u = await rpc('admin_users', { p_query: r.email, p_limit: 50 });
      const found = u.rows.find((x) => (x.email || '').toLowerCase() === r.email.trim().toLowerCase());
      if (!found) throw new Error('No existe ningún usuario con ese email.');
      await rpc('admin_set_member_role', { p_business: b.id, p_user: found.id, p_role: r.role }); toast('Añadido al equipo');
    }
    route();
  } catch (e) { toast(e.message, true); }
}

function auditList(list) {
  if (!list || !list.length) return '<p class="muted">Sin cambios registrados.</p>';
  return `<ul style="margin:0;padding-left:18px;font-size:14px">${list.map((l) => `<li><b>${esc(ACTIONS[l.action] || l.action)}</b> <span class="muted">· ${esc(l.admin_email || '')} · ${fmtDate(l.created_at)}</span>${l.details && Object.keys(l.details).length ? `<div class="muted small">${esc(summarize(l.details))}</div>` : ''}</li>`).join('')}</ul>`;
}
const ACTIONS = {
  'business.verification': 'Verificación de negocio', 'business.activate': 'Negocio activado', 'business.deactivate': 'Negocio desactivado', 'business.update': 'Ficha editada', 'business.member': 'Equipo modificado',
  'business.subscription': 'Cambio de plan', 'business.payment': 'Pago registrado', 'offer.moderation': 'Moderación de publicación', 'offer.status': 'Estado de publicación', 'offer.boost': 'Boost de publicación',
  'report.resolve': 'Denuncia resuelta', 'report.group': 'Denuncias resueltas en bloque', 'review.delete': 'Reseña borrada', 'post.delete': 'Novedad borrada', 'user.ban': 'Usuario suspendido', 'user.unban': 'Usuario reactivado', 'user.premium': 'Premium cambiado',
  'user.type': 'Tipo de cuenta cambiado', 'user.birth_date': 'Fecha de nacimiento corregida', 'user.delete': 'Cuenta eliminada', 'notification.send': 'Notificación enviada', 'push.retry': 'Push reintentado', 'config.set': 'Configuración cambiada', 'plan.upsert': 'Plan guardado',
  'category.upsert': 'Categoría guardada', 'category.delete': 'Categoría borrada', 'admin.add': 'Administrador añadido', 'admin.remove': 'Administrador quitado', 'maintenance.expire_offers': 'Caducidad forzada',
  'business_message_approve': 'Mensaje a clientes aprobado', 'business_message_reject': 'Mensaje a clientes rechazado', 'collection_save': 'Colección guardada', 'collection_delete': 'Colección borrada',
  'feedback.update': 'Sugerencia actualizada', 'feedback.delete': 'Sugerencia borrada',
  'web_error.resolve': 'Error de la web resuelto',
};
const summarize = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ').slice(0, 300);

// ── Publicaciones ───────────────────────────────────────────────────────────
PAGES.publicaciones = async (v, id) => {
  if (id) return offerDetail(v, id);
  const p = params(); const s = st.publicaciones;
  s.moderation = p.moderation || s.moderation || 'all';
  if (p.business) s.business = p.business;
  v.innerHTML = `
    <div class="page-head"><h1>Publicaciones</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p>Flash offers and events from every business. The ones <b>pending moderation</b> come from businesses that haven't been verified yet or have been flagged for review: if they meet the <a class="link" href="/en/community-guidelines/" target="_blank">Community guidelines</a> (nothing misleading, their own photos, no alcohol aimed at minors…) press <b>Approve</b>; if not, <b>Take down</b> with a reason, which the business receives along with how to appeal (required by the DSA). The system automatically puts under review the ones that mention <b>alcohol</b> (and also marks them 18+: only adults see them), <b>tobacco/vaping</b> (advertising is banned: take it down), <b>gambling</b> or <b>offensive language</b> (insults, swear words, explicit sexual content, hate or threats); you'll see a tag with the reason.</p>` : '<p>Ofertas flash y eventos de todos los negocios. Las <b>pendientes de moderar</b> son de negocios que aún no han sido verificados o que han sido marcadas para revisión: si cumplen las <a class="link" href="/normas/" target="_blank">Normas de la comunidad</a> (sin contenido engañoso, fotos propias, sin alcohol a menores…) pulsa <b>Aprobar</b>; si no, <b>Retirar</b> con un motivo, que el negocio recibe junto con la vía de recurso (obligatorio por el DSA). El sistema pone en revisión automáticamente las que mencionan <b>alcohol</b> (además las marca +18: solo las ven mayores), <b>tabaco/vapeo</b> (publicidad prohibida: retirar), <b>apuestas</b> o <b>lenguaje ofensivo</b> (insultos, palabras malsonantes, contenido sexual explícito, odio o amenazas); verás la etiqueta del motivo.</p>')}
    <div class="toolbar">
      <input id="q" class="grow" placeholder="Buscar por título, negocio o id…" value="${esc(s.q || '')}">
      <select id="moderation">${[['all', 'Toda moderación'], ['pending', 'Por moderar'], ['approved', 'Aprobadas'], ['rejected', 'Retiradas']].map((o) => `<option value="${o[0]}" ${s.moderation === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="status">${[['all', 'Todos los estados'], ['active', 'Activas'], ['draft', 'Borradores'], ['expired', 'Caducadas'], ['sold_out', 'Agotadas'], ['cancelled', 'Canceladas']].map((o) => `<option value="${o[0]}" ${(s.status || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="kind">${[['all', 'Ofertas y eventos'], ['flash_offer', 'Solo ofertas flash'], ['future_event', 'Solo eventos']].map((o) => `<option value="${o[0]}" ${(s.kind || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      ${s.business ? `<button class="btn sm" id="clearbiz">✕ Solo un negocio</button>` : ''}
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  let rows = [];
  const load = async () => {
    const r = await rpc('admin_offers_page', { p_moderation: s.moderation, p_status: s.status || 'all', p_kind: s.kind || 'all', p_query: s.q || null, p_business: s.business || null, p_limit: s.limit, p_offset: s.offset });
    rows = r.rows;
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = table({
      cols: [
        { h: 'Publicación', r: (o) => `${img(o.images?.[0], KIND_ICON[o.kind])}<span class="title">${esc(o.title)}<span class="sub">${esc(I18N.t(LABELS[o.kind]))} · <a class="link" href="#/negocios/${o.business_id}" data-sin-fila>${esc(o.business_name)}</a> ${o.verification_status !== 'verified' ? tag(o.verification_status) : ''}</span></span>` },
        { h: 'Estado', r: (o) => `${tag(o.status)} ${modTag(o.moderation_status)} ${flagTags(o)} ${o.adults_only ? '<span class="tag bad">+18</span>' : ''} ${o.is_boosted ? '<span class="tag">boost</span>' : ''} ${o.open_reports ? `<span class="tag bad">${ms('flag')} ${o.open_reports}</span>` : ''}` },
        { h: 'Cuándo', r: (o) => `<span class="nowrap">${o.kind === 'flash_offer' ? `${fmtDate(o.redeem_start_at, KZ.de(o))}<span class="sub">→ ${fmtDate(o.redeem_end_at, KZ.de(o))}</span>` : fmtDate(o.event_at, KZ.de(o))}</span>` },
        { h: 'Precio', r: (o) => `${o.discount ? `<span class="tag">${esc(discountLabel(o.discount))}</span> ` : ''}${o.price_cents != null ? fmtMoney(o.price_cents, o.currency) : ''}` },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views_count) },
        { h: 'Canjes', num: true, r: (o) => `${o.redemptions_count}${o.max_redemptions ? `<span class="muted"> / ${o.max_redemptions}</span>` : ''}` },
        { h: '', r: (o) => `<span class="actions">${o.moderation_status !== 'approved' ? `<button class="btn sm ok" data-mod="${o.id}" data-val="approved">Aprobar</button>` : ''}${o.moderation_status !== 'rejected' ? `<button class="btn sm bad" data-mod="${o.id}" data-val="rejected">Retirar</button>` : ''}</span>` },
      ], rows, onRow: true, empty: 'No hay publicaciones con esos filtros.',
    }) + pg.html;
    pg.bind($('#list'));
    $$('#list tr.row').forEach((tr) => { tr.onclick = (e) => { if (e.target.closest('button,a')) return; go(`#/publicaciones/${rows[tr.dataset.i].id}`); }; });
    $$('#list [data-mod]').forEach((btn) => { btn.onclick = () => esperando(btn, async () => { if (await moderateOffer(btn.dataset.mod, btn.dataset.val)) await load(); }); });
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['moderation', 'status', 'kind'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  if ($('#clearbiz')) $('#clearbiz').onclick = () => { s.business = null; go('#/publicaciones'); };
  $('#csv').onclick = () => downloadCsv('publicaciones', rows, [['id', 'id'], ['kind', 'tipo'], ['title', 'título'], ['business_name', 'negocio'], ['status', 'estado'], ['moderation_status', 'moderación'], ['redeem_start_at', 'inicio canje'], ['redeem_end_at', 'fin canje'], ['event_at', 'evento'], ['price_cents', 'precio (cts)'], ['views_count', 'vistas'], ['redemptions_count', 'canjes'], ['max_redemptions', 'máx'], ['created_at', 'creada']]);
  await load();
};
const discountLabel = (d) => {
  if (!d) return '';
  if (d.type === 'percent') return `−${d.value} %`;
  if (d.type === 'fixed') return `${Number(d.value).toFixed(2).replace('.', ',')} €`;
  if (d.type === '2x1') return d.alcohol ? '2x1 (con alcohol)' : '2x1';
  if (d.type === 'free') return 'Gratis';
  if (d.type === 'other') return String(d.value || '');
  return d.label || '';
};

async function moderateOffer(id, val) {
  try {
    if (val === 'rejected') {
      const r = await modal({ title: 'Retirar publicación', intro: 'Deja de verse en la app. El negocio recibe el motivo y puede recurrir en 15 días (Reglamento de Servicios Digitales).', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true, placeholder: 'Ej.: la foto no es del local; la oferta es engañosa; publicidad de alcohol dirigida a menores…' }], submit: 'Retirar', danger: true });
      if (!r) return false;
      await rpc('admin_set_offer_moderation', { p_id: id, p_status: 'rejected', p_reason: r.reason }); toast('Publicación retirada');
    } else {
      await rpc('admin_set_offer_moderation', { p_id: id, p_status: val }); toast(val === 'approved' ? 'Publicación aprobada' : 'Marcada como pendiente');
    }
    refreshBadges();
    return true;
  } catch (e) { toast(e.message, true); return false; }
}

async function offerDetail(v, id) {
  const d = await rpc('admin_offer_detail', { p_id: id });
  const o = d.offer;
  if (!o) throw new Error('Publicación no encontrada.');
  // Sus horas, en la zona de su negocio (la posición es la del local).
  const tz = KZ.de(o);
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/publicaciones">← Publicaciones</a></div>
    <div class="detail-head">
      ${o.images?.[0] ? `<img src="${esc(o.images[0])}" alt="">` : `<div class="ph">${KIND_ICON[o.kind]}</div>`}
      <div><h1>${esc(o.title)}</h1><div class="tags">${tag(o.kind, 'dim')} ${tag(o.status)} ${modTag(o.moderation_status)} ${flagTags(o)} ${o.adults_only ? '<span class="tag bad">+18</span>' : ''} ${o.is_boosted ? `<span class="tag">boost ${I18N.lang === 'en' ? 'until' : 'hasta'} ${fmtDate(o.boosted_until)}</span>` : ''}</div>
        <div class="muted small" style="margin-top:4px"><a class="link" href="#/negocios/${o.business_id}">${esc(o.business_name)}</a> ${o.verification_status !== 'verified' ? tag(o.verification_status) : ''} · ${esc(o.city || '')}</div></div>
      <span class="spacer"></span>
      <div class="actions">
        ${o.moderation_status !== 'approved' ? '<button class="btn ok" data-a="approve">✓ Aprobar</button>' : ''}
        ${o.moderation_status !== 'rejected' ? '<button class="btn bad" data-a="reject">Retirar…</button>' : ''}
        <button class="btn" data-a="status">Cambiar estado…</button>
        <button class="btn" data-a="boost">${o.is_boosted ? 'Quitar boost' : 'Destacar (boost)…'}</button>
        ${appLink('/o/' + o.id)}
      </div>
    </div>
    <div class="grid2">
      <div class="card"><h2>Detalles</h2><dl class="kv">
        <dt>Descripción</dt><dd>${esc(o.description || '—')}</dd>
        <dt>Condiciones</dt><dd>${esc(o.terms || '—')}</dd>
        ${o.kind === 'flash_offer' ? `<dt>Canje</dt><dd>${fmtDate(o.redeem_start_at, tz)} → ${fmtDate(o.redeem_end_at, tz)}</dd>` : `<dt>Evento</dt><dd>${fmtDate(o.event_at, tz)}${o.event_end_at ? ` → ${fmtDate(o.event_end_at, tz)}` : ''}</dd>`}
        <dt>Zona horaria</dt><dd>${zonaTxt(tz)}</dd>
        <dt>Descuento / precio</dt><dd>${o.discount ? esc(discountLabel(o.discount)) : '—'} ${o.price_cents != null ? `· ${fmtMoney(o.price_cents, o.currency)}` : ''}</dd>
        <dt>Aforo</dt><dd>${I18N.lang === 'en' ? `${o.max_redemptions ? `${o.redemptions_count} of ${o.max_redemptions}` : `${o.redemptions_count} (no limit)`} ${o.max_per_user ? `· max. ${o.max_per_user} per person` : ''}` : `${o.max_redemptions ? `${o.redemptions_count} de ${o.max_redemptions}` : `${o.redemptions_count} (sin límite)`} ${o.max_per_user ? `· máx. ${o.max_per_user} por persona` : ''}`}</dd>
        <dt>Enlace externo</dt><dd>${o.external_url ? enlaceExterno(o.external_url) : '—'}</dd>
        <dt>Diseño</dt><dd>${o.style && Object.keys(o.style).length ? esc(JSON.stringify(o.style)) : 'por defecto'}</dd>
        <dt>Guardada por</dt><dd>${fmtNum(d.saved)} ${I18N.lang === 'en' ? (d.saved === 1 ? 'person' : 'people') : (d.saved === 1 ? 'persona' : 'personas')}</dd>
        <dt>Posición</dt><dd>${o.lat ? `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${o.lat},${o.lng}">${o.lat.toFixed(5)}, ${o.lng.toFixed(5)} ↗</a>` : 'la del negocio'}</dd>
        <dt>Creada / editada</dt><dd>${fmtDate(o.created_at, tz)} · ${fmtDate(o.updated_at, tz)}</dd>
        <dt>Id</dt><dd><code>${o.id}</code></dd>
      </dl>
      ${(o.images || []).length ? `<h3 style="margin-top:12px">Fotos</h3><div class="gallery">${o.images.filter(urlSegura).map((u) => `<a href="${esc(urlSegura(u))}" target="_blank" rel="noopener noreferrer"><img src="${esc(urlSegura(u))}" alt=""></a>`).join('')}</div>` : ''}
      </div>
      <div>
        <div class="card"><h2>Últimos 14 días</h2><div class="kpis"><div class="kpi"><b>${fmtNum(o.views_count)}</b><span>vistas totales</span></div><div class="kpi"><b>${fmtNum(o.redemptions_count)}</b><span>canjes totales</span></div><div class="kpi"><b>${o.views_count ? Math.round(o.redemptions_count / o.views_count * 100) : 0} %</b><span>conversión</span></div></div>
          <p class="muted small" style="margin:10px 0 0">Vistas</p>${bars(d.series, 'views', (s) => fmtDay(s.day))}<p class="muted small" style="margin:10px 0 0">Canjes</p>${bars(d.series, 'redemptions', (s) => fmtDay(s.day))}</div>
        <div class="card"><h2>${I18N.lang === 'en' ? 'Reports' : 'Denuncias'} (${d.reports.length})</h2>${d.reports.length ? d.reports.map((r) => `<div class="item" style="grid-template-columns:1fr"><div><b>${esc(r.reason)}</b> ${tag(r.status)} <span class="muted small">${ago(r.created_at)}</span><p>${esc(r.details || '')}</p></div></div>`).join('') + '<a class="link" href="#/denuncias">Gestionar en denuncias →</a>' : '<p class="muted">Ninguna.</p>'}</div>
        <div class="card"><h2>Registro de cambios</h2>${auditList(d.audit)}</div>
      </div>
    </div>
    <div class="card"><h2>${I18N.lang === 'en' ? `Last ${d.redemptions.length} redemptions` : `Canjes (${d.redemptions.length} últimos)`}</h2>
      ${table({ cols: [{ h: 'Usuario', r: (r) => esc(r.user_email || '—') }, { h: 'Código', r: (r) => `<code>${esc(r.code)}</code>` }, { h: 'Estado', r: (r) => tag(r.status) }, { h: 'Generado', r: (r) => fmtDate(r.created_at, tz) }, { h: 'Validado', r: (r) => `${fmtDate(r.validated_at, tz)}<span class="sub">${esc(r.validated_by_email || '')}</span>` }], rows: d.redemptions, empty: 'Nadie ha canjeado todavía.' })}
    </div>`;
  $$('[data-a]').forEach((btn) => { btn.onclick = () => esperando(btn, async () => {
    try {
      const a = btn.dataset.a;
      if (a === 'approve') { if (await moderateOffer(o.id, 'approved')) route(); return; }
      if (a === 'reject') { if (await moderateOffer(o.id, 'rejected')) route(); return; }
      if (a === 'status') {
        const r = await modal({ title: 'Cambiar estado', intro: 'Úsalo con cuidado: «cancelada» y «caducada» la quitan del feed; «activa» la vuelve a publicar (si el negocio está verificado y la moderación es aprobada).', fields: [{ name: 'status', label: 'Estado', type: 'select', value: o.status, options: [['active', 'Activa'], ['draft', 'Borrador'], ['expired', 'Caducada'], ['sold_out', 'Agotada'], ['cancelled', 'Cancelada']] }] });
        if (!r) return; await rpc('admin_set_offer_status', { p_id: o.id, p_status: r.status }); toast('Estado actualizado');
      }
      if (a === 'boost') {
        if (o.is_boosted) { await rpc('admin_set_offer_boost', { p_id: o.id, p_until: null }); toast('Boost retirado'); }
        else {
          const r = await modal({ title: 'Destacar publicación', intro: 'Sale la primera en Descubre y en el mapa hasta la fecha indicada.', fields: [{ name: 'until', label: 'Hasta (hora de Madrid)', type: 'datetime-local', required: true, value: aInputMadrid(new Date(Date.now() + 7 * 86400e3)) }] });
          if (!r) return; await rpc('admin_set_offer_boost', { p_id: o.id, p_until: deInputMadrid(r.until) }); toast('Publicación destacada');
        }
      }
      route();
    } catch (e) { toast(e.message, true); }
  }); });
}

// ── Canjes ─────────────────────────────────────────────────────────────────
PAGES.canjes = async (v) => {
  const s = st.canjes;
  v.innerHTML = `
    <div class="page-head"><h1>Canjes</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p>Every time someone taps “Get the code”, a single-use code is created (<b>pending</b>) that expires when the business decides (5 minutes for a bar offer, the day of the event for a ticket); when the business scans it, it becomes <b>validated</b>; if not, it <b>expires</b>. Use it to handle complaints (“they charged me and didn't apply the discount”) and to spot abuse: search by email, business, title or code.</p>` : '<p>Cada vez que alguien pulsa «Conseguir el código» se genera un código de un solo uso (<b>pendiente</b>), que caduca cuando decide el negocio (5 minutos en una oferta de barra, hasta el día del evento en una entrada); cuando el negocio lo escanea pasa a <b>validado</b>; si no, <b>caduca</b>. Sirve para atender reclamaciones («me cobraron y no aplicaron el descuento») y detectar abusos: busca por email, negocio, título o código.</p>')}
    <div class="toolbar">
      <input id="q" class="grow" placeholder="Buscar por email, negocio, título o código…" value="${esc(s.q || '')}">
      <select id="status">${[['all', 'Todos'], ['validated', 'Validados'], ['pending', 'Pendientes'], ['expired', 'Caducados'], ['cancelled', 'Cancelados']].map((o) => `<option value="${o[0]}" ${(s.status || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <label class="f" style="grid-auto-flow:column;align-items:center">Desde <input type="date" id="from" value="${esc(s.from || '')}"></label>
      <label class="f" style="grid-auto-flow:column;align-items:center">Hasta <input type="date" id="to" value="${esc(s.to || '')}"></label>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  let rows = [];
  const load = async () => {
    const r = await rpc('admin_redemptions', { p_status: s.status || 'all', p_query: s.q || null, p_from: s.from || null, p_to: s.to || null, p_limit: s.limit, p_offset: s.offset });
    rows = r.rows;
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = table({ cols: [
      { h: 'Publicación', r: (x) => `<a class="link" href="#/publicaciones/${x.offer_id}">${esc(x.title)}</a><span class="sub"><a class="link" href="#/negocios/${x.business_id}">${esc(x.business)}</a></span>` },
      { h: 'Usuario', r: (x) => esc(x.user_email || '—') }, { h: 'Código', r: (x) => `<code>${esc(x.code)}</code>` }, { h: 'Estado', r: (x) => tag(x.status) },
      { h: 'Generado', r: (x) => `<span class="nowrap">${fmtDate(x.created_at)}</span>` }, { h: 'Validado', r: (x) => `<span class="nowrap">${fmtDate(x.validated_at)}</span><span class="sub">${esc(x.validated_by_email || '')}</span>` },
    ], rows, empty: 'Sin canjes con esos filtros.' }) + pg.html;
    pg.bind($('#list'));
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['status', 'from', 'to'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  $('#csv').onclick = () => downloadCsv('canjes', rows, [['id', 'id'], ['title', 'publicación'], ['business', 'negocio'], ['user_email', 'usuario'], ['code', 'código'], ['status', 'estado'], ['created_at', 'generado'], ['validated_at', 'validado'], ['validated_by_email', 'validado por']]);
  await load();
};

// ── Usuarios ────────────────────────────────────────────────────────────────
PAGES.usuarios = async (v, id) => {
  if (id) return userDetail(v, id);
  const s = st.usuarios;
  v.innerHTML = `
    <div class="page-head"><h1>Usuarios</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p>Every account in the app. Click one to see its details: consents (GDPR), businesses, redemptions, reviews and reports; from there you can <b>suspend</b> anyone who breaks the rules, give <b>premium</b>, or <b>delete the account</b> if the user asks by email (right to erasure; they can also do it themselves from the app).</p>` : '<p>Todas las cuentas de la app. Pulsa en una para ver su ficha: consentimientos (RGPD), negocios, canjes, reseñas y denuncias; desde allí puedes <b>suspender</b> a quien incumpla las normas, dar <b>premium</b>, o <b>borrar la cuenta</b> si el usuario lo pide por email (derecho de supresión; también puede hacerlo él mismo desde la app).</p>')}
    <div class="toolbar">
      <input id="q" class="grow" placeholder="Buscar por email, nombre o id…" value="${esc(s.q || '')}">
      <select id="type">${[['all', 'Todos los tipos'], ['user', 'Usuarios'], ['business', 'Cuentas de negocio']].map((o) => `<option value="${o[0]}" ${(s.type || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="banned">${[['', 'Todos'], ['true', 'Suspendidos'], ['false', 'No suspendidos']].map((o) => `<option value="${o[0]}" ${(s.banned ?? '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="sort">${[['created_desc', 'Más recientes'], ['created_asc', 'Más antiguos'], ['last_sign_in', 'Último acceso'], ['email', 'Por email']].map((o) => `<option value="${o[0]}" ${(s.sort || 'created_desc') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  let rows = [];
  const load = async () => {
    const r = await rpc('admin_users', { p_query: s.q || null, p_type: s.type || 'all', p_banned: s.banned === '' || s.banned == null ? null : s.banned === 'true', p_sort: s.sort || 'created_desc', p_limit: s.limit, p_offset: s.offset });
    rows = r.rows;
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = table({ cols: [
      { h: 'Usuario', r: (u) => `${img(u.avatar_url, ms('person'))}<span class="title">${esc(u.display_name || '—')}<span class="sub">${esc(u.email)}</span></span>` },
      { h: 'Tipo', r: (u) => `${tag(u.user_type || 'user', 'dim')} ${u.is_admin ? '<span class="tag">admin</span>' : ''} ${u.is_premium ? '<span class="tag ok">premium</span>' : ''} ${u.banned_at ? tag('banned', 'st-banned') : ''} ${!u.email_confirmed_at ? '<span class="tag warn">email sin confirmar</span>' : ''}` },
      { h: 'Negocios', num: true, r: (u) => u.memberships || 0 }, { h: 'Canjes', num: true, r: (u) => u.redemptions || 0 },
      { h: 'Alta', r: (u) => `<span class="nowrap">${fmtDay(u.created_at)}</span>` }, { h: 'Último acceso', r: (u) => `<span class="nowrap">${ago(u.last_sign_in_at)}</span>` },
    ], rows, onRow: true, empty: 'Sin usuarios con esos filtros.' }) + pg.html;
    pg.bind($('#list'));
    $$('#list tr.row').forEach((tr) => { tr.onclick = () => go(`#/usuarios/${rows[tr.dataset.i].id}`); });
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['type', 'banned', 'sort'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  $('#csv').onclick = () => downloadCsv('usuarios', rows, [['id', 'id'], ['email', 'email'], ['display_name', 'nombre'], ['user_type', 'tipo'], ['locale', 'idioma'], [(u) => u.is_premium ? 'sí' : 'no', 'premium'], [(u) => u.banned_at ? 'sí' : 'no', 'suspendido'], [(u) => u.marketing_consent ? 'sí' : 'no', 'consentimiento marketing'], ['memberships', 'negocios'], ['redemptions', 'canjes'], ['created_at', 'alta'], ['last_sign_in_at', 'último acceso']]);
  await load();
};

async function userDetail(v, id) {
  const d = await rpc('admin_user_detail', { p_id: id });
  const u = d.user;
  if (!u) throw new Error('Usuario no encontrado.');
  const prefs = d.notification_prefs;
  const en = I18N.lang === 'en';
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/usuarios">← Usuarios</a></div>
    <div class="detail-head">
      ${u.avatar_url ? `<img src="${esc(u.avatar_url)}" alt="">` : `<div class="ph">${ms('person')}</div>`}
      <div><h1>${esc(u.display_name || u.email)}</h1><div class="tags">${tag(u.user_type || 'user', 'dim')} ${u.is_admin ? '<span class="tag">administrador</span>' : ''} ${u.is_premium ? `<span class="tag ok">premium${u.premium_until ? ` ${en ? 'until' : 'hasta'} ${fmtDay(u.premium_until)}` : ''}</span>` : ''} ${u.banned_at ? `<span class="tag bad">${en ? 'suspended' : 'suspendido'} ${fmtDay(u.banned_at)}</span>` : ''} ${!u.email_confirmed_at ? '<span class="tag warn">email sin confirmar</span>' : ''}</div><div class="muted small" style="margin-top:4px">${esc(u.email)}</div></div>
      <span class="spacer"></span>
      <div class="actions">
        <button class="btn ${u.banned_at ? 'ok' : 'bad'}" data-a="ban">${u.banned_at ? 'Reactivar cuenta' : 'Suspender…'}</button>
        <button class="btn" data-a="premium">Premium…</button>
        <button class="btn" data-a="type">Tipo de cuenta…</button>
        <button class="btn" data-a="birth">Corregir fecha de nacimiento…</button>
        <button class="btn" data-a="notify">Enviar notificación…</button>
        <button class="btn" data-a="admin">${u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
        <button class="btn bad ghost" data-a="delete">Eliminar cuenta…</button>
      </div>
    </div>
    ${u.banned_reason ? `<div class="card"><b>Motivo de la suspensión:</b> ${esc(u.banned_reason)}</div>` : ''}
    <div class="grid2">
      <div class="card"><h2>Cuenta</h2><dl class="kv">
        <dt>Id</dt><dd><code>${u.id}</code></dd>
        <dt>Alta</dt><dd>${fmtDate(u.created_at)}</dd>
        <dt>Último acceso</dt><dd>${fmtDate(u.last_sign_in_at)}</dd>
        <dt>Email confirmado</dt><dd>${u.email_confirmed_at ? fmtDate(u.email_confirmed_at) : 'no'}</dd>
        <dt>Acceso con</dt><dd>${esc((u.providers || []).join(', ') || 'email')}</dd>
        <dt>Idioma</dt><dd>${esc(u.locale || 'sistema')}</dd>
        <dt>Fecha de nacimiento</dt><dd>${u.birth_date ? fmtDay(u.birth_date) : '—'}</dd>
        <dt>Push</dt><dd>${d.push_tokens.length ? d.push_tokens.map((t) => `${esc(t.platform)} (${ago(t.last_seen_at)})`).join(', ') : 'sin dispositivos'}</dd>
        <dt>Favoritos / guardados</dt><dd>${d.favorites} / ${d.saved}</dd>
      </dl></div>
      <div class="card"><h2>Consentimientos (RGPD)</h2><dl class="kv">
        <dt>Términos</dt><dd>${u.terms_accepted_at ? `${en ? 'accepted' : 'aceptados'} ${fmtDate(u.terms_accepted_at)} (v${esc(u.terms_version || '?')})` : '<span class="tag warn">sin registro</span>'}</dd>
        <dt>Comunicaciones comerciales</dt><dd>${u.marketing_consent ? `${en ? 'yes' : 'sí'}, ${fmtDate(u.marketing_consent_at)}` : 'no'}</dd>
        <dt>Ubicación</dt><dd>${u.location_consent_at ? (en ? `given ${fmtDate(u.location_consent_at)} · last ${ago(u.last_location_at)}` : `consentida ${fmtDate(u.location_consent_at)} · última ${ago(u.last_location_at)}`) : (en ? 'not given' : 'no consentida')}</dd>
        <dt>Notificaciones</dt><dd>${prefs ? (en ? `favourites: ${prefs.notify_favorites ? 'yes' : 'no'} · nearby: ${prefs.notify_nearby ? `yes (${prefs.nearby_radius_m} m)` : 'no'}${prefs.quiet_hours_start ? ` · quiet hours ${esc(prefs.quiet_hours_start)}–${esc(prefs.quiet_hours_end)}` : ''}` : `favoritos: ${prefs.notify_favorites ? 'sí' : 'no'} · cerca: ${prefs.notify_nearby ? `sí (${prefs.nearby_radius_m} m)` : 'no'}${prefs.quiet_hours_start ? ` · silencio ${esc(prefs.quiet_hours_start)}–${esc(prefs.quiet_hours_end)}` : ''}`) : 'por defecto'}</dd>
      </dl><p class="muted small" style="margin:10px 0 0">Para atender un derecho de acceso, usa «Exportar» en cada listado o pide el volcado en Supabase; para supresión, «Eliminar cuenta».</p></div>
    </div>
    <div class="grid2">
      <div class="card"><h2>${I18N.lang === 'en' ? 'Businesses' : 'Negocios'} (${d.memberships.length})</h2>${d.memberships.length ? table({ cols: [{ h: 'Negocio', r: (m) => `<a class="link" href="#/negocios/${m.business_id}">${esc(m.name)}</a><span class="sub">${esc(m.city || '')}</span>` }, { h: 'Rol', r: (m) => tag(m.role, 'dim') }, { h: 'Estado', r: (m) => tag(m.verification_status) }], rows: d.memberships }) : '<p class="muted">No pertenece a ningún negocio.</p>'}</div>
      <div class="card"><h2>${I18N.lang === 'en' ? `Last ${d.redemptions.length} redemptions` : `Canjes (${d.redemptions.length} últimos)`}</h2>${table({ cols: [{ h: 'Publicación', r: (r) => `${esc(r.title)}<span class="sub">${esc(r.business)}</span>` }, { h: 'Estado', r: (r) => tag(r.status) }, { h: 'Fecha', r: (r) => `<span class="nowrap">${fmtDate(r.validated_at || r.created_at)}</span>` }], rows: d.redemptions, empty: 'Ninguno.' })}</div>
    </div>
    <div class="grid2">
      <div class="card"><h2>${I18N.lang === 'en' ? 'Reviews' : 'Reseñas'} (${d.reviews.length})</h2>${d.reviews.length ? d.reviews.map((r) => `<div class="item" style="grid-template-columns:1fr"><div><span class="stars">${'★'.repeat(r.rating)}</span> <b>${esc(r.business)}</b> <span class="muted small">${ago(r.created_at)}</span><p>${esc(r.comment || '')}</p><div class="actions"><button class="btn sm bad" data-delreview="${r.id}">Borrar…</button></div></div></div>`).join('') : '<p class="muted">Ninguna.</p>'}</div>
      <div class="card"><h2>${I18N.lang === 'en' ? 'Reports made' : 'Denuncias que ha puesto'} (${d.reports_made.length})</h2>${d.reports_made.length ? table({ cols: [{ h: 'Sobre', r: (r) => tag(r.target_type, 'dim') }, { h: 'Motivo', r: (r) => esc(r.reason) }, { h: 'Estado', r: (r) => tag(r.status) }, { h: 'Fecha', r: (r) => fmtDay(r.created_at) }], rows: d.reports_made }) : '<p class="muted">Ninguna.</p>'}</div>
    </div>
    <div class="grid2">
      <div class="card"><h2>Últimas notificaciones</h2>${d.notifications.length ? `<ul style="margin:0;padding-left:18px;font-size:14px">${d.notifications.map((n) => `<li>${esc(n.title)} <span class="muted small">· ${esc(n.kind)} · ${ago(n.created_at)}${n.read_at ? (en ? ' · read' : ' · leída') : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Ninguna.</p>'}</div>
      <div class="card"><h2>Registro de cambios</h2>${auditList(d.audit)}</div>
    </div>`;
  $$('[data-delreview]').forEach((btn) => { btn.onclick = () => esperando(btn, () => deleteReview(btn.dataset.delreview)); });
  $$('[data-a]').forEach((btn) => { btn.onclick = () => esperando(btn, async () => {
    try {
      const a = btn.dataset.a;
      if (a === 'ban') {
        if (u.banned_at) { await rpc('admin_set_user_ban', { p_id: u.id, p_banned: false }); toast('Cuenta reactivada'); }
        else {
          const r = await modal({ title: 'Suspender cuenta', intro: 'No podrá canjear, publicar, reseñar ni denunciar. Recibe una notificación con el motivo y la vía de recurso.', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }], submit: 'Suspender', danger: true });
          if (!r) return; await rpc('admin_set_user_ban', { p_id: u.id, p_banned: true, p_reason: r.reason }); toast('Cuenta suspendida');
        }
      }
      if (a === 'premium') {
        const r = await modal({ title: 'Premium', intro: 'Sin fecha = quitar premium.', fields: [{ name: 'until', label: 'Premium hasta', type: 'date', value: u.premium_until ? new Date(u.premium_until).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }) : '' }] });
        if (!r) return; await rpc('admin_set_premium', { p_id: u.id, p_until: r.until || null }); toast('Premium actualizado');
      }
      if (a === 'type') {
        const r = await modal({ title: 'Tipo de cuenta', fields: [{ name: 'type', label: 'Tipo', type: 'select', value: u.user_type, options: [['user', 'Usuario'], ['business', 'Cuenta de negocio']] }] });
        if (!r) return; await rpc('admin_set_user_type', { p_id: u.id, p_type: r.type }); toast('Tipo actualizado');
      }
      if (a === 'birth') {
        // La persona no puede cambiarla (así no adelanta el regalo de
        // cumpleaños ni se hace mayor de edad): solo aquí, con motivo.
        const r = await modal({ title: 'Corregir fecha de nacimiento', intro: 'La persona no puede cambiarla desde la app ni desde la web. Corrígela solo si lo pide y lo acredita (por ejemplo, con el DNI). Queda en el registro con la fecha anterior y el motivo.', fields: [
          { name: 'birth', label: 'Fecha de nacimiento', type: 'date', required: true, value: u.birth_date || '' },
          { name: 'reason', label: 'Motivo (queda en el registro)', type: 'textarea', required: true },
        ], submit: 'Corregir' });
        if (!r) return; await rpc('admin_set_birth_date', { p_id: u.id, p_birth_date: r.birth, p_reason: r.reason }); toast('Fecha de nacimiento corregida');
      }
      if (a === 'notify') {
        const r = await modal({ title: 'Notificación al usuario', fields: CAMPOS_AVISO, submit: 'Enviar' });
        if (!r) return; await rpc('admin_send_notification', { p_audience: 'ids', p_user_ids: [u.id], ...textosAviso(r) }); toast('Notificación enviada');
      }
      if (a === 'admin') {
        if (u.is_admin) { if (!await confirmDlg('Quitar permisos de administrador', en ? `${esc(u.email)} will no longer be able to log in to this panel.` : `${esc(u.email)} dejará de poder entrar en este panel.`, { danger: true, submit: 'Quitar' })) return; await rpc('admin_remove_admin', { p_user_id: u.id }); toast('Ya no es administrador'); }
        else { if (!await confirmDlg('Hacer administrador', en ? `${esc(u.email)} will be able to log in to this panel with full permissions.` : `${esc(u.email)} podrá entrar en este panel con todos los permisos.`, { submit: 'Hacer admin' })) return; await rpc('admin_add_admin', { p_email: u.email }); toast('Ahora es administrador'); }
      }
      if (a === 'delete') {
        const r = await modal({ title: 'Eliminar la cuenta definitivamente', warn: en ? `Everything is deleted: profile, redemptions, reviews, favourites and <b>any businesses they own, with all their publications</b>. This can't be undone. Only do it at the user's request (right to erasure) or for a serious breach.` : 'Se borra todo: perfil, canjes, reseñas, favoritos y <b>los negocios de los que sea propietario con todas sus publicaciones</b>. No se puede deshacer. Hazlo solo a petición del usuario (derecho de supresión) o por incumplimiento grave.', fields: [{ name: 'reason', label: 'Motivo (queda en el registro)', type: 'textarea', required: true }], submit: 'Eliminar para siempre', danger: true, confirmWord: en ? 'DELETE' : 'ELIMINAR' });
        if (!r || !await confirmaIdentidad()) return;
        await rpc('admin_delete_user', { p_id: u.id, p_reason: r.reason }); toast('Cuenta eliminada'); go('#/usuarios'); return;
      }
      route();
    } catch (e) { toast(e.message, true); }
  }); });
}

// ── Reseñas y novedades ─────────────────────────────────────────────────────────
async function deleteReview(id) {
  const r = await modal({ title: 'Borrar reseña', intro: 'El autor recibe una notificación con el motivo y puede recurrir.', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }], submit: 'Borrar', danger: true });
  if (!r) return;
  try { await rpc('admin_delete_review', { p_id: id, p_reason: r.reason }); toast('Reseña borrada'); route(); } catch (e) { toast(e.message, true); }
}
async function deletePost(id) {
  const r = await modal({ title: 'Borrar novedad', intro: 'El negocio recibe una notificación con el motivo y puede recurrir.', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }], submit: 'Borrar', danger: true });
  if (!r) return;
  try { await rpc('admin_delete_post', { p_id: id, p_reason: r.reason }); toast('Novedad borrada'); route(); } catch (e) { toast(e.message, true); }
}
/** Aprobar o retirar un texto de la cola «En revisión». true si se hizo. */
async function decideTexto(x, aprobar) {
  const en = I18N.lang === 'en';
  let reason = null;
  if (!aprobar) {
    const intro = {
      post: en ? 'The news post is deleted.' : 'La novedad se borra.',
      review: en ? 'The review is deleted.' : 'La reseña se borra.',
      reply: en ? "The reply isn't published (if there was an earlier one, it stays)." : 'La respuesta no se publica (si había otra antes, se queda).',
      business_name: en ? 'The name goes back to the previous one.' : 'El nombre vuelve al anterior.',
      business_description: en ? 'The description goes back to the previous one (or is left empty).' : 'La descripción vuelve a la anterior (o se queda vacía).',
      menu: en ? 'Dishes with that name are deleted; if it is a description, it is removed; if it is a section, it is renamed “Carta”.' : 'Los platos con ese nombre se borran; si es una descripción, se quita; si es un apartado, pasa a llamarse «Carta».',
      closure_reason: en ? 'The closed days stay, without a reason.' : 'Los días cerrados se quedan, sin motivo.',
      birthday_gift: en ? 'It is not used: the previous gift stays (if there was none, no gift is given).' : 'No se usa: sigue el regalo anterior (si no había, no se regala nada).',
      stamp_card_name: en ? 'It is not used: the previous name stays. If the card is new, it is deleted.' : 'No se usa: sigue el nombre anterior. Si la tarjeta es nueva, se borra.',
      stamp_card_reward: en ? 'It is not used: the previous reward stays. If the card is new, it is deleted.' : 'No se usa: sigue el premio anterior. Si la tarjeta es nueva, se borra.',
    }[x.kind] || '';
    const r = await modal({
      title: 'Retirar texto',
      intro: `${esc(intro)} ${en ? 'Whoever wrote it gets the reason below and can appeal within 15 days.' : 'Quien lo escribió recibe el motivo de abajo y puede recurrir en 15 días.'}`,
      fields: [{ name: 'reason', label: 'Motivo que verá quien lo publicó (obligatorio por el DSA)', type: 'textarea', required: true }],
      submit: 'Retirar', danger: true,
    });
    if (!r) return false;
    reason = r.reason;
  }
  try {
    const res = await rpc('admin_review_text', { p_kind: x.kind, p_id: x.id, p_approve: aprobar, p_reason: reason });
    if (!res?.ok) {
      toast(res?.error === 'no_previous'
        ? (en ? 'There is no earlier name to go back to: change it from the business page or reject the verification.' : 'No hay un nombre anterior al que volver: cámbialo desde la ficha del negocio o rechaza la verificación.')
        : res?.error === 'outdated' ? (en ? 'The business has already changed it: reload the list.' : 'El negocio ya lo ha cambiado: vuelve a cargar la lista.')
          : res?.error === 'name_taken' ? (en ? 'Another card of that business already has that name.' : 'Otra tarjeta de ese negocio ya tiene ese nombre.')
            : (res?.error || 'Error'), true);
      return false;
    }
    toast(aprobar ? 'Texto aprobado' : 'Texto retirado');
    refreshBadges();
    return true;
  } catch (e) { toast(e.message, true); return false; }
}

PAGES.resenas = async (v) => {
  const p = params(); let tab = p.tab || (BADGES.resenas ? 'cola' : 'reviews');
  const sR = st.resenas, sP = st.posts;
  st.cola = st.cola || { limit: 50, offset: 0 };
  const sC = st.cola;
  v.innerHTML = `
    <div class="page-head"><h1>Reseñas y novedades</h1></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p><b>Reviews</b> are written by users about businesses; <b>news posts</b> are published by businesses on their page. Only delete them if they break the rules (insults, personal data, spam, content that isn't about the venue). The author gets the reason.</p>` : '<p>Las <b>reseñas</b> las escriben usuarios sobre negocios; las <b>novedades</b> las publican los negocios en su perfil. Bórralos solo si incumplen las normas (insultos, datos personales, spam, contenido que no es del local). El autor recibe el motivo.</p>')}
    ${helpBox('¿Qué es «En revisión»?', I18N.lang === 'en' ? '<p>Texts the system has stopped automatically for <b>offensive language</b> (insults, swear words, explicit sexual content, hate or threats), with the tag of what it found. News, reviews and replies to reviews are <b>not public</b> until you approve them. A new <b>birthday gift</b> or <b>stamp card</b> name or reward is not used until you approve it (the previous one stays; a new card waits paused), because it reaches customers in notifications. The business name, description, menu and the reason for closed days stay visible in the meantime. <b>Approve</b> if it is fine (a false positive, or strong but acceptable language); <b>Take down</b> if it breaks the Community guidelines: the author gets the reason. The word lists are in the database (<code>offensive_terms</code> and <code>offensive_exceptions</code>).</p>' : '<p>Textos que el sistema ha parado solo por <b>lenguaje ofensivo</b> (insultos, palabras malsonantes, contenido sexual explícito, odio o amenazas), con la etiqueta de lo que ha encontrado. Las novedades, las reseñas y las respuestas a reseñas <b>no se ven</b> hasta que las apruebas. El <b>regalo de cumpleaños</b> y el nombre o el premio de una <b>tarjeta de sellos</b> no se usan hasta que los apruebas (sigue el anterior; una tarjeta nueva espera en pausa), porque llegan a los clientes en notificaciones. El nombre, la descripción y la carta del negocio y el motivo de los días cerrados siguen a la vista mientras tanto. <b>Aprobar</b> si está bien (un falso positivo o algo fuerte pero aceptable); <b>Retirar</b> si incumple las Normas de la comunidad: el autor recibe el motivo. Las listas de palabras están en la base (<code>offensive_terms</code> y <code>offensive_exceptions</code>).</p>')}
    <div class="tabs"><button data-t="cola" class="${tab === 'cola' ? 'on' : ''}">En revisión${BADGES.resenas ? ` <span class="badge">${BADGES.resenas}</span>` : ''}</button><button data-t="reviews" class="${tab === 'reviews' ? 'on' : ''}">Reseñas</button><button data-t="posts" class="${tab === 'posts' ? 'on' : ''}">Novedades</button></div>
    <div class="toolbar" ${tab === 'cola' ? 'hidden' : ''}><input id="q" class="grow" placeholder="Buscar por texto, negocio o email…" value="${esc((tab === 'posts' ? sP.q : sR.q) || '')}"><select id="rating" ${tab === 'posts' ? 'hidden' : ''}>${[['', 'Cualquier puntuación'], ['1', 'Solo 1 ★'], ['2', '≤ 2 ★'], ['3', '≤ 3 ★']].map((o) => `<option value="${o[0]}" ${String(sR.rating || '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  const load = async () => {
    if (tab === 'cola') {
      const r = await rpc('admin_text_reviews', { p_limit: sC.limit, p_offset: sC.offset });
      const pg = pager(sC, r.total, load);
      $('#list').innerHTML = (r.rows.length ? r.rows.map((x, i) => `<div class="item">${x.image ? `<img src="${esc(x.image)}" alt="">` : `<div class="ph">${ms(ICONO_TEXTO[x.kind] || 'text_fields')}</div>`}<div>
        <h3>${esc(I18N.t(TIPO_TEXTO[x.kind] || x.kind))} · <a class="link" href="#/negocios/${x.business_id}">${esc(x.business)}</a> ${(x.categories || []).map((c) => `<span class="tag warn" title="Detectado automáticamente en el texto">${esc(I18N.t(CAT_OFENSIVA[c] || c))}</span>`).join(' ')}</h3>
        <div class="meta">${x.user_email ? `${esc(x.user_email)} · ` : ''}${fmtDate(x.created_at)}${x.rating ? ` · <span class="stars">${'★'.repeat(x.rating)}${'☆'.repeat(5 - x.rating)}</span>` : ''}</div>
        <p>${esc(x.text || '')}</p>
        ${x.context ? `<div class="meta">${esc(I18N.t(CONTEXTO_TEXTO[x.kind] || 'Reseña'))}: «${esc(x.context)}»</div>` : ''}
        ${x.previous ? `<div class="meta">${esc(I18N.t(x.kind === 'reply' ? 'Respuesta publicada' : ['birthday_gift', 'stamp_card_name', 'stamp_card_reward'].includes(x.kind) ? 'En uso' : 'Antes'))}: «${esc(x.previous)}»</div>` : ''}
        <div class="actions"><button class="btn sm ok" data-ap="${i}">Aprobar</button><button class="btn sm bad" data-re="${i}">Retirar…</button></div></div></div>`).join('') : '<div class="tbl-wrap"><div class="empty">No hay textos en revisión.</div></div>') + pg.html;
      pg.bind($('#list'));
      $$('#list [data-ap]').forEach((b) => { b.onclick = () => esperando(b, async () => { if (await decideTexto(r.rows[+b.dataset.ap], true)) await load(); }); });
      $$('#list [data-re]').forEach((b) => { b.onclick = () => esperando(b, async () => { if (await decideTexto(r.rows[+b.dataset.re], false)) await load(); }); });
      I18N.translate($('#list'));
      return;
    }
    if (tab === 'reviews') {
      const r = await rpc('admin_reviews', { p_query: sR.q || null, p_max_rating: sR.rating ? +sR.rating : null, p_limit: sR.limit, p_offset: sR.offset });
      const pg = pager(sR, r.total, load);
      $('#list').innerHTML = (r.rows.length ? r.rows.map((x) => `<div class="item"><div class="ph">${ms('chat_bubble')}</div><div><h3><span class="stars">${'★'.repeat(x.rating)}${'☆'.repeat(5 - x.rating)}</span> ${I18N.lang === 'en' ? 'at' : 'en'} <a class="link" href="#/negocios/${x.business_id}">${esc(x.business)}</a> ${x.moderation_status === 'pending' ? '<span class="tag warn">en revisión</span>' : ''} ${flagTags(x)} ${x.reply_pending ? '<span class="tag warn">respuesta en revisión</span>' : ''} ${x.open_reports ? `<span class="tag bad">${ms('flag')} ${x.open_reports}</span>` : ''}</h3><div class="meta">${esc(x.user_email || (I18N.lang === 'en' ? 'anonymous' : 'anónimo'))} · ${fmtDate(x.created_at)}</div><p>${esc(x.comment || '(sin texto)')}</p><div class="actions"><button class="btn sm bad" data-del="${x.id}">Borrar…</button></div></div></div>`).join('') : '<div class="tbl-wrap"><div class="empty">Sin reseñas.</div></div>') + pg.html;
      pg.bind($('#list'));
      $$('#list [data-del]').forEach((b) => { b.onclick = () => esperando(b, () => deleteReview(b.dataset.del)); });
    } else {
      const r = await rpc('admin_posts', { p_query: sP.q || null, p_limit: sP.limit, p_offset: sP.offset });
      const pg = pager(sP, r.total, load);
      $('#list').innerHTML = (r.rows.length ? r.rows.map((x) => `<div class="item">${x.image_url ? `<img src="${esc(x.image_url)}" alt="">` : `<div class="ph">${ms('article')}</div>`}<div><h3><a class="link" href="#/negocios/${x.business_id}">${esc(x.business)}</a> ${x.moderation_status === 'pending' ? '<span class="tag warn">en revisión</span>' : ''} ${flagTags(x)} ${x.open_reports ? `<span class="tag bad">${ms('flag')} ${x.open_reports}</span>` : ''}</h3><div class="meta">${fmtDate(x.created_at)}</div><p>${esc(x.body || '')}</p><div class="actions"><button class="btn sm bad" data-del="${x.id}">Borrar…</button></div></div></div>`).join('') : '<div class="tbl-wrap"><div class="empty">Sin novedades.</div></div>') + pg.html;
      pg.bind($('#list'));
      $$('#list [data-del]').forEach((b) => { b.onclick = () => esperando(b, () => deletePost(b.dataset.del)); });
    }
  };
  $$('.tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; history.replaceState(null, '', `#/resenas?tab=${tab}`); $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#rating').hidden = tab === 'posts'; $('.toolbar', v).hidden = tab === 'cola'; load(); }; });
  $('#q').oninput = debounce(() => { const q = $('#q').value.trim(); sR.q = q; sP.q = q; sR.offset = sP.offset = 0; load(); });
  $('#rating').onchange = () => { sR.rating = $('#rating').value; sR.offset = 0; load(); };
  await load();
};

// ── Denuncias ───────────────────────────────────────────────────────────────
// Una tarjeta por contenido denunciado (publicación, negocio, reseña o
// novedad), con cuántas denuncias tiene, de cuántas personas (con y sin
// cuenta), los motivos y cómo está el contenido. Dentro (#/denuncias/<tipo>/<id>),
// cada denuncia con su explicación y quién la puso. Las decisiones se toman
// para todas las abiertas de ese contenido a la vez
// (`admin_resolve_report_group`); a quien denunció le llega la decisión
// (en la app, o por correo si fue sin cuenta).
const MOTIVOS_DENUNCIA = {
  spam: 'Spam o publicidad engañosa', inappropriate: 'Contenido inapropiado u ofensivo', misleading: 'La oferta no es como se anuncia',
  closed: 'El negocio ya no existe o está cerrado', illegal: 'Contenido ilegal', child_abuse: 'Abuso sexual infantil', other: 'Otro motivo',
};
const motivoDen = (r) => I18N.t(MOTIVOS_DENUNCIA[r] || r);
// Cómo está lo denunciado (report_target_state).
const ESTADO_DEN = { published: ['publicado', 'ok'], review: ['en revisión', 'warn'], removed: ['retirado', 'bad'], hidden: ['no visible', 'dim'], deleted: ['borrado', 'dim'] };
const estadoDen = (s) => { const e = ESTADO_DEN[s]; return e ? `<span class="tag ${e[1]}">${esc(I18N.t(e[0]))}</span>` : ''; };
const RESOLUCION_DEN = { removed: 'contenido retirado', no_action: 'cerrada sin retirar', dismissed: 'desestimada' };
const TIPO_DEN = { offer: 'Publicación', business: 'Negocio', review: 'Reseña', post: 'Novedad' };
/** Dónde se ve en la web pública (reseñas y novedades, con su ancla en la ficha). */
const urlDenunciado = (tipo, id, t) => {
  const b = (t && (t.slug || t.business_id)) || null;
  if (tipo === 'offer') return `/o/${id}`;
  if (tipo === 'business') return `/b/${(t && t.slug) || id}`;
  if (!b) return '';
  return `/b/${b}#${tipo === 'review' ? 'resena' : 'novedad'}-${id}`;
};
/** Su ficha dentro del admin. */
const adminDenunciado = (tipo, id, t) => (tipo === 'offer' ? `#/publicaciones/${id}` : tipo === 'business' ? `#/negocios/${id}` : t?.business_id ? `#/negocios/${t.business_id}` : '');
/** El título que se enseña: el de la publicación, el nombre del negocio o el texto de la reseña o la novedad. */
const tituloDen = (tipo, t) => {
  const en = I18N.lang === 'en';
  if (!t) return en ? '(content no longer available)' : '(contenido ya no disponible)';
  if (tipo === 'review') return `${'★'.repeat(Math.max(0, Math.min(5, t.rating | 0)))} ${t.title ? `«${t.title}»` : (en ? '(no text)' : '(sin texto)')}`;
  if (tipo === 'post') return t.title ? `«${t.title}»` : (en ? '(photo only)' : '(solo foto)');
  return t.title || '—';
};
const miniDen = (tipo, t) => (t?.image && /\.(mp4|webm|mov)(\?|$)/i.test(t.image) ? `<video src="${esc(t.image)}#t=0.5" muted playsinline preload="metadata" aria-hidden="true"></video>` : t?.image ? `<img src="${esc(t.image)}" alt="" loading="lazy">` : `<div class="ph">${ms({ offer: 'bolt', business: 'storefront', review: 'chat_bubble', post: 'article' }[tipo] || 'flag')}</div>`);

/** Retirar y cerrar / cerrar sin retirar / desestimar / en revisión, para
 * todas las abiertas de un contenido. true si se hizo. */
async function decideDenuncias(tipo, id, decision, abiertas) {
  const en = I18N.lang === 'en';
  let reason = null;
  if (decision === 'remove') {
    const intro = {
      offer: en ? 'The publication is taken down (it stops being visible).' : 'La publicación se retira (deja de verse).',
      business: en ? 'The business is deactivated: its page and publications stop being visible.' : 'El negocio se desactiva: su ficha y sus publicaciones dejan de verse.',
      review: en ? 'The review is deleted.' : 'La reseña se borra.',
      post: en ? 'The news post is deleted.' : 'La novedad se borra.',
    }[tipo];
    const r = await modal({
      title: en ? 'Take down and close all' : 'Retirar y cerrar todas',
      intro: `${esc(intro)} ${en ? `The ${abiertas} open reports are closed and each reporter is told the content was taken down. Whoever posted it gets the reason below and can appeal within 15 days.` : `Se cierran las ${abiertas} denuncias abiertas y a cada denunciante se le dice que se ha retirado. Quien lo publicó recibe el motivo de abajo y puede recurrir en 15 días.`}`,
      fields: [{ name: 'reason', label: 'Motivo que verá quien lo publicó (obligatorio por el DSA)', type: 'textarea', required: true }],
      submit: 'Retirar y cerrar', danger: true,
    });
    if (!r) return false;
    reason = r.reason;
    if (!reason) { toast('Hace falta indicar un motivo.', true); return false; }
  } else if (decision !== 'reviewing') {
    const ok = await confirmDlg(
      decision === 'dismiss' ? (en ? 'Dismiss all' : 'Desestimar todas') : (en ? 'Close without taking down' : 'Cerrar sin retirar'),
      decision === 'dismiss'
        ? (en ? `The ${abiertas} open reports are dismissed as unfounded. The content stays up and each reporter is told so.` : `Se desestiman las ${abiertas} denuncias abiertas por no tener fundamento. El contenido sigue publicado y a cada denunciante se le dice.`)
        : (en ? `The ${abiertas} open reports are closed: the content complies with the rules and stays up. Each reporter is told so.` : `Se cierran las ${abiertas} denuncias abiertas: el contenido cumple las normas y sigue publicado. A cada denunciante se le dice.`),
      { submit: decision === 'dismiss' ? 'Desestimar todas' : 'Cerrar sin retirar' });
    if (!ok) return false;
  }
  try {
    const res = await rpc('admin_resolve_report_group', { p_type: tipo, p_id: id, p_decision: decision, p_reason: reason });
    toast(en ? `${res?.reports ?? 0} ${res?.reports === 1 ? 'report updated' : 'reports updated'}` : `${res?.reports ?? 0} ${res?.reports === 1 ? 'denuncia actualizada' : 'denuncias actualizadas'}`);
    refreshBadges();
    return true;
  } catch (e) { toast(e.message, true); return false; }
}

const botonesDen = (g) => g.open_count > 0 ? `
  <button class="btn sm bad" data-dec="remove" ${g.state === 'deleted' ? 'disabled' : ''}>${g.state === 'removed' ? 'Cerrar (ya retirado)…' : 'Retirar y cerrar todas…'}</button>
  <button class="btn sm ok" data-dec="keep">Cerrar sin retirar</button>
  <button class="btn sm ghost" data-dec="dismiss">Desestimar todas</button>
  ${g.reviewing ? '' : '<button class="btn sm ghost" data-dec="reviewing">Marcar en revisión</button>'}` : '';

/** Las cifras de un grupo: denuncias, personas, con y sin cuenta, fechas. */
function cifrasDen(g, abiertas = true) {
  const en = I18N.lang === 'en';
  const n = g.n;
  const cuenta = en
    ? `<b>${n}</b> ${abiertas ? (n === 1 ? 'open report' : 'open reports') : (n === 1 ? 'report' : 'reports')} · <b>${g.people}</b> ${g.people === 1 ? 'person' : 'different people'} · ${g.with_account} with an account · ${g.without_account} without`
    : `<b>${n}</b> ${abiertas ? (n === 1 ? 'denuncia abierta' : 'denuncias abiertas') : (n === 1 ? 'denuncia' : 'denuncias')} · <b>${g.people}</b> ${g.people === 1 ? 'persona' : 'personas distintas'} · ${g.with_account} con cuenta · ${g.without_account} sin cuenta`;
  const fechas = g.first_at === g.last_at || n === 1
    ? `${en ? 'On' : 'El'} ${fmtDate(g.last_at)}`
    : `${en ? 'First' : 'Primera'} ${fmtDate(g.first_at)} · ${en ? 'latest' : 'última'} ${fmtDate(g.last_at)}`;
  const otras = abiertas && g.total_count > g.open_count ? ` · ${en ? `${g.total_count - g.open_count} already closed` : `${g.total_count - g.open_count} ya cerradas`}` : '';
  return `<div class="meta">${cuenta}${otras}</div><div class="meta">${fechas}</div>`;
}

PAGES.denuncias = async (v, tipoRuta) => {
  const [, tipoD, idD] = currentRoute();
  if (tipoRuta && TIPO_DEN[tipoD] && /^[0-9a-f-]{36}$/i.test(idD || '')) return denunciasDe(v, tipoD, idD);
  const s = st.denuncias;
  const en = I18N.lang === 'en';
  v.innerHTML = `
    <div class="page-head"><h1>Denuncias</h1></div>
    ${helpBox('¿Qué hago aquí?', en
      ? `<p>One card per reported item (publication, business, review or news post), with how many reports it has, from how many different people (with and without an account), the reasons and whether it's still up. Open it (“See the reports”) to read each report and who made it. Decide for all its open reports at once: <b>Take down and close all</b> (the publication is taken down, the business deactivated, the review or news post deleted; whoever posted it gets the reason and can appeal within 15 days), <b>Close without taking down</b> (the content complies) or <b>Dismiss all</b> (unfounded reports). Every reporter is told the decision: in the app if they have an account, by email if they reported without one. By law (DSA, art. 16) reports must be handled diligently and the decision explained.</p><p>People without an account report from klendar.app (“Report illegal content” in the footer, or “Report” on any page without being logged in). Their name and email are only visible here.</p>`
      : `<p>Una tarjeta por cada contenido denunciado (publicación, negocio, reseña o novedad), con cuántas denuncias tiene, de cuántas personas distintas (con y sin cuenta), los motivos y si sigue publicado. Ábrelo («Ver las denuncias») para leer cada denuncia y quién la puso. Decide para todas sus denuncias abiertas a la vez: <b>Retirar y cerrar todas</b> (la publicación se retira, el negocio se desactiva, la reseña o la novedad se borran; quien lo publicó recibe el motivo y puede recurrir en 15 días), <b>Cerrar sin retirar</b> (el contenido cumple) o <b>Desestimar todas</b> (denuncias sin fundamento). A cada denunciante le llega la decisión: en la app si tiene cuenta, por correo si denunció sin ella. Por ley (DSA, art. 16) hay que resolverlas con diligencia y explicar la decisión.</p><p>Quien no tiene cuenta denuncia desde klendar.app («Denunciar contenido ilegal» en el pie, o «Denunciar» en cualquier ficha sin haber entrado). Su nombre y su correo solo se ven aquí.</p>`)}
    <div class="toolbar">
      <select id="status">${[['open', 'Con denuncias abiertas'], ['closed', 'Ya cerradas'], ['all', 'Todo']].map((o) => `<option value="${o[0]}" ${(s.status || 'open') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="type">${[['all', 'Todo tipo'], ['offer', 'Publicaciones'], ['business', 'Negocios'], ['review', 'Reseñas'], ['post', 'Novedades']].map((o) => `<option value="${o[0]}" ${(s.type || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  const load = async () => {
    const abiertas = (s.status || 'open') === 'open';
    const r = await rpc('admin_report_groups', { p_status: s.status || 'open', p_type: s.type || 'all', p_min_open: 0, p_limit: s.limit, p_offset: s.offset });
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = (r.rows.length ? r.rows.map((g) => {
      const t = g.target || {};
      const url = urlDenunciado(g.target_type, g.target_id, t);
      const det = `#/denuncias/${g.target_type}/${g.target_id}`;
      return `
      <div class="item den-grupo${g.open_count >= 3 ? ' den-caliente' : ''}" data-tipo="${esc(g.target_type)}" data-id="${esc(g.target_id)}" data-abiertas="${g.open_count}">${miniDen(g.target_type, t)}<div style="min-width:0">
        <h3><a class="link" href="${det}">${esc(tituloDen(g.target_type, g.target))}</a></h3>
        <div class="meta">${tag(g.target_type, 'dim')} ${estadoDen(g.state)} ${g.reviewing ? tag('reviewing') : ''} ${g.target_type !== 'business' && t.business ? `${en ? 'by' : 'de'} ${t.business_id ? `<a class="link" href="#/negocios/${esc(t.business_id)}">${esc(t.business)}</a>` : esc(t.business)}` : ''}${t.city ? ` · ${esc(t.city)}` : ''}</div>
        ${cifrasDen(g, abiertas)}
        <div class="den-motivos">${(g.reasons || []).map((m) => `<span class="tag ${m.reason === 'child_abuse' || m.reason === 'illegal' ? 'bad' : 'dim'}">${esc(motivoDen(m.reason))} · ${m.n}</span>`).join(' ')}</div>
        <div class="actions">
          <a class="btn sm" href="${det}">${en ? `See the reports (${g.total_count})` : `Ver las denuncias (${g.total_count})`}</a>
          ${url ? `<a class="btn sm ghost" href="${APP_URL}${esc(url)}" target="_blank" rel="noopener">${en ? 'Open' : 'Abrir'} ↗</a>` : ''}
          ${botonesDen(g)}
        </div>
      </div></div>`;
    }).join('') : `<div class="tbl-wrap"><div class="empty">${abiertas ? 'No hay denuncias abiertas.' : 'Sin denuncias con esos filtros.'}</div></div>`) + pg.html;
    pg.bind($('#list'));
    $$('#list [data-dec]').forEach((b) => { b.onclick = () => esperando(b, async () => {
      const card = b.closest('[data-tipo]');
      if (await decideDenuncias(card.dataset.tipo, card.dataset.id, b.dataset.dec, +card.dataset.abiertas)) await load();
    }); });
    I18N.translate($('#list'));
  };
  ['status', 'type'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  await load();
};

/** Un contenido denunciado: qué es, cómo está y cada denuncia. */
async function denunciasDe(v, tipo, id) {
  const en = I18N.lang === 'en';
  const d = await rpc('admin_report_group', { p_type: tipo, p_id: id });
  const t = d.target || {};
  const reps = d.reports || [];
  const abiertas = reps.filter((r) => ['open', 'reviewing'].includes(r.status));
  const personas = new Set(reps.filter((r) => ['open', 'reviewing'].includes(r.status)).map((r) => r.reporter?.kind === 'account' ? r.reporter.id : r.reporter?.email ? `m:${r.reporter.email.toLowerCase()}` : r.id)).size;
  const motivos = {};
  for (const r of (abiertas.length ? abiertas : reps)) motivos[r.reason] = (motivos[r.reason] || 0) + 1;
  const url = urlDenunciado(tipo, id, t);
  const ficha = adminDenunciado(tipo, id, t);
  const g = {
    n: abiertas.length || reps.length, open_count: abiertas.length, total_count: reps.length, people: personas || new Set(reps.map((r) => r.reporter?.id || r.reporter?.email || r.id)).size,
    with_account: (abiertas.length ? abiertas : reps).filter((r) => r.channel === 'account').length,
    without_account: (abiertas.length ? abiertas : reps).filter((r) => r.channel === 'public').length,
    first_at: (abiertas.length ? abiertas : reps).reduce((m, r) => (!m || r.created_at < m ? r.created_at : m), null),
    last_at: (abiertas.length ? abiertas : reps).reduce((m, r) => (!m || r.created_at > m ? r.created_at : m), null),
    state: d.state, reviewing: abiertas.some((r) => r.status === 'reviewing'),
  };
  const quien = (r) => {
    const p = r.reporter || {};
    if (p.kind === 'account') return `${en ? 'Account' : 'Cuenta'}: <a class="link" href="#/usuarios/${esc(p.id)}">${esc(p.email || p.name || (en ? 'user' : 'usuario'))}</a>${p.name && p.email ? ` <span class="muted">(${esc(p.name)})</span>` : ''}`;
    if (p.kind === 'public') {
      const datos = [p.name ? esc(p.name) : '', p.email ? `<a class="link" href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''].filter(Boolean).join(' · ');
      const correos = [p.ack_sent_at ? `${en ? 'receipt sent' : 'acuse enviado'} ${fmtDate(p.ack_sent_at)}` : '', p.decision_sent_at ? `${en ? 'decision sent' : 'decisión enviada'} ${fmtDate(p.decision_sent_at)}` : ''].filter(Boolean).join(' · ');
      return `<span class="tag warn">${en ? 'no account' : 'sin cuenta'}</span> ${datos || `<span class="muted">${en ? 'anonymous (no name or email)' : 'anónima (sin nombre ni correo)'}</span>`}${p.good_faith ? ` · <span class="muted">${en ? 'good-faith statement ✓' : 'declaración de buena fe ✓'}</span>` : ''}${correos ? `<div class="meta">${correos}</div>` : ''}`;
    }
    return `<span class="muted">${en ? 'deleted account' : 'cuenta borrada'}</span>`;
  };
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/denuncias">← ${en ? 'Reports' : 'Denuncias'}</a></div>
    <div class="card den-ficha">
      <div class="item" style="border:0;padding:0">${miniDen(tipo, d.target)}<div style="min-width:0">
        <h1 style="margin:0 0 4px;font-size:22px">${esc(tituloDen(tipo, d.target))}</h1>
        <div class="meta">${tag(tipo, 'dim')} ${estadoDen(d.state)} ${g.reviewing ? tag('reviewing') : ''} ${tipo !== 'business' && t.business ? `${en ? 'by' : 'de'} ${t.business_id ? `<a class="link" href="#/negocios/${esc(t.business_id)}">${esc(t.business)}</a>` : esc(t.business)}` : ''}${t.city ? ` · ${esc(t.city)}` : ''}</div>
        ${d.live ? '' : `<p class="meta">${en ? 'It no longer exists: this is how it was when it was reported.' : 'Ya no existe: así estaba cuando lo denunciaron.'}</p>`}
        ${cifrasDen(g, abiertas.length > 0)}
        <div class="den-motivos">${Object.entries(motivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => `<span class="tag ${m === 'child_abuse' || m === 'illegal' ? 'bad' : 'dim'}">${esc(motivoDen(m))} · ${n}</span>`).join(' ')}</div>
        <div class="actions">
          ${url && d.live ? `<a class="btn sm" href="${APP_URL}${esc(url)}" target="_blank" rel="noopener">${en ? 'Open on the website' : 'Abrir en la web'} ↗</a>` : ''}
          ${ficha ? `<a class="btn sm ghost" href="${ficha}">${tipo === 'offer' ? (en ? 'Publication in the admin' : 'Publicación en el admin') : (en ? 'Business in the admin' : 'Negocio en el admin')}</a>` : ''}
          ${botonesDen(g)}
        </div>
      </div></div>
    </div>
    ${reps.some((r) => r.reason === 'child_abuse' && ['open', 'reviewing'].includes(r.status)) ? `<div class="card den-aviso">${en ? '<b>Child sexual abuse.</b> If the report looks credible, take the content down straight away and report it to the Police (Policía Nacional, <a class="link" href="https://www.policia.es/_es/colabora.php" target="_blank" rel="noopener">policia.es</a>) or the Guardia Civil: the DSA (art. 18) requires informing the authorities of any suspected offence that threatens someone’s life or safety. Do not download or forward the material.' : '<b>Abuso sexual infantil.</b> Si la denuncia parece creíble, retira el contenido en el acto y avisa a la Policía Nacional (<a class="link" href="https://www.policia.es/_es/colabora.php" target="_blank" rel="noopener">policia.es</a>) o a la Guardia Civil: el DSA (art. 18) obliga a informar a las autoridades de cualquier sospecha de delito que amenace la vida o la seguridad de alguien. No descargues ni reenvíes el material.'}</div>` : ''}
    <div class="card"><h2>${en ? `Reports (${reps.length})` : `Denuncias (${reps.length})`}</h2>
      ${reps.map((r) => `<div class="item den-fila" style="grid-template-columns:1fr" data-rep="${esc(r.id)}"><div>
        <h3>${esc(motivoDen(r.reason))} ${tag(r.status)} ${r.resolution && r.resolution !== 'dismissed' ? `<span class="tag dim">${esc(I18N.t(RESOLUCION_DEN[r.resolution] || r.resolution))}</span>` : ''} <span class="muted small">${en ? 'ref.' : 'ref.'} ${esc(r.ref)}</span></h3>
        <div class="meta">${fmtDate(r.created_at)}${r.resolved_at ? ` · ${en ? 'closed' : 'cerrada'} ${fmtDate(r.resolved_at)}` : ''}</div>
        <div class="meta">${quien(r)}</div>
        ${r.details ? `<p class="den-texto">${esc(r.details)}</p>` : `<p class="meta">${en ? 'No explanation.' : 'Sin explicación.'}</p>`}
        ${['open', 'reviewing'].includes(r.status) ? `<div class="actions"><button class="btn sm ghost" data-una="dismissed">${en ? 'Dismiss this one' : 'Desestimar esta'}</button></div>` : ''}
      </div></div>`).join('')}
    </div>`;
  $$('[data-dec]', v).forEach((b) => { b.onclick = () => esperando(b, async () => {
    if (await decideDenuncias(tipo, id, b.dataset.dec, abiertas.length)) route();
  }); });
  $$('[data-una]', v).forEach((b) => { b.onclick = () => esperando(b, async () => {
    if (!await confirmDlg(en ? 'Dismiss this report' : 'Desestimar esta denuncia', en ? 'Only this report is dismissed (unfounded). The reporter is told the content stays up.' : 'Solo se desestima esta denuncia (sin fundamento). A quien la puso se le dice que el contenido sigue publicado.', { submit: 'Desestimar' })) return;
    try { await rpc('admin_resolve_report', { p_id: b.closest('[data-rep]').dataset.rep, p_status: 'dismissed', p_action: 'none', p_reason: null }); toast('Denuncia actualizada'); refreshBadges(); route(); } catch (e) { toast(e.message, true); }
  }); });
}

// ── Mensajes a clientes ─────────────────────────────────────────────────────
// Los mensajes de «Avisar a mis clientes» que la moderación automática ha
// parado (mencionan alcohol, tabaco o apuestas) esperan aquí: se envían tal
// cual o se rechazan con un motivo opcional, que el negocio recibe. El resto
// ya salió solo; se listan para poder mirar qué se manda.
const ESTADO_MENSAJE = { review: ['warn', 'En revisión'], sent: ['ok', 'Enviado'], rejected: ['bad', 'No enviado'] };
PAGES.mensajes = async (v) => {
  const s = st.mensajes;
  const en = I18N.lang === 'en';
  v.innerHTML = `
    <div class="page-head"><h1>Mensajes a clientes</h1></div>
    ${helpBox('¿Qué hago aquí?', en
      ? '<p>A business can send one short message a week to people who have it in their favourites (“Message my customers”). If the text mentions <b>alcohol</b>, <b>tobacco</b> or <b>gambling</b>, or has <b>offensive language</b>, it stops here. <b>Send</b> delivers it as it is (with alcohol, only to adults); <b>Reject</b> discards it and the business is told, with the reason if you give one. A rejected message does not use up their week.</p>'
      : '<p>Un negocio puede mandar un mensaje corto a la semana a quien lo tiene en favoritos («Avisar a mis clientes»). Si el texto menciona <b>alcohol</b>, <b>tabaco</b> o <b>apuestas</b>, o tiene <b>lenguaje ofensivo</b>, se para aquí. <b>Enviar</b> lo manda tal cual (con alcohol, solo a mayores de edad); <b>Rechazar</b> lo descarta y se le dice al negocio, con el motivo si lo pones. Uno rechazado no le gasta la semana.</p>')}
    <div class="toolbar">
      <select id="status">${[['all', 'Todos'], ['review', 'En revisión'], ['sent', 'Enviados'], ['rejected', 'No enviados']].map((o) => `<option value="${o[0]}" ${(s.status || 'review') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  const load = async () => {
    const estado = s.status || 'review';
    const r = await rpc('admin_business_messages', { p_status: estado === 'all' ? null : estado, p_limit: s.limit, p_offset: s.offset });
    const pg = pager(s, r.total || 0, load);
    const items = r.items || [];
    $('#list').innerHTML = (items.length ? items.map((x) => {
      const [cls, txt] = ESTADO_MENSAJE[x.status] || ['dim', x.status];
      const personas = x.recipients === 1 ? (en ? '1 person' : '1 persona') : `${fmtNum(x.recipients || 0)} ${en ? 'people' : 'personas'}`;
      return `
      <div class="item"><div class="ph">${ms('campaign')}</div><div>
        <h3>${esc(x.title)} <span class="tag ${cls}">${esc(I18N.t(txt))}</span> ${flagTags(x)}</h3>
        <div class="meta"><a class="link" href="#/negocios/${esc(x.business_id)}">${esc(x.business_name)}</a>${x.city ? ` · ${esc(x.city)}` : ''} · ${fmtDate(x.created_at)}${x.author_email ? ` · ${esc(x.author_email)}` : ''}</div>
        <p>${esc(x.body)}</p>
        <div class="meta">${esc(en ? (x.include_customers ? 'Favourites and customers with stamps' : 'Favourites') : (x.include_customers ? 'Favoritos y clientes con sellos' : 'Favoritos'))}${x.status === 'sent' ? ` · ${esc(personas)}${x.sent_at ? ` · ${fmtDate(x.sent_at)}` : ''}` : ''}${x.offer_title ? ` · ${esc(en ? `Linking to “${x.offer_title}”` : `Con enlace a «${x.offer_title}»`)}` : ''}</div>
        ${x.status === 'rejected' && x.rejection_reason ? `<div class="meta">${esc(en ? `Reason: ${x.rejection_reason}` : `Motivo: ${x.rejection_reason}`)}</div>` : ''}
        ${x.status === 'review' ? `<div class="actions">
          <button class="btn sm ok" data-msg="${esc(x.id)}" data-ok="1">Enviar</button>
          <button class="btn sm bad" data-msg="${esc(x.id)}" data-ok="0">Rechazar…</button>
        </div>` : ''}
      </div></div>`;
    }).join('') : '<div class="tbl-wrap"><div class="empty">Ningún mensaje con ese filtro.</div></div>') + pg.html;
    pg.bind($('#list'));
    $$('#list [data-msg]').forEach((b) => { b.onclick = () => esperando(b, async () => {
      const aprobar = b.dataset.ok === '1';
      let motivo = null;
      if (aprobar) {
        if (!await confirmDlg('Enviar el mensaje', esc(I18N.t('Llega ahora como notificación a quien tiene el negocio en favoritos (y a sus clientes, si lo pidió). No se puede deshacer.')), { submit: 'Enviar' })) return;
      } else {
        const m = await modal({ title: 'Rechazar el mensaje', intro: esc(I18N.t('No se envía y se le dice al negocio. Puede escribir otro cuando quiera.')), fields: [{ name: 'reason', label: 'Motivo que verá el negocio (opcional)', type: 'textarea' }], submit: 'Rechazar', danger: true });
        if (!m) return;
        motivo = m.reason || null;
      }
      try {
        const res = await rpc('admin_review_business_message', { p_id: b.dataset.msg, p_approve: aprobar, p_reason: motivo });
        if (res?.ok === false) { toast(res.error === 'not_in_review' ? 'Ese mensaje ya no está en revisión.' : 'No encontrado.', true); await load(); return; }
        toast(aprobar
          ? (res.recipients === 1 ? (en ? 'Sent to 1 person' : 'Enviado a 1 persona') : (en ? `Sent to ${fmtNum(res.recipients || 0)} people` : `Enviado a ${fmtNum(res.recipients || 0)} personas`))
          : 'Mensaje rechazado');
        refreshBadges();
        await load();
      } catch (e) { toast(e.message, true); }
    }); });
  };
  $('#status').onchange = () => { s.status = $('#status').value; s.offset = 0; load(); };
  await load();
};

// ── Sugerencias y fallos ────────────────────────────────────────────────────
PAGES.sugerencias = async (v) => {
  const s = st.sugerencias;
  s.status = s.status || 'open';
  v.innerHTML = `
    <div class="page-head"><h1>Sugerencias</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p>What people write from the app (Account → “Ideas and feedback”) or the website: ideas, bugs and messages from businesses. <b>Bugs</b> also reach your phone as a notification. Mark each one with what you're going to do —<b>we're looking into it</b>, <b>we'll do it</b>, <b>done</b> or <b>not for now</b>— and, if you like, <b>reply</b>: the person gets your reply as a notification. Nobody outside sees the internal notes.</p>` : '<p>Lo que la gente escribe desde la app (Cuenta → «Sugerencias y mejoras») o la web: ideas, fallos y mensajes de negocios. Los <b>fallos</b> te llegan además como notificación al móvil. Marca cada una con lo que vas a hacer —<b>la estamos viendo</b>, <b>la haremos</b>, <b>hecho</b> o <b>de momento no</b>— y, si quieres, <b>responde</b>: la persona recibe tu respuesta como notificación. Las notas internas no las ve nadie de fuera.</p>')}
    <div id="counts"></div>
    <div class="toolbar">
      <input id="q" class="grow" placeholder="Buscar en el texto o por email…" value="${esc(s.q || '')}">
      <select id="status">${[['open', 'Sin resolver'], ['new', 'Sin leer'], ['reviewing', 'En revisión'], ['planned', 'Las haremos'], ['done', 'Hechas'], ['declined', 'Descartadas'], ['all', 'Todas']].map((o) => `<option value="${o[0]}" ${s.status === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="kind">${[['all', 'De todo'], ['suggestion', 'Sugerencias'], ['bug', 'Fallos'], ['business', 'De negocios'], ['other', 'Otros']].map((o) => `<option value="${o[0]}" ${(s.kind || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  let rows = [];
  const kindIcon = { suggestion: ms('lightbulb'), bug: ms('bug_report'), business: ms('storefront'), other: ms('chat_bubble') };
  const load = async () => {
    const r = await rpc('admin_feedback', { p_status: s.status, p_kind: s.kind || 'all', p_query: s.q || null, p_limit: s.limit, p_offset: s.offset });
    rows = r.rows;
    const c = r.counts || {};
    $('#counts').innerHTML = `<div class="kpis" style="margin-bottom:14px">
      <div class="kpi ${c.new ? 'accent' : ''}"><b>${fmtNum(c.new)}</b><span>sin leer</span></div>
      <div class="kpi ${c.bugs ? 'accent' : ''}"><b>${fmtNum(c.bugs)}</b><span>fallos abiertos</span></div>
      <div class="kpi"><b>${fmtNum(c.planned)}</b><span>las haremos</span></div>
      <div class="kpi"><b>${fmtNum(c.done)}</b><span>hechas</span></div></div>`;
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = (rows.length ? rows.map((f) => `
      <div class="item"><div class="ph">${kindIcon[f.kind] || ms('chat_bubble')}</div><div>
        <h3>${tag(f.kind, 'dim')} ${tag(f.status)} ${f.replied_at ? '<span class="tag ok">respondida</span>' : ''} ${(f.offensive || []).length ? `<span class="tag warn" title="${esc(I18N.t('Detectado automáticamente en el texto'))}">${esc(I18N.t('lenguaje ofensivo'))}: ${esc(f.offensive.map((c) => I18N.t(CAT_OFENSIVA[c] || c)).join(', '))}</span>` : ''}</h3>
        <div class="meta">${fmtDate(f.created_at)} · ${f.user_id ? `<a class="link" href="#/usuarios/${f.user_id}">${esc(f.user_email || f.user_name || 'usuario')}</a>` : (I18N.lang === 'en' ? 'no account' : 'sin cuenta')}${f.from_same_user > 1 ? ` · ${f.from_same_user} ${I18N.lang === 'en' ? 'messages from them' : 'mensajes suyos'}` : ''} · ${esc(f.app_version || '?')} · ${esc(f.platform || '?')}${f.locale ? ' · ' + esc(f.locale) : ''}</div>
        <p style="white-space:pre-wrap">${esc(f.message)}</p>
        ${f.admin_note ? `<div class="meta"><b>Nota interna:</b> ${esc(f.admin_note)}</div>` : ''}
        <div class="actions">
          <button class="btn sm ghost" data-set="${f.id}" data-status="reviewing">La estamos viendo</button>
          <button class="btn sm ghost" data-set="${f.id}" data-status="planned">La haremos</button>
          <button class="btn sm ghost" data-set="${f.id}" data-status="done">Hecho</button>
          <button class="btn sm ghost" data-set="${f.id}" data-status="declined">De momento no</button>
          <button class="btn sm" data-reply="${f.id}">Responder…</button>
          <button class="btn sm ghost" data-note="${f.id}">Nota interna…</button>
          <button class="btn sm bad ghost" data-del="${f.id}" style="margin-left:auto">Borrar…</button>
        </div>
      </div></div>`).join('') : '<div class="tbl-wrap"><div class="empty">Nada por aquí.</div></div>') + pg.html;
    pg.bind($('#list'));
    $$('#list [data-set]').forEach((b) => { b.onclick = () => esperando(b, async () => {
      try { await rpc('admin_set_feedback', { p_id: b.dataset.set, p_status: b.dataset.status }); toast('Actualizada'); refreshBadges(); await load(); } catch (e) { toast(e.message, true); }
    }); });
    $$('#list [data-reply]').forEach((b) => { b.onclick = () => esperando(b, async () => {
      const r2 = await modal({ title: 'Responder', intro: 'Le llega como notificación en la app (y push si lo tiene activado). Sé concreto y breve.', fields: [
        { name: 'reply', label: 'Tu respuesta', type: 'textarea', required: true },
        { name: 'reply_en', label: 'En inglés (opcional)', type: 'textarea', help: 'Lo recibe quien tiene la app en inglés. Si lo dejas vacío, le llega el español.' },
        { name: 'status', label: 'Y marcarla como', type: 'select', value: 'reviewing', options: [['reviewing', 'La estamos viendo'], ['planned', 'La haremos'], ['done', 'Hecho'], ['declined', 'De momento no'], ['new', 'Dejar sin leer']] },
      ], submit: 'Responder' });
      if (!r2) return;
      try { await rpc('admin_set_feedback', { p_id: b.dataset.reply, p_status: r2.status, p_reply: r2.reply, p_reply_en: r2.reply_en || null }); toast('Respuesta enviada'); refreshBadges(); await load(); } catch (e) { toast(e.message, true); }
    }); });
    $$('#list [data-note]').forEach((b) => { b.onclick = () => esperando(b, async () => {
      const f = rows.find((x) => x.id === b.dataset.note);
      const r2 = await modal({ title: 'Nota interna', intro: 'Solo la veis los administradores.', fields: [{ name: 'note', label: 'Nota', type: 'textarea', value: f?.admin_note || '' }] });
      if (!r2) return;
      try { await rpc('admin_set_feedback', { p_id: b.dataset.note, p_note: r2.note }); toast('Guardada'); await load(); } catch (e) { toast(e.message, true); }
    }); });
    $$('#list [data-del]').forEach((b) => { b.onclick = () => esperando(b, async () => {
      if (!await confirmDlg('Borrar mensaje', 'Se borra para siempre. Úsalo solo con spam o duplicados.', { danger: true, submit: 'Borrar' })) return;
      try { await rpc('admin_delete_feedback', { p_id: b.dataset.del }); toast('Borrado'); refreshBadges(); await load(); } catch (e) { toast(e.message, true); }
    }); });
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['status', 'kind'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  $('#csv').onclick = () => downloadCsv('sugerencias', rows, [['created_at', 'fecha'], ['kind', 'tipo'], ['status', 'estado'], ['message', 'mensaje'], ['user_email', 'usuario'], ['app_version', 'versión'], ['platform', 'plataforma'], ['locale', 'idioma'], ['admin_note', 'nota interna'], ['replied_at', 'respondida']]);
  await load();
};

// ── Planes y pagos ──────────────────────────────────────────────────────────
PAGES.planes = async (v) => {
  const p = params(); let tab = p.tab || 'subs';
  v.innerHTML = `
    <div class="page-head"><h1>Planes y pagos</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p><b>Subscriptions</b>: which plan each business has and when it expires. Until card payments are available, payments are made by bank transfer and recorded by hand on the business page (“Record payment”). <b>Payments</b>: history of payments with monthly totals (for the accounts). <b>Plans</b>: there is a single plan with no limits and no commission per redemption: <b>Klendar</b> (<code>standard</code>, €19.90 a month or €199 a year per venue, after the 30-day free trial) and <b>Launch, free</b> (<code>free</code>, while a city is starting up). <b>Founder</b> (<code>founder</code>, €9.90) was withdrawn: it stays hidden and is not offered to anyone new. Chains pay per venue on a sliding scale (2 to 5 venues €15 each, 6 or more €12 each): apply it when you record the subscription. Changing a plan affects the businesses that have it.</p>` : '<p><b>Suscripciones</b>: qué plan tiene cada negocio y cuándo vence. Mientras no haya pago con tarjeta, los cobros se hacen por transferencia y se anotan a mano en la ficha del negocio («Registrar pago»). <b>Pagos</b>: histórico de cobros con totales por mes (para la contabilidad). <b>Planes</b>: hay un solo plan, sin límites y sin comisión por canje: <b>Klendar</b> (<code>standard</code>, 19,90 € al mes o 199 € al año por local, después de la prueba gratis de 30 días) y <b>Gratis de lanzamiento</b> (<code>free</code>, mientras una ciudad está arrancando). <b>Fundador</b> (<code>founder</code>, 9,90 €) se retiró: queda oculto y no se ofrece a nadie nuevo. Las cadenas pagan por local con escalera (de 2 a 5 locales, 15 € cada uno; 6 o más, 12 €): aplícala al registrar la suscripción. Cambiar un plan afecta a los negocios que lo tengan.</p>')}
    <div class="tabs">${[['subs', 'Suscripciones'], ['payments', 'Pagos'], ['plans', 'Planes']].map((t) => `<button data-t="${t[0]}" class="${tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>
    <div id="tabview"></div>`;
  let rows = [], csvCols = [], csvName = 'suscripciones';
  const load = async () => {
    const tv = $('#tabview'); tv.innerHTML = '<div class="loading">Cargando…</div>';
    if (tab === 'subs') {
      const s = st.subs;
      tv.innerHTML = `<div class="toolbar"><select id="sstatus">${[['current', 'Vigentes'], ['trial', 'En prueba'], ['active', 'Activas'], ['past_due', 'Impagadas'], ['cancelled', 'Canceladas'], ['all', 'Todas']].map((o) => `<option value="${o[0]}" ${(s.status || 'current') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div><div id="list"></div>`;
      const r = await rpc('admin_subscriptions', { p_status: s.status || 'current', p_limit: s.limit, p_offset: s.offset });
      rows = r.rows; csvName = 'suscripciones';
      csvCols = [['business', 'negocio'], ['owner_email', 'email'], ['plan', 'plan'], ['status', 'estado'], ['period_start', 'inicio'], ['period_end', 'fin'], ['days_left', 'días restantes'], ['payment_method', 'pago'], [(x) => (x.paid_cents / 100).toFixed(2), 'cobrado (€)']];
      const pg = pager(s, r.total, load);
      $('#list').innerHTML = table({ cols: [
        { h: 'Negocio', r: (x) => `<a class="link" href="#/negocios/${x.business_id}">${esc(x.business)}</a><span class="sub">${esc(x.city || '')} · ${esc(x.owner_email || '')}</span>` },
        { h: 'Plan', r: (x) => `${tag(x.plan, 'dim')} ${fmtMoney(x.price_cents)}/${I18N.lang === 'en' ? 'month' : 'mes'}` }, { h: 'Estado', r: (x) => tag(x.status) },
        { h: 'Periodo', r: (x) => `${fmtDay(x.period_start)} → ${x.period_end ? fmtDay(x.period_end) : '∞'}` },
        { h: 'Vence', r: (x) => x.days_left == null ? '—' : I18N.lang === 'en' ? (x.days_left < 0 ? `<span class="tag bad">${-x.days_left} d ago</span>` : x.days_left <= 7 ? `<span class="tag warn">in ${x.days_left} d</span>` : `in ${x.days_left} d`) : x.days_left < 0 ? `<span class="tag bad">hace ${-x.days_left} d</span>` : x.days_left <= 7 ? `<span class="tag warn">en ${x.days_left} d</span>` : `en ${x.days_left} d` },
        { h: 'Cobrado', num: true, r: (x) => fmtMoney(x.paid_cents) }, { h: 'Pago', r: (x) => esc(x.payment_method || '') },
      ], rows, empty: 'Sin suscripciones.' }) + pg.html;
      pg.bind($('#list'));
      $('#sstatus').onchange = () => { s.status = $('#sstatus').value; s.offset = 0; load(); };
    }
    if (tab === 'payments') {
      const s = st.pagos;
      tv.innerHTML = `<div class="toolbar"><label class="f" style="grid-auto-flow:column;align-items:center">Desde <input type="date" id="from" value="${esc(s.from || '')}"></label><label class="f" style="grid-auto-flow:column;align-items:center">Hasta <input type="date" id="to" value="${esc(s.to || '')}"></label></div><div id="sum"></div><div id="list"></div>`;
      const r = await rpc('admin_payments', { p_from: s.from || null, p_to: s.to || null, p_limit: s.limit, p_offset: s.offset });
      rows = r.rows; csvName = 'pagos';
      csvCols = [['paid_at', 'fecha'], ['business', 'negocio'], ['plan', 'plan'], [(x) => (x.amount_cents / 100).toFixed(2), 'importe (€)'], ['currency', 'moneda'], ['method', 'método'], ['period_start', 'periodo inicio'], ['period_end', 'periodo fin'], ['notes', 'notas'], ['recorded_by', 'registrado por']];
      const months = r.by_month || [];
      $('#sum').innerHTML = `<div class="card"><div class="kpis"><div class="kpi accent"><b>${fmtMoney(r.sum_cents)}</b><span>${I18N.lang === 'en' ? `total for the period (${fmtNum(r.total)} ${r.total === 1 ? 'payment' : 'payments'})` : `total en el periodo (${fmtNum(r.total)} ${r.total === 1 ? 'pago' : 'pagos'})`}</span></div></div>${months.length ? `<p class="muted small" style="margin:10px 0 0">Por mes (12 meses)</p>${bars(months.map((m) => ({ ...m, cents: m.cents })), 'cents', (m) => `${m.month} · ${fmtMoney(m.cents)} (${m.n})`)}<div class="chart-legend">${months.map((m) => `<span>${m.month.slice(5)}: ${fmtMoney(m.cents)}</span>`).join('')}</div>` : ''}</div>`;
      const pg = pager(s, r.total, load);
      $('#list').innerHTML = table({ cols: [
        { h: 'Fecha', r: (x) => `<span class="nowrap">${fmtDate(x.paid_at)}</span>` }, { h: 'Negocio', r: (x) => `<a class="link" href="#/negocios/${x.business_id}">${esc(x.business)}</a> ${tag(x.plan, 'dim')}` },
        { h: 'Importe', num: true, r: (x) => fmtMoney(x.amount_cents, x.currency) }, { h: 'Método', r: (x) => esc(x.method) }, { h: 'Periodo', r: (x) => `${fmtDay(x.period_start)} → ${fmtDay(x.period_end)}` },
        { h: 'Notas', r: (x) => `${esc(x.notes || '')}<span class="sub">${esc(x.recorded_by || '')}</span>` },
      ], rows, empty: 'Sin pagos registrados.' }) + pg.html;
      pg.bind($('#list'));
      ['from', 'to'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
    }
    if (tab === 'plans') {
      const plans = await rpc('admin_plans');
      rows = plans; csvName = 'planes';
      csvCols = [['slug', 'slug'], [(x) => x.names?.es, 'nombre'], [(x) => (x.price_cents / 100).toFixed(2), 'precio (€)'], ['max_active_offers', 'máx. publicaciones activas'], ['boosts_included', 'boosts'], [(x) => x.has_analytics ? 'sí' : 'no', 'estadísticas'], [(x) => x.is_offered === false ? 'no' : 'sí', 'se ofrece'], ['current_subs', 'suscripciones']];
      tv.innerHTML = `<div class="toolbar"><span class="spacer"></span><button class="btn primary sm" id="newplan">Nuevo plan…</button></div>` + table({ cols: [
        { h: 'Plan', r: (x) => `<span class="title">${esc(x.names?.es || x.slug)}<span class="sub">${esc(x.slug)} · ${esc(x.names?.en || '')}</span></span>` },
        { h: 'Precio', num: true, r: (x) => `${fmtMoney(x.price_cents, x.currency)}/${I18N.lang === 'en' ? 'month' : 'mes'}` }, { h: 'Publicaciones activas', num: true, r: (x) => x.max_active_offers ?? 'sin límite' },
        { h: 'Boosts', num: true, r: (x) => x.boosts_included }, { h: 'Estadísticas', r: (x) => x.has_analytics ? 'sí' : 'no' }, { h: 'Se ofrece', r: (x) => x.is_offered === false ? 'no' : 'sí' }, { h: 'Suscripciones', num: true, r: (x) => x.current_subs },
        { h: '', r: (x) => `<button class="btn sm" data-edit="${x.id}">Editar…</button>` },
      ], rows: plans });
      const edit = async (pl) => {
        const r = await modal({ title: pl ? 'Editar plan' : 'Nuevo plan', fields: [
          { name: 'slug', label: 'Identificador (slug)', value: pl?.slug, required: true, help: 'Sin espacios: free, standard…' },
          { name: 'name_es', label: 'Nombre (ES)', value: pl?.names?.es, required: true }, { name: 'name_en', label: 'Nombre (EN)', value: pl?.names?.en },
          { name: 'price', label: 'Precio al mes (€)', type: 'number', step: '0.01', value: pl ? (pl.price_cents / 100).toFixed(2) : '0' },
          { name: 'max', label: 'Máx. publicaciones activas', type: 'number', value: pl?.max_active_offers ?? '', help: 'Vacío = sin límite.' },
          { name: 'boosts', label: 'Boosts incluidos', type: 'number', value: pl?.boosts_included ?? 0 }, { name: 'position', label: 'Orden', type: 'number', value: pl?.position ?? 99 },
          { name: 'analytics', label: 'Incluye estadísticas', type: 'checkbox', value: pl?.has_analytics },
          { name: 'offered', label: 'Se ofrece al cambiar de plan', type: 'checkbox', value: pl ? pl.is_offered !== false : true, help: 'Apagado, quien ya lo tiene lo conserva, pero no se asigna a nadie más.' },
        ] });
        if (!r) return;
        try {
          await rpc('admin_upsert_plan', { p: { id: pl?.id, slug: r.slug, names: { es: r.name_es, en: r.name_en || r.name_es }, price_cents: Math.round(parseFloat(r.price.replace(',', '.') || '0') * 100), currency: 'EUR', max_active_offers: r.max === '' ? null : +r.max, boosts_included: +r.boosts || 0, has_analytics: r.analytics, position: +r.position || 99, is_offered: r.offered } });
          toast('Plan guardado'); load();
        } catch (e) { toast(e.message, true); }
      };
      $('#newplan').onclick = () => edit(null);
      $$('[data-edit]').forEach((b) => { b.onclick = () => esperando(b, () => edit(plans.find((x) => x.id === b.dataset.edit))); });
    }
  };
  $$('.tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); }; });
  $('#csv').onclick = () => downloadCsv(csvName, rows, csvCols);
  await load();
};

/** Los campos de una notificación a mano: español obligatorio, inglés si se
 * quiere (lo recibe quien tiene la app en inglés). */
const CAMPOS_AVISO = [
  { name: 'title', label: 'Título', required: true },
  { name: 'body', label: 'Texto', type: 'textarea', required: true },
  { name: 'title_en', label: 'Título en inglés (opcional)' },
  { name: 'body_en', label: 'Texto en inglés (opcional)', type: 'textarea', help: 'Lo recibe quien tiene la app en inglés. Si lo dejas vacío, le llega el español.' },
];
/** Lo escrito → parámetros de `admin_send_notification` (vacío = sin inglés). */
const textosAviso = (r) => ({
  p_title: String(r.title || '').trim(), p_body: String(r.body || '').trim(),
  p_title_en: String(r.title_en || '').trim() || null, p_body_en: String(r.body_en || '').trim() || null,
});

// ── Notificaciones y push ───────────────────────────────────────────────────────────
PAGES.avisos = async (v) => {
  const p = params(); let tab = p.tab || 'send';
  v.innerHTML = `
    <div class="page-head"><h1>Notificaciones y push</h1></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p><b>Send notification</b>: sends a notification (in the app and by push) to every user, users only, businesses only, or the businesses in one city. Use it sparingly (important news, incidents); everything is logged. <b>Push queue</b>: what the system is sending; if something fails (expired token, Firebase error) you'll see why and can retry.</p>` : '<p><b>Enviar notificación</b>: manda una notificación (en la app y por push) a todos los usuarios, solo a usuarios, solo a los negocios, o a los negocios de una ciudad. Úsalo con moderación (novedades importantes, incidencias); todo queda en el registro. <b>Cola de push</b>: lo que el sistema está enviando; si algo falla (token caducado, error de Firebase) verás el motivo y podrás reintentar.</p>')}
    <div class="tabs">${[['send', 'Enviar notificación'], ['history', 'Enviados'], ['push', 'Cola de push']].map((t) => `<button data-t="${t[0]}" class="${tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>
    <div id="tabview"></div>`;
  const load = async () => {
    const tv = $('#tabview'); tv.innerHTML = '<div class="loading">Cargando…</div>';
    if (tab === 'send') {
      tv.innerHTML = `<div class="card" style="max-width:640px"><form id="sendf" style="display:grid;gap:12px">
        <label class="f"><span>Destinatarios</span><select name="audience"><option value="all">Todos los usuarios</option><option value="users">Solo usuarios (no negocios)</option><option value="business_owners">Propietarios y encargados de negocios</option><option value="city">Negocios de una ciudad…</option></select></label>
        <label class="f" id="cityf" hidden><span>Ciudad</span><input name="city" placeholder="Madrid"></label>
        <label class="f"><span>Título</span><input name="title" required maxlength="80"></label>
        <label class="f"><span>Texto</span><textarea name="body" required maxlength="300"></textarea></label>
        <label class="f"><span>Título en inglés <small>(opcional)</small></span><input name="title_en" maxlength="80" lang="en"></label>
        <label class="f"><span>Texto en inglés <small>(opcional)</small></span><textarea name="body_en" maxlength="300" lang="en"></textarea></label>
        <p class="muted small" style="margin:-4px 0 0">Lo recibe quien tiene la app en inglés. Si lo dejas vacío, le llega el español.</p>
        <label class="f"><span>Ruta al pulsar <small>(opcional, p. ej. /explore)</small></span><input name="route" placeholder="/explore"></label>
        <div><button class="btn primary" type="submit">Enviar notificación…</button></div></form></div>`;
      const f = $('#sendf');
      // Los campos, por `elements`: `f.title` o `f.name` chocan con propiedades
      // del propio formulario y se leen distinto según el navegador.
      const c = f.elements;
      c.audience.onchange = () => { $('#cityf').hidden = c.audience.value !== 'city'; };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const aud = c.audience.value;
        if (aud === 'city' && !c.city.value.trim()) { toast('Escribe la ciudad.', true); c.city.focus(); return; }
        const boton = f.querySelector('[type=submit]');
        if (boton.disabled) return;
        if (!await confirmDlg('Enviar notificación', I18N.lang === 'en' ? `“${esc(c.title.value)}” will be sent to: <b>${esc($('option:checked', c.audience).textContent)}${aud === 'city' ? ' ' + esc(c.city.value) : ''}</b>. This can't be undone.` : `Se enviará «${esc(c.title.value)}» a: <b>${esc($('option:checked', c.audience).textContent)}${aud === 'city' ? ' ' + esc(c.city.value) : ''}</b>. No se puede deshacer.`, { submit: 'Enviar' })) return;
        // Bloqueado mientras va: un segundo clic lo mandaría dos veces a todos.
        await esperando(boton, async () => {
          try { const n = await rpc('admin_send_notification', { p_audience: aud, ...textosAviso({ title: c.title.value, body: c.body.value, title_en: c.title_en.value, body_en: c.body_en.value }), p_route: c.route.value.trim() || null, p_city: aud === 'city' ? c.city.value.trim() : null }); toast(I18N.lang === 'en' ? `Notification sent to ${n} ${n === 1 ? 'person' : 'people'}` : `Notificación enviada a ${n} ${n === 1 ? 'persona' : 'personas'}`); f.reset(); $('#cityf').hidden = true; } catch (err) { toast(err.message, true); }
        });
      };
    }
    if (tab === 'history') {
      const r = await rpc('admin_audit', { p_action: 'notification.send', p_limit: 100 });
      tv.innerHTML = table({ cols: [{ h: 'Fecha', r: (x) => `<span class="nowrap">${fmtDate(x.created_at)}</span>` }, { h: 'Notificación', r: (x) => `<span class="title">${esc(x.details?.title)}<span class="sub">${esc(x.details?.body)}</span></span>` }, { h: 'Destinatarios', r: (x) => `${esc(I18N.t(AUDIENCIAS[x.details?.audience] || x.details?.audience || ''))}${x.details?.city ? ' ' + esc(x.details.city) : ''} · ${x.details?.recipients ?? '?'}` }, { h: 'Por', r: (x) => esc(x.admin_email || '') }], rows: r.rows, empty: 'Todavía no se ha enviado ninguna notificación.' });
    }
    if (tab === 'push') {
      tv.innerHTML = `<div class="toolbar"><select id="pstatus">${[['all', 'Todos'], ['pending', 'Pendientes'], ['sent', 'Enviados'], ['failed', 'Fallidos'], ['skipped', 'Omitidos']].map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div><div id="list"></div>`;
      const loadQ = async () => {
        const rows = await rpc('admin_push_queue', { p_status: $('#pstatus').value, p_limit: 200 });
        $('#list').innerHTML = table({ cols: [{ h: 'Creado', r: (x) => `<span class="nowrap">${fmtDate(x.created_at)}</span>` }, { h: 'Usuario', r: (x) => esc(x.user_email || '—') }, { h: 'Notificación', r: (x) => `<span class="title">${esc(x.title)}<span class="sub">${esc(x.body || '')} · ${esc(x.kind || '')}</span></span>` }, { h: 'Estado', r: (x) => `${tag(x.status)} ${x.attempts ? `<span class="muted small">${x.attempts} ${I18N.lang === 'en' ? (x.attempts === 1 ? 'attempt' : 'attempts') : (x.attempts === 1 ? 'intento' : 'intentos')}</span>` : ''}${x.error ? `<span class="sub">${esc(x.error)}</span>` : ''}` }, { h: 'Enviado', r: (x) => fmtDate(x.sent_at) }, { h: '', r: (x) => ['failed', 'skipped'].includes(x.status) ? `<button class="btn sm" data-retry="${x.id}">Reintentar</button>` : '' }], rows, empty: 'Cola vacía.' });
        $$('#list [data-retry]').forEach((b) => { b.onclick = () => esperando(b, async () => { try { await rpc('admin_push_retry', { p_id: +b.dataset.retry }); toast('Reencolado'); await loadQ(); } catch (e) { toast(e.message, true); } }); });
      };
      $('#pstatus').onchange = loadQ; await loadQ();
    }
  };
  $$('.tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); }; });
  await load();
};

// ── Categorías ──────────────────────────────────────────────────────────────
PAGES.categorias = async (v) => {
  const cats = await rpc('admin_categories');
  const byId = Object.fromEntries(cats.map((c) => [c.id, c]));
  v.innerHTML = `
    <div class="page-head"><h1>Categorías</h1><span class="spacer"></span><button class="btn primary sm" id="new">Nueva categoría…</button></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p>The categories used to classify businesses and publications (the app's filters). The <b>slug</b> is the internal identifier (don't change it if it's already in use); the icon is a Material Symbols name, as in the app (local_bar, restaurant…). Only an empty category can be deleted.</p>` : '<p>Las categorías con las que se clasifican negocios y publicaciones (filtros de la app). El <b>slug</b> es el identificador interno (no lo cambies si ya está en uso); el icono es el nombre de un icono de Material Symbols, como en la app (local_bar, restaurant…). Solo se puede borrar una categoría vacía.</p>')}
    ${table({ cols: [
      { h: 'Categoría', r: (c) => `<span class="ph" style="font-size:20px">${c.icon ? ms(esc(c.icon)) : '·'}</span><span class="title">${esc(c.names?.[I18N.lang] || c.names?.es || c.slug)}<span class="sub">${esc(c.slug)} · EN: ${esc(c.names?.en || '—')}${c.parent_id ? ` · ${I18N.lang === 'en' ? 'under' : 'dentro de'} ${esc(byId[c.parent_id]?.names?.es || '')}` : ''}</span></span>` },
      { h: 'Orden', num: true, r: (c) => c.position }, { h: 'Negocios', num: true, r: (c) => c.businesses }, { h: 'Publicaciones', num: true, r: (c) => c.offers },
      { h: '', r: (c) => `<span class="actions"><button class="btn sm" data-edit="${c.id}">Editar…</button>${(c.businesses || c.offers) ? '' : `<button class="btn sm bad ghost" data-del="${c.id}">Borrar</button>`}</span>` },
    ], rows: cats, empty: 'Sin categorías.' })}`;
  const edit = async (c) => {
    const r = await modal({ title: c ? 'Editar categoría' : 'Nueva categoría', fields: [
      { name: 'slug', label: 'Slug', value: c?.slug, required: true }, { name: 'icon', label: 'Icono (nombre de Material Symbols, como en la app: local_bar, restaurant…)', value: c?.icon },
      { name: 'es', label: 'Nombre (ES)', value: c?.names?.es, required: true }, { name: 'en', label: 'Nombre (EN)', value: c?.names?.en },
      { name: 'parent_id', label: 'Categoría superior', type: 'select', value: c?.parent_id || '', options: [['', '— (principal)'], ...cats.filter((x) => x.id !== c?.id).map((x) => [x.id, x.names?.[I18N.lang] || x.names?.es || x.slug])] },
      { name: 'position', label: 'Orden', type: 'number', value: c?.position ?? 99 },
    ] });
    if (!r) return;
    try { await rpc('admin_upsert_category', { p: { id: c?.id, slug: r.slug, icon: r.icon || null, names: { es: r.es, en: r.en || r.es }, parent_id: r.parent_id || null, position: +r.position || 99 } }); toast('Categoría guardada'); route(); } catch (e) { toast(e.message, true); }
  };
  $('#new').onclick = () => edit(null);
  $$('[data-edit]').forEach((b) => { b.onclick = () => esperando(b, () => edit(byId[b.dataset.edit])); });
  $$('[data-del]').forEach((b) => { b.onclick = () => esperando(b, async () => { if (!await confirmDlg('Borrar categoría', 'Solo se puede si no la usa ningún negocio ni publicación.', { danger: true, submit: 'Borrar' })) return; try { await rpc('admin_delete_category', { p_id: b.dataset.del }); toast('Borrada'); route(); } catch (e) { toast(e.message, true); } }); });
};

// ── Ciudades ────────────────────────────────────────────────────────────────
// Los números globales no dicen dónde hay que arrimar el hombro. Esto sí:
// ciudad por ciudad, y dentro de una ciudad, negocio por negocio.
PAGES.ciudades = async (v, param) => {
  const days = 30;
  if (param) return cityDetail(v, decodeURIComponent(param), days);
  const rows = await rpc('admin_cities', { p_days: days });
  const ratio = (a, b) => (!b ? '—' : (a / b).toFixed(1).replace('.', ','));
  v.innerHTML = `
    <div class="page-head"><h1>Ciudades</h1><span class="muted small">${I18N.lang === 'en' ? `last ${days} days` : `últimos ${days} días`}</span></div>
    <div class="card">${table({
      cols: [
        { h: 'Ciudad', r: (c) => `<a class="link" href="#/ciudades/${encodeURIComponent(c.city)}"><b>${esc(c.city)}</b></a>` },
        { h: 'Negocios', num: true, r: (c) => `${fmtNum(c.negocios)} <span class="muted small">(${fmtNum(c.verificados)} ${I18N.lang === 'en' ? 'verified' : 'verif.'})</span>` },
        { h: 'Publicaciones', num: true, r: (c) => fmtNum(c.publicaciones) },
        { h: 'Activas ahora', num: true, r: (c) => fmtNum(c.activas) },
        { h: 'Vistas', num: true, r: (c) => fmtNum(c.vistas) },
        { h: 'Canjes', num: true, r: (c) => fmtNum(c.canjes) },
        { h: 'Publicaciones por negocio', num: true, r: (c) => ratio(c.publicaciones, c.negocios) },
      ],
      rows,
      empty: 'Todavía no hay ningún negocio con ciudad.',
    })}</div>
    <p class="muted small">«Publicaciones por negocio» es la cifra que más dice: por debajo de 1 al mes, esa ciudad está dada de alta pero no viva.</p>`;
};

async function cityDetail(v, city, days) {
  const d = await rpc('admin_city_detail', { p_city: city, p_days: days }) || {};
  const biz = d.businesses || [];
  const weeks = d.weekly || [];
  const max = Math.max(1, ...weeks.map((w) => w.published));
  const dormidos = biz.filter((b) => b.published === 0).length;
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/ciudades">← Ciudades</a><h1>${esc(city)}</h1>
      <span class="muted small">${I18N.lang === 'en' ? `last ${days} days` : `últimos ${days} días`}</span></div>
    <div class="card"><h2>Publicaciones por semana</h2>
      <div class="spark">${weeks.map((w) => `<i title="${I18N.lang === 'en' ? 'Week of' : 'Semana del'} ${w.week}: ${w.published}" style="height:${Math.round((w.published / max) * 100)}%"></i>`).join('')}</div>
      <p class="muted small" style="margin:8px 0 0">Doce semanas. Si baja y no sube, es que los negocios se han enfriado.</p>
    </div>
    <div class="card"><h2>Negocios</h2>
      ${dormidos ? `<p class="muted" style="margin:0 0 10px"><b>${dormidos}</b> ${I18N.lang === 'en' ? (dormidos === 1 ? "hasn't published anything in this period: that's the one to call." : "haven't published anything in this period: these are the ones to call.") : (dormidos === 1 ? 'no ha publicado nada en este periodo: es al que hay que llamar.' : 'no han publicado nada en este periodo: son los que hay que llamar.')}</p>` : ''}
      ${table({
        cols: [
          { h: 'Negocio', r: (b) => `<a class="link" href="#/negocios/${esc(b.id)}"><b>${esc(b.name)}</b></a><span class="sub">${I18N.lang === 'en' ? 'joined' : 'alta'} ${fmtDate(b.created_at)}</span>` },
          { h: 'Estado', r: (b) => tag(b.status) },
          { h: 'Activas', num: true, r: (b) => fmtNum(b.active) },
          { h: 'Publicadas', num: true, r: (b) => (b.published ? fmtNum(b.published) : '<span class="muted">0</span>') },
          { h: 'Canjes', num: true, r: (b) => fmtNum(b.redeemed) },
        ],
        rows: biz,
        empty: 'Ningún negocio en esta ciudad.',
      })}
    </div>`;
}

// ── Colecciones ─────────────────────────────────────────────────────────────
PAGES.colecciones = async (v, param) => {
  const cols = await rpc('admin_collections');
  if (param) return pintaADedo(v, cols.find((c) => c.id === param));
  const cats = await rpc('admin_categories').catch(() => []);
  const byId = Object.fromEntries(cols.map((c) => [c.id, c]));
  const en = I18N.lang === 'en';
  const ruleText = (r = {}) => [
    r.kind === 'flash_offer' ? (en ? 'offers' : 'ofertas') : r.kind === 'future_event' ? (en ? 'events' : 'eventos') : null,
    r.when === 'today' ? (en ? 'today' : 'hoy') : r.when === 'weekend' ? (en ? 'weekend' : 'fin de semana') : r.when === 'next7' ? (en ? 'next 7 days' : 'próximos 7 días') : null,
    r.max_price_cents != null ? (en ? `up to ${fmtMoney(r.max_price_cents)}` : `hasta ${fmtMoney(r.max_price_cents)}`) : null,
    r.discount_only ? (en ? 'discounted only' : 'solo con descuento') : null,
    r.new_days ? (en ? `published in the last ${r.new_days} days` : `publicado en ${r.new_days} días`) : null,
    r.categories?.length ? (en ? `${r.categories.length} ${r.categories.length === 1 ? 'category' : 'categories'}` : `${r.categories.length} ${r.categories.length === 1 ? 'categoría' : 'categorías'}`) : null,
  ].filter(Boolean).join(' · ') || (en ? 'everything nearby' : 'todo lo que haya cerca');
  v.innerHTML = `
    <div class="page-head"><h1>Colecciones</h1><span class="spacer"></span><button class="btn primary sm" id="new">Nueva colección…</button></div>
    ${helpBox('¿Qué es esto?', en ? `<p>Named selections that appear in Discover (“Plans for the weekend”, “Cheap and good”). There are two ways to fill them:</p><p><b>By rule</b>: you define what fits (type, when, price, category) and the app shows whatever is near each person. <b>By hand</b>: you pick the publications one by one, in the order you want. A collection with hand-picked items shows <b>only those</b> and its rule is ignored.</p><p>Hand-picked items still go through the usual filter: if a publication expires or the business takes it down, it drops out of the collection by itself. You can limit collections to a <b>city</b> and give them <b>dates</b>: a collection for a local fair appears and disappears by itself.</p>` : '<p>Selecciones con nombre que aparecen en Descubre («Planes para el finde», «Barato y bueno»). Hay dos maneras de llenarlas:</p><p><b>Por regla</b>: defines qué encaja (tipo, cuándo, precio, categoría) y la app enseña lo que haya cerca de cada persona. <b>A dedo</b>: eliges las publicaciones una a una y en el orden que quieras. Una colección con piezas a dedo enseña <b>solo esas</b> y su regla se ignora.</p><p>Lo elegido a dedo sigue pasando por el filtro de siempre: si una publicación caduca o el negocio la retira, se cae sola de la colección. Puedes limitarlas a una <b>ciudad</b> y ponerles <b>fechas</b>: una colección de feria aparece y desaparece sola.</p>')}
    ${table({ cols: [
      { h: 'Colección', r: (c) => `<span class="title">${esc(c.title?.es || c.slug)}<span class="sub">${esc(c.slug)}${c.city ? ' · ' + esc(c.city) : ''} · ${esc(ruleText(c.rules))}</span></span>` },
      { h: 'Estado', r: (c) => c.is_active ? tag('active') : tag('draft') },
      { h: 'Vigencia', r: (c) => (c.active_from || c.active_until) ? `<span class="small nowrap">${c.active_from ? fmtDay(c.active_from) : '—'} → ${c.active_until ? fmtDay(c.active_until) : '—'}</span>` : 'siempre' },
      { h: 'Orden', num: true, r: (c) => c.position },
      { h: '', r: (c) => `<span class="actions"><a class="btn sm" href="#/colecciones/${c.id}">Elegir a dedo…</a><button class="btn sm" data-edit="${c.id}">Editar…</button><button class="btn sm bad ghost" data-del="${c.id}">Borrar</button></span>` },
    ], rows: cols, empty: 'Todavía no hay colecciones.' })}`;
  const edit = async (c) => {
    const r = await modal({ title: c ? 'Editar colección' : 'Nueva colección', fields: [
      { name: 'slug', label: 'Slug (identificador)', value: c?.slug, required: true, placeholder: 'planes-finde' },
      { name: 'es', label: 'Título (ES)', value: c?.title?.es, required: true },
      { name: 'en', label: 'Título (EN)', value: c?.title?.en },
      { name: 'sub_es', label: 'Subtítulo (ES)', value: c?.subtitle?.es },
      { name: 'sub_en', label: 'Subtítulo (EN)', value: c?.subtitle?.en },
      { name: 'kind', label: 'Qué incluye', type: 'select', value: c?.rules?.kind || '', options: [['', 'Ofertas y eventos'], ['flash_offer', 'Solo ofertas flash'], ['future_event', 'Solo eventos']] },
      { name: 'when', label: 'Cuándo', type: 'select', value: c?.rules?.when || '', options: [['', 'Cualquier momento'], ['today', 'Hoy'], ['weekend', 'Fin de semana'], ['next7', 'Próximos 7 días']] },
      { name: 'max_price', label: 'Precio máximo (€, opcional)', value: c?.rules?.max_price_cents != null ? (c.rules.max_price_cents / 100).toFixed(2) : '' },
      { name: 'discount_only', label: 'Solo con descuento', type: 'checkbox', value: !!c?.rules?.discount_only },
      { name: 'new_days', label: 'Publicado en los últimos N días (opcional)', type: 'number', value: c?.rules?.new_days ?? '' },
      { name: 'category_id', label: 'Categoría (opcional)', type: 'select', value: c?.rules?.categories?.[0] || '', options: [['', '— todas'], ...cats.map((x) => [x.id, x.names?.[I18N.lang] || x.names?.es || x.slug])] },
      { name: 'city', label: 'Ciudad (opcional)', value: c?.city || '' },
      { name: 'position', label: 'Orden', type: 'number', value: c?.position ?? 50 },
      { name: 'active_from', label: 'Desde (opcional)', type: 'date', value: c?.active_from ? c.active_from.slice(0, 10) : '' },
      { name: 'active_until', label: 'Hasta (opcional)', type: 'date', value: c?.active_until ? c.active_until.slice(0, 10) : '' },
      { name: 'is_active', label: 'Activa', type: 'checkbox', value: c ? c.is_active : true },
    ] });
    if (!r) return;
    const rules = {};
    if (r.kind) rules.kind = r.kind;
    if (r.when) rules.when = r.when;
    if (r.max_price) rules.max_price_cents = Math.round(parseFloat(r.max_price.replace(',', '.')) * 100);
    if (r.discount_only) rules.discount_only = true;
    if (r.new_days) rules.new_days = +r.new_days;
    if (r.category_id) rules.categories = [r.category_id];
    try {
      await rpc('admin_save_collection', {
        p_id: c?.id || null, p_slug: r.slug,
        p_title: { es: r.es, en: r.en || r.es },
        p_subtitle: (r.sub_es || r.sub_en) ? { es: r.sub_es || '', en: r.sub_en || r.sub_es || '' } : null,
        p_rules: rules, p_city: r.city || null, p_position: +r.position || 50,
        p_is_active: r.is_active,
        p_active_from: r.active_from || null, p_active_until: r.active_until || null,
      });
      toast('Colección guardada'); route();
    } catch (e) { toast(e.message, true); }
  };
  $('#new').onclick = () => edit(null);
  $$('[data-edit]').forEach((b) => { b.onclick = () => esperando(b, () => edit(byId[b.dataset.edit])); });
  $$('[data-del]').forEach((b) => { b.onclick = () => esperando(b, async () => {
    if (!await confirmDlg('Borrar colección', 'Deja de aparecer en Descubre. Las publicaciones no se tocan.', { danger: true, submit: 'Borrar' })) return;
    try { await rpc('admin_delete_collection', { p_id: b.dataset.del }); toast('Borrada'); route(); } catch (e) { toast(e.message, true); }
  }); });
};

/** Las publicaciones de una colección, elegidas a mano y en orden. */
async function pintaADedo(v, c) {
  if (!c) { go('#/colecciones'); return; }
  let busqueda = '';

  const dibuja = async () => {
    const [dentro, fuera] = await Promise.all([
      rpc('admin_collection_items', { p_collection: c.id }),
      busqueda.trim().length >= 2
        ? rpc('admin_offers_page', {
          p_moderation: 'all', p_status: 'all', p_kind: 'all',
          p_query: busqueda.trim(), p_business: null, p_limit: 15, p_offset: 0,
        }).catch((e) => { if (!e?.obsoleta) toast(e.message, true); return { rows: [] }; })
        : Promise.resolve({ rows: [] }),
    ]);
    const items = dentro?.items || [];
    const dentroYa = new Set(items.map((x) => x.offer_id));
    const candidatas = (fuera?.rows || []).filter((o) => !dentroYa.has(o.id));
    // Se repinta todo, buscador incluido: lo escrito mientras tanto, el foco
    // y el cursor se quedan como estaban para poder seguir escribiendo.
    const qAntes = $('#q', v);
    const escribiendo = qAntes && document.activeElement === qAntes;
    const cursor = escribiendo ? qAntes.selectionStart : null;
    if (qAntes) busqueda = qAntes.value;

    v.innerHTML = `
      <div class="page-head"><a class="btn sm ghost" href="#/colecciones">← Colecciones</a>
        <h1>${esc(c.title?.es || c.slug)}</h1></div>
      ${helpBox('¿Cómo va esto?', I18N.lang === 'en' ? `<p>Whatever you put here is shown <b>in this order</b> and instead of the collection's rule. If the list ends up empty, the rule takes over again.</p><p>An expired or taken-down publication stops showing by itself: you don't need to remove it.</p>` : '<p>Lo que pongas aquí se enseña <b>en este orden</b> y en lugar de la regla de la colección. Si la lista se queda vacía, vuelve a mandar la regla.</p><p>Una publicación caducada o retirada deja de verse sola: no hace falta que la quites.</p>')}
      <div class="card"><h2>En la colección</h2>${table({
        cols: [
          { h: '#', num: true, r: (x, i) => i + 1 },
          { h: 'Publicación', r: (x) => `<span class="title">${esc(x.title)}<span class="sub">${esc(x.business_name || '')}${x.city ? ' · ' + esc(x.city) : ''}</span></span>` },
          { h: 'Se ve', r: (x) => x.visible ? tag('active') : '<span class="muted">ahora no</span>' },
          { h: '', r: (x) => `<span class="actions">
              <button class="btn sm" data-move="${esc(x.offer_id)}" data-delta="-1">↑</button>
              <button class="btn sm" data-move="${esc(x.offer_id)}" data-delta="1">↓</button>
              <button class="btn sm bad ghost" data-out="${esc(x.offer_id)}">Quitar</button></span>` },
        ],
        rows: items,
        empty: 'Todavía no has elegido ninguna: manda la regla de la colección.',
      })}</div>
      <div class="card"><h2>Añadir</h2>
        <label class="f"><span>Buscar publicación</span><input id="q" value="${esc(busqueda)}" placeholder="Título o negocio…"></label>
        ${candidatas.length ? table({
          cols: [
            { h: 'Publicación', r: (o) => `<span class="title">${esc(o.title)}<span class="sub">${esc(o.business_name || '')} · ${esc(I18N.t(LABELS[o.kind]))}</span></span>` },
            { h: 'Estado', r: (o) => `${tag(o.status)} ${modTag(o.moderation_status)}` },
            { h: '', r: (o) => `<button class="btn sm" data-in="${esc(o.id)}">Añadir</button>` },
          ],
          rows: candidatas,
        }) : `<p class="muted">${busqueda.trim().length >= 2 ? 'Nada con ese nombre.' : 'Escribe al menos dos letras.'}</p>`}
      </div>`;

    const q = $('#q', v);
    if (escribiendo) { q.focus(); q.setSelectionRange(cursor, cursor); }
    q.oninput = debounce(() => { busqueda = q.value; dibuja(); });
    // Cada botón, bloqueado mientras va (un doble clic subía dos puestos) y
    // con el error dicho si falla.
    const accion = (b, trabajo) => esperando(b, async () => {
      try { await trabajo(); await dibuja(); } catch (e) { toast(e.message, true); }
    });
    $$('[data-in]', v).forEach((b) => { b.onclick = () => accion(b, async () => {
      await rpc('admin_collection_add', { p_collection: c.id, p_offer: b.dataset.in });
      toast('Añadida');
    }); });
    $$('[data-out]', v).forEach((b) => { b.onclick = () => accion(b, () => rpc('admin_collection_remove', { p_collection: c.id, p_offer: b.dataset.out })); });
    $$('[data-move]', v).forEach((b) => { b.onclick = () => accion(b, () => rpc('admin_collection_move', { p_collection: c.id, p_offer: b.dataset.move, p_delta: +b.dataset.delta })); });
  };

  await dibuja();
}

// ── Configuración ───────────────────────────────────────────────────────────
PAGES.configuracion = async (v) => {
  const cfg = await rpc('admin_config');
  const mv = cfg.min_version?.value || {}, mt = cfg.maintenance?.value || {}, sp = cfg.send_push?.value || {};
  const rl = cfg.rules?.value || {};
  const limits = await rpc('admin_rate_limits', { p_limit: 50 });
  v.innerHTML = `
    <div class="page-head"><h1>Configuración</h1></div>
    ${helpBox('¿Qué hago aquí?', I18N.lang === 'en' ? `<p><b>Minimum version</b>: if a user opens an older version of the app, they're asked to update (useful after breaking changes). <b>Maintenance</b>: blocks the app with a message while you make a delicate change. <b>Push delivery</b>: address of the function that sends the notifications (don't touch it unless the project changes). Below, maintenance tools and usage of the anti-abuse limits.</p>` : '<p><b>Versión mínima</b>: si un usuario abre una versión más antigua de la app, se le pide actualizar (útil tras cambios incompatibles). <b>Mantenimiento</b>: bloquea la app con un mensaje mientras haces un cambio delicado. <b>Envío de push</b>: dirección de la función que manda las notificaciones (no la toques salvo que cambie el proyecto). Abajo, herramientas de mantenimiento y el uso de los límites anti-abuso.</p>')}
    <div class="grid2">
      <div class="card"><h2>Versión mínima de la app</h2><form id="mvf" style="display:grid;gap:10px"><label class="f"><span>Android</span><input name="android" value="${esc(mv.android || '')}" placeholder="0.1.0"></label><label class="f"><span>iOS</span><input name="ios" value="${esc(mv.ios || '')}" placeholder="0.1.0"></label><div><button class="btn sm">Guardar</button> <span class="muted small">${I18N.lang === 'en' ? 'updated' : 'actualizado'} ${fmtDate(cfg.min_version?.updated_at)}</span></div></form></div>
      <div class="card"><h2>Modo mantenimiento</h2><form id="mtf" style="display:grid;gap:10px"><label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="enabled" ${mt.enabled ? 'checked' : ''}><span>App en mantenimiento (bloquea a todos los usuarios)</span></label><label class="f"><span>Mensaje</span><textarea name="message">${esc(mt.message || '')}</textarea></label><div><button class="btn ${mt.enabled ? 'bad' : ''} sm">Guardar</button> <span class="muted small">${I18N.lang === 'en' ? 'updated' : 'actualizado'} ${fmtDate(cfg.maintenance?.updated_at)}</span></div></form></div>
      <div class="card"><h2>Reglas de publicación</h2><form id="rlf" style="display:grid;gap:10px">
        <label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="block2x1" ${rl.block_2x1_alcohol === true ? 'checked' : ''}><span>Bloquear promociones <b>2x1 en bebidas alcohólicas</b></span></label>
        <p class="muted small" style="margin:0">${I18N.lang === 'en' ? `Off, which is how it is now: the business declares whether its two-for-one includes alcohol and, if it says yes, the publication is marked <b>over-18s only</b>. On, it simply won't let them publish it. Context for deciding: Law 34/1988 and several regional laws ban promotions that encourage drinking more for the same money (“2x1”, “open bar”), even if the venue is adults-only, and the fine falls on the advertising business.` : `Apagado, que es como está ahora: el negocio declara si su 2x1 lleva alcohol y, si dice que sí, la publicación sale marcada <b>solo para mayores de 18</b>. Encendido, directamente no deja publicarla. Contexto para decidir: la Ley 34/1988 y varias leyes autonómicas prohíben las promociones que incentivan beber más por el mismo dinero («2x1», «barra libre»), aunque el local sea solo para mayores, y la sanción recae en el negocio anunciante.`}</p>
        <div><button class="btn sm">Guardar</button> <span class="muted small">${I18N.lang === 'en' ? 'updated' : 'actualizado'} ${fmtDate(cfg.rules?.updated_at)}</span></div></form></div>
      <div class="card"><h2>Envío de push</h2><form id="spf" style="display:grid;gap:10px"><label class="f"><span>URL de la función</span><input name="url" value="${esc(sp.url || '')}"></label><label class="f"><span>Clave</span><input name="key" type="password" autocomplete="off" value="${esc(sp.key || '')}"></label><div><button class="btn sm">Guardar</button></div></form></div>
      <div class="card"><h2>Mantenimiento</h2><p class="muted small">Las publicaciones caducan solas cada 5 minutos (cron). Si ves alguna caducada que sigue apareciendo, fuerza la comprobación.</p><div class="actions"><button class="btn sm" id="expire">Caducar publicaciones vencidas ahora</button></div>
        <h3 style="margin-top:16px">Límites anti-abuso (últimas 24 h)</h3>${table({ cols: [{ h: 'Usuario', r: (x) => esc(x.user_email || '—') }, { h: 'Acción', r: (x) => esc(x.action) }, { h: 'Ventana', r: (x) => fmtDate(x.window_start) }, { h: 'Intentos', num: true, r: (x) => x.hits }], rows: limits, empty: 'Nadie ha tocado un límite.' })}</div>
    </div>`;
  const save = (key, value) => rpc('admin_set_config', { p_key: key, p_value: value }).then(() => { toast('Guardado'); route(); }).catch((e) => toast(e.message, true));
  // Cada formulario bloquea su botón mientras pregunta y guarda. Los campos,
  // por `elements` (un campo llamado como una propiedad del formulario, tipo
  // `name` o `title`, choca con ella).
  const alGuardar = (form, trabajo) => {
    form.onsubmit = (e) => {
      e.preventDefault();
      const boton = form.querySelector('button:not([type]), button[type=submit]');
      esperando(boton, () => trabajo(form.elements));
    };
  };
  alGuardar($('#mvf'), async (c) => { if (!await confirmDlg('Cambiar la versión mínima', 'Quien tenga una versión anterior tendrá que actualizar para seguir usando la app.', { danger: true, submit: 'Guardar' })) return; await save('min_version', { android: c.android.value.trim(), ios: c.ios.value.trim() }); });
  alGuardar($('#mtf'), async (c) => { if (c.enabled.checked && !await confirmDlg('Activar mantenimiento', 'Todos los usuarios verán el mensaje y no podrán usar la app hasta que lo desactives.', { danger: true, submit: 'Activar' })) return; await save('maintenance', { enabled: c.enabled.checked, message: c.message.value.trim() || null }); });
  alGuardar($('#spf'), async (c) => { if (!await confirmDlg('Cambiar el envío de push', 'Si la dirección o la clave están mal, dejarán de llegar todas las notificaciones push.', { danger: true, submit: 'Guardar' })) return; await save('send_push', { url: c.url.value.trim(), key: c.key.value.trim() }); });
  alGuardar($('#rlf'), (c) => save('rules', { block_2x1_alcohol: c.block2x1.checked }));
  $('#expire').onclick = (ev) => esperando(ev.currentTarget, async () => { try { const n = await rpc('admin_run_expire_offers'); toast(I18N.lang === 'en' ? `${n} ${n === 1 ? 'publication' : 'publications'} expired` : `${n} ${n === 1 ? 'publicación caducada' : 'publicaciones caducadas'}`); } catch (e) { toast(e.message, true); } });
};

// ── Errores de la web ───────────────────────────────────────────────────────
// Lo que falla en el navegador de la gente (assets/errores.js → log_web_error),
// agrupado: el mismo error suma veces en vez de repetirse.
const AREAS_ERR = { publica: 'Web pública', cuenta: 'Tu cuenta', panel: 'Panel de negocios', admin: 'Administración' };
const AREA_ICON = { publica: 'public', cuenta: 'person', panel: 'storefront', admin: 'shield' };
PAGES.errores = async (v) => {
  const p = params(); const s = st.errores;
  s.area = p.area || s.area || 'all';
  s.status = p.status || s.status || 'open';
  const en = I18N.lang === 'en';
  v.innerHTML = `
    <div class="page-head"><h1>Errores de la web</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', en
      ? `<p>What breaks in people's browsers on klendar.app: the public pages, Your account, the business dashboard and this panel. The same error is <b>grouped</b> (same place and message) and adds up <b>times</b> instead of repeating. No personal data is kept: only the page (without the address details), the browser, the language and the error, with emails, keys and long numbers removed.</p><p>What to do: start with the <b>new</b> ones and the ones repeated most, open the <b>stack</b> to see where it breaks, fix it and, once it's published, press <b>Mark as resolved</b>. If it happens again, it reopens by itself and is marked <b>back again</b>. A few odd ones (old browsers, bots) can be marked as resolved without doing anything. Browser extensions, network drops and similar noise are never recorded. Everything is deleted after 30 days without happening.</p><p><b>Email alert</b> (at the bottom): if an error repeats a lot in one hour, or many new ones appear in a day, an email goes to the address you set, at most once every few hours.</p>`
      : `<p>Lo que falla en el navegador de la gente en klendar.app: las páginas públicas, «Tu cuenta», el panel de negocios y este panel. El mismo error se <b>agrupa</b> (mismo sitio y mismo mensaje) y suma <b>veces</b> en vez de repetirse. No se guarda nada personal: solo la página (sin los datos de la dirección), el navegador, el idioma y el error, con correos, claves y números largos quitados.</p><p>Qué hacer: empieza por los <b>nuevos</b> y los que más se repiten, abre la <b>pila</b> para ver dónde se rompe, arréglalo y, cuando esté publicado, pulsa <b>Marcar como resuelto</b>. Si vuelve a pasar, se reabre solo y sale marcado como <b>ha vuelto</b>. Alguno raro (navegadores muy viejos, robots) se puede marcar como resuelto sin hacer nada. Las extensiones del navegador, los cortes de red y ruido parecido no se apuntan nunca. Todo se borra a los 30 días sin volver a pasar.</p><p><b>Aviso por correo</b> (abajo): si un error se repite mucho en una hora, o salen muchos nuevos en un día, llega un correo a la dirección que pongas, como mucho uno cada pocas horas.</p>`)}
    <div id="counts"></div>
    <div class="toolbar">
      <select id="area">${[['all', 'Todas las áreas'], ['publica', 'Web pública'], ['cuenta', 'Tu cuenta'], ['panel', 'Panel de negocios'], ['admin', 'Administración']].map((o) => `<option value="${o[0]}" ${s.area === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="status">${[['open', 'Sin resolver'], ['resolved', 'Resueltos'], ['all', 'Todos']].map((o) => `<option value="${o[0]}" ${s.status === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>
    <div id="aviso"></div>
    <div id="tareas"></div>`;
  let rows = [];
  let avisoPintado = false;
  const donde = (e) => e.source ? `<code>${esc(e.source)}${e.line != null ? ':' + e.line : ''}${e.col != null ? ':' + e.col : ''}</code>${e.version ? ` <span class="muted">v${esc(e.version)}</span>` : ''}` : '';
  const veces = (e) => en
    ? `<b>${fmtNum(e.count)}</b> ${e.count === 1 ? 'time' : 'times'}${e.last_hour ? ` · ${fmtNum(e.last_hour)} in the last hour` : ''}`
    : `<b>${fmtNum(e.count)}</b> ${e.count === 1 ? 'vez' : 'veces'}${e.last_hour ? ` · ${fmtNum(e.last_hour)} en la última hora` : ''}`;
  const pintaAviso = (cfg, ultimo) => {
    if (avisoPintado || !cfg) return;
    avisoPintado = true;
    $('#aviso').innerHTML = `<div class="card"><h2>Aviso por correo</h2>
      <p class="muted small" style="margin:0 0 10px">${en
        ? `An email when an error that hasn't been reported yet repeats in one hour, or when more new errors than the limit appear since the last alert (within 24 h). Last alert: <b>${ultimo ? fmtDate(ultimo) : 'never'}</b>.`
        : `Un correo cuando un error del que aún no se ha avisado se repite en una hora, o cuando salen más errores nuevos que el límite desde el último aviso (dentro de 24 h). Último aviso: <b>${ultimo ? fmtDate(ultimo) : 'nunca'}</b>.`}</p>
      <form id="avf" style="display:grid;gap:10px">
        <label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="email" ${cfg.email !== false ? 'checked' : ''}><span>Mandar el aviso por correo</span></label>
        <label class="f"><span>Dirección</span><input name="to" type="email" required value="${esc(cfg.to || 'dev@klendar.app')}"></label>
        <div class="grid3" style="gap:10px">
          <label class="f"><span>Veces en una hora</span><input name="hits" type="number" min="1" max="100000" step="1" required value="${esc(cfg.hits_per_hour ?? 20)}"></label>
          <label class="f"><span>Errores nuevos al día</span><input name="nuevos" type="number" min="0" max="500" step="1" required value="${esc(cfg.new_per_day ?? 10)}"></label>
          <label class="f"><span>Como mucho uno cada (horas)</span><input name="cada" type="number" min="1" max="168" step="1" required value="${esc(cfg.every_hours ?? 6)}"></label>
        </div>
        <label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="log" ${cfg.log !== false ? 'checked' : ''}><span>Apuntar los errores de la web (si lo apagas, no se guarda ninguno nuevo)</span></label>
        <div><button class="btn sm">Guardar</button></div>
      </form></div>`;
    const f = $('#avf');
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const c = f.elements;
      esperando(f.querySelector('button'), async () => {
        const entero = (x, min, max, def) => { const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
        const valor = {
          log: c.log.checked,
          email: c.email.checked,
          to: c.to.value.trim() || 'dev@klendar.app',
          hits_per_hour: entero(c.hits.value, 1, 100000, 20),
          new_per_day: entero(c.nuevos.value, 0, 500, 10),
          every_hours: entero(c.cada.value, 1, 168, 6),
        };
        if (!valor.log && !await confirmDlg('Dejar de apuntar errores', 'No se guardará ningún error nuevo de la web hasta que lo vuelvas a encender.', { danger: true, submit: 'Apagar' })) return;
        try { await rpc('admin_set_config', { p_key: 'web_errors', p_value: valor }); toast('Guardado'); } catch (e) { toast(e.message, true); }
      });
    };
  };
  const load = async () => {
    const r = await rpc('admin_web_errors', { p_area: s.area === 'all' ? null : s.area, p_limit: s.limit, p_offset: s.offset, p_status: s.status });
    rows = r.rows || [];
    const c = r.counts || {};
    $('#counts').innerHTML = `<div class="kpis" style="margin-bottom:14px">
      <div class="kpi ${c.new_24h ? 'accent' : ''}"><b>${fmtNum(c.new_24h)}</b><span>nuevos (24 h)</span></div>
      <div class="kpi"><b>${fmtNum(c.open)}</b><span>sin resolver</span></div>
      <div class="kpi"><b>${fmtNum(c.last_hour)}</b><span>veces en la última hora</span></div>
      <div class="kpi"><b>${fmtNum(c.resolved)}</b><span>resueltos</span></div></div>`;
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = (rows.length ? rows.map((e) => `
      <div class="item"><div class="ph">${ms(AREA_ICON[e.area] || 'bug_report')}</div><div style="min-width:0">
        <h3><span class="tag dim">${esc(AREAS_ERR[e.area] || e.area)}</span> ${e.is_new ? `<span class="tag ${e.reopened_at ? 'warn' : 'bad'}">${e.reopened_at ? 'ha vuelto' : 'nuevo'}</span>` : ''} ${e.resolved_at ? '<span class="tag ok">resuelto</span>' : ''} ${e.kind === 'rejection' ? '<span class="tag dim" title="Una promesa rechazada que nadie ha atendido (unhandledrejection)">promesa</span>' : ''}</h3>
        <p class="mono" style="font-size:13px;white-space:pre-wrap;word-break:break-word;margin:6px 0"><b>${esc(e.message)}</b></p>
        <div class="meta">${e.page ? `<code>${esc(e.page)}</code>` : '—'}${donde(e) ? ' · ' + donde(e) : ''}</div>
        <div class="meta">${veces(e)} · ${en ? 'first' : 'primera'} ${fmtDate(e.first_seen)} · ${en ? 'last' : 'última'} ${ago(e.last_seen)}${e.browser ? ' · ' + esc(e.browser) : ''}${e.lang ? ' · ' + esc(e.lang) : ''}</div>
        ${e.stack ? `<details style="margin-top:6px"><summary class="small" style="cursor:pointer">Pila</summary><pre class="mono">${esc(e.stack)}</pre></details>` : ''}
        <div class="actions">${e.resolved_at
          ? `<span class="muted small">${en ? 'Resolved' : 'Resuelto'} ${ago(e.resolved_at)}</span>`
          : `<button class="btn sm" data-res="${e.id}">Marcar como resuelto</button>`}</div>
      </div></div>`).join('') : `<div class="tbl-wrap"><div class="empty">${s.status === 'open' ? 'Ningún error sin resolver. Todo en orden.' : 'Nada por aquí.'}</div></div>`) + pg.html;
    pg.bind($('#list'));
    $$('#list [data-res]').forEach((b) => { b.onclick = () => esperando(b, async () => {
      try { await rpc('admin_resolve_web_error', { p_id: +b.dataset.res }); toast('Marcado como resuelto'); refreshBadges(); await load(); } catch (e) { toast(e.message, true); }
    }); });
    pintaAviso(r.config, r.last_alert);
  };
  // Tareas programadas (pg_cron) y llamadas de la base a las Edge Functions
  // (pg_net) que han fallado en 7 días: `admin_task_health`. Lo que se ve en
  // Supabase, aquí, para no tener que entrar allí a mirarlo.
  const tareas = async () => {
    let h;
    try { h = await rpc('admin_task_health'); } catch (e) { $('#tareas').innerHTML = `<div class="card"><h2>Tareas programadas</h2><p class="err">${esc(e.message)}</p></div>`; return; }
    const crons = h.crons || [];
    const malas = crons.filter((c) => c.failed_7d > 0 || (c.last_status && c.last_status !== 'succeeded'));
    const http = h.http || [];
    $('#tareas').innerHTML = `<div class="card"><h2>Tareas programadas</h2>
      <p class="muted small" style="margin:0 0 10px">${en
        ? `What the database runs by itself (expire offers, send push, reminders, emails…) and its calls to the Edge Functions, over the last 7 days. <b>${fmtNum(crons.length)}</b> tasks · <b>${fmtNum(malas.length)}</b> with failures · <b>${fmtNum(h.http_24h)}</b> failed calls in 24 h. An Edge Function that fails when the app or the website calls it is only in Supabase (Edge Functions → Logs).`
        : `Lo que la base hace sola (caducar ofertas, mandar push, recordatorios, correos…) y sus llamadas a las Edge Functions, en los últimos 7 días. <b>${fmtNum(crons.length)}</b> tareas · <b>${fmtNum(malas.length)}</b> con fallos · <b>${fmtNum(h.http_24h)}</b> llamadas fallidas en 24 h. Si una Edge Function falla cuando la llama la app o la web, eso solo está en Supabase (Edge Functions → Logs).`}</p>
      ${malas.length ? table({ cols: [
        { h: 'Tarea', r: (c) => `<b class="mono">${esc(c.jobname)}</b><span class="sub mono">${esc(c.schedule)}</span>` },
        { h: 'Fallos (7 días)', num: true, r: (c) => `<span class="tag bad">${fmtNum(c.failed_7d)}</span> <span class="muted small">/ ${fmtNum(c.runs_7d)}</span>` },
        { h: 'Último fallo', r: (c) => c.last_failed_at ? ago(c.last_failed_at) : '—' },
        { h: 'Error', r: (c) => `<span class="mono small">${esc(c.last_error || '')}</span>` },
      ], rows: malas }) : `<p style="margin:0"><span class="tag ok">Todo en orden</span> <span class="muted small">${en ? 'No task has failed in 7 days.' : 'Ninguna tarea ha fallado en 7 días.'}</span></p>`}
      ${http.length ? `<h3 style="margin:14px 0 6px">Llamadas a Edge Functions que han fallado</h3>${table({ cols: [
        { h: 'Respuesta', r: (x) => `<span class="tag bad">${x.status_code ?? '—'}</span> ${esc(x.error || '')}` },
        { h: 'Veces', num: true, r: (x) => fmtNum(x.count) },
        { h: 'Última', r: (x) => ago(x.last) },
        { h: 'Cuerpo', r: (x) => `<span class="mono small">${esc(x.body || '')}</span>` },
      ], rows: http })}` : ''}</div>`;
  };
  $('#area').onchange = () => { s.area = $('#area').value; s.offset = 0; load(); };
  $('#status').onchange = () => { s.status = $('#status').value; s.offset = 0; load(); };
  $('#csv').onclick = () => downloadCsv('errores-web', rows, [['area', 'área'], ['page', 'página'], ['message', 'mensaje'], ['source', 'archivo'], ['line', 'línea'], ['version', 'versión'], ['count', 'veces'], ['first_seen', 'primera vez'], ['last_seen', 'última vez'], ['browser', 'navegador'], ['lang', 'idioma'], ['resolved_at', 'resuelto']]);
  await load();
  await tareas();
};

// ── Administradores ─────────────────────────────────────────────────────────
PAGES.administradores = async (v) => {
  const [list, m] = await Promise.all([rpc('admin_admins'), mfaEstado().catch(() => null)]);
  if (m) MFA = m;
  const f = MFA?.factor;
  v.innerHTML = `
    <div class="page-head"><h1>Administradores</h1><span class="spacer"></span><button class="btn primary sm" id="add">Añadir administrador…</button></div>
    ${helpBox('¿Qué hago aquí?', '<p>Quién puede entrar en este panel. Un administrador puede hacerlo todo, así que da acceso solo a personas de confianza, con contraseña fuerte y la verificación en dos pasos activada (columna «2FA»). La persona tiene que haberse registrado antes en la app con ese email. Todas sus acciones quedan en el registro de actividad.</p>')}
    <div class="card"><h2>Tu verificación en dos pasos</h2>
      <p style="margin:0 0 10px">${f ? `<span class="tag ok">Activada</span> <span class="muted small">${I18N.lang === 'en' ? 'since' : 'desde'} ${esc(fmtDay(f.created_at))}</span>` : '<span class="tag warn">Sin activar</span>'}</p>
      <p class="muted small" style="margin:0 0 10px">${MFA?.required ? 'Obligatoria para administrar.' : 'Recomendada (todavía no es obligatoria).'}</p>
      <p style="margin:0">${f ? '<button class="btn sm" id="mfaCambiar" type="button">Cambiar de móvil o de app…</button><button class="btn sm bad ghost" id="mfaQuitar" type="button">Quitar…</button>' : '<button class="btn sm primary" id="mfaActivar" type="button">Activar ahora</button>'}</p></div>
    ${table({ cols: [{ h: 'Administrador', r: (a) => `<span class="title">${esc(a.display_name || '—')}<span class="sub"><a class="link" href="#/usuarios/${a.user_id}">${esc(a.email)}</a></span></span>` }, { h: '2FA', r: (a) => a.mfa ? '<span class="tag ok">activada</span>' : '<span class="tag warn">sin activar</span>' }, { h: 'Desde', r: (a) => fmtDay(a.created_at) }, { h: 'Último acceso', r: (a) => ago(a.last_sign_in_at) }, { h: 'Acciones', num: true, r: (a) => fmtNum(a.actions) }, { h: '', r: (a) => a.user_id === ME.id ? '<span class="muted small">tú</span>' : `<button class="btn sm bad ghost" data-rm="${a.user_id}">Quitar</button>` }], rows: list })}`;
  if ($('#mfaActivar')) $('#mfaActivar').onclick = () => pantallaAlta({ cancelar: true });
  if ($('#mfaCambiar')) $('#mfaCambiar').onclick = () => cambiarFactor(false);
  if ($('#mfaQuitar')) $('#mfaQuitar').onclick = () => cambiarFactor(true);
  $('#add').onclick = () => esperando($('#add'), async () => { const r = await modal({ title: 'Añadir administrador', fields: [{ name: 'email', label: 'Email (tiene que existir como usuario)', type: 'email', required: true }] }); if (!r) return; try { await rpc('admin_add_admin', { p_email: r.email }); toast('Administrador añadido'); route(); } catch (e) { toast(e.message, true); } });
  $$('[data-rm]').forEach((b) => { b.onclick = () => esperando(b, async () => { if (!await confirmDlg('Quitar administrador', 'Dejará de poder entrar en el panel.', { danger: true, submit: 'Quitar' })) return; try { await rpc('admin_remove_admin', { p_user_id: b.dataset.rm }); toast('Quitado'); route(); } catch (e) { toast(e.message, true); } }); });
};

// ── Registro de actividad ───────────────────────────────────────────────────
PAGES.actividad = async (v) => {
  const s = st.actividad;
  v.innerHTML = `
    <div class="page-head"><h1>Registro de actividad</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', '<p>Todo lo que hacen los administradores queda aquí con fecha, quién y sobre qué: verificaciones, moderación, pagos, cambios de configuración… Sirve para auditoría y para responder ante una reclamación («¿por qué se retiró mi oferta y cuándo?»).</p>')}
    <div class="toolbar"><input id="q" class="grow" placeholder="Buscar por email del admin, id del objeto o texto…" value="${esc(s.q || '')}"><select id="action">${[['all', 'Todas las acciones'], ['business', 'Negocios'], ['offer', 'Publicaciones'], ['report', 'Denuncias'], ['user', 'Usuarios'], ['review', 'Reseñas'], ['post', 'Novedades'], ['notification', 'Notificaciones'], ['config', 'Configuración'], ['plan', 'Planes'], ['category', 'Categorías'], ['admin', 'Administradores']].map((o) => `<option value="${o[0]}" ${(s.action || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    <div id="list"></div>`;
  let rows = [];
  const linkFor = (l) => l.target_type === 'business' ? `#/negocios/${l.target_id}` : l.target_type === 'offer' ? `#/publicaciones/${l.target_id}` : l.target_type === 'user' ? `#/usuarios/${l.target_id}` : null;
  const load = async () => {
    const r = await rpc('admin_audit', { p_query: s.q || null, p_action: s.action || 'all', p_limit: s.limit, p_offset: s.offset });
    rows = r.rows;
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = table({ cols: [
      { h: 'Fecha', r: (l) => `<span class="nowrap">${fmtDate(l.created_at)}</span>` }, { h: 'Administrador', r: (l) => esc(l.admin_email || '—') },
      { h: 'Acción', r: (l) => `<b>${esc(ACTIONS[l.action] || l.action)}</b><span class="sub mono">${esc(l.action)}</span>` },
      { h: 'Sobre', r: (l) => l.target_id ? (linkFor(l) ? `<a class="link" href="${linkFor(l)}">${esc(l.target_type)} ${esc(l.target_id.slice(0, 8))}…</a>` : `${esc(l.target_type || '')} <code>${esc(l.target_id)}</code>`) : '—' },
      { h: 'Detalles', r: (l) => `<span class="small">${esc(summarize(l.details || {}))}</span>` },
    ], rows, empty: 'Sin actividad.' }) + pg.html;
    pg.bind($('#list'));
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  $('#action').onchange = () => { s.action = $('#action').value; s.offset = 0; load(); };
  $('#csv').onclick = () => downloadCsv('actividad', rows, [['created_at', 'fecha'], ['admin_email', 'admin'], ['action', 'acción'], ['target_type', 'tipo'], ['target_id', 'id'], ['details', 'detalles']]);
  await load();
};

// ── Ayuda ───────────────────────────────────────────────────────────────────
PAGES.ayuda = async (v) => {
  v.innerHTML = `
    <div class="page-head"><h1>Ayuda</h1></div>
    <div class="card"><h2>Cómo funciona Klendar (en 1 minuto)</h2>${I18N.lang === 'en' ? `<p><b>Businesses</b> sign up from the app and stay <b>pending</b> until an administrator verifies them. Once verified, they publish <b>flash offers</b> (with a countdown and limited places) and <b>events</b>. <b>Users</b> see them in Discover and on the map, save them in Your plans and redeem them by showing a <b>single-use QR code</b> that the business scans. Businesses have <b>a single plan</b>, with no limits and <b>never a commission per redemption</b>: a <b>30-day free trial</b>, <b>free while each city is starting up</b> (with a month's notice before we start charging) and then <b>€19.90 a month</b> (or €199 a year) per venue, with no lock-in. Sign-up comes with a 30-day trial without a card; for now payments are made by bank transfer and recorded here.</p>` : `<p>Los <b>negocios</b> se dan de alta desde la app y quedan <b>pendientes</b> hasta que un administrador los verifica. Una vez verificados publican <b>ofertas flash</b> (con cuenta atrás y aforo) y <b>eventos</b>. Los <b>usuarios</b> las ven en Descubre y el mapa, las guardan en Tus planes y las canjean enseñando un <b>código QR de un solo uso</b> que el negocio escanea. Los negocios tienen <b>un solo plan</b>, sin límites y <b>nunca con comisión por canje</b>: <b>prueba gratis de 30 días</b>, <b>gratis mientras cada ciudad está arrancando</b> (con un mes de aviso antes de empezar a cobrar) y después <b>19,90 € al mes</b> (o 199 € al año) por local, sin permanencia. El alta trae una prueba de 30 días sin tarjeta; por ahora los cobros se hacen por transferencia y se anotan aquí.</p>`}</div>
    <div class="grid2">
      <div class="card">${I18N.lang === 'en' ? `<h2>Daily routine (5 minutes)</h2><ol style="margin:0;padding-left:18px"><li><b>Overview</b>: check “Waiting for you”.</li><li><b>Pending businesses</b>: check that they exist (website, phone, Google Maps) and verify or reject them with a reason.</li><li><b>Publications to moderate</b>: approve or take down with a reason.</li><li><b>Open reports</b>: review and resolve them (always with a reason if you take something down).</li><li><b>Failed push</b>: if there are many, something is wrong with Firebase.</li></ol>` : `<h2>Rutina diaria (5 minutos)</h2><ol style="margin:0;padding-left:18px"><li><b>Resumen</b>: mira «Pendiente de ti».</li><li><b>Negocios pendientes</b>: comprueba que existen (web, teléfono, Google Maps) y verifica o rechaza con motivo.</li><li><b>Publicaciones por moderar</b>: aprueba o retira con motivo.</li><li><b>Denuncias abiertas</b>: revisa y resuelve (siempre con motivo si retiras algo).</li><li><b>Push fallidos</b>: si hay muchos, algo pasa con Firebase.</li></ol>`}</div>
      <div class="card">${I18N.lang === 'en' ? `<h2>Weekly routine</h2><ul style="margin:0;padding-left:18px"><li><b>Plans and payments</b>: subscriptions expiring in 7 days → contact the business; record the bank transfers received.</li><li><b>Users</b>: handle access or erasure requests received by email (info@klendar.app).</li><li><b>Feedback</b>: read what has come in, set the status and reply to whatever deserves a reply.</li><li><b>Activity log</b>: check that everything that was done makes sense.</li></ul>` : `<h2>Rutina semanal</h2><ul style="margin:0;padding-left:18px"><li><b>Planes y pagos</b>: suscripciones que vencen en 7 días → contacta con el negocio; registra las transferencias recibidas.</li><li><b>Usuarios</b>: atiende peticiones de acceso o supresión recibidas por email (info@klendar.app).</li><li><b>Sugerencias</b>: lee lo que ha entrado, marca estado y responde lo que merezca respuesta.</li><li><b>Registro de actividad</b>: repasa que todo lo hecho tenga sentido.</li></ul>`}</div>
      <div class="card">${I18N.lang === 'en' ? `<h2>Moderation criteria</h2><ul style="margin:0;padding-left:18px"><li>The venue's or product's own photos; no third-party images without permission.</li><li>A clear offer that can be honoured: price, conditions, places, opening hours. Nothing misleading.</li><li>Alcohol: only businesses marked 18+, without encouraging drinking (Law 34/1988).</li><li>No third parties' personal data, insults, discrimination or sexual content.</li><li>If in doubt, mark it “under review” and ask the business for more information with “Send notification”.</li></ul><p class="muted small" style="margin:8px 0 0">Reference: <a class="link" href="/en/community-guidelines/" target="_blank">Community guidelines</a> · <a class="link" href="/en/business-terms/" target="_blank">Business terms</a>.</p>` : `<h2>Criterios de moderación</h2><ul style="margin:0;padding-left:18px"><li>Fotos propias del local o del producto; nada de imágenes de terceros sin permiso.</li><li>Oferta clara y cumplible: precio, condiciones, aforo, horario. Nada engañoso.</li><li>Alcohol: solo negocios +18 marcados, sin incitar al consumo (Ley 34/1988).</li><li>Sin datos personales de terceros, insultos, discriminación ni contenido sexual.</li><li>Ante la duda, marca «en revisión» y pide más información al negocio con «Enviar notificación».</li></ul><p class="muted small" style="margin:8px 0 0">Referencia: <a class="link" href="/normas/" target="_blank">Normas de la comunidad</a> · <a class="link" href="/negocios/" target="_blank">Condiciones para negocios</a>.</p>`}</div>
      <div class="card">${I18N.lang === 'en' ? `<h2>Legal duties this panel covers</h2><ul style="margin:0;padding-left:18px"><li><b>DSA</b> (Digital Services Act): every content takedown comes with a reason and a way to appeal (15 days, info@klendar.app); reports are handled diligently.</li><li><b>GDPR</b>: consents visible on the user's page; erasure with “Delete account”; access with “Export CSV”.</li><li><b>Log</b>: every administrative action is logged with its author and date.</li></ul>` : `<h2>Obligaciones legales que cubre el panel</h2><ul style="margin:0;padding-left:18px"><li><b>DSA</b> (Reglamento de Servicios Digitales): toda retirada de contenido lleva motivo y vía de recurso (15 días, info@klendar.app); las denuncias se gestionan con diligencia.</li><li><b>RGPD</b>: consentimientos visibles en la ficha del usuario; supresión con «Borrar cuenta»; acceso con «Exportar CSV».</li><li><b>Registro</b>: cada acción administrativa queda registrada con autor y fecha.</li></ul>`}</div>
    </div>
    <div class="card"><h2>Atajos</h2><p class="muted" style="margin:0">${I18N.lang === 'en' ? `<code>/</code> jumps to the page's search box · Click any row to open its details · “Export CSV” downloads what you see with the filters applied.` : `<code>/</code> salta al buscador de la página · Pulsa en cualquier fila para abrir su ficha · «Exportar CSV» descarga lo que ves con los filtros aplicados.`}</p></div>
    <div class="card"><h2>Si algo falla</h2><p class="muted" style="margin:0">${I18N.lang === 'en' ? `If you see “This account is not an administrator”, ask another administrator to add you. If the panel doesn't load any data, check Supabase's status (<a class="link" href="https://status.supabase.com" target="_blank" rel="noopener">status.supabase.com</a>). Technical support: dev@klendar.app.` : `Si ves «Esta cuenta no es administradora» pide a otro administrador que te añada. Si el panel no carga datos, comprueba el estado de Supabase (<a class="link" href="https://status.supabase.com" target="_blank" rel="noopener">status.supabase.com</a>). Soporte técnico: dev@klendar.app.`}</p></div>`;
};

boot();
