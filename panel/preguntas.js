/* Panel del negocio: «Preguntas» (#/preguntas; «Pregúntale al local»,
 * migración 20261237100000 de la app). Lo mismo que Mi negocio › Tu negocio
 * › «Preguntas» en la app.
 *
 * - «Sin contestar · Contestadas · Ocultas», por partes («Ver más»;
 *   `business_questions_inbox` con el cursor `at`) y cuántas hay en cada una
 *   (`business_question_counts`). Nunca quién preguntó.
 * - Propietario y encargado: «Contestar» / «Editar respuesta»
 *   (`answer_business_question`; la primera vez avisa a quien preguntó) y
 *   «Ocultar» con motivo (`hide_business_question`; se le dice el motivo).
 *   El resto del equipo, solo leer.
 * - La fila «Preguntas · 2 sin contestar» del resumen está en
 *   panel/herramientas.js (`business_tools_overview` → `questions`).
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `esc`, `bi`,
 * `toast`, `modal`, `gestiona`, `fmtDate`, `cursorDe`, `botonVerMas`…).
 * Comparten ámbito: los nombres de aquí empiezan por `preg`.
 */
'use strict';

let PREG_TAB = 'pending';
const PREG_POR_PARTE = 20;
const PREG_MOTIVOS = [
  ['answered_elsewhere', 'La respuesta ya está en la ficha', 'The answer is already on the page'],
  ['not_about_us', 'No es sobre el local', "It isn't about the venue"],
  ['personal_data', 'Lleva datos personales', 'It contains personal details'],
  ['inappropriate', 'No es apropiada', "It isn't appropriate"],
  ['outdated', 'Ya no está al día', "It's out of date"],
];
const pregMotivo = (c) => {
  const m = PREG_MOTIVOS.find((x) => x[0] === c);
  return m ? bi(m[1], m[2]) : '';
};
const PREG_ERR = {
  too_short: ['Escribe al menos 2 caracteres.', 'Write at least 2 characters.'],
  too_long: ['Como mucho 1000 caracteres.', '1000 characters at most.'],
  offensive_text: ['Tiene palabras que no se pueden publicar. Cámbialo y vuelve a enviarlo.', "It has words that can't be published. Change it and send it again."],
  hidden: ['Esta pregunta está oculta.', 'This question is hidden.'],
  not_found: ['Esa pregunta ya no está.', 'That question is no longer there.'],
  rate_limited: ['Has hecho demasiadas hoy. Prueba mañana.', "You've done too many today. Try again tomorrow."],
};
const pregError = (c) => (PREG_ERR[c] ? bi(PREG_ERR[c][0], PREG_ERR[c][1]) : friendly(c));
const pregParte = (estado, ultima) => rpc('business_questions_inbox', {
  p_business: BIZ.id, p_state: estado, p_limit: PREG_POR_PARTE, ...cursorDe(ultima, 'at'),
}).then((x) => x || []);

PAGES.preguntas = async (v) => {
  const [n, primera] = await Promise.all([
    rpc('business_question_counts', { p_business: BIZ.id }),
    pregParte(PREG_TAB, null),
  ]);
  const puede = Boolean(n?.can_answer);
  const lista = [...primera];
  let hayMas = primera.length >= PREG_POR_PARTE;
  const tabs = [
    ['pending', bi('Sin contestar', 'To answer'), n?.unanswered],
    ['answered', bi('Contestadas', 'Answered'), n?.answered],
    ['hidden', bi('Ocultas', 'Hidden'), n?.hidden],
  ];
  const vacio = {
    pending: bi('No tienes preguntas sin contestar.', 'You have no questions to answer.'),
    answered: bi('Aún no has contestado ninguna.', "You haven't answered any yet."),
    hidden: bi('No has ocultado ninguna.', "You haven't hidden any."),
  }[PREG_TAB];
  const fila = (q, i) => `<article class="card pregunta-panel">
      <p style="margin:0"><b>${esc(q.question)}</b></p>
      <small class="muted">${esc(fmtDate(q.asked_at))}</small>
      ${q.reported ? ` <span class="tag st-pending">${esc(bi('Denunciada', 'Reported'))}</span>` : ''}
      ${q.hidden_reason ? `<p class="muted" style="margin:6px 0 0">${esc(`${bi('Oculta', 'Hidden')}: ${pregMotivo(q.hidden_reason)}`)}</p>` : ''}
      ${q.answer ? `<div class="respuesta"><b>${esc(bi('Respuesta de', 'Reply from'))} <span>${esc(BIZ.name)}</span></b>${q.answered_at ? `<small class="muted"> · ${esc(fmtDate(q.answered_at))}${q.edited ? ` · ${esc(bi('editada', 'edited'))}` : ''}</small>` : ''}<p>${esc(q.answer).replace(/\n/g, '<br>')}</p></div>` : ''}
      ${puede && PREG_TAB !== 'hidden' ? `<div class="pie">
        <button class="btn sm" type="button" data-ocultar="${i}">${esc(bi('Ocultar', 'Hide'))}</button>
        <button class="btn sm" type="button" data-contestar="${i}">${ms(q.answer ? 'edit' : 'reply')}${esc(q.answer ? bi('Editar respuesta', 'Edit reply') : bi('Contestar', 'Answer'))}</button>
      </div>` : ''}
    </article>`;

  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Preguntas', 'Questions'))}</h1><span class="spacer"></span>
      <a class="btn sm ghost" href="${APP_URL}/b/${esc(BIZ.id)}#preguntas" target="_blank" rel="noopener">${esc(bi('Ver en tu ficha ↗', 'See on your page ↗'))}</a></div>
    ${helpBox(bi('¿Cómo funciona?', 'How does it work?'), bi(
      '<p>La gente pregunta en tu ficha («¿Se puede ir con perro?», «¿Hay que reservar?»). Lo que contestes se verá en tu ficha, debajo de la pregunta, y a quien preguntó le llega un aviso. Nunca verás quién es.</p><p>Si una pregunta no procede, ocúltala con un motivo: se lo diremos a quien la hizo. Si incumple las normas, denúnciala desde tu ficha. Contestan el propietario y los encargados.</p>',
      '<p>People ask on your page (“Can I bring my dog?”, “Do I need to book?”). Your reply shows on your page, under the question, and the person who asked gets a notification. You’ll never see who it is.</p><p>If a question isn’t appropriate, hide it with a reason: we’ll tell the person who asked. If it breaks the rules, report it from your page. The owner and managers answer.</p>'))}
    ${puede ? '' : `<p class="muted">${esc(bi('Contestan el propietario y los encargados.', 'The owner and managers answer.'))}</p>`}
    <div class="seg" role="group" aria-label="${esc(bi('Preguntas', 'Questions'))}">
      ${tabs.map(([k, txt, c]) => `<button type="button" class="btn sm${PREG_TAB === k ? '' : ' ghost'}" aria-pressed="${PREG_TAB === k}" data-pestana="${k}">${esc(c ? `${txt} · ${c}` : txt)}</button>`).join('')}
    </div>
    ${lista.length ? `<div class="preguntas-panel" id="pregLista">${lista.map(fila).join('')}</div>${hayMas ? botonVerMas('preguntas') : ''}`
    : `<div class="card"><p class="muted" style="margin:0">${esc(vacio)}</p></div>`}`;

  $$('[data-pestana]', v).forEach((b) => { b.onclick = () => { PREG_TAB = b.dataset.pestana; route(); }; });
  const conecta = () => {
    $$('[data-contestar]', v).forEach((b) => { b.onclick = async () => {
      const q = lista[+b.dataset.contestar];
      const out = await modal({
        title: bi('Tu respuesta', 'Your reply'),
        intro: esc(`«${q.question}»`) + '<br>' + esc(bi('Se verá en tu ficha, debajo de la pregunta.', 'It will show on your page, under the question.')),
        fields: [{ name: 'answer', label: bi('Respuesta', 'Reply'), type: 'textarea', value: q.answer || '', maxlength: 1000, rows: 6,
          placeholder: bi('Escribe tu respuesta', 'Write your reply') }],
        submit: bi('Publicar', 'Publish'),
      });
      if (!out) return;
      const texto = out.answer.trim();
      if (texto === (q.answer || '')) return;
      if (texto.length < 2) { toast(pregError('too_short'), true); return; }
      const res = await rpc('answer_business_question', { p_id: q.id, p_text: texto }).catch((e) => ({ ok: false, error: e.clave || e.message }));
      if (!res?.ok) { toast(pregError(res?.error), true); return; }
      toast(res.first ? bi('Respuesta publicada', 'Reply published') : bi('Respuesta cambiada', 'Reply updated'));
      route();
    }; });
    $$('[data-ocultar]', v).forEach((b) => { b.onclick = async () => {
      const q = lista[+b.dataset.ocultar];
      const out = await modal({
        title: bi('¿Por qué la ocultas?', 'Why are you hiding it?'),
        intro: esc(`«${q.question}»`) + '<br>' + esc(bi('Se lo diremos a quien preguntó.', "We'll tell the person who asked.")),
        fields: [{ name: 'reason', label: bi('Motivo', 'Reason'), type: 'select', value: '',
          options: [['', bi('Elige un motivo', 'Choose a reason')], ...PREG_MOTIVOS.map((m) => [m[0], bi(m[1], m[2])])] }],
        submit: bi('Ocultar', 'Hide'),
      });
      if (!out) return;
      if (!out.reason) { toast(bi('Elige un motivo.', 'Choose a reason.'), true); return; }
      const res = await rpc('hide_business_question', { p_id: q.id, p_reason: out.reason }).catch((e) => ({ ok: false, error: e.clave || e.message }));
      if (!res?.ok) { toast(pregError(res?.error), true); return; }
      toast(bi('Pregunta oculta. Se lo hemos dicho a quien preguntó.', "Question hidden. We've told the person who asked."));
      route();
    }; });
  };
  conecta();
  const mas = () => {
    const b = $('[data-ver-mas="preguntas"]', v);
    if (!b) return;
    b.onclick = async () => {
      b.disabled = true;
      try {
        const desde = lista.length;
        const parte = await pregParte(PREG_TAB, lista[lista.length - 1]);
        lista.push(...parte);
        hayMas = parte.length >= PREG_POR_PARTE;
        $('#pregLista', v).insertAdjacentHTML('beforeend', parte.map((q, k) => fila(q, desde + k)).join(''));
        b.closest('.ver-mas').remove();
        if (hayMas) { $('#pregLista', v).insertAdjacentHTML('afterend', botonVerMas('preguntas')); mas(); }
        I18N.translate($('#pregLista', v));
        conecta();
      } catch (e) { toast(friendly(e.message), true); b.disabled = false; }
    };
  };
  mas();
};
