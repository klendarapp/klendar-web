/* Panel del negocio: Encargos (migraciones 20261284000000 y …010 de la app).
 * Lo mismo que «Encargos» en «Mi negocio» de la app.
 *
 * - #/encargos: los encargos de un día, con la fila de días que tienen
 *   alguno. Todo el equipo: Aceptar, Rechazar (con motivo), Listo (avisa al
 *   cliente), Recogido y No vino; llamar o escribir con `contact_details`.
 * - #/encargos-cosas: «Lo que se encarga» y su formulario (foto, nombre,
 *   descripción, precio orientativo, alérgenos —obligatorios en comida—,
 *   opciones, antelación, días y franjas o fechas, máximo por día, plazo
 *   para anular, +18; pausar y quitar). Propietario y encargado.
 * - En «Más herramientas», la tarjeta (panel/herramientas.js).
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `esc`, `bi`,
 * `toast`, `modal`, `confirmDlg`, `friendly`, `KFotos`, `BUCKET`). Comparten
 * ámbito: los nombres de aquí empiezan por `enc`.
 */
'use strict';

// Icono (shopping_basket): no está en la fuente recortada del panel.
Object.assign(SVG, {
  encargo: 'M22 9h-4.79l-4.38-6.56a1 1 0 0 0-1.66 0L6.79 9H2a1 1 0 0 0-.96 1.27l2.54 9.27A2 2 0 0 0 5.5 21h13a2 2 0 0 0 1.93-1.46l2.54-9.27L23 10a1 1 0 0 0-1-1zM12 4.8 14.8 9H9.2L12 4.8zM18.5 19l-12.99.01L3.31 11H20.7l-2.2 8zM12 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
});

const ENC_ERR = {
  not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
  already_done: 'Ese encargo ya ha cambiado. Te enseñamos cómo está.',
  not_found: 'Ese encargo ya ha cambiado. Te enseñamos cómo está.',
  not_yet: 'Aún no es la hora de recogida: «No vino» se puede marcar desde que empieza su franja.',
  reason_required: 'Escribe el motivo: se lo decimos al cliente.',
  off: 'Encargos aún no está disponible.',
  bad_schedule: 'Elige al menos un día con su franja de recogida (y, en fechas, el primer y el último día).',
  bad_options: 'Cada opción necesita un nombre y al menos dos valores distintos, separados por comas.',
  bad_name: 'Pon un nombre (de 2 a 80 letras).',
  bad_price: 'Revisa los números: el precio y el máximo por día.',
  bad_number: 'Revisa los números: el precio y el máximo por día.',
  too_many: 'Has llegado al máximo de 50.',
  allergens_required: 'Marca sus alérgenos o «Sin alérgenos de la lista».',
  bad_allergens: 'Marca sus alérgenos o «Sin alérgenos de la lista».',
};
const encError = (code) => I18N.t(ENC_ERR[code] || friendly(code));
async function encRpc(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw Object.assign(new Error(encError(r.error)), { clave: r.error });
  return r;
}
const ENC_ALERGENOS = [
  ['gluten', 'Cereales que contienen gluten', 'Cereals containing gluten'],
  ['crustaceos', 'Crustáceos', 'Crustaceans'],
  ['huevos', 'Huevos', 'Eggs'],
  ['pescado', 'Pescado', 'Fish'],
  ['cacahuetes', 'Cacahuetes', 'Peanuts'],
  ['soja', 'Soja', 'Soybeans'],
  ['lacteos', 'Leche (incluida la lactosa)', 'Milk (including lactose)'],
  ['frutos_cascara', 'Frutos de cáscara', 'Nuts'],
  ['apio', 'Apio', 'Celery'],
  ['mostaza', 'Mostaza', 'Mustard'],
  ['sesamo', 'Granos de sésamo', 'Sesame seeds'],
  ['sulfitos', 'Dióxido de azufre y sulfitos', 'Sulphur dioxide and sulphites'],
  ['altramuces', 'Altramuces', 'Lupin'],
  ['moluscos', 'Moluscos', 'Molluscs'],
];
const ENC_ESTADO = {
  pending: ['Por aceptar', 'To accept'], accepted: ['Aceptado', 'Accepted'], ready: ['Listo para recoger', 'Ready to pick up'],
  picked_up: ['Recogido', 'Picked up'], no_show: ['No vino', 'Didn’t come'], rejected: ['Rechazado', 'Declined'],
  cancelled: ['Anulado por el cliente', 'Cancelled by the customer'], closed: ['Cancelado por cierre', 'Cancelled: closed'],
  expired: ['Sin confirmar', 'Not confirmed'],
};
const encEstado = (s) => bi(...(ENC_ESTADO[s] || ENC_ESTADO.pending));
const encQue = (o) => (o.quantity > 1 ? `${o.quantity} × ${o.item_name}` : o.item_name);
const encDia = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short' });
const encVivo = (s) => ['pending', 'accepted', 'ready'].includes(s);
const ENC_DIAS = [[1, 'Lunes', 'Monday'], [2, 'Martes', 'Tuesday'], [3, 'Miércoles', 'Wednesday'], [4, 'Jueves', 'Thursday'],
  [5, 'Viernes', 'Friday'], [6, 'Sábado', 'Saturday'], [7, 'Domingo', 'Sunday']];

PAGES.encargos = async (v) => {
  const dia = new URLSearchParams(location.hash.split('?')[1] || '').get('day');
  const d = await encRpc('business_preorders', { p_business: BIZ.id, ...(dia ? { p_day: dia } : {}) });
  const fila = (o) => {
    const quien = o.name || bi('Sin nombre', 'No name');
    const btn = (accion, es, en, clase = 'btn sm') => `<button type="button" class="${clase}" data-enc="${accion}" data-id="${esc(o.id)}">${esc(bi(es, en))}</button>`;
    const acciones = !encVivo(o.status) ? '' : [
      o.status === 'pending' ? btn('accept', 'Aceptar', 'Accept') : '',
      o.status !== 'ready' ? btn('ready', 'Listo', 'Ready') : '',
      btn('picked_up', 'Recogido', 'Picked up'),
      btn('no_show', 'No vino', 'Didn’t come'),
      btn('reject', 'Rechazar', 'Decline', 'btn sm ghost bad'),
    ].join(' ');
    const c = o.contact || {};
    return `<div class="card enc-fila">
      <p><b>${esc(encQue(o))}</b> · ${esc(encEstado(o.status))}</p>
      ${(o.options || []).length ? `<p>${esc(o.options.map((x) => `${x.group}: ${x.value}`).join(' · '))}</p>` : ''}
      <p class="muted">${esc(o.slot_start)}–${esc(o.slot_end)} · ${esc(quien)}</p>
      ${o.note ? `<p><i>${esc(bi('Nota:', 'Note:'))} ${esc(o.note)}</i></p>` : ''}
      ${o.status === 'rejected' && o.reject_reason ? `<p class="muted">${esc(o.reject_reason)}</p>` : ''}
      <p>${acciones}
        ${c.phone ? `<a class="btn sm ghost" href="tel:${esc(String(c.phone).replace(/\s/g, ''))}">${esc(bi(`Llamar a ${quien}`, `Call ${quien}`))}</a>` : ''}
        ${c.email ? `<a class="btn sm ghost" href="mailto:${esc(c.email)}">${esc(bi(`Escribir a ${quien}`, `Email ${quien}`))}</a>` : ''}</p>
    </div>`;
  };
  const dias = [...new Set([d.today, d.day, ...(d.days || []).map((x) => x.day)])].sort();
  const cuenta = Object.fromEntries((d.days || []).map((x) => [x.day, x.orders]));
  const vivos = (d.orders || []).filter((o) => encVivo(o.status));
  const hechos = (d.orders || []).filter((o) => !encVivo(o.status));
  v.innerHTML = `<div class="page-head"><h1>${esc(bi('Encargos', 'Pre-orders'))}</h1>
      <a class="btn" href="#/encargos-cosas">${esc(bi('Lo que se encarga', 'What can be pre-ordered'))}</a></div>
    ${!d.enabled ? `<p class="muted">${esc(I18N.t('Encargos aún no está disponible.'))}</p>` : ''}
    ${d.pending > 0 ? `<p><b>${esc(bi(`${d.pending} por aceptar`, `${d.pending} to accept`))}</b></p>` : ''}
    ${d.blocked ? `<p class="card">${esc(I18N.t('Mientras tu negocio esté bloqueado por el pago, no recibe encargos nuevos. Los que ya tienes siguen aquí.'))}</p>` : ''}
    <p class="chips">${dias.map((x) => `<a class="pill${x === d.day ? ' sel' : ''}" href="#/encargos?day=${esc(x)}" ${x === d.day ? 'aria-current="true"' : ''}>${esc(x === d.today ? bi('Hoy', 'Today') : encDia(x))}${cuenta[x] ? ` · ${cuenta[x]}` : ''}</a>`).join(' ')}
      <label class="pill"><input type="date" id="encOtroDia" value="${esc(d.day)}" aria-label="${esc(bi('Otro día', 'Another day'))}"></label></p>
    ${!(d.orders || []).length ? `<p class="muted">${esc(bi('No hay encargos para este día.', 'No pre-orders for this day.'))}</p>` : ''}
    ${vivos.map(fila).join('')}
    ${hechos.length ? `<details><summary>${esc(bi(`Terminados (${hechos.length})`, `Finished (${hechos.length})`))}</summary>${hechos.map(fila).join('')}</details>` : ''}
    ${(d.orders || []).some((o) => o.contact) ? `<p class="muted">${esc(I18N.t('Úsalos solo para avisar de este encargo. Se dejan de ver 7 días después de la recogida.'))}</p>` : ''}
    <p class="muted">${esc(I18N.t('El cliente lo paga en tu local al recogerlo. El encargo es entre tu negocio y el cliente: Klendar no cobra ni interviene.'))}</p>`;
  $('#encOtroDia', v)?.addEventListener('change', (e) => { if (e.target.value) location.hash = `#/encargos?day=${e.target.value}`; });
  v.querySelectorAll('[data-enc]').forEach((b) => {
    b.onclick = async () => {
      const accion = b.dataset.enc;
      let motivo = null;
      if (accion === 'reject') {
        const r = await modal({ title: bi('¿Por qué lo rechazas?', 'Why are you declining it?'),
          intro: esc(I18N.t('Escribe el motivo: se lo decimos al cliente.')),
          fields: [{ name: 'motivo', type: 'textarea', label: bi('Motivo', 'Reason'), required: true, maxlength: 200, rows: 3,
            placeholder: bi('Ej.: Ese día no tenemos horno', 'E.g. Our oven is off that day') }],
          submit: bi('Rechazar', 'Decline'), danger: true });
        if (!r) return;
        motivo = r.motivo;
      }
      if (accion === 'no_show' && !(await confirmDlg(bi('¿No vino a recogerlo?', 'They didn’t come to pick it up?'),
        esc(I18N.t('Queda como «No vino» en tus cifras. Si viene más tarde, valida su QR igualmente.')), { submit: bi('No vino', 'Didn’t come') }))) return;
      b.disabled = true;
      try {
        await encRpc('preorder_action', { p_id: b.dataset.id, p_action: accion, p_reason: motivo });
        if (accion === 'ready') toast(bi('Le hemos dicho que ya puede recogerlo.', 'We’ve told them they can pick it up now.'));
        if (accion === 'accept') toast(bi('Aceptado. Se lo hemos dicho al cliente.', 'Accepted. We’ve told the customer.'));
      } catch (e) { toast(e.message, true); }
      PAGES.encargos(v);
    };
  });
};

async function encSubeFoto(file) {
  const f = await KFotos.reduce(file, KFotos.TAM.foto);
  if (f.size > 5 * 1024 * 1024) { toast(bi('Esa foto pesa más de 5 MB.', 'That photo is over 5 MB.'), true); return null; }
  const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${BIZ.id}/encargos/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
  if (error) { toast(friendly(error.message), true); return null; }
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

PAGES['encargos-cosas'] = async (v) => {
  const d = await encRpc('business_preorder_items', { p_business: BIZ.id });
  const s = d.stats || {};
  const linea = (x) => [bi(`${x?.orders || 0} encargos`, `${x?.orders || 0} pre-orders`), bi(`${x?.picked_up || 0} recogidos`, `${x?.picked_up || 0} picked up`),
    bi(`${x?.no_show || 0} no vinieron`, `${x?.no_show || 0} didn’t come`)].join(' · ');
  v.innerHTML = `<div class="page-head"><h1>${esc(bi('Lo que se encarga', 'What can be pre-ordered'))}</h1>
      <a class="btn" href="#/encargos">${esc(bi('Encargos', 'Pre-orders'))}</a></div>
    <p class="muted">${esc(I18N.t('Lo que tus clientes pueden encargarte desde tu ficha para recogerlo aquí. Pagan al recogerlo.'))}</p>
    ${!d.enabled ? `<p>${esc(I18N.t('Encargos aún no está disponible.'))}</p>` : ''}
    ${s.all?.orders ? `<p><b>${esc(bi('Últimos 30 días:', 'Last 30 days:'))}</b> ${esc(linea(s.d30))}</p>` : ''}
    ${(d.items || []).map((i) => `<div class="card"><p><b>${esc(i.name)}</b> · ${esc(i.status === 'paused' ? bi('En pausa', 'Paused') : bi('Activo', 'Active'))}${i.upcoming ? ` · ${esc(bi(`${i.upcoming} por recoger`, `${i.upcoming} to pick up`))}` : ''}</p>
      ${d.can_edit ? `<p><button type="button" class="btn sm" data-editar="${esc(i.id)}">${esc(bi('Editar', 'Edit'))}</button>
        <button type="button" class="btn sm ghost" data-estado="${i.status === 'paused' ? 'active' : 'paused'}" data-id="${esc(i.id)}">${esc(i.status === 'paused' ? bi('Volver a activar', 'Turn back on') : bi('Pausar', 'Pause'))}</button>
        <button type="button" class="btn sm ghost bad" data-estado="deleted" data-id="${esc(i.id)}">${esc(bi('Quitar', 'Remove'))}</button></p>` : ''}</div>`).join('')}
    ${!(d.items || []).length ? `<p class="muted">${esc(d.can_edit ? I18N.t('Aún no hay nada para encargar. Añade lo primero: una tarta, una bandeja, un ramo…') : I18N.t('Aún no hay nada para encargar. Lo añade el propietario o un encargado.'))}</p>` : ''}
    ${d.can_edit && d.enabled ? `<p><button type="button" class="btn primary principal" id="encNuevo">${esc(bi('Añadir algo para encargar', 'Add something to pre-order'))}</button></p>` : ''}
    <div id="encForm"></div>`;
  v.querySelectorAll('[data-estado]').forEach((b) => {
    b.onclick = async () => {
      if (b.dataset.estado === 'deleted' && !(await confirmDlg(bi('¿Quitar de Encargos?', 'Remove from Pre-orders?'),
        esc(I18N.t('Deja de salir en tu ficha. Los encargos que ya tienes siguen igual.')), { submit: bi('Quitar', 'Remove'), danger: true }))) return;
      try { await encRpc('set_preorder_item_status', { p_id: b.dataset.id, p_status: b.dataset.estado }); } catch (e) { toast(e.message, true); }
      PAGES['encargos-cosas'](v);
    };
  });
  const abre = (i) => encFormulario($('#encForm', v), d, i, () => PAGES['encargos-cosas'](v));
  $('#encNuevo', v)?.addEventListener('click', () => abre(null));
  v.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => abre(d.items.find((x) => x.id === b.dataset.editar)); });
};

function encFormulario(caja, d, i, hecho) {
  const sch = i?.schedule || { mode: 'week', week: { 2: [['09:00', '14:00']], 3: [['09:00', '14:00']], 4: [['09:00', '14:00']], 5: [['09:00', '14:00']], 6: [['09:00', '14:00']] } };
  const franjas = (l) => (l || []).map((x) => `${x[0]}-${x[1]}`).join(', ');
  let foto = i?.photo_url || null;
  const sel = (name, ops, val) => `<select name="${name}">${ops.map(([k, t]) => `<option value="${k}" ${String(k) === String(val) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const horas = (h, lead) => (h === 0 ? (lead ? bi('Sin antelación', 'No notice needed') : bi('Hasta la hora de recogida', 'Up to pick-up time'))
    : h % 24 === 0 ? (lead ? bi(`${h / 24} día(s) antes`, `${h / 24} day(s) before`) : bi(`Hasta ${h / 24} día(s) antes`, `Up to ${h / 24} day(s) before`))
      : (lead ? bi(`${h} horas antes`, `${h} hours before`) : bi(`Hasta ${h} horas antes`, `Up to ${h} hours before`)));
  caja.innerHTML = `<form class="card" id="encF">
    <h2>${esc(i ? bi('Editar', 'Edit') : bi('Algo para encargar', 'Something to pre-order'))}</h2>
    <p>${foto ? `<img src="${esc(foto)}" alt="" style="max-width:120px;border-radius:12px">` : ''}
      <label class="btn sm">${esc(bi('Añadir foto', 'Add photo'))}<input type="file" accept="image/*" id="encFoto" hidden></label></p>
    <label class="f"><span>${esc(bi('Nombre', 'Name'))}</span><input name="name" required maxlength="80" value="${esc(i?.name || '')}" placeholder="${esc(bi('Ej.: Tarta de fresas', 'E.g. Strawberry cake'))}"></label>
    <label class="f"><span>${esc(bi('Descripción (opcional)', 'Description (optional)'))}</span><textarea name="description" maxlength="500" rows="3">${esc(i?.description || '')}</textarea></label>
    <label class="f"><span>${esc(bi('Precio orientativo (opcional)', 'Approximate price (optional)'))}</span><input name="price" inputmode="decimal" value="${i?.price_from_cents == null ? '' : (i.price_from_cents / 100).toString().replace('.', ',')}"></label>
    <fieldset><legend>${esc(d.food ? bi('Alérgenos', 'Allergens') : bi('Alérgenos (opcional)', 'Allergens (optional)'))}</legend>
      <p class="muted">${esc(I18N.t('Marca los que lleva (Reglamento (UE) 1169/2011). Se enseñan antes de encargar.'))}</p>
      ${ENC_ALERGENOS.map(([k, es, en]) => `<label><input type="checkbox" name="al" value="${k}" ${(i?.allergens || []).includes(k) ? 'checked' : ''}> ${esc(bi(es, en))}</label>`).join('<br>')}
      <br><label><input type="checkbox" name="al_none" ${i?.allergens_none ? 'checked' : ''}> ${esc(bi('Sin alérgenos de la lista', 'None of the listed allergens'))}</label></fieldset>
    <label class="f"><span>${esc(bi('Opciones (opcional)', 'Options (optional)'))}</span><textarea name="options" rows="3" placeholder="${esc(bi('Tamaño: Pequeño, Mediano, Grande', 'Size: Small, Medium, Large'))}">${esc((i?.options || []).map((g) => `${g.name}: ${g.values.join(', ')}`).join('\n'))}</textarea>
      <small class="muted">${esc(bi('Una por línea: «Nombre: valor, valor». Hasta 4.', 'One per line: “Name: value, value”. Up to 4.'))}</small></label>
    <label class="f"><span>${esc(bi('Antelación mínima', 'Minimum notice'))}</span>${sel('lead', [0, 2, 4, 12, 24, 48, 72, 168].map((h) => [h, horas(h, true)]), i?.lead_hours ?? 24)}</label>
    <label class="f"><span>${esc(bi('Días y horas de recogida', 'Pick-up days and times'))}</span>${sel('mode', [['week', bi('Días de la semana', 'Days of the week')], ['dates', bi('Fechas', 'Dates')]], sch.mode)}</label>
    <div id="encSemana">${ENC_DIAS.map(([n, es, en]) => `<label class="f"><span>${esc(bi(es, en))}</span><input name="w${n}" value="${esc(franjas(sch.week?.[n]))}" placeholder="09:00-14:00, 17:00-20:00"></label>`).join('')}</div>
    <div id="encFechas"><label class="f"><span>${esc(bi('Desde', 'From'))}</span><input type="date" name="from" value="${esc(sch.from || '')}"></label>
      <label class="f"><span>${esc(bi('Hasta', 'To'))}</span><input type="date" name="to" value="${esc(sch.to || '')}"></label>
      <label class="f"><span>${esc(bi('Franjas de cada día', 'Time slots each day'))}</span><input name="slots" value="${esc(franjas(sch.slots))}" placeholder="10:00-14:00"></label></div>
    <label class="f"><span>${esc(bi('Máximo por día (opcional)', 'Daily maximum (optional)'))}</span><input name="max" type="number" min="1" max="999" value="${i?.daily_max ?? ''}"></label>
    <label class="f"><span>${esc(bi('Plazo para anular', 'Cancellation deadline'))}</span>${sel('cancel', [0, 2, 12, 24, 48].map((h) => [h, horas(h, false)]), i?.cancel_hours ?? 24)}</label>
    <label><input type="checkbox" name="adults" ${i?.adults_only ? 'checked' : ''}> ${esc(bi('Solo mayores de 18', 'Over-18s only'))}</label>
    <div class="foot"><button type="submit" class="btn primary principal">${esc(i ? bi('Guardar', 'Save') : bi('Crear', 'Create'))}</button></div></form>`;
  const f = $('#encF', caja);
  const modo = () => { const w = f.elements.mode.value === 'week'; $('#encSemana', caja).hidden = !w; $('#encFechas', caja).hidden = w; };
  f.elements.mode.onchange = modo; modo();
  f.querySelectorAll('[name="al"]').forEach((c) => { c.onchange = () => { if (c.checked) f.elements.al_none.checked = false; }; });
  f.elements.al_none.onchange = () => { if (f.elements.al_none.checked) f.querySelectorAll('[name="al"]').forEach((c) => { c.checked = false; }); };
  $('#encFoto', caja).onchange = async (e) => { const fl = e.target.files?.[0]; if (fl) { foto = (await encSubeFoto(fl)) || foto; toast(bi('Foto lista', 'Photo ready')); } };
  const lee = (txt) => String(txt || '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.split('-').map((y) => y.trim()));
  caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fe = f.elements;
    const precio = fe.price.value.trim() ? Math.round(Number(fe.price.value.replace(',', '.')) * 100) : null;
    const opciones = fe.options.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [n, ...r] = l.split(':');
      return { name: n.trim(), values: r.join(':').split(',').map((x) => x.trim()).filter(Boolean) };
    });
    const schedule = fe.mode.value === 'week'
      ? { mode: 'week', week: Object.fromEntries(ENC_DIAS.map(([n]) => [n, lee(fe[`w${n}`].value)]).filter(([, l]) => l.length)) }
      : { mode: 'dates', from: fe.from.value, to: fe.to.value, slots: lee(fe.slots.value) };
    const p = {
      name: fe.name.value, description: fe.description.value, photo_url: foto, price_from_cents: Number.isFinite(precio) ? precio : -1,
      options: opciones, lead_hours: Number(fe.lead.value), schedule, daily_max: fe.max.value ? Number(fe.max.value) : null,
      cancel_hours: Number(fe.cancel.value), adults_only: fe.adults.checked,
      allergens: [...f.querySelectorAll('[name="al"]:checked')].map((c) => c.value), allergens_none: fe.al_none.checked,
    };
    try {
      await encRpc('save_preorder_item', { p_business: BIZ.id, p_id: i?.id || null, p });
      toast(i ? bi('Guardado.', 'Saved.') : bi('Creado.', 'Created.'));
      hecho();
    } catch (err) { toast(err.message, true); }
  };
}
