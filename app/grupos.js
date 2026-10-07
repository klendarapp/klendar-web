/* «Tu cuenta» → «Grupos y empresas» (tanda C; migración
 * 20261208100000_grupos_y_empresas de la app). Lo mismo que la app:
 *
 * - `#/grupos/pedir?b=<id>,<id>`: «Pedir presupuesto» a 1–3 negocios
 *   (`create_group_request`). Llega de la lista pública (/grupos/) o de la
 *   ficha de un negocio; pide entrar. Las mismas validaciones que la base.
 * - `#/grupos`: «Tus peticiones» (`my_group_requests`).
 * - `#/grupos/<id>`: la petición, con lo que ha contestado cada negocio;
 *   «Aceptar esta propuesta» (hoja: correo o teléfono, `accept_group_proposal`)
 *   y «Retirar la petición» (`cancel_group_request`).
 *
 * Los textos, de /assets/textos-grupos.js (los mismos que la web pública y
 * el panel). Va después de app.js y usa lo suyo (`RUTAS`, `llamar`, `pinta`,
 * `esc`, `ic`, `toast`, `exigeSesion`, `confirma`, `ocupado`,
 * `pantallaVacia`…). Comparten ámbito: los nombres de aquí empiezan por
 * `grupo`.
 */
'use strict';

const KGr = globalThis.KlendarGrupos;
const grupoLang = () => (EN ? 'en' : 'es');
const GS = () => KGr.t(grupoLang());
const GRUPO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const grupoLista = () => (EN ? '/en/groups/' : '/grupos/');
/** groups (Material Symbols, Apache 2.0): no está en la fuente recortada. */
const GRUPO_SVG = 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z';
const grupoIc = (s = 30) => `<svg class="ms-svg" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${GRUPO_SVG}"/></svg>`;
/** Lo elegido en la lista pública (la misma clave que /assets/grupos.js). */
const GRUPO_ELEGIDOS = 'klendar.grupos.elegidos';
/** Una pantalla vacía con el icono de grupos. */
const grupoVacio = (o) => pantallaVacia(o).replace('<section class="vacio">', `<section class="vacio"><span class="vacio-ic">${grupoIc()}</span>`);
const grupoGuardaElegidos = (ids) => { try { sessionStorage.setItem(GRUPO_ELEGIDOS, JSON.stringify(ids)); } catch { /* sin almacenamiento */ } };

/** El error de la base en palabras (con el nombre del negocio si lo trae). */
const grupoError = (e) => KGr.error(e?.clave, grupoLang(), e?.datos) || e?.message || amable('');

RUTAS.grupos = async ([sub], params) => {
  if (sub === 'pedir') return grupoPedir(params);
  if (sub && GRUPO_UUID.test(sub)) return grupoDetalle(sub.toLowerCase());
  return grupoPeticiones();
};

// ── «Pedir presupuesto» ───────────────────────────────────────────────────
async function grupoPedir(params) {
  const S = GS();
  const L = grupoLang();
  const ids = [...new Set(String(params.get('b') || '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => GRUPO_UUID.test(x)))].slice(0, 3);
  if (!exigeSesion(`grupos/pedir?b=${ids.join(',')}`)) return;
  if (!ids.length) {
    pinta(grupoVacio({ titulo: S.formTitle, h: 'h1', texto: S.noBusinesses,
      botones: `<a class="pill accent" href="${grupoLista()}">${esc(S.title)}</a>` }));
    return;
  }
  const [infos, filas] = await Promise.all([
    Promise.all(ids.map((id) => llamar('business_group_info', { p_business: id }).catch(() => null))),
    sb.from('businesses').select('id,name,slug,logo_url,city').in('id', ids).then((r) => r.data || [], () => []),
  ]);
  const negocios = ids.map((id, i) => {
    const f = filas.find((x) => x.id === id) || { id, name: '' };
    const info = infos[i];
    return { ...f, info: info && info.max_people ? info : null };
  }).filter((n) => n.name);
  const fuera = negocios.filter((n) => !n.info);
  const validos = negocios.filter((n) => n.info);
  grupoGuardaElegidos(validos.map((n) => n.id));
  if (!validos.length) {
    pinta(grupoVacio({ titulo: S.formTitle, h: 'h1',
      texto: fuera.length ? KGr.error('business_not_accepting', L, { business: fuera.map((n) => n.name).join(', ') }) : S.noBusinesses,
      botones: `<a class="pill accent" href="${grupoLista()}">${esc(S.title)}</a>` }));
    return;
  }
  // Desde mañana y como mucho a un año (en la hora de la península, como la base).
  const manana = KZ.hoy('Europe/Madrid', 1);
  const enUnAno = KZ.hoy('Europe/Madrid', 365);
  const maxPersonas = Math.min(...validos.map((n) => n.info.max_people));
  const chips = validos.map((n) => `<span class="grupo-para">
      ${/^https:\/\//.test(n.logo_url || '') ? `<img src="${esc(n.logo_url)}" alt="" width="28" height="28">` : `<span class="ph" aria-hidden="true">${esc(n.name.charAt(0).toUpperCase())}</span>`}
      <b>${esc(n.name)}</b>
      ${validos.length > 1 ? `<button type="button" class="grupo-quita" data-quita="${esc(n.id)}" aria-label="${esc(S.remove(n.name))}">×</button>` : ''}
    </span>`).join('');
  const otro = validos.length < 3 ? `<a class="grupo-otro" href="${esc(`${grupoLista()}?b=${validos.map((n) => n.id).join(',')}`)}">+ ${esc(S.addOther)}</a>` : '';
  pinta(`
    <p class="crumbs"><a href="${grupoLista()}">${esc(S.title)}</a></p>
    <h1>${esc(S.formTitle)}</h1>
    ${fuera.length ? `<p class="err">${esc(KGr.error('business_not_accepting', L, { business: fuera.map((n) => n.name).join(', ') }))}</p>` : ''}
    <form class="formu" id="f-grupo" novalidate>
      <fieldset class="grupo-campo"><legend>${esc(S.to)}</legend>
        <div class="grupo-paras">${chips}${otro}</div></fieldset>
      <fieldset class="grupo-campo" id="grupo-tipos"><legend>${esc(S.what)}</legend>
        <div class="grupo-tipos">${KGr.KINDS.map((k) => `<label class="chip-radio"><input type="radio" name="kind" value="${k}"><span>${esc(KGr.singular(k, L))}</span></label>`).join('')}</div></fieldset>
      <label>${esc(S.date)}<input type="date" name="date" min="${manana}" max="${enUnAno}" required></label>
      <label>${esc(S.howMany)}<input type="number" name="people" inputmode="numeric" min="2" max="${maxPersonas}" required></label>
      <label>${esc(S.budget)}<input name="budget" inputmode="decimal" maxlength="9" placeholder="${EN ? '25.00' : '25,00'}"></label>
      <label>${esc(S.note)} <small>${esc(S.noteHelp)}</small>
        <textarea name="note" rows="4" maxlength="500"></textarea></label>
      <p class="muted nota">${esc(S.privacy)}</p>
      <p class="err" id="grupo-err" role="alert"></p>
      <button class="pill accent" id="grupo-enviar">${esc(S.send)}</button>
    </form>`);
  const f = $('#f-grupo');
  $$('[data-quita]', f).forEach((b) => b.addEventListener('click', () => {
    const resto = validos.map((n) => n.id).filter((x) => x !== b.dataset.quita);
    grupoGuardaElegidos(resto);
    history.replaceState(null, '', `${location.pathname}${location.search}#/grupos/pedir?b=${resto.join(',')}`);
    navegar();
  }));
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const err = $('#grupo-err');
    err.textContent = '';
    const el = f.elements;
    const kind = f.querySelector('input[name=kind]:checked')?.value || '';
    const people = Number(el.people.value);
    const fecha = el.date.value;
    const budgetTxt = el.budget.value.trim().replace(/[\s€]/g, '').replace(',', '.');
    let falla = '';
    let campo = null;
    if (!kind) { falla = KGr.error('bad_kind', L); campo = f.querySelector('input[name=kind]'); }
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < manana || fecha > enUnAno) { falla = KGr.error('bad_date', L); campo = el.date; }
    else if (!Number.isInteger(people) || people < 2 || people > 500) { falla = KGr.error('bad_people', L); campo = el.people; }
    else if (budgetTxt && !/^\d{1,4}(\.\d{1,2})?$/.test(budgetTxt)) { falla = KGr.error('bad_budget', L); campo = el.budget; }
    if (!falla) {
      // Como la base, negocio a negocio: que acepte ese plan y quepa el grupo.
      for (const n of validos) {
        if (!(n.info.kinds || []).includes(kind)) { falla = KGr.error('kind_not_accepted', L, { business: n.name }); break; }
        if (people > n.info.max_people) { falla = KGr.error('too_many_people', L, { business: n.name, max_people: n.info.max_people }); campo = el.people; break; }
      }
    }
    if (falla) {
      err.textContent = falla;
      campo?.focus();
      return;
    }
    ocupado($('#grupo-enviar'), async () => {
      try {
        const r = await llamar('create_group_request', {
          p_businesses: validos.map((n) => n.id), p_kind: kind, p_date: fecha, p_people: people,
          p_budget_cents: budgetTxt ? Math.round(Number(budgetTxt) * 100) : null,
          p_note: el.note.value.trim() || null,
        });
        grupoGuardaElegidos([]);
        hecho({
          titulo: S.sent, texto: '',
          volver: `#/grupos/${r.id}`, volverTxt: S.seeRequest,
          lista: '#/grupos', listaTxt: S.yourRequests,
        });
      } catch (e) {
        err.textContent = grupoError(e);
      }
    });
  });
}

// ── «Tus peticiones» ──────────────────────────────────────────────────────
async function grupoPeticiones() {
  if (!exigeSesion('grupos')) return;
  const S = GS();
  const L = grupoLang();
  const lista = (await llamar('my_group_requests', {})) || [];
  const cabeza = `<p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a> · <a href="${grupoLista()}">${esc(S.title)}</a></p>
    <h1>${esc(S.yourRequests)}</h1>`;
  if (!lista.length) {
    pinta(`${cabeza}${grupoVacio({ titulo: S.requestsEmptyTitle, texto: S.requestsEmptyText,
      botones: `<a class="pill accent" href="${grupoLista()}">${esc(S.title)}</a>` })}`);
    return;
  }
  pinta(`${cabeza}
    <div class="olist">${lista.map((r) => `<a class="ocard grupo-pet" href="#/grupos/${esc(r.id)}">
      <span class="ph">${grupoIc(24)}</span>
      <span class="ocard-body"><b>${esc(KGr.linea(r, L))}</b>
        <span class="muted">${esc((r.targets || []).map((x) => x.business?.name).filter(Boolean).join(', '))}</span>
        <span class="ocard-meta"><span class="tag off">${esc(S.status[r.status] || r.status)}</span></span>
      </span>
      ${ic('chevron_right')}
    </a>`).join('')}</div>
    <p class="acciones"><a class="pill" href="${grupoLista()}">${esc(S.title)}</a></p>`);
}

// ── Una petición ──────────────────────────────────────────────────────────
function grupoEstadoTarget(x, r, S, L) {
  const pend = x.status === 'pending' && new Date(x.respond_by) > new Date();
  switch (x.status) {
    case 'pending': return pend ? S.waiting(KGr.cuando(x.respond_by, L)) : S.noReply;
    case 'proposed': return S.proposal;
    case 'declined': return S.declined;
    case 'expired': return S.noReply;
    case 'accepted': return S.acceptedShared(x.shared);
    // «Eligió otra» no se enseña a quien pidió: para ella, «No elegida».
    case 'not_chosen': return S.notChosen;
    case 'withdrawn': return S.withdrawn;
    default: return '';
  }
}

async function grupoDetalle(id) {
  if (!exigeSesion(`grupos/${id}`)) return;
  const S = GS();
  const L = grupoLang();
  const r = await llamar('group_request_detail', { p_request: id });
  if (!r || !r.id) {
    pinta(grupoVacio({ titulo: S.notFound, h: 'h1', botones: `<a class="pill accent" href="#/grupos">${esc(S.yourRequests)}</a>` }));
    return;
  }
  const abierta = r.status === 'open';
  const tarjeta = (x) => {
    const b = x.business || {};
    const conPropuesta = ['proposed', 'accepted', 'not_chosen'].includes(x.status) && x.proposal;
    return `<article class="grupo-resp">
      <a class="grupo-resp-neg" href="${pre}/b/${esc(b.slug || b.id)}">
        ${/^https:\/\//.test(b.logo_url || '') ? `<img src="${esc(b.logo_url)}" alt="" width="40" height="40">` : `<span class="ph" aria-hidden="true">${esc((b.name || '·').charAt(0).toUpperCase())}</span>`}
        <span><b>${esc(b.name || '')}</b>${b.city ? `<small class="muted">${esc(b.city)}</small>` : ''}</span></a>
      <p class="grupo-resp-estado"><b>${esc(grupoEstadoTarget(x, r, S, L))}</b></p>
      ${x.status === 'declined' && x.decline_reason ? `<p class="muted">${esc(x.decline_reason)}</p>` : ''}
      ${conPropuesta ? `<div class="grupo-propuesta">
        <p>${esc(x.proposal).replace(/\n/g, '<br>')}</p>
        ${x.price_pp_cents != null ? `<p><b>${esc(S.perPerson(KGr.dinero(x.price_pp_cents, L)))}</b></p>` : ''}
        ${x.conditions ? `<p class="muted">${esc(x.conditions).replace(/\n/g, '<br>')}</p>` : ''}
      </div>` : ''}
      ${abierta && x.status === 'proposed' ? `<button type="button" class="pill accent" data-acepta="${esc(x.id)}" data-nombre="${esc(b.name || '')}">${esc(S.accept)}</button>` : ''}
    </article>`;
  };
  pinta(`
    <p class="crumbs"><a href="#/grupos">${esc(S.yourRequests)}</a></p>
    <h1>${esc(KGr.linea(r, L))}</h1>
    <p class="ocard-meta"><span class="tag off">${esc(S.status[r.status] || r.status)}</span></p>
    ${r.budget_cents != null ? `<p class="muted">${esc(S.about(KGr.dinero(r.budget_cents, L)))}</p>` : ''}
    ${r.note ? `<p class="muted">«${esc(r.note)}»</p>` : ''}
    <div class="grupo-resps">${(r.targets || []).map(tarjeta).join('')}</div>
    ${abierta ? `<p class="acciones"><button type="button" class="pill" id="grupo-retira">${esc(S.withdraw)}</button></p>` : ''}`);

  $$('[data-acepta]').forEach((b) => b.addEventListener('click', () => grupoAcepta(b.dataset.acepta, b.dataset.nombre, id)));
  $('#grupo-retira')?.addEventListener('click', async () => {
    if (!await confirma({ titulo: S.withdrawQ, aceptar: S.withdraw, peligro: true })) return;
    try {
      await llamar('cancel_group_request', { p_request: id });
      toast(S.withdrawn2);
      navegar();
    } catch (e) { toast(grupoError(e), true); }
  });
}

/** La hoja de aceptar: «¿Cómo quieres que te contacte X?» con «Mi correo
 * (…)» o «Un teléfono». */
function grupoAcepta(target, nombre, peticion) {
  const S = GS();
  const correo = YO?.email || '';
  const d = document.createElement('dialog');
  d.className = 'dialogo grupo-hoja';
  d.setAttribute('aria-labelledby', 'grupo-hoja-t');
  d.innerHTML = `<form method="dialog" class="formu" novalidate>
      <h2 id="grupo-hoja-t">${esc(S.sheetTitle(nombre))}</h2>
      <label class="check"><input type="radio" name="share" value="email"${correo ? ' checked' : ' disabled'}> ${esc(S.myEmail(correo || '—'))}</label>
      <label class="check"><input type="radio" name="share" value="phone"${correo ? '' : ' checked'}> ${esc(S.aPhone)}</label>
      <label class="grupo-tel"${correo ? ' hidden' : ''}>${esc(S.phone)}<input type="tel" name="phone" autocomplete="tel" maxlength="24" inputmode="tel"></label>
      <p class="muted">${esc(S.sheetNote(nombre))}</p>
      <p class="err" role="alert"></p>
      <div class="dialogo-botones">
        <button type="button" class="pill" value="no">${esc(t('Cancelar'))}</button>
        <button type="submit" class="pill accent" value="si">${esc(S.acceptShare)}</button>
      </div></form>`;
  document.body.appendChild(d);
  const f = d.querySelector('form');
  const tel = d.querySelector('.grupo-tel');
  f.addEventListener('change', () => { tel.hidden = f.share.value !== 'phone'; });
  d.querySelector('button[value=no]').onclick = () => d.close();
  d.addEventListener('close', () => d.remove());
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const share = f.share.value;
    const err = f.querySelector('.err');
    err.textContent = '';
    const phone = f.phone.value.trim();
    if (share === 'phone' && !/^\+?[0-9][0-9 ]{7,18}[0-9]$/.test(phone.replace(/\s+/g, ' '))) {
      err.textContent = KGr.error('bad_phone', grupoLang());
      f.phone.focus();
      return;
    }
    ocupado(d.querySelector('button[value=si]'), async () => {
      try {
        await llamar('accept_group_proposal', { p_target: target, p_share: share, p_phone: share === 'phone' ? phone : null });
        d.close();
        toast(S.accepted);
        if (location.hash === `#/grupos/${peticion}`) navegar();
      } catch (e) { err.textContent = grupoError(e); }
    });
  });
  d.showModal();
}
