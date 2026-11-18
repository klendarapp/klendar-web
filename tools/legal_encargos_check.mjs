// Prueba de «Encargos» (legal_encargos.py, ENCARGOS_DESDE; Iván, 17-11-2026): en la privacidad (ES y EN), la fila
// «Encargos» y el encargo en «Los negocios ven tu nombre mostrado…» (el correo y el teléfono, hasta 7 días después del
// día de recogida); en los términos, el apartado 3 octies (3g); en las condiciones para negocios, el apartado 3 terdecies
// (3l), la versión con sus 15 días y el aviso de arriba; la fecha y el historial. Sin desplazamiento horizontal ni
// errores de JavaScript. Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_encargos_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { ENCARGOS, VERSION_NEGOCIOS, fechaLegal } from './_fecha_ia.mjs';

if (!ENCARGOS) {
  console.log('ENCARGOS_DESDE = None en legal_encargos.py: no hay textos de encargos que mirar.');
  process.exit(0);
}
const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const V = esc(ENCARGOS.version);

const PAGINAS = [
  ['/privacidad', fechaLegal('/privacidad', `Última actualización: ${ENCARGOS.es} · Versión 2026-09-29`), [
    /Encargos\s+Si haces un encargo, guardamos qué encargas \(producto, cantidad y opciones\), el día y la franja de recogida, tu nota si la escribes, cómo va el encargo y, si lo das, una copia de tu teléfono\. En la nota no escribas datos de salud: los alérgenos del producto los ves antes de encargar\. Si el producto es para mayores de 18, miramos la fecha de nacimiento de tu perfil\s+Hacer llegar tu encargo al negocio y avisarte de cómo va\. Qué ve el negocio: tu nombre mostrado, lo encargado y tu nota\. Si el negocio puede ver tu contacto, ve también tu correo y ese teléfono, solo para avisarte de ese encargo\s+Ejecución del servicio \(art\. 6\.1\.b RGPD\)\s+La nota y el teléfono se borran 7 días después del día de recogida\. El resto queda en «Tus códigos» mientras tengas la cuenta, puedes quitarlo de tu lista y sale en «Descargar mis datos»/,
    /cuando coges número en su cola \(tu turno\), cuando les haces un encargo \(tu nombre mostrado, sin tu foto, lo que encargas y tu nota\), cuando ganas/,
    /te apuntas a su lista de espera, coges número en su cola o le haces un encargo, tu correo y el teléfono que decidas darle en ese momento \(opcional\)/,
    /deja de verlo 7 días después del evento o del día de recogida del encargo \(en la cola, al acabar el día\)\./,
    // Encima van las dos líneas del 16-11 de después («Avísame» y «Si el negocio puede ver tu contacto»).
    new RegExp(`Historial de cambios\\s+(?:.+\\n\\s*){0,4}?${ENCARGOS.es}: Encargos: fila nueva`),
  ], [/Con el contacto activado, ve/]],
  ['/en/privacy', fechaLegal('/en/privacy', `Last updated: ${ENCARGOS.en} · Version 2026-09-29`), [
    /Pre-orders\s+If you place a pre-order, we keep what you've ordered \(product, quantity and options\)[^\n]+Please don't put any health details in the note[^\n]+\s+Getting your pre-order to the business[^\n]+\s+Performance of the service \(art\. 6\(1\)\(b\) GDPR\)\s+The note and the phone number are deleted 7 days after the pick-up day/,
    /when you get a number in their queue \(your turn\), when you place a pre-order with them \(your display name, without your photo, what you order and your note\), when you win/,
    /join their waiting list, get a number in their queue or place a pre-order with them, your email/,
    /stops seeing them 7 days after the event or the pre-order's pick-up day \(in the queue, at the end of the day\)\./,
    /What the business sees: your display name, what you ordered and your note\. If the business can see your contact details, it also sees your email and that phone number, only to let you know about that pre-order/,
    new RegExp(`Change history\\s+(?:.+\\n\\s*){0,4}?${ENCARGOS.en}: Pre-orders: new row`),
  ], [/With contact details turned on, it/]],
  ['/terminos', fechaLegal('/terminos', `Última actualización: ${ENCARGOS.es} · Versión 2026-09-29`), [
    /3 octies\. Encargos\s+Algunos negocios te dejan encargarles productos desde Klendar[^\n]+Al encargar, el contrato es con el negocio; Klendar no cobra ni responde del pedido\. El precio es orientativo y pagas en el local al recoger\.[^\n]+no escribas datos de salud en la nota\. Puedes anular hasta el plazo que fije el negocio; si no vas a recoger, anúlalo\.\s+4\. Reseñas/,
    new RegExp(`Historial de cambios\\s+(?:.+\\n\\s*){0,1}?${ENCARGOS.es}: Encargos \\(apartado 3 octies nuevo\\)`),
  ], []],
  ['/en/terms', fechaLegal('/en/terms', `Last updated: ${ENCARGOS.en} · Version 2026-09-29`), [
    /3g\. Pre-orders\s+Some businesses let you pre-order products[^\n]+your contract is with the business; Klendar doesn't take payment and isn't responsible for the order\.[^\n]+please cancel\.\s+4\. Reviews/,
    new RegExp(`Change history\\s+(?:.+\\n\\s*){0,1}?${ENCARGOS.en}: Pre-orders \\(new section 3g\\)`),
  ], []],
  ['/negocios', fechaLegal('/negocios', `Última actualización: ${ENCARGOS.es} · Versión ${VERSION_NEGOCIOS}`), [
    /3 terdecies\. Encargos\s+Si activas Encargos, tus clientes pueden encargarte productos desde Klendar para recogerlos y pagarlos en tu local\. El encargo es un acuerdo directo entre tu negocio y el cliente\. Klendar solo transmite el encargo y sus avisos: no cobra ni recibe pagos, no es parte del contrato y no responde de la preparación, calidad, precio, entrega ni anulación\. El precio en Klendar es orientativo y el final lo fijas tú\.[^\n]+14 alérgenos[^\n]+Usarás los datos de contacto del cliente solo para gestionar ese encargo\.\s+(?:3 quaterdecies\.|4\. Prueba)/,
    /«Encargos» \(apartado 3 terdecies\)[^.]+ se aplica desde el 1 de diciembre de 2026\./,
    new RegExp(`${V}\\s+16-11-2026\\s+1-12-2026`),
    new RegExp(`Historial de cambios\\s+(?:.+\\n\\s*){0,4}?${ENCARGOS.es}: Apartado 3 terdecies nuevo, «Encargos»[^\\n]+Se aplica desde el 1 de diciembre de 2026`),
  ], []],
  ['/en/business-terms', fechaLegal('/en/business-terms', `Last updated: ${ENCARGOS.en} · Version ${VERSION_NEGOCIOS}`), [
    /3l\. Pre-orders\s+If you turn on Pre-orders[^\n]+isn't a party to the contract[^\n]+14 allergens[^\n]+only to handle that pre-order\.\s+(?:3m\.|4\. Free trial)/,
    /“Pre-orders” \(section 3l\)[^.]+ applies from 1 December 2026\./,
    new RegExp(`${V}\\s+16 Nov 2026\\s+1 Dec 2026`),
    new RegExp(`Change history\\s+(?:.+\\n\\s*){0,4}?${ENCARGOS.en}: New section 3l, “Pre-orders”`),
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
