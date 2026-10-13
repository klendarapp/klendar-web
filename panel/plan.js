/* Panel del negocio: «Tu plan» (#/plan). Cobro con Stripe (migración
 * 20261216100000 de la app, Edge Function `billing`).
 *
 * - Todo el equipo de gestión ve el plan, el estado (prueba, activo, pago
 *   pendiente, en pausa, cancelado) y la próxima factura.
 * - Solo el propietario paga: elegir plan, mes o año y qué locales suyos
 *   (escalera por número de locales), y Stripe Checkout; luego «Cambiar de
 *   plan», «Gestionar el pago» (portal de Stripe: tarjeta, datos de factura,
 *   facturas), la pausa por cierre y añadir o quitar este local.
 * - Mientras el cobro con tarjeta no esté encendido (`ready` = false), como
 *   antes: el estado y «Preguntar por el plan».
 * - Precios SIN IVA («+ IVA»): salen de la base (`billing_prices`), nunca de
 *   aquí.
 *
 * La app no vende el plan (normas de Apple y Google): solo enseña el estado.
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `sb`, `BIZ`,
 * `gestiona`, `esPropietario`, `esc`, `ms`, `bi`, `toast`, `modal`,
 * `confirmDlg`, `fmtMoney`, `LOC`, `I18N`). Los nombres de aquí empiezan por
 * `plan`.
 */
'use strict';

const PLAN_ERR = {
  not_configured: 'El pago con tarjeta aún no está disponible. Escríbenos a info@klendar.app.',
  billing_disabled: 'El pago con tarjeta aún no está disponible. Escríbenos a info@klendar.app.',
  price_not_ready: 'Ese plan aún no se puede pagar con tarjeta. Escríbenos a info@klendar.app.',
  already_subscribed: 'Este local ya tiene el plan pagado con tarjeta.',
  already_covered: 'Este local ya está en tu suscripción.',
  free_forever: 'Tu plan es gratis: no tienes que pagar nada.',
  not_owner: 'Solo el propietario del negocio puede pagar el plan.',
  not_authenticated: 'Tu sesión ha caducado. Vuelve a entrar para continuar.',
  no_subscription: 'No hay ninguna suscripción con tarjeta.',
  pause_limit: 'Ya has usado los días de pausa de este año.',
  invalid_days: 'Elige cuántos días, dentro de los que te quedan.',
  not_monthly: 'La pausa es para el plan mensual. Con el anual, escríbenos.',
  past_due: 'Primero hay que ponerse al día con el pago.',
  not_active: 'Ahora mismo no se puede: la suscripción no está activa.',
  not_paused: 'El plan no está en pausa.',
  already_paused: 'El plan ya está en pausa.',
  last_location: 'Es el único local de la suscripción: para dejar de pagar, cancela la suscripción.',
  same_plan: 'Ya tienes ese plan.',
  invalid_plan: 'Ese plan no está disponible.',
  invalid_businesses: 'Solo puedes incluir locales de los que eres propietario.',
  stripe_error: 'Stripe no ha podido hacerlo. Prueba otra vez en un momento.',
};

/** Llama a la Edge Function `billing` con la sesión. Devuelve el JSON o lanza
 * un error con su frase. */
async function planFn(op, extra = {}) {
  const { data, error } = await sb.functions.invoke('billing', { body: { op, business_id: BIZ.id, ...extra } });
  if (!error) return data;
  let codigo = 'stripe_error';
  try { codigo = (await error.context.json()).error || codigo; } catch (_) { /* sin cuerpo */ }
  throw new Error(I18N.t(PLAN_ERR[codigo] || friendly(codigo)));
}

/** Precio sin IVA de `n` locales con la escalera de un precio, como lo
 * cobra Stripe: `graduated` (lo decidido el 14-10: el primero 19,90 €, del
 * 2.º al 5.º 15 € cada uno…) o `volume` (todos al precio del tramo). Lo mismo
 * que `billing_price_total` en la base. */
function planPrecio(tiers, n, mode = 'graduated') {
  const q = Math.max(1, n);
  const ts = tiers || [];
  if (mode === 'volume') {
    const t = ts.find((x) => x.up_to == null || q <= x.up_to) || {};
    return { total: (t.unit_cents ?? 0) * q };
  }
  let total = 0;
  let desde = 0;
  for (const t of ts) {
    const hasta = t.up_to == null ? q : Math.min(q, t.up_to);
    if (hasta > desde) total += (t.unit_cents ?? 0) * (hasta - desde);
    if (t.up_to == null || q <= t.up_to) break;
    desde = t.up_to;
  }
  return { total };
}
const planDia = (iso) => (iso ? new Date(iso).toLocaleDateString(LOC(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }) : '');
const planNombre = (names, slug) => names?.[I18N.lang] || names?.[I18N.pub] || names?.es || slug || '';
const planPor = (interval) => (interval === 'year' ? bi('al año', 'a year') : bi('al mes', 'a month'));
const planMasIva = (cents, interval) => bi(`${fmtMoney(cents)} + IVA ${interval === 'year' ? 'al año' : 'al mes'}`,
  `${fmtMoney(cents)} + VAT ${interval === 'year' ? 'a year' : 'a month'}`);

/** Etiqueta y frase del estado (las mismas que la app). */
function planEstado(sub, bill, st) {
  const fin = sub.period_end ? planDia(sub.period_end) : '';
  if (bill.hold === 'unpaid') {
    return ['bad', bi('PAGO PENDIENTE', 'PAYMENT DUE'),
      bi(`Hay un pago pendiente desde el ${planDia(bill.past_due_since || bill.hold_since)}. Tus publicaciones no se ven hasta que se resuelva; no se ha borrado nada.`,
        `A payment has been due since ${planDia(bill.past_due_since || bill.hold_since)}. Your publications are hidden until it's sorted; nothing has been deleted.`)];
  }
  if (sub.status === 'past_due') {
    return ['warn', bi('PAGO PENDIENTE', 'PAYMENT DUE'),
      bi(`No hemos podido cobrar. Si no se resuelve antes del ${planDia(bill.grace_until)}, pausaremos tus publicaciones (no se borra nada).`,
        `We couldn't take the payment. If it isn't sorted by ${planDia(bill.grace_until)}, we'll pause your publications (nothing is deleted).`)];
  }
  if (sub.status === 'paused' || bill.hold === 'paused') {
    return ['dim', bi('EN PAUSA', 'PAUSED'),
      bi(`Plan en pausa hasta el ${planDia(bill.paused_until)}: no se cobra y tus publicaciones no se ven. Todo lo demás se queda como está.`,
        `Plan paused until ${planDia(bill.paused_until)}: nothing is charged and your publications are hidden. Everything else stays as it is.`)];
  }
  if (bill.cancel_at_period_end) {
    return ['warn', bi('CANCELADO', 'CANCELLED'),
      bi(`Cancelado: sigue con todo hasta el ${planDia(bill.ends_at)} y después no se renueva.`,
        `Cancelled: everything stays on until ${planDia(bill.ends_at)} and then it won't renew.`)];
  }
  if (sub.status === 'trial') {
    return ['st-trial', bi('PRUEBA', 'TRIAL'), st
      ? bi(`Prueba gratis hasta el ${fin}. Después se cobrará con la forma de pago que elegiste.`,
        `Free trial until ${fin}. After that, it will be charged to the payment method you chose.`)
      : bi(`Prueba con todo hasta el ${fin}, sin tarjeta y sin renovación automática. Mientras tu ciudad arranca, sigues gratis.`,
        `Everything included until ${fin}, no card and no automatic renewal. While your city is launching, it stays free.`)];
  }
  if (sub.plan_slug === 'free') {
    return ['dim', bi('GRATIS', 'FREE'), bi('Gratis mientras tu ciudad arranca, sin límite de publicaciones. Te avisaremos con un mes de antelación antes de cobrar.',
      'Free while your city is launching, with no limit on publications. We’ll give you a month’s notice before charging.')];
  }
  return ['ok', bi('ACTIVO', 'ACTIVE'), st ? bi('Al día. Sin permanencia y sin comisión por canje.', 'Up to date. No minimum term and no commission per redemption.')
    : bi('Al día, con pago por transferencia. Sin permanencia y sin comisión por canje.', 'Up to date, paid by bank transfer. No minimum term and no commission per redemption.')];
}

PAGES.plan = async (v) => {
  const ov = await rpc('billing_overview', { p_business: BIZ.id });
  const sub = ov.subscription || {};
  const bill = sub.billing || {};
  const st = ov.stripe;
  const duena = ov.is_owner;
  const [tono, etiqueta, frase] = planEstado(sub, bill, st);
  const nombre = planNombre(sub.plan_names, sub.plan_slug);
  const asunto = encodeURIComponent(I18N.lang === 'en' ? 'Klendar plan' : 'Plan de Klendar');
  const cuerpo = encodeURIComponent(`${I18N.lang === 'en' ? 'Business' : 'Negocio'}: ${BIZ.id}`);
  const correo = `mailto:info@klendar.app?subject=${asunto}&body=${cuerpo}`;

  // Datos: próxima factura, locales, forma de pago.
  const datos = [];
  if (st && bill.next_billing_at && bill.next_amount_cents != null) {
    datos.push([bi('Próxima factura', 'Next invoice'), `${planDia(bill.next_billing_at)} · ${planMasIva(bill.next_amount_cents, st.interval)}`]);
  }
  if (st) {
    datos.push([bi('Locales', 'Venues'), st.businesses.map((b) => b.name).join(', ')]);
    datos.push([bi('Forma de pago', 'Payment method'), bi('Tarjeta o domiciliación, con Stripe', 'Card or direct debit, with Stripe')]);
  } else if (['transfer', 'cash'].includes(sub.payment_method)) {
    datos.push([bi('Forma de pago', 'Payment method'), sub.payment_method === 'cash' ? bi('Efectivo', 'Cash') : bi('Transferencia', 'Bank transfer')]);
  }
  const factura = st?.invoice;
  const pagarYa = duena && st && (sub.status === 'past_due' || bill.hold === 'unpaid') && factura?.hosted_invoice_url && factura.status !== 'paid';

  let html = `<div class="page-head"><h1>Tu plan</h1></div>
    ${new URLSearchParams(location.hash.split('?')[1] || '').get('pago') === 'ok' && !st
      ? `<div class="help"><b>${esc(bi('Pago hecho.', 'Payment done.'))}</b> ${esc(bi('En unos segundos verás aquí tu plan al día.', 'In a few seconds you’ll see your plan up to date here.'))}</div>` : ''}
    <div class="card plan-card">
      <h2>${ms('workspace_premium')} ${esc(I18N.lang === 'en' ? `${nombre} plan` : `Plan ${nombre}`)} <span class="tag ${esc(tono)}">${esc(etiqueta)}</span></h2>
      <p class="muted" style="margin:0 0 10px">${esc(frase)}</p>
      ${datos.length ? `<dl class="plan-datos">${datos.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>` : ''}
      ${pagarYa ? `<p style="margin:12px 0 0"><a class="btn primary" href="${esc(factura.hosted_invoice_url)}" target="_blank" rel="noopener">${ms('credit_card')}${esc(bi('Pagar la factura pendiente', 'Pay the outstanding invoice'))}</a></p>` : ''}
      ${duena && st ? `<div class="plan-botones">
        <button class="btn" type="button" id="plan-cambiar">${ms('edit')}${esc(bi('Cambiar de plan', 'Change plan'))}</button>
        <button class="btn" type="button" id="plan-portal">${ms('credit_card')}${esc(bi('Gestionar el pago', 'Manage payment'))}</button>
      </div>
      <p class="muted small" style="margin:8px 0 0">${esc(bi('«Gestionar el pago» abre Stripe: tarjeta, datos de la factura (nombre fiscal, NIF y dirección) y tus facturas.', '“Manage payment” opens Stripe: card, invoice details (legal name, tax ID and address) and your invoices.'))}</p>` : ''}
      ${!duena ? `<p class="muted small" style="margin:8px 0 0">${esc(bi('El plan lo gestiona el propietario del negocio.', 'The plan is managed by the business owner.'))}</p>` : ''}
      ${duena && !st && !ov.ready ? `<p style="margin:12px 0 0"><a class="btn sm" href="${correo}">${ms('mail')}${esc(bi('Preguntar por el plan', 'Ask about the plan'))}</a></p>` : ''}
    </div>`;

  // Pausa por cierre (solo mensual; el anual, escribiendo).
  if (duena && st && ov.pause) {
    const p = ov.pause;
    const enPausa = sub.status === 'paused' || bill.hold === 'paused';
    html += `<div class="card"><h2>${ms('event_busy')} ${esc(bi('Pausa por cierre', 'Pause while closed'))}</h2>
      ${enPausa
        ? `<p class="muted" style="margin:0 0 10px">${esc(bi(`En pausa hasta el ${planDia(bill.paused_until)}. Puedes reanudarlo antes.`, `Paused until ${planDia(bill.paused_until)}. You can resume it earlier.`))}</p>
           <button class="btn" type="button" id="plan-reanudar">${ms('play_circle')}${esc(bi('Reanudar ahora', 'Resume now'))}</button>`
        : `<p class="muted" style="margin:0 0 10px">${esc(bi(`Si cierras por vacaciones, obras o temporada, pausa el plan: no se cobra y tus publicaciones no se ven mientras dure. Tus clientes, sellos y bonos se quedan. Hasta ${p.max_days} días al año; te quedan ${p.left_days}.`,
          `If you close for holidays, works or the season, pause the plan: nothing is charged and your publications are hidden while it lasts. Your customers, stamps and passes stay. Up to ${p.max_days} days a year; you have ${p.left_days} left.`))}</p>
          ${st.interval === 'month' && p.left_days >= p.min_days && sub.status === 'active'
            ? `<button class="btn" type="button" id="plan-pausar">${ms('timer_off')}${esc(bi('Pausar el plan…', 'Pause the plan…'))}</button>`
            : `<p class="muted small" style="margin:0">${esc(st.interval !== 'month'
              ? bi('Con el plan anual, escríbenos y alargamos la renovación.', 'With the yearly plan, write to us and we’ll push back the renewal.')
              : sub.status !== 'active' ? bi('Se puede pausar cuando el plan está activo y al día.', 'You can pause once the plan is active and up to date.')
                : bi('Ya has usado los días de pausa de este año.', 'You’ve used this year’s pause days.'))}</p>`}`}
    </div>`;
  }

  // Pagar con tarjeta (aún sin suscripción de Stripe).
  const libres = (ov.locales || []).filter((l) => !l.covered && !l.free_forever);
  const gratisSiempre = (ov.locales || []).find((l) => l.id === BIZ.id)?.free_forever;
  if (duena && !st && ov.ready && ov.can_add_to) {
    html += `<div class="card"><h2>${ms('storefront')} ${esc(bi('Añadir este local a tu suscripción', 'Add this venue to your subscription'))}</h2>
      <p class="muted" style="margin:0 0 10px">${esc(bi('Ya pagas el plan de otro local con tarjeta. Súmalo a esa suscripción: el precio por local baja con la escalera y Stripe ajusta la próxima factura.',
        'You already pay for another venue by card. Add this one to that subscription: the price per venue drops with the sliding scale and Stripe adjusts the next invoice.'))}</p>
      <button class="btn primary" type="button" id="plan-anadir">${ms('storefront')}${esc(bi('Añadir este local', 'Add this venue'))}</button></div>`;
  } else if (duena && !st && ov.ready && !gratisSiempre && (ov.plans || []).length) {
    const enPrueba = sub.status === 'trial' && sub.period_end;
    html += `<div class="card"><h2>${ms('credit_card')} ${esc(bi('Pagar el plan con tarjeta', 'Pay for the plan by card'))}</h2>
      <p class="muted" style="margin:0 0 12px">${esc(enPrueba
        ? bi(`No se cobra nada hasta que acabe tu prueba, el ${planDia(sub.period_end)}. Sin permanencia: cancelas cuando quieras.`, `Nothing is charged until your trial ends on ${planDia(sub.period_end)}. No minimum term: cancel whenever you like.`)
        : bi('Sin permanencia: cancelas cuando quieras. Precios sin IVA.', 'No minimum term: cancel whenever you like. Prices exclude VAT.'))}</p>
      <form id="plan-pagar" class="plan-form">
        ${ov.plans.length > 1 ? `<fieldset><legend>${esc(bi('Plan', 'Plan'))}</legend>${ov.plans.map((p, i) => `<label class="opc"><input type="radio" name="plan" value="${esc(p.slug)}" ${i === 0 ? 'checked' : ''}> ${esc(planNombre(p.names, p.slug))}</label>`).join('')}</fieldset>` : `<input type="hidden" name="plan" value="${esc(ov.plans[0].slug)}">`}
        <fieldset><legend>${esc(bi('Cada cuánto', 'How often'))}</legend>
          <label class="opc"><input type="radio" name="interval" value="month" checked> ${esc(bi('Cada mes', 'Monthly'))}</label>
          <label class="opc"><input type="radio" name="interval" value="year"> ${esc(bi('Cada año', 'Yearly'))}</label>
        </fieldset>
        ${libres.length > 1 ? `<fieldset><legend>${esc(bi('Locales', 'Venues'))}</legend>${libres.map((l) => `<label class="opc"><input type="checkbox" name="loc" value="${esc(l.id)}" ${l.id === BIZ.id ? 'checked disabled' : ''}> ${esc(l.name)}${l.city ? ` <span class="muted">· ${esc(l.city)}</span>` : ''}</label>`).join('')}
          <small class="muted">${esc(bi('El primer local paga la cuota entera; los siguientes, menos.', 'The first venue pays the full fee; the others pay less.'))}</small></fieldset>` : ''}
        <p class="plan-total" id="plan-total" aria-live="polite"></p>
        <button class="btn primary" type="submit">${ms('payment')}${esc(bi('Continuar al pago', 'Continue to payment'))}</button>
        <small class="muted">${esc(bi('El pago lo hace Stripe: Klendar no ve ni guarda tu tarjeta. Te pedirá el nombre fiscal, el NIF y la dirección para la factura.', 'Payment is handled by Stripe: Klendar never sees or stores your card. It will ask for your legal name, tax ID and address for the invoice.'))}</small>
      </form></div>`;
  }

  // Locales y cancelar (propietario con tarjeta).
  if (duena && st) {
    html += `<div class="card"><h2>${ms('more_horiz')} ${esc(bi('Más', 'More'))}</h2><div class="plan-mas">
      ${st.quantity > 1 ? `<button class="btn sm ghost" type="button" id="plan-quitar">${esc(bi('Quitar este local de la suscripción…', 'Remove this venue from the subscription…'))}</button>` : ''}
      ${!bill.cancel_at_period_end ? `<a class="btn sm ghost" href="#/baja">${esc(bi('Cancelar la suscripción…', 'Cancel the subscription…'))}</a>` : `<a class="btn sm ghost" href="#/baja">${esc(bi('Deshacer la cancelación…', 'Undo the cancellation…'))}</a>`}
    </div></div>`;
  }
  v.innerHTML = html;

  // ── Acciones ──────────────────────────────────────────────────────────────
  const espera = async (boton, trabajo) => {
    boton.disabled = true;
    try { await trabajo(); } catch (e) { toast(e.message, true); boton.disabled = false; }
  };
  const vete = (url) => { location.href = url; };

  const form = $('#plan-pagar', v);
  if (form) {
    const elegido = () => {
      const plan = ov.plans.find((p) => p.slug === (form.elements.plan.value || ov.plans[0].slug)) || ov.plans[0];
      const interval = form.elements.interval.value;
      const locs = [BIZ.id, ...$$('input[name=loc]:checked:not(:disabled)', form).map((x) => x.value)];
      return { plan, interval, locs };
    };
    const pinta = () => {
      const { plan, interval, locs } = elegido();
      // Sin precio anual (o mensual) en Stripe: esa opción no se ofrece.
      $$('input[name=interval]', form).forEach((x) => { x.disabled = !plan.prices?.[x.value]; });
      if (!plan.prices?.[interval]) { const otra = $$('input[name=interval]:not(:disabled)', form)[0]; if (otra) otra.checked = true; }
      const iv = form.elements.interval.value;
      const pr = planPrecio(plan.prices?.[iv]?.tiers, locs.length, plan.prices?.[iv]?.mode);
      $('#plan-total', v).textContent = locs.length > 1
        ? bi(`Total: ${planMasIva(pr.total, iv)} (${locs.length} locales)`, `Total: ${planMasIva(pr.total, iv)} (${locs.length} venues)`)
        : bi(`Total: ${planMasIva(pr.total, iv)}`, `Total: ${planMasIva(pr.total, iv)}`);
    };
    form.addEventListener('change', pinta);
    pinta();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const { plan, locs } = elegido();
      const boton = $('button[type=submit]', form);
      await espera(boton, async () => {
        const r = await planFn('checkout', { plan: plan.slug, interval: form.elements.interval.value, businesses: locs });
        vete(r.url);
      });
    };
  }

  const portal = $('#plan-portal', v);
  if (portal) portal.onclick = () => espera(portal, async () => vete((await planFn('portal', { flow: '' })).url));

  const cambiar = $('#plan-cambiar', v);
  if (cambiar) {
    cambiar.onclick = async () => {
      const opciones = [];
      for (const p of ov.plans || []) {
        for (const iv of ['month', 'year']) {
          if (!p.prices?.[iv]) continue;
          const pr = planPrecio(p.prices[iv].tiers, st.quantity, p.prices[iv].mode);
          opciones.push([`${p.slug}|${iv}`, `${planNombre(p.names, p.slug)} · ${planMasIva(pr.total, iv)}`]);
        }
      }
      if (opciones.length < 2) { toast(I18N.t('Ahora mismo no hay otro plan al que cambiar.')); return; }
      const r = await modal({
        title: bi('Cambiar de plan', 'Change plan'),
        intro: esc(bi('El cambio vale desde ya: Stripe descuenta lo que no has usado del plan de ahora y cobra la diferencia. Precios sin IVA.',
          'The change applies straight away: Stripe credits what you haven’t used of the current plan and charges the difference. Prices exclude VAT.')),
        fields: [{ name: 'p', label: bi('Plan nuevo', 'New plan'), type: 'select', value: opciones[0][0], options: opciones }],
        submit: bi('Cambiar', 'Change'),
      });
      if (!r) return;
      const [plan, interval] = r.p.split('|');
      await espera(cambiar, async () => { await planFn('change_plan', { plan, interval }); toast(I18N.t('Plan cambiado')); route(); });
    };
  }

  const pausar = $('#plan-pausar', v);
  if (pausar) {
    pausar.onclick = async () => {
      const p = ov.pause;
      const r = await modal({
        title: bi('Pausar el plan', 'Pause the plan'),
        intro: esc(bi('Mientras dure no se cobra nada y tus publicaciones no se ven (los códigos y reservas que ya tiene la gente siguen valiendo). Se reanuda solo ese día.',
          'While it lasts nothing is charged and your publications are hidden (codes and bookings people already have stay valid). It resumes on its own that day.')),
        fields: [{ name: 'dias', label: bi(`Días (de ${p.min_days} a ${p.left_days})`, `Days (${p.min_days} to ${p.left_days})`), type: 'number', value: String(Math.min(30, p.left_days)), min: String(p.min_days), max: String(p.left_days), required: true }],
        submit: bi('Pausar', 'Pause'),
      });
      if (!r) return;
      await espera(pausar, async () => { await planFn('pause', { days: Number(r.dias) }); toast(I18N.t('Plan en pausa')); route(); });
    };
  }
  const reanudar = $('#plan-reanudar', v);
  if (reanudar) reanudar.onclick = () => espera(reanudar, async () => { await planFn('resume'); toast(I18N.t('Plan reanudado')); route(); });

  const anadir = $('#plan-anadir', v);
  if (anadir) {
    anadir.onclick = async () => {
      if (!(await confirmDlg(bi('Añadir este local', 'Add this venue'), esc(bi('Stripe sumará este local a tu suscripción y ajustará la próxima factura con la parte proporcional.', 'Stripe will add this venue to your subscription and adjust the next invoice proportionally.')), { submit: bi('Añadir', 'Add') }))) return;
      await espera(anadir, async () => { await planFn('add_location'); toast(I18N.t('Local añadido a tu suscripción')); route(); });
    };
  }
  const quitar = $('#plan-quitar', v);
  if (quitar) {
    quitar.onclick = async () => {
      if (!(await confirmDlg(bi('Quitar este local', 'Remove this venue'), esc(bi('Deja de pagarse con la suscripción desde hoy (Stripe ajusta la próxima factura). El local no se borra; su plan vuelve a como estaba antes de pagar.', 'It stops being paid by the subscription from today (Stripe adjusts the next invoice). The venue isn’t deleted; its plan goes back to how it was before paying.')), { submit: bi('Quitar', 'Remove'), danger: true }))) return;
      await espera(quitar, async () => { await planFn('remove_location'); toast(I18N.t('Local quitado de la suscripción')); route(); });
    };
  }

  // Vuelta de Stripe Checkout: el aviso de Stripe tarda unos segundos.
  if (!st && new URLSearchParams(location.hash.split('?')[1] || '').get('pago') === 'ok') {
    for (let i = 0; i < 6; i++) {
      await new Promise((ok) => setTimeout(ok, 2500));
      if (!v.isConnected) return;
      const otra = await rpc('billing_overview', { p_business: BIZ.id }).catch(() => null);
      if (otra?.stripe) { history.replaceState(null, '', '#/plan'); route(); return; }
    }
  }
};
