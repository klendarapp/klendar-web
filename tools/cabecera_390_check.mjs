// La cabecera a 390 px, el ancho del móvil más común (iPhone 12–15), con el
// nombre «Klendar» en todas las páginas (revisión del 3-11-2026, 1.2: en
// Explorar salía solo el símbolo). Era la barra de desplazamiento del
// escritorio: Explorar tiene scroll de página y, en una ventana de 390 px de
// un ordenador, la barra (15 px) le quita el sitio del nombre; en un móvil
// la barra va por encima y no ocupa. Aquí, como un móvil (`isMobile`): el
// nombre en todas; y a 360 px, todas solo con el símbolo (lo mismo en
// todas, que es lo que importa: «la barra no es constante», Iván, 2-11).
//
//   SUPABASE_BLOQUEADO=1 PORT=8821 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> BASE=http://localhost:8821 node tools/cabecera_390_check.mjs
import { playwright, servidorSeguro, supabaseVacio } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8821';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
const PAGINAS = ['/descubre', '/explorar', '/explorar?que=sitios', '/partidos', '/hoy/madrid/', '/precios', '/privacidad', '/cuenta'];
let fallos = 0;
const check = (msg, ok, extra = '') => {
  console.log(`${ok ? '✔' : '✘'} ${msg}${ok || !extra ? '' : ` (${extra})`}`);
  if (!ok) fallos++;
};

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const ancho of [390, 360]) {
    const ctx = await nav.newContext({
      viewport: { width: ancho, height: 844 }, isMobile: nombre === 'chromium', hasTouch: true,
      deviceScaleFactor: 3, locale: 'es-ES', timezoneId: 'Europe/Madrid',
    });
    // Lo que lee de pasada (formas de entrar, ciudades…): base vacía simulada.
    await supabaseVacio(ctx);
    const p = await ctx.newPage();
    const justas = [];
    for (const ruta of PAGINAS) {
      await p.goto(BASE + ruta, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(500);
      justas.push([ruta, await p.evaluate(() => document.querySelector('header.top')?.classList.contains('top-justa') ?? null)]);
    }
    const conNombre = justas.filter(([, j]) => j === false).map(([r]) => r);
    if (ancho === 390) check(`${nombre} · 390 px: «Klendar» en todas`, conNombre.length === PAGINAS.length, `solo el símbolo en ${justas.filter(([, j]) => j).map(([r]) => r).join(', ')}`);
    else check(`${nombre} · 360 px: igual en todas`, conNombre.length === 0 || conNombre.length === PAGINAS.length, JSON.stringify(justas));
    await ctx.close();
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
