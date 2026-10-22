// «Dar en el momento» (2026-10-16) en la web local, de punta a punta y con un
// Supabase de mentira (no toca dev ni manda nada; no se teclean contraseñas):
//  1. Panel, «Validar códigos» → «Dar en el momento»: elegir «Algo del
//     momento», escribir «Postre invitado» y «Enseñar el QR». El QR lleva
//     `https://klendar.app/m/<clave>.<ventana>.<firma>` y la firma se
//     comprueba aquí con HMAC-SHA256 (la misma que mira la base). Al llegar
//     alguien, en directo: «Lucía lo ha recibido». «Terminar» cierra el QR.
//  2. Con el negocio parado: sellos nuevos y «Algo del momento» desactivados.
//  3. Cliente: ese mismo QR leído con la cámara del móvil (`/m/<…>` de las
//     Functions) lleva a «Tu cuenta» (#/momento/<…>): «Cafetería Prueba te
//     da: Postre invitado», «Aceptar» → «¡Hecho!»; y en «Tus códigos», «Te
//     dieron». Un QR caducado: «Ese QR ya no vale».
//  4. Sin errores en la consola.
// Chromium y WebKit, móvil (375) y escritorio. Capturas en OUT.
//
//   PORT=8812 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8812 node tools/momento_check.mjs
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8812';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000a0a0';
const BIZ = 'b1000000-0000-4000-8000-00000000a0a0';
const KEY = '0123456789abcdef';
const SECRET = '00112233445566778899aabbccddeeff00112233';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'momento.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

/** La firma que mira la base (`spot_qr_check`). */
const firmaBuena = (token) => {
  const m = /(?:^|\/m\/)([0-9a-f]{16})\.([0-9]+)\.([0-9a-f]{12})$/.exec(token || '');
  if (!m) return false;
  const w = Number(m[2]);
  const ahora = Math.floor(Date.now() / 1000 / 30);
  return createHmac('sha256', SECRET).update(`${m[1]}.${m[2]}`).digest('hex').slice(0, 12) === m[3]
    && w >= ahora - 3 && w <= ahora + 1;
};

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      let body = {};
      try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, time_zone: 'Europe/Madrid', logo_url: null, cover_image_url: null, gallery: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

const NEGOCIO = { id: BIZ, name: 'Cafetería Prueba', logo_url: null, slug: 'cafeteria-prueba-madrid' };

async function contexto(nav, vp, { bloqueado = false } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ }
    // Lo que va dentro de cada QR que se pinta (para leerlo sin cámara).
    const espera = setInterval(() => {
      if (!window.qrcode || window.qrcode.__espia) return;
      const original = window.qrcode;
      window.qrcode = (...a) => { const q = original(...a); const add = q.addData.bind(q); q.addData = (d, ...r) => { window.__ultimoQr = d; return add(d, ...r); }; return q; };
      window.qrcode.__espia = true;
      clearInterval(espera);
    }, 20);
  }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc: {}, recibido: false, gifts: [] };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Cafetería Prueba', role: 'staff', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: { plan_slug: 'standard', status: 'active', billing: { blocked: bloqueado, hold: bloqueado ? 'ended' : null } },
    business_tools_overview: { ok: true, can_edit: false, team: { members: 2 } },
    business_recent_validations: [],
    spot_give_options: { ok: true, blocked: bloqueado, cards: [{ id: 'c1', name: 'Cafés', goal: 5, reward: 'Un café gratis', applies_to: 'all' }], passes: [], recent_gifts: ['Chupito de la casa'] },
    spot_give_start: (b) => ({
      ok: true, id: 's1', key: KEY, secret: SECRET, step: 30, now: Math.floor(Date.now() / 1000),
      expires_at: new Date(Date.now() + 3 * 3600e3).toISOString(), business_id: BIZ,
      kind: b.p_kind, label: b.p_gift || 'Cafés', stamps: b.p_stamps, gift: b.p_gift, adults_only: false, business: NEGOCIO,
    }),
    spot_give_status: () => ({ ok: true, live: true, count: estado.recibido ? 1 : 0, receipts: estado.recibido ? [{ id: 'r1', at: new Date().toISOString(), name: 'Lucía' }] : [] }),
    spot_give_end: { ok: true, count: 1 },
    spot_give_info: (b) => (firmaBuena(b.p_token)
      ? { ok: true, error: null, kind: 'gift', label: 'Postre invitado', gift: 'Postre invitado', adults_only: false, business: NEGOCIO }
      : { ok: false, error: 'qr_expired', kind: 'gift', label: 'Postre invitado', business: NEGOCIO }),
    spot_give_accept: (b) => {
      if (!firmaBuena(b.p_token)) return { ok: false, error: 'qr_expired' };
      estado.recibido = true;
      estado.gifts = [{ id: 'g1', gift: 'Postre invitado', received_at: new Date().toISOString(), business_id: BIZ, business_name: 'Cafetería Prueba', business_slug: NEGOCIO.slug }];
      return { ok: true, receipt_id: 'g1', auto_stamps: 1, kind: 'gift', label: 'Postre invitado', gift: 'Postre invitado', business: NEGOCIO };
    },
    my_spot_gifts: () => estado.gifts,
    my_redemptions: [],
    my_birthday_gifts: [],
    my_loyalty_gifts: [],
    my_stamp_rewards: [],
    my_passes: [],
    my_queue_turns: [],
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  return { ctx, p, estado, errores };
}

async function prueba(nav, nombre, t, vp) {
  // 1. El negocio abre el QR.
  const { ctx, p, estado, errores } = await contexto(nav, vp);
  const foto = (n, pagina = p) => pagina.screenshot({ path: `${OUT}/web-${n}-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${BASE}/panel/#/validar`, { waitUntil: 'networkidle' });
  await p.waitForSelector('a[href="#/momento"]');
  ok(true, `${nombre}/${t} «Validar códigos» lleva a «Dar en el momento»`);
  await p.click('a[href="#/momento"]');
  await p.waitForSelector('#momentoForm');
  await p.check('input[name=kind][value=gift]');
  ok(await p.locator('[data-para=gift]').isVisible(), `${nombre}/${t} «Algo del momento»: el campo de texto`);
  await p.fill('input[name=gift]', 'Postre invitado');
  await foto('momento-elegir');
  await p.click('#momentoForm button[type=submit]');
  await p.waitForSelector('#momentoCaja svg');
  await p.waitForFunction(() => !!window.__ultimoQr);
  const token = await p.evaluate(() => window.__ultimoQr);
  ok(firmaBuena(token), `${nombre}/${t} el QR lleva klendar.app/m/ con la firma buena (${token})`);
  const v = await p.locator('#view').innerText();
  ok(/Cafetería Prueba te da:/.test(v) && /Postre invitado/.test(v), `${nombre}/${t} «Cafetería Prueba te da: Postre invitado»`);
  ok(/Nadie lo ha recibido todavía/.test(v), `${nombre}/${t} todavía nadie`);
  await foto('momento-qr');

  // 3. El cliente, con la cámara del móvil (otra sesión: otra persona).
  const cli = await contexto(nav, vp);
  const ruta = token.replace('https://klendar.app', '');
  await cli.p.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
  ok(/\/app\/#\/momento\//.test(cli.p.url()), `${nombre}/${t} /m/ lleva a «Tu cuenta» (${cli.p.url()})`);
  await cli.p.waitForSelector('#momento-acepta', { timeout: 8000 }).catch(async (e) => {
    console.log('DEPURA', cli.p.url(), (await cli.p.locator('body').innerText()).slice(0, 600), cli.errores, cli.estado.llamadas.map((x) => x[0]).join(','));
    throw e;
  });
  const c = await cli.p.locator('main, body').first().innerText();
  ok(/Cafetería Prueba te da:/.test(c) && /Postre invitado/.test(c) && /Lo da y lo cumple el negocio/.test(c), `${nombre}/${t} cliente: lo que le dan y quién lo cumple`);
  await foto('momento-cliente', cli.p);
  await cli.p.click('#momento-acepta');
  await cli.p.waitForSelector('text=¡Hecho!');
  ok(/Lo tienes en Tus códigos/.test(await cli.p.locator('body').innerText()), `${nombre}/${t} cliente: «¡Hecho!» y dónde queda`);
  await foto('momento-hecho', cli.p);
  await cli.p.goto(`${BASE}/app/#/codigos`, { waitUntil: 'networkidle' });
  await cli.p.waitForSelector('text=Te dieron');
  ok(/Postre invitado/.test(await cli.p.locator('body').innerText()), `${nombre}/${t} «Tus códigos»: «Te dieron» con el regalo`);
  await foto('momento-tus-codigos', cli.p);
  // Una foto vieja del QR (5 ventanas atrás) ya no vale.
  const viejo = ruta.replace(/\.(\d+)\./, (_, w) => `.${Number(w) - 5}.`);
  await cli.p.goto(`${BASE}/app/#/momento/${viejo.slice(3)}`, { waitUntil: 'networkidle' });
  await cli.p.waitForSelector('text=Ese QR ya no vale');
  ok(true, `${nombre}/${t} cliente: un QR viejo, «Ese QR ya no vale»`);
  ok(!cli.errores.length, `${nombre}/${t} cliente sin errores (${cli.errores.join(' | ')})`);
  // Lo que la base apuntó al aceptar el cliente es lo que ve el negocio.
  estado.recibido = cli.estado.recibido;
  await cli.ctx.close();

  // De vuelta en el negocio: en directo.
  await p.waitForSelector('text=Lucía lo ha recibido', { timeout: 10000 });
  ok(/1 persona lo ha recibido/.test(await p.locator('#view').innerText()), `${nombre}/${t} negocio: «✓ Lucía lo ha recibido» en directo`);
  await foto('momento-recibido');
  await p.click('#momentoFin');
  await p.waitForSelector('#momentoForm');
  ok(estado.llamadas.some(([fn]) => fn === 'spot_give_end'), `${nombre}/${t} «Terminar» cierra el QR`);
  ok(!errores.length, `${nombre}/${t} negocio sin errores (${errores.join(' | ')})`);
  await ctx.close();

  // 2. Parado: «Algo del momento», no.
  const b = await contexto(nav, vp, { bloqueado: true });
  await b.p.goto(`${BASE}/panel/#/momento`, { waitUntil: 'networkidle' });
  await b.p.waitForSelector('#momentoForm');
  // Iván (2026-10-22): parado, solo usos de bonos que ya tiene la gente;
  // sellos nuevos (Fidelizar) y «algo del momento», no, y se dice por qué.
  ok(await b.p.locator('input[name=kind][value=gift]').isDisabled()
    && await b.p.locator('input[name=kind][value=stamps]').isDisabled()
    && /solo puedes dar usos de bonos/.test(await b.p.locator('#momentoForm').innerText()),
  `${nombre}/${t} parado: ni sellos nuevos ni «algo del momento», y lo dice`);
  await foto('momento-parado', b.p);
  await b.ctx.close();
}

const VISTAS = [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 860 }]];
for (const [nombre, nav] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await nav.launch();
  for (const [t, vp] of VISTAS) await prueba(b, nombre, t, vp);
  await b.close();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
