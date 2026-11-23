// Pasada de tablet y pantallas grandes (RUNBOOK §4zzz-tablet, 23-11): lo
// público, «Tu cuenta», el panel y el admin a los tamaños de los iPad, las
// tablets Android, los plegables y las pantallas muy anchas, en claro y en
// oscuro. Con un Supabase de mentira (_web_con_datos): no toca dev ni prod.
//
// En cada página y tamaño se mira lo del barrido (_mira.mjs: scroll de lado,
// textos que se salen, cortados o que se pisan) y además:
//
//   · renglones larguísimos: un párrafo de letra normal con un renglón de más
//     de 62 em (≈ 120 letras; lo cómodo son 60–80) es una columna estirada a
//     todo lo ancho;
//   · fotos deformadas (con `object-fit: fill`, otra proporción que la suya)
//     o pixeladas (pintadas más del doble de grandes que su archivo);
//   · ninguna violación de la CSP (§4zzz-csp) en la consola;
//   · que lo de dentro no se estire de lado a lado en una pantalla muy ancha
//     (nada con texto de más de 1.400 px en una de 1.920).
//
//   PW=<ruta a playwright> node tools/tablet_check.mjs          (todo, unos 11 min)
//   TABLET_RAPIDO=1 …       claro, cuatro tamaños y sin capturas (el pre-push, unos 2 min)
//   TABLET_SOLO=/panel,/admin …   solo esas (en Git Bash, con MSYS_NO_PATHCONV=1)
//   OUT=<carpeta> …         capturas de cada página y tamaño (tools/out/tablet)
import { mkdirSync } from 'node:fs';
import { playwright, REF, SUPA } from './_supabase_simulado.mjs';
import { webConDatos, NEGOCIOS, PLANES } from './_web_con_datos.mjs';
import { mira } from './_mira.mjs';
import { contesta, estadoInicial } from './_bandeja_datos.mjs';

const { chromium } = playwright();
const RAPIDO = process.env.TABLET_RAPIDO === '1';
const OUT = process.env.OUT || 'tools/out/tablet';
if (!RAPIDO) mkdirSync(OUT, { recursive: true });

/** [nombre, ancho, alto]: los iPad (mini/Air en vertical, 11" y 13" en las dos), plegables y pantallas anchas. */
const TAMANOS = [
  ['768x1024', 768, 1024], ['820x1180', 820, 1180], ['1024x768', 1024, 768], ['1180x820', 1180, 820],
  ['1366x1024', 1366, 1024], ['1024x1366', 1024, 1366],
  // Plegable abierto (casi cuadrado) y cerrado (la pantalla de fuera, muy estrecha y alta).
  ['plegable-720x820', 720, 820], ['plegable-cerrado-344x882', 344, 882],
  ['1920x1080', 1920, 1080], ['2560x1440', 2560, 1440],
];
const RAPIDOS = new Set(['768x1024', '1024x768', '1366x1024', '1920x1080']);

const oferta = PLANES.find((p) => p.kind === 'flash_offer');
const evento = PLANES.find((p) => p.kind === 'future_event');
/** [ruta, zona]: zona `panel`/`admin`/`cuenta` entra con la sesión de mentira. */
const RUTAS = [
  ['/', null], ['/descubre', null], ['/explorar', null], ['/explorar?que=sitios', null], [`/b/${NEGOCIOS[0].slug}`, null],
  [`/o/${oferta.id}`, null], [`/o/${evento.id}`, null], [`/cartel/${oferta.id}`, null], ['/precios', null],
  ['/para-negocios', null], ['/para-entidades', null], ['/como-funciona', null], ['/preguntas', null], ['/alta', null], ['/en', null],
  ['/cuenta', 'cuenta'],
  ['/panel#/hoy', 'panel'], ['/panel#/validar', 'panel'], ['/panel#/publicar', 'panel'], ['/panel#/negocio', 'panel'], ['/panel#/ficha', 'panel'],
  ['/admin', 'admin'],
];
const solo = (process.env.TABLET_SOLO || '').split(',').filter(Boolean);

/** Lo visto que no es un fallo de maquetación: [ruta, tamaño, aviso]. */
const PERMITIDOS = [];
const permitido = (ruta, t, a) => PERMITIDOS.some(([r, tt, re]) => (r === '*' || ruta.startsWith(r)) && (tt === '*' || tt === t) && re.test(a));

/** Lo de tablet y pantallas anchas, además del barrido. */
const miraAncho = () => {
  const avisos = [];
  const ancho = document.documentElement.clientWidth;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return !el.closest('[hidden], dialog:not([open]), [aria-hidden="true"], .sr-only, .visually-hidden');
  };
  const nombre = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} «${(el.innerText || el.alt || '').trim().replace(/\s+/g, ' ').slice(0, 40)}»`;
  // Renglones larguísimos en letra de leer (no titulares: hasta 22 px).
  for (const el of document.body.querySelectorAll('p, li, dd, label, blockquote, figcaption, td, .hint, .muted, small')) {
    if (!visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (!(fs > 0) || fs > 22) continue;
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const max = Math.max(0, ...[...rg.getClientRects()].map((r) => r.width));
    if (max / fs > 62 && (el.innerText || '').trim().length > 130) avisos.push(`renglón de ${Math.round(max / fs)} em (${Math.round(max)} px): ${nombre(el)}`);
  }
  // Fotos deformadas o pixeladas (las de 1 px de los datos de mentira, no).
  for (const img of document.images) {
    if (!visible(img) || !img.complete || img.naturalWidth < 8) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 40) continue;
    const cs = getComputedStyle(img);
    const nat = img.naturalWidth / img.naturalHeight;
    const pin = r.width / r.height;
    if (cs.objectFit === 'fill' && !/svg/i.test(img.currentSrc) && Math.abs(pin / nat - 1) > 0.04) avisos.push(`foto deformada (${nat.toFixed(2)} → ${pin.toFixed(2)}): ${nombre(img)}`);
    const escala = cs.objectFit === 'cover' ? Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight) : Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    if (!/\.svg|image\/svg/i.test(img.currentSrc) && escala > 2) avisos.push(`foto pixelada (×${escala.toFixed(1)}, ${img.naturalWidth} px de archivo): ${nombre(img)}`);
  }
  // En una pantalla muy ancha, el bloque principal no va de lado a lado.
  if (ancho >= 1800) {
    // En todos los bloques principales que se ven (la web tiene más de un <main>: el de entrar, escondido).
    fuera: for (const main of document.querySelectorAll('main, #view')) {
      if (!visible(main)) continue;
      for (const h of main.querySelectorAll('p, li, a, button, label, .card, form, table')) {
        if (!visible(h)) continue;
        const r = h.getBoundingClientRect();
        if (r.width > 1400 && (h.innerText || '').trim().length > 15) { avisos.push(`a todo lo ancho (${Math.round(r.width)} px): ${nombre(h)}`); break fuera; }
      }
    }
  }
  return [...new Set(avisos)];
};

// ── La sesión de mentira (una dueña de un bar; admin para /admin) ──────────
const U = '0e7717e0-0000-4000-8000-0000000ab1e7';
const BIZ = NEGOCIOS[0].id;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2', amr: [{ method: 'password', timestamp: 1 }] })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'tablet@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Ana' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ahora = Date.now();
const iso = (h) => new Date(ahora + h * 3600e3).toISOString();
const pub = (n, titulo, extra = {}) => ({
  id: `0ff00000-0000-4000-8000-00000000ab1${n}`, business_id: BIZ, title: titulo, kind: 'flash_offer', status: 'active', panel_state: 'activa',
  redeem_start_at: iso(-1), redeem_end_at: iso(4), views: 120, redemptions_count: 4, audience: 'all', price_cents: 250, moderation_status: 'approved', ...extra,
});
const PUBS = [
  pub(1, 'Café + tostada'),
  pub(2, 'Concierto acústico en la terraza', { kind: 'future_event', event_at: iso(5), event_end_at: iso(7), reservations_enabled: true, max_redemptions: 40, seats_taken: 22 }),
  pub(3, '2x1 en cañas de 19 a 21', { panel_state: 'programada', redeem_start_at: iso(20), redeem_end_at: iso(24) }),
];
const R = {
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_profile: { id: U, display_name: 'Ana', email: USER.email },
  my_businesses: [{ id: BIZ, name: NEGOCIOS[0].name, role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  my_subscription: {
    plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: '2027-01-01T00:00:00Z',
    payment_method: 'transfer', price_cents: 1990, active_offers: 2, max_active_offers: null, has_analytics: true,
    billing: { enabled: true, blocked: false, hold: null, block_soon: false, entity: false, block_kind: null },
  },
  business_tools_overview: {
    ok: true, can_edit: true, features: {}, team: { members: 3 }, promoters: { active: 1 }, series: { rules_active: 1, active: 1 },
    reviews: { unanswered: 1 }, questions: { unanswered: 2 }, daily_menu: { suggested: true }, before_closing: { suggested: true },
    broadcasts: { suggested: true, upcoming: 2 }, tv: { screens: 1 }, menu: { items: 12 }, links: { count: 2 }, stamps: { active: 1 },
    queue: { open: false, used_30d: true }, capacity: { enabled: false }, crowd: { enabled: true }, groups: { enabled: true, pending: 1 },
    table_qr: { has: true, wifi: true }, orders: { enabled: false }, preorders: { enabled: false },
  },
  my_business_offer_counts: { todas: 3, activa: 2, programada: 1, total: 3, publicadas: 3 },
  my_business_offers_page: PUBS,
  business_crowd_status: { enabled: true, open_now: true, level: null },
  business_venue_demand: { people: 0 },
  business_today: {
    validated: 7, views: 85, today: PUBS.slice(0, 2), next: [PUBS[2]],
    recent: [{ at: iso(-0.2), title: 'Café + tostada', seats: 1, kind: 'offer', code: 'ABC123', ticket_cents: 1250 }],
  },
  business_terms_notice: null, business_closure_state: null, business_recent_validations: [],
  my_offer_rules: [], my_publishable_businesses: [], my_stamp_cards: [], my_redemptions: [],
  business_loyalty: { ok: true, can_edit: true, coupon: {}, thanks: {} },
  is_admin: true,
  admin_mfa_status: { required: false, enrolled: true },
};
const ADMIN = estadoInicial();
async function conSesion(ctx) {
  // La de la web y la del admin (que guarda la suya aparte).
  await ctx.addInitScript(([k, ka, v]) => { try { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(ka, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, `sb-${REF}-admin-auth-token`, SESION]);
  await ctx.route(`${SUPA}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/token')) return json(JSON.parse(SESION));
    if (p.startsWith('/auth/v1/factors')) return json([]);
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn in R) return json(R[fn]);
      // El admin, con la bandeja de mentira de bandeja_check (un caso de cada tipo).
      if (fn.startsWith('admin_')) {
        let cuerpo = {};
        try { cuerpo = route.request().postDataJSON() || {}; } catch { /* sin cuerpo */ }
        return json(contesta(fn, cuerpo, ADMIN));
      }
    }
    return route.fallback();
  });
}

const web = await webConDatos({ puerto: Number(process.env.PORT || 9371) });
const nav = await chromium.launch();
let total = 0;
let vistas = 0;
const t0 = Date.now();
try {
  for (const [tn, w, h] of TAMANOS) {
    if (RAPIDO && !RAPIDOS.has(tn)) continue;
    for (const tema of RAPIDO ? ['light'] : ['light', 'dark']) {
      for (const sesion of [false, true]) {
        const rutas = RUTAS.filter(([r, z]) => Boolean(z) === sesion && (!solo.length || solo.some((s) => r.startsWith(s))));
        if (!rutas.length) continue;
        const ctx = await nav.newContext({ viewport: { width: w, height: h }, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: w <= 1366, isMobile: w < 400 });
        await web.conDatos(ctx);
        if (sesion) await conSesion(ctx);
        const p = await ctx.newPage();
        const errores = [];
        p.on('pageerror', (e) => errores.push(e.message));
        // La CSP (§4zzz-csp) también a estos tamaños: lo que se carga distinto en tablet (el mapa, el panel con menú) no se bloquea.
        p.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to (execute|load|apply)/i.test(m.text())) errores.push(`CSP: ${m.text().slice(0, 160)}`); });
        for (const [ruta, zona] of rutas) {
          errores.length = 0;
          await p.goto(web.BASE + ruta, { waitUntil: 'networkidle' }).catch(() => {});
          if (zona === 'panel' || zona === 'admin') await p.waitForSelector('#view h1, main h1', { timeout: 10000 }).catch(() => {});
          await p.waitForTimeout(zona ? 700 : 300);
          vistas += 1;
          const avisos = [...(await p.evaluate(mira)), ...(await p.evaluate(miraAncho)), ...errores.map((e) => `error de JS: ${e}`)]
            .filter((a) => !permitido(ruta, tn, a));
          const fichero = `${(ruta.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'portada').slice(0, 40)}-${tn}-${tema === 'light' ? 'claro' : 'oscuro'}.png`;
          if (!RAPIDO) await p.screenshot({ path: `${OUT}/${fichero}` }).catch(() => {});
          if (avisos.length) {
            total += avisos.length;
            console.log(`\n${ruta} · ${tn} · ${tema}`);
            for (const a of avisos) console.log(`  ${a}`);
          }
        }
        await ctx.close();
      }
    }
  }
} finally {
  await nav.close();
  await web.cierra();
}
console.log(`\n${vistas} páginas en ${Math.round((Date.now() - t0) / 1000)} s.`);
console.log(total ? `${total} avisos.` : 'tablet: todo bien.');
process.exit(total ? 1 : 0);
