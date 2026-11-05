/* «Lo estamos revisando»: lo que has subido y el filtro ha retenido, con el
 * original (un enlace firmado que solo sirve a quien lo subió). Para el panel y
 * «Tu cuenta» (klendar/docs/FILTRO_MEDIOS.md). Si no hay nada o algo falla, no se ve.
 *
 *   KRetenido.pinta(sb, contenedor, { negocio, t, esc })
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
  globalThis.KRetenido = { pinta };
})();
