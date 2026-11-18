// Prueba de la línea nueva del apartado 3 bis de las condiciones para negocios (legal_entidad.py, ENTIDAD_DESDE;
// Iván, 18-11-2026): un Negocio que ya paga y pasa a tener cuenta de entidad deja de pagar cuota. El párrafo en ES y
// EN, detrás del de «no pagan cuota» y antes de los bonos; la versión nueva con sus 15 días en la tabla y en el aviso
// de arriba; la fecha y el historial. Las demás páginas legales no lo dicen. Sin desplazamiento horizontal ni errores
// de JavaScript. Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_entidad_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { ENTIDAD, PORLOCAL, fechaLegal } from './_fecha_ia.mjs';

if (!ENTIDAD) {
  console.log('ENTIDAD_DESDE = None en legal_entidad.py: no hay textos nuevos que mirar.');
  process.exit(0);
}
const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const V = esc(ENTIDAD.version);
const [a, m, d] = ENTIDAD.iso.split('-').map(Number);
const aplica = new Date(Date.UTC(a, m - 1, d + 15));
const MES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const AP_ES = `${aplica.getUTCDate()} de ${MES_ES[aplica.getUTCMonth()]} de ${aplica.getUTCFullYear()}`;
const AP_EN = `${aplica.getUTCDate()} ${MES_EN[aplica.getUTCMonth()]} ${aplica.getUTCFullYear()}`;
const corto = (x) => `${x.getUTCDate()}-${x.getUTCMonth() + 1}-${x.getUTCFullYear()}`;
const cortoEn = (x) => `${x.getUTCDate()} ${MES_EN[x.getUTCMonth()].slice(0, 3)} ${x.getUTCFullYear()}`;
const pub = new Date(Date.UTC(a, m - 1, d));

// Exactamente lo aprobado por Iván (ES) y su traducción (EN). Con «cada local paga lo suyo» (legal_porlocal.py,
// PORLOCAL_DESDE) sale sin el paréntesis de «si incluye otros locales…» (una suscripción por local).
const sinOtros = (x, y) => (PORLOCAL ? x.replace(y, '') : x);
const ES = sinOtros('Si un Negocio que ya paga pasa a tener cuenta de entidad, desde ese momento deja de pagar cuota: su suscripción no se renueva al final del periodo ya pagado (si incluye otros locales, deja de incluir este y desde la factura siguiente se cobra uno menos) y se lo avisamos por correo y en la app. Lo ya pagado de ese periodo no se devuelve. Si deja de tener cuenta de entidad, la suscripción anterior no se reactiva sola.',
  ' (si incluye otros locales, deja de incluir este y desde la factura siguiente se cobra uno menos)');
const EN = sinOtros("If a Business that already pays gets an organisation account, from then on it stops paying the fee: its subscription doesn't renew at the end of the period already paid (if it covers other venues, it stops covering this one and one fewer is charged from the next invoice) and we let it know by email and in the app. What has already been paid for that period is not refunded. If it stops having an organisation account, the previous subscription doesn't restart on its own.",
  ' (if it covers other venues, it stops covering this one and one fewer is charged from the next invoice)');

// [ruta, cabecera, lo que tiene que salir]
const PAGINAS = [
  ['/negocios', fechaLegal('/negocios', `Última actualización: ${ENTIDAD.es} · Versión ${ENTIDAD.version}`), [
    new RegExp(`3 bis\\. Cuentas de entidad[\\s\\S]+?todo lo demás\\.\\s+${esc(ES)}\\s+3 ter\\. Bonos`),
    new RegExp(`Lo de un Negocio que ya paga y pasa a tener cuenta de entidad \\(apartado 3 bis\\), publicado el mismo día, también se aplica desde el ${esc(AP_ES)}\\.`),
    new RegExp(`${V}\\s+${corto(pub)}\\s+${corto(aplica)}`),
    new RegExp(`Historial de cambios\\s+(?:.+\\n\\s*){0,1}?${ENTIDAD.es}: Cuentas de entidad \\(apartado 3 bis\\): si un Negocio que ya paga[^\\n]+Se aplica desde el ${esc(AP_ES)}, 15 días después de publicarlo y avisar\\.`),
  ], ES],
  ['/en/business-terms', fechaLegal('/en/business-terms', `Last updated: ${ENTIDAD.en} · Version ${ENTIDAD.version}`), [
    new RegExp(`3a\\. Organisation accounts[\\s\\S]+?everything else for free\\.\\s+${esc(EN)}\\s+3b\\. Passes`),
    new RegExp(`What happens when a Business that already pays gets an organisation account \\(section 3a\\), published the same day, also applies from ${esc(AP_EN)}\\.`),
    new RegExp(`${V}\\s+${cortoEn(pub)}\\s+${cortoEn(aplica)}`),
    new RegExp(`Change history\\s+(?:.+\\n\\s*){0,1}?${ENTIDAD.en}: Organisation accounts \\(section 3a\\): if a Business that already pays[^\\n]+It applies from ${esc(AP_EN)}, 15 days after publishing it and notifying you\\.`),
  ], EN],
];
// Las demás no lo dicen (ni cambian de fecha por esto).
const OTRAS = ['/aviso-legal', '/privacidad', '/terminos', '/en/legal-notice', '/en/privacy', '/en/terms'];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, frase] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((x) => { x.open = true; }));
    const txt = (await p.locator('body').innerText()).replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    ok(txt.split(frase).length === 2, `${nombre}/${t} ${ruta}: la línea sale una sola vez`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  for (const ruta of OTRAS) {
    await p.goto(`${BASE}${ruta}`);
    const txt = await p.locator('body').innerText();
    ok(!/pasa a tener cuenta de entidad|gets an organisation account/.test(txt), `${nombre}/${t} ${ruta}: no lo dice`);
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
