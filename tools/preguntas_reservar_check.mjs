// «Preguntas al reservar» (Iván, 2026-11-17): lo que la web tiene que hacer
// igual que la app. Sin navegador ni red: prueba la lógica común
// (assets/cuenta/reservar_preguntas.js) y lee el código. Lo de la base
// (validar, no cambiar con respuestas, quién ve qué, el borrado y el
// interruptor), en la app (tool/preguntas_reservar_smoke.py, migración
// 20261284300000).
//
//   1. Validar como la base: texto de 3 a 120, de 2 a 8 opciones distintas,
//      ids nuevos, lo que se manda y las respuestas (obligatorias, 200 letras).
//   2. El panel: el bloque solo con el interruptor y con «Reserva de plaza»,
//      el aviso de salud, con respuestas las que hay fijas, y los errores.
//   3. Asistentes: el resumen («Sí 12 · No 3»), la respuesta en cada fila,
//      su nota y una columna por pregunta en el CSV.
//   4. «Tu cuenta»: las preguntas antes de reservar (con «¿Para cuántos?»),
//      se mandan en cuanto la reserva existe, «Tus respuestas» en el código
//      y la ruta respuestas/ para cambiarlas.
//   5. El admin ve las preguntas de una publicación (por si van a revisión).
//   6. Salud (20261284350000): las palabras de salud (la lista de la base)
//      marcan la pregunta sola, no se desmarca, no es obligatoria; quien
//      reserva solo responde con la casilla del consentimiento, que va con la
//      respuesta, y lo puede retirar; marcadas en Asistentes y el CSV.
//   7. Tipos y tope (20261284350010): hasta 20; varias, número (mín./máx.) y
//      fecha, con su resumen.
//
//   node tools/preguntas_reservar_check.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const raiz = new URL('..', import.meta.url);
const lee = (f) => readFileSync(new URL(f, raiz), 'utf8');
const KP = createRequire(import.meta.url)('../assets/cuenta/reservar_preguntas.js');
const modulo = lee('assets/cuenta/reservar_preguntas.js');
const editor = lee('panel/preguntas_reservar.js');
const panel = lee('panel/panel.js');
const cuenta = lee('assets/cuenta/app.js');
const admin = lee('admin/admin.js');
const enPanel = lee('panel/i18n.js');
const enCuenta = lee('assets/cuenta/i18n.js');
const htmlPanel = lee('panel.html');
const htmlCuenta = lee('cuenta.html');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};
const tr = (s) => s;

// 1. Como la base
const menu = { id: 'q1', text: '¿Menú infantil?', type: 'yesno', required: true };
const talla = { id: 'q2', text: '¿Talla?', type: 'choice', options: ['S', 'M', 'L'] };
const nota = { id: 'q3', text: '¿Algo más?', type: 'text' };
ok('1. bien', [menu, talla, nota].every(KP.valida));
ok('1. texto corto o largo, no', !KP.valida({ ...nota, text: '¿?' }) && !KP.valida({ ...nota, text: 'a'.repeat(121) }));
ok('1. una opción o repetidas, no', !KP.valida({ ...talla, options: ['S'] }) && !KP.valida({ ...talla, options: ['S', 's'] })
  && !KP.valida({ ...talla, options: Array.from({ length: 13 }, (_, i) => `T${i}`) })
  && KP.valida({ ...talla, options: Array.from({ length: 12 }, (_, i) => `T${i}`) }));
ok('1. ids nuevos', KP.idNuevo([{ id: 'q1' }, { id: 'q3' }]) === 'q2');
ok('1. lo que se manda, limpio', JSON.stringify(KP.paraGuardar([{ ...talla, text: '  ¿Talla?  ', options: [' S', 'M '] }, menu]))
  === JSON.stringify([{ id: 'q2', text: '¿Talla?', type: 'choice', required: false, health: false, options: ['S', 'M'] },
    { id: 'q1', text: '¿Menú infantil?', type: 'yesno', required: true, health: false, options: [] }]));
ok('1. «S, M, L» → tres opciones', JSON.stringify(KP.opciones('S, M,, L ')) === '["S","M","L"]');
{
  const leer = (vals) => (q) => vals[q.id] || '';
  const falta = KP.respuestas([menu, talla], leer({ q2: 'M' }));
  const bien = KP.respuestas([menu, talla, nota], leer({ q1: 'yes', q3: '  ' + 'x'.repeat(250) }));
  ok('1. falta la obligatoria', falta.ok === false && falta.falta === 'q1');
  ok('1. bien: limpias y la libre, hasta 200', bien.ok && bien.answers.q1 === 'yes' && !('q2' in bien.answers)
    && bien.answers.q3.length === 200);
}
ok('1. Sí / No y el resumen como la app', KP.textoRespuesta(menu, 'yes', tr) === 'Sí'
  && KP.resumen(menu, { counts: { yes: 12, no: 3 } }, 15, tr) === 'Sí 12 · No 3'
  && KP.resumen(talla, { counts: [{ value: 'S', count: 4 }, { value: 'M', count: 6 }] }, 15, tr) === 'S 4 · M 6 · L 0'
  && KP.resumen(nota, { answered: 8 }, 15, tr) === '8 de 15 han respondido');
ok('1. con respuestas, igual salvo «Obligatoria»', KP.igual(menu, { ...menu, required: false }) && !KP.igual(menu, { ...menu, text: 'Otra' }));

// 2. El panel
ok('2. se carga en el panel y en «Tu cuenta»', htmlPanel.includes('/assets/cuenta/reservar_preguntas.js?v=')
  && htmlPanel.includes('/panel/preguntas_reservar.js?v=') && htmlCuenta.includes('/assets/cuenta/reservar_preguntas.js?v='));
ok('2. el interruptor manda (sin él, ni sale ni se manda)', panel.includes("const preguntasOn = preguntasInfo.enabled === true")
  && panel.includes("${preguntasOn ? '<div id=\"preguntasRow\"")
  && panel.includes('...(editorP ? { booking_questions: reservas ? editorP.preguntas() : [] } : {}),'));
ok('2. solo con «Reserva de plaza»', panel.includes("if ($('#preguntasRow', v)) $('#preguntasRow', v).hidden = !conReserva;"));
ok('2. al copiar se copian; al editar, con respuestas, las que hay fijas',
  panel.includes("rpc('booking_questions_for', { p_offer: origenLugar || null })")
  && panel.includes('const preguntasFijas = id && preguntasInfo.locked ? (preguntasInfo.questions || []).length : 0;'));
ok('2. el aviso, fijo', editor.includes("tr('Pregunta solo lo que necesites para preparar el evento.')"));
ok('2. con respuestas: no se apaga, no se quitan ni se cambian', editor.includes("${bloqueadas && encendido ? 'disabled' : ''}")
  && editor.includes("${fija ? '' : `<button type=\"button\" class=\"btn sm ghost\" data-p=\"quitar\">"));
ok('2. hasta 20', editor.includes('lista.length < KP.MAX') && KP.MAX === 20);
ok('2. se valida antes de mandar y los errores de la base, en su sitio', panel.includes('!editorP.valida()')
  && /questions_locked: '[^']+'/.test(panel) && /bad_questions: '[^']+'/.test(panel)
  && panel.includes("/questions_locked|bad_questions/.test(msg)"));
ok('2. en inglés', enPanel.includes('"Preguntas al reservar": "Booking questions"')
  && enPanel.includes('"Elegir una opción": "Pick an option"'));

// 3. Asistentes
ok('3. las respuestas las da la base (todo el equipo)', panel.includes("rpc('offer_booking_answers', { p_offer: offerId }).catch(() => null)"));
ok('3. el resumen y la respuesta en cada fila', panel.includes('KP.resumen(q, (respuestasP.summary || []).find((x) => x.id === q.id), respuestasP.reservations, trP)')
  && panel.includes('${respuestasDe(a)}'));
ok('3. la nota de los 7 días', panel.includes('Usa las respuestas solo para este evento. Se borran 7 días después.'));
ok('3. una columna por pregunta en el CSV', panel.includes('...(preguntas || []).map((q) => [(a) => {'));

// 4. «Tu cuenta»
ok('4. antes de reservar, solo en eventos con reserva y sin código vivo',
  cuenta.includes("const bq = !yaTiene && o.kind === 'future_event' && o.reservations_enabled && typeof preguntasDe === 'function'"));
ok('4. «¿Para cuántos?» en la misma pantalla y no se repite con el teléfono',
  cuenta.includes('encima: plazasP, qs: bq.questions') && cuenta.includes('tope > 1 && plazasElegidas == null'));
ok('4. se mandan en cuanto la reserva existe', cuenta.includes('aplicaRespuestas(id, tomaRespuestas(id))')
  && modulo.includes("llamar('set_booking_answers', { p_offer: offerId, p_answers: answers, p_consents: pendientes.consents || [] })")
  && cuenta.includes('guardaRespuestas(id, answers, consents);'));
ok('4. «Tus respuestas» en el código y la ruta para cambiarlas', cuenta.includes('id="tusRespuestas"')
  && modulo.includes('RUTAS.respuestas = async ([id]) =>') && modulo.includes('href="/cuenta/respuestas/${esc(offerId)}"'));
ok('4. «No escribas datos de salud.» bajo las libres', modulo.includes("t('No escribas datos de salud.')"));
ok('4. qué verá el negocio', modulo.includes("t('{negocio} verá tus respuestas solo para organizar este evento.')"));
ok('4. en inglés', enCuenta.includes('"Tus respuestas": "Your answers"') && enCuenta.includes('"No escribas datos de salud.": "Don’t write health information."'));

// 5. Admin
ok('5. el admin ve las preguntas', admin.includes('<dt>Preguntas al reservar</dt>') && admin.includes('· dato de salud'));

// 6. Salud
const terminos = [{ t: 'alerg', m: 'any' }, { t: 'allerg', m: 'any' }, { t: 'gluten', m: 'any' },
  { t: 'celiac', m: 'prefix' }, { t: 'salud', m: 'word' }, { t: 'silla de ruedas', m: 'word' }];
ok('6. las palabras de salud se detectan', ['¿Alguna alergia?', 'Sin gluten', 'Al·lèrgies?', 'Any allergies?', '¿Eres celíaca?',
  'Glutenfrei', '¿Vienes en silla de ruedas?', 'SALUD'].every((x) => KP.palabrasSalud(x, terminos).length));
ok('6. y lo que no es de salud, no', ['¿Menú vegetariano?', 'Saludos', '¿Talla de camiseta?', 'Kids’ menu?']
  .every((x) => !KP.palabrasSalud(x, terminos).length));
{
  const g = KP.paraGuardar([{ id: 'q1', text: '¿Alguna alergia?', type: 'text', required: true },
    { id: 'q2', text: '¿Menú?', type: 'choice', options: ['Normal', 'Sin gluten'] },
    { id: 'q3', text: '¿Algo para el evento?', type: 'text', health: true }, menu], terminos);
  ok('6. se marca sola (texto u opción) o a mano, y nunca es obligatoria', g[0].health && !g[0].required && g[1].health
    && g[2].health && !g[3].health && g[3].required);
}
{
  const salud = { id: 'h1', text: '¿Alguna alergia?', type: 'text', health: true };
  const leer = (q) => ({ h1: 'Frutos secos', q1: 'yes' })[q.id] || '';
  const sin = KP.respuestas([salud, menu], leer);
  const con = KP.respuestas([salud, menu], leer, new Set(['h1']));
  ok('6. sin la casilla, la de salud no cuenta (y se reserva igual)', sin.ok && !('h1' in sin.answers) && !sin.consents.length);
  ok('6. con la casilla, va con su consentimiento', con.ok && con.answers.h1 === 'Frutos secos' && con.consents.join() === 'h1');
}
ok('6. el panel: la lista de la base, la marca y «Obligatoria» sin la de salud',
  panel.includes("rpc('booking_health_terms', {})") && panel.includes('salud: saludTerminos')
  && editor.includes("tr('Es sobre salud (alergias, intolerancias…)')") && editor.includes('h.disabled = fija || det;')
  && editor.includes('r.disabled = s;') && editor.includes('KP.paraGuardar(lista, salud)'));
ok('6. «Tu cuenta»: la casilla, sin marcar, y retirar el consentimiento',
  modulo.includes("t('Acepto que {negocio} vea esta respuesta, que puede ser un dato de salud, solo para preparar este evento. Se borra al día siguiente del evento.')")
  && modulo.includes('enlazaConsentimientos(') && modulo.includes("llamar('withdraw_booking_consent', { p_offer: offerId })")
  && modulo.includes('p_consents: consents'));
ok('6. Asistentes y el CSV, marcadas', panel.includes('KP.etiqueta(q, trP)')
  && panel.includes("q.health ? `${q.text} (${bi('dato de salud', 'health data')})` : q.text")
  && KP.etiqueta({ text: '¿Alergias?', health: true }, tr) === '¿Alergias? · Dato de salud');
ok('6. en inglés', enPanel.includes('"Es sobre salud (alergias, intolerancias…)": "It’s about health (allergies, intolerances…)"')
  && enCuenta.includes('"Retirar mi consentimiento": "Withdraw my consent"'));

// 7. Tipos
const talleres = { id: 'v1', text: '¿Qué talleres?', type: 'multi', options: ['Pintura', 'Barro', 'Música'] };
const bicis = { id: 'v2', text: '¿Cuántas bicis?', type: 'number', min: 0, max: 4 };
const dia = { id: 'v3', text: '¿Qué día llegas?', type: 'date' };
ok('7. los seis tipos en el panel', ['text', 'yesno', 'choice', 'multi', 'number', 'date'].every((x) => KP.TIPOS.includes(x))
  && editor.includes("multi: tr('Elegir varias'), number: tr('Número'), date: tr('Fecha')"));
ok('7. número: mínimo no mayor que el máximo; se guardan', !KP.valida({ ...bicis, min: 5, max: 1 }) && KP.valida(bicis)
  && JSON.stringify(KP.paraGuardar([bicis])[0]) === JSON.stringify({ id: 'v2', text: '¿Cuántas bicis?', type: 'number', required: false, health: false, options: [], min: 0, max: 4 }));
ok('7. las respuestas, como la base', KP.problema(bicis, '9') === 'answer_out_of_range' && KP.problema(bicis, 'dos') === 'bad_answers'
  && KP.problema(bicis, '3') === null && KP.problema(dia, '2026-02-30') === 'bad_answers' && KP.problema(dia, '2026-12-24') === null
  && KP.problema(talleres, 'Pintura\nBaile') === 'bad_answers' && KP.problema(talleres, 'Barro') === null);
ok('7. varias: en el orden del negocio y con comas', KP.juntaVarias(['Música', 'Pintura'], talleres) === 'Pintura\nMúsica'
  && KP.textoRespuesta(talleres, 'Pintura\nMúsica', tr) === 'Pintura, Música');
ok('7. el resumen de varias, número y fecha',
  KP.resumen(talleres, { counts: [{ value: 'Pintura', count: 2 }, { value: 'Barro', count: 1 }] }, 3, tr) === 'Pintura 2 · Barro 1 · Música 0'
  && KP.resumen(bicis, { answered: 2, stats: { sum: 5, avg: 2.5 } }, 3, tr).startsWith('Suma 5 · Media 2')
  && KP.resumen(dia, { counts: [{ value: '2026-12-24', count: 2 }] }, 3, tr).includes('(2)'));
ok('7. «Tu cuenta»: casillas, número y fecha', modulo.includes("type=\"${multi ? 'checkbox' : 'radio'}\"")
  && modulo.includes('type="number" inputmode="numeric" step="1"') && modulo.includes("'type=\"date\"'"));

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
