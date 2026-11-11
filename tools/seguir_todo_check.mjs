// «Equipos y deportistas que sigues»: seguir lo que sea (equipos, deportistas
// y competiciones; migración 20261260100070_seguir_lo_que_sea de la app), en
// la web, en Chromium y WebKit, a 390 y 1280:
//   · la ficha pública de una carrera (simulada): «Seguir
//     Fórmula 1» (o MotoGP) y sus pilotos, con «Ver N más»; con sesión
//     (simulada), los que ya sigues salen de «Ver N más»; ES y EN;
//   · «Tu cuenta» (/cuenta/equipos, simulada): la lista con su etiqueta («Piloto ·
//     Fórmula 1», «Equipo · LaLiga», «Competición») y el buscador único;
//   · el panel («Partidos que pones», simulado): «Poner siempre…» con el
//     buscador y «⋯» → «Poner siempre los de Topuria»;
//   · el admin (Emisiones → Seguir, simulado): la lista, «Dar de alta» y
//     «Apagar».
// No escribe nada de verdad.
//
// Con sus propios datos (tools/_web_con_datos.mjs) para la ficha pública: una
// carrera de Fórmula 1 con la competición y su parrilla para seguir
// (`where_to_watch` y `broadcast_detail`, con `follow` como
// `follow_item_json` de la migración 20261260100070 de la app: la
// competición, con su nombre en cada idioma). Antes cogía una carrera de dev
// y, desde que las pruebas no llegan a Supabase (5-11), fallaba siempre.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/seguir_todo_check.mjs
import { mkdirSync } from 'node:fs';
import { playwright, REF, SUPA } from './_supabase_simulado.mjs';
import { webConDatos } from './_web_con_datos.mjs';

const uid = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PILOTOS = ['Max Verstappen', 'Lando Norris', 'Charles Leclerc', 'Fernando Alonso', 'Carlos Sainz', 'Lewis Hamilton', 'Oscar Piastri', 'George Russell'];
/** Lo que se puede seguir de la carrera, en [lang] (la competición con su nombre en inglés). */
const seguibles = (lang) => [
  { id: uid(300), kind: 'competition', sport: 'motor', name: lang === 'en' ? 'Formula 1' : 'Fórmula 1', full_name: 'Fórmula 1', competition: 'f1', context: null, following: false },
  ...PILOTOS.map((n, i) => ({
    id: uid(301 + i), kind: 'athlete', sport: 'motor', name: n.split(' ').pop(), full_name: n, competition: null,
    context: lang === 'en' ? 'Formula 1' : 'Fórmula 1', following: false,
  })),
];
const empieza = new Date(Date.now() + 3 * 864e5).toISOString();
const carrera = (lang) => ({
  id: uid(30), sport: 'motor', competition: lang === 'en' ? 'Formula 1' : 'Fórmula 1', competition_code: 'f1', competition_sort: 500,
  title: lang === 'en' ? 'Brazilian Grand Prix' : 'Gran Premio de Brasil', home: null, away: null, starts_at: empieza, ends_at: empieza,
  time_confirmed: true, status: 'scheduled', source: 'thesportsdb', teams: [], follow: seguibles(lang), bars: 0, offers: 0, nearest_m: null,
});
const web = await webConDatos({
  puerto: Number(process.env.PORT || 9000),
  rpc: {
    where_to_watch: (a) => ((a.p_all || a.p_q) && (!a.p_sport || a.p_sport === 'motor') ? [carrera(a.p_lang)] : []),
    broadcast_competitions: (a) => [{ key: 'f1', name: a.p_lang === 'en' ? 'Formula 1' : 'Fórmula 1', sport: 'motor', count: 1 }],
    broadcast_detail: (a) => (a.p_broadcast === uid(30) ? { ...carrera(a.p_lang), live: true, radius_m: null, bars: [] } : null),
  },
});
const BASE = web.BASE;

const pw = playwright();
const OUT = process.env.OUT || 'tools/out';
mkdirSync(OUT, { recursive: true });
const U = '0e7717e0-0000-4000-8000-00000000f070';
const BIZ = 'b1000000-0000-4000-8000-00000000f070';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'seguir.todo@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

/** La base simulada: `rpc` con lo que devuelve cada función (o una función
 * del cuerpo); `llamadas`, lo que se ha pedido. Las páginas públicas
 * sacan sus datos en el servidor (del Supabase falso de arriba). */
function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
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
async function contexto(nav, vp, clave, rpc, lang = 'es') {
  const ctx = await nav.newContext({ viewport: vp, locale: lang === 'en' ? 'en-GB' : 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ } }, [clave, sesion(), lang]);
  const estado = { llamadas: [], rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(20000);
  return { ctx, p, estado, errores };
}
const sinScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const TODOS = { movil: { width: 390, height: 844 }, escritorio: { width: 1280, height: 900 } };
// SOLO=movil (o escritorio) para no pasar los dos tamaños (dev con poco disco).
const TAM = process.env.SOLO ? { [process.env.SOLO]: TODOS[process.env.SOLO] } : TODOS;
const CONSENT = { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true };
const ALONSO = { id: 'a0000000-0000-4000-8000-000000000001', kind: 'athlete', sport: 'motor', name: 'Alonso', full_name: 'Fernando Alonso', context: 'Fórmula 1', following: false };
const F1 = { id: 'a0000000-0000-4000-8000-000000000002', kind: 'competition', sport: 'motor', name: 'Fórmula 1', full_name: 'Fórmula 1', competition: 'f1', context: null, following: false };
const RM = { id: 'a0000000-0000-4000-8000-000000000003', kind: 'team', sport: 'football', name: 'Real Madrid', full_name: 'Real Madrid CF', context: 'LaLiga', following: true };
const TOPURIA = { id: 'a0000000-0000-4000-8000-000000000004', kind: 'athlete', sport: 'combat', name: 'Topuria', full_name: 'Ilia Topuria', context: 'UFC', following: false };

// MOTOR=chromium (o webkit) para pasar solo uno.
for (const [motor, tipo] of [['chromium', pw.chromium], ['webkit', pw.webkit]].filter(([m]) => !process.env.MOTOR || m === process.env.MOTOR)) {
  const nav = await tipo.launch();

  // ── 1. La ficha pública de una carrera ─────────────────────────────────
  const p0 = await nav.newPage();
  await p0.goto(`${BASE}/partidos?deporte=motor`, { waitUntil: 'networkidle' });
  const carreras = await p0.locator('a.partido').evaluateAll((l) => l.map((a) => a.getAttribute('href')).slice(0, 6));
  let ruta = null;
  for (const h of carreras) {
    await p0.goto(`${BASE}${h}`, { waitUntil: 'networkidle' });
    if (await p0.locator('details.seguir-mas').count()) { ruta = h; break; }
  }
  ok(Boolean(ruta), `${motor}: una carrera con sus pilotos para seguir (${ruta})`);
  let dentro = null;
  if (ruta) {
    const comp = await p0.locator('.seguir-equipos > [data-seguir-equipo]').first().innerText();
    ok(/^Seguir (Fórmula 1|MotoGP)$/.test(comp), `${motor}: primero, la competición sin «a» («${comp}»)`);
    const resumen = await p0.locator('details.seguir-mas > summary').innerText();
    ok(/^Ver \d+ más$/.test(resumen), `${motor}: «${resumen}»`);
    // Solo los de fuera de «Ver N más» (dentro hay otro .seguir-equipos).
    const fuera = await p0.locator('.seguir-equipos > [data-seguir-equipo]:not(details [data-seguir-equipo])').count();
    ok(fuera === 4, `${motor}: la competición y 3 pilotos a la vista (${fuera})`);
    dentro = await p0.locator('details.seguir-mas [data-seguir-equipo]').first().getAttribute('data-seguir-equipo');
    const msg = await p0.locator('details.seguir-mas [data-seguir-equipo]').first().getAttribute('data-msg-si');
    ok(/^Sigues a .+: te avisamos antes de sus carreras$/.test(msg || ''), `${motor}: el aviso de un piloto («${msg}»)`);
    const en = ruta.replace(/^\/partidos\//, '/en/matches/');
    await p0.goto(`${BASE}${en}`, { waitUntil: 'networkidle' });
    const resEn = await p0.locator('details.seguir-mas > summary').innerText().catch(() => '');
    ok(/^See \d+ more$/.test(resEn) && /^Follow (Formula 1|MotoGP)$/.test(await p0.locator('.seguir-equipos > [data-seguir-equipo]').first().innerText()), `${motor} EN: «Follow Formula 1» y «${resEn}»`);
  }
  await p0.close();

  for (const [t, vp] of Object.entries(TAM)) {
    if (ruta && dentro) {
      const { ctx, p, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, {
        my_followed_teams: [{ ...ALONSO, id: dentro, following: true }],
        my_followed_artists: [],
      });
      await p.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
      await p.waitForFunction((id) => document.querySelector(`.seguir-equipos > [data-seguir-equipo="${id}"]`), dentro, { timeout: 15000 }).catch(() => {});
      ok(await p.locator(`.seguir-equipos > [data-seguir-equipo="${dentro}"][aria-pressed="true"]`).count() === 1, `${motor} ${t}: el piloto que sigues sale de «Ver N más», en activo`);
      ok(await sinScroll(p), `${motor} ${t}: ficha sin desplazamiento lateral`);
      await p.locator('details.seguir-mas > summary').click();
      await p.screenshot({ path: `${OUT}/seguir-ficha-${motor}-${t}.png`, fullPage: false });
      ok(!errores.length, `${motor} ${t}: ficha sin errores ${errores.join(' | ')}`);
      await ctx.close();
    }

    // ── 2. «Tu cuenta» → /cuenta/equipos ─────────────────────────────────────────
    {
      const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, {
        my_consents: CONSENT,
        my_followed_teams: [
          { ...RM, next: null }, { ...ALONSO, following: true, next: null }, { ...F1, following: true, next: null },
        ],
        follow_search: [F1, ALONSO, RM],
        follow_broadcast_team: { ok: true, new: true },
        unfollow_broadcast_team: { ok: true },
        set_broadcast_area: { ok: true, stored: true },
      });
      await p.goto(`${BASE}/cuenta/equipos`, { waitUntil: 'networkidle' });
      await p.waitForSelector('.equipos-lista');
      const txt = await p.locator('main').innerText();
      ok(/Equipos y deportistas que sigues/.test(txt), `${motor} ${t} cuenta: el título`);
      ok(/Fernando Alonso/.test(txt) && /Piloto · Fórmula 1/.test(txt), `${motor} ${t} cuenta: el piloto con su etiqueta`);
      ok(/Real Madrid CF · Equipo · LaLiga/.test(txt), `${motor} ${t} cuenta: el equipo con la suya`);
      ok(/Competición/.test(txt), `${motor} ${t} cuenta: la competición`);
      ok(await sinScroll(p), `${motor} ${t} cuenta: sin desplazamiento lateral`);
      await p.screenshot({ path: `${OUT}/seguir-cuenta-${motor}-${t}.png`, fullPage: false });
      await p.locator('[data-seguir-equipo]').first().click();
      await p.locator('dialog input[name=q]').fill('alo');
      await p.waitForSelector('dialog .eq-fila');
      const filas = await p.locator('dialog .eq-fila').allInnerTexts();
      ok(filas.length === 3 && /Competición/.test(filas[0]) && /Fernando Alonso[\s\S]*Piloto · Fórmula 1/.test(filas[1]), `${motor} ${t} cuenta: el buscador único con los tres tipos`);
      ok(/Seguir Fórmula 1/.test(filas[0]) && /Seguir a Alonso/.test(filas[1]) && /Sigues a Real Madrid/.test(filas[2]), `${motor} ${t} cuenta: «Seguir Fórmula 1» sin «a» y los demás con ella`);
      await p.screenshot({ path: `${OUT}/seguir-cuenta-buscar-${motor}-${t}.png`, fullPage: false });
      await p.locator('dialog .eq-fila button').first().click();
      await p.waitForTimeout(400);
      const l = estado.llamadas.find(([fn]) => fn === 'follow_broadcast_team');
      ok(l && l[1].p_team === F1.id, `${motor} ${t} cuenta: seguir una competición llama a la base`);
      const s = estado.llamadas.find(([fn]) => fn === 'follow_search');
      ok(s && s[1].p_q === 'alo' && s[1].p_lang === 'es', `${motor} ${t} cuenta: busca con follow_search`);
      ok(!errores.length, `${motor} ${t} cuenta: sin errores ${errores.join(' | ')}`);
      await ctx.close();
    }

    // ── 3. El panel: «Poner siempre…» ──────────────────────────────────────
    {
      const empieza = new Date(Date.now() + 864e5).toISOString();
      const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, {
        my_consents: CONSENT,
        my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
        business_is_organizer: false,
        my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
        business_tools_overview: { ok: true, can_edit: true, team: { members: 1 } },
        business_broadcast_week: {
          ok: true, can_edit: true, suggested: true, rules: [],
          items: [{ id: 'c0000000-0000-4000-8000-000000000001', sport: 'combat', competition: 'UFC', competition_code: 'ufc', competition_key: 'ufc', competition_sort: 400,
            title: 'UFC 330: Topuria vs Oliveira', starts_at: empieza, time_confirmed: true, status: 'scheduled', source: 'admin',
            teams: [], athletes: [TOPURIA], on: false, auto: false, own: false, offer: null }],
        },
        follow_search: [F1, ALONSO],
        set_business_broadcast_rule: { ok: true, changed: 2 },
      });
      await p.goto(`${BASE}/panel#/partidos`, { waitUntil: 'networkidle' });
      await p.waitForSelector('#ptSiempreMas');
      ok(/Poner siempre…/.test(await p.locator('#ptSiempreMas').innerText()), `${motor} ${t} panel: «Poner siempre…» aunque aún no haya reglas`);
      await p.locator('.pt-mas summary').first().click();
      const menu = await p.locator('.pt-mas[open] .pt-mas-menu').innerText();
      ok(/Poner siempre los de Topuria/.test(menu) && /Poner siempre: UFC/.test(menu), `${motor} ${t} panel: «⋯» con el luchador que nombra y la competición`);
      await p.locator('.pt-mas[open] [data-siempre-equipo]').first().click();
      await p.waitForTimeout(400);
      let l = estado.llamadas.find(([fn, b]) => fn === 'set_business_broadcast_rule' && b.p_team === TOPURIA.id);
      ok(l && l[1].p_on === true, `${motor} ${t} panel: «Poner siempre los de Topuria» llama a la base`);
      await p.waitForSelector('#ptSiempreMas');
      await p.locator('#ptSiempreMas').click();
      await p.locator('#modal input[name=q]').fill('alo');
      await p.waitForSelector('#modal .pt-elige-fila');
      const filas = await p.locator('#modal .pt-elige-fila').allInnerTexts();
      ok(/¿Qué pones siempre\?/.test(await p.locator('#modal h2').innerText()) && /Competición/.test(filas[0]) && /Piloto · Fórmula 1/.test(filas[1]), `${motor} ${t} panel: el buscador con sus etiquetas`);
      await p.screenshot({ path: `${OUT}/seguir-panel-${motor}-${t}.png`, fullPage: false });
      await p.locator('#modal .pt-elige-fila').nth(1).click();
      await p.waitForTimeout(400);
      l = estado.llamadas.find(([fn, b]) => fn === 'set_business_broadcast_rule' && b.p_team === ALONSO.id);
      ok(l && l[1].p_on === true && l[1].p_business === BIZ, `${motor} ${t} panel: elegir un piloto lo pone siempre`);
      ok(!errores.length, `${motor} ${t} panel: sin errores ${errores.join(' | ')}`);
      await ctx.close();
    }

    // ── 4. El admin: Emisiones → Seguir ────────────────────────────────────
    {
      const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-admin-auth-token`, {
        is_admin: true,
        admin_mfa_status: { required: false, enrolled: true },
        admin_kpis: {},
        admin_broadcasts: { last_import: null, items: [] },
        admin_broadcast_leagues: [],
        admin_follow_items: [
          { ...ALONSO, name: 'Fernando Alonso', short_name: 'Alonso', aliases: [], competitions: ['f1'], match_rule: 'competition', season: null, sort: 10, hidden: false, followers: 3, upcoming: 2, rules: 1 },
          { ...TOPURIA, name: 'Ilia Topuria', short_name: 'Topuria', aliases: ['El Matador'], competitions: ['ufc'], match_rule: 'name', season: null, sort: 30, hidden: true, followers: 0, upcoming: 0, rules: 0 },
        ],
        admin_save_follow_item: { ok: true, id: 'a0000000-0000-4000-8000-000000000009' },
        admin_hide_follow_item: { ok: true },
      });
      await p.goto(`${BASE}/admin#/emisiones?tab=seguir`, { waitUntil: 'networkidle' });
      await p.waitForSelector('[data-sg-editar]');
      const v = await p.locator('#view').innerText();
      ok(/Fernando Alonso/.test(v) && /Todas las de su campeonato/.test(v) && /Las que lo nombran/.test(v) && /apagado/.test(v), `${motor} ${t} admin: el catálogo con su regla y lo apagado`);
      await p.screenshot({ path: `${OUT}/seguir-admin-${motor}-${t}.png`, fullPage: false });
      await p.locator('#sgNuevo').click();
      await p.locator('dialog [name=name]').fill('Pedro Acosta');
      await p.locator('dialog [name=short_name]').fill('Acosta');
      await p.locator('dialog [name=competitions]').fill('motogp');
      await p.locator('dialog button[type=submit]').click();
      await p.waitForTimeout(500);
      const g = estado.llamadas.find(([fn]) => fn === 'admin_save_follow_item');
      ok(g && g[1].p_kind === 'athlete' && g[1].p_name === 'Pedro Acosta' && g[1].p_competitions?.[0] === 'motogp' && g[1].p_match_rule === 'competition', `${motor} ${t} admin: dar de alta un piloto ${JSON.stringify(g?.[1] || {})}`);
      await p.locator('[data-sg-apagar]').first().click();
      await p.locator('dialog button[type=submit]').click();
      await p.waitForTimeout(500);
      const h = estado.llamadas.find(([fn]) => fn === 'admin_hide_follow_item');
      ok(h && h[1].p_hidden === true, `${motor} ${t} admin: apagar uno`);
      ok(!errores.length, `${motor} ${t} admin: sin errores ${errores.join(' | ')}`);
      await ctx.close();
    }
  }
  await nav.close();
}
await web.cierra();
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
