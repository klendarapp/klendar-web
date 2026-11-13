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
  queue_closed: 'La cola está cerrada.',
  not_done: 'Ya está en la cola.',
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
/** Lo que va la hora del servidor por delante de la de este ordenador (`now`
 * de cada respuesta): «Le quedan» se cuenta con la del servidor. */
let COLA_DESFASE = 0;
/** «3:12» que quedan hasta `iso`. */
const colaQueda = (iso) => {
  const s = Math.max(0, Math.round((new Date(iso).getTime() - (Date.now() + COLA_DESFASE)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** «8,5» (los minutos de la espera media, con un decimal). */
const colaMinutos = (m) => Number(m).toLocaleString(LOC(), { maximumFractionDigits: 1 });
const colaCartelUrl = (code) => `${I18N.pub === 'en' ? '/en/poster/queue/' : '/cartel/cola/'}${encodeURIComponent(code || '')}`;

PAGES.cola = async (v) => {
  let d = await colaRpc('business_queue', { p_business: BIZ.id });
  let firma = '';
  const desfase = () => { const x = Date.parse(d?.now || ''); if (Number.isFinite(x)) COLA_DESFASE = x - Date.now(); };
  desfase();

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
      </div>
      <h2 class="cola-h2">${esc(I18N.t('Pantalla para la puerta'))}</h2>
      <p class="muted">${esc(I18N.t('Ábrela en una tele o una tablet: enseña los números que tocan, sin nombres.'))}</p>
      <div class="cola-acciones"><a class="btn" href="${esc(`${I18N.pub === 'en' ? '/en/queue/' : '/cola/'}${encodeURIComponent(d.code || '')}?pantalla=1`)}" target="_blank" rel="noopener">${esc(I18N.t('Pantalla para la puerta'))}</a></div>
      </div>`;

  const pinta = () => {
    firma = firmaDe(d);
    const q = d.queue;
    if (!q) {
      v.innerHTML = `
        <div class="page-head"><h1>Cola virtual</h1></div>
        ${d.can_manage ? `
          <form class="card form cola-abrir" id="f-cola" novalidate>
            <div class="full">${helpBox(I18N.t('¿Cómo funciona?'), `<p>${esc(I18N.t('Quien llega escanea el cartel de la puerta, coge número y le avisamos en el móvil cuando le toca. Tú solo tocas «Avisar al siguiente». A quien no tenga la app lo apuntas tú y le llamas en voz alta. La lista se borra sola a las 6:00.'))}</p>`)}</div>
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
    // «Uno cada 0,3 min» avisando seguido no dice nada: desde 1 min (como la app).
    const ritmo = q.pace_minutes != null && Number(q.pace_minutes) >= 1 ? Number(q.pace_minutes).toLocaleString(LOC(), { maximumFractionDigits: 1 }) : null;
    const fila = (e, extra) => `<div class="cola-fila" data-entrada="${esc(e.id)}">
        <div class="cola-fila-t"><b>${esc(`${colaNumero(e.number)} · ${colaNombre(e)}`)}</b>
          <span class="muted">${esc(colaPersonas(e.party_size))}${e.status === 'waiting' ? esc(bi(` · desde las ${fmtHora(e.joined_at)}`, ` · since ${fmtHora(e.joined_at)}`)) : ''}</span></div>
        ${extra}</div>`;
    v.innerHTML = `
      <div class="page-head"><h1>Cola virtual</h1><span class="tag ${abierta ? 'st-active' : 'dim'}">${esc(I18N.t(abierta ? 'Abierta' : 'Cerrada'))}</span></div>
      ${q.auto_paused ? `<div class="scan-result warn cola-pausa">${esc(I18N.t('Tres seguidos no han venido: ya no avisamos solos. Toca «Avisar al siguiente» cuando puedas atender.'))}</div>` : ''}
      <div class="card cola-cifras">
        <p class="cola-n">${esc(bi(`${fmtNum(q.waiting)} esperando · ${Number(q.served) === 1 ? '1 atendido' : `${fmtNum(q.served)} atendidos`}`, `${fmtNum(q.waiting)} waiting · ${fmtNum(q.served)} served`))}</p>
        ${ritmo ? `<p class="muted">${esc(bi(`Uno cada ${ritmo} min`, `One every ${ritmo} min`))}</p>` : ''}
        ${!abierta ? `<p class="muted">${esc(I18N.t('No entra nadie más. Los que ya están siguen en su turno.'))}</p>` : ''}
        <button class="btn primary cola-avisar" type="button" data-cola="avisar"${q.waiting ? '' : ' disabled'}>${esc(I18N.t(q.waiting ? 'Avisar al siguiente' : 'No hay nadie esperando'))}</button>
      </div>
      ${avisados.length ? `<h2 class="cola-h2">${esc(I18N.t('Avisados'))}</h2>
        <div class="card cola-lista">${avisados.map((e) => fila(e, `
          <p class="cola-queda" data-plazo="${esc(e.call_deadline)}">${esc(bi(`Le quedan ${colaQueda(e.call_deadline)}`, `${colaQueda(e.call_deadline)} left`))}</p>
          ${e.guest ? `<p class="cola-nota-fuerte">${ms('campaign')}${esc(I18N.t('Sin la app: llámale en voz alta'))}</p>` : ''}
          ${e.on_way_at ? `<p class="cola-nota-fuerte">${ms('check_circle_outline')}${esc(I18N.t('Va de camino'))}</p>` : ''}
          <div class="cola-dos"><button class="btn" type="button" data-llega="${esc(e.id)}">${esc(I18N.t('Ha llegado'))}</button>
            <button class="btn" type="button" data-novino="${esc(e.id)}">${esc(I18N.t('No vino'))}</button></div>`)).join('')}</div>` : ''}
      <h2 class="cola-h2">${esc(I18N.t('Esperando'))}</h2>
      ${esperan.length ? `<div class="card cola-lista">${esperan.map((e) => fila(e, `
          <details class="mas cola-mas"><summary class="btn sm ghost" aria-label="${esc(bi(`Más opciones para el ${colaNumero(e.number)}`, `More options for ${colaNumero(e.number)}`))}">${ms('more_horiz')}</summary>
            <div class="mas-menu"><button type="button" data-llega="${esc(e.id)}">${esc(I18N.t('Ha llegado'))}</button>
              <button type="button" class="bad" data-quita="${esc(e.id)}">${esc(I18N.t('Quitar de la cola'))}</button></div></details>`)).join('')}</div>`
      : `<p class="muted">${esc(I18N.t('No hay nadie esperando.'))}</p>`}
      ${hechos.length ? `<details class="help cola-hechos"><summary>${esc(bi(`Terminados (${hechos.length})`, `Finished (${hechos.length})`))}</summary>
        <div class="cola-lista">${hechos.map((e) => fila(e, `<span class="tag ${e.status === 'served' ? 'st-active' : 'dim'}">${esc(I18N.t(COLA_ESTADO[e.status] || e.status))}</span>
          ${e.status === 'left' ? '' : `<button class="btn sm" type="button" data-devuelve="${esc(e.id)}">${esc(I18N.t('Devolver a la cola'))}</button>`}`)).join('')}</div></details>` : ''}
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
      <div id="cola-cifras-caja">${cifrasHtml}</div>
      <p class="muted">${esc(I18N.t('La lista se borra sola al acabar el día (a las 6:00).'))}</p>`;
    engancha();
  };

  // «Cifras de la cola»: hoy y los últimos 30 días (solo números; como la
  // app). Se piden aparte y cada minuto.
  let cifrasHtml = '';
  const cifras = async () => {
    const c = await rpc('business_queue_stats', { p_business: BIZ.id }).catch(() => null);
    if (!c || c.ok === false) return;
    const linea = (et, x) => [
      `${et}: ${Number(x.served) === 1 ? bi('1 atendido', '1 served') : bi(`${fmtNum(x.served)} atendidos`, `${fmtNum(x.served)} served`)}`,
      x.no_show ? (Number(x.no_show) === 1 ? bi('1 no vino', "1 didn't come") : bi(`${fmtNum(x.no_show)} no vinieron`, `${fmtNum(x.no_show)} didn't come`)) : '',
      x.avg_wait_minutes != null ? bi(`espera media ${colaMinutos(x.avg_wait_minutes)} min`, `average wait ${colaMinutos(x.avg_wait_minutes)} min`) : '',
    ].filter(Boolean).join(' · ');
    const hoy = c.today || {};
    const mes = c.month || {};
    cifrasHtml = !Number(hoy.turns) && !Number(mes.turns) ? '' : `<div class="card cola-stats">
        <h2 class="cola-h2">${esc(I18N.t('Cifras de la cola'))}</h2>
        ${Number(hoy.turns) ? `<p>${esc(linea(bi('Hoy', 'Today'), hoy))}</p>` : ''}
        ${Number(mes.turns) ? `<p class="muted">${esc(linea(bi('Últimos 30 días', 'Last 30 days'), mes))}</p>` : ''}
      </div>`;
    const caja = $('#cola-cifras-caja', v);
    if (caja) { caja.innerHTML = cifrasHtml; I18N.translate(caja); }
  };
  cifras();
  const relojCifras = setInterval(() => { if (!v.isConnected) { clearInterval(relojCifras); return; } cifras(); }, 60000);

  /** Vuelve a pedir la cola (o pinta lo que devuelve una acción). */
  const recarga = async (nuevo = null) => {
    try {
      d = nuevo || await colaRpc('business_queue', { p_business: BIZ.id });
      desfase();
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

  /** «Avisar al siguiente». Si al que le toca no tiene la app, se dice en
   * grande: no le llega ningún aviso y hay que llamarle en voz alta. */
  const avisar = async (boton) => {
    boton.disabled = true;
    let r;
    try {
      r = await colaRpc('queue_call_next', { p_business: BIZ.id });
      await recarga(r);
    } catch (err) {
      toast(err.message, true);
      if (boton.isConnected) boton.disabled = false;
      recarga();
      return;
    }
    const e = (r?.queue?.entries || []).find((x) => x.id === r.called_id);
    if (!e?.guest) return;
    await modal({
      title: I18N.t('Llámale en voz alta'),
      html: `<p class="cola-voz">${esc(`${colaNumero(e.number)} · ${e.name || ''}`)}</p>
        <p>${esc(I18N.t('No tiene la app: no le llega ningún aviso.'))}</p>`,
      submit: I18N.t('Aceptar'), cancel: '',
    });
  };

  /** «Ha llegado», «No vino» o «Quitar»: lo hace y deja unos segundos para
   * deshacerlo (un clic sin querer no le quita el turno a nadie; como la app). */
  const marca = async (boton, id, estado) => {
    const e = (d.queue?.entries || []).find((x) => x.id === id);
    if (boton) boton.disabled = true;
    try {
      const r = await colaRpc('queue_set_status', { p_entry: id, p_status: estado });
      await recarga(r);
    } catch (err) {
      toast(err.message, true);
      if (boton?.isConnected) boton.disabled = false;
      recarga();
      return;
    }
    colaToastDeshacer(`${e ? `${colaNumero(e.number)} · ` : ''}${I18N.t(COLA_ESTADO[estado])}`,
      () => haz(null, 'queue_return', { p_entry: id }));
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
        if (que === 'avisar') return avisar(b);
        if (que === 'apuntar') {
          const r = await modal({
            title: I18N.t('Apuntar a alguien'),
            intro: esc(I18N.t('Para quien no tiene la app: le llamas tú cuando le toque.')),
            fields: [
              { name: 'name', label: I18N.t('Nombre'), maxlength: 40, required: true },
              { name: 'party', label: I18N.t('¿Cuántas personas?'), type: 'select', value: '1', options: Array.from({ length: 20 }, (_, i) => [String(i + 1), String(i + 1)]) },
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
    $$('[data-llega]', v).forEach((b) => { b.onclick = () => marca(b, b.dataset.llega, 'served'); });
    $$('[data-novino]', v).forEach((b) => { b.onclick = () => marca(b, b.dataset.novino, 'no_show'); });
    $$('[data-devuelve]', v).forEach((b) => { b.onclick = () => haz(b, 'queue_return', { p_entry: b.dataset.devuelve }, 'Devuelto a la cola'); });
    $$('[data-quita]', v).forEach((b) => {
      b.onclick = async () => {
        const e = (d.queue?.entries || []).find((x) => x.id === b.dataset.quita);
        if (!await confirmDlg(I18N.t('¿Quitar de la cola?'), esc(bi(`Se le avisa de que ya no está en la cola${e ? ` (${colaNumero(e.number)})` : ''}.`, `We'll let them know they're no longer in the queue${e ? ` (${colaNumero(e.number)})` : ''}.`)), { submit: I18N.t('Quitar de la cola'), danger: true })) return;
        marca(null, b.dataset.quita, 'removed');
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

/** Un aviso con «Deshacer» unos segundos (como el de la app). */
function colaToastDeshacer(msg, alDeshacer) {
  const aviso = document.createElement('div');
  aviso.className = 'toast';
  aviso.innerHTML = `<span>${esc(msg)}</span> <button type="button" class="toast-accion">${esc(I18N.t('Deshacer'))}</button>`;
  $('#toasts').appendChild(aviso);
  const fuera = () => aviso.isConnected && aviso.parentNode.removeChild(aviso);
  aviso.querySelector('button').onclick = () => { fuera(); alDeshacer(); };
  setTimeout(fuera, 6000);
}

// ── En el inicio del panel ──────────────────────────────────────────────────
/** «Cola virtual · 3 esperando», si hoy hay cola (abierta o cerrada: los de
 * dentro siguen; como la app). Si falla, nada. */
async function resumenCola(caja) {
  if (!caja) return;
  const negocio = BIZ.id;
  const q = await rpc('business_queue', { p_business: negocio }).catch(() => null);
  if (!caja.isConnected || BIZ?.id !== negocio) return;
  if (q?.ok === false || !q?.queue) { caja.innerHTML = ''; return; }
  const n = Number(q.queue.waiting) || 0;
  caja.innerHTML = `<div class="filas-inicio"><a class="fila-inicio" href="#/cola">${svg('cola')}<span>${esc(bi(`Cola virtual · ${n} esperando`, `Virtual queue · ${n} waiting`))}</span>${ms('chevron_right')}</a></div>`;
}
