// QR personales (decisión de Iván, 2026-10-22) en la web local, con un
// Supabase de mentira (no toca dev ni manda nada; no se teclean contraseñas):
//  1. Panel › «Dar en el momento»: «¿Para cuántas personas?» → «Para 2
//     personas» va a `spot_give_start` (`p_max_people: 2`); lleno, «Ya lo han
//     recibido todos»; 10 minutos sin uso, «Se ha cerrado: 10 minutos sin
//     usarse»; y «Si nadie lo usa en 10 minutos, se cierra solo».
//  2. Cliente (`/app/#/momento/…`): sin permiso de ubicación no se manda
//     ninguna posición (ni sale el aviso del navegador); con permiso ya dado,
//     sí (`p_lat`, `p_lng`, `p_accuracy`) y lejos del local, «Tienes que
//     estar en el local para aceptarlo». Con tope: «Ya lo han recibido todos».
//  3. Panel › «Validar códigos»: el QR de una entrada nominativa
//     (`…/r/<código>.<ventana>.<firma>`) va entero a `validate_redemption`;
//     se ve la foto si la tiene, «5.ª vez aquí» y «Nominativa». Una captura:
//     «Es un QR de otro momento (una captura)…».
//  4. Panel › nuevo evento con reserva: «Entradas: Normales / Nominativas».
//  5. «Tu cuenta»: la entrada nominativa enseña un QR que cambia, firmado con
//     la clave del QR de cliente (se comprueba aquí con HMAC-SHA256), sin el
//     código suelto ni «Copiar».
//  6. Sin errores en la consola.
// Chromium y WebKit, móvil (375) y escritorio. Capturas en OUT.
//
//   PORT=8814 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8814 node tools/qr_check.mjs
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8814';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000b0b0';
const BIZ = 'b1000000-0000-4000-8000-00000000b0b0';
const KEY = '0123456789abcdef';
const SECRET = '00112233445566778899aabbccddeeff00112233';
const CKEY = 'fedcba9876543210';
const CSECRET = 'ffeeddccbbaa99887766554433221100ffeeddcc';
const CODE = 'a1b2c3d4e5f60718293a4b5c';
const OFFER = 'o1000000-0000-4000-8000-00000000b0b0';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'qr.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ventana = () => Math.floor(Date.now() / 1000 / 30);
const firma = (secreto, texto) => createHmac('sha256', secreto).update(texto).digest('hex').slice(0, 12);
const tokenMomento = (off = 0) => { const w = ventana() + off; return `https://klendar.app/m/${KEY}.${w}.${firma(SECRET, `${KEY}.${w}`)}`; };
const tokenEntrada = (off = 0) => { const w = ventana() + off; return `https://klendar.app/r/${CODE}.${w}.${firma(CSECRET, `${CODE}.${w}`)}`; };
/** ¿Es la entrada nominativa de ahora, bien firmada (`named_ticket_check`)? */
const entradaBuena = (t) => {
  const m = /(?:^|\/r\/)([0-9a-f]{24})\.([0-9]+)\.([0-9a-f]{12})$/.exec(t || '');
  return !!m && m[1] === CODE && firma(CSECRET, `${m[1]}.${m[2]}`) === m[3] && Math.abs(Number(m[2]) - ventana()) <= 1;
};

const NEGOCIO = { id: BIZ, name: 'Cafetería Prueba', logo_url: null, slug: 'cafeteria-prueba-madrid' };
// Una foto de perfil de mentira (un píxel), servida desde una dirección https.
const FOTO = 'https://fotos.example.com/lucia.png';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

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
    if (p.startsWith('/rest/v1/offers')) return json([{ named_tickets: estado.nominativas === true }]);
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, time_zone: 'Europe/Madrid', logo_url: null, cover_image_url: null, gallery: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, { ubicacion = false, rol = 'staff' } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  if (ubicacion) {
    await ctx.grantPermissions(['geolocation'], { origin: BASE });
    await ctx.setGeolocation({ latitude: 41.39, longitude: 2.17, accuracy: 20 }); // Barcelona: lejos
  }
  await ctx.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ }
    window.__pidioUbicacion = false;
    if (navigator.geolocation) {
      const g = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...a) => { window.__pidioUbicacion = true; return g(...a); };
    }
    const espera = setInterval(() => {
      if (!window.qrcode || window.qrcode.__espia) return;
      const original = window.qrcode;
      window.qrcode = (...a) => { const q = original(...a); const add = q.addData.bind(q); q.addData = (d, ...r) => { window.__ultimoQr = d; return add(d, ...r); }; return q; };
      window.qrcode.__espia = true;
      clearInterval(espera);
    }, 20);
  }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc: {}, recibidos: 0, cerrado: null, nominativas: false };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Cafetería Prueba', role: rol, verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: { plan_slug: 'standard', status: 'active', billing: { blocked: false, hold: null } },
    business_tools_overview: { ok: true, can_edit: rol !== 'staff', team: { members: 2 } },
    business_recent_validations: [],
    spot_give_options: { ok: true, blocked: false, cards: [{ id: 'c1', name: 'Cafés', goal: 5, reward: 'Un café gratis', applies_to: 'all' }], passes: [], recent_gifts: [] },
    spot_give_start: (b) => ({
      ok: true, id: 's1', key: KEY, secret: SECRET, step: 30, now: Math.floor(Date.now() / 1000),
      expires_at: new Date(Date.now() + 3 * 3600e3).toISOString(), idle_at: new Date(Date.now() + 600e3).toISOString(),
      max_people: b.p_max_people ?? null, business_id: BIZ,
      kind: b.p_kind, label: b.p_gift || 'Cafés', stamps: b.p_stamps, gift: b.p_gift, adults_only: false, business: NEGOCIO,
    }),
    spot_give_status: () => ({
      ok: true, live: !estado.cerrado, closed_reason: estado.cerrado, max_people: 2, count: estado.recibidos,
      receipts: Array.from({ length: estado.recibidos }, (_, i) => ({ id: `r${i}`, at: new Date().toISOString(), name: ['Lucía', 'Mario'][i] })),
    }),
    spot_give_end: { ok: true, count: 0 },
    spot_give_info: (b) => (b.p_lat != null
      ? { ok: false, error: 'too_far', kind: 'gift', label: 'Postre invitado', business: NEGOCIO }
      : estado.lleno ? { ok: false, error: 'full', kind: 'gift', label: 'Postre invitado', business: NEGOCIO }
        : { ok: true, error: null, kind: 'gift', label: 'Postre invitado', gift: 'Postre invitado', adults_only: false, business: NEGOCIO }),
    spot_give_accept: () => ({ ok: true, receipt_id: 'g1', auto_stamps: 0, kind: 'gift', label: 'Postre invitado', gift: 'Postre invitado', business: NEGOCIO }),
    validate_redemption: (b) => (entradaBuena(b.p_code)
      ? {
        ok: true, status: 'validated', kind: 'offer', offer_kind: 'future_event', offer_title: 'Concierto acústico', business_name: 'Cafetería Prueba',
        business_id: BIZ, seats: 1, named: true, user_name: 'Lucía', customer_photo: FOTO, times_here: 5,
        obtained_at: new Date(Date.now() - 86400e3).toISOString(), validated_at: new Date().toISOString(),
      }
      : {
        ok: false, error: 'named_qr_old', kind: 'offer', offer_kind: 'future_event', offer_title: 'Concierto acústico',
        business_name: 'Cafetería Prueba', business_id: BIZ, named: true, user_name: 'Lucía', customer_photo: null, times_here: 1,
      }),
    customer_qr_key: () => ({ key: CKEY, secret: CSECRET, step: 30, now: Math.floor(Date.now() / 1000) }),
    start_redemption: { ok: true, code: CODE, named: true, expires_at: new Date(Date.now() + 5 * 86400e3).toISOString(), seats: 1, offer_title: 'Concierto acústico', business_name: 'Cafetería Prueba' },
    offer_tz: 'Europe/Madrid',
    offer_marks: null,
    offer_detail: [{ id: OFFER, title: 'Concierto acústico', kind: 'future_event', reservations_enabled: true, max_seats: 1, business_id: BIZ, business_name: 'Cafetería Prueba' }],
    my_spot_gifts: [], my_redemptions: [], my_birthday_gifts: [], my_loyalty_gifts: [], my_stamp_rewards: [], my_passes: [], my_queue_turns: [],
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  await ctx.route('https://fotos.example.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  return { ctx, p, estado, errores };
}

const texto = (p) => p.locator('body').innerText();

async function prueba(nav, nombre, t, vp) {
  const foto = (n, pagina) => pagina.screenshot({ path: `${OUT}/web-qr-${n}-${nombre}-${t}.png`, fullPage: true });

  // 1. Panel: tope de personas y por qué se cierra.
  {
    const { ctx, p, estado, errores } = await contexto(nav, vp);
    await p.goto(`${BASE}/panel/#/momento`, { waitUntil: 'networkidle' });
    await p.waitForSelector('#momentoForm');
    await p.check('input[name=kind][value=gift]');
    await p.fill('input[name=gift]', 'Postre invitado');
    await p.selectOption('select[name=max_people]', '2');
    ok(/Al llegar a ese número, el QR se cierra solo/.test(await texto(p)), `${nombre}/${t} panel: «¿Para cuántas personas?» y su ayuda`);
    await foto('momento-tope', p);
    await p.click('#momentoForm button[type=submit]');
    await p.waitForSelector('#momentoCaja svg');
    const inicio = estado.llamadas.find(([fn]) => fn === 'spot_give_start');
    ok(inicio && inicio[1].p_max_people === 2, `${nombre}/${t} panel: «Para 2 personas» llega como p_max_people = 2`);
    ok(/Si nadie lo usa en 10 minutos, se cierra solo/.test(await texto(p)), `${nombre}/${t} panel: «Si nadie lo usa en 10 minutos, se cierra solo»`);
    estado.recibidos = 2;
    estado.cerrado = 'full';
    await p.waitForSelector('text=Ya lo han recibido todos', { timeout: 10000 });
    ok(/2 de 2 lo han recibido/.test(await texto(p)), `${nombre}/${t} panel: lleno, «Ya lo han recibido todos» y «2 de 2»`);
    await foto('momento-lleno', p);
    ok(!errores.length, `${nombre}/${t} panel momento sin errores (${errores.join(' | ')})`);
    await ctx.close();
  }
  {
    const { ctx, p, estado, errores } = await contexto(nav, vp);
    await p.goto(`${BASE}/panel/#/momento`, { waitUntil: 'networkidle' });
    await p.waitForSelector('#momentoForm');
    await p.check('input[name=kind][value=gift]');
    await p.fill('input[name=gift]', 'Postre invitado');
    await p.click('#momentoForm button[type=submit]');
    await p.waitForSelector('#momentoCaja svg');
    estado.cerrado = 'idle';
    await p.waitForSelector('text=Se ha cerrado: 10 minutos sin usarse', { timeout: 10000 });
    ok(true, `${nombre}/${t} panel: 10 minutos sin uso, «Se ha cerrado: 10 minutos sin usarse»`);
    await foto('momento-sin-uso', p);
    ok(!errores.length, `${nombre}/${t} panel momento (sin uso) sin errores (${errores.join(' | ')})`);
    await ctx.close();
  }

  // 2. Cliente: sin permiso, nada de ubicación; con permiso, cerca o no.
  {
    const c = await contexto(nav, vp);
    await c.p.goto(`${BASE}/app/#/momento/${tokenMomento().split('/m/')[1]}`, { waitUntil: 'networkidle' });
    await c.p.waitForSelector('#momento-acepta', { timeout: 10000 });
    const info = c.estado.llamadas.find(([fn]) => fn === 'spot_give_info');
    ok(info && info[1].p_lat === undefined, `${nombre}/${t} cliente sin permiso: no se manda ninguna posición`);
    ok(!(await c.p.evaluate(() => window.__pidioUbicacion)), `${nombre}/${t} cliente sin permiso: no se pide la ubicación`);
    await c.p.click('#momento-acepta');
    await c.p.waitForSelector('text=¡Hecho!');
    ok(true, `${nombre}/${t} cliente sin permiso: se deja pasar («¡Hecho!»)`);
    ok(!c.errores.length, `${nombre}/${t} cliente sin errores (${c.errores.join(' | ')})`);
    await c.ctx.close();
  }
  {
    const c = await contexto(nav, vp, { ubicacion: true });
    const concedido = await (async () => {
      await c.p.goto(`${BASE}/app/`, { waitUntil: 'networkidle' });
      return c.p.evaluate(async () => {
        try { return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted'; } catch { return false; }
      });
    })();
    await c.p.goto(`${BASE}/app/#/momento/${tokenMomento().split('/m/')[1]}`, { waitUntil: 'networkidle' });
    if (concedido) {
      await c.p.waitForSelector('text=Tienes que estar en el local para aceptarlo', { timeout: 10000 });
      const info = c.estado.llamadas.find(([fn]) => fn === 'spot_give_info');
      ok(info && typeof info[1].p_lat === 'number' && typeof info[1].p_accuracy === 'number',
        `${nombre}/${t} cliente con permiso: va la posición (sin guardarla) y lejos, «Tienes que estar en el local»`);
      await foto('momento-lejos', c.p);
    } else {
      // El navegador no deja saber si hay permiso: se deja pasar sin pedirlo.
      await c.p.waitForSelector('#momento-acepta', { timeout: 10000 });
      ok(!(await c.p.evaluate(() => window.__pidioUbicacion)), `${nombre}/${t} cliente: sin saber el permiso, no se pide (se deja pasar)`);
    }
    ok(!c.errores.length, `${nombre}/${t} cliente con permiso sin errores (${c.errores.join(' | ')})`);
    await c.ctx.close();
  }
  {
    const c = await contexto(nav, vp);
    c.estado.lleno = true;
    await c.p.goto(`${BASE}/app/#/momento/${tokenMomento().split('/m/')[1]}`, { waitUntil: 'networkidle' });
    await c.p.waitForSelector('text=Ya lo han recibido todos', { timeout: 10000 });
    ok(true, `${nombre}/${t} cliente: con el tope lleno, «Ya lo han recibido todos»`);
    await foto('momento-cliente-lleno', c.p);
    await c.ctx.close();
  }

  // 3. Panel › Validar: entrada nominativa, foto, veces aquí y una captura.
  {
    const { ctx, p, estado, errores } = await contexto(nav, vp);
    await p.goto(`${BASE}/panel/#/validar`, { waitUntil: 'networkidle' });
    await p.waitForSelector('#code');
    const tk = tokenEntrada();
    await p.fill('#code', tk);
    await p.click('#go');
    await p.waitForSelector('.scan-result.ok', { timeout: 10000 }).catch(async (e) => {
      console.log('DEPURA', await p.locator('#result').innerText(), JSON.stringify(estado.llamadas.slice(-3)), errores);
      throw e;
    });
    const v = estado.llamadas.find(([fn]) => fn === 'validate_redemption');
    ok(v && v[1].p_code === tk.split('/r/')[1], `${nombre}/${t} validar: el QR nominativo va entero (${v && v[1].p_code})`);
    const r = await p.locator('#result').innerText();
    ok(/5\.ª vez aquí/.test(r) && /Nominativa/.test(r) && /Lucía/.test(r), `${nombre}/${t} validar: «Lucía», «5.ª vez aquí» y «Nominativa»`);
    ok(await p.locator('#result img.cod-av').count() === 1, `${nombre}/${t} validar: la foto, porque la tiene`);
    await foto('validar-nominativa', p);
    await p.fill('#code', tokenEntrada(-4));
    await p.click('#go');
    await p.waitForSelector('.scan-result.bad', { timeout: 10000 });
    const r2 = await p.locator('#result').innerText();
    ok(/Es un QR de otro momento/.test(r2) && /Primera vez aquí/.test(r2), `${nombre}/${t} validar: una captura, «Es un QR de otro momento…»`);
    ok(await p.locator('#result img.cod-av').count() === 0, `${nombre}/${t} validar: sin foto si no la tiene`);
    await foto('validar-captura', p);
    ok(!errores.length, `${nombre}/${t} validar sin errores (${errores.join(' | ')})`);
    await ctx.close();
  }

  // 4. Panel › nuevo evento: «Entradas».
  {
    const { ctx, p, errores } = await contexto(nav, vp, { rol: 'owner' });
    await p.goto(`${BASE}/panel/#/publicaciones/nuevo-evento`, { waitUntil: 'networkidle' });
    await p.waitForSelector('#bPlazas summary', { timeout: 15000 });
    await p.click('#bPlazas summary');
    const reserva = p.locator('[name=reservations_enabled]');
    if (!(await reserva.isChecked())) await reserva.check();
    await p.waitForSelector('#nominativasRow:not([hidden])', { timeout: 5000 });
    const fila = await p.locator('#nominativasRow').innerText();
    ok(/Entradas/.test(fila) && /Normales/.test(fila) && /Nominativas/.test(fila) && /Se pueden pasar a otra persona/.test(fila),
      `${nombre}/${t} publicación: «Entradas: Normales / Nominativas», por defecto Normales`);
    await p.locator('#nominativasRow').getByText('Nominativas', { exact: true }).click();
    ok(/Solo para quien reserva/.test(await p.locator('#nominativasRow').innerText()), `${nombre}/${t} publicación: Nominativas explica qué pasa`);
    await p.locator('#nominativasRow').scrollIntoViewIfNeeded();
    await foto('publicacion-entradas', p);
    ok(!errores.length, `${nombre}/${t} publicación sin errores (${errores.join(' | ')})`);
    await ctx.close();
  }

  // 5. Tu cuenta: la entrada nominativa.
  {
    const c = await contexto(nav, vp);
    await c.p.goto(`${BASE}/app/#/codigo/${OFFER}`, { waitUntil: 'networkidle' });
    const conf = c.p.locator('#confirmaEnlace');
    if (await conf.count()) await conf.click();
    await c.p.waitForSelector('#qr svg', { timeout: 10000 });
    await c.p.waitForFunction(() => /\/r\/[0-9a-f]{24}\.[0-9]+\.[0-9a-f]{12}$/.test(window.__ultimoQr || ''));
    const qr = await c.p.evaluate(() => window.__ultimoQr);
    ok(entradaBuena(qr), `${nombre}/${t} Tu cuenta: el QR de la entrada nominativa cambia y va firmado (${qr})`);
    const b = await texto(c.p);
    ok(/Entrada nominativa: el QR cambia cada 30 segundos/.test(b) && /Cambia en \d+ s/.test(b), `${nombre}/${t} Tu cuenta: «Entrada nominativa…» y «Cambia en N s»`);
    ok(await c.p.locator('#copiar').count() === 0, `${nombre}/${t} Tu cuenta: sin el código suelto ni «Copiar»`);
    await foto('cuenta-nominativa', c.p);
    ok(!c.errores.length, `${nombre}/${t} Tu cuenta sin errores (${c.errores.join(' | ')})`);
    await c.ctx.close();
  }
}

const VISTAS = [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 860 }]];
for (const [nombre, nav] of [['chromium', chromium], ['webkit', webkit]]) {
  const b = await nav.launch();
  for (const [t, vp] of VISTAS) await prueba(b, nombre, t, vp);
  await b.close();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
