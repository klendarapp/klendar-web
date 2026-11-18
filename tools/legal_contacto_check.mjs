// Prueba de «Contacto de quien reserva» (legal_contacto.py, CONTACTO_DESDE; Iván, 17-11-2026): en la privacidad (ES y
// EN), la lista de espera en «Los negocios ven tu nombre mostrado…», el correo y el teléfono para avisar de cambios
// (lo ve el equipo del negocio, 7 días tras el evento) y la fila «Teléfono de contacto»; en las condiciones para
// negocios, la cláusula del apartado 3, la versión con sus 15 días y el aviso de arriba; las dos preguntas de la
// ayuda; la fecha y el historial. Sin desplazamiento horizontal ni errores de JavaScript. Chromium y WebKit, móvil
// (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_contacto_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { CONTACTO, VERSION_NEGOCIOS, fechaLegal } from './_fecha_ia.mjs';

if (!CONTACTO) {
  console.log('CONTACTO_DESDE = None en legal_contacto.py: no hay textos del contacto que mirar.');
  process.exit(0);
}
const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  // Encima pueden ir los encargos (legal_encargos.py), con su fecha y «o le haces un encargo».
  ['/privacidad', fechaLegal('/privacidad', `Última actualización: ${CONTACTO.es} · Versión 2026-09-29`), [
    /si has entrado\), cuando te apuntas a la lista de espera de uno de sus eventos \(tu nombre mostrado, sin tu foto, por orden y, si te hemos avisado de una plaza, hasta cuándo te la guardamos\), cuando tienes sellos/,
    /Nunca tu fecha de nacimiento ni tu ubicación\. Tu correo y tu teléfono, solo el contacto que elijas darle en «Grupos y empresas» y, cuando reservas en uno de sus eventos, te apuntas a su lista de espera(?: o|,) coges número en su cola(?: o le haces un encargo)?, tu correo y el teléfono que decidas darle en ese momento \(opcional\): solo para avisarte de cambios en eso, nunca para publicidad\. Lo ve el equipo del negocio y deja de verlo 7 días después del evento(?: o del día de recogida del encargo)? \(en la cola, al acabar el día\)\./,
    /Teléfono de contacto\s+El que guardas en tu perfil \(opcional, no lo verificamos\) y una copia del que das al reservar, apuntarte a una lista de espera o coger número\s+Que el negocio pueda avisarte de un cambio y rellenarte el campo la próxima vez\s+Consentimiento \(art\. 6\.1\.a\): lo borras cuando quieras\s+Perfil: hasta que lo borres o elimines la cuenta; copia: 7 días tras el evento \(cola: hasta las 6:00\)/,
    new RegExp(`Historial de cambios\\s+(?:.+\\n\\s*){0,5}?${CONTACTO.es}: Lo que ven los negocios`),
  ], [/Nunca tu correo, tu teléfono, tu fecha de nacimiento ni tu ubicación/, /el propietario y los encargados/]],
  ['/en/privacy', fechaLegal('/en/privacy', `Last updated: ${CONTACTO.en} · Version 2026-09-29`), [
    /whether you got in\), when you join the waiting list for one of their events \(your display name, without your photo, in order and, if we've told you about a free place, until when we're holding it for you\), when you have stamps/,
    /Never your date of birth or location\. Your email and phone number, only the contact details you choose to give them in “Groups and companies” and, when you book at one of their events, join their waiting list(?: or|,) get a number in their queue(?: or place a pre-order with them)?, your email and the phone number you decide to give them at that moment \(optional\): only to let you know about changes to that, never for advertising\. The business's team sees them and stops seeing them 7 days after the event(?: or the pre-order's pick-up day)? \(in the queue, at the end of the day\)\./,
    /Contact phone\s+The one you save in your profile \(optional, we don't verify it\)[^\n]+\s+Letting the business tell you about a change[^\n]+\s+Consent \(art\. 6\(1\)\(a\)\)[^\n]+\s+Profile: until you delete it or delete your account; copy: 7 days after the event \(queue: until 6:00\)/,
    new RegExp(`Change history\\s+(?:.+\\n\\s*){0,5}?${CONTACTO.en}: What businesses see`),
  ], [/Never your email, phone number, date of birth or location/]],
  ['/negocios', fechaLegal('/negocios', `Última actualización: ${CONTACTO.es} · Versión ${VERSION_NEGOCIOS}`), [
    /Contacto de quien reserva\. El correo y el teléfono de quien tiene una reserva, está en su lista de espera o en su cola solo puede usarlos para avisarle de algo de esa reserva, lista o turno \(un cambio de hora, una cancelación, que le toca\)\. Nunca para publicidad ni para meterlo en sus listas\. No puede copiarlos ni guardarlos fuera de Klendar: dejan de verse 7 días después del evento \(en la cola, al acabar el día\)\./,
    new RegExp(`Los del ${CONTACTO.es} \\(apartado 3, «Contacto de quien reserva»\\) se aplican desde el 1 de diciembre de 2026, también 15 días después\\. (?:[^\\n]*?)La «Pausa`),
    new RegExp(`${CONTACTO.iso}\\s+16-11-2026\\s+1-12-2026`),
    new RegExp(`Historial de cambios\\s+(?:.+\\n\\s*){0,5}?${CONTACTO.es}: Apartado 3, «Contacto de quien reserva»[^\\n]+Se aplica desde el 1 de diciembre de 2026`),
  ], []],
  ['/en/business-terms', fechaLegal('/en/business-terms', `Last updated: ${CONTACTO.en} · Version ${VERSION_NEGOCIOS}`), [
    /Contact details of people who book\. It may only use the email and phone number of anyone who has a booking, is on its waiting list or in its queue/,
    new RegExp(`Those of ${CONTACTO.en} \\(section 3, “Contact details of people who book”\\) apply from 1 December 2026, also 15 days later\\. (?:[^\\n]*?)The “Seasonal pause”`),
    new RegExp(`${CONTACTO.iso}\\s+16 Nov 2026\\s+1 Dec 2026`),
    new RegExp(`Change history\\s+(?:.+\\n\\s*){0,5}?${CONTACTO.en}: Section 3, “Contact details of people who book”`),
  ], []],
  ['/preguntas', null, [
    /¿Qué ve el negocio cuando reservo, me apunto a la lista de espera o cojo número\?/,
    /¿Puedo avisar a quien ha reservado\?/,
  ], []],
  ['/en/faq', null, [
    /What does the business see when I book, join the waiting list or get a number\?/,
    /Can I let people who have booked know about something\?/,
  ], []],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, nunca] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    // La ayuda tiene pestañas: la de negocios está oculta y no sale en innerText.
    const txt = (fecha ? await p.locator('body').innerText() : await p.evaluate(() => document.body.textContent)).replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    if (fecha) ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: ya no dice ${re.source.slice(0, 60)}`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  ok(errores.length === 0, `${nombre}/${t}: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    await legales(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
