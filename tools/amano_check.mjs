// «Lo que más se usa, a mano» (Iván, 17-11; RUNBOOK de la app §4zz): lo que
// la web tiene que hacer igual que la app.
//
//   1. Tu código (o tu plan) arriba en «Tu cuenta», con las reglas de la app
//      (`pickUpNext`): un código de oferta siempre, una reserva desde 2 h
//      antes, sin código un plan guardado desde 2 h antes hasta que acaba.
//
// Sin navegador ni red: lee assets/cuenta/app.js y prueba sus funciones
// sueltas. Con BASE (y Playwright en PW o en la caché de npx), además pinta
// «Tu cuenta» con la base simulada (nada contra dev ni prod):
//
//   node tools/amano_check.mjs
//   SUPABASE_BLOQUEADO=1 PORT=8874 node tools/serve_dev.mjs &
//   BASE=http://localhost:8874 node tools/amano_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const app = readFileSync(new URL('assets/cuenta/app.js', raiz), 'utf8');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

/** Saca `function nombre(…) { … }` de app.js (con las constantes de antes). */
function funcion(nombre, previo = '') {
  const ini = app.indexOf(`function ${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre}`);
  let i = app.indexOf('{', ini);
  let nivel = 0;
  for (; i < app.length; i++) {
    if (app[i] === '{') nivel++;
    else if (app[i] === '}' && --nivel === 0) break;
  }
  return new Function(`${previo}${app.slice(ini, i + 1)}; return ${nombre};`)();
}

const consts = (app.match(/const ARRIBA_ANTES = [^\n]+\nconst ARRIBA_EVENTO = [^\n]+/) || [''])[0];
ok('1. las ventanas de la app (2 h antes, un evento dura 3 h)', /ARRIBA_ANTES = 2 \* 3600000/.test(consts) && /ARRIBA_EVENTO = 3 \* 3600000/.test(consts));
const elige = funcion('eligeArriba', `${consts};`);
const reloj = funcion('relojArriba');
const ahora = Date.parse('2026-11-17T17:00:00Z');
const iso = (min) => new Date(ahora + min * 60000).toISOString();
const r = (id, min, extra = {}) => ({ offer_id: id, offer_title: `Oferta ${id}`, status: 'pending', expires_at: iso(min), ...extra });
const ev = (id, min) => ({ id, kind: 'future_event', title: `Plan ${id}`, event_at: iso(min) });

ok('1. el código de oferta más urgente', elige([r('tarde', 1200), r('ya', 4), r('usado', 4, { status: 'validated' }), r('caducado', -1)], [ev('x', 30)], ahora)?.codigo?.offer_id === 'ya');
ok('1. una reserva, no antes de 2 h', elige([r('reserva', 480, { event_at: iso(300) })], [], ahora) === null);
ok('1. una reserva, desde 2 h antes', elige([r('reserva', 240, { event_at: iso(90) })], [], ahora)?.codigo?.offer_id === 'reserva');
ok('1. sin código, el plan que empieza en menos de 2 h', elige([], [ev('luego', 180), ev('ya', 60)], ahora)?.plan?.id === 'ya');
ok('1. el plan ya empezado sigue (3 h)', elige([], [ev('empezado', -30)], ahora)?.plan?.id === 'empezado');
ok('1. el plan acabado, no', elige([], [ev('fin', -240)], ahora) === null);
ok('1. una oferta guardada en su franja', elige([], [{ id: 'f', kind: 'flash_offer', title: 'F', redeem_start_at: iso(-10), redeem_end_at: iso(50) }], ahora)?.plan?.id === 'f');
ok('1. sin nada, nada', elige([], [], ahora) === null && elige(null, null, ahora) === null);
ok('1. la cuenta atrás como la app', reloj(252000) === '04:12' && reloj(3852000) === '1:04:12' && reloj(-5) === '00:00');
ok('1. arriba en «Tu cuenta», sin ×', /<div id="arriba-codigo" hidden><\/div>/.test(app) && /pintaArribaCuenta\(\$\('#arriba-codigo'\)\)/.test(app)
  && !/arriba-codigo[^\n]*close/.test(app));

// Con la web local y la base simulada: se pinta, abre el código y se va sola.
const BASE = process.env.BASE;
if (BASE) {
  const { playwright, REF, SUPA, realtimeMudo, servidorSeguro } = await import('./_supabase_simulado.mjs');
  const { chromium } = playwright();
  await servidorSeguro(BASE);
  const U = '0e7717e0-0000-4000-8000-0000000097d5';
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', exp: 4102444800, amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }], session_id: 'a0000000-0000-4000-8000-000000000002' })}.x`;
  const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'amano@example.com', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const SESION = JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

  const nav = await chromium.launch();
  const prueba = async (nombre, { canjes = [], guardados = [], lang = '' }, mira) => {
    const ctx = await nav.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    await ctx.addInitScript(([k, v, l]) => {
      try { localStorage.setItem(k, v); if (l) localStorage.setItem('klendar_lang', l); } catch { /* */ }
    }, [`sb-${REF}-auth-token`, SESION, lang]);
    await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await ctx.route(`${SUPA}/**`, async (route) => {
      const url = new URL(route.request().url());
      const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
      if (url.pathname.startsWith('/auth/v1/')) return json(url.pathname.endsWith('/user') ? USER : {});
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = url.pathname.slice('/rest/v1/rpc/'.length);
        if (fn === 'my_consents') return json({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true, name_asked_at: null, terms_current: '2026-09-29' });
        if (fn === 'my_redemptions') return json(typeof canjes === 'function' ? canjes() : canjes);
        if (fn === 'my_saved_offers') return json(guardados);
        if (fn === 'my_businesses' || fn === 'my_team_invites' || fn === 'my_business_transfers' || fn === 'my_promoter_invites' || fn === 'my_promoter_roles') return json([]);
        if (fn === 'my_tastes') return json({ c: [], city: null, asked: true });
        return json(null);
      }
      if (url.pathname.startsWith('/rest/v1/profiles')) {
        const fila = { id: U, display_name: 'Ana', avatar_url: null, birth_date: '1990-01-01' };
        return json(route.request().headers().accept?.includes('vnd.pgrst.object') ? fila : [fila]);
      }
      return json(route.request().headers().accept?.includes('vnd.pgrst.object') ? {} : []);
    });
    await realtimeMudo(ctx);
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.goto(`${BASE}/cuenta`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.perfil', { timeout: 15000 });
    await p.waitForTimeout(600);
    await mira(p);
    ok(`${nombre}: sin errores`, errores.length === 0);
    if (errores.length) console.log(errores.join('\n'));
    await ctx.close();
  };
  const en = (min) => new Date(Date.now() + min * 60000).toISOString();

  await prueba('web, código', { canjes: [{ id: 'r1', offer_id: 'o1', offer_title: 'Pedicura −25 %', status: 'pending', expires_at: en(0.2) }] }, async (p) => {
    const a = p.locator('#arriba-codigo a.arriba-codigo');
    ok('web: «Tu código: Pedicura −25 %» arriba', (await a.count()) === 1 && /Tu código:\s*Pedicura/.test(await a.innerText()));
    ok('web: abre el código', (await a.getAttribute('href')) === '/cuenta/codigo/o1');
    ok('web: la cuenta atrás en coral', /^00:\d\d$/.test((await p.locator('.arriba-d.coral').innerText()).trim()));
    ok('web: sin ×', (await p.locator('#arriba-codigo button').count()) === 0);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
    const arriba = await p.evaluate(() => {
      const c = document.querySelector('#arriba-codigo').getBoundingClientRect();
      const f = document.querySelector('.perfil').getBoundingClientRect();
      return c.bottom <= f.top && document.documentElement.scrollWidth <= innerWidth;
    });
    ok('web: encima del perfil y sin scroll de lado (360)', arriba);
    await p.waitForTimeout(13500);
    ok('web: al caducar se va sola', (await p.locator('#arriba-codigo a').count()) === 0 && await p.locator('#arriba-codigo').isHidden());
  });
  await prueba('web, plan', { guardados: [{ id: 'e1', kind: 'future_event', title: 'Concierto', event_at: en(45) }] }, async (p) => {
    const a = p.locator('#arriba-codigo a.arriba-codigo');
    ok('web: «Tu plan: Concierto · hh:mm»', /Tu plan:\s*Concierto/.test(await a.innerText()) && /\d\d:\d\d/.test(await p.locator('.arriba-d').innerText()));
    ok('web: el plan no va en coral', (await p.locator('.arriba-d.coral').count()) === 0);
    ok('web: abre la publicación', (await a.getAttribute('href')) === '/o/e1');
  });
  await prueba('web, en inglés', { lang: 'en', canjes: [{ id: 'r2', offer_id: 'o2', offer_title: '2x1', status: 'pending', expires_at: en(600) }] }, async (p) => {
    ok('web: «Your code: 2x1 · Show»', /Your code:\s*2x1/.test(await p.locator('#arriba-codigo').innerText()));
  });
  await prueba('web, nada', {}, async (p) => {
    ok('web: sin código ni plan, nada', await p.locator('#arriba-codigo').isHidden());
  });
  await nav.close();
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
