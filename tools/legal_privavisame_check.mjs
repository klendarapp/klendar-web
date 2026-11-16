// Prueba de la privacidad del 16-11-2026 (aprobado por Iván el 17-11; build_legal.py, PRIV_AVISAME_DESDE):
// «Avísame» cuando abren las reservas en las filas «Favoritos, reseñas, canjes y sellos» y «Notificaciones push»
// (ES y EN), «Si el negocio puede ver tu contacto» en la fila «Encargos» (legal_encargos.py) y sus dos líneas en el
// historial. Sin desplazamiento horizontal ni errores de JavaScript. Chromium y WebKit, móvil (390 × 844) y
// escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_privavisame_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { fechaLegal } from './_fecha_ia.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad', fechaLegal('/privacidad', 'Última actualización: 16 de noviembre de 2026 · Versión 2026-09-29'), [
    /tu lugar en la lista de espera y los avisos que te hemos mandado de ella, los eventos de los que has pedido «Avísame» para cuando abran las reservas \(y si ya te hemos avisado; se borra cuando pasa el evento\), vistas de ofertas/,
    /una plaza libre de la lista de espera, que han abierto las reservas de un evento del que pediste «Avísame» \(una vez por evento\), cambios o anulaciones/,
    /\(los avisos de tus reservas, de la lista de espera y de «Avísame» cuando abren las reservas van siempre, porque son de algo que has pedido\)/,
    /Qué ve el negocio: tu nombre mostrado, lo encargado y tu nota\. Si el negocio puede ver tu contacto, ve también tu correo y ese teléfono, solo para avisarte de ese encargo/,
    /Historial de cambios\s+(?:.+\n\s*){0,1}?16 de noviembre de 2026: «Avísame» cuando abren las reservas: en «Favoritos, reseñas, canjes y sellos», los eventos de los que lo pides y si ya te hemos avisado \(se borra cuando pasa el evento\); en «Notificaciones push», el aviso de que han abierto las reservas \(una vez por evento\), que va siempre porque lo has pedido\.\s+16 de noviembre de 2026: Encargos: donde decía «Con el contacto activado» dice ahora «Si el negocio puede ver tu contacto»/,
  ], [
    /los avisos de tus reservas y de la lista de espera van siempre/,
    /Con el contacto activado, ve/,
  ]],
  ['/en/privacy', fechaLegal('/en/privacy', 'Last updated: 16 November 2026 · Version 2026-09-29'), [
    /your place on the waiting list and the notices we've sent you from it, the events you've asked us to tell you about when reservations open \(“Tell me”\) and whether we already have \(this is deleted when the event is over\), deal views/,
    /a free place from the waiting list, that reservations have opened for an event you asked about with “Tell me” \(once per event\), changes to or cancellations/,
    /\(notices about your bookings, the waiting list and “Tell me” when reservations open are always sent, because they're about something you asked for\)/,
    /What the business sees: your display name, what you ordered and your note\. If the business can see your contact details, it also sees your email and that phone number/,
    /Change history\s+(?:.+\n\s*){0,1}?16 November 2026: “Tell me” when reservations open: [^\n]+\s+16 November 2026: Pre-orders: “With contact details turned on” now reads “If the business can see your contact details”/,
  ], [
    /notices about your bookings and the waiting list are always sent/,
    /With contact details turned on, it/,
  ]],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, nunca] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = (await p.locator('body').innerText()).replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
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
