// Datos de mentira de la bandeja del admin (Resumen › «Pendiente de ti»): un caso de cada tipo, como
// los devolvería la base, y lo que contesta cada función al decidir. Lo usan
// tools/bandeja_check.mjs (Playwright, con Supabase simulado) y tools/bandeja_demo.mjs (para verla en
// el navegador sin tocar ninguna base). Nombres, correos y NIF inventados (example.com).

const id = (n) => `0ba0de1a-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const IDS = {
  admin: id(1), negocioListo: id(10), negocioListo2: id(11), negocioNo: id(12), entidad: id(20), reclamacion: id(30),
  denunciaGrave: id(40), denunciaNada: id(41), oferta: id(50), texto: id(60), mensaje: id(70), medio: id(80), contenido: id(81),
  dupA: id(90), dupB: id(91), cambio: id(100), baja: id(110), sugerencia: id(120), festivo: id(130), avisoIA: id(140),
};
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();

export function estadoInicial() {
  return {
    rpc: [],
    negocios: [
      { id: IDS.negocioListo, name: 'Taberna La Esquina', city: 'Málaga', address: 'Calle Granada 12', created_at: hace(95), category: 'Bares', category_en: 'Bars',
        owner_email: 'esquina@example.com', has_tax_id: true, has_logo: true, offers: 1, rules: 0, auto_failed: [], auto_checked_at: hace(60) },
      { id: IDS.negocioListo2, name: 'Peluquería Sol', city: 'Málaga', address: 'Calle Larios 3', created_at: hace(80), category: 'Peluquerías', category_en: 'Hairdressers',
        owner_email: 'sol@example.com', has_tax_id: true, has_logo: false, offers: 0, rules: 1, auto_failed: [], auto_checked_at: hace(50) },
      { id: IDS.negocioNo, name: 'Burguer Kin Sondas', city: 'Marbella', address: 'Av. del Mar 1', created_at: hace(40), category: 'Restaurantes', category_en: 'Restaurants',
        owner_email: 'bk@example.com', has_tax_id: false, has_logo: false, offers: 0, rules: 0, auto_failed: ['tax_id', 'brand'], auto_checked_at: hace(10) },
    ],
    entidades: [
      { id: IDS.entidad, status: 'pending', kind: 'neighbours', origin: 'signup', official_name: 'Asociación Vecinal El Palo', tax_id: 'G29123450', website: 'https://elpalo.example.com',
        business_id: id(21), business_name: 'AV El Palo', business_city: 'Málaga', user_email: 'palo@example.com', created_at: hace(300), proof_path: `${id(22)}/estatutos.pdf`,
        auto_failed: ['document_only'], auto_checked_at: hace(200), doc_check: { verdict: 'coincide', motive: 'ok', state: 'done' } },
    ],
    reclamaciones: [
      { id: IDS.reclamacion, status: 'pending', created_at: hace(2000), role_title: 'Dueña', contact_email: 'duena@example.com', business_id: id(31), business_name: 'Café Central',
        business_phone: '+34 600 000 001', business_email: 'info@example.com', user_id: id(32), user_email: 'duena@example.com', owner_email: 'antiguo@example.com',
        proved_at: hace(1500), proved_via: 'code_email', auto_failed: ['owner_active'], doc_check: { verdict: 'no_coincide', motive: 'nif_distinto', state: 'done' }, proof_path: `${id(32)}/doc.pdf` },
    ],
    denuncias: [
      { target_type: 'offer', target_id: IDS.denunciaGrave, n: 2, open_count: 2, total_count: 2, people: 2, last_at: hace(30), state: 'published', live: true,
        target: { title: 'Fiesta de fin de semana', business: 'Pub Nocturno', business_id: id(42) }, reasons: [{ reason: 'illegal', n: 2 }],
        ai: { verdict: 'dudoso', norm: 'none', confidence: 0.55, reason: 'Habla de una fiesta; la denuncia dice que venden alcohol a menores.', action: 'to_admin', why: 'opinion', decided_at: hace(20) } },
      { target_type: 'review', target_id: IDS.denunciaNada, n: 1, open_count: 1, total_count: 1, people: 1, last_at: hace(400), state: 'published', live: true,
        target: { title: '«El servicio fue lento»', business: 'Bar Pepe', business_id: id(43) }, reasons: [{ reason: 'inappropriate', n: 1 }],
        ai: { verdict: 'nada', norm: 'none', confidence: 0.92, reason: 'Es una opinión sobre el servicio, sin insultos.', action: 'to_admin', why: 'opinion', decided_at: hace(380) } },
    ],
    medios: [
      { id: IDS.medio, kind: 'photo', name: `${id(82)}/foto.jpg`, in_held: true, hold_reason: 'doubt', labels: { racy: 'POSSIBLE' }, business: 'Gimnasio Fuerte', business_id: id(83), city: 'Málaga',
        user_email: 'gym@example.com', created_at: hace(120), used_in: ['Novedad'], frames: [] },
    ],
    contenidos: [
      { id: IDS.contenido, kind: 'post', text: 'Ven a probar nuestras cañas a 1 € esta noche', grave: false, motive: 'ambiguous', decided_by: 'ai', provider: 'simulado', reason: 'No está claro si anima a beber.',
        business: 'Bar Pepe', business_id: id(43), city: 'Málaga', user_email: 'pepe@example.com', created_at: hace(200) },
    ],
    ofertas: [
      { id: IDS.oferta, title: '2x1 en tapas', kind: 'flash_offer', business_name: 'Taberna La Esquina', business_id: IDS.negocioListo, verification_status: 'pending', moderation_status: 'pending',
        moderation_flags: [], created_at: hace(90), images: [] },
    ],
    textos: [
      { id: IDS.texto, kind: 'review', business: 'Bar Pepe', business_id: id(43), text: 'Un sitio de mierda, no volváis', categories: ['profanity'], flags: ['offensive'],
        user_email: 'cliente@example.com', created_at: hace(600), rating: 1 },
    ],
    mensajes: [
      { id: IDS.mensaje, title: 'Noche de póker', body: 'Este viernes, torneo de póker con premios', status: 'review', moderation_flags: ['gambling'], business_name: 'Bar Pepe', business_id: id(43),
        city: 'Málaga', author_email: 'pepe@example.com', created_at: hace(700), recipients: 0 },
    ],
    duplicados: [
      { id: IDS.dupA, name: 'Mesón Andaluz', city: 'Málaga', verification_status: 'pending', created_at: hace(1000), pending: true,
        candidates: [{ id: IDS.dupB, name: 'Mesón Andaluz S.L.', city: 'Málaga', verification_status: 'verified', reason: 'same_name_city', safe: true }] },
    ],
    cambios: [
      { id: IDS.cambio, business_id: id(101), business_name: 'Heladería Polo', reasons: ['name'], before: { name: 'Heladería Polo' }, after: { name: 'Polo Helados & Café' }, updated_at: hace(3000) },
    ],
    bajas: [
      { id: IDS.baja, business_id: id(111), business_name: 'Floristería Rosa', requested_at: hace(5000), effective_on: '2026-12-01', reason: 'Cierro el local', live: true },
    ],
    sugerencias: [
      { id: IDS.sugerencia, kind: 'idea', message: 'Estaría bien poder filtrar por terraza', user_email: 'idea@example.com', platform: 'ios', app_version: '0.1.7', created_at: hace(4000) },
    ],
    avisosIA: [
      { id: IDS.avisoIA, use_key: 'help_assistant', reason: 'wrong', note: 'Dice que se paga por canjear', response: 'Para canjear una oferta hay que pagar una comisión.',
        lang: 'es', platform: 'android', status: 'new', user_email: 'aviso@example.com', from_same_user: 1, created_at: hace(3000) },
    ],
    festivos: [
      { code: '29084', slug: 'ronda', name: 'Ronda', province: 'Málaga', region: 'AN', city_id: null, klendar_city: false, key: '29084', businesses: 1, last_verified: hace(15),
        confirmed: 0, proposed: 0, ok: false, days: [], bulletin: { name: 'BOJA', url: 'https://www.juntadeandalucia.es/eboja.html' }, year: new Date().getFullYear() },
    ],
    modos: {
      verify_business: { enabled: true, mode: 'suggest' }, verify_entity: { enabled: true, mode: 'suggest', by_document: false },
      report_review: { enabled: true, mode: 'opine' }, document_review: { enabled: true }, claim_code: { enabled: true },
    },
  };
}

const quita = (lista, f) => { const i = lista.findIndex(f); if (i >= 0) lista.splice(i, 1); return i >= 0; };

/** Lo que contesta la base simulada a `fn` con `b` (el cuerpo). null: no la conoce. */
export function contesta(fn, b, e) {
  e.rpc.push({ fn, cuerpo: b });
  switch (fn) {
    case 'admin_kpis': return { businesses_pending: e.negocios.length, reports_open: e.denuncias.reduce((a, g) => a + g.open_count, 0), offers_pending: e.ofertas.length, series: [], push_failed_7d: 0 };
    case 'admin_attention': return { pending: { media_held: e.medios.length, content_held: e.contenidos.length, subs_past_due: 1 }, tasks: { crons: [], agenda: [], leagues: [], billing: {} }, urgent: [], alerts: { config: { email: true } }, media_filter: { enabled: true }, free_tier_cfg: { warn_pct: 80 }, free_tier: [] };
    case 'admin_inbox_extra': return { modes: e.modos, holidays: e.festivos, checked_at: new Date().toISOString() };
    case 'admin_pending_now': return { total: e.negocios.length, rows: e.negocios };
    case 'admin_entity_applications': return { counts: { pending: e.entidades.length }, items: e.entidades };
    case 'admin_business_claims': return { counts: { pending: e.reclamaciones.length }, items: e.reclamaciones };
    case 'admin_report_groups': return { total: e.denuncias.length, hot: 0, rows: e.denuncias };
    case 'admin_media_queue': return { counts: { held: e.medios.length }, rows: e.medios, config: { enabled: true, used: 3, cap: 1000 } };
    case 'admin_content_queue': return { counts: { held: e.contenidos.length }, rows: e.contenidos };
    case 'admin_offers_page': return { total: e.ofertas.length, rows: e.ofertas };
    case 'admin_text_reviews': return { total: e.textos.length, rows: e.textos };
    case 'admin_business_messages': return { total: e.mensajes.length, pending: e.mensajes.length, items: e.mensajes };
    case 'admin_duplicate_alerts': return e.duplicados;
    case 'admin_business_changes': return { open: e.cambios.length, rows: e.cambios };
    case 'admin_subscription_cancellations': return { pending: e.bajas.length, items: e.bajas };
    case 'admin_suspension_pauses': return [];
    case 'admin_feedback': return { total: e.sugerencias.length, counts: { new: e.sugerencias.length }, rows: e.sugerencias };
    case 'admin_ai_reports': return { total: e.avisosIA.length, rows: e.avisosIA };
    case 'admin_ai_report_seen': quita(e.avisosIA, (x) => x.id === b.p_id); return null;
    case 'admin_web_errors': return { counts: { new_24h: 0, open: 0 }, rows: [] };
    case 'admin_holiday_alert': return null;
    case 'admin_pulso': return null;
    case 'admin_piloto_overview': return { config: { verify_business: { enabled: true, mode: 'suggest' }, report_review: { enabled: true, mode: 'opine' } }, ai: {}, week: { total: 0, by_kind: {} }, month: {}, actions: [], lists: { brand: 0, official_domain: 0 } };
    // Las decisiones.
    case 'admin_set_verification': quita(e.negocios, (x) => x.id === b.p_id); return null;
    case 'admin_approve_ready': {
      const approved = [];
      const skipped = [];
      for (const x of b.p_businesses || []) {
        if (x === IDS.negocioListo2) { skipped.push({ kind: 'business', id: x, failed: ['brand'] }); continue; }
        quita(e.negocios, (y) => y.id === x);
        approved.push({ kind: 'business', id: x });
      }
      for (const x of b.p_entities || []) { quita(e.entidades, (y) => y.id === x); approved.push({ kind: 'entity', id: x }); }
      const n2 = e.negocios.find((y) => y.id === IDS.negocioListo2);
      if (n2) n2.auto_failed = ['brand'];
      return { ok: true, approved, skipped };
    }
    case 'admin_resolve_entity_application': quita(e.entidades, (x) => x.id === b.p_id); return null;
    case 'admin_resolve_business_claim': quita(e.reclamaciones, (x) => x.id === b.p_id); return null;
    case 'admin_resolve_report_group': quita(e.denuncias, (x) => x.target_id === b.p_id); return { ok: true, reports: 1 };
    case 'admin_media_decide': quita(e.medios, (x) => x.id === b.p_id); return { ok: true };
    case 'admin_content_decide': quita(e.contenidos, (x) => x.id === b.p_id); return { ok: true };
    case 'admin_set_offer_moderation': quita(e.ofertas, (x) => x.id === b.p_id); return null;
    case 'admin_review_text': quita(e.textos, (x) => x.id === b.p_id); return { ok: true };
    case 'admin_review_business_message': quita(e.mensajes, (x) => x.id === b.p_id); return { ok: true, recipients: 12 };
    case 'admin_dismiss_duplicate': quita(e.duplicados, (x) => x.id === b.p_a); return null;
    case 'admin_review_business_change': quita(e.cambios, (x) => x.id === b.p_id); return null;
    case 'admin_handle_cancellation': quita(e.bajas, (x) => x.id === b.p_id); return null;
    case 'admin_save_city_holidays': {
      const h = e.festivos.find((x) => x.key === b.p_city);
      if (h) {
        h.days = (b.p_days || []).map((d, i) => ({ id: id(140 + i), day: d.day, name: d.name, status: 'confirmed' }));
        h.confirmed = h.days.length;
        if (h.confirmed >= 2) quita(e.festivos, (x) => x.key === b.p_city);
      }
      return { ok: true, saved: (b.p_days || []).length };
    }
    case 'admin_piloto_mode': return { ok: true };
    default: return null;
  }
}
