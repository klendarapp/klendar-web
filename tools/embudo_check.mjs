// Prueba de «Saber dónde se atascan» en el admin (migración 20261281700000 de
// la app), en la web local con Supabase simulado (no toca dev ni prod):
//
//  1. Cifras: «Alta de negocios» con sus pasos, Negocios / Entidades,
//     «Atascados ahora» con números que llevan a la lista; en «Activación»,
//     «Confirman el correo» y «Ven una publicación».
//  2. Sin la migración en la base (la RPC nueva falla): Cifras sale igual,
//     sin los pasos nuevos y con el aviso.
//  3. Negocios desde un «atascado»: manda `p_stuck`, enseña el filtro y
//     «Quitar este filtro» lo quita; sin él no se manda `p_stuck`.
//
//   SUPABASE_BLOQUEADO=1 PORT=8788 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> node tools/embudo_check.mjs
import { playwright, REF, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8788';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const U = '0e7717e0-0000-4000-8000-00000000eb0d';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admin.embudo@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const paso = (n, d1, d7, h) => ({ n, d1, d7, median_hours: h });
const EMBUDO = {
  business: {
    total: 10, pending: 2, rejected: 1,
    steps: { verified: paso(7, 3, 6, 20.5), started: paso(5, 1, 4, 40), published: paso(4, 1, 3, 52), viewed: paso(4, 1, 3, 60), code: paso(2, 0, 1, 120), validated: paso(1, 0, 1, 150) },
    weeks: [{ week: '2026-10-26', total: 4, verified: 3, published: 2, validated: 1 }, { week: '2026-11-02', total: 6, verified: 4, published: 2, validated: 0 }],
  },
  entity: { total: 1, pending: 1, rejected: 0, steps: {}, weeks: [] },
  stuck: { pending_48h: 3, no_publication: 2, draft_only: 1, no_redemption: 4 },
};
const ACTIVACION = {
  people: 20,
  steps: { confirmed: paso(18, 17, 18, 0.2), viewed: paso(15, 10, 14, 1), code: paso(8, 3, 6, 30), validated: paso(5, 1, 4, 50), saved: paso(9, 5, 8, 10) },
  weeks: [{ week: '2026-10-26', people: 8, confirmed: 7, viewed: 6, code: 3, validated: 2, saved: 4 }, { week: '2026-11-02', people: 12, confirmed: 11, viewed: 9, code: 5, validated: 3, saved: 5 }],
};

async function contexto(nav, vp, { sinMigracion = false } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, sesion()]);
  const llamadas = [];
  const RPC = {
    is_admin: true,
    admin_mfa_status: { required: false, enrolled: true },
    admin_kpis: {},
    admin_stats_cities: [{ city: 'Málaga', businesses: 10 }],
    admin_stats_signups: { total: 0, people: 0, businesses: 0, day: [], week: [], month: [] },
    admin_stats_activation: ACTIVACION,
    admin_stats_retention: { cohorts: [] },
    admin_stats_places: { cities: [], zones: [] },
    admin_stats_businesses: { weeks: [], top: [] },
    admin_stats_sources: { totals: {}, weeks: [] },
    admin_stats_business_funnel: EMBUDO,
    admin_businesses_page: { total: 0, rows: [] },
  };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      llamadas.push([fn, body]);
      if (sinMigracion && fn === 'admin_stats_business_funnel') {
        return json({ code: 'PGRST202', message: 'Could not find the function' }, 404);
      }
      return json(RPC[fn] === undefined ? null : RPC[fn]);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.setDefaultTimeout(15000);
  return { ctx, pg, llamadas, errores };
}

const nav = await chromium.launch();
for (const [t, vp] of [['escritorio', { width: 1280, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
  // 1. Cifras con la migración.
  {
    const { ctx, pg, errores } = await contexto(nav, vp);
    await pg.goto(`${BASE}/admin#/cifras`, { waitUntil: 'networkidle' });
    await pg.waitForSelector('#cfAlta');
    const v = await pg.locator('#view').innerText();
    ok(/Alta de negocios/.test(v) && /De los 10 negocios que se dieron de alta/.test(v), `${t}: «Alta de negocios» con el total`);
    ok(['Verificados', 'Empiezan una publicación', 'Publican la primera', 'Primera vista', 'Primer código', 'Primer canje validado'].every((x) => v.includes(x)), `${t}: los seis pasos`);
    ok(/70 %/.test(v) && /40 %/.test(v), `${t}: porcentajes de los pasos`);
    ok(/Confirman el correo/.test(v) && /Ven una publicación/.test(v), `${t}: dos pasos más en «Activación»`);
    const atascos = await pg.locator('#cfAltaSec a.kpi').evaluateAll((as) => as.map((a) => [a.getAttribute('href'), a.querySelector('b').textContent]));
    ok(atascos.length === 4 && atascos[0][0] === '#/negocios?stuck=pending_48h' && atascos[0][1] === '3' && atascos[3][1] === '4', `${t}: «Atascados ahora» con enlaces ${JSON.stringify(atascos)}`);
    await pg.screenshot({ path: `${OUT}/web-admin-embudo-${t}.png`, fullPage: true });
    await pg.click('#cfAltaTipo button[data-k=entity]');
    const v2 = await pg.locator('#cfAltaSec').innerText();
    ok(/De la entidad que se dio de alta/.test(v2) && /entidades|Entidades/.test(v2), `${t}: pestaña Entidades`);
    ok(/alta=entity/.test(pg.url()), `${t}: la pestaña queda en la dirección`);
    ok(errores.length === 0, `${t}: Cifras sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
  // 2. Sin la migración.
  {
    const { ctx, pg, errores } = await contexto(nav, vp, { sinMigracion: true });
    await pg.goto(`${BASE}/admin#/cifras`, { waitUntil: 'networkidle' });
    await pg.waitForSelector('#cfAlta');
    const v = await pg.locator('#view').innerText();
    ok(/falta la migración 20261281700000/.test(v) && /Activación/.test(v) && /Sacan su primer código/.test(v), `${t}: sin migración, Cifras sale y avisa`);
    ok(!/Confirman el correo/.test(v), `${t}: sin migración, sin los pasos nuevos`);
    ok(errores.length === 0, `${t}: sin migración, sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
  // 3. La lista de Negocios filtrada.
  {
    const { ctx, pg, llamadas, errores } = await contexto(nav, vp);
    await pg.goto(`${BASE}/admin#/negocios?stuck=no_publication`, { waitUntil: 'networkidle' });
    await pg.waitForSelector('#quitaAtasco');
    const pide = llamadas.filter(([fn]) => fn === 'admin_businesses_page');
    ok(pide.length && pide.at(-1)[1].p_stuck === 'no_publication' && pide.at(-1)[1].p_status === 'all', `${t}: manda p_stuck ${JSON.stringify(pide.at(-1))}`);
    ok(/Verificados hace más de 7 días sin publicar nada/.test(await pg.locator('#atascoFiltro').innerText()), `${t}: se ve el filtro`);
    await pg.click('#quitaAtasco');
    await pg.waitForTimeout(300);
    const ultima = llamadas.filter(([fn]) => fn === 'admin_businesses_page').at(-1);
    ok(!('p_stuck' in ultima[1]) && (await pg.locator('#atascoFiltro').count()) === 0 && !/stuck=/.test(pg.url()), `${t}: «Quitar este filtro» lo quita ${JSON.stringify(ultima)}`);
    ok(errores.length === 0, `${t}: Negocios sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}
await nav.close();
console.log(fallos ? `${fallos} fallo(s)` : 'todo bien');
process.exit(fallos ? 1 : 0);
