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
    const permiso = document.createElement('div');
    v.prepend(permiso);
    await KRetenido.permiso(sb, permiso, { t: I18N.t, esc });
    await KRetenido.pinta(sb, hueco, { negocio: BIZ.id, t: I18N.t, esc });
    I18N.translate?.(hueco);
  };
}
