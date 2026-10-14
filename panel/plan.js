/* Panel del negocio: «Tu plan» (#/plan). Cobro con Stripe (migración
 * 20261216100000 de la app, Edge Function `billing`) y el bloqueo sin pago y
 * la pausa por cierre (migración 20261222100000).
 *
 * - Todo el equipo de gestión ve el plan, el estado (prueba, activo, pago
 *   pendiente, en proceso, bloqueado, en pausa, cancelado) y la próxima
 *   factura.
 * - Solo el propietario paga: elegir plan, mes o año y qué locales suyos
 *   (escalera por número de locales), y Stripe Checkout (tarjeta o
 *   domiciliación SEPA); luego «Cambiar de plan», «Gestionar el pago» (portal
 *   de Stripe: tarjeta, datos de factura, facturas), la pausa por cierre y
 *   añadir o quitar este local.
 * - Bloqueado (sin pagar): aquí se paga y, al pagar, todo vuelve solo. Un
 *   recibo devuelto (`dispute`) no tiene factura que pagar: se escribe.
 * - Pausa por cierre: con fecha de vuelta o sin fecha (= `pause.max_days`).
 *   Mientras dura, el negocio está parado como bloqueado; los días pagados se
 *   congelan y se gastan al volver (lo hace el servidor). «Volver a abrir».
 * - Mientras el cobro con tarjeta no esté encendido (`ready` = false), como
 *   antes: el estado y «Preguntar por el plan».
 * - Precios SIN IVA («+ IVA»): salen de la base (`billing_prices`), nunca de
 *   aquí. En Canarias, Ceuta y Melilla (`tax_region`), sin IVA y con su nota.
 *
 * La app no vende el plan (normas de Apple y Google): solo enseña el estado.
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `sb`, `BIZ`,
 * `gestiona`, `esPropietario`, `esc`, `ms`, `bi`, `toast`, `modal`,
 * `confirmDlg`, `fmtMoney`, `LOC`, `I18N`, `KZ`, `TZ`, `diaLargoFecha`,
 * `motivoBloqueo`, `volverAAbrir`, `cargaCobro`, `correoCobro`). Los nombres
 * de aquí empiezan por `plan`.
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
  pause_disabled: 'Ahora mismo no se puede pausar. Escríbenos a info@klendar.app.',
  invalid_days: 'Elige una fecha dentro de lo que se puede pausar.',
  past_due: 'Primero hay que ponerse al día con el pago.',
  payment_processing: 'No se puede pausar con un pago por domiciliación en proceso.',
  invoice_open: 'Primero hay que pagar la factura pendiente.',
  not_active: 'Se puede pausar cuando el plan está pagado y al día.',
  not_paused: 'Tu negocio no está en pausa.',
  already_paused: 'Tu negocio ya está en pausa.',
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
/** Canarias, Ceuta y Melilla: sin IVA (`tax_region`, lo decide la base por la
 * dirección del local). El precio va sin «+ IVA» y con su nota. */
const PLAN_SIN_IVA = ['canarias', 'ceuta', 'melilla'];
const planExento = (ov) => PLAN_SIN_IVA.includes(ov?.tax_region) || ov?.subscription?.billing?.tax_exempt === true;
const planNotaExento = () => bi('Operación no sujeta al IVA (Canarias, Ceuta y Melilla).', 'Transaction not subject to Spanish VAT (Canary Islands, Ceuta and Melilla).');
const planMasIva = (cents, interval, exento = false) => (exento
  ? bi(`${fmtMoney(cents)} ${interval === 'year' ? 'al año' : 'al mes'}`, `${fmtMoney(cents)} ${interval === 'year' ? 'a year' : 'a month'}`)
  : bi(`${fmtMoney(cents)} + IVA ${interval === 'year' ? 'al año' : 'al mes'}`,
    `${fmtMoney(cents)} + VAT ${interval === 'year' ? 'a year' : 'a month'}`));
/** Fechas de calendario (AAAA-MM-DD) en el negocio: hoy, `n` días después y
 * los días que hay entre dos. */
const planHoy = () => KZ.hoy(TZ);
const planMasDias = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const planDiasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/** Etiqueta y frase del estado (las mismas que la app). */
function planEstado(sub, bill, st) {
  const fin = sub.period_end ? planDia(sub.period_end) : '';
  const bloqueoEl = bill.block_on ? diaLargoFecha(bill.block_on) : '';
  const conBloqueo = bill.block_enabled === true;
  if (bill.hold === 'paused' || sub.status === 'paused') {
    return ['dim', bi('EN PAUSA', 'PAUSED'),
      bi(`Cerrado temporalmente hasta el ${planDia(bill.paused_until)}: tus publicaciones no se ven y no se cobra nada. Los días que tenías pagados se guardan y se gastan al volver.`,
        `Temporarily closed until ${planDia(bill.paused_until)}: your publications are hidden and nothing is charged. The days you’d already paid for are kept and used when you’re back.`)];
  }
  if (bill.blocked || bill.hold === 'unpaid' || bill.hold === 'ended') {
    return ['bad', bi('BLOQUEADO', 'BLOCKED'),
      `${motivoBloqueo(bill.block_kind || (bill.hold === 'unpaid' ? 'unpaid' : 'ended'), true)} ${bi('Tus publicaciones no se ven y tu ficha dice «No disponible ahora mismo». No se ha borrado nada: al pagar, todo vuelve solo.',
        'Your publications are hidden and your page says “Not available right now”. Nothing has been deleted: once paid, everything comes back on its own.')}`];
  }
  if (bill.dispute) {
    return ['bad', bi('PAGO PENDIENTE', 'PAYMENT DUE'),
      `${bi('El banco ha devuelto el recibo. Escríbenos a info@klendar.app para ponerlo al día.', 'The bank has returned the direct debit. Write to us at info@klendar.app to sort it out.')}${conBloqueo && bloqueoEl
        ? ` ${bi(`Si no se resuelve, tu negocio se bloqueará el ${bloqueoEl}.`, `If it isn’t sorted, your business will be blocked on ${bloqueoEl}.`)}` : ''}`];
  }
  if (bill.processing) {
    return ['dim', bi('EN PROCESO', 'PROCESSING'),
      bi('Pago por domiciliación en proceso: el banco tarda unos días en confirmarlo. Mientras, todo sigue funcionando.',
        'Direct debit payment in progress: the bank takes a few days to confirm it. Meanwhile, everything keeps working.')];
  }
  if (sub.status === 'past_due') {
    return ['warn', bi('PAGO PENDIENTE', 'PAYMENT DUE'), conBloqueo && bloqueoEl
      ? bi(`No hemos podido cobrar. Si no se resuelve antes del ${bloqueoEl}, tu negocio quedará bloqueado (no se borra nada).`,
        `We couldn't take the payment. If it isn't sorted by ${bloqueoEl}, your business will be blocked (nothing is deleted).`)
      : bi(`No hemos podido cobrar. Si no se resuelve antes del ${planDia(bill.grace_until)}, pausaremos tus publicaciones (no se borra nada).`,
        `We couldn't take the payment. If it isn't sorted by ${planDia(bill.grace_until)}, we'll pause your publications (nothing is deleted).`)];
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
      : conBloqueo
        ? bi(`Prueba con todo hasta el ${fin}, sin tarjeta y sin renovación automática. Para seguir después, paga el plan; si no, tu negocio quedará bloqueado (no se borra nada).`,
          `Everything included until ${fin}, no card and no automatic renewal. To carry on afterwards, pay for the plan; otherwise your business will be blocked (nothing is deleted).`)
        : bi(`Prueba con todo hasta el ${fin}, sin tarjeta y sin renovación automática. Mientras tu ciudad arranca, sigues gratis.`,
          `Everything included until ${fin}, no card and no automatic renewal. While your city is launching, it stays free.`)];
  }
  if (sub.plan_slug === 'free') {
    return ['dim', bi('GRATIS', 'FREE'), conBloqueo && fin
      ? bi(`Gratis de lanzamiento hasta el ${fin}. Para seguir después, paga el plan; si no, tu negocio quedará bloqueado (no se borra nada).`,
        `Free launch period until ${fin}. To carry on afterwards, pay for the plan; otherwise your business will be blocked (nothing is deleted).`)
      : bi('Gratis mientras tu ciudad arranca, sin límite de publicaciones. Te avisaremos con un mes de antelación antes de cobrar.',
        'Free while your city is launching, with no limit on publications. We’ll give you a month’s notice before charging.')];
  }
  return ['ok', bi('ACTIVO', 'ACTIVE'), st ? bi('Al día. Sin permanencia y sin comisión por canje.', 'Up to date. No minimum term and no commission per redemption.')
    : bi('Al día, con pago por transferencia. Sin permanencia y sin comisión por canje.', 'Up to date, paid by bank transfer. No minimum term and no commission per redemption.')];
}

/** Por qué ahora no se puede pausar (o null si se puede). Lo mismo que mira
 * la base (`billing_action_prepare`): nada pendiente ni en proceso, y lo
 * pagado (no la prueba ni el gratis de lanzamiento). */
function planNoPausa(sub, bill, st) {
  if (bill.blocked) return bi('Primero hay que pagar el plan.', 'You need to pay for the plan first.');
  if (bill.processing || st?.processing) return I18N.t(PLAN_ERR.payment_processing);
  if (bill.dispute || st?.dispute || sub.status === 'past_due') return I18N.t(PLAN_ERR.past_due);
  if (st?.invoice?.status === 'open') return I18N.t(PLAN_ERR.invoice_open);
  const pagado = st ? st.status === 'active' && sub.status === 'active'
    : sub.status === 'active' && !!sub.period_end && ['transfer', 'cash', 'card'].includes(sub.payment_method);
  if (!pagado) return bi('Se puede pausar cuando el plan está pagado y al día (no durante la prueba ni con el gratis de lanzamiento).',
    'You can pause once the plan is paid and up to date (not during the trial or the free launch period).');
  return null;
}

PAGES.plan = async (v) => {
  const ov = await rpc('billing_overview', { p_business: BIZ.id });
  const sub = ov.subscription || {};
  const bill = sub.billing || {};
  // Lo que se pinta en el resto del panel (el menú, el aviso) va con esto.
  if (ov.subscription && !!bill.blocked !== bloqueado()) { SUB = ov.subscription; renderNav('plan'); }
  else if (ov.subscription) SUB = ov.subscription;
  const st = ov.stripe;
  const duena = ov.is_owner;
  const exento = planExento(ov);
  const [tono, etiqueta, frase] = planEstado(sub, bill, st);
  const nombre = planNombre(sub.plan_names, sub.plan_slug);
  const asunto = encodeURIComponent(I18N.lang === 'en' ? 'Klendar plan' : 'Plan de Klendar');
  const cuerpo = encodeURIComponent(`${I18N.lang === 'en' ? 'Business' : 'Negocio'}: ${BIZ.id}`);
  const correo = `mailto:info@klendar.app?subject=${asunto}&body=${cuerpo}`;
  const parado = bill.blocked === true;
  const enPausa = bill.hold === 'paused' || !!ov.pause?.open;
  const dispute = !!(bill.dispute || st?.dispute);
  const metodos = Array.isArray(ov.payment_methods) ? ov.payment_methods : ['card'];
  const conSepa = metodos.includes('sepa_debit');

  // Datos: próxima factura, locales, forma de pago.
  const datos = [];
  if (st && bill.next_billing_at && bill.next_amount_cents != null) {
    datos.push([bi('Próxima factura', 'Next invoice'), `${planDia(bill.next_billing_at)} · ${planMasIva(bill.next_amount_cents, st.interval, exento)}`]);
  }
  if (st) {
    datos.push([bi('Locales', 'Venues'), st.businesses.map((b) => b.name).join(', ')]);
    datos.push([bi('Forma de pago', 'Payment method'), bi('Tarjeta o domiciliación, con Stripe', 'Card or direct debit, with Stripe')]);
  } else if (['transfer', 'cash'].includes(sub.payment_method)) {
    datos.push([bi('Forma de pago', 'Payment method'), sub.payment_method === 'cash' ? bi('Efectivo', 'Cash') : bi('Transferencia', 'Bank transfer')]);
  }
  const factura = st?.invoice;
  const pagarYa = duena && st && !dispute && (sub.status === 'past_due' || bill.hold === 'unpaid') && factura?.hosted_invoice_url && factura.status !== 'paid';
  // Se bloquea pronto (y la frase del estado no lo dice ya).
  const pronto = bill.block_soon && bill.block_on && !dispute && sub.status !== 'past_due' && !bill.processing
    ? bi(`Si no se paga antes, tu negocio se bloquea el ${diaLargoFecha(bill.block_on)}: tus publicaciones dejarán de verse y solo podrás validar los códigos y bonos que ya tiene la gente. No se borra nada.`,
      `If it isn’t paid before then, your business will be blocked on ${diaLargoFecha(bill.block_on)}: your publications will stop showing and you’ll only be able to validate the codes and passes people already have. Nothing is deleted.`)
    : '';

  let html = `<div class="page-head"><h1>Tu plan</h1></div>
    ${new URLSearchParams(location.hash.split('?')[1] || '').get('pago') === 'ok' && !st
      ? `<div class="help"><b>${esc(bi('Pago hecho.', 'Payment done.'))}</b> ${esc(bi('En unos segundos verás aquí tu plan al día.', 'In a few seconds you’ll see your plan up to date here.'))}</div>` : ''}
    <div class="card plan-card">
      <h2>${ms('workspace_premium')} ${esc(I18N.lang === 'en' ? `${nombre} plan` : `Plan ${nombre}`)} <span class="tag ${esc(tono)}">${esc(etiqueta)}</span></h2>
      <p class="muted" style="margin:0 0 10px">${esc(frase)}</p>
      ${pronto ? `<p class="plan-aviso" style="margin:0 0 10px"><b>${esc(pronto)}</b></p>` : ''}
      ${datos.length ? `<dl class="plan-datos">${datos.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(x)}</dd>`).join('')}</dl>` : ''}
      ${exento && st ? `<p class="muted small" style="margin:8px 0 0">${esc(planNotaExento())}</p>` : ''}
      ${pagarYa ? `<p style="margin:12px 0 0"><a class="btn primary" href="${esc(factura.hosted_invoice_url)}" target="_blank" rel="noopener">${ms('credit_card')}${esc(bi('Pagar la factura pendiente', 'Pay the outstanding invoice'))}</a></p>` : ''}
      ${duena && dispute ? `<p style="margin:12px 0 0"><a class="btn primary" href="${esc(correoCobro())}">${ms('mail')}${esc(I18N.t('Escribir a soporte'))}</a></p>` : ''}
      ${duena && st ? `<div class="plan-botones">
        <button class="btn" type="button" id="plan-cambiar">${ms('edit')}${esc(bi('Cambiar de plan', 'Change plan'))}</button>
        <button class="btn" type="button" id="plan-portal">${ms('credit_card')}${esc(bi('Gestionar el pago', 'Manage payment'))}</button>
      </div>
      <p class="muted small" style="margin:8px 0 0">${esc(bi('«Gestionar el pago» abre Stripe: tarjeta, datos de la factura (nombre fiscal, NIF y dirección) y tus facturas.', '“Manage payment” opens Stripe: card, invoice details (legal name, tax ID and address) and your invoices.'))}</p>` : ''}
      ${!duena ? `<p class="muted small" style="margin:8px 0 0">${esc(bi('El plan lo gestiona el propietario del negocio.', 'The plan is managed by the business owner.'))}</p>` : ''}
      ${duena && !st && !ov.ready && !enPausa ? `<p style="margin:12px 0 0"><a class="btn ${parado || pronto ? 'primary' : 'sm'}" href="${correo}">${ms('mail')}${esc(bi('Preguntar por el plan', 'Ask about the plan'))}</a></p>` : ''}
    </div>`;

  // Pausa por cierre: con fecha de vuelta o sin fecha. Abierta, «Volver a abrir».
  // Bloqueado sin pagar no se pausa: lo primero es pagar (y no se enseña).
  if (duena && ov.pause && (ov.pause.enabled || ov.pause.open) && (enPausa || !parado)) {
    const p = ov.pause;
    const motivo = enPausa ? null : planNoPausa(sub, bill, st);
    html += `<div class="card"><h2>${ms('event_busy')} ${esc(bi('Pausa por cierre', 'Pause while closed'))}</h2>
      ${enPausa
        ? `<p style="margin:0 0 6px"><b>${esc(bi(`Cerrado temporalmente hasta el ${planDia(p.open?.until || bill.paused_until)}.`, `Temporarily closed until ${planDia(p.open?.until || bill.paused_until)}.`))}</b></p>
           <p class="muted" style="margin:0 0 12px">${esc(bi('No se cobra nada y los días que tenías pagados se guardan: se gastan al volver. Vuelve solo ese día, o antes si quieres, y avisamos a tus seguidores.',
            'Nothing is charged and the days you’d already paid for are kept: they’re used when you’re back. It reopens on its own that day, or earlier if you like, and we let your followers know.'))}</p>
           <button class="btn primary" type="button" id="plan-reanudar">${ms('play_circle')}${esc(bi('Volver a abrir', 'Reopen'))}</button>`
        : `<p class="muted" style="margin:0 0 10px">${esc(bi(`Si cierras por vacaciones, obras o temporada, pausa tu negocio: no se cobra nada mientras dure y los días que ya tenías pagados se guardan para cuando vuelvas. Mientras, queda parado como si estuviera bloqueado: tus publicaciones no se ven y solo podrás validar los códigos y bonos que ya tiene la gente. Como mucho ${p.max_days} días cada vez.`,
          `If you close for holidays, works or the season, pause your business: nothing is charged while it lasts and the days you’d already paid for are kept for when you’re back. Meanwhile it’s on hold as if it were blocked: your publications are hidden and you can only validate the codes and passes people already have. Up to ${p.max_days} days each time.`))}</p>
          ${motivo ? `<p class="muted small" style="margin:0">${esc(motivo)}</p>`
            : `<button class="btn" type="button" id="plan-pausar">${ms('timer_off')}${esc(bi('Pausar el plan…', 'Pause the plan…'))}</button>`}`}
    </div>`;
  }

  // Pagar (aún sin suscripción de Stripe): con tarjeta o domiciliación.
  const libres = (ov.locales || []).filter((l) => !l.covered && !l.free_forever);
  const gratisSiempre = (ov.locales || []).find((l) => l.id === BIZ.id)?.free_forever;
  const formas = conSepa ? bi('Con tarjeta o con domiciliación bancaria (SEPA).', 'By card or by direct debit (SEPA).') : bi('Con tarjeta.', 'By card.');
  if (duena && !st && ov.ready && ov.can_add_to && !enPausa) {
    html += `<div class="card"><h2>${ms('storefront')} ${esc(bi('Añadir este local a tu suscripción', 'Add this venue to your subscription'))}</h2>
      <p class="muted" style="margin:0 0 10px">${esc(bi('Ya pagas el plan de otro local con tarjeta. Súmalo a esa suscripción: el precio por local baja con la escalera y Stripe ajusta la próxima factura.',
        'You already pay for another venue by card. Add this one to that subscription: the price per venue drops with the sliding scale and Stripe adjusts the next invoice.'))}</p>
      <button class="btn primary" type="button" id="plan-anadir">${ms('storefront')}${esc(bi('Añadir este local', 'Add this venue'))}</button></div>`;
  } else if (duena && !st && ov.ready && !gratisSiempre && !enPausa && (ov.plans || []).length) {
    const enPrueba = sub.status === 'trial' && sub.period_end;
    html += `<div class="card" id="plan-pagar-caja"><h2>${ms('credit_card')} ${esc(bi('Pagar el plan', 'Pay for the plan'))}</h2>
      <p class="muted" style="margin:0 0 12px">${esc(`${formas} ${parado
        ? bi('Al pagar, tu negocio vuelve a funcionar solo. Sin permanencia: cancelas cuando quieras.', 'Once paid, your business is back on its own. No minimum term: cancel whenever you like.')
        : enPrueba
          ? bi(`No se cobra nada hasta que acabe tu prueba, el ${planDia(sub.period_end)}. Sin permanencia: cancelas cuando quieras.`, `Nothing is charged until your trial ends on ${planDia(sub.period_end)}. No minimum term: cancel whenever you like.`)
          : bi('Sin permanencia: cancelas cuando quieras.', 'No minimum term: cancel whenever you like.')} ${exento ? planNotaExento() : bi('Precios sin IVA.', 'Prices exclude VAT.')}`)}</p>
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
        <small class="muted">${esc(conSepa
          ? bi('El pago lo hace Stripe: Klendar no ve ni guarda tu tarjeta ni tu cuenta. Te pedirá el nombre fiscal, el NIF y la dirección para la factura. Un cobro por domiciliación tarda unos días en confirmarse; mientras, tu negocio funciona con normalidad.',
            'Payment is handled by Stripe: Klendar never sees or stores your card or account. It will ask for your legal name, tax ID and address for the invoice. A direct debit takes a few days to confirm; meanwhile, your business works as normal.')
          : bi('El pago lo hace Stripe: Klendar no ve ni guarda tu tarjeta. Te pedirá el nombre fiscal, el NIF y la dirección para la factura.', 'Payment is handled by Stripe: Klendar never sees or stores your card. It will ask for your legal name, tax ID and address for the invoice.'))}</small>
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
        ? bi(`Total: ${planMasIva(pr.total, iv, exento)} (${locs.length} locales)`, `Total: ${planMasIva(pr.total, iv, exento)} (${locs.length} venues)`)
        : bi(`Total: ${planMasIva(pr.total, iv, exento)}`, `Total: ${planMasIva(pr.total, iv, exento)}`);
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
          opciones.push([`${p.slug}|${iv}`, `${planNombre(p.names, p.slug)} · ${planMasIva(pr.total, iv, exento)}`]);
        }
      }
      if (opciones.length < 2) { toast(I18N.t('Ahora mismo no hay otro plan al que cambiar.')); return; }
      const r = await modal({
        title: bi('Cambiar de plan', 'Change plan'),
        intro: esc(`${bi('El cambio vale desde ya: Stripe descuenta lo que no has usado del plan de ahora y cobra la diferencia.',
          'The change applies straight away: Stripe credits what you haven’t used of the current plan and charges the difference.')} ${exento ? planNotaExento() : bi('Precios sin IVA.', 'Prices exclude VAT.')}`),
        fields: [{ name: 'p', label: bi('Plan nuevo', 'New plan'), type: 'select', value: opciones[0][0], options: opciones }],
        submit: bi('Cambiar', 'Change'),
      });
      if (!r) return;
      const [plan, interval] = r.p.split('|');
      await espera(cambiar, async () => { await planFn('change_plan', { plan, interval }); toast(I18N.t('Plan cambiado')); route(); });
    };
  }

  // Pausar: hasta un día (de `min_days` a `max_days`) o sin fecha (= hasta
  // `max_days`). Primero se elige; luego se confirma con lo que va a pasar.
  const pausar = $('#plan-pausar', v);
  if (pausar) {
    pausar.onclick = async () => {
      const p = ov.pause;
      const hoy = planHoy();
      const desde = planMasDias(hoy, p.min_days || 1);
      const hasta = planMasDias(hoy, p.max_days);
      const espera1 = modal({
        title: bi('Pausar el plan', 'Pause the plan'),
        intro: esc(bi(`Elige el día en que vuelves a abrir. Sin fecha, la pausa dura como mucho ${p.max_days} días (hasta el ${diaLargoFecha(hasta)}); puedes volver antes cuando quieras.`,
          `Choose the day you reopen. Without a date, the pause lasts at most ${p.max_days} days (until ${diaLargoFecha(hasta)}); you can come back earlier whenever you like.`)),
        fields: [
          { name: 'modo', label: bi('Hasta cuándo', 'Until when'), type: 'select', value: 'fecha',
            options: [['fecha', bi('Hasta un día', 'Until a date')], ['sin', bi('Sin fecha', 'No date')]] },
          { name: 'dia', label: bi('Vuelves a abrir el', 'You reopen on'), type: 'date', value: planMasDias(hoy, Math.min(Math.max(14, p.min_days || 1), p.max_days)), min: desde, max: hasta },
        ],
        submit: bi('Seguir', 'Continue'),
      });
      // «Sin fecha» apaga el día.
      const caja = $('#modal');
      const modo = $('select[name=modo]', caja);
      const dia = $('input[name=dia]', caja);
      if (modo && dia) modo.onchange = () => { dia.disabled = modo.value === 'sin'; dia.closest('label').hidden = modo.value === 'sin'; };
      const r = await espera1;
      if (!r) return;
      const sinFecha = r.modo === 'sin';
      const vuelta = sinFecha ? hasta : r.dia;
      const dias = sinFecha ? null : planDiasEntre(hoy, vuelta);
      if (!sinFecha && (!/^\d{4}-\d{2}-\d{2}$/.test(vuelta || '') || dias < (p.min_days || 1) || dias > p.max_days)) {
        toast(I18N.t(PLAN_ERR.invalid_days), true);
        return;
      }
      const X = diaLargoFecha(vuelta);
      if (!(await confirmDlg(bi('¿Pausar el plan?', 'Pause the plan?'),
        esc(bi(`Mientras dure, tu negocio queda parado como si estuviera bloqueado: tus publicaciones no se ven, tu ficha dirá «Cerrado temporalmente hasta el ${X}» y solo podrás validar los códigos y bonos que ya tiene la gente. No se cobra nada y los días que ya tenías pagados se guardan para cuando vuelvas. Al volver avisamos a tus seguidores.`,
          `While it lasts, your business is on hold as if it were blocked: your publications are hidden, your page will say “Temporarily closed until ${X}” and you can only validate the codes and passes people already have. Nothing is charged and the days you’d already paid for are kept for when you’re back. When you reopen, we let your followers know.`)),
        { submit: bi('Pausar', 'Pause') }))) return;
      await espera(pausar, async () => {
        await planFn('pause', { days: dias });
        toast(bi(`Cerrado temporalmente hasta el ${X}`, `Temporarily closed until ${X}`));
        await cargaCobro();
        route();
      });
    };
  }
  const reanudar = $('#plan-reanudar', v);
  if (reanudar) reanudar.onclick = () => volverAAbrir(reanudar);

  const anadir = $('#plan-anadir', v);
  if (anadir) {
    anadir.onclick = async () => {
      if (!(await confirmDlg(bi('Añadir este local', 'Add this venue'), esc(bi('Stripe sumará este local a tu suscripción y ajustará la próxima factura con la parte proporcional.', 'Stripe will add this venue to your subscription and adjust the next invoice proportionally.')), { submit: bi('Añadir', 'Add') }))) return;
      await espera(anadir, async () => { await planFn('add_location'); toast(I18N.t('Local añadido a tu suscripción')); await cargaCobro(); route(); });
    };
  }
  const quitar = $('#plan-quitar', v);
  if (quitar) {
    quitar.onclick = async () => {
      if (!(await confirmDlg(bi('Quitar este local', 'Remove this venue'), esc(bi('Deja de pagarse con la suscripción desde hoy (Stripe ajusta la próxima factura). El local no se borra; su plan vuelve a como estaba antes de pagar.', 'It stops being paid by the subscription from today (Stripe adjusts the next invoice). The venue isn’t deleted; its plan goes back to how it was before paying.')), { submit: bi('Quitar', 'Remove'), danger: true }))) return;
      await espera(quitar, async () => { await planFn('remove_location'); toast(I18N.t('Local quitado de la suscripción')); await cargaCobro(); route(); });
    };
  }

  // Vuelta de Stripe Checkout: el aviso de Stripe tarda unos segundos.
  if (!st && new URLSearchParams(location.hash.split('?')[1] || '').get('pago') === 'ok') {
    for (let i = 0; i < 6; i++) {
      await new Promise((ok) => setTimeout(ok, 2500));
      if (!v.isConnected) return;
      const otra = await rpc('billing_overview', { p_business: BIZ.id }).catch(() => null);
      if (otra?.stripe) { history.replaceState(null, '', '#/plan'); await cargaCobro(); route(); return; }
    }
  }
};
