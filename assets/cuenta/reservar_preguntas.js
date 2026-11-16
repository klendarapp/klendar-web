// «Preguntas al reservar» (Iván, 2026-11-17), igual que la app
// (lib/features/booking_questions). Todo detrás de
// `app_config.booking_questions` (migración 20261284300000 de la app):
// apagado, `booking_questions_for` dice `enabled: false` y no sale nada.
//
//   · El negocio (panel): en un evento con «Reserva de plaza», hasta 5
//     preguntas (Respuesta corta · Sí o no · Elegir una opción), cada una
//     obligatoria o no, con el aviso fijo de no pedir datos de salud. Con
//     respuestas ya dadas, las que hay no se cambian ni se quitan (solo
//     «Obligatoria»); se pueden añadir otras al final.
//   · Quien reserva («Tu cuenta»): las contesta antes de reservar (bajo las
//     libres, «No escribas datos de salud.»), se mandan en cuanto la reserva
//     existe (`set_booking_answers`) y las cambia desde su código mientras
//     la reserva siga en pie.
//   · Asistentes (panel): el resumen por pregunta («Sí 12 · No 3») y la
//     respuesta en cada fila; el CSV, una columna por pregunta.
//
// Lo de aquí arriba (KlPreguntas) no toca la página: lo prueba
// tools/preguntas_reservar_check.mjs (fichero: assets/cuenta/reservar_preguntas.js).
'use strict';

const KlPreguntas = (() => {
  const MAX = 5;
  const TIPOS = ['text', 'yesno', 'choice'];
  const limpiaTxt = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
  /** «S, M, L» → ['S', 'M', 'L']. */
  const opciones = (s) => String(s ?? '').split(',').map(limpiaTxt).filter(Boolean);
  /** Lo mismo que comprueba la base (`booking_questions_norm`). */
  const valida = (q) => {
    const t = limpiaTxt(q && q.text);
    if (t.length < 3 || t.length > 120 || !TIPOS.includes(q.type)) return false;
    if (q.type !== 'choice') return true;
    const vistos = new Set();
    for (const o of q.options || []) {
      const x = limpiaTxt(o);
      if (!x || x.length > 40 || vistos.has(x.toLowerCase())) return false;
      vistos.add(x.toLowerCase());
    }
    return vistos.size >= 2 && vistos.size <= 8;
  };
  /** Lo que se manda a la base. */
  const paraGuardar = (qs) => (qs || []).map((q) => ({
    id: q.id, text: limpiaTxt(q.text), type: q.type, required: !!q.required,
    options: q.type === 'choice' ? (q.options || []).map(limpiaTxt).filter(Boolean) : [],
  }));
  /** Un id que no tiene ninguna («q1», «q2»…). */
  const idNuevo = (qs) => {
    const usados = new Set((qs || []).map((q) => q.id));
    for (let i = 1; ; i++) if (!usados.has(`q${i}`)) return `q${i}`;
  };
  /** Igual salvo «Obligatoria» (con respuestas, es lo único que cambia). */
  const igual = (a, b) => a.id === b.id && limpiaTxt(a.text) === limpiaTxt(b.text) && a.type === b.type
    && (a.type !== 'choice' || (a.options || []).map(limpiaTxt).join('\n') === (b.options || []).map(limpiaTxt).join('\n'));
  /** Sí / No en el idioma de quien mira; lo demás, tal cual. */
  const textoRespuesta = (q, v, tr) => (q.type === 'yesno' ? (v === 'yes' ? tr('Sí') : v === 'no' ? tr('No') : v) : v);
  /** «Sí 12 · No 3», «S 4 · M 6 · L 0» o «8 de 15 han respondido». */
  const resumen = (q, s, total, tr) => {
    if (q.type === 'yesno') return `${tr('Sí')} ${s?.counts?.yes ?? 0} · ${tr('No')} ${s?.counts?.no ?? 0}`;
    if (q.type === 'choice') {
      const c = Array.isArray(s?.counts) ? s.counts : [];
      return (q.options || []).map((o) => `${o} ${c.find((x) => x.value === o)?.count ?? 0}`).join(' · ');
    }
    return tr('{answered} de {total} han respondido').replace('{answered}', s?.answered ?? 0).replace('{total}', total ?? 0);
  };
  /** Las respuestas de un formulario: { ok, answers } o { ok: false, falta }
   * (el id de la primera obligatoria sin responder). `leer(q)`: el valor. */
  const respuestas = (qs, leer) => {
    const answers = {};
    for (const q of qs || []) {
      const v = limpiaTxt(leer(q));
      if (!v) {
        if (q.required) return { ok: false, falta: q.id };
        continue;
      }
      answers[q.id] = q.type === 'text' ? v.slice(0, 200) : v;
    }
    return { ok: true, answers };
  };
  return { MAX, valida, paraGuardar, idNuevo, igual, opciones, textoRespuesta, resumen, respuestas };
})();
if (typeof module !== 'undefined') module.exports = KlPreguntas;

// ── «Tu cuenta»: contestar ─────────────────────────────────────────────────
/** Los campos de unas preguntas (con lo ya contestado en `ans`). */
function camposPreguntas(qs, ans = {}) {
  return (qs || []).map((q, i) => {
    const id = `bq-${i}`;
    const v = ans[q.id] || '';
    const etq = `${esc(q.text)}${q.required ? ` <small class="muted">(${esc(t('obligatoria'))})</small>` : ''}`;
    if (q.type === 'yesno' || q.type === 'choice') {
      const ops = q.type === 'yesno' ? [['yes', t('Sí')], ['no', t('No')]] : (q.options || []).map((o) => [o, o]);
      return `<fieldset class="plazas pregunta" data-q="${esc(q.id)}"><legend>${etq}</legend>
        ${ops.map(([val, txt]) => `<label class="check"><input type="radio" name="${id}" value="${esc(val)}" ${v === val ? 'checked' : ''}> <span>${esc(txt)}</span></label>`).join('')}
        <p class="err" role="alert"></p></fieldset>`;
    }
    return `<div class="pregunta" data-q="${esc(q.id)}"><label>${etq}
        <input name="${id}" maxlength="200" value="${esc(v)}" placeholder="${esc(t('Tu respuesta'))}"></label>
        <small class="muted">${esc(t('No escribas datos de salud.'))}</small>
        <p class="err" role="alert"></p></div>`;
  }).join('');
}

/** Lee el formulario: las respuestas, o null (y dice cuál falta). */
function leePreguntas(form, qs) {
  const r = KlPreguntas.respuestas(qs, (q) => {
    const caja = form.querySelector(`[data-q="${CSS.escape(q.id)}"]`);
    if (!caja) return '';
    const marcado = caja.querySelector('input[type="radio"]:checked');
    return marcado ? marcado.value : (caja.querySelector('input:not([type="radio"])')?.value || '');
  });
  form.querySelectorAll('.pregunta .err').forEach((e) => { e.textContent = ''; });
  if (r.ok) return r.answers;
  const caja = form.querySelector(`[data-q="${CSS.escape(r.falta)}"]`);
  const err = caja && caja.querySelector('.err');
  if (err) err.textContent = t('Responde a las preguntas obligatorias.');
  caja?.querySelector('input')?.focus();
  return null;
}

/** `booking_questions_for`: { enabled, questions, mine }. Sin red, apagado. */
async function preguntasDe(offerId) {
  try {
    const r = await llamar('booking_questions_for', { p_offer: offerId });
    return r && r.enabled ? r : { enabled: false, questions: [] };
  } catch { return { enabled: false, questions: [] }; }
}

/** Lo contestado antes de ir a la pantalla del código (sessionStorage, 15 min). */
const PREGUNTAS_PENDIENTES = 'klendar.preguntas';
function guardaRespuestas(offerId, answers) {
  try {
    if (!answers) sessionStorage.removeItem(PREGUNTAS_PENDIENTES);
    else sessionStorage.setItem(PREGUNTAS_PENDIENTES, JSON.stringify({ o: offerId, a: answers, t: Date.now() }));
  } catch { /* sin almacenamiento: se contestan luego desde el código */ }
}
function tomaRespuestas(offerId) {
  try {
    const m = JSON.parse(sessionStorage.getItem(PREGUNTAS_PENDIENTES) || 'null');
    sessionStorage.removeItem(PREGUNTAS_PENDIENTES);
    return m && m.o === offerId && Date.now() - m.t < 15 * 60 * 1000 ? m.a : null;
  } catch { return null; }
}
/** En cuanto la reserva existe. Si falla, la reserva sigue: se contestan
 * desde el código. */
async function aplicaRespuestas(offerId, answers) {
  if (!answers || !Object.keys(answers).length) return;
  try {
    const r = await llamar('set_booking_answers', { p_offer: offerId, p_answers: answers });
    if (r && r.ok === false) throw new Error(r.error || 'unknown');
  } catch (e) {
    console.warn('preguntas', e);
    if (typeof toast === 'function') toast(t('No se han podido guardar tus respuestas: contéstalas desde tu código.'), true);
  }
}

/** Una pantalla con las preguntas (antes de reservar o para cambiarlas).
 * `encima`: lo que va antes (p. ej. «¿Para cuántos?»). Devuelve
 * { answers, form } al pulsar el botón; Cancelar vuelve a `volver`. */
function pantallaPreguntas({ titulo, encima = '', qs, ans = {}, negocio, boton, volver, crumbs = '' }) {
  return new Promise((sigue) => {
    pinta(`
      ${crumbs}
      <h1>${esc(titulo)}</h1>
      <p class="muted">${esc(t('{negocio} verá tus respuestas solo para organizar este evento.').replace('{negocio}', negocio || ''))}</p>
      <form class="formu" id="f-preguntas" novalidate>
        ${encima}
        ${camposPreguntas(qs, ans)}
        <p class="acciones">
          <button class="pill accent" id="g-preguntas">${esc(boton)}</button>
          <a class="pill" href="${esc(volver)}">${esc(t('Cancelar'))}</a>
        </p>
      </form>`);
    $('#f-preguntas').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const answers = leePreguntas(ev.currentTarget, qs);
      if (answers) sigue({ answers, form: ev.currentTarget });
    });
    if (typeof I18N !== 'undefined') I18N.translate(view);
  });
}

/** En el código: «Tus respuestas» y «Cambiar respuestas» (mientras la
 * reserva siga en pie). `antes`: lo que se estaba guardando. */
async function pintaTusRespuestas(offerId, antes) {
  await antes;
  const caja = $('#tusRespuestas');
  if (!caja) return;
  const info = await preguntasDe(offerId);
  const qs = info.questions || [];
  if (!qs.length || !info.mine) return;
  const r = info.mine.answers || {};
  const dichas = qs.filter((q) => r[q.id]);
  caja.innerHTML = `<h2>${esc(t('Tus respuestas'))}</h2>
    ${dichas.length ? `<dl>${dichas.map((q) => `<dt>${esc(q.text)}</dt><dd>${esc(KlPreguntas.textoRespuesta(q, r[q.id], t))}</dd>`).join('')}</dl>`
    : `<p class="muted">${esc(t('Aún no has respondido a las preguntas del negocio.'))}</p>`}
    ${info.mine.editable ? `<p><a class="pill" href="/cuenta/respuestas/${esc(offerId)}">${esc(dichas.length ? t('Cambiar respuestas') : t('Responder'))}</a></p>` : ''}`;
  caja.hidden = false;
  if (typeof I18N !== 'undefined') I18N.translate(caja);
}

const ERR_RESPUESTAS = {
  answer_required: 'Responde a las preguntas obligatorias.',
  answer_too_long: 'Cada respuesta, como mucho 200 letras.',
  not_found: 'Tu reserva ya no está en pie: las respuestas ya no se cambian.',
  rate_limited: 'Demasiados cambios seguidos. Prueba dentro de un rato.',
};

// Cambiar las respuestas de una reserva en pie (en node, para la prueba, no
// hay RUTAS).
if (typeof RUTAS !== 'undefined') {
RUTAS.respuestas = async ([id]) => {
  if (!exigeSesion(`respuestas/${id}`)) return;
  const volver = `/cuenta/codigo/${encodeURIComponent(id)}`;
  const info = await preguntasDe(id);
  if (!(info.questions || []).length || !info.mine || !info.mine.editable) {
    irA(`codigo/${encodeURIComponent(id)}`, { reemplaza: true });
    return;
  }
  const fila = await llamar('offer_detail', { p_id: id, p_rp: null }).catch(() => null);
  const o = (Array.isArray(fila) ? fila[0] : fila) || {};
  for (;;) {
    const { answers } = await pantallaPreguntas({
      titulo: t('Tus respuestas'), qs: info.questions, ans: info.mine.answers || {},
      negocio: o.business_name, boton: t('Guardar'), volver,
      crumbs: `<p class="crumbs"><a href="${esc(volver)}">${esc(o.title || t('Tu código'))}</a></p>`,
    });
    const r = await llamar('set_booking_answers', { p_offer: id, p_answers: answers }).catch((e) => ({ ok: false, error: e.clave || 'x' }));
    if (r && r.ok) {
      toast(t('Respuestas guardadas.'));
      irA(`codigo/${encodeURIComponent(id)}`, { reemplaza: true });
      return;
    }
    toast(t(ERR_RESPUESTAS[r?.error] || 'No se han podido guardar tus respuestas. Inténtalo de nuevo.'), true);
    info.mine.answers = answers;
  }
};
}
