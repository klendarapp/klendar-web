// Prueba del alta de entidades y de Turnstile en la web local, con una
// sesión simulada (Supabase contestado aquí: no toca dev ni manda nada).
//
//  1. Panel: «¿Qué vas a dar de alta?» → «Un ayuntamiento, asociación u ONG»
//     → los tres pasos (CIF mal, documento, declaración y condiciones) →
//     `register_entity` con lo que toca → el resumen dice que se está
//     comprobando, «Crear» no publica y el menú no enseña Fidelizar, RRPP
//     ni el plan.
//  2. Admin: «Entidades por verificar» con el documento, aprobar (tipo y
//     cómo se ha comprobado) y rechazar (motivo).
//  3. Turnstile con las claves de prueba oficiales de Cloudflare: con la que
//     siempre pasa, el registro manda el token de prueba a Supabase; con la
//     que siempre falla, no manda nada y lo dice.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8795 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> node tools/alta_entidades_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8795';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000e171';
const BIZ = 'b1000000-0000-4000-8000-0000000000e1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

// Un JWT con forma de JWT (nadie lo comprueba: Supabase lo contestamos aquí).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (extra = {}) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }], ...extra,
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'entidad.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

/** Supabase de mentira: lo que la página pide y lo que contesta cada RPC. */
function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/storage/v1/object/sign/')) return json({ signedURL: '/object/sign/business-claims/doc.pdf?token=x' });
    if (p.startsWith('/storage/v1/object/business-claims/')) {
      estado.subidas.push(p.replace('/storage/v1/object/business-claims/', ''));
      return json({ Key: p.replace('/storage/v1/object/', ''), Id: 'x' });
    }
    if (p.startsWith('/storage/')) return json({});
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
    if (p.startsWith('/rest/v1/businesses')) return json(estado.bizzes.length ? [{ id: BIZ, name: 'Ayuntamiento de Prueba', time_zone: 'Europe/Madrid', city: 'Getafe', amenities: [] }] : []);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function panel(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { subidas: [], llamadas: [], bizzes: [], rpc: {} };
  const ent = { entity_kind: null, can_apply: true, why: null, application: null };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: () => estado.bizzes,
    business_is_organizer: false,
    my_entity_application: () => ent,
    business_stats: { redemptions_30d: 0 },
    my_business_offers: [],
    business_tools_overview: () => ({ ok: true, can_edit: true, entity: { kind: null, pending: true, application: 'pending' }, team: { members: 1 }, series: { rules_active: 0 } }),
    register_entity: (b) => {
      estado.alta = b;
      estado.bizzes = [{ id: BIZ, name: b.p_official_name, role: 'owner', verification_status: 'pending', is_active: true, time_zone: 'Europe/Madrid' }];
      Object.assign(ent, { can_apply: false, why: 'already_pending', application: { id: 'a1', status: 'pending', origin: 'signup', kind: b.p_kind, created_at: new Date().toISOString() } });
      return { ok: true, business_id: BIZ };
    },
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const foto = (n) => p.screenshot({ path: `${OUT}/web-${n}-${nombre}-${t}.png`, fullPage: true });

  await p.goto(`${BASE}/panel/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('text=¿Qué vas a dar de alta?');
  ok(await p.locator('.crear-op').count() === 2, `${nombre}/${t} panel: dos opciones al empezar`);
  await foto('alta-elegir');
  await p.click('text=Un ayuntamiento, asociación u ONG');
  await p.waitForSelector('#altaEnt');
  ok((await p.content()).includes('Paso 1 de 3 · La entidad'), `${nombre}/${t} paso 1 de la entidad`);
  ok(await p.locator('[data-campo-cat], [name=category_id]').count() === 0, `${nombre}/${t} sin categoría de negocio`);
  await p.selectOption('[name=ent_kind]', 'merchants');
  await p.fill('[name=official_name]', 'Asociación de Comerciantes de Prueba');
  await p.fill('[name=ent_tax_id]', '12345678Z');
  await p.fill('[name=ent_website]', 'comerciantes-prueba.es');
  await p.click('#enviar');
  ok(await p.locator('text=Revisa el CIF').count() > 0, `${nombre}/${t} un CIF que no es de entidad no pasa`);
  await foto('alta-entidad-cif-mal');
  await p.fill('[name=ent_tax_id]', 'g-28000000');
  await p.click('#enviar');
  await p.waitForSelector('[name=city]');
  ok((await p.content()).includes('Paso 2 de 3 · Zona'), `${nombre}/${t} paso 2: zona`);
  await p.fill('[name=city]', 'Getafe');
  await p.fill('[name=ent_area]', 'Barrio de Prueba');
  // El punto del mapa (sin token de Mapbox en local): como si se hubiera marcado.
  await p.evaluate(() => { ALTA_ENT.punto = { lat: 40.305, lng: -3.732 }; });
  await foto('alta-entidad-paso-2');
  await p.click('#enviar');
  await p.waitForSelector('[name=contact_name]');
  ok((await p.content()).includes('Paso 3 de 3 · Quién la da de alta'), `${nombre}/${t} paso 3: quién la da de alta`);
  await p.fill('[name=contact_name]', 'Ana Prueba');
  await p.fill('[name=contact_role]', 'Presidenta');
  await p.click('#enviar');
  ok((await p.locator('#err').innerText()).includes('documento'), `${nombre}/${t} sin documento no se envía`);
  await p.setInputFiles('[name=ent_doc]', { name: 'nombramiento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%prueba\n') });
  await p.waitForSelector('[data-doc-estado]:not([hidden])');
  ok(estado.subidas.length === 1 && estado.subidas[0].startsWith(`${U}/`) && estado.subidas[0].endsWith('.pdf'), `${nombre}/${t} el documento va a la carpeta privada de quien lo sube`);
  await p.check('[name=ent_declaration]');
  await p.check('[name=terms]');
  await foto('alta-entidad-paso-3');
  await p.click('#enviar');
  await p.waitForSelector('text=Comprobando la entidad');
  const a = estado.alta || {};
  ok(a.p_kind === 'merchants' && a.p_tax_id === 'G28000000' && a.p_official_name === 'Asociación de Comerciantes de Prueba'
    && a.p_website === 'comerciantes-prueba.es' && a.p_city === 'Getafe' && a.p_area === 'Barrio de Prueba'
    && a.p_contact_name === 'Ana Prueba' && a.p_contact_role === 'Presidenta' && a.p_proof_path === estado.subidas[0]
    && Math.abs(a.p_lat - 40.305) < 1e-6, `${nombre}/${t} register_entity con todo ${JSON.stringify(a)}`);
  const menu = await p.locator('#nav').textContent();
  ok(!/Fidelizar|RRPP|Días cerrados/.test(menu) && /Equipo/.test(menu), `${nombre}/${t} el menú de una entidad`);
  const resumen = await p.locator('#view').innerText();
  ok(!/Fidelizar|Tu plan/.test(resumen) && /Series y repeticiones/.test(resumen), `${nombre}/${t} el resumen de una entidad`);
  await foto('panel-entidad-pendiente');
  await p.click('[data-go=crear]');
  ok(await p.locator('text=Podrás publicar cuando verifiquemos la entidad.').count() > 0, `${nombre}/${t} «Crear» no publica hasta verificarla`);
  ok(errores.length === 0, `${nombre}/${t} panel sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function admin(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, sesion()]);
  const item = (id, status, origin) => ({
    id, status, origin, kind: 'council', official_name: 'Ayuntamiento de Prueba', tax_id: 'P2806500B', contact_name: 'Ana Prueba',
    contact_role: 'Técnica de Cultura', website: 'https://prueba.example.org', area: 'Getafe', created_at: '2026-10-14T09:00:00Z',
    proof_path: `${U}/doc.pdf`, business_id: BIZ, business_name: 'Ayuntamiento de Prueba', business_city: 'Getafe',
    business_status: 'pending', user_id: U, user_email: 'entidad.prueba@example.com', user_since: '2026-10-14T08:00:00Z', business_applications: 1,
  });
  const estado = { subidas: [], llamadas: [], bizzes: [], rpc: {} };
  Object.assign(estado.rpc, {
    is_admin: true,
    admin_entity_applications: { counts: { pending: 2, approved: 0, rejected: 0, withdrawn: 0 }, items: [item('a1', 'pending', 'signup'), item('a2', 'pending', 'profile')] },
    admin_resolve_entity_application: (b) => { estado.decisiones = [...(estado.decisiones || []), b]; return { ok: true }; },
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`${BASE}/admin/#/entidades`, { waitUntil: 'networkidle' });
  await p.waitForSelector('text=Entidades por verificar');
  await p.waitForSelector('[data-aprobar]');
  ok(await p.locator('[data-doc]').count() === 2, `${nombre}/${t} admin: el documento de cada solicitud`);
  await p.screenshot({ path: `${OUT}/web-admin-entidades-${nombre}-${t}.png`, fullPage: true });
  const pop = p.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
  await p.click('[data-doc="0"]');
  const ventana = await pop;
  ok(!!ventana && ventana.url().includes('business-claims'), `${nombre}/${t} admin: abre el documento con enlace firmado`);
  if (ventana) await ventana.close();
  await p.click('[data-aprobar="0"]');
  await p.waitForSelector('dialog[open]');
  await p.screenshot({ path: `${OUT}/web-admin-aprobar-${nombre}-${t}.png` });
  await p.selectOption('dialog[open] [name=kind]', 'district');
  await p.fill('dialog[open] [name=note]', 'Llamada al teléfono de la sede electrónica');
  await p.click('dialog[open] button[type=submit], dialog[open] .btn.primary');
  await p.waitForTimeout(400);
  await p.click('[data-rechazar="1"]');
  await p.waitForSelector('dialog[open]');
  await p.fill('dialog[open] [name=reason]', 'El documento no está firmado');
  await p.click('dialog[open] button[type=submit], dialog[open] .btn.primary, dialog[open] .btn.bad');
  await p.waitForTimeout(400);
  const d = estado.decisiones || [];
  ok(d.length === 2 && d[0].p_approve === true && d[0].p_kind === 'district' && /sede/.test(d[0].p_reason)
    && d[1].p_approve === false && d[1].p_reason === 'El documento no está firmado', `${nombre}/${t} admin: aprobar y rechazar ${JSON.stringify(d)}`);
  ok(errores.length === 0, `${nombre}/${t} admin sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

/** Turnstile con las claves de prueba: 1x… siempre pasa, 2x… siempre falla. */
async function turnstile(nav, nombre, t, vp) {
  for (const [clave, pasa] of [['1x00000000000000000000AA', true], ['2x00000000000000000000AB', false]]) {
    const ctx = await nav.newContext({ viewport: vp });
    await ctx.route(`${BASE}/config.js*`, async (route) => {
      const r = await route.fetch();
      route.fulfill({ response: r, body: (await r.text()).replace("turnstile: ''", `turnstile: '${clave}'`) });
    });
    const pedidos = [];
    await ctx.route(`${SUPA}/**`, async (route) => {
      const req = route.request();
      if (req.method() === 'POST' && /\/auth\/v1\/(signup|otp|token)/.test(req.url())) {
        pedidos.push({ url: req.url(), body: req.postDataJSON() });
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'email_address_invalid', msg: 'prueba' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/app/#/registro`, { waitUntil: 'networkidle' });
    await p.fill('#f [name=name]', 'Prueba Turnstile');
    await p.fill('#f [name=email]', 'turnstile.prueba@example.com');
    await p.fill('#f [name=password]', 'Prueba-Turnstile-2026');
    await p.fill('#f [name=password2]', 'Prueba-Turnstile-2026');
    await p.fill('#f [name=birth]', '1990-01-01');
    await p.check('#f [name=terms]');
    await p.click('#f button[type=submit]');
    await p.waitForTimeout(pasa ? 6000 : 8000);
    await p.screenshot({ path: `${OUT}/web-turnstile-${pasa ? 'pasa' : 'falla'}-${nombre}-${t}.png`, fullPage: true });
    const token = pedidos.filter((x) => x.url.includes('/signup')).map((x) => x.body?.gotrue_meta_security?.captcha_token).find(Boolean);
    if (pasa) ok(token === 'XXXX.DUMMY.TOKEN.XXXX', `${nombre}/${t} Turnstile (siempre pasa): el registro manda el token de prueba ${JSON.stringify(pedidos.map((x) => x.url))}`);
    else ok(pedidos.length === 0 && /robot/i.test(await p.locator('body').innerText()), `${nombre}/${t} Turnstile (siempre falla): no se manda y se dice`);
    await ctx.close();
  }
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    if (!SOLO || SOLO.includes('panel')) await panel(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} panel: ${e.message}`));
    if (!SOLO || SOLO.includes('admin')) await admin(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} admin: ${e.message}`));
    if (!SOLO || SOLO.includes('turnstile')) await turnstile(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} turnstile: ${e.message}`));
  }
  await nav.close();
}
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
