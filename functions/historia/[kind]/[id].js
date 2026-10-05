import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { storyPage } from '../../_lib/historia.js';

// «Compartir en historias»: /historia/o/<id>, /historia/b/<negocio>,
// /historia/c/<colección> (ver `_lib/historia.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  // `?rp=<código>`: desde la ficha abierta con el enlace de un RRPP.
  return guard('es', url.pathname, () => storyPage(ctx.params.kind, ctx.params.id, 'es', url.searchParams.get('rp') || ''));
};

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
