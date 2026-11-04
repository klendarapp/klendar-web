// «Dónde verlo» con todos los deportes (TheSportsDB, migraciones
// 20261260100008–100010 de la app), en la web:
//   · la página pública, con los datos de verdad de dev: todo lo que viene,
//     deportes (balonmano), competiciones del deporte elegido, el filtro por
//     competición, la cita «Datos deportivos: TheSportsDB» (ES y EN) y el
//     detalle de un partido con su cita;
//   · el panel («Partidos que pones», con la base simulada): «Pones siempre»
//     con su ✕, competiciones, «⋯» → «Poner siempre los de …» y «Lo pones
//     siempre»;
//   · el admin (Emisiones → Ligas, simulado): encender y apagar una liga.
// Guarda capturas en OUT (móvil y escritorio).
//
//   PORT=8811 node tools/serve_dev.mjs
//   BASE=http://localhost:8811 PW=<ruta a playwright> OUT=<carpeta> node tools/deportes_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { supabasePublic } from '../functions/_lib/page.js';

const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const OUT = process.env.OUT || 'tools/out';
mkdirSync(OUT, { recursive: true });
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000de01';
const BIZ = 'b1000000-0000-4000-8000-00000000de01';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'deportes@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json({ ok: true, results: { thesportsdb: { items: 10, inserted: 0, updated: 10 } } });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, time_zone: 'Europe/Madrid', brand_color: '#1E79D1', logo_url: null, cover_image_url: null, gallery: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, clave, rpc) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [clave, sesion()]);
  const estado = { llamadas: [], rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const TODOS = { movil: { width: 390, height: 844 }, escritorio: { width: 1280, height: 900 } };
// SOLO=movil (o escritorio) para no pasar los dos tamaños (dev con poco disco).
const TAM = process.env.SOLO ? { [process.env.SOLO]: TODOS[process.env.SOLO] } : TODOS;
const nav = await chromium.launch();

// ── 1. La página pública (datos de verdad de dev) ─────────────────────────
for (const [t, vp] of Object.entries(TAM)) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/partidos/`, { waitUntil: 'networkidle' });
  let txt = await p.locator('main').innerText();
  ok(/Dónde verlo/.test(await p.title()) || /Dónde verlo/.test(txt), `${t} /partidos/: se llama «Dónde verlo»`);
  ok(await p.locator('a.partido').count() > 5, `${t} /partidos/: todo lo que viene (aunque no lo ponga ningún bar)`);
  ok(/Balonmano/.test(txt) && /Baloncesto/.test(txt), `${t} /partidos/: deportes con balonmano`);
  ok(/Datos deportivos: TheSportsDB/.test(txt), `${t} /partidos/: la cita de TheSportsDB`);
  await p.screenshot({ path: `${OUT}/web-donde-verlo-${t}.png`, fullPage: false });

  await p.goto(`${BASE}/partidos/?deporte=football`, { waitUntil: 'networkidle' });
  txt = await p.locator('main').innerText();
  ok(await p.locator('.partidos-comps a.chip').count() > 3 && /LaLiga/.test(txt) && /Champions League/.test(txt), `${t} fútbol: sus competiciones`);
  await p.screenshot({ path: `${OUT}/web-donde-verlo-futbol-${t}.png`, fullPage: false });

  await p.goto(`${BASE}/partidos/?deporte=football&competicion=champions`, { waitUntil: 'networkidle' });
  const metas = await p.locator('a.partido small').allInnerTexts();
  ok(metas.length > 0 && metas.every((m) => /Champions League/.test(m)), `${t} Champions: solo la Champions (${metas.length})`);
  ok(await p.locator('.partidos-comps a.chip.on').innerText() === 'Champions League', `${t} Champions: el chip marcado`);
  await p.screenshot({ path: `${OUT}/web-donde-verlo-champions-${t}.png`, fullPage: false });

  const href = await p.locator('a.partido').first().getAttribute('href');
  await p.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
  txt = await p.locator('main').innerText();
  ok(/Bares que lo ponen/.test(txt) && /Datos deportivos: TheSportsDB/.test(txt), `${t} detalle: bares y la cita`);
  await p.screenshot({ path: `${OUT}/web-partido-${t}.png`, fullPage: false });

  await p.goto(`${BASE}/en/matches/?sport=handball`, { waitUntil: 'networkidle' });
  txt = await p.locator('main').innerText();
  ok(/Where to watch/.test(txt) && /Sports data: TheSportsDB/.test(txt) && /Handball/.test(txt), `${t} EN: «Where to watch», handball y la cita`);
  await ctx.close();
}

// ── 2. El panel (simulado, con partidos de verdad de dev) ─────────────────
const real = await (await fetch(`${SUPA}/rest/v1/rpc/where_to_watch`, {
  method: 'POST',
  headers: { apikey: supabasePublic().key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_all: true, p_sport: 'football', p_days: 7, p_limit: 40, p_lang: 'es' }),
}).catch(() => null))?.json().catch(() => null);
const base = Array.isArray(real) && real.length ? real : [];
const conClave = base.map((b, i) => ({
  ...b, on: i % 4 === 0 || b.competition_code === 'champions', auto: b.competition_code === 'champions',
  own: false, competition_key: b.competition_code, offer: i === 0 ? { id: 'o1', title: 'Caña y tapa a 2,50 €', status: 'active' } : null,
}));
for (const [t, vp] of Object.entries(TAM)) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    business_tools_overview: { ok: true, can_edit: true, team: { members: 1 } },
    business_broadcast_week: {
      ok: true, can_edit: true, suggested: true,
      rules: [{ team_id: 'equipo-betis', name: 'Real Betis', sport: 'football' }, { competition: 'champions', name: 'Champions League', sport: 'football' }],
      items: conClave,
    },
    set_business_broadcast_rule: { ok: true, changed: 3 },
  });
  await p.goto(`${BASE}/panel/#/partidos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.pt-siempre');
  let v = await p.locator('#view').innerText();
  ok(/Pones siempre/.test(v) && /Real Betis/.test(v) && /Champions League/.test(v), `${t} panel: «Pones siempre» con sus reglas`);
  ok(/Lo pones siempre/.test(v), `${t} panel: lo marcado por una regla lo dice`);
  ok(/Datos deportivos: TheSportsDB/.test(v), `${t} panel: la cita`);
  await p.screenshot({ path: `${OUT}/web-panel-partidos-${t}.png`, fullPage: false });
  // Fútbol → sus competiciones.
  await p.locator('#ptDeportes label', { hasText: 'Fútbol' }).click().catch(() => {});
  const comps = await p.locator('#ptComps label').count();
  ok(comps > 2, `${t} panel: competiciones del fútbol (${comps})`);
  // «⋯» → «Poner siempre los de …».
  const mas = p.locator('.pt-mas summary').first();
  if (await mas.count()) {
    await mas.click();
    await p.screenshot({ path: `${OUT}/web-panel-poner-siempre-${t}.png`, fullPage: false });
    const btn = p.locator('.pt-mas[open] [data-siempre-equipo]').first();
    await btn.click();
    await p.waitForTimeout(400);
    const l = estado.llamadas.find(([fn, b]) => fn === 'set_business_broadcast_rule' && b.p_on === true);
    ok(l && l[1].p_team && l[1].p_business === BIZ, `${t} panel: «Poner siempre los de …» llama a la base ${JSON.stringify(l?.[1])}`);
  } else ok(false, `${t} panel: sin «⋯»`);
  await p.waitForSelector('[data-regla]');
  await p.locator('[data-regla]').first().click();
  await p.waitForTimeout(400);
  const q = estado.llamadas.find(([fn, b]) => fn === 'set_business_broadcast_rule' && b.p_on === false);
  ok(q && q[1].p_team === 'equipo-betis', `${t} panel: el ✕ deja de ponerlo siempre`);
  ok(!errores.length, `${t} panel: sin errores ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 3. El admin: Emisiones → Ligas (simulado) ─────────────────────────────
const LIGAS = [
  { id: '4335', code: 'laliga', sport: 'football', name: 'LaLiga', name_en: 'LaLiga', enabled: true, sort: 10, season: '2026-2027', upcoming: 10, bars: 3, rules: 1, last_run_at: new Date().toISOString(), last_items: 10, last_error: null },
  { id: '4387', code: 'nba', sport: 'basketball', name: 'NBA', name_en: 'NBA', enabled: true, sort: 130, season: '2026-2027', upcoming: 105, bars: 0, rules: 0, last_run_at: new Date().toISOString(), last_items: 105, last_error: null },
  { id: '5519', code: 'eurocopa_clasif', sport: 'football', name: 'Clasificación para la Eurocopa', name_en: 'Euro qualifiers', enabled: true, sort: 95, season: null, upcoming: 0, bars: 0, rules: 0, last_run_at: new Date().toISOString(), last_items: 0, last_error: 'sin_temporada' },
  { id: '4464', code: 'atp', sport: 'tennis', name: 'ATP', name_en: 'ATP', enabled: false, sort: 600, season: '2026', note: 'Sin calendario: solo resultados. Los grandes, a mano', upcoming: 0, bars: 0, rules: 0, last_run_at: null, last_items: null, last_error: null },
];
for (const [t, vp] of Object.entries(TAM)) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-admin-auth-token`, {
    is_admin: true,
    admin_mfa_status: { required: false, enrolled: true },
    admin_kpis: {},
    admin_broadcast_leagues: LIGAS,
    admin_broadcasts: { last_import: { source: 'thesportsdb', mode: 'daily', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), items: 462, calls: 42 }, items: [] },
    admin_set_broadcast_league: { ok: true, removed: 0 },
  });
  await p.goto(`${BASE}/admin/#/emisiones`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-liga]');
  const v = await p.locator('#view').innerText();
  ok(/Ligas/.test(v) && /LaLiga/.test(v) && /NBA/.test(v) && /Sin temporada en curso/.test(v), `${t} admin: las ligas con lo que traen`);
  ok(/TheSportsDB/.test(v), `${t} admin: la última importación es de TheSportsDB`);
  await p.screenshot({ path: `${OUT}/web-admin-ligas-${t}.png`, fullPage: false });
  await p.locator('[data-liga="4464"]').check();
  await p.waitForTimeout(400);
  const l = estado.llamadas.find(([fn]) => fn === 'admin_set_broadcast_league');
  ok(l && l[1].p_id === '4464' && l[1].p_enabled === true, `${t} admin: encender una liga`);
  ok(!errores.length, `${t} admin: sin errores ${errores.join(' | ')}`);
  await ctx.close();
}

await nav.close();
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
