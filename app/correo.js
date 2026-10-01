/* «Tu cuenta» — el correo de la cuenta (como la app, 2026-10-27):
 *
 * - «Correo» en Ajustes: con qué correo entras, un cambio a medias y
 *   «Cambiar correo» detrás de «Confirma que eres tú» (assets/identidad.js).
 *   Con «Secure email change» llega un código y un enlace al correo nuevo y
 *   otro al de ahora; el cambio se hace al confirmar los dos (aquí con los
 *   códigos, o con los enlaces en cualquier navegador: assets/acceso.js).
 * - «Tu correo nos devuelve los mensajes: revísalo» (webhook de Resend →
 *   `my_email_status`), en la portada de «Tu cuenta» y en Ajustes.
 * - Lo que sigue vivo al eliminar la cuenta (`my_account_live_items`).
 *
 * Script clásico que comparte ámbito con app.js y cuenta.js: todos los
 * nombres empiezan por `correo`/`cuentaViva` para no pisar ninguno.
 */
'use strict';

/** Estado del correo según la base, o null (sin red: sin aviso). */
async function correoEstado() {
  try { return await llamar('my_email_status', {}); } catch { return null; }
}

/** El aviso de que rebota (o nos marcó como spam), con «Cambiar correo» y
 * «Ya lo he revisado». `alCambiar`: qué hace el botón (en la portada, ir a
 * Ajustes). */
function correoAvisoHtml(st) {
  const queja = st.suppressed_reason === 'complaint';
  const correo = esc(st.email || '');
  const texto = queja
    ? (EN ? `You marked a Klendar email as spam, so we've stopped sending summaries to <b>${correo}</b>. If it was a mistake, tap “I've checked it”.`
      : `Marcaste un correo de Klendar como spam, así que hemos dejado de mandarte resúmenes a <b>${correo}</b>. Si fue sin querer, pulsa «Ya lo he revisado».`)
    : (EN ? `Klendar emails aren't reaching <b>${correo}</b>. Check it's spelt correctly and the mailbox works, or change it. We'll still send you login and confirmation emails.`
      : `Los correos de Klendar no llegan a <b>${correo}</b>. Comprueba que está bien escrito y que el buzón funciona, o cámbialo. Los de entrar y confirmar te los seguimos mandando.`);
  return `<div class="invitacion aviso-correo" role="status">
      <span class="inv-ic">${ic('mail')}</span>
      <span class="fila-t"><b>${esc(t('Tu correo nos devuelve los mensajes: revísalo'))}</b>
        <small>${texto}</small>
        <span class="acciones">
          <button type="button" class="pill" data-correo="cambiar">${esc(t('Cambiar correo'))}</button>
          <button type="button" class="pill" data-correo="revisado">${esc(t('Ya lo he revisado'))}</button>
        </span></span>
    </div>`;
}

function correoAvisoEnlaza(caja, alCambiar) {
  caja.querySelector('[data-correo=cambiar]')?.addEventListener('click', alCambiar);
  caja.querySelector('[data-correo=revisado]')?.addEventListener('click', (ev) => ocupado(ev.currentTarget, async () => {
    await llamar('clear_my_email_suppression', {});
    toast(t('Gracias: volveremos a intentarlo'));
    caja.innerHTML = '';
  }));
}

/** En la portada de «Tu cuenta»: el aviso si hace falta, nada si no. */
async function correoAvisoPortada(caja) {
  if (!caja) return;
  const st = await correoEstado();
  if (!st?.suppressed_at || !caja.isConnected) return;
  caja.innerHTML = correoAvisoHtml(st);
  correoAvisoEnlaza(caja, () => { location.hash = '#/ajustes'; });
}

/** La sección «Correo» de Ajustes. */
async function correoSeccion(caja) {
  if (!caja) return;
  const st = (await correoEstado()) || { email: YO?.email || '' };
  if (!caja.isConnected) return;
  const actual = st.email || YO?.email || '';
  const pendiente = st.new_email || YO?.new_email || '';
  caja.innerHTML = `
    <h2>${esc(t('Correo'))}</h2>
    ${st.suppressed_at ? `<div class="aviso-correo-caja">${correoAvisoHtml(st)}</div>` : ''}
    <p>${actual ? (EN ? `You log in with <b>${esc(actual)}</b>.` : `Entras con <b>${esc(actual)}</b>.`) : esc(t('Tu cuenta no tiene correo.'))}</p>
    ${pendiente && actual ? `<p class="muted">${EN
      ? `The change to <b>${esc(pendiente)}</b> still needs confirming: check both inboxes.`
      : `Falta confirmar el cambio a <b>${esc(pendiente)}</b>: mira los dos correos.`}
      <button type="button" class="linkbtn" id="correo-codigos">${esc(t('Escribir los códigos'))}</button></p>` : ''}
    ${actual ? `<p><button type="button" class="pill" id="correo-cambiar">${ic('mail')} ${esc(t('Cambiar correo'))}</button></p>` : ''}`;
  const cambiar = () => correoCambiar(caja);
  if (st.suppressed_at) correoAvisoEnlaza(caja.querySelector('.aviso-correo-caja'), cambiar);
  caja.querySelector('#correo-cambiar')?.addEventListener('click', cambiar);
  caja.querySelector('#correo-codigos')?.addEventListener('click', async () => {
    if (await correoCodigos(pendiente, actual)) correoSeccion(caja);
  });
}

/** «Cambiar correo»: confirmar que eres tú, el correo nuevo, y los códigos. */
async function correoCambiar(caja) {
  const id = await confirmaIdentidad();
  if (!id) return;
  try {
    const nuevo = await correoPideNuevo(id.email, (n) => id.cambiarCorreo(n));
    if (!nuevo) return;
    if (caja?.isConnected) correoSeccion(caja);
    const hecho = await correoCodigos(nuevo, id.email);
    if (hecho) {
      toast(EN ? `Done: you now log in with ${nuevo}` : `Listo: ahora entras con ${nuevo}`);
      if (caja?.isConnected) correoSeccion(caja);
      window.KL_CABECERA?.();
    }
  } finally {
    await id.cerrar();
  }
}

/** Pide el correo nuevo (válido y distinto) y llama a `enviar` con él.
 * Devuelve el correo si se envió, o null si se cancela. */
function correoPideNuevo(actual, enviar) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    d.setAttribute('aria-labelledby', 'correo-nuevo-t');
    d.innerHTML = `<h2 id="correo-nuevo-t">${esc(t('Cambiar correo'))}</h2>
      <form class="formu" novalidate>
        <p class="muted">${EN
          ? `Type your new email. We'll send a code to it and another to your current one (<b>${esc(actual)}</b>): the change happens once you confirm both.`
          : `Escribe el correo nuevo. Te mandaremos un código a ese correo y otro al de ahora (<b>${esc(actual)}</b>): el cambio se hace al confirmar los dos.`}</p>
        <label>${esc(t('Correo nuevo'))}<input name="correo" type="email" autocomplete="email" maxlength="254"></label>
        <p class="err" role="alert"></p>
        <div class="dialogo-botones">
          <button type="button" class="pill" value="no">${esc(t('Cancelar'))}</button>
          <button type="submit" class="pill accent">${esc(t('Enviar los códigos'))}</button>
        </div>
      </form>`;
    document.body.appendChild(d);
    let enviado = null;
    const form = d.querySelector('form');
    d.querySelector('button[value=no]').onclick = () => d.close();
    form.onsubmit = (e) => {
      e.preventDefault();
      const campo = form.elements.correo;
      const v = campo.value.trim().toLowerCase();
      if (!validaForm(form, { correo: VALIDA.correo })) return;
      if (v === String(actual || '').toLowerCase()) { errorCampo(campo, t('Es el mismo correo que ya tienes.')); return; }
      ocupado(form.querySelector('button[type=submit]'), async () => {
        try {
          await enviar(v);
        } catch (x) {
          const ya = x?.code === 'email_exists' || /already been registered/i.test(x?.message || '');
          form.querySelector('.err').textContent = ya ? t('Ya existe una cuenta con ese correo') : errAuth(x);
          return;
        }
        enviado = v;
        d.close();
      });
    };
    d.addEventListener('close', () => { d.remove(); resolve(enviado); });
    d.showModal();
    form.elements.correo.focus();
  });
}

/** Los dos códigos (uno de cada correo). Cada código se prueba con las dos
 * direcciones, así da igual en qué casilla se escriba. true si el cambio ya
 * está hecho; false si se deja para luego. */
function correoCodigos(nuevo, actual) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    d.setAttribute('aria-labelledby', 'correo-codigos-t');
    const campo = (n, correo) => `<label>${EN ? `Code sent to ${esc(correo)}` : `Código enviado a ${esc(correo)}`}
      <input name="${n}" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label>`;
    d.innerHTML = `<h2 id="correo-codigos-t">${esc(t('Confirma el cambio'))}</h2>
      <form class="formu" novalidate>
        <p class="muted">${esc(t('Escribe los dos códigos de 6 cifras, o toca el botón de cada correo.'))}</p>
        ${campo('a', nuevo)}${campo('b', actual)}
        <p class="err" role="alert"></p>
        <div class="dialogo-botones">
          <button type="button" class="pill" value="no">${esc(t('Lo hago luego'))}</button>
          <button type="submit" class="pill accent">${esc(t('Seguir'))}</button>
        </div>
      </form>`;
    document.body.appendChild(d);
    let hecho = false;
    const form = d.querySelector('form');
    const err = form.querySelector('.err');
    d.querySelector('button[value=no]').onclick = () => d.close();
    const prueba = async (codigo) => {
      let ultimo = null;
      for (const email of [nuevo, actual]) {
        const { data, error } = await sb.auth.verifyOtp({ email, token: codigo, type: 'email_change' });
        if (!error) return !!data?.session;
        ultimo = error;
      }
      throw ultimo;
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      err.textContent = '';
      const campos = [form.elements.a, form.elements.b];
      const llenos = campos.filter((c) => c.value.replace(/\D/g, ''));
      if (!llenos.length || llenos.some((c) => !/^\d{6}$/.test(c.value.replace(/\D/g, '')))) {
        err.textContent = t('Escribe el código completo que te hemos enviado.');
        return;
      }
      ocupado(form.querySelector('button[type=submit]'), async () => {
        for (const c of llenos) {
          let listo;
          try { listo = await prueba(c.value.replace(/\D/g, '')); } catch (x) {
            err.textContent = /otp_expired|expired|invalid/i.test(`${x?.code} ${x?.message}`)
              ? t('Ese código no vale o ha caducado.') : errAuth(x);
            return;
          }
          c.value = '';
          if (listo) { hecho = true; d.close(); return; }
        }
        err.textContent = t('Hecho. Falta el código del otro correo.');
      });
    };
    d.addEventListener('close', () => { d.remove(); resolve(hecho); });
    d.showModal();
    form.elements.a.focus();
  });
}

/** Debajo de la lista de lo que se pierde al eliminar la cuenta. */
const PIE_VIVO = 'Las reservas y los códigos se anulan (si hay lista de espera, la plaza pasa a otra persona) y los premios, los regalos y los sellos se pierden.';

/** Lo que se pierde al eliminar la cuenta, en líneas (vacío si nada). */
async function cuentaVivaLineas() {
  let v = null;
  try { v = await llamar('my_account_live_items', {}); } catch { return []; }
  if (!v) return [];
  const cuando = (iso, tz) => fecha(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, tz);
  const q = (s) => (EN ? `“${s}”` : `«${s}»`);
  return [
    ...(v.reservations || []).map((r) => (EN ? `A booking for ${q(r.title)} (${r.business}), ${cuando(r.at, r.time_zone)}`
      : `Reserva en ${q(r.title)} (${r.business}), ${cuando(r.at, r.time_zone)}`)),
    ...(v.codes || []).map((c) => (EN ? `An unused code for ${q(c.title)} (${c.business})` : `Un código sin usar de ${q(c.title)} (${c.business})`)),
    ...(v.rewards || []).map((r) => (r.kind === 'birthday_gift'
      ? (EN ? `A birthday gift: ${r.reward} (${r.business})` : `Un regalo de cumpleaños: ${r.reward} (${r.business})`)
      : (EN ? `A reward to collect: ${r.reward} (${r.business})` : `Un premio por recoger: ${r.reward} (${r.business})`))),
    ...(v.stamps || []).map((s) => (EN ? `${s.count} of ${s.goal} stamps on ${q(s.card)} (${s.business})`
      : `${s.count} de ${s.goal} sellos en ${q(s.card)} (${s.business})`)),
  ];
}
