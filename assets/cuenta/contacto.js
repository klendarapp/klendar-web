// El teléfono para avisar de una reserva (Iván, 2026-11-17), igual que la app
// (lib/features/contact). Todo detrás de `app_config.contact_details`
// (migración 20261283000000 de la app): apagado, `my_contact` dice
// `enabled: false` y no se pide nada al reservar, apuntarse a la lista de
// espera ni coger número.
//
//   · «Teléfono (opcional)»: relleno con el del perfil y sin casilla; si lo
//     cambia, «Cambiarlo también en mi perfil» (desmarcada); si el perfil no
//     tenía, «Guardar en mi perfil» (marcada); vacío, ninguna.
//   · Debajo, qué verá el negocio (sin teléfono, solo «tu correo»).
//   · Va con esa reserva, sitio o turno (una copia: `set_booking_phone`);
//     el perfil solo cambia con la casilla (`set_my_contact_phone`).
//   · El negocio solo ve el correo de quien ha visto esa línea: por eso se
//     llama a `set_booking_phone` también sin teléfono (migración
//     20261283000010).
'use strict';

const KlContacto = (() => {
  /** Dígitos, espacios y un «+» delante; de 9 a 15 dígitos (como la base). */
  const valido = (v) => {
    const x = String(v || '').trim();
    if (!/^\+?[0-9 ]+$/.test(x)) return false;
    const n = x.replace(/[^0-9]/g, '').length;
    return n >= 9 && n <= 15;
  };
  /** Como lo guarda la base; vacío, null. */
  const limpio = (v) => {
    const x = String(v || '').trim().replace(/\s+/g, ' ');
    return x ? x.replace(/^\+ /, '+') : null;
  };
  const clave = (v) => String(v || '').replace(/[^0-9+]/g, '');
  /** 'none' | 'change' | 'save'. */
  const casilla = (perfil, escrito) => {
    const e = limpio(escrito);
    if (!e) return 'none';
    if (!perfil) return 'save';
    return clave(e) === clave(perfil) ? 'none' : 'change';
  };
  /** Lo que se manda: { shown, phone, saveToProfile }, o null si está mal
   * escrito. `shown`: ha visto la línea de qué verá el negocio (solo
   * entonces ve su correo). `marcada`: la casilla como la ha dejado
   * (undefined: la de serie). */
  const respuesta = (perfil, escrito, marcada) => {
    const e = limpio(escrito);
    if (e && !valido(e)) return null;
    const c = casilla(perfil, e);
    const m = marcada === undefined ? c === 'save' : marcada;
    return { shown: true, phone: e, saveToProfile: c !== 'none' && m ? e : null };
  };
  const TEXTOS = {
    reservation: ['{negocio} verá tu correo y tu teléfono solo para avisarte de esta reserva. Nunca para publicidad.',
      '{negocio} verá tu correo solo para avisarte de esta reserva. Nunca para publicidad.'],
    waitlist: ['{negocio} verá tu correo y tu teléfono solo para avisarte de tu sitio en la lista de espera. Nunca para publicidad.',
      '{negocio} verá tu correo solo para avisarte de tu sitio en la lista de espera. Nunca para publicidad.'],
    queue: ['{negocio} verá tu correo y tu teléfono solo para avisarte de tu turno. Nunca para publicidad.',
      '{negocio} verá tu correo solo para avisarte de tu turno. Nunca para publicidad.'],
  };
  return { valido, limpio, casilla, respuesta, TEXTOS };
})();
if (typeof module !== 'undefined') module.exports = KlContacto;

/** `my_contact`: { enabled, phone }. Sin red o sin sesión, apagado. */
async function miContacto() {
  if (typeof YO === 'undefined' || !YO) return { enabled: false, phone: null };
  try {
    const r = await llamar('my_contact', {});
    return { enabled: !!(r && r.enabled), phone: (r && r.phone) || null };
  } catch { return { enabled: false, phone: null }; }
}

/** El campo, la casilla y la línea de debajo. `id`: prefijo de los ids. */
function campoContacto(id, { perfil, estado }) {
  return `<div class="contacto" id="${id}">
      <label>${esc(t('Teléfono (opcional)'))}
        <input name="telefono" type="tel" inputmode="tel" autocomplete="tel" maxlength="24"
          placeholder="+34 600 000 000" value="${esc(estado ? estado.valor : (perfil || ''))}"></label>
      <p class="err" data-c="err" role="alert"></p>
      <label class="check" data-c="caja" hidden><input type="checkbox" data-c="marca"> <span data-c="caja-t"></span></label>
      <p class="muted" data-c="linea"></p>
    </div>`;
}

/** Enlaza el campo de [campoContacto]. Devuelve `lee()`: la respuesta o null
 * si está mal escrito (y entonces enseña el error). `estado` ({ valor,
 * tocada }): lo escrito, para que un repintado (la cola) no lo borre. */
function enlazaContacto(caja, { perfil, kind, negocio, estado = null }) {
  const KC = KlContacto;
  const input = caja.querySelector('input[name="telefono"]');
  const err = caja.querySelector('[data-c="err"]');
  const fila = caja.querySelector('[data-c="caja"]');
  const marca = caja.querySelector('[data-c="marca"]');
  const cajaT = caja.querySelector('[data-c="caja-t"]');
  const linea = caja.querySelector('[data-c="linea"]');
  let tocada = estado ? estado.tocada : undefined;
  const pintaLinea = () => {
    if (estado) { estado.valor = input.value; estado.tocada = tocada; }
    const e = KC.limpio(input.value);
    const bien = !e || KC.valido(e);
    const [con, sin] = KC.TEXTOS[kind] || KC.TEXTOS.reservation;
    linea.textContent = t(e && bien ? con : sin).replace('{negocio}', negocio || '');
    const c = bien ? KC.casilla(perfil, e) : 'none';
    fila.hidden = c === 'none';
    if (c !== 'none') {
      cajaT.textContent = t(c === 'save' ? 'Guardar en mi perfil' : 'Cambiarlo también en mi perfil');
      marca.checked = tocada === undefined ? c === 'save' : tocada;
    }
    if (bien) err.textContent = '';
  };
  input.addEventListener('input', () => {
    // Solo lo que vale: dígitos, espacios y «+».
    const v = input.value.replace(/[^0-9 +]/g, '');
    if (v !== input.value) input.value = v;
    pintaLinea();
  });
  marca.addEventListener('change', () => { tocada = marca.checked; if (estado) estado.tocada = tocada; });
  pintaLinea();
  return {
    lee() {
      const r = KC.respuesta(perfil, input.value, fila.hidden ? undefined : marca.checked);
      if (!r) {
        err.textContent = t('Escribe solo números, espacios y «+» (de 9 a 15 cifras).');
        input.focus();
      }
      return r;
    },
  };
}

/** Después de reservar, apuntarse o coger número: que ha visto la línea y
 * el teléfono de esa reserva (una copia; sin él, solo el correo) y, con la
 * casilla, el del perfil. Si falla, la reserva sigue: es opcional. */
async function aplicaContacto(kind, ref, r) {
  if (!r || !r.shown) return;
  try {
    await llamar('set_booking_phone', { p_kind: kind, p_ref: ref, p_phone: r.phone || '' });
    if (r.saveToProfile) await llamar('set_my_contact_phone', { p_phone: r.saveToProfile });
  } catch (e) { console.warn('contacto', e); }
}

/** Lo decidido antes de ir a la pantalla del código (sessionStorage, 15 min). */
const CONTACTO_PENDIENTE = 'klendar.contacto';
function guardaContacto(offerId, r) {
  try {
    if (!r || !r.shown) sessionStorage.removeItem(CONTACTO_PENDIENTE);
    else sessionStorage.setItem(CONTACTO_PENDIENTE, JSON.stringify({ o: offerId, r, t: Date.now() }));
  } catch { /* sin almacenamiento: sin teléfono */ }
}
function tomaContacto(offerId) {
  try {
    const m = JSON.parse(sessionStorage.getItem(CONTACTO_PENDIENTE) || 'null');
    sessionStorage.removeItem(CONTACTO_PENDIENTE);
    return m && m.o === offerId && Date.now() - m.t < 15 * 60 * 1000 ? m.r : null;
  } catch { return null; }
}

/** Una pantalla con el teléfono antes de reservar o apuntarse. `encima`:
 * lo que va antes del campo (p. ej. «¿Para cuántos?»). Devuelve
 * { r, form } al pulsar el botón; Cancelar vuelve a `volver`. */
function pantallaContacto({ titulo, encima = '', perfil, kind, negocio, boton, volver, crumbs = '' }) {
  return new Promise((sigue) => {
    pinta(`
      ${crumbs}
      <h1>${esc(titulo)}</h1>
      <form class="formu" id="f-contacto" novalidate>
        ${encima}
        ${campoContacto('c-contacto', { perfil, kind, negocio })}
        <p class="acciones">
          <button class="pill accent" id="g-contacto">${esc(boton)}</button>
          <a class="pill" href="${esc(volver)}">${esc(t('Cancelar'))}</a>
        </p>
      </form>`);
    const campo = enlazaContacto($('#c-contacto'), { perfil, kind, negocio });
    $('#f-contacto').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const r = campo.lee();
      if (r) sigue({ r, form: ev.currentTarget });
    });
    if (typeof I18N !== 'undefined') I18N.translate(view);
  });
}
