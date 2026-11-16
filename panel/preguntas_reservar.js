// «Preguntas al reservar» en el panel (Iván, 2026-11-17): el bloque del
// formulario del evento, igual que la app (booking_questions_editor.dart).
// La lógica común (KlPreguntas) está en assets/cuenta/reservar_preguntas.js,
// que el panel también carga.
'use strict';

// ── El panel: el bloque del formulario ─────────────────────────────────────
/** Pinta y enlaza el bloque en `caja`. `inicial`: las preguntas guardadas;
 * `bloqueadas`: cuántas de las primeras ya tienen respuestas; `n`: cuántas
 * reservas han respondido; `tr`: la traducción. Devuelve
 * { activas(), preguntas(), valida() }. */
function editorPreguntas(caja, { inicial = [], bloqueadas = 0, n = 0, tr = (s) => s }) {
  const KP = KlPreguntas;
  let encendido = inicial.length > 0;
  const lista = inicial.map((q) => ({ ...q, options: [...(q.options || [])] }));
  const tipoTxt = { text: tr('Respuesta corta'), yesno: tr('Sí o no'), choice: tr('Elegir una opción') };
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
            ${q.type === 'choice' ? `<label class="f"><span>${esc(tr('Opciones'))}</span><input data-p="options" value="${esc((q.options || []).join(', '))}" placeholder="${esc(tr('S, M, L, XL (separadas por comas)'))}" ${fija ? 'disabled' : ''}></label>` : ''}
            <label class="check"><input type="checkbox" data-p="required" ${q.required ? 'checked' : ''}> <span>${esc(tr('Obligatoria'))}</span></label>
            ${fija ? '' : `<button type="button" class="btn sm ghost" data-p="quitar">${esc(tr('Quitar la pregunta'))}</button>`}
          </fieldset>`;
        }).join('')}
        ${lista.length < KP.MAX ? `<p><button type="button" class="btn sm ghost" data-p="anadir">+ ${esc(tr('Añadir una pregunta'))}</button></p>` : ''}
        ${bloqueadas ? `<p class="hint">${esc(n === 1
    ? tr('Ya ha respondido 1 reserva: las preguntas que hay no se pueden cambiar ni quitar. Puedes añadir otras al final.')
    : tr('Ya han respondido {n} reservas: las preguntas que hay no se pueden cambiar ni quitar. Puedes añadir otras al final.').replace('{n}', n))}</p>` : ''}
        <p class="hint aviso-salud">${esc(tr('No pidas datos de salud (alergias, enfermedades…). Usa las respuestas solo para este evento.'))}</p>` : ''}`;
  };
  const nueva = () => lista.push({ id: KP.idNuevo(lista), text: '', type: 'text', required: false, options: [] });
  caja.addEventListener('input', (ev) => {
    const fs = ev.target.closest('fieldset.pregunta');
    if (!fs) return;
    const q = lista[Number(fs.dataset.i)];
    if (ev.target.dataset.p === 'text') q.text = ev.target.value;
    if (ev.target.dataset.p === 'options') q.options = KP.opciones(ev.target.value);
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
    const q = lista[Number(fs.dataset.i)];
    if (p === 'type') { q.type = ev.target.value; pinta(); }
    if (p === 'required') q.required = ev.target.checked;
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
    preguntas: () => (encendido ? KP.paraGuardar(lista) : []),
    valida: () => !encendido || lista.every(KP.valida),
  };
}
