/* Administración → «Emisiones» («Dónde verlo»; migraciones
 * 20261201100000_partidos y 20261260100008_deportes_thesportsdb de la app).
 *
 * - Ligas: las ligas de TheSportsDB que se importan (`broadcast_leagues`):
 *   encenderlas o apagarlas, qué trae cada una (temporada, próximos 14 días,
 *   bares, «Poner siempre», última importación y su fallo) e «Importar esta
 *   liga».
 * - Próximas: lo de los próximos 14 días de cualquier fuente (TheSportsDB,
 *   el admin o los bares), con cuántos bares lo ponen; «Editar» (solo lo del
 *   admin o de un bar: lo importado no se edita, se oculta) y «Ocultar» /
 *   «Enseñar».
 * - De los bares: lo que han añadido los bares, agrupado por lo que parece lo
 *   mismo; «Pasar a la lista oficial» y «Fusionar con «…»».
 * - Equipos: los alias de cada equipo («Atleti», «Barça») y cuántos lo siguen.
 * Arriba: «Añadir un evento», «Importar ahora» y «Comprobar la fuente» (la
 * Edge Function `broadcasts-import` con la sesión del admin) y la última
 * importación.
 *
 * Va después de admin.js y usa lo suyo (`PAGES`, `rpc`, `sb`, `modal`,
 * `confirmDlg`, `table`, `toast`, `esperando`, `params`, `ponUrl`, `tag`…).
 */
'use strict';

const KEa = globalThis.KlendarEmisiones;
const enA = () => I18N.lang === 'en';
const FUENTE_NOMBRE = { 'football-data': 'football-data.org', thesportsdb: 'TheSportsDB', admin: 'Admin', business: 'Bares' };
const fuenteTxt = (s) => I18N.t(FUENTE_NOMBRE[s] || s || '—');
const EM = { tab: 'ligas', fuente: '', q: '', ocultas: false, qEquipos: '' };

/** «6 oct 6:30» en la hora de Madrid. */
const cuandoAdmin = (iso) => KZ.fmt(iso, TZ, LOC(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(',', '');

/** «Última importación: 6 oct 6:30 · 203 partidos · 2 llamadas (football-data.org)». */
function lineaImportacion(li) {
  const en = enA();
  if (!li) return en ? 'No imports yet.' : 'Aún no se ha importado nada.';
  const cuando = cuandoAdmin(li.finished_at || li.started_at);
  const fuente = fuenteTxt(li.source);
  if (li.error) return en ? `Last import: ${cuando} · failed: ${li.error} (${fuente})` : `Última importación: ${cuando} · falló: ${li.error} (${fuente})`;
  const n = li.items || 0;
  const c = li.calls || 0;
  return en
    ? `Last import: ${cuando} · ${fmtNum(n)} ${n === 1 ? 'match' : 'matches'} · ${fmtNum(c)} ${c === 1 ? 'call' : 'calls'} (${fuente})`
    : `Última importación: ${cuando} · ${fmtNum(n)} ${n === 1 ? 'partido' : 'partidos'} · ${fmtNum(c)} ${c === 1 ? 'llamada' : 'llamadas'} (${fuente})`;
}

/** «Importar ahora» / «Comprobar la fuente»: la Edge Function con la sesión
 * del admin (ella comprueba `is_admin`; 429 si hubo otra hace < 2 min). */
async function importacion(modo, extra = {}) {
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error(window.KL_AUTH_TEXT('sesion', I18N.lang));
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/broadcasts-import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: modo, ...extra }),
    });
  } catch { throw new Error(window.KL_AUTH_TEXT('sinRed', I18N.lang)); }
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  if (r.status === 429 || j?.error === 'too_soon') {
    throw new Error(enA() ? 'There was another import less than 2 minutes ago. Wait a moment and try again.' : 'Hubo otra importación hace menos de 2 minutos. Espera un momento y vuelve a probar.');
  }
  if (r.status === 401 || r.status === 403) throw new Error('No tienes permiso para esto.');
  if (!r.ok || !j?.ok) throw new Error(enA() ? "The import didn't work. Try again in a while." : 'La importación no ha funcionado. Prueba otra vez en un rato.');
  return j;
}

/** Lo que dice «Comprobar la fuente»: TheSportsDB, la ficha de LaLiga (si
 * la clave vale, su temporada); football-data.org, sus competiciones. */
function sondeoTxt(x) {
  const liga = Object.values(x || {}).find((y) => y && Array.isArray(y.leagues))?.leagues?.[0];
  if (liga) return `${I18N.t('La clave funciona')} · ${liga.strLeague} · ${I18N.t('temporada')} ${liga.strCurrentSeason || '—'}`;
  return (x?.competitions || []).map((c) => [c.code, c.name].filter(Boolean).join(' · ')).join(', ') || '—';
}

/** Los campos de «Añadir un evento» / «Editar». */
function camposEvento(b) {
  const lang = I18N.lang;
  return [
    { grupo: 'El evento', cols: 2, campos: [
      { name: 'sport', label: 'Deporte', type: 'select', value: b?.sport || 'football', options: KEa.DEPORTES.map((s) => [s, KEa.deporte(s, lang)]) },
      { name: 'title', label: 'Título', value: b?.title || '', required: true, placeholder: 'Eurovisión 2027 · Final', ancho: true },
      { name: 'competition', label: 'Competición (ES)', value: b?.competition || '' },
      { name: 'competition_en', label: 'Competición (EN)', value: b?.competition_en || '' },
      { name: 'teams', label: 'Equipos o participantes (para seguir)', value: (b?.team_names || []).join(', '), help: 'Separados por comas. Quien los siga recibirá el aviso.', ancho: true },
      { name: 'keywords', label: 'Palabras clave', value: b?.keywords || '', help: 'Para que se encuentre al buscar (otros nombres, siglas…).', ancho: true },
    ] },
    { grupo: 'Cuándo (hora de Madrid)', cols: 2, campos: [
      { name: 'starts', label: 'Inicio', type: 'datetime-local', value: b?.starts_at ? aInputMadrid(b.starts_at) : '', required: true },
      { name: 'ends', label: 'Fin (opcional)', type: 'datetime-local', value: b?.ends_at && b?.id ? aInputMadrid(b.ends_at) : '' },
    ] },
  ];
}
const ERR_EVENTO = {
  sport_invalid: 'Ese deporte no existe.',
  title_invalid: 'El título tiene que tener entre 2 y 120 caracteres.',
  date_invalid: 'Revisa las fechas: falta el inicio o el fin es anterior.',
  imported: 'Lo que llega de la importación no se edita (la siguiente lo pisaría): ocúltalo y añade uno tuyo.',
  not_found: 'No encontrado.',
};
async function editaEvento(b) {
  const r = await modal({ title: b ? 'Editar el evento' : 'Añadir un evento', fields: camposEvento(b), submit: 'Guardar' });
  if (!r) return false;
  try {
    const res = await rpc('admin_save_broadcast', {
      p_id: b?.id || null, p_sport: r.sport, p_title: r.title, p_starts_at: deInputMadrid(r.starts),
      p_competition: r.competition || null, p_competition_en: r.competition_en || null,
      p_teams: String(r.teams || '').split(',').map((x) => x.trim()).filter(Boolean),
      p_keywords: r.keywords || null, p_ends_at: r.ends ? deInputMadrid(r.ends) : null,
    });
    if (res?.ok === false) { toast(ERR_EVENTO[res.error] || 'No se ha podido completar. Prueba otra vez.', true); return false; }
    toast('Guardado');
    return true;
  } catch (e) { toast(e.message, true); return false; }
}

PAGES.emisiones = async (v) => {
  const p = params();
  if (['ligas', 'proximas', 'bares', 'equipos'].includes(p.tab)) EM.tab = p.tab;
  if (p.fuente != null) EM.fuente = ['thesportsdb', 'football-data', 'admin', 'business'].includes(p.fuente) ? p.fuente : '';
  const aUrl = () => ponUrl('emisiones', { tab: EM.tab === 'ligas' ? null : EM.tab, fuente: EM.tab === 'proximas' && EM.fuente ? EM.fuente : null });
  aUrl();
  v.innerHTML = `
    <div class="page-head"><h1>Emisiones</h1><span class="spacer"></span>
      <button class="btn primary sm" type="button" id="emNuevo">Añadir un evento</button>
      <button class="btn sm" type="button" id="emImportar">Importar ahora</button>
      <button class="btn sm" type="button" id="emSondear">Comprobar la fuente</button></div>
    ${helpBox('¿Qué hago aquí?', enA()
    ? `<p>Everything for “Where to watch”. Every sport comes in automatically from <b>TheSportsDB</b> every day (and every two hours during the day for time changes), league by league: in <b>Leagues</b> you turn them on or off and see what each one brings. TV channels aren't stored: what matters is whether the bar is showing it. Add here what doesn't come in on its own (Eurovision, tennis finals, the Super Bowl…): with its teams or participants, people can follow them and get notified. What comes from the provider isn't edited: hide it. In <b>From bars</b>, what bars have added by hand: if several are showing the same thing, move it to the official list or merge it with the official one. In <b>Teams</b>, aliases (“Atleti”, “Barça”) so they can be found by those names too.</p>`
    : '<p>Todo lo de «Dónde verlo». Todos los deportes llegan solos de <b>TheSportsDB</b> cada día (y cada dos horas de día, por los cambios de hora), liga a liga: en <b>Ligas</b> se encienden o se apagan y se ve qué trae cada una. El canal de TV no se guarda: lo que importa es si el bar lo pone. Aquí se añade lo que no llega solo (Eurovisión, las finales de tenis, la Super Bowl…): con sus equipos o participantes, la gente los puede seguir y recibir el aviso. Lo que llega del proveedor no se edita: se oculta. En <b>De los bares</b>, lo que los bares han añadido a mano: si varios ponen lo mismo, pásalo a la lista oficial o fusiónalo con el oficial. En <b>Equipos</b>, los alias («Atleti», «Barça») para que se encuentren también así.</p>')}
    <p class="muted small" id="emImport"></p>
    <div class="tabs">${[['ligas', 'Ligas'], ['proximas', 'Próximas'], ['bares', 'De los bares'], ['equipos', 'Equipos']].map((t) => `<button type="button" data-t="${t[0]}" class="${EM.tab === t[0] ? 'on' : ''}" aria-pressed="${EM.tab === t[0]}">${t[1]}</button>`).join('')}</div>
    <div id="tabview"></div>`;

  const load = async () => {
    const tv = $('#tabview', v);
    tv.innerHTML = '<div class="loading">Cargando…</div>';
    I18N.translate(tv);
    if (EM.tab === 'ligas') await ligas(tv);
    else if (EM.tab === 'proximas') await proximas(tv);
    else if (EM.tab === 'bares') await deLosBares(tv);
    else await equipos(tv);
    I18N.translate(tv);
  };

  async function ligas(tv) {
    const [rows, r] = await Promise.all([
      rpc('admin_broadcast_leagues'),
      rpc('admin_broadcasts', { p_days: 1, p_source: 'admin' }).catch(() => null),
    ]);
    if (r) $('#emImport', v).textContent = lineaImportacion(r.last_import);
    const lang = I18N.lang;
    const lista = rows || [];
    const nOn = lista.filter((x) => x.enabled).length;
    tv.innerHTML = `<p class="muted small">${esc(enA() ? `${nOn} of ${lista.length} leagues on. Every import asks TheSportsDB once or twice per league on (100 requests per minute in the plan).` : `${nOn} de ${lista.length} ligas encendidas. Cada importación pide a TheSportsDB una o dos veces por liga encendida (100 peticiones por minuto en el plan).`)}</p>
      <div id="list"></div>`;
    $('#list', tv).innerHTML = table({ cols: [
      { h: 'Liga', r: (x) => `<span class="title">${esc(enA() ? x.name_en : x.name)}<span class="sub">${esc([KEa.deporte(x.sport, lang), x.season, x.note].filter(Boolean).join(' · '))}</span></span>` },
      { h: 'Encendida', r: (x) => `<label class="f check" style="grid-auto-flow:column;align-items:center"><input type="checkbox" data-liga="${esc(x.id)}" ${x.enabled ? 'checked' : ''} aria-label="${esc(`${I18N.t('Encendida')}: ${x.name}`)}"></label>` },
      { h: 'Próximos 14 días', num: true, r: (x) => fmtNum(x.upcoming) },
      { h: 'Bares', num: true, r: (x) => fmtNum(x.bars) },
      { h: 'Poner siempre', num: true, r: (x) => fmtNum(x.rules) },
      { h: 'Última importación', r: (x) => (x.last_run_at
        ? `<span class="nowrap">${esc(cuandoAdmin(x.last_run_at))}</span><span class="sub">${esc(x.last_error
          ? (x.last_error === 'sin_temporada' ? I18N.t('Sin temporada en curso') : `${I18N.t('Falló')}: ${x.last_error}`)
          : (enA() ? `${fmtNum(x.last_items)} matches` : `${fmtNum(x.last_items)} partidos`))}</span>`
        : '—') },
      { h: '', r: (x) => (x.enabled ? `<button class="btn sm ghost" type="button" data-importa="${esc(x.id)}">Importar esta liga</button>` : '') },
    ], rows: lista, empty: 'Ninguna liga.' });
    $$('[data-liga]', tv).forEach((c) => {
      c.onchange = async () => {
        const x = lista.find((y) => y.id === c.dataset.liga);
        if (!c.checked && !await confirmDlg(enA() ? `Turn off “${x.name_en}”` : `Apagar «${x.name}»`,
          esc(enA() ? "It won't be imported any more. What hasn't started and no bar is showing disappears; what bars are showing stays." : 'Ya no se importará. Lo que no ha empezado y no pone ningún bar desaparece; lo que ponen los bares se queda.'),
          { submit: enA() ? 'Turn off' : 'Apagar' })) { c.checked = true; return; }
        c.disabled = true;
        try {
          const res = await rpc('admin_set_broadcast_league', { p_id: c.dataset.liga, p_enabled: c.checked });
          if (res?.ok === false) { toast(ERR_EVENTO[res.error] || 'No se ha podido completar. Prueba otra vez.', true); c.checked = !c.checked; return; }
          toast(c.checked ? I18N.t('Encendida: llegará con la próxima importación («Importar esta liga» para ya).') : I18N.t('Apagada'));
          load();
        } catch (e) { toast(e.message, true); c.checked = !c.checked; } finally { c.disabled = false; }
      };
    });
    $$('[data-importa]', tv).forEach((btn) => {
      btn.onclick = () => esperando(btn, async () => {
        try {
          const j = await importacion('daily', { league: btn.dataset.importa });
          const x = j.results?.thesportsdb || {};
          toast(x.error ? x.error : (enA() ? `${fmtNum(x.items)} matches (${fmtNum(x.inserted)} new, ${fmtNum(x.updated)} updated)` : `${fmtNum(x.items)} partidos (${fmtNum(x.inserted)} nuevos, ${fmtNum(x.updated)} actualizados)`), Boolean(x.error));
          load();
        } catch (e) { toast(e.message, true); }
      });
    });
    I18N.translate(tv);
  }

  async function proximas(tv) {
    tv.innerHTML = `<div class="toolbar">
        <select id="emFuente" aria-label="${esc(I18N.t('Fuente'))}">${[['', 'Todas'], ['thesportsdb', 'TheSportsDB'], ['admin', 'Admin'], ['business', 'Bares']].map((o) => `<option value="${o[0]}" ${EM.fuente === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
        <input class="grow" type="search" id="emQ" value="${esc(EM.q)}" placeholder="Buscar: equipo, partido o competición" aria-label="Buscar: equipo, partido o competición">
        <label class="f check" style="grid-auto-flow:column;align-items:center"><input type="checkbox" id="emOcultas" ${EM.ocultas ? 'checked' : ''}><span>Ver ocultas</span></label>
      </div><div id="list"><div class="loading">Cargando…</div></div>`;
    const pinta = async () => {
      const r = await rpc('admin_broadcasts', { p_from: null, p_days: 14, p_source: EM.fuente || null, p_q: EM.q.trim() || null, p_hidden: EM.ocultas });
      $('#emImport', v).textContent = lineaImportacion(r?.last_import);
      const rows = r?.items || [];
      const lang = I18N.lang;
      $('#list', tv).innerHTML = table({ cols: [
        { h: 'Fecha', r: (b) => `<span class="nowrap">${esc(cuandoAdmin(b.starts_at))}</span>${b.time_confirmed === false ? `<span class="sub">${esc(KEa.t(lang).tbc)}</span>` : ''}` },
        { h: 'Deporte', r: (b) => esc(KEa.deporte(b.sport, lang)) },
        { h: 'Competición', r: (b) => esc(b.competition || '—') },
        { h: 'Título', r: (b) => `<span class="title">${esc(b.title)}${b.hidden ? ` <span class="tag dim">${esc(I18N.t('oculta'))}</span>` : ''}${b.business ? `<span class="sub">${esc([b.business.name, b.business.city].filter(Boolean).join(' · '))}</span>` : ''}</span>` },
        { h: 'Fuente', r: (b) => esc(fuenteTxt(b.source)) },
        { h: 'Bares', num: true, r: (b) => esc(enA() ? `${fmtNum(b.bars)} ${b.bars === 1 ? 'bar' : 'bars'}` : `${fmtNum(b.bars)} ${b.bars === 1 ? 'bar' : 'bares'}`) },
        { h: '', r: (b) => `<span class="actions">${['admin', 'business'].includes(b.source) ? `<button class="btn sm" type="button" data-editar="${esc(b.id)}">Editar</button>` : ''}
          <button class="btn sm ghost" type="button" data-ocultar="${esc(b.id)}" data-oculta="${b.hidden ? '1' : '0'}">${b.hidden ? 'Enseñar' : 'Ocultar'}</button></span>` },
      ], rows, empty: 'Nada en los próximos 14 días con esos filtros.' });
      $$('[data-editar]', tv).forEach((btn) => { btn.onclick = () => esperando(btn, async () => { if (await editaEvento(rows.find((x) => x.id === btn.dataset.editar))) pinta(); }); });
      $$('[data-ocultar]', tv).forEach((btn) => {
        btn.onclick = () => esperando(btn, async () => {
          try {
            const res = await rpc('admin_hide_broadcast', { p_id: btn.dataset.ocultar, p_hidden: btn.dataset.oculta !== '1' });
            if (res?.ok === false) { toast(ERR_EVENTO[res.error] || 'No se ha podido completar. Prueba otra vez.', true); return; }
            toast(btn.dataset.oculta === '1' ? 'Enseñada' : 'Ocultada');
            pinta();
          } catch (e) { toast(e.message, true); }
        });
      });
      I18N.translate($('#list', tv));
    };
    $('#emFuente', tv).onchange = (e) => { EM.fuente = e.target.value; aUrl(); pinta(); };
    $('#emQ', tv).oninput = debounce((e) => { EM.q = e.target.value; pinta(); });
    $('#emOcultas', tv).onchange = (e) => { EM.ocultas = e.target.checked; pinta(); };
    await pinta();
  }

  async function deLosBares(tv) {
    const [grupos, r] = await Promise.all([
      rpc('admin_broadcast_suggestions'),
      rpc('admin_broadcasts', { p_days: 1, p_source: 'admin' }).catch(() => null),
    ]);
    if (r) $('#emImport', v).textContent = lineaImportacion(r.last_import);
    const lang = I18N.lang;
    const lista = grupos || [];
    tv.innerHTML = lista.length ? lista.map((g, i) => {
      const n = Number(g.bars) || 0;
      const barras = enA() ? `${n} ${n === 1 ? 'bar' : 'bars'}` : `${n} ${n === 1 ? 'bar' : 'bares'}`;
      return `<div class="card">
        <h2>${esc(`${g.title} · ${barras} · ${KEa.cuandoCorto(g, TZ, lang)}`)}</h2>
        <p class="muted small">${esc((g.businesses || []).join(', '))}</p>
        <div class="actions" style="margin-top:10px">
          <button class="btn sm" type="button" data-oficial="${i}">Pasar a la lista oficial</button>
          ${(g.official || []).map((o, j) => `<button class="btn sm ghost" type="button" data-fusionar="${i}" data-con="${j}">${esc(enA() ? `Merge with “${o.title}”` : `Fusionar con «${o.title}»`)}</button>`).join('')}
        </div></div>`;
    }).join('') : `<div class="card"><p class="muted" style="margin:0">${esc(I18N.t('Ningún bar ha añadido nada de lo que viene.'))}</p></div>`;
    $$('[data-oficial]', tv).forEach((btn) => {
      btn.onclick = () => esperando(btn, async () => {
        const g = lista[Number(btn.dataset.oficial)];
        const ids = g.ids || [];
        if (!ids.length) return;
        if (!await confirmDlg('Pasar a la lista oficial', esc(enA() ? `“${g.title}” goes to the official list and the ${ids.length} entries become one, with all their bars.` : `«${g.title}» pasa a la lista oficial y las ${ids.length} entradas quedan en una, con todos sus bares.`), { submit: 'Pasar a la lista oficial' })) return;
        try { await rpc('admin_merge_broadcasts', { p_target: ids[0], p_sources: ids.slice(1) }); toast('Hecho'); load(); } catch (e) { toast(e.message, true); }
      });
    });
    $$('[data-fusionar]', tv).forEach((btn) => {
      btn.onclick = () => esperando(btn, async () => {
        const g = lista[Number(btn.dataset.fusionar)];
        const o = (g.official || [])[Number(btn.dataset.con)];
        if (!o) return;
        if (!await confirmDlg(enA() ? `Merge with “${o.title}”` : `Fusionar con «${o.title}»`, esc(enA() ? `The bars showing “${g.title}” move to “${o.title}” (${cuandoAdmin(o.starts_at)}, ${fuenteTxt(o.source)}), with their offer.` : `Los bares que ponen «${g.title}» pasan a «${o.title}» (${cuandoAdmin(o.starts_at)}, ${fuenteTxt(o.source)}), con su oferta.`), { submit: 'Fusionar' })) return;
        try { await rpc('admin_merge_broadcasts', { p_target: o.id, p_sources: g.ids || [] }); toast('Hecho'); load(); } catch (e) { toast(e.message, true); }
      });
    });
  }

  async function equipos(tv) {
    tv.innerHTML = `<div class="toolbar"><input class="grow" type="search" id="eqQ" value="${esc(EM.qEquipos)}" placeholder="Buscar equipo" aria-label="Buscar equipo"></div><div id="list"><div class="loading">Cargando…</div></div>`;
    const pinta = async () => {
      const rows = (await rpc('admin_broadcast_teams', { p_q: EM.qEquipos.trim() || null })) || [];
      const lang = I18N.lang;
      $('#list', tv).innerHTML = table({ cols: [
        { h: 'Equipo', r: (x) => `<span class="title">${esc(x.name)}<span class="sub">${esc([x.short_name && x.short_name !== x.name ? x.short_name : '', KEa.deporte(x.sport, lang), fuenteTxt(x.source)].filter(Boolean).join(' · '))}</span></span>` },
        { h: 'Alias', r: (x) => `<span class="actions" style="flex-wrap:nowrap"><input type="text" data-alias="${esc(x.id)}" value="${esc((x.aliases || []).join(', '))}" placeholder="${esc(I18N.t('Alias, separados por comas'))}" aria-label="${esc(`${I18N.t('Alias, separados por comas')}: ${x.name}`)}" style="min-width:180px">
            <button class="btn sm" type="button" data-guardar="${esc(x.id)}">Guardar</button></span>` },
        { h: 'Lo siguen', num: true, r: (x) => fmtNum(x.followers) },
      ], rows, empty: 'Ningún equipo con ese nombre.' });
      $$('[data-guardar]', tv).forEach((btn) => {
        btn.onclick = () => esperando(btn, async () => {
          const campo = $(`[data-alias="${btn.dataset.guardar}"]`, tv);
          const alias = String(campo.value || '').split(',').map((x) => x.trim()).filter((x) => x.length >= 2);
          try {
            const res = await rpc('admin_set_team_aliases', { p_team: btn.dataset.guardar, p_aliases: alias });
            if (res?.ok === false) { toast(ERR_EVENTO[res.error] || 'No se ha podido completar. Prueba otra vez.', true); return; }
            toast('Guardado');
          } catch (e) { toast(e.message, true); }
        });
      });
      I18N.translate($('#list', tv));
    };
    $('#eqQ', tv).oninput = debounce((e) => { EM.qEquipos = e.target.value; pinta(); });
    await pinta();
  }

  $$('.tabs button', v).forEach((b) => {
    b.onclick = () => {
      EM.tab = b.dataset.t; aUrl();
      $$('.tabs button', v).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      load();
    };
  });
  $('#emNuevo', v).onclick = (e) => esperando(e.currentTarget, async () => { if (await editaEvento(null) && EM.tab === 'proximas') load(); });
  $('#emImportar', v).onclick = (e) => esperando(e.currentTarget, async () => {
    try {
      const j = await importacion('daily');
      const partes = Object.entries(j.results || {}).filter(([, x]) => x && typeof x === 'object').map(([fuente, x]) => (x?.error
        ? `${fuenteTxt(fuente)}: ${x.error}`
        : (enA() ? `${fuenteTxt(fuente)}: ${fmtNum(x.items)} matches (${fmtNum(x.inserted)} new, ${fmtNum(x.updated)} updated)`
          : `${fuenteTxt(fuente)}: ${fmtNum(x.items)} partidos (${fmtNum(x.inserted)} nuevos, ${fmtNum(x.updated)} actualizados)`)));
      toast(partes.join(' · ') || 'Hecho', Object.values(j.results || {}).some((x) => x && typeof x === 'object' && x.error));
      load();
    } catch (err) { toast(err.message, true); }
  });
  $('#emSondear', v).onclick = (e) => esperando(e.currentTarget, async () => {
    try {
      const j = await importacion('probe');
      const html = Object.entries(j.probe || {}).map(([fuente, x]) => `<p><b>${esc(fuenteTxt(fuente))}</b><br>${x?.error
        ? `<span class="err">${esc(x.error === 'sin_clave' ? I18N.t('Falta la clave del proveedor en las Edge Functions.') : x.error)}</span>`
        : esc(sondeoTxt(x))}</p>`).join('');
      await modal({ title: 'Comprobar la fuente', intro: html || esc(I18N.t('Ningún proveedor activo.')), submit: 'Cerrar' });
    } catch (err) { toast(err.message, true); }
  });
  await load();
};

// admin.js arranca (`boot()`) antes de que llegue este archivo: si ya ha
// pintado otra pantalla estando en «Emisiones», se vuelve a pintar esta.
if (ME && currentRoute()[0] === 'emisiones' && !$('#view [data-t="equipos"]')) route();
