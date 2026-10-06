/* «Partidos que pones» (grupo Publicar), como «Mi negocio» → «Partidos que
 * pones» en la app (migración 20261201100000_partidos de la app).
 *
 * La semana (esta o la próxima, en la hora del local) con lo de la lista
 * oficial y lo que ha añadido el bar, agrupado por competición y dentro por
 * fecha. «Lo ponemos» marca o quita uno; «Ponerlos todos» / «Quitar todos»,
 * los de una competición. Marcado, «Oferta para el partido»: crear una nueva
 * (el formulario de oferta flash ya relleno: `#/publicaciones/nueva-flash?
 * partido=<id>`, que al guardar la une al partido), usar una que ya tienes o
 * quitarla. «Añadir otro» (`#/partidos/nuevo`): lo que no está en la lista.
 * Un empleado lo ve sin poder tocar (`can_edit`).
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `TZ`, `KZ`,
 * `modal`, `toast`, `friendly`, `bi`, `esc`, `$`, `$$`…). Los textos, de
 * /assets/emisiones.js (los mismos que la app).
 */
'use strict';

const KEp = globalThis.KlendarEmisiones;
const SP = () => KEp.t(I18N.lang);
/** Lo que se está mirando: la semana (0 esta, 1 la próxima), la búsqueda y
 * el deporte. Se queda al ir y volver del formulario. */
const PT = { semana: 0, q: '', deporte: '' };

/** «Football data provided by the Football-Data.org API» (con sus datos). */
const atribucionPanel = () => `<p class="pt-fuente"><a href="${KEp.FUENTE.url}" target="_blank" rel="noopener">${esc(KEp.FUENTE.texto)}</a></p>`;

/** Lo que dice la base cuando algo no ha ido bien, con las frases de la app. */
function errorPartido(code) {
  const S = SP();
  return { title_invalid: S.errTitle, date_invalid: S.errDate, offensive_name: S.errOffensive }[code] || friendly(code);
}

PAGES.partidos = async (v, param) => {
  if (param === 'nuevo') return nuevoPartido(v);
  const S = SP();
  const lang = I18N.lang;
  const desde = KZ.hoy(TZ, PT.semana ? 7 : 0);
  const r = await rpc('business_broadcast_week', { p_business: BIZ.id, p_from: desde, p_days: 7, p_lang: lang });
  if (!r || r.ok === false) throw new Error(friendly(r?.error || 'not_authorized'));
  const puede = !!r.can_edit;
  let items = Array.isArray(r.items) ? r.items : [];

  v.innerHTML = `
    <div class="page-head"><h1>${esc(S.tool)}</h1><span class="spacer"></span>
      ${puede ? `<a class="btn sm" href="#/partidos/nuevo">${esc(S.addAnother)}</a>` : ''}</div>
    <p class="muted" style="margin:-6px 0 14px">${esc(S.toolLead)}</p>
    ${puede ? '' : `<div class="help pt-solo">${esc(S.readOnly)}</div>`}
    <div class="pt-filtros">
      <div class="elige" role="radiogroup" aria-label="${esc(S.thisWeek)}">
        ${[[0, S.thisWeek], [1, S.nextWeek]].map(([n, txt]) => `<label><input type="radio" name="ptSemana" value="${n}" ${PT.semana === n ? 'checked' : ''}><span>${esc(txt)}</span></label>`).join('')}
      </div>
      <label class="f pt-buscar"><span class="sr">${esc(S.searchBiz)}</span><input type="search" id="ptQ" value="${esc(PT.q)}" placeholder="${esc(S.searchBiz)}" maxlength="60" autocomplete="off"></label>
      <div class="elige" id="ptDeportes" role="radiogroup" aria-label="${esc(S.sport)}"></div>
    </div>
    <div id="ptLista"></div>`;

  const pinta = () => {
    // Los deportes que hay esta semana (solo si hay más de uno).
    const deportes = KEp.DEPORTES.filter((s) => items.some((b) => b.sport === s));
    if (PT.deporte && !deportes.includes(PT.deporte)) PT.deporte = '';
    $('#ptDeportes', v).innerHTML = deportes.length > 1
      ? [['', S.all], ...deportes.map((s) => [s, KEp.deporte(s, lang)])].map(([s, txt]) => `<label><input type="radio" name="ptDep" value="${esc(s)}" ${PT.deporte === s ? 'checked' : ''}><span>${esc(txt)}</span></label>`).join('')
      : '';
    const caja = $('#ptLista', v);
    if (!items.length) {
      caja.innerHTML = `<section class="vacio">
        <h2>${esc(S.emptyWeek)}</h2>
        <p>${esc(S.emptyWeekText)}</p>
        ${puede ? `<div class="vacio-botones"><a class="btn" href="#/partidos/nuevo">${esc(S.addAnother)}</a></div>` : ''}
      </section>`;
      return;
    }
    const q = KEp.plano(PT.q.trim());
    const vis = items.filter((b) => (!PT.deporte || b.sport === PT.deporte)
      && (!q || KEp.plano([b.title, b.competition, b.home, b.away].filter(Boolean).join(' ')).includes(q)));
    if (!vis.length) {
      caja.innerHTML = `<div class="card"><p style="margin:0"><b>${esc(S.notFound(PT.q.trim() || KEp.deporte(PT.deporte, lang)))}</b></p><p class="muted" style="margin:4px 0 0">${esc(S.notFoundText)}</p></div>`;
      return;
    }
    // Por competición (sin ella, el deporte), en el orden del primer partido.
    const grupos = [];
    for (const b of vis) {
      const nombre = b.competition || KEp.deporte(b.sport, lang);
      let g = grupos.find((x) => x.nombre === nombre);
      if (!g) { g = { nombre, items: [] }; grupos.push(g); }
      g.items.push(b);
    }
    // Dentro, por fecha.
    for (const g of grupos) g.items.sort((x, y) => String(x.starts_at).localeCompare(String(y.starts_at)));
    // Las competiciones, en el orden de la app (lo que más se pone primero:
    // LaLiga, Champions, Premier…); las demás, por nombre.
    const ORDEN = ['PD', 'CL', 'PL', 'SA', 'BL1', 'FL1', 'PPL', 'DED', 'ELC', 'BSA', 'WC', 'EC'];
    const rango = (g) => { const i = ORDEN.indexOf(g.items[0]?.competition_code); return i < 0 ? 100 : i; };
    grupos.sort((a, b) => rango(a) - rango(b) || a.nombre.localeCompare(b.nombre));
    caja.innerHTML = grupos.map((g, gi) => {
      const on = g.items.filter((b) => b.on).length;
      const todos = on === g.items.length;
      return `<section class="card pt-grupo">
        <div class="pt-cab"><h2>${esc(S.groupCount(g.nombre, on, g.items.length))}</h2>
          ${puede ? `<button type="button" class="linkbtn" data-todos="${gi}" data-on="${todos ? '0' : '1'}">${esc(todos ? S.removeAll : S.showAll)}</button>` : ''}</div>
        ${g.items.map((b) => {
          const oferta = b.offer && b.offer.title;
          const lineaOferta = !b.on ? ''
            : oferta
              ? (puede ? `<button type="button" class="pt-oferta" data-oferta="${esc(b.id)}">${esc(S.offer(b.offer.title))}</button>` : `<span class="pt-oferta">${esc(S.offer(b.offer.title))}</span>`)
              : (puede ? `<button type="button" class="linkbtn pt-oferta-nueva" data-oferta="${esc(b.id)}">${esc(S.offerFor)}</button>` : '');
          return `<div class="pt-fila${b.on ? ' on' : ''}">
            <div class="pt-info"><span class="pt-cuando">${esc(KEp.cuandoCorto(b, TZ, lang))}</span><b>${esc(b.title)}</b>
              ${lineaOferta ? `<div class="pt-linea">${lineaOferta}</div>` : ''}</div>
            <label class="pt-chip"><input type="checkbox" data-pon="${esc(b.id)}" ${b.on ? 'checked' : ''} ${puede ? '' : 'disabled'}><span>${esc(S.weShow)}</span></label>
          </div>`;
        }).join('')}
      </section>`;
    }).join('') + (KEp.conAtribucion(vis) ? atribucionPanel() : '');

    // «Lo ponemos» de uno, y «Ponerlos todos» / «Quitar todos» de una competición.
    const pon = async (ids, alto, boton) => {
      if (boton) boton.disabled = true;
      try {
        const res = await rpc('set_business_broadcasts', { p_business: BIZ.id, p_broadcasts: ids, p_on: alto });
        if (res && res.ok === false) { toast(friendly(res.error), true); return false; }
        // Lo que añadió el bar y ya no pone nadie desaparece (lo borra la base).
        items = items.filter((b) => alto || !(ids.includes(b.id) && b.own))
          .map((b) => (ids.includes(b.id) ? { ...b, on: alto, offer: alto ? b.offer : null } : b));
        return true;
      } catch (e) { toast(e.message, true); return false; } finally { if (boton) boton.disabled = false; }
    };
    $$('[data-pon]', caja).forEach((c) => {
      c.onchange = async () => {
        const ok = await pon([c.dataset.pon], c.checked, c);
        if (!ok) c.checked = !c.checked;
        pinta();
      };
    });
    $$('[data-todos]', caja).forEach((b) => {
      b.onclick = async () => {
        const g = grupos[Number(b.dataset.todos)];
        const alto = b.dataset.on === '1';
        const ids = g.items.filter((x) => x.on !== alto).map((x) => x.id);
        if (await pon(ids, alto, b)) pinta();
      };
    });
    $$('[data-oferta]', caja).forEach((b) => {
      b.onclick = async () => {
        const item = items.find((x) => x.id === b.dataset.oferta);
        if (!item) return;
        const cambio = await hojaOferta(item);
        if (cambio) {
          items = items.map((x) => (x.id === item.id ? { ...x, on: true, offer: cambio.offer } : x));
          pinta();
        }
      };
    });
  };

  $$('input[name=ptSemana]', v).forEach((x) => { x.onchange = () => { PT.semana = Number(x.value); PAGES.partidos(v); }; });
  $('#ptDeportes', v).addEventListener('change', (e) => { if (e.target.name === 'ptDep') { PT.deporte = e.target.value; pinta(); } });
  let espera = null;
  $('#ptQ', v).addEventListener('input', (e) => { clearTimeout(espera); espera = setTimeout(() => { PT.q = e.target.value; pinta(); }, 200); });
  pinta();
  I18N.translate(v);
};

/** La hoja de «Oferta para el partido»: crear una, usar una que ya tienes o
 * quitarla. Devuelve `{ offer }` si ha cambiado (null = ya no tiene) o null. */
function hojaOferta(item) {
  const S = SP();
  return new Promise((resolve) => {
    const d = $('#modal');
    d.innerHTML = `<form method="dialog"><h2>${esc(S.offerFor)}</h2>
      <p class="muted" style="margin:0">${esc(`${item.title} · ${KEp.cuandoCorto(item, TZ, I18N.lang)}`)}</p>
      <div class="pt-hoja">
        <button type="button" class="btn primary" data-op="crear">${esc(S.createOffer)}</button>
        <button type="button" class="btn" data-op="usar">${esc(S.useOffer)}</button>
        ${item.offer ? `<button type="button" class="btn" data-op="quitar">${esc(S.removeOffer)}</button>` : ''}
      </div>
      <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(I18N.t('Cancelar'))}</button></div></form>`;
    let hecho = false;
    const fin = (v) => { if (hecho) return; hecho = true; if (d.open) d.close(); resolve(v); };
    $('[data-cancel]', d).onclick = () => fin(null);
    d.oncancel = (e) => { e.preventDefault(); fin(null); };
    $$('[data-op]', d).forEach((b) => {
      b.onclick = async () => {
        const op = b.dataset.op;
        if (op === 'crear') {
          fin(null);
          location.hash = `#/publicaciones/nueva-flash?partido=${encodeURIComponent(item.id)}`;
          return;
        }
        if (op === 'quitar') {
          fin(await ponOferta(item.id, null) ? { offer: null } : null);
          return;
        }
        // «Usar una que ya tienes»: las publicaciones en borrador, activas o
        // agotadas (no las de RRPP), como dice la base.
        d.close();
        let lista = [];
        try { lista = (await rpc('my_business_offers', { p_id: BIZ.id })) || []; } catch (e) { toast(e.message, true); fin(null); return; }
        const sirven = lista.filter((o) => ['draft', 'active', 'sold_out'].includes(o.status) && o.audience !== 'promoters');
        if (!sirven.length) {
          toast(bi('No tienes publicaciones en borrador ni activas. Crea una para el partido.', "You don't have any draft or live publications. Create one for the match."), true);
          fin(null);
          return;
        }
        const r = await modal({
          title: S.useOffer,
          fields: [{ name: 'oferta', type: 'select', label: S.offerFor, value: item.offer?.id || sirven[0].id,
            options: sirven.map((o) => [o.id, `${o.title} · ${I18N.t(LABELS[o.status] || o.status)}`]) }],
          submit: S.useOffer,
        });
        if (!r?.oferta) { fin(null); return; }
        const o = sirven.find((x) => x.id === r.oferta);
        fin(await ponOferta(item.id, r.oferta) ? { offer: { id: o.id, title: o.title, status: o.status } } : null);
      };
    });
    d.showModal();
  });
}

/** Une (o quita, con null) la oferta al partido; también lo marca. */
async function ponOferta(partido, oferta) {
  try {
    const r = await rpc('set_business_broadcast_offer', { p_business: BIZ.id, p_broadcast: partido, p_offer: oferta });
    if (r && r.ok === false) { toast(friendly(r.error), true); return false; }
    toast(bi('Guardado', 'Saved'));
    return true;
  } catch (e) { toast(e.message, true); return false; }
}

/** «Añadir otro»: algo que no está en la lista («Partido del CD Pueblo»). */
async function nuevoPartido(v) {
  const S = SP();
  const lang = I18N.lang;
  if (!gestiona()) { location.replace('#/partidos'); return; }
  const min = KZ.aInput(new Date(Date.now() - 36e5).toISOString(), TZ);
  const max = KZ.aInput(new Date(Date.now() + 60 * 864e5).toISOString(), TZ);
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/partidos">← Volver</a><h1>${esc(S.addAnother)}</h1></div>
    <form class="card form pt-nuevo" id="ptNuevo" novalidate>
      <label class="f"><span>${esc(S.sport)}</span><select name="sport">${KEp.DEPORTES.map((s) => `<option value="${s}">${esc(KEp.deporte(s, lang))}</option>`).join('')}</select></label>
      <label class="f"><span>${esc(S.what)}</span><input name="title" maxlength="90" autocomplete="off" required><small class="hint">${esc(S.whatHelp)}</small><small class="hint err-txt" data-err="title" hidden></small></label>
      <label class="f"><span>${esc(S.competitionOpt)}</span><input name="competition" maxlength="60" autocomplete="off"></label>
      <label class="f"><span>${esc(S.dayTime)}</span><input name="when" type="datetime-local" min="${esc(min)}" max="${esc(max)}" required><small class="hint err-txt" data-err="when" hidden></small></label>
      <p class="hint err-txt" id="ptErr" hidden></p>
      <button class="btn primary grande" type="submit">${esc(S.add)}</button>
    </form>`;
  const f = $('#ptNuevo', v);
  const marca = (campo, msg) => {
    const el = $(`[data-err="${campo}"]`, f);
    el.textContent = msg || '';
    el.hidden = !msg;
    f.elements[campo === 'when' ? 'when' : 'title'].setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) f.elements[campo === 'when' ? 'when' : 'title'].focus();
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    marca('title', ''); marca('when', ''); $('#ptErr', f).hidden = true;
    const titulo = String(f.elements.title.value || '').replace(/\s+/g, ' ').trim();
    const cuando = KZ.deInput(f.elements.when.value, TZ);
    if (titulo.length < 3 || titulo.length > 90) { marca('title', S.errTitle); return; }
    const t0 = cuando ? new Date(cuando).getTime() : NaN;
    if (!Number.isFinite(t0) || t0 < Date.now() - 36e5 || t0 > Date.now() + 60 * 864e5) { marca('when', S.errDate); return; }
    try {
      const r = await rpc('add_business_broadcast', {
        p_business: BIZ.id, p_sport: f.elements.sport.value, p_starts_at: cuando,
        p_title: titulo, p_competition: String(f.elements.competition.value || '').trim() || null,
      });
      if (!r || r.ok === false) {
        const code = r?.error || '';
        if (code === 'title_invalid' || code === 'offensive_name') marca('title', errorPartido(code));
        else if (code === 'date_invalid') marca('when', errorPartido(code));
        else { $('#ptErr', f).textContent = errorPartido(code); $('#ptErr', f).hidden = false; }
        return;
      }
      toast(r.existing ? S.existing : S.added);
      // A la semana en la que cae.
      PT.semana = KZ.dia(cuando, TZ) >= KZ.hoy(TZ, 7) ? 1 : 0;
      PT.q = ''; PT.deporte = '';
      location.hash = '#/partidos';
    } catch (err) { $('#ptErr', f).textContent = err.message; $('#ptErr', f).hidden = false; }
  };
}
