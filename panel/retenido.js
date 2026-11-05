/* El Resumen del panel: lo retenido del negocio, arriba («Lo estamos revisando»,
 * assets/retenido.js). Solo para quien gestiona: el personal no lo puede ver. */
'use strict';

{
  const resumenSinRetenido = PAGES.resumen;
  PAGES.resumen = async (v, param) => {
    await resumenSinRetenido(v, param);
    if (!gestiona() || !window.KRetenido) return;
    const hueco = document.createElement('div');
    v.prepend(hueco);
    await KRetenido.pinta(sb, hueco, { negocio: BIZ.id, t: I18N.t, esc });
    I18N.translate?.(hueco);
  };
}
