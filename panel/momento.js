/* Panel del negocio: «Dar en el momento» (migración 20261228100000). Lo
 * mismo que en la app (`SpotGiveScreen`), desde «Validar códigos».
 *
 * Cualquiera del equipo elige qué da (sellos de una tarjeta, un uso de un
 * bono que el cliente ya tiene o «algo del momento», un texto libre) y
 * enseña un QR del negocio que cambia cada 30 segundos y vale 1 minuto
 * (`klendar.app/m/<clave>.<ventana>.<firma>`; la firma HMAC-SHA256 se
 * calcula aquí con el secreto que da `spot_give_start`, como el QR de
 * cliente). El cliente lo escanea y lo acepta; aquí se ve en directo quién lo
 * ha recibido (`spot_give_status` cada 3 s). Se deja abierto para varias
 * personas hasta «Terminar» (como mucho 3 horas); irse de la pantalla
 * también lo cierra.
 *
 * Personal de verdad (migración 20261241100000): tope opcional de personas
 * («Para 1 persona» … «Para 20 personas»; al llegar, se cierra solo) y se
 * cierra solo si nadie lo usa en 10 minutos. Por qué se ha cerrado lo dice
 * `spot_give_status.closed_reason` (`full`, `idle`, `expired`, `ended`).
 *
 * Con el negocio parado (bloqueado o en pausa): usos de un bono que la
 * gente ya tiene, sí (prometidos); sellos nuevos (Fidelizar, bloqueado) y
 * «algo del momento», no (Iván, 2026-10-22). Como la app y la base.
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `esc`, `ms`,
 * `bi`, `toast`, `helpBox`, `friendly`). Comparten ámbito: los nombres de
 * aquí empiezan por `momento`.
 */
'use strict';

const MOMENTO_ERR = {
  card_gone: 'Esa tarjeta de sellos ya no está activa.',
  bad_amount: 'De 1 a 5 sellos.',
  pass_type_not_found: 'Ese bono ya no está.',
  business_blocked: 'Tu negocio está parado: ahora solo puedes dar usos de bonos que la gente ya tiene.',
  bad_gift: 'Escribe qué das (de 2 a 60 caracteres).',
  bad_kind: 'Elige qué das.',
  offensive_text: 'Ese texto no se puede usar. Cámbialo.',
  not_allowed: 'En Klendar no se pueden dar apuestas ni juegos de azar.',
  business_inactive: 'Tu negocio no está activo.',
  rate_limited: 'Vas muy rápido. Espera un momento y vuelve a probar.',
  account_suspended: 'Tu cuenta está suspendida.',
  not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
  bad_max_people: 'Elige para cuántas personas (de 1 a 20) o «Sin tope».',
};
/** Por qué se ha cerrado el QR (`closed_reason`), dicho al equipo. */
const MOMENTO_CERRADO = {
  full: 'Ya lo han recibido todos',
  idle: 'Se ha cerrado: 10 minutos sin usarse',
  expired: 'Se ha cerrado: llevaba 3 horas abierto',
};
/** «Para 1 persona», «Para 5 personas». */
const momentoParaN = (n) => (n === 1 ? 'Para 1 persona' : `Para ${n} personas`);
const momentoError = (code) => I18N.t(MOMENTO_ERR[code] || friendly(code));

/** HMAC-SHA256(secreto, texto) en hexadecimal. */
async function momentoFirma(secreto, texto) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(texto)));
  return [...s].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lo que da el QR, dicho al cliente (es quien mira la pantalla). */
const momentoQue = (s) => (s.kind === 'stamps'
  ? (s.stamps === 1 ? `1 sello en ${s.label}` : `${s.stamps} sellos en ${s.label}`)
  : s.kind === 'pass_use' ? `1 uso de tu bono «${s.label}»` : s.label);

/** Cuántas personas tienen ese bono con usos (como la app: «2 personas lo tienen»). */
const momentoTienen = (n) => {
  const k = Number(n) || 0;
  return k === 0 ? bi('Nadie lo tiene ahora', 'Nobody has it right now')
    : k === 1 ? bi('1 persona lo tiene', '1 person has it')
      : bi(`${k} personas lo tienen`, `${k} people have it`);
};

/** ¿Es el QR de «Dar en el momento»? (lo escanea el cliente, no el equipo). */
const momentoEsQr = (raw) => /\/m\/[0-9a-f]{16}\.[0-9]{1,12}\.[0-9a-f]{12}/i.test(String(raw || ''));

/** Los relojes del QR abierto (uno a la vez). */
let MOMENTO_RELOJ = null;
let MOMENTO_SONDEO = null;
const momentoPara = () => {
  clearInterval(MOMENTO_RELOJ); MOMENTO_RELOJ = null;
  clearInterval(MOMENTO_SONDEO); MOMENTO_SONDEO = null;
};

PAGES.momento = async (v) => {
  momentoPara();
  const o = await rpc('spot_give_options', { p_business: BIZ.id });
  if (o?.ok === false) { v.innerHTML = `<div class="card"><p>${esc(momentoError(o.error))}</p></div>`; return; }
  const cards = o.cards || [];
  const passes = o.passes || [];
  const bloq = o.blocked === true;
  const primero = cards.length && !bloq ? 'stamps' : passes.length ? 'pass_use' : bloq ? '' : 'gift';
  const radio = (k, texto, ok, nota) => `<label class="opcion"><input type="radio" name="kind" value="${k}" ${k === primero ? 'checked' : ''} ${ok ? '' : 'disabled'}><span>${esc(texto)}${nota ? `<br><small class="muted">${esc(nota)}</small>` : ''}</span></label>`;
  v.innerHTML = `
    <div class="page-head"><h1>Dar en el momento</h1></div>
    <p class="muted"><a class="link" href="#/validar">← Validar códigos</a></p>
    <form class="card momento-form" id="momentoForm">
      <fieldset class="f full"><legend>¿Qué das?</legend>
        ${bloq ? `<p class="hint">${esc('Con el negocio parado solo puedes dar usos de bonos que la gente ya tiene: los sellos nuevos y «algo del momento» vuelven cuando se reactive.')}</p>` : ''}
        ${radio('stamps', 'Sellos', cards.length > 0 && !bloq, cards.length ? '' : 'No tienes tarjetas de sellos activas.')}
        ${radio('pass_use', 'Un uso de un bono', passes.length > 0, passes.length ? '' : 'No tienes bonos.')}
        ${radio('gift', 'Algo del momento', !bloq, '')}
      </fieldset>
      <div data-para="stamps" hidden>
        <label class="f"><span>¿De qué tarjeta?</span><select name="card">${cards.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(`Premio: ${c.reward}`)}</option>`).join('')}</select></label>
        <label class="f"><span>¿Cuántos?</span><select name="stamps">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n === 1 ? '1 sello' : `${n} sellos`}</option>`).join('')}</select></label>
      </div>
      <div data-para="pass_use" hidden>
        <label class="f"><span>¿De qué bono?</span><select name="pass">${passes.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(momentoTienen(p.active))}</option>`).join('')}</select></label>
        <p class="hint">Se descuenta un uso del bono que ya tiene el cliente.</p>
      </div>
      <div data-para="gift" hidden>
        <label class="f"><span>Qué das</span><input name="gift" maxlength="60" placeholder="Chupito de la casa, 10 % en tu cuenta, Postre invitado…" autocomplete="off"></label>
        ${(o.recent_gifts || []).length ? `<p class="hint">Lo último que has dado</p>
          <div class="momento-recientes">${o.recent_gifts.map((g) => `<button type="button" class="pill" data-reciente="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}
      </div>
      <label class="f"><span>¿Para cuántas personas?</span><select name="max_people">
        <option value="">Sin tope</option>${Array.from({ length: 20 }, (_, i) => i + 1).map((n) => `<option value="${n}">${esc(momentoParaN(n))}</option>`).join('')}</select></label>
      <p class="hint">Al llegar a ese número, el QR se cierra solo.</p>
      <p class="hint">El cliente escanea el QR con la app o con la cámara del móvil y lo acepta. Una vez por persona; como mucho 5 al día en tu negocio.</p>
      <button class="btn primary grande" type="submit" ${primero ? '' : 'disabled'}>${ms('qr_code_2')}Enseñar el QR</button>
    </form>`;
  const form = $('#momentoForm', v);
  const muestra = () => {
    const k = form.elements.kind.value;
    $$('[data-para]', form).forEach((d) => { d.hidden = d.dataset.para !== k; });
  };
  form.addEventListener('change', muestra);
  muestra();
  $$('[data-reciente]', form).forEach((b) => { b.onclick = () => { form.elements.gift.value = b.dataset.reciente; }; });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const k = form.elements.kind.value;
    if (!k) return;
    const gift = (form.elements.gift?.value || '').trim();
    if (k === 'gift' && (gift.length < 2 || gift.length > 60)) { toast(momentoError('bad_gift'), true); return; }
    if (!window.crypto?.subtle) { toast(I18N.t('Este navegador no puede enseñar el QR. Ábrelo en la app de Klendar o en otro navegador.'), true); return; }
    const boton = $('button[type=submit]', form);
    boton.disabled = true;
    try {
      const s = await rpc('spot_give_start', {
        p_business: BIZ.id,
        p_kind: k,
        p_card: k === 'stamps' ? form.elements.card.value : null,
        p_stamps: k === 'stamps' ? Number(form.elements.stamps.value) : null,
        p_pass_type: k === 'pass_use' ? form.elements.pass.value : null,
        p_gift: k === 'gift' ? gift : null,
        // Vacío = sin tope (null, como la app).
        p_max_people: form.elements.max_people.value ? Number(form.elements.max_people.value) : null,
      });
      if (s?.ok === false) { toast(momentoError(s.error), true); boton.disabled = false; return; }
      momentoQr(v, s);
    } catch (err) {
      toast(friendly(err.message), true);
      boton.disabled = false;
    }
  };
};

/** El QR abierto: lo que se da, el QR que cambia y quién lo ha recibido. */
function momentoQr(v, s) {
  momentoPara();
  const desfase = Number(s.now || 0) - Math.floor(Date.now() / 1000);
  const paso = Number(s.step || 30);
  const cierra = new Date(s.expires_at).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  v.innerHTML = `
    <div class="page-head"><h1>Dar en el momento</h1></div>
    <div class="card momento-qr">
      <p class="muted">${esc(`${s.business?.name || BIZ.name} te da:`)}</p>
      <h2 class="momento-que">${esc(momentoQue(s))}</h2>
      ${s.adults_only ? `<p><b>${esc(I18N.t('Solo para mayores de 18'))}</b></p>` : ''}
      <div class="momento-caja" id="momentoCaja" role="img" aria-label="QR"></div>
      <p class="muted" id="momentoCambia" aria-hidden="true"></p>
      <p class="muted" id="momentoAyuda">Escanéalo con la app de Klendar o con la cámara del móvil</p>
      <p class="momento-cuantos" id="momentoCuantos" aria-live="polite"></p>
      <p class="muted" id="momentoSolo">Si nadie lo usa en 10 minutos, se cierra solo.</p>
      <ul class="momento-lista" id="momentoLista"></ul>
      <button class="btn grande" type="button" id="momentoFin">Terminar</button>
      <p class="muted" id="momentoCierra">${esc(`Se cierra solo a las ${cierra}`)}</p>
    </div>`;
  I18N.translate(v);
  let vista = -1;
  let cuantos = 0;
  let abierto = true;
  const caja = $('#momentoCaja', v);
  const fuera = () => !document.contains(caja);
  const cerrar = (seguro) => {
    momentoPara();
    if (abierto && seguro) rpc('spot_give_end', { p_session: s.id }).catch(() => {});
    abierto = false;
  };
  const tick = async () => {
    // Al irse de la pantalla, el QR se cierra: nadie más puede usarlo.
    if (fuera()) { cerrar(true); return; }
    const ahora = Math.floor(Date.now() / 1000) + desfase;
    const w = Math.floor(ahora / paso);
    $('#momentoCambia', v).textContent = I18N.t(`Cambia en ${paso - (ahora % paso)} s: una captura no sirve`);
    if (w === vista) return;
    vista = w;
    const firma = (await momentoFirma(s.secret, `${s.key}.${w}`)).slice(0, 12);
    const qr = window.qrcode(0, 'M');
    qr.addData(`https://klendar.app/m/${s.key}.${w}.${firma}`);
    qr.make();
    caja.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  };
  const tope = Number(s.max_people) || null;
  const pintaEstado = (st) => {
    const n = Number(st.count || 0);
    const max = Number(st.max_people ?? tope) || null;
    // Con tope, cuántos de cuántos («1 de 2 lo han recibido»).
    $('#momentoCuantos', v).textContent = max ? `${n} de ${max} lo han recibido`
      : n === 0 ? 'Nadie lo ha recibido todavía'
        : n === 1 ? '1 persona lo ha recibido' : `${n} personas lo han recibido`;
    $('#momentoLista', v).innerHTML = (st.receipts || []).slice(0, 12).map((r) => `<li>${ms('check_circle')}<span>${esc(`${r.name || 'Alguien'} lo ha recibido`)}</span><small class="muted">${esc(new Date(r.at).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', timeZone: TZ }))}</small></li>`).join('');
    I18N.translate($('#momentoCuantos', v));
    I18N.translate($('#momentoLista', v));
    if (n > cuantos && navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(120);
    cuantos = n;
    if (st.live === false) {
      cerrar(false);
      // Por qué: lleno, 10 minutos sin usarse, 3 horas o «Terminar».
      const porQue = MOMENTO_CERRADO[st.closed_reason] || 'Este QR ya no vale';
      caja.innerHTML = `<p class="momento-fin">${ms(st.closed_reason === 'full' ? 'check_circle' : 'timer_off')}${esc(I18N.t(porQue))}</p>`;
      $('#momentoCambia', v).textContent = '';
      $('#momentoAyuda', v).hidden = true;
      $('#momentoSolo', v).hidden = true;
      $('#momentoCierra', v).hidden = true;
      const b = $('#momentoFin', v);
      b.textContent = I18N.t('Dar otra cosa');
      b.onclick = () => PAGES.momento(v).then(() => I18N.translate(v));
    }
  };
  const sondea = async () => {
    if (fuera()) { cerrar(true); return; }
    try {
      const st = await rpc('spot_give_status', { p_session: s.id });
      if (st?.ok !== false && !fuera()) pintaEstado(st);
    } catch { /* sin red un momento: en 3 s otra vez */ }
  };
  pintaEstado({ count: 0, receipts: [], live: true, max_people: tope });
  $('#momentoFin', v).onclick = async () => {
    cerrar(true);
    toast(cuantos === 0 ? 'Nadie lo ha recibido todavía' : cuantos === 1 ? '1 persona lo ha recibido' : `${cuantos} personas lo han recibido`);
    await PAGES.momento(v);
    I18N.translate(v);
  };
  MOMENTO_RELOJ = setInterval(tick, 1000);
  MOMENTO_SONDEO = setInterval(sondea, 3000);
  tick();
}
