// Revisión general, parte 4 (§4zzz-revweb): «Tu cuenta».
//  · `#view` no es una región viva (el lector leía la pantalla entera con
//    cada cambio, también cada segundo de una cuenta atrás); al cambiar de
//    pantalla dice solo su título (`#anuncio`).
//  · La zona de los negocios, una consulta por pantalla aunque haya turnos
//    de cola (antes, dos seguidas en Planes y en «Tus códigos»).
//  · «Algo ha fallado» se reintenta solo al volver la red.
// Con datos de mentira y la sesión de _cuenta_simulado (Chromium, ~15 s).
//
//   node tools/cuenta_revweb_check.mjs
import { webConDatos, NEGOCIOS } from './_web_con_datos.mjs';
import { playwright, SUPA } from './_supabase_simulado.mjs';
import { conSesionCuenta } from './_cuenta_simulado.mjs';

const web = await webConDatos({ puerto: 8975 });
const { chromium } = playwright();
const nav = await chromium.launch();
let fallos = 0;
const ok = (nombre, cond, extra = '') => { console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}${cond || !extra ? '' : ` (${extra})`}`); if (!cond) fallos++; };
const TURNO = { code: 'abc123', status: 'waiting', number: 7, ahead: 2, wait_minutes: 10, business: { id: NEGOCIOS[6].id, name: NEGOCIOS[6].name } };

async function contexto(extra) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  await conSesionCuenta(ctx, extra);
  return ctx;
}

// 1. Región viva y anuncio del título.
{
  const ctx = await contexto();
  const p = await ctx.newPage();
  await p.goto(`${web.BASE}/cuenta`);
  await p.waitForSelector('#view h1');
  ok('#view sin aria-live', (await p.getAttribute('#view', 'aria-live')) === null);
  await p.click('a[href="/cuenta/favoritos"]');
  await p.waitForFunction(() => location.pathname === '/cuenta/favoritos' && document.querySelector('#view h1'));
  await p.waitForTimeout(400);
  const [h1, anuncio] = await p.evaluate(() => [document.querySelector('#view h1').textContent.trim(), document.getElementById('anuncio')?.textContent || '']);
  ok('al cambiar de pantalla se anuncia su título', anuncio && anuncio === h1.replace(/\s+/g, ' '), `${anuncio} / ${h1}`);
  await ctx.close();
}

// 2. Una consulta de zonas con turnos de cola.
for (const ruta of ['/cuenta/planes', '/cuenta/codigos']) {
  const ctx = await contexto({ my_queue_turns: [TURNO] });
  let n = 0;
  ctx.on('request', (r) => { if (r.url().startsWith(`${SUPA}/rest/v1/businesses?`) && /time_zone/.test(decodeURIComponent(r.url()))) n++; });
  const p = await ctx.newPage();
  await p.goto(`${web.BASE}${ruta}`);
  await p.waitForSelector('.cola-tarjeta');
  await p.waitForTimeout(500);
  ok(`${ruta}: una consulta de zonas con un turno de cola`, n === 1, `${n}`);
  await ctx.close();
}

// 3. «Algo ha fallado», reintentado al volver la red.
{
  const ctx = await contexto();
  let cortar = true;
  await ctx.route(`${SUPA}/rest/v1/rpc/my_favorites`, (r) => (cortar ? r.abort('internetdisconnected') : r.fallback()));
  const p = await ctx.newPage();
  await p.goto(`${web.BASE}/cuenta/favoritos`);
  await p.waitForSelector('#reintentar', { timeout: 30000 }).catch(() => {});
  const conError = await p.locator('#reintentar').count();
  cortar = false;
  await p.evaluate(() => dispatchEvent(new Event('online')));
  await p.waitForTimeout(1500);
  ok('favoritos sin red: «Reintentar»', conError === 1);
  ok('al volver la red se reintenta solo', (await p.locator('#reintentar').count()) === 0);
  await ctx.close();
}

await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
