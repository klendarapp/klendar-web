import { configure } from '../../_lib/page.js';
import { haceAvisame, preguntaAvisame } from '../../_lib/avisame.js';

// «Confirma tu correo» del correo de «Avísame cuando Klendar llegue»: abrir
// el enlace solo pregunta; el botón (POST) confirma. Ver _lib/avisame.js.

export function onRequestGet(ctx) {
  configure(ctx.env);
  return preguntaAvisame(ctx, 'confirmar');
}

export function onRequestPost(ctx) {
  configure(ctx.env);
  return haceAvisame(ctx, 'confirmar');
}

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
