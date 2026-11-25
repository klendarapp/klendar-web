// «Mira lo que hay cerca de ti · Activar» en la web, como la app (Iván,
// 25-11-2026; RUNBOOK §4zzz-ubicacion-web2; `LocationBannerNotice` y
// `PromptGate` de la app), con las Functions de verdad contra el Supabase
// falso, en Chromium y WebKit, móvil y escritorio:
//
//  - Descubre (uno de sus avisos, `#ubic`) y Explorar (antes «Mira primero lo
//    que tienes más cerca.»): el texto de la app, «Activar» y su ×.
//  - Solo con el permiso en «preguntar»: concedido (se usa solo) o denegado,
//    nada.
//  - Visible desde el principio, sin mover nada después (lo decide el <head>).
//  - Topes: 3 veces, cada 14 días, un aviso opcional por visita
//    (`klendar.aviso.ubicacion`, `klendar.aviso.sesion`); en la misma visita
//    sigue hasta la × (y la × la quita para la visita).
//  - «Activar» pide la ubicación y va a tu celda.
//  - Con la pregunta de la edad, espera a que se conteste.
//
//   node tools/aviso_ubicacion_check.mjs     (AVISO_RAPIDO=1: solo Chromium)
import { webConDatos } from './_web_con_datos.mjs';

const KCe = (await import('../assets/celda.js')).default;
let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const MADRID = { lat: 40.41123, lng: -3.70687 };
const CELDA = KCe.de(MADRID.lat, MADRID.lng);

let PW = process.env.PW;
if (!PW) {
  try {
    const { readdirSync } = await import('node:fs');
    const base = `${process.env.LOCALAPPDATA || ''}\\npm-cache\\_npx`;
    for (const d of readdirSync(base)) { try { readdirSync(`${base}\\${d}\\node_modules\\playwright`); PW = `${base}\\${d}\\node_modules\\playwright`; break; } catch { /* otra */ } }
  } catch { /* sin caché de npx */ }
}
if (!PW) { console.log('(sin Playwright: me salto la prueba)'); process.exit(0); }
process.env.PW = PW;
const { playwright } = await import('./_supabase_simulado.mjs');
const pw = playwright();
// Sin la pregunta de la edad (aparte, abajo, con ella).
const conEdad = process.argv.includes('--edad');
const web = await webConDatos({ puerto: Number(process.env.PORT || 8987), tablas: conEdad ? {} : { app_config: [{ key: 'adults_gate', value: { enabled: false } }] } });
const BASE = web.BASE;

// Lo que se ve al acabar de leer la página (antes de los scripts con defer
// no: el <head> ya ha decidido) y dónde está lo de debajo.
const mira = ({ estado }) => {
  if (estado && navigator.permissions) {
    const q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => (d && d.name === 'geolocation' ? Promise.resolve({ state: estado }) : q(d));
  }
  const sel = '#ubic, .cerca-aviso[data-aviso-ubic]';
  const debajo = () => document.querySelector('#feed .tj, .tjs, #dia, .cal, .tj-filas, .exp-lista, main h2');
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.querySelector(sel);
    const d = debajo();
    window.__alLeer = { visible: Boolean(el && getComputedStyle(el).display !== 'none'), y: d ? Math.round(d.getBoundingClientRect().top) : null };
  });
};
async function contexto(nav, { permiso = 'prompt', vp, estado = '' } = {}) {
  const ctx = await nav.newContext({ geolocation: { latitude: MADRID.lat, longitude: MADRID.lng, accuracy: 10 }, ...(permiso === 'granted' ? { permissions: ['geolocation'] } : {}), locale: 'es-ES', viewport: vp });
  await ctx.addInitScript(mira, { estado });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  return { ctx, p, errores };
}
const quieto = async (p) => { await p.waitForLoadState('networkidle').catch(() => {}); await espera(1500); };
const SEL = '#ubic, .cerca-aviso[data-aviso-ubic]';
const DENTRO = (x) => `#ubic ${x}, .cerca-aviso[data-aviso-ubic] ${x}`;
const visible = (p) => p.locator(SEL).first().isVisible().catch(() => false);
const guardado = (p) => p.evaluate(() => ({ l: JSON.parse(localStorage.getItem('klendar.aviso.ubicacion') || 'null'), s: sessionStorage.getItem('klendar.aviso.sesion') }));
const despues = (p) => p.evaluate(() => {
  const d = document.querySelector('#feed .tj, .tjs, #dia, .cal, .tj-filas, .exp-lista, main h2');
  return d ? Math.round(d.getBoundingClientRect().top) : null;
});

const tipos = process.env.AVISO_RAPIDO ? ['chromium'] : ['chromium', 'webkit'];
for (const tipo of tipos) {
  const nav = await pw[tipo].launch();
  try {
    if (conEdad) {
      // Con la pregunta de la edad: espera; al contestar «Soy menor», sale.
      const { ctx, p, errores } = await contexto(nav, { vp: { width: 1280, height: 800 } });
      await p.goto(`${BASE}/explorar?vista=lista`);
      await quieto(p);
      const hayEdad = await p.locator('[data-edad]').count();
      if (!hayEdad) console.log(`(${tipo}: sin la pregunta de la edad en los datos de prueba; me salto esto)`);
      else {
        ok(!(await visible(p)), `${tipo} edad: con la pregunta a la vista, la franja espera`);
        await p.click('[data-edad-no]');
        await espera(500);
        ok(await visible(p), `${tipo} edad: al contestar «Soy menor», sale la franja`);
        ok((await guardado(p)).l?.n === 1, `${tipo} edad: cuenta entonces, no antes`, JSON.stringify(await guardado(p)));
      }
      ok(!errores.length, `${tipo} edad: sin errores`, errores.join(' | '));
      await ctx.close();
      continue;
    }
    // ¿Dice este navegador cómo está el permiso? (El WebKit de Playwright en
    // Windows no: `permissions.query` no admite la ubicación.) Si no lo dice,
    // no se molesta: la franja no sale (y la vez siguiente, ni un momento).
    {
      const { ctx, p } = await contexto(nav, { vp: { width: 1280, height: 800 } });
      await p.goto(`${BASE}/descubre?ciudad=madrid`);
      const sabe = await p.evaluate(async () => { try { await navigator.permissions.query({ name: 'geolocation' }); return true; } catch { return false; } });
      await ctx.close();
      if (!sabe) {
        for (const ruta of ['/descubre', '/explorar?vista=lista']) {
          const c = await contexto(nav, { vp: { width: 1280, height: 800 } });
          await c.p.goto(`${BASE}${ruta}`);
          await quieto(c.p);
          ok(!(await visible(c.p)) && (await guardado(c.p)).l?.p === '?', `${tipo} ${ruta}: sin saber el permiso, no sale`, JSON.stringify(await guardado(c.p)));
          await c.p.evaluate(() => sessionStorage.clear());
          await c.p.goto(`${BASE}${ruta}`);
          await quieto(c.p);
          ok(!(await c.p.evaluate(() => window.__alLeer?.visible)), `${tipo} ${ruta}: la vez siguiente, ni al leer la página`);
          ok(!c.errores.length, `${tipo} ${ruta}: sin errores`, c.errores.join(' | '));
          await c.ctx.close();
        }
        continue;
      }
    }
    for (const [vpn, vp] of [['móvil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
      for (const [nombre, ruta, texto] of [['Descubre', '/descubre', 'Mira lo que hay cerca de ti'], ['Explorar', '/explorar?vista=lista', 'Mira lo que hay cerca de ti'], ['Discover', '/en/discover', 'See what’s near you']]) {
        const t = `${tipo} ${vpn} ${nombre}`;
        // 1. Pendiente, la primera vez: desde el principio y sin saltos.
        const { ctx, p, errores } = await contexto(nav, { vp });
        await p.goto(`${BASE}${ruta}`);
        await quieto(p);
        const al = await p.evaluate(() => window.__alLeer);
        const y = await despues(p);
        ok(al?.visible && (await visible(p)), `${t}: con el permiso por preguntar, la franja, ya al leer la página`, JSON.stringify(al));
        ok(al?.y === y, `${t}: sin mover nada después (lo de debajo, en ${al?.y} y luego ${y})`);
        const txt = await p.locator(SEL).first().innerText();
        ok(txt.includes(texto) && /Activar|Turn on/.test(txt) && (await p.locator(DENTRO('[data-ubic-x]')).count()) === 1, `${t}: «${texto} · Activar» y su ×, como la app`, txt);
        ok(!/Mira primero lo que tienes más cerca/.test(await p.locator('main').innerText()), `${t}: sin el aviso de antes`);
        if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/franja-${nombre}-${vpn}-${tipo}.png` });
        let g = await guardado(p);
        ok(g.l?.n === 1 && g.l?.p === 'prompt' && g.s === 'ubicacion', `${t}: cuenta una vez (y es el aviso de esta visita)`, JSON.stringify(g));
        // En la misma visita sigue (sin contar otra vez).
        await p.goto(`${BASE}${ruta}`);
        await quieto(p);
        g = await guardado(p);
        ok(await visible(p) && g.l?.n === 1, `${t}: en la misma visita sigue, sin contar otra vez`, JSON.stringify(g));
        // La × la quita para la visita.
        await p.click(DENTRO('[data-ubic-x]'));
        ok(!(await visible(p)), `${t}: la × la quita`);
        await p.goto(`${BASE}${ruta}`);
        await quieto(p);
        ok(!(await visible(p)), `${t}: y no vuelve en esta visita`);
        // Otra visita: no antes de 14 días; luego sí; nunca más de 3.
        for (const [l, sale, que] of [[{ n: 1, t: Date.now() - 3 * 864e5, p: 'prompt' }, false, 'hace 3 días'], [{ n: 1, t: Date.now() - 15 * 864e5, p: 'prompt' }, true, 'hace 15 días'],
          [{ n: 3, t: Date.now() - 30 * 864e5, p: 'prompt' }, false, 'ya 3 veces']]) {
          await p.evaluate((x) => { sessionStorage.clear(); localStorage.setItem('klendar.aviso.ubicacion', JSON.stringify(x)); }, l);
          await p.goto(`${BASE}${ruta}`);
          await quieto(p);
          ok((await visible(p)) === sale, `${t}: otra visita, la última ${que}: ${sale ? 'sale' : 'no sale'}`);
        }
        // Otro aviso opcional ya en esta visita: no.
        await p.evaluate(() => { localStorage.removeItem('klendar.aviso.ubicacion'); sessionStorage.setItem('klendar.aviso.sesion', 'otro'); });
        await p.goto(`${BASE}${ruta}`);
        await quieto(p);
        ok(!(await visible(p)), `${t}: con otro aviso opcional ya en esta visita, no`);
        ok(!errores.length, `${t}: sin errores`, errores.join(' | '));
        await ctx.close();
      }
    }
    // Denegado: nada (y la vez siguiente, ni al leer la página).
    for (const ruta of ['/descubre', '/explorar?vista=lista']) {
      const { ctx, p } = await contexto(nav, { vp: { width: 1280, height: 800 }, estado: 'denied' });
      await p.goto(`${BASE}${ruta}`);
      await quieto(p);
      ok(!(await visible(p)), `${tipo} ${ruta}: con el permiso denegado, nada`);
      await p.evaluate(() => sessionStorage.clear());
      await p.goto(`${BASE}${ruta}`);
      await quieto(p);
      const al = await p.evaluate(() => window.__alLeer);
      ok(!al?.visible && (await guardado(p)).l?.p === 'denied' && !(await guardado(p)).l?.n, `${tipo} ${ruta}: denegado, ni al leer la página la vez siguiente, y sin contar`, JSON.stringify(await guardado(p)));
      await ctx.close();
    }
    // Concedido: se usa sola (a tu celda) y la franja no está.
    {
      const { ctx, p } = await contexto(nav, { permiso: 'granted', vp: { width: 1280, height: 800 } });
      await p.goto(`${BASE}/descubre`);
      await p.waitForURL(/celda=/, { timeout: 10000 }).catch(() => {});
      await quieto(p);
      ok(new URL(p.url()).searchParams.get('celda') === CELDA && !(await p.locator(SEL).count()), `${tipo}: con el permiso concedido, a tu celda y sin franja`, p.url());
      ok(!(await guardado(p)).l?.n, `${tipo}: concedido, no cuenta`, JSON.stringify(await guardado(p)));
      await ctx.close();
    }
    // «Activar»: pide la ubicación y a tu celda.
    {
      const { ctx, p } = await contexto(nav, { vp: { width: 1280, height: 800 } });
      await p.goto(`${BASE}/explorar?vista=lista`);
      await quieto(p);
      await ctx.grantPermissions(['geolocation']);
      await p.click(DENTRO('[data-cerca]'));
      await p.waitForURL(/celda=/, { timeout: 10000 }).catch(() => {});
      ok(new URL(p.url()).searchParams.get('celda') === CELDA, `${tipo}: «Activar» pide la ubicación y va a tu celda`, p.url());
      ok((await guardado(p)).s === 'ubicacion-x', `${tipo}: después de «Activar», no vuelve en esta visita`);
      await ctx.close();
    }
    // Con una ciudad o «Todas las ciudades» elegidas: nada.
    {
      const { ctx, p } = await contexto(nav, { vp: { width: 1280, height: 800 } });
      for (const ruta of ['/descubre?ciudad=madrid', '/explorar?todas=1&vista=lista', `/descubre?celda=${CELDA}`]) {
        await p.goto(`${BASE}${ruta}`);
        await quieto(p);
        ok(!(await p.locator(SEL).count()), `${tipo} ${ruta}: con algo elegido, sin franja`);
      }
      await ctx.close();
    }
  } finally {
    await nav.close();
  }
}

await web.cierra();
console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
