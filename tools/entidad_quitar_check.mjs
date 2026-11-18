// Prueba del admin › negocio › «Cuenta de entidad…» al quitarla (migración
// 20261285400110 de la app): pide el motivo (obligatorio) y, opcional, en
// inglés; manda `admin_set_entity` con los dos y dice lo que le queda. Al
// ponerla o cambiar el tipo, no pide nada. Sesión y Supabase simulados (no
// toca dev ni prod ni manda nada).
//
//   SUPABASE_BLOQUEADO=1 PORT=8793 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> BASE=http://localhost:8793 node tools/entidad_quitar_check.mjs
import { playwright, REF, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8793';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const U = '0e7717e0-0000-4000-8000-00000000e17a';
const BIZ = 'b1000000-0000-4000-8000-00000000e17a';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admin.entidad@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const negocio = (kind) => ({
  id: BIZ, name: 'Asociación Sonda', city: 'Málaga', address: 'Calle Larios 1', owner_id: U, owner_email: 'duena@example.com',
  verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', entity_kind: kind, entity_requested: null,
  amenities: [], social_links: {}, opening_hours: {}, gallery: [], created_at: '2026-10-01T10:00:00Z',
});

async function prueba(nav, kindAntes, elige, motivo) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } },
    [`sb-${REF}-admin-auth-token`, sesion()]);
  const llamadas = [];
  const rpc = {
    is_admin: true,
    admin_mfa_status: { required: false, enrolled: true },
    admin_kpis: {},
    admin_business_detail: { business: negocio(kindAntes), subscriptions: [], payments: [], offers: [], members: [], posts: [], reviews: [], reports: [], audit: [],
      stats: { favorites: 0, redemptions_30d: 0, views_30d: 0 } },
    admin_set_entity: (b) => (b.p_kind ? { entity_kind: b.p_kind, plan: null, until: null }
      : { entity_kind: null, plan: 'launch_free', until: '2027-03-31' }),
  };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      llamadas.push([fn, body]);
      const r = rpc[fn];
      return json(r === undefined ? null : typeof r === 'function' ? r(body) : r);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.setDefaultTimeout(15000);
  await pg.goto(`${BASE}/admin#/negocios/${BIZ}`, { waitUntil: 'networkidle' });
  await pg.waitForSelector('[data-a="entity"]', { state: 'attached' }).catch(async (e) => {
    const v = await pg.locator('#view').innerText().catch(() => '');
    throw new Error(`no sale «Cuenta de entidad…»: ${v.replace(/\s+/g, ' ').slice(0, 400)} ${errores.join(' | ')} ${e.message}`);
  });
  await pg.evaluate(() => document.querySelector('[data-a="entity"]').click());
  await pg.waitForSelector('#modal select[name=kind]');
  await pg.selectOption('#modal select[name=kind]', elige);
  await pg.click('#modal button[type=submit]');
  let dlg = '';
  if (motivo !== undefined) {
    await pg.waitForSelector('#modal textarea[name=reason]');
    dlg = await pg.locator('#modal').innerText();
    await pg.screenshot({ path: `${OUT}/web-admin-entidad-quitar.png` });
    // Vacío no deja (es obligatorio).
    await pg.click('#modal button[type=submit]');
    await pg.waitForTimeout(200);
    const sigue = await pg.locator('#modal textarea[name=reason]').isVisible();
    await pg.fill('#modal textarea[name=reason]', motivo.es);
    if (motivo.en) await pg.fill('#modal textarea[name=reason_en]', motivo.en);
    await pg.click('#modal button[type=submit]');
    await pg.waitForTimeout(500);
    return { llamadas, dlg, sigue, errores, toast: await pg.locator('#toast, .toast').allInnerTexts().catch(() => []), cierra: () => ctx.close() };
  }
  await pg.waitForTimeout(500);
  return { llamadas, dlg, errores, toast: await pg.locator('#toast, .toast').allInnerTexts().catch(() => []), cierra: () => ctx.close() };
}

const nav = await chromium.launch();
try {
  const q = await prueba(nav, 'merchants', '', { es: 'No hemos podido comprobar la inscripción', en: 'We could not check the registration' });
  ok(/Quitar la cuenta de entidad/.test(q.dlg) && /Asociación Sonda/.test(q.dlg) && /motivo/i.test(q.dlg) && /Gratis de lanzamiento/.test(q.dlg),
    `quitarla abre el diálogo del motivo y explica qué le llega ${q.dlg.slice(0, 200)}`);
  ok(q.sigue, 'sin motivo no se puede enviar');
  const l = q.llamadas.find(([fn]) => fn === 'admin_set_entity');
  ok(l && l[1].p_business === BIZ && l[1].p_kind === null && l[1].p_reason === 'No hemos podido comprobar la inscripción'
    && l[1].p_reason_en === 'We could not check the registration', `manda el motivo y el de inglés ${JSON.stringify(l)}`);
  ok(q.toast.some((t) => /Ya no es una entidad; avisado/.test(t) && /Gratis de lanzamiento/.test(t)), `dice lo que le queda ${JSON.stringify(q.toast)}`);
  ok(q.errores.length === 0, `sin errores JS ${q.errores.join(' | ')}`);
  await q.cierra();

  const p = await prueba(nav, null, 'ngo');
  const lp = p.llamadas.find(([fn]) => fn === 'admin_set_entity');
  ok(lp && lp[1].p_kind === 'ngo' && !('p_reason' in lp[1]), `ponerla no pide motivo ${JSON.stringify(lp)}`);
  ok(p.errores.length === 0, `sin errores JS ${p.errores.join(' | ')}`);
  await p.cierra();

  const c = await prueba(nav, 'merchants', 'ngo');
  const lc = c.llamadas.find(([fn]) => fn === 'admin_set_entity');
  ok(lc && lc[1].p_kind === 'ngo' && !('p_reason' in lc[1]), `cambiar el tipo no pide motivo ${JSON.stringify(lc)}`);
  await c.cierra();
} finally {
  await nav.close();
}
if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
console.log('\nTodo bien.');
