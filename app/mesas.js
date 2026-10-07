/* «Tu cuenta»: reserva de mesa (tanda C, migración 20261207100000).
 *
 * - `#/mesa/<id del negocio>`: «Reservar mesa» (desde el botón de la ficha):
 *   día y hora en chips, «¿Cuántos sois?», tu teléfono (se recuerda en este
 *   navegador, no en la cuenta, y se borra al cerrar sesión), una nota y
 *   «Pedir mesa». Sin sesión, «Entrar para reservar».
 * - `#/mesas/<id>`: la reserva, con su estado y lo que se puede hacer:
 *   anular, contestar a la otra hora que propone el negocio, llamar o pedir
 *   otra mesa.
 * - En Planes: «Reservas de mesa» con las vivas y las pasadas en «Pasados»
 *   (`mesaPartes`, `mesaFila`).
 *
 * Va después de app.js y de app/cola.js y usa lo suyo (`RUTAS`, `llamar`,
 * `pinta`, `t`, `esc`, `fecha`, `colaHora`, `confirma`, `ocupado`…).
 * Comparten ámbito: los nombres de aquí empiezan por `mesa`.
 */
'use strict';

const MESA_TELEFONO = 'klendar.telefono';
/** Los errores de la reserva de mesa, en palabras (los mismos que la app). */
const MESA_ERR = {
  tables_off: 'Este local ya no acepta reservas por Klendar.',
  adults_only: 'Solo para mayores de 18 años.',
  bad_phone: 'Escribe un teléfono válido.',
  bad_time: 'Esa hora ya no está libre. Elige otra.',
  too_many_here: 'Ya tienes dos reservas en este local.',
  too_many: 'Tienes demasiadas reservas abiertas.',
  too_late: 'Ya ha pasado el plazo.',
  not_pending: 'Ya está contestada.',
  not_proposed: 'Ya está contestada.',
  not_live: 'Esta reserva ya no está viva.',
  rate_limited: 'Demasiados intentos. Espera un minuto.',
};
function mesaError(e) {
  if (e?.clave === 'bad_party') {
    const max = Number(e.datos?.max_party) || 1;
    return EN ? `At most ${max} people.` : `Como mucho ${max} personas.`;
  }
  return MESA_ERR[e?.clave] ? t(MESA_ERR[e.clave]) : (e?.message || amable(''));
}

const MESA_ESTADOS = {
  pending: 'Pendiente de respuesta',
  proposed: 'Te proponen otra hora',
  confirmed: 'Confirmada',
  declined: 'Rechazada',
  expired: 'Caducada',
  cancelled: 'Anulada',
};
const MESA_SVG = '<svg class="ms-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.96 9.73l-1.43-5C20.41 4.3 20.02 4 19.57 4H4.43c-.45 0-.84.3-.96.73l-1.43 5c-.18.63.3 1.27.96 1.27h2.2L4 20h2l.67-5h10.67l.66 5h2l-1.2-9H21c.66 0 1.14-.64.96-1.27zM6.93 13l.27-2h9.6l.27 2H6.93z"/></svg>';

/** Viva: por contestar, con otra hora propuesta o confirmada y por llegar. */
const mesaViva = (r) => r.status === 'pending' || r.status === 'proposed'
  || (r.status === 'confirmed' && new Date(r.starts_at).getTime() > Date.now());
const mesaPersonas = (n) => (EN ? (n === 1 ? '1 person' : `${n} people`) : (n === 1 ? '1 persona' : `${n} personas`));
const mesaZona = (r) => r?.business?.time_zone || r?.time_zone || undefined;
/** «sáb 12 oct, 21:00» en la hora del local. */
const mesaDiaHora = (iso, tz) => `${fecha(iso, { weekday: 'short' }, tz).replace('.', '')} ${fecha(iso, { day: 'numeric' }, tz)} ${fecha(iso, { month: 'short' }, tz).replace('.', '')}, ${colaHora(iso, tz)}`;
/** «hoy a las 21:00», «mañana a las 13:30», «el sábado 12 de octubre a las
 * 21:00» (lo mismo que los avisos de la base, `tq_when_text`). */
function mesaCuando(iso, tz) {
  if (!iso) return '';
  const z = KZ ? KZ.zona(tz) : 'Europe/Madrid';
  const dia = KZ ? KZ.dia(iso, z) : String(iso).slice(0, 10);
  const hoy = KZ ? KZ.hoy(z) : '';
  const manana = KZ ? KZ.hoy(z, 1) : '';
  const hora = colaHora(iso, z);
  const una = hora.startsWith('01:');
  const largo = (pre_) => `${pre_}${fecha(iso, { weekday: 'long' }, z)} ${fecha(iso, { day: 'numeric' }, z)}`;
  const d = dia === hoy ? (EN ? 'today' : 'hoy') : dia === manana ? (EN ? 'tomorrow' : 'mañana')
    : EN ? `${largo('on ')} ${fecha(iso, { month: 'long' }, z)}` : `${largo('el ')} de ${fecha(iso, { month: 'long' }, z)}`;
  return EN ? `${d} at ${hora}` : `${d} ${una ? 'a la' : 'a las'} ${hora}`;
}
/** «2 horas» (lo que tiene el negocio para contestar). */
const mesaPlazo = (min) => {
  const m = Number(min) || 120;
  if (m < 60) return EN ? `${m} minutes` : `${m} minutos`;
  const h = Math.round(m / 60);
  return EN ? (h === 1 ? '1 hour' : `${h} hours`) : (h === 1 ? '1 hora' : `${h} horas`);
};
const mesaFicha = (b) => `${pre}/b/${encodeURIComponent(b?.slug || b?.id || '')}`;
const mesaTel = (tel) => String(tel || '').replace(/[\s().-]/g, '');

// ── En Planes ─────────────────────────────────────────────────────────────
/** Una reserva en Planes: el local, cuántos y cuándo, y su estado. */
function mesaFila(r) {
  const b = r.business || {};
  const tz = mesaZona(r);
  return `<a class="ocard mesa-fila" href="#/mesas/${esc(r.id)}">
      ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="" loading="lazy">` : `<span class="ph">${MESA_SVG}</span>`}
      <span class="ocard-body"><b>${esc(b.name || '')}</b>
        <span class="muted">${esc(`${mesaPersonas(r.party_size)} · ${mesaDiaHora(r.starts_at, tz)}`)}</span>
        <span class="ocard-meta"><span class="tag ${r.status === 'proposed' ? 'ink' : 'off'}">${esc(t(MESA_ESTADOS[r.status] || r.status))}</span></span>
      </span>
    </a>`;
}
/** Las vivas (en «Reservas de mesa») y las pasadas (para «Pasados»). */
function mesaPartes(lista) {
  const filas = Array.isArray(lista) ? lista : [];
  return {
    vivas: filas.filter(mesaViva).map(mesaFila),
    pasadas: filas.filter((r) => !mesaViva(r)).map((r) => ({ cuando: new Date(r.starts_at).getTime(), html: mesaFila(r) })),
  };
}

// ── Reservar mesa ─────────────────────────────────────────────────────────
RUTAS.mesa = async ([id]) => {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) { location.hash = '#/planes'; return; }
  const d = await llamar('business_table_booking', { p_business: id });
  const b = d?.business || { id };
  const tz = b.time_zone || undefined;
  const verLocal = (cls = '') => `<a class="pill${cls}" href="${esc(mesaFicha(b))}">${esc(t('Ver el local'))}</a>`;
  const llamar_ = b.phone ? `<a class="pill" href="tel:${esc(mesaTel(b.phone))}">${esc(EN ? `Call ${b.name}` : `Llamar a ${b.name}`)}</a>` : '';
  if (!d?.enabled) {
    pinta(pantallaVacia({ h: 'h1', titulo: t('Reservar mesa'), texto: t('Este local ya no acepta reservas por Klendar.'), botones: verLocal(' accent') }));
    return;
  }
  const dias = Array.isArray(d.days) ? d.days : [];
  if (!dias.length) {
    pinta(pantallaVacia({
      h: 'h1', titulo: t('No quedan horas para reservar'), texto: t('Llámales o vuelve a mirar más adelante.'),
      botones: `${b.phone ? llamar_.replace('class="pill"', 'class="pill accent"') : verLocal(' accent')}${b.phone ? verLocal() : ''}`,
    }));
    return;
  }
  const hoy = KZ ? KZ.hoy(KZ.zona(tz)) : '';
  const manana = KZ ? KZ.hoy(KZ.zona(tz), 1) : '';
  const chipDia = (dia) => {
    if (dia === hoy) return t('Hoy');
    if (dia === manana) return t('Mañana');
    try {
      return new Intl.DateTimeFormat(LOC, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`)).replace('.', '');
    } catch { return dia; }
  };
  let telefono = '';
  try { telefono = localStorage.getItem(MESA_TELEFONO) || ''; } catch { /* sin almacenamiento */ }
  const max = Math.max(1, Number(d.max_party) || 1);
  pinta(`
    <p class="crumbs"><a href="${esc(mesaFicha(b))}">${esc(b.name || '')}</a></p>
    <h1>${esc(t('Reservar mesa'))}</h1>
    <p class="muted">${esc(b.name || '')}</p>
    <form id="f-mesa" class="formu mesa-form" novalidate>
      <fieldset class="chips" id="mesa-dias"><legend>${esc(t('Día'))}</legend>
        ${dias.map((dia, i) => `<label><input type="radio" name="day" value="${esc(dia)}"${i === 0 ? ' checked' : ''}>${esc(chipDia(dia))}</label>`).join('')}
      </fieldset>
      <fieldset class="chips" id="mesa-horas" aria-describedby="err-hora"><legend>${esc(t('Hora'))}</legend>
        <p class="muted">${esc(t('Cargando…'))}</p>
      </fieldset>
      <p class="err" id="err-hora" role="alert"></p>
      <label>${esc(t('¿Cuántos sois?'))}<select name="party">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${i === Math.min(1, max - 1) ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>
        <small>${esc(EN ? `Up to ${max} people. For more, call them.` : `Hasta ${max} personas. Para más, llámales.`)}</small></label>
      <label>${esc(t('Tu teléfono'))}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${esc(telefono)}" required>
        <small>${esc(EN ? `Only ${b.name} sees it, and only for this booking, in case they need to call you. It's deleted when it's over.` : `Solo lo ve ${b.name} y solo para esta reserva, por si tiene que llamarte. Se borra al terminar.`)}</small></label>
      <label>${esc(t('Nota (opcional)'))}<textarea name="note" maxlength="200" rows="3" placeholder="${esc(t('Una trona, en la terraza, un cumpleaños…'))}"></textarea></label>
      <p class="muted mesa-plazo">${esc(EN ? `${b.name} replies within ${mesaPlazo(d.reply_minutes)} at most; if not, the request expires and we'll let you know.` : `${b.name} contesta en ${mesaPlazo(d.reply_minutes)} como mucho; si no, la petición caduca y te avisamos.`)}</p>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" type="submit">${esc(t(YO ? 'Pedir mesa' : 'Entrar para reservar'))}</button>
    </form>`);
  const f = $('#f-mesa');
  let pide = 0;
  /** Las horas del día elegido (de 15 en 15), en chips. */
  const cargaHoras = async (elegida = '') => {
    const n = ++pide;
    const caja = $('#mesa-horas');
    const dia = f.day.value;
    caja.innerHTML = `<legend>${esc(t('Hora'))}</legend><p class="muted">${esc(t('Cargando…'))}</p>`;
    let horas = [];
    try { horas = await llamar('table_booking_times', { p_business: id, p_day: dia }); } catch { horas = []; }
    if (n !== pide || !caja.isConnected) return;
    horas = Array.isArray(horas) ? horas : [];
    caja.innerHTML = `<legend>${esc(t('Hora'))}</legend>${horas.length
      ? horas.map((h) => `<label><input type="radio" name="time" value="${esc(h)}"${h === elegida ? ' checked' : ''}>${esc(h)}</label>`).join('')
      : `<p class="muted">${esc(t('Ese día ya no quedan horas. Elige otro.'))}</p>`}`;
    I18N.translate(caja);
  };
  $$('input[name=day]', f).forEach((r) => { r.onchange = () => { $('#err-hora').textContent = ''; cargaHoras(); }; });
  cargaHoras();
  f.onsubmit = (ev) => {
    ev.preventDefault();
    if (!YO) { location.hash = `#/entrar?siguiente=${encodeURIComponent(`mesa/${id}`)}`; return; }
    $('#err').textContent = '';
    const hora = f.querySelector('input[name=time]:checked')?.value || '';
    $('#err-hora').textContent = hora ? '' : t('Elige una hora.');
    const tel = mesaTel(f.phone.value);
    errorCampo(f.phone, /^\+?[0-9]{9,15}$/.test(tel) ? null : t('Escribe un teléfono válido.'));
    if (!hora) { $('#mesa-horas input')?.focus(); return; }
    if (!/^\+?[0-9]{9,15}$/.test(tel)) { f.phone.focus(); return; }
    ocupado(f.querySelector('button[type=submit]'), async () => {
      try {
        const r = await llamar('request_table_booking', {
          p_business: id, p_day: f.day.value, p_time: hora, p_party: Number(f.party.value) || 1,
          p_phone: tel, p_note: f.note.value.trim() || null,
        });
        try { localStorage.setItem(MESA_TELEFONO, f.phone.value.trim()); } catch { /* sin almacenamiento */ }
        pinta(`
          <div class="ticket">
            <p class="hecho-ic" aria-hidden="true">✓</p>
            <h1>${esc(t('Petición enviada'))}</h1>
            <p class="muted">${esc(EN ? `We'll let you know when ${b.name} replies. You'll find it in Plans.` : `Te avisamos cuando ${b.name} conteste. La tienes en Planes.`)}</p>
            <p class="acciones">
              <a class="pill accent" href="#/mesas/${esc(r.id)}">${esc(t('Ver la petición'))}</a>
              <a class="pill" href="#/planes">${esc(t('Tus planes'))}</a>
            </p>
          </div>`);
        history.replaceState(null, '', `#/mesas/${r.id}`);
        I18N.translate(view);
      } catch (e) {
        if (e.clave === 'bad_time') { $('#err-hora').textContent = mesaError(e); cargaHoras(); return; }
        if (e.clave === 'bad_phone') { errorCampo(f.phone, mesaError(e)); f.phone.focus(); return; }
        $('#err').textContent = mesaError(e);
      }
    });
  };
};

// ── Una reserva ───────────────────────────────────────────────────────────
RUTAS.mesas = async ([id]) => {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) { location.hash = '#/planes'; return; }
  if (!exigeSesion(`mesas/${id}`)) return;
  let r;
  try {
    r = await llamar('my_table_booking', { p_booking: id });
  } catch (e) {
    if (e.clave !== 'not_found') throw e;
    pinta(pantallaVacia({
      icono: 'bookmark', h: 'h1', titulo: t('Esa reserva ya no está'),
      texto: t('Las reservas se borran a los 90 días. Las tuyas están en Planes.'),
      botones: `<a class="pill accent" href="#/planes">${esc(t('Tus planes'))}</a>`,
    }));
    return;
  }
  const b = r.business || {};
  const tz = mesaZona(r);
  const pasada = r.status === 'confirmed' && new Date(r.starts_at).getTime() <= Date.now();
  const dato = (k, v) => (v ? `<div class="fila fila-dato"><span class="fila-t"><small>${esc(k)}</small><b>${esc(v)}</b></span></div>` : '');
  const telNegocio = b.phone ? `<a class="pill" href="tel:${esc(mesaTel(b.phone))}">${esc(EN ? `Call ${b.name}` : `Llamar a ${b.name}`)}</a>` : '';
  const otra = `<a class="pill accent" href="#/mesa/${esc(b.id)}">${esc(t('Pedir otra mesa'))}</a>`;
  const n = b.name || '';
  let caja = '';
  if (r.status === 'pending') {
    caja = `<p>${esc(EN ? `${n} has until ${colaHora(r.reply_by, tz)} to reply.` : `${n} tiene hasta las ${colaHora(r.reply_by, tz)} para contestar.`)}</p>
      <div class="mesa-botones"><button type="button" class="pill" id="mesa-anular">${esc(t('Anular la petición'))}</button></div>`;
  } else if (r.status === 'proposed') {
    caja = `<div class="mesa-propuesta">
        <p class="mesa-propone"><b>${esc(EN ? `They suggest ${mesaCuando(r.proposed_at, tz)}` : `Te proponen ${mesaCuando(r.proposed_at, tz)}`)}</b></p>
        <div class="mesa-botones dos">
          <button type="button" class="pill accent" data-resp="1">${esc(t('Me va bien'))}</button>
          <button type="button" class="pill" data-resp="0">${esc(t('No me va bien'))}</button>
        </div>
        <p class="muted">${esc(EN ? `Reply by ${colaHora(r.reply_by, tz)}` : `Contesta antes de las ${colaHora(r.reply_by, tz)}`)}</p>
      </div>`;
  } else if (r.status === 'confirmed' && !pasada) {
    caja = `<div class="mesa-botones${telNegocio ? ' dos' : ''}">${telNegocio}<button type="button" class="pill" id="mesa-anular">${esc(t('Anular la reserva'))}</button></div>`;
  } else {
    const texto = pasada ? ''
      : r.status === 'declined' ? (EN ? `${n} can't give you a table this time.` : `${n} no puede darte mesa esta vez.`)
        : r.status === 'expired' ? (r.proposed_at
          ? t('No contestaste a tiempo a la otra hora y la reserva quedó anulada.')
          : (EN ? `${n} didn't reply in time and the request expired. You can call them or ask for another time.` : `${n} no contestó a tiempo y la petición caducó. Puedes llamarles o pedir otra hora.`))
          : r.cancelled_by === 'business' ? (EN ? `${n} cancelled this booking.` : `${n} anuló esta reserva.`)
            : t('Anulaste esta reserva.');
    caja = `${texto ? `<p>${esc(texto)}</p>` : ''}<div class="mesa-botones">${otra}</div>`;
  }
  pinta(`
    <p class="crumbs"><a href="#/planes">${esc(t('Tus planes'))}</a></p>
    <p class="cola-kicker">${esc(t('Reserva de mesa'))}</p>
    <h1 class="cola-h1">${esc(n)}</h1>
    <p class="mesa-estado"><span class="tag ${r.status === 'proposed' ? 'ink' : 'off'}">${esc(t(MESA_ESTADOS[r.status] || r.status))}</span>
      <a href="${esc(mesaFicha(b))}">${esc(t('Ver el local'))}</a></p>
    <div class="lista mesa-datos">
      ${dato(t('Día y hora'), mesaDiaHora(r.starts_at, tz))}
      ${dato(t('Personas'), mesaPersonas(r.party_size))}
      ${dato(t('Nota'), r.note)}
      ${dato(t('Tu teléfono'), r.phone)}
    </div>
    ${r.business_message ? `<p class="mesa-msg">${esc(EN ? `Message from ${n}: “${r.business_message}”` : `Mensaje de ${n}: «${r.business_message}»`)}</p>` : ''}
    <div class="mesa-caja">${caja}</div>`);

  $('#mesa-anular')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    const peticion = r.status === 'pending';
    const ok = await confirma({
      titulo: t(peticion ? '¿Anular la petición?' : '¿Anular la reserva?'),
      texto: EN ? `We'll let ${n} know.` : `Le avisamos a ${n}.`,
      aceptar: t(peticion ? 'Anular la petición' : 'Anular la reserva'), cancelar: t('Volver'), peligro: true,
    });
    if (!ok) return;
    await ocupado(boton, async () => {
      try {
        await llamar('cancel_table_booking', { p_booking: r.id });
        toast(t(peticion ? 'Petición anulada' : 'Reserva anulada'));
      } catch (e) { toast(mesaError(e), true); }
      navegar();
    });
  });
  $$('[data-resp]').forEach((boton) => boton.addEventListener('click', async () => {
    const si = boton.dataset.resp === '1';
    if (!si) {
      const ok = await confirma({
        titulo: t('¿No te va bien la otra hora?'),
        texto: EN ? `The booking is cancelled and we'll let ${n} know.` : `La reserva queda anulada y se lo decimos a ${n}.`,
        aceptar: t('No me va bien'), cancelar: t('Volver'), peligro: true,
      });
      if (!ok) return;
    }
    await ocupado(boton, async () => {
      try {
        await llamar('answer_table_proposal', { p_booking: r.id, p_accept: si });
        toast(t(si ? 'Reserva confirmada' : 'Reserva anulada'));
      } catch (e) { toast(mesaError(e), true); }
      navegar();
    });
  }));
};
