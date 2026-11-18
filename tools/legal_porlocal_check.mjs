// Prueba de «cada local paga lo suyo» en las condiciones para negocios (legal_porlocal.py, PORLOCAL_DESDE; Iván,
// 18-11-2026): apartado 4 sin el precio menor desde el segundo local y con la suscripción por local y los códigos
// promocionales; apartado 5 (pausa, traspaso, eliminar) y 3 bis con la suscripción de ese local; la versión nueva con
// sus 15 días en la tabla y en el aviso de arriba; la fecha y el historial. Las demás páginas legales no cambian por
// esto. Sin desplazamiento horizontal ni errores de JavaScript. Chromium y WebKit, móvil (390 × 844) y escritorio
// (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_porlocal_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { PORLOCAL, fechaLegal } from './_fecha_ia.mjs';

if (!PORLOCAL) {
  console.log('PORLOCAL_DESDE = None en legal_porlocal.py: no hay textos nuevos que mirar.');
  process.exit(0);
}
const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const V = esc(PORLOCAL.version);
const [a, m, d] = PORLOCAL.iso.split('-').map(Number);
const aplica = new Date(Date.UTC(a, m - 1, d + 15));
const MES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const AP_ES = `${aplica.getUTCDate()} de ${MES_ES[aplica.getUTCMonth()]} de ${aplica.getUTCFullYear()}`;
const AP_EN = `${aplica.getUTCDate()} ${MES_EN[aplica.getUTCMonth()]} ${aplica.getUTCFullYear()}`;
const corto = (x) => `${x.getUTCDate()}-${x.getUTCMonth() + 1}-${x.getUTCFullYear()}`;
const cortoEn = (x) => `${x.getUTCDate()} ${MES_EN[x.getUTCMonth()].slice(0, 3)} ${x.getUTCFullYear()}`;
const pub = new Date(Date.UTC(a, m - 1, d));

// La frase nueva del apartado 4 (una sola vez) y lo que ya no puede salir fuera del historial.
const ES = 'Cada local tiene su propia suscripción, con su forma de pago y su factura, y paga la cuota entera: no hay descuento por número de locales.';
const EN = 'Each venue has its own subscription, with its own payment method and invoice, and pays the full fee: there is no discount for the number of venues.';
const FUERA_ES = [/a partir del segundo, la de cada local es menor/, /se pausan todos/, /deja de incluirlo/, /si incluye otros locales, deja de incluir este\)/];
const FUERA_EN = [/from the second one on, the fee for each venue is lower/, /they're all paused/, /stops covering it and/, /it stops covering this one\)/];

// [ruta, cabecera, lo que tiene que salir, frase, lo que no]
const PAGINAS = [
  ['/negocios', fechaLegal('/negocios', `Última actualización: ${PORLOCAL.es} · Versión ${PORLOCAL.version}`), [
    new RegExp(`4\\. Prueba gratuita, precio y facturación[\\s\\S]+?${esc(ES)} Contratarla, cambiar la forma de pago, pausarla, cancelarla o traspasar el local afecta solo a ese local\\. Klendar puede ofrecer descuentos puntuales con un código promocional`),
    /Se pausa la suscripción de ese local; los demás locales no cambian\./,
    /la suscripción de ese local que pagaba quien lo tenía no se renueva/,
    /La suscripción de ese local se cancela en ese momento\./,
    new RegExp(`Que cada local tenga su propia suscripción y pague la cuota entera, sin descuento por número de locales \\(apartados 3 bis, 4 y 5\\), publicado el mismo día, también se aplica desde el ${esc(AP_ES)}\\.`),
    new RegExp(`${V}\\s+${corto(pub)}\\s+${corto(aplica)}`),
    new RegExp(`Historial de cambios\\s+${PORLOCAL.es}: Cada local paga lo suyo \\(apartados 3 bis, 4 y 5\\)[^\\n]+Se aplica desde el ${esc(AP_ES)}, 15 días después de publicarlo y avisar\\.`),
  ], ES, FUERA_ES],
  ['/en/business-terms', fechaLegal('/en/business-terms', `Last updated: ${PORLOCAL.en} · Version ${PORLOCAL.version}`), [
    new RegExp(`4\\. Free trial, pricing and invoicing[\\s\\S]+?${esc(EN)} Taking it out, changing the payment method, pausing it, cancelling it or transferring the venue only affects that venue\\. Klendar may offer one-off discounts with a promotion code`),
    /That venue's subscription is paused; the other venues don't change\./,
    /the subscription for that venue that the previous holder paid doesn't renew/,
    /That venue's subscription is cancelled at that moment\./,
    new RegExp(`Each venue having its own subscription and paying the full fee, with no discount for the number of venues \\(sections 3a, 4 and 5\\), published the same day, also applies from ${esc(AP_EN)}\\.`),
    new RegExp(`${V}\\s+${cortoEn(pub)}\\s+${cortoEn(aplica)}`),
    new RegExp(`Change history\\s+${PORLOCAL.en}: Each venue pays its own way \\(sections 3a, 4 and 5\\)[^\\n]+It applies from ${esc(AP_EN)}, 15 days after publishing it and notifying you\\.`),
  ], EN, FUERA_EN],
];
const OTRAS = ['/aviso-legal', '/privacidad', '/terminos', '/en/legal-notice', '/en/privacy', '/en/terms'];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, frase, fuera] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((x) => { x.open = true; }));
    const txt = (await p.locator('body').innerText()).replace(/ /g, ' ');
    // Lo de antes solo puede seguir en el historial de cambios (no se reescribe).
    const vigente = txt.split(/Historial de cambios|Change history/)[0];
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    ok(txt.split(frase).length === 2, `${nombre}/${t} ${ruta}: la frase nueva sale una sola vez`);
    for (const re of fuera) ok(!re.test(vigente), `${nombre}/${t} ${ruta}: ya no dice ${re.source}`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  for (const ruta of OTRAS) {
    await p.goto(`${BASE}${ruta}`);
    const txt = await p.locator('body').innerText();
    ok(!/Cada local paga lo suyo|Each venue pays its own way/.test(txt), `${nombre}/${t} ${ruta}: no lo dice`);
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
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
