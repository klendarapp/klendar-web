// Capturas del panel de negocios, pantalla por pantalla, para revisarlas a ojo
// (revisión de coherencia, parte 1; RUNBOOK §4zzz-coherencia1). Con la sesión
// y el Supabase de mentira de panel_app_check (_web_con_datos): no toca dev ni
// prod. No es una prueba: solo hace PNG (página entera).
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/panel_capturas.mjs
//
// Con variables (separadas por comas; sin ellas, lo de por defecto):
//   RUTAS=hoy,validar,publicar          (por defecto, todas las de SECCIONES_PANEL)
//   TAMANOS=390x844,1280x800            (por defecto, 360, 390, 768, 1024 en las dos, 1280, 1920)
//   TEMAS=light,dark                    (por defecto, light)
//   PAPELES=owner,manager,staff,entidad (por defecto, owner)
//   NAV=chromium|webkit                 (por defecto, chromium)
//   RESERVAS=0                          sin reservas hoy (dos cifras en Hoy)
//   MIDE=1                              además, los bordes de cada pantalla (tools/_bordes.mjs) en MIDE.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { playwright } from './_supabase_simulado.mjs';
import { webConDatos } from './_web_con_datos.mjs';
import { PUBS, rpcs, conSesion } from './_panel_simulado.mjs';
import { SECCIONES_PANEL } from '../functions/_lib/panel.js';
import { bordesPantalla } from './_bordes.mjs';

const pw = playwright();
const OUT = process.env.OUT || 'tools/out/capturas';
mkdirSync(OUT, { recursive: true });
const lista = (v, d) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : d);

const RUTAS = lista(process.env.RUTAS, [...SECCIONES_PANEL.filter((s) => s !== 'publicaciones'), `publicaciones/${PUBS[0].id}`]);
const TAMANOS = lista(process.env.TAMANOS, ['360x780', '390x844', '768x1024', '1024x768', '1024x1366', '1366x1024', '1280x800', '1920x1080'])
  .map((t) => t.split('x').map(Number));
const TEMAS = lista(process.env.TEMAS, ['light']);
const PAPELES = lista(process.env.PAPELES, ['owner']);
const NAV = process.env.NAV || 'chromium';

const web = await webConDatos({ puerto: Number(process.env.PORT || 9391) });
const nav = await pw[NAV].launch();
let n = 0;
const medidas = [];
try {
  for (const papel of PAPELES) {
    for (const [w, h] of TAMANOS) {
      for (const tema of TEMAS) {
        const ctx = await nav.newContext({ viewport: { width: w, height: h }, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid',
          ...(NAV === 'chromium' ? { isMobile: w < 800 } : {}), hasTouch: w < 1000 });
        await web.conDatos(ctx);
        await conSesion(ctx, rpcs(papel, { reservas: process.env.RESERVAS !== '0' }));
        const p = await ctx.newPage();
        for (const ruta of RUTAS) {
          try {
            await p.goto(`${web.BASE}/panel/${ruta}`);
            await p.waitForSelector('#view h1, #view h2', { timeout: 12000 }).catch(() => {});
            await p.waitForTimeout(900);
            const nombre = `${papel}_${w}x${h}_${tema}${NAV === 'chromium' ? '' : `_${NAV}`}_${ruta.replace(/\//g, '-').replace(/-[0-9a-f-]{36}$/, '-id')}.png`;
            if (process.env.MIDE) medidas.push({ papel, w, h, tema, ruta, ...(await p.evaluate(bordesPantalla)) });
            // La página entera, pero con la ventana de su alto: así la barra de
            // abajo (fija) sale abajo y no en medio de la captura.
            const alto = Math.min(6000, await p.evaluate(() => document.documentElement.scrollHeight));
            if (alto > h) { await p.setViewportSize({ width: w, height: alto }); await p.waitForTimeout(250); }
            await p.screenshot({ path: `${OUT}/${nombre}` });
            if (alto > h) await p.setViewportSize({ width: w, height: h });
            n += 1;
          } catch (e) { console.log('no pude:', papel, w, h, tema, ruta, e.message.split('\n')[0]); }
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
console.log(`${n} capturas en ${OUT}`);
process.exit(0);
