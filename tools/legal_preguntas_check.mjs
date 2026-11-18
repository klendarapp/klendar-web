// Prueba de «Preguntas al reservar» (legal_preguntas.py, PREGUNTAS_DESDE; Iván, 17-11-2026): en la privacidad (ES y
// EN), la fila «Preguntas al reservar» (las de salud solo con consentimiento expreso, art. 9.2.a, retirable, borradas
// al día siguiente del evento; las demás, 7 días); en las condiciones para negocios, el apartado 3 quaterdecies (3m),
// la versión con sus 15 días y el aviso de arriba; la fecha y el historial. Sin desplazamiento horizontal ni errores
// de JavaScript. Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_preguntas_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { PREGUNTAS, fechaLegal } from './_fecha_ia.mjs';

if (!PREGUNTAS) {
  console.log('PREGUNTAS_DESDE = None en legal_preguntas.py: no hay textos de preguntas al reservar que mirar.');
  process.exit(0);
}
const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const V = esc(PREGUNTAS.version);
const [a, m, d] = PREGUNTAS.iso.split('-').map(Number);
const aplica = new Date(Date.UTC(a, m - 1, d + 15));
const MES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const AP_ES = `${aplica.getUTCDate()} de ${MES_ES[aplica.getUTCMonth()]} de ${aplica.getUTCFullYear()}`;
const AP_EN = `${aplica.getUTCDate()} ${MES_EN[aplica.getUTCMonth()]} ${aplica.getUTCFullYear()}`;
const corto = (x) => `${x.getUTCDate()}-${x.getUTCMonth() + 1}-${x.getUTCFullYear()}`;
const cortoEn = (x) => `${x.getUTCDate()} ${MES_EN[x.getUTCMonth()].slice(0, 3)} ${x.getUTCFullYear()}`;
const pub = new Date(Date.UTC(a, m - 1, d));

const PAGINAS = [
  ['/privacidad', fechaLegal('/privacidad', `Última actualización: ${PREGUNTAS.es} · Versión 2026-09-29`), [
    /Preguntas al reservar\s+Si un negocio hace preguntas al reservar un evento \(por ejemplo, «¿Menú infantil\?» o «¿Talla de camiseta\?»\), guardamos tus respuestas con tu reserva\. Puedes verlas y cambiarlas mientras tu reserva siga en pie\. Si una pregunta es sobre salud \(por ejemplo, alergias o intolerancias\), solo la respondes si marcas su casilla de consentimiento; puedes retirarlo cuando quieras desde tu código y borramos esa respuesta\s+Se las enseñamos al negocio y a su equipo solo para organizar ese evento\s+Ejecución del servicio que pides \(art\. 6\.1\.b RGPD\) y, para las respuestas de salud, tu consentimiento expreso \(art\. 9\.2\.a RGPD\)\s+Las respuestas de salud las borramos al día siguiente del evento; las demás, 7 días después, o esa misma noche si anulas la reserva/,
    // Va detrás de «Encargos».
    /Encargos\s+Si haces un encargo[\s\S]+?Preguntas al reservar\s+Si un negocio hace preguntas/,
    new RegExp(`Historial de cambios\\s+(?:.+\\n\\s*){0,1}?${PREGUNTAS.es}: Preguntas al reservar: fila nueva[^\\n]+consentimiento expreso \\(art\\. 9\\.2\\.a RGPD\\)`),
  ]],
  ['/en/privacy', fechaLegal('/en/privacy', `Last updated: ${PREGUNTAS.en} · Version 2026-09-29`), [
    /Booking questions\s+If a business asks questions when you book an event \(e\.g\. “Kids’ menu\?” or “T-shirt size\?”\), we store your answers with your booking\. You can see and change them while your booking stands\. If a question is about health \(e\.g\. allergies or intolerances\), you only answer it if you tick its consent box; you can withdraw consent at any time from your code and we delete that answer\s+We show them to the business and its team only to organise that event\s+Performance of the service you request \(Art\. 6\(1\)\(b\) GDPR\) and, for health answers, your explicit consent \(Art\. 9\(2\)\(a\) GDPR\)\s+We delete health answers the day after the event; the others 7 days after it, or the same night if you cancel/,
    new RegExp(`Change history\\s+(?:.+\\n\\s*){0,1}?${PREGUNTAS.en}: Booking questions: new row[^\\n]+explicit consent \\(Art\\. 9\\(2\\)\\(a\\) GDPR\\)`),
  ]],
  ['/negocios', fechaLegal('/negocios', `Última actualización: ${PREGUNTAS.es} · Versión ${PREGUNTAS.version}`), [
    /3 quaterdecies\. Preguntas al reservar\s+Puedes hacer las preguntas que quieras a quien reserva un evento\. Pregunta solo lo que necesites para ese evento\. Puedes preguntar por salud \(alergias, intolerancias…\) solo si lo necesitas para preparar el evento y marcando la pregunta como de salud \(Klendar la marca sola si detecta palabras de salud\): esas preguntas no pueden ser obligatorias y quien reserva solo las responde si da su consentimiento\. No pidas otras categorías especiales de datos \(religión, ideología, orientación sexual…\)\. Usa las respuestas solo para organizar ese evento: no las guardes fuera de Klendar más de lo necesario ni las uses para publicidad; las de salud, bórralas de tus copias \(también del CSV\) en cuanto pase el evento\. Eres responsable de lo que preguntas y de cómo usas las respuestas, también de las que exportas en el CSV\. Klendar puede retirar preguntas que incumplan estas normas\.\s+4\. Prueba/,
    /3 terdecies\. Encargos[\s\S]+?3 quaterdecies\. Preguntas al reservar/,
    new RegExp(`(?:«Preguntas al reservar» \\(apartado 3 quaterdecies\\)[^.]+ se aplica desde el|apartado 3 quaterdecies, «Preguntas al reservar»\\) se aplican desde el) ${esc(AP_ES)}`),
    new RegExp(`${V}\\s+${corto(pub)}\\s+${corto(aplica)}`),
    new RegExp(`Historial de cambios\\s+(?:.+\\n\\s*){0,3}?${PREGUNTAS.es}: Apartado 3 quaterdecies nuevo, «Preguntas al reservar»[^\\n]+Se aplica desde el ${esc(AP_ES)}`),
  ]],
  ['/en/business-terms', fechaLegal('/en/business-terms', `Last updated: ${PREGUNTAS.en} · Version ${PREGUNTAS.version}`), [
    /3m\. Booking questions\s+You may ask the questions you want to people booking an event\. Only ask what you need for that event\.[^\n]+those questions can’t be required and people booking only answer them if they give their consent\.[^\n]+Klendar may remove questions that breach these rules\.\s+4\. Free trial/,
    new RegExp(`(?:“Booking questions” \\(section 3m\\)[^.]+ applies from|section 3m, “Booking questions”\\) apply from) ${esc(AP_EN)}`),
    new RegExp(`${V}\\s+${cortoEn(pub)}\\s+${cortoEn(aplica)}`),
    new RegExp(`Change history\\s+(?:.+\\n\\s*){0,3}?${PREGUNTAS.en}: New section 3m, “Booking questions”[^\\n]+It applies from ${esc(AP_EN)}`),
  ]],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((x) => { x.open = true; }));
    const txt = (await p.locator('body').innerText()).replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
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
