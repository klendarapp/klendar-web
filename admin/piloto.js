/* Administración → «Lo que se ha hecho solo» (Resumen) y Sistema → «Automático» (migración
 * 20261269500000 de la app; docs/PILOTO_AUTOMATICO.md).
 *
 * El administrador es una sola persona y solo debe ver excepciones. Aquí: el recuento y el
 * deshacer de lo hecho solo, los interruptores (todo apagado de serie), las dos listas editables y por
 * qué algo ha llegado a Iván (`motivosAuto`, en las demás colas).
 *
 * Va después de admin.js y usa lo suyo (`PAGES`, `rpc`, `esc`, `ms`, `tag`, `toast`…).
 */
'use strict';

const QUE_HECHO = {
  verify_business: ['negocio verificado', 'negocios verificados', 'business verified', 'businesses verified'],
  verify_entity: ['entidad verificada', 'entidades verificadas', 'organisation verified', 'organisations verified'],
  claim_code: ['reclamación resuelta con código', 'reclamaciones resueltas con código', 'claim settled with a code', 'claims settled with a code'],
  claim_document: ['reclamación resuelta con documento', 'reclamaciones resueltas con documento', 'claim settled with a document', 'claims settled with a document'],
  report_close: ['denuncia cerrada sin nada', 'denuncias cerradas sin nada', 'report closed, nothing found', 'reports closed, nothing found'],
  report_hide: ['contenido oculto tras una denuncia', 'contenidos ocultos tras una denuncia', 'item hidden after a report', 'items hidden after a report'],
  report_hold_grave: ['contenido grave oculto (míralo)', 'contenidos graves ocultos (míralos)', 'serious item hidden (check it)', 'serious items hidden (check them)'],
  venue_group: ['local pedido agrupado', 'locales pedidos agrupados', 'requested place grouped', 'requested places grouped'],
};

// Por qué ha llegado a ti: los códigos de `piloto_*_check`.
const MOTIVO_AUTO = {
  tax_id: ['NIF ausente o con la letra mal', 'Tax ID missing or wrong check letter'],
  tax_id_taken: ['su NIF lo usa un negocio de otra persona', 'tax ID used by someone else’s business'],
  tax_kind: ['la letra del CIF no es de esa clase de entidad', 'tax ID letter does not fit that kind of organisation'],
  contact_unconfirmed: ['sin correo ni móvil confirmado', 'no confirmed email or phone'],
  owner_banned: ['cuenta suspendida', 'suspended account'],
  owner_history: ['tiene otro negocio rechazado', 'has another rejected business'],
  owner_limit: ['varias altas de la misma cuenta', 'several sign-ups from one account'],
  day_limit: ['tope del día', 'daily cap'],
  minimum_profile: ['ficha incompleta', 'incomplete page'],
  duplicate: ['posible duplicado', 'possible duplicate'],
  contact_taken: ['teléfono, web o correo de otro negocio', 'phone, website or email of another business'],
  text_flagged: ['nombre marcado por la moderación', 'name flagged by moderation'],
  brand: ['se parece a una marca conocida', 'looks like a known brand'],
  review_only: ['ficha de revisión', 'review page'],
  rejected_before: ['ya se le rechazó', 'already rejected once'],
  withdrawn_before: ['ya se le retiró', 'already withdrawn once'],
  no_proof: ['sin dominio oficial ni documento leído', 'no official domain or read document'],
  document_pending: ['leyendo el documento', 'reading the document'],
  document_no_coincide: ['el documento no coincide', 'the document does not match'],
  document_dudoso: ['documento dudoso', 'doubtful document'],
  document_not_matching: ['el documento no coincide', 'the document does not match'],
  document_off: ['leer documentos apagado', 'document reading off'],
  no_access: ['dice que no tiene acceso al correo', 'says they have no access to the email'],
  no_proof_in_time: ['no lo ha demostrado a tiempo', 'did not prove it in time'],
  not_proved: ['sin código comprobado', 'no checked code'],
  no_contact: ['la ficha no tiene correo', 'no email on the page'],
  contact_recent: ['el correo de la ficha es reciente', 'the page’s email is recent'],
  auto_verified: ['negocio verificado solo hace poco', 'recently auto-verified business'],
  team_member: ['ya está en el equipo', 'already on the team'],
  claimant_banned: ['cuenta suspendida', 'suspended account'],
  other_claims: ['hay otra reclamación abierta', 'another open claim'],
  undone_before: ['ya se deshizo un traspaso', 'a handover was already undone'],
  owner_active: ['el dueño está activo', 'the owner is active'],
  paid: ['el negocio ha pagado', 'the business has paid'],
  has_team: ['tiene equipo', 'has a team'],
  entity: ['es una entidad', 'is an organisation'],
};
const COD_DOC = {
  ok: ['todo cuadra', 'everything matches'], nif_distinto: ['otro NIF', 'another tax ID'], nombre_distinto: ['otro nombre', 'another name'],
  nombre: ['el nombre no cuadra del todo', 'the name does not fully match'], sin_nif: ['el documento no dice el NIF', 'the document has no tax ID'],
  direccion: ['otra dirección', 'another address'], sin_nif_ni_direccion: ['sin NIF ni dirección que comparar', 'no tax ID or address to compare'],
  tipo_documento: ['no es un documento de los que valen', 'not an accepted kind of document'], ilegible: ['no se lee', 'unreadable'],
  instrucciones: ['lleva instrucciones dentro (¡ojo!)', 'contains instructions (careful!)'], formato: ['formato que no se puede leer', 'unreadable format'],
  muy_grande: ['demasiado grande', 'too large'], no_disponible: ['la IA no estaba disponible', 'AI not available'], fallo: ['la IA ha fallado', 'AI failed'], rechazado: ['el modelo no ha querido', 'the model declined'],
};
const POR_QUE_DENUNCIA = {
  doubt: ['la IA duda', 'the AI is unsure'], low_confidence: ['la IA no está segura', 'the AI is not sure'], many_voices: ['varias personas lo denuncian', 'several people reported it'],
  hidden_by_voices: ['ya está oculto por las denuncias', 'already hidden by reports'], grave_reason: ['denuncia grave: la decide una persona', 'serious report: a person decides'],
  norm: ['sin una norma con la que motivarlo', 'no rule to justify it'], type_not_hideable: ['eso no se oculta solo', 'that is not hidden automatically'],
  ai_unavailable: ['IA no disponible o en el tope', 'AI unavailable or at its cap'], no_consent: ['sin permiso de quien lo publicó', 'no permission from whoever published it'],
  already_removed: ['ya estaba retirado', 'already removed'], grave: ['grave: oculto y a ti', 'serious: hidden and sent to you'],
  child_abuse_no_ai: ['abuso sexual infantil: sin pasar por la IA', 'child sexual abuse: not sent to the AI'], child_abuse_low_weight: ['abuso sexual infantil, voz sin peso', 'child sexual abuse, low-weight voice'],
};

const motivosAuto = (lista) => {
  const en = I18N.lang === 'en';
  if (!lista?.length) return '';
  const txt = lista.map((c) => (MOTIVO_AUTO[c] ? MOTIVO_AUTO[c][en ? 1 : 0] : c)).join(' · ');
  return `<div class="meta">${en ? 'Why it came to you' : 'Por qué te llega'}: ${esc(txt)}</div>`;
};

function lineaDocumento(d) {
  if (!d) return '';
  const en = I18N.lang === 'en';
  if (d.state === 'pending') return `<div class="meta">${en ? 'Reading the document…' : 'Leyendo el documento…'}</div>`;
  const cls = d.verdict === 'coincide' ? 'ok' : d.verdict === 'no_coincide' ? 'bad' : 'warn';
  const q = { coincide: en ? 'matches' : 'coincide', no_coincide: en ? 'does not match' : 'no coincide', dudoso: en ? 'doubtful' : 'dudoso' }[d.verdict] || d.verdict;
  const m = COD_DOC[d.motive] ? COD_DOC[d.motive][en ? 1 : 0] : d.motive;
  return `<div class="meta">${en ? 'AI document reading' : 'Lectura del documento con IA'}: <span class="tag ${cls}">${esc(q)}</span> ${esc(m || '')}</div>`;
}

function lineaDenunciaIA(ai) {
  if (!ai?.decided_at) return '';
  const en = I18N.lang === 'en';
  const q = { nada: en ? 'nothing wrong' : 'nada', ocultar: en ? 'hide' : 'ocultar', dudoso: en ? 'doubtful' : 'dudoso', grave: en ? 'serious' : 'grave' }[ai.verdict] || (en ? 'not read' : 'sin leer');
  const m = POR_QUE_DENUNCIA[ai.why] ? POR_QUE_DENUNCIA[ai.why][en ? 1 : 0] : '';
  return `<div class="meta">${en ? 'AI reading' : 'Lectura con IA'}: <b>${esc(q)}</b>${ai.confidence != null && ai.verdict ? ` (${Math.round(Number(ai.confidence) * 100)} %)` : ''}${m ? ` · ${esc(m)}` : ''}${ai.reason ? ` · ${esc(ai.reason)}` : ''}</div>`;
}

const MOTIVOS_DESHACER = [
  ['impersonation', 'No se ha podido confirmar que sea suyo', 'Could not confirm it is theirs'],
  ['data', 'Los datos de la ficha no cuadran', 'The page details do not add up'],
  ['other', 'Hay que comprobarlo a mano', 'It needs checking by hand'],
];

function filaHecho(a) {
  const en = I18N.lang === 'en';
  const q = QUE_HECHO[a.kind] || [a.kind, a.kind, a.kind, a.kind];
  const enlace = a.business_id ? `#/negocios/${esc(a.business_id)}` : (a.kind.startsWith('report') ? `#/denuncias/${esc(a.target_type)}/${esc(a.target_id)}` : '');
  const nombre = a.kind.startsWith('report') ? '' : esc(a.label || '');
  const adversa = ['verify_business', 'verify_entity', 'claim_code', 'claim_document'].includes(a.kind);
  const accion = a.undone_at
    ? `<span class="tag dim">${en ? 'undone' : 'deshecho'}</span>`
    : a.undoable
      ? `${adversa ? `<select class="sm" data-motivo="${esc(a.id)}" aria-label="${en ? 'Reason' : 'Motivo'}">${MOTIVOS_DESHACER.map(([v, es, e]) => `<option value="${v}">${esc(en ? e : es)}</option>`).join('')}</select>` : ''}
         <button class="btn sm" type="button" data-deshacer="${esc(a.id)}" data-tipo="${esc(a.kind)}">${en ? 'Undo' : 'Deshacer'}</button>`
      : '';
  return `<div class="item" style="grid-template-columns:1fr"><div style="min-width:0">
      <div class="meta"><b>${esc(en ? q[2] : q[0])}</b>${nombre ? ` · ${enlace ? `<a class="link" href="${enlace}">${nombre}</a>` : nombre}` : (enlace ? ` · <a class="link" href="${enlace}">${en ? 'see' : 'ver'}</a>` : '')} · ${esc(ago(a.created_at))}${a.ai ? ' · IA' : ''}</div>
      ${accion ? `<div class="actions">${accion}</div>` : ''}
    </div></div>`;
}

function tarjetaHechoSolo(d) {
  if (!d) return '';
  const en = I18N.lang === 'en';
  const cfg = d.config || {};
  const encendido = Object.values(cfg).some((x) => x && x.enabled);
  const sem = d.week || {};
  const filas = (d.actions || []).slice(0, 6);
  if (!encendido && !filas.length) return '';
  const cifras = Object.entries(sem.by_kind || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => `<li><b>${fmtNum(n)}</b> ${esc((QUE_HECHO[k] || [k, k, k, k])[(en ? 2 : 0) + (n === 1 ? 0 : 1)])}</li>`).join('');
  return `<div class="card" id="hechoSolo"><h2>${ms('auto_awesome')} ${en ? 'What was done automatically' : 'Lo que se ha hecho solo'}</h2>
    ${cifras ? `<p class="muted small" style="margin:0 0 6px">${en ? 'Last 7 days' : 'Últimos 7 días'}</p><ul class="pend-lista" style="margin:0 0 10px">${cifras}</ul>` : `<p class="muted" style="margin:0 0 8px">${en ? 'Nothing in the last 7 days.' : 'Nada en los últimos 7 días.'}</p>`}
    ${filas.map(filaHecho).join('')}
    <p style="margin:8px 0 0"><a class="link" href="#/automatico">${en ? 'See everything and the switches' : 'Ver todo y los interruptores'}</a></p></div>`;
}

function activaDeshacer(v) {
  const en = I18N.lang === 'en';
  $$('[data-deshacer]', v).forEach((b) => {
    b.onclick = () => esperando(b, async () => {
      // Devolver un negocio a su dueño pide «Confirma que eres tú», como cualquier traspaso.
      if (b.dataset.tipo.startsWith('claim') && !await confirmaIdentidad()) return;
      const m = $(`[data-motivo="${b.dataset.deshacer}"]`, v)?.value || 'other';
      await rpc('admin_piloto_undo', { p_id: b.dataset.deshacer, p_motive: m });
      toast(en ? 'Undone: notified, with the reason' : 'Deshecho: avisado, con el motivo');
      refreshBadges();
      route();
    });
  });
}

const PARTES = [
  ['verify_business', 'Verificar negocios', 'Verify businesses', 'NIF con letra válida, correo o móvil confirmado, ficha mínima, sin duplicado, nombre limpio, sin marca conocida. Lo demás, a ti.', 'Valid tax ID, confirmed email or phone, minimum page, no duplicate, clean name, no known brand. The rest goes to you.'],
  ['verify_entity', 'Verificar entidades', 'Verify organisations', 'Correo confirmado de un dominio oficial de la lista, o documento que coincide. CIF con letra válida y de su clase.', 'Confirmed email on a listed official domain, or a matching document. Valid tax ID of the right kind.'],
  ['claim_code', '«¿Es tu negocio?» con código', '“Is this your business?” with a code', 'Código al correo publicado en la ficha. Se resuelve solo si el dueño no está activo, no paga, no hay equipo y el correo no es reciente. Con teléfono no: falta proveedor de SMS.', 'Code to the email published on the page. Settled automatically if the owner is inactive and not paying, with no team and no recent email change. Not by phone: no SMS provider.'],
  ['claim_document', '«¿Es tu negocio?» con documento', '“Is this your business?” with a document', 'El documento coincide y se cumple lo demás. Es lo más arriesgado: un documento se puede falsificar.', 'The document matches and the rest holds. The riskiest one: a document can be forged.'],
  ['document_review', 'Leer documentos con IA', 'Read documents with AI', 'Claude Haiku lee nombre, NIF y dirección; compara el código, no el modelo; no se guarda lo leído. Solo con el permiso de quien lo sube.', 'Claude Haiku reads name, tax ID and address; the code compares, not the model; what it reads is not kept. Only with the uploader’s permission.'],
  ['report_review', 'Revisar denuncias con IA', 'Review reports with AI', 'Cierra lo claro y oculta lo claro (reversible, con aviso). Lo dudoso y lo grave, a ti. Los recursos, siempre una persona.', 'Closes what is clear and hides what is clear (reversible, with a notice). Doubtful and serious, to you. Appeals, always a person.'],
  ['report_reliability', 'Peso de quien denuncia', 'Weight of reporters', 'Quien denuncia en falso de forma repetida deja de contar para ocultar solo, con aviso previo. Se le sigue leyendo.', 'Whoever repeatedly reports falsely stops counting towards automatic hiding, after a warning. Still read.'],
  ['duplicates', 'Duplicados seguros', 'Safe duplicates', 'Marca los que coinciden en nombre, dirección y teléfono o web. Unir borra una ficha y no se puede deshacer: lo decides tú, con un toque.', 'Marks those matching on name, address and phone or website. Merging deletes a page and cannot be undone: you decide, in one tap.'],
  ['venue_weekly', 'Ranking semanal de locales pedidos', 'Weekly ranking of requested places', 'Agrupa «Pedir un local» y manda el ranking los lunes al correo de administración.', 'Groups “Request a place” and emails the ranking on Mondays.'],
];

PAGES.automatico = async (v) => {
  const en = I18N.lang === 'en';
  const d = await rpc('admin_piloto_overview', { p_limit: 100 });
  const cfg = d.config || {};
  const euros = (n) => `${Number(n || 0).toLocaleString(LOC(), { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €`;
  const ia = d.ai || {};
  v.innerHTML = `
    <div class="page-head"><h1>${en ? 'Automatic' : 'Automático'}</h1></div>
    ${helpBox(en ? 'What do I do here?' : '¿Qué hago aquí?', en
    ? '<p>What Klendar can do alone so that only exceptions reach you. Everything starts off. <b>Before switching on</b>: the PA texts of <code>LEGAL_PENDIENTE</code> must be approved and published (RUNBOOK §4zf). A switch with AI also switches its use in the shared AI piece, with its cap.</p>'
    : '<p>Lo que Klendar puede hacer solo para que te lleguen solo las excepciones. Todo empieza apagado. <b>Antes de encender</b>: aprobar y publicar los textos PA de <code>LEGAL_PENDIENTE</code> (RUNBOOK §4zf). Un interruptor con IA enciende también su uso en la pieza común, con su tope.</p>')}
    <div class="card"><h2>${en ? 'Switches' : 'Interruptores'}</h2>
      ${PARTES.map(([k, es, e, de, den]) => {
    const on = !!cfg[k]?.enabled;
    const gasto = ia[k] ? `<div class="meta">${en ? 'This month' : 'Este mes'}: ${esc(euros(ia[k].spent_eur))} / ${esc(euros(ia[k].cap_eur))}</div>` : '';
    return `<div class="item" style="grid-template-columns:1fr auto"><div style="min-width:0"><h3>${esc(en ? e : es)} <span class="tag ${on ? 'ok' : 'dim'}">${on ? (en ? 'on' : 'encendido') : (en ? 'off' : 'apagado')}</span></h3>
        <div class="meta">${esc(en ? den : de)}</div>${gasto}</div>
        <div><button class="btn sm${on ? '' : ' ok'}" type="button" data-parte="${k}" data-on="${on ? '1' : ''}">${on ? (en ? 'Switch off' : 'Apagar') : (en ? 'Switch on' : 'Encender')}</button></div></div>`;
  }).join('')}
    </div>
    <div class="grid2" style="margin-top:12px">
      <div class="card" id="listaMarcas"><h2>${en ? 'Known brands' : 'Marcas conocidas'} <span class="badge">${fmtNum(d.lists?.brand || 0)}</span></h2><div data-lista="brand"><div class="loading"></div></div></div>
      <div class="card" id="listaDominios"><h2>${en ? 'Official domains' : 'Dominios oficiales'} <span class="badge">${fmtNum(d.lists?.official_domain || 0)}</span></h2><div data-lista="official_domain"><div class="loading"></div></div></div>
    </div>
    <div class="card" style="margin-top:12px"><h2>${en ? 'What was done automatically' : 'Lo que se ha hecho solo'}</h2>
      ${(d.actions || []).length ? d.actions.map(filaHecho).join('') : `<p class="muted" style="margin:0">${en ? 'Nothing yet.' : 'Nada todavía.'}</p>`}
    </div>`;
  activaDeshacer(v);
  $$('[data-parte]', v).forEach((b) => {
    b.onclick = () => esperando(b, async () => {
      const on = !b.dataset.on;
      const p = PARTES.find((x) => x[0] === b.dataset.parte);
      if (on && !await confirmDlg(en ? `Switch on: ${p[2]}` : `Encender: ${p[1]}`, esc(en
        ? 'From now on Klendar decides this alone. Are the PA texts published and the lawyer’s questions answered?'
        : 'A partir de ahora Klendar lo decide solo. ¿Están publicados los textos PA y contestadas las preguntas al abogado?'), { submit: en ? 'Switch on' : 'Encender' })) return;
      await rpc('admin_piloto_set', { p_part: b.dataset.parte, p_enabled: on });
      toast(on ? (en ? 'On' : 'Encendido') : (en ? 'Off' : 'Apagado'));
      route();
    });
  });
  const pintaLista = async (caja) => {
    const kind = caja.dataset.lista;
    const filas = await rpc('admin_piloto_list', { p_kind: kind });
    caja.innerHTML = `<form class="toolbar" data-anade><input class="grow" name="v" required maxlength="120" placeholder="${kind === 'brand' ? (en ? 'A brand…' : 'Una marca…') : (en ? 'a-domain.es' : 'un-dominio.es')}" aria-label="${en ? 'Add' : 'Añadir'}"><button class="btn sm ok">${en ? 'Add' : 'Añadir'}</button></form>
      <div class="tags-lista">${filas.map((x) => `<span class="tag dim">${esc(x.value)} <button type="button" class="linkbtn" data-quita="${esc(x.id)}" aria-label="${en ? 'Remove' : 'Quitar'} ${esc(x.value)}">×</button></span>`).join(' ')}</div>`;
    $('[data-anade]', caja).onsubmit = async (e) => {
      e.preventDefault();
      try {
        await rpc('admin_piloto_list_add', { p_kind: kind, p_value: e.target.elements.v.value, p_note: null });
        pintaLista(caja);
      } catch (x) { toast(x.message === 'invalid_domain' ? (en ? 'That domain is not valid here' : 'Ese dominio no vale aquí') : x.message, true); }
    };
    $$('[data-quita]', caja).forEach((q) => { q.onclick = async () => {
      try { await rpc('admin_piloto_list_remove', { p_id: q.dataset.quita }); pintaLista(caja); } catch (x) { toast(x.message, true); }
    }; });
  };
  $$('[data-lista]', v).forEach(pintaLista);
};
