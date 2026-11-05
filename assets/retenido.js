/* «Lo estamos revisando»: lo que has subido y el filtro ha retenido, con el
 * original (un enlace firmado que solo sirve a quien lo subió). Para el panel y
 * «Tu cuenta» (klendar/docs/FILTRO_MEDIOS.md). Si no hay nada o algo falla, no se ve.
 *
 *   KRetenido.pinta(sb, contenedor, { negocio, t, esc })
 *
 * Y el permiso para mandar lo que se publica a una IA de terceros (Apple 5.1.2(i), Google
 * Play Datos de usuario): si hace falta, una tarjeta con Aceptar y Ahora no. Sin él, nada de
 * esa persona sale a un tercero: textos, las listas de siempre; fotos, las mira una persona.
 *
 *   KRetenido.permiso(sb, contenedor, { t, esc })
 */
'use strict';

(function () {
  async function pinta(sb, contenedor, { negocio = null, t, esc }) {
    if (!contenedor) return;
    try {
      const { data, error } = await sb.rpc('my_held_media', negocio ? { p_business: negocio } : {});
      if (error || !Array.isArray(data) || !data.length) return;
      const firma = async (x) => {
        if (!x.in_held || x.kind === 'video') return '';
        const r = await sb.storage.from('media-held').createSignedUrl(x.name, 600);
        return r.data?.signedUrl || '';
      };
      const conFoto = await Promise.all(data.slice(0, 12).map(async (x) => ({ ...x, src: await firma(x) })));
      const revisando = conFoto.filter((x) => x.state === 'held');
      const fuera = conFoto.filter((x) => x.state === 'rejected');
      const miniatura = (x) => (x.src
        ? `<img src="${esc(x.src)}" alt="" loading="lazy">`
        : '<span class="retenido-video" aria-hidden="true"></span>');
      const bloque = (lista, titulo, texto) => (lista.length
        ? `<div class="retenido-bloque"><b>${esc(t(titulo))}</b><p>${esc(t(texto))}</p>
            <div class="retenido-fotos">${lista.map(miniatura).join('')}</div></div>`
        : '');
      contenedor.innerHTML = `<section class="retenido">
        ${bloque(revisando, 'Lo estamos revisando', 'Mientras tanto no se publica y solo lo ves tú. No tienes que hacer nada: te avisamos en cuanto esté.')}
        ${bloque(fuera, 'No se ha publicado', 'Te hemos contado el motivo en un aviso. Si crees que es un error, escríbenos a info@klendar.app en un plazo de 6 meses.')}
      </section>`;
    } catch { /* si falla, no se ve */ }
  }
  async function permiso(sb, contenedor, { t, esc }) {
    if (!contenedor) return;
    try {
      const { data, error } = await sb.rpc('ai_consent_needed');
      if (error || data !== true) return;
      let visto = false;
      try { visto = sessionStorage.getItem('klendar.ia.ahora_no') === '1'; } catch { /* sin almacenamiento */ }
      if (visto) return;
      contenedor.innerHTML = `<section class="retenido" role="group" aria-labelledby="ia-permiso-t">
        <b id="ia-permiso-t">${esc(t('¿Revisamos lo que publicas con IA?'))}</b>
        <p>${esc(t('Antes de publicarse, lo que escribes y las fotos que subes (y unos fotogramas de tus vídeos) los analiza un servicio de IA de otra empresa, Google Cloud, para filtrar lo que no permiten las Normas de la comunidad. No se usa para entrenar a la IA.'))}</p>
        <p>${esc(t('Si prefieres que no, lo revisará una persona del equipo y tus fotos pueden tardar más en publicarse. Puedes cambiarlo cuando quieras.'))} <a href="/privacidad/" target="_blank" rel="noopener">${esc(t('Más información'))}</a></p>
        <div class="retenido-botones"><button type="button" class="pill accent" data-ia="si">${esc(t('Acepto'))}</button>
        <button type="button" class="pill" data-ia="no">${esc(t('Ahora no'))}</button></div>
      </section>`;
      contenedor.querySelector('[data-ia="si"]').onclick = async () => {
        await sb.rpc('set_ai_consent', { p_granted: true });
        contenedor.innerHTML = '';
      };
      contenedor.querySelector('[data-ia="no"]').onclick = () => {
        try { sessionStorage.setItem('klendar.ia.ahora_no', '1'); } catch { /* sin almacenamiento */ }
        contenedor.innerHTML = '';
      };
    } catch { /* si falla, no se ve */ }
  }
  globalThis.KRetenido = { pinta, permiso };
})();
