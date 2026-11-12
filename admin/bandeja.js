/* Administración → Resumen › «Pendiente de ti»: la bandeja (migración 20261279000000 de la app;
 * klendar/docs/PILOTO_AUTOMATICO.md y RUNBOOK §4zm).
 *
 * Una tarjeta por cada caso que espera una decisión, de cualquier tipo: qué es, lo que ha comprobado
 * la máquina o lo que opina la IA en una línea, y los botones para decidir allí mismo. Los botones
 * llaman a las mismas funciones que cada apartado (`verificarNegocio`, `aprobarReclamacion`,
 * `aprobarEntidad`, `decideDenuncias`, `decideTexto`, `moderateOffer`, `decideMensaje`,
 * `decideMedio`, `decideContenido`, `fusionar`, `festLocalesDialogo`…), con sus diálogos de motivo y
 * de confirmación: aquí no hay lógica de decidir propia. Al resolver una, la tarjeta se va y se
 * actualizan los números.
 *
 * Lo más urgente arriba (lo grave, las disputas, las tareas que fallan…), con filtro por tipo.
 * «Aprobar todos los que cuadran»: solo lo que el piloto ha dado por bueno en «Listos para aprobar»
 * (negocios y entidades), con la lista y una confirmación; la base lo vuelve a comprobar justo antes
 * (`admin_approve_ready`). Los apartados de siempre se quedan para buscar, el historial y los casos
 * raros: cada tarjeta lleva «Abrir en su apartado».
 *
 * Va después de admin.js, festivos.js, medios.js y piloto.js y usa lo suyo.
 */
'use strict';

const BANDEJA_FILTRO = 'klendar.admin.bandeja.filtro';

// Cada tipo: icono, nombre (para el filtro) y lo que pone encima de cada tarjeta.
const BANDEJA_TIPOS = {
  negocio: ['storefront', 'Negocios nuevos', 'New businesses', 'Negocio nuevo', 'New business'],
  entidad: ['account_balance', 'Entidades', 'Organisations', 'Entidad', 'Organisation'],
  reclamacion: ['how_to_reg', 'Reclamaciones', 'Claims', '«¿Es tu negocio?»', '“Is this your business?”'],
  denuncia: ['flag', 'Denuncias', 'Reports', 'Denuncia', 'Report'],
  filtro: ['imagesmode', 'Retenido por el filtro', 'Held by the filter', 'Retenido por el filtro', 'Held by the filter'],
  publicacion: ['bolt', 'Publicaciones', 'Publications', 'Publicación por moderar', 'Publication to moderate'],
  texto: ['chat_bubble', 'Reseñas y textos', 'Reviews and texts', 'Texto en revisión', 'Text under review'],
  mensaje: ['campaign', 'Mensajes a clientes', 'Customer messages', 'Mensaje a clientes', 'Customer message'],
  duplicado: ['content_copy', 'Duplicados', 'Duplicates', 'Posible duplicado', 'Possible duplicate'],
  festivo: ['event_busy', 'Festivos', 'Public holidays', 'Festivos', 'Public holidays'],
  ficha: ['published_with_changes', 'Cambios de ficha', 'Page changes', 'Revisar de nuevo', 'Review again'],
  cuenta: ['credit_card_off', 'Bajas y pausas', 'Cancellations and pauses', 'Cuenta', 'Account'],
  sistema: ['build', 'Sistema y cobros', 'System and payments', 'Sistema', 'System'],
  sugerencia: ['lightbulb', 'Sugerencias', 'Suggestions', 'Sugerencia', 'Suggestion'],
};

const bjEn = () => I18N.lang === 'en';
const bjT = (es, en) => (bjEn() ? en : es);
const bjCorta = (s, n = 220) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
/** La línea de la máquina: `cls` ok / warn / bad / dim. */
const bjLinea = (cls, texto) => ({ cls, texto });
const bjMotivos = (lista) => (lista || []).map((c) => (MOTIVO_AUTO[c] ? MOTIVO_AUTO[c][bjEn() ? 1 : 0] : c)).join(' · ');

/** Lo que ha comprobado el piloto de un negocio o una entidad («Listos para aprobar»). */
function bjComprobado(x, modo) {
  const comprobado = x.auto_checked_at != null || Array.isArray(x.auto_failed);
  if (comprobado && !(x.auto_failed || []).length) {
    return { listo: true, linea: bjLinea('ok', bjT('Todo cuadra ✔ · listo para aprobar', 'Everything checks out ✔ · ready to approve')) };
  }
  if (comprobado) return { listo: false, linea: bjLinea('warn', `${bjT('Por qué te llega', 'Why it came to you')}: ${bjMotivos(x.auto_failed)}`) };
  if (modo?.enabled) return { listo: false, linea: bjLinea('dim', bjT('El piloto aún no lo ha comprobado (lo hace a los pocos minutos del alta).', 'Not checked yet (it is checked a few minutes after sign-up).')) };
  return { listo: false, linea: null };
}

/** El resultado de leer un documento con la IA, en una línea. */
function bjDocumento(d) {
  if (!d) return null;
  if (d.state === 'pending') return bjLinea('dim', bjT('Leyendo el documento con la IA…', 'Reading the document with AI…'));
  const m = COD_DOC[d.motive] ? COD_DOC[d.motive][bjEn() ? 1 : 0] : (d.motive || '');
  if (d.verdict === 'coincide') return bjLinea('ok', bjT('El documento coincide ✔ (lo ha leído la IA; no decide nada)', 'The document matches ✔ (read by the AI; it decides nothing)'));
  if (d.verdict === 'no_coincide') return bjLinea('bad', `${bjT('El documento no coincide ✘', 'The document does not match ✘')}${m ? `: ${m}` : ''}`);
  return bjLinea('warn', `${bjT('Documento dudoso', 'Doubtful document')}${m ? `: ${m}` : ''}`);
}

const BJ_NORMA = {
  insults: ['insultos', 'insults'], hate: ['odio', 'hate'], threats: ['amenazas', 'threats'], sexual: ['contenido sexual', 'sexual content'],
  drugs: ['drogas', 'drugs'], weapons: ['armas', 'weapons'], violence: ['violencia', 'violence'], scam: ['estafa', 'scam'], spam: ['spam', 'spam'],
  privacy: ['datos de otra persona', 'someone else’s data'],
};
/** Lo que opina la IA de una denuncia, en una línea («solo opina»: no ha cerrado ni ocultado nada). */
function bjOpinion(ai, encendida) {
  if (!ai?.decided_at) {
    return encendida ? bjLinea('dim', bjT('La IA la leerá en unos minutos y te dirá lo que opina.', 'The AI will read it in a few minutes and give its opinion.')) : null;
  }
  if (ai.why === 'child_abuse_no_ai') return bjLinea('bad', bjT('Abuso sexual infantil: no se manda a ninguna IA. Míralo ya.', 'Child sexual abuse: never sent to any AI. Look at it now.'));
  if (ai.why === 'no_consent') return bjLinea('dim', bjT('La IA no la ha leído: quien lo publicó no ha dado permiso.', 'Not read by the AI: whoever published it has not given permission.'));
  if (!ai.verdict) return bjLinea('dim', bjT('La IA no ha podido leerla (caída o en el tope).', 'The AI could not read it (down or at its cap).'));
  const pct = ai.confidence != null ? ` · ${Math.round(Number(ai.confidence) * 100)} %` : '';
  const motivo = ai.reason ? `: ${bjCorta(ai.reason, 160)}` : '';
  const norma = BJ_NORMA[ai.norm] ? ` (${BJ_NORMA[ai.norm][bjEn() ? 1 : 0]})` : '';
  const q = {
    nada: ['ok', bjT('La IA cree que no pasa nada', 'The AI thinks there is nothing wrong')],
    ocultar: ['bad', bjT(`La IA cree que incumple las normas${norma}`, `The AI thinks it breaks the rules${norma}`)],
    dudoso: ['warn', bjT('La IA duda', 'The AI is unsure')],
    grave: ['bad', bjT('La IA cree que es grave', 'The AI thinks it is serious')],
  }[ai.verdict] || ['dim', ai.verdict];
  const hecho = ai.action === 'closed' ? bjT(' · cerrada sola', ' · closed automatically') : ai.action === 'hidden' ? bjT(' · ocultada sola', ' · hidden automatically') : '';
  return bjLinea(q[0], `${q[1]}${motivo}${pct}${hecho} · ${bjT('es una opinión: decides tú', 'it is an opinion: you decide')}`);
}

/** Pide todo lo pendiente a la vez (una sola rueda de carga: la del Resumen). */
async function cargaBandeja() {
  const ok = (p) => p.catch((e) => { if (e?.obsoleta) throw e; return null; });
  const [extra, pv, ents, recl, den, med, cont, ofs, txt, msj, dups, sug] = await Promise.all([
    ok(rpc('admin_inbox_extra')),
    ok(rpc('admin_pending_now', { p_limit: 100 })),
    ok(rpc('admin_entity_applications', { p_status: 'pending', p_limit: 100, p_offset: 0 })),
    ok(rpc('admin_business_claims', { p_status: 'pending', p_limit: 100, p_offset: 0 })),
    ok(rpc('admin_report_groups', { p_status: 'open', p_type: 'all', p_min_open: 1, p_limit: 100, p_offset: 0 })),
    ok(rpc('admin_media_queue', { p_tab: 'held', p_limit: 50, p_offset: 0 })),
    ok(rpc('admin_content_queue', { p_tab: 'held', p_limit: 50, p_offset: 0 })),
    ok(rpc('admin_offers_page', { p_moderation: 'pending', p_status: 'all', p_kind: 'all', p_query: null, p_business: null, p_limit: 50, p_offset: 0 })),
    ok(rpc('admin_text_reviews', { p_limit: 50, p_offset: 0 })),
    ok(rpc('admin_business_messages', { p_status: 'review', p_limit: 50, p_offset: 0 })),
    ok(rpc('admin_duplicate_alerts', { p_limit: 200 })),
    ok(rpc('admin_feedback', { p_status: 'new', p_kind: 'all', p_query: null, p_limit: 20, p_offset: 0 })),
  ]);
  // Las fotos retenidas se ven con un enlace firmado de 5 minutos (como en «Filtro automático»).
  const fotos = await Promise.all(((med?.rows) || []).map((x) => (x.kind === 'video' && x.frames?.length
    ? urlMedio(x.frames[0].name, x.frames[0].in_held) : urlMedio(x.name, x.in_held)).catch(() => '')));
  return { extra, pv, ents, recl, den, med, cont, ofs, txt, msj, dups, sug, fotos };
}

/** Las tarjetas, de todo lo pedido. `k`: admin_kpis; `ctx`: lo que el Resumen ya tiene (ATT, festivos…). */
function tarjetasBandeja(d, k, ctx) {
  const en = bjEn();
  const out = [];
  const modos = d.extra?.modes || {};
  const add = (c) => out.push({ urg: 2, acciones: [], lineas: [], ...c });

  // Negocios nuevos.
  for (const b of d.pv?.rows || []) {
    const c = bjComprobado(b, modos.verify_business);
    const datos = [
      b.has_tax_id ? (en ? 'Tax ID ✓' : 'NIF ✓') : (en ? 'no tax ID' : 'sin NIF'),
      b.has_logo ? 'logo ✓' : (en ? 'no logo' : 'sin logo'),
      b.rules ? (en ? `${b.rules} repeating offer(s) ready` : `${b.rules} ${b.rules === 1 ? 'oferta que se repite' : 'ofertas que se repiten'}`)
        : b.offers ? (en ? `${b.offers} publication(s)` : `${b.offers} ${b.offers === 1 ? 'publicación' : 'publicaciones'}`) : (en ? 'nothing published yet' : 'nada publicado aún'),
    ];
    add({
      key: `negocio:${b.id}`, tipo: 'negocio', at: b.review_requested_at || b.created_at, listo: c.listo, id: b.id, nombre: b.name,
      titulo: b.name,
      sub: [[(en ? b.category_en : b.category) || '', [b.address, b.city].filter(Boolean).join(', ')].filter(Boolean).join(' · '), [b.owner_email, datos.join(' · ')].filter(Boolean).join(' · ')],
      lineas: [c.linea].filter(Boolean),
      acciones: [
        { t: en ? 'Approve…' : 'Aprobar…', fn: () => verificarNegocio(b) },
        { t: en ? 'Reject…' : 'Rechazar…', cls: 'bad ghost', fn: () => rechazarNegocio(b) },
      ],
      abrir: `#/negocios/${b.id}`,
    });
  }
  if ((d.pv?.total || 0) > (d.pv?.rows || []).length) ctx.mas.push(['negocio', d.pv.total - d.pv.rows.length, '#/negocios?status=pending']);

  // Entidades.
  for (const x of d.ents?.items || []) {
    const c = bjComprobado(x, modos.verify_entity);
    add({
      key: `entidad:${x.id}`, tipo: 'entidad', at: x.created_at, listo: c.listo, id: x.id, nombre: x.official_name,
      titulo: x.official_name,
      sub: [[nombreEntidad(x.kind), x.origin === 'signup' ? (en ? 'sign-up as an organisation' : 'alta como entidad') : (en ? 'asked from the page' : 'pedida desde la ficha'), x.business_city].filter(Boolean).join(' · '),
        [`CIF ${x.tax_id || '—'}`, x.website || '', x.user_email || ''].filter(Boolean).join(' · ')],
      lineas: [c.linea, bjDocumento(x.doc_check)].filter(Boolean),
      acciones: [
        { t: en ? 'Approve…' : 'Aprobar…', fn: () => aprobarEntidad(x) },
        { t: en ? 'Reject…' : 'Rechazar…', cls: 'bad ghost', fn: () => rechazarEntidad(x) },
        ...(x.proof_path ? [{ t: en ? 'View the document' : 'Ver el documento', cls: 'ghost', fn: async () => { await verPrueba(x.proof_path); return false; } }] : []),
      ],
      abrir: '#/entidades',
    });
  }

  // «¿Es tu negocio?» (las que esperan el código no son aún de Iván).
  for (const x of d.recl?.items || []) {
    if (x.hold_until && new Date(x.hold_until) > new Date()) continue;
    const lineas = [];
    if (x.proved_at) lineas.push(bjLinea('ok', bjT('Código correcto ✔ (al correo publicado en la ficha)', 'Code correct ✔ (sent to the email on the page)')));
    const doc = bjDocumento(x.doc_check);
    if (doc) lineas.push(doc);
    if ((x.auto_failed || []).length) lineas.push(bjLinea('warn', `${bjT('Por qué te llega', 'Why it came to you')}: ${bjMotivos(x.auto_failed)}`));
    add({
      key: `reclamacion:${x.id}`, tipo: 'reclamacion', at: x.created_at,
      titulo: x.business_name || '—',
      sub: [`${en ? 'Claimed by' : 'Reclama'} ${x.user_name || x.user_email || '—'}${x.user_name ? ` (${x.user_email || ''})` : ''} · ${x.role_title || ''}`,
        [en ? `On the page: ${[x.business_phone, x.business_email].filter(Boolean).join(' · ') || '—'}` : `En la ficha: ${[x.business_phone, x.business_email].filter(Boolean).join(' · ') || '—'}`,
          x.owner_email ? `${en ? 'owner' : 'propietario'} ${x.owner_email}` : ''].filter(Boolean).join(' · ')],
      lineas,
      acciones: [
        { t: en ? 'Approve…' : 'Aprobar…', fn: () => aprobarReclamacion(x) },
        { t: en ? 'Reject…' : 'Rechazar…', cls: 'bad ghost', fn: () => rechazarReclamacion(x) },
        ...(x.proof_path ? [{ t: en ? 'View the evidence' : 'Ver la prueba', cls: 'ghost', fn: async () => { await verPrueba(x.proof_path); return false; } }] : []),
      ],
      abrir: '#/reclamaciones',
    });
  }

  // Denuncias: una por contenido denunciado.
  for (const g of d.den?.rows || []) {
    if (!g.open_count) continue;
    const motivos = (g.reasons || []).map((m) => m.reason);
    const grave = motivos.some((m) => m === 'child_abuse' || m === 'illegal');
    add({
      key: `denuncia:${g.target_type}:${g.target_id}`, tipo: 'denuncia', at: g.last_at,
      urg: grave || g.open_count >= 3 || g.ai?.verdict === 'grave' ? 0 : 2,
      grave,
      mini: miniDen(g.target_type, g.target),
      titulo: tituloDen(g.target_type, g.target),
      sub: [`${I18N.t(TIPO_DEN[g.target_type] || 'Contenido')}${g.target?.business && g.target_type !== 'business' ? ` · ${g.target.business}` : ''}`,
        `${g.open_count} ${en ? (g.open_count === 1 ? 'open report' : 'open reports') : (g.open_count === 1 ? 'denuncia abierta' : 'denuncias abiertas')} · ${g.people} ${en ? (g.people === 1 ? 'person' : 'people') : (g.people === 1 ? 'persona' : 'personas')} · ${(g.reasons || []).map((m) => `${motivoDen(m.reason)} (${m.n})`).join(', ')}`],
      lineas: [bjOpinion(g.ai, modos.report_review?.enabled)].filter(Boolean),
      acciones: [
        { t: g.state === 'removed' ? (en ? 'Close (already taken down)…' : 'Cerrar (ya retirado)…') : (en ? 'Take down and close…' : 'Retirar y cerrar…'), cls: 'bad ghost', fn: () => decideDenuncias(g.target_type, g.target_id, 'remove', g.open_count), off: g.state === 'deleted' },
        { t: en ? 'Close without taking down…' : 'Cerrar sin retirar…', fn: () => decideDenuncias(g.target_type, g.target_id, 'keep', g.open_count) },
      ],
      abrir: `#/denuncias/${g.target_type}/${g.target_id}`,
    });
  }

  // Lo que ha retenido el filtro: fotos y vídeos, y textos del moderador.
  (d.med?.rows || []).forEach((x, i) => {
    const [mot, cls] = MEDIO_MOTIVO[x.hold_reason] || ['En revisión', 'warn'];
    const etiquetas = Object.entries(MEDIO_ETIQUETA).map(([kk, nombre]) => [nombre, MEDIO_NIVEL[x.labels?.[kk]]]).filter(([, n]) => n)
      .map(([nombre, n]) => `${I18N.t(nombre)}: ${I18N.t(n[0])}`);
    add({
      key: `medio:${x.id}`, tipo: 'filtro', at: x.created_at,
      foto: d.fotos?.[i] || '',
      titulo: x.kind === 'video' ? (en ? 'Video held back' : 'Vídeo retenido') : (en ? 'Photo held back' : 'Foto retenida'),
      sub: [[x.business, x.city, x.user_email].filter(Boolean).join(' · '), (x.used_in || []).length ? `${en ? 'Used in' : 'Dónde'}: ${(x.used_in || []).join(' · ')}` : ''].filter(Boolean),
      lineas: [bjLinea(cls === 'bad' ? 'bad' : 'warn', [I18N.t(mot), ...etiquetas, MEDIO_PISTA[x.hold_reason] ? I18N.t(MEDIO_PISTA[x.hold_reason]) : ''].filter(Boolean).join(' · '))],
      acciones: [
        { t: en ? 'Approve' : 'Aprobar', fn: () => decideMedio(x, true) },
        { t: en ? 'Reject…' : 'Rechazar…', cls: 'bad ghost', fn: async () => { const m = await eligeMotivoMedio(); return m ? decideMedio(x, false, m) : false; } },
      ],
      abrir: '#/medios',
    });
  });
  for (const x of d.cont?.rows || []) {
    const que = [x.grave ? I18N.t('Grave: decides tú') : '', x.motive ? I18N.t(TEXTO_CATEGORIA[x.motive] || x.motive) : '', quienDecide(x) ? I18N.t(quienDecide(x)) : '', x.reason || ''].filter(Boolean);
    add({
      key: `contenido:${x.id}`, tipo: 'filtro', at: x.created_at, urg: x.grave ? 0 : 2, grave: !!x.grave,
      titulo: I18N.t(TEXTO_TIPO[x.kind] || x.kind),
      cita: x.text || '',
      sub: [[x.business, x.city, x.user_email].filter(Boolean).join(' · ')],
      lineas: [bjLinea(x.grave ? 'bad' : 'warn', `${en ? 'The moderator held it back' : 'Lo ha retenido el moderador'}${que.length ? `: ${que.join(' · ')}` : ''}`)],
      acciones: [
        { t: en ? 'Approve' : 'Aprobar', fn: () => decideContenido(x, true) },
        { t: en ? 'Reject…' : 'Rechazar…', cls: 'bad ghost', fn: async () => { const m = await eligeMotivoMedio(MOTIVOS_TEXTO); return m ? decideContenido(x, false, m) : false; } },
      ],
      abrir: '#/medios',
    });
  }

  // Publicaciones por moderar.
  for (const o of d.ofs?.rows || []) {
    const flags = (o.moderation_flags || []).map((f) => FLAGS[f] || f);
    add({
      key: `publicacion:${o.id}`, tipo: 'publicacion', at: o.created_at,
      titulo: o.title,
      foto: o.images?.[0] || '',
      sub: [`${I18N.t(LABELS[o.kind] || o.kind)} · ${o.business_name || ''}`],
      lineas: [flags.length ? bjLinea('warn', `${en ? 'Stopped automatically' : 'Parada sola'}: ${flags.join(' · ')}`)
        : o.verification_status && o.verification_status !== 'verified' ? bjLinea('dim', en ? 'From a business not verified yet' : 'De un negocio aún sin verificar') : null].filter(Boolean),
      acciones: [
        { t: en ? 'Approve' : 'Aprobar', fn: () => moderateOffer(o.id, 'approved') },
        { t: en ? 'Take down…' : 'Retirar…', cls: 'bad ghost', fn: () => moderateOffer(o.id, 'rejected') },
      ],
      abrir: `#/publicaciones/${o.id}`,
    });
  }

  // Textos en revisión (reseñas, novedades, respuestas, ficha, carta…).
  for (const x of d.txt?.rows || []) {
    const cats = (x.categories || []).map((c) => I18N.t(CAT_OFENSIVA[c] || c));
    const flags = (x.flags || []).filter((f) => f !== 'offensive').map((f) => I18N.t(FLAGS[f] || f));
    add({
      key: `texto:${x.kind}:${x.id}`, tipo: 'texto', at: x.created_at,
      titulo: `${I18N.t(TIPO_TEXTO[x.kind] || x.kind)} · ${x.business || ''}`,
      cita: x.text || '',
      foto: x.image || '',
      sub: [[x.user_email, x.rating ? '★'.repeat(x.rating) + '☆'.repeat(5 - x.rating) : ''].filter(Boolean).join(' · '),
        x.previous ? `${I18N.t(x.kind === 'reply' ? 'Respuesta publicada' : 'Antes')}: «${bjCorta(x.previous, 120)}»` : ''].filter(Boolean),
      lineas: [bjLinea('warn', x.kind === 'review_media' ? I18N.t('Moderación de imágenes')
        : `${en ? 'Stopped automatically' : 'Parado solo'}: ${[...cats, ...flags].join(' · ') || I18N.t('lenguaje ofensivo')}`)],
      acciones: [
        { t: en ? 'Approve' : 'Aprobar', fn: () => decideTexto(x, true) },
        { t: en ? 'Take down…' : 'Retirar…', cls: 'bad ghost', fn: () => decideTexto(x, false) },
      ],
      abrir: '#/resenas?tab=cola',
    });
  }

  // Mensajes a clientes parados.
  for (const x of d.msj?.items || []) {
    const flags = (x.moderation_flags || []).map((f) => FLAGS[f] || f);
    add({
      key: `mensaje:${x.id}`, tipo: 'mensaje', at: x.created_at,
      titulo: x.title,
      cita: x.body || '',
      sub: [[x.business_name, x.city, x.author_email].filter(Boolean).join(' · ')],
      lineas: [bjLinea('warn', `${en ? 'Stopped automatically' : 'Parado solo'}${flags.length ? `: ${flags.join(' · ')}` : ''}`)],
      acciones: [
        { t: en ? 'Send' : 'Enviar', fn: async () => (await decideMensaje(x.id, true)) !== null },
        { t: en ? 'Reject…' : 'Rechazar…', cls: 'bad ghost', fn: async () => (await decideMensaje(x.id, false)) !== null },
      ],
      abrir: '#/mensajes',
    });
  }

  // Posibles duplicados: una tarjeta por pareja.
  for (const x of (d.dups || []).filter((y) => y.pending)) {
    for (const c of x.candidates || []) {
      add({
        key: `duplicado:${x.id}:${c.id}`, tipo: 'duplicado', at: x.created_at,
        titulo: `${x.name} ↔ ${c.name}`,
        sub: [[x.city, `${en ? 'joined' : 'alta'} ${fmtDay(x.created_at)}`, `${c.name}: ${I18N.t(c.verification_status || '')}`].filter(Boolean).join(' · ')],
        lineas: [c.safe ? bjLinea('ok', bjT('Coinciden con seguridad ✔ (nombre, dirección y teléfono o web)', 'Safe match ✔ (name, address and phone or website)')) : bjLinea('warn', motivoDuplicado(c, en))],
        acciones: [
          { t: en ? 'Merge…' : 'Fusionar…', cls: 'bad ghost', fn: () => fusionar(x, c, { ir: false }) },
          { t: en ? 'Not a duplicate' : 'No es duplicado', fn: () => noEsDuplicado(x.id, c.id) },
        ],
        abrir: `#/negocios/${x.id}?ver=duplicados`,
      });
    }
  }

  // Fiestas locales que faltan en municipios con negocios (el año que corre y, desde octubre, el siguiente).
  for (const h of d.extra?.holidays || []) {
    const nombre = h.klendar_city ? h.name : `${h.name}${h.province ? ` (${h.province})` : ''}`;
    const propuestos = (h.days || []).filter((x) => x.status === 'proposed');
    const falta = Math.max(0, 2 - (h.confirmed || 0) - propuestos.length);
    add({
      key: `festivo:${h.code}:${h.year}`, tipo: 'festivo', at: h.last_verified || null, urg: 2,
      titulo: en ? `Local holidays missing for ${nombre} (${h.year})` : `Faltan las fiestas locales de ${nombre} (${h.year})`,
      sub: [`${h.businesses} ${en ? (h.businesses === 1 ? 'verified business' : 'verified businesses') : (h.businesses === 1 ? 'negocio verificado' : 'negocios verificados')}${h.bulletin?.name ? ` · ${en ? 'they come out in' : 'salen en el'} ${h.bulletin.name}` : ''}`,
        (h.days || []).length ? (h.days || []).map((x) => `${fmtDay(x.day)} ${x.name}${x.status === 'proposed' ? (en ? ' (proposed)' : ' (propuesto)') : ''}`).join(' · ') : ''].filter(Boolean),
      lineas: [bjLinea('warn', propuestos.length
        ? (en ? `${propuestos.length} proposed, not confirmed${falta ? ` · ${falta} missing` : ''}` : `${propuestos.length} ${propuestos.length === 1 ? 'propuesto' : 'propuestos'} sin confirmar${falta ? ` · falta${falta === 1 ? '' : 'n'} ${falta}` : ''}`)
        : (h.confirmed ? (en ? 'One missing' : 'Falta una') : (en ? 'Both missing' : 'Faltan las dos')))],
      acciones: [
        { t: en ? 'Add the holidays…' : 'Añadir las fiestas…', fn: () => festLocalesDialogo({ id: h.key, nombre, days: h.days, bulletin: h.bulletin }, h.year), comprueba: true },
        ...(propuestos.length ? [{ t: en ? 'Confirm the proposed ones' : 'Confirmar los propuestos', fn: () => festConfirmar(propuestos.map((x) => x.id)), comprueba: true }] : []),
      ],
      abrir: `#/festivos/${h.year}?m=${encodeURIComponent(h.slug || h.code)}`,
      festivo: h,
    });
  }
  if (ctx.festivos?.count) {
    add({
      key: 'festivo:aviso', tipo: 'festivo', at: null, urg: 3,
      titulo: en ? `Public holidays ${ctx.festivos.year}` : `Festivos de ${ctx.festivos.year}`,
      sub: [en ? (ctx.festivos.summary || '') : (ctx.festivos.text || '')],
      abrir: `#/festivos/${ctx.festivos.year}`,
    });
  }

  // Revisar de nuevo, pausas y cancelaciones.
  for (const c of (ctx.cambios || []).filter((x) => !x.reviewed_at)) {
    const MOTIVO = { name: en ? 'new name' : 'nombre nuevo', city: en ? 'other city' : 'otra ciudad', location: en ? 'moved' : 'se ha mudado' };
    add({
      key: `ficha:${c.id}`, tipo: 'ficha', at: c.updated_at,
      titulo: c.business_name,
      sub: [(c.reasons || []).map((m) => MOTIVO[m] || m).join(' · '),
        [c.before?.name !== c.after?.name ? `«${c.before?.name || '—'}» → «${c.after?.name || '—'}»` : '',
          c.before?.city !== c.after?.city ? `${c.before?.city || '—'} → ${c.after?.city || '—'}` : '',
          c.distance_m != null ? `${(c.distance_m / 1000).toLocaleString(LOC(), { maximumFractionDigits: 1 })} km` : ''].filter(Boolean).join(' · ')].filter(Boolean),
      lineas: [bjLinea('dim', bjT('Sigue a la vista y verificado: mira que sea el mismo negocio.', 'Still visible and verified: check it is the same business.'))],
      acciones: [{ t: en ? 'Reviewed…' : 'Revisado…', fn: () => marcarRevisado(c.id) }],
      abrir: `#/negocios/${c.business_id}`,
    });
  }
  for (const x of ctx.pausas || []) {
    add({
      key: `pausa:${x.id}`, tipo: 'cuenta', at: x.suspension_paused_at,
      titulo: x.name,
      sub: [`${en ? 'Paused by a suspension that has been lifted' : 'En pausa por una suspensión ya levantada'} · ${x.owner_email || ''}`],
      acciones: [
        { t: en ? 'Reopen' : 'Reabrir', fn: () => soltarPausa(x.id, true) },
        { t: en ? 'Let the owner decide' : 'Que lo decida el propietario', cls: 'ghost', fn: () => soltarPausa(x.id, false) },
      ],
      abrir: `#/negocios/${x.id}`,
    });
  }
  for (const c of (ctx.bajas || []).filter((y) => !y.handled_at && !y.undone_at)) {
    add({
      key: `baja:${c.id}`, tipo: 'cuenta', at: c.requested_at, urg: 1,
      titulo: c.business_name,
      sub: [`${en ? 'Subscription cancellation' : 'Cancelación de suscripción'} · ${en ? 'effective' : 'efectiva'} ${c.effective_on ? fmtDay(c.effective_on) : (en ? 'nothing to pay' : 'sin nada que pagar')}`, c.reason || ''].filter(Boolean),
      lineas: [bjLinea('dim', bjT('Hasta que haya cobro automático: no renovarla en su fecha y marcarla.', 'Until there is automatic billing: stop renewing it on its date and mark it.'))],
      acciones: [{ t: en ? 'Mark as handled…' : 'Marcar gestionada…', fn: () => gestionarBaja(c.id) }],
      abrir: `#/negocios/${c.business_id}`,
    });
  }

  // Sugerencias sin leer.
  for (const x of d.sug?.rows || []) {
    add({
      key: `sugerencia:${x.id}`, tipo: 'sugerencia', at: x.created_at, urg: 3,
      titulo: bjCorta(x.message, 90) || '—',
      sub: [[x.user_email, x.platform, x.app_version].filter(Boolean).join(' · ')],
      abrir: '#/sugerencias',
    });
  }

  // Sistema y cobros: no se decide aquí; se abre su apartado.
  const ap = ctx.att?.pending || {};
  const tk = ctx.att?.tasks || {};
  const urg = ctx.att?.urgent || [];
  const sis = (key, n, urgencia, es1, esN, en1, enN, abrir) => {
    if (!n) return;
    add({ key: `sistema:${key}`, tipo: 'sistema', at: null, urg: urgencia, titulo: `${fmtNum(n)} ${en ? (n === 1 ? en1 : enN) : (n === 1 ? es1 : esN)}`, sub: [], abrir });
  };
  sis('disputas', (tk.billing || {})['charge.dispute.created'] || 0, 0, 'disputa o devolución de un cobro (24 h)', 'disputas o devoluciones de cobros (24 h)', 'payment dispute or return (24 h)', 'payment disputes or returns (24 h)', '#/planes');
  sis('impagos', ap.subs_past_due, 1, 'suscripción impagada', 'suscripciones impagadas', 'unpaid subscription', 'unpaid subscriptions', '#/planes');
  sis('tareas', (tk.crons || []).length, urg.some((x) => x.kind === 'cron') ? 0 : 1, 'tarea programada con fallos (24 h)', 'tareas programadas con fallos (24 h)', 'scheduled task with failures (24 h)', 'scheduled tasks with failures (24 h)', '#/errores');
  sis('emisiones', (tk.leagues || []).length, 1, 'importación de emisiones que no va bien', 'importaciones de emisiones que no van bien', 'broadcast import not working', 'broadcast imports not working', '#/emisiones');
  sis('web', ctx.webErr?.new_24h || 0, 2, 'error nuevo en la web (24 h)', 'errores nuevos en la web (24 h)', 'new website error (24 h)', 'new website errors (24 h)', '#/errores');
  sis('http', tk.http_24h, 2, 'llamada a una Edge Function con error (24 h)', 'llamadas a Edge Functions con error (24 h)', 'failed Edge Function call (24 h)', 'failed Edge Function calls (24 h)', '#/errores');
  sis('agendas', tk.calendars_failing, 2, 'agenda conectada de una entidad que no se puede leer', 'agendas conectadas de entidades que no se pueden leer', 'connected organisation calendar that can’t be read', 'connected organisation calendars that can’t be read', '#/agenda');
  sis('push', k?.push_failed_7d, 3, 'notificación push fallida (7 d)', 'notificaciones push fallidas (7 d)', 'failed push notification (7 d)', 'failed push notifications (7 d)', '#/avisos?tab=push');
  sis('vencen', k?.subs_expiring_7d, 3, 'suscripción vence en 7 días', 'suscripciones vencen en 7 días', 'subscription expiring in 7 days', 'subscriptions expiring in 7 days', '#/planes');
  sis('locales', ap.venue_groups_open, 3, 'local pedido por la gente sin enlazar', 'locales pedidos por la gente sin enlazar', 'place requested by people, not linked yet', 'places requested by people, not linked yet', '#/pedidos');

  // Lo más urgente arriba; dentro de cada nivel, lo que lleva más tiempo esperando.
  const t = (x) => (x.at ? Date.parse(x.at) || 0 : Number.MAX_SAFE_INTEGER);
  return out.sort((a, b) => (a.urg - b.urg) || (t(a) - t(b)));
}

function htmlTarjeta(c) {
  const en = bjEn();
  const [icono, , , nombreEs, nombreEn] = BANDEJA_TIPOS[c.tipo] || ['inbox', '', '', c.tipo, c.tipo];
  const urgente = c.urg === 0;
  const media = c.mini ? `<div class="bj-mini">${c.mini}</div>`
    : c.foto ? `<div class="bj-mini">${/\.(mp4|webm|mov)(\?|$)/i.test(c.foto) ? `<video src="${esc(c.foto)}#t=0.5" muted playsinline preload="metadata" aria-hidden="true"></video>` : `<img src="${esc(c.foto)}" alt="" loading="lazy">`}</div>` : '';
  return `<article class="bj${urgente ? ' urgente' : ''}" role="listitem" data-k="${esc(c.key)}" data-tipo="${esc(c.tipo)}">
    <div class="bj-cab">${ms(icono)}<span class="bj-tipo">${esc(en ? nombreEn : nombreEs)}</span>${urgente ? `<span class="tag bad">${c.grave ? (en ? 'serious' : 'grave') : (en ? 'urgent' : 'urgente')}</span>` : ''}${c.at ? `<span class="bj-cuando">${esc(ago(c.at))}</span>` : ''}</div>
    <div class="bj-cuerpo">${media}<div class="bj-texto">
      <h3>${esc(c.titulo || '—')}</h3>
      ${(c.sub || []).filter(Boolean).map((s) => `<div class="meta">${esc(s)}</div>`).join('')}
      ${c.cita ? `<p class="bj-cita">${esc(bjCorta(c.cita, 400))}</p>` : ''}
    </div></div>
    ${(c.lineas || []).map((l) => `<p class="bj-maquina ${esc(l.cls)}">${esc(l.texto)}</p>`).join('')}
    <div class="bj-acc">${(c.acciones || []).map((a, i) => `<button class="btn sm ${esc(a.cls || '')}" type="button" data-acc="${i}"${a.off ? ' disabled' : ''}>${esc(a.t)}</button>`).join('')}
      ${c.abrir ? `<a class="link bj-abrir" href="${esc(c.abrir)}">${en ? 'Open in its section' : 'Abrir en su apartado'}</a>` : ''}</div>
  </article>`;
}

/** La tarjeta de la bandeja en el Resumen: el HTML (`tarjetaBandeja`) y sus botones (`activaBandeja`). */
function tarjetaBandeja(cards, ctx) {
  const en = bjEn();
  const listos = cards.filter((c) => c.listo);
  return `<section class="card bandeja" id="bandeja" aria-labelledby="bandejaTit">
    <div class="bandeja-cab"><h2 id="bandejaTit">${en ? 'Waiting for you' : 'Pendiente de ti'} <span class="badge pend-total" id="bandejaN" title="${en ? 'Things waiting for a decision' : 'Cosas que esperan una decisión'}">${fmtNum(cards.length)}</span></h2>
      <button class="btn primary" type="button" id="bandejaListos"${listos.length ? '' : ' hidden'}>${ms('done_all')} <span>${en ? 'Approve all that check out' : 'Aprobar todos los que cuadran'} (<b id="bandejaListosN">${fmtNum(listos.length)}</b>)</span></button></div>
    <p class="muted small" style="margin:0 0 10px">${en
      ? 'The most urgent first. Decide on each card here; “Open in its section” for the history and the odd cases. What the AI says is an opinion: you decide.'
      : 'Lo más urgente, arriba. Cada caso se decide aquí; «Abrir en su apartado», para el historial y los casos raros. Lo que dice la IA es una opinión: decides tú.'}</p>
    <div class="bandeja-filtros" id="bandejaFiltros" role="toolbar" aria-label="${en ? 'Filter by type' : 'Filtrar por tipo'}"></div>
    <div class="bandeja-lista" id="bandejaLista" role="list">${cards.map(htmlTarjeta).join('')}</div>
    <p class="bandeja-vacia muted" id="bandejaVacia"${cards.length ? ' hidden' : ''}>${ms('task_alt')} ${en ? 'All up to date: nothing is waiting for you.' : 'Todo al día: no hay nada esperando una decisión.'}</p>
    ${(ctx.mas || []).map(([, n, href]) => `<p class="small" style="margin:6px 0 0"><a class="link" href="${esc(href)}">${en ? `${n} more in its section` : `${n} más en su apartado`}</a></p>`).join('')}
  </section>`;
}

function activaBandeja(v, cards) {
  const en = bjEn();
  const caja = $('#bandeja', v);
  if (!caja) return;
  const porKey = new Map(cards.map((c) => [c.key, c]));
  let filtro = '';
  try { filtro = localStorage.getItem(BANDEJA_FILTRO) || ''; } catch { /* sin almacenamiento */ }

  const pintaFiltros = () => {
    const vivos = [...porKey.values()];
    const n = {};
    vivos.forEach((c) => { n[c.tipo] = (n[c.tipo] || 0) + 1; });
    if (filtro && !n[filtro]) filtro = '';
    const chip = (k, texto, cuantos) => `<button type="button" class="chip${filtro === k ? ' on' : ''}" aria-pressed="${filtro === k}" data-f="${esc(k)}">${esc(texto)} <span class="chip-n">${fmtNum(cuantos)}</span></button>`;
    const tipos = Object.keys(BANDEJA_TIPOS).filter((k) => n[k]);
    // En el ordenador, los tipos a la vista; en el móvil, un desplegable (catorce botones ocupaban media pantalla).
    $('#bandejaFiltros', caja).innerHTML = vivos.length > 1
      ? `<div class="bandeja-chips">${chip('', en ? 'All' : 'Todo', vivos.length)}${tipos.map((k) => chip(k, BANDEJA_TIPOS[k][en ? 2 : 1], n[k])).join('')}</div>
        <label class="bandeja-sel"><select id="bandejaSel" aria-label="${en ? 'Filter by type' : 'Filtrar por tipo'}">
          <option value=""${filtro ? '' : ' selected'}>${esc(`${en ? 'All' : 'Todo'} (${vivos.length})`)}</option>
          ${tipos.map((k) => `<option value="${esc(k)}"${filtro === k ? ' selected' : ''}>${esc(`${BANDEJA_TIPOS[k][en ? 2 : 1]} (${n[k]})`)}</option>`).join('')}</select></label>`
      : '';
    const elige = (f) => { filtro = f; try { localStorage.setItem(BANDEJA_FILTRO, filtro); } catch { /* */ } aplica(); };
    $$('[data-f]', caja).forEach((b) => { b.onclick = () => elige(b.dataset.f); });
    const sel = $('#bandejaSel', caja);
    if (sel) sel.onchange = () => elige(sel.value);
  };
  const aplica = () => {
    pintaFiltros();
    $$('.bj', caja).forEach((el) => { el.hidden = !!filtro && el.dataset.tipo !== filtro; });
    const total = porKey.size;
    $('#bandejaN', caja).textContent = fmtNum(total);
    $('#bandejaVacia', caja).hidden = total > 0;
    const listos = [...porKey.values()].filter((c) => c.listo);
    $('#bandejaListos', caja).hidden = !listos.length;
    $('#bandejaListosN', caja).textContent = fmtNum(listos.length);
  };
  const quita = (key) => {
    porKey.delete(key);
    const el = $(`.bj[data-k="${CSS.escape(key)}"]`, caja);
    if (el) {
      const siguiente = el.nextElementSibling;
      el.remove();
      // El foco, a la siguiente (con teclado no se pierde al quitar la tarjeta).
      (siguiente?.querySelector('button:not([disabled])') || $('#bandejaTit', caja))?.focus?.({ preventScroll: true });
    }
    aplica();
  };
  // Un festivo: guardar uno solo o confirmar no siempre lo completa; se vuelve a mirar.
  const comprueba = async (c) => {
    const x = await rpc('admin_inbox_extra').catch(() => null);
    const h = (x?.holidays || []).find((y) => `festivo:${y.code}:${y.year}` === c.key);
    if (!h) { quita(c.key); return; }
    const nuevo = tarjetasBandeja({ extra: { holidays: [h], modes: x.modes } }, null, { mas: [] }).find((y) => y.key === c.key);
    if (!nuevo) { quita(c.key); return; }
    porKey.set(c.key, nuevo);
    const el = $(`.bj[data-k="${CSS.escape(c.key)}"]`, caja);
    if (el) { el.outerHTML = htmlTarjeta(nuevo); enlaza($(`.bj[data-k="${CSS.escape(c.key)}"]`, caja)); }
    aplica();
  };
  const enlaza = (el) => {
    if (!el) return;
    const c = porKey.get(el.dataset.k);
    if (!c) return;
    $$('[data-acc]', el).forEach((b) => {
      b.onclick = () => esperando(b, async () => {
        const a = c.acciones[+b.dataset.acc];
        try {
          const hecho = await a.fn();
          if (hecho && a.comprueba) await comprueba(c);
          else if (hecho) quita(c.key);
        } catch (e) { if (!e?.obsoleta) toast(I18N.t(e?.message || 'Error'), true); }
      });
    });
    I18N.translate(el);
  };
  $$('.bj', caja).forEach(enlaza);

  $('#bandejaListos', caja).onclick = (e) => esperando(e.currentTarget, async () => {
    const listos = [...porKey.values()].filter((c) => c.listo);
    if (!listos.length) return;
    const negocios = listos.filter((c) => c.tipo === 'negocio');
    const entidades = listos.filter((c) => c.tipo === 'entidad');
    const lista = (xs, titulo) => (xs.length ? `<p style="margin:8px 0 4px"><b>${esc(titulo)}</b></p><ul class="bandeja-confirma">${xs.map((c) => `<li>${esc(c.nombre || c.titulo)}</li>`).join('')}</ul>` : '');
    const ok = await confirmDlg(en ? 'Approve all that check out' : 'Aprobar todos los que cuadran',
      `${esc(en
        ? 'They pass every check of the autopilot. They are checked again just before approving: anything that no longer checks out stays here with its reason. Each owner gets the usual notification.'
        : 'Cumplen todo lo que se comprueba. Se vuelven a comprobar justo antes de aprobar: lo que ya no cuadre se queda aquí, con su motivo. A cada uno le llega el aviso de siempre.')}
       ${lista(negocios, en ? `Verify ${negocios.length} business(es)` : `Verificar ${negocios.length} ${negocios.length === 1 ? 'negocio' : 'negocios'}`)}
       ${lista(entidades, en ? `Approve ${entidades.length} organisation(s) (free plan with no end date)` : `Aprobar ${entidades.length} ${entidades.length === 1 ? 'entidad' : 'entidades'} (plan gratis sin fin)`)}`,
      { submit: en ? `Approve ${listos.length}` : `Aprobar ${listos.length}` });
    if (!ok) return;
    try {
      const r = await rpc('admin_approve_ready', { p_businesses: negocios.map((c) => c.id), p_entities: entidades.map((c) => c.id) });
      for (const a of r?.approved || []) quita(`${a.kind === 'entity' ? 'entidad' : 'negocio'}:${a.id}`);
      for (const s of r?.skipped || []) {
        const c = porKey.get(`${s.kind === 'entity' ? 'entidad' : 'negocio'}:${s.id}`);
        if (!c) continue;
        c.listo = false;
        c.lineas = [bjLinea('warn', `${en ? 'No longer checks out' : 'Ya no cuadra'}: ${bjMotivos(s.failed)}`)];
        const el = $(`.bj[data-k="${CSS.escape(c.key)}"]`, caja);
        if (el) { el.outerHTML = htmlTarjeta(c); enlaza($(`.bj[data-k="${CSS.escape(c.key)}"]`, caja)); }
      }
      const n = (r?.approved || []).length;
      const s = (r?.skipped || []).length;
      toast(en ? `Approved: ${n}${s ? ` · ${s} no longer check out` : ''}` : `Aprobados: ${n}${s ? ` · ${s} ya no cuadran` : ''}`);
      refreshBadges();
      aplica();
    } catch (err) { toast(I18N.t(err?.message || 'Error'), true); }
  });
  aplica();
}
