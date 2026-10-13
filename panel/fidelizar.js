/* Panel del negocio: «Fidelizar» (tanda C, migración 20261211100000 de la
 * app). Lo mismo que Mi negocio › Fidelizar en la app: las herramientas
 * opcionales para que la gente vuelva, cada una con una frase de para qué
 * sirve.
 *
 * - #/fidelizar: todo lo de fidelizar, por orden de uso (sellos, cupón,
 *   cumpleaños, avisar a los clientes, primera visita, exclusivas,
 *   habituales, bonos y sorteos), con `business_loyalty` y el estado de
 *   `business_tools_overview` (panel/herramientas.js).
 *   · Ofertas de primera visita: es una opción de cada oferta («Más
 *     opciones» del formulario); el botón abre una nueva ya marcada
 *     (#/publicaciones/nueva-flash?primera=1).
 *   · Cupón para la próxima visita (#/cupon, `save_visit_coupon`).
 *   · Agradecer a los habituales (#/habituales, `save_thanks_enabled`,
 *     `loyalty_top_customers`, `send_thanks_gifts`).
 * Lo ve todo el equipo; cambiarlo y la lista de habituales, propietario y
 * encargado (la base también lo exige).
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `gestiona`,
 * `esc`, `ms`, `bi`, `toast`, `confirmDlg`, `fmtNum`, `friendly`, `TZ`).
 * Comparten ámbito: los nombres de aquí empiezan por `fiel`.
 */
'use strict';

const FIEL_ERR = () => ({
  percent_range: bi('El descuento tiene que ser del 5 al 50 %.', 'The discount must be between 5% and 50%.'),
  gift_length: bi('El regalo tiene que tener entre 3 y 80 caracteres.', 'The gift must be between 3 and 80 characters.'),
  terms_length: bi('Las condiciones, como mucho 200 caracteres.', 'Conditions can be at most 200 characters.'),
  days_range: bi('Elige cuántos días vale.', "Choose how many days it's valid."),
  cap_range: bi('Elige de 1 a 4 cupones al mes por persona.', 'Choose 1 to 4 coupons a month per person.'),
  message_length: bi('El mensaje, como mucho 200 caracteres.', 'The message can be at most 200 characters.'),
  flagged: bi('El regalo no puede ser tabaco ni apuestas.', "The gift can't be tobacco or gambling."),
  offensive: bi('Ese texto no se puede usar. Cámbialo, por favor.', "That text can't be used. Please change it."),
  already_sent: bi('Este mes ya mandaste el regalo.', "You've already sent the gift this month."),
  not_enabled: bi('Activa antes «Agradecer a los habituales».', 'Turn on “Thank your regulars” first.'),
  no_recipients: bi('Elige al menos a una persona de la lista.', 'Choose at least one person from the list.'),
  business_inactive: bi('Tu negocio tiene que estar verificado y activo.', 'Your business has to be verified and active.'),
  rate_limited: bi('Vas muy rápido. Espera un momento y vuelve a probar.', 'Slow down a little. Wait a moment and try again.'),
  not_authorized: bi('Solo el propietario o un encargado pueden cambiarlo.', 'Only the owner or a manager can change it.'),
});
const fielError = (code) => FIEL_ERR()[code] || friendly(code);
async function fielRpc(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw Object.assign(new Error(fielError(r.error)), { clave: r.error });
  return r;
}
const fielDias = (n) => bi(n === 1 ? '1 día' : `${n} días`, n === 1 ? '1 day' : `${n} days`);
/** «septiembre» / «September», del día 1 del mes que se agradece. */
const fielMes = (iso) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(I18N.locale, { month: 'long', timeZone: 'UTC' }) : '');
const fielLectura = () => `<div class="help" style="max-width:820px">${esc(bi('Solo el propietario o un encargado pueden cambiarlo.', 'Only the owner or a manager can change it.'))}</div>`;

/** Una tarjeta: título, para qué sirve, cómo está y su botón. */
function fielTarjeta({ icono: ic, titulo, frase, estado, on, detalle, boton, href }) {
  return `<div class="card fiel-card">
    <h2 style="display:flex;align-items:center;gap:8px;margin:0 0 6px">${icono(ic)}<span>${esc(titulo)}</span></h2>
    <p class="muted" style="margin:0">${esc(frase)}</p>
    ${estado ? `<p class="herr-estado">${on ? ms('check_circle') : '<span class="herr-off" aria-hidden="true"></span>'}<span>${esc(estado)}</span></p>` : ''}
    ${detalle ? `<p class="muted" style="margin:4px 0 0">${esc(detalle)}</p>` : ''}
    ${boton ? `<p class="actions" style="margin:12px 0 0"><a class="btn" href="${esc(href)}">${esc(boton)}</a></p>` : ''}
  </div>`;
}

PAGES.fidelizar = async (v) => {
  // El estado de lo demás (sellos, bonos…) llega aparte: si falla, las
  // tarjetas salen igual, sin su línea de estado.
  const [d, o] = await Promise.all([
    fielRpc('business_loyalty', { p_business: BIZ.id }),
    typeof herrEstado === 'function' ? herrEstado() : null,
  ]);
  const c = d.coupon || {};
  const t = d.thanks || {};
  const edit = d.can_edit === true;
  const regalo = c.kind === 'percent' ? (c.percent ? `−${c.percent} %` : '') : (c.gift || '');
  const mes = fielMes(t.month);
  const dados = c.given_month || 0;
  const canjeados = c.redeemed_month || 0;
  const mesCupon = bi(`Este mes: ${dados === 1 ? '1 dado' : `${fmtNum(dados)} dados`} · ${canjeados === 1 ? '1 canjeado' : `${fmtNum(canjeados)} canjeados`}`,
    `This month: ${fmtNum(dados)} given · ${fmtNum(canjeados)} redeemed`);
  const n = t.recipients || 0;
  const detalleGracias = !t.enabled ? ''
    : t.sent ? bi(`Regalo de ${mes} mandado a ${n === 1 ? '1 persona' : `${fmtNum(n)} personas`} · ${fmtNum(t.redeemed)} canjeados`,
      `${mes} gift sent to ${n === 1 ? '1 person' : `${fmtNum(n)} people`} · ${fmtNum(t.redeemed)} redeemed`)
      : (t.candidates || 0) > 0 ? bi(`Tus clientes más fieles de ${mes} están listos.`, `Your most loyal customers from ${mes} are ready.`)
        : bi(`Nadie a quien agradecer de ${mes}: el mes que viene te avisamos.`, `No one to thank from ${mes}: we'll let you know next month.`);
  const num = (k, f) => Number(o?.[k]?.[f]) || 0;
  const apagado = bi('Apagado', 'Off');
  const ahora = (x) => (x === 0 ? bi('Ninguna activa ahora', 'None live right now') : bi(x === 1 ? '1 activa ahora' : `${x} activas ahora`, `${x} live right now`));
  const sello = num('stamps', 'active');
  const bonos = num('passes', 'on_sale');
  const sorteos = num('giveaways', 'active');
  const prox = o?.messages?.next_at
    ? new Date(o.messages.next_at).toLocaleDateString(I18N.lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', timeZone: TZ })
    : null;
  const configurar = edit ? bi('Configurar', 'Set up') : bi('Ver', 'View');
  // Por orden de lo que más usa un negocio pequeño (como la app).
  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Fidelizar', 'Loyalty'))}</h1></div>
    <p class="muted" style="max-width:640px">${esc(bi('Herramientas opcionales para que la gente vuelva. Activa solo las que te encajen.', 'Optional tools to bring people back. Turn on only the ones that suit you.'))}</p>
    <div class="fiel-lista" style="display:grid;gap:12px;max-width:820px">
      ${fielTarjeta({
    icono: 'loyalty',
    titulo: bi('Tarjetas de sellos', 'Stamp cards'),
    frase: bi('Para premiar a quien repite: cada canje (o cada visita con el QR del local) suma un sello y al llegar a la meta hay premio.', 'To reward people who come back: each redemption (or visit with the venue QR) adds a stamp, and reaching the goal earns a prize.'),
    estado: o ? (sello ? bi(sello === 1 ? '1 tarjeta activa' : `${sello} tarjetas activas`, sello === 1 ? '1 active card' : `${sello} active cards`) : apagado) : '',
    on: sello > 0,
    boton: edit ? bi('Configurar', 'Set up') : '',
    href: '#/sellos',
  })}
      ${fielTarjeta({
    icono: 'local_offer',
    titulo: bi('Cupón para la próxima visita', 'Coupon for the next visit'),
    frase: bi('Para que vuelvan: al validar un canje, la persona recibe un cupón para su próxima visita.', 'To bring them back: when you validate a redemption, the person gets a coupon for their next visit.'),
    estado: c.enabled && regalo ? bi(`Activado: ${regalo} · ${fielDias(c.valid_days)}`, `On: ${regalo} · ${fielDias(c.valid_days)}`) : apagado,
    on: !!c.enabled,
    detalle: c.enabled || dados ? mesCupon : '',
    boton: configurar,
    href: '#/cupon',
  })}
      ${fielTarjeta({
    icono: 'cake',
    titulo: bi('Regalo de cumpleaños', 'Birthday gift'),
    frase: bi('Para tener un detalle en su cumpleaños: a quien te tiene en favoritos le llega un regalo para canjear.', 'A treat on their birthday: people who have you in favourites get a gift to redeem.'),
    estado: o ? (o.birthday?.enabled ? bi('Activado', 'On') : apagado) : '',
    on: o?.birthday?.enabled === true,
    boton: configurar,
    href: '#/cumpleanos',
  })}
      ${fielTarjeta({
    icono: 'campaign',
    titulo: bi('Avisar a mis clientes', 'Message my customers'),
    frase: bi('Para contar algo a tus favoritos y clientes con una notificación. Uno por semana.', 'To tell your favourites and customers something with a notification. One a week.'),
    estado: o ? (prox ? bi(`Podrás mandar otro el ${prox}`, `You can send another on ${prox}`) : bi('Puedes mandar uno ahora', 'You can send one now')) : '',
    on: !!prox,
    boton: edit ? bi('Abrir', 'Open') : '',
    href: '#/mensajes',
  })}
      ${fielTarjeta({
    icono: 'waving_hand',
    titulo: bi('Ofertas de primera visita', 'First-visit offers'),
    frase: bi('Para atraer clientes nuevos: una oferta que solo puede usar quien no ha canjeado nunca nada en tu negocio.', 'To attract new customers: an offer that only people who have never redeemed anything at your business can use.'),
    estado: o ? ahora(num('first_visit', 'live')) : '',
    on: num('first_visit', 'live') > 0,
    boton: edit ? bi('Crear oferta de primera visita', 'Create a first-visit offer') : '',
    href: '#/publicaciones/nueva-flash?primera=1',
  })}
      ${fielTarjeta({
    icono: 'candado',
    titulo: bi('Exclusivas para favoritos o clientes', 'Exclusives for favourites or customers'),
    frase: bi('Para premiar a los tuyos: una oferta que solo ve entera quien te tiene en favoritos o ya es cliente.', 'To reward your people: an offer only those who have you in favourites, or are already customers, see in full.'),
    estado: o ? ahora(num('exclusives', 'live')) : '',
    on: num('exclusives', 'live') > 0,
    boton: edit ? bi('Crear una exclusiva', 'Create an exclusive') : '',
    href: '#/publicaciones/nueva-flash?exclusiva=1',
  })}
      ${fielTarjeta({
    icono: 'volunteer_activism',
    titulo: bi('Agradecer a los habituales', 'Thank your regulars'),
    frase: bi('Para cuidar a quien más viene: una vez al mes, regala algo a tus 10 clientes más fieles con un mensaje.', 'To look after the people who come most: once a month, send your 10 most loyal customers a gift with a message.'),
    estado: t.enabled ? bi('Activado', 'On') : apagado,
    on: !!t.enabled,
    detalle: detalleGracias,
    boton: edit ? bi('Ver y agradecer', 'View and thank') : '',
    href: '#/habituales',
  })}
      ${fielTarjeta({
    icono: 'redeem',
    titulo: bi('Bonos', 'Passes'),
    frase: bi('Para vender en tu local bonos de varios usos (5 cafés, 10 clases…). Cada uso se descuenta con el QR del cliente.', 'To sell multi-use passes at your venue (5 coffees, 10 classes…). Each use is taken off with the customer’s QR.'),
    estado: o ? (bonos ? bi(bonos === 1 ? '1 bono a la venta' : `${bonos} bonos a la venta`, bonos === 1 ? '1 pass on sale' : `${bonos} passes on sale`) : apagado) : '',
    on: bonos > 0,
    boton: configurar,
    href: '#/bonos',
  })}
      ${fielTarjeta({
    icono: 'sorteo',
    titulo: bi('Sorteos', 'Giveaways'),
    frase: bi('Para darte a conocer: un sorteo gratis en el que participa quien te añade a favoritos.', 'To get known: a free giveaway people enter by adding you to their favourites.'),
    estado: o ? (sorteos ? bi(sorteos === 1 ? '1 sorteo abierto' : `${sorteos} sorteos abiertos`, sorteos === 1 ? '1 open giveaway' : `${sorteos} open giveaways`) : apagado) : '',
    on: sorteos > 0,
    boton: bi('Abrir', 'Open'),
    href: '#/sorteos',
  })}
    </div>
    ${edit ? '' : fielLectura()}`;
};

PAGES.cupon = async (v) => {
  const d = await fielRpc('business_loyalty', { p_business: BIZ.id });
  const c = d.coupon || {};
  const edita = !!d.can_edit;
  const ro = edita ? '' : 'disabled';
  const pcts = [5, 10, 15, 20, 25, 30, 50];
  if (c.percent && !pcts.includes(c.percent)) pcts.push(c.percent);
  pcts.sort((a, b) => a - b);
  const dias = [7, 15, 30, 60, 90];
  if (c.valid_days && !dias.includes(c.valid_days)) dias.push(c.valid_days);
  dias.sort((a, b) => a - b);
  const dados = c.given_month || 0;
  const canjeados = c.redeemed_month || 0;
  v.innerHTML = `
    <p style="margin:0 0 6px"><a class="link" href="#/fidelizar">${esc(bi('‹ Fidelizar', '‹ Loyalty'))}</a></p>
    <div class="page-head"><h1>${esc(bi('Cupón para la próxima visita', 'Coupon for the next visit'))}</h1></div>
    <p class="muted" style="max-width:640px">${esc(bi('Para que vuelvan: al validar un canje, la persona recibe un cupón para su próxima visita.', 'To bring them back: when you validate a redemption, the person gets a coupon for their next visit.'))}</p>
    ${edita ? '' : fielLectura()}
    <form id="f" class="form" novalidate>
      <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="activo" ${c.enabled ? 'checked' : ''} ${ro}><span>${esc(bi('Al validar, regala un cupón para la próxima visita', 'When validating, give a coupon for the next visit'))}</span></label>
      <fieldset class="f full filtro-sellos"><legend>${esc(bi('Qué regalas', 'What you give'))}</legend>
        <label class="opcion"><input type="radio" name="kind" value="percent" ${c.kind !== 'gift' ? 'checked' : ''} ${ro}><span>${esc(bi('Un descuento', 'A discount'))}</span></label>
        <label class="opcion"><input type="radio" name="kind" value="gift" ${c.kind === 'gift' ? 'checked' : ''} ${ro}><span>${esc(bi('Un regalo', 'A gift'))}</span></label>
      </fieldset>
      <label class="f" id="pctRow"><span>${esc(bi('Descuento', 'Discount'))}</span><select name="pct" ${ro}>
        ${pcts.map((p) => `<option value="${p}" ${Number(c.percent || 10) === p ? 'selected' : ''}>−${p} %</option>`).join('')}</select></label>
      <label class="f full" id="regaloRow"><span>${esc(bi('El regalo', 'The gift'))}</span>
        <input name="regalo" maxlength="80" placeholder="${esc(bi('Por ejemplo: Un café gratis', 'For example: A free coffee'))}" value="${esc(c.gift || '')}" autocomplete="off" ${ro}></label>
      <label class="f full"><span>${esc(bi('Condiciones (opcional)', 'Conditions (optional)'))}</span>
        <input name="cond" maxlength="200" placeholder="${esc(bi('Por ejemplo: No acumulable con otras ofertas', "For example: Can't be combined with other offers"))}" value="${esc(c.terms || '')}" autocomplete="off" ${ro}></label>
      <label class="f"><span>${esc(bi('Cuántos días vale', "How many days it's valid"))}</span><select name="dias" ${ro}>
        ${dias.map((x) => `<option value="${x}" ${Number(c.valid_days || 30) === x ? 'selected' : ''}>${esc(fielDias(x))}</option>`).join('')}</select></label>
      <label class="f"><span>${esc(bi('Como mucho, cupones al mes por persona', 'Maximum coupons per person per month'))}</span><select name="tope" ${ro}>
        ${[1, 2, 3, 4].map((x) => `<option value="${x}" ${Number(c.monthly_cap || 2) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <p class="hint full">${esc(bi('Vale desde el día siguiente al canje y se valida en «Validar códigos», como los demás. Uno por canje; tu equipo no los recibe. Si menciona alcohol, solo lo reciben mayores de edad.',
    "It's valid from the day after the redemption and you validate it in “Validate codes”, like the others. One per redemption; your team doesn't get them. If it mentions alcohol, only adults get it."))}</p>
      <p class="hint full" id="alcohol" ${c.adults_only ? '' : 'hidden'}>${esc(bi('Menciona alcohol: solo lo recibirán mayores de edad.', 'It mentions alcohol: only adults will get it.'))}</p>
      ${edita ? `<div class="full"><button class="btn primary" type="submit">${esc(bi('Guardar', 'Save'))}</button></div>` : ''}
      <p class="err full" id="cupErr" role="alert"></p>
    </form>
    <div class="card"><p style="margin:0">${esc(bi(`Este mes: ${dados === 1 ? '1 dado' : `${fmtNum(dados)} dados`} · ${canjeados === 1 ? '1 canjeado' : `${fmtNum(canjeados)} canjeados`}`,
    `This month: ${fmtNum(dados)} given · ${fmtNum(canjeados)} redeemed`))}</p></div>`;
  const f = $('#f', v);
  const tipo = () => (f.elements.kind.value === 'gift' ? 'gift' : 'percent');
  const pinta = () => { $('#pctRow', v).hidden = tipo() !== 'percent'; $('#regaloRow', v).hidden = tipo() !== 'gift'; };
  $$('[name=kind]', v).forEach((r) => r.addEventListener('change', pinta));
  pinta();
  if (!edita) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#cupErr', v);
    err.textContent = '';
    const activo = f.elements.activo.checked;
    const regalo = f.elements.regalo.value.replace(/\s+/g, ' ').trim();
    // Las mismas reglas que la base.
    if (tipo() === 'gift' && (activo || regalo) && (regalo.length < 3 || regalo.length > 80)) { err.textContent = fielError('gift_length'); return; }
    try {
      const r = await fielRpc('save_visit_coupon', {
        p_business: BIZ.id, p_enabled: activo, p_kind: tipo(),
        p_percent: tipo() === 'percent' ? Number(f.elements.pct.value) : null,
        p_gift: tipo() === 'gift' ? regalo || null : null,
        p_terms: f.elements.cond.value.trim() || null,
        p_valid_days: Number(f.elements.dias.value), p_monthly_cap: Number(f.elements.tope.value),
      });
      $('#alcohol', v).hidden = !r.adults_only;
      toast(bi('Cupón guardado', 'Coupon saved'));
    } catch (x) { err.textContent = x.message; }
  };
};

PAGES.habituales = async (v) => {
  if (!gestiona()) {
    v.innerHTML = `<div class="card"><p style="margin:0">${esc(bi('Solo el propietario o un encargado pueden cambiarlo.', 'Only the owner or a manager can change it.'))}</p></div>`;
    return;
  }
  const d = await fielRpc('loyalty_top_customers', { p_business: BIZ.id });
  const mes = fielMes(d.month);
  const lista = d.customers || [];
  const linea = (x) => bi(`${x.visits === 1 ? '1 visita' : `${fmtNum(x.visits)} visitas`} · ${x.redemptions === 1 ? '1 canje' : `${fmtNum(x.redemptions)} canjes`}`,
    `${x.visits === 1 ? '1 visit' : `${fmtNum(x.visits)} visits`} · ${x.redemptions === 1 ? '1 redemption' : `${fmtNum(x.redemptions)} redemptions`}`);
  const enviado = d.sent;
  const n = d.recipients || 0;
  const cuando = d.sent_at ? new Date(d.sent_at).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', timeZone: TZ }) : '';
  v.innerHTML = `
    <p style="margin:0 0 6px"><a class="link" href="#/fidelizar">${esc(bi('‹ Fidelizar', '‹ Loyalty'))}</a></p>
    <div class="page-head"><h1>${esc(bi('Agradecer a los habituales', 'Thank your regulars'))}</h1></div>
    <p class="muted" style="max-width:640px">${esc(bi('Para cuidar a quien más viene: una vez al mes, regala algo a tus 10 clientes más fieles con un mensaje.', 'To look after the people who come most: once a month, send your 10 most loyal customers a gift with a message.'))}</p>
    <form id="onf" class="form" novalidate>
      <label class="f full" style="grid-template-columns:auto 1fr;align-items:center"><input type="checkbox" name="on" ${d.enabled ? 'checked' : ''}><span><b>${esc(bi('Proponerme cada mes a quién agradecer', 'Suggest who to thank every month'))}</b><br><small class="muted">${esc(bi('Te avisamos a primeros de mes. Mandar el regalo siempre lo decides tú.', "We'll let you know at the start of each month. You always decide whether to send the gift."))}</small></span></label>
    </form>
    ${!d.enabled ? '' : `<div class="card" style="max-width:820px"><h2>${esc(bi(`Tus 10 clientes más fieles de ${mes}`, `Your 10 most loyal customers in ${mes}`))}</h2>
      ${!lista.length ? `<p class="muted" style="margin:0">${esc(bi(`Nadie a quien agradecer de ${mes}: el mes que viene te avisamos.`, `No one to thank from ${mes}: we'll let you know next month.`))}</p>` : `
      <form id="gf" class="form" novalidate>
        <div class="f full" role="group" aria-label="${esc(bi('Quién lo recibe', 'Who gets it'))}">
          ${lista.map((x) => `<label class="opcion"><input type="checkbox" name="u" value="${esc(x.user_id)}" ${enviado ? `disabled ${x.sent ? 'checked' : ''}` : 'checked'}><span><b>${esc(x.name)}</b> <small class="muted">${esc(linea(x))}</small></span></label>`).join('')}
        </div>
        <p class="hint full">${esc(bi('Solo ves su nombre visible y cuántas veces han venido: nada de datos de contacto. El regalo les llega como un código.', 'You only see their display name and how often they came: no contact details. The gift reaches them as a code.'))}</p>
        ${enviado ? `<p class="full" style="font-weight:700;margin:6px 0 0">${esc(bi(`Este mes ya lo mandaste: ${n === 1 ? '1 persona' : `${fmtNum(n)} personas`}, el ${cuando}.`, `Already sent this month: ${n === 1 ? '1 person' : `${fmtNum(n)} people`}, on ${cuando}.`))}</p>` : `
        <label class="f full"><span>${esc(bi('El regalo', 'The gift'))}</span><input name="regalo" maxlength="80" placeholder="${esc(bi('Por ejemplo: Un postre gratis', 'For example: A free dessert'))}" autocomplete="off"></label>
        <label class="f full"><span>${esc(bi('Tu mensaje (opcional)', 'Your message (optional)'))}</span><input name="msg" maxlength="200" placeholder="${esc(bi('Por ejemplo: Gracias por venir tanto este mes', 'For example: Thanks for coming so often this month'))}" autocomplete="off"></label>
        <label class="f"><span>${esc(bi('Cuántos días vale', "How many days it's valid"))}</span><select name="dias">
          ${[7, 15, 30, 60].map((x) => `<option value="${x}" ${x === 30 ? 'selected' : ''}>${esc(fielDias(x))}</option>`).join('')}</select></label>
        <p class="hint full">${esc(bi('Una vez al mes. Les llega un aviso (si no lo han apagado) y el código en «Tus códigos». Si menciona alcohol, solo a mayores de edad.', "Once a month. They get a notification (unless they've turned it off) and the code in “Your codes”. If it mentions alcohol, only adults get it."))}</p>
        <div class="full"><button class="btn primary" type="submit" id="mandar"></button></div>
        <p class="err full" id="gErr" role="alert"></p>`}
      </form>`}
    </div>`}`;
  $('#onf [name=on]', v).addEventListener('change', async (e) => {
    try {
      await fielRpc('save_thanks_enabled', { p_business: BIZ.id, p_enabled: e.target.checked });
      PAGES.habituales(v);
    } catch (x) { e.target.checked = !e.target.checked; toast(x.message, true); }
  });
  const gf = $('#gf', v);
  if (!gf || enviado) return;
  const elegidos = () => $$('[name=u]:checked', gf).map((i) => i.value);
  const pintaBoton = () => {
    const k = elegidos().length;
    const b = $('#mandar', gf);
    b.textContent = bi(k === 1 ? 'Mandar el regalo a 1 persona' : `Mandar el regalo a ${k} personas`, k === 1 ? 'Send the gift to 1 person' : `Send the gift to ${k} people`);
    b.disabled = k === 0;
  };
  gf.addEventListener('change', pintaBoton);
  pintaBoton();
  gf.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#gErr', gf);
    err.textContent = '';
    const regalo = gf.elements.regalo.value.replace(/\s+/g, ' ').trim();
    if (regalo.length < 3 || regalo.length > 80) { err.textContent = fielError('gift_length'); return; }
    const users = elegidos();
    if (!users.length) { err.textContent = fielError('no_recipients'); return; }
    const k = users.length;
    const ok = await confirmDlg(bi(`¿Mandar el regalo a ${k === 1 ? '1 persona' : `${k} personas`}?`, `Send the gift to ${k === 1 ? '1 person' : `${k} people`}?`),
      bi(`Recibirán «${regalo}» con un código para canjearlo. Solo se puede mandar una vez al mes.`, `They'll get “${regalo}” with a code to redeem it. You can only send it once a month.`),
      { submit: $('#mandar', gf).textContent });
    if (!ok) return;
    try {
      const r = await fielRpc('send_thanks_gifts', {
        p_business: BIZ.id, p_gift: regalo, p_message: gf.elements.msg.value.trim() || null,
        p_valid_days: Number(gf.elements.dias.value), p_users: users,
      });
      const menores = r.skipped_minors || 0;
      toast([bi(r.sent === 1 ? 'Regalo mandado a 1 persona.' : `Regalo mandado a ${r.sent} personas.`, r.sent === 1 ? 'Gift sent to 1 person.' : `Gift sent to ${r.sent} people.`),
        menores ? bi(menores === 1 ? '1 menor de edad no lo recibe (menciona alcohol).' : `${menores} menores de edad no lo reciben (menciona alcohol).`,
          menores === 1 ? "1 minor won't get it (it mentions alcohol)." : `${menores} minors won't get it (it mentions alcohol).`) : ''].filter(Boolean).join(' '));
      PAGES.habituales(v);
    } catch (x) { err.textContent = x.message; }
  };
};
