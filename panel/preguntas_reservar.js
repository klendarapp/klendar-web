// «Preguntas al reservar» en el panel (Iván, 2026-11-17): el bloque del
// formulario del evento, igual que la app (booking_questions_editor.dart).
// La lógica común (KlPreguntas) está en assets/cuenta/reservar_preguntas.js,
// que el panel también carga. No sabe nada de la publicación: recibe y
// devuelve la lista de preguntas (sirve igual para otras reservas).
'use strict';

// ── El panel: el bloque del formulario ─────────────────────────────────────
/** Pinta y enlaza el bloque en `caja`. `inicial`: las preguntas guardadas;
 * `bloqueadas`: cuántas de las primeras ya tienen respuestas; `n`: cuántas
 * reservas han respondido; `salud`: la lista de palabras de salud de la base
 * ([{t, m}], `booking_health_terms()`); `tr`: la traducción. Devuelve
 * { activas(), preguntas(), valida() }. */
function editorPreguntas(caja, { inicial = [], bloqueadas = 0, n = 0, salud = [], tr = (s) => s }) {
  const KP = KlPreguntas;
  let encendido = inicial.length > 0;
  const lista = inicial.map((q) => ({ ...q, options: [...(q.options || [])] }));
  const tipoTxt = {
    text: tr('Respuesta corta'), yesno: tr('Sí o no'), choice: tr('Elegir una opción'),
    multi: tr('Elegir varias'), number: tr('Número'), date: tr('Fecha'),
  };
  const detectada = (q) => KP.detectaSalud(q, salud);
  const esSalud = (q) => !!q.health || detectada(q);
  // La marca de salud y «Obligatoria» de una pregunta, sin repintar (no se
  // pierde el foco al escribir).
  const marcas = (fs, q, fija) => {
    const det = detectada(q);
    const s = esSalud(q);
    const h = fs.querySelector('[data-p="health"]');
    h.checked = s;
    h.disabled = fija || det;
    fs.querySelector('.salud-ayuda').textContent = det
      ? tr('Tiene palabras de salud: se marca sola. Quien reserva solo responde si da su consentimiento y no puede ser obligatoria.')
      : tr('Quien reserva solo responde si da su consentimiento. No puede ser obligatoria y la respuesta se borra al día siguiente del evento.');
    const r = fs.querySelector('[data-p="required"]');
    if (s) q.required = false;
    r.checked = !!q.required;
    r.disabled = s;
  };
  const pinta = () => {
    caja.innerHTML = `
      <label class="opcion"><input type="checkbox" data-p="on" ${encendido ? 'checked' : ''} ${bloqueadas && encendido ? 'disabled' : ''}>
        <span><b>${esc(tr('Preguntas al reservar'))}</b><br><small class="muted">${esc(tr('Opcional. Pregunta algo a quien reserva, como «¿Menú infantil?» o «¿Talla de camiseta?».'))}</small></span></label>
      ${encendido ? `
        ${lista.map((q, i) => {
          const fija = i < bloqueadas;
          return `<fieldset class="pregunta" data-i="${i}"><legend>${esc(tr('Pregunta {n}').replace('{n}', i + 1))}</legend>
            <label class="f"><span class="sr">${esc(tr('Pregunta {n}').replace('{n}', i + 1))}</span><input data-p="text" maxlength="120" value="${esc(q.text || '')}" placeholder="${esc(tr('Por ejemplo: ¿Menú infantil?'))}" ${fija ? 'disabled' : ''}></label>
            <label class="f"><span>${esc(tr('Tipo de respuesta'))}</span><select data-p="type" ${fija ? 'disabled' : ''}>
              ${Object.entries(tipoTxt).map(([k, txt]) => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${esc(txt)}</option>`).join('')}</select></label>
            ${KP.conOpciones(q.type) ? `<label class="f"><span>${esc(tr('Opciones'))}</span><input data-p="options" value="${esc((q.options || []).join(', '))}" placeholder="${esc(tr('S, M, L, XL (separadas por comas)'))}" ${fija ? 'disabled' : ''}></label>` : ''}
            ${q.type === 'number' ? `<div class="fila-2">
              <label class="f"><span>${esc(tr('Mínimo (opcional)'))}</span><input data-p="min" type="number" step="1" inputmode="numeric" value="${esc(q.min ?? '')}" ${fija ? 'disabled' : ''}></label>
              <label class="f"><span>${esc(tr('Máximo (opcional)'))}</span><input data-p="max" type="number" step="1" inputmode="numeric" value="${esc(q.max ?? '')}" ${fija ? 'disabled' : ''}></label></div>` : ''}
            <label class="check"><input type="checkbox" data-p="health"> <span>${esc(tr('Es sobre salud (alergias, intolerancias…)'))}<br><small class="muted salud-ayuda"></small></span></label>
            <label class="check"><input type="checkbox" data-p="required"> <span>${esc(tr('Obligatoria'))}</span></label>
            ${fija ? '' : `<button type="button" class="btn sm ghost" data-p="quitar">${esc(tr('Quitar la pregunta'))}</button>`}
          </fieldset>`;
        }).join('')}
        ${lista.length < KP.MAX ? `<p><button type="button" class="btn sm ghost" data-p="anadir">+ ${esc(tr('Añadir una pregunta'))}</button></p>` : ''}
        ${bloqueadas ? `<p class="hint">${esc(n === 1
    ? tr('Ya ha respondido 1 reserva: las preguntas que hay no se pueden cambiar ni quitar. Puedes añadir otras al final.')
    : tr('Ya han respondido {n} reservas: las preguntas que hay no se pueden cambiar ni quitar. Puedes añadir otras al final.').replace('{n}', n))}</p>` : ''}
        <p class="hint aviso-salud">${esc(tr('Pregunta solo lo que necesites para preparar el evento.'))}</p>` : ''}`;
    caja.querySelectorAll('fieldset.pregunta').forEach((fs) => {
      const i = Number(fs.dataset.i);
      marcas(fs, lista[i], i < bloqueadas);
    });
  };
  const nueva = () => lista.push({ id: KP.idNuevo(lista), text: '', type: 'text', required: false, health: false, options: [] });
  caja.addEventListener('input', (ev) => {
    const fs = ev.target.closest('fieldset.pregunta');
    if (!fs) return;
    const i = Number(fs.dataset.i);
    const q = lista[i];
    const p = ev.target.dataset.p;
    if (p === 'text') q.text = ev.target.value;
    if (p === 'options') q.options = KP.opciones(ev.target.value);
    if (p === 'min' || p === 'max') q[p] = ev.target.value === '' ? null : ev.target.value;
    if (p === 'text' || p === 'options') marcas(fs, q, i < bloqueadas);
  });
  caja.addEventListener('change', (ev) => {
    const p = ev.target.dataset.p;
    if (p === 'on') {
      encendido = ev.target.checked;
      if (encendido && !lista.length) nueva();
      pinta();
      return;
    }
    const fs = ev.target.closest('fieldset.pregunta');
    if (!fs) return;
    const i = Number(fs.dataset.i);
    const q = lista[i];
    if (p === 'type') { q.type = ev.target.value; pinta(); }
    if (p === 'required') q.required = ev.target.checked;
    if (p === 'health') { q.health = ev.target.checked; marcas(fs, q, i < bloqueadas); }
  });
  caja.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-p]');
    if (!b) return;
    if (b.dataset.p === 'anadir') nueva();
    if (b.dataset.p === 'quitar') lista.splice(Number(b.closest('fieldset').dataset.i), 1);
    pinta();
  });
  pinta();
  return {
    activas: () => encendido && lista.length > 0,
    preguntas: () => (encendido ? KP.paraGuardar(lista, salud) : []),
    valida: () => !encendido || lista.every(KP.valida),
  };
}
