/* Panel del negocio: bonos pagados en el local (tanda B, migración
 * 20261202100000). Lo mismo que «Bonos» en «Mi negocio» de la app.
 *
 * - «Bonos» (#/bonos): los que vende el local («10 cafés por 12 €»), sus
 *   cifras (vendidos y usos de 30 días, activos ahora) y, para propietario y
 *   encargado, crear, cambiar, pausar y quitar (#/bonos/nuevo, #/bonos/<id>)
 *   y la lista de vendidos (#/bonos/vendidos) con quién vendió y cada uso.
 *   El personal los ve para venderlos.
 * - En «Validar códigos», el QR de cliente (klendar.app/c/…): la persona,
 *   sus bonos de este negocio, «Descontar un uso» y «Cargar un bono», con
 *   «Deshacer» durante 10 minutos (`bonoCliente`).
 *
 * El bono lo cobra el negocio en su local: Klendar no cobra nada y solo
 * lleva la cuenta. Va después de panel.js y usa lo suyo (`PAGES`, `rpc`,
 * `BIZ`, `gestiona`, `esc`, `ms`, `bi`, `toast`, `modal`, `confirmDlg`,
 * `table`, `helpBox`, `fmtMoney`, `fmtDate`, `fmtNum`, `friendly`). Comparten
 * ámbito: los nombres de aquí empiezan por `bono`.
 */
'use strict';

const BONO_ERR = {
  qr_expired: 'Ese QR ya no vale: pide que lo vuelva a enseñar desde «Tus códigos».',
  qr_invalid: 'No es un QR de cliente de Klendar.',
  own_qr: 'Es tu propio QR: no puedes cargarte ni usar un bono a ti mismo.',
  pass_used_up: 'No le quedan usos.',
  pass_expired: 'Este bono ha caducado.',
  too_fast: 'Ya se han descontado dos usos de este bono en el último minuto. Espera un momento.',
  scan_expired: 'Han pasado más de 10 minutos: vuelve a escanear su QR.',
  pass_type_paused: 'Ese bono está en pausa: no se vende.',
  pass_type_not_found: 'Ese bono ya no está.',
  not_found: 'Ese bono ya no está.',
  undo_too_late: 'Ya no se puede deshacer: han pasado más de 10 minutos.',
  pass_has_uses: 'Ya se ha usado: la venta no se puede deshacer.',
  already_undone: 'Ya estaba deshecho.',
  bad_name: 'Ponle un nombre (dos letras como mínimo).',
  bad_uses: 'Los usos tienen que estar entre 1 y 100.',
  bad_price: 'Escribe el precio, por ejemplo 12 o 12,50.',
  bad_months: 'La caducidad tiene que estar entre 1 y 36 meses.',
  too_long: 'Hay un texto demasiado largo.',
  too_many_passes: 'Como mucho 20 bonos. Quita alguno que ya no vendas.',
  rate_limited: 'Vas muy rápido. Espera un momento y vuelve a probar.',
  not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
};
const bonoError = (code) => I18N.t(BONO_ERR[code] || friendly(code));
/** Llama a la base; si dice que no, lanza el error ya en palabras. */
async function bonoRpc(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw Object.assign(new Error(bonoError(r.error)), { clave: r.error });
  return r;
}

/** Vibrar solo si ya se ha tocado la página (si no, el navegador lo bloquea
 * y lo apunta en la consola: pasa al llegar desde klendar.app/c/…). */
const bonoVibra = (patron) => {
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(patron);
};
/** El QR de cliente que se ha leído (o null). */
const bonoToken = (raw) => {
  const m = /(?:^|\/c\/)([0-9a-f]{16}\.[0-9]{1,12}\.[0-9a-f]{12})\s*$/i.exec(String(raw || '').trim());
  return m ? m[1].toLowerCase() : null;
};
/** «12 de noviembre de 2027». */
const bonoFecha = (iso) => (iso ? new Date(iso).toLocaleDateString(LOC(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }) : '');
/** «Quedan 7 de 10». */
const bonoQuedan = (left, total) => bi(left === 1 ? `Queda 1 de ${total}` : `Quedan ${left} de ${total}`, `${left} of ${total} left`);
const bonoUsos = (n) => bi(n === 1 ? '1 uso' : `${n} usos`, n === 1 ? '1 use' : `${n} uses`);
const bonoValidez = (m) => (m ? bi(m === 1 ? 'Caduca 1 mes después de comprarlo' : `Caduca ${m} meses después de comprarlo`,
  m === 1 ? 'Expires 1 month after purchase' : `Expires ${m} months after purchase`) : I18N.t('Sin caducidad'));
function bonoEstado(p) {
  switch (p.state) {
    case 'used_up': return I18N.t('Gastado: no quedan usos');
    case 'expired': return bi(`Caducó el ${bonoFecha(p.expires_at)}`, `Expired on ${bonoFecha(p.expires_at)}`);
    default: return p.expires_at ? bi(`Caduca el ${bonoFecha(p.expires_at)}`, `Expires on ${bonoFecha(p.expires_at)}`) : I18N.t('Sin caducidad');
  }
}
const bonoBarra = (p) => `<span class="bono-barra" aria-hidden="true"><span style="width:${p.uses_total ? Math.round((p.uses_left / p.uses_total) * 100) : 0}%"></span></span>`;

// ── La herramienta ──────────────────────────────────────────────────────────
PAGES.bonos = async (v, param) => {
  if (param === 'nuevo') return bonoForm(v, null);
  if (param === 'vendidos') return bonoVendidos(v);
  if (param) return bonoForm(v, param);
  const d = await rpc('business_pass_types', { p_business: BIZ.id });
  const tipos = d.types || [];
  const tt = d.totals || {};
  v.innerHTML = `
    <div class="page-head"><h1>Bonos</h1><span class="spacer"></span>
      ${d.can_manage ? `<a class="btn sm ghost" href="#/bonos/vendidos">Bonos vendidos</a>
      <a class="btn sm primary" href="#/bonos/nuevo"${tipos.length >= 20 ? ' aria-disabled="true"' : ''}>Crear un bono</a>` : ''}</div>
    ${helpBox('¿Cómo funciona?', bi(
      `<p>Vende bonos en tu local («10 cafés por 12 €», «5 clases por 40 €»): <b>el cliente te paga a ti, como siempre</b>, y Klendar lleva la cuenta de los usos. Klendar no cobra nada.</p>
      <p>Para cargar un bono o descontar un uso, escanea su <b>QR de cliente</b> (lo tiene en «Tus códigos») desde «Validar códigos». Durante 10 minutos puedes cargar o descontar sin volver a escanear, y deshacer si te equivocas.</p>
      <p>Pausar un bono deja de venderlo, pero <b>los vendidos siguen valiendo</b>: tienes que cumplirlos.</p>`,
      `<p>Sell passes at your venue (“10 coffees for €12”, “5 classes for €40”): <b>the customer pays you, as usual</b>, and Klendar keeps count of the uses. Klendar doesn't charge anything.</p>
      <p>To add a pass or use one, scan their <b>customer QR code</b> (it's in “Your codes”) from “Validate codes”. For 10 minutes you can add or use passes without scanning again, and undo if you make a mistake.</p>
      <p>Pausing a pass stops selling it, but <b>passes already sold are still valid</b>: you have to honour them.</p>`))}
    <div class="kpis">
      <div class="kpi"><b>${fmtNum(tt.sold)}</b><span>Bonos vendidos</span></div>
      <div class="kpi"><b>${fmtNum(tt.uses)}</b><span>Usos</span></div>
      <div class="kpi"><b>${fmtNum(tt.active)}</b><span>Bonos activos</span></div>
    </div>
    <p class="muted">Vendidos y usos: últimos 30 días. Activos: ahora.</p>
    ${tipos.length ? tipos.map((t) => {
      const dentro = `
        <div class="ts-top"><h2>${esc(t.name)}</h2><span class="tag ${t.status === 'paused' ? 'off' : 'st-active'}">${esc(I18N.t(t.status === 'paused' ? 'En pausa' : 'A la venta'))}</span>${d.can_manage ? '<span class="ms" aria-hidden="true">chevron_right</span>' : ''}</div>
        <p class="ts-meta"><b>${esc(`${bonoUsos(t.uses)} · ${fmtMoney(t.price_cents, t.currency)}`)}</b></p>
        <p class="muted">${esc(bonoValidez(t.valid_months))}</p>
        ${t.includes ? `<p class="muted">${esc(t.includes)}</p>` : ''}
        <p class="muted">${esc(bi(`${t.sold === 1 ? '1 vendido' : `${fmtNum(t.sold)} vendidos`} · ${t.active === 1 ? '1 activo' : `${fmtNum(t.active)} activos`}`, `${fmtNum(t.sold)} sold · ${fmtNum(t.active)} active`))}</p>`;
      return d.can_manage ? `<a class="card tarjeta-sellos" href="#/bonos/${esc(t.id)}">${dentro}</a>` : `<div class="card tarjeta-sellos">${dentro}</div>`;
    }).join('')
    : `<div class="empty"><b>${esc(I18N.t('Aún no vendes bonos'))}</b><br>${esc(d.can_manage
      ? bi('Crea uno, por ejemplo «10 cafés por 12 €» o «5 clases por 40 €». Lo cobras tú en el local y Klendar lleva la cuenta de los usos.', 'Create one, for example “10 coffees for €12” or “5 classes for €40”. You charge for it at your venue and Klendar keeps count of the uses.')
      : I18N.t('Cuando quien lleva el negocio cree un bono, lo verás aquí para venderlo.'))}</div>`}
    <p><a class="btn ghost" href="#/validar">${ms('qr_code_scanner')}Vender o usar un bono: Validar códigos</a></p>`;
};

/** Crear (id null) o cambiar un bono. */
async function bonoForm(v, id) {
  if (!gestiona()) { location.hash = '#/bonos'; return; }
  const d = await rpc('business_pass_types', { p_business: BIZ.id });
  const t = id ? (d.types || []).find((x) => x.id === id) : null;
  if (id && !t) { location.hash = '#/bonos'; return; }
  const meses = [1, 2, 3, 6, 12, 24];
  if (t?.valid_months && !meses.includes(t.valid_months)) meses.push(t.valid_months);
  const precio = t ? (t.price_cents / 100).toFixed(2).replace('.', I18N.lang === 'en' ? '.' : ',') : '';
  v.innerHTML = `
    <div class="page-head"><h1>${esc(I18N.t(t ? 'Editar el bono' : 'Crear un bono'))}</h1><span class="spacer"></span>
      <a class="btn sm ghost" href="#/bonos">← Bonos</a></div>
    <form class="card form" id="f-bono" novalidate>
      ${t?.sold ? `<p class="muted">${esc(bi(`Ya has vendido ${fmtNum(t.sold)}. Lo que cambies vale para los próximos: los vendidos siguen como se vendieron.`, `You've already sold ${fmtNum(t.sold)}. Changes apply to future sales: those sold stay as they were sold.`))}</p>` : ''}
      <label class="f"><span>Nombre</span><input name="name" maxlength="60" required placeholder="10 cafés" value="${esc(t?.name || '')}"></label>
      <label class="f"><span>Número de usos</span><input name="uses" type="number" min="1" max="100" required value="${esc(t?.uses ?? 10)}"></label>
      <label class="f"><span>Precio en tu local</span><input name="price" inputmode="decimal" required placeholder="12,00" value="${esc(precio)}">
        <small class="muted">Lo cobras tú en el local, como siempre: Klendar no cobra nada. Lo usamos para tus cifras.</small></label>
      <label class="f"><span>Qué incluye (opcional)</span><textarea name="includes" rows="2" maxlength="200" placeholder="Café solo, con leche o cortado">${esc(t?.includes || '')}</textarea></label>
      <label class="f"><span>Caducidad</span><select name="months">
        <option value="">${esc(I18N.t('Sin caducidad'))}</option>
        ${meses.sort((a, b) => a - b).map((m) => `<option value="${m}"${t?.valid_months === m ? ' selected' : ''}>${esc(bi(m === 1 ? '1 mes desde la compra' : `${m} meses desde la compra`, m === 1 ? '1 month from purchase' : `${m} months from purchase`))}</option>`).join('')}
      </select></label>
      <label class="f"><span>Condiciones (opcional)</span><textarea name="terms" rows="3" maxlength="500" placeholder="Uno por visita. No se cambia por dinero.">${esc(t?.terms || '')}</textarea></label>
      <p class="err" id="bono-err" role="alert"></p>
      <div class="foot"><button class="btn primary" type="submit">${esc(I18N.t(t ? 'Guardar' : 'Crear el bono'))}</button></div>
    </form>
    ${t ? `<div class="card">
      <p class="muted">${esc(I18N.t(t.status === 'paused' ? 'En pausa: no se vende. Los vendidos siguen valiendo.' : 'En pausa deja de venderse, pero los bonos vendidos siguen valiendo.'))}</p>
      <div class="foot">
        <button class="btn" type="button" id="bono-pausa">${esc(I18N.t(t.status === 'paused' ? 'Volver a vender' : 'Pausar'))}</button>
        <button class="btn bad" type="button" id="bono-quita">Quitar el bono</button>
      </div></div>` : ''}
    <p class="muted">El bono lo vendes y lo cumples tú: Klendar solo lleva la cuenta de los usos y no cobra nada. Tienes que respetar los bonos vendidos aunque los pauses o los quites.</p>`;
  const f = $('#f-bono', v);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#bono-err', v);
    err.textContent = '';
    const name = f.name.value.trim();
    const uses = Number(f.uses.value);
    const p = f.price.value.trim().replace(/[\s€]/g, '').replace(',', '.');
    const cents = /^\d{1,6}(\.\d{1,2})?$/.test(p) ? Math.round(Number(p) * 100) : null;
    if (name.length < 2) { err.textContent = bonoError('bad_name'); return; }
    if (!Number.isInteger(uses) || uses < 1 || uses > 100) { err.textContent = bonoError('bad_uses'); return; }
    if (cents == null) { err.textContent = bonoError('bad_price'); return; }
    try {
      await bonoRpc('save_pass_type', {
        p_business: BIZ.id, p_id: id, p_name: name, p_uses: uses, p_price_cents: cents,
        p_includes: f.includes.value.trim() || null,
        p_valid_months: f.months.value ? Number(f.months.value) : null,
        p_terms: f.terms.value.trim() || null,
      });
      toast(t ? 'Bono guardado. Lo ya vendido no cambia.' : 'Bono creado');
      location.hash = '#/bonos';
    } catch (e2) { err.textContent = e2.message; }
  };
  const pausa = $('#bono-pausa', v);
  if (pausa) {
    pausa.onclick = async () => {
      try {
        await bonoRpc('set_pass_type_status', { p_id: t.id, p_status: t.status === 'paused' ? 'active' : 'paused' });
        toast(t.status === 'paused' ? 'El bono vuelve a estar a la venta' : 'Bono en pausa');
        bonoForm(v, id);
      } catch (e) { toast(e.message, true); }
    };
    $('#bono-quita', v).onclick = async () => {
      const ok = await confirmDlg(bi(`¿Quitar «${t.name}»?`, `Remove “${t.name}”?`),
        I18N.t('Deja de salir para vender. Los que ya vendiste siguen valiendo hasta que se gasten o caduquen.'),
        { submit: I18N.t('Quitar el bono'), danger: true });
      if (!ok) return;
      try {
        await bonoRpc('delete_pass_type', { p_id: t.id });
        toast('Bono quitado');
        location.hash = '#/bonos';
      } catch (e) { toast(e.message, true); }
    };
  }
}

/** Una lista de usos: cuándo, quién, a mano, deshecho y «Deshacer». */
function bonoListaUsos(p) {
  if (!(p.uses || []).length) return `<span class="muted">${esc(I18N.t('Aún no lo ha usado.'))}</span>`;
  return `<ul class="bono-usos">${p.uses.map((u) => `<li${u.undone_at ? ' class="deshecho"' : ''}>
      <span>${esc([fmtDate(u.at), bi(`por ${u.by || 'alguien del equipo'}`, `by ${u.by || 'someone on the team'}`),
    u.manual ? I18N.t('a mano') : '', u.undone_at ? I18N.t('deshecho') : ''].filter(Boolean).join(' · '))}</span>
      ${u.undo_until && !u.undone_at && new Date(u.undo_until) > new Date() ? `<button class="btn sm ghost" type="button" data-deshaz-uso="${esc(u.id)}">Deshacer</button>` : ''}
    </li>`).join('')}</ul>`;
}

/** «Bonos vendidos» (propietario y encargado). */
async function bonoVendidos(v, soloActivos = true) {
  if (!gestiona()) { location.hash = '#/bonos'; return; }
  const lista = await rpc('business_sold_passes', { p_business: BIZ.id, p_state: soloActivos ? 'active' : null });
  v.innerHTML = `
    <div class="page-head"><h1>Bonos vendidos</h1><span class="spacer"></span><a class="btn sm ghost" href="#/bonos">← Bonos</a></div>
    <div class="seg" role="group" aria-label="${esc(I18N.t('Bonos vendidos'))}">
      <button type="button" class="btn sm${soloActivos ? '' : ' ghost'}" aria-pressed="${soloActivos}" data-f="1">Activos</button>
      <button type="button" class="btn sm${soloActivos ? ' ghost' : ''}" aria-pressed="${!soloActivos}" data-f="0">Todos</button>
    </div>
    ${table({
    cols: [
      { h: 'Cliente', r: (p) => `<b class="title">${esc(p.customer || I18N.t('Usuario de Klendar'))}</b><span class="sub">${esc(p.name)}</span>` },
      { h: 'Usos', r: (p) => `<b>${esc(bonoQuedan(p.uses_left, p.uses_total))}</b>${bonoBarra(p)}<span class="sub">${esc(bonoEstado(p))}</span>` },
      { h: 'Vendido', r: (p) => `${esc(fmtDate(p.sold_at))}<span class="sub">${esc(bi(`por ${p.sold_by || 'alguien del equipo'}`, `by ${p.sold_by || 'someone on the team'}`))}</span>` },
      { h: 'Historial', r: (p) => bonoListaUsos(p) },
      { h: '', r: (p) => (p.state === 'active' ? `<button class="btn sm" type="button" data-a-mano="${esc(p.id)}" data-nombre="${esc(p.customer || '')}">Descontar un uso a mano</button>` : '') },
    ],
    rows: lista || [],
    empty: 'Cuando vendas un bono, lo verás aquí con quién lo vendió y cada uso.',
  })}`;
  $$('[data-f]', v).forEach((b) => { b.onclick = () => bonoVendidos(v, b.dataset.f === '1'); });
  $$('[data-a-mano]', v).forEach((b) => {
    b.onclick = async () => {
      const nombre = b.dataset.nombre || I18N.t('Usuario de Klendar');
      const ok = await confirmDlg(bi(`¿Descontar un uso a ${nombre}?`, `Use one of ${nombre}'s?`),
        I18N.t('Hazlo solo si no puede enseñar su QR de cliente. Le llegará un aviso con los usos que le quedan.'),
        { submit: I18N.t('Descontar un uso') });
      if (!ok) return;
      try {
        const r = await bonoRpc('use_pass', { p_pass: b.dataset.aMano, p_scan: null });
        toast(bi(`Uso descontado. ${r.uses_left === 1 ? 'Queda 1' : `Quedan ${r.uses_left}`} de ${r.uses_total}.`, `Use recorded. ${r.uses_left} of ${r.uses_total} left.`));
        bonoVendidos(v, soloActivos);
      } catch (e) { toast(e.message, true); }
    };
  });
  $$('[data-deshaz-uso]', v).forEach((b) => {
    b.onclick = async () => {
      try {
        await bonoRpc('undo_pass_use', { p_use: b.dataset.deshazUso });
        toast('Uso deshecho');
        bonoVendidos(v, soloActivos);
      } catch (e) { toast(e.message, true); }
    };
  });
  I18N.translate(v);
}

// ── El cliente delante (en «Validar códigos») ──────────────────────────────
let BONO_CLIENTE = null; // { key, scan }

/** Lee el QR de cliente y pinta sus bonos en `caja`. Devuelve true si era un
 * QR de cliente (aunque no valga), para que «Validar códigos» no lo trate
 * como un código. */
async function bonoCliente(caja, raw) {
  const token = bonoToken(raw);
  if (!token) return false;
  const clave = token.split('.')[0];
  // El mismo cliente sigue delante (su QR cambia cada 30 s): no se vuelve a
  // escanear mientras dure la ventana de 10 minutos.
  if (BONO_CLIENTE?.key === clave && BONO_CLIENTE.scan && new Date(BONO_CLIENTE.scan.scan_until) > new Date()
    && caja.querySelector('.bono-cliente')) return true;
  try {
    const s = await bonoRpc('pass_scan', { p_business: BIZ.id, p_token: token });
    BONO_CLIENTE = { key: clave, scan: s };
    bonoVibra(60);
    bonoPintaCliente(caja);
  } catch (e) {
    BONO_CLIENTE = null;
    bonoVibra([60, 60, 60]);
    caja.innerHTML = `<div class="scan-result bad">${ms('cancel')}${esc(e.message)}</div>`;
  }
  return true;
}

function bonoPintaCliente(caja) {
  const s = BONO_CLIENTE?.scan;
  if (!s) return;
  const nombre = s.customer?.name || I18N.t('Usuario de Klendar');
  caja.innerHTML = `<div class="bono-cliente card">
    <h2>${esc(nombre)}</h2>
    <p class="muted">${esc(I18N.t('Durante 10 minutos puedes cargar o descontar sin volver a escanear. Cada venta y cada uso se pueden deshacer en ese rato.'))}</p>
    ${(s.passes || []).length ? s.passes.map((p) => {
    const deshazUso = (p.uses || []).find((u) => !u.undone_at && u.undo_until && new Date(u.undo_until) > new Date());
    const ultimo = (p.uses || []).find((u) => !u.undone_at);
    return `<div class="bono-pase">
        <h3>${esc(p.name)}</h3>
        <p class="bono-quedan grande">${esc(bonoQuedan(p.uses_left, p.uses_total))}</p>
        ${bonoBarra(p)}
        <p class="${p.state === 'active' ? 'muted' : 'err'}">${esc(bonoEstado(p))}</p>
        ${ultimo ? `<p class="muted">${esc(bi(`Último uso: ${fmtDate(ultimo.at)}`, `Last used: ${fmtDate(ultimo.at)}`))}</p>` : ''}
        ${p.terms ? `<p class="muted">${esc(p.terms)}</p>` : ''}
        ${p.state === 'active' ? `<button class="btn primary grande" type="button" data-usa="${esc(p.id)}">${ms('check')}${esc(I18N.t('Descontar un uso'))}</button>` : ''}
        ${deshazUso ? `<button class="btn ghost" type="button" data-deshaz-uso="${esc(deshazUso.id)}">${esc(bi(`Deshacer el uso de las ${fmtHora(deshazUso.at)}`, `Undo the use at ${fmtHora(deshazUso.at)}`))}</button>`
      : p.sale_undo_until && new Date(p.sale_undo_until) > new Date() ? `<button class="btn ghost" type="button" data-deshaz-venta="${esc(p.id)}">${esc(I18N.t('Deshacer la venta'))}</button>` : ''}
        ${p.sold_by ? `<p class="muted">${esc(bi(`Vendido por ${p.sold_by} el ${bonoFecha(p.sold_at)}`, `Sold by ${p.sold_by} on ${bonoFecha(p.sold_at)}`))}</p>` : ''}
      </div>`;
  }).join('') : `<p class="muted">${esc(I18N.t('No tiene bonos de este negocio.'))}</p>`}
    ${(s.types || []).length ? `<button class="btn grande" type="button" id="bono-cargar">${esc(I18N.t('Cargar un bono'))}</button>`
    : `<p class="muted">${esc(I18N.t('Este negocio aún no vende bonos.'))}</p>${s.can_manage ? `<a class="btn" href="#/bonos/nuevo">${esc(I18N.t('Crear un bono'))}</a>` : ''}`}
    <p class="muted">${esc(I18N.t('El bono se paga en el local, como siempre: Klendar no cobra nada y solo lleva la cuenta de los usos.'))}</p>
  </div>`;
  const recarga = async () => {
    try {
      BONO_CLIENTE.scan = await bonoRpc('pass_scan_info', { p_scan: s.scan_id });
      bonoPintaCliente(caja);
    } catch (e) { toast(e.message, true); }
  };
  $$('[data-usa]', caja).forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await bonoRpc('use_pass', { p_pass: b.dataset.usa, p_scan: s.scan_id });
        bonoVibra(120);
        BONO_CLIENTE.scan = r;
        toast(bi(`Uso descontado. ${r.uses_left === 1 ? 'Queda 1' : `Quedan ${r.uses_left}`} de ${r.uses_total}.`, `Use recorded. ${r.uses_left} of ${r.uses_total} left.`));
        bonoPintaCliente(caja);
      } catch (e) { b.disabled = false; toast(e.message, true); }
    };
  });
  $$('[data-deshaz-uso]', caja).forEach((b) => {
    b.onclick = async () => {
      try { await bonoRpc('undo_pass_use', { p_use: b.dataset.deshazUso }); toast('Uso deshecho'); await recarga(); } catch (e) { toast(e.message, true); }
    };
  });
  $$('[data-deshaz-venta]', caja).forEach((b) => {
    b.onclick = async () => {
      try { await bonoRpc('undo_pass_sale', { p_pass: b.dataset.deshazVenta }); toast('Venta deshecha'); await recarga(); } catch (e) { toast(e.message, true); }
    };
  });
  const cargar = $('#bono-cargar', caja);
  if (cargar) {
    cargar.onclick = async () => {
      const r = await modal({
        title: I18N.t('¿Qué bono ha pagado?'),
        intro: esc(I18N.t('Cóbralo en el local antes de cargarlo: Klendar no cobra nada. Si te equivocas, lo puedes deshacer durante 10 minutos.')),
        fields: [{ type: 'select', name: 'tipo', label: I18N.t('Bono'),
          options: s.types.map((t) => [t.id, `${t.name} · ${bonoUsos(t.uses)} · ${fmtMoney(t.price_cents, t.currency)}`]) }],
        submit: I18N.t('Cargar un bono'),
      });
      if (!r?.tipo) return;
      try {
        const res = await bonoRpc('sell_pass', { p_scan: s.scan_id, p_type: r.tipo });
        BONO_CLIENTE.scan = res;
        const tipo = s.types.find((t) => t.id === r.tipo);
        toast(bi(`Bono cargado: ${tipo?.name || ''}`, `Pass added: ${tipo?.name || ''}`));
        bonoPintaCliente(caja);
      } catch (e) { toast(e.message, true); }
    };
  }
  I18N.translate(caja);
}
