// Prueba de la estructura del panel web, la misma que el modo negocio de la
// app (Iván, 23-11; RUNBOOK §4zzz-panelapp): Hoy · Validar · Publicar ·
// Negocio, con los grupos de Negocio en el mismo orden, las reglas de cada
// papel, la entidad, las direcciones viejas y el menú lateral o la barra de
// abajo según el tamaño. Con un Supabase de mentira (_web_con_datos): no toca
// dev ni prod.
//
//  1. Escritorio (1440) y tablet en horizontal (1180): menú lateral con las
//     cuatro y, debajo de Negocio, sus grupos; sin barra de abajo.
//  2. Tablet en vertical (820) y móvil (390): barra de abajo con las cuatro,
//     sin menú lateral, sin «Más» y sin desplazamiento de lado.
//  3. Hoy: el día, las cifras de hoy (`business_today`), «Para hoy», «Lo
//     último validado» y nada de lo que se ha ido a otra sección.
//  4. Publicar: «¿Qué quieres publicar?» (cuatro y «Más formas de publicar»)
//     y «Publicaciones» con sus chips, sin «Nueva oferta» arriba.
//  5. Negocio: los grupos y sus baldosas en el orden de la app (la
//     pegatina de escaparate junto al cartel del local, §4zzz-cartel);
//     `#/negocio/<grupo>` baja a ese grupo; una pantalla de dentro marca su
//     sección y su grupo.
//  6. El personal: tres secciones (sin Publicar), sin importes ni lo de
//     gestión en Negocio, «Fidelizar» entero y «Listas».
//  7. Una entidad: «Entidad», sin «Que vuelvan», «Pantallas y gente».
//  8. Direcciones viejas: #/resumen, #/publicaciones (con ?estado=),
//     #/herramientas y ?biz= de un aviso.
//  9. Parado (bloqueado): Hoy con el aviso; Negocio con «Tu plan», lo
//     delicado y nada más.
// 10. Peticiones al entrar en Hoy: `business_today` sí; las dos del menú de
//     antes (`before_closing_setup`, `business_broadcast_week`), no.
//
//   PW=<ruta a playwright> node tools/panel_app_check.mjs
//   (arranca su serve_dev en PORT, 9341, con Supabase cortado)
import { mkdirSync } from 'node:fs';
import { playwright, REF, SUPA } from './_supabase_simulado.mjs';
import { webConDatos, NEGOCIOS } from './_web_con_datos.mjs';

const { chromium } = playwright();
const OUT = process.env.OUT || 'tools/out';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

// ── La sesión de mentira ───────────────────────────────────────────────────
const U = '0e7717e0-0000-4000-8000-0000000a99a1';
const BIZ = NEGOCIOS[0].id;
const BIZ2 = NEGOCIOS[1].id;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2', amr: [{ method: 'password', timestamp: 1 }] })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'panel.app@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Ana' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ahora = Date.now();
const iso = (h) => new Date(ahora + h * 3600e3).toISOString();
const oferta = (n, titulo, extra = {}) => ({
  id: `0ff00000-0000-4000-8000-00000000a99${n}`, business_id: BIZ, title: titulo, kind: 'flash_offer', status: 'active', panel_state: 'activa',
  redeem_start_at: iso(-1), redeem_end_at: iso(4), views: 120, redemptions_count: 4, audience: 'all', price_cents: 250, moderation_status: 'approved', ...extra,
});
const OFERTAS = [oferta(1, 'Café + tostada'), oferta(2, 'Concierto acústico', { kind: 'future_event', event_at: iso(5), event_end_at: iso(7), reservations_enabled: true, max_redemptions: 40, seats_taken: 22 })];
const TOOLS = {
  ok: true, features: {}, team: { members: 3 }, promoters: { active: 1 }, series: { rules_active: 1, active: 1 },
  reviews: { unanswered: 1 }, questions: { unanswered: 2 }, daily_menu: { suggested: true }, before_closing: { suggested: true },
  broadcasts: { suggested: true, upcoming: 2 }, tv: { screens: 1 }, menu: { items: 12 }, links: { count: 2 }, stamps: { active: 1 },
  queue: { open: false, used_30d: true }, capacity: { enabled: false }, crowd: { enabled: true }, groups: { enabled: true, pending: 1 },
  table_qr: { has: true, wifi: true }, orders: { enabled: false }, preorders: { enabled: false },
};
function rpcs({ rol = 'owner', entidad = false, bloqueado = false } = {}) {
  return {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [
      { id: BIZ, name: entidad ? 'Ayuntamiento de Prueba' : 'Bar Sonda', role: rol, verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' },
      { id: BIZ2, name: 'Otro Local', role: 'manager', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' },
    ],
    business_is_organizer: false,
    my_entity_application: entidad ? { entity_kind: 'municipality', can_apply: false, why: null, application: null } : { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: {
      plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: bloqueado ? 'past_due' : 'active', period_end: '2027-01-01T00:00:00Z',
      payment_method: 'transfer', price_cents: 1990, active_offers: 1, max_active_offers: null, has_analytics: true,
      billing: { enabled: true, blocked: bloqueado, hold: bloqueado ? 'blocked' : null, block_soon: false, entity: entidad, block_kind: bloqueado ? 'unpaid' : null },
    },
    business_tools_overview: { ...TOOLS, can_edit: rol !== 'staff' },
    my_business_offer_counts: { todas: 2, activa: 2, total: 2, publicadas: 2 },
    my_business_offers_page: OFERTAS,
    business_crowd_status: { enabled: true, open_now: true, level: null },
    business_venue_demand: { people: 0 },
    business_today: {
      validated: 7, views: 85, today: OFERTAS, next: entidad ? [OFERTAS[1]] : [],
      recent: [{ at: iso(-0.2), title: 'Café + tostada', seats: 1, kind: 'offer', code: 'ABC123', ...(rol === 'staff' ? {} : { ticket_cents: 1250 }) }],
    },
    business_terms_notice: null, business_closure_state: null, business_recent_validations: [],
    my_offer_rules: [], my_publishable_businesses: [], assistant_status: { available: false }, my_stamp_cards: [], my_redemptions: [],
    business_loyalty: { ok: true, can_edit: rol !== 'staff', coupon: {}, thanks: {} },
  };
}
async function conSesion(ctx, R, peticiones) {
  await ctx.addInitScript(([k, v]) => { try { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, SESION]);
  await ctx.route(`${SUPA}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (peticiones && p.startsWith('/rest/v1/')) peticiones.push(p.replace('/rest/v1/', ''));
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/token')) return json(JSON.parse(SESION));
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn in R) return json(R[fn]);
    }
    return route.fallback();
  });
}

const web = await webConDatos({ puerto: Number(process.env.PORT || 9341) });
const nav = await chromium.launch();
async function abre({ w = 1440, h = 900, ...op } = {}, ruta = 'hoy', peticiones = null) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 1000 });
  await web.conDatos(ctx);
  await conSesion(ctx, rpcs(op), peticiones);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`${web.BASE}/panel#/${ruta}`);
  await p.waitForSelector('#view h1', { timeout: 15000 });
  await p.waitForTimeout(900);
  return { ctx, p, errores };
}
const textos = (p, sel) => p.$$eval(sel, (es) => es.filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => e.textContent.trim()));
const visible = (p, sel) => p.$eval(sel, (e) => getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0).catch(() => false);
const hash = (p) => p.evaluate(() => location.hash);

// ── 1 y 2. Menú lateral o barra de abajo, según el tamaño ─────────────────
for (const [nombre, w, h, lateral] of [['escritorio', 1440, 900, true], ['tablet horizontal', 1180, 820, true], ['tablet vertical', 820, 1180, false], ['móvil', 390, 844, false]]) {
  const { ctx, p, errores } = await abre({ w, h });
  ok(await visible(p, '#side') === lateral, `${nombre}: menú lateral ${lateral ? 'a la vista' : 'escondido'}`);
  ok(await visible(p, '#tabbar') === !lateral, `${nombre}: barra de abajo ${lateral ? 'escondida' : 'a la vista'}`);
  if (lateral) {
    ok(JSON.stringify(await textos(p, '#nav > a.nav > span:last-child')) === JSON.stringify(['Hoy', 'Validar', 'Publicar', 'Negocio']), `${nombre}: las cuatro, en el orden de la app`);
    ok(JSON.stringify(await textos(p, '#nav .nav-sub a')) === JSON.stringify(['Tu ficha', 'Que vuelvan', 'En el local', 'Agenda y equipo', 'Cifras, plan y ayuda']), `${nombre}: los grupos de Negocio, en orden`);
    ok(await p.$eval('#nav a[href="#/hoy"]', (a) => a.getAttribute('aria-current')) === 'page', `${nombre}: Hoy marcada como la página`);
  } else {
    ok(JSON.stringify(await textos(p, '#tabbar a > span:last-child')) === JSON.stringify(['Hoy', 'Validar', 'Publicar', 'Negocio']), `${nombre}: la barra con las cuatro`);
    ok(!(await p.$('#masBtn')) && !(await p.$('#menuBtn')), `${nombre}: sin «Más» ni «Menú»`);
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(sobra <= 1, `${nombre}: sin desplazamiento de lado (${sobra} px)`);
    // Cambiar de sección con la barra.
    await p.click('#tabbar a[href="#/negocio"]');
    await p.waitForSelector('.neg-tiles');
    ok(await p.$eval('#tabbar a[href="#/negocio"]', (a) => a.getAttribute('aria-current')) === 'page', `${nombre}: la barra marca Negocio`);
  }
  // Dentro del panel, solo el menú del negocio (§4zzz-tabletojo): ni las
  // pestañas de cliente ni «Para negocios» ni tu cuenta; «Volver a Klendar»,
  // la campana y el idioma, sí.
  ok(!(await visible(p, 'header.top .pestanas')) && !(await visible(p, 'header.top .top-negocios')) && !(await visible(p, 'header.top .top-entrar')),
    `${nombre}: sin la barra de cliente de la web`);
  ok(await visible(p, '.panel-volver') && await p.$eval('.panel-volver', (a) => a.getAttribute('href')) === '/descubre', `${nombre}: «Volver a Klendar» a Descubre`);
  ok(await visible(p, 'header.top details.idioma'), `${nombre}: el idioma, a la vista`);
  if (lateral) {
    // El menú lateral sigue el tema: claro en modo claro.
    const fondo = await p.$eval('#side', (e) => getComputedStyle(e).backgroundColor);
    const [r, g, b] = fondo.match(/\d+/g).map(Number);
    ok(r > 200 && g > 200 && b > 200, `${nombre}: menú lateral claro en modo claro (${fondo})`);
  }
  await p.screenshot({ path: `${OUT}/panelapp_${nombre.replace(' ', '_')}.png` });
  ok(!errores.length, `${nombre}: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── 3 y 10. Hoy y sus peticiones ────────────────────────────────────────────
{
  const peticiones = [];
  const { ctx, p } = await abre({}, 'hoy', peticiones);
  await p.waitForTimeout(800);
  const t = await p.$eval('#view', (e) => e.innerText);
  ok(/^[A-ZÁÉÍÓÚ]/.test(await p.$eval('#view h1', (e) => e.textContent)) && /noviembre|diciembre|enero|[a-z]+, \d+ de/.test(await p.$eval('#view h1', (e) => e.textContent.toLowerCase())), 'Hoy: el día de título');
  ok(/validados hoy/.test(t) && /vistas hoy/.test(t) && /reservas de hoy/.test(t), 'Hoy: las cifras de hoy (validados, vistas y reservas)');
  ok(/Para hoy/.test(t) && /Lo último validado/.test(t), 'Hoy: «Para hoy» y «Lo último validado»');
  ok(!!(await p.$('#pausa')), 'Hoy: «Cerrar por hoy» junto al día');
  ok(!/Crear|Últimas publicaciones|Más herramientas|Lo esencial|Salir del equipo/.test(t), 'Hoy: sin lo que se ha ido a otra sección');
  ok(await p.$eval('a[href="#/validar?recientes=1"]', (a) => !!a).catch(() => false), 'Hoy: «Ver todos» lleva a Validar › Últimos validados');
  ok(peticiones.includes('rpc/business_today'), 'Hoy: pide business_today');
  ok(!peticiones.includes('rpc/before_closing_setup') && !peticiones.includes('rpc/business_broadcast_week'), 'Hoy: sin las dos peticiones del menú de antes');
  ok(!peticiones.includes('rpc/business_stats') && !peticiones.includes('rpc/business_loyalty') && !peticiones.includes('rpc/my_business_offers_page'), 'Hoy: sin lo del resumen de antes (stats, loyalty, publicaciones)');
  console.log(`   peticiones al entrar en Hoy: ${peticiones.length} (${[...new Set(peticiones)].join(', ')})`);
  // El resumen de antes pedía 36 al entrar (23-11, con estos mismos datos).
  ok(peticiones.length <= 26, `Hoy: menos peticiones que el resumen de antes (${peticiones.length}; antes, 36)`);
  await p.click('a[href="#/validar?recientes=1"]');
  await p.waitForSelector('#recientesT');
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.activeElement?.id === 'recientesT'), 'Validar: «Ver todos» deja el foco en «Últimos validados»');
  await ctx.close();
}

// ── 4. Publicar ──────────────────────────────────────────────────────────────
{
  const { ctx, p } = await abre({}, 'publicar');
  await p.waitForSelector('.crear-op');
  ok(await p.$eval('#view h1', (e) => e.textContent.trim()) === 'Publicar', 'Publicar: su título');
  ok((await p.$$eval('.crear > .crear-ops > .crear-op', (es) => es.length)) === 4, 'Publicar: las cuatro de siempre');
  ok(!!(await p.$('details.crear-mas')), 'Publicar: «Más formas de publicar ▾»');
  ok(await p.$eval('#pubsT', (e) => e.textContent.trim()) === 'Publicaciones', 'Publicar: «Publicaciones» debajo');
  ok(!(await p.$('.page-head a[href="#/publicaciones/nueva-flash"]')), 'Publicar: sin «Nueva oferta» arriba (un solo camino)');
  ok((await p.$$eval('#filtroArch button', (es) => es.map((b) => b.textContent))).every((x) => !/^Tod[ao]s?\b/.test(x)), 'Publicar: chips sin «Todas»');
  // «Imprimir cartel» (§4zzz-cartel): a la página de la web, en otra pestaña;
  // una exclusiva o una +18, sin enlace (el botón dice por qué).
  const acc = await p.evaluate(() => {
    const base = { id: '0ff00000-0000-4000-8000-0000000c0a01', kind: 'flash_offer', status: 'active', moderation_status: 'approved', audience: 'all',
      redeem_start_at: new Date(Date.now() - 36e5).toISOString(), redeem_end_at: new Date(Date.now() + 36e5).toISOString() };
    return [accionesPub(base), accionesPub({ ...base, audience: 'favorites' }), accionesPub({ ...base, adults_only: true }), accionesPub({ ...base, audience: 'promoters' })];
  });
  ok(/<a href="\/cartel\/0ff00000-0000-4000-8000-0000000c0a01" target="_blank"[^>]*>Imprimir cartel/.test(acc[0]) && !/Cartel para imprimir/.test(acc[0]), 'Publicar: «Imprimir cartel» lleva al cartel de la web');
  ok(/data-act="cartel-no"[^>]*>Imprimir cartel/.test(acc[1]) && /data-act="cartel-no"/.test(acc[2]), 'Publicar: exclusiva y +18, el botón sin enlace (dice por qué)');
  ok(!/Imprimir cartel/.test(acc[3]), 'Publicar: una de RRPP, sin cartel');
  // En la lista de verdad: «Más ▾» de la primera, con «Imprimir cartel».
  const mas = p.locator('details.mas').first();
  await mas.locator('summary').click();
  ok(await mas.locator('a', { hasText: 'Imprimir cartel' }).isVisible(), 'Publicar: «Más ▾» enseña «Imprimir cartel»');
  await mas.screenshot({ path: `${OUT}/panelapp_imprimir_cartel.png` }).catch(() => {});
  await p.screenshot({ path: `${OUT}/panelapp_publicar_mas.png` });
  await ctx.close();
}

// ── 5. Negocio ───────────────────────────────────────────────────────────────
{
  const { ctx, p } = await abre({}, 'negocio/en-el-local');
  await p.waitForSelector('.neg-tiles');
  await p.waitForTimeout(600);
  ok(JSON.stringify(await textos(p, '.neg-grupo > h2')) === JSON.stringify(['Tu ficha', 'Que vuelvan', 'En el local', 'Agenda y equipo', 'Cifras, plan y ayuda', 'Zona delicada · solo el propietario']), 'Negocio: los grupos de la app, en orden');
  ok(await p.evaluate(() => document.activeElement?.id === 'gt-en-el-local'), 'Negocio: #/negocio/en-el-local baja a su grupo');
  ok(await p.$eval('#nav .nav-sub a[href="#/negocio/en-el-local"]', (a) => a.getAttribute('aria-current')) === 'page', 'Negocio: el grupo, marcado en el menú');
  const ficha = await textos(p, '#g-tu-ficha .neg-tile > span:last-child');
  ok(JSON.stringify(ficha.slice(0, 3)) === JSON.stringify(['Editar ficha', 'Cómo se ve ↗', 'Horario']), 'Negocio: Tu ficha empieza como la app');
  ok(await p.$eval('#g-tu-ficha [data-neg="viewPublic"]', (a) => a.target === '_blank' && /otra pestaña/.test(a.getAttribute('aria-label'))), 'Negocio: «Cómo se ve» dice que se abre en otra pestaña');
  ok(!!(await p.$('[data-neg="tv"]')) && !!(await p.$('[data-neg="broadcasts"]')) && !!(await p.$('[data-neg="dailyMenu"]')), 'Negocio: tele, partidos y menú del día en «En el local»');
  ok(!(await p.$('[data-neg="loyalty"]')), 'Negocio: quien gestiona no tiene «Fidelizar» entero (cada herramienta a un toque)');
  // La pegatina de escaparate, junto al cartel del local (§4zzz-cartel).
  const local = await p.$$eval('#g-en-el-local [data-neg]', (es) => es.map((e) => e.dataset.neg));
  ok(local.indexOf('sticker') === local.indexOf('poster') + 1, `Negocio: «Pegatina» justo después de «Cartel» (${local.join(', ')})`);
  await p.locator('#g-en-el-local').screenshot({ path: `${OUT}/panelapp_en_el_local.png` });
  ok(await p.$eval('[data-neg="sticker"]', (a, id) => a.target === '_blank' && new URL(a.href).pathname === `/cartel/pegatina/${id}` && /Pegatina de escaparate/.test(a.getAttribute('aria-label')), BIZ), 'Negocio: «Pegatina» abre la de su local en otra pestaña');
  await p.click('[data-neg="webWidget"]');
  ok(await p.$eval('#modal', (d) => d.open && /widget\.js/.test(d.textContent)), 'Negocio: «En tu web» abre la línea para pegar');
  await p.keyboard.press('Escape');
  // Una pantalla de dentro marca su sección y su grupo.
  await p.evaluate(() => { location.hash = '#/sellos'; });
  await p.waitForTimeout(800);
  ok(await p.$eval('#nav a[href="#/negocio"]', (a) => a.getAttribute('aria-current')) === 'true', 'Sellos: Negocio marcada como sección');
  ok(await p.$eval('#nav .nav-sub a[href="#/negocio/que-vuelvan"]', (a) => a.getAttribute('aria-current')) === 'true', 'Sellos: «Que vuelvan» marcado');
  await ctx.close();
}

// ── 6. El personal ───────────────────────────────────────────────────────────
{
  const { ctx, p } = await abre({ rol: 'staff', w: 390, h: 844 }, 'hoy');
  ok(JSON.stringify(await textos(p, '#tabbar a > span:last-child')) === JSON.stringify(['Hoy', 'Validar', 'Negocio']), 'Personal: tres secciones, sin Publicar');
  ok(!/€/.test(await p.$eval('#view', (e) => e.innerText)), 'Personal: Hoy sin importes');
  ok(!(await p.$('#pausa')), 'Personal: sin «Cerrar por hoy»');
  await p.evaluate(() => { location.hash = '#/negocio'; });
  await p.waitForSelector('.neg-tiles');
  await p.waitForTimeout(500);
  const claves = await p.$$eval('[data-neg]', (es) => es.map((e) => e.dataset.neg));
  ok(!claves.some((k) => ['profileEdit', 'team', 'plan', 'tv', 'promoters', 'thanks', 'message', 'poster', 'sticker'].includes(k)), 'Personal: Negocio sin lo de gestión');
  ok(claves.includes('loyalty') && claves.includes('door'), 'Personal: «Fidelizar» entero y «Listas»');
  ok(await p.$$eval('.neg-grupo > h2', (es) => es.some((e) => e.textContent.trim() === 'Cifras y ayuda')), 'Personal: «Cifras y ayuda» (sin plan)');
  ok(!!(await p.$('#salir-equipo')) && await visible(p, '.neg-sesion'), 'Personal: «Salir del equipo» y, en el móvil, «Cerrar sesión»');
  await p.evaluate(() => { location.hash = '#/publicar'; });
  await p.waitForTimeout(900);
  ok(!(await p.$('.crear')), 'Personal: #/publicar, la lista sin «¿Qué quieres publicar?»');
  await p.evaluate(() => { location.hash = '#/equipo'; });
  await p.waitForTimeout(600);
  ok(await p.$eval('#view', (e) => /propietario o de un encargado/.test(e.innerText)) && !!(await p.$('a[href="#/hoy"]')), 'Personal: lo de gestión, con el aviso y «Ir a Hoy»');
  await ctx.close();
}

// ── 7. Una entidad ───────────────────────────────────────────────────────────
{
  const { ctx, p } = await abre({ entidad: true }, 'hoy');
  ok(JSON.stringify(await textos(p, '#nav > a.nav > span:last-child')) === JSON.stringify(['Hoy', 'Validar', 'Publicar', 'Entidad']), 'Entidad: la sección se llama «Entidad»');
  ok(await p.$eval('#view', (e) => /Lo próximo/.test(e.innerText)), 'Entidad: Hoy con «Lo próximo»');
  ok(!(await p.$('#pausa')), 'Entidad: sin «Cerrar por hoy»');
  await p.evaluate(() => { location.hash = '#/negocio'; });
  await p.waitForSelector('.neg-tiles');
  await p.waitForTimeout(500);
  const grupos = await textos(p, '.neg-grupo > h2');
  ok(!grupos.includes('Que vuelvan') && grupos.includes('Pantallas y gente') && grupos.includes('Cifras y ayuda'), `Entidad: sus grupos (${grupos.join(' · ')})`);
  ok(await p.$eval('#view', (e) => /Dar de baja la entidad/.test(e.innerText)), 'Entidad: «Dar de baja la entidad»');
  ok(!(await p.$('[data-neg="sticker"]')) && !!(await p.$('[data-neg="poster"]')), 'Entidad: su cartel, sin pegatina de escaparate (no tiene local)');
  await ctx.close();
}

// ── 8. Direcciones viejas ────────────────────────────────────────────────────
{
  const { ctx, p } = await abre({}, 'resumen');
  ok(await hash(p) === '#/hoy', '#/resumen → #/hoy');
  await p.evaluate(() => { location.hash = '#/publicaciones?estado=borrador'; });
  await p.waitForTimeout(900);
  ok(await hash(p) === '#/publicar?estado=borrador', '#/publicaciones?estado=… → #/publicar?estado=…');
  await p.evaluate(() => { location.hash = '#/herramientas'; });
  await p.waitForTimeout(900);
  ok(await hash(p) === '#/negocio', '#/herramientas → #/negocio');
  await p.evaluate(() => { location.hash = '#/publicaciones/nueva-flash'; });
  await p.waitForTimeout(900);
  ok(await hash(p) === '#/publicaciones/nueva-flash' && await p.$eval('#nav a[href="#/publicar"]', (a) => a.getAttribute('aria-current')) === 'true', 'Nueva oferta: se queda y marca Publicar');
  await ctx.close();
  const otro = await abre({}, `resumen?biz=${BIZ2}`);
  ok((await hash(otro.p)).startsWith('#/hoy') && await otro.p.$eval('#bizSelect', (s) => s.value) === BIZ2, '#/resumen?biz= (un aviso): Hoy del otro local');
  await otro.ctx.close();
}

// ── 9. Parado ────────────────────────────────────────────────────────────────
{
  const { ctx, p } = await abre({ bloqueado: true }, 'hoy');
  ok(JSON.stringify(await textos(p, '#nav > a.nav > span:last-child')) === JSON.stringify(['Hoy', 'Validar', 'Publicar', 'Negocio']) && !(await p.$('#nav .nav-sub')), 'Parado: las cuatro, sin los grupos');
  await p.evaluate(() => { location.hash = '#/negocio'; });
  await p.waitForTimeout(900);
  const claves = await p.$$eval('[data-neg]', (es) => es.map((e) => e.dataset.neg));
  ok(JSON.stringify(claves) === JSON.stringify(['plan', 'help']) && !!(await p.$('#g-delicado')), `Parado: Negocio con «Tu plan», la ayuda y lo delicado (${claves.join(', ')})`);
  await p.evaluate(() => { location.hash = '#/sellos'; });
  await p.waitForTimeout(700);
  ok(await hash(p) === '#/hoy', 'Parado: lo demás lleva a Hoy');
  await ctx.close();
}

await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
