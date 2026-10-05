/* Series del negocio («Micro abierto de los jueves»), como «Series» en «Mi
 * negocio» de la app (migración 20261107100000_series de la app).
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `modal`,
 * `confirmDlg`, `table`, `toast`, `bi`, `esc`, `gestiona`…). Cuántas personas
 * siguen cada serie (nunca quiénes); propietario y encargado pueden cambiar
 * el nombre, terminarla o cancelarla, y meter una publicación en una serie
 * («Serie…» en su menú). */
'use strict';

/** Las series del negocio activo (las terminadas, 90 días). */
async function seriesDeNegocio() {
  try { return (await rpc('my_business_series', { p_business: BIZ.id })) || []; } catch { return []; }
}

const seguidoresTxt = (n) => bi(
  n === 0 ? 'Aún no la sigue nadie' : n === 1 ? 'La sigue 1 persona' : `La siguen ${fmtNum(n)} personas`,
  n === 0 ? 'No followers yet' : n === 1 ? '1 person follows it' : `${fmtNum(n)} people follow it`);
const fechasTxt = (s) => [
  bi(s.dates === 1 ? '1 fecha' : `${fmtNum(s.dates)} fechas`, s.dates === 1 ? '1 date' : `${fmtNum(s.dates)} dates`),
  s.status === 'active' ? bi(s.upcoming === 0 ? 'ninguna próxima' : s.upcoming === 1 ? '1 próxima' : `${fmtNum(s.upcoming)} próximas`,
    s.upcoming === 0 ? 'none coming up' : s.upcoming === 1 ? '1 coming up' : `${fmtNum(s.upcoming)} coming up`) : '',
  s.status === 'active' && s.next_at ? fmtDate(s.next_at) : '',
  s.status === 'active' && s.rule_id ? bi('Se repite sola', 'Repeats automatically') : '',
  s.status === 'ended' ? bi('Terminada', 'Ended') : s.status === 'cancelled' ? bi('Cancelada', 'Cancelled') : '',
].filter(Boolean).join(' · ');
const erroresSerie = {
  too_many: ['Tienes 50 series abiertas: termina alguna antes de crear otra.', 'You have 50 open series: end one before creating another.'],
  series_ended: ['Esa serie ya ha terminado.', 'That series has already ended.'],
  series_name_invalid: ['El nombre tiene que tener entre 2 y 90 caracteres.', 'The name must be between 2 and 90 characters.'],
  offensive_name: ['Ese nombre no se puede usar.', "That name can't be used."],
};
const errorSerieTxt = (e) => {
  const k = Object.keys(erroresSerie).find((x) => String(e?.message || '').includes(x));
  return k ? bi(...erroresSerie[k]) : friendly(e?.message || '');
};
/** `rpc` devuelve el `{ ok, error }` de la base tal cual: aquí se convierte
 * en error para los avisos. */
async function rpcSerie(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw new Error(r.error || 'error');
  return r;
}

PAGES.series = async (v) => {
  const puede = gestiona();
  const [lista, reglas] = await Promise.all([
    seriesDeNegocio(),
    puede ? rpc('my_offer_rules', { p_business: BIZ.id }).catch(() => []) : Promise.resolve([]),
  ]);
  const DIAS = I18N.lang === 'en'
    ? ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
    : ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
  // Lo que se publica solo cada semana (antes en Publicaciones): ya es una
  // serie, así que va aquí, como en la app.
  const repiten = puede ? `<div class="card"><h2>${esc(bi('Se repiten solas', 'Repeating offers'))}</h2>
      <p class="muted" style="margin:0 0 10px">${esc((reglas || []).length
        ? bi('Cada una se publica sola a su hora. Si la de la semana pasada sigue activa, esa semana se salta: no se apilan.', "Each one goes live on its own at its time. If last week's is still active, that week is skipped: they don't pile up.")
        : bi('En «Más» de una publicación, «Repetir cada semana»: elige días y hora y se publicará sola.', 'In a publication\'s “More”, “Repeat every week”: choose days and time and it will go live on its own.'))}</p>
      ${(reglas || []).length ? table({
        cols: [
          { h: bi('Publicación', 'Publication'), r: (x) => `<b class="title">${esc(x.title || '—')}</b><span class="sub">${esc(bi(`${fmtNum(x.published)} ${x.published === 1 ? 'publicada' : 'publicadas'}`, `${fmtNum(x.published)} published`))}${x.series_id ? ` · ${esc(seguidoresTxt(x.followers || 0))}` : ''}</span>` },
          { h: bi('Cuándo', 'When'), r: (x) => `${x.weekdays.map((d) => DIAS[d]).join(', ')} ${I18N.lang === 'en' ? 'at' : 'a las'} ${esc(x.start_time)}` },
          { h: bi('Dura', 'Lasts'), r: (x) => `${Math.round(x.duration_min / 60 * 10) / 10} h` },
          { h: bi('Estado', 'Status'), r: (x) => tag(x.is_active ? 'active' : 'draft') },
          { h: '', r: (x) => `<div class="actions">
              <button class="btn sm ghost" data-rule="${x.is_active ? 'pause' : 'resume'}" data-id="${esc(x.id)}">${esc(x.is_active ? bi('Pausar', 'Pause') : bi('Reanudar', 'Resume'))}</button>
              <button class="btn sm ghost" data-rule="delete" data-id="${esc(x.id)}">${esc(bi('Quitar', 'Remove'))}</button></div>` },
        ],
        rows: reglas,
      }) : ''}</div>` : '';
  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Series y repeticiones', 'Series and repeats'))}</h1></div>
    <p class="muted">${esc(bi('Una serie agrupa las fechas de lo mismo («Micro abierto de los jueves»). Quien la sigue recibe un aviso con cada fecha nueva. Lo que se repite solo ya es una serie.',
      'A series groups the dates of the same thing (“Thursday open mic”). Its followers get a notification with each new date. Anything that repeats automatically is already a series.'))}</p>
    ${repiten}
    <div class="card"><h2>${esc(bi('Series', 'Series'))}</h2>${table({
      cols: [
        { h: bi('Serie', 'Series'), r: (s) => `<b class="title">${esc(s.name)}</b><span class="sub">${esc(fechasTxt(s))}</span>` },
        { h: bi('Personas', 'People'), r: (s) => `<b>${esc(seguidoresTxt(s.followers || 0))}</b>` },
        { h: '', r: (s) => (puede && s.status === 'active' ? `<div class="actions">
            <button class="btn sm ghost" data-serie="rename" data-id="${esc(s.id)}">${esc(bi('Cambiar el nombre', 'Rename'))}</button>
            <button class="btn sm ghost" data-serie="end" data-id="${esc(s.id)}">${esc(bi('Terminar la serie', 'End the series'))}</button>
            <button class="btn sm ghost bad" data-serie="cancel" data-id="${esc(s.id)}">${esc(bi('Cancelar la serie', 'Cancel the series'))}</button>
          </div>` : '') },
      ],
      rows: lista,
      empty: bi('Aún no tienes series. En «Más» de una publicación, «Serie…» la mete en una serie nueva o en una que ya tengas. Lo que se repite solo tiene la suya.',
        "You don't have any series yet. In a publication's “More”, “Series…” adds it to a new series or one you already have. Anything that repeats automatically has its own."),
    })}</div>`;
  $$('[data-rule]', v).forEach((b) => {
    b.onclick = async () => {
      try {
        if (b.dataset.rule === 'delete') {
          const regla = (reglas || []).find((x) => x.id === b.dataset.id) || {};
          const n = regla.followers || 0;
          if (!await confirmDlg(bi('Quitar la repetición', 'Remove the repeat'), `${esc(I18N.t('Dejará de publicarse sola. Lo que ya se publicó se queda como está.'))}${n ? ` ${esc(bi(
            n === 1 ? 'La persona que sigue la serie recibirá un aviso de que ha terminado.' : `Las ${n} personas que siguen la serie recibirán un aviso de que ha terminado.`,
            n === 1 ? 'The person following the series will be notified that it has ended.' : `The ${n} people following the series will be notified that it has ended.`))}` : ''}`, { danger: true, submit: bi('Quitar', 'Remove') })) return;
          await rpc('delete_offer_rule', { p_id: b.dataset.id });
          toast(bi('Quitada', 'Removed'));
        } else {
          await rpc('set_offer_rule_active', { p_id: b.dataset.id, p_active: b.dataset.rule === 'resume' });
          toast(bi('Guardado', 'Saved'));
        }
        PAGES.series(v);
      } catch (e) { toast(friendly(e.message), true); }
    };
  });
  $$('[data-serie]', v).forEach((b) => {
    b.onclick = async () => {
      const s = lista.find((x) => x.id === b.dataset.id);
      if (!s) return;
      try {
        if (b.dataset.serie === 'rename') {
          const r = await modal({
            title: bi('Cambiar el nombre', 'Rename'),
            fields: [{ name: 'name', label: bi('Nombre de la serie', 'Series name'), value: s.name, required: true, maxlength: 90 }],
          });
          if (!r || r.name === s.name) return;
          await rpcSerie('rename_offer_series', { p_series: s.id, p_name: r.name });
          toast(bi('Guardado', 'Saved'));
        } else {
          const cancelar = b.dataset.serie === 'cancel';
          const n = s.followers || 0;
          const texto = cancelar
            ? bi(`También se cancelan las próximas fechas, con aviso a quien tenga reserva${n ? `, y ${n === 1 ? 'la persona que la sigue recibirá' : `las ${n} personas que la siguen recibirán`} un aviso` : ''}.`,
              `The upcoming dates are cancelled too, and anyone with a booking is notified${n ? `; ${n === 1 ? 'the person following it' : `the ${n} people following it`} will be notified too` : ''}.`)
            : bi(`No habrá más fechas; las que ya están publicadas siguen en pie.${n ? ` ${n === 1 ? 'La persona que la sigue recibirá' : `Las ${n} personas que la siguen recibirán`} un aviso.` : ''}`,
              `There won't be any more dates; the ones already posted still go ahead.${n ? ` ${n === 1 ? 'The person following it' : `The ${n} people following it`} will be notified.` : ''}`);
          const regla = s.rule_id ? ` ${bi('También se quita «Repetir cada semana».', '“Repeat every week” is removed too.')}` : '';
          if (!await confirmDlg(cancelar ? bi(`¿Cancelar «${s.name}»?`, `Cancel “${s.name}”?`) : bi(`¿Terminar «${s.name}»?`, `End “${s.name}”?`),
            esc(texto + regla), { danger: true, submit: cancelar ? bi('Cancelar la serie', 'Cancel the series') : bi('Terminar la serie', 'End the series') })) return;
          await rpcSerie('end_offer_series', { p_series: s.id, p_cancel: cancelar });
          toast(cancelar ? bi('Serie cancelada', 'Series cancelled') : bi('Serie terminada', 'Series ended'));
        }
        PAGES.series(v);
      } catch (e) { toast(errorSerieTxt(e), true); }
    };
  });
};

/** «Serie…» en el menú de una publicación: una serie nueva, una de las que
 * hay o ninguna. Devuelve true si ha cambiado algo. */
async function serieDialogo(o) {
  const lista = await seriesDeNegocio();
  const activas = lista.filter((s) => s.status === 'active');
  const actual = lista.find((s) => (s.offer_ids || []).includes(o.id));
  const r = await modal({
    title: bi('Forma parte de una serie', 'Part of a series'),
    intro: esc(bi('Quien siga la serie recibirá un aviso con cada fecha nueva.', 'People who follow the series get a notification with each new date.')),
    fields: [
      { name: 'serie', type: 'select', label: bi('Serie', 'Series'), value: actual?.id || (activas.length ? '' : '+'), options: [
        ['', bi('No forma parte de ninguna', "It isn't part of any")],
        ...activas.map((s) => [s.id, `${s.name} · ${seguidoresTxt(s.followers || 0)}`]),
        ['+', bi('Una serie nueva', 'A new series')],
      ] },
      { name: 'name', label: bi('Nombre de la serie nueva', 'New series name'), value: o.title || '', maxlength: 90,
        placeholder: bi('Ej.: Micro abierto de los jueves', 'E.g. Thursday open mic'),
        help: bi('Solo si eliges «Una serie nueva».', 'Only if you choose “A new series”.') },
    ],
  });
  if (!r) return false;
  if (r.serie === (actual?.id || '')) return false;
  try {
    await rpcSerie('set_offer_series', {
      p_offer: o.id,
      p_series: r.serie && r.serie !== '+' ? r.serie : null,
      p_name: r.serie === '+' ? r.name : null,
    });
    toast(bi('Guardado', 'Saved'));
    return true;
  } catch (e) { toast(errorSerieTxt(e), true); return false; }
}

/** La tarjeta del Informe: cuántas personas siguen cada serie (hoy). */
async function informeSeriesHtml() {
  const lista = await seriesDeNegocio();
  if (!lista.length) return '';
  return `<div class="card"><h2>Series</h2>
    <p class="muted" style="margin:0 0 10px">${esc(bi('Cuántas personas siguen cada serie (nunca quiénes).', 'How many people follow each series (never who).'))}</p>
    ${table({
      cols: [
        { h: bi('Serie', 'Series'), r: (s) => `<b class="title">${esc(s.name)}</b><span class="sub">${esc(fechasTxt(s))}</span>` },
        { h: bi('Personas', 'People'), num: true, r: (s) => fmtNum(s.followers || 0) },
      ],
      rows: lista,
    })}</div>`;
}
