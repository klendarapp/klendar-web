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
  document.body.innerHTML = '<p style="padding:24px">Falta la configuración '
    + '(<code>/config.js</code>). Avisa a soporte.</p>';
  throw new Error('sin configuración');
}
const APP_URL = 'https://klendar.app';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Utilidades ──────────────────────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOC = () => (I18N.lang === 'en' ? 'en-GB' : 'es-ES');
const fmtDate = (s) => s ? new Date(s).toLocaleString(LOC(), { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtDay = (s) => s ? new Date(s).toLocaleDateString(LOC(), { dateStyle: 'medium' }) : '—';
const fmtMoney = (c, cur = 'EUR') => (c == null ? '—' : (c / 100).toLocaleString('es-ES', { style: 'currency', currency: cur }));
const fmtNum = (n) => (n ?? 0).toLocaleString('es-ES');
const ago = (s) => {
  if (!s) return '—';
  const d = (Date.now() - new Date(s)) / 1000;
  if (d < 60) return 'hace un momento';
  if (d < 3600) return `hace ${Math.floor(d / 60)} min`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)} h`;
  if (d < 86400 * 30) return `hace ${Math.floor(d / 86400)} d`;
  return fmtDay(s);
};
const tag = (v, cls) => v ? `<span class="tag ${cls || 'st-' + esc(v)}">${esc(LABELS[v] || v)}</span>` : '';
const LABELS = {
  pending: 'pendiente', verified: 'verificado', rejected: 'rechazado', approved: 'aprobada', active: 'activa', expired: 'caducada',
  cancelled: 'cancelada', sold_out: 'agotada', draft: 'borrador', open: 'abierta', reviewing: 'en revisión', resolved: 'resuelta', dismissed: 'desestimada',
  trial: 'prueba', past_due: 'impagada', validated: 'validado', failed: 'fallido', sent: 'enviado', skipped: 'omitido',
  flash_offer: 'oferta flash', future_event: 'evento', user: 'usuario', business: 'negocio', offer: 'publicación', review: 'reseña', post: 'post',
  owner: 'propietario', manager: 'encargado', staff: 'empleado', free: 'Gratis', basic: 'Básico', pro: 'Pro',
  new: 'sin leer', planned: 'la haremos', done: 'hecho', declined: 'descartada',
  suggestion: 'sugerencia', bug: 'fallo',
};
const KIND_ICON = { flash_offer: '⚡', future_event: '📅' };
const FLAGS = { alcohol: '🍺 alcohol', tobacco: '🚬 tabaco/vapeo', gambling: '🎰 apuestas' };
const flagTags = (o) => (o.moderation_flags || []).map((f) => `<span class="tag warn" title="Detectado automáticamente en el texto">${esc(FLAGS[f] || f)}</span>`).join(' ');
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const qs = (o) => Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    const msg = error.message || '';
    if (/not_admin|42501/.test(msg + error.code)) throw new Error('Esta cuenta no es administradora.');
    throw new Error(RPC_ERRORS[msg] || msg);
  }
  return data;
}
const RPC_ERRORS = {
  cannot_ban_admin: 'No se puede suspender a un administrador.', cannot_delete_self: 'No puedes borrar tu propia cuenta desde aquí.',
  cannot_delete_admin: 'Quita primero los permisos de administrador.', reason_required: 'Hace falta indicar un motivo.',
  invalid_plan: 'Plan no válido.', invalid_status: 'Estado no válido.', no_subscription: 'El negocio no tiene suscripción vigente; asigna primero un plan.',
  user_not_found: 'No existe ningún usuario con ese email.', cannot_remove_self: 'No puedes quitarte a ti mismo.', last_admin: 'Tiene que quedar al menos un administrador.',
  category_in_use: 'La categoría está en uso (negocios, publicaciones o subcategorías).', slug_required: 'El identificador (slug) es obligatorio.',
  title_body_required: 'Título y texto son obligatorios.', unknown_key: 'Clave de configuración desconocida.', invalid_amount: 'Importe no válido.', invalid_period: 'El fin del periodo es anterior al inicio.',
  not_found: 'No encontrado.', account_suspended: 'Cuenta suspendida.',
};

function toast(msg, bad = false) {
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
      ${confirmWord ? `<label class="f"><span>Escribe <b>${esc(confirmWord)}</b> para confirmar</span><input name="__confirm" autocomplete="off" required></label>` : ''}
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
const confirmDlg = (title, text, opts = {}) => modal({ title, intro: text, submit: opts.submit || 'Confirmar', danger: opts.danger, confirmWord: opts.confirmWord, warn: opts.warn }).then((v) => v !== null);

// CSV del listado actual.
function downloadCsv(name, rows, cols) {
  const head = cols.map((c) => c[1]);
  const lines = [head, ...rows.map((r) => cols.map((c) => { const v = typeof c[0] === 'function' ? c[0](r) : r[c[0]]; return v == null ? '' : String(typeof v === 'object' ? JSON.stringify(v) : v); }))];
  const csv = lines.map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

// Gráfica de barras simple.
function bars(series, key, labelFn) {
  const max = Math.max(1, ...series.map((s) => s[key] || 0));
  return `<div class="chart">${series.map((s) => `<div title="${esc(labelFn ? labelFn(s) : s.day)}: ${s[key] || 0}" style="height:${Math.round((s[key] || 0) / max * 100)}%"></div>`).join('')}</div>`;
}

// Tabla + paginación.
function table({ cols, rows, onRow, empty = 'Nada por aquí.' }) {
  if (!rows.length) return `<div class="tbl-wrap"><div class="empty">${esc(empty)}</div></div>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th ${c.num ? 'class="num"' : ''}>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr class="${onRow ? 'row' : ''}" data-i="${i}">${cols.map((c) => `<td ${c.num ? 'class="num"' : ''}>${c.r(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pager(state, total, onChange) {
  const pages = Math.max(1, Math.ceil(total / state.limit));
  const page = Math.floor(state.offset / state.limit) + 1;
  const html = `<div class="pager"><span><b>${fmtNum(total)}</b> resultados · <span>página</span> <b>${page}</b> <span>de</span> <b>${pages}</b></span><span class="spacer"></span>
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
const img = (url, ph = '🏪') => url ? `<img class="thumb" src="${esc(url)}" alt="" loading="lazy">` : `<span class="ph">${ph}</span>`;
const appLink = (path, label = 'Ver en la app') => `<a class="btn sm ghost" href="${APP_URL}${path}" target="_blank" rel="noopener">${label} ↗</a>`;

// ── Sesión ──────────────────────────────────────────────────────────────────
const insecure = location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
if (insecure) {
  document.body.innerHTML = '<div class="login"><h2>Conexión no segura</h2><p class="muted">Este panel solo funciona por HTTPS: <a href="https://klendar.app/admin/">https://klendar.app/admin/</a>.</p></div>';
  throw new Error('insecure');
}
let ME = null;
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  ME = session.user;
  $('#who').textContent = ME.email;
  $('#login').hidden = true; $('#app').hidden = false;
  route();
}
function showLogin() { $('#login').hidden = false; $('#app').hidden = true; ME = null; }
$('#doLogin').onclick = async () => {
  $('#loginErr').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
  if (error) { $('#loginErr').textContent = error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message; return; }
  boot();
};
$('#password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#doLogin').click(); });
$('#logout').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); showLogin(); };
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') showLogin(); });
$('#menuBtn').onclick = () => $('#side').classList.toggle('open');

// ── Idioma ──────────────────────────────────────────────────────────────────
I18N.pickers(['#lang', '#langLogin', '#langSide']);
I18N.translate(document.body);
document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea|select/i.test(e.target.tagName)) { const s = $('#q'); if (s) { e.preventDefault(); s.focus(); } } });

// ── Navegación ──────────────────────────────────────────────────────────────
const NAV = [
  ['group', 'Actividad'],
  ['resumen', '📊', 'Resumen'], ['ciudades', '🗺', 'Ciudades'], ['negocios', '🏪', 'Negocios'], ['publicaciones', '⚡', 'Publicaciones'], ['canjeos', '🎟', 'Canjeos'], ['usuarios', '👤', 'Usuarios'],
  ['group', 'Moderación'],
  ['denuncias', '🚩', 'Denuncias'], ['resenas', '💬', 'Reseñas y posts'], ['sugerencias', '💡', 'Sugerencias'],
  ['group', 'Negocio'],
  ['planes', '💳', 'Planes y pagos'], ['avisos', '🔔', 'Avisos y push'],
  ['group', 'Sistema'],
  ['colecciones', '✨', 'Colecciones'], ['categorias', '🗂', 'Categorías'], ['configuracion', '⚙️', 'Configuración'], ['administradores', '🛡', 'Administradores'], ['actividad', '📜', 'Registro de actividad'], ['ayuda', '❓', 'Ayuda'],
];
let BADGES = {};
function renderNav(current) {
  // (al final se traduce; la lista se arma igual en los dos idiomas)
  $('#nav').innerHTML = NAV.map((n) => n[0] === 'group' ? `<div class="group">${n[1]}</div>`
    : `<a class="nav ${current === n[0] ? 'on' : ''}" href="#/${n[0]}"><span class="ic">${n[1]}</span>${n[2]}${BADGES[n[0]] ? `<span class="badge">${BADGES[n[0]]}</span>` : ''}</a>`).join('');
  I18N.translate($('#nav'));
}
async function refreshBadges() {
  try {
    const k = await rpc('admin_kpis');
    let sug = 0;
    try { sug = (await rpc('admin_feedback', { p_status: 'new', p_limit: 1 })).counts?.new || 0; } catch { /* sin permisos */ }
    BADGES = { negocios: k.businesses_pending || 0, publicaciones: k.offers_pending || 0, denuncias: k.reports_open || 0, sugerencias: sug };
    Object.keys(BADGES).forEach((x) => { if (!BADGES[x]) delete BADGES[x]; });
    renderNav(currentRoute()[0]);
    return k;
  } catch { return null; }
}
const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'resumen').split('/');
const PAGES = {};
async function route() {
  if (!ME) return;
  const [page, id] = currentRoute();
  renderNav(page);
  $('#side').classList.remove('open');
  const v = $('#view');
  v.innerHTML = '<div class="loading">Cargando…</div>';
  window.scrollTo(0, 0);
  try {
    const fn = PAGES[page] || PAGES.resumen;
    await fn(v, id);
    I18N.translate(v);
  } catch (e) {
    v.innerHTML = `<div class="card"><p class="err">${esc(e.message)}</p>${/administradora/.test(e.message) ? '<p class="muted">Pide a otro administrador que te dé de alta en «Administradores», o ejecuta en Supabase: <code>insert into public.admin_users (user_id) select id from auth.users where email = \'tu@email\'</code></p>' : ''}</div>`;
  }
}
window.addEventListener('hashchange', route);
const go = (h) => { location.hash = h; };

// ── Resumen ─────────────────────────────────────────────────────────────────
PAGES.resumen = async (v) => {
  const k = await refreshBadges();
  if (!k) throw new Error('Esta cuenta no es administradora.');
  const kpi = (n, label, cls = '') => `<div class="kpi ${cls}"><b>${typeof n === 'number' ? fmtNum(n) : n}</b><span>${label}</span></div>`;
  const series = k.series || [];
  v.innerHTML = `
    <div class="page-head"><h1>Resumen</h1><span class="spacer"></span><span class="muted">${new Date().toLocaleString(LOC(), { dateStyle: 'full', timeStyle: 'short' })}</span></div>
    ${(k.businesses_pending || k.offers_pending || k.reports_open || BADGES.sugerencias) ? `<div class="card"><h2>Pendiente de ti</h2><div class="actions">
      ${k.businesses_pending ? `<a class="btn" href="#/negocios?status=pending">🏪 <b>${k.businesses_pending}</b> negocio(s) por verificar</a>` : ''}
      ${k.offers_pending ? `<a class="btn" href="#/publicaciones?moderation=pending">⚡ <b>${k.offers_pending}</b> publicación(es) por moderar</a>` : ''}
      ${k.reports_open ? `<a class="btn" href="#/denuncias">🚩 <b>${k.reports_open}</b> denuncia(s) abiertas</a>` : ''}
      ${k.subs_expiring_7d ? `<a class="btn" href="#/planes">💳 <b>${k.subs_expiring_7d}</b> suscripción(es) vencen en 7 días</a>` : ''}
      ${k.push_failed_7d ? `<a class="btn" href="#/avisos?tab=push">🔔 <b>${k.push_failed_7d}</b> push fallidos (7 d)</a>` : ''}
      ${BADGES.sugerencias ? `<a class="btn" href="#/sugerencias">💡 <b>${BADGES.sugerencias}</b> sugerencia(s) sin leer</a>` : ''}
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
      <div class="card"><h2>Publicaciones y canjeos</h2><div class="kpis">
        ${kpi(k.offers_active, 'activas ahora')} ${kpi(k.offers_7d, 'publicadas (7 d)')} ${kpi(k.offers_pending, 'por moderar', k.offers_pending ? 'accent' : '')} ${kpi(k.offers_rejected, 'retiradas')}
        ${kpi(k.views_7d, 'vistas (7 d)')} ${kpi(k.views_30d, 'vistas (30 d)')} ${kpi(k.redemptions_7d, 'canjeos (7 d)')} ${kpi(k.redemptions_30d, 'canjeos (30 d)')} ${kpi(k.redemptions_pending, 'códigos en curso')}
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
    </div>
    <div class="card"><div class="page-head" style="margin-bottom:4px"><h2 style="margin:0">Últimos 30 días</h2><span class="spacer"></span>
      <div class="chart-tabs" id="ctabs">${[['redemptions', 'Canjeos'], ['views', 'Vistas'], ['offers', 'Publicaciones'], ['users', 'Altas']].map(([k2, l], i) => `<button class="${i === 0 ? 'on' : ''}" data-k="${k2}">${l}</button>`).join('')}</div></div>
      <div id="chart">${bars(series, 'redemptions', (s) => fmtDay(s.day))}</div>
      <div class="chart-legend"><span>${fmtDay(series[0]?.day)}</span><span style="margin-left:auto">${fmtDay(series[series.length - 1]?.day)}</span></div>
    </div>
    <div class="grid3">
      <div class="card"><h2>Top negocios (canjeos 30 d)</h2>${(k.top_businesses || []).length ? `<ol style="margin:0;padding-left:18px">${k.top_businesses.map((b) => `<li><a class="link" href="#/negocios/${b.id}">${esc(b.name)}</a> <span class="muted">${esc(b.city || '')} · ${b.redemptions}</span></li>`).join('')}</ol>` : '<p class="muted">Aún sin canjeos.</p>'}</div>
      <div class="card"><h2>Top publicaciones (30 d)</h2>${(k.top_offers || []).length ? `<ol style="margin:0;padding-left:18px">${k.top_offers.map((o) => `<li><a class="link" href="#/publicaciones/${o.id}">${esc(o.title)}</a> <span class="muted">${esc(o.business)} · ${o.redemptions_count} canjeos · ${o.views_count} vistas</span></li>`).join('')}</ol>` : '<p class="muted">Nada todavía.</p>'}</div>
      <div class="card"><h2>Negocios por ciudad</h2>${(k.by_city || []).length ? `<dl class="kv" style="grid-template-columns:1fr auto">${k.by_city.map((c) => `<dt>${esc(c.city)}</dt><dd>${c.verified}/${c.businesses}</dd>`).join('')}</dl><p class="muted small" style="margin:8px 0 0">verificados / total</p>` : '<p class="muted">—</p>'}</div>
    </div>`;
  $('#ctabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('#ctabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#chart').innerHTML = bars(series, b.dataset.k, (s) => fmtDay(s.day)); };
};

// ── Negocios ────────────────────────────────────────────────────────────────
const params = () => Object.fromEntries(new URLSearchParams((location.hash.split('?')[1] || '')));
const st = { sugerencias: { limit: 50, offset: 0 }, negocios: { limit: 50, offset: 0 }, publicaciones: { limit: 50, offset: 0 }, canjeos: { limit: 50, offset: 0 }, usuarios: { limit: 50, offset: 0 }, resenas: { limit: 50, offset: 0 }, posts: { limit: 50, offset: 0 }, denuncias: { limit: 50, offset: 0 }, actividad: { limit: 100, offset: 0 }, pagos: { limit: 100, offset: 0 }, subs: { limit: 100, offset: 0 } };

PAGES.negocios = async (v, id) => {
  if (id) return businessDetail(v, id);
  const p = params(); const s = st.negocios;
  s.status = p.status || s.status || 'all';
  v.innerHTML = `
    <div class="page-head"><h1>Negocios</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', '<p>Aquí ves todos los negocios dados de alta. Los <b>pendientes</b> son altas nuevas que tienes que revisar: comprueba que el negocio existe (web, teléfono, Google Maps) y pulsa <b>Verificar</b>; si no procede, <b>Rechazar</b> indicando el motivo (el negocio lo recibe como aviso). Pulsa en una fila para ver la ficha completa, cambiar el plan o registrar un pago.</p>')}
    <div class="toolbar">
      <input id="q" class="grow" placeholder="Buscar por nombre, ciudad, email del dueño, CIF o id…" value="${esc(s.q || '')}">
      <select id="status">${[['all', 'Todos los estados'], ['pending', 'Pendientes'], ['verified', 'Verificados'], ['rejected', 'Rechazados']].map((o) => `<option value="${o[0]}" ${s.status === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="plan">${[['all', 'Todos los planes'], ['free', 'Gratis de lanzamiento'], ['standard', 'Klendar'], ['founder', 'Fundador']].map((o) => `<option value="${o[0]}" ${(s.plan || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="active">${[['', 'Activos e inactivos'], ['true', 'Solo activos'], ['false', 'Solo desactivados']].map((o) => `<option value="${o[0]}" ${(s.active ?? '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="sort">${[['created_desc', 'Más recientes'], ['created_asc', 'Más antiguos'], ['name', 'Por nombre'], ['redemptions', 'Más canjeos']].map((o) => `<option value="${o[0]}" ${(s.sort || 'created_desc') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
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
        { h: 'Estado', r: (b) => `${tag(b.verification_status)} ${b.is_active ? '' : tag('inactive', 'st-inactive')} ${b.open_reports ? `<span class="tag bad">🚩 ${b.open_reports}</span>` : ''}` },
        { h: 'Plan', r: (b) => `${tag(b.plan_slug || 'free', 'dim')} ${b.sub_status ? tag(b.sub_status) : ''}${b.sub_period_end ? `<span class="sub">hasta ${fmtDay(b.sub_period_end)}</span>` : ''}` },
        { h: 'Publicaciones', num: true, r: (b) => `${b.active_offers} <span class="muted">/ ${b.offers_count}</span>` },
        { h: 'Canjeos', num: true, r: (b) => fmtNum(b.redemptions_count) },
        { h: 'Alta', r: (b) => `<span class="nowrap">${fmtDay(b.created_at)}</span>` },
      ], rows, onRow: true, empty: 'No hay negocios con esos filtros.',
    }) + pg.html;
    pg.bind($('#list'));
    $$('#list tr.row').forEach((tr) => { tr.onclick = () => go(`#/negocios/${rows[tr.dataset.i].id}`); });
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['status', 'plan', 'active', 'sort'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  $('#csv').onclick = () => downloadCsv('negocios', rows, [['id', 'id'], ['name', 'nombre'], ['category', 'categoría'], ['city', 'ciudad'], ['address', 'dirección'], ['owner_email', 'email dueño'], ['phone', 'teléfono'], ['website', 'web'], ['verification_status', 'verificación'], [(b) => b.is_active ? 'sí' : 'no', 'activo'], [(b) => b.plan_slug || 'free', 'plan'], ['sub_status', 'suscripción'], ['sub_period_end', 'fin periodo'], ['offers_count', 'publicaciones'], ['redemptions_count', 'canjeos'], ['created_at', 'alta']]);
  await load();
};

async function businessDetail(v, id) {
  const d = await rpc('admin_business_detail', { p_id: id });
  const b = d.business;
  if (!b) throw new Error('Negocio no encontrado.');
  const cur = d.subscriptions.find((s) => ['trial', 'active', 'past_due'].includes(s.status));
  const social = b.social_links && typeof b.social_links === 'object' ? Object.entries(b.social_links).filter(([, u]) => u) : [];
  const hours = b.opening_hours && typeof b.opening_hours === 'object' ? Object.entries(b.opening_hours) : [];
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/negocios">← Negocios</a></div>
    <div class="detail-head">
      ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="">` : '<div class="ph">🏪</div>'}
      <div><h1>${esc(b.name)}</h1><div class="tags">${tag(b.verification_status)} ${b.is_active ? tag('active') : tag('inactive', 'st-inactive')} ${tag(cur?.plan || 'free', 'dim')} ${cur ? tag(cur.status) : ''} ${b.adults_only ? '<span class="tag bad">+18</span>' : ''}</div></div>
      <span class="spacer"></span>
      <div class="actions">
        ${b.verification_status !== 'verified' ? '<button class="btn ok" data-a="verify">✓ Verificar</button>' : ''}
        ${b.verification_status !== 'rejected' ? '<button class="btn bad" data-a="reject">Rechazar…</button>' : ''}
        <button class="btn" data-a="active">${b.is_active ? 'Desactivar' : 'Activar'}</button>
        <button class="btn" data-a="edit">Editar ficha…</button>
        <button class="btn" data-a="plan">Cambiar plan…</button>
        <button class="btn" data-a="pay">Registrar pago…</button>
        <button class="btn" data-a="notify">Enviar aviso al dueño…</button>
        ${appLink('/b/' + b.id)}
      </div>
    </div>
    ${b.rejection_reason ? `<div class="card"><b>Motivo del rechazo:</b> ${esc(b.rejection_reason)}</div>` : ''}
    <div class="grid2">
      <div class="card"><h2>Ficha</h2><dl class="kv">
        <dt>Categoría</dt><dd>${esc(b.category || '—')}</dd>
        <dt>Dirección</dt><dd>${esc([b.address, b.city].filter(Boolean).join(', ') || '—')} ${b.lat ? `· <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${b.lat},${b.lng}">mapa ↗</a>` : ''}</dd>
        <dt>Teléfono</dt><dd>${b.phone ? `<a class="link" href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : '—'}</dd>
        <dt>Email de contacto</dt><dd>${b.contact_email ? `<a class="link" href="mailto:${esc(b.contact_email)}">${esc(b.contact_email)}</a>` : '—'}</dd>
        <dt>Web</dt><dd>${b.website ? `<a class="link" target="_blank" rel="noopener" href="${esc(b.website)}">${esc(b.website)}</a>` : '—'}</dd>
        <dt>Redes</dt><dd>${social.length ? social.map(([k, u]) => `<a class="link" target="_blank" rel="noopener" href="${esc(u)}">${esc(k)}</a>`).join(' · ') : '—'}</dd>
        <dt>CIF / NIF</dt><dd>${esc(b.tax_id || '—')}</dd>
        <dt>Dueño</dt><dd>${esc(b.owner_name || '—')} · <a class="link" href="#/usuarios/${b.owner_id}">${esc(b.owner_email || '')}</a></dd>
        <dt>Valoración</dt><dd>${b.rating_count ? `★ ${Number(b.rating_avg).toFixed(1)} (${b.rating_count})` : 'sin reseñas'}</dd>
        <dt>Alta</dt><dd>${fmtDate(b.created_at)} ${b.verified_at ? `· verificado ${fmtDate(b.verified_at)}` : ''}</dd>
        <dt>Horario</dt><dd>${hours.length ? hours.map(([k, val]) => `${esc(k)}: ${esc(Array.isArray(val) ? val.map((x) => Array.isArray(x) ? x.join('–') : JSON.stringify(x)).join(', ') : JSON.stringify(val))}`).join('<br>') : '—'}</dd>
        <dt>Descripción</dt><dd>${esc(b.description || '—')}</dd>
        <dt>Id</dt><dd><code>${b.id}</code></dd>
      </dl>
      ${(b.gallery || []).length ? `<h3 style="margin-top:12px">Galería</h3><div class="gallery">${b.gallery.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt=""></a>`).join('')}</div>` : ''}
      </div>
      <div>
        <div class="card"><h2>Actividad</h2><div class="kpis">
          <div class="kpi"><b>${fmtNum(d.stats.views_30d)}</b><span>vistas (30 d)</span></div>
          <div class="kpi"><b>${fmtNum(d.stats.redemptions_30d)}</b><span>canjeos (30 d)</span></div>
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
          ${cur ? `<dl class="kv"><dt>Plan</dt><dd>${tag(cur.plan, 'dim')} ${tag(cur.status)} · ${fmtMoney(cur.price_cents)}/mes</dd><dt>Periodo</dt><dd>${fmtDay(cur.period_start)} → ${cur.period_end ? fmtDay(cur.period_end) : 'sin fin'}</dd><dt>Forma de pago</dt><dd>${esc(cur.payment_method || '—')}</dd></dl>` : '<p class="muted">Sin suscripción vigente (plan Gratis).</p>'}
          ${d.subscriptions.length > 1 ? `<details style="margin-top:8px"><summary class="muted">Histórico (${d.subscriptions.length})</summary>${table({ cols: [{ h: 'Plan', r: (s) => tag(s.plan, 'dim') }, { h: 'Estado', r: (s) => tag(s.status) }, { h: 'Periodo', r: (s) => `${fmtDay(s.period_start)} → ${s.period_end ? fmtDay(s.period_end) : '—'}` }, { h: 'Pago', r: (s) => esc(s.payment_method || '') }], rows: d.subscriptions })}</details>` : ''}
          <h3 style="margin-top:12px">Pagos registrados</h3>
          ${table({ cols: [{ h: 'Fecha', r: (p) => fmtDay(p.paid_at) }, { h: 'Importe', num: true, r: (p) => fmtMoney(p.amount_cents, p.currency) }, { h: 'Método', r: (p) => esc(p.method) }, { h: 'Periodo', r: (p) => `${fmtDay(p.period_start)} → ${fmtDay(p.period_end)}` }, { h: 'Notas', r: (p) => `${esc(p.notes || '')}<span class="sub">${esc(p.recorded_by || '')}</span>` }], rows: d.payments, empty: 'Ningún pago registrado.' })}
        </div>
      </div>
    </div>
    <div class="card"><h2>Publicaciones (${d.offers.length})</h2>
      ${table({ cols: [
        { h: 'Publicación', r: (o) => `${KIND_ICON[o.kind]} <span class="title">${esc(o.title)}</span>` },
        { h: 'Estado', r: (o) => `${tag(o.status)} ${tag(o.moderation_status)} ${o.is_boosted ? '<span class="tag">boost</span>' : ''}` },
        { h: 'Cuándo', r: (o) => `<span class="nowrap">${fmtDate(o.kind === 'flash_offer' ? o.redeem_end_at : o.event_at)}</span>` },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views_count) }, { h: 'Canjeos', num: true, r: (o) => `${o.redemptions_count}${o.max_redemptions ? ` / ${o.max_redemptions}` : ''}` },
        { h: 'Creada', r: (o) => fmtDay(o.created_at) },
      ], rows: d.offers, onRow: true, empty: 'Este negocio no ha publicado nada.' })}
    </div>
    <div class="grid2">
      <div class="card"><h2>Reseñas (${d.reviews.length})</h2>${d.reviews.length ? d.reviews.map((r) => `<div class="item" style="grid-template-columns:1fr"><div><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span> <span class="muted small">${esc(r.user_email || '')} · ${ago(r.created_at)}</span><p>${esc(r.comment || '')}</p><div class="actions"><button class="btn sm bad" data-delreview="${r.id}">Borrar…</button></div></div></div>`).join('') : '<p class="muted">Sin reseñas.</p>'}</div>
      <div class="card"><h2>Posts (${d.posts.length})</h2>${d.posts.length ? d.posts.map((p) => `<div class="item">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : '<div class="ph">📝</div>'}<div><span class="muted small">${ago(p.created_at)}</span><p>${esc(p.body || '')}</p><div class="actions"><button class="btn sm bad" data-delpost="${p.id}">Borrar…</button></div></div></div>`).join('') : '<p class="muted">Sin posts.</p>'}</div>
    </div>
    <div class="grid2">
      <div class="card"><h2>Denuncias relacionadas (${d.reports.length})</h2>${d.reports.length ? table({ cols: [{ h: 'Sobre', r: (r) => tag(r.target_type, 'dim') }, { h: 'Motivo', r: (r) => `${esc(r.reason)}<span class="sub">${esc(r.details || '')}</span>` }, { h: 'Estado', r: (r) => tag(r.status) }, { h: 'Fecha', r: (r) => fmtDay(r.created_at) }], rows: d.reports }) : '<p class="muted">Ninguna.</p>'}<p style="margin:10px 0 0"><a class="link" href="#/denuncias">Ir a denuncias →</a></p></div>
      <div class="card"><h2>Registro de cambios</h2>${auditList(d.audit)}</div>
    </div>`;
  $$('#view tr.row').forEach((tr) => { tr.onclick = () => go(`#/publicaciones/${d.offers[tr.dataset.i].id}`); });
  $$('[data-role]').forEach((sel) => { sel.onchange = async () => { try { await rpc('admin_set_member_role', { p_business: id, p_user: sel.dataset.role, p_role: sel.value }); toast('Rol actualizado'); } catch (e) { toast(e.message, true); } }; });
  $$('[data-rm]').forEach((btn) => { btn.onclick = async () => { if (!await confirmDlg('Quitar del equipo', 'Esta persona dejará de poder gestionar el negocio ni validar códigos.', { danger: true, submit: 'Quitar' })) return; try { await rpc('admin_set_member_role', { p_business: id, p_user: btn.dataset.rm, p_role: null }); toast('Quitado'); route(); } catch (e) { toast(e.message, true); } }; });
  $$('[data-delreview]').forEach((btn) => { btn.onclick = () => deleteReview(btn.dataset.delreview); });
  $$('[data-delpost]').forEach((btn) => { btn.onclick = () => deletePost(btn.dataset.delpost); });
  $$('[data-a]').forEach((btn) => { btn.onclick = () => businessAction(btn.dataset.a, b, d); });
}

async function businessAction(a, b, d) {
  try {
    if (a === 'verify') {
      if (!await confirmDlg('Verificar negocio', `«${esc(b.name)}» pasará a verificado y activo: sus publicaciones aparecerán en la app y el dueño recibirá un aviso.`, { submit: 'Verificar' })) return;
      await rpc('admin_set_verification', { p_id: b.id, p_status: 'verified' }); toast('Negocio verificado');
    }
    if (a === 'reject') {
      const r = await modal({ title: 'Rechazar negocio', intro: 'El dueño recibirá el motivo como aviso en la app. Sé concreto: «no encontramos el local en la dirección indicada», «faltan datos fiscales»…', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }], submit: 'Rechazar', danger: true });
      if (!r) return;
      await rpc('admin_set_verification', { p_id: b.id, p_status: 'rejected', p_reason: r.reason }); toast('Negocio rechazado');
    }
    if (a === 'active') {
      if (b.is_active && !await confirmDlg('Desactivar negocio', 'El negocio y sus publicaciones dejarán de verse en la app hasta que lo actives de nuevo.', { danger: true, submit: 'Desactivar' })) return;
      await rpc('admin_set_business_active', { p_id: b.id, p_active: !b.is_active }); toast(b.is_active ? 'Negocio desactivado' : 'Negocio activado');
    }
    if (a === 'edit') {
      const cats = await rpc('admin_categories');
      const r = await modal({ title: 'Editar ficha', fields: [
        { name: 'name', label: 'Nombre', value: b.name, required: true },
        { name: 'category_id', label: 'Categoría', type: 'select', value: b.category_id || '', options: [['', '—'], ...cats.map((c) => [c.id, (c.names?.es || c.slug)])] },
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
        { name: 'plan', label: 'Plan', type: 'select', value: cur?.plan || 'standard', options: plans.map((p) => [p.slug, `${p.names?.es || p.slug} · ${fmtMoney(p.price_cents)}/mes`]) },
        { name: 'status', label: 'Estado', type: 'select', value: 'active', options: [['active', 'Activa (pagada)'], ['trial', 'Prueba gratuita'], ['past_due', 'Impagada'], ['cancelled', 'Cancelada']] },
        { name: 'period_end', label: 'Fin del periodo', type: 'date', value: cur?.period_end || '', help: 'Vacío = sin fecha de fin.' },
        { name: 'method', label: 'Forma de pago', type: 'select', value: 'transfer', options: [['transfer', 'Transferencia'], ['cash', 'Efectivo'], ['card', 'Tarjeta'], ['none', 'Ninguna']] },
      ] });
      if (!r) return;
      await rpc('admin_set_subscription', { p_business: b.id, p_plan_slug: r.plan, p_status: r.status, p_period_end: r.period_end || null, p_payment_method: r.method }); toast('Plan actualizado');
    }
    if (a === 'pay') {
      const today = new Date().toISOString().slice(0, 10); const next = new Date(); next.setMonth(next.getMonth() + 1);
      const r = await modal({ title: 'Registrar pago', intro: 'Anota un cobro recibido (transferencia, efectivo…). La suscripción pasa a activa y su fin se amplía hasta el fin del periodo pagado.', fields: [
        { name: 'amount', label: 'Importe (€)', type: 'number', step: '0.01', required: true, placeholder: '19,00' },
        { name: 'method', label: 'Forma de pago', type: 'select', value: 'transfer', options: [['transfer', 'Transferencia'], ['cash', 'Efectivo'], ['card', 'Tarjeta']] },
        { name: 'start', label: 'Inicio del periodo pagado', type: 'date', value: today, required: true }, { name: 'end', label: 'Fin del periodo pagado', type: 'date', value: next.toISOString().slice(0, 10), required: true },
        { name: 'notes', label: 'Notas (nº de factura, referencia…)' },
      ] });
      if (!r) return;
      await rpc('admin_record_payment', { p_business: b.id, p_amount_cents: Math.round(parseFloat(r.amount.replace(',', '.')) * 100), p_method: r.method, p_period_start: r.start, p_period_end: r.end, p_notes: r.notes || null }); toast('Pago registrado');
    }
    if (a === 'notify') {
      const r = await modal({ title: 'Aviso al equipo del negocio', intro: 'Lo reciben el dueño y los encargados como notificación (y push si la tienen activada).', fields: [{ name: 'title', label: 'Título', required: true }, { name: 'body', label: 'Texto', type: 'textarea', required: true }] });
      if (!r) return;
      const ids = d.members.filter((m) => ['owner', 'manager'].includes(m.role)).map((m) => m.user_id);
      const n = await rpc('admin_send_notification', { p_audience: 'ids', p_user_ids: ids, p_title: r.title, p_body: r.body, p_route: '/my-business/' + b.id }); toast(`Aviso enviado a ${n} persona(s)`);
    }
    if (a === 'addmember') {
      const r = await modal({ title: 'Añadir persona al equipo', intro: 'Busca por email en «Usuarios» y copia su id, o escribe aquí su email exacto.', fields: [{ name: 'email', label: 'Email del usuario', type: 'email', required: true }, { name: 'role', label: 'Rol', type: 'select', value: 'staff', options: [['staff', 'Empleado (valida códigos)'], ['manager', 'Encargado (gestiona publicaciones)'], ['owner', 'Propietario']] }] });
      if (!r) return;
      const u = await rpc('admin_users', { p_query: r.email, p_limit: 5 });
      const found = u.rows.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
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
  'report.resolve': 'Denuncia resuelta', 'review.delete': 'Reseña borrada', 'post.delete': 'Post borrado', 'user.ban': 'Usuario suspendido', 'user.unban': 'Usuario reactivado', 'user.premium': 'Premium cambiado',
  'user.type': 'Tipo de cuenta cambiado', 'user.delete': 'Cuenta borrada', 'notification.send': 'Aviso enviado', 'push.retry': 'Push reintentado', 'config.set': 'Configuración cambiada', 'plan.upsert': 'Plan guardado',
  'category.upsert': 'Categoría guardada', 'category.delete': 'Categoría borrada', 'admin.add': 'Administrador añadido', 'admin.remove': 'Administrador quitado', 'maintenance.expire_offers': 'Caducidad forzada',
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
    ${helpBox('¿Qué hago aquí?', '<p>Ofertas flash y eventos de todos los negocios. Las <b>pendientes de moderar</b> son de negocios que aún no han sido verificados o que han sido marcadas para revisión: si cumplen las <a class="link" href="/normas/" target="_blank">Normas de la comunidad</a> (sin contenido engañoso, fotos propias, sin alcohol a menores…) pulsa <b>Aprobar</b>; si no, <b>Retirar</b> con un motivo, que el negocio recibe junto con la vía de recurso (obligatorio por el DSA). El sistema pone en revisión automáticamente las que mencionan <b>alcohol</b> (además las marca +18: solo las ven mayores), <b>tabaco/vapeo</b> (publicidad prohibida: retirar) o <b>apuestas</b>; verás la etiqueta del motivo.</p>')}
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
        { h: 'Publicación', r: (o) => `${img(o.images?.[0], KIND_ICON[o.kind])}<span class="title">${esc(o.title)}<span class="sub">${LABELS[o.kind]} · <a class="link" href="#/negocios/${o.business_id}" onclick="event.stopPropagation()">${esc(o.business_name)}</a> ${o.verification_status !== 'verified' ? tag(o.verification_status) : ''}</span></span>` },
        { h: 'Estado', r: (o) => `${tag(o.status)} ${tag(o.moderation_status)} ${flagTags(o)} ${o.adults_only ? '<span class="tag bad">+18</span>' : ''} ${o.is_boosted ? '<span class="tag">boost</span>' : ''} ${o.open_reports ? `<span class="tag bad">🚩 ${o.open_reports}</span>` : ''}` },
        { h: 'Cuándo', r: (o) => `<span class="nowrap">${o.kind === 'flash_offer' ? `${fmtDate(o.redeem_start_at)}<span class="sub">→ ${fmtDate(o.redeem_end_at)}</span>` : fmtDate(o.event_at)}</span>` },
        { h: 'Precio', r: (o) => `${o.discount ? `<span class="tag">${esc(discountLabel(o.discount))}</span> ` : ''}${o.price_cents != null ? fmtMoney(o.price_cents, o.currency) : ''}` },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views_count) },
        { h: 'Canjeos', num: true, r: (o) => `${o.redemptions_count}${o.max_redemptions ? `<span class="muted"> / ${o.max_redemptions}</span>` : ''}` },
        { h: '', r: (o) => `<span class="actions">${o.moderation_status !== 'approved' ? `<button class="btn sm ok" data-mod="${o.id}" data-val="approved">Aprobar</button>` : ''}${o.moderation_status !== 'rejected' ? `<button class="btn sm bad" data-mod="${o.id}" data-val="rejected">Retirar</button>` : ''}</span>` },
      ], rows, onRow: true, empty: 'No hay publicaciones con esos filtros.',
    }) + pg.html;
    pg.bind($('#list'));
    $$('#list tr.row').forEach((tr) => { tr.onclick = (e) => { if (e.target.closest('button,a')) return; go(`#/publicaciones/${rows[tr.dataset.i].id}`); }; });
    $$('#list [data-mod]').forEach((btn) => { btn.onclick = async () => { if (await moderateOffer(btn.dataset.mod, btn.dataset.val)) load(); }; });
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['moderation', 'status', 'kind'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  if ($('#clearbiz')) $('#clearbiz').onclick = () => { s.business = null; go('#/publicaciones'); };
  $('#csv').onclick = () => downloadCsv('publicaciones', rows, [['id', 'id'], ['kind', 'tipo'], ['title', 'título'], ['business_name', 'negocio'], ['status', 'estado'], ['moderation_status', 'moderación'], ['redeem_start_at', 'inicio canje'], ['redeem_end_at', 'fin canje'], ['event_at', 'evento'], ['price_cents', 'precio (cts)'], ['views_count', 'vistas'], ['redemptions_count', 'canjeos'], ['max_redemptions', 'máx'], ['created_at', 'creada']]);
  await load();
};
const discountLabel = (d) => { if (!d) return ''; if (d.type === 'percent') return `−${d.value} %`; if (d.type === 'amount') return `−${(d.value / 100).toFixed(2)} €`; if (d.type === 'fixed_price') return `${(d.value / 100).toFixed(2)} €`; if (d.type === 'two_for_one') return '2×1'; return d.label || JSON.stringify(d); };

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
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/publicaciones">← Publicaciones</a></div>
    <div class="detail-head">
      ${o.images?.[0] ? `<img src="${esc(o.images[0])}" alt="">` : `<div class="ph">${KIND_ICON[o.kind]}</div>`}
      <div><h1>${esc(o.title)}</h1><div class="tags">${tag(o.kind, 'dim')} ${tag(o.status)} ${tag(o.moderation_status)} ${flagTags(o)} ${o.adults_only ? '<span class="tag bad">+18</span>' : ''} ${o.is_boosted ? `<span class="tag">boost hasta ${fmtDate(o.boosted_until)}</span>` : ''}</div>
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
        ${o.kind === 'flash_offer' ? `<dt>Canje</dt><dd>${fmtDate(o.redeem_start_at)} → ${fmtDate(o.redeem_end_at)}</dd>` : `<dt>Evento</dt><dd>${fmtDate(o.event_at)}${o.event_end_at ? ` → ${fmtDate(o.event_end_at)}` : ''}</dd>`}
        <dt>Descuento / precio</dt><dd>${o.discount ? esc(discountLabel(o.discount)) : '—'} ${o.price_cents != null ? `· ${fmtMoney(o.price_cents, o.currency)}` : ''}</dd>
        <dt>Aforo</dt><dd>${o.max_redemptions ? `${o.redemptions_count} de ${o.max_redemptions}` : `${o.redemptions_count} (sin límite)`} ${o.max_per_user ? `· máx. ${o.max_per_user} por persona` : ''}</dd>
        <dt>Enlace externo</dt><dd>${o.external_url ? `<a class="link" target="_blank" rel="noopener" href="${esc(o.external_url)}">${esc(o.external_url)}</a>` : '—'}</dd>
        <dt>Diseño</dt><dd>${o.style && Object.keys(o.style).length ? esc(JSON.stringify(o.style)) : 'por defecto'}</dd>
        <dt>Guardada por</dt><dd>${fmtNum(d.saved)} persona(s)</dd>
        <dt>Posición</dt><dd>${o.lat ? `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${o.lat},${o.lng}">${o.lat.toFixed(5)}, ${o.lng.toFixed(5)} ↗</a>` : 'la del negocio'}</dd>
        <dt>Creada / editada</dt><dd>${fmtDate(o.created_at)} · ${fmtDate(o.updated_at)}</dd>
        <dt>Id</dt><dd><code>${o.id}</code></dd>
      </dl>
      ${(o.images || []).length ? `<h3 style="margin-top:12px">Fotos</h3><div class="gallery">${o.images.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt=""></a>`).join('')}</div>` : ''}
      </div>
      <div>
        <div class="card"><h2>Últimos 14 días</h2><div class="kpis"><div class="kpi"><b>${fmtNum(o.views_count)}</b><span>vistas totales</span></div><div class="kpi"><b>${fmtNum(o.redemptions_count)}</b><span>canjeos totales</span></div><div class="kpi"><b>${o.views_count ? Math.round(o.redemptions_count / o.views_count * 100) : 0} %</b><span>conversión</span></div></div>
          <p class="muted small" style="margin:10px 0 0">Vistas</p>${bars(d.series, 'views', (s) => fmtDay(s.day))}<p class="muted small" style="margin:10px 0 0">Canjeos</p>${bars(d.series, 'redemptions', (s) => fmtDay(s.day))}</div>
        <div class="card"><h2>Denuncias (${d.reports.length})</h2>${d.reports.length ? d.reports.map((r) => `<div class="item" style="grid-template-columns:1fr"><div><b>${esc(r.reason)}</b> ${tag(r.status)} <span class="muted small">${ago(r.created_at)}</span><p>${esc(r.details || '')}</p></div></div>`).join('') + '<a class="link" href="#/denuncias">Gestionar en denuncias →</a>' : '<p class="muted">Ninguna.</p>'}</div>
        <div class="card"><h2>Registro de cambios</h2>${auditList(d.audit)}</div>
      </div>
    </div>
    <div class="card"><h2>Canjeos (${d.redemptions.length} últimos)</h2>
      ${table({ cols: [{ h: 'Usuario', r: (r) => esc(r.user_email || '—') }, { h: 'Código', r: (r) => `<code>${esc(r.code)}</code>` }, { h: 'Estado', r: (r) => tag(r.status) }, { h: 'Generado', r: (r) => fmtDate(r.created_at) }, { h: 'Validado', r: (r) => `${fmtDate(r.validated_at)}<span class="sub">${esc(r.validated_by_email || '')}</span>` }], rows: d.redemptions, empty: 'Nadie ha canjeado todavía.' })}
    </div>`;
  $$('[data-a]').forEach((btn) => { btn.onclick = async () => {
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
          const r = await modal({ title: 'Destacar publicación', intro: 'Sale la primera en Descubre y en el mapa hasta la fecha indicada.', fields: [{ name: 'until', label: 'Hasta', type: 'datetime-local', required: true, value: new Date(Date.now() + 7 * 86400e3).toISOString().slice(0, 16) }] });
          if (!r) return; await rpc('admin_set_offer_boost', { p_id: o.id, p_until: new Date(r.until).toISOString() }); toast('Publicación destacada');
        }
      }
      route();
    } catch (e) { toast(e.message, true); }
  }; });
}

// ── Canjeos ─────────────────────────────────────────────────────────────────
PAGES.canjeos = async (v) => {
  const s = st.canjeos;
  v.innerHTML = `
    <div class="page-head"><h1>Canjeos</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', '<p>Cada vez que un usuario pulsa «Canjear» se genera un código de un solo uso válido 5 minutos (<b>pendiente</b>); cuando el negocio lo escanea pasa a <b>validado</b>; si no, <b>caduca</b>. Sirve para atender reclamaciones («me cobraron y no aplicaron el descuento») y detectar abusos: busca por email, negocio, título o código.</p>')}
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
    ], rows, empty: 'Sin canjeos con esos filtros.' }) + pg.html;
    pg.bind($('#list'));
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['status', 'from', 'to'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  $('#csv').onclick = () => downloadCsv('canjeos', rows, [['id', 'id'], ['title', 'publicación'], ['business', 'negocio'], ['user_email', 'usuario'], ['code', 'código'], ['status', 'estado'], ['created_at', 'generado'], ['validated_at', 'validado'], ['validated_by_email', 'validado por']]);
  await load();
};

// ── Usuarios ────────────────────────────────────────────────────────────────
PAGES.usuarios = async (v, id) => {
  if (id) return userDetail(v, id);
  const s = st.usuarios;
  v.innerHTML = `
    <div class="page-head"><h1>Usuarios</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', '<p>Todas las cuentas de la app. Pulsa en una para ver su ficha: consentimientos (RGPD), negocios, canjeos, reseñas y denuncias; desde allí puedes <b>suspender</b> a quien incumpla las normas, dar <b>premium</b>, o <b>borrar la cuenta</b> si el usuario lo pide por email (derecho de supresión; también puede hacerlo él mismo desde la app).</p>')}
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
      { h: 'Usuario', r: (u) => `${img(u.avatar_url, '👤')}<span class="title">${esc(u.display_name || '—')}<span class="sub">${esc(u.email)}</span></span>` },
      { h: 'Tipo', r: (u) => `${tag(u.user_type || 'user', 'dim')} ${u.is_admin ? '<span class="tag">admin</span>' : ''} ${u.is_premium ? '<span class="tag ok">premium</span>' : ''} ${u.banned_at ? tag('banned', 'st-banned') : ''} ${!u.email_confirmed_at ? '<span class="tag warn">email sin confirmar</span>' : ''}` },
      { h: 'Negocios', num: true, r: (u) => u.memberships || 0 }, { h: 'Canjeos', num: true, r: (u) => u.redemptions || 0 },
      { h: 'Alta', r: (u) => `<span class="nowrap">${fmtDay(u.created_at)}</span>` }, { h: 'Último acceso', r: (u) => `<span class="nowrap">${ago(u.last_sign_in_at)}</span>` },
    ], rows, onRow: true, empty: 'Sin usuarios con esos filtros.' }) + pg.html;
    pg.bind($('#list'));
    $$('#list tr.row').forEach((tr) => { tr.onclick = () => go(`#/usuarios/${rows[tr.dataset.i].id}`); });
  };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  ['type', 'banned', 'sort'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  $('#csv').onclick = () => downloadCsv('usuarios', rows, [['id', 'id'], ['email', 'email'], ['display_name', 'nombre'], ['user_type', 'tipo'], ['locale', 'idioma'], [(u) => u.is_premium ? 'sí' : 'no', 'premium'], [(u) => u.banned_at ? 'sí' : 'no', 'suspendido'], [(u) => u.marketing_consent ? 'sí' : 'no', 'consentimiento marketing'], ['memberships', 'negocios'], ['redemptions', 'canjeos'], ['created_at', 'alta'], ['last_sign_in_at', 'último acceso']]);
  await load();
};

async function userDetail(v, id) {
  const d = await rpc('admin_user_detail', { p_id: id });
  const u = d.user;
  if (!u) throw new Error('Usuario no encontrado.');
  const prefs = d.notification_prefs;
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/usuarios">← Usuarios</a></div>
    <div class="detail-head">
      ${u.avatar_url ? `<img src="${esc(u.avatar_url)}" alt="">` : '<div class="ph">👤</div>'}
      <div><h1>${esc(u.display_name || u.email)}</h1><div class="tags">${tag(u.user_type || 'user', 'dim')} ${u.is_admin ? '<span class="tag">administrador</span>' : ''} ${u.is_premium ? `<span class="tag ok">premium${u.premium_until ? ` hasta ${fmtDay(u.premium_until)}` : ''}</span>` : ''} ${u.banned_at ? `<span class="tag bad">suspendido ${fmtDay(u.banned_at)}</span>` : ''} ${!u.email_confirmed_at ? '<span class="tag warn">email sin confirmar</span>' : ''}</div><div class="muted small" style="margin-top:4px">${esc(u.email)}</div></div>
      <span class="spacer"></span>
      <div class="actions">
        <button class="btn ${u.banned_at ? 'ok' : 'bad'}" data-a="ban">${u.banned_at ? 'Reactivar cuenta' : 'Suspender…'}</button>
        <button class="btn" data-a="premium">Premium…</button>
        <button class="btn" data-a="type">Tipo de cuenta…</button>
        <button class="btn" data-a="notify">Enviar aviso…</button>
        <button class="btn" data-a="admin">${u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
        <button class="btn bad ghost" data-a="delete">Borrar cuenta…</button>
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
        <dt>Términos</dt><dd>${u.terms_accepted_at ? `aceptados ${fmtDate(u.terms_accepted_at)} (v${esc(u.terms_version || '?')})` : '<span class="tag warn">sin registro</span>'}</dd>
        <dt>Comunicaciones comerciales</dt><dd>${u.marketing_consent ? `sí, ${fmtDate(u.marketing_consent_at)}` : 'no'}</dd>
        <dt>Ubicación</dt><dd>${u.location_consent_at ? `consentida ${fmtDate(u.location_consent_at)} · última ${ago(u.last_location_at)}` : 'no consentida'}</dd>
        <dt>Avisos</dt><dd>${prefs ? `favoritos: ${prefs.notify_favorites ? 'sí' : 'no'} · cerca: ${prefs.notify_nearby ? `sí (${prefs.nearby_radius_m} m)` : 'no'}${prefs.quiet_hours_start ? ` · silencio ${esc(prefs.quiet_hours_start)}–${esc(prefs.quiet_hours_end)}` : ''}` : 'por defecto'}</dd>
      </dl><p class="muted small" style="margin:10px 0 0">Para atender un derecho de acceso, usa «Exportar» en cada listado o pide el volcado en Supabase; para supresión, «Borrar cuenta».</p></div>
    </div>
    <div class="grid2">
      <div class="card"><h2>Negocios (${d.memberships.length})</h2>${d.memberships.length ? table({ cols: [{ h: 'Negocio', r: (m) => `<a class="link" href="#/negocios/${m.business_id}">${esc(m.name)}</a><span class="sub">${esc(m.city || '')}</span>` }, { h: 'Rol', r: (m) => tag(m.role, 'dim') }, { h: 'Estado', r: (m) => tag(m.verification_status) }], rows: d.memberships }) : '<p class="muted">No pertenece a ningún negocio.</p>'}</div>
      <div class="card"><h2>Canjeos (${d.redemptions.length} últimos)</h2>${table({ cols: [{ h: 'Publicación', r: (r) => `${esc(r.title)}<span class="sub">${esc(r.business)}</span>` }, { h: 'Estado', r: (r) => tag(r.status) }, { h: 'Fecha', r: (r) => `<span class="nowrap">${fmtDate(r.validated_at || r.created_at)}</span>` }], rows: d.redemptions, empty: 'Ninguno.' })}</div>
    </div>
    <div class="grid2">
      <div class="card"><h2>Reseñas (${d.reviews.length})</h2>${d.reviews.length ? d.reviews.map((r) => `<div class="item" style="grid-template-columns:1fr"><div><span class="stars">${'★'.repeat(r.rating)}</span> <b>${esc(r.business)}</b> <span class="muted small">${ago(r.created_at)}</span><p>${esc(r.comment || '')}</p><div class="actions"><button class="btn sm bad" data-delreview="${r.id}">Borrar…</button></div></div></div>`).join('') : '<p class="muted">Ninguna.</p>'}</div>
      <div class="card"><h2>Denuncias que ha puesto (${d.reports_made.length})</h2>${d.reports_made.length ? table({ cols: [{ h: 'Sobre', r: (r) => tag(r.target_type, 'dim') }, { h: 'Motivo', r: (r) => esc(r.reason) }, { h: 'Estado', r: (r) => tag(r.status) }, { h: 'Fecha', r: (r) => fmtDay(r.created_at) }], rows: d.reports_made }) : '<p class="muted">Ninguna.</p>'}</div>
    </div>
    <div class="grid2">
      <div class="card"><h2>Últimas notificaciones</h2>${d.notifications.length ? `<ul style="margin:0;padding-left:18px;font-size:14px">${d.notifications.map((n) => `<li>${esc(n.title)} <span class="muted small">· ${esc(n.kind)} · ${ago(n.created_at)}${n.read_at ? ' · leída' : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Ninguna.</p>'}</div>
      <div class="card"><h2>Registro de cambios</h2>${auditList(d.audit)}</div>
    </div>`;
  $$('[data-delreview]').forEach((btn) => { btn.onclick = () => deleteReview(btn.dataset.delreview); });
  $$('[data-a]').forEach((btn) => { btn.onclick = async () => {
    try {
      const a = btn.dataset.a;
      if (a === 'ban') {
        if (u.banned_at) { await rpc('admin_set_user_ban', { p_id: u.id, p_banned: false }); toast('Cuenta reactivada'); }
        else {
          const r = await modal({ title: 'Suspender cuenta', intro: 'No podrá canjear, publicar, reseñar ni denunciar. Recibe un aviso con el motivo y la vía de recurso.', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }], submit: 'Suspender', danger: true });
          if (!r) return; await rpc('admin_set_user_ban', { p_id: u.id, p_banned: true, p_reason: r.reason }); toast('Cuenta suspendida');
        }
      }
      if (a === 'premium') {
        const r = await modal({ title: 'Premium', intro: 'Sin fecha = quitar premium.', fields: [{ name: 'until', label: 'Premium hasta', type: 'date', value: u.premium_until || '' }] });
        if (!r) return; await rpc('admin_set_premium', { p_id: u.id, p_until: r.until || null }); toast('Premium actualizado');
      }
      if (a === 'type') {
        const r = await modal({ title: 'Tipo de cuenta', fields: [{ name: 'type', label: 'Tipo', type: 'select', value: u.user_type, options: [['user', 'Usuario'], ['business', 'Cuenta de negocio']] }] });
        if (!r) return; await rpc('admin_set_user_type', { p_id: u.id, p_type: r.type }); toast('Tipo actualizado');
      }
      if (a === 'notify') {
        const r = await modal({ title: 'Aviso al usuario', fields: [{ name: 'title', label: 'Título', required: true }, { name: 'body', label: 'Texto', type: 'textarea', required: true }] });
        if (!r) return; await rpc('admin_send_notification', { p_audience: 'ids', p_user_ids: [u.id], p_title: r.title, p_body: r.body }); toast('Aviso enviado');
      }
      if (a === 'admin') {
        if (u.is_admin) { if (!await confirmDlg('Quitar permisos de administrador', `${esc(u.email)} dejará de poder entrar en este panel.`, { danger: true, submit: 'Quitar' })) return; await rpc('admin_remove_admin', { p_user_id: u.id }); toast('Ya no es administrador'); }
        else { if (!await confirmDlg('Hacer administrador', `${esc(u.email)} podrá entrar en este panel con todos los permisos.`, { submit: 'Hacer admin' })) return; await rpc('admin_add_admin', { p_email: u.email }); toast('Ahora es administrador'); }
      }
      if (a === 'delete') {
        const r = await modal({ title: 'Borrar cuenta definitivamente', warn: 'Se borra todo: perfil, canjeos, reseñas, favoritos y <b>los negocios de los que sea propietario con todas sus publicaciones</b>. No se puede deshacer. Hazlo solo a petición del usuario (derecho de supresión) o por incumplimiento grave.', fields: [{ name: 'reason', label: 'Motivo (queda en el registro)', type: 'textarea', required: true }], submit: 'Borrar para siempre', danger: true, confirmWord: 'BORRAR' });
        if (!r) return; await rpc('admin_delete_user', { p_id: u.id, p_reason: r.reason }); toast('Cuenta borrada'); go('#/usuarios'); return;
      }
      route();
    } catch (e) { toast(e.message, true); }
  }; });
}

// ── Reseñas y posts ─────────────────────────────────────────────────────────
async function deleteReview(id) {
  const r = await modal({ title: 'Borrar reseña', intro: 'El autor recibe un aviso con el motivo y puede recurrir.', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }], submit: 'Borrar', danger: true });
  if (!r) return;
  try { await rpc('admin_delete_review', { p_id: id, p_reason: r.reason }); toast('Reseña borrada'); route(); } catch (e) { toast(e.message, true); }
}
async function deletePost(id) {
  const r = await modal({ title: 'Borrar post', intro: 'El negocio recibe un aviso con el motivo y puede recurrir.', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }], submit: 'Borrar', danger: true });
  if (!r) return;
  try { await rpc('admin_delete_post', { p_id: id, p_reason: r.reason }); toast('Post borrado'); route(); } catch (e) { toast(e.message, true); }
}
PAGES.resenas = async (v) => {
  const p = params(); let tab = p.tab || 'reviews';
  const sR = st.resenas, sP = st.posts;
  v.innerHTML = `
    <div class="page-head"><h1>Reseñas y posts</h1></div>
    ${helpBox('¿Qué hago aquí?', '<p>Las <b>reseñas</b> las escriben usuarios sobre negocios; los <b>posts</b> los publican los negocios en su perfil. Bórralos solo si incumplen las normas (insultos, datos personales, spam, contenido que no es del local). El autor recibe el motivo.</p>')}
    <div class="tabs"><button data-t="reviews" class="${tab === 'reviews' ? 'on' : ''}">Reseñas</button><button data-t="posts" class="${tab === 'posts' ? 'on' : ''}">Posts</button></div>
    <div class="toolbar"><input id="q" class="grow" placeholder="Buscar por texto, negocio o email…"><select id="rating" ${tab === 'posts' ? 'hidden' : ''}>${[['', 'Cualquier puntuación'], ['1', 'Solo 1 ★'], ['2', '≤ 2 ★'], ['3', '≤ 3 ★']].map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  const load = async () => {
    if (tab === 'reviews') {
      const r = await rpc('admin_reviews', { p_query: sR.q || null, p_max_rating: sR.rating ? +sR.rating : null, p_limit: sR.limit, p_offset: sR.offset });
      const pg = pager(sR, r.total, load);
      $('#list').innerHTML = (r.rows.length ? r.rows.map((x) => `<div class="item"><div class="ph">💬</div><div><h3><span class="stars">${'★'.repeat(x.rating)}${'☆'.repeat(5 - x.rating)}</span> en <a class="link" href="#/negocios/${x.business_id}">${esc(x.business)}</a> ${x.open_reports ? `<span class="tag bad">🚩 ${x.open_reports}</span>` : ''}</h3><div class="meta">${esc(x.user_email || 'anónimo')} · ${fmtDate(x.created_at)}</div><p>${esc(x.comment || '(sin texto)')}</p><div class="actions"><button class="btn sm bad" data-del="${x.id}">Borrar…</button></div></div></div>`).join('') : '<div class="tbl-wrap"><div class="empty">Sin reseñas.</div></div>') + pg.html;
      pg.bind($('#list'));
      $$('#list [data-del]').forEach((b) => { b.onclick = () => deleteReview(b.dataset.del); });
    } else {
      const r = await rpc('admin_posts', { p_query: sP.q || null, p_limit: sP.limit, p_offset: sP.offset });
      const pg = pager(sP, r.total, load);
      $('#list').innerHTML = (r.rows.length ? r.rows.map((x) => `<div class="item">${x.image_url ? `<img src="${esc(x.image_url)}" alt="">` : '<div class="ph">📝</div>'}<div><h3><a class="link" href="#/negocios/${x.business_id}">${esc(x.business)}</a> ${x.open_reports ? `<span class="tag bad">🚩 ${x.open_reports}</span>` : ''}</h3><div class="meta">${fmtDate(x.created_at)}</div><p>${esc(x.body || '')}</p><div class="actions"><button class="btn sm bad" data-del="${x.id}">Borrar…</button></div></div></div>`).join('') : '<div class="tbl-wrap"><div class="empty">Sin posts.</div></div>') + pg.html;
      pg.bind($('#list'));
      $$('#list [data-del]').forEach((b) => { b.onclick = () => deletePost(b.dataset.del); });
    }
  };
  $$('.tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#rating').hidden = tab === 'posts'; load(); }; });
  $('#q').oninput = debounce(() => { const q = $('#q').value.trim(); sR.q = q; sP.q = q; sR.offset = sP.offset = 0; load(); });
  $('#rating').onchange = () => { sR.rating = $('#rating').value; sR.offset = 0; load(); };
  await load();
};

// ── Denuncias ───────────────────────────────────────────────────────────────
PAGES.denuncias = async (v) => {
  const s = st.denuncias;
  v.innerHTML = `
    <div class="page-head"><h1>Denuncias</h1></div>
    ${helpBox('¿Qué hago aquí?', '<p>Cuando un usuario denuncia una publicación, negocio, reseña o post, aparece aquí. Revisa el contenido (botón «Ver»), y decide: <b>Retirar y cerrar</b> (la oferta se retira, el negocio se desactiva, la reseña o el post se borran; el autor recibe el motivo y puede recurrir en 15 días), <b>Cerrar sin retirar</b> (la denuncia era razonable pero el contenido es correcto) o <b>Desestimar</b> (denuncia sin fundamento). Por ley (DSA) hay que resolverlas con diligencia y motivar la decisión.</p>')}
    <div class="toolbar">
      <select id="status">${[['open', 'Abiertas'], ['resolved', 'Resueltas'], ['dismissed', 'Desestimadas'], ['all', 'Todas']].map((o) => `<option value="${o[0]}" ${(s.status || 'open') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="type">${[['all', 'Todo tipo'], ['offer', 'Publicaciones'], ['business', 'Negocios'], ['review', 'Reseñas'], ['post', 'Posts']].map((o) => `<option value="${o[0]}" ${(s.type || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  const target = (r) => {
    const t = r.target || {};
    if (!r.target) return '<span class="tag dim">contenido ya eliminado</span>';
    if (r.target_type === 'offer') return `Publicación <a class="link" href="#/publicaciones/${r.target_id}">«${esc(t.title)}»</a> de <a class="link" href="#/negocios/${t.business_id}">${esc(t.business)}</a> · ${tag(t.moderation)} ${tag(t.status)}`;
    if (r.target_type === 'business') return `Negocio <a class="link" href="#/negocios/${r.target_id}">«${esc(t.name)}»</a> (${esc(t.city || '')}) · ${t.active ? tag('active') : tag('inactive', 'st-inactive')} ${tag(t.verification)}`;
    if (r.target_type === 'review') return `Reseña <span class="stars">${'★'.repeat(t.rating)}</span> en <a class="link" href="#/negocios/${t.business_id}">${esc(t.business)}</a>: «${esc(t.comment || '')}» · <a class="link" href="#/usuarios/${t.user_id}">autor</a>`;
    if (r.target_type === 'post') return `Post de <a class="link" href="#/negocios/${t.business_id}">${esc(t.business)}</a>: «${esc(t.body || '')}»`;
    return '';
  };
  const load = async () => {
    const r = await rpc('admin_reports_page', { p_status: s.status || 'open', p_type: s.type || 'all', p_limit: s.limit, p_offset: s.offset });
    const pg = pager(s, r.total, load);
    $('#list').innerHTML = (r.rows.length ? r.rows.map((x) => `
      <div class="item">${x.target?.image ? `<img src="${esc(x.target.image)}" alt="">` : '<div class="ph">🚩</div>'}<div>
        <h3>${esc(x.reason)} ${tag(x.status)} ${tag(x.target_type, 'dim')} ${x.same_target_count > 1 ? `<span class="tag warn">${x.same_target_count} denuncias sobre lo mismo</span>` : ''}</h3>
        <div class="meta">${fmtDate(x.created_at)} · por ${x.reporter_id ? `<a class="link" href="#/usuarios/${x.reporter_id}">${esc(x.reporter_email || 'usuario')}</a>` : 'anónimo'}${x.resolved_at ? ` · cerrada ${fmtDate(x.resolved_at)}` : ''}</div>
        <p>${target(x)}</p>${x.details ? `<div class="meta">Detalles: ${esc(x.details)}</div>` : ''}
        ${['open', 'reviewing'].includes(x.status) ? `<div class="actions">
          <button class="btn sm bad" data-res="${x.id}" data-status="resolved" data-action="hide" ${x.target ? '' : 'disabled'}>Retirar contenido y cerrar…</button>
          <button class="btn sm ok" data-res="${x.id}" data-status="resolved" data-action="none">Cerrar sin retirar</button>
          <button class="btn sm ghost" data-res="${x.id}" data-status="dismissed" data-action="none">Desestimar</button>
          ${x.status === 'open' ? `<button class="btn sm ghost" data-res="${x.id}" data-status="reviewing" data-action="none">Marcar en revisión</button>` : ''}
          ${x.target_type === 'offer' ? appLink('/o/' + x.target_id, 'Ver') : x.target_type === 'business' ? appLink('/b/' + x.target_id, 'Ver') : ''}
        </div>` : ''}
      </div></div>`).join('') : '<div class="tbl-wrap"><div class="empty">Sin denuncias con esos filtros.</div></div>') + pg.html;
    pg.bind($('#list'));
    $$('#list [data-res]').forEach((b) => { b.onclick = async () => {
      let reason = null;
      if (b.dataset.action === 'hide') {
        const r = await modal({ title: 'Retirar contenido', intro: 'Publicaciones: se retiran; negocios: se desactivan; reseñas y posts: se borran. Se cierran también las demás denuncias sobre el mismo contenido.', fields: [{ name: 'reason', label: 'Motivo que verá quien lo publicó (obligatorio por el DSA)', type: 'textarea', required: true }], submit: 'Retirar y cerrar', danger: true });
        if (!r) return; reason = r.reason;
      }
      try { await rpc('admin_resolve_report', { p_id: b.dataset.res, p_status: b.dataset.status, p_action: b.dataset.action, p_reason: reason }); toast('Denuncia actualizada'); refreshBadges(); load(); } catch (e) { toast(e.message, true); }
    }; });
  };
  ['status', 'type'].forEach((k) => { $('#' + k).onchange = () => { s[k] = $('#' + k).value; s.offset = 0; load(); }; });
  await load();
};

// ── Sugerencias y fallos ────────────────────────────────────────────────────
PAGES.sugerencias = async (v) => {
  const s = st.sugerencias;
  s.status = s.status || 'open';
  v.innerHTML = `
    <div class="page-head"><h1>Sugerencias</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', '<p>Lo que la gente escribe desde la app (Perfil → «Sugerencias y mejoras»): ideas, fallos y mensajes de negocios. Los <b>fallos</b> te llegan además como aviso al móvil. Marca cada una con lo que vas a hacer —<b>la estamos viendo</b>, <b>la haremos</b>, <b>hecho</b> o <b>de momento no</b>— y, si quieres, <b>responde</b>: la persona recibe tu respuesta como notificación. Las notas internas no las ve nadie de fuera.</p>')}
    <div id="counts"></div>
    <div class="toolbar">
      <input id="q" class="grow" placeholder="Buscar en el texto o por email…" value="${esc(s.q || '')}">
      <select id="status">${[['open', 'Sin resolver'], ['new', 'Sin leer'], ['reviewing', 'En revisión'], ['planned', 'Las haremos'], ['done', 'Hechas'], ['declined', 'Descartadas'], ['all', 'Todas']].map((o) => `<option value="${o[0]}" ${s.status === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <select id="kind">${[['all', 'De todo'], ['suggestion', 'Sugerencias'], ['bug', 'Fallos'], ['business', 'De negocios'], ['other', 'Otros']].map((o) => `<option value="${o[0]}" ${(s.kind || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  let rows = [];
  const kindIcon = { suggestion: '💡', bug: '🐞', business: '🏪', other: '💬' };
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
      <div class="item"><div class="ph">${kindIcon[f.kind] || '💬'}</div><div>
        <h3>${tag(f.kind, 'dim')} ${tag(f.status)} ${f.replied_at ? '<span class="tag ok">respondida</span>' : ''}</h3>
        <div class="meta">${fmtDate(f.created_at)} · ${f.user_id ? `<a class="link" href="#/usuarios/${f.user_id}">${esc(f.user_email || f.user_name || 'usuario')}</a>` : 'sin cuenta'}${f.from_same_user > 1 ? ` · ${f.from_same_user} mensajes suyos` : ''} · ${esc(f.app_version || '?')} · ${esc(f.platform || '?')}${f.locale ? ' · ' + esc(f.locale) : ''}</div>
        <p style="white-space:pre-wrap">${esc(f.message)}</p>
        ${f.admin_note ? `<div class="meta"><b>Nota interna:</b> ${esc(f.admin_note)}</div>` : ''}
        <div class="actions">
          <button class="btn sm" data-set="${f.id}" data-status="reviewing">La estoy viendo</button>
          <button class="btn sm ok" data-set="${f.id}" data-status="planned">La haremos</button>
          <button class="btn sm ok" data-set="${f.id}" data-status="done">Hecho</button>
          <button class="btn sm ghost" data-set="${f.id}" data-status="declined">De momento no</button>
          <button class="btn sm primary" data-reply="${f.id}">Responder…</button>
          <button class="btn sm ghost" data-note="${f.id}">Nota interna…</button>
          <button class="btn sm bad ghost" data-del="${f.id}">Borrar</button>
        </div>
      </div></div>`).join('') : '<div class="tbl-wrap"><div class="empty">Nada por aquí.</div></div>') + pg.html;
    pg.bind($('#list'));
    $$('#list [data-set]').forEach((b) => { b.onclick = async () => {
      try { await rpc('admin_set_feedback', { p_id: b.dataset.set, p_status: b.dataset.status }); toast('Actualizada'); refreshBadges(); load(); } catch (e) { toast(e.message, true); }
    }; });
    $$('#list [data-reply]').forEach((b) => { b.onclick = async () => {
      const r2 = await modal({ title: 'Responder', intro: 'Le llega como aviso en la app (y push si lo tiene activado). Sé concreto y breve.', fields: [
        { name: 'reply', label: 'Tu respuesta', type: 'textarea', required: true },
        { name: 'status', label: 'Y marcarla como', type: 'select', value: 'reviewing', options: [['reviewing', 'La estamos viendo'], ['planned', 'La haremos'], ['done', 'Hecho'], ['declined', 'De momento no'], ['new', 'Dejar sin leer']] },
      ], submit: 'Responder' });
      if (!r2) return;
      try { await rpc('admin_set_feedback', { p_id: b.dataset.reply, p_status: r2.status, p_reply: r2.reply }); toast('Respuesta enviada'); refreshBadges(); load(); } catch (e) { toast(e.message, true); }
    }; });
    $$('#list [data-note]').forEach((b) => { b.onclick = async () => {
      const f = rows.find((x) => x.id === b.dataset.note);
      const r2 = await modal({ title: 'Nota interna', intro: 'Solo la veis los administradores.', fields: [{ name: 'note', label: 'Nota', type: 'textarea', value: f?.admin_note || '' }] });
      if (!r2) return;
      try { await rpc('admin_set_feedback', { p_id: b.dataset.note, p_note: r2.note }); toast('Guardada'); load(); } catch (e) { toast(e.message, true); }
    }; });
    $$('#list [data-del]').forEach((b) => { b.onclick = async () => {
      if (!await confirmDlg('Borrar mensaje', 'Se borra para siempre. Úsalo solo con spam o duplicados.', { danger: true, submit: 'Borrar' })) return;
      try { await rpc('admin_delete_feedback', { p_id: b.dataset.del }); toast('Borrado'); refreshBadges(); load(); } catch (e) { toast(e.message, true); }
    }; });
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
    ${helpBox('¿Qué hago aquí?', '<p><b>Suscripciones</b>: qué plan tiene cada negocio y cuándo vence. Mientras no haya pago con tarjeta, los cobros se hacen por transferencia y se anotan a mano en la ficha del negocio («Registrar pago»). <b>Pagos</b>: histórico de cobros con totales por mes (para la contabilidad). <b>Planes</b>: precio y límites de cada plan (cambiarlos afecta a los negocios que los tengan).</p>')}
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
        { h: 'Plan', r: (x) => `${tag(x.plan, 'dim')} ${fmtMoney(x.price_cents)}/mes` }, { h: 'Estado', r: (x) => tag(x.status) },
        { h: 'Periodo', r: (x) => `${fmtDay(x.period_start)} → ${x.period_end ? fmtDay(x.period_end) : '∞'}` },
        { h: 'Vence', r: (x) => x.days_left == null ? '—' : x.days_left < 0 ? `<span class="tag bad">hace ${-x.days_left} d</span>` : x.days_left <= 7 ? `<span class="tag warn">en ${x.days_left} d</span>` : `en ${x.days_left} d` },
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
      $('#sum').innerHTML = `<div class="card"><div class="kpis"><div class="kpi accent"><b>${fmtMoney(r.sum_cents)}</b><span>total en el periodo (${fmtNum(r.total)} pagos)</span></div></div>${months.length ? `<p class="muted small" style="margin:10px 0 0">Por mes (12 meses)</p>${bars(months.map((m) => ({ ...m, cents: m.cents })), 'cents', (m) => `${m.month} · ${fmtMoney(m.cents)} (${m.n})`)}<div class="chart-legend">${months.map((m) => `<span>${m.month.slice(5)}: ${fmtMoney(m.cents)}</span>`).join('')}</div>` : ''}</div>`;
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
      csvCols = [['slug', 'slug'], [(x) => x.names?.es, 'nombre'], [(x) => (x.price_cents / 100).toFixed(2), 'precio (€)'], ['max_active_offers', 'máx. publicaciones activas'], ['boosts_included', 'boosts'], [(x) => x.has_analytics ? 'sí' : 'no', 'estadísticas'], ['current_subs', 'suscripciones']];
      tv.innerHTML = `<div class="toolbar"><span class="spacer"></span><button class="btn primary sm" id="newplan">Nuevo plan…</button></div>` + table({ cols: [
        { h: 'Plan', r: (x) => `<span class="title">${esc(x.names?.es || x.slug)}<span class="sub">${esc(x.slug)} · ${esc(x.names?.en || '')}</span></span>` },
        { h: 'Precio', num: true, r: (x) => `${fmtMoney(x.price_cents, x.currency)}/mes` }, { h: 'Publicaciones activas', num: true, r: (x) => x.max_active_offers ?? 'sin límite' },
        { h: 'Boosts', num: true, r: (x) => x.boosts_included }, { h: 'Estadísticas', r: (x) => x.has_analytics ? 'sí' : 'no' }, { h: 'Suscripciones', num: true, r: (x) => x.current_subs },
        { h: '', r: (x) => `<button class="btn sm" data-edit="${x.id}">Editar…</button>` },
      ], rows: plans });
      const edit = async (pl) => {
        const r = await modal({ title: pl ? 'Editar plan' : 'Nuevo plan', fields: [
          { name: 'slug', label: 'Identificador (slug)', value: pl?.slug, required: true, help: 'Sin espacios: free, basic, pro…' },
          { name: 'name_es', label: 'Nombre (ES)', value: pl?.names?.es, required: true }, { name: 'name_en', label: 'Nombre (EN)', value: pl?.names?.en },
          { name: 'price', label: 'Precio al mes (€)', type: 'number', step: '0.01', value: pl ? (pl.price_cents / 100).toFixed(2) : '0' },
          { name: 'max', label: 'Máx. publicaciones activas', type: 'number', value: pl?.max_active_offers ?? '', help: 'Vacío = sin límite.' },
          { name: 'boosts', label: 'Boosts incluidos', type: 'number', value: pl?.boosts_included ?? 0 }, { name: 'position', label: 'Orden', type: 'number', value: pl?.position ?? 99 },
          { name: 'analytics', label: 'Incluye estadísticas', type: 'checkbox', value: pl?.has_analytics },
        ] });
        if (!r) return;
        try {
          await rpc('admin_upsert_plan', { p: { id: pl?.id, slug: r.slug, names: { es: r.name_es, en: r.name_en || r.name_es }, price_cents: Math.round(parseFloat(r.price.replace(',', '.') || '0') * 100), currency: 'EUR', max_active_offers: r.max === '' ? null : +r.max, boosts_included: +r.boosts || 0, has_analytics: r.analytics, position: +r.position || 99 } });
          toast('Plan guardado'); load();
        } catch (e) { toast(e.message, true); }
      };
      $('#newplan').onclick = () => edit(null);
      $$('[data-edit]').forEach((b) => { b.onclick = () => edit(plans.find((x) => x.id === b.dataset.edit)); });
    }
  };
  $$('.tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); load(); }; });
  $('#csv').onclick = () => downloadCsv(csvName, rows, csvCols);
  await load();
};

// ── Avisos y push ───────────────────────────────────────────────────────────
PAGES.avisos = async (v) => {
  const p = params(); let tab = p.tab || 'send';
  v.innerHTML = `
    <div class="page-head"><h1>Avisos y push</h1></div>
    ${helpBox('¿Qué hago aquí?', '<p><b>Enviar aviso</b>: manda una notificación (en la app y por push) a todos los usuarios, solo a usuarios, solo a los negocios, o a los negocios de una ciudad. Úsalo con moderación (novedades importantes, incidencias); todo queda en el registro. <b>Cola de push</b>: lo que el sistema está enviando; si algo falla (token caducado, error de Firebase) verás el motivo y podrás reintentar.</p>')}
    <div class="tabs">${[['send', 'Enviar aviso'], ['history', 'Enviados'], ['push', 'Cola de push']].map((t) => `<button data-t="${t[0]}" class="${tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>
    <div id="tabview"></div>`;
  const load = async () => {
    const tv = $('#tabview'); tv.innerHTML = '<div class="loading">Cargando…</div>';
    if (tab === 'send') {
      tv.innerHTML = `<div class="card" style="max-width:640px"><form id="sendf" style="display:grid;gap:12px">
        <label class="f"><span>Destinatarios</span><select name="audience"><option value="all">Todos los usuarios</option><option value="users">Solo usuarios (no negocios)</option><option value="business_owners">Dueños y encargados de negocios</option><option value="city">Negocios de una ciudad…</option></select></label>
        <label class="f" id="cityf" hidden><span>Ciudad</span><input name="city" placeholder="Madrid"></label>
        <label class="f"><span>Título</span><input name="title" required maxlength="80"></label>
        <label class="f"><span>Texto</span><textarea name="body" required maxlength="300"></textarea></label>
        <label class="f"><span>Ruta al pulsar <small>(opcional, p. ej. /explore)</small></span><input name="route" placeholder="/explore"></label>
        <div><button class="btn primary" type="submit">Enviar aviso…</button></div></form></div>`;
      const f = $('#sendf');
      f.audience.onchange = () => { $('#cityf').hidden = f.audience.value !== 'city'; };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const aud = f.audience.value;
        if (!await confirmDlg('Enviar aviso', `Se enviará «${esc(f.title.value)}» a: <b>${esc($('option:checked', f.audience).textContent)}${aud === 'city' ? ' ' + esc(f.city.value) : ''}</b>. No se puede deshacer.`, { submit: 'Enviar' })) return;
        try { const n = await rpc('admin_send_notification', { p_audience: aud, p_title: f.title.value.trim(), p_body: f.body.value.trim(), p_route: f.route.value.trim() || null, p_city: f.city.value.trim() || null }); toast(`Aviso enviado a ${n} persona(s)`); f.reset(); } catch (err) { toast(err.message, true); }
      };
    }
    if (tab === 'history') {
      const r = await rpc('admin_audit', { p_action: 'notification.send', p_limit: 100 });
      tv.innerHTML = table({ cols: [{ h: 'Fecha', r: (x) => `<span class="nowrap">${fmtDate(x.created_at)}</span>` }, { h: 'Aviso', r: (x) => `<span class="title">${esc(x.details?.title)}<span class="sub">${esc(x.details?.body)}</span></span>` }, { h: 'Destinatarios', r: (x) => `${esc(x.details?.audience)}${x.details?.city ? ' ' + esc(x.details.city) : ''} · ${x.details?.recipients ?? '?'}` }, { h: 'Por', r: (x) => esc(x.admin_email || '') }], rows: r.rows, empty: 'Todavía no se ha enviado ningún aviso.' });
    }
    if (tab === 'push') {
      tv.innerHTML = `<div class="toolbar"><select id="pstatus">${[['all', 'Todos'], ['pending', 'Pendientes'], ['sent', 'Enviados'], ['failed', 'Fallidos'], ['skipped', 'Omitidos']].map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></div><div id="list"></div>`;
      const loadQ = async () => {
        const rows = await rpc('admin_push_queue', { p_status: $('#pstatus').value, p_limit: 200 });
        $('#list').innerHTML = table({ cols: [{ h: 'Creado', r: (x) => `<span class="nowrap">${fmtDate(x.created_at)}</span>` }, { h: 'Usuario', r: (x) => esc(x.user_email || '—') }, { h: 'Aviso', r: (x) => `<span class="title">${esc(x.title)}<span class="sub">${esc(x.body || '')} · ${esc(x.kind || '')}</span></span>` }, { h: 'Estado', r: (x) => `${tag(x.status)} ${x.attempts ? `<span class="muted small">${x.attempts} intento(s)</span>` : ''}${x.error ? `<span class="sub">${esc(x.error)}</span>` : ''}` }, { h: 'Enviado', r: (x) => fmtDate(x.sent_at) }, { h: '', r: (x) => ['failed', 'skipped'].includes(x.status) ? `<button class="btn sm" data-retry="${x.id}">Reintentar</button>` : '' }], rows, empty: 'Cola vacía.' });
        $$('#list [data-retry]').forEach((b) => { b.onclick = async () => { try { await rpc('admin_push_retry', { p_id: +b.dataset.retry }); toast('Reencolado'); loadQ(); } catch (e) { toast(e.message, true); } }; });
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
    ${helpBox('¿Qué hago aquí?', '<p>Las categorías con las que se clasifican negocios y publicaciones (filtros de la app). El <b>slug</b> es el identificador interno (no lo cambies si ya está en uso); el icono es un emoji. Solo se puede borrar una categoría vacía.</p>')}
    ${table({ cols: [
      { h: 'Categoría', r: (c) => `<span class="ph" style="font-size:20px">${esc(c.icon || '·')}</span><span class="title">${esc(c.names?.es || c.slug)}<span class="sub">${esc(c.slug)} · EN: ${esc(c.names?.en || '—')}${c.parent_id ? ` · dentro de ${esc(byId[c.parent_id]?.names?.es || '')}` : ''}</span></span>` },
      { h: 'Orden', num: true, r: (c) => c.position }, { h: 'Negocios', num: true, r: (c) => c.businesses }, { h: 'Publicaciones', num: true, r: (c) => c.offers },
      { h: '', r: (c) => `<span class="actions"><button class="btn sm" data-edit="${c.id}">Editar…</button>${(c.businesses || c.offers) ? '' : `<button class="btn sm bad ghost" data-del="${c.id}">Borrar</button>`}</span>` },
    ], rows: cats, empty: 'Sin categorías.' })}`;
  const edit = async (c) => {
    const r = await modal({ title: c ? 'Editar categoría' : 'Nueva categoría', fields: [
      { name: 'slug', label: 'Slug', value: c?.slug, required: true }, { name: 'icon', label: 'Icono (emoji)', value: c?.icon },
      { name: 'es', label: 'Nombre (ES)', value: c?.names?.es, required: true }, { name: 'en', label: 'Nombre (EN)', value: c?.names?.en },
      { name: 'parent_id', label: 'Categoría superior', type: 'select', value: c?.parent_id || '', options: [['', '— (principal)'], ...cats.filter((x) => x.id !== c?.id).map((x) => [x.id, x.names?.es || x.slug])] },
      { name: 'position', label: 'Orden', type: 'number', value: c?.position ?? 99 },
    ] });
    if (!r) return;
    try { await rpc('admin_upsert_category', { p: { id: c?.id, slug: r.slug, icon: r.icon || null, names: { es: r.es, en: r.en || r.es }, parent_id: r.parent_id || null, position: +r.position || 99 } }); toast('Categoría guardada'); route(); } catch (e) { toast(e.message, true); }
  };
  $('#new').onclick = () => edit(null);
  $$('[data-edit]').forEach((b) => { b.onclick = () => edit(byId[b.dataset.edit]); });
  $$('[data-del]').forEach((b) => { b.onclick = async () => { if (!await confirmDlg('Borrar categoría', 'Solo se puede si no la usa ningún negocio ni publicación.', { danger: true, submit: 'Borrar' })) return; try { await rpc('admin_delete_category', { p_id: b.dataset.del }); toast('Borrada'); route(); } catch (e) { toast(e.message, true); } }; });
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
    <div class="page-head"><h1>Ciudades</h1><span class="muted small">últimos ${days} días</span></div>
    <div class="card">${table({
      cols: [
        { h: 'Ciudad', r: (c) => `<a class="link" href="#/ciudades/${encodeURIComponent(c.city)}"><b>${esc(c.city)}</b></a>` },
        { h: 'Negocios', num: true, r: (c) => `${fmtNum(c.negocios)} <span class="muted small">(${fmtNum(c.verificados)} verif.)</span>` },
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
      <span class="muted small">últimos ${days} días</span></div>
    <div class="card"><h2>Publicaciones por semana</h2>
      <div class="spark">${weeks.map((w) => `<i title="Semana del ${w.week}: ${w.published}" style="height:${Math.round((w.published / max) * 100)}%"></i>`).join('')}</div>
      <p class="muted small" style="margin:8px 0 0">Doce semanas. Si baja y no sube, es que los negocios se han enfriado.</p>
    </div>
    <div class="card"><h2>Negocios</h2>
      ${dormidos ? `<p class="muted" style="margin:0 0 10px"><b>${dormidos}</b> no han publicado nada en este periodo: son los que hay que llamar.</p>` : ''}
      ${table({
        cols: [
          { h: 'Negocio', r: (b) => `<a class="link" href="#/negocios/${esc(b.id)}"><b>${esc(b.name)}</b></a><span class="sub">alta ${fmtDate(b.created_at)}</span>` },
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
PAGES.colecciones = async (v) => {
  const cols = await rpc('admin_collections');
  const cats = await rpc('admin_categories').catch(() => []);
  const byId = Object.fromEntries(cols.map((c) => [c.id, c]));
  const ruleText = (r = {}) => [
    r.kind === 'flash_offer' ? 'ofertas' : r.kind === 'future_event' ? 'eventos' : null,
    r.when === 'today' ? 'hoy' : r.when === 'weekend' ? 'fin de semana' : r.when === 'next7' ? 'próximos 7 días' : null,
    r.max_price_cents != null ? `hasta ${fmtMoney(r.max_price_cents)}` : null,
    r.discount_only ? 'solo con descuento' : null,
    r.new_days ? `publicado en ${r.new_days} días` : null,
    r.categories?.length ? `${r.categories.length} categoría(s)` : null,
  ].filter(Boolean).join(' · ') || 'todo lo que haya cerca';
  v.innerHTML = `
    <div class="page-head"><h1>Colecciones</h1><span class="spacer"></span><button class="btn primary sm" id="new">Nueva colección…</button></div>
    ${helpBox('¿Qué es esto?', '<p>Selecciones con nombre que aparecen en Descubre («Planes para el finde», «Barato y bueno»). No se eligen una a una: se define una <b>regla</b> y la app enseña lo que encaje cerca de cada persona. Si una colección se queda sin nada cerca, no se enseña.</p><p>Puedes limitarlas a una <b>ciudad</b> y ponerles <b>fechas</b>: una colección de feria aparece y desaparece sola.</p>')}
    ${table({ cols: [
      { h: 'Colección', r: (c) => `<span class="title">${esc(c.title?.es || c.slug)}<span class="sub">${esc(c.slug)}${c.city ? ' · ' + esc(c.city) : ''} · ${esc(ruleText(c.rules))}</span></span>` },
      { h: 'Estado', r: (c) => c.is_active ? tag('active') : tag('draft') },
      { h: 'Vigencia', r: (c) => (c.active_from || c.active_until) ? `<span class="small nowrap">${c.active_from ? fmtDay(c.active_from) : '—'} → ${c.active_until ? fmtDay(c.active_until) : '—'}</span>` : 'siempre' },
      { h: 'Orden', num: true, r: (c) => c.position },
      { h: '', r: (c) => `<span class="actions"><button class="btn sm" data-edit="${c.id}">Editar…</button><button class="btn sm bad ghost" data-del="${c.id}">Borrar</button></span>` },
    ], rows: cols, empty: 'Todavía no hay colecciones.' })}`;
  const edit = async (c) => {
    const r = await modal({ title: c ? 'Editar colección' : 'Nueva colección', fields: [
      { name: 'slug', label: 'Slug (identificador)', value: c?.slug, required: true, placeholder: 'planes-finde' },
      { name: 'es', label: 'Título (ES)', value: c?.title?.es, required: true },
      { name: 'en', label: 'Título (EN)', value: c?.title?.en },
      { name: 'sub_es', label: 'Subtítulo (ES)', value: c?.subtitle?.es },
      { name: 'sub_en', label: 'Subtítulo (EN)', value: c?.subtitle?.en },
      { name: 'kind', label: 'Qué incluye', type: 'select', value: c?.rules?.kind || '', options: [['', 'Ofertas y eventos'], ['flash_offer', 'Solo ofertas relámpago'], ['future_event', 'Solo eventos']] },
      { name: 'when', label: 'Cuándo', type: 'select', value: c?.rules?.when || '', options: [['', 'Cualquier momento'], ['today', 'Hoy'], ['weekend', 'Fin de semana'], ['next7', 'Próximos 7 días']] },
      { name: 'max_price', label: 'Precio máximo (€, opcional)', value: c?.rules?.max_price_cents != null ? (c.rules.max_price_cents / 100).toFixed(2) : '' },
      { name: 'discount_only', label: 'Solo con descuento', type: 'checkbox', value: !!c?.rules?.discount_only },
      { name: 'new_days', label: 'Publicado en los últimos N días (opcional)', type: 'number', value: c?.rules?.new_days ?? '' },
      { name: 'category_id', label: 'Categoría (opcional)', type: 'select', value: c?.rules?.categories?.[0] || '', options: [['', '— todas'], ...cats.map((x) => [x.id, x.names?.es || x.slug])] },
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
  $$('[data-edit]').forEach((b) => { b.onclick = () => edit(byId[b.dataset.edit]); });
  $$('[data-del]').forEach((b) => { b.onclick = async () => {
    if (!await confirmDlg('Borrar colección', 'Deja de aparecer en Descubre. Las publicaciones no se tocan.', { danger: true, submit: 'Borrar' })) return;
    try { await rpc('admin_delete_collection', { p_id: b.dataset.del }); toast('Borrada'); route(); } catch (e) { toast(e.message, true); }
  }; });
};

// ── Configuración ───────────────────────────────────────────────────────────
PAGES.configuracion = async (v) => {
  const cfg = await rpc('admin_config');
  const mv = cfg.min_version?.value || {}, mt = cfg.maintenance?.value || {}, sp = cfg.send_push?.value || {};
  const rl = cfg.rules?.value || {};
  const limits = await rpc('admin_rate_limits', { p_limit: 50 });
  v.innerHTML = `
    <div class="page-head"><h1>Configuración</h1></div>
    ${helpBox('¿Qué hago aquí?', '<p><b>Versión mínima</b>: si un usuario abre una versión más antigua de la app, se le pide actualizar (útil tras cambios incompatibles). <b>Mantenimiento</b>: bloquea la app con un mensaje mientras haces un cambio delicado. <b>Envío de push</b>: dirección de la función que manda las notificaciones (no la toques salvo que cambie el proyecto). Abajo, herramientas de mantenimiento y el uso de los límites anti-abuso.</p>')}
    <div class="grid2">
      <div class="card"><h2>Versión mínima de la app</h2><form id="mvf" style="display:grid;gap:10px"><label class="f"><span>Android</span><input name="android" value="${esc(mv.android || '')}" placeholder="0.1.0"></label><label class="f"><span>iOS</span><input name="ios" value="${esc(mv.ios || '')}" placeholder="0.1.0"></label><div><button class="btn primary sm">Guardar</button> <span class="muted small">actualizado ${fmtDate(cfg.min_version?.updated_at)}</span></div></form></div>
      <div class="card"><h2>Modo mantenimiento</h2><form id="mtf" style="display:grid;gap:10px"><label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="enabled" ${mt.enabled ? 'checked' : ''}><span>App en mantenimiento (bloquea a todos los usuarios)</span></label><label class="f"><span>Mensaje</span><textarea name="message">${esc(mt.message || '')}</textarea></label><div><button class="btn ${mt.enabled ? 'bad' : 'primary'} sm">Guardar</button> <span class="muted small">actualizado ${fmtDate(cfg.maintenance?.updated_at)}</span></div></form></div>
      <div class="card"><h2>Reglas de publicación</h2><form id="rlf" style="display:grid;gap:10px">
        <label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="block2x1" ${rl.block_2x1_alcohol === true ? 'checked' : ''}><span>Bloquear promociones <b>2x1 en bebidas alcohólicas</b></span></label>
        <p class="muted small" style="margin:0">Apagado, que es como está ahora: el negocio declara si su 2x1 lleva alcohol y, si dice que sí, la publicación sale marcada <b>solo para mayores de 18</b>. Encendido, directamente no deja publicarla. Contexto para decidir: la Ley 34/1988 y varias leyes autonómicas prohíben las promociones que incentivan beber más por el mismo dinero («2x1», «barra libre»), aunque el local sea solo para mayores, y la sanción recae en el negocio anunciante.</p>
        <div><button class="btn primary sm">Guardar</button> <span class="muted small">actualizado ${fmtDate(cfg.rules?.updated_at)}</span></div></form></div>
      <div class="card"><h2>Envío de push</h2><form id="spf" style="display:grid;gap:10px"><label class="f"><span>URL de la función</span><input name="url" value="${esc(sp.url || '')}"></label><label class="f"><span>Clave</span><input name="key" value="${esc(sp.key || '')}"></label><div><button class="btn primary sm">Guardar</button></div></form></div>
      <div class="card"><h2>Mantenimiento</h2><p class="muted small">Las ofertas caducan solas cada 5 minutos (cron). Si ves alguna caducada que sigue apareciendo, fuerza la comprobación.</p><div class="actions"><button class="btn sm" id="expire">Caducar ofertas vencidas ahora</button></div>
        <h3 style="margin-top:16px">Límites anti-abuso (últimas 24 h)</h3>${table({ cols: [{ h: 'Usuario', r: (x) => esc(x.user_email || '—') }, { h: 'Acción', r: (x) => esc(x.action) }, { h: 'Ventana', r: (x) => fmtDate(x.window_start) }, { h: 'Intentos', num: true, r: (x) => x.hits }], rows: limits, empty: 'Nadie ha tocado un límite.' })}</div>
    </div>`;
  const save = (key, value) => rpc('admin_set_config', { p_key: key, p_value: value }).then(() => { toast('Guardado'); route(); }).catch((e) => toast(e.message, true));
  $('#mvf').onsubmit = (e) => { e.preventDefault(); save('min_version', { android: e.target.android.value.trim(), ios: e.target.ios.value.trim() }); };
  $('#mtf').onsubmit = async (e) => { e.preventDefault(); if (e.target.enabled.checked && !await confirmDlg('Activar mantenimiento', 'Todos los usuarios verán el mensaje y no podrán usar la app hasta que lo desactives.', { danger: true, submit: 'Activar' })) return; save('maintenance', { enabled: e.target.enabled.checked, message: e.target.message.value.trim() || null }); };
  $('#spf').onsubmit = (e) => { e.preventDefault(); save('send_push', { url: e.target.url.value.trim(), key: e.target.key.value.trim() }); };
  $('#rlf').onsubmit = (e) => { e.preventDefault(); save('rules', { block_2x1_alcohol: e.target.block2x1.checked }); };
  $('#expire').onclick = async () => { try { const n = await rpc('admin_run_expire_offers'); toast(`${n} oferta(s) caducadas`); } catch (e) { toast(e.message, true); } };
};

// ── Administradores ─────────────────────────────────────────────────────────
PAGES.administradores = async (v) => {
  const list = await rpc('admin_admins');
  v.innerHTML = `
    <div class="page-head"><h1>Administradores</h1><span class="spacer"></span><button class="btn primary sm" id="add">Añadir administrador…</button></div>
    ${helpBox('¿Qué hago aquí?', '<p>Quién puede entrar en este panel. Un administrador puede hacerlo todo, así que da acceso solo a personas de confianza con contraseña fuerte y verificación en dos pasos en su correo. La persona tiene que haberse registrado antes en la app con ese email. Todas sus acciones quedan en el registro de actividad.</p>')}
    ${table({ cols: [{ h: 'Administrador', r: (a) => `<span class="title">${esc(a.display_name || '—')}<span class="sub"><a class="link" href="#/usuarios/${a.user_id}">${esc(a.email)}</a></span></span>` }, { h: 'Desde', r: (a) => fmtDay(a.created_at) }, { h: 'Último acceso', r: (a) => ago(a.last_sign_in_at) }, { h: 'Acciones', num: true, r: (a) => fmtNum(a.actions) }, { h: '', r: (a) => a.user_id === ME.id ? '<span class="muted small">tú</span>' : `<button class="btn sm bad ghost" data-rm="${a.user_id}">Quitar</button>` }], rows: list })}`;
  $('#add').onclick = async () => { const r = await modal({ title: 'Añadir administrador', fields: [{ name: 'email', label: 'Email (tiene que existir como usuario)', type: 'email', required: true }] }); if (!r) return; try { await rpc('admin_add_admin', { p_email: r.email }); toast('Administrador añadido'); route(); } catch (e) { toast(e.message, true); } };
  $$('[data-rm]').forEach((b) => { b.onclick = async () => { if (!await confirmDlg('Quitar administrador', 'Dejará de poder entrar en el panel.', { danger: true, submit: 'Quitar' })) return; try { await rpc('admin_remove_admin', { p_user_id: b.dataset.rm }); toast('Quitado'); route(); } catch (e) { toast(e.message, true); } }; });
};

// ── Registro de actividad ───────────────────────────────────────────────────
PAGES.actividad = async (v) => {
  const s = st.actividad;
  v.innerHTML = `
    <div class="page-head"><h1>Registro de actividad</h1><span class="spacer"></span><button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Qué hago aquí?', '<p>Todo lo que hacen los administradores queda aquí con fecha, quién y sobre qué: verificaciones, moderación, pagos, cambios de configuración… Sirve para auditoría y para responder ante una reclamación («¿por qué se retiró mi oferta y cuándo?»).</p>')}
    <div class="toolbar"><input id="q" class="grow" placeholder="Buscar por email del admin, id del objeto o texto…" value="${esc(s.q || '')}"><select id="action">${[['all', 'Todas las acciones'], ['business', 'Negocios'], ['offer', 'Publicaciones'], ['report', 'Denuncias'], ['user', 'Usuarios'], ['review', 'Reseñas'], ['post', 'Posts'], ['notification', 'Avisos'], ['config', 'Configuración'], ['plan', 'Planes'], ['category', 'Categorías'], ['admin', 'Administradores']].map((o) => `<option value="${o[0]}" ${(s.action || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
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
    <div class="card"><h2>Cómo funciona Klendar (en 1 minuto)</h2><p>Los <b>negocios</b> se dan de alta desde la app y quedan <b>pendientes</b> hasta que un administrador los verifica. Una vez verificados publican <b>ofertas flash</b> (con cuenta atrás y aforo) y <b>eventos</b>. Los <b>usuarios</b> las ven en Descubre y el mapa, las guardan en Mis planes y las canjean enseñando un <b>código QR de un solo uso</b> que el negocio escanea. Los negocios tienen un <b>plan</b> (Gratis / Básico / Pro) con una prueba inicial; por ahora los cobros se hacen por transferencia y se anotan aquí.</p></div>
    <div class="grid2">
      <div class="card"><h2>Rutina diaria (5 minutos)</h2><ol style="margin:0;padding-left:18px"><li><b>Resumen</b>: mira «Pendiente de ti».</li><li><b>Negocios pendientes</b>: comprueba que existen (web, teléfono, Google Maps) y verifica o rechaza con motivo.</li><li><b>Publicaciones por moderar</b>: aprueba o retira con motivo.</li><li><b>Denuncias abiertas</b>: revisa y resuelve (siempre con motivo si retiras algo).</li><li><b>Push fallidos</b>: si hay muchos, algo pasa con Firebase.</li></ol></div>
      <div class="card"><h2>Rutina semanal</h2><ul style="margin:0;padding-left:18px"><li><b>Planes y pagos</b>: suscripciones que vencen en 7 días → contacta con el negocio; registra las transferencias recibidas.</li><li><b>Usuarios</b>: atiende peticiones de acceso o supresión recibidas por email (info@klendar.app).</li><li><b>Sugerencias</b>: lee lo que ha entrado, marca estado y responde lo que merezca respuesta.</li><li><b>Registro de actividad</b>: repasa que todo lo hecho tenga sentido.</li></ul></div>
      <div class="card"><h2>Criterios de moderación</h2><ul style="margin:0;padding-left:18px"><li>Fotos propias del local o del producto; nada de imágenes de terceros sin permiso.</li><li>Oferta clara y cumplible: precio, condiciones, aforo, horario. Nada engañoso.</li><li>Alcohol: solo negocios +18 marcados, sin incitar al consumo (Ley 34/1988).</li><li>Sin datos personales de terceros, insultos, discriminación ni contenido sexual.</li><li>Ante la duda, marca «en revisión» y pide más información al negocio con «Enviar aviso».</li></ul><p class="muted small" style="margin:8px 0 0">Referencia: <a class="link" href="/normas/" target="_blank">Normas de la comunidad</a> · <a class="link" href="/negocios/" target="_blank">Condiciones para negocios</a>.</p></div>
      <div class="card"><h2>Obligaciones legales que cubre el panel</h2><ul style="margin:0;padding-left:18px"><li><b>DSA</b> (Reglamento de Servicios Digitales): toda retirada de contenido lleva motivo y vía de recurso (15 días, info@klendar.app); las denuncias se gestionan con diligencia.</li><li><b>RGPD</b>: consentimientos visibles en la ficha del usuario; supresión con «Borrar cuenta»; acceso con «Exportar CSV».</li><li><b>Registro</b>: cada acción administrativa queda registrada con autor y fecha.</li></ul></div>
    </div>
    <div class="card"><h2>Atajos</h2><p class="muted" style="margin:0"><code>/</code> salta al buscador de la página · Pulsa en cualquier fila para abrir su ficha · «Exportar CSV» descarga lo que ves con los filtros aplicados.</p></div>
    <div class="card"><h2>Si algo falla</h2><p class="muted" style="margin:0">Si ves «Esta cuenta no es administradora» pide a otro administrador que te añada. Si el panel no carga datos, comprueba el estado de Supabase (<a class="link" href="https://status.supabase.com" target="_blank" rel="noopener">status.supabase.com</a>). Soporte técnico: dev@klendar.app.</p></div>`;
};

boot();
