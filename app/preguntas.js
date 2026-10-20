/* «Tu cuenta» → «Pregúntale al local» (migración 20261237100000 de la app).
 * Como la app.
 *
 * - `#/preguntar/<negocio>`: «Pregúntale a <negocio>» (de 8 a 300
 *   caracteres; sin tu nombre: no se enseña quién pregunta) y «Tus
 *   preguntas» a ese negocio con su estado (Esperando respuesta · Oculta por
 *   el negocio: motivo · la respuesta) y «Borrar mi pregunta». Llega desde
 *   «Preguntar» de la ficha (`/b/`) y desde los avisos «… ha contestado tu
 *   pregunta» / «… ha ocultado tu pregunta».
 * Topes de la base: 3 preguntas al día y una sin contestar por negocio; el
 * equipo no pregunta a su negocio; bloqueado o en pausa, no recibe.
 *
 * Va después de app.js y cuenta.js y usa lo suyo (`RUTAS`, `llamar`, `pinta`,
 * `esc`, `t`, `toast`, `exigeSesion`, `confirma`, `ocupado`,
 * `pantallaVacia`, `fecha`, `pre`…). Nombres que empiezan por `preg`.
 */
'use strict';

/** Los «no» de la base, dichos como en la app. */
const PREG_ERR = {
  too_short: 'Escribe al menos 8 caracteres.',
  too_long: 'Como mucho 300 caracteres.',
  offensive_text: 'Tiene palabras que no se pueden publicar. Cámbialo y vuelve a enviarlo.',
  pending: 'Ya tienes una pregunta esperando respuesta aquí.',
  daily_limit: 'Por hoy ya está: mañana puedes preguntar más.',
  unavailable: 'Este negocio no recibe preguntas ahora mismo.',
  no_team: 'Este negocio aún no contesta preguntas en Klendar.',
  // Hasta el 4-11-2026 nadie pregunta (migración 20261237100001 de la app).
  not_yet: 'Pronto podrás preguntar a este local.',
  team: 'Eres del equipo de este negocio.',
  rate_limited: 'Has hecho demasiadas hoy. Prueba mañana.',
  not_found: 'Esa pregunta ya no está.',
};
const pregError = (e) => (PREG_ERR[e?.clave] ? t(PREG_ERR[e.clave]) : e?.message || amable(''));

/** El motivo de «Ocultar» (los mismos que el panel y la app). */
const PREG_MOTIVO = {
  answered_elsewhere: 'La respuesta ya está en la ficha',
  not_about_us: 'No es sobre el local',
  personal_data: 'Lleva datos personales',
  inappropriate: 'No es apropiada',
  outdated: 'Ya no está al día',
};

RUTAS.preguntar = async ([id]) => {
  if (!exigeSesion(`preguntar/${id}`)) return;
  const [fila, s, mias] = await Promise.all([
    llamar('business_profile', { p_id: id }).catch(() => null),
    llamar('business_questions_summary', { p_business: id }).catch(() => null),
    llamar('my_questions', { p_business: id, p_limit: 50 }).then((x) => x || []).catch(() => []),
  ]);
  const b = Array.isArray(fila) ? fila[0] : fila;
  if (!b || !s?.ok) {
    pinta(pantallaVacia({ icono: 'storefront', titulo: t('Ese sitio ya no está en Klendar.'), h: 'h1', botones: botonTuCuenta() }));
    return;
  }
  const ficha = `${pre}/b/${encodeURIComponent(b.slug || id)}`;
  const nombre = b.name;
  const bloqueo = s.ask_block && !['auth', 'team'].includes(s.ask_block) ? t(PREG_ERR[s.ask_block] || '') : '';
  const estado = (q) => {
    if (q.state === 'hidden') {
      return `<span class="tag off">${esc(`${t('Oculta por el negocio')}: ${t(PREG_MOTIVO[q.hidden_reason] || '')}`)}</span>`;
    }
    if (q.state === 'pending') return `<span class="tag tag-tinta">${esc(t('Esperando respuesta'))}</span>`;
    return '';
  };
  const filaPregunta = (q) => `<div class="aviso pregunta" id="pregunta-${esc(q.id)}">
      <b>${esc(q.question)}</b>
      <small>${estado(q)} <span class="muted">${esc(fecha(q.asked_at, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></small>
      ${q.answer ? `<div class="respuesta"><b>${esc(EN ? `Reply from ${nombre}` : `Respuesta de ${nombre}`)}</b>
        <p>${esc(q.answer).replace(/\n/g, '<br>')}</p></div>` : ''}
      <span class="acciones"><button type="button" class="pill" data-borrar="${esc(q.id)}" data-respondida="${q.answer ? '1' : ''}">${esc(t('Borrar mi pregunta'))}</button></span>
    </div>`;

  let formulario = '';
  if (s.team) {
    formulario = `<p class="muted">${esc(t('Eres del equipo de este negocio.'))} <a href="/panel/#/preguntas?biz=${esc(id)}">${esc(t('Contestar en el panel'))}</a></p>`;
  } else if (s.can_ask) {
    formulario = `<form class="formu" id="f" novalidate>
      <label>${esc(t('Tu pregunta'))}
        <textarea name="texto" rows="3" minlength="8" maxlength="300" placeholder="${esc(t('¿Se puede ir con perro? ¿Hay que reservar?'))}"></textarea></label>
      <p class="muted pie-form">${esc(t('La verá todo el mundo cuando el negocio conteste, sin tu nombre. No pongas datos personales.'))}</p>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" id="enviar">${esc(t('Enviar'))}</button>
    </form>`;
  } else if (bloqueo) {
    formulario = `<p class="muted">${esc(bloqueo)}</p>`;
  }

  pinta(`<p class="crumbs"><a href="${esc(ficha)}">${esc(b.name)}</a></p>
    <h1>${esc(EN ? `Ask ${nombre}` : `Pregúntale a ${nombre}`)}</h1>
    ${formulario}
    ${mias.length ? `<h2 class="seccion-t">${esc(t('Tus preguntas'))}</h2>
      <div class="avisos">${mias.map(filaPregunta).join('')}</div>` : ''}
    <p class="acciones"><a class="pill" href="${esc(ficha)}#preguntas">${esc(t('Volver a la ficha'))}</a></p>`);

  // Desde el aviso: la pregunta, a la vista.
  const destino = new URLSearchParams(location.hash.split('?')[1] || '').get('q');
  if (destino) document.getElementById(`pregunta-${destino}`)?.scrollIntoView({ block: 'center' });

  const f = $('#f');
  if (f) {
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const texto = f.elements.texto.value.trim().replace(/\s+/g, ' ');
      if (texto.length < 8) { $('#err').textContent = t(PREG_ERR.too_short); f.elements.texto.focus(); return; }
      $('#err').textContent = '';
      ocupado($('#enviar'), async () => {
        try {
          await llamar('ask_business_question', { p_business: id, p_text: texto });
        } catch (e) {
          $('#err').textContent = pregError(e);
          return;
        }
        toast(t('Pregunta enviada. Te avisaremos cuando conteste.'));
        RUTAS.preguntar([id]);
      });
    });
  }
  $$('[data-borrar]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!(await confirma({
      titulo: t('¿Borrar tu pregunta?'),
      texto: btn.dataset.respondida ? t('También se borra la respuesta, si la tiene.') : '',
      aceptar: t('Borrar'),
      peligro: true,
    }))) return;
    ocupado(btn, async () => {
      try {
        await llamar('delete_my_question', { p_id: btn.dataset.borrar });
        toast(t('Pregunta borrada'));
      } catch (e) {
        toast(pregError(e), true);
      }
      RUTAS.preguntar([id]);
    });
  }));
};
