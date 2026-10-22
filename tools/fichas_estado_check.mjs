// Prueba de la paridad de las fichas públicas con la app (2026-10-22), con
// las Functions de verdad contra un Supabase falso (no toca dev):
//
//  1. Publicación (`/o/`): «Destacado», «Antes de cerrar» y «Quedan N
//     bolsas», «antes 12,00 €», «Organiza: X», «N personas ya lo han
//     cogido», «Hasta N por persona», «Compartir», «Cómo llegar · Contactar ·
//     Redes sociales». Con sesión (lo pinta /assets/amigos.js): «Ver mi
//     código» con el código vivo, «Te quedan 2 de 3»; agotada, «Salir de la
//     lista de espera» con su línea y «N personas esperando» sin estar.
//     Un evento agotado sin código no ofrece la lista de espera.
//  2. Negocio (`/b/`): «Comprobado por Klendar», «N canjes hasta ahora»,
//     «Ofertas / Eventos», «Sin valoraciones todavía», «Compartir» y «Cómo
//     llegar»; con sesión, «Editar mi reseña» y «3 de 10 sellos · Te faltan 7».
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/fichas_estado_check.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const OUT = process.env.OUT || '.';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8862);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8863);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000097c1';
const BIZ = 'b1000000-0000-4000-8000-0000000097c1';
const VIVA = 'a1000000-0000-4000-8000-0000000097c1';
const AGOTADA = 'a1000000-0000-4000-8000-0000000097c2';
const EVENTO = 'a1000000-0000-4000-8000-0000000097c3';
const TARJETA = 'c1000000-0000-4000-8000-0000000097c1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'fichas@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const ahora = Date.now();
const iso = (h) => new Date(ahora + h * 3600e3).toISOString();
const base = {
  business_id: BIZ, business_name: 'Bar Sonda', business_city: 'Madrid', business_address: 'Calle Mayor 1',
  business_phone: '612345678', business_email: 'hola@barsonda.es', business_website: 'https://barsonda.es',
  business_social: { instagram: '@barsonda' }, lat: 40.4168, lng: -3.7038, images: [], status: 'active',
  time_zone: 'Europe/Madrid', audience: 'all', locked: false, style: {}, waitlist_count: 0, redemptions_count: 0, max_per_user: 1,
};
const OFERTAS = {
  [VIVA]: { ...base, id: VIVA, kind: 'flash_offer', title: 'Bolsa sorpresa', is_boosted: true, style: { badge: 'before_closing' },
    discount: { type: 'fixed', value: 4 }, currency: 'EUR', redeem_start_at: iso(-1), redeem_end_at: iso(3), seats_left: 4,
    max_per_user: 3, redemptions_count: 5, venue_name: 'Parque del Oeste', venue_address: 'Paseo de Moret 2' },
  [AGOTADA]: { ...base, id: AGOTADA, kind: 'flash_offer', title: 'Cañas 2x1', discount: { type: '2x1' },
    redeem_start_at: iso(-1), redeem_end_at: iso(3), seats_left: 0, status: 'sold_out', waitlist_count: 4 },
  [EVENTO]: { ...base, id: EVENTO, kind: 'future_event', title: 'Concierto lleno', event_at: iso(30), seats_left: 0, status: 'sold_out',
    external_url: 'https://dice.fm/event/x' },
};

/** El Supabase que ve la Function (lo público, sin sesión). */
function supabaseFicha() {
  return createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, 'http://x');
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(b)); };
      let args = {};
      try { args = JSON.parse(cuerpo || '{}'); } catch { /* */ }
      const p = url.pathname;
      if (p === '/rest/v1/rpc/offer_detail') return json(OFERTAS[args.p_id] ? [OFERTAS[args.p_id]] : []);
      if (p === '/rest/v1/rpc/business_profile') {
        return json([{ id: args.p_id, name: 'Bar Sonda', city: 'Madrid', address: 'Calle Mayor 1, 28013 Madrid', lat: 40.4168, lng: -3.7038,
          is_verified: true, redemptions_total: 12, member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid',
          description: 'Un bar de prueba.', closed_indefinitely: false, social: {}, rating: null, ratings: 0 }]);
      }
      if (p === '/rest/v1/rpc/stamp_cards_of') return json([{ id: TARJETA, name: 'Cafés', goal: 10, card_goal: 10, reward: 'Un café', applies_to: 'all', stamps: 0 }]);
      if (p === '/rest/v1/rpc/resolve_business_slug') return json([{ id: BIZ, slug: 'bar-sonda-madrid' }]);
      if (p.startsWith('/rest/v1/rpc/')) return json([]);
      return json([]);
    });
  });
}

/** El Supabase que ve el navegador con la sesión de «Tu cuenta». */
function supabaseNavegador(estado) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn === 'offer_detail') return json([{ ...OFERTAS[body.p_id], ...(estado.oferta || {}) }]);
      if (fn === 'my_waitlist_status') return json(estado.espera || null);
      if (fn === 'offer_friends') return json({ ok: true, visible: true, going: false, friends: [], invites: [] });
      if (fn === 'stamp_cards_of') return json([{ id: TARJETA, name: 'Cafés', goal: 10, reward: 'Un café', stamps: 3 }]);
      if (fn === 'my_blocks') return json({ blocks: [] });
      return json([]);
    }
    if (p.startsWith('/rest/v1/redemptions')) return json(estado.vivo ? [{ id: 'r1' }] : []);
    if (p.startsWith('/rest/v1/reviews')) return json(estado.resena ? [{ id: 'v1' }] : []);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function pagina(nav, vp, estado) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  if (estado) {
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
    await ctx.route(`${SUPA}/**`, supabaseNavegador(estado));
  }
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  return { ctx, p, errores };
}

async function publicacion(nav, nombre, t, vp) {
  const tag = `${nombre}/${t}`;
  let { ctx, p, errores } = await pagina(nav, vp, null);
  await p.goto(`http://localhost:${FICHA_PORT}/o/${VIVA}`, { waitUntil: 'networkidle' });
  const txt = await p.locator('.detail').innerText();
  ok(/Destacado/.test(txt) && /Antes de cerrar/.test(txt), `${tag} o/: «Destacado» y «Antes de cerrar»`);
  ok(/Quedan 4 bolsas/.test(txt), `${tag} o/: «Quedan 4 bolsas»`);
  ok(/Organiza: Bar Sonda/.test(txt), `${tag} o/: «Organiza: Bar Sonda»`);
  ok(/5 personas ya lo han cogido/.test(txt) && /Hasta 3 por persona/.test(txt), `${tag} o/: prueba social y tope por persona`);
  ok(await p.locator('[data-compartir]').count() === 1, `${tag} o/: «Compartir»`);
  ok(await p.locator('.toques a', { hasText: 'Cómo llegar' }).count() === 1
    && await p.locator('.toques summary', { hasText: 'Contactar' }).count() === 1
    && await p.locator('.toques summary', { hasText: 'Redes sociales' }).count() === 1, `${tag} o/: Cómo llegar · Contactar · Redes sociales`);
  await p.locator('.toques summary', { hasText: 'Contactar' }).click();
  ok(await p.locator('.toques a[href^="tel:"]').isVisible() && await p.locator('.toques a[href^="https://wa.me/34612345678"]').count() === 1,
    `${tag} o/: «Contactar» abre Llamar y WhatsApp`);
  await p.screenshot({ path: `${OUT}/web-o-sin-sesion-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${tag} o/ sin errores ${errores.join(' | ')}`);
  await ctx.close();

  // Con sesión y el código ya cogido (2 de 3 usados): «Ver mi código».
  ({ ctx, p, errores } = await pagina(nav, vp, { vivo: true, oferta: { my_redemptions: 1 } }));
  await p.goto(`http://localhost:${FICHA_PORT}/o/${VIVA}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => /Ver mi código/.test(document.querySelector('[data-principal]')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Ver mi código/.test(await p.locator('[data-principal]').innerText())
    && /#\/codigo\/a1000000/.test(await p.locator('[data-principal]').getAttribute('href')), `${tag} o/ con sesión: «Ver mi código»`);
  ok(/Te quedan 2 de 3/.test(await p.locator('#por-persona').innerText()), `${tag} o/ con sesión: «Te quedan 2 de 3»`);
  await p.screenshot({ path: `${OUT}/web-o-mi-codigo-${nombre}-${t}.png`, fullPage: false });
  ok(errores.length === 0, `${tag} o/ con sesión sin errores ${errores.join(' | ')}`);
  await ctx.close();

  // Agotada, sin sesión: «Apuntarme…» y «4 personas esperando».
  ({ ctx, p } = await pagina(nav, vp, null));
  await p.goto(`http://localhost:${FICHA_PORT}/o/${AGOTADA}`, { waitUntil: 'networkidle' });
  ok(/Apuntarme a la lista de espera/.test(await p.locator('[data-principal="espera"]').innerText())
    && /4 personas esperando/.test(await p.locator('#espera-nota').innerText()), `${tag} o/ agotada: lista de espera y «4 personas esperando»`);
  await ctx.close();
  // Agotada y ya en la lista (con un aviso gastado).
  ({ ctx, p, errores } = await pagina(nav, vp, { oferta: { in_waitlist: true, waitlist_count: 4 }, espera: { state: 'waiting', notices: 1 } }));
  await p.goto(`http://localhost:${FICHA_PORT}/o/${AGOTADA}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => /Salir/.test(document.querySelector('[data-principal]')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Salir de la lista de espera/.test(await p.locator('[data-principal]').innerText())
    && /\?quitar=1$/.test(await p.locator('[data-principal]').getAttribute('href')), `${tag} o/ agotada con sesión: «Salir de la lista de espera»`);
  ok(/te queda un aviso más/.test(await p.locator('#espera-nota').innerText()), `${tag} o/ agotada con sesión: «…te queda un aviso más»`);
  await p.screenshot({ path: `${OUT}/web-o-espera-${nombre}-${t}.png`, fullPage: false });
  ok(errores.length === 0, `${tag} o/ agotada sin errores ${errores.join(' | ')}`);
  await ctx.close();
  // Evento agotado sin código: sus entradas, nunca la lista de espera.
  ({ ctx, p } = await pagina(nav, vp, null));
  await p.goto(`http://localhost:${FICHA_PORT}/o/${EVENTO}`, { waitUntil: 'networkidle' });
  ok(await p.locator('[data-principal="espera"]').count() === 0 && /Entradas en DICE/.test(await p.locator('aside').innerText()),
    `${tag} o/ evento agotado sin código: «Entradas en DICE», sin lista de espera`);
  await ctx.close();
}

async function negocio(nav, nombre, t, vp) {
  const tag = `${nombre}/${t}`;
  let { ctx, p, errores } = await pagina(nav, vp, null);
  await p.goto(`http://localhost:${FICHA_PORT}/b/${BIZ}`, { waitUntil: 'networkidle' });
  const txt = await p.locator('.detail').innerText();
  ok(/Comprobado por Klendar/.test(txt) && /12 canjes hasta ahora/.test(txt), `${tag} b/: «Comprobado por Klendar» y «12 canjes hasta ahora»`);
  ok(/Sin valoraciones todavía/.test(txt), `${tag} b/: «Sin valoraciones todavía»`);
  ok(await p.locator('[data-compartir]').count() === 1 && await p.locator('.toques a', { hasText: 'Cómo llegar' }).count() === 1, `${tag} b/: «Compartir» y «Cómo llegar»`);
  ok(/Escribir una reseña/.test(await p.locator('[data-opinar]').innerText()), `${tag} b/: «Escribir una reseña»`);
  await p.screenshot({ path: `${OUT}/web-b-sin-sesion-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${tag} b/ sin errores ${errores.join(' | ')}`);
  await ctx.close();

  ({ ctx, p, errores } = await pagina(nav, vp, { resena: true }));
  await p.goto(`http://localhost:${FICHA_PORT}/b/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.sellos-mios', { timeout: 8000 }).catch(() => {});
  ok(/Editar mi reseña/.test(await p.locator('[data-opinar]').innerText()), `${tag} b/ con sesión: «Editar mi reseña»`);
  ok(/3 de 10 sellos · Te faltan 7 sellos/.test(await p.locator(`[data-tarjeta="${TARJETA}"]`).innerText()), `${tag} b/ con sesión: «3 de 10 sellos · Te faltan 7 sellos»`);
  await p.locator(`[data-tarjeta="${TARJETA}"]`).scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/web-b-con-sesion-${nombre}-${t}.png`, fullPage: false });
  ok(errores.length === 0, `${tag} b/ con sesión sin errores ${errores.join(' | ')}`);
  await ctx.close();
}

const falso = supabaseFicha();
await new Promise((r) => falso.listen(FALSO_PORT, r));
const servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(FICHA_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2000));

const SOLO = process.env.SOLO || '';
const PRUEBAS = { publicacion, negocio };
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const [k, f] of Object.entries(PRUEBAS)) {
      if (SOLO && !SOLO.split(',').includes(k)) continue;
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${k}: ${e.message.split('\n')[0]}`));
    }
  }
  await nav.close();
}
servidor.kill();
falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
