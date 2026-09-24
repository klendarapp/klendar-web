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
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOC = () => (I18N.lang === 'en' ? 'en-GB' : 'es-ES');
const fmtDate = (s) => s ? new Date(s).toLocaleString(LOC(), { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtMoney = (c) => (c == null ? '—' : (c / 100).toLocaleString(I18N.lang === 'en' ? 'en-IE' : 'es-ES', { style: 'currency', currency: 'EUR' }));
const fmtNum = (n) => (n ?? 0).toLocaleString('es-ES');
const LABELS = {
  active: 'activa', draft: 'borrador', expired: 'terminada', sold_out: 'agotada', cancelled: 'cancelada',
  pending: 'en revisión', approved: 'aprobada', rejected: 'rechazada',
  flash_offer: 'oferta flash', future_event: 'evento',
  owner: 'propietario', manager: 'encargado', staff: 'empleado',
  validated: 'dentro',
};
const tag = (v, cls) => v ? `<span class="tag ${cls || 'st-' + esc(v)}">${esc(LABELS[v] || v)}</span>` : '';
const toast = (msg, bad = false) => {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = I18N.t(msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3500);
};
const ERRORS = {
  not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
  user_not_found: 'No hay ninguna cuenta con ese correo.',
  owner_untouchable: 'Al propietario no se le cambia el rol desde aquí.',
  not_a_member: 'Esa persona ya no está en el equipo.',
  invalid_role: 'Ese rol no existe.',
  plan_limit_reached: 'Has llegado al límite de publicaciones activas de tu plan.',
};
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
function modal({ title, intro, fields = [], submit = 'Guardar', danger = false }) {
  return new Promise((resolve) => {
    const d = $('#modal');
    const field = (f) => {
      if (f.type === 'select') return `<label class="f"><span>${esc(f.label)}</span><select name="${f.name}">${f.options.map((o) => `<option value="${esc(o[0])}" ${o[0] == f.value ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
      if (f.type === 'checkbox') return `<label class="f" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
      return `<label class="f"><span>${esc(f.label)}</span><input name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}></label>`;
    };
    d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${intro ? `<p class="muted" style="margin:0">${intro}</p>` : ''}
      ${fields.map(field).join('')}
      <div class="foot"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="submit" class="btn ${danger ? 'bad' : 'primary'}">${esc(submit)}</button></div></form>`;
    const form = $('form', d);
    const close = (v) => { d.close(); resolve(v); };
    $('[data-cancel]', d).onclick = () => close(null);
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
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th ${c.num ? 'class="num"' : ''}>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr data-i="${i}">${cols.map((c) => `<td ${c.num ? 'class="num"' : ''}>${c.r(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
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
  $('#who').textContent = ME.email || ME.phone || '';
  $('#login').hidden = true; $('#app').hidden = false;

  BIZZES = await rpc('my_businesses');
  if (!BIZZES.length) return noBusiness();
  const saved = localStorage.getItem('klendar.biz');
  BIZ = BIZZES.find((b) => b.id === saved) || BIZZES[0];
  renderBizPicker();
  try { CATS = (await sb.from('categories').select('id, names, position').order('position')).data || []; } catch { CATS = []; }
  route();
}
function showLogin() { $('#login').hidden = false; $('#app').hidden = true; ME = null; }
function noBusiness() {
  $('#view').innerHTML = `<div class="card"><h2>Todavía no tienes ningún negocio</h2>
    <p class="muted">Este panel es para negocios ya dados de alta. El alta se hace desde la app (Perfil → Dar de alta mi negocio) porque hace falta la ubicación exacta del local.</p>
    <p class="muted">Si alguien te ha añadido a su equipo, entra con el mismo correo con el que te invitaron.</p>
    <a class="btn primary" href="${APP_URL}/negocios/">Cómo funciona ↗</a></div>`;
  $('#nav').innerHTML = '';
}
function renderBizPicker() {
  $('#bizSelect').innerHTML = BIZZES.map((b) => `<option value="${esc(b.id)}" ${b.id === BIZ.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  $('#bizSelect').onchange = () => {
    BIZ = BIZZES.find((b) => b.id === $('#bizSelect').value);
    localStorage.setItem('klendar.biz', BIZ.id);
    route();
  };
}

$('#doLogin').onclick = async () => {
  $('#loginErr').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
  if (error) { $('#loginErr').textContent = error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message; return; }
  boot();
};
$('#doReset').onclick = async () => {
  const email = $('#email').value.trim();
  if (!email) { $('#loginErr').textContent = 'Escribe tu correo y vuelve a pulsar.'; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${APP_URL}/panel/` });
  $('#loginErr').textContent = error ? error.message : '';
  if (!error) toast('Te hemos enviado un correo para cambiar la contraseña.');
};
$('#password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#doLogin').click(); });
$('#logout').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); showLogin(); };
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') showLogin(); });
$('#menuBtn').onclick = () => $('#side').classList.toggle('open');

// ── Idioma ──────────────────────────────────────────────────────────────────
// El panel se escribió en español; la versión inglesa se pinta encima (ver
// i18n.js). Lo que no esté traducido se queda en español, nunca en blanco.
I18N.pickers(['#lang', '#langLogin', '#langSide']);
I18N.translate(document.body);

// ── Navegación ──────────────────────────────────────────────────────────────
const NAV = [
  ['resumen', '📊', 'Resumen'],
  ['publicaciones', '⚡', 'Publicaciones'],
  ['validar', '🎟', 'Validar códigos'],
  ['informe', '📈', 'Informe'],
  ['sellos', '🎫', 'Tarjeta de sellos'],
  ['equipo', '👥', 'Equipo'],
  ['ayuda', '❓', 'Ayuda'],
];
function renderNav(current) {
  $('#nav').innerHTML = NAV.map((n) => `<a class="nav ${current === n[0] ? 'on' : ''}" href="#/${n[0]}"><span class="ic">${n[1]}</span>${n[2]}</a>`).join('');
  I18N.translate($('#nav'));
}
const currentRoute = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'resumen').split('/');
const PAGES = {};
async function route() {
  if (!ME || !BIZ) return;
  const [page, param] = currentRoute();
  renderNav(page);
  $('#side').classList.remove('open');
  const v = $('#view');
  v.innerHTML = '<div class="loading">Cargando…</div>';
  try {
    await (PAGES[page] || PAGES.resumen)(v, param);
    I18N.translate(v);
  } catch (e) {
    v.innerHTML = `<div class="card"><h2>Algo ha fallado</h2><p class="err">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
  }
}
window.addEventListener('hashchange', route);

// ── Resumen ─────────────────────────────────────────────────────────────────
PAGES.resumen = async (v) => {
  const [stats, offers, sub] = await Promise.all([
    rpc('business_stats', { p_id: BIZ.id }),
    rpc('my_business_offers', { p_id: BIZ.id }),
    rpc('my_subscription', { p_business_id: BIZ.id }).catch(() => null),
  ]);
  const pending = offers.filter((o) => o.status === 'active');
  const s = stats || {};
  v.innerHTML = `
    <div class="page-head"><h1>${esc(BIZ.name)}</h1>${tag(BIZ.verification_status)}<span class="spacer"></span>
      <a class="btn sm ghost" href="${APP_URL}/b/${esc(BIZ.id)}" target="_blank" rel="noopener">Ver ficha pública ↗</a></div>
    ${BIZ.verification_status !== 'verified' ? `<div class="help"><b>Tu negocio está ${esc(LABELS[BIZ.verification_status] || BIZ.verification_status)}.</b> Mientras tanto puedes preparar publicaciones en borrador; se verán en cuanto te verifiquemos.</div>` : ''}
    <div class="quick">
      <button class="primary" data-go="nueva-flash"><span class="ic">⚡</span>Nueva oferta relámpago<small>Canjeable con QR durante unas horas</small></button>
      <button data-go="nuevo-evento"><span class="ic">📅</span>Nuevo evento<small>Con fecha, aforo y reserva de plaza</small></button>
      <button data-go="validar"><span class="ic">🎟</span>Validar un código<small>Escribe el código que enseña el cliente</small></button>
    </div>
    <div class="card" style="margin-top:14px"><h2>Cómo va</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmtNum(s.views_30d)}</b><span>Vistas (30 días)</span></div>
        <div class="kpi accent"><b>${fmtNum(s.redemptions_30d)}</b><span>Canjeos (30 días)</span></div>
        <div class="kpi"><b>${fmtNum(s.favorites)}</b><span>Favoritos</span></div>
        <div class="kpi"><b>${s.ratings ? `${Number(s.rating).toFixed(1).replace('.', ',')} (${s.ratings})` : '—'}</b><span>Valoración</span></div>
        <div class="kpi"><b>${fmtNum(pending.length)}</b><span>Publicaciones activas</span></div>
      </div>
    </div>
    ${sub ? `<div class="card"><h2>Tu plan</h2><p style="margin:0"><b>${esc(sub.plan_name_es || sub.plan || '')}</b> ${sub.status === 'trial' ? tag('trial') : ''} · ${sub.max_active_offers == null ? 'sin límite de publicaciones activas' : `hasta ${sub.max_active_offers} publicaciones activas`}</p>
      <p class="muted" style="margin:6px 0 0">Para cambiar de plan escribe a <a class="link" href="mailto:info@klendar.app">info@klendar.app</a>.</p></div>` : ''}
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
        { h: 'Canjeos', num: true, r: (o) => fmtNum(o.redemptions_count) },
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
};

// ── Publicaciones ───────────────────────────────────────────────────────────
PAGES.publicaciones = async (v, param) => {
  if (param === 'nueva-flash') return offerForm(v, null, 'flash_offer');
  if (param === 'nuevo-evento') return offerForm(v, null, 'future_event');
  if (param) return offerForm(v, param);

  const offers = await rpc('my_business_offers', { p_id: BIZ.id });
  v.innerHTML = `
    <div class="page-head"><h1>Publicaciones</h1><span class="spacer"></span>
      <a class="btn sm" href="#/publicaciones/nueva-flash">⚡ Nueva oferta</a>
      <a class="btn sm" href="#/publicaciones/nuevo-evento">📅 Nuevo evento</a>
      <button class="btn sm ghost" id="csv">Exportar CSV</button></div>
    ${helpBox('¿Oferta o evento?', '<p><b>Oferta relámpago</b>: algo que se canjea hoy, con cuenta atrás y aforo («café + tostada 2,50 € hasta mediodía»). <b>Evento</b>: algo con fecha, que se guarda en la agenda y puede admitir reserva de plaza.</p>')}
    <div id="list"></div>
    <div id="rules"></div>`;
  const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

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
          { h: 'Cuándo', r: (x) => `${x.weekdays.map((d) => DIAS[d]).join(', ')} a las ${esc(x.start_time)}` },
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
        } catch (e) { toast(e.message, true); }
      };
    });
  };

  async function repetirDialogo(offerId) {
    const o = offers.find((x) => x.id === offerId) || {};
    const r = await modal({
      title: 'Repetir cada semana',
      intro: `«${esc(o.title || '')}» se publicará sola los días y la hora que elijas, con su cuenta atrás y su aforo. Puedes pausarla cuando quieras.`,
      submit: 'Crear la repetición',
      fields: [
        { name: 'dias', type: 'select', label: '¿Qué días?', value: 'L-V', options: [
          ['L-V', 'De lunes a viernes'], ['todos', 'Todos los días'], ['finde', 'Fines de semana'],
          ['1', 'Solo los lunes'], ['2', 'Solo los martes'], ['3', 'Solo los miércoles'],
          ['4', 'Solo los jueves'], ['5', 'Solo los viernes'], ['6', 'Solo los sábados'], ['0', 'Solo los domingos'],
        ] },
        { name: 'hora', type: 'time', label: '¿A qué hora empieza?', value: '17:00', required: true },
        { name: 'duracion', type: 'select', label: '¿Cuánto dura?', value: '120', options: [
          ['60', '1 hora'], ['120', '2 horas'], ['180', '3 horas'], ['240', '4 horas'], ['480', 'Toda la tarde (8 h)'],
        ] },
      ],
    });
    if (!r) return;
    const dias = r.dias === 'L-V' ? [1, 2, 3, 4, 5]
      : r.dias === 'todos' ? [0, 1, 2, 3, 4, 5, 6]
        : r.dias === 'finde' ? [6, 0] : [Number(r.dias)];
    try {
      await rpc('save_offer_rule', {
        p_business: BIZ.id, p_offer: offerId, p_weekdays: dias,
        p_start_time: r.hora, p_duration_min: Number(r.duracion),
      });
      toast('Se repetirá sola');
      renderRules();
    } catch (e) { toast(e.message, true); }
  }

  const render = () => {
    $('#list').innerHTML = table({
      cols: [
        { h: 'Publicación', r: (o) => `${o.images?.[0] ? `<img class="thumb" src="${esc(o.images[0])}" alt="" loading="lazy">` : `<span class="ph">${o.kind === 'flash_offer' ? '⚡' : '📅'}</span>`}<b class="title">${esc(o.title)}</b><span class="sub">${esc(LABELS[o.kind])} · ${fmtDate(o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at)}</span>` },
        { h: 'Estado', r: (o) => tag(o.status) + (o.moderation_status === 'pending' ? ' ' + tag('pending') : '') + (o.publish_at ? ` <span class="tag dim">programada ${esc(fmtDate(o.publish_at))}</span>` : '') },
        { h: 'Plazas', r: (o) => o.max_redemptions == null ? '—' : `${fmtNum(o.redemptions_count + (o.pending_count || 0))}/${fmtNum(o.max_redemptions)}` },
        { h: 'Vistas', num: true, r: (o) => fmtNum(o.views) },
        { h: 'Canjeos', num: true, r: (o) => fmtNum(o.redemptions_count) },
        { h: '', r: (o) => `<div class="actions">
            <a class="btn sm" href="#/publicaciones/${esc(o.id)}">Editar</a>
            ${o.kind === 'future_event' && o.reservations_enabled ? `<a class="btn sm ghost" href="#/asistentes/${esc(o.id)}">Asistentes</a>` : ''}
            <button class="btn sm ghost" data-act="${o.status === 'active' ? 'pause' : 'activate'}" data-id="${esc(o.id)}">${o.status === 'active' ? 'Pausar' : 'Activar'}</button>
            ${o.kind === 'flash_offer' ? `<button class="btn sm ghost" data-act="repeat" data-id="${esc(o.id)}">Repetir…</button>` : ''}
            <button class="btn sm ghost" data-act="delete" data-id="${esc(o.id)}">Borrar</button>
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
          if (b.dataset.act === 'delete') {
            if (!await confirmDlg('Borrar publicación', 'Se borra para siempre, junto con sus estadísticas. Si solo quieres que deje de verse, púlsale a «Pausar».', { danger: true, submit: 'Borrar' })) return;
            await sb.from('offers').delete().eq('id', id);
          } else {
            await sb.from('offers').update({ status: b.dataset.act === 'pause' ? 'draft' : 'active' }).eq('id', id);
          }
          toast('Hecho');
          route();
        } catch (e) { toast(e.message, true); }
      };
    });
  };
  $('#csv').onclick = () => downloadCsv(`klendar-${BIZ.name}`, offers, [
    ['title', 'publicación'], [(o) => LABELS[o.kind], 'tipo'], [(o) => LABELS[o.status], 'estado'],
    ['views', 'vistas'], ['redemptions_count', 'canjeos'], ['max_redemptions', 'aforo'],
    [(o) => o.kind === 'flash_offer' ? o.redeem_start_at : o.event_at, 'cuándo'],
  ]);
  render();
  renderRules();
};

/** Formulario de publicación (nueva o existente). */
async function offerForm(v, id, kindDefault) {
  let o = { kind: kindDefault || 'flash_offer', max_per_user: 1, code_ttl_minutes: 5, images: [], status: 'active' };
  if (id) {
    const all = await rpc('my_business_offers', { p_id: BIZ.id });
    o = all.find((x) => x.id === id) || o;
  }
  const isFlash = () => $('[name=kind]', v).value === 'flash_offer';
  const disc = o.discount || {};
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/publicaciones">← Volver</a><h1>${id ? 'Editar publicación' : (kindDefault === 'future_event' ? 'Nuevo evento' : 'Nueva oferta relámpago')}</h1></div>
    <form class="card" id="form">
      <div class="form-grid">
        <label class="f full"><span>Título</span><input name="title" value="${esc(o.title || '')}" required maxlength="80" placeholder="${kindDefault === 'future_event' ? 'Concierto de jazz' : 'Café + tostada 2,50 €'}"></label>
        <label class="f full"><span>Descripción</span><textarea name="description" maxlength="600">${esc(o.description || '')}</textarea></label>
        <label class="f"><span>Tipo</span><select name="kind">
          <option value="flash_offer" ${o.kind === 'flash_offer' ? 'selected' : ''}>Oferta relámpago</option>
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
        <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="reservations_enabled" ${o.reservations_enabled ? 'checked' : ''}><span>Evento con <b>reserva de plaza</b> (sin pago): la gente reserva desde la app y enseña su código en la puerta</span></label>
        <label class="f" id="seatsRow" hidden><span>Plazas por persona <small>(a un evento no se va solo; un código vale por todas)</small></span><select name="max_seats">
          ${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${Number(o.max_seats || 1) === n ? 'selected' : ''}>${n === 1 ? '1 (solo quien reserva)' : n + ' personas'}</option>`).join('')}</select></label>
        <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="adults_only" ${o.adults_only ? 'checked' : ''}><span>Solo para mayores de 18</span></label>
        <label class="f full"><span>Condiciones (letra pequeña)</span><textarea name="terms" maxlength="400">${esc(o.terms || '')}</textarea></label>
        <label class="f full"><span>Enlace externo (entradas, reservas…)</span><input name="external_url" value="${esc(o.external_url || '')}" placeholder="https://"></label>
      </div>
      <h3 style="margin-top:16px">Fotos y vídeo</h3>
      <p class="hint">La primera es la portada; muévelas con las flechas. Si no pones ninguna, se usa la foto del local. Los vídeos se ven al abrir la publicación (en el feed van las fotos).</p>
      <div class="photos" id="photos"></div>
      <div class="actions" style="margin-top:18px">
        <button class="btn primary" type="submit">${id ? 'Guardar cambios' : 'Publicar'}</button>
        <label class="f" style="grid-template-columns:auto 1fr;align-items:center;margin:0"><input type="checkbox" name="publish" ${o.status !== 'draft' ? 'checked' : ''}><span>Publicar ahora (desactívalo para dejarlo en borrador)</span></label>
      </div>
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
  const isVideo = (u) => /\.(mp4|mov|webm)(\?|$)/i.test(u);
  const renderPhotos = () => {
    // El orden manda: la primera es la portada. Se mueve con las flechas.
    $('#photos').innerHTML = images.map((u, i) => `
      <div class="ph-item">
        ${isVideo(u) ? `<div class="ph-video">▶</div>` : `<img src="${esc(u)}" alt="">`}
        ${i === 0 ? '<span class="ph-cover">Portada</span>' : ''}
        <button class="rm" type="button" data-i="${i}" title="Quitar">×</button>
        <div class="ph-move">
          <button type="button" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''} title="Mover antes">←</button>
          <button type="button" data-mv="${i}:1" ${i === images.length - 1 ? 'disabled' : ''} title="Mover después">→</button>
        </div>
      </div>`).join('')
      + `<label class="add">+ Añadir foto o vídeo<input type="file" accept="image/*,video/mp4,video/quicktime" multiple></label>`;
    $$('#photos .rm').forEach((b) => { b.onclick = () => { images.splice(+b.dataset.i, 1); renderPhotos(); }; });
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
      for (const file of [...e.target.files].slice(0, 6)) {
        const video = /^video\//.test(file.type);
        const max = video ? 60 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > max) { toast(video ? 'Ese vídeo pesa más de 60 MB.' : 'Esa foto pesa más de 5 MB.', true); continue; }
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

  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    $('#formErr').textContent = '';
    const f = new FormData($('#form'));
    const flash = f.get('kind') === 'flash_offer';
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
      status: $('[name=publish]').checked ? 'active' : 'draft',
    };
    if (flash && (!data.redeem_start_at || !data.redeem_end_at)) {
      $('#formErr').textContent = 'Una oferta relámpago necesita principio y fin.'; return;
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
      const m = err.message || '';
      $('#formErr').textContent =
        /plan_limit_reached/.test(m) ? 'Has llegado al límite de publicaciones activas de tu plan. Pausa alguna o cambia de plan.'
        : /prior_price_required/.test(m) ? 'Pon el precio anterior: la ley obliga a enseñarlo junto al descuento.'
        : /prior_price_not_lower/.test(m) ? 'El precio anterior tiene que ser mayor que el de ahora.'
        : /alcohol_declaration_required/.test(m) ? 'Di si el 2x1 incluye bebidas alcohólicas.'
        : m;
    }
  };
}

// ── Validar códigos ─────────────────────────────────────────────────────────
PAGES.validar = async (v) => {
  v.innerHTML = `
    <div class="page-head"><h1>Validar códigos</h1></div>
    ${helpBox('¿Cómo funciona?', '<p>Pide a la persona su código (lo tiene en la app, debajo del QR) y escríbelo aquí. Cada código vale una vez: al validarlo queda marcado y el aforo baja. Si tienes cámara, desde la app es más rápido.</p>')}
    <div class="scan-box">
      <input id="code" placeholder="Código o enlace del QR" autocomplete="off" autofocus>
      <button class="btn primary" id="go">Validar</button>
      <div id="result"></div>
    </div>
    <div class="card" style="margin-top:18px"><h2>Últimos validados</h2><div id="recent"></div></div>`;

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
    const code = raw.includes('/r/') ? raw.split('/r/').pop().split(/[?#]/)[0] : raw;
    try {
      const res = await rpc('validate_redemption', { p_code: code });
      if (res.ok) {
        $('#result').innerHTML = `<div class="scan-result ok">✅ Validado · ${esc(res.offer_title || '')}<small>${esc(res.user_name || '')}</small></div>`;
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
        $('#result').innerHTML = `<div class="scan-result bad">❌ ${esc(msgs[res.error] || res.error)}${res.validated_at ? `<small>Se validó el ${esc(fmtDate(res.validated_at))}</small>` : ''}</div>`;
      }
    } catch (e) { toast(e.message, true); }
  };
  $('#go').onclick = validate;
  $('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') validate(); });
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
        } catch (e) { toast(e.message, true); }
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
    ${helpBox('¿Cómo funciona?', `<p>La de toda la vida, la de cartón, pero sin cartón: cada vez que validas un código de esta persona, cae un sello. Al llegar a la meta, se lleva el premio, y el premio es otro código que validas igual que los demás.</p>
      <p>Como mucho <b>un sello al día por persona</b>, para que no valga con pedir tres cafés seguidos. Si la apagas, dejas de dar sellos nuevos, pero <b>nadie pierde los que tiene</b>: al encenderla otra vez siguen ahí.</p>`)}

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

PAGES.equipo = async (v) => {
  const [team, invites] = await Promise.all([
    rpc('business_team', { p_id: BIZ.id }),
    rpc('business_invites_list', { p_business_id: BIZ.id }).catch(() => []),
  ]);
  const canManage = ['owner', 'manager'].includes(BIZ.role);
  v.innerHTML = `
    <div class="page-head"><h1>Equipo</h1><span class="spacer"></span>
      ${canManage ? '<button class="btn sm primary" id="add">Añadir a alguien</button>' : ''}</div>
    ${helpBox('¿Quién puede qué?', '<p><b>Empleado</b>: valida códigos QR. <b>Encargado</b>: además publica, edita la ficha y lleva el equipo. <b>Propietario</b>: todo; no se le puede cambiar el rol desde aquí.</p>')}
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
        intro: 'Si todavía no tiene cuenta en Klendar, le guardamos la invitación y entra en cuanto se registre con ese correo.',
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
        toast(res.invited ? 'Invitación guardada' : 'Añadido al equipo');
        route();
      } catch (e) { toast(e.message, true); }
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
    <p class="muted small" style="margin:10px 0 0">Distancia entre tu local y el último sitio conocido de quien ha canjeado algo, de ${fmtNum(aud.people)} persona(s). Es aproximado y nunca se enseña dónde está nadie.</p>
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
    ['at', 'Fecha y hora'], ['title', 'Publicación'], ['code', 'Código'], ['by', 'Validado por'],
  ]);
};

// ── Ayuda ───────────────────────────────────────────────────────────────────
PAGES.ayuda = async (v) => {
  v.innerHTML = `
    <div class="page-head"><h1>Ayuda</h1></div>
    <div class="card"><h2>Qué puedes hacer aquí</h2>
      <p>Este panel hace lo mismo que la app, pero desde el ordenador: publicar ofertas y eventos, ver cómo van, validar códigos en la puerta y llevar el equipo.</p>
      <p class="muted">Lo único que se hace solo desde la app es <b>dar de alta el negocio</b> (hace falta la ubicación exacta) y <b>escanear el QR con la cámara</b>.</p></div>
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
