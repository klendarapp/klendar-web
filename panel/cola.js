/* Panel del negocio: «Cola virtual» (tanda C, migración 20261207100000). Lo
 * mismo que «Cola virtual» en «Mi negocio» de la app.
 *
 * - Sin cola hoy: propietario y encargado la abren con el tope de personas y
 *   los minutos para presentarse; el personal ve que está cerrada.
 * - Abierta (o cerrada con gente dentro): cuántos esperan y cuántos se han
 *   atendido, el ritmo, «Avisar al siguiente» (todo el equipo), los avisados
 *   con su cuenta atrás («Ha llegado» / «No vino»), los que esperan («Ha
 *   llegado», «Quitar de la cola») y los terminados. «Apuntar a alguien»
 *   (sin la app) es de todo el equipo; cerrar, volver a abrir, terminar por
 *   hoy, cambiar tope y minutos y cambiar el código del cartel, de
 *   propietario y encargado.
 * - «Cartel para la puerta»: /cartel/cola/<código> (functions/_lib/poster.js).
 *
 * Se vuelve a pedir cada 10 s. Va después de panel.js y usa lo suyo
 * (`PAGES`, `rpc`, `BIZ`, `gestiona`, `esc`, `ms`, `bi`, `toast`, `modal`,
 * `confirmDlg`, `helpBox`, `fmtNum`, `fmtHora`, `friendly`). Comparten
 * ámbito: los nombres de aquí empiezan por `cola`.
 */
'use strict';

const COLA_ERR = {
  not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
  bad_max_people: 'El tope tiene que estar entre 5 y 300 personas.',
  bad_call_minutes: 'Los minutos tienen que estar entre 2 y 30.',
  business_not_visible: 'Tu negocio aún no sale en Klendar.',
  queue_not_open: 'Hoy no hay cola virtual.',
  queue_empty: 'No hay nadie esperando.',
  queue_full: 'La cola está llena. Prueba dentro de un rato.',
  rate_limited: 'Demasiados intentos. Espera un minuto.',
  already_done: 'Ya no está en la cola.',
  not_found: 'Ya no está en la cola.',
  not_called: 'Todavía no le has avisado.',
  bad_name: 'Escribe su nombre.',
  bad_party: 'Elige cuántos son, de 1 a 20.',
};
const colaError = (code) => I18N.t(COLA_ERR[code] || friendly(code));
/** Llama a la base; si dice que no, lanza el error ya en palabras. */
async function colaRpc(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw Object.assign(new Error(colaError(r.error)), { clave: r.error });
  return r;
}

const COLA_ESTADO = {
  waiting: 'Esperando', called: 'Avisado', served: 'Atendido', no_show: 'No vino', left: 'Se salió', removed: 'Quitado',
};
const colaNumero = (n) => bi(`Nº ${n}`, `No. ${n}`);
const colaPersonas = (n) => bi(n === 1 ? '1 persona' : `${n} personas`, n === 1 ? '1 person' : `${n} people`);
/** El nombre que ve el equipo: el suyo, «Usuario de Klendar» o el que se
 * apuntó a mano, con «(sin la app)». */
const colaNombre = (e) => (e.guest
  ? `${e.name || ''} ${I18N.t('(sin la app)')}`
  : (e.name || I18N.t('Usuario de Klendar')));
/** «3:12» que quedan hasta `iso`. */
const colaQueda = (iso) => {
  const s = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const colaCartelUrl = (code) => `${I18N.lang === 'en' ? '/en/poster/queue/' : '/cartel/cola/'}${encodeURIComponent(code || '')}`;

PAGES.cola = async (v) => {
  let d = await colaRpc('business_queue', { p_business: BIZ.id });
  let firma = '';

  const firmaDe = (x) => JSON.stringify([x.code, x.queue && [x.queue.status, x.queue.waiting, x.queue.served, x.queue.pace_minutes,
    x.queue.auto_paused, (x.queue.entries || []).map((e) => [e.id, e.status])]]);

  /** Ajustes para abrir (o cambiar tope y minutos). */
  const camposAbrir = (max, min) => `
      <label class="f"><span>${esc(I18N.t('Tope de personas'))}</span><input name="max" type="number" inputmode="numeric" min="5" max="300" required value="${esc(max)}"></label>
      <label class="f"><span>${esc(I18N.t('Minutos para presentarse'))}</span><input name="min" type="number" inputmode="numeric" min="2" max="30" required value="${esc(min)}">
        <small class="muted">${esc(I18N.t('Si no llega en ese tiempo, pasa el siguiente.'))}</small></label>`;
  const leeAbrir = (form) => {
    const max = Number(form.max.value);
    const min = Number(form.min.value);
    if (!Number.isInteger(max) || max < 5 || max > 300) return { error: colaError('bad_max_people') };
    if (!Number.isInteger(min) || min < 2 || min > 30) return { error: colaError('bad_call_minutes') };
    return { max, min };
  };

  /** La tarjeta del cartel (todas las pantallas). */
  const cartelCard = () => `<div class="card cola-cartel">
      <h2>${esc(I18N.t('Cartel para la puerta'))}</h2>
      <p class="muted">${esc(I18N.t('Quien llega lo escanea con el móvil y coge número. Imprímelo y ponlo en la puerta.'))}</p>
      <div class="cola-acciones">
        <a class="btn" href="${esc(colaCartelUrl(d.code))}" target="_blank" rel="noopener">${ms('qr_code_2')}${esc(I18N.t('Cartel para la puerta'))}</a>
        ${d.can_manage ? `<button class="btn" type="button" data-cola="codigo">${esc(I18N.t('Cambiar el código del cartel'))}</button>` : ''}
      </div></div>`;

  const pinta = () => {
    firma = firmaDe(d);
    const q = d.queue;
    if (!q) {
      v.innerHTML = `
        <div class="page-head"><h1>Cola virtual</h1></div>
        ${d.can_manage ? `
          <form class="card form cola-abrir" id="f-cola" novalidate>
            <p class="full" style="margin:0">${esc(I18N.t('Quien llega escanea el cartel de la puerta, coge número y le avisamos en el móvil cuando le toca. Tú solo tocas «Avisar al siguiente».'))}</p>
            ${camposAbrir(d.max_people || 40, d.call_minutes || 5)}
            <p class="err full" id="cola-err" role="alert"></p>
            <div class="full"><button class="btn primary" type="submit">${esc(I18N.t('Abrir la cola de hoy'))}</button></div>
          </form>`
        : `<section class="vacio"><h2>${esc(I18N.t('La cola está cerrada'))}</h2><p>${esc(I18N.t('La abre el propietario o un encargado.'))}</p></section>`}
        ${cartelCard()}
        <p class="muted">${esc(I18N.t('La lista se borra sola al acabar el día (a las 6:00).'))}</p>`;
      engancha();
      return;
    }
    const es = q.entries || [];
    const avisados = es.filter((e) => e.status === 'called');
    const esperan = es.filter((e) => e.status === 'waiting');
    const hechos = es.filter((e) => e.status !== 'called' && e.status !== 'waiting');
    const abierta = q.status === 'open';
    const ritmo = q.pace_minutes != null ? Number(q.pace_minutes).toLocaleString(LOC(), { maximumFractionDigits: 1 }) : null;
    const fila = (e, extra) => `<div class="cola-fila" data-entrada="${esc(e.id)}">
        <div class="cola-fila-t"><b>${esc(`${colaNumero(e.number)} · ${colaNombre(e)}`)}</b>
          <span class="muted">${esc(colaPersonas(e.party_size))}${e.status === 'waiting' ? esc(bi(` · desde las ${fmtHora(e.joined_at)}`, ` · since ${fmtHora(e.joined_at)}`)) : ''}</span></div>
        ${extra}</div>`;
    v.innerHTML = `
      <div class="page-head"><h1>Cola virtual</h1><span class="tag ${abierta ? 'st-active' : 'dim'}">${esc(I18N.t(abierta ? 'Abierta' : 'Cerrada'))}</span></div>
      ${q.auto_paused ? `<div class="scan-result warn cola-pausa">${esc(I18N.t('Tres seguidos no han venido: ya no avisamos solos. Toca «Avisar al siguiente» cuando puedas atender.'))}</div>` : ''}
      <div class="card cola-cifras">
        <p class="cola-n">${esc(bi(`${fmtNum(q.waiting)} esperando · ${fmtNum(q.served)} atendidos`, `${fmtNum(q.waiting)} waiting · ${fmtNum(q.served)} served`))}</p>
        ${ritmo ? `<p class="muted">${esc(bi(`Uno cada ${ritmo} min`, `One every ${ritmo} min`))}</p>` : ''}
        ${!abierta ? `<p class="muted">${esc(I18N.t('No entra nadie más. Los que ya están siguen en su turno.'))}</p>` : ''}
        <button class="btn primary cola-avisar" type="button" data-cola="avisar"${q.waiting ? '' : ' disabled'}>${esc(I18N.t(q.waiting ? 'Avisar al siguiente' : 'No hay nadie esperando'))}</button>
      </div>
      ${avisados.length ? `<h2 class="cola-h2">${esc(I18N.t('Avisados'))}</h2>
        <div class="card cola-lista">${avisados.map((e) => fila(e, `
          <p class="cola-queda" data-plazo="${esc(e.call_deadline)}">${esc(bi(`Le quedan ${colaQueda(e.call_deadline)}`, `${colaQueda(e.call_deadline)} left`))}</p>
          <div class="cola-dos"><button class="btn" type="button" data-llega="${esc(e.id)}">${esc(I18N.t('Ha llegado'))}</button>
            <button class="btn" type="button" data-novino="${esc(e.id)}">${esc(I18N.t('No vino'))}</button></div>`)).join('')}</div>` : ''}
      <h2 class="cola-h2">${esc(I18N.t('Esperando'))}</h2>
      ${esperan.length ? `<div class="card cola-lista">${esperan.map((e) => fila(e, `
          <details class="mas cola-mas"><summary class="btn sm ghost" aria-label="${esc(bi(`Más opciones para el ${colaNumero(e.number)}`, `More options for ${colaNumero(e.number)}`))}">${ms('more_horiz')}</summary>
            <div class="mas-menu"><button type="button" data-llega="${esc(e.id)}">${esc(I18N.t('Ha llegado'))}</button>
              <button type="button" class="bad" data-quita="${esc(e.id)}">${esc(I18N.t('Quitar de la cola'))}</button></div></details>`)).join('')}</div>`
      : `<p class="muted">${esc(I18N.t('No hay nadie esperando.'))}</p>`}
      ${hechos.length ? `<details class="help cola-hechos"><summary>${esc(bi(`Terminados (${hechos.length})`, `Finished (${hechos.length})`))}</summary>
        <div class="cola-lista">${hechos.map((e) => fila(e, `<span class="tag ${e.status === 'served' ? 'st-active' : 'dim'}">${esc(I18N.t(COLA_ESTADO[e.status] || e.status))}</span>`)).join('')}</div></details>` : ''}
      <div class="card">
        <div class="cola-acciones">
          ${abierta ? `<button class="btn" type="button" data-cola="apuntar">${esc(I18N.t('Apuntar a alguien'))}</button>` : ''}
          ${d.can_manage && abierta ? `<button class="btn" type="button" data-cola="tope">${esc(I18N.t('Cambiar tope y minutos'))}</button>
            <button class="btn" type="button" data-cola="cerrar">${esc(I18N.t('Cerrar la cola'))}</button>` : ''}
          ${d.can_manage && !abierta ? `<button class="btn" type="button" data-cola="abrir">${esc(I18N.t('Volver a abrir'))}</button>` : ''}
          ${d.can_manage ? `<button class="btn bad ghost" type="button" data-cola="terminar">${esc(I18N.t('Terminar por hoy'))}</button>` : ''}
        </div>
      </div>
      ${cartelCard()}
      <p class="muted">${esc(I18N.t('La lista se borra sola al acabar el día (a las 6:00).'))}</p>`;
    engancha();
  };

  /** Vuelve a pedir la cola (o pinta lo que devuelve una acción). */
  const recarga = async (nuevo = null) => {
    try {
      d = nuevo || await colaRpc('business_queue', { p_business: BIZ.id });
    } catch (e) { if (nuevo === null) return; toast(e.message, true); return; }
    if (!v.isConnected) return;
    if (nuevo || firmaDe(d) !== firma) { pinta(); I18N.translate(v); }
  };
  /** Una acción que devuelve la cola entera. */
  const haz = async (boton, fn, args, ok) => {
    if (boton) boton.disabled = true;
    try {
      const r = await colaRpc(fn, args);
      if (ok) toast(I18N.t(ok));
      await recarga(r);
    } catch (e) {
      toast(e.message, true);
      if (boton?.isConnected) boton.disabled = false;
      recarga();
    }
  };

  function engancha() {
    const f = $('#f-cola', v);
    if (f) {
      f.onsubmit = async (ev) => {
        ev.preventDefault();
        const x = leeAbrir(f);
        $('#cola-err', v).textContent = x.error || '';
        if (x.error) return;
        await haz(f.querySelector('button[type=submit]'), 'open_queue', { p_business: BIZ.id, p_max_people: x.max, p_call_minutes: x.min }, 'Cola abierta');
      };
    }
    $$('[data-cola]', v).forEach((b) => {
      b.onclick = async () => {
        const que = b.dataset.cola;
        if (que === 'avisar') return haz(b, 'queue_call_next', { p_business: BIZ.id });
        if (que === 'apuntar') {
          const r = await modal({
            title: I18N.t('Apuntar a alguien'),
            intro: esc(I18N.t('Para quien no tiene la app: le llamas tú cuando le toque.')),
            fields: [
              { name: 'name', label: I18N.t('Nombre'), maxlength: 40, required: true },
              { name: 'party', label: I18N.t('¿Cuántos son?'), type: 'select', value: '1', options: Array.from({ length: 20 }, (_, i) => [String(i + 1), String(i + 1)]) },
            ],
            submit: I18N.t('Apuntar'),
          });
          if (!r) return;
          if (!r.name) { toast(colaError('bad_name'), true); return; }
          return haz(null, 'queue_add_guest', { p_business: BIZ.id, p_name: r.name.slice(0, 40), p_party: Number(r.party) || 1 }, 'Apuntado');
        }
        if (que === 'tope' || que === 'abrir') {
          const q = d.queue || {};
          const r = await modal({
            title: I18N.t(que === 'abrir' ? 'Volver a abrir' : 'Cambiar tope y minutos'),
            html: `<div class="form" style="grid-template-columns:1fr;margin:0">${camposAbrir(q.max_people || d.max_people || 40, q.call_minutes || d.call_minutes || 5)}</div>`,
            submit: I18N.t(que === 'abrir' ? 'Volver a abrir' : 'Guardar'),
          });
          if (r === null) return;
          const x = leeAbrir($('#modal form'));
          if (x.error) { toast(x.error, true); return; }
          return haz(null, 'open_queue', { p_business: BIZ.id, p_max_people: x.max, p_call_minutes: x.min }, que === 'abrir' ? 'Cola abierta' : 'Guardado');
        }
        if (que === 'cerrar') {
          if (!await confirmDlg(I18N.t('¿Cerrar la cola?'), esc(I18N.t('No entrará nadie más. Los que ya están siguen en su turno.')), { submit: I18N.t('Cerrar la cola') })) return;
          return haz(b, 'close_queue', { p_business: BIZ.id }, 'Cola cerrada');
        }
        if (que === 'terminar') {
          if (!await confirmDlg(I18N.t('¿Terminar por hoy?'), esc(I18N.t('Se avisa a quien siga esperando y se borra la lista de hoy.')), { submit: I18N.t('Terminar por hoy'), danger: true })) return;
          return haz(b, 'end_queue', { p_business: BIZ.id }, 'Cola terminada por hoy');
        }
        if (que === 'codigo') {
          if (!await confirmDlg(I18N.t('¿Cambiar el código del cartel?'), esc(I18N.t('El cartel que tengas impreso dejará de funcionar.')), { submit: I18N.t('Cambiar el código'), danger: true })) return;
          return haz(b, 'rotate_queue_code', { p_business: BIZ.id }, 'Código cambiado. Imprime el cartel nuevo.');
        }
        return null;
      };
    });
    $$('[data-llega]', v).forEach((b) => { b.onclick = () => haz(b, 'queue_set_status', { p_entry: b.dataset.llega, p_status: 'served' }); });
    $$('[data-novino]', v).forEach((b) => { b.onclick = () => haz(b, 'queue_set_status', { p_entry: b.dataset.novino, p_status: 'no_show' }); });
    $$('[data-quita]', v).forEach((b) => {
      b.onclick = async () => {
        const e = (d.queue?.entries || []).find((x) => x.id === b.dataset.quita);
        if (!await confirmDlg(I18N.t('¿Quitar de la cola?'), esc(bi(`Se le avisa de que ya no está en la cola${e ? ` (${colaNumero(e.number)})` : ''}.`, `We'll let them know they're no longer in the queue${e ? ` (${colaNumero(e.number)})` : ''}.`)), { submit: I18N.t('Quitar de la cola'), danger: true })) return;
        haz(null, 'queue_set_status', { p_entry: b.dataset.quita, p_status: 'removed' }, 'Quitado de la cola');
      };
    });
  }

  pinta();
  // Cada 10 s (sin pisar un menú o un diálogo abiertos) y la cuenta atrás de
  // los avisados cada segundo. Se apaga al irse de la pantalla.
  const reloj = setInterval(() => {
    if (!v.isConnected) { clearInterval(reloj); return; }
    if ($('#modal')?.open || $('details.mas[open]', v) || document.visibilityState === 'hidden') return;
    recarga();
  }, 10000);
  const segundos = setInterval(() => {
    if (!v.isConnected) { clearInterval(segundos); return; }
    $$('[data-plazo]', v).forEach((p) => { p.textContent = bi(`Le quedan ${colaQueda(p.dataset.plazo)}`, `${colaQueda(p.dataset.plazo)} left`); });
  }, 1000);
};
