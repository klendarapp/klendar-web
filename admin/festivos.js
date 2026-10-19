/* Administración → «Festivos» (migraciones 20261233100002–03 de la app).
 *
 * La tabla `holidays`: nacionales, autonómicos y locales de las ciudades de
 * Klendar, con su fuente (BOE, boletines autonómicos y provinciales, el
 * ayuntamiento). Con ella, unos días antes de cada festivo se pregunta a los
 * negocios con horario «¿Abres el …?» y la ficha dice si abre. Aquí se ve
 * por año y se añaden, cambian o quitan (cuando salga el boletín de un año
 * nuevo o se corrija uno).
 *
 * Va después de admin.js y usa lo suyo (`PAGES`, `rpc`, `modal`,
 * `confirmDlg`, `table`, `toast`, `tag`, `esc`…).
 */
'use strict';

Object.assign(RPC_ERRORS, {
  invalid_region: 'La comunidad va con su código de dos letras (MD, AR, CT…).',
  invalid_city: 'Esa ciudad no está en Klendar.',
  duplicate: 'Ya hay un festivo ese día con ese mismo alcance.',
});

// Comunidades autónomas (ISO 3166-2, sin «ES-»).
const FEST_CCAA = [
  ['AN', 'Andalucía'], ['AR', 'Aragón'], ['AS', 'Asturias'], ['IB', 'Illes Balears'], ['CN', 'Canarias'],
  ['CB', 'Cantabria'], ['CL', 'Castilla y León'], ['CM', 'Castilla-La Mancha'], ['CT', 'Cataluña'],
  ['EX', 'Extremadura'], ['GA', 'Galicia'], ['MD', 'Comunidad de Madrid'], ['MC', 'Región de Murcia'],
  ['NC', 'Navarra'], ['PV', 'País Vasco'], ['RI', 'La Rioja'], ['VC', 'Comunitat Valenciana'],
  ['CE', 'Ceuta'], ['ML', 'Melilla'],
];
const festCcaa = (c) => (FEST_CCAA.find((x) => x[0] === c) || [c, c])[1];

PAGES.festivos = async (v, param) => {
  const en = I18N.lang === 'en';
  const anio = /^\d{4}$/.test(param || '') ? Number(param) : new Date().getFullYear();
  const d = await rpc('admin_holidays', { p_year: anio });
  const lista = d.holidays || [];
  const ciudades = d.cities || [];
  const anios = [...new Set([...(d.years || []), anio, anio + 1])].sort();
  const dia = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const donde = (h) => (h.scope === 'national' ? (en ? 'All of Spain' : 'Toda España')
    : h.scope === 'region' ? festCcaa(h.region) : (h.city_name || h.city));
  const alcance = { national: en ? 'National' : 'Nacional', region: en ? 'Regional' : 'Autonómico', local: 'Local' };
  v.innerHTML = `
    <div class="page-head"><h1>${en ? 'Public holidays' : 'Festivos'}</h1><span class="spacer"></span>
      <button class="btn primary sm" type="button" id="nuevo">${en ? 'Add a holiday…' : 'Añadir un festivo…'}</button></div>
    ${helpBox(en ? 'How it works' : '¿Cómo funciona?', en
    ? '<p>National, regional and local holidays (for the cities in Klendar). Seven days before each one, and again two days before if they haven’t answered, businesses with opening hours are asked “Are you open on …?”, and their page shows the answer.</p><p>Each row cites its source (BOE, regional or provincial bulletin, or the city council). Add next year’s when the bulletin comes out.</p>'
    : '<p>Nacionales, autonómicos y locales (de las ciudades de Klendar). Siete días antes de cada uno, y otra vez dos días antes si no han contestado, se pregunta a los negocios con horario «¿Abres el …?», y su ficha lo dice.</p><p>Cada fila cita su fuente (BOE, boletín autonómico o provincial, o el ayuntamiento). Los del año siguiente se añaden cuando sale el boletín.</p>')}
    <div class="toolbar">${anios.map((y) => `<a class="btn sm ${y === anio ? 'primary' : 'ghost'}" href="#/festivos/${y}">${y}</a>`).join(' ')}
      <span class="muted small">${en ? `${lista.length} rows` : `${lista.length} filas`}</span></div>
    <div class="card">${table({
    cols: [
      { h: en ? 'Day' : 'Día', r: (h) => `<b class="title">${esc(dia(h.day))}</b>` },
      { h: en ? 'Name' : 'Nombre', r: (h) => esc(h.name) },
      { h: en ? 'Scope' : 'Alcance', r: (h) => `${tag(alcance[h.scope], h.scope === 'national' ? 'ok' : 'dim')} <span class="sub">${esc(donde(h))}</span>` },
      { h: en ? 'Source' : 'Fuente', r: (h) => `<span class="sub">${esc(h.source || '—')}</span>` },
      { h: '', r: (h, i) => `<span class="actions"><button class="btn sm ghost" data-editar="${i}">${ms('edit')}${en ? 'Edit' : 'Cambiar'}</button><button class="btn sm ghost" data-quitar="${i}">${ms('delete')}${en ? 'Remove' : 'Quitar'}</button></span>` },
    ],
    rows: lista,
    empty: en ? 'No holidays loaded for this year.' : 'No hay festivos cargados para este año.',
  })}</div>`;

  const editar = async (h) => {
    const r = await modal({
      title: h ? (en ? 'Edit holiday' : 'Cambiar festivo') : (en ? 'Add a holiday' : 'Añadir un festivo'),
      fields: [
        { name: 'day', label: en ? 'Day' : 'Día', type: 'date', value: h?.day || '', required: true },
        { name: 'name', label: en ? 'Name' : 'Nombre', value: h?.name || '', maxlength: 80, required: true, placeholder: 'Todos los Santos' },
        { name: 'scope', label: en ? 'Scope' : 'Alcance', type: 'select', value: h?.scope || 'local',
          options: [['national', alcance.national], ['region', alcance.region], ['local', alcance.local]] },
        { name: 'region', label: en ? 'Region (if regional)' : 'Comunidad (si es autonómico)', type: 'select', value: h?.region || 'MD',
          options: FEST_CCAA.map(([c, n]) => [c, `${n} (${c})`]) },
        { name: 'city', label: en ? 'City (if local)' : 'Ciudad (si es local)', type: 'select', value: h?.city || 'madrid',
          options: ciudades.map((c) => [c.id, c.name]) },
        { name: 'source', label: en ? 'Source' : 'Fuente', value: h?.source || '', maxlength: 300,
          placeholder: 'BOE-A-2026-21254, 13-10-2026', help: en ? 'Bulletin, number and date (and the link).' : 'Boletín, número y fecha (y el enlace).' },
      ],
      submit: en ? 'Save' : 'Guardar',
    });
    if (!r) return;
    const res = await rpc('admin_save_holiday', {
      p_id: h?.id || null, p_day: r.day, p_name: r.name, p_scope: r.scope,
      p_region: r.scope === 'region' ? r.region : null, p_city: r.scope === 'local' ? r.city : null, p_source: r.source,
    }).catch((e) => ({ ok: false, error: e.message }));
    if (!res?.ok) { toast(I18N.t(RPC_ERRORS[res?.error] || 'No se ha podido guardar'), true); return; }
    toast(en ? 'Saved' : 'Guardado');
    route();
  };
  $('#nuevo', v).onclick = () => editar(null);
  $$('[data-editar]', v).forEach((b) => { b.onclick = () => editar(lista[+b.dataset.editar]); });
  $$('[data-quitar]', v).forEach((b) => { b.onclick = async () => {
    const h = lista[+b.dataset.quitar];
    if (!(await confirmDlg(en ? 'Remove this holiday?' : '¿Quitar este festivo?', esc(`${dia(h.day)} · ${h.name} · ${donde(h)}`), { submit: en ? 'Remove' : 'Quitar', danger: true }))) return;
    const res = await rpc('admin_delete_holiday', { p_id: h.id }).catch(() => null);
    if (!res?.ok) { toast(en ? 'Could not remove it' : 'No se ha podido quitar', true); return; }
    toast(en ? 'Removed' : 'Quitado');
    route();
  }; });
};
