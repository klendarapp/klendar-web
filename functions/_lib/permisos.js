// La cabecera `Permissions-Policy` de lo que pintan las Functions (la pone
// functions/_middleware.js; tools/serve_dev.mjs, la misma en local para que
// las pruebas vean lo de producción). Lo estático lleva la suya en `_headers`.
//
// La ubicación solo la puede usar klendar.app misma (`(self)`: ningún iframe
// ni script de otro sitio; además nada se deja enmarcar, X-Frame-Options), y
// solo donde hace falta:
//  - Explorar, Descubre, Partidos, Grupos, Sorteos y las guías: «Cerca de mí»
//    al pulsarlo y, con el permiso ya dado, sola al abrir (RUNBOOK
//    §4zzz-ubicacion-web y §4zzz-ubicacion-web2);
//  - la ficha de un negocio (`/b/`): el sello por visita desde el QR del
//    local y «Estaba cerrado» (que manda la posición si el permiso ya está
//    dado, para comprobar que estás cerca; nunca lo pide). Antes, solo con
//    `?visita=`, y la web no comprobaba nunca lo de «Estaba cerrado» (Iván,
//    25-11);
//  - «Tu cuenta» y el panel.
// La cámara, solo el panel (validar códigos).
const CON_UBICACION = /^\/(en\/)?b\/|^\/(explorar|descubre|partidos|grupos|sorteos|guia|en\/explore|en\/discover|en\/matches|en\/groups|en\/giveaways|en\/guide|cuenta|panel)(\/|$)/;

export const ubicacionPermitida = (pathname) => CON_UBICACION.test(pathname);

export function politicaPermisos(pathname) {
  return `geolocation=${ubicacionPermitida(pathname) ? '(self)' : '()'}, camera=${/^\/panel(\/|$)/.test(pathname) ? '(self)' : '()'}, microphone=()`;
}
