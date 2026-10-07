/* Panel del negocio: «Reservas de mesa» (tanda C, migración 20261207100000).
 * Lo mismo que «Reservas de mesa» en «Mi negocio» de la app.
 *
 * - Sin activar: qué es y «Activar las reservas de mesa» (propietario o
 *   encargado), que lleva a los ajustes.
 * - Ajustes (#/mesas/ajustes, gestión): aceptar o no, las horas a las que se
 *   puede reservar (el mismo editor que el horario de la ficha,
 *   `editorHorario` de ficha.js), grupo máximo, antelación mínima y tiempo
 *   para contestar.
 * - La lista: «Por contestar y próximas» (#/mesas) y «Pasadas»
 *   (#/mesas/pasadas). Por contestar: «Aceptar», «Otra hora» o «No puedo»
 *   (todo el equipo); las confirmadas por llegar se pueden anular.
 * - En el inicio del panel: «Cola virtual · N esperando» y «N peticiones de
 *   mesa por contestar · antes de las HH:MM» (`resumenColaMesas`).
 *
 * Va después de panel.js, ficha.js y cola.js y usa lo suyo (`PAGES`, `rpc`,
 * `BIZ`, `TZ`, `KZ`, `gestiona`, `esc`, `ms`, `bi`, `toast`, `modal`,
 * `confirmDlg`, `fmtHora`, `editorHorario`, `colaRpc`…). Comparten ámbito:
 * los nombres de aquí empiezan por `mesa`.
 */
'use strict';

const MESA_ERR = {
  not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
  bad_hours: 'Revisa las horas: hay algún tramo que no está bien.',
  no_hours: 'Pon al menos unas horas para reservar.',
  bad_max_party: 'El grupo máximo tiene que estar entre 1 y 50.',
  bad_notice: 'Elige la antelación mínima.',
  bad_reply: 'Elige el tiempo para contestar.',
  not_pending: 'Ya está contestada.',
  too_late: 'Ya ha pasado el plazo.',
  bad_time: 'Elige un día y una hora que aún no hayan pasado, distintos de los que pidieron.',
  too_long: 'El mensaje es demasiado largo: 200 caracteres como mucho.',
  not_live: 'Esta reserva ya no se puede anular.',
  not_found: 'Esa reserva ya no está.',
  rate_limited: 'Demasiados intentos. Espera un minuto.',
};
const mesaError = (code) => I18N.t(MESA_ERR[code] || friendly(code));
async function mesaRpc(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw Object.assign(new Error(mesaError(r.error)), { clave: r.error });
  return r;
}

/** Estados, como los ve el negocio («proposed»: esperando su respuesta). */
const MESA_ESTADO = {
  pending: 'Pendiente de respuesta', proposed: 'Esperando su respuesta', confirmed: 'Confirmada',
  declined: 'Rechazada', expired: 'Caducada', cancelled: 'Anulada',
};
const MESA_ANTELACION = [[30, '30 min'], [60, '1 h'], [120, '2 h'], [240, '4 h'], [1440, '1 día'], [2880, '2 días']];
const MESA_CONTESTAR = [[30, '30 min'], [60, '1 h'], [120, '2 h'], [240, '4 h'], [720, '12 h'], [1440, '24 h']];
const mesaPersonas = (n) => bi(n === 1 ? '1 persona' : `${n} personas`, n === 1 ? '1 person' : `${n} people`);
/** «sáb 12 oct, 21:00» en la hora del negocio. */
const mesaDiaHora = (iso) => {
  const f = (o) => KZ.fmt(iso, TZ, LOC(), o).replace('.', '');
  return `${f({ weekday: 'short' })} ${f({ day: 'numeric' })} ${f({ month: 'short' })}, ${fmtHora(iso)}`;
};
const mesaTel = (tel) => String(tel || '').replace(/[\s().-]/g, '');

// ── La herramienta ──────────────────────────────────────────────────────────
PAGES.mesas = async (v, param) => {
  if (param === 'ajustes') return mesaAjustes(v);
  const pasadas = param === 'pasadas';
  const [s, lista] = await Promise.all([
    mesaRpc('business_table_settings', { p_business: BIZ.id }),
    mesaRpc('business_table_bookings', { p_business: BIZ.id, p_past: pasadas }),
  ]);
  const reservas = lista?.bookings || [];
  const intro = I18N.t('La gente te pide mesa desde tu ficha y tú aceptas, propones otra hora o dices que no. Sin pagos.');
  if (!s.enabled && !reservas.length && !pasadas) {
    v.innerHTML = `
      <div class="page-head"><h1>Reservas de mesa</h1></div>
      <section class="vacio">
        <h2>${esc(I18N.t('Reservas de mesa'))}</h2>
        <p>${esc(intro)}</p>
        ${s.can_manage ? `<div class="vacio-botones"><a class="btn primary" href="#/mesas/ajustes?activar=1">${esc(I18N.t('Activar las reservas de mesa'))}</a></div>`
        : `<p>${esc(I18N.t('Las activa el propietario o un encargado.'))}</p>`}
      </section>`;
    return;
  }
  const tarjeta = (r) => {
    const viva = r.status === 'pending' || r.status === 'proposed' || (r.status === 'confirmed' && new Date(r.starts_at) > new Date());
    const nombre = r.name || I18N.t('Usuario de Klendar');
    return `<div class="card mesa-res${r.status === 'pending' ? ' por-contestar' : ''}" data-reserva="${esc(r.id)}">
        <div class="ts-top"><h2>${esc(nombre)}</h2><span class="tag ${r.status === 'confirmed' ? 'st-active' : r.status === 'pending' ? 'warn' : 'dim'}">${esc(I18N.t(MESA_ESTADO[r.status] || r.status))}</span></div>
        <p class="ts-meta"><b>${esc(`${mesaPersonas(r.party_size)} · ${mesaDiaHora(r.starts_at)}`)}</b></p>
        ${r.status === 'proposed' && r.proposed_at ? `<p>${esc(bi(`Le has propuesto: ${mesaDiaHora(r.proposed_at)}. Tiene hasta las ${fmtHora(r.reply_by)} para contestar.`, `You suggested: ${mesaDiaHora(r.proposed_at)}. They have until ${fmtHora(r.reply_by)} to reply.`))}</p>` : ''}
        ${r.note ? `<p class="mesa-nota">${esc(bi(`«${r.note}»`, `“${r.note}”`))}</p>` : ''}
        ${r.phone ? `<p class="mesa-tel"><span>${esc(r.phone)}</span> <a class="btn sm" href="tel:${esc(mesaTel(r.phone))}">${esc(I18N.t('Llamar'))}</a></p>` : ''}
        ${r.responded_by ? `<p class="muted">${esc(bi(`Contestó ${r.responded_by}`, `Answered by ${r.responded_by}`))}</p>` : ''}
        ${r.business_message ? `<p class="muted">${esc(bi(`Tu mensaje: «${r.business_message}»`, `Your message: “${r.business_message}”`))}</p>` : ''}
        ${r.status === 'pending' ? `<p class="mesa-plazo">${esc(bi(`Contesta antes de las ${fmtHora(r.reply_by)}`, `Reply before ${fmtHora(r.reply_by)}`))}</p>
          <div class="mesa-tres">
            <button class="btn primary" type="button" data-mesa="confirm">${esc(I18N.t('Aceptar'))}</button>
            <button class="btn" type="button" data-mesa="propose">${esc(I18N.t('Otra hora'))}</button>
            <button class="btn" type="button" data-mesa="decline">${esc(I18N.t('No puedo'))}</button>
          </div>` : ''}
        ${viva && r.status !== 'pending' ? `<div class="mesa-una"><button class="btn bad ghost" type="button" data-mesa="cancel">${esc(I18N.t('Anular'))}</button></div>` : ''}
      </div>`;
  };
  v.innerHTML = `
    <div class="page-head"><h1>Reservas de mesa</h1>${s.enabled ? '' : `<span class="tag dim">${esc(I18N.t('Desactivadas'))}</span>`}<span class="spacer"></span>
      ${s.can_manage ? `<a class="btn sm ghost" href="#/mesas/ajustes">${esc(I18N.t('Ajustes'))}</a>` : ''}</div>
    ${s.enabled ? '' : `<div class="scan-result warn">${esc(I18N.t('Las reservas de mesa están desactivadas: tu ficha ya no enseña «Reservar mesa». Las que ya tenías siguen aquí.'))}</div>`}
    <div class="pills mesa-pestanas" role="group" aria-label="${esc(I18N.t('Reservas de mesa'))}">
      <button type="button" data-ir="#/mesas" class="${pasadas ? '' : 'on'}" aria-pressed="${!pasadas}">${esc(I18N.t('Por contestar y próximas'))}</button>
      <button type="button" data-ir="#/mesas/pasadas" class="${pasadas ? 'on' : ''}" aria-pressed="${pasadas}">${esc(I18N.t('Pasadas'))}</button>
    </div>
    ${reservas.length ? `<div class="mesa-lista">${reservas.map(tarjeta).join('')}</div>`
    : `<div class="empty">${esc(I18N.t(pasadas ? 'No hay reservas pasadas.' : 'No tienes reservas por contestar ni próximas.'))}</div>`}
    <p class="muted">${esc(I18N.t('El teléfono es solo para esta reserva y se borra al terminar.'))}</p>`;

  $$('[data-ir]', v).forEach((b) => { b.onclick = () => { location.hash = b.dataset.ir; }; });
  $$('[data-mesa]', v).forEach((b) => {
    b.onclick = async () => {
      const id = b.closest('[data-reserva]').dataset.reserva;
      const r = reservas.find((x) => x.id === id);
      const que = b.dataset.mesa;
      const msg = { name: 'message', label: I18N.t('Mensaje (opcional)'), type: 'textarea', rows: 3, maxlength: 200 };
      let args = { p_booking: id, p_action: que, p_day: null, p_time: null, p_message: null };
      if (que === 'propose') {
        const hoy = KZ.hoy(TZ);
        const p = KZ.partes(r.starts_at, TZ);
        const res = await modal({
          title: I18N.t('Otra hora'),
          intro: esc(bi(`Pidió ${mesaDiaHora(r.starts_at)}. Le preguntamos si le va bien la que pongas.`, `They asked for ${mesaDiaHora(r.starts_at)}. We'll ask them if the time you choose works.`)),
          fields: [
            { name: 'day', label: I18N.t('Día'), type: 'date', value: KZ.dia(r.starts_at, TZ), min: hoy, max: KZ.hoy(TZ, 60), required: true },
            { name: 'time', label: I18N.t('Hora'), type: 'time', value: `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`, required: true },
            msg,
          ],
          submit: I18N.t('Proponer'),
        });
        if (!res) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(res.day) || !/^\d{1,2}:\d{2}$/.test(res.time)) { toast(mesaError('bad_time'), true); return; }
        args = { ...args, p_day: res.day, p_time: res.time.slice(0, 5), p_message: res.message || null };
      } else if (que === 'decline') {
        const res = await modal({ title: I18N.t('No puedo'), intro: esc(I18N.t('Se lo decimos. Si quieres, añade por qué.')), fields: [msg], submit: I18N.t('No puedo') });
        if (!res) return;
        args.p_message = res.message || null;
      } else if (que === 'cancel') {
        const res = await modal({ title: I18N.t('¿Anular la reserva?'), intro: esc(I18N.t('Se lo decimos. Si quieres, añade por qué.')), fields: [msg], submit: I18N.t('Anular'), danger: true });
        if (!res) return;
        b.disabled = true;
        try {
          await mesaRpc('business_cancel_table_booking', { p_booking: id, p_message: res.message || null });
          toast(I18N.t('Reserva anulada. Se lo decimos.'));
        } catch (e) { toast(e.message, true); }
        route();
        return;
      }
      b.disabled = true;
      try {
        await mesaRpc('answer_table_booking', args);
        toast(I18N.t(que === 'confirm' ? 'Reserva confirmada. Se lo decimos.' : que === 'propose' ? 'Otra hora propuesta. Se lo decimos.' : 'Hecho. Se lo decimos.'));
      } catch (e) { toast(e.message, true); }
      route();
    };
  });
};

/** Los ajustes (propietario y encargado). */
async function mesaAjustes(v) {
  if (!gestiona()) { location.hash = '#/mesas'; return; }
  const s = await mesaRpc('business_table_settings', { p_business: BIZ.id });
  const activar = new URLSearchParams(location.hash.split('?')[1] || '').get('activar') === '1';
  const opciones = (lista, actual) => {
    const l = lista.some(([m]) => m === actual) ? lista : [...lista, [actual, bi(`${actual} min`, `${actual} min`)]].sort((a, b) => a[0] - b[0]);
    return l.map(([m, txt]) => `<option value="${m}"${m === actual ? ' selected' : ''}>${esc(I18N.t(txt))}</option>`).join('');
  };
  v.innerHTML = `
    <div class="page-head"><h1>${esc(I18N.t('Ajustes de las reservas de mesa'))}</h1><span class="spacer"></span>
      <a class="btn sm ghost" href="#/mesas">${esc(I18N.t('← Reservas de mesa'))}</a></div>
    <form class="card form mesa-ajustes" id="f-mesas" novalidate>
      <label class="f full check"><input type="checkbox" name="enabled"${s.enabled || activar ? ' checked' : ''}><span>${esc(I18N.t('Aceptar reservas de mesa'))}</span></label>
      <div class="full">
        <p class="mesa-campo-t">${esc(I18N.t('Horas a las que se puede reservar'))}</p>
        <p class="hint" style="margin:0 0 10px">${esc(I18N.t('Hora de llegada, de 15 en 15 minutos.'))}</p>
        <div id="mesa-horas"></div>
      </div>
      <label class="f"><span>${esc(I18N.t('Grupo máximo'))}</span><input name="max" type="number" inputmode="numeric" min="1" max="50" required value="${esc(s.max_party || 8)}"></label>
      <label class="f"><span>${esc(I18N.t('Antelación mínima'))}</span><select name="notice">${opciones(MESA_ANTELACION, s.min_notice_minutes ?? 120)}</select></label>
      <label class="f"><span>${esc(I18N.t('Tiempo para contestar'))}</span><select name="reply">${opciones(MESA_CONTESTAR, s.reply_minutes || 120)}</select></label>
      <div class="full scan-result warn mesa-rapido">${esc(I18N.t('Contesta rápido. Te llega un aviso con cada petición y, si no contestas a tiempo, caduca y se lo decimos a la persona.'))}</div>
      ${s.has_phone ? '' : `<p class="full hint">${esc(I18N.t('Pon tu teléfono en «Contacto y redes» para que puedan llamarte.'))} <a href="#/ficha/contacto">${esc(I18N.t('Contacto y redes'))}</a></p>`}
      <p class="err full" id="mesa-err" role="alert"></p>
      <div class="full"><button class="btn primary" type="submit">${esc(I18N.t('Guardar'))}</button></div>
    </form>`;
  const editor = editorHorario($('#mesa-horas', v), s.hours && Object.keys(s.hours).length ? s.hours : null);
  const f = $('#f-mesas', v);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#mesa-err', v);
    err.textContent = '';
    const horas = editor.valor() || {};
    const max = Number(f.max.value);
    if (!Number.isInteger(max) || max < 1 || max > 50) { err.textContent = mesaError('bad_max_party'); return; }
    if (f.enabled.checked && !Object.values(horas).some((tr) => Array.isArray(tr) && tr.length)) { err.textContent = mesaError('no_hours'); return; }
    try {
      await mesaRpc('save_table_settings', {
        p_business: BIZ.id, p_enabled: f.enabled.checked, p_hours: horas, p_max_party: max,
        p_min_notice_minutes: Number(f.notice.value), p_reply_minutes: Number(f.reply.value),
      });
      toast(I18N.t(f.enabled.checked ? 'Guardado: ya se puede pedir mesa desde tu ficha' : 'Guardado'));
      location.hash = '#/mesas';
    } catch (e2) { err.textContent = e2.message; }
  };
}

// ── En el inicio del panel ──────────────────────────────────────────────────
/** «Cola virtual · 3 esperando» (si está abierta) y «2 peticiones de mesa
 * por contestar · antes de las 21:30» (destacada). Si falla, nada. */
async function resumenColaMesas(caja) {
  if (!caja) return;
  const negocio = BIZ.id;
  const [q, s] = await Promise.all([
    rpc('business_queue', { p_business: negocio }).catch(() => null),
    rpc('business_table_settings', { p_business: negocio }).catch(() => null),
  ]);
  if (!caja.isConnected || BIZ?.id !== negocio) return;
  const filas = [];
  const pend = Number(s?.pending) || 0;
  if (s?.ok !== false && pend > 0) {
    const hora = s.next_reply_by ? fmtHora(s.next_reply_by) : '';
    filas.push(`<a class="fila-inicio destacada" href="#/mesas">${svg('mesa')}<span>${esc(bi(
      `${pend === 1 ? '1 petición de mesa por contestar' : `${pend} peticiones de mesa por contestar`}${hora ? ` · antes de las ${hora}` : ''}`,
      `${pend === 1 ? '1 table request to answer' : `${pend} table requests to answer`}${hora ? ` · by ${hora}` : ''}`))}</span>${ms('chevron_right')}</a>`);
  }
  if (q?.ok !== false && q?.queue && q.queue.status === 'open') {
    const n = Number(q.queue.waiting) || 0;
    filas.push(`<a class="fila-inicio" href="#/cola">${svg('cola')}<span>${esc(bi(`Cola virtual · ${n} esperando`, `Virtual queue · ${n} waiting`))}</span>${ms('chevron_right')}</a>`);
  }
  caja.innerHTML = filas.length ? `<div class="filas-inicio">${filas.join('')}</div>` : '';
}
