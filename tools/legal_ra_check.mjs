// Prueba de RA1 (13-11-2026, aprobado por Iván): la fila «Avisos sobre
// respuestas de la IA» de la privacidad (ES y EN), junto a «Sugerencias y
// mejoras», con su base jurídica (interés legítimo), su plazo (un año después
// de revisarlo), la fecha del 13-11 y su línea en el historial. Sin
// desplazamiento horizontal ni errores de JavaScript. Chromium y WebKit, móvil
// (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_ra_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { fechaLegal } from './_fecha_ia.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad', fechaLegal('/privacidad', 'Última actualización: 13 de noviembre de 2026 · Versión 2026-09-29'), [
    /Sugerencias y mejoras[\s\S]+?Avisos sobre respuestas de la IA\s+Si nos avisas de una respuesta hecha con IA: esa respuesta, el motivo, tu nota y, si tienes cuenta, quién avisa\s+Revisarla y mejorar el servicio\s+Interés legítimo \(art\. 6\.1\.f RGPD\)[^\n]*\s+Lo borramos un año después de revisarlo/,
    /Historial de cambios\s+(?:.+\n\s*){0,2}?13 de noviembre de 2026: Fila nueva «Avisos sobre respuestas de la IA»/,
  ]],
  ['/en/privacy', fechaLegal('/en/privacy', 'Last updated: 13 November 2026 · Version 2026-09-29'), [
    /Ideas and feedback[\s\S]+?Reports about AI answers\s+If you tell us about an answer made with AI: that answer, the reason, your note and, if you have an account, who reported it\s+Reviewing it and improving the service\s+Legitimate interest[^\n]*\s+We delete it one year after reviewing it/,
    /Change history\s+(?:.+\n\s*){0,2}?13 November 2026: New “Reports about AI answers” row/,
  ]],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
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
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
