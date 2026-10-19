/* «Qué pedir aquí», momentos del día y festivos en el panel (migraciones
 * 20261233100000–03 de la app), como la app:
 *
 *   · `#/ficha/que-pedir`: 2 o 3 cosas estrella con una línea y una foto
 *     opcionales; con carta, se pueden elegir de ella
 *     (`set_business_highlights`).
 *   · «Cómo es tu local»: los momentos del día (`set_business_moments`), en
 *     ficha.js con `pedMomentosHtml`.
 *   · «Días cerrados» (`#/cerrados`): debajo, «Días con otro horario»
 *     (`save_business_day_hours`, `delete_business_day_hours`).
 *   · El resumen: «¿Abres el 1 de noviembre?» con «Horario normal», «Otro
 *     horario» y «Cerrado» (`business_holiday_questions`, `answer_holiday`).
 *     `#/festivo/<día>` desde el aviso.
 *
 * Comparte ámbito con panel.js: nombres que empiezan por `ped`. */
'use strict';

const pedMom = () => globalThis.KlendarMomentos;

/** Los momentos del día en «Cómo es tu local». */
function pedMomentosHtml(marcados) {
  const KMO = pedMom();
  if (!KMO) return '';
  const sel = Array.isArray(marcados) ? marcados : [];
  return `<div class="full"><h3 class="f-tit" id="momentosTit" style="margin:4px 0 4px">${esc(I18N.t('Momentos del día'))}</h3>
    <p class="muted" style="margin:0 0 10px">${esc(I18N.t('Para cuándo es tu sitio. La gente lo encuentra con «Para ahora» en los filtros.'))}</p>
    <div class="sitio-ops" role="group" aria-labelledby="momentosTit">
      ${KMO.MOMENTOS.map((m) => `<label class="sitio-op"><input type="checkbox" name="momento" value="${m.id}" ${sel.includes(m.id) ? 'checked' : ''}><span>${esc(KMO.nombre(m.id, I18N.lang))}</span></label>`).join('')}
    </div></div>`;
}

/** Los marcados, en el orden del día. */
const pedMomentosDe = (caja) => {
  const KMO = pedMom();
  const marc = $$('[name=momento]:checked', caja).map((c) => c.value);
  return KMO ? KMO.MOMENTOS.map((m) => m.id).filter((id) => marc.includes(id)) : marc;
};

// ── Qué pedir aquí ──────────────────────────────────────────────────────────
const PED_ERR = {
  too_many: 'Como mucho 3.',
  duplicate: 'Hay dos con el mismo nombre.',
  title_length: 'Pon un nombre de 2 a 60 caracteres.',
  note_length: 'La línea, de 2 a 120 caracteres.',
  not_authorized: 'No tienes permiso para esto.',
};

async function pedQuePedir(v, carta) {
  const info = await rpc('business_ficha_info', { p_business: BIZ.id });
  const items = (info?.highlights || []).map((h) => ({ title: h.title || '', note: h.note || '', image_url: h.image_url || '', menu_item_id: h.menu_item_id || null }));
  if (!items.length) items.push({ title: '', note: '', image_url: '', menu_item_id: null });
  const platos = (carta || []).flatMap((s) => (s.items || []).map((it) => ({ ...it, seccion: s.name })));
  const valor = () => JSON.stringify(items);
  let inicial = '';

  const pinta = () => {
    v.innerHTML = `<p class="crumbs"><a href="#/ficha">← ${esc(I18N.t('Tu ficha'))}</a></p>
      <div class="page-head"><h1>${esc(I18N.t('Qué pedir aquí'))}</h1></div>
      <p class="muted" style="margin:0 0 12px">${esc(I18N.t('Las 2 o 3 cosas que no hay que perderse. Salen en tu ficha y la gente las encuentra al buscar («croquetas»), aunque no tengas planes publicados.'))}</p>
      <form id="qp" class="form ped-form" novalidate>
        ${items.map((it, i) => `<div class="card ped-cosa full" data-i="${i}" role="group" aria-labelledby="pedN${i}">
          <p class="ped-n full" id="pedN${i}">${esc(bi(`${i + 1} de 3`, `${i + 1} of 3`))}</p>
          <label class="f full"><span>${esc(I18N.t('Nombre'))}</span><input name="title" maxlength="60" value="${esc(it.title)}" placeholder="${esc(I18N.t('Croquetas de jamón'))}"></label>
          <label class="f full"><span>${esc(I18N.t('Una línea'))} <small>${esc(I18N.t('(opcional)'))}</small></span><input name="note" maxlength="120" value="${esc(it.note)}" placeholder="${esc(I18N.t('Las de la abuela, cremosas por dentro'))}"></label>
          <div class="ped-foto full">
            ${it.image_url ? `<img src="${esc(it.image_url)}" alt="" width="64" height="64">` : ''}
            <button type="button" class="btn sm" data-foto="${i}">${ms('photo_camera')}${esc(I18N.t(it.image_url ? 'Cambiar foto' : 'Añadir foto'))}</button>
            ${it.image_url ? `<button type="button" class="btn sm ghost" data-sin-foto="${i}">${esc(I18N.t('Quitar foto'))}</button>` : ''}
            ${platos.length ? `<button type="button" class="btn sm ghost" data-carta="${i}">${ms('restaurant_menu')}${esc(I18N.t('Elegir de la carta'))}</button>` : ''}
            <span class="spacer"></span>
            <button type="button" class="btn sm ghost" data-quitar="${i}">${ms('delete')}${esc(I18N.t('Quitar'))}</button>
          </div>
        </div>`).join('')}
        ${items.length < 3 ? `<div class="full"><button type="button" class="btn sm" data-otra>${esc(I18N.t('Añadir otra'))}</button></div>` : ''}
        <div class="full"><button class="btn primary" type="submit">Guardar</button> <span id="qpMsg" class="err"></span></div>
      </form>`;
    I18N.translate(v);
    const f = $('#qp', v);
    // Lo escrito se apunta al cambiar (para no perderlo al repintar).
    $$('[data-i]', f).forEach((fs) => {
      const it = items[+fs.dataset.i];
      fs.querySelector('[name=title]').oninput = (e) => { it.title = e.target.value; };
      fs.querySelector('[name=note]').oninput = (e) => { it.note = e.target.value; };
    });
    $$('[data-quitar]', f).forEach((b) => { b.onclick = () => {
      items.splice(+b.dataset.quitar, 1);
      if (!items.length) items.push({ title: '', note: '', image_url: '', menu_item_id: null });
      pinta();
    }; });
    $$('[data-sin-foto]', f).forEach((b) => { b.onclick = () => { items[+b.dataset.sinFoto].image_url = ''; pinta(); }; });
    const otra = $('[data-otra]', f);
    if (otra) otra.onclick = () => { items.push({ title: '', note: '', image_url: '', menu_item_id: null }); pinta(); };
    $$('[data-foto]', f).forEach((b) => { b.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const elegida = input.files?.[0];
        if (!elegida) return;
        b.disabled = true;
        try {
          const foto = await KFotos.reduce(elegida, KFotos.TAM.foto);
          if (foto.size > 5 * 1024 * 1024) { toast('Esa foto pesa más de 5 MB.', true); return; }
          const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `${BIZ.id}/highlights/${crypto.randomUUID()}.${ext}`;
          const { error } = await sb.storage.from(BUCKET).upload(path, foto, { contentType: foto.type });
          if (error) { toast(friendly(error.message), true); return; }
          items[+b.dataset.foto].image_url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
          pinta();
        } finally { b.disabled = false; }
      };
      input.click();
    }; });
    $$('[data-carta]', f).forEach((b) => { b.onclick = async () => {
      const i = +b.dataset.carta;
      const elegido = await pedEligePlato(platos);
      if (!elegido) return;
      Object.assign(items[i], {
        title: String(elegido.name || '').slice(0, 60),
        note: String(elegido.description || '').trim().slice(0, 120),
        image_url: elegido.image_url || items[i].image_url,
        menu_item_id: elegido.id || null,
      });
      pinta();
    }; });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const msg = $('#qpMsg', f);
      msg.textContent = '';
      const lista = items.map((it) => ({ ...it, title: it.title.trim(), note: it.note.trim() }))
        .filter((it) => it.title || it.note || it.image_url);
      const mala = lista.find((it) => it.title.length < 2);
      if (mala) { msg.textContent = I18N.t(PED_ERR.title_length); return; }
      if (lista.some((it) => it.note && it.note.length < 2)) { msg.textContent = I18N.t(PED_ERR.note_length); return; }
      const r = await rpc('set_business_highlights', {
        p_business: BIZ.id,
        p_items: lista.map((it) => ({ title: it.title, ...(it.note ? { note: it.note } : {}),
          ...(it.image_url ? { image_url: it.image_url } : {}), ...(it.menu_item_id ? { menu_item_id: it.menu_item_id } : {}) })),
      }).catch((err) => ({ ok: false, error: err.message }));
      if (!r?.ok) { msg.textContent = I18N.t(PED_ERR[r?.error] || 'No se ha podido guardar'); return; }
      inicial = valor();
      GUARDA = null;
      toast(r.review ? 'Guardado. Revisaremos un texto que puede no cumplir las Normas de la comunidad.' : 'Guardado');
      location.hash = '#/ficha';
    };
  };
  pinta();
  inicial = valor();
  GUARDA = { sucia: () => valor() !== inicial };
}

/** Elegir un plato de la carta (nombre, descripción y foto). */
async function pedEligePlato(platos) {
  const r = await modal({
    title: I18N.t('Elegir de la carta'),
    fields: [{ type: 'select', name: 'p', label: I18N.t('Plato'),
      options: platos.map((p, i) => [String(i), [p.name, p.seccion].filter(Boolean).join(' · ')]) }],
    submit: I18N.t('Elegir'),
  });
  return r ? platos[Number(r.p)] || null : null;
}

// ── Festivos: la pregunta ───────────────────────────────────────────────────
const pedDia = (iso) => new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const pedTramos = (t) => (Array.isArray(t) ? t : []).filter((x) => Array.isArray(x)).map((x) => `${x[0]}–${x[1]}`).join(', ');
const PED_ERR_DIA = {
  invalid_hours: 'Pon una hora de abrir y otra de cerrar distintas.',
  closed_that_day: 'Ese día ya está en tus días cerrados.',
  in_the_past: 'Esas fechas ya han pasado.',
  too_far: 'Como mucho, a un año vista.',
  too_many: 'Ya tienes 24 días con otro horario por delante. Quita alguno antes.',
  not_a_holiday: 'Ese día ya no tiene nada que contestar.',
  not_authorized: 'No tienes permiso para esto.',
};

/** La tarjeta «¿Abres el 1 de noviembre?» con sus tres respuestas. */
function pedTarjetaFestivo(q, alContestar) {
  const caja = document.createElement('div');
  caja.className = 'card ped-festivo';
  const faltan = q.days_left === 0 ? bi('Es hoy', "It's today") : q.days_left === 1 ? bi('Es mañana', "It's tomorrow")
    : bi(`Faltan ${q.days_left} días`, `In ${q.days_left} days`);
  const normal = pedTramos(q.usual_hours);
  caja.innerHTML = `<h2 style="margin:0">${ms('event')} ${esc(bi(`¿Abres el ${pedDia(q.day)}?`, `Are you open on ${pedDia(q.day)}?`))}</h2>
    <p class="muted" style="margin:4px 0 0">${esc([q.name, faltan].filter(Boolean).join(' · '))}</p>
    <p class="muted" style="margin:4px 0 10px">${esc(I18N.t('Es festivo. Lo verá la gente en tu ficha; si no contestas, dirá «horario sin confirmar».'))}</p>
    <div class="ped-tres">
      <button type="button" class="btn" data-r="normal">${esc(normal ? bi(`Horario normal (${normal})`, `Usual hours (${normal})`) : I18N.t('Horario normal'))}</button>
      <button type="button" class="btn" data-r="other">${esc(I18N.t('Otro horario'))}</button>
      <button type="button" class="btn" data-r="closed">${esc(I18N.t('Cerrado'))}</button>
    </div>
    <form class="form ped-otro" hidden>
      <label class="f"><span>${esc(I18N.t('Abre'))}</span><input type="time" name="from" required value="${esc((q.usual_hours?.[0] || [])[0] || '10:00')}"></label>
      <label class="f"><span>${esc(I18N.t('Cierra'))}</span><input type="time" name="to" required value="${esc((q.usual_hours?.[0] || [])[1] || '14:00')}"></label>
      <div class="full"><button class="btn primary" type="submit">Guardar</button> <span class="err" data-msg></span></div>
    </form>`;
  const responde = async (answer, horas) => {
    const r = await rpc('answer_holiday', { p_business: BIZ.id, p_day: q.day, p_answer: answer, ...(horas ? { p_hours: horas } : {}) })
      .catch((err) => ({ ok: false, error: err.message }));
    if (!r?.ok) { toast(I18N.t(PED_ERR_DIA[r?.error] || ERR_CIERRE?.[r?.error] || 'No se ha podido guardar'), true); return; }
    toast('Hecho. Ya sale en tu ficha.');
    alContestar();
  };
  $$('[data-r]', caja).forEach((b) => { b.onclick = () => {
    if (b.dataset.r === 'other') { $('.ped-otro', caja).hidden = false; $('[name=from]', caja).focus(); return; }
    responde(b.dataset.r);
  }; });
  $('.ped-otro', caja).onsubmit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (!d.from || !d.to || d.from === d.to) { $('[data-msg]', caja).textContent = I18N.t(PED_ERR_DIA.invalid_hours); return; }
    responde('other', [[d.from, d.to]]);
  };
  I18N.translate(caja);
  return caja;
}

/** En el resumen, si no hay otro aviso: el festivo de esta semana. */
async function pedFestivo(caja) {
  if (!caja || !gestiona() || esOrganizador()) return;
  const lista = await rpc('business_holiday_questions', { p_business: BIZ.id }).catch(() => null);
  const q = Array.isArray(lista) ? lista[0] : null;
  if (!q) { caja.replaceChildren(); return; }
  caja.replaceChildren(pedTarjetaFestivo(q, () => pedFestivo(caja)));
}

/** `#/festivo/<día>`: desde el aviso. */
PAGES.festivo = async (v, dia) => {
  const lista = await rpc('business_holiday_questions', { p_business: BIZ.id }).catch(() => []);
  const q = (Array.isArray(lista) ? lista : []).find((x) => x.day === dia);
  v.innerHTML = `<div class="page-head"><h1>${esc(I18N.t('Festivo'))}</h1></div>`;
  if (q) {
    v.appendChild(pedTarjetaFestivo(q, () => { location.hash = '#/resumen'; }));
    return;
  }
  v.insertAdjacentHTML('beforeend', `<section class="vacio"><h2>${esc(I18N.t('Ya está contestado'))}</h2>
    <p class="muted">${esc(I18N.t('Puedes cambiarlo en «Días cerrados».'))}</p>
    <div class="vacio-botones"><a class="btn primary" href="#/cerrados">${esc(I18N.t('Días cerrados'))}</a></div></section>`);
};

// ── Días cerrados: «Días con otro horario» ──────────────────────────────────
{
  const original = PAGES.cerrados;
  PAGES.cerrados = async (v) => {
    await original(v);
    const lista = await rpc('business_special_days', { p_business: BIZ.id }).catch(() => []);
    const dias = Array.isArray(lista) ? lista : [];
    const hoy = hoyNegocio();
    const maxDia = new Date(Date.parse(`${hoy}T00:00:00Z`) + 366 * 864e5).toISOString().slice(0, 10);
    const largo = (iso) => new Intl.DateTimeFormat(LOC(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="card"><h2>${esc(I18N.t('Días con otro horario'))}</h2>
      <p class="muted" style="margin:0 0 10px">${esc(I18N.t('Un día concreto con otro horario: un festivo, Nochebuena… Ese día manda sobre tu horario de siempre.'))}</p>
      ${table({
    cols: [
      { h: 'Día', r: (d) => `<b class="title">${esc(largo(d.day))}</b>` },
      { h: 'Horario', r: (d) => esc([pedTramos(d.hours), d.holiday].filter(Boolean).join(' · ')) },
      ...(gestiona() ? [{ h: '', r: (d, i) => `<span class="actions"><button class="btn sm ghost" data-del-dia="${i}">${ms('delete')}Quitar</button></span>` }] : []),
    ],
    rows: dias,
    empty: 'No tienes días con otro horario por delante.',
  })}
      ${gestiona() ? `<form id="fOtro" class="form" style="margin-top:12px">
        <label class="f"><span>Día</span><input type="date" name="day" required min="${hoy}" max="${maxDia}"></label>
        <label class="f"><span>Abre</span><input type="time" name="from" required value="10:00"></label>
        <label class="f"><span>Cierra</span><input type="time" name="to" required value="14:00"></label>
        <div class="full"><button class="btn primary" type="submit">Abrir con otro horario</button> <span id="msgOtro" class="err"></span></div>
      </form>` : ''}</div>`;
    v.appendChild(caja);
    I18N.translate(caja);
    sinDobleEnvio(caja);
    $$('[data-del-dia]', caja).forEach((b) => { b.onclick = async () => {
      const d = dias[+b.dataset.delDia];
      if (!(await confirmDlg('¿Quitar este día?', I18N.t('Ese día vuelve a ir con tu horario de siempre.'), { submit: 'Quitar', danger: true }))) return;
      const r = await rpc('delete_business_day_hours', { p_id: d.id }).catch(() => null);
      if (!r?.ok) { toast(PED_ERR_DIA[r?.error] || 'No se ha podido guardar', true); return; }
      toast('Día con otro horario quitado'); route();
    }; });
    const f = $('#fOtro', caja);
    if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const msg = $('#msgOtro', f);
      msg.textContent = '';
      if (!d.day || d.day < hoy || d.day > maxDia) { msg.textContent = I18N.t('Elige días entre hoy y dentro de un año.'); return; }
      if (!d.from || !d.to || d.from === d.to) { msg.textContent = I18N.t(PED_ERR_DIA.invalid_hours); return; }
      const r = await rpc('save_business_day_hours', { p_business: BIZ.id, p_day: d.day, p_hours: [[d.from, d.to]] }).catch(() => null);
      if (!r?.ok) { msg.textContent = I18N.t(PED_ERR_DIA[r?.error] || 'No se ha podido guardar'); return; }
      toast('Día con otro horario guardado'); route();
    };
  };
}
