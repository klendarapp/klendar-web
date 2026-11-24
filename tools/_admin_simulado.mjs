// La sesión y las respuestas de mentira del admin (una administradora con unos
// pocos negocios, publicaciones, canjes, usuarios…), para tools/admin_capturas.mjs
// y tools/coherencia_check.mjs (revisión de coherencia, parte 3; RUNBOOK
// §4zzz-coherencia3). Lo de «Pendiente de ti» es la bandeja de
// _bandeja_datos.mjs (un caso de cada tipo); lo que no está aquí lo contesta
// `VACIO` (una lista vacía con su forma) o el Supabase falso de _web_con_datos.
// No toca dev ni prod: nada sale de la página.
//
//   await web.conDatos(ctx); await conSesionAdmin(ctx);
//   PANTALLAS_ADMIN: [nombre, ruta] de cada pantalla (las del menú y tres fichas)
import { REF, SUPA } from './_supabase_simulado.mjs';
import { NEGOCIOS, CATEGORIAS } from './_web_con_datos.mjs';
import { estadoInicial, contesta } from './_bandeja_datos.mjs';

const U = '0e7717e0-0000-4000-8000-0000000ad315';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2', amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) }, { method: 'password', timestamp: Math.floor(Date.now() / 1000) }] })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admin.capturas@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Marta' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ahora = Date.now();
const iso = (h) => new Date(ahora + h * 3600e3).toISOString();
const id = (n) => `0ad00000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const NEGS = NEGOCIOS.slice(0, 5).map((n, i) => ({
  id: n.id, name: n.name, city: n.city || 'Málaga', category: ['Bares', 'Restaurantes', 'Peluquerías', 'Cafeterías', 'Librerías'][i], logo_url: null,
  owner_name: ['Ana Ruiz', 'Pedro Gil', 'Lola Sanz', 'Juan Mora', 'Carmen Vela'][i], owner_email: `dueno${i + 1}@example.com`,
  verification_status: ['verified', 'pending', 'verified', 'rejected', 'verified'][i], is_active: i !== 3, open_reports: i === 2 ? 1 : 0,
  plan_slug: i % 2 ? 'free' : 'standard', sub_status: i % 2 ? 'trial' : 'active', sub_period_end: iso(24 * (20 + i)),
  active_offers: 3 - (i % 3), offers_count: 6 + i, redemptions_count: 120 - i * 17, created_at: iso(-24 * (40 + i * 9)),
}));
const OFS = [
  ['Café + tostada', 'flash_offer'], ['Concierto acústico en la terraza', 'future_event'], ['2x1 en cañas de 19 a 21', 'flash_offer'],
  ['Taller de cerámica para principiantes', 'future_event'], ['Menú del día con postre casero', 'flash_offer'],
].map(([title, kind], i) => ({
  id: id(200 + i), title, kind, business_id: NEGS[i % NEGS.length].id, business_name: NEGS[i % NEGS.length].name, verification_status: 'verified', city: 'Málaga',
  status: 'active', moderation_status: i === 1 ? 'pending' : 'approved', images: [], redeem_start_at: iso(-1), redeem_end_at: iso(4), event_at: iso(30 + i), ends_at: iso(40),
  price_cents: kind === 'flash_offer' ? 250 + i * 100 : 1200, currency: 'EUR', discount: i === 2 ? { type: '2x1' } : null, views_count: 340 - i * 40, redemptions_count: 12 + i,
  max_redemptions: kind === 'future_event' ? 40 : null, created_at: iso(-30 - i), time_zone: 'Europe/Madrid',
}));
const USUARIOS = ['Lucía Martín', 'Marcos Romero', 'Elena Castro', 'Jorge Peña', 'Sara Ortiz'].map((n, i) => ({
  id: id(300 + i), display_name: n, email: `persona${i + 1}@example.com`, avatar_url: null, user_type: i === 1 ? 'business' : 'user', is_admin: false,
  is_premium: i === 2, banned_at: null, email_confirmed_at: i === 4 ? null : iso(-500), memberships: i === 1 ? 1 : 0, redemptions: 9 - i, created_at: iso(-24 * (10 + i * 7)), last_sign_in_at: iso(-3 - i * 20),
}));
const CANJES = OFS.slice(0, 4).map((o, i) => ({
  id: id(400 + i), offer_id: o.id, title: o.title, business_id: o.business_id, business: o.business_name, user_email: USUARIOS[i].email, code: `K${i}AB${i}C`,
  status: ['validated', 'pending', 'expired', 'validated'][i], created_at: iso(-2 - i * 5), validated_at: i % 3 === 0 ? iso(-1.8 - i * 5) : null, validated_by_email: i % 3 === 0 ? 'barra@example.com' : '',
}));
const AUDIT = [
  { id: id(500), created_at: iso(-0.5), admin_email: USER.email, action: 'set_verification', target_type: 'business', target_id: NEGS[0].id, details: { status: 'verified' } },
  { id: id(501), created_at: iso(-5), admin_email: USER.email, action: 'set_offer_moderation', target_type: 'offer', target_id: OFS[1].id, details: { status: 'approved' } },
];
const lista = (rows) => ({ total: rows.length, rows, items: rows, counts: {}, pending: 0 });

/** Lo que contesta el admin de mentira (lo que no esté, la bandeja o `VACIO`). */
export const RPC_ADMIN = {
  is_admin: true,
  // Sin la llamada de una vez: los números del menú, uno a uno (la bandeja).
  admin_badges: null,
  admin_config: {},
  admin_mfa_status: { required: true, enrolled: true },
  admin_businesses_page: lista(NEGS),
  admin_offers_page: lista(OFS),
  admin_redemptions: lista(CANJES),
  admin_users: lista(USUARIOS),
  admin_audit: lista(AUDIT),
  admin_reviews: lista([{ id: id(600), rating: 4, comment: 'Muy buen café y la tostada, de pan de verdad.', user_email: USUARIOS[0].email, business_id: NEGS[0].id, business_name: NEGS[0].name, created_at: iso(-20), media: [] },
    { id: id(601), rating: 2, comment: 'Tardaron mucho en atender.', user_email: USUARIOS[3].email, business_id: NEGS[1].id, business_name: NEGS[1].name, created_at: iso(-50), media: [] }]),
  admin_posts: lista([{ id: id(610), body: 'Esta semana, música en directo el jueves.', business_id: NEGS[0].id, business_name: NEGS[0].name, created_at: iso(-30), image_url: null }]),
  admin_admins: [{ user_id: U, email: USER.email, display_name: 'Marta', created_at: iso(-2000) }, { user_id: id(700), email: 'ivan.capturas@example.com', display_name: 'Iván', created_at: iso(-3000) }],
  admin_categories: CATEGORIAS.slice(0, 6).map((c, i) => ({ ...c, businesses: 10 - i, offers: 20 - i, sort_order: i })),
  admin_business_detail: (a) => {
    const b = NEGS.find((x) => x.id === a.p_id) || NEGS[0];
    return {
      business: { ...b, address: 'Calle Granada 12', phone: '+34 600 000 000', contact_email: 'hola@example.com', website: 'https://example.com', tax_id: 'B12345678',
        owner_id: USUARIOS[1].id, rating_avg: 4.4, rating_count: 18, verified_at: iso(-24 * 30), description: 'Bar de barrio con terraza y tapas caseras.', amenities: ['terrace', 'wifi', 'card'],
        opening_hours: { lunes: [['09:00', '23:00']], martes: [['09:00', '23:00']] }, social_links: { instagram: 'https://instagram.com/example' }, gallery: [], time_zone: 'Europe/Madrid', lat: 36.72, lng: -4.42 },
      stats: { views_30d: 1280, redemptions_30d: 64, favorites: 41 },
      subscriptions: [{ plan: 'standard', status: 'active', price_cents: 1990, period_start: iso(-24 * 10), period_end: iso(24 * 20), payment_method: 'transfer' }],
      members: [{ user_id: USUARIOS[1].id, display_name: 'Pedro Gil', email: USUARIOS[1].email, role: 'owner' }, { user_id: USUARIOS[3].id, display_name: 'Jorge Peña', email: USUARIOS[3].email, role: 'staff' }],
      payments: [{ paid_at: iso(-24 * 10), amount_cents: 1990, currency: 'EUR', method: 'transfer', period_start: iso(-24 * 10), period_end: iso(24 * 20), notes: 'Noviembre', recorded_by: USER.email }],
      offers: OFS.slice(0, 3), reviews: [{ id: id(600), rating: 4, comment: 'Muy buen café.', user_email: USUARIOS[0].email, created_at: iso(-20) }], posts: [], reports: [], audit: AUDIT,
    };
  },
  admin_offer_detail: (a) => {
    const o = OFS.find((x) => x.id === a.p_id) || OFS[0];
    return { offer: { ...o, description: 'Café de especialidad y tostada de pan de masa madre con tomate.', terms: 'Una por persona y día.', max_per_user: 1, updated_at: iso(-2), lat: 36.72, lng: -4.42, style: null, booking_questions: [] },
      redemptions: CANJES.slice(0, 2).map((c) => ({ ...c, user_email: c.user_email })), saved: 14, reports: [], audit: AUDIT,
      series: Array.from({ length: 14 }, (_, i) => ({ day: iso(-24 * (13 - i)).slice(0, 10), views: 20 + ((i * 7) % 15), redemptions: (i * 3) % 5 })) };
  },
  admin_user_detail: (a) => {
    const u = USUARIOS.find((x) => x.id === a.p_id) || USUARIOS[0];
    return { user: { ...u, locale: 'es', birth_date: '1990-04-12', terms_accepted_at: iso(-500), terms_version: '2026-11', marketing_consent: false, location_consent_at: iso(-400), last_location_at: iso(-5), providers: ['email'] },
      notification_prefs: { notify_nearby: true, notify_favorites: true, nearby_radius_m: 2000, quiet_hours_start: '23:00', quiet_hours_end: '08:00' },
      memberships: [], redemptions: CANJES.slice(0, 2), reviews: [], reports_made: [], favorites: [], saved: [], notifications: [], push_tokens: [], audit: [] };
  },
};
/** Una lista vacía «con todas las formas» (total/rows/items/counts): lo que no se conoce. */
export const VACIO = { total: 0, rows: [], items: [], counts: {}, pending: 0, open: 0 };

/** Las que devuelven una lista (un array), no un objeto: lo que no se conoce, `[]`. */
const LISTAS = /^admin_(stats_cities|collections|guides|broadcast_leagues|broadcasts|follow_items|broadcast_teams|broadcast_suggestions|artists|artist_duplicates|piloto_list|piloto_actions|rate_limits|push_queue|inactive_accounts|venue_requests|klendar_cities|city_waitlist|launch_free_provinces|giveaways|holidays|cities|plans|payments|guide_places)$/;

/** [nombre, ruta] de las pantallas del admin (en su host: admin.localhost). */
export const PANTALLAS_ADMIN = [
  ['resumen', '/'], ['semanas', '/semanas'], ['cifras', '/cifras'], ['ciudades', '/ciudades'],
  ['negocios', '/negocios'], ['negocio', `/negocios/${NEGS[0].id}`], ['reclamaciones', '/reclamaciones'], ['entidades', '/entidades'], ['duplicados', '/duplicados'],
  ['planes', '/planes'], ['condiciones', '/condiciones'], ['pedidos', '/pedidos'], ['crecer', '/crecer'],
  ['publicaciones', '/publicaciones'], ['publicacion', `/publicaciones/${OFS[0].id}`], ['canjes', '/canjes'], ['colecciones', '/colecciones'], ['guias', '/guias'],
  ['emisiones', '/emisiones'], ['artistas', '/artistas'], ['categorias', '/categorias'], ['festivos', '/festivos'],
  ['usuarios', '/usuarios'], ['usuario', `/usuarios/${USUARIOS[0].id}`], ['inactivas', '/inactivas'], ['avisos', '/avisos'], ['sugerencias', '/sugerencias'],
  ['denuncias', '/denuncias'], ['medios', '/medios'], ['sorteos', '/sorteos'], ['resenas', '/resenas'], ['mensajes', '/mensajes'],
  ['configuracion', '/configuracion'], ['errores', '/errores'], ['automatico', '/automatico'], ['traduccion', '/traduccion'],
  ['administradores', '/administradores'], ['actividad', '/actividad'], ['ayuda', '/ayuda'],
];

/** `{ entrar: true }`: sin sesión (la pantalla de entrar). */
export async function conSesionAdmin(ctx, { entrar = false, extra = {} } = {}) {
  const R = { ...RPC_ADMIN, ...extra };
  const bandeja = estadoInicial();
  await ctx.addInitScript(([k, v, sin]) => { try { localStorage.clear(); if (!sin) localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, SESION, entrar]);
  if (entrar) return;
  await ctx.route(`${SUPA}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/token')) return json(JSON.parse(SESION));
    if (p.startsWith('/auth/v1/factors')) return json([]);
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      let args = {};
      try { args = route.request().postDataJSON() || {}; } catch { /* sin cuerpo */ }
      if (fn in R) return json(typeof R[fn] === 'function' ? R[fn](args) : R[fn]);
      if (fn.startsWith('admin_')) {
        const r = contesta(fn, args, bandeja);
        return json(r ?? (LISTAS.test(fn) ? [] : VACIO));
      }
    }
    return route.fallback();
  });
}
