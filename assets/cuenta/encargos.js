/* «Tu cuenta»: Encargos (migraciones 20261284000000 y …010 de la app). Lo
 * mismo que la app:
 *
 * - `/cuenta/encargar/<negocio>[?item=<id>]`: «Hacer un encargo». Qué,
 *   cuántos, las opciones, los alérgenos a la vista (Reg. (UE) 1169/2011,
 *   art. 14), el día (solo con hueco) y la franja, la nota con «No escribas
 *   datos de salud…», el teléfono (como al reservar, con `contact_details`) y
 *   el resumen con «Se paga al recogerlo en X» y «El encargo es con el
 *   negocio; Klendar no cobra ni responde del pedido». Hace falta sesión.
 * - `/cuenta/encargo/<id>`: el encargo con su QR, el día y la franja, y
 *   «Anular el encargo» hasta el plazo.
 * - En «Tus códigos», «Tus encargos» (`encargosHtml`), con «Quitar de la
 *   lista» en los terminados.
 *
 * Va después de app.js y comparte ámbito: los nombres empiezan por
 * `encargo`.
 */
'use strict';

/** Los 14 del anexo II, con su nombre oficial (las claves de la carta). */
const ENCARGO_ALERGENOS = [
  ['gluten', 'Cereales que contienen gluten', 'Cereals containing gluten'],
  ['crustaceos', 'Crustáceos', 'Crustaceans'],
  ['huevos', 'Huevos', 'Eggs'],
  ['pescado', 'Pescado', 'Fish'],
  ['cacahuetes', 'Cacahuetes', 'Peanuts'],
  ['soja', 'Soja', 'Soybeans'],
  ['lacteos', 'Leche (incluida la lactosa)', 'Milk (including lactose)'],
  ['frutos_cascara', 'Frutos de cáscara', 'Nuts'],
  ['apio', 'Apio', 'Celery'],
  ['mostaza', 'Mostaza', 'Mustard'],
  ['sesamo', 'Granos de sésamo', 'Sesame seeds'],
  ['sulfitos', 'Dióxido de azufre y sulfitos', 'Sulphur dioxide and sulphites'],
  ['altramuces', 'Altramuces', 'Lupin'],
  ['moluscos', 'Moluscos', 'Molluscs'],
];
const encargoAlergeno = (k) => {
  const a = ENCARGO_ALERGENOS.find((x) => x[0] === k);
  return a ? (EN ? a[2] : t(a[1])) : k;
};
/** «Alérgenos: Contiene: …», «Sin alérgenos de la lista» o nada. */
function encargoAlergenosTexto(i) {
  if (i.allergens_none) return EN ? 'None of the listed allergens' : t('Sin alérgenos de la lista');
  const l = ENCARGO_ALERGENOS.filter((a) => (i.allergens || []).includes(a[0])).map((a) => encargoAlergeno(a[0]));
  if (!l.length) return '';
  return EN ? `Contains: ${l.join(', ')}` : t('Contiene: {list}').replace('{list}', l.join(', '));
}

const ENCARGO_ERR = {
  full: 'Ese día ya no queda hueco. Elige otro.',
  too_soon: 'Ese día ya no llega a tiempo. Elige otro.',
  bad_day: 'Ese día ya no llega a tiempo. Elige otro.',
  closed_day: 'Ese día el negocio cierra. Elige otro.',
  unavailable: 'Ahora no se puede encargar aquí.',
  paused: 'Ahora no se puede encargar aquí.',
  not_found: 'Ahora no se puede encargar aquí.',
  off: 'Ahora no se puede encargar aquí.',
  allergens_missing: 'Ahora no se puede encargar aquí.',
  adults_only: 'Solo para mayores de 18 años.',
  team_member: 'Eres del equipo: no puedes encargar en tu negocio.',
  too_many: 'Ya tienes muchos encargos aquí por recoger.',
  bad_phone: 'Revisa el teléfono: solo números y espacios.',
  bad_options: 'Elige una opción de cada.',
  too_late: 'Ya ha pasado el plazo para anularlo. Habla con el negocio.',
};
const encargoError = (e) => (ENCARGO_ERR[e?.clave] ? t(ENCARGO_ERR[e.clave]) : (e?.message || amable('')));

const ENCARGO_ESTADO = {
  pending: ['Por aceptar', 'To accept'],
  accepted: ['Aceptado', 'Accepted'],
  ready: ['Listo para recoger', 'Ready to pick up'],
  picked_up: ['Recogido', 'Picked up'],
  no_show: ['No vino', 'Didn’t come'],
  rejected: ['Rechazado', 'Declined'],
  cancelled: ['Anulado por el cliente', 'Cancelled by the customer'],
  closed: ['Cancelado por cierre', 'Cancelled: closed'],
  expired: ['Sin confirmar', 'Not confirmed'],
};
const encargoEstado = (s) => {
  const x = ENCARGO_ESTADO[s] || ENCARGO_ESTADO.pending;
  return EN ? x[1] : t(x[0]);
};
const encargoVivo = (p) => ['pending', 'accepted', 'ready'].includes(p.status);
const encargoQue = (p) => (p.quantity > 1 ? `${p.quantity} × ${p.item_name}` : p.item_name);
const encargoDia = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short' });
const encargoEuros = (c, cur) => (c == null ? '' : (c / 100).toLocaleString(LOC, { style: 'currency', currency: cur || 'EUR' }));
const encargoPrecio = (c, cur) => (c == null
  ? (EN ? 'Price: the business will tell you.' : t('Precio: te lo dice el negocio.'))
  : EN ? `Approximate price: from ${encargoEuros(c, cur)}.` : t('Precio orientativo: desde {price}.').replace('{price}', encargoEuros(c, cur)));
const encargoPaga = (n) => (EN ? `You pay when you pick it up at ${n}.` : t('Se paga al recogerlo en {business}.').replace('{business}', n));
const encargoAviso = () => (EN ? 'The pre-order is with the business; Klendar doesn’t charge or answer for the order.'
  : t('El encargo es con el negocio; Klendar no cobra ni responde del pedido.'));

/** «Tus encargos» en «Tus códigos» (vacío sin encargos). */
function encargosHtml(lista, quitar) {
  if (!Array.isArray(lista) || !lista.length) return '';
  const fila = (p) => `<a class="ocard" href="${pre}/cuenta/encargo/${esc(p.id)}">
      <span class="otxt"><b>${esc(encargoQue(p))}</b>
      <span class="muted">${esc(p.business_name)} · ${esc(encargoDia(p.pickup_day))} · ${esc(p.slot_start)}–${esc(p.slot_end)}</span>
      <span>${esc(encargoEstado(p.status))}</span></span>
      ${ic(encargoVivo(p) ? 'qr_code_2' : 'chevron_right')}</a>`;
  return `${seccionQuitable(EN ? 'Your pre-orders' : t('Tus encargos'), quitar && lista.some((p) => !encargoVivo(p)) ? 'preorders' : '')}
    <div class="olist" id="codigosEncargos">${lista.map((p) => quitable(fila(p), p.id, quitar && !encargoVivo(p))).join('')}</div>`;
}

RUTAS.encargo = async ([id]) => {
  if (!exigeSesion(`encargo/${id || ''}`)) return;
  const lista = await llamar('my_preorders', { p_limit: 100, p_offset: 0 }).catch(() => []);
  const p = (lista || []).find((x) => x.id === id);
  if (!p) {
    pinta(pantallaVacia({ icono: 'qr_code_2', titulo: EN ? 'Pre-order not found' : t('No encontramos el encargo'), texto: '' }));
    return;
  }
  const precio = p.price_from_cents == null ? null : p.price_from_cents * p.quantity;
  pinta(`
    <p class="crumbs"><a href="${pre}/cuenta/codigos">${esc(t('Tus códigos'))}</a></p>
    <div class="card codigo-card">
      <h1>${esc(encargoQue(p))}</h1>
      <p>${esc(p.business_name)}</p>
      <p><b>${esc(new Date(`${p.pickup_day}T12:00:00`).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(p.slot_start)}–${esc(p.slot_end)}</b></p>
      <p><b>${esc(encargoEstado(p.status))}</b></p>
      ${p.status === 'rejected' && p.reject_reason ? `<p>${esc(EN ? `Reason: ${p.reject_reason}` : t('Motivo: {reason}').replace('{reason}', p.reject_reason))}</p>` : ''}
      ${(p.options || []).length ? `<p>${esc(p.options.map((o) => `${o.group}: ${o.value}`).join(' · '))}</p>` : ''}
      ${encargoVivo(p) ? `<div class="qr" id="qr" role="img" aria-label="${esc(t('Código QR para que el negocio valide tu canje'))}"></div>
      <p class="muted">${esc(EN ? 'Show it when you pick it up.' : t('Enséñalo al recogerlo.'))}</p>
      <p><b>${esc(encargoPaga(p.business_name))}</b> ${esc(encargoPrecio(precio, p.currency))}</p>
      ${p.can_cancel ? `<p class="muted">${esc(EN ? `You can cancel until ${fecha(p.cancel_until)}.` : t('Puedes anularlo hasta el {when}.').replace('{when}', fecha(p.cancel_until)))}</p>
        <p><button type="button" class="pill peligro" id="anular">${esc(EN ? 'Cancel pre-order' : t('Anular el encargo'))}</button></p>` : ''}` : ''}
      <p class="muted">${esc(encargoAviso())}</p>
    </div>`);
  if (encargoVivo(p)) {
    const qr = window.qrcode(0, 'M');
    qr.addData(`https://klendar.app/r/${p.code}`);
    qr.make();
    $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }
  $('#anular')?.addEventListener('click', async (ev) => {
    const ok = await confirma({
      titulo: EN ? 'Cancel the pre-order?' : t('¿Anular el encargo?'),
      texto: EN ? 'We’ll let the business know.' : t('Se lo decimos al negocio.'),
      aceptar: EN ? 'Cancel pre-order' : t('Anular el encargo'),
      peligro: true,
    });
    if (!ok) return;
    await ocupado(ev.currentTarget, async () => {
      try {
        await llamar('cancel_preorder', { p_id: p.id });
        toast(EN ? 'Pre-order cancelled.' : t('Encargo anulado.'));
        navegar();
      } catch (e) { toast(encargoError(e), true); }
    });
  });
};

RUTAS.encargar = async ([negocio], params) => {
  if (!exigeSesion(`encargar/${negocio || ''}`)) return;
  const m = await llamar('preorder_menu', { p_business: negocio }).catch(() => null);
  if (!m || !m.enabled || !(m.items || []).length) {
    pinta(pantallaVacia({ icono: 'qr_code_2', titulo: EN ? 'Place a pre-order' : t('Hacer un encargo'),
      texto: EN ? 'You can’t pre-order here right now.' : t('Ahora no se puede encargar aquí.') }));
    return;
  }
  const contacto = m.contact ? await llamar('my_contact', {}).catch(() => null) : null;
  const st = { item: (m.items.find((i) => i.id === params?.get('item')) || (m.items.length === 1 ? m.items[0] : null)), qty: 1, opts: {}, day: null, slot: null, days: null };
  const L = (es, en) => (EN ? en : t(es));

  const cargaDias = async () => {
    st.days = null; st.day = null; st.slot = null;
    if (!st.item) return;
    try {
      const r = await llamar('preorder_days', { p_item: st.item.id, p_quantity: st.qty });
      st.days = r.days || [];
    } catch { st.days = []; }
  };
  const repinta = () => {
    const i = st.item;
    const precio = i && i.price_from_cents != null ? i.price_from_cents * st.qty : null;
    const dia = (st.days || []).find((d) => d.day === st.day);
    pinta(`
      <p class="crumbs"><a href="${pre}/b/${esc(negocio)}">${esc(m.business_name)}</a></p>
      <h1>${esc(L('Hacer un encargo', 'Place a pre-order'))}</h1>
      <h2 class="seccion-t">${esc(L('¿Qué encargas?', 'What are you ordering?'))}</h2>
      <div class="olist">${m.items.map((x) => {
    const al = encargoAlergenosTexto(x);
    return `<button type="button" class="ocard${i && i.id === x.id ? ' activa' : ''}" data-item="${esc(x.id)}" aria-pressed="${i && i.id === x.id}">
          <span class="otxt"><b>${esc(x.name)}</b>
          ${x.description ? `<span class="muted">${esc(x.description)}</span>` : ''}
          ${x.price_from_cents != null ? `<span>${esc(EN ? `From ${encargoEuros(x.price_from_cents, x.currency)}` : t('Desde {price}').replace('{price}', encargoEuros(x.price_from_cents, x.currency)))}</span>` : ''}
          ${al ? `<span><b>${esc(L('Alérgenos', 'Allergens'))}:</b> ${esc(al)}</span>` : ''}</span></button>`;
  }).join('')}</div>
      ${i ? `
        <h2 class="seccion-t">${esc(L('Cuántos', 'How many'))}</h2>
        <p><button type="button" class="pill" data-qty="-1" aria-label="${esc(L('Uno menos', 'One fewer'))}">−</button>
          <b class="encargo-n">${st.qty}</b>
          <button type="button" class="pill" data-qty="1" aria-label="${esc(L('Uno más', 'One more'))}">+</button></p>
        ${(i.options || []).map((g) => `<h2 class="seccion-t">${esc(g.name)}</h2>
          <p class="chips">${g.values.map((v) => `<button type="button" class="pill${st.opts[g.name] === v ? ' accent' : ''}" data-op="${esc(g.name)}" data-val="${esc(v)}" aria-pressed="${st.opts[g.name] === v}">${esc(v)}</button>`).join(' ')}</p>`).join('')}
        <h2 class="seccion-t">${esc(L('Día de recogida', 'Pick-up day'))}</h2>
        ${st.days == null ? '<p class="muted">…</p>' : !st.days.length
    ? `<p class="muted">${esc(L('Ahora no quedan días con hueco. Prueba con menos o más adelante.', 'No days with room right now. Try fewer or later on.'))}</p>`
    : `<p class="chips">${st.days.slice(0, 30).map((d) => `<button type="button" class="pill${d.day === st.day ? ' accent' : ''}" data-dia="${esc(d.day)}" aria-pressed="${d.day === st.day}">${esc(encargoDia(d.day))}</button>`).join(' ')}</p>`}
        ${dia ? `<h2 class="seccion-t">${esc(L('Franja', 'Time slot'))}</h2>
          <p class="chips">${dia.slots.map((s) => `<button type="button" class="pill${st.slot === s.start ? ' accent' : ''}" data-franja="${esc(s.start)}" aria-pressed="${st.slot === s.start}">${esc(s.start)}–${esc(s.end)}</button>`).join(' ')}</p>` : ''}
        <label class="campo"><span>${esc(L('Nota (opcional)', 'Note (optional)'))}</span>
          <textarea id="encargoNota" maxlength="300" rows="2" placeholder="${esc(L('Ej.: Que ponga «Feliz cumpleaños, Lucía»', 'E.g. Please write “Happy birthday, Lucía”'))}"></textarea></label>
        <p class="muted">${esc(L('No escribas datos de salud. Si tienes una alergia, consulta los alérgenos o contacta con el negocio.', 'Don’t write health information. If you have an allergy, check the allergens or contact the business.'))}</p>
        ${contacto && contacto.enabled ? `<label class="campo"><span>${esc(t('Teléfono (opcional)'))}</span>
          <input id="encargoTel" type="tel" inputmode="tel" maxlength="24" value="${esc(contacto.phone || '')}"></label>
          <p class="muted">${esc(EN ? `${m.business_name} will see your email and phone only to let you know about this pre-order. Never for advertising.`
    : t('{name} verá tu correo y tu teléfono solo para avisarte de este encargo. Nunca para publicidad.').replace('{name}', m.business_name))}</p>` : ''}
        <div class="card">
          <p><b>${esc(st.qty > 1 ? `${st.qty} × ${i.name}` : i.name)}</b></p>
          <p><b>${esc(encargoPaga(m.business_name))}</b></p>
          <p>${esc(encargoPrecio(precio, i.currency))}</p>
          <p class="muted">${esc(encargoAviso())}</p>
        </div>
        <p><button type="button" class="pill accent grande" id="encargar">${esc(L('Encargar', 'Order'))}</button></p>` : ''}`);
    const nota = $('#encargoNota');
    if (nota) nota.value = st.nota || '';
    nota?.addEventListener('input', () => { st.nota = nota.value; });
    $$('[data-item]').forEach((b) => { b.onclick = async () => { st.item = m.items.find((x) => x.id === b.dataset.item); st.qty = 1; st.opts = {}; await cargaDias(); repinta(); }; });
    $$('[data-qty]').forEach((b) => {
      b.onclick = async () => {
        const max = Math.min(20, i.daily_max || 20);
        st.qty = Math.max(1, Math.min(max, st.qty + Number(b.dataset.qty)));
        await cargaDias(); repinta();
      };
    });
    $$('[data-op]').forEach((b) => { b.onclick = () => { st.opts[b.dataset.op] = b.dataset.val; repinta(); }; });
    $$('[data-dia]').forEach((b) => {
      b.onclick = () => {
        st.day = b.dataset.dia;
        const d = st.days.find((x) => x.day === st.day);
        st.slot = d && d.slots.length === 1 ? d.slots[0].start : null;
        repinta();
      };
    });
    $$('[data-franja]').forEach((b) => { b.onclick = () => { st.slot = b.dataset.franja; repinta(); }; });
    $('#encargar')?.addEventListener('click', (ev) => ocupado(ev.currentTarget, async () => {
      if ((i.options || []).some((g) => !st.opts[g.name])) { toast(L('Elige una opción de cada.', 'Choose one of each option.'), true); return; }
      if (!st.day || !st.slot) { toast(L('Elige el día y la franja.', 'Choose the day and time slot.'), true); return; }
      try {
        const r = await llamar('place_preorder', {
          p_item: i.id, p_quantity: st.qty, p_options: st.opts, p_day: st.day, p_start: st.slot,
          p_note: (st.nota || '').trim() || null, p_phone: $('#encargoTel')?.value.trim() || null,
        });
        toast(L('Encargo hecho. Está en «Tus códigos».', 'Pre-order placed. It’s in “Your codes”.'));
        irA(`encargo/${r.id}`);
      } catch (e) {
        toast(encargoError(e), true);
        if (['full', 'too_soon', 'closed_day'].includes(e?.clave)) { await cargaDias(); repinta(); }
      }
    }));
  };
  await cargaDias();
  repinta();
};
