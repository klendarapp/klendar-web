import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { storyPage } from '../../_lib/historia.js';

// «Compartir en historias»: /historia/o/<id>, /historia/b/<negocio>,
// /historia/c/<colección> (ver `_lib/historia.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('es', new URL(ctx.request.url).pathname, () => storyPage(ctx.params.kind, ctx.params.id, 'es'));
};

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
