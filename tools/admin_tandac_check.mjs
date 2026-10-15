// Prueba de la tanda C del admin en la web local, con una sesión simulada
// (Supabase contestado aquí: no toca dev ni manda nada):
//
//  1. Admin › «Sorteos»: abiertos y retirados (con motivo y quién); «Retirar…»
//     pide el motivo y manda `admin_remove_giveaway`.
//  2. Admin › «Denuncias»: una petición de grupo denunciada (tipo, «para»
//     los negocios, la nota) y, dentro, «Retirar y cerrar todas» con motivo
//     → `admin_resolve_report_group('group_request', …)`.
//  3. Panel › «Grupos y empresas»: «Denunciar» en una petición → hoja con
//     motivo → `report_target('group_request', <fila>)`.
//  4. Panel › «Sorteos»: uno retirado, con el motivo y la vía de recurso.
//  5. «Tu cuenta» › una petición de grupo retirada por Klendar.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8788 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> node tools/admin_tandac_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8788';
const OUT = process.env.OUT || '.';
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000ad3c';
const BIZ = 'b1000000-0000-4000-8000-00000000ad3c';
const G1 = 'a1000000-0000-4000-8000-00000000a001';
const G2 = 'a1000000-0000-4000-8000-00000000a002';
const PET = 'c1000000-0000-4000-8000-00000000c001';
const FILA = 'd1000000-0000-4000-8000-00000000d001';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admin.tandac@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const masDias = (n) => new Date(Date.now() + n * 864e5).toISOString();

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
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
  // Si algo no aparece, lo que se ve (para saber por qué).
  p.setDefaultTimeout(15000);
  const esperaOriginal = p.waitForSelector.bind(p);
  p.waitForSelector = (sel, o) => esperaOriginal(sel, o).catch(async (e) => {
    const v = await p.locator('#view').innerText().catch(() => '');
    throw new Error(`${sel} no aparece: ${v.replace(/\s+/g, ' ').slice(0, 300)} ${errores.join(' | ')}`);
  });
  return { ctx, p, estado, errores };
}

const sorteo = (x) => ({
  id: G1, prize: 'Cena para dos', description: 'Menú degustación', prize_value_cents: 6000, winners: 1, status: 'active',
  starts_at: masDias(-2), ends_at: masDias(5), created_at: masDias(-2), adults_only: false, requires_favorite: true,
  organizer_name: 'Bar Sonda SL', entries: 12, open_reports: 2,
  business: { id: BIZ, name: 'Bar Sonda', city: 'Madrid', slug: 'bar-sonda-madrid', is_active: true }, ...x,
});

async function adminSorteos(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-admin-auth-token`, {
    is_admin: true,
    admin_mfa_status: { required: false, enrolled: true },
    admin_kpis: {},
    admin_giveaways: (b) => ({ total: 2, rows: b.p_status === 'removed' ? [sorteo({ id: G2, status: 'removed', removed_at: masDias(-1), removed_reason: 'Premio engañoso', removed_by: 'qa@klendar.app' })]
      : [sorteo(), sorteo({ id: G2, prize: 'Un año de cafés', status: 'removed', removed_at: masDias(-1), removed_reason: 'Premio engañoso', removed_by: 'qa@klendar.app', entries: 30 })] }),
    admin_remove_giveaway: { ok: true, entries: 12 },
  });
  await p.goto(`${BASE}/admin/#/sorteos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-sorteo-adm]');
  const v = await p.locator('#view').innerText();
  ok(/Cena para dos/.test(v) && /Abierto/.test(v) && /Bar Sonda/.test(v) && /12 participan/.test(v), `${nombre}/${t} admin sorteos: el abierto con su negocio y participantes`);
  ok(/Retirado/.test(v) && /Motivo: Premio engañoso/.test(v) && /qa@klendar.app/.test(v), `${nombre}/${t} admin sorteos: el retirado con motivo y quién`);
  ok(await p.locator('[data-retira-sorteo]').count() === 1, `${nombre}/${t} admin sorteos: «Retirar…» solo en el abierto`);
  ok(await p.locator('#nav').filter({ hasText: 'Sorteos' }).count() === 1, `${nombre}/${t} admin: «Sorteos» en el menú`);
  await p.screenshot({ path: `${OUT}/web-admin-sorteos-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-retira-sorteo]');
  await p.waitForSelector('#modal textarea[name=reason]');
  const dlg = await p.locator('#modal').innerText();
  ok(/Retirar el sorteo/.test(dlg) && /12 personas que participan/.test(dlg) && /6 meses/.test(dlg) && /No se puede deshacer/.test(dlg), `${nombre}/${t} admin sorteos: el diálogo explica qué pasa`);
  await p.screenshot({ path: `${OUT}/web-admin-sorteo-retirar-${nombre}-${t}.png` });
  await p.fill('#modal textarea[name=reason]', 'Premio que no existe: publicidad engañosa');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const llamada = estado.llamadas.find(([fn]) => fn === 'admin_remove_giveaway');
  ok(llamada && llamada[1].p_id === G1 && llamada[1].p_reason === 'Premio que no existe: publicidad engañosa', `${nombre}/${t} admin sorteos: manda el sorteo y el motivo ${JSON.stringify(llamada)}`);
  ok(errores.length === 0, `${nombre}/${t} admin sorteos sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const grupoDen = {
  target_type: 'group_request', target_id: PET, n: 2, open_count: 2, total_count: 2, people: 2, with_account: 2, without_account: 0,
  first_at: masDias(-1), last_at: masDias(0), reviewing: false, state: 'published', live: true,
  target: { title: 'Visitad mi web de apuestas', kind: 'company_dinner', people: 10, event_date: '2026-12-12', business: 'Bar Sonda, Casa Lola', business_id: BIZ, city: 'Madrid' },
  reasons: [{ reason: 'spam', n: 2 }],
};

async function adminDenuncias(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-admin-auth-token`, {
    is_admin: true,
    admin_mfa_status: { required: false, enrolled: true },
    admin_kpis: {},
    admin_report_groups: { total: 1, rows: [grupoDen], hot: 0 },
    admin_report_group: { target_type: 'group_request', target_id: PET, state: 'published', live: true, target: grupoDen.target,
      reports: [{ id: 'e1000000-0000-4000-8000-00000000e001', ref: 'E1000000', status: 'open', reason: 'spam', details: 'Publicidad', channel: 'account', created_at: masDias(0),
        reporter: { kind: 'account', id: U, email: 'duena@example.com', name: 'Lola' } }] },
    admin_resolve_report_group: { ok: true, reports: 2, taken_down: true },
  });
  await p.goto(`${BASE}/admin/#/denuncias`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.den-grupo');
  const v = await p.locator('#view').innerText();
  ok(/petición de grupo/i.test(v) && /Cena de empresa · 10 personas/.test(v) && /«Visitad mi web de apuestas»/.test(v) && /para Bar Sonda, Casa Lola/.test(v), `${nombre}/${t} admin denuncias: la petición de grupo con su tipo, nota y negocios`);
  ok(await p.locator('#type option[value=group_request]').count() === 1, `${nombre}/${t} admin denuncias: filtro «Peticiones de grupo»`);
  await p.screenshot({ path: `${OUT}/web-admin-denuncia-grupo-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${BASE}/admin/#/denuncias/group_request/${PET}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.den-ficha');
  await p.click('.den-ficha [data-dec=remove]');
  await p.waitForSelector('#modal textarea[name=reason]');
  ok(/La petición se cierra para todos los negocios/.test(await p.locator('#modal').innerText()), `${nombre}/${t} admin denuncias: explica qué pasa al retirar una petición`);
  await p.fill('#modal textarea[name=reason]', 'Publicidad de otra web');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const l = estado.llamadas.find(([fn]) => fn === 'admin_resolve_report_group');
  ok(l && l[1].p_type === 'group_request' && l[1].p_id === PET && l[1].p_decision === 'remove' && l[1].p_reason === 'Publicidad de otra web', `${nombre}/${t} admin denuncias: retira con motivo ${JSON.stringify(l)}`);
  ok(errores.length === 0, `${nombre}/${t} admin denuncias sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const PANEL = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 } },
  ...x,
});

async function panelGrupos(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, PANEL({
    business_group_settings_get: { can_manage: true, enabled: true, max_people: 30, kinds: ['company_dinner'], note: null },
    business_group_requests: [{ id: FILA, status: 'pending', respond_by: masDias(2), kind: 'company_dinner', event_date: '2026-12-12', people: 10, budget_cents: 3000, note: 'Visitad mi web de apuestas', others: 1, created_at: masDias(0) }],
    report_target: null,
  }));
  await p.goto(`${BASE}/panel/#/grupos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-denunciar]');
  await p.screenshot({ path: `${OUT}/web-panel-grupos-denunciar-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-denunciar]');
  await p.waitForSelector('#modal select[name=motivo]');
  await p.screenshot({ path: `${OUT}/web-panel-grupos-denunciar-hoja-${nombre}-${t}.png` });
  await p.fill('#modal textarea[name=detalles]', 'Nos manda publicidad');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const l = estado.llamadas.find(([fn]) => fn === 'report_target');
  ok(l && l[1].p_type === 'group_request' && l[1].p_id === FILA && l[1].p_reason === 'spam' && l[1].p_details === 'Nos manda publicidad', `${nombre}/${t} panel grupos: denuncia la petición ${JSON.stringify(l)}`);
  ok(errores.length === 0, `${nombre}/${t} panel grupos sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function panelSorteo(nav, nombre, t, vp) {
  const g = { ...sorteo({ status: 'removed', removed_at: masDias(-1), removed_reason: 'Premio engañoso' }), seed_hash: 'abc', stats: { participants: 12, left: 0, new_favorites: 3 }, winners_list: [], editable: false };
  const { ctx, p, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, PANEL({
    business_giveaways: { can_manage: true, tax_id: 'B12345674', giveaways: [g] },
  }));
  await p.goto(`${BASE}/panel/#/sorteos/${G1}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.kpis');
  const v = await p.locator('#view').innerText();
  ok(/Retirado/.test(v) && /Klendar lo ha retirado: Premio engañoso/.test(v) && /6 meses/.test(v), `${nombre}/${t} panel sorteo retirado: estado, motivo y recurso`);
  ok(!/Cancelar el sorteo/.test(v), `${nombre}/${t} panel sorteo retirado: sin «Cancelar»`);
  await p.screenshot({ path: `${OUT}/web-panel-sorteo-retirado-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} panel sorteo sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function cuentaGrupo(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    group_request_detail: { id: PET, kind: 'company_dinner', event_date: '2026-12-12', people: 10, budget_cents: 3000, note: null, status: 'removed', created_at: masDias(-1), closed_at: masDias(0),
      targets: [{ id: FILA, status: 'withdrawn', business: { id: BIZ, name: 'Bar Sonda', city: 'Madrid' } }] },
  });
  await p.goto(`${BASE}/app/#/grupos/${PET}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const v = await p.locator('body').innerText();
  ok(/Retirada por Klendar/.test(v) && /Klendar ha retirado esta petición/.test(v), `${nombre}/${t} Tu cuenta: petición retirada por Klendar`);
  await p.screenshot({ path: `${OUT}/web-cuenta-peticion-retirada-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} Tu cuenta sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const PRUEBAS = { adminSorteos, adminDenuncias, panelGrupos, panelSorteo, cuentaGrupo };
const SOLO = process.env.SOLO || '';
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const [k, f] of Object.entries(PRUEBAS)) {
      if (SOLO && !SOLO.includes(k)) continue;
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${k}: ${e.message.split('\n')[0]}`));
    }
  }
  await nav.close();
}
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
