// «Preguntas al reservar» (Iván, 2026-11-17), igual que la app
// (lib/features/booking_questions). Todo detrás de
// `app_config.booking_questions` (migraciones 20261284300000, 20261284350000
// y 20261284350010 de la app): apagado, `booking_questions_for` dice
// `enabled: false` y no sale nada.
//
//   · El negocio (panel): en un evento con «Reserva de plaza», hasta 20
//     preguntas (Respuesta corta · Sí o no · Elegir una opción · Elegir
//     varias · Número · Fecha), cada una obligatoria o no y, si es sobre
//     salud, marcada: se marca sola con las palabras de salud (la lista de la
//     base, `booking_health_terms()`), no se desmarca y no puede ser
//     obligatoria. Con respuestas ya dadas, las que hay no se cambian ni se
//     quitan (solo «Obligatoria»); se pueden añadir otras al final.
//   · Quien reserva («Tu cuenta»): las contesta antes de reservar; la de
//     salud, solo si marca la casilla del consentimiento (sin marcar de
//     inicio). Se mandan en cuanto la reserva existe (`set_booking_answers`,
//     con `p_consents`), las cambia desde su código mientras la reserva siga
//     en pie y puede retirar el consentimiento siempre
//     (`withdraw_booking_consent`).
//   · Asistentes (panel): el resumen por pregunta («Sí 12 · No 3», «Suma 5 ·
//     Media 2,5»…) y la respuesta en cada fila; el CSV, una columna por
//     pregunta. Las de salud, marcadas.
//
// Lo de aquí arriba (KlPreguntas) no toca la página ni sabe nada de
// «oferta»: recibe preguntas y respuestas (sirve igual para otras reservas,
// como mesa o cita). Lo prueba tools/preguntas_reservar_check.mjs (fichero:
// assets/cuenta/reservar_preguntas.js).
'use strict';

const KlPreguntas = (() => {
  const MAX = 20;
  const MAX_OPC = 12;
  const TIPOS = ['text', 'yesno', 'choice', 'multi', 'number', 'date'];
  const conOpciones = (t) => t === 'choice' || t === 'multi';
  const limpiaTxt = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
  /** «S, M, L» → ['S', 'M', 'L']. */
  const opciones = (s) => String(s ?? '').split(',').map(limpiaTxt).filter(Boolean);
  /** Un número entero o null. */
  const entero = (v) => (v === '' || v == null || !/^-?\d{1,9}$/.test(String(v).trim()) ? null : Number(String(v).trim()));

  // ── Salud: la misma lista y la misma regla que la base ───────────────────
  /** Como `booking_health_norm`: minúsculas, sin tildes, ñ → nh, sin
   * apóstrofos y sin el punto volado catalán. */
  const norm = (s) => String(s ?? '').toLowerCase().replace(/ñ/g, 'nh')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/ø/g, 'o')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/_/g, ' ').replace(/['’`´]/g, '').replace(/l[·.]l/g, 'll').replace(/·/g, '')
    .trim();
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reTermino = ({ t, m }) => {
    const base = String(t).trim().split(/\s+/).map(escRe).join('[^\\p{L}\\p{N}]+');
    return new RegExp(`(?<![\\p{L}\\p{N}])${m === 'any' ? '[\\p{L}\\p{N}]*' : ''}${base}${m === 'word' ? '' : '[\\p{L}\\p{N}]*'}(?![\\p{L}\\p{N}])`, 'u');
  };
  /** Las palabras de la lista ([{t, m}]) que hay en un texto. */
  const palabrasSalud = (texto, terminos) => {
    const x = norm(texto);
    return x ? (terminos || []).filter((w) => reTermino(w).test(x)).map((w) => w.t) : [];
  };
  /** ¿Tiene palabras de salud la pregunta (texto u opciones)? */
  const detectaSalud = (q, terminos) => palabrasSalud(
    [q.text, ...(conOpciones(q.type) ? q.options || [] : [])].join(' '), terminos).length > 0;

  /** Lo mismo que comprueba la base (`booking_questions_norm`). */
  const valida = (q) => {
    const t = limpiaTxt(q && q.text);
    if (t.length < 3 || t.length > 120 || !TIPOS.includes(q.type)) return false;
    if (q.type === 'number') {
      const a = entero(q.min);
      const b = entero(q.max);
      return a == null || b == null || a <= b;
    }
    if (!conOpciones(q.type)) return true;
    const vistos = new Set();
    for (const o of q.options || []) {
      const x = limpiaTxt(o);
      if (!x || x.length > 40 || vistos.has(x.toLowerCase())) return false;
      vistos.add(x.toLowerCase());
    }
    return vistos.size >= 2 && vistos.size <= MAX_OPC;
  };
  /** Lo que se manda a la base: la de salud (marcada o con palabras de
   * salud), nunca obligatoria. */
  const paraGuardar = (qs, terminos = []) => (qs || []).map((q) => {
    const health = !!q.health || detectaSalud(q, terminos);
    return {
      id: q.id, text: limpiaTxt(q.text), type: q.type, required: !!q.required && !health, health,
      options: conOpciones(q.type) ? (q.options || []).map(limpiaTxt).filter(Boolean) : [],
      ...(q.type === 'number' ? { min: entero(q.min), max: entero(q.max) } : {}),
    };
  });
  /** Un id que no tiene ninguna («q1», «q2»…). */
  const idNuevo = (qs) => {
    const usados = new Set((qs || []).map((q) => q.id));
    for (let i = 1; ; i++) if (!usados.has(`q${i}`)) return `q${i}`;
  };
  /** Igual salvo «Obligatoria» (con respuestas, es lo único que cambia). */
  const igual = (a, b) => a.id === b.id && limpiaTxt(a.text) === limpiaTxt(b.text) && a.type === b.type
    && !!a.health === !!b.health && entero(a.min) === entero(b.min) && entero(a.max) === entero(b.max)
    && (!conOpciones(a.type) || (a.options || []).map(limpiaTxt).join('\n') === (b.options || []).map(limpiaTxt).join('\n'));

  /** «Elegir varias»: las elegidas, separadas por un salto de línea, en el
   * orden del negocio (como las guarda la base). */
  const varias = (v) => String(v ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  const juntaVarias = (elegidas, q) => (q.options || []).filter((o) => elegidas.includes(o)).join('\n');
  const fecha = (v) => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : null;
    if (!d || Number.isNaN(d.getTime())) return v;
    const lang = typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined;
    try { return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return v; }
  };
  const numero = (n) => {
    const lang = typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined;
    try { return Number(n).toLocaleString(lang, { maximumFractionDigits: 1 }); } catch { return String(n); }
  };
  /** Sí / No en el idioma de quien mira; varias, con comas; la fecha, en su
   * formato; lo demás, tal cual. */
  const textoRespuesta = (q, v, tr) => {
    if (q.type === 'yesno') return v === 'yes' ? tr('Sí') : v === 'no' ? tr('No') : v;
    if (q.type === 'multi') return varias(v).join(', ');
    if (q.type === 'date') return fecha(v);
    return v;
  };
  /** «De 0 a 4», «Desde 1», «Hasta 10» (o '' sin límites). */
  const rango = (q, tr) => {
    const a = entero(q.min);
    const b = entero(q.max);
    if (a != null && b != null) return tr('De {min} a {max}').replace('{min}', a).replace('{max}', b);
    if (a != null) return tr('Desde {min}').replace('{min}', a);
    if (b != null) return tr('Hasta {max}').replace('{max}', b);
    return '';
  };
  /** La pregunta con su marca si es de salud. */
  const etiqueta = (q, tr) => (q.health ? `${q.text} · ${tr('Dato de salud')}` : q.text);
  /** «Sí 12 · No 3», «S 4 · M 6 · L 0», «Suma 5 · Media 2,5 · 2 de 3 han
   * respondido», «24 dic 2026 (2)» o «8 de 15 han respondido». */
  const resumen = (q, s, total, tr) => {
    const respondido = () => tr('{answered} de {total} han respondido').replace('{answered}', s?.answered ?? 0).replace('{total}', total ?? 0);
    if (q.type === 'yesno') return `${tr('Sí')} ${s?.counts?.yes ?? 0} · ${tr('No')} ${s?.counts?.no ?? 0}`;
    if (conOpciones(q.type)) {
      const c = Array.isArray(s?.counts) ? s.counts : [];
      return (q.options || []).map((o) => `${o} ${c.find((x) => x.value === o)?.count ?? 0}`).join(' · ');
    }
    if (q.type === 'number' && s?.stats) {
      return `${tr('Suma {sum} · Media {avg}').replace('{sum}', numero(s.stats.sum)).replace('{avg}', numero(s.stats.avg))} · ${respondido()}`;
    }
    if (q.type === 'date' && Array.isArray(s?.counts) && s.counts.length) {
      return s.counts.map((x) => `${fecha(x.value)} (${x.count})`).join(' · ');
    }
    return respondido();
  };
  /** Qué le pasa a una respuesta, o null si vale (como
   * `booking_answers_norm`). */
  const problema = (q, valor) => {
    const v = q.type === 'multi' ? varias(valor).join('\n') : limpiaTxt(valor);
    if (!v) return q.required ? 'answer_required' : null;
    if (q.type === 'text') return v.length > 200 ? 'answer_too_long' : null;
    if (q.type === 'yesno') return v === 'yes' || v === 'no' ? null : 'bad_answers';
    if (q.type === 'choice') return (q.options || []).includes(v) ? null : 'bad_answers';
    if (q.type === 'multi') return varias(v).every((x) => (q.options || []).includes(x)) ? null : 'bad_answers';
    if (q.type === 'number') {
      const n = entero(v);
      if (n == null) return 'bad_answers';
      const a = entero(q.min);
      const b = entero(q.max);
      return (a != null && n < a) || (b != null && n > b) ? 'answer_out_of_range' : null;
    }
    if (q.type === 'date') {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`) : null;
      return d && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? null : 'bad_answers';
    }
    return 'bad_answers';
  };
  /** Las respuestas de un formulario: { ok, answers, consents } o
   * { ok: false, falta, error } (el id de la primera que no vale).
   * `leer(q)`: el valor; `consentidas`: las de salud con la casilla
   * marcada (sin ella, esa respuesta no cuenta). */
  const respuestas = (qs, leer, consentidas = new Set()) => {
    const answers = {};
    const consents = [];
    for (const q of qs || []) {
      const abierta = !q.health || consentidas.has(q.id);
      let v = abierta ? String(leer(q) ?? '') : '';
      v = q.type === 'multi' ? varias(v).join('\n') : limpiaTxt(v);
      if (q.type === 'text') v = v.slice(0, 200);
      const p = problema(q, v);
      if (p) return { ok: false, falta: q.id, error: p };
      if (!v) continue;
      answers[q.id] = v;
      if (q.health) consents.push(q.id);
    }
    return { ok: true, answers, consents };
  };
  return {
    MAX, MAX_OPC, TIPOS, valida, paraGuardar, idNuevo, igual, opciones, textoRespuesta, resumen, respuestas,
    problema, rango, etiqueta, varias, juntaVarias, norm, palabrasSalud, detectaSalud, conOpciones,
  };
})();
if (typeof module !== 'undefined') module.exports = KlPreguntas;

// ── «Tu cuenta»: contestar ─────────────────────────────────────────────────
/** Los campos de unas preguntas (con lo ya contestado en `ans` y los
 * consentimientos ya dados en `cons`). */
function camposPreguntas(qs, ans = {}, cons = [], negocio = '') {
  return (qs || []).map((q, i) => {
    const id = `bq-${i}`;
    const v = ans[q.id] || '';
    const abierta = !q.health || (cons.includes(q.id) && v);
    const off = abierta ? '' : 'disabled';
    const etq = `${esc(q.text)}${q.required ? ` <small class="muted">(${esc(t('obligatoria'))})</small>` : ''}`;
    const casilla = q.health ? `<label class="check consentimiento"><input type="checkbox" data-consent="${esc(q.id)}" ${abierta ? 'checked' : ''}>
        <span>${esc(t('Acepto que {negocio} vea esta respuesta, que puede ser un dato de salud, solo para preparar este evento. Se borra al día siguiente del evento.').replace('{negocio}', negocio || ''))}</span></label>` : '';
    if (q.type === 'yesno' || q.type === 'choice' || q.type === 'multi') {
      const multi = q.type === 'multi';
      const elegidas = multi ? KlPreguntas.varias(v) : [v];
      const ops = q.type === 'yesno' ? [['yes', t('Sí')], ['no', t('No')]] : (q.options || []).map((o) => [o, o]);
      return `<fieldset class="plazas pregunta" data-q="${esc(q.id)}"><legend>${etq}</legend>${casilla}
        ${ops.map(([val, txt]) => `<label class="check"><input type="${multi ? 'checkbox' : 'radio'}" name="${id}" value="${esc(val)}" ${abierta && elegidas.includes(val) ? 'checked' : ''} ${off}> <span>${esc(txt)}</span></label>`).join('')}
        <p class="err" role="alert"></p></fieldset>`;
    }
    const r = q.type === 'number' ? KlPreguntas.rango(q, t) : '';
    const tipo = q.type === 'number'
      ? `type="number" inputmode="numeric" step="1"${q.min != null ? ` min="${esc(q.min)}"` : ''}${q.max != null ? ` max="${esc(q.max)}"` : ''}`
      : q.type === 'date' ? 'type="date"' : 'maxlength="200"';
    return `<div class="pregunta" data-q="${esc(q.id)}"><label for="${id}">${etq}</label>
        ${casilla}
        <input id="${id}" name="${id}" ${tipo} value="${esc(abierta ? v : '')}" placeholder="${esc(r || t('Tu respuesta'))}" ${off}>
        ${q.type === 'text' && !q.health ? `<small class="muted">${esc(t('No escribas datos de salud.'))}</small>` : ''}
        ${r ? `<small class="muted">${esc(r)}</small>` : ''}
        <p class="err" role="alert"></p></div>`;
  }).join('');
}

/** La casilla del consentimiento abre o cierra los campos de su pregunta
 * (al cerrarla, la respuesta se borra). */
function enlazaConsentimientos(form) {
  form.addEventListener('change', (ev) => {
    const c = ev.target.closest('input[data-consent]');
    if (!c) return;
    const caja = c.closest('.pregunta');
    caja.querySelectorAll('input:not([data-consent])').forEach((x) => {
      x.disabled = !c.checked;
      if (!c.checked) {
        if (x.type === 'radio' || x.type === 'checkbox') x.checked = false;
        else x.value = '';
      }
    });
  });
}

const ERR_PREGUNTA = {
  answer_required: 'Responde a las preguntas obligatorias.',
  answer_out_of_range: 'Revisa esta respuesta.',
  bad_answers: 'Revisa esta respuesta.',
  answer_too_long: 'Cada respuesta, como mucho 200 letras.',
};

/** Lee el formulario: { answers, consents }, o null (y dice cuál falla). */
function leePreguntas(form, qs) {
  const consentidas = new Set([...form.querySelectorAll('input[data-consent]:checked')].map((x) => x.dataset.consent));
  const r = KlPreguntas.respuestas(qs, (q) => {
    const caja = form.querySelector(`[data-q="${CSS.escape(q.id)}"]`);
    if (!caja) return '';
    if (q.type === 'multi') {
      return [...caja.querySelectorAll('input[type="checkbox"]:not([data-consent]):checked')].map((x) => x.value).join('\n');
    }
    const marcado = caja.querySelector('input[type="radio"]:checked');
    return marcado ? marcado.value : (caja.querySelector('input:not([type="radio"]):not([type="checkbox"])')?.value || '');
  }, consentidas);
  form.querySelectorAll('.pregunta .err').forEach((e) => { e.textContent = ''; });
  if (r.ok) return { answers: r.answers, consents: r.consents };
  const caja = form.querySelector(`[data-q="${CSS.escape(r.falta)}"]`);
  const err = caja && caja.querySelector('.err');
  if (err) err.textContent = t(ERR_PREGUNTA[r.error] || 'Revisa esta respuesta.');
  caja?.querySelector('input:not([disabled])')?.focus();
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
function guardaRespuestas(offerId, answers, consents = []) {
  try {
    if (!answers) sessionStorage.removeItem(PREGUNTAS_PENDIENTES);
    else sessionStorage.setItem(PREGUNTAS_PENDIENTES, JSON.stringify({ o: offerId, a: answers, c: consents, t: Date.now() }));
  } catch { /* sin almacenamiento: se contestan luego desde el código */ }
}
function tomaRespuestas(offerId) {
  try {
    const m = JSON.parse(sessionStorage.getItem(PREGUNTAS_PENDIENTES) || 'null');
    sessionStorage.removeItem(PREGUNTAS_PENDIENTES);
    return m && m.o === offerId && Date.now() - m.t < 15 * 60 * 1000 ? { answers: m.a, consents: m.c || [] } : null;
  } catch { return null; }
}
/** En cuanto la reserva existe. Si falla, la reserva sigue: se contestan
 * desde el código. */
async function aplicaRespuestas(offerId, pendientes) {
  const answers = pendientes && pendientes.answers;
  if (!answers || !Object.keys(answers).length) return;
  try {
    const r = await llamar('set_booking_answers', { p_offer: offerId, p_answers: answers, p_consents: pendientes.consents || [] });
    if (r && r.ok === false) throw new Error(r.error || 'unknown');
  } catch (e) {
    console.warn('preguntas', e);
    if (typeof toast === 'function') toast(t('No se han podido guardar tus respuestas: contéstalas desde tu código.'), true);
  }
}

/** Una pantalla con las preguntas (antes de reservar o para cambiarlas).
 * `encima`: lo que va antes (p. ej. «¿Para cuántos?»). Devuelve
 * { answers, consents, form } al pulsar el botón; Cancelar vuelve a
 * `volver`. */
function pantallaPreguntas({ titulo, encima = '', qs, ans = {}, cons = [], negocio, boton, volver, crumbs = '' }) {
  return new Promise((sigue) => {
    pinta(`
      ${crumbs}
      <h1>${esc(titulo)}</h1>
      <p class="muted">${esc(t('{negocio} verá tus respuestas solo para organizar este evento.').replace('{negocio}', negocio || ''))}</p>
      <form class="formu" id="f-preguntas" novalidate>
        ${encima}
        ${camposPreguntas(qs, ans, cons, negocio)}
        <p class="acciones">
          <button class="pill accent" id="g-preguntas">${esc(boton)}</button>
          <a class="pill" href="${esc(volver)}">${esc(t('Cancelar'))}</a>
        </p>
      </form>`);
    enlazaConsentimientos($('#f-preguntas'));
    $('#f-preguntas').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const r = leePreguntas(ev.currentTarget, qs);
      if (r) sigue({ answers: r.answers, consents: r.consents, form: ev.currentTarget });
    });
    if (typeof I18N !== 'undefined') I18N.translate(view);
  });
}

/** En el código: «Tus respuestas», «Cambiar respuestas» (mientras la
 * reserva siga en pie) y, si respondió alguna de salud, «Retirar mi
 * consentimiento» (siempre). `antes`: lo que se estaba guardando. */
async function pintaTusRespuestas(offerId, antes) {
  await antes;
  const caja = $('#tusRespuestas');
  if (!caja) return;
  const info = await preguntasDe(offerId);
  const qs = info.questions || [];
  if (!qs.length || !info.mine) return;
  const r = info.mine.answers || {};
  const dichas = qs.filter((q) => r[q.id]);
  const salud = dichas.some((q) => q.health);
  caja.innerHTML = `<h2>${esc(t('Tus respuestas'))}</h2>
    ${dichas.length ? `<dl>${dichas.map((q) => `<dt>${esc(KlPreguntas.etiqueta(q, t))}</dt><dd>${esc(KlPreguntas.textoRespuesta(q, r[q.id], t))}</dd>`).join('')}</dl>`
    : `<p class="muted">${esc(t('Aún no has respondido a las preguntas del negocio.'))}</p>`}
    <p>${info.mine.editable ? `<a class="pill" href="/cuenta/respuestas/${esc(offerId)}">${esc(dichas.length ? t('Cambiar respuestas') : t('Responder'))}</a>` : ''}
    ${salud ? `<button type="button" class="pill" id="retiraConsentimiento">${esc(t('Retirar mi consentimiento'))}</button>` : ''}</p>`;
  caja.hidden = false;
  $('#retiraConsentimiento')?.addEventListener('click', async () => {
    try {
      await llamar('withdraw_booking_consent', { p_offer: offerId });
      toast(t('Consentimiento retirado: hemos borrado tus respuestas de salud.'));
    } catch { toast(t('No se han podido guardar tus respuestas. Inténtalo de nuevo.'), true); }
    pintaTusRespuestas(offerId, null);
  });
  if (typeof I18N !== 'undefined') I18N.translate(caja);
}

const ERR_RESPUESTAS = {
  answer_required: 'Responde a las preguntas obligatorias.',
  answer_too_long: 'Cada respuesta, como mucho 200 letras.',
  answer_out_of_range: 'Revisa esta respuesta.',
  health_consent_required: 'Para responder a una pregunta de salud, marca su casilla.',
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
  let cons = Object.keys(info.mine.consents || {});
  for (;;) {
    const { answers, consents } = await pantallaPreguntas({
      titulo: t('Tus respuestas'), qs: info.questions, ans: info.mine.answers || {}, cons,
      negocio: o.business_name, boton: t('Guardar'), volver,
      crumbs: `<p class="crumbs"><a href="${esc(volver)}">${esc(o.title || t('Tu código'))}</a></p>`,
    });
    const r = await llamar('set_booking_answers', { p_offer: id, p_answers: answers, p_consents: consents })
      .catch((e) => ({ ok: false, error: e.clave || 'x' }));
    if (r && r.ok) {
      toast(t('Respuestas guardadas.'));
      irA(`codigo/${encodeURIComponent(id)}`, { reemplaza: true });
      return;
    }
    toast(t(ERR_RESPUESTAS[r?.error] || 'No se han podido guardar tus respuestas. Inténtalo de nuevo.'), true);
    info.mine.answers = answers;
    cons = consents;
  }
};
}
