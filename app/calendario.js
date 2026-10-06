/* «Tu cuenta» → Ajustes → «Tus planes en tu calendario» (#/ajustes/calendario).
 *
 * Igual que la app (CalendarFeedScreen): un enlace secreto de suscripción
 * (`https://klendar.app/cal/<token>.ics`, Pages Function `functions/cal/`)
 * para Google Calendar, Apple o cualquier calendario que lea .ics. Se crea
 * al pulsar el primer botón; se puede cambiar (el viejo deja de funcionar)
 * y desactivar. Funciones de la base: `my_calendar_feed`,
 * `enable_calendar_feed`, `regenerate_calendar_feed`,
 * `disable_calendar_feed` (migración 20261120100001 de la app).
 *
 * Va después de cuenta.js y usa lo de app.js (`RUTAS`, `llamar`, `pinta`,
 * `t`, `esc`, `ic`, `fila`, `toast`, `confirma`, `exigeSesion`, `LOC`…).
 */
'use strict';

/** Iconos que no están en la fuente recortada de «Tu cuenta» (Material
 * Symbols, Apache 2.0), en SVG: calendario y ayuda. */
const ICONO_SVG = {
  calendario: 'M438-226 296-368l58-58 84 84 168-168 58 58-226 226ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z',
  ayuda: 'M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm-36-154h74q0-33 7.5-52t42.5-52q26-26 41-49.5t15-56.5q0-56-41-86t-97-30q-57 0-92.5 30T342-618l66 26q5-18 22.5-39t53.5-21q32 0 48 17.5t16 38.5q0 20-12 37.5T506-526q-44 39-54 59t-10 73Zm38 314q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z',
};
const icSvg = (n) => `<svg class="ms-svg" viewBox="0 -960 960 960" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="${ICONO_SVG[n]}"/></svg>`;

/** Una fila como `fila()`, con un icono SVG. */
const filaSvg = ({ href, icono, titulo, detalle }) => `
  <a class="fila" href="${esc(href)}">
    ${icSvg(icono)}
    <span class="fila-t"><b>${esc(titulo)}</b>${detalle ? `<small>${esc(detalle)}</small>` : ''}</span>
    ${ic('chevron_right')}
  </a>`;

const enlacesCalendario = (token) => {
  const https = `${location.origin.includes('localhost') ? 'https://klendar.app' : location.origin}/cal/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, 'webcal://');
  return { https, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
};

async function ajustesCalendario() {
  if (!exigeSesion('ajustes/calendario')) return;
  let feed = await llamar('my_calendar_feed', {});
  const usado = (f) => (f?.last_used_at
    ? t('Tu calendario lo consultó por última vez el {when}.').replace('{when}',
      new Intl.DateTimeFormat(LOC, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(f.last_used_at)))
    : t('Ningún calendario lo ha consultado todavía.'));

  const dibuja = () => {
    pinta(`
      <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a> › <a href="#/ajustes">${esc(t('Ajustes'))}</a></p>
      <h1>${esc(t('Tus planes en tu calendario'))}</h1>
      <p>${esc(t('Lo que tienes en Planes, en el calendario de tu móvil y al día: eventos a los que vas, reservas, códigos con hora y las fechas que añaden las series que sigues. Si algo se anula, desaparece; si cambia la hora, se mueve.'))}</p>
      <h2 class="seccion-t">${esc(t('Añádelo a tu calendario'))}</h2>
      <div class="botones-cal">
        <button type="button" class="pill ancho-cal" data-cal="google">${ic('open_in_new')} ${esc(t('Google Calendar'))}</button>
        <button type="button" class="pill ancho-cal" data-cal="apple">${ic('smartphone')} ${esc(t('Apple / iPhone'))}</button>
        <button type="button" class="pill ancho-cal" data-cal="copiar">${ic('content_copy')} ${esc(t('Copiar enlace'))}</button>
      </div>
      <p class="muted nota-cal">${esc(t('Google Calendar puede tardar unas horas en mostrar los cambios.'))}</p>
      <p class="muted nota-cal">${esc(t('Quien tenga el enlace ve tus planes. No lo compartas; si se te escapa, cámbialo.'))}</p>
      ${feed ? `
        <h2 class="seccion-t">${esc(t('Tu enlace'))}</h2>
        <p class="muted">${esc(usado(feed))}</p>
        <div class="lista">
          <button type="button" class="fila fila-btn" id="cal-cambiar">${ic('refresh')}
            <span class="fila-t"><b>${esc(t('Cambiar el enlace'))}</b><small>${esc(t('El de ahora deja de funcionar'))}</small></span></button>
          <button type="button" class="fila fila-btn peligro-t" id="cal-quitar">${ic('block')}
            <span class="fila-t"><b>${esc(t('Desactivar'))}</b><small>${esc(t('Tu calendario deja de recibir tus planes'))}</small></span></button>
        </div>` : ''}`);
    I18N.translate(view);

    $$('[data-cal]').forEach((b) => {
      b.onclick = async () => {
        const botones = $$('[data-cal]');
        botones.forEach((x) => { x.disabled = true; });
        try {
          if (!feed) feed = await llamar('enable_calendar_feed', {});
          const e = enlacesCalendario(feed.token);
          if (b.dataset.cal === 'copiar') {
            await navigator.clipboard.writeText(e.https);
            toast(t('Enlace copiado. En tu calendario, pégalo en «Suscribirse» o «Desde URL».'));
          } else if (b.dataset.cal === 'google') {
            window.open(e.google, '_blank', 'noopener');
          } else {
            location.href = e.webcal;
          }
          dibuja();
        } catch (err) {
          // El portapapeles puede negarse (permiso del navegador): su mensaje
          // viene en inglés y crudo. Si el enlace ya se creó, se pinta igual
          // para que se pueda copiar a mano o cambiar.
          const portapapeles = err && (err.name === 'NotAllowedError' || /clipboard/i.test(err.message || ''));
          toast(portapapeles ? t('No se ha podido copiar') : (err.message || t('No se ha podido copiar')), true);
          if (feed) dibuja();
          else botones.forEach((x) => { x.disabled = false; });
        }
      };
    });
    const cambiar = $('#cal-cambiar');
    if (cambiar) {
      cambiar.onclick = async () => {
        if (!(await confirma({
          titulo: t('¿Cambiar el enlace?'),
          texto: t('El enlace de ahora deja de funcionar y el calendario donde lo añadiste se quedará sin tus planes. Después, añade el nuevo.'),
          aceptar: t('Cambiar'),
        }))) return;
        try {
          feed = await llamar('regenerate_calendar_feed', {});
          toast(t('Enlace cambiado. Añade el nuevo a tu calendario.'));
          dibuja();
        } catch (err) { toast(err.message, true); }
      };
      $('#cal-quitar').onclick = async () => {
        if (!(await confirma({
          titulo: t('¿Desactivar el enlace?'),
          texto: t('Tu calendario dejará de recibir tus planes. Puedes volver a activarlo cuando quieras, con un enlace nuevo.'),
          aceptar: t('Desactivar'),
          peligro: true,
        }))) return;
        try {
          await llamar('disable_calendar_feed', {});
          feed = null;
          toast(t('Enlace desactivado.'));
          dibuja();
        } catch (err) { toast(err.message, true); }
      };
    }
  };
  dibuja();
}
