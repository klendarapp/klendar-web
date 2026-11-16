// Reservas, segunda tanda (Iván, 2026-11-16): lo que la web tiene que hacer
// igual que la app. Sin navegador ni red: lee el código y prueba la hoja de
// los cierres con una base de mentira. Lo de la base, en la app
// (tool/reservas2_smoke.py).
//
//   1. La plaza avisada de la lista de espera se guarda: la ficha y «Tu
//      cuenta» lo dicen («te la guardamos hasta las…»), sin «Si ya no queda».
//   2. Al cerrar («Cerrado por hoy», «Días cerrados», un festivo cerrado o
//      «Cerrar hasta nuevo aviso») con eventos con reservas o lista de
//      espera: «Cancelar y avisar» (cancel_offer de los elegidos) o «Dejarlo».
//   3. Asistentes: «No vino» en vez de «Caducada» con el evento ya pasado.
//   4. «Dar entrada» en tinta, no en coral.
//   5. Asistentes: la lista de espera, cuántos y, con el interruptor, quiénes.
//   6. «Tus códigos»: las plazas en la fila de la reserva.
//
//   node tools/reservas2_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const lee = (f) => readFileSync(new URL(f, raiz), 'utf8');
const panel = lee('panel/panel.js');
const pedir = lee('panel/pedir.js');
const cuenta = lee('assets/cuenta/app.js');
const amigos = lee('assets/amigos.js');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

// 1
ok('1. la ficha: «te la guardamos hasta las…»', amigos.includes("te la guardamos hasta las ' + h + '. Si no la coges")
  && !amigos.includes('Si ya no queda'));
ok('1. «Tu cuenta», igual', cuenta.includes('te la guardamos hasta las ${hora}. Si no la coges, vuelves a la lista.')
  && !cuenta.includes('Si ya no queda'));

// 2: los cuatro sitios desde los que se cierra.
ok('2. «Cerrado por hoy»', panel.includes('if (cerrar) await avisaEventosDelCierre({ p_until: hasta.toISOString() });'));
ok('2. «Días cerrados»', panel.includes('await avisaEventosDelCierre({ p_starts: r.from, p_ends: to });'));
ok('2. «Cerrar hasta nuevo aviso»', panel.includes('await avisaEventosDelCierre({});'));
ok('2. un festivo cerrado', /answer === 'closed'[^\n]*\n\s*await avisaEventosDelCierre\(\{ p_starts: q\.day, p_ends: q\.day \}\)/.test(pedir));

// 2: la hoja, con una base de mentira.
const ini = panel.indexOf('async function avisaEventosDelCierre(');
const fin = panel.indexOf('\n}\n', ini) + 2;
const hoja = (eventos, respuesta) => {
  const llamadas = [];
  const avisos = [];
  let abierta = null;
  const f = new Function('rpc', 'modal', 'toast', 'bi', 'I18N', 'fmtDate', 'fmtNum', 'esc', 'friendly', 'BIZ',
    `${panel.slice(ini, fin)}; return avisaEventosDelCierre;`)(
    async (fn, args) => {
      llamadas.push([fn, args]);
      return fn === 'closure_events' ? eventos : { ok: true, notified: 1 };
    },
    async (op) => { abierta = op; return respuesta; },
    (t) => avisos.push(t),
    (es) => es, { t: (x) => x, lang: 'es' }, () => '20 nov · 21:00', (n) => String(n), (s) => String(s), (s) => s,
    { id: 'b1' });
  return { f, llamadas, avisos, abierta: () => abierta };
};
{
  const h = hoja([], null);
  await h.f({ p_until: 'x' });
  ok('2. sin eventos, no pregunta', h.abierta() === null && h.llamadas.length === 1
    && h.llamadas[0][1].p_business === 'b1' && h.llamadas[0][1].p_until === 'x');
}
const dos = [{ id: 'e1', title: 'Concierto', event_at: '2026-11-20T20:00:00Z', reserved: 3, waiting: 2 },
  { id: 'e2', title: 'Cata', event_at: '2026-11-20T21:00:00Z', reserved: 1, waiting: 0 }];
{
  const h = hoja(dos, { e0: true, e1: false });
  await h.f({ p_starts: '2026-11-20', p_ends: '2026-11-20' });
  const op = h.abierta();
  ok('2. con eventos: «Cancelar y avisar» y «Dejarlo»', op && op.submit === 'Cancelar y avisar' && op.cancel === 'Dejarlo'
    && op.title === 'Tienes 2 eventos con reservas mientras cierras');
  ok('2. uno por casilla, marcados todos, con plazas y lista', op.fields.length === 2 && op.fields.every((x) => x.value === true)
    && op.fields[0].label.includes('3 plazas reservadas') && op.fields[0].label.includes('2 personas en lista de espera'));
  const canceladas = h.llamadas.filter(([fn]) => fn === 'cancel_offer').map(([, a]) => a.p_offer);
  ok('2. cancela solo los marcados', canceladas.length === 1 && canceladas[0] === 'e1');
  ok('2. y lo dice', h.avisos.some((t) => t.startsWith('Evento cancelado. Hemos avisado')));
}
{
  const h = hoja(dos, null);
  await h.f({});
  ok('2. «Dejarlo»: no cancela nada', !h.llamadas.some(([fn]) => fn === 'cancel_offer'));
}
{
  const h = hoja(dos.slice(0, 1), {});
  await h.f({});
  ok('2. con uno solo, sin casillas, y se cancela', h.abierta().fields.length === 0
    && h.llamadas.some(([fn, a]) => fn === 'cancel_offer' && a.p_offer === 'e1'));
}

// 3, 4 y 5: Asistentes.
const asis = panel.slice(panel.indexOf('PAGES.asistentes = async'), panel.indexOf('// ── Tarjetas de sellos'));
ok('3. «No vino» con el evento pasado', asis.includes("const terminado = resumen?.ended === true;")
  && asis.includes("${terminado ? 'No vino' : 'Caducada'}") && asis.includes("expired: terminado ? 'no vino' : 'caducada'"));
ok('4. «Dar entrada» en tinta', asis.includes('<button class="btn sm tinta" data-code=') && !asis.includes('<button class="btn sm" data-code='));
ok('5. la lista de espera: cuántos y, si llegan, los nombres', asis.includes('const enEspera = Number(resumen?.waiting || 0) || 0;')
  && asis.includes('Array.isArray(resumen?.waitlist) ? resumen.waitlist : null') && asis.includes('${esperaHtml}'));
ok('5. solo el nombre (y hasta cuándo se le guarda)', /p\.name \|\| I18N\.t\('Invitada'\)/.test(asis)
  && !/p\.(email|phone)/.test(asis));

// 6: «Tus códigos».
const fila = cuenta.slice(cuenta.indexOf('function filaCanje('), cuenta.indexOf('// ── Códigos guardados'));
ok('6. las plazas en la fila de la reserva', fila.includes("${r.event_at || (r.seats || 1) > 1 ? `<span class=\"muted\">${esc(plazasTxt(r.seats || 1))}</span>` : ''}"));
const plazasTxt = new Function('t', `${(cuenta.match(/const plazasTxt = [^\n]+/) || [''])[0]}; return plazasTxt;`)((x) => x);
ok('6. «1 plaza» y «3 plazas»', plazasTxt(1) === '1 plaza' && plazasTxt(3) === '3 plazas');

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
