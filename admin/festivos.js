/* Administración → «Festivos» (migraciones 20261233100002–03 y 20261238100000
 * de la app).
 *
 * La tabla `holidays`: nacionales, autonómicos y locales de las ciudades de
 * Klendar, con su fuente (BOE, boletines autonómicos y provinciales, el
 * ayuntamiento). Con ella, unos días antes de cada festivo se pregunta a los
 * negocios con horario «¿Abres el …?» y la ficha dice si abre.
 *
 * Casi solo: la Edge Function `holidays` busca cada lunes de octubre a enero
 * la resolución del BOE y los locales que se publican como datos abiertos, y
 * los deja **propuestos** (no se aplican a nadie hasta confirmarlos aquí).
 * Arriba, cómo va el año que se vigila («2028: nacionales confirmados ·
 * locales 16 de 18 ciudades»); debajo, los locales por ciudad con el enlace a
 * su boletín y «Añadir los dos…».
 *
 * Va después de admin.js y usa lo suyo (`PAGES`, `rpc`, `modal`,
 * `confirmDlg`, `table`, `toast`, `tag`, `esc`…).
 */
'use strict';

Object.assign(RPC_ERRORS, {
  invalid_region: 'La comunidad va con su código de dos letras (MD, AR, CT…).',
  invalid_city: 'Esa ciudad no está en Klendar.',
  invalid_source: 'Pon de dónde sale (boletín, número y fecha).',
  invalid_postal: 'El código postal, solo con cifras (de 2 a 5).',
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

/** La Edge Function `holidays` con la sesión del admin (`importar`). */
async function festImportar() {
  const en = I18N.lang === 'en';
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error(window.KL_AUTH_TEXT('sesion', I18N.lang));
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/holidays`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'importar' }),
    });
  } catch { throw new Error(window.KL_AUTH_TEXT('sinRed', I18N.lang)); }
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  if (r.status === 429 || j?.error === 'too_soon') {
    throw new Error(en ? 'It looked less than 2 minutes ago. Wait a moment and try again.' : 'Se ha buscado hace menos de 2 minutos. Espera un momento y vuelve a probar.');
  }
  if (r.status === 401 || r.status === 403) throw new Error(en ? "You don't have permission for this." : 'No tienes permiso para esto.');
  if (!r.ok || !j?.ok) throw new Error(en ? "The search didn't work. Try again in a while." : 'La búsqueda no ha funcionado. Prueba otra vez en un rato.');
  return j;
}

PAGES.festivos = async (v, param) => {
  const en = I18N.lang === 'en';
  const hoy = new Date();
  const anio = /^\d{4}$/.test(param || '') ? Number(param) : hoy.getFullYear();
  const d = await rpc('admin_holidays', { p_year: anio });
  const lista = d.holidays || [];
  const ciudades = d.cities || [];
  const st = d.status || {};
  const vig = d.watch || {};
  const imp = d.import || null;
  const anios = [...new Set([...(d.years || []), anio, anio + 1, vig.year].filter(Boolean))].sort();
  const dia = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const donde = (h) => (h.scope === 'national' ? (en ? 'All of Spain' : 'Toda España')
    : h.scope === 'region' ? festCcaa(h.region) : (h.city_name || h.city));
  const alcance = { national: en ? 'National' : 'Nacional', region: en ? 'Regional' : 'Autonómico', local: 'Local' };
  const propuestos = lista.filter((h) => h.status === 'proposed');

  // La línea de estado («2028: nacionales confirmados · locales 16 de 18 ciudades»).
  const linea = (s) => {
    if (!s?.year) return '';
    if (!en) return s.summary || '';
    const nac = s.national?.state === 'confirmed' ? 'national confirmed' : s.national?.state === 'proposed' ? 'national proposed, not confirmed' : 'national not loaded';
    return `${s.year}: ${nac} · local ${s.cities_ok} of ${s.cities_total} cities`;
  };
  const estado = (s, titulo) => {
    if (!s?.year) return '';
    const bien = s.complete;
    const faltan = (s.cities_missing || []);
    return `<div class="card fest-estado"><h2>${ms(bien ? 'check_circle' : 'event_busy')} ${esc(titulo)}</h2>
      <p style="margin:0"><b>${esc(linea(s))}</b></p>
      ${s.proposed ? `<p class="muted small" style="margin:6px 0 0">${esc(en ? `${s.proposed} proposed and not confirmed: they don't apply to anyone until you confirm them.` : `${s.proposed} ${s.proposed === 1 ? 'propuesto sin confirmar' : 'propuestos sin confirmar'}: no se aplican a nadie hasta que los confirmes.`)}</p>` : ''}
      ${faltan.length ? `<p class="muted small" style="margin:6px 0 0">${esc(en ? `Local holidays missing: ${faltan.join(', ')}.` : `Faltan los locales de ${faltan.join(', ')}.`)}</p>` : ''}
      ${(s.regions_missing || []).length ? `<p class="muted small" style="margin:6px 0 0">${esc(en ? 'No regional holidays: ' : 'Sin autonómicos: ')}${esc(s.regions_missing.map(festCcaa).join(', '))}</p>` : ''}
    </div>`;
  };
  const ultima = imp?.checked_at
    ? (en ? `Last automatic search: ${new Date(imp.checked_at).toLocaleString(LOC(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })}`
      : `Última búsqueda automática: ${new Date(imp.checked_at).toLocaleString(LOC(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })}`)
      + (imp.year ? ` · ${imp.year}` : '') + (imp.boe ? ` · ${imp.boe}` : '')
    : (en ? 'No automatic search yet.' : 'Aún no ha habido búsqueda automática.');

  // Locales por ciudad del año que se ve.
  const porCiudad = (st.cities || []).map((c) => ({ ...c, nombre: c.name }));

  v.innerHTML = `
    <div class="page-head"><h1>${en ? 'Public holidays' : 'Festivos'}</h1><span class="spacer"></span>
      <button class="btn sm" type="button" id="buscar">${ms('travel_explore')}${en ? 'Search now' : 'Buscar ahora'}</button>
      <button class="btn primary sm" type="button" id="nuevo">${en ? 'Add a holiday…' : 'Añadir un festivo…'}</button></div>
    ${vig.year && vig.year !== anio ? estado(vig, en ? `Next year (${vig.year})` : `El año que se vigila (${vig.year})`) : ''}
    ${estado(st, en ? `This year on screen (${anio})` : `${anio}`)}
    ${helpBox(en ? 'How it works' : '¿Cómo funciona?', en
    ? `<p>National, regional and local holidays (for the cities in Klendar). Seven days before each one, and again two days before if they haven’t answered, businesses with opening hours are asked “Are you open on …?”, and their page shows the answer. Businesses outside these cities only get national and regional ones; their own local holidays go in “Closed days”.</p>
       <p>Almost automatic: every Monday from October to January the BOE resolution and the local holidays published as open data (Madrid, Catalonia, Andalusia, Aragon, Balearic Islands, Basque Country, Castile and León) are loaded as proposed: confirm them here. The rest of the cities, by hand with “Add both…” and the link to their bulletin. On 1 October dev@klendar.app gets “Time to prepare next year’s holidays”, and from November a weekly email while something is missing. By hand: <code>python tool/festivos_importar.py --anio ${vig.year || anio + 1}</code>.</p>`
    : `<p>Nacionales, autonómicos y locales (de las ciudades de Klendar). Siete días antes de cada uno, y otra vez dos días antes si no han contestado, se pregunta a los negocios con horario «¿Abres el …?», y su ficha lo dice. Un negocio fuera de estas ciudades solo recibe los nacionales y los de su comunidad; sus fiestas locales las marca él en «Días cerrados».</p>
       <p>Casi solo: cada lunes de octubre a enero se cargan como propuestos la resolución del BOE y los locales que se publican como datos abiertos (Madrid, Cataluña, Andalucía, Aragón, Illes Balears, Euskadi y Castilla y León): confírmalos aquí. Los de las demás ciudades, a mano con «Añadir los dos…» y el enlace a su boletín. El 1 de octubre llega a dev@klendar.app «Toca preparar los festivos del año siguiente» y, desde noviembre, un correo cada semana mientras falte algo. A mano: <code>python tool/festivos_importar.py --anio ${vig.year || anio + 1}</code>.</p>`)}
    <div class="toolbar">${anios.map((y) => `<a class="btn sm ${y === anio ? 'primary' : 'ghost'}" href="#/festivos/${y}">${y}</a>`).join(' ')}
      <span class="muted small">${en ? `${lista.length} rows` : `${lista.length} filas`} · ${esc(ultima)}</span>
      ${propuestos.length ? `<span class="spacer"></span><button class="btn sm" type="button" id="confirmarTodos">${ms('done_all')}${esc(en ? `Confirm the ${propuestos.length} proposed` : `Confirmar los ${propuestos.length} propuestos`)}</button>` : ''}</div>
    <div class="card"><h2>${esc(en ? `Local holidays ${anio}` : `Locales de ${anio}`)}</h2>${table({
    cols: [
      { h: en ? 'City' : 'Ciudad', r: (c) => `<span class="title">${esc(c.nombre)}</span><span class="sub">${esc(c.region ? festCcaa(c.region) : (en ? 'no region' : 'sin comunidad'))}</span>` },
      { h: en ? 'Status' : 'Estado', r: (c) => (c.ok ? tag(en ? 'complete' : 'completo', 'ok')
        : c.proposed ? tag(en ? `${c.proposed} to confirm` : `${c.proposed} por confirmar`, 'warn')
          : tag(en ? `${c.confirmed} of 2` : `${c.confirmed} de 2`, 'bad')) },
      { h: en ? 'Days' : 'Días', r: (c) => (c.days || []).map((x) => `<span class="nowrap">${esc(dia(x.day))} · ${esc(x.name)}${x.status === 'proposed' ? ` ${tag(en ? 'proposed' : 'propuesto', 'warn')}` : ''}</span>`).join('<br>') || '<span class="muted">—</span>' },
      { h: en ? 'Where it is published' : 'Dónde sale', r: (c) => (c.bulletin ? `<a class="link" target="_blank" rel="noopener" href="${esc(c.bulletin.url)}">${esc(c.bulletin.name)} ↗</a>` : '—') },
      { h: '', r: (c, i) => `<span class="actions"><button class="btn sm" data-ciudad="${i}">${ms('edit_calendar')}${en ? 'Add both…' : 'Añadir los dos…'}</button></span>` },
    ],
    rows: porCiudad,
    empty: en ? 'No active cities.' : 'No hay ciudades activas.',
  })}</div>
    <div class="card"><h2>${esc(en ? `All of ${anio}` : `Todo ${anio}`)}</h2>${table({
    cols: [
      { h: en ? 'Day' : 'Día', r: (h) => `<b class="title">${esc(dia(h.day))}</b>` },
      { h: en ? 'Name' : 'Nombre', r: (h) => `${esc(h.name)}${h.status === 'proposed' ? ` ${tag(en ? 'proposed' : 'propuesto', 'warn')}` : ''}` },
      { h: en ? 'Scope' : 'Alcance', r: (h) => `${tag(alcance[h.scope], h.scope === 'national' ? 'ok' : 'dim')} <span class="sub">${esc(donde(h))}</span>` },
      { h: en ? 'Source' : 'Fuente', r: (h) => `<span class="sub">${esc(h.source || '—')}</span>` },
      { h: '', r: (h, i) => `<span class="actions">${h.status === 'proposed' ? `<button class="btn sm ghost" data-confirmar="${i}">${ms('check')}${en ? 'Confirm' : 'Confirmar'}</button>` : ''}<button class="btn sm ghost" data-editar="${i}">${ms('edit')}${en ? 'Edit' : 'Cambiar'}</button><button class="btn sm ghost" data-quitar="${i}">${ms('delete')}${en ? 'Remove' : 'Quitar'}</button></span>` },
    ],
    rows: lista,
    empty: en ? 'No holidays loaded for this year.' : 'No hay festivos cargados para este año.',
  })}</div>`;

  const editar = async (h) => {
    const r = await modal({
      title: h ? (en ? 'Edit holiday' : 'Cambiar festivo') : (en ? 'Add a holiday' : 'Añadir un festivo'),
      intro: h?.status === 'proposed' ? esc(en ? 'Saving it confirms it.' : 'Al guardarlo queda confirmado.') : '',
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

  /** Los dos locales de una ciudad de una vez, con la fuente. */
  const deCiudad = async (c) => {
    const ya = (c.days || []);
    const b = c.bulletin || {};
    const r = await modal({
      title: en ? `Local holidays ${anio} · ${c.nombre}` : `Locales de ${anio} · ${c.nombre}`,
      intro: `${esc(en ? 'The two days the city sets each year. Look them up in' : 'Los dos días que fija la ciudad cada año. Míralos en el')} ${b.url ? `<a class="link" target="_blank" rel="noopener" href="${esc(b.url)}">${esc(b.name || '')} ↗</a>` : esc(b.name || 'boletín')}.`,
      fields: [
        { grupo: en ? 'First' : 'El primero', cols: 2, campos: [
          { name: 'd1', label: en ? 'Day' : 'Día', type: 'date', value: ya[0]?.day || '', required: true },
          { name: 'n1', label: en ? 'Name' : 'Nombre', value: ya[0]?.name || '', required: true, placeholder: 'San Valero' },
        ] },
        { grupo: en ? 'Second' : 'El segundo', cols: 2, campos: [
          { name: 'd2', label: en ? 'Day' : 'Día', type: 'date', value: ya[1]?.day || '' },
          { name: 'n2', label: en ? 'Name' : 'Nombre', value: ya[1]?.name || '', placeholder: 'Cincomarzada' },
        ] },
        { name: 'source', label: en ? 'Source' : 'Fuente', value: `${b.name || ''} núm. …, ${en ? 'date' : 'fecha'} … — `, required: true, ancho: true,
          help: en ? 'Bulletin, number and date (and the link).' : 'Boletín, número y fecha (y el enlace).' },
      ],
      submit: en ? 'Save both' : 'Guardar los dos',
    });
    if (!r) return;
    const dias = [[r.d1, r.n1], [r.d2, r.n2]].filter(([x, n]) => x && n).map(([x, n]) => ({ day: x, name: n }));
    if (dias.some((x) => !x.day.startsWith(String(anio)))) { toast(en ? `The days must be in ${anio}.` : `Los días tienen que ser de ${anio}.`, true); return; }
    const res = await rpc('admin_save_city_holidays', { p_city: c.id, p_days: dias, p_source: r.source })
      .catch((e) => ({ ok: false, error: e.message }));
    if (!res?.ok) { toast(I18N.t(RPC_ERRORS[res?.error] || 'No se ha podido guardar'), true); return; }
    toast(en ? 'Saved' : 'Guardado');
    route();
  };

  const confirmar = async (ids) => {
    const res = await rpc('admin_confirm_holidays', { p_ids: ids }).catch(() => null);
    if (!res?.ok) { toast(en ? 'Could not confirm them' : 'No se han podido confirmar', true); return; }
    toast(en ? `Confirmed: ${res.confirmed}` : `Confirmados: ${res.confirmed}`);
    route();
  };

  $('#nuevo', v).onclick = () => editar(null);
  $('#buscar', v).onclick = (e) => esperando(e.currentTarget, async () => {
    try {
      const x = await festImportar();
      toast(en ? `Search done (${x.year}): ${x.proposed} new proposed.` : `Búsqueda hecha (${x.year}): ${x.proposed} propuestos nuevos.`);
      route();
    } catch (err) { toast(err.message, true); }
  });
  const todos = $('#confirmarTodos', v);
  if (todos) todos.onclick = (e) => esperando(e.currentTarget, () => confirmar(propuestos.map((h) => h.id)));
  $$('[data-confirmar]', v).forEach((b) => { b.onclick = () => esperando(b, () => confirmar([lista[+b.dataset.confirmar].id])); });
  $$('[data-ciudad]', v).forEach((b) => { b.onclick = () => deCiudad(porCiudad[+b.dataset.ciudad]); });
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
