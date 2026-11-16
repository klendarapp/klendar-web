// El teléfono para avisar de una reserva (Iván, 2026-11-17): lo que la web
// tiene que hacer igual que la app. Sin navegador ni red: prueba la lógica de
// las casillas (assets/cuenta/contacto.js) y lee el código. Lo de la base
// (quién lo ve, los 7 días, el interruptor), en la app
// (tool/contacto_smoke.py).
//
//   1. El teléfono se valida igual que en la base (dígitos, espacios y «+»,
//      de 9 a 15 dígitos) y las casillas salen como en la app.
//   2. Reservar, la lista de espera y la cola lo piden solo con el
//      interruptor (`my_contact.enabled`) y lo mandan después
//      (`set_booking_phone`), con la línea de qué verá el negocio.
//   3. «Tus datos»: el teléfono de contacto, guardar y borrar.
//   4. El panel: llamar y escribir en Asistentes, la lista de espera y la
//      cola, con su nota; lo da la base (nada de `auth.users`).
//
//   node tools/contacto_check.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const raiz = new URL('..', import.meta.url);
const lee = (f) => readFileSync(new URL(f, raiz), 'utf8');
const KC = createRequire(import.meta.url)('../assets/cuenta/contacto.js');
const cuenta = lee('assets/cuenta/app.js');
const datos = lee('assets/cuenta/cuenta.js');
const cola = lee('assets/cuenta/cola.js');
const contacto = lee('assets/cuenta/contacto.js');
const panel = lee('panel/panel.js');
const panelCola = lee('panel/cola.js');
const html = lee('cuenta.html');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

// 1. Validar y las casillas
ok('1. válidos', ['600 111 222', '+34 600 111 222', '600111222', '123456789012345'].every(KC.valido));
ok('1. no válidos', !['12345678', '1234567890123456', '600-111-222', '600 +111 222', 'abc', ''].some(KC.valido));
ok('1. se limpia como en la base', KC.limpio('  +34   600 111 222 ') === '+34 600 111 222' && KC.limpio('+ 34 600') === '+34 600'
  && KC.limpio('   ') === null);
ok('1. con el del perfil: sin casilla', KC.casilla('600 111 222', '600 111 222') === 'none'
  && KC.casilla('600 111 222', '600111222') === 'none');
ok('1. lo borra: sin casilla, sin teléfono y el perfil no cambia',
  KC.casilla('600 111 222', '') === 'none'
  && JSON.stringify(KC.respuesta('600 111 222', '')) === JSON.stringify({ shown: true, phone: null, saveToProfile: null }));
{
  const r = KC.respuesta('600 111 222', '611 000 001');
  ok('1. lo cambia: «Cambiarlo también…», desmarcada', KC.casilla('600 111 222', '611 000 001') === 'change'
    && r.phone === '611 000 001' && r.saveToProfile === null);
  ok('1. …y marcada, cambia el perfil', KC.respuesta('600 111 222', '611 000 001', true).saveToProfile === '611 000 001');
}
{
  const r = KC.respuesta(null, '611 000 001');
  ok('1. sin perfil y escribe uno: «Guardar en mi perfil», marcada', KC.casilla(null, '611 000 001') === 'save'
    && r.phone === '611 000 001' && r.saveToProfile === '611 000 001');
  ok('1. …desmarcada, la reserva lo lleva y el perfil no', KC.respuesta(null, '611 000 001', false).saveToProfile === null
    && KC.respuesta(null, '611 000 001', false).phone === '611 000 001');
}
ok('1. vacío y sin perfil: ninguna', KC.casilla(null, '') === 'none');
ok('1. mal escrito: null (no se manda)', KC.respuesta(null, '123') === null);
ok('1. la línea de debajo, con y sin teléfono, en los tres sitios',
  ['reservation', 'waitlist', 'queue'].every((k) => KC.TEXTOS[k][0].includes('tu correo y tu teléfono')
    && !KC.TEXTOS[k][1].includes('teléfono') && KC.TEXTOS[k].every((x) => x.startsWith('{negocio} verá') && x.endsWith('Nunca para publicidad.'))));
ok('1. «de esta reserva» al reservar', KC.TEXTOS.reservation[0] === '{negocio} verá tu correo y tu teléfono solo para avisarte de esta reserva. Nunca para publicidad.');

// 2. Dónde se pide
const reservar = cuenta.slice(cuenta.indexOf('RUTAS.reservar ='), cuenta.indexOf('RUTAS.espera ='));
ok('2. reservar: solo en un evento con reserva y sin código vivo', reservar.includes("!yaTiene && o.kind === 'future_event' && o.reservations_enabled ? await miContacto()"));
ok('2. reservar: solo encendido', reservar.includes('if (me.enabled) {') && reservar.includes("kind: 'reservation'"));
ok('2. reservar: se guarda para cuando exista la reserva', reservar.includes('guardaContacto(id, r);'));
ok('2. el código lo aplica al reservar', cuenta.includes("aplicaContacto('reservation', id, tomaContacto(id));"));
const espera = cuenta.slice(cuenta.indexOf('RUTAS.espera ='), cuenta.indexOf('// ── El recibo de un canje'));
ok('2. lista de espera: al apuntarse (no al salir) y encendido', espera.includes("if (!quitar && !['waiting', 'notified'].includes(antes?.state))")
  && espera.includes('if (me.enabled)') && espera.includes("kind: 'waitlist'"));
ok('2. lista de espera: se manda tras apuntarse', espera.includes("if (dentro && !yaEstaba) await aplicaContacto('waitlist', id, contacto);"));
ok('2. cola: el campo solo encendido', cola.includes("${contactoYo.enabled ? campoContacto('c-cola'") && cola.includes("kind: 'queue'"));
ok('2. cola: no se borra al repintar', cola.includes('estado: telCola'));
ok('2. cola: se manda con el turno', cola.includes("if (turno?.id) await aplicaContacto('queue', turno.id, contacto);"));
ok('2. la base: set_booking_phone (también sin teléfono: ha visto la línea) y set_my_contact_phone',
  contacto.includes("if (!r || !r.shown) return;")
  && contacto.includes("llamar('set_booking_phone', { p_kind: kind, p_ref: ref, p_phone: r.phone || '' })")
  && contacto.includes("llamar('set_my_contact_phone', { p_phone: r.saveToProfile })"));
ok('2. sin sesión o sin red: apagado', contacto.includes("catch { return { enabled: false, phone: null }; }"));
ok('2. contacto.js se carga en «Tu cuenta»', /<script src="\/assets\/cuenta\/contacto\.js\?v=[^"]+"><\/script>/.test(html));

// 3. «Tus datos»
const td = datos.slice(datos.indexOf("RUTAS['tus-datos'] ="), datos.indexOf('// ── Editar perfil'));
ok('3. «Teléfono de contacto» y su nota', td.includes("t('Teléfono de contacto')")
  && td.includes('Solo lo ve el negocio donde tienes una reserva, en la lista o en la cola, y solo para avisarte de eso. Puedes borrarlo cuando quieras.'));
ok('3. apagado, solo si ya había uno (y solo para borrarlo)', td.includes('const conTel = tel.enabled || !!tel.phone;')
  && td.includes("${tel.enabled ? '' : ' readonly aria-readonly=\"true\"'}"));
ok('3. guardar y borrar', td.includes("llamar('set_my_contact_phone', { p_phone: limpio || '' })") && td.includes("guardaTel('', ev.currentTarget)"));

// 4. El panel
ok('4. Asistentes: los contactos de la base', panel.includes("rpc('offer_attendee_contacts', { p_offer: offerId })"));
ok('4. Asistentes: llamar y escribir por fila', panel.includes('contactos[a.id] ? botonesContacto(contactos[a.id]'));
ok('4. la lista de espera, solo si la base dice contact', panel.includes("${resumen?.contact ? botonesContacto(p,"));
ok('4. la nota de Asistentes', panel.includes('Úsalos solo para avisar de esta reserva. Se dejan de ver 7 días después del evento.'));
ok('4. la cola: botones y su nota', panelCola.includes("${d.contact ? botonesContacto(e, colaNombre(e)) : ''}")
  && panelCola.includes('Úsalos solo para avisar de este turno. Se dejan de ver al acabar el día.'));
{
  const ini = panel.indexOf('function botonesContacto(');
  const fin = panel.indexOf('\n}\n', ini) + 2;
  const f = new Function('esc', 'ms', `${panel.slice(ini, fin)}; return botonesContacto;`)((s) => String(s), (n) => `[${n}]`);
  const dos = f({ phone: '+34 600 111 222', email: 'ana@example.com' }, 'Ana');
  ok('4. tel: sin espacios y mailto:', dos.includes('href="tel:+34600111222"') && dos.includes('href="mailto:ana@example.com"')
    && dos.includes('aria-label="Llamar a Ana"') && dos.includes('aria-label="Escribir a Ana"'));
  ok('4. sin teléfono, solo escribir; sin nada, nada', !f({ email: 'a@example.com' }, 'A').includes('tel:')
    && f({}, 'A') === '' && f(null, 'A') === '');
  ok('4. en tinta, no en coral', !dos.includes('primary') && !dos.includes('accent'));
}
ok('4. nada de auth.users desde la web', ![cuenta, datos, cola, contacto, panel, panelCola].some((s) => s.includes('auth.users')));

if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
console.log('\ntodo bien');
