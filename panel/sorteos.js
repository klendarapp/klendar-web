/* Panel del negocio: «Sorteos» (#/sorteos; tanda C, migración
 * 20261208100001_sorteos de la app). Lo mismo que Mi negocio › Clientes ›
 * «Sorteos» en la app. Lo ve todo el equipo; crear, cambiar y cancelar,
 * propietario o encargado (`can_manage`; la base también lo exige). «Marcar
 * como entregado», cualquiera del equipo (es quien da el premio).
 *
 * - #/sorteos: la lista con su estado y cifras (`business_giveaways`).
 * - #/sorteos/nuevo y #/sorteos/<id>?editar=1: el formulario
 *   (`save_giveaway`), con el NIF de serie (`tax_id`), el aviso del IRPF por
 *   encima de 300 € y la casilla de las obligaciones.
 * - #/sorteos/<id>: cifras, ganadores y suplentes, «Marcar como entregado»
 *   (`mark_giveaway_delivered`), «Ver la página», «Compartir en historias»,
 *   «Editar» (sin participantes) y «Cancelar el sorteo» (`cancel_giveaway`,
 *   con motivo si ya participa alguien).
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `gestiona`,
 * `esc`, `bi`, `toast`, `modal`, `confirmDlg`, `helpBox`, `fmtNum`,
 * `toLocalInput`, `fromLocalInput`, `TZ`, `I18N`…). Comparten ámbito: los
 * nombres de aquí empiezan por `sorteo`.
 */
'use strict';

const KSp = globalThis.KlendarSorteos;
const sorteoL = () => (I18N.lang === 'en' ? 'en' : 'es');
/** Lo que dice la base cuando algo no se puede, en palabras. */
const SORTEO_ERR = () => ({
  obligations_required: bi('Marca la casilla: te comprometes a entregar el premio y cumplir las bases.', 'Tick the box: you commit to handing over the prize and following the rules.'),
  bad_prize: bi('Escribe el premio (de 3 a 90 caracteres).', 'Write the prize (3 to 90 characters).'),
  too_long: bi('Hay un texto demasiado largo.', 'One of the texts is too long.'),
  bad_value: bi('Escribe el valor aproximado en euros.', 'Write the approximate value in euros.'),
  bad_winners: bi('Entre 1 y 10 ganadores.', 'Between 1 and 10 winners.'),
  bad_end: bi('Elige un final entre 1 hora y 90 días desde ahora.', 'Choose an end between 1 hour and 90 days from now.'),
  bad_claim_days: bi('El plazo para aceptar el premio va de 3 a 30 días.', 'The time to accept the prize is 3 to 30 days.'),
  bad_organizer: bi('Escribe la razón social (de 2 a 120 caracteres).', 'Write the company name (2 to 120 characters).'),
  bad_tax_id: bi('Revisa el NIF o CIF.', 'Check the tax ID (NIF or CIF).'),
  offensive_text: bi('Revisa el texto: hay palabras que no se permiten.', "Check the text: it has words that aren't allowed."),
  prize_not_allowed: bi('No se pueden sortear tabaco, vapeo ni apuestas.', "Tobacco, vaping and gambling can't be given away."),
  too_many_giveaways: bi('Puedes tener 3 sorteos abiertos a la vez.', 'You can have 3 open giveaways at a time.'),
  has_entries: bi('Ya participa gente: solo se puede cancelar.', 'People have already entered: it can only be cancelled.'),
  ended: bi('Este sorteo ya ha terminado.', 'This giveaway has already ended.'),
  not_found: bi('Ese sorteo ya no está.', "That giveaway isn't here any more."),
  reason_required: bi('Escribe el motivo (de 5 a 200 caracteres): se lo diremos a quien participa.', "Write the reason (5 to 200 characters): we'll tell everyone who entered."),
  bad_status: bi('Ese premio ya no se puede marcar como entregado.', "That prize can't be marked as handed over any more."),
  not_authorized: bi('No tienes permiso para esto. Pídeselo a quien lleve el negocio.', "You don't have permission for this. Ask whoever runs the business."),
});
const sorteoError = (code) => SORTEO_ERR()[code] || friendly(code);
async function sorteoRpc(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw Object.assign(new Error(sorteoError(r.error)), { clave: r.error });
  return r;
}
const sorteoPub = (id) => `${sorteoL() === 'en' ? '/en/giveaway/' : '/sorteo/'}${id}`;
const sorteoHistoria = (id) => `${sorteoL() === 'en' ? '/en/story/s/' : '/historia/s/'}${id}`;
const sorteoAbierto = (g) => g.status === 'active' && new Date(g.ends_at) > new Date();
/** «Abierto · termina el 14 de octubre, 21:00» / «Terminado» / «Cancelado». */
const sorteoEstado = (g) => (g.status === 'cancelled' ? bi('Cancelado', 'Cancelled')
  : sorteoAbierto(g) ? bi(`Abierto · termina el ${KSp.cuando(g.ends_at, 'es', TZ)}`, `Open · ends on ${KSp.cuando(g.ends_at, 'en', TZ)}`)
    : bi('Terminado', 'Ended'));
const sorteoCifras = (s) => bi(`${fmtNum(s?.participants)} participantes · ${fmtNum(s?.new_favorites)} favoritos nuevos`,
  `${fmtNum(s?.participants)} entries · ${fmtNum(s?.new_favorites)} new favourites`);
/** El NIF como lo guarda la base: sin espacios, puntos ni guiones, en mayúsculas. */
const sorteoNif = (v) => String(v || '').replace(/[\s.-]/g, '').toUpperCase();
const SORTEO_NIF = /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J])$/;

PAGES.sorteos = async (v, param) => {
  const d = await rpc('business_giveaways', { p_business: BIZ.id });
  const lista = d.giveaways || [];
  if (param === 'nuevo') return sorteoForm(v, d, null);
  if (param) {
    const g = lista.find((x) => x.id === param);
    if (!g) { location.hash = '#/sorteos'; return; }
    if (new URLSearchParams(location.hash.split('?')[1] || '').get('editar') === '1') return sorteoForm(v, d, g);
    return sorteoDetalle(v, d, g);
  }
  const abiertos = lista.filter((g) => g.status === 'active').length;
  v.innerHTML = `
    <div class="page-head"><h1>${esc(KSp.t(sorteoL()).title)}</h1><span class="spacer"></span>
      ${d.can_manage ? `<a class="btn sm primary" href="#/sorteos/nuevo"${abiertos >= 3 ? ' aria-disabled="true"' : ''}>${esc(bi('Crear un sorteo', 'Create a giveaway'))}</a>` : ''}</div>
    ${helpBox(bi('¿Cómo funciona?', 'How does it work?'), bi(
      `<p>Sorteas algo tuyo (una manicura, una cena para dos…) entre quien participe en la app o en klendar.app. <b>Participar es gratis y sin compra</b>; lo único que puedes pedir es tener tu negocio en favoritos.</p>
      <p>Al terminar, Klendar sortea solo con un sistema verificable: cualquiera puede comprobar el resultado. Quien gana lo acepta en la app y tú se lo entregas en tu local y lo marcas como entregado.</p>
      <p>Tú organizas el sorteo: las bases legales se generan con tus datos (razón social y NIF) y te comprometes a entregar el premio. Como mucho 3 sorteos abiertos a la vez.</p>`,
      `<p>You give away something of yours (a manicure, dinner for two…) among the people who enter in the app or on klendar.app. <b>Entering is free, no purchase needed</b>; the only thing you can ask is to have your business in their favourites.</p>
      <p>When it ends, Klendar draws the winners with a verifiable system: anyone can check the result. The winner accepts the prize in the app and you hand it over at your venue and mark it as handed over.</p>
      <p>You run the giveaway: the rules are generated with your details (company name and tax ID) and you commit to handing over the prize. Up to 3 open giveaways at a time.</p>`))}
    ${lista.length ? lista.map((g) => `<a class="card tarjeta-sellos sorteo-item" href="#/sorteos/${esc(g.id)}">
        <div class="ts-top"><h2>${esc(g.prize)}</h2><span class="tag ${sorteoAbierto(g) ? 'st-active' : 'off'}">${esc(sorteoEstado(g))}</span><span class="ms" aria-hidden="true">chevron_right</span></div>
        <p class="muted">${esc(sorteoCifras(g.stats))}</p>
      </a>`).join('')
    : `<div class="empty"><b>${esc(bi('Aún no has hecho ningún sorteo', "You haven't run any giveaways yet"))}</b><br>${esc(d.can_manage
      ? bi('Crea uno: la gente participa gratis y, si quieres, añade tu negocio a favoritos.', 'Create one: people enter for free and, if you like, add your business to their favourites.')
      : bi('Cuando quien lleva el negocio cree un sorteo, lo verás aquí.', 'When whoever runs the business creates a giveaway, you’ll see it here.'))}</div>`}`;
};

/** El estado de un ganador o suplente. */
function sorteoEstadoGanador(w) {
  switch (w.status) {
    case 'pending': return bi(`Pendiente de aceptar (hasta el ${KSp.cuando(w.claim_until, 'es', TZ)})`, `Waiting for them to accept (until ${KSp.cuando(w.claim_until, 'en', TZ)})`);
    case 'claimed': return bi('Aceptado', 'Accepted');
    case 'delivered': return bi(`Entregado el ${KSp.cuando(w.delivered_at, 'es', TZ)}`, `Handed over on ${KSp.cuando(w.delivered_at, 'en', TZ)}`);
    case 'expired': return bi('No lo aceptó', "Didn't accept it");
    case 'declined': return bi('Renunció', 'Declined');
    default: return bi('En espera', 'Waiting');
  }
}

async function sorteoDetalle(v, d, g) {
  const s = g.stats || {};
  const ganadores = g.winners_list || [];
  let nSup = 0;
  const filas = ganadores.map((w) => {
    const quien = w.backup ? bi(`Suplente ${++nSup}`, `Reserve ${nSup}`) : (g.winners > 1 ? bi(`Ganador ${w.position}`, `Winner ${w.position}`) : bi('Ganador', 'Winner'));
    const linea = [quien, bi(`nº ${w.number}`, `no. ${w.number}`), w.name || ''].filter(Boolean).join(' · ');
    return `<li class="sorteo-ganador">
      ${w.avatar_url && /^https:\/\//.test(w.avatar_url) ? `<img src="${esc(w.avatar_url)}" alt="" width="36" height="36">` : '<span class="ph" aria-hidden="true"></span>'}
      <span><b>${esc(linea)}</b><small class="muted">${esc(sorteoEstadoGanador(w))}</small></span>
      ${['pending', 'claimed'].includes(w.status) ? `<button type="button" class="btn sm" data-entregado="${esc(w.id)}" data-nombre="${esc(w.name || '')}">${esc(bi('Marcar como entregado', 'Mark as handed over'))}</button>` : ''}
    </li>`;
  }).join('');
  const acciones = [
    `<a class="btn" href="${esc(sorteoPub(g.id))}" target="_blank" rel="noopener">${esc(bi('Ver la página', 'See the page'))}</a>`,
    sorteoAbierto(g) ? `<a class="btn" href="${esc(sorteoHistoria(g.id))}" target="_blank" rel="noopener">${esc(KSp.t(sorteoL()).shareStories)}</a>` : '',
    d.can_manage && g.editable ? `<a class="btn" href="#/sorteos/${esc(g.id)}?editar=1">${esc(bi('Editar', 'Edit'))}</a>` : '',
    d.can_manage && g.status === 'active' ? `<button type="button" class="btn bad" id="sorteo-cancela">${esc(bi('Cancelar el sorteo', 'Cancel the giveaway'))}</button>` : '',
  ].filter(Boolean);
  v.innerHTML = `
    <div class="page-head"><h1>${esc(g.prize)}</h1><span class="spacer"></span><a class="btn sm ghost" href="#/sorteos">← ${esc(KSp.t(sorteoL()).title)}</a></div>
    <p><span class="tag ${sorteoAbierto(g) ? 'st-active' : 'off'}">${esc(sorteoEstado(g))}</span></p>
    ${g.status === 'cancelled' && g.cancel_reason ? `<p class="muted">${esc(g.cancel_reason)}</p>` : ''}
    <div class="kpis">
      <div class="kpi"><b>${fmtNum(s.participants)}</b><span>${esc(bi('Participantes', 'Entries'))}</span></div>
      <div class="kpi"><b>${fmtNum(s.new_favorites)}</b><span>${esc(bi('Favoritos nuevos', 'New favourites'))}</span></div>
      <div class="kpi"><b>${fmtNum(s.left)}</b><span>${esc(bi('Lo dejaron', 'Left'))}</span></div>
    </div>
    ${ganadores.length ? `<div class="card"><h2>${esc(bi('Ganadores', 'Winners'))}</h2><ul class="sorteo-ganadores">${filas}</ul>
      <p class="muted">${esc(bi('Entrégale el premio en tu local a quien lo acepte: te enseñará la pantalla del sorteo en su móvil.', 'Hand over the prize at your venue to whoever accepts it: they’ll show you the giveaway screen on their phone.'))}</p></div>`
    : g.status === 'drawn' ? `<div class="empty">${esc(bi('No participó nadie: el premio queda desierto.', 'Nobody entered: the prize is left unawarded.'))}</div>` : ''}
    <div class="sorteo-acciones">${acciones.join('')}</div>`;

  $$('[data-entregado]', v).forEach((b) => {
    b.onclick = async () => {
      const ok = await confirmDlg(bi('¿Marcar el premio como entregado?', 'Mark the prize as handed over?'),
        esc(b.dataset.nombre ? bi(`Confirma que ${b.dataset.nombre} ya tiene su premio.`, `Confirm that ${b.dataset.nombre} already has their prize.`) : bi('Confirma que ya lo has entregado.', 'Confirm that you have already handed it over.')),
        { submit: bi('Marcar como entregado', 'Mark as handed over') });
      if (!ok) return;
      try {
        await sorteoRpc('mark_giveaway_delivered', { p_winner: b.dataset.entregado });
        toast(bi('Premio entregado', 'Prize handed over'));
        PAGES.sorteos(v, g.id).then(() => I18N.translate(v));
      } catch (e) { toast(e.message, true); }
    };
  });
  const cancela = $('#sorteo-cancela', v);
  if (cancela) {
    cancela.onclick = async () => {
      const n = Number(s.participants) || 0;
      for (let aviso = ''; ;) {
        const r = await modal({
          title: bi('Cancelar el sorteo', 'Cancel the giveaway'),
          intro: `${esc(n ? bi(`Avisaremos a los ${fmtNum(n)} participantes con este motivo.`, `We'll tell the ${fmtNum(n)} entrants with this reason.`)
            : bi('Aún no participa nadie.', 'Nobody has entered yet.'))}${aviso ? `<br><b class="err-txt">${esc(aviso)}</b>` : ''}`,
          fields: [{ type: 'textarea', name: 'motivo', label: n ? bi('Motivo', 'Reason') : bi('Motivo (opcional)', 'Reason (optional)'), maxlength: 200, rows: 3, required: n > 0 }],
          submit: bi('Cancelar el sorteo', 'Cancel the giveaway'), danger: true, cancel: bi('Volver', 'Back'),
        });
        if (!r) return;
        if (n && (r.motivo.length < 5 || r.motivo.length > 200)) { aviso = sorteoError('reason_required'); continue; }
        try {
          await sorteoRpc('cancel_giveaway', { p_id: g.id, p_reason: r.motivo || null });
          toast(bi('Sorteo cancelado', 'Giveaway cancelled'));
          location.hash = '#/sorteos';
          return;
        } catch (e) { aviso = e.message; }
      }
    };
  }
}

/** Crear (`g` null) o editar un sorteo (solo sin participantes). */
async function sorteoForm(v, d, g) {
  if (!d.can_manage) { location.hash = '#/sorteos'; return; }
  if (g && !g.editable) { location.hash = `#/sorteos/${g.id}`; return; }
  const en = sorteoL() === 'en';
  const fin = g ? toLocalInput(g.ends_at) : toLocalInput(enDiasNegocio(7, 21).toISOString());
  const min = toLocalInput(new Date(Date.now() + 61 * 60e3).toISOString());
  const max = toLocalInput(new Date(Date.now() + 90 * 864e5).toISOString());
  const valor = g ? (g.prize_value_cents / 100).toFixed(2).replace('.', en ? '.' : ',') : '';
  const sup = (w) => Math.min(10, Math.max(2, w));
  v.innerHTML = `
    <div class="page-head"><h1>${esc(g ? bi('Editar el sorteo', 'Edit the giveaway') : bi('Crear un sorteo', 'Create a giveaway'))}</h1><span class="spacer"></span>
      <a class="btn sm ghost" href="${g ? `#/sorteos/${esc(g.id)}` : '#/sorteos'}">← ${esc(KSp.t(sorteoL()).title)}</a></div>
    <form class="card form sorteo-form" id="f-sorteo" novalidate>
      <label class="f"><span>${esc(bi('Premio', 'Prize'))}</span><input name="prize" maxlength="90" required placeholder="${esc(bi('Ej.: Una manicura completa', 'E.g. A full manicure'))}" value="${esc(g?.prize || '')}"></label>
      <label class="f"><span>${esc(bi('Qué incluye (opcional)', "What's included (optional)"))}</span><textarea name="desc" rows="3" maxlength="600">${esc(g?.description || '')}</textarea></label>
      <label class="f"><span>${esc(bi('Valor aproximado', 'Approximate value'))} (€)</span><input name="value" inputmode="decimal" maxlength="10" required placeholder="${en ? '50.00' : '50,00'}" value="${esc(valor)}"></label>
      <p class="sorteo-irpf" id="sorteo-irpf" hidden>${esc(bi('Más de 300 €: tienes que hacer el ingreso a cuenta del 19 % del IRPF y pedir el NIF a quien gane.', 'Over €300: you have to make the 19% income tax payment on account and ask the winner for their tax ID.'))}</p>
      <label class="f"><span>${esc(bi('Número de ganadores', 'Number of winners'))}</span><select name="winners">${[...Array(10)].map((_, i) => `<option value="${i + 1}"${(g?.winners || 1) === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>
        <small class="muted" id="sorteo-sup"></small></label>
      <label class="f"><span>${esc(bi('Termina', 'Ends'))}</span><input name="ends" type="datetime-local" required min="${esc(min)}" max="${esc(max)}" value="${esc(fin)}">
        <small class="muted">${esc(bi('De 1 hora a 90 días desde ahora.', 'From 1 hour to 90 days from now.'))}</small></label>
      <label class="opcion"><input type="checkbox" name="fav"${g ? (g.requires_favorite ? ' checked' : '') : ' checked'}><span><b>${esc(bi('Requisito: tener tu negocio en favoritos', 'Requirement: have your business in their favourites'))}</b><br>
        <small class="muted">${esc(bi('Es lo único que se puede pedir: participar es gratis y sin compra.', "It's the only thing you can ask for: entering is free, no purchase needed."))}</small></span></label>
      <label class="opcion"><input type="checkbox" name="adults"${g?.adults_only ? ' checked' : ''}><span><b>${esc(bi('Solo mayores de 18', '18+ only'))}</b><br>
        <small class="muted">${esc(bi('Si el premio lleva alcohol. Si lo detectamos, lo marcamos nosotros.', "If the prize includes alcohol. If we spot it, we'll mark it ourselves."))}</small></span></label>
      <label class="f"><span>${esc(bi('Plazo para aceptar el premio (días)', 'Time to accept the prize (days)'))}</span><input name="claim" type="number" inputmode="numeric" min="3" max="30" required value="${esc(g?.claim_days || 7)}"></label>
      <label class="f"><span>${esc(bi('Condiciones (opcional)', 'Conditions (optional)'))}</span><textarea name="terms" rows="3" maxlength="1000">${esc(g?.terms || '')}</textarea>
        <small class="muted">${esc(bi('Cómo y dónde se recoge, fechas para usarlo…', 'How and where to collect it, dates to use it…'))}</small></label>
      <fieldset class="sorteo-organiza"><legend>${esc(bi('Quién organiza', "Who's running it"))}</legend>
        <label class="f"><span>${esc(bi('Razón social', 'Company name'))}</span><input name="org" maxlength="120" required value="${esc(g?.organizer_name || BIZ.name || '')}"></label>
        <label class="f"><span>${esc(bi('NIF o CIF', 'Tax ID (NIF or CIF)'))}</span><input name="nif" maxlength="15" required autocapitalize="characters" value="${esc(g?.organizer_tax_id || d.tax_id || '')}">
          <small class="muted">${esc(bi('Sale en las bases legales: la ley pide identificar al organizador.', 'It appears in the rules: the law requires the organiser to be identified.'))}</small></label>
      </fieldset>
      <label class="opcion sorteo-obligaciones"><input type="checkbox" name="ok"${g ? ' checked' : ''} required><span>${esc(bi('Me comprometo a entregar el premio y cumplir las bases (y, si pasa de 300 €, a hacer el ingreso a cuenta del IRPF).', 'I commit to handing over the prize and following the rules (and, if it is over €300, to making the income tax payment on account).'))}</span></label>
      <p class="err" id="sorteo-err" role="alert"></p>
      <div class="foot"><button class="btn primary" type="submit">${esc(g ? bi('Guardar cambios', 'Save changes') : bi('Publicar el sorteo', 'Publish the giveaway'))}</button></div>
    </form>`;
  const f = $('#f-sorteo', v);
  const centimos = () => {
    const p = f.value.value.trim().replace(/[\s€]/g, '').replace(',', '.');
    return /^\d{1,6}(\.\d{1,2})?$/.test(p) ? Math.round(Number(p) * 100) : null;
  };
  const pintaExtra = () => {
    const w = Number(f.winners.value) || 1;
    const n = sup(w);
    $('#sorteo-sup', v).textContent = bi(`Habrá ${n} suplentes por si alguien no lo acepta.`, `There will be ${n} reserves in case someone doesn't accept it.`);
    const c = centimos();
    $('#sorteo-irpf', v).hidden = !(c != null && c > 30000);
  };
  f.winners.onchange = pintaExtra;
  f.value.oninput = pintaExtra;
  pintaExtra();
  GUARDA = { sucia: () => f.dataset.sucia === '1' };
  f.addEventListener('input', () => { f.dataset.sucia = '1'; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#sorteo-err', v);
    err.textContent = '';
    const prize = f.prize.value.trim();
    const cents = centimos();
    const ends = fromLocalInput(f.ends.value);
    const claim = Number(f.claim.value);
    const org = f.org.value.trim();
    const nif = sorteoNif(f.nif.value);
    const t = ends ? new Date(ends).getTime() : NaN;
    let code = '';
    if (prize.length < 3 || prize.length > 90) code = 'bad_prize';
    else if (cents == null || cents > 10000000) code = 'bad_value';
    else if (!(t >= Date.now() + 3600e3 && t <= Date.now() + 90 * 864e5)) code = 'bad_end';
    else if (!Number.isInteger(claim) || claim < 3 || claim > 30) code = 'bad_claim_days';
    else if (org.length < 2 || org.length > 120) code = 'bad_organizer';
    else if (!SORTEO_NIF.test(nif)) code = 'bad_tax_id';
    else if (!f.ok.checked) code = 'obligations_required';
    if (code) { err.textContent = sorteoError(code); return; }
    try {
      const r = await sorteoRpc('save_giveaway', {
        p_business: BIZ.id, p_id: g?.id || null, p_prize: prize, p_description: f.desc.value.trim() || null,
        p_value_cents: cents, p_winners: Number(f.winners.value), p_ends_at: ends,
        p_requires_favorite: f.fav.checked, p_adults_only: f.adults.checked, p_terms: f.terms.value.trim() || null,
        p_claim_days: claim, p_organizer_name: org, p_organizer_tax_id: nif, p_accept_obligations: f.ok.checked,
      });
      GUARDA = null;
      toast(g ? bi('Cambios guardados', 'Changes saved') : bi('Sorteo publicado', 'Giveaway published'));
      if (r.adults_only && !f.adults.checked) toast(bi('Lo hemos marcado como solo para mayores de 18.', "We've marked it as 18+ only."));
      location.hash = `#/sorteos/${r.id}`;
    } catch (e2) { err.textContent = e2.message; }
  };
}
