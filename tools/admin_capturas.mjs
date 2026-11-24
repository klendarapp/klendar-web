// Capturas del admin (admin.klendar.app), pantalla por pantalla, para revisarlas
// a ojo (revisión de coherencia, parte 3; RUNBOOK §4zzz-coherencia3). Con la
// sesión de mentira de _admin_simulado (y el Supabase falso de _web_con_datos):
// no toca dev ni prod. No es una prueba: solo hace PNG (página entera, hasta
// 6.000 px) y, si una pantalla no se pinta («Algo ha fallado»), lo dice.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/admin_capturas.mjs
//
// Con variables (separadas por comas; sin ellas, lo de por defecto):
//   SOLO=resumen,negocios               (por defecto, todas las de PANTALLAS_ADMIN y «entrar»)
//   TAMANOS=390x844,1280x800            (por defecto, 360, 390, 768, 1024 en las dos, 1280, 1920)
//   TEMAS=light,dark                    (por defecto, light)
//   NAV=chromium|webkit                 (por defecto, chromium)
//   MIDE=1                              además, los bordes (tools/_bordes.mjs) en MIDE.json
//   MIDE=solo                           solo los bordes, sin capturas
//   CSS_EXTRA=<fichero.css>             una propuesta: esa hoja encima de la página (no toca la web)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { adminDe, playwright } from './_supabase_simulado.mjs';
import { webConDatos } from './_web_con_datos.mjs';
import { PANTALLAS_ADMIN, conSesionAdmin } from './_admin_simulado.mjs';
import { bordesPantalla } from './_bordes.mjs';

const pw = playwright();
const OUT = process.env.OUT || 'tools/out/admin-capturas';
mkdirSync(OUT, { recursive: true });
const lista = (v, d) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : d);
const SOLO = lista(process.env.SOLO, []);
const pantallas = [['entrar', '/'], ...PANTALLAS_ADMIN].filter(([n]) => !SOLO.length || SOLO.includes(n));
const TAMANOS = lista(process.env.TAMANOS, ['360x780', '390x844', '768x1024', '1024x768', '1024x1366', '1366x1024', '1280x800', '1920x1080']).map((t) => t.split('x').map(Number));
const TEMAS = lista(process.env.TEMAS, ['light']);
const NAV = process.env.NAV || 'chromium';

const web = await webConDatos({ puerto: Number(process.env.PORT || 9431) });
const ADMIN = adminDe(web.BASE);
const nav = await pw[NAV].launch();
let n = 0;
const medidas = [];
const fallidas = new Set();
try {
  for (const [w, h] of TAMANOS) {
    for (const tema of TEMAS) {
      for (const entrar of [true, false]) {
        const mias = pantallas.filter(([nombre]) => (nombre === 'entrar') === entrar);
        if (!mias.length) continue;
        const ctx = await nav.newContext({ viewport: { width: w, height: h }, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid',
          ...(NAV === 'chromium' ? { isMobile: w < 800 } : {}), hasTouch: w < 1000 });
        await web.conDatos(ctx);
        await conSesionAdmin(ctx, { entrar });
        const p = await ctx.newPage();
        const errores = [];
        p.on('pageerror', (e) => errores.push(e.message));
        for (const [nombre, ruta] of mias) {
          try {
            errores.length = 0;
            await p.goto(ADMIN + ruta, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
            await p.waitForSelector(entrar ? '#login:not([hidden])' : '#view h1, #view h2', { timeout: 10000 }).catch(() => {});
            await p.waitForFunction(() => !document.querySelector('#view .loading'), null, { timeout: 6000 }).catch(() => {});
            if (process.env.CSS_EXTRA) await p.addStyleTag({ content: readFileSync(process.env.CSS_EXTRA, 'utf8') });
            await p.waitForTimeout(600);
            const roto = await p.evaluate(() => (document.querySelector('#view .vacio h2')?.textContent || '').includes('Algo ha fallado') ? document.querySelector('#view .vacio p')?.textContent : '');
            if (roto || errores.length) { fallidas.add(nombre); console.log('rota:', nombre, w, roto || '', errores.join(' | ')); }
            const fichero = `${nombre}_${w}x${h}_${tema}${NAV === 'chromium' ? '' : `_${NAV}`}.png`;
            if (process.env.MIDE) medidas.push({ nombre, ruta, w, h, tema, nav: NAV, ...(await p.evaluate(bordesPantalla, entrar ? '#login' : '#view > div')),
              sobra: await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) });
            if (process.env.MIDE === 'solo') { n += 1; continue; }
            const alto = Math.min(6000, await p.evaluate(() => document.documentElement.scrollHeight));
            if (alto > h) { await p.setViewportSize({ width: w, height: alto }); await p.waitForTimeout(250); }
            await p.screenshot({ path: `${OUT}/${fichero}` });
            if (alto > h) await p.setViewportSize({ width: w, height: h });
            n += 1;
          } catch (e) { console.log('no pude:', nombre, w, h, tema, e.message.split('\n')[0]); }
        }
        await ctx.close();
      }
    }
  }
} finally {
  await nav.close();
  await web.cierra();
}
if (process.env.MIDE) writeFileSync(`${OUT}/MIDE.json`, JSON.stringify(medidas, null, 1));
console.log(`${n} capturas en ${OUT}${fallidas.size ? ` · sin pintar: ${[...fallidas].join(', ')}` : ''}`);
process.exit(0);
