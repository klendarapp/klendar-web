/* Administración → «Sorteos» (admin tanda C; migración 20261226100000 de la
 * app).
 *
 * Los sorteos de los negocios: abiertos (por defecto), retirados o todos,
 * con buscador. «Retirar…» quita un sorteo abierto concreto sin tocar el
 * negocio (`admin_remove_giveaway`): pide el motivo (obligatorio por el DSA,
 * art. 17) y confirmación. El sorteo pasa a «Retirado» y ya no se sortea; el
 * negocio recibe el aviso motivado con la vía de recurso; quien participaba
 * lo sigue viendo en «Mis sorteos» como «Retirado» (y un aviso, si no tiene
 * apagados los de sorteos). Queda en el registro de actividad
 * (`giveaway.remove`). Uno ya sorteado sigue su curso (la entrega del premio).
 *
 * También en la ficha de cada negocio (`sorteosDelNegocioAdmin`).
 *
 * Va después de admin.js (y de artistas.js, de donde toma `bi`) y usa lo
 * suyo (`PAGES`, `rpc`, `modal`, `toast`, `esperando`, `pager`, `helpBox`,
 * `coincide`, `filtrosEnUrl`…). Los nombres de aquí empiezan por `sorteoAdm`.
 */
'use strict';

st.sorteos = { status: 'active', limit: 50, offset: 0 };

const SORTEO_ADM_ESTADO = {
  active: ['Abierto', 'Open', 'ok'],
  drawn: ['Sorteado', 'Drawn', 'dim'],
  cancelled: ['Cancelado por el negocio', 'Cancelled by the business', 'dim'],
  removed: ['Retirado', 'Removed', 'bad'],
};
const SORTEO_ADM_ERR = {
  reason_required: ['Escribe el motivo (al menos 5 caracteres): lo recibe el negocio.', 'Write the reason (at least 5 characters): the business gets it.'],
  reason_too_long: ['El motivo cabe en 500 caracteres.', 'The reason fits in 500 characters.'],
  not_active: ['Ese sorteo ya no está abierto (se ha sorteado, cancelado o retirado).', 'That giveaway is no longer open (it has been drawn, cancelled or removed).'],
  not_found: ['Ese sorteo ya no existe.', 'That giveaway no longer exists.'],
};
const sorteoAdmErr = (m) => {
  const k = Object.keys(SORTEO_ADM_ERR).find((x) => String(m || '').includes(x));
  return k ? bi(...SORTEO_ADM_ERR[k]) : m;
};
const sorteoAdmPub = (id) => `${APP_URL}${I18N.lang === 'en' ? '/en/giveaway/' : '/sorteo/'}${id}`;

/** Una fila: premio, negocio, estado, fechas, participantes y, si se retiró,
 * quién y por qué. */
function sorteoAdmFila(g, conNegocio = true) {
  const en = I18N.lang === 'en';
  const [es, ing, cls] = SORTEO_ADM_ESTADO[g.status] || [g.status, g.status, 'dim'];
  const b = g.business || {};
  const abierto = g.status === 'active';
  const cuando = abierto
    ? bi(`Termina el ${fmtDate(g.ends_at)}`, `Ends on ${fmtDate(g.ends_at)}`)
    : g.status === 'removed' ? bi(`Retirado el ${fmtDate(g.removed_at)}`, `Removed on ${fmtDate(g.removed_at)}`)
      : g.status === 'cancelled' ? bi(`Cancelado el ${fmtDate(g.cancelled_at)}`, `Cancelled on ${fmtDate(g.cancelled_at)}`)
        : bi(`Sorteado el ${fmtDate(g.drawn_at || g.ends_at)}`, `Drawn on ${fmtDate(g.drawn_at || g.ends_at)}`);
  const personas = bi(`${fmtNum(g.entries || 0)} ${g.entries === 1 ? 'participa' : 'participan'}`, `${fmtNum(g.entries || 0)} ${g.entries === 1 ? 'entry' : 'entries'}`);
  return `<div class="item" data-sorteo-adm="${esc(g.id)}" data-premio="${esc(g.prize)}" data-negocio="${esc(b.name || '')}" data-gente="${Number(g.entries) || 0}">
    <div class="ph">${ms('redeem')}</div><div style="min-width:0">
    <h3>${esc(g.prize)} <span class="tag ${cls}">${esc(en ? ing : es)}</span>${g.adults_only ? ' <span class="tag bad">+18</span>' : ''}</h3>
    <div class="meta">${conNegocio && b.id ? `<a class="link" href="#/negocios/${esc(b.id)}">${esc(b.name)}</a>${b.city ? ` · ${esc(b.city)}` : ''} · ` : ''}${esc(cuando)} · ${esc(personas)}${g.prize_value_cents ? ` · ${esc(fmtMoney(g.prize_value_cents))}` : ''}${conNegocio && g.open_reports ? ` · <a class="link" href="#/denuncias/business/${esc(b.id)}"><span class="tag bad">${ms('flag')} ${g.open_reports}</span></a>` : ''}</div>
    ${g.description ? `<p>${esc(g.description)}</p>` : ''}
    ${g.status === 'removed' && g.removed_reason ? `<div class="meta">${esc(bi(`Motivo: ${g.removed_reason}`, `Reason: ${g.removed_reason}`))}${g.removed_by ? ` · ${esc(g.removed_by)}` : ''}</div>` : ''}
    ${g.status === 'cancelled' && g.cancel_reason ? `<div class="meta">${esc(bi(`Motivo del negocio: ${g.cancel_reason}`, `Business’s reason: ${g.cancel_reason}`))}</div>` : ''}
    <div class="actions">
      ${g.status !== 'removed' ? `<a class="btn sm ghost" href="${esc(sorteoAdmPub(g.id))}" target="_blank" rel="noopener">${esc(bi('Abrir en la web', 'Open on the website'))} ↗</a>` : ''}
      ${abierto ? `<button class="btn sm bad" data-retira-sorteo="${esc(g.id)}">${esc(bi('Retirar…', 'Remove…'))}</button>` : ''}
    </div>
  </div></div>`;
}

/** «Retirar…»: motivo y confirmación. true si se retiró. */
async function sorteoAdmRetira(boton) {
  const fila = boton.closest('[data-sorteo-adm]');
  const n = Number(fila.dataset.gente) || 0;
  const r = await modal({
    title: bi('Retirar el sorteo', 'Remove the giveaway'),
    intro: esc(bi(
      `«${fila.dataset.premio}» de ${fila.dataset.negocio}. Deja de verse y ya no se sortea; el negocio sigue como está. El negocio recibe el motivo de abajo y puede pedir que se revise en 6 meses. ${n ? `Las ${n} personas que participan lo verán como «Retirado» y reciben un aviso.` : 'Nadie participa todavía.'} No se puede deshacer.`,
      `“${fila.dataset.premio}” by ${fila.dataset.negocio}. It stops being visible and won’t be drawn; the business stays as it is. The business gets the reason below and can ask for a review within 6 months. ${n ? `The ${n} people who entered will see it as “Removed” and get a notification.` : 'Nobody has entered yet.'} This can’t be undone.`)),
    fields: [{ name: 'reason', label: bi('Motivo que verá el negocio (obligatorio por el DSA)', 'Reason the business will see (required by the DSA)'), type: 'textarea', required: true }],
    submit: bi('Retirar el sorteo', 'Remove the giveaway'),
    danger: true,
  });
  if (!r) return false;
  if ((r.reason || '').length < 5) { toast(bi(...SORTEO_ADM_ERR.reason_required), true); return false; }
  try {
    const res = await rpc('admin_remove_giveaway', { p_id: fila.dataset.sorteoAdm, p_reason: r.reason });
    toast(bi(`Sorteo retirado${res?.entries ? ` · avisadas ${res.entries} personas` : ''}`, `Giveaway removed${res?.entries ? ` · ${res.entries} people notified` : ''}`));
    return true;
  } catch (e) { toast(sorteoAdmErr(e.message), true); return false; }
}

/** Engancha los «Retirar…» de una caja; `luego` repinta. */
function sorteoAdmEngancha(caja, luego) {
  $$('[data-retira-sorteo]', caja).forEach((b) => { b.onclick = () => esperando(b, async () => { if (await sorteoAdmRetira(b)) await luego(); }); });
}

/** La tarjeta «Sorteos» de la ficha de un negocio (vacía si no tiene). */
async function sorteosDelNegocioAdmin(caja, negocio) {
  if (!caja) return;
  let r;
  try { r = await rpc('admin_giveaways', { p_status: 'all', p_business: negocio, p_limit: 20, p_offset: 0 }); } catch { return; }
  const filas = r?.rows || [];
  if (!filas.length) { caja.innerHTML = ''; return; }
  caja.innerHTML = `<div class="card"><h2>${esc(bi('Sorteos', 'Giveaways'))} (${fmtNum(r.total || filas.length)})</h2>
    ${filas.map((g) => sorteoAdmFila(g, false)).join('')}
    <p style="margin:10px 0 0"><a class="link" href="#/sorteos">${esc(bi('Todos los sorteos →', 'All giveaways →'))}</a></p></div>`;
  sorteoAdmEngancha(caja, () => sorteosDelNegocioAdmin(caja, negocio));
  I18N.translate(caja);
}

PAGES.sorteos = async (v) => {
  const s = st.sorteos;
  const en = I18N.lang === 'en';
  const aUrl = filtrosEnUrl('sorteos', s, ['status'], { status: 'active' });
  v.innerHTML = `
    <div class="page-head"><h1>Sorteos</h1></div>
    ${helpBox('¿Qué hago aquí?', en
      ? '<p>The giveaways businesses run. If one breaks the Community guidelines or the law (misleading prize, tobacco, gambling…), <b>Remove…</b> takes down that giveaway only, without touching the business: it stops being visible and won’t be drawn. You must give the reason (DSA, art. 17): the business gets it with how to appeal (6 months). Whoever entered sees it as “Removed” and gets a notification. A giveaway that has already been drawn carries on (the prize is handed over). Reports about a giveaway arrive as reports about its business (“Giveaway: …” in the details).</p>'
      : '<p>Los sorteos que hacen los negocios. Si uno incumple las Normas de la comunidad o la ley (premio engañoso, tabaco, apuestas…), <b>Retirar…</b> quita solo ese sorteo, sin tocar el negocio: deja de verse y no se sortea. Hay que dar el motivo (DSA, art. 17): el negocio lo recibe con la vía de recurso (6 meses). Quien participaba lo ve como «Retirado» y recibe un aviso. Uno ya sorteado sigue su curso (la entrega del premio). Las denuncias de un sorteo llegan como denuncias de su negocio («Sorteo: …» en los detalles).</p>')}
    <div class="toolbar">
      <input id="q" class="grow" type="search" placeholder="Buscar por premio, negocio o ciudad…" aria-label="Buscar en sorteos" value="${esc(s.q || '')}">
      <select id="status">${[['active', 'Abiertos'], ['removed', 'Retirados'], ['all', 'Todos']].map((o) => `<option value="${o[0]}" ${(s.status || 'active') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    </div>
    <div id="list"><div class="loading">Cargando…</div></div>`;
  const load = async () => {
    const q = (s.q || '').trim();
    const r = await rpc('admin_giveaways', { p_status: s.status || 'active', p_business: null, p_limit: q ? BUSCA_MAX : s.limit, p_offset: q ? 0 : s.offset });
    const todos = r.rows || [];
    const filas = q ? todos.filter((g) => coincide(q, g.prize, g.description, g.business?.name, g.business?.city)) : todos;
    const pg = q ? { html: '', bind() {} } : pager(s, r.total || 0, load);
    $('#list').innerHTML = (q ? notaBusqueda(filas.length, todos.length) : '') + (filas.length ? filas.map((g) => sorteoAdmFila(g)).join('')
      : `<div class="tbl-wrap"><div class="empty">${(s.status || 'active') === 'active' ? 'No hay sorteos abiertos.' : 'Ningún sorteo con ese filtro.'}</div></div>`) + pg.html;
    pg.bind($('#list'));
    sorteoAdmEngancha($('#list'), load);
    I18N.translate($('#list'));
  };
  $('#status').onchange = () => { s.status = $('#status').value; s.offset = 0; aUrl(); load(); };
  $('#q').oninput = debounce(() => { s.q = $('#q').value.trim(); s.offset = 0; load(); });
  await load();
};
// Si el admin ya pintó esta ruta antes de cargar este fichero (con la sesión
// guardada entra muy deprisa), se pinta otra vez, ya con «Sorteos».
if (ME && currentRoute()[0] === 'sorteos' && !$('#view [data-sorteo-adm], #view #status')) route();
