/* Administración → «Filtro automático»: la cola del moderador único, textos, fotos y vídeos
 * (migraciones 20261265100000_filtro_medios y 20261266500000_moderador_unico de la app;
 * klendar/docs/FILTRO_MEDIOS.md).
 *
 * Lo retenido (en duda, tope del mes, el servicio falla, vídeo sin fotogramas, sin permiso,
 * denuncias), con el original en un enlace firmado de 5 minutos: aprobar es un toque
 * y rechazar, dos (el motivo y listo), y el motivo le llega a quien lo subió (DSA
 * art. 17, `notify_content_removed`). Aparte, lo que ha rechazado el filtro solo,
 * por si hay que recuperarlo: una reclamación no puede resolverla solo una máquina.
 *
 * Va después de admin.js y usa lo suyo.
 */
'use strict';

const MEDIO_BUCKET = 'business-images';
const MEDIO_MOTIVO = {
  doubt: ['En duda', 'warn'],
  cap: ['Tope del mes', 'warn'],
  error: ['El servicio no contesta', 'warn'],
  no_frames: ['Vídeo sin fotogramas', 'dim'],
  too_big: ['Demasiado grande para analizar', 'dim'],
  report: ['Por denuncias', 'bad'],
  no_consent: ['Sin permiso para la IA', 'dim'],
};
const MEDIO_PISTA = {
  doubt: 'El filtro no lo tiene claro: decide tú.',
  cap: 'No se ha analizado: se ha llegado al tope del mes. Si no decides, el mes que viene lo analiza solo.',
  error: 'No se ha podido analizar. Se reintenta solo; también puedes decidir ahora.',
  no_frames: 'Quien lo subió usa una versión de la app que no manda fotogramas: míralo tú.',
  too_big: 'Pesa más de lo que se puede mandar a analizar: míralo tú.',
  report: 'Varias personas lo han denunciado. Decide aquí o en «Denuncias».',
  no_consent: 'Quien lo subió no ha dado permiso para mandarlo a una IA: míralo tú.',
};

// Los textos.
const TEXTO_TIPO = {
  offer: 'Publicación', post: 'Novedad', review: 'Reseña', review_reply: 'Respuesta a una reseña', business_message: 'Mensaje a clientes',
  business_name: 'Nombre del negocio', business_description: 'Descripción del negocio', menu_section: 'Apartado de la carta', menu_item: 'Plato de la carta',
  closure_reason: 'Motivo de días cerrados', highlight: 'Qué pedir aquí', question: 'Pregunta', question_answer: 'Respuesta a una pregunta',
  profile_name: 'Nombre de perfil', group_request: 'Petición de grupo', group_conditions: 'Condiciones de un grupo', group_proposal: 'Propuesta a un grupo', group_decline: 'Motivo de un no a un grupo', daily_menu: 'Menú del día',
  venue_request: 'Local pedido', giveaway: 'Sorteo', series: 'Serie', artist: 'Artista', stamp_card: 'Tarjeta de sellos', birthday_gift: 'Regalo de cumpleaños',
  pass_type: 'Bono', loyalty: 'Cupón', loyalty_thanks: 'Agradecimiento', spot: 'Dar en el momento',
};
const TEXTO_CATEGORIA = {
  alcohol: 'Alcohol', tobacco: 'Tabaco', gambling: 'Apuestas', insults: 'Insultos', insult: 'Insultos', profanity: 'Tacos', hate: 'Odio', threats: 'Amenazas', threat: 'Amenazas',
  sexual: 'Sexual', porn: 'Porno', paid_sex: 'Sexo de pago', drugs: 'Drogas', weapons: 'Armas', violence: 'Violencia', scam: 'Estafa', medicines: 'Medicamentos',
  misleading: 'Oferta engañosa', spam: 'Publicidad ajena', privacy: 'Datos de otra persona', defamation: 'Acusación',
  illegal: 'Ilegal', child_abuse: 'Abuso sexual infantil', ambiguous: 'Palabra ambigua', offensive: 'Lenguaje ofensivo',
};
// Lo que el moderador deja a la vista: no hay forma de ocultarlo sin romper el negocio.
const TEXTO_A_LA_VISTA = ['giveaway', 'series', 'artist', 'stamp_card', 'birthday_gift', 'pass_type', 'loyalty', 'loyalty_thanks', 'spot', 'venue_request', 'menu_section'];
const quienDecide = (x) => (x.decided_by === 'lists' ? 'Listas de palabras' : x.decided_by === 'ai' ? 'IA' : '');

const filaTexto = (x, i, tab) => {
  const en = I18N.lang === 'en';
  const tags = [];
  if (x.grave) tags.push(`<span class="tag bad">${esc(I18N.t('Grave: decides tú'))}</span>`);
  if (quienDecide(x)) tags.push(`<span class="tag dim">${esc(I18N.t(quienDecide(x)))}${x.provider ? ` · ${esc(x.provider)}` : ''}</span>`);
  if (x.motive) tags.push(`<span class="tag warn">${esc(I18N.t(TEXTO_CATEGORIA[x.motive] || x.motive))}</span>`);
  const quien = [
    x.business ? `<a class="link" href="/negocios/${esc(x.business_id)}">${esc(x.business)}</a>${x.city ? ` (${esc(x.city)})` : ''}` : '',
    x.user_email ? esc(x.user_email) : '',
    fmtDate(x.created_at),
  ].filter(Boolean).join(' · ');
  return `<div class="card med-texto" data-t="${i}">
    <h3 style="margin:0 0 6px">${esc(I18N.t(TEXTO_TIPO[x.kind] || x.kind))}</h3>
    <div>${tags.join(' ')}</div>
    <p class="med-cita">${esc(x.text || '')}</p>
    ${x.reason ? `<p class="muted small" style="margin:6px 0">${esc(x.reason)}</p>` : ''}
    ${TEXTO_A_LA_VISTA.includes(x.kind) ? `<p class="muted small" style="margin:6px 0">${esc(I18N.t('Sigue a la vista: mira el negocio si hay que quitarlo.'))}</p>` : ''}
    <div class="meta">${quien}</div>
    <div class="actions"><button class="btn ok" type="button" data-tok="${i}">${esc(I18N.t(tab === 'rejected' ? 'Recuperar' : 'Aprobar'))}</button>
      ${tab === 'rejected' ? '' : `<button class="btn bad" type="button" data-tno="${i}">${esc(I18N.t('Rechazar'))}</button>`}</div>
  </div>`;
};
/** Un texto parado por las listas de palabras (`admin_text_reviews`, la cola
 *  que antes estaba en «Reseñas y novedades › En revisión»): se decide igual
 *  que antes (`decideTexto`, admin.js). */
const filaListas = (x, i) => {
  const cats = (x.categories || []).map((c) => I18N.t(CAT_OFENSIVA[c] || c));
  const flags = (x.flags || []).filter((f) => f !== 'offensive').map((f) => I18N.t(FLAGS[f] || f));
  const quien = [
    x.business ? `<a class="link" href="/negocios/${esc(x.business_id)}">${esc(x.business)}</a>` : '',
    x.user_email ? esc(x.user_email) : '',
    fmtDate(x.created_at),
    x.rating ? `<span class="stars">${'★'.repeat(x.rating)}${'☆'.repeat(5 - x.rating)}</span>` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="card med-texto" data-l="${i}">
    <h3 style="margin:0 0 6px">${esc(I18N.t(TIPO_TEXTO[x.kind] || x.kind))}</h3>
    <div><span class="tag dim">${esc(I18N.t('Listas de palabras'))}</span> ${x.kind === 'review_media' ? `<span class="tag warn">${esc(I18N.t('Moderación de imágenes'))}</span>` : [...cats, ...flags].map((c) => `<span class="tag warn">${esc(c)}</span>`).join(' ')}</div>
    ${x.image ? `<img class="med-mini" src="${esc(x.image)}" alt="" loading="lazy">` : ''}
    <p class="med-cita">${esc(x.text || '')}</p>
    ${mediosResena(x.media)}
    ${x.context ? `<p class="muted small" style="margin:6px 0">${esc(I18N.t(CONTEXTO_TEXTO[x.kind] || 'Reseña'))}: «${esc(x.context)}»</p>` : ''}
    ${x.previous ? `<p class="muted small" style="margin:6px 0">${esc(I18N.t(x.kind === 'reply' ? 'Respuesta publicada' : ['birthday_gift', 'stamp_card_name', 'stamp_card_reward'].includes(x.kind) ? 'En uso' : 'Antes'))}: «${esc(x.previous)}»</p>` : ''}
    <div class="meta">${quien}</div>
    <div class="actions"><button class="btn ok" type="button" data-lok="${i}">${esc(I18N.t('Aprobar'))}</button>
      <button class="btn bad" type="button" data-lno="${i}">${esc(I18N.t('Retirar…'))}</button></div>
  </div>`;
};
const MEDIO_ETIQUETA = { adult: 'Desnudos', violence: 'Violencia', racy: 'Sugerente', medical: 'Médico' };
const MEDIO_NIVEL = { VERY_LIKELY: ['Muy probable', 'bad'], LIKELY: ['Probable', 'bad'], POSSIBLE: ['Posible', 'warn'] };
// Lo que recibe quien lo subió: claro y sin más que lo necesario.
const MEDIO_RAZONES = [
  'Contiene desnudos o contenido sexual.',
  'Contiene violencia o escenas desagradables.',
  'Promociona drogas u otra cosa que no permiten las Normas de la comunidad.',
  'Muestra a menores de forma que no permiten las Normas de la comunidad.',
];

// Enlaces firmados de lo retenido: 5 minutos; se reutilizan 4 (rendimiento,
// 20-11: la bandeja firmaba hasta 50, uno a uno, antes de pintar).
const FIRMADAS = new Map();
const firmadaViva = (nombre) => { const f = FIRMADAS.get(nombre); return f && f.hasta > Date.now() ? f.url : null; };
const urlMedio = async (nombre, enRetenido) => {
  if (!enRetenido) return sb.storage.from(MEDIO_BUCKET).getPublicUrl(nombre).data.publicUrl;
  const viva = firmadaViva(nombre);
  if (viva) return viva;
  const { data } = await sb.storage.from('media-held').createSignedUrl(nombre, 300);
  if (data?.signedUrl) FIRMADAS.set(nombre, { url: data.signedUrl, hasta: Date.now() + 240000 });
  return data?.signedUrl || '';
};
/** Firma de una vez (una sola petición) lo retenido de una lista: `[[nombre, enRetenido], …]`.
 *  Después, urlMedio de cada uno sale de lo ya firmado. */
const firmaMedios = async (pares) => {
  const faltan = [...new Set(pares.filter(([n, held]) => held && n && !firmadaViva(n)).map(([n]) => n))];
  if (!faltan.length) return;
  try {
    const { data } = await sb.storage.from('media-held').createSignedUrls(faltan, 300);
    for (const x of data || []) if (x?.signedUrl && x.path) FIRMADAS.set(x.path, { url: x.signedUrl, hasta: Date.now() + 240000 });
  } catch { /* cada una se firma luego por su cuenta */ }
};

/** Rechazar: un toque en el motivo y ya. */
const MOTIVOS_TEXTO = [
  'Contiene insultos, odio o amenazas.',
  'Contiene contenido sexual o anuncia sexo de pago.',
  'Promociona drogas, armas, tabaco, apuestas o medicamentos.',
  'Parece una estafa.',
];
function eligeMotivoMedio(lista = MEDIO_RAZONES) {
  return new Promise((resolve) => {
    const d = $('#modal');
    d.classList.remove('ancho');
    d.setAttribute('aria-labelledby', 'modalTit');
    d.innerHTML = `<form method="dialog">
      <h2 id="modalTit">${esc(I18N.t('¿Por qué lo rechazas?'))}</h2>
      <p class="muted" style="margin:0">${esc(I18N.t('Quien lo subió recibe este motivo y puede pedir que se revise en 6 meses.'))}</p>
      <div class="med-razones">${lista.map((m, i) => `<button type="button" class="btn bad" data-r="${i}">${esc(I18N.t(m))}</button>`).join('')}</div>
      <label class="f ancho"><span>${esc(I18N.t('Otro motivo'))}</span><textarea name="otro"></textarea></label>
      <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(I18N.t('Cancelar'))}</button><button type="submit" class="btn bad">${esc(I18N.t('Rechazar'))}</button></div>
    </form>`;
    const cerrar = (v) => { d.close(); resolve(v); };
    $$('[data-r]', d).forEach((b) => { b.onclick = () => cerrar(I18N.t(lista[+b.dataset.r])); });
    $('[data-cancel]', d).onclick = () => cerrar(null);
    d.oncancel = (e) => { e.preventDefault(); cerrar(null); };
    $('form', d).onsubmit = (e) => {
      e.preventDefault();
      const otro = new FormData(e.target).get('otro').toString().trim();
      if (!otro) { toast(I18N.t('Elige un motivo o escribe otro.'), true); return; }
      cerrar(otro);
    };
    d.showModal();
    // El foco, en «Cancelar»: con el primer motivo enfocado, un Intro de más
    // rechazaba con «Contiene desnudos…».
    $('[data-cancel]', d).focus();
  });
}

const filaMedio = async (x, i, tab) => {
  const en = I18N.lang === 'en';
  const video = x.kind === 'video';
  const [src, fotogramas] = await Promise.all([
    urlMedio(x.name, x.in_held),
    Promise.all((x.frames || []).map((f) => urlMedio(f.name, f.in_held))),
  ]);
  const [mot, cls] = MEDIO_MOTIVO[x.hold_reason] || (tab === 'rejected' ? ['Rechazado por el filtro', 'bad'] : ['En revisión', 'warn']);
  const etiquetas = Object.entries(MEDIO_ETIQUETA)
    .map(([k, nombre]) => [nombre, MEDIO_NIVEL[x.labels?.[k]]])
    .filter(([, n]) => n)
    .map(([nombre, n]) => `<span class="tag ${n[1]}">${esc(I18N.t(nombre))}: ${esc(I18N.t(n[0]))}</span>`);
  const ver = video
    ? `<video class="med-grande" src="${esc(src)}" controls preload="metadata" playsinline></video>`
    : `<a href="${esc(src)}" target="_blank" rel="noopener"><img class="med-grande" src="${esc(src)}" alt="${esc(I18N.t('Foto retenida'))}" loading="lazy"></a>`;
  const usos = (x.used_in || []).length
    ? (x.used_in || []).map(esc).join(' · ')
    : esc(I18N.t('Aún no se usa en ningún sitio'));
  const quien = [
    x.business ? `<a class="link" href="/negocios/${esc(x.business_id)}">${esc(x.business)}</a>${x.city ? ` (${esc(x.city)})` : ''}` : '',
    x.user_email ? esc(x.user_email) : '',
    fmtDate(x.created_at),
  ].filter(Boolean).join(' · ');
  return `<div class="card med-fila" data-i="${i}">
    <div class="med-ver">${ver}${fotogramas.length ? `<div class="med-fotogramas">${fotogramas.map((u) => `<img src="${esc(u)}" alt="${esc(I18N.t('Fotograma'))}" loading="lazy">`).join('')}</div>` : ''}</div>
    <div class="med-info">
      <div><span class="tag ${cls}">${esc(I18N.t(mot))}</span> ${etiquetas.join(' ')}</div>
      ${MEDIO_PISTA[x.hold_reason] ? `<p class="muted small" style="margin:6px 0">${esc(I18N.t(MEDIO_PISTA[x.hold_reason]))}</p>` : ''}
      <div class="meta">${quien}</div>
      <div class="meta">${en ? 'Used in' : 'Dónde'}: ${usos}</div>
      ${x.last_error ? `<div class="meta mono small" style="word-break:break-word">${esc(String(x.last_error).slice(0, 160))}</div>` : ''}
      <div class="actions"><button class="btn ok" type="button" data-ok="${i}">${esc(I18N.t(tab === 'rejected' ? 'Recuperar' : 'Aprobar'))}</button>
        ${tab === 'rejected' ? '' : `<button class="btn bad" type="button" data-no="${i}">${esc(I18N.t('Rechazar'))}</button>`}</div>
    </div>
  </div>`;
};

/** Aprobar o rechazar (con su motivo) un texto retenido por el moderador. true si se hizo.
 * Lo usan «Filtro automático» y la bandeja del Resumen. */
async function decideContenido(x, aprobar, motivo) {
  const res = await rpc('admin_content_decide', { p_id: x.id, p_approve: aprobar, p_reason: motivo ?? null });
  if (!res?.ok) { toast(res?.error || 'Error', true); return false; }
  toast(I18N.t(aprobar ? 'Aprobado: vuelve a verse en un minuto' : 'Rechazado: quien lo subió recibe el motivo'));
  refreshBadges();
  return true;
}
/** Lo mismo con una foto o un vídeo retenido. */
async function decideMedio(x, aprobar, motivo) {
  const res = await rpc('admin_media_decide', { p_id: x.id, p_approve: aprobar, p_reason: motivo ?? null });
  if (!res?.ok) { toast(res?.error || 'Error', true); return false; }
  toast(I18N.t(aprobar ? 'Aprobado: vuelve a verse en un minuto' : 'Rechazado: quien lo subió recibe el motivo'));
  refreshBadges();
  return true;
}

PAGES.medios = async (v) => {
  const p = params();
  let tab = p.tab === 'rejected' ? 'rejected' : 'held';
  const s = (st.medios = st.medios || { limit: 30, offset: 0 });
  const en0 = I18N.lang === 'en';
  v.innerHTML = `
    <div class="page-head"><h1>Filtro automático</h1></div>
    ${helpBox(en0 ? 'What do I do here?' : '¿Qué hago aquí?', en0
    ? '<p>The <b>only queue</b> for what has been held back before anyone sees it: texts (news, reviews and replies, the page and the menu, questions, birthday gifts, stamp cards…), photos and videos. Some are held by the <b>word lists</b> (insults, swear words, explicit sex, hate or threats), others by the <b>AI filter</b> when it is on, and others by <b>reports</b>. News, reviews and replies <b>are not public</b> until you approve them; a new birthday gift or stamp card name or reward is not used until then (the previous one stays). The business name, description and menu stay visible in the meantime. <b>Approve</b> if it is fine (a false alarm, or strong but acceptable); <b>Reject</b> or <b>Take down</b> if it breaks the Community guidelines: whoever posted it gets the reason and can ask for a review within 6 months. “Rejected by the filter”: what the filter rejected on its own, in case something has to be recovered.</p>'
    : '<p>La <b>única cola</b> de lo que se ha parado antes de que lo vea nadie: textos (novedades, reseñas y respuestas, la ficha y la carta, preguntas, regalos de cumpleaños, tarjetas de sellos…), fotos y vídeos. Unos los paran las <b>listas de palabras</b> (insultos, palabras malsonantes, sexo explícito, odio o amenazas), otros el <b>filtro con IA</b> cuando está encendido y otros las <b>denuncias</b>. Las novedades, las reseñas y las respuestas <b>no se ven</b> hasta que las apruebas; un regalo de cumpleaños o el nombre o el premio de una tarjeta de sellos nuevos no se usan hasta entonces (sigue el anterior). El nombre, la descripción y la carta del negocio siguen a la vista mientras tanto. <b>Aprobar</b> si está bien (una falsa alarma o algo fuerte pero aceptable); <b>Rechazar</b> o <b>Retirar</b> si incumple las Normas de la comunidad: quien lo publicó recibe el motivo y puede pedir que se revise en 6 meses. «Rechazado por el filtro»: lo que el filtro rechazó solo, por si hay que recuperar algo.</p>')}
    <div id="medEstado"></div>
    <div class="tabs" id="medTabs"></div>
    <div id="list"><div class="loading" role="status">Cargando…</div></div>`;
  const load = enOrden(() => cargaLista());
  const cargaLista = async () => {
    ponUrl('medios', { tab: tab === 'held' ? null : tab });
    let r;
    let txt = { rows: [], counts: {} };
    let leg = { rows: [], total: 0 };
    try {
      // Fotos y textos a la vez y por partes los dos (antes los textos iban
      // siempre desde el primero: del 31 en adelante no se llegaba nunca).
      // Con ellos, los textos de las listas de palabras (antes en «Reseñas y
      // novedades › En revisión»: una sola cola de textos).
      [r, txt, leg] = await Promise.all([
        rpc('admin_media_queue', { p_tab: tab, p_limit: s.limit, p_offset: s.offset }),
        rpc('admin_content_queue', { p_tab: tab, p_limit: s.limit, p_offset: s.offset }),
        tab === 'held' ? rpc('admin_text_reviews', { p_limit: s.limit, p_offset: s.offset }) : Promise.resolve(leg),
      ]);
    } catch (e) {
      if (e?.obsoleta || !/could not find the function|schema cache/i.test(e?.codigo || e?.message || '')) throw e;
      // La web se publica antes que la base: hasta subir la migración, sin error.
      $('#list').innerHTML = `<div class="tbl-wrap"><div class="empty">${esc(I18N.t('Esta base aún no tiene el filtro: falta subir la migración.'))}</div></div>`;
      return;
    }
    const en = I18N.lang === 'en';
    const c = r.config || {};
    const cifras = `${fmtNum(c.used || 0)} / ${fmtNum(c.cap || 0)}`;
    $('#medEstado').innerHTML = c.enabled
      ? `<p class="muted" style="margin:0 0 12px">${en ? `The filter is on. Used this month: ${cifras} images.` : `El filtro está encendido. Este mes: ${cifras} imágenes.`}</p>`
      : `<div class="card"><p style="margin:0"><b>${esc(I18N.t('El filtro con IA está apagado.'))}</b> ${esc(I18N.t('Mientras tanto, aquí llega lo que paran las listas de palabras y lo que se denuncia.'))}${c.test_users ? ` ${en ? `Active for ${c.test_users} test account(s).` : `Activo para ${c.test_users} cuenta(s) de prueba.`}` : ''}</p></div>`;
    $('#medTabs').innerHTML = [['held', 'Por decidir', (r.counts?.held || 0) + (txt.counts?.held || 0) + (tab === 'held' ? Number(leg?.total) || 0 : TEXTOS_N)], ['rejected', 'Rechazado por el filtro', (r.counts?.rejected || 0) + (txt.counts?.rejected || 0)]]
      .map(([k, t, n]) => `<button type="button" data-t="${k}" aria-pressed="${tab === k}" class="${tab === k ? 'on' : ''}">${esc(I18N.t(t))}${n ? ` <span class="badge">${fmtNum(n)}</span>` : ''}</button>`).join('');
    $$('#medTabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; s.offset = 0; load(); }; });
    const rows = r.rows || [];
    const total = tab === 'held' ? (r.counts?.held || 0) : (r.counts?.rejected || 0);
    const totalTxt = tab === 'held' ? (txt.counts?.held || 0) : (txt.counts?.rejected || 0);
    const listas = tab === 'held' ? (leg?.rows || []) : [];
    // Una página = las fotos y los textos de ese tramo: hasta el más largo.
    const pg = pager(s, Math.max(total, totalTxt, tab === 'held' ? Number(leg?.total) || 0 : 0), load);
    const textos = txt.rows || [];
    // Si el servicio lleva tiempo sin contestar o se ha acabado el tope, aprobar todo de una vez.
    const nBloque = rows.filter((x) => ['cap', 'error'].includes(x.hold_reason)).length;
    // Aprobar en bloque coge todas las de esos motivos, también las de otras
    // páginas: el número solo se enseña si caben todas en esta.
    const todasAqui = s.offset === 0 && total <= rows.length;
    const bloque = tab === 'held' && nBloque
      ? `<div class="card"><p style="margin:0 0 8px"><b>${esc(I18N.t('El servicio no ha podido mirar estas fotos.'))}</b> ${esc(I18N.t('Se reintenta solo. Si lo has mirado y corre prisa:'))}</p>
         <button class="btn" type="button" id="medBloque">${esc(I18N.t('Aprobar en bloque'))}${todasAqui ? ` (${fmtNum(nBloque)})` : ''}</button></div>` : '';
    $('#list').innerHTML = rows.length || textos.length || listas.length
      ? bloque + listas.map(filaListas).join('') + textos.map((x, i) => filaTexto(x, i, tab)).join('') + (await firmaMedios(rows.flatMap((x) => [[x.name, x.in_held], ...(x.frames || []).map((f) => [f.name, f.in_held])])), await Promise.all(rows.map((x, i) => filaMedio(x, i, tab)))).join('') + pg.html
      : `<div class="tbl-wrap"><div class="empty">${esc(I18N.t(tab === 'held' ? 'No hay nada por decidir.' : 'El filtro no ha rechazado nada.'))}</div></div>`;
    if (rows.length || textos.length || listas.length) pg.bind($('#list'));
    const bb = $('#medBloque');
    if (bb) {
      bb.onclick = () => esperando(bb, async () => {
        if (!(await confirmDlg(I18N.t('¿Aprobar todas sin mirarlas una a una?'), `${I18N.t('Se publican sin que las haya mirado nadie más: mira antes las que puedas.')}${todasAqui ? '' : ` ${I18N.t('Son todas las que el servicio no ha podido mirar, también las de las otras páginas.')}`}`))) return;
        const b = await rpc('admin_media_approve_bulk', { p_reasons: ['cap', 'error'] });
        toast(`${I18N.t('Aprobadas')}: ${fmtNum(b.approved || 0)}`);
        refreshBadges();
        await load();
      });
    }
    $$('#list [data-lok]').forEach((b) => { b.onclick = () => esperando(b, async () => { if (await decideTexto(listas[+b.dataset.lok], true)) await load(); }); });
    $$('#list [data-lno]').forEach((b) => { b.onclick = () => esperando(b, async () => { if (await decideTexto(listas[+b.dataset.lno], false)) await load(); }); });
    const decideTxt = async (x, aprobar, motivo) => { if (await decideContenido(x, aprobar, motivo)) await load(); };
    $$('#list [data-tok]').forEach((b) => { b.onclick = () => esperando(b, () => decideTxt(textos[+b.dataset.tok], true)); });
    $$('#list [data-tno]').forEach((b) => {
      b.onclick = async () => {
        const motivo = await eligeMotivoMedio(MOTIVOS_TEXTO);
        if (motivo) await esperando(b, () => decideTxt(textos[+b.dataset.tno], false, motivo));
      };
    });
    const decide = async (x, aprobar, motivo) => { if (await decideMedio(x, aprobar, motivo)) await load(); };
    $$('#list [data-ok]').forEach((b) => { b.onclick = () => esperando(b, () => decide(rows[+b.dataset.ok], true)); });
    $$('#list [data-no]').forEach((b) => {
      b.onclick = async () => {
        const motivo = await eligeMotivoMedio();
        if (motivo) await esperando(b, () => decide(rows[+b.dataset.no], false, motivo));
      };
    });
    I18N.translate(v);
  };
  await load();
};

// «Límites gratis» en el Resumen (migración 20261265100002 de la app).
const LIM_UNIDAD = (x, n) => {
  const v = Number(n) || 0;
  if (x.unit === 'usd') return `${v.toFixed(2)} $`;
  if (x.unit !== 'bytes') return fmtNum(Math.round(v));
  return v >= 1024 ** 3 ? `${(v / 1024 ** 3).toFixed(1)} GB` : `${Math.round(v / 1024 ** 2)} MB`;
};
function tarjetaLimitesGratis(att) {
  const lista = att?.free_tier || [];
  if (!lista.length) return '';
  const en = I18N.lang === 'en';
  const avisar = att?.free_tier_cfg?.warn_pct ?? 80;
  const filas = lista.map((x) => {
    const pct = Math.min(100, Number(x.pct) || 0);
    const cls = x.level === 'over' ? 'bad' : x.level === 'warn' ? 'warn' : 'ok';
    return `<tr><td><b>${esc(x.service)}</b> <span class="muted small">${esc(I18N.t(x.metric))}</span></td>
      <td class="num">${esc(LIM_UNIDAD(x, x.used))} / ${esc(LIM_UNIDAD(x, x.limit))}</td>
      <td class="lim-barra"><span class="lim-fondo"><span class="lim-lleno ${cls}" style="width:${pct}%"></span></span></td>
      <td class="num"><span class="tag ${cls}">${esc(String(Math.round(Number(x.pct) || 0)))} %</span></td></tr>`;
  }).join('');
  return `<div class="card" id="limitesGratis"><h2>${ms('speed')} ${en ? 'Free limits' : 'Límites gratis'}</h2>
    <p class="muted" style="margin:0 0 10px">${en ? `An email at ${avisar} % and at 100 %, once per period. What only each provider knows is in docs/SERVICIOS_Y_COSTES.md.` : `Un correo al ${avisar} % y al 100 %, una vez por periodo. Lo que solo sabe cada proveedor está en docs/SERVICIOS_Y_COSTES.md.`}</p>
    <div class="tbl-wrap"><table><tbody>${filas}</tbody></table></div></div>`;
}
