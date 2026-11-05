// Prueba de la nota de «Ofertas flash cerca de ti» en «Tu cuenta», Ajustes →
// Notificaciones (migración 20261260100100 de la app), con un Supabase de
// mentira: no toca dev.
//
//  1. Encendido y sin posición de los últimos 7 días (`my_nearby_location`
//     → saved_at null): «Ahora no te llegan: no sabemos dónde estás…».
//  2. Con posición reciente: nada.
//  3. Apagado: nada, y no pregunta; al encenderlo, pregunta y lo dice.
//  4. En inglés, traducido. La web nunca manda la posición
//     (`update_my_location`).
//
// Chromium y WebKit, móvil y escritorio.
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> BASE=http://localhost:8871 node tools/cerca_nota_check.mjs
import { playwright, REF, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
const U = '0e7717e0-0000-4000-8000-00000000ce71';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'cerca.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const ES = /Ahora no te llegan: no sabemos dónde estás\. Abre la app de Klendar de vez en cuando para que lo sepamos \(guardamos solo la última posición, 7 días\)\./;
const EN = /You're not getting them right now: we don't know where you are\. Open the Klendar app now and then so we know/;

async function contexto(nav, vp, { nearby, savedAt, lang = 'es' }) {
  const ctx = await nav.newContext({ viewport: vp, locale: lang === 'es' ? 'es-ES' : 'en-GB', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ } },
    [`sb-${REF}-auth-token`, sesion(), lang]);
  const llamadas = [];
  const rpc = {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, push_devices: 1 },
    my_businesses: [],
    my_notification_preferences: { notify_favorites: true, notify_nearby: nearby, nearby_radius_m: 1000, nearby_categories: null,
      quiet_hours_start: null, quiet_hours_end: null, weekly_email: false, notify_word_alerts: false },
    my_nearby_location: { saved_at: savedAt },
    my_alert_words: { words: [], max: 10, on: false, area: null },
  };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      llamadas.push(fn);
      return json(rpc[fn] === undefined ? null : rpc[fn]);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(`${BASE}${lang === 'es' ? '/app/' : '/app/?lang=en'}#/ajustes/notificaciones`);
  await page.waitForSelector('#f-avisos input[name=cerca]', { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page, llamadas, errores };
}
const visible = (page) => page.locator('#cerca-nota').isVisible();
const texto = (page) => page.locator('#cerca-mas').innerText().catch(() => '');

async function caso(nav, nombre, t, vp) {
  // 1. Encendido, sin posición
  let { ctx, page, llamadas, errores } = await contexto(nav, vp, { nearby: true, savedAt: null });
  ok(await visible(page) && ES.test(await texto(page)), `${nombre}/${t}: encendido y sin posición, lo dice`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0), `${nombre}/${t}: sin desplazamiento horizontal`);
  ok(!llamadas.includes('update_my_location'), `${nombre}/${t}: la web no manda la posición`);
  ok(errores.length === 0, `${nombre}/${t}: sin errores (${errores.join(' | ')})`);
  await ctx.close();

  // 2. Con posición reciente
  ({ ctx, page } = await contexto(nav, vp, { nearby: true, savedAt: new Date().toISOString() }));
  ok(!(await visible(page)), `${nombre}/${t}: con posición reciente, nada`);
  await ctx.close();

  // 3. Apagado → encender
  ({ ctx, page, llamadas } = await contexto(nav, vp, { nearby: false, savedAt: null }));
  ok(!(await visible(page)) && !llamadas.includes('my_nearby_location'), `${nombre}/${t}: apagado, ni lo dice ni pregunta`);
  await page.locator('label:has(input[name=cerca])').click();
  await page.waitForFunction(() => !document.querySelector('#cerca-nota')?.hidden, null, { timeout: 5000 }).catch(() => {});
  ok(await visible(page) && llamadas.includes('my_nearby_location'), `${nombre}/${t}: al encenderlo, pregunta y lo dice`);
  await page.locator('label:has(input[name=cerca])').click();
  ok(!(await visible(page)), `${nombre}/${t}: al apagarlo, se va`);
  await ctx.close();

  // 4. En inglés
  ({ ctx, page } = await contexto(nav, vp, { nearby: true, savedAt: null, lang: 'en' }));
  ok(EN.test(await texto(page)), `${nombre}/${t}: en inglés, traducido`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    await caso(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
