// Revisión general, parte 4 (§4zzz-revweb): el scroll sin fin de Descubre
// vuelve a intentarlo. Si la página siguiente no llega (sin red, un corte),
// antes se dejaba de vigilar «Ver más» y Descubre se quedaba parada para
// siempre; ahora se reintenta al volver la red (`online`) o, si no, a los
// pocos segundos. Un 4xx no se reintenta. Con datos de mentira, Chromium (~15 s).
//
//   node tools/feed_reintenta_check.mjs
import { webConDatos, DATOS, PLANES } from './_web_con_datos.mjs';
import { playwright } from './_supabase_simulado.mjs';

// 40 ofertas más: Descubre tiene página 2.
const MAS = Array.from({ length: 40 }, (_, i) => ({ ...PLANES[0], id: `a9000000-0000-4000-8000-0000000009${String(i).padStart(2, '0')}`, title: `Oferta extra ${i + 1}` }));
const web = await webConDatos({ puerto: 8971, datos: { ...DATOS, PLANES: [...PLANES, ...MAS] } });
const { chromium } = playwright();
const nav = await chromium.launch();
let fallos = 0;
const ok = (nombre, cond) => { console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`); if (!cond) fallos++; };

async function prueba(nombre, { aborta, status }) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  let pedidas = 0;
  await ctx.route(/\/descubre\?.*\bp=2\b/, (r) => {
    pedidas++;
    if (pedidas === 1 && aborta) return r.abort('internetdisconnected');
    if (status) return r.fulfill({ status, contentType: 'text/html', body: '<p>no</p>' });
    return r.fallback();
  });
  const p = await ctx.newPage();
  await p.goto(`${web.BASE}/descubre`);
  const tarjetas = () => p.locator('#feed .tj').count();
  const antes = await tarjetas();
  const mas = p.locator('[data-feed-mas]');
  if (!(await mas.count())) { ok(`${nombre}: hay página 2`, false); await ctx.close(); return null; }
  await mas.first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  if (aborta === 'online') await p.evaluate(() => dispatchEvent(new Event('online')));
  let despues = antes;
  for (let i = 0; i < (aborta === 'online' ? 6 : 30) && despues <= antes; i++) { await p.waitForTimeout(300); despues = await tarjetas(); }
  await ctx.close();
  return { antes, despues, pedidas };
}

let r = await prueba('falla una vez', { aborta: 'tiempo' });
ok('falla una vez: vuelve a pedirla sola y llegan más tarjetas', r && r.pedidas >= 2 && r.despues > r.antes);
r = await prueba('vuelve la red', { aborta: 'online' });
ok('al volver la red: la pide otra vez enseguida (antes de los 4 s)', r && r.pedidas >= 2 && r.despues > r.antes);
r = await prueba('4xx', { status: 404 });
ok('un 404 no se reintenta', r && r.pedidas === 1 && r.despues === r.antes);

await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
