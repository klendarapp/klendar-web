/* Panel del negocio: «Aforo en directo» (migración 20261234100000 de la app).
 * Lo mismo que la app:
 *
 * - #/aforo: la pantalla de la puerta. La cifra grande («86 / 120») y el
 *   nivel del contador, dos botones enormes e iguales (−1 y +1, en tinta),
 *   lo que ve la gente en la ficha, «Esta noche…», cuántas personas esperan
 *   que haya sitio, los eventos de hoy y «Poner a 0». Cualquiera del equipo
 *   (también un empleado, varios a la vez: se pone al día cada 4 s mientras
 *   está abierta y la pestaña se ve).
 * - #/aforo/ajustes: activar, aforo máximo y porcentajes. Propietario o
 *   encargado; un empleado va a la puerta.
 * - En «Cifras»: «Aforo · A qué hora se llenó» (`aforoCifras`).
 *
 * Cada toque cuenta al momento en pantalla y se manda agrupado (la suma de
 * los toques seguidos, hasta ±50) con su identificador (`p_op`): si la red
 * falla se reenvía con el mismo, y la base no lo cuenta dos veces. Un
 * segundo toque del mismo botón a menos de 120 ms no cuenta (dedo que
 * rebota).
 *
 * Va después de panel.js y herramientas.js y usa lo suyo (`PAGES`, `rpc`,
 * `sb`, `BIZ`, `TZ`, `LOC`, `esc`, `bi`, `toast`, `friendly`, `gestiona`,
 * `confirmDlg`, `route`, `fmtNum`, `SVG`, `icono`, `cifrasPlegar`). Comparten
 * ámbito: los nombres de aquí empiezan por `afd` (y `aforoCifras`).
 */
'use strict';

Object.assign(SVG, {
  // tune (ajustes del aforo).
  ajustesAforo: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
});

const AFD_DOBLE_MS = 120;
const AFD_SONDEO_MS = 4000;
const AFD_AGRUPA_MS = 350;

const afdHora = (iso, tz = TZ) => (iso ? new Date(iso).toLocaleTimeString(LOC(), { hour: 'numeric', minute: '2-digit', timeZone: tz }) : '');
const afdNivelDe = (n, st) => {
  const max = Number(st?.max) || 0;
  if (max <= 0) return null;
  const casi = Number(st.almost_pct) || 70;
  const lleno = Number(st.full_pct) || 95;
  return n * 100 < max * casi ? 'quiet' : n * 100 < max * lleno ? 'lively' : 'full';
};
const afdNivel = (l) => (l && window.KlendarMarcas ? window.KlendarMarcas.nivel(l, I18N.lang) : '');
const afdUuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

/** Por qué no ha ido, dicho para el negocio. */
function afdError(msg) {
  const m = String(msg || '');
  if (m.includes('capacity_disabled')) return bi('El aforo en directo está apagado.', 'Live capacity is off.');
  if (m.includes('invalid_max')) return bi('Pon un aforo máximo entre 1 y 100.000 personas.', 'Enter a maximum capacity between 1 and 100,000 people.');
  if (m.includes('invalid_pct')) return bi('«Casi lleno» va del 10 al 95 % y «Lleno», al menos 5 puntos más, hasta el 100 %.', '“Nearly full” goes from 10 to 95% and “Full” at least 5 points higher, up to 100%.');
  if (m.includes('organizer')) return bi('Sin local fijo no hay aforo que contar.', 'Without a fixed venue there’s no head count.');
  if (m.includes('forbidden')) return friendly('not_authorized');
  return friendly(m);
}

/** Lo que dice la puerta debajo de los botones (lo que ve la gente, esta
 * noche, quién espera y los eventos de hoy). */
function afdLineas(st) {
  const lineas = [];
  // Lo que ve la gente en la ficha.
  let ficha = '';
  let volver = false;
  if (!st.crowd_enabled) ficha = bi('«¿Hay sitio ahora?» está apagado: tu ficha no lo enseña.', '“Room right now?” is off: your page doesn’t show it.');
  else if (!st.open_now) ficha = bi('Ahora estás cerrado: tu ficha no lo enseña.', 'You’re closed now: your page doesn’t show it.');
  else if (st.shown_source === 'manual' && st.shown_level) {
    const nivel = afdNivel(st.shown_level);
    ficha = st.manual_until
      ? bi(`Marcado a mano: ${nivel} · vuelve al contador a las ${afdHora(st.manual_until)}`, `Set by hand: ${nivel} · back to the counter at ${afdHora(st.manual_until)}`)
      : bi(`Marcado a mano: ${nivel}`, `Set by hand: ${nivel}`);
    volver = true;
  } else if (st.shown_level) ficha = bi(`En tu ficha: ${afdNivel(st.shown_level)}`, `On your page: ${afdNivel(st.shown_level)}`);
  else ficha = bi('Aún no has contado hoy: tu ficha no dice nada.', 'You haven’t counted today: your page says nothing.');
  lineas.push(`<p class="afd-linea afd-ficha"><span>${esc(ficha)}</span>${volver
    ? ` <button type="button" class="linkbtn" id="afdVolver">${esc(bi('Volver al contador', 'Back to the counter'))}</button>` : ''}</p>`);
  // Esta noche: el máximo y, si llegó, cuándo se llenó.
  const n = st.tonight;
  if (n && Number(n.peak) > 0) {
    const max = bi(`Esta noche: máximo ${fmtNum(n.peak)} a las ${afdHora(n.peak_at)}`, `Tonight: peak of ${fmtNum(n.peak)} at ${afdHora(n.peak_at)}`);
    const lleno = n.full_at ? bi(` · lleno a las ${afdHora(n.full_at)}`, ` · full at ${afdHora(n.full_at)}`) : '';
    lineas.push(`<p class="afd-linea">${esc(max + lleno)}</p>`);
  }
  const esperan = Number(st.alerts_waiting) || 0;
  if (esperan > 0) {
    lineas.push(`<p class="afd-linea">${esc(esperan === 1
      ? bi('1 persona espera que haya sitio', '1 person is waiting for there to be room')
      : bi(`${fmtNum(esperan)} personas esperan que haya sitio`, `${fmtNum(esperan)} people are waiting for there to be room`))}</p>`);
  }
  const eventos = Array.isArray(st.events_today) ? st.events_today : [];
  for (const e of eventos) {
    const faltan = Number(e.waiting) || 0;
    const titulo = String(e.title || '');
    const hora = afdHora(e.event_at);
    lineas.push(`<p class="afd-linea">${esc(faltan > 0
      ? bi(`Hoy: «${titulo}» a las ${hora} · ${fmtNum(faltan)} con reserva por llegar`, `Today: “${titulo}” at ${hora} · ${fmtNum(faltan)} with a booking still to arrive`)
      : bi(`Hoy: «${titulo}» a las ${hora}`, `Today: “${titulo}” at ${hora}`))}</p>`);
  }
  if (eventos.length) lineas.push(`<p class="afd-linea muted">${esc(bi('El aforo no cierra las reservas del evento.', 'The head count doesn’t close the event’s bookings.'))}</p>`);
  return lineas.join('');
}

// ── La puerta ───────────────────────────────────────────────────────────────
PAGES.aforo = async (v, param) => {
  if (param === 'ajustes') return afdAjustes(v);
  let st = await rpc('capacity_status', { p_business: BIZ.id });
  if (!st) throw new Error('not_authorized');
  if (st.organizer) { location.replace('#/resumen'); return; }
  const puedeAjustar = st.can_edit === true;
  if (!st.enabled || !(Number(st.max) > 0)) {
    // Apagado: la pantalla vacía de siempre, centrada y con salida.
    v.innerHTML = `<div class="page-head"><h1>${esc(bi('Aforo en directo', 'Live capacity'))}</h1></div>
      <section class="vacio"><h2>${esc(bi('El aforo en directo está apagado', 'Live capacity is off'))}</h2>
        <p>${esc(bi('Cuenta en la puerta con +1 y −1, y «¿Hay sitio ahora?» se pone solo.', 'Count at the door with +1 and −1, and “Room right now?” sets itself.'))}</p>
        <div class="vacio-botones">${puedeAjustar
    ? `<a class="btn primary" href="#/aforo/ajustes">${esc(bi('Activar', 'Turn on'))}</a>`
    : `<a class="btn" href="#/resumen">${esc(bi('Volver al resumen', 'Back to the summary'))}</a>`}</div>
        ${puedeAjustar ? '' : `<p class="muted">${esc(bi('Lo activa el propietario o un encargado.', 'The owner or a manager turns it on.'))}</p>`}</section>`;
    return;
  }

  v.innerHTML = `<div class="afd">
    <div class="page-head"><h1>${esc(bi('Aforo en directo', 'Live capacity'))}</h1><span class="spacer"></span>
      ${puedeAjustar ? `<a class="btn sm ghost" href="#/aforo/ajustes" aria-label="${esc(bi('Ajustes del aforo', 'Head count settings'))}" title="${esc(bi('Ajustes del aforo', 'Head count settings'))}">${icono('ajustesAforo')}<span class="afd-ajustes-txt">${esc(bi('Ajustes del aforo', 'Head count settings'))}</span></a>` : ''}</div>
    <section class="afd-puerta" aria-labelledby="afdCifra">
      <p class="afd-cifra" id="afdCifra" aria-live="polite" aria-atomic="true"><b id="afdN"></b><span class="afd-max"> / ${esc(fmtNum(st.max))}</span></p>
      <p class="afd-nivel" id="afdNivel"></p>
      <div class="afd-botones">
        <button type="button" class="afd-btn" data-d="-1" aria-label="${esc(bi('Sale una persona (−1)', 'One person leaves (−1)'))}">−1</button>
        <button type="button" class="afd-btn" data-d="1" aria-label="${esc(bi('Entra una persona (+1)', 'One person comes in (+1)'))}">+1</button>
      </div>
      <p class="afd-red" id="afdRed" role="status" hidden>${esc(bi('Sin conexión: lo mandamos en cuanto vuelva.', 'No connection: we’ll send it as soon as it’s back.'))}</p>
      <div class="afd-lineas" id="afdLineas"></div>
      <p class="afd-cero"><button type="button" class="linkbtn" id="afdCero">${esc(bi('Poner a 0', 'Set to 0'))}</button></p>
    </section></div>`;

  // Lo que aún no ha confirmado la base: lo que está en camino y lo tocado
  // mientras tanto.
  let vuelo = null; // { op, d }
  let pend = 0;
  let tAgrupa = null;
  let tReintento = null;
  let espera = 2000;
  const ultimo = { '1': 0, '-1': 0 };
  const visto = () => (Number(st.people) || 0) + (vuelo ? vuelo.d : 0) + pend;

  const pinta = () => {
    const n = Math.max(0, visto());
    $('#afdN', v).textContent = fmtNum(n);
    $('#afdNivel', v).textContent = afdNivel(afdNivelDe(n, st));
    $('#afdLineas', v).innerHTML = afdLineas(st);
    const volverBtn = $('#afdVolver', v);
    if (volverBtn) {
      volverBtn.onclick = async () => {
        if (volverBtn.disabled) return;
        volverBtn.disabled = true;
        try {
          await rpc('set_business_crowd', { p_business: BIZ.id, p_level: null });
          toast(bi('Vuelve el contador', 'Back to the counter'));
          await refresca(true);
        } catch (e) { toast(afdError(e.clave || e.message), true); volverBtn.disabled = false; }
      };
    }
  };

  const refresca = async (forzar = false) => {
    if (!v.isConnected) return;
    if (!forzar && (vuelo || pend)) return;
    try {
      const nuevo = await rpc('capacity_status', { p_business: BIZ.id });
      if (!v.isConnected || !nuevo) return;
      if (!nuevo.enabled) { route(); return; }
      if (!forzar && (vuelo || pend)) return;
      st = nuevo;
      pinta();
    } catch { /* sin red: lo de antes; el siguiente sondeo lo vuelve a intentar */ }
  };

  const manda = async () => {
    clearTimeout(tAgrupa); tAgrupa = null;
    if (vuelo || !v.isConnected) return;
    if (!pend) return;
    const d = Math.max(-50, Math.min(50, pend));
    pend -= d;
    vuelo = { op: afdUuid(), d };
    envia();
  };
  const envia = async () => {
    if (!vuelo || !v.isConnected) return;
    const { op, d } = vuelo;
    let res;
    try { res = await sb.rpc('capacity_bump', { p_business: BIZ.id, p_delta: d, p_op: op }); } catch (e) { res = { error: { message: String(e?.message || e) } }; }
    if (!v.isConnected) return;
    const err = res?.error;
    // Sin respuesta de la base (red): el mismo toque, con el mismo `p_op`.
    if (err && !err.code) {
      $('#afdRed', v).hidden = false;
      clearTimeout(tReintento);
      tReintento = setTimeout(envia, espera);
      espera = Math.min(espera * 2, 10000);
      return;
    }
    $('#afdRed', v).hidden = true;
    espera = 2000;
    vuelo = null;
    if (err) {
      // La base lo ha rechazado (apagado, demasiado rápido…): se descarta.
      pend = 0;
      toast(afdError(err.message), true);
      if (String(err.message).includes('capacity_disabled')) { route(); return; }
      await refresca(true);
      return;
    }
    if (res.data) st = res.data;
    pinta();
    if (pend) manda();
  };

  $$('.afd-btn', v).forEach((b) => {
    b.addEventListener('click', () => {
      const d = Number(b.dataset.d);
      const ahora = performance.now();
      // Un dedo que rebota: el segundo toque del mismo botón no cuenta.
      if (ahora - ultimo[b.dataset.d] < AFD_DOBLE_MS) return;
      ultimo[b.dataset.d] = ahora;
      if (d < 0 && visto() <= 0) return;
      pend += d;
      pinta();
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch { /* sin vibración */ } }
      if (!vuelo) { clearTimeout(tAgrupa); tAgrupa = setTimeout(manda, AFD_AGRUPA_MS); }
    });
  });

  $('#afdCero', v).onclick = async () => {
    const si = await confirmDlg(bi('¿Poner el aforo a 0?', 'Set the head count to 0?'),
      esc(bi('Hazlo al cerrar. Al empezar otro día vuelve a 0 solo.', 'Do it when you close. It goes back to 0 by itself when a new day starts.')),
      { submit: bi('Poner a 0', 'Set to 0') });
    if (!si || !v.isConnected) return;
    clearTimeout(tAgrupa); tAgrupa = null;
    pend = 0;
    try {
      const nuevo = await rpc('capacity_reset', { p_business: BIZ.id });
      if (nuevo) st = nuevo;
      vuelo = null;
      pinta();
      toast(bi('Aforo a 0', 'Head count set to 0'));
    } catch (e) { toast(afdError(e.clave || e.message), true); }
  };

  pinta();
  // Varios del equipo a la vez: cada 4 s mientras se ve; con la pestaña
  // escondida, nada; al volver, al momento.
  const sondeo = setInterval(() => {
    if (!v.isConnected) { clearInterval(sondeo); document.removeEventListener('visibilitychange', alVolver); return; }
    if (!document.hidden) refresca();
  }, AFD_SONDEO_MS);
  const alVolver = () => {
    if (!v.isConnected) { clearInterval(sondeo); document.removeEventListener('visibilitychange', alVolver); return; }
    if (!document.hidden) refresca();
  };
  document.addEventListener('visibilitychange', alVolver);
};

// ── Ajustes del aforo ───────────────────────────────────────────────────────
async function afdAjustes(v) {
  const st = await rpc('capacity_status', { p_business: BIZ.id });
  if (!st) throw new Error('not_authorized');
  if (st.organizer) { location.replace('#/resumen'); return; }
  if (!(st.can_edit === true)) { location.replace('#/aforo'); return; }
  const casiTxt = (n) => bi(`Por debajo del ${n} %, «Hay sitio».`, `Below ${n}%, “There’s room”.`);
  v.innerHTML = `
    <p class="crumbs"><a class="link" href="#/aforo">${esc(bi('Aforo en directo', 'Live capacity'))}</a></p>
    <div class="page-head"><h1>${esc(bi('Ajustes del aforo', 'Head count settings'))}</h1></div>
    <form class="form afd-form" id="afdForm" novalidate>
      <label class="f full casilla"><input type="checkbox" name="on" ${st.enabled ? 'checked' : ''}>
        <span><b>${esc(bi('Aforo en directo', 'Live capacity'))}</b> <small class="muted">${esc(bi('Cuenta en la puerta con +1 y −1, y «¿Hay sitio ahora?» se pone solo.', 'Count at the door with +1 and −1, and “Room right now?” sets itself.'))}</small></span></label>
      <label class="f full"><span>${esc(bi('Aforo máximo', 'Maximum capacity'))}</span>
        <span class="afd-con-unidad"><input name="max" type="number" inputmode="numeric" min="1" max="100000" step="1" value="${esc(st.max ?? '')}"><span class="muted">${esc(bi('personas', 'people'))}</span></span>
        <small class="err-txt" data-err="max" hidden></small></label>
      <label class="f"><span>${esc(bi('Casi lleno desde', 'Nearly full from'))}</span>
        <span class="afd-con-unidad"><input name="almost" type="number" inputmode="numeric" min="10" max="95" step="1" value="${esc(st.almost_pct ?? 70)}"><span class="muted">%</span></span></label>
      <label class="f"><span>${esc(bi('Lleno desde', 'Full from'))}</span>
        <span class="afd-con-unidad"><input name="full" type="number" inputmode="numeric" min="15" max="100" step="1" value="${esc(st.full_pct ?? 95)}"><span class="muted">%</span></span></label>
      <p class="hint full" id="afdCasiTxt">${esc(casiTxt(st.almost_pct ?? 70))}</p>
      <small class="err-txt full" data-err="pct" hidden></small>
      <p class="help full afd-aviso">${esc(bi('El aforo lo pones y lo cuentas tú, y tiene que ser real. Klendar no controla el aforo legal de tu local.', 'You set the capacity and you do the counting, and it has to be real. Klendar doesn’t check your venue’s legal capacity.'))}</p>
      <div class="full"><button type="submit" class="btn primary">${esc(bi('Guardar', 'Save'))}</button></div>
    </form>`;
  const f = $('#afdForm', v);
  const el = f.elements;
  const err = (k, txt) => { const s = $(`[data-err="${k}"]`, f); s.textContent = txt || ''; s.hidden = !txt; };
  el.almost.addEventListener('input', () => {
    const n = Number(el.almost.value);
    if (Number.isFinite(n) && n > 0) $('#afdCasiTxt', v).textContent = casiTxt(n);
  });
  f.onsubmit = async (e) => {
    e.preventDefault();
    err('max', ''); err('pct', '');
    const on = el.on.checked;
    const maxTxt = String(el.max.value).trim();
    const max = maxTxt === '' ? null : Number(maxTxt);
    const casi = Number(el.almost.value);
    const lleno = Number(el.full.value);
    // Las mismas reglas que la base (y la app).
    if ((on && max == null) || (max != null && !(Number.isInteger(max) && max >= 1 && max <= 100000))) {
      err('max', afdError('invalid_max')); el.max.focus(); return;
    }
    if (!(Number.isInteger(casi) && casi >= 10 && casi <= 95 && Number.isInteger(lleno) && lleno >= casi + 5 && lleno <= 100)) {
      err('pct', afdError('invalid_pct')); el.almost.focus(); return;
    }
    try {
      await rpc('set_capacity_settings', { p_business: BIZ.id, p_enabled: on, p_max: max, p_almost: casi, p_full: lleno });
      toast(bi('Guardado', 'Saved'));
      location.hash = on ? '#/aforo' : '#/herramientas';
    } catch (x) {
      const c = String(x.clave || x.message);
      if (c.includes('invalid_max')) err('max', afdError(c));
      else if (c.includes('invalid_pct')) err('pct', afdError(c));
      else toast(afdError(c), true);
    }
  };
}

// ── Cifras: «Aforo · A qué hora se llenó» ──────────────────────────────────
/** Las barras de una noche: un tramo de 15 min por barra (alto = el máximo
 * del tramo), en tinta, y el aforo máximo en discontinua. Solo números. */
function afdBarras(noche, tz) {
  const slots = Array.isArray(noche.slots) ? noche.slots : [];
  if (!slots.length) return '';
  const max = Number(noche.max) || 0;
  const tope = Math.max(1, max, ...slots.map((s) => Number(s.peak) || 0));
  const W = 320; const H = 120; const pie = 18;
  const ancho = W / slots.length;
  const alto = (n) => Math.round(((Number(n) || 0) / tope) * (H - 4));
  const barras = slots.map((s, i) => {
    const h = alto(s.peak);
    return `<rect x="${(i * ancho + ancho * 0.12).toFixed(1)}" y="${H - h}" width="${Math.max(1, ancho * 0.76).toFixed(1)}" height="${h}" rx="1.5"><title>${esc(`${afdHora(s.at, tz)} · ${fmtNum(Number(s.peak) || 0)}`)}</title></rect>`;
  }).join('');
  const linea = max > 0 ? `<line class="afd-tope" x1="0" x2="${W}" y1="${H - alto(max)}" y2="${H - alto(max)}"/>` : '';
  const marcas = [0, Math.floor((slots.length - 1) / 2), slots.length - 1]
    .filter((x, i, a) => a.indexOf(x) === i)
    .map((i) => `<text x="${Math.min(W - 2, Math.max(2, i * ancho + ancho / 2)).toFixed(1)}" y="${H + pie - 4}" text-anchor="${i === 0 ? 'start' : i === slots.length - 1 ? 'end' : 'middle'}">${esc(afdHora(slots[i].at, tz))}</text>`).join('');
  return `<svg class="afd-grafica" viewBox="0 0 ${W} ${H + pie}" role="img" aria-label="${esc(bi(`Cuánta gente había, cada 15 minutos. Aforo máximo: ${fmtNum(max)}`, `How many people there were, every 15 minutes. Maximum capacity: ${fmtNum(max)}`))}">${barras}${linea}${marcas}</svg>`;
}

async function aforoCifras(caja) {
  if (!caja) return;
  const s = await rpc('capacity_stats', { p_business: BIZ.id, p_days: 14 }).catch(() => null);
  if (!s || !caja.isConnected) return;
  const noches = Array.isArray(s.nights) ? s.nights : [];
  if (!s.enabled && !noches.length) return;
  const tz = s.time_zone || TZ;
  const dia = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`)
    .toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
  const resumen = (n) => bi(`Máximo: ${fmtNum(n.peak)} a las ${afdHora(n.peak_at, tz)}`, `Peak: ${fmtNum(n.peak)} at ${afdHora(n.peak_at, tz)}`);
  let elegida = 0;
  const detalle = (n) => `${afdBarras(n, tz)}
    <p class="afd-dato"><b>${esc(resumen(n))}</b></p>
    <p class="afd-dato">${esc(n.full_at ? bi(`Lleno a las ${afdHora(n.full_at, tz)}`, `Full at ${afdHora(n.full_at, tz)}`) : bi('No llegó a llenarse', 'It didn’t fill up'))}</p>
    ${n.almost_at ? `<p class="afd-dato muted">${esc(bi(`Casi lleno a las ${afdHora(n.almost_at, tz)}`, `Nearly full at ${afdHora(n.almost_at, tz)}`))}</p>` : ''}`;
  caja.innerHTML = `<div class="card afd-cifras" data-res="${esc(noches.length ? resumen(noches[0]) : bi('Aún no hay noches contadas.', 'No nights counted yet.'))}"><h2>${esc(bi('Aforo', 'Head count'))}</h2>
    <h3 class="afd-cifras-t">${esc(bi('A qué hora se llenó', 'What time it filled up'))}</h3>
    ${noches.length ? `<div class="afd-noches" role="group" aria-label="${esc(bi('Noches', 'Nights'))}">${noches.map((n, i) => `<button type="button" class="btn sm${i === 0 ? ' on' : ''}" data-noche="${i}" aria-pressed="${i === 0}">${esc(dia(n.day))}</button>`).join('')}</div>
      <div id="afdNoche">${detalle(noches[0])}</div>
      <p class="muted" style="margin:8px 0 0">${esc(bi('Cada barra son 15 minutos: la altura, cuánta gente había como mucho. La línea discontinua es tu aforo máximo. Solo números: nunca quién.', 'Each bar is 15 minutes: its height, the most people there were. The dashed line is your maximum capacity. Only numbers: never who.'))}</p>`
    : `<p class="muted" style="margin:0">${esc(bi('Aún no hay noches contadas.', 'No nights counted yet.'))}</p>`}
  </div>`;
  if (typeof cifrasPlegar === 'function') cifrasPlegar(caja);
  $$('[data-noche]', caja).forEach((b) => {
    b.onclick = () => {
      elegida = Number(b.dataset.noche);
      $$('[data-noche]', caja).forEach((x) => { const on = Number(x.dataset.noche) === elegida; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      $('#afdNoche', caja).innerHTML = detalle(noches[elegida]);
    };
  });
}
