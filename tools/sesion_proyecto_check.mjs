// La cabecera solo enseña la sesión del Supabase al que apunta la web (Iván,
// 2026-11-04: al pasar la web de dev a prod, «Tu cuenta» pedía entrar y la
// cabecera seguía con su foto, la de la sesión de dev del navegador).
// En la web local, Chromium, con Supabase falso (ninguna petición del
// navegador sale a Supabase):
//  1. Con la sesión de OTRO proyecto (y sus gustos, su negocio y sus
//     códigos), en «Tu cuenta» (estática) y en Descubre (Function): «Entrar»
//     desde el primer pintado, sin foto ni campana; la sesión de otro y lo de
//     esa cuenta se borran; la marca del proyecto (`klendar.sb`) queda; CLS < 0,01
//     (como saltos_check).
//  2. Con la sesión de ESTE proyecto: la foto desde el primer pintado (con la
//     marca) y no se borra nada; sin la marca (la primera vez), se confirma
//     con config.js y sale la foto.
//  2b. Con sesión de otro usuario en este proyecto, sin foto, y la vieja de
//     otro proyecto (con foto): la inicial del de ahora, nunca la otra foto.
//  3. «Cerrar sesión» en «Tu cuenta»: la cabecera vuelve a «Entrar» y la
//     sesión, los gustos y el negocio se borran.
//
//   SUPABASE_BLOQUEADO=1 PORT=8877 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> BASE=http://localhost:8877 node tools/sesion_proyecto_check.mjs
import { playwright, REF, OTRO_REF, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8877';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
// El otro proyecto de Klendar (dev si la web va a prod, y al revés).
const OTRO = OTRO_REF;
const U = '0e7717e0-0000-4000-8000-0000000094a2';
const FOTO = 'https://example.com/foto-de-ivan.jpg';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'yo@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Iván', avatar_url: FOTO }, created_at: '2026-01-01T00:00:00Z' };
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1' })}.firma`;
const SESION = JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const DE_LA_CUENTA = {
  'klendar.gustos': JSON.stringify({ c: ['musica'], home: { slug: 'zaragoza', name: 'Zaragoza', lat: 41.65, lng: -0.88 } }),
  'klendar.biz': '11111111-1111-4111-8111-111111111111',
  [`klendar.codigos.${U}`]: '{}',
};

// Cómo está la cabecera justo después de cabecera-yo.js (antes del primer
// pintado) y el desplazamiento de maquetación de toda la carga.
function medir() {
  const d = { cls: 0, primero: null, de: [] };
  window.__m = d;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        d.cls += e.value;
        d.de.push(`${e.value.toFixed(4)} ${(e.sources || []).map((x) => (x.node && x.node.nodeType === 1 ? `${x.node.tagName}.${String(x.node.className).split(' ')[0]}` : '?')).join(',')}`);
      } })
      .observe({ type: 'layout-shift', buffered: true });
  } catch { /* sin layout-shift */ }
  let v;
  Object.defineProperty(window, 'KL_YO', {
    configurable: true,
    get: () => v,
    set: (x) => {
      v = x;
      queueMicrotask(() => {
        if (d.primero) return;
        const b = document.querySelector('.top-entrar');
        d.primero = { yo: Boolean(b && b.classList.contains('top-yo')), foto: b?.querySelector('img')?.getAttribute('src') || null };
      });
    },
  });
}
const estado = (p) => p.evaluate(() => {
  const b = [...document.querySelectorAll('.top-entrar')].find((x) => x.offsetParent) || document.querySelector('.top-entrar');
  const c = [...document.querySelectorAll('[data-campana]')].find((x) => !x.hidden);
  return {
    m: window.__m,
    yo: Boolean(b && b.classList.contains('top-yo')),
    foto: b?.querySelector('img')?.getAttribute('src') || null,
    campana: Boolean(c),
    claves: Object.keys(localStorage).sort(),
    marca: localStorage.getItem('klendar.sb'),
  };
});

const supabaseFalso = (route) => {
  const p = new URL(route.request().url()).pathname;
  const j = (x, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(x) });
  if (p.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
  if (p.startsWith('/auth/v1/user')) return j(USER);
  if (p.startsWith('/rest/v1/rpc/my_consents')) return j({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true });
  if (p.startsWith('/rest/v1/')) return j([]);
  return j({});
};

const nav = await chromium.launch();
async function contexto(guardado) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript((g) => {
    try {
      if (sessionStorage.getItem('__sembrado')) return;
      sessionStorage.setItem('__sembrado', '1');
      for (const [k, v] of Object.entries(g)) localStorage.setItem(k, v);
      localStorage.setItem('klendar_lang', 'es');
    } catch { /* */ }
  }, guardado);
  await ctx.addInitScript(medir);
  // Nada del navegador sale a Supabase (ni al de dev ni al de prod).
  await ctx.route(/https:\/\/[a-z0-9]+\.supabase\.co\//, supabaseFalso);
  await ctx.route(FOTO, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  return { ctx, page, errores };
}
const sinCuenta = (e) => !e.claves.some((k) => k.startsWith(`sb-${OTRO}-`) || k in DE_LA_CUENTA || k.startsWith('klendar.codigos.'));

// 1. La sesión de otro proyecto.
for (const ruta of ['/cuenta/', '/descubre/']) {
  const { ctx, page, errores } = await contexto({ [`sb-${OTRO}-auth-token`]: SESION, ...DE_LA_CUENTA });
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const e = await estado(page);
  ok(e.m.primero && !e.m.primero.yo && !e.m.primero.foto, `otro proyecto ${ruta}: «Entrar» desde el primer pintado (${JSON.stringify(e.m.primero)})`);
  ok(!e.yo && !e.foto && !e.campana, `otro proyecto ${ruta}: «Entrar» al acabar de cargar, sin foto ni campana`);
  ok(sinCuenta(e), `otro proyecto ${ruta}: la sesión de otro y lo de esa cuenta, borrados (${e.claves.join(', ')})`);
  ok(e.marca === REF, `otro proyecto ${ruta}: la marca del proyecto (${e.marca})`);
  ok(e.m.cls < 0.01, `otro proyecto ${ruta}: CLS ${e.m.cls.toFixed(4)}${e.m.de.length ? ` (${e.m.de.slice(0, 3).join(' | ')})` : ''}`);
  if (ruta === '/cuenta/') ok(await page.locator('#contenido, main').getByText(/Hola de nuevo/).first().isVisible().catch(() => false), 'otro proyecto /cuenta/: pide entrar («Hola de nuevo»)');
  ok(errores.length === 0, `otro proyecto ${ruta}: sin errores${errores.length ? `: ${errores.slice(0, 2).join(' | ')}` : ''}`);
  await ctx.close();
}

// 2. La sesión de este proyecto, con y sin la marca.
for (const [marca, ruta] of [[true, '/accesibilidad/'], [true, '/descubre/'], [false, '/accesibilidad/']]) {
  const guardado = { [`sb-${REF}-auth-token`]: SESION, ...DE_LA_CUENTA };
  if (marca) guardado['klendar.sb'] = REF;
  const { ctx, page, errores } = await contexto(guardado);
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const e = await estado(page);
  const tag = `este proyecto ${ruta} ${marca ? 'con' : 'sin'} marca`;
  if (marca || ruta === '/descubre/') {
    ok(e.m.primero?.yo && e.m.primero.foto === FOTO, `${tag}: la foto desde el primer pintado (${JSON.stringify(e.m.primero)})`);
    ok(e.m.cls < 0.01, `${tag}: CLS ${e.m.cls.toFixed(4)}${e.m.de.length ? ` (${e.m.de.slice(0, 3).join(' | ')})` : ''}`);
  }
  ok(e.yo && e.foto === FOTO && e.campana, `${tag}: la foto y la campana al acabar de cargar`);
  ok(e.claves.includes(`sb-${REF}-auth-token`) && e.claves.includes('klendar.gustos') && e.claves.includes('klendar.biz'), `${tag}: no se borra nada de la cuenta`);
  ok(e.marca === REF, `${tag}: la marca (${e.marca})`);
  ok(errores.length === 0, `${tag}: sin errores${errores.length ? `: ${errores.slice(0, 2).join(' | ')}` : ''}`);
  await ctx.close();
}

// 2b. Con sesión en este proyecto de OTRO usuario, sin foto (Iván: entró en
// prod con ivan@klendar.app y la cabecera seguía con la foto de Google de la
// sesión vieja de dev): la inicial del usuario de ahora, nunca la foto de la
// otra; y la sesión vieja, borrada.
for (const ruta of ['/accesibilidad/', '/cuenta/', '/descubre/']) {
  for (const marca of [false, true]) {
    const AHORA = { ...USER, id: '0e7717e0-0000-4000-8000-0000000094a3', email: 'ivan@klendar.app', user_metadata: { display_name: 'Iván Prod' } };
    const sesionAhora = JSON.stringify({ ...JSON.parse(SESION), user: AHORA });
    const guardado = { [`sb-${OTRO}-auth-token`]: SESION, [`sb-${REF}-auth-token`]: sesionAhora };
    if (marca) guardado['klendar.sb'] = REF;
    const { ctx, page, errores } = await contexto(guardado);
    await page.route(/https:\/\/[a-z0-9]+\.supabase\.co\/auth\/v1\/user/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AHORA) }));
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const e = await estado(page);
    const letra = await page.evaluate(() => ([...document.querySelectorAll('.top-entrar')].find((x) => x.offsetParent) || {}).textContent || '');
    const tag = `otro usuario sin foto ${ruta} ${marca ? 'con' : 'sin'} marca`;
    ok(!e.m.primero?.foto, `${tag}: nunca la foto de la sesión vieja en el primer pintado (${JSON.stringify(e.m.primero)})`);
    ok(e.yo && !e.foto && letra.trim() === 'I', `${tag}: la inicial del usuario de ahora («${letra.trim()}»)`);
    ok(!e.claves.some((k) => k.startsWith(`sb-${OTRO}-`)) && e.claves.includes(`sb-${REF}-auth-token`), `${tag}: la sesión vieja, borrada; la de ahora, no`);
    ok(errores.length === 0, `${tag}: sin errores${errores.length ? `: ${errores.slice(0, 2).join(' | ')}` : ''}`);
    await ctx.close();
  }
}

// 3. «Cerrar sesión».
{
  const { ctx, page, errores } = await contexto({ [`sb-${REF}-auth-token`]: SESION, 'klendar.sb': REF, ...DE_LA_CUENTA });
  await page.goto(`${BASE}/cuenta/`, { waitUntil: 'load' });
  const salir = page.locator('#salir');
  await salir.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  ok(await salir.isVisible(), '«Tu cuenta» con la sesión de este proyecto: «Cerrar sesión» a la vista');
  const antes = await estado(page);
  ok(antes.yo && antes.foto === FOTO, 'antes de salir: la foto en la cabecera');
  await salir.click();
  await page.waitForTimeout(1500);
  const e = await estado(page);
  ok(!e.yo && !e.foto && !e.campana, 'al salir: la cabecera vuelve a «Entrar», sin foto ni campana');
  ok(!e.claves.includes(`sb-${REF}-auth-token`) && !e.claves.includes('klendar.gustos') && !e.claves.includes('klendar.biz') && !e.claves.some((k) => k.startsWith('klendar.codigos.')), `al salir: la sesión y lo de la cuenta, borrados (${e.claves.join(', ')})`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const r = await estado(page);
  ok(!r.yo && !r.m.primero?.yo, 'al salir y recargar: «Entrar» desde el primer pintado');
  ok(errores.length === 0, `salir: sin errores${errores.length ? `: ${errores.slice(0, 2).join(' | ')}` : ''}`);
  await ctx.close();
}

await nav.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO BIEN');
process.exit(fallos ? 1 : 0);
