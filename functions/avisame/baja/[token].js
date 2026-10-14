import { configure } from '../../_lib/page.js';
import { haceAvisame, preguntaAvisame } from '../../_lib/avisame.js';

// Borrarse de la lista de «Avísame cuando Klendar llegue» (el enlace de los
// correos): abrir el enlace solo pregunta; el botón (POST) borra, y también
// la «baja en un clic» de Gmail y Outlook. Ver _lib/avisame.js.

export function onRequestGet(ctx) {
  configure(ctx.env);
  return preguntaAvisame(ctx, 'baja');
}

export function onRequestPost(ctx) {
  configure(ctx.env);
  return haceAvisame(ctx, 'baja');
}

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
