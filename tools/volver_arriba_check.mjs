// Tocar otra vez «Descubre» o el logo estando en Descubre (Iván, 2026-10-28),
// como en la app: si no está en la primera publicación, vuelve a ella (con
// «Reducir movimiento», de un salto) sin pedir nada; si ya está, trae la
// lista otra vez sin recargar la página (la aguja del logo gira mientras).
// El logo se lee «Klendar, volver arriba» («Klendar, back to top»). Con Ctrl,
// el logo sigue siendo un enlace normal. En la web local contra dev, solo
// leyendo. Chromium y WebKit, móvil (la barra de abajo) y escritorio (las
// pestañas de arriba).
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/volver_arriba_check.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const PORT = Number(process.env.PORT || 8871);
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
});
for (let i = 0; i < 50; i++) {
  try { await fetch(`${BASE}/robots.txt`); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
}

/** Lo bajado en lo que se desliza (el <body> en Descubre; si no, el documento). */
const bajado = (page) => page.evaluate(() => Math.max(document.body.scrollTop, (document.scrollingElement || document.documentElement).scrollTop));

/** Va a la tercera publicación con el teclado (como la flecha ↓). */
async function baja(page) {
  await page.locator('#feed').focus().catch(() => {});
  for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(700); }
}

const ruta = '/descubre/?lat=40.417&lng=-3.704';
try {
  for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
    const nav = await tipo.launch();
    for (const [disp, vp, reducido] of [
      ['móvil', { width: 390, height: 780 }, false],
      ['escritorio', { width: 1280, height: 800 }, false],
      ['móvil reducido', { width: 390, height: 780 }, true],
    ]) {
      const movil = disp.startsWith('móvil');
      const ctx = await nav.newContext({
        viewport: vp, locale: 'es-ES', hasTouch: movil, isMobile: movil && nombre === 'chromium',
        reducedMotion: reducido ? 'reduce' : 'no-preference',
      });
      const page = await ctx.newPage();
      const t = `[${nombre} ${disp}]`;
      // Dev a veces da 500: se repite.
      for (let i = 0; i < 4; i++) {
        await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' });
        if (await page.locator('#feed > .tj').count()) break;
        await page.waitForTimeout(2000);
      }
      await page.waitForSelector('#feed > .tj');
      await page.waitForTimeout(800);
      const pedidas = [];
      page.on('request', (r) => { if (r.resourceType() === 'fetch' && new URL(r.url()).pathname === '/descubre/') pedidas.push(r.url()); });
      await page.evaluate(() => { window.__mismaPagina = true; });

      ok(await page.getAttribute('header.top a.brand', 'aria-label') === 'Klendar, volver arriba', `${t} el logo se lee «Klendar, volver arriba»`);
      const tab = page.locator(movil ? '.tabbar a[data-tab="descubre"]' : '.pestanas a[data-tab="descubre"]');
      const logo = page.locator('header.top a.brand');

      for (const [como, boton] of [['la pestaña', tab], ['el logo', logo]]) {
        await baja(page);
        const antes = await bajado(page);
        ok(antes > 100, `${t} ${como}: bajado a la tercera (${antes})`);
        const n = pedidas.length;
        await boton.click();
        if (reducido) {
          await page.waitForTimeout(120);
          ok(await bajado(page) === 0, `${t} ${como}: reducido, arriba de un salto`);
        } else {
          await page.waitForTimeout(120);
          const medio = await bajado(page);
          ok(medio > 0 && medio < antes, `${t} ${como}: sube con animación (${medio})`);
          await page.waitForTimeout(1500);
          ok(await bajado(page) === 0, `${t} ${como}: en la primera`);
        }
        ok(pedidas.length === n, `${t} ${como}: el primer toque no pide nada`);
        ok(new URL(page.url()).pathname === '/descubre/', `${t} ${como}: sigue en Descubre`);

        // Ya arriba: la lista otra vez, sin recargar la página.
        await boton.click();
        await page.waitForTimeout(60);
        const gira = await page.evaluate(() => {
          const ag = document.querySelector('header.top .brand .simbolo-aguja');
          return Boolean(ag && ag.getAnimations && ag.getAnimations().length);
        });
        ok(reducido ? !gira : gira, `${t} ${como}: ${reducido ? 'la aguja quieta' : 'la aguja gira'}`);
        await page.waitForFunction(() => !document.getElementById('feed').hasAttribute('aria-busy'), null, { timeout: 30000 });
        await page.waitForTimeout(1300);
        ok(pedidas.length === n + 1, `${t} ${como}: el segundo toque trae la lista (${pedidas.length - n})`);
        ok(await page.evaluate(() => window.__mismaPagina === true), `${t} ${como}: sin recargar la página`);
        ok(await page.locator('#feed > .tj').count() > 1, `${t} ${como}: con sus publicaciones`);
        ok(await bajado(page) === 0, `${t} ${como}: en la primera`);
        const giraAun = await page.evaluate(() => document.querySelector('header.top .brand .simbolo-aguja').getAnimations().length);
        ok(giraAun === 0, `${t} ${como}: la aguja para al acabar`);
        // Y se sigue pudiendo bajar.
        await baja(page);
        ok(await bajado(page) > 100, `${t} ${como}: se sigue bajando después`);
      }
      if (nombre === 'chromium' && !reducido) await page.screenshot({ path: `${OUT}/volver-arriba-${disp}.png` });

      // Con Ctrl (o Cmd), el logo es el enlace de siempre: no se intercepta
      // (sin Ctrl, sí). Se mira desde la ventana, después de la página.
      const intercepta = (ctrlKey) => page.evaluate((ctrl) => new Promise((res) => {
        window.addEventListener('click', (e) => { res(e.defaultPrevented); e.preventDefault(); }, { once: true });
        document.querySelector('header.top a.brand').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: ctrl, button: 0 }));
      }), ctrlKey);
      ok(await intercepta(true) === false, `${t} Ctrl+clic en el logo: el enlace de siempre`);
      ok(await intercepta(false) === true, `${t} clic en el logo: se queda en Descubre`);
      await ctx.close();
    }

    // En inglés.
    const ctx = await nav.newContext({ viewport: { width: 390, height: 780 }, locale: 'en-GB' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/en/discover/?lat=40.417&lng=-3.704`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    ok(await page.getAttribute('header.top a.brand', 'aria-label') === 'Klendar, back to top', `[${nombre} en] «Klendar, back to top»`);
    // En otra página, el logo sigue llevando a la portada.
    await page.goto(`${BASE}/explorar/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    ok(await page.getAttribute('header.top a.brand', 'aria-label') === null, `[${nombre}] fuera de Descubre, el logo es el de siempre`);
    await ctx.close();
    await nav.close();
  }
} finally {
  servidor.kill();
}
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
