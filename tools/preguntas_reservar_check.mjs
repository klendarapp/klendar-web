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
  && !KP.valida({ ...talla, options: Array.from({ length: 9 }, (_, i) => `T${i}`) }));
ok('1. ids nuevos', KP.idNuevo([{ id: 'q1' }, { id: 'q3' }]) === 'q2');
ok('1. lo que se manda, limpio', JSON.stringify(KP.paraGuardar([{ ...talla, text: '  ¿Talla?  ', options: [' S', 'M '] }, menu]))
  === JSON.stringify([{ id: 'q2', text: '¿Talla?', type: 'choice', required: false, options: ['S', 'M'] },
    { id: 'q1', text: '¿Menú infantil?', type: 'yesno', required: true, options: [] }]));
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
ok('2. el aviso de salud, fijo', editor.includes("tr('No pidas datos de salud (alergias, enfermedades…). Usa las respuestas solo para este evento.')"));
ok('2. con respuestas: no se apaga, no se quitan ni se cambian', editor.includes("${bloqueadas && encendido ? 'disabled' : ''}")
  && editor.includes("${fija ? '' : `<button type=\"button\" class=\"btn sm ghost\" data-p=\"quitar\">"));
ok('2. hasta 5', editor.includes('lista.length < KP.MAX') && KP.MAX === 5);
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
  && modulo.includes("llamar('set_booking_answers', { p_offer: offerId, p_answers: answers })"));
ok('4. «Tus respuestas» en el código y la ruta para cambiarlas', cuenta.includes('id="tusRespuestas"')
  && modulo.includes('RUTAS.respuestas = async ([id]) =>') && modulo.includes('href="/cuenta/respuestas/${esc(offerId)}"'));
ok('4. «No escribas datos de salud.» bajo las libres', modulo.includes("t('No escribas datos de salud.')"));
ok('4. qué verá el negocio', modulo.includes("t('{negocio} verá tus respuestas solo para organizar este evento.')"));
ok('4. en inglés', enCuenta.includes('"Tus respuestas": "Your answers"') && enCuenta.includes('"No escribas datos de salud.": "Don’t write health information."'));

// 5. Admin
ok('5. el admin ve las preguntas', admin.includes('<dt>Preguntas al reservar</dt>'));

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
