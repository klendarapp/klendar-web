// La sesión y las respuestas de mentira del panel (una dueña de un bar; con
// `papel`: owner, manager, staff o entidad), para tools/panel_capturas.mjs y
// tools/coherencia_check.mjs (RUNBOOK §4zzz-coherencia1). Lo que no está aquí
// lo contesta el Supabase falso de _web_con_datos (vacío). No toca dev ni prod.
//
//   await web.conDatos(ctx); await conSesion(ctx, rpcs('owner', { reservas: false }));
import { REF, SUPA } from './_supabase_simulado.mjs';
import { NEGOCIOS } from './_web_con_datos.mjs';

const U = '0e7717e0-0000-4000-8000-0000000c0e11';
const BIZ = NEGOCIOS[0].id;
const BIZ2 = NEGOCIOS[1].id;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2', amr: [{ method: 'password', timestamp: 1 }] })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'capturas@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Ana' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ahora = Date.now();
const iso = (h) => new Date(ahora + h * 3600e3).toISOString();
const pub = (n, titulo, extra = {}) => ({
  id: `0ff00000-0000-4000-8000-00000000c0e${n}`, business_id: BIZ, title: titulo, kind: 'flash_offer', status: 'active', panel_state: 'activa',
  redeem_start_at: iso(-1), redeem_end_at: iso(4), views: 120, redemptions_count: 4, audience: 'all', price_cents: 250, moderation_status: 'approved', ...extra,
});
export const PUBS = [
  pub(1, 'Café + tostada'),
  pub(2, 'Concierto acústico en la terraza', { kind: 'future_event', event_at: iso(5), event_end_at: iso(7), reservations_enabled: true, max_redemptions: 40, seats_taken: 22 }),
  pub(3, '2x1 en cañas de 19 a 21', { panel_state: 'programada', redeem_start_at: iso(20), redeem_end_at: iso(24) }),
  pub(4, 'Menú del día con postre casero', { kind: 'daily_menu', price_cents: 1250 }),
];
const TOOLS = {
  ok: true, features: {}, team: { members: 3 }, promoters: { active: 1 }, series: { rules_active: 1, active: 1 },
  reviews: { unanswered: 1 }, questions: { unanswered: 2 }, daily_menu: { suggested: true }, before_closing: { suggested: true },
  broadcasts: { suggested: true, upcoming: 2 }, tv: { screens: 1 }, menu: { items: 12 }, links: { count: 2 }, stamps: { active: 1 },
  queue: { open: false, used_30d: true }, capacity: { enabled: false }, crowd: { enabled: true }, groups: { enabled: true, pending: 1 },
  table_qr: { has: true, wifi: true }, orders: { enabled: false }, preorders: { enabled: false },
};
/** [reservas]: con reservas hoy (tres cifras en Hoy) o sin ellas (dos). */
export function rpcs(papel = 'owner', { reservas = true } = {}) {
  const rol = papel === 'entidad' ? 'owner' : papel;
  const entidad = papel === 'entidad';
  return {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_profile: { id: U, display_name: 'Ana', email: USER.email },
    my_businesses: [
      { id: BIZ, name: entidad ? 'Ayuntamiento de Prueba' : 'Bar Sonda', role: rol, verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' },
      { id: BIZ2, name: 'Otro Local', role: 'manager', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' },
    ],
    business_is_organizer: false,
    my_entity_application: entidad ? { entity_kind: 'municipality', can_apply: false, why: null, application: null } : { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: {
      plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: '2027-01-01T00:00:00Z',
      payment_method: 'transfer', price_cents: 1990, active_offers: 2, max_active_offers: null, has_analytics: true,
      billing: { enabled: true, blocked: false, hold: null, block_soon: false, entity: entidad, block_kind: null },
    },
    business_tools_overview: { ...TOOLS, can_edit: rol !== 'staff' },
    my_business_offer_counts: { todas: 4, activa: 3, programada: 1, total: 4, publicadas: 4 },
    my_business_offers_page: PUBS,
    business_crowd_status: { enabled: true, open_now: true, level: null },
    business_venue_demand: { people: 0 },
    business_today: {
      validated: 7, views: 85, today: reservas ? PUBS.slice(0, 2) : [PUBS[0], PUBS[3]], next: entidad ? [PUBS[1]] : [PUBS[2]],
      recent: [{ at: iso(-0.2), title: 'Café + tostada', seats: 1, kind: 'offer', code: 'ABC123', ...(rol === 'staff' ? {} : { ticket_cents: 1250 }) },
        { at: iso(-1.4), title: 'Concierto acústico en la terraza', seats: 2, kind: 'event', code: 'XYZ789' }],
    },
    business_terms_notice: null, business_closure_state: null,
    business_recent_validations: [
      { at: iso(-0.2), title: 'Café + tostada', kind: 'offer', code: 'ABC123', seats: 1, person: 'Lucía M.', ticket_until: iso(20), ...(rol === 'staff' ? {} : { ticket_cents: 1250 }) },
      { at: iso(-1.4), title: 'Concierto acústico en la terraza', kind: 'event', code: 'XYZ789', seats: 2, person: 'Marcos R.', ticket_until: iso(19) },
    ],
    my_offer_rules: [], my_publishable_businesses: [], assistant_status: { available: false }, my_stamp_cards: [], my_redemptions: [],
    business_loyalty: { ok: true, can_edit: rol !== 'staff', coupon: {}, thanks: {} },
  };
}
export async function conSesion(ctx, R) {
  await ctx.addInitScript(([k, v]) => { try { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, SESION]);
  await ctx.route(`${SUPA}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/token')) return json(JSON.parse(SESION));
    if (p.startsWith('/auth/v1/factors')) return json([]);
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn in R) return json(R[fn]);
    }
    return route.fallback();
  });
}

