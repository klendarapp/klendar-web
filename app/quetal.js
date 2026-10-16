/* «¿Qué tal?» en «Tu cuenta» (migración 20261229100000 de la app): la
 * pregunta del día siguiente a una visita, igual que la app.
 *
 *   · En «Tus códigos», con lo ya usado: «¿Qué tal en …?» y 👍 / 👎.
 *   · `#/que-tal/<id>[?a=up|down]`: la pregunta. 👍 invita a reseñar con 5
 *     estrellas marcadas (`#/opinar/<id>?nota=5`, se pueden cambiar); 👎 deja
 *     escribir en privado al negocio y enseña siempre «Prefiero dejar una
 *     reseña». Reseñar nunca depende de lo que se conteste (normas de
 *     reseñas y Directiva Ómnibus).
 *
 * Comparte ámbito con app.js (t, esc, llamar, pinta, RUTAS…): nombres que
 * empiezan por `qt` para no pisar nada. */
'use strict';

/** El texto de un error de ¿Qué tal? (la base manda `{ok:false, error}`). */
const qtError = (e) => ({
  too_short: t('Escribe un poco más (3 caracteres como mínimo).'),
  too_long: t('Como mucho, 500 caracteres.'),
  offensive_text: t('Revisa el texto: hay palabras que no se permiten.'),
  already_sent: t('Ya le has escrito al negocio.'),
  expired: t('Esta pregunta ya ha caducado.'),
}[e?.clave] || e?.message || t('Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.'));

/** «Ayer · Vermú + tapa» (o el día, si fue antes). */
function qtVisita(q) {
  const [a, m, d] = String(q.visit_day).split('-').map(Number);
  const dia = new Date(a, m - 1, d);
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const cuando = dia.getTime() === ayer.getTime()
    ? t('Ayer')
    : dia.toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'short' });
  return [cuando, q.what].filter(Boolean).join(' · ');
}

const qtLogo = (q) => (q.business_logo
  ? `<img src="${esc(q.business_logo)}" alt="" loading="lazy">`
  : '<span class="ph">✦</span>');

/** Las preguntas en «Tus códigos». */
function qtTarjetas(lista) {
  if (!Array.isArray(lista) || !lista.length) return '';
  return lista.map((q) => {
    const pendiente = q.answer == null && q.can_answer;
    const estado = pendiente ? ''
      : q.reply ? t('Te han contestado')
        : q.answer === 'up' ? t('Le diste 👍')
          : q.answer === 'down' ? t('Le diste 👎') : t('Esta pregunta ya ha caducado.');
    return `<div class="ocard qt-tarjeta">
      <a class="qt-cabeza" href="#/que-tal/${esc(q.id)}">
        ${qtLogo(q)}
        <span class="ocard-body"><b>${esc(t('¿Qué tal en {nombre}?').replace('{nombre}', q.business_name))}</b>
          <span class="muted">${esc(qtVisita(q))}</span>
          ${estado ? `<span class="ocard-meta"><span class="tag off">${esc(estado)}</span></span>` : ''}
        </span></a>
      ${pendiente ? `<div class="qt-botones">
        <a class="pill" href="#/que-tal/${esc(q.id)}?a=up">${esc(t('👍 Bien'))}</a>
        <a class="pill" href="#/que-tal/${esc(q.id)}?a=down">${esc(t('👎 Mal'))}</a>
      </div>` : ''}
    </div>`;
  }).join('');
}

RUTAS['que-tal'] = async ([id], params) => {
  if (!exigeSesion(`que-tal/${id}`)) return;
  const lista = await llamar('my_quetal', { p_id: id }).catch(() => []);
  let q = Array.isArray(lista) ? lista[0] : null;
  if (!q) {
    pinta(pantallaVacia({
      icono: 'storefront', h: 'h1',
      titulo: t('No encontramos esta pregunta'),
      texto: t('Puede que haya caducado. Tus visitas recientes están en «Tus códigos».'),
      botones: `<a class="pill accent" href="#/codigos">${esc(t('Tus códigos'))}</a>`,
    }));
    return;
  }
  // Desde «Tus códigos», el botón pulsado allí cuenta ya.
  const pulsado = params?.get('a');
  if ((pulsado === 'up' || pulsado === 'down') && q.can_answer && q.answer !== pulsado) {
    try {
      q = (await llamar('quetal_answer', { p_id: id, p_answer: pulsado })).item;
    } catch (e) { toast(qtError(e), true); }
    history.replaceState(null, '', `#/que-tal/${id}`);
  }
  let cambiando = false;

  const resena = (cinco) => `#/opinar/${esc(q.business_id)}${cinco ? '?nota=5' : ''}`;
  const textoResena = () => (q.reviewed ? t('Cambiar mi reseña') : t('Escribir una reseña'));

  const dibuja = () => {
    const preguntando = (q.answer == null || cambiando) && q.can_answer;
    let cuerpo;
    if (preguntando) {
      cuerpo = `<div class="qt-botones">
          <button type="button" class="pill${q.answer === 'up' ? ' activo' : ''}" data-qt="up" aria-pressed="${q.answer === 'up'}">${esc(t('👍 Bien'))}</button>
          <button type="button" class="pill${q.answer === 'down' ? ' activo' : ''}" data-qt="down" aria-pressed="${q.answer === 'down'}">${esc(t('👎 Mal'))}</button>
        </div>
        <p class="muted">${esc(t('El negocio ve cuántos 👍 y 👎 tiene, no quién los da.'))}</p>`;
    } else if (q.answer == null) {
      cuerpo = `<p>${esc(t('Esta pregunta ya ha caducado.'))}</p>`;
    } else if (q.answer === 'up') {
      cuerpo = `<h2>${esc(t('¡Qué bien!'))}</h2>
        <p>${esc(t('¿Lo cuentas en una reseña? Ayuda a otros a decidir.'))}</p>
        <p><a class="pill accent" href="${resena(!q.reviewed)}">${esc(textoResena())}</a></p>`;
    } else if (q.message == null && !q.message_removed && q.can_message) {
      cuerpo = `<form class="formu" id="qtForm" novalidate>
          <label>${esc(t('Vaya. ¿Qué ha fallado?'))}
            <textarea name="texto" rows="5" maxlength="500" placeholder="${esc(t('Cuéntaselo al negocio en privado'))}"></textarea></label>
          <p class="muted">${esc(t('Solo lo leerá el negocio, con tu nombre visible. Puede contestarte una vez.'))}</p>
          <button type="submit" class="pill accent">${esc(t('Enviar al negocio'))}</button>
        </form>`;
    } else {
      cuerpo = `${q.message_removed
        ? `<p>${esc(t('Retiramos tu mensaje porque incumplía las normas.'))}</p>`
        : q.message ? `<div class="qt-burbuja"><small class="muted">${esc(t('Tu mensaje'))}</small><p>${esc(q.message)}</p></div>`
          : `<p>${esc(t('Le diste 👎'))}</p>`}
        ${q.reply
    ? `<div class="qt-burbuja"><small class="muted">${esc(t('Respuesta de {nombre}').replace('{nombre}', q.business_name))}</small><p>${esc(q.reply)}</p></div>`
    : q.message ? `<p class="muted">${esc(t('{nombre} aún no ha contestado.').replace('{nombre}', q.business_name))}</p>` : ''}`;
    }
    // Reseñar, siempre a mano (salvo con 👍, que ya es el botón principal).
    const enlaceResena = q.answer === 'up' && !preguntando ? ''
      : `<p class="qt-enlace"><a href="${resena(false)}">${esc(q.answer === 'down' && !preguntando ? t('Prefiero dejar una reseña') : textoResena())}</a></p>`;
    const cambiar = q.answer != null && !preguntando && q.can_answer && q.message == null
      ? `<p class="qt-enlace"><button type="button" class="enlace" id="qtCambiar">${esc(t('Cambiar mi respuesta'))}</button></p>` : '';
    pinta(`
      <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
      <h1>${esc(t('¿Qué tal?'))}</h1>
      <div class="qt-negocio">${qtLogo(q)}
        <div><h2>${esc(t('¿Qué tal en {nombre}?').replace('{nombre}', q.business_name))}</h2>
        <p class="muted">${esc(qtVisita(q))}</p></div></div>
      ${cuerpo}${enlaceResena}${cambiar}`);
    for (const b of $$('[data-qt]')) {
      b.addEventListener('click', async () => {
        $$('[data-qt]').forEach((x) => { x.disabled = true; });
        try {
          q = (await llamar('quetal_answer', { p_id: id, p_answer: b.dataset.qt })).item;
          cambiando = false;
        } catch (e) { toast(qtError(e), true); }
        dibuja();
      });
    }
    $('#qtCambiar')?.addEventListener('click', () => { cambiando = true; dibuja(); });
    $('#qtForm')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const texto = ev.target.elements.texto.value.trim();
      if (texto.length < 3) { toast(qtError({ clave: 'too_short' }), true); return; }
      const boton = ev.target.querySelector('button[type=submit]');
      boton.disabled = true;
      try {
        q = (await llamar('quetal_send_message', { p_id: id, p_text: texto })).item;
        toast(t('Enviado. Gracias por contarlo.'));
        dibuja();
      } catch (e) {
        boton.disabled = false;
        toast(qtError(e), true);
      }
    });
  };
  dibuja();
};
