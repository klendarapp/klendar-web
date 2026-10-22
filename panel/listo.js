/* Panel del negocio: «Pedidos de hoy» (Te aviso cuando esté listo, tanda D,
 * migración 20261235100000 de la app). Lo mismo que «Pedidos de hoy» en «Mi
 * negocio» de la app.
 *
 * - Apagado: propietario y encargado lo activan aquí («Activar el avisador»);
 *   el personal ve que está apagado.
 * - Activado: cuántos se preparan y cuántos están listos, los avisados hoy y
 *   la espera media; «Preparando» con «Listo» (avisa al momento), «Listos»
 *   con «Recogido», «Quitar» en los dos (con pregunta) y «Terminados»
 *   plegados. «Terminar por hoy», «Volver a abrir», «Apagar el avisador» y
 *   «Cambiar el código del cartel»: propietario y encargado.
 * - «Cartel para el mostrador»: /cartel/listo/<código> (functions/_lib/poster.js).
 * - En el resumen, la fila «Pedidos de hoy · 3 preparando» (`resumenListo`);
 *   en «Validar códigos», el botón (`listoEntradaValidar`); en «Cifras»,
 *   «Te aviso cuando esté listo» (`listoCifras`).
 *
 * Se vuelve a pedir cada 10 s. Va después de panel.js y usa lo suyo (`PAGES`,
 * `rpc`, `BIZ`, `esc`, `ms`, `bi`, `toast`, `confirmDlg`, `fmtNum`, `friendly`).
 * Comparten ámbito: los nombres de aquí empiezan por `listo`.
 */
'use strict';

// Icono (takeout_dining): no está en la fuente recortada del panel.
Object.assign(SVG, {
  listo: 'm7.79 18-.51-7h9.46l-.51 7H7.79zM9.83 5h4.33l2.8 2.73L16.87 9H7.12l-.09-1.27L9.83 5zM22 7.46l-1.41-1.41L19 7.63l.03-.56L14.98 3H9.02L4.97 7.07l.03.5-1.59-1.56L2 7.44l3.23 3.11.7 9.45h12.14l.7-9.44L22 7.46z',
});

const LISTO_ERR = {
  not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
  business_blocked: 'Tu negocio está bloqueado: ahora no se pueden avisar pedidos.',
  business_not_visible: 'Tu negocio aún no sale en Klendar.',
  not_yet: 'Disponible desde el 4 de noviembre',
  already_done: 'Ese pedido ya no está en la lista.',
  not_found: 'Ese pedido ya no está en la lista.',
  rate_limited: 'Demasiados intentos. Espera un minuto.',
};
const listoError = (code) => I18N.t(LISTO_ERR[code] || friendly(code));
async function listoRpc(fn, args) {
  const r = await rpc(fn, args);
  if (r && r.ok === false) throw Object.assign(new Error(listoError(r.error)), { clave: r.error });
  return r;
}
const listoCartelUrl = (code) => `${I18N.pub === 'en' ? '/en/poster/ready/' : '/cartel/listo/'}${encodeURIComponent(code || '')}`;
const listoNumero = (n) => bi(`Nº ${n}`, `No. ${n}`);
/** Minutos desde `iso`. */
const listoMin = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
const listoHace = (iso) => {
  const m = listoMin(iso);
  return m === 0 ? bi('ahora mismo', 'just now') : bi(`hace ${m} min`, `${m} min ago`);
};
const listoDecimal = (x) => Number(x).toLocaleString(LOC(), { maximumFractionDigits: 1 });
const LISTO_ESTADO = {
  picked_up: 'Recogido', removed: 'Quitado', left: 'Ya no lo espera', expired: 'Se cerró solo',
};

PAGES.pedidos = async (v) => {
  let d = await listoRpc('business_orders', { p_business: BIZ.id });
  let firma = '';
  const firmaDe = (x) => JSON.stringify([x.enabled, x.code, x.paused, x.blocked, x.board && [x.board.status,
    (x.board.entries || []).map((e) => [e.id, e.status])], x.stats]);

  const pinta = () => {
    firma = firmaDe(d);
    const titulo = `<div class="page-head"><h1>${esc(bi('Pedidos de hoy', 'Today’s orders'))}</h1></div>`;
    const pie = `<p class="muted">${esc(I18N.t('La lista se borra sola a las 6:00. Un pedido listo que nadie recoge se cierra solo a las 2 h.'))}</p>`;
    if (!d.enabled) {
      v.innerHTML = `${titulo}
        ${d.can_manage ? `<div class="card listo-apagado">
            <h2>${icono('listo')}<span>${esc(I18N.t('Te aviso cuando esté listo'))}</span></h2>
            <p class="muted">${esc(I18N.t('Quien pide en el mostrador escanea el cartel y le avisamos en el móvil cuando su pedido está listo. Tú solo tocas «Listo».'))}</p>
            ${d.available === false
    // Hasta el 4-11-2026 no se puede activar (TL1, migración 20261235100001).
    ? `<p class="listo-pronto"><b>${esc(I18N.t('Disponible desde el 4 de noviembre'))}</b></p>`
    : `<button class="btn primary" type="button" data-listo="activar">${esc(I18N.t('Activar el avisador'))}</button>`}
          </div>`
    : `<section class="vacio"><h2>${esc(I18N.t('El avisador de pedidos está apagado'))}</h2><p>${esc(I18N.t('Lo activa el propietario o un encargado.'))}</p></section>`}
        ${pie}`;
      engancha();
      return;
    }
    const cartel = `<div class="card listo-cartel">
        <h2>${esc(I18N.t('Cartel para el mostrador'))}</h2>
        <p class="muted">${esc(I18N.t('Ponlo en el mostrador. Quien pide lo escanea y le avisamos cuando su pedido esté listo. Vale todos los días.'))}</p>
        <div class="cola-acciones">
          <a class="btn" href="${esc(listoCartelUrl(d.code))}" target="_blank" rel="noopener">${ms('qr_code_2')}${esc(I18N.t('Cartel para el mostrador'))}</a>
          ${d.can_manage ? `<button class="btn" type="button" data-listo="codigo">${esc(I18N.t('Cambiar el código del cartel'))}</button>` : ''}
        </div></div>`;
    const b = d.board;
    if (b?.status === 'ended') {
      v.innerHTML = `${titulo}
        <section class="vacio"><h2>${esc(I18N.t('Has terminado por hoy'))}</h2>
          <p>${esc(I18N.t('No entran pedidos nuevos hasta mañana a las 6:00.'))}</p>
          ${d.can_manage ? `<div class="vacio-botones"><button class="btn primary" type="button" data-listo="reabrir">${esc(I18N.t('Volver a abrir'))}</button></div>` : ''}
        </section>
        ${cartel}${pie}`;
      engancha();
      return;
    }
    const es = b?.entries || [];
    const preparando = es.filter((e) => e.status === 'waiting');
    const listos = es.filter((e) => e.status === 'ready');
    const hechos = es.filter((e) => e.status !== 'waiting' && e.status !== 'ready');
    const hoy = d.stats?.today || {};
    const nombre = (e) => (e.name ? `<b translate="no">${esc(e.name)}</b>` : '');
    const fila = (e, boton, menu) => `<div class="listo-fila" data-pedido="${esc(e.id)}">
        <span class="listo-num" aria-label="${esc(listoNumero(e.number))}">${esc(String(e.number))}</span>
        <span class="listo-t">${nombre(e)}<span class="${e.status === 'ready' ? 'listo-ya' : 'muted'}" data-desde="${esc(e.status === 'ready' ? e.ready_at : e.created_at)}" data-listo-ya="${e.status === 'ready' ? '1' : ''}">${esc(e.status === 'ready' ? bi(`listo hace ${listoMin(e.ready_at)} min`, `ready ${listoMin(e.ready_at)} min ago`) : listoHace(e.created_at))}</span></span>
        ${boton}
        <details class="mas cola-mas"><summary class="btn sm ghost" aria-label="${esc(bi(`Más opciones para el ${listoNumero(e.number)}`, `More options for ${listoNumero(e.number)}`))}">${ms('more_horiz')}</summary>
          <div class="mas-menu">${menu}</div></details>
      </div>`;
    const bloq = d.blocked ? ' disabled' : '';
    v.innerHTML = `${titulo}
      ${d.blocked || d.paused ? `<div class="scan-result warn">${esc(I18N.t(d.blocked ? 'Tu negocio está bloqueado: ahora no se pueden avisar pedidos.' : 'Tu local está en pausa: no entran pedidos nuevos.'))}</div>` : ''}
      <div class="card listo-cifras">
        <p class="cola-n">${esc(bi(`${fmtNum(b?.waiting || 0)} preparando · ${fmtNum(b?.ready || 0)} ${Number(b?.ready) === 1 ? 'listo' : 'listos'}`, `${fmtNum(b?.waiting || 0)} being prepared · ${fmtNum(b?.ready || 0)} ready`))}</p>
        <p class="muted">${esc([
    Number(hoy.notified) === 0 ? bi('Hoy: ningún pedido avisado', 'Today: no orders alerted')
      : bi(`Hoy: ${fmtNum(hoy.notified)} ${Number(hoy.notified) === 1 ? 'pedido avisado' : 'pedidos avisados'}`, `Today: ${fmtNum(hoy.notified)} ${Number(hoy.notified) === 1 ? 'order' : 'orders'} alerted`),
    hoy.avg_wait_minutes != null ? bi(`Espera media: ${listoDecimal(hoy.avg_wait_minutes)} min`, `Average wait: ${listoDecimal(hoy.avg_wait_minutes)} min`) : '',
  ].filter(Boolean).join(' · '))}</p>
      </div>
      <h2 class="cola-h2">${esc(I18N.t('Preparando'))}</h2>
      ${preparando.length ? `<div class="card cola-lista">${preparando.map((e) => fila(e,
    `<button class="btn" type="button" data-listo-ya="${esc(e.id)}"${bloq}>${ms('check')}${esc(I18N.t('Listo'))}</button>`,
    `<button type="button" data-recogido="${esc(e.id)}"${bloq}>${esc(I18N.t('Recogido'))}</button>
           <button type="button" class="bad" data-quita="${esc(e.id)}"${bloq}>${esc(I18N.t('Quitar'))}</button>`)).join('')}</div>`
    : `<p class="muted">${esc(I18N.t('No hay pedidos esperando. Cuando alguien escanee el cartel, aparecerá aquí.'))}</p>`}
      ${listos.length ? `<h2 class="cola-h2">${esc(I18N.t('Listos'))}</h2>
        <div class="card cola-lista">${listos.map((e) => fila(e,
    `<button class="btn" type="button" data-recogido="${esc(e.id)}"${bloq}>${ms('check_circle')}${esc(I18N.t('Recogido'))}</button>`,
    `<button type="button" class="bad" data-quita="${esc(e.id)}"${bloq}>${esc(I18N.t('Quitar'))}</button>`)).join('')}</div>` : ''}
      ${hechos.length ? `<details class="help cola-hechos"><summary>${esc(bi(`Terminados (${hechos.length})`, `Finished (${hechos.length})`))}</summary>
        <div class="cola-lista">${hechos.map((e) => `<p class="listo-hecho">${esc([listoNumero(e.number), e.name, I18N.t(LISTO_ESTADO[e.status] || e.status)].filter(Boolean).join(' · '))}</p>`).join('')}</div></details>` : ''}
      ${d.can_manage ? `<div class="card"><div class="cola-acciones">
          <button class="btn bad ghost" type="button" data-listo="terminar">${esc(I18N.t('Terminar por hoy'))}</button>
          <button class="btn ghost" type="button" data-listo="apagar">${esc(I18N.t('Apagar el avisador'))}</button>
        </div></div>` : ''}
      ${cartel}${pie}`;
    engancha();
  };

  const recarga = async (nuevo = null) => {
    try {
      d = nuevo || await listoRpc('business_orders', { p_business: BIZ.id });
    } catch (e) { if (nuevo === null) return; toast(e.message, true); return; }
    if (!v.isConnected) return;
    if (nuevo || firmaDe(d) !== firma) { pinta(); I18N.translate(v); }
  };
  const haz = async (boton, fn, args, ok) => {
    if (boton) boton.disabled = true;
    try {
      const r = await listoRpc(fn, args);
      if (ok) toast(typeof ok === 'string' ? I18N.t(ok) : ok(r));
      await recarga(r);
    } catch (e) {
      toast(e.message, true);
      if (boton?.isConnected) boton.disabled = false;
      recarga();
    }
  };

  function engancha() {
    $$('[data-listo]', v).forEach((b) => {
      b.onclick = async () => {
        const que = b.dataset.listo;
        if (que === 'activar') return haz(b, 'set_orders_enabled', { p_business: BIZ.id, p_enabled: true }, 'Activado');
        if (que === 'reabrir') return haz(b, 'reopen_orders', { p_business: BIZ.id });
        if (que === 'terminar') {
          if (!await confirmDlg(I18N.t('¿Terminar por hoy?'), esc(I18N.t('Se avisa a quien siga esperando y se borra la lista de hoy.')), { submit: I18N.t('Terminar por hoy'), danger: true })) return null;
          return haz(b, 'end_orders', { p_business: BIZ.id });
        }
        if (que === 'apagar') {
          if (!await confirmDlg(I18N.t('¿Apagar el avisador?'), esc(I18N.t('Se avisa a quien siga esperando y el cartel deja de funcionar hasta que lo vuelvas a activar.')), { submit: I18N.t('Apagar'), danger: true })) return null;
          return haz(b, 'set_orders_enabled', { p_business: BIZ.id, p_enabled: false });
        }
        if (que === 'codigo') {
          if (!await confirmDlg(I18N.t('¿Cambiar el código del cartel?'), esc(I18N.t('El cartel que tengas impreso dejará de funcionar.')), { submit: I18N.t('Cambiar el código'), danger: true })) return null;
          return haz(b, 'rotate_order_code', { p_business: BIZ.id }, 'Código cambiado. Imprime el cartel nuevo.');
        }
        return null;
      };
    });
    const numeroDe = (id) => (d.board?.entries || []).find((x) => x.id === id)?.number;
    $$('button[data-listo-ya]', v).forEach((b) => {
      b.onclick = () => haz(b, 'order_set_ready', { p_ticket: b.dataset.listoYa },
        () => bi(`Avisado el ${numeroDe(b.dataset.listoYa) ?? ''}`, `No. ${numeroDe(b.dataset.listoYa) ?? ''} alerted`));
    });
    $$('[data-recogido]', v).forEach((b) => { b.onclick = () => haz(b, 'order_set_status', { p_ticket: b.dataset.recogido, p_status: 'picked_up' }); });
    $$('[data-quita]', v).forEach((b) => {
      b.onclick = async () => {
        const n = numeroDe(b.dataset.quita);
        if (!await confirmDlg(bi(`¿Quitar el ${n}?`, `Remove no. ${n}?`), esc(I18N.t('Le avisamos de que su pedido ya no está en la lista.')), { submit: I18N.t('Quitar'), danger: true })) return;
        haz(null, 'order_set_status', { p_ticket: b.dataset.quita, p_status: 'removed' });
      };
    });
  }

  pinta();
  // Cada 10 s (sin pisar un menú o un diálogo abiertos) y «hace 3 min» cada
  // 30 s. Se apaga al irse de la pantalla.
  const reloj = setInterval(() => {
    if (!v.isConnected) { clearInterval(reloj); return; }
    if ($('#modal')?.open || $('details.mas[open]', v) || document.visibilityState === 'hidden') return;
    recarga();
  }, 10000);
  const minutos = setInterval(() => {
    if (!v.isConnected) { clearInterval(minutos); return; }
    $$('[data-desde]', v).forEach((s) => {
      s.textContent = s.dataset.listoYa
        ? bi(`listo hace ${listoMin(s.dataset.desde)} min`, `ready ${listoMin(s.dataset.desde)} min ago`)
        : listoHace(s.dataset.desde);
    });
  }, 30000);
};

// ── En el inicio del panel ──────────────────────────────────────────────────
/** «Pedidos de hoy · 3 preparando», si el avisador está activado. */
async function resumenListo(caja) {
  if (!caja) return;
  const negocio = BIZ.id;
  const r = await rpc('business_orders', { p_business: negocio }).catch(() => null);
  if (!caja.isConnected || BIZ?.id !== negocio) return;
  if (r?.ok === false || !r?.enabled) { caja.innerHTML = ''; return; }
  const n = Number(r.board?.waiting) || 0;
  caja.innerHTML = `<div class="filas-inicio"><a class="fila-inicio" href="#/pedidos">${icono('listo')}<span>${esc(bi(`Pedidos de hoy · ${n} preparando`, `Today’s orders · ${n} being prepared`))}</span>${ms('chevron_right')}</a></div>`;
}

/** En «Validar códigos», debajo de «Escanear» y «Dar en el momento»: la fila
 * «Pedidos de hoy».
 * Con el negocio parado (bloqueado o en pausa) no: «Pedidos de hoy» no es de
 * lo que se puede abrir entonces y el botón llevaba al resumen. */
async function listoEntradaValidar(caja) {
  if (!caja || (typeof bloqueado === 'function' && bloqueado())) return;
  const negocio = BIZ.id;
  const r = await rpc('business_orders', { p_business: negocio }).catch(() => null);
  if (!caja.isConnected || BIZ?.id !== negocio || !r?.enabled) return;
  // Una fila (como en el resumen), no un tercer botón al lado de los dos.
  caja.innerHTML = `<a class="fila-inicio" href="#/pedidos">${icono('listo')}<span>${esc(bi('Pedidos de hoy', 'Today’s orders'))}</span>${ms('chevron_right')}</a>`;
}

/** En «Cifras»: pedidos avisados hoy y este mes, y la espera media. */
async function listoCifras(caja) {
  if (!caja) return;
  const r = await rpc('business_orders', { p_business: BIZ.id }).catch(() => null);
  if (!caja.isConnected || !r || r.ok === false) return;
  const hoy = r.stats?.today || {};
  const mes = r.stats?.month || {};
  if (!r.enabled && !Number(mes.notified)) return;
  const media = (s) => (s.avg_wait_minutes == null ? '—' : `${listoDecimal(s.avg_wait_minutes)} min`);
  const avisados = bi(`Pedidos avisados: ${fmtNum(hoy.notified || 0)} hoy · ${fmtNum(mes.notified || 0)} este mes`,
    `Orders alerted: ${fmtNum(hoy.notified || 0)} today · ${fmtNum(mes.notified || 0)} this month`);
  caja.innerHTML = `<div class="card" data-res="${esc(avisados)}"><h2>${esc(bi('Te aviso cuando esté listo', 'Ready alert'))}</h2>
    <p style="margin:0 0 4px"><b>${esc(avisados)}</b></p>
    <p class="muted" style="margin:0">${esc(bi(`Espera media: ${media(hoy)} hoy · ${media(mes)} este mes`, `Average wait: ${media(hoy)} today · ${media(mes)} this month`))}</p>
  </div>`;
  if (typeof cifrasPlegar === 'function') cifrasPlegar(caja);
}
