// Prueba de «oferta flash» → «oferta» en los textos legales (legal_oferta.py, OFERTA_DESDE; Iván, 18-11-2026): las
// cuatro frases nuevas en ES y EN (aviso legal, privacidad «Avísame si…», términos del QR y condiciones para
// negocios §2), que ya no está la frase vieja, la versión nueva de las condiciones con sus 15 días y el aviso de
// arriba, la fecha y el historial. Fuera del historial y del aviso del cambio, ninguna página legal dice «flash».
// Sin desplazamiento horizontal ni errores de JavaScript. Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_oferta_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { OFERTA, fechaLegal } from './_fecha_ia.mjs';

if (!OFERTA) {
  console.log('OFERTA_DESDE = None en legal_oferta.py: no hay textos nuevos que mirar.');
  process.exit(0);
}
const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const V = esc(OFERTA.version);
const [a, m, d] = OFERTA.iso.split('-').map(Number);
const aplica = new Date(Date.UTC(a, m - 1, d + 15));
const MES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const AP_ES = `${aplica.getUTCDate()} de ${MES_ES[aplica.getUTCMonth()]} de ${aplica.getUTCFullYear()}`;
const AP_EN = `${aplica.getUTCDate()} ${MES_EN[aplica.getUTCMonth()]} ${aplica.getUTCFullYear()}`;
const corto = (x) => `${x.getUTCDate()}-${x.getUTCMonth() + 1}-${x.getUTCFullYear()}`;
const cortoEn = (x) => `${x.getUTCDate()} ${MES_EN[x.getUTCMonth()].slice(0, 3)} ${x.getUTCFullYear()}`;
const pub = new Date(Date.UTC(a, m - 1, d));
const HES = (t) => new RegExp(`Historial de cambios\\s+${OFERTA.es}: ${t}`);
const HEN = (t) => new RegExp(`Change history\\s+${OFERTA.en}: ${t}`);

// [ruta, cabecera, lo que tiene que salir, lo que ya no sale]
const PAGINAS = [
  ['/aviso-legal', fechaLegal('/aviso-legal', `Última actualización: ${OFERTA.es} · Versión 2026-09-29`), [
    /permite a negocios locales publicar ofertas de duración limitada y eventos, y a las personas usuarias/,
    HES('«Oferta flash» pasa a llamarse «oferta», como en la app y en la web\\. Solo cambia el nombre\\.'),
  ], [/\("ofertas flash"\)/]],
  ['/en/legal-notice', fechaLegal('/en/legal-notice', `Last updated: ${OFERTA.en} · Version 2026-09-29`), [
    /lets local businesses publish time-limited deals and events, and lets users/,
    HEN('“Flash offer” \\(“flash deal”\\) is now called “offer”'),
  ], [/\("flash deals"\)/]],
  ['/privacidad', fechaLegal('/privacidad', `Última actualización: ${OFERTA.es} · Versión 2026-09-29`), [
    /la distancia de «Ofertas cerca de ti»/,
    HES('El ajuste «Ofertas flash cerca de ti» se llama ahora «Ofertas cerca de ti»\\. Solo cambia el nombre\\.'),
  ], [/la distancia de «Ofertas flash cerca de ti»/]],
  ['/en/privacy', fechaLegal('/en/privacy', `Last updated: ${OFERTA.en} · Version 2026-09-29`), [
    /your “Offers near you” distance/,
    HEN('The “Flash offers near you” setting is now called “Offers near you”\\. Only the name changes\\.'),
  ], [/your “Flash offers near you” distance/]],
  ['/terminos', fechaLegal('/terminos', `Última actualización: ${OFERTA.es} · Versión 2026-09-29`), [
    /\(lo fija cada negocio: unos minutos en una oferta; en un evento, hasta que termina\)/,
    HES('«Oferta flash» pasa a llamarse «oferta»'),
  ], [/unos minutos en una oferta flash/]],
  ['/en/terms', fechaLegal('/en/terms', `Last updated: ${OFERTA.en} · Version 2026-09-29`), [
    /\(each business sets it: a few minutes for an offer; for an event, until it ends\)/,
    HEN('“Flash offer” \\(“flash deal”\\) is now called “offer”'),
  ], [/for a flash offer/]],
  ['/negocios', fechaLegal('/negocios', `Última actualización: ${OFERTA.es} · Versión ${OFERTA.version}`), [
    /Klendar permite al Negocio publicar ofertas y eventos \(con reserva de plazas/,
    new RegExp(`Los del ${OFERTA.es} \\(apartado 2: «oferta flash» pasa a llamarse «oferta», sin ningún otro cambio\\) se aplican desde el ${esc(AP_ES)}, también 15 días después\\.`),
    new RegExp(`${V}\\s+${corto(pub)}\\s+${corto(aplica)}`),
    HES(`«Oferta flash» pasa a llamarse «oferta» \\(apartado 2\\)[^\\n]+Se aplica desde el ${esc(AP_ES)}`),
  ], [/publicar ofertas flash/]],
  ['/en/business-terms', fechaLegal('/en/business-terms', `Last updated: ${OFERTA.en} · Version ${OFERTA.version}`), [
    /Klendar lets the Business publish offers and events \(with place reservations/,
    new RegExp(`Those of ${OFERTA.en} \\(section 2: “flash deals” are now called “offers”, with no other change\\) apply from ${esc(AP_EN)}, also 15 days later\\.`),
    new RegExp(`${V}\\s+${cortoEn(pub)}\\s+${cortoEn(aplica)}`),
    HEN(`“Flash deal” is now called “offer” \\(section 2\\)[^\\n]+It applies from ${esc(AP_EN)}`),
  ], [/publish flash deals/]],
];

// «flash» solo puede salir en el historial y en el aviso del cambio (las frases que dicen cómo se llamaba antes).
const sinFlash = (txt) => txt.split('\n').filter((l) => /flash/i.test(l)
  && !new RegExp(`^\\s*(?:${OFERTA.es}|${OFERTA.en}):`).test(l)
  && !/(?:Los del|Those of) /.test(l));

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, nunca] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((x) => { x.open = true; }));
    const txt = (await p.locator('body').innerText()).replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: ya no dice ${re.source.slice(0, 60)}`);
    const quedan = sinFlash(txt);
    ok(quedan.length === 0, `${nombre}/${t} ${ruta}: no dice «flash» fuera del historial (${quedan.join(' | ').slice(0, 200)})`);
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
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
