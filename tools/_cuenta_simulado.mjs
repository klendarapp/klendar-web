// La sesión y las respuestas de mentira de «Tu cuenta» (una persona con planes,
// códigos, favoritos, avisos y encargos), para tools/web_capturas.mjs y
// tools/coherencia_check.mjs (RUNBOOK §4zzz-coherencia2). Va encima del
// Supabase falso de _web_con_datos (lo público: ofertas, negocios…): lo que no
// está aquí lo contesta él. No toca dev ni prod.
//
//   await web.conDatos(ctx); await conSesionCuenta(ctx);
//   (sin sesión: no llames a conSesionCuenta; «Tu cuenta» enseña entrar)
import { REF, SUPA } from './_supabase_simulado.mjs';
import { NEGOCIOS, PLANES, CATEGORIAS } from './_web_con_datos.mjs';

const U = '0e7717e0-0000-4000-8000-0000000c0e22';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1', amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] })}.firma`;
const USER = {
  id: U, aud: 'authenticated', role: 'authenticated', email: 'capturas@example.com', app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { display_name: 'Lucía' }, identities: [{ id: 'i', provider: 'email' }], created_at: '2026-01-01T00:00:00Z',
};
const SESION = JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ahora = Date.now();
const iso = (h) => new Date(ahora + h * 3600e3).toISOString();
const neg = (i) => NEGOCIOS[i % NEGOCIOS.length];
const oferta = PLANES.filter((o) => o.kind === 'flash_offer');
const eventos = PLANES.filter((o) => o.kind === 'future_event' && !o.imported);

const canje = (n, o, extra = {}) => ({
  id: `0c000000-0000-4000-8000-00000000c0${n}`, offer_id: o.id, offer_title: o.title, business_id: o.business_id, business_name: o.business_name,
  business_logo: null, category_id: o.category_id, kind: o.kind, status: 'pending', code: `K${n}AB${n}C`, created_at: iso(-0.3), expires_at: iso(0.5),
  event_at: o.event_at || null, seats: 1, time_zone: 'Europe/Madrid', ...extra,
});

export const RESPUESTAS = {
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, marketing: false, analytics: false },
  my_profile: { id: U, display_name: 'Lucía', email: USER.email },
  my_auth_methods: { has_password: true, providers: ['email'] },
  my_businesses: [], my_team_invites: [], my_business_transfers: [], my_promoter_invites: [], my_promoter_roles: [],
  my_tastes: { asked: true, categories: ['bar', 'music'], cities: ['malaga'] },
  my_saved_offers: (a) => (a.p_when === 'upcoming' ? eventos.slice(0, 3) : []),
  my_redemptions: [
    canje(1, oferta[0]),
    canje(2, eventos[0], { seats: 2, expires_at: iso(30) }),
    canje(3, oferta[1], { status: 'validated', validated_at: iso(-50), created_at: iso(-50.2) }),
    canje(4, oferta[2], { status: 'expired', created_at: iso(-120), expires_at: iso(-119) }),
  ],
  my_followed_series: [], my_queue_turns: [], my_orders: [], my_stamp_rewards: [], my_spot_gifts: [], my_birthday_gifts: [], my_loyalty_gifts: [], my_passes: [],
  my_stamp_cards: [{ id: 'c1000000-0000-4000-8000-0000000c0e01', business_id: neg(0).id, business_name: neg(0).name, name: 'Cafés', goal: 10, card_goal: 10, reward: 'Un café', stamps: 4, is_active: true, applies_to: 'all' }],
  my_favorites: () => [0, 1, 2].map((i) => ({ id: neg(i).id, name: neg(i).name, logo: null, category_id: neg(i).category_id, city: neg(i).city, distance_m: 400 + i * 900, active_flash: i === 0 ? 1 : 0, upcoming_events: i })),
  favorites_feed: eventos.slice(1, 3),
  public_organizers: [],
  my_notification_preferences: {
    push_enabled: true, email_enabled: true, nearby_enabled: true, favorites_enabled: true, reminders_enabled: true, alerts_enabled: true,
    quiet_start: '23:00', quiet_end: '08:00', max_per_day: 5, nearby_km: 2,
  },
  my_offer_alerts: [{ id: 'a1e00000-0000-4000-8000-0000000c0e01', label: 'Cañas cerca', categories: [CATEGORIAS[0].id], lat: 36.72, lng: -4.42, place_label: 'Málaga centro', radius_m: 1500, kind: 'flash_offer', active: true, created_at: iso(-200) }],
  my_alert_words: [{ id: 'w1', word: 'flamenco' }, { id: 'w2', word: 'jazz' }],
  my_translation_settings: { translate_content: false },
  my_preorders: [{ id: 'e0000000-0000-4000-8000-0000000c0e01', business_id: neg(3).id, business_name: neg(3).name, status: 'pending', item_name: 'Tarta de queso', quantity: 1, pickup_day: new Date(ahora + 864e5).toISOString().slice(0, 10), slot_start: '13:00', slot_end: '13:30', total_cents: 1850,
    items: [{ name: 'Tarta de queso', qty: 1, price_cents: 1850 }], created_at: iso(-2) }],
  my_venue_requests: [{ id: 'f0000000-0000-4000-8000-0000000c0e01', name: 'Librería La Esquina', place: 'Málaga', address: 'Calle Larios 3', status: 'waiting', people: 4, created_at: iso(-300) }],
  my_city_waitlist: [],
  my_savings: { total_cents: 2350, count: 3, by_month: [] },
  my_blocks: [], my_waitlist_status: [], ai_consent_status: { granted: false }, review_ai_notice: null,
  photo_fill_status: { available: false }, link_fill_status: { available: false }, ai_help_status: { available: false },
  my_nearby_location: null, my_contact: { phone: null, email: USER.email },
};
const TABLAS = {
  profiles: [{ id: U, display_name: 'Lucía', locale: 'es', birth_date: null, avatar_url: null, phone: null, marketing_consent: false, analytics_consent: false, share_plans: false }],
  notifications: [
    { id: 'n1', user_id: U, kind: 'flash_nearby', title: 'Cañas 2x1 a 300 m', body: 'En Bar Sonda, hasta las 21:00.', created_at: iso(-0.5), read_at: null, data: { offer_id: oferta[0].id } },
    { id: 'n2', user_id: U, kind: 'reminder', title: 'Mañana: Monólogos', body: 'Lo guardaste en tus planes.', created_at: iso(-20), read_at: iso(-19), data: {} },
  ],
  categories: CATEGORIAS,
};

export async function conSesionCuenta(ctx, extra = {}) {
  const R = { ...RESPUESTAS, ...extra };
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, SESION]);
  await ctx.route(`${SUPA}/**`, async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/token')) return json(JSON.parse(SESION));
    if (p.startsWith('/auth/v1/factors')) return json([]);
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn in R) {
        let args = {};
        try { args = route.request().postDataJSON() || {}; } catch { /* */ }
        return json(typeof R[fn] === 'function' ? R[fn](args) : R[fn]);
      }
    }
    const t = p.startsWith('/rest/v1/') ? p.slice('/rest/v1/'.length) : '';
    if (t in TABLAS) {
      const uno = /vnd\.pgrst\.object/.test(route.request().headers().accept || '');
      return json(uno ? TABLAS[t][0] : TABLAS[t]);
    }
    return route.fallback();
  });
}
