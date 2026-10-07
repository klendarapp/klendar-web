/* Panel del negocio: «Grupos y empresas» (#/grupos; tanda C, migración
 * 20261208100000_grupos_y_empresas de la app). Lo mismo que Mi negocio ›
 * Clientes › «Grupos y empresas» en la app. Solo propietario o encargado
 * (`SOLO_GESTION` en panel.js; la base también lo exige).
 *
 * - Arriba, los ajustes: «Aceptamos grupos», hasta cuántas personas, para
 *   qué y una nota (`business_group_settings_get` /
 *   `save_business_group_settings`).
 * - Debajo, «Peticiones» (`business_group_requests`) con «Sin cerrar» ·
 *   «Aceptadas» · «Todas»: «Enviar propuesta» (texto, precio orientativo y
 *   condiciones; se puede corregir mientras no la acepten) o «No podemos»
 *   (`respond_group_request`). Quien pide y su contacto, solo al aceptar.
 *
 * Los textos, de /assets/textos-grupos.js (los mismos que la web pública y
 * «Tu cuenta»). Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`,
 * `esc`, `bi`, `toast`, `modal`, `I18N`, `TZ`…). Comparten ámbito: los
 * nombres de aquí empiezan por `grupo`.
 */
'use strict';

const KGp = globalThis.KlendarGrupos;
const grupoL = () => (I18N.lang === 'en' ? 'en' : 'es');
const grupoT = () => KGp.t(grupoL());
let GRUPO_FILTRO = 'open';

/** Llama a la base; si dice que no, lanza el error ya en palabras. */
async function grupoRpc(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw Object.assign(new Error(KGp.error(r.error, grupoL(), r) || friendly(r.error)), { clave: r.error });
  return r;
}
/** «25,00» → 2500; '' → null; mal escrito → NaN. */
const grupoCentimos = (txt) => {
  const p = String(txt || '').trim().replace(/[\s€]/g, '').replace(',', '.');
  if (!p) return null;
  return /^\d{1,4}(\.\d{1,2})?$/.test(p) ? Math.round(Number(p) * 100) : NaN;
};
const grupoEuros = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', grupoL() === 'en' ? '.' : ','));

PAGES.grupos = async (v) => {
  const S = grupoT();
  const L = grupoL();
  const [cfg, lista] = await Promise.all([
    rpc('business_group_settings_get', { p_business: BIZ.id }),
    rpc('business_group_requests', { p_business: BIZ.id, p_filter: GRUPO_FILTRO }),
  ]);
  const kinds = cfg.kinds || [];
  v.innerHTML = `
    <div class="page-head"><h1>${esc(S.title)}</h1></div>
    ${helpBox(bi('¿Cómo funciona?', 'How does it work?'), bi(
      `<p>Marca «Aceptamos grupos» y saldrás en «Grupos y empresas»: la gente elige hasta 3 negocios y les pide presupuesto a la vez (fecha, personas, presupuesto por persona y una nota).</p>
      <p>Tienes <b>72 horas</b> para contestar con una propuesta o decir que no puedes. Hasta que acepten tu propuesta no sabes quién lo pide; al aceptarla te compartimos su correo o su teléfono para cerrarlo. Klendar no cobra nada.</p>`,
      `<p>Tick “We take groups” and you'll appear in “Groups and companies”: people pick up to 3 places and ask them all for a quote (date, people, budget per person and a note).</p>
      <p>You have <b>72 hours</b> to reply with a proposal or say you can't. Until they accept your proposal you don't know who's asking; when they do, we share their email or phone number so you can confirm it. Klendar doesn't charge anything.</p>`))}
    <h2 class="grupo-h">${esc(S.requests)}</h2>
    <div class="seg" role="group" aria-label="${esc(S.requests)}">
      ${['open', 'done', 'all'].map((f) => `<button type="button" class="btn sm${GRUPO_FILTRO === f ? '' : ' ghost'}" aria-pressed="${GRUPO_FILTRO === f}" data-filtro="${f}">${esc(S.segs[f])}</button>`).join('')}
    </div>
    <div class="grupo-peticiones">${(lista || []).length ? lista.map(grupoTarjeta).join('')
      : `<div class="empty">${esc(bi('Cuando alguien te pida presupuesto para un grupo, lo verás aquí.', 'When someone asks you for a group quote, you’ll see it here.'))}</div>`}</div>

    <details class="card grupo-plegable"${cfg.enabled ? '' : ' open'}>
      <summary><b>${esc(S.weTake)}</b> <span class="muted">${esc(cfg.enabled ? `${S.upTo(cfg.max_people)} · ${kinds.map((k) => KGp.plural(k, L)).join(' · ')}` : bi('Sin activar', 'Off'))}</span></summary>
      <form class="form grupo-ajustes" id="f-grupos" novalidate>
      <label class="opcion"><input type="checkbox" name="enabled"${cfg.enabled ? ' checked' : ''}><span><b>${esc(S.weTake)}</b></span></label>
      <label class="f"><span>${esc(S.maxPeople)}</span><input name="max" type="number" inputmode="numeric" min="2" max="500" value="${esc(cfg.max_people || 20)}" required></label>
      <fieldset class="grupo-para-que"><legend>${esc(S.forWhat)}</legend>
        ${KGp.KINDS.map((k) => `<label class="opcion"><input type="checkbox" name="kind" value="${k}"${kinds.includes(k) ? ' checked' : ''}><span>${esc(KGp.plural(k, L))}</span></label>`).join('')}
      </fieldset>
      <label class="f"><span>${esc(S.bizNote)}</span><textarea name="note" rows="2" maxlength="200">${esc(cfg.note || '')}</textarea>
        <small class="muted">${esc(S.bizNoteHelp)}</small></label>
      <p class="err" id="grupos-err" role="alert"></p>
      <div class="foot"><button class="btn primary" type="submit">${esc(I18N.lang === 'en' ? 'Save' : 'Guardar')}</button></div>
      </form>
    </details>`;

  const f = $('#f-grupos', v);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#grupos-err', v);
    err.textContent = '';
    const max = Number(f.max.value);
    const elegidos = $$('input[name=kind]:checked', f).map((x) => x.value);
    if (!Number.isInteger(max) || max < 2 || max > 500) { err.textContent = KGp.error('bad_people', L); f.max.focus(); return; }
    if (f.enabled.checked && !elegidos.length) { err.textContent = KGp.error('no_kinds', L); return; }
    try {
      await grupoRpc('save_business_group_settings', {
        p_business: BIZ.id, p_enabled: f.enabled.checked, p_max_people: max, p_kinds: elegidos, p_note: f.note.value.trim() || null,
      });
      toast(bi('Guardado', 'Saved'));
      PAGES.grupos(v).then(() => I18N.translate(v));
    } catch (e2) { err.textContent = e2.message; }
  };
  $$('[data-filtro]', v).forEach((b) => { b.onclick = () => { GRUPO_FILTRO = b.dataset.filtro; PAGES.grupos(v).then(() => I18N.translate(v)); }; });
  $$('[data-propuesta]', v).forEach((b) => {
    b.onclick = () => grupoPropuesta((lista || []).find((x) => x.id === b.dataset.propuesta), v);
  });
  $$('[data-no-podemos]', v).forEach((b) => {
    b.onclick = async () => {
      const r = await modal({
        title: S.cannotQ,
        intro: esc(bi('Le diremos que esta vez no puedes. Su petición sigue abierta con los demás negocios.', 'We’ll tell them you can’t this time. Their request stays open with the other places.')),
        fields: [{ type: 'textarea', name: 'motivo', label: bi('Motivo (opcional)', 'Reason (optional)'), maxlength: 200, rows: 3 }],
        submit: S.cannot,
      });
      if (!r) return;
      try {
        await grupoRpc('respond_group_request', { p_target: b.dataset.noPodemos, p_action: 'decline', p_text: r.motivo || null, p_price_pp_cents: null, p_conditions: null });
        toast(S.cannotDone);
        PAGES.grupos(v).then(() => I18N.translate(v));
      } catch (e) { toast(e.message, true); }
    };
  });
};

/** Una petición en la bandeja. */
function grupoTarjeta(x) {
  const S = grupoT();
  const L = grupoL();
  const linea = KGp.linea(x, L);
  const meta = [
    x.budget_cents != null ? S.about(KGp.dinero(x.budget_cents, L)) : '',
  ].filter(Boolean);
  let estado = '';
  let botones = '';
  if (x.status === 'pending') {
    estado = `<p>${esc(S.replyBy(KGp.cuando(x.respond_by, L, TZ)))}</p>`;
    botones = `<div class="dos-botones grupo-botones"><button type="button" class="btn primary" data-propuesta="${esc(x.id)}">${esc(S.sendProposal)}</button>
      <button type="button" class="btn" data-no-podemos="${esc(x.id)}">${esc(S.cannot)}</button></div>`;
  } else if (x.status === 'proposed') {
    estado = `<p><b>${esc(S.proposalSent)}</b> · <button type="button" class="linkbtn" data-propuesta="${esc(x.id)}">${esc(S.fix)}</button></p>
      <div class="grupo-tu-propuesta"><p>${esc(x.proposal || '').replace(/\n/g, '<br>')}</p>
      ${x.price_pp_cents != null ? `<p><b>${esc(S.perPerson(KGp.dinero(x.price_pp_cents, L)))}</b></p>` : ''}
      ${x.conditions ? `<p class="muted">${esc(x.conditions)}</p>` : ''}</div>`;
  } else if (x.status === 'accepted') {
    const c = x.contact || {};
    const dato = c.email || c.phone || '';
    estado = `<p><b>${esc(S.bizStatus.accepted)}</b></p>
      ${dato ? `<p>${esc(S.contact(c.name || '', dato))}</p>
      <div class="dos-botones grupo-botones">${c.email ? `<a class="btn primary" href="mailto:${esc(c.email)}">${esc(S.write)}</a>` : ''}${c.phone ? `<a class="btn${c.email ? '' : ' primary'}" href="tel:${esc(String(c.phone).replace(/\s+/g, ''))}">${esc(S.call)}</a>` : ''}</div>` : ''}
      <p class="muted">${esc(S.contactFoot)}</p>`;
  } else {
    estado = `<p><b>${esc(S.bizStatus[x.status] || x.status)}</b></p>${x.status === 'declined' && x.decline_reason ? `<p class="muted">${esc(x.decline_reason)}</p>` : ''}`;
  }
  return `<article class="card grupo-pet">
      <h3>${esc(linea)}</h3>
      ${meta.length ? `<p class="muted">${esc(meta.join(' · '))}</p>` : ''}
      ${x.note ? `<p class="grupo-nota">«${esc(x.note)}»</p>` : ''}
      ${x.others > 0 && ['pending', 'proposed'].includes(x.status) ? `<p class="muted">${esc(S.others(Number(x.others)))}</p>` : ''}
      ${estado}
      ${botones}
    </article>`;
}

/** La hoja de la propuesta (nueva o «Corregir»). */
async function grupoPropuesta(x, v) {
  if (!x) return;
  const S = grupoT();
  const L = grupoL();
  let valores = { texto: x.proposal || '', precio: grupoEuros(x.price_pp_cents), cond: x.conditions || '' };
  let aviso = '';
  for (;;) {
    const r = await modal({
      title: S.yourProposal,
      intro: `${esc(KGp.linea(x, L))}${aviso ? `<br><b class="err-txt">${esc(aviso)}</b>` : ''}`,
      fields: [
        { type: 'textarea', name: 'texto', label: S.yourProposal, value: valores.texto, maxlength: 600, rows: 5, required: true,
          help: S.proposalHelp },
        { name: 'precio', label: S.pricePP, value: valores.precio, placeholder: L === 'en' ? '25.00' : '25,00' },
        { type: 'textarea', name: 'cond', label: S.conditions, value: valores.cond, maxlength: 400, rows: 3 },
      ],
      submit: S.sendProposal,
    });
    if (!r) return;
    valores = r;
    const cents = grupoCentimos(r.precio);
    if (r.texto.length < 10 || r.texto.length > 600) { aviso = KGp.error('bad_text', L); continue; }
    if (Number.isNaN(cents)) { aviso = KGp.error('bad_price', L); continue; }
    try {
      await grupoRpc('respond_group_request', { p_target: x.id, p_action: 'propose', p_text: r.texto, p_price_pp_cents: cents, p_conditions: r.cond || null });
      toast(bi('Propuesta enviada', 'Proposal sent'));
      PAGES.grupos(v).then(() => I18N.translate(v));
      return;
    } catch (e) { aviso = e.message; }
  }
}
