import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { posterPage } from '../_lib/poster.js';

// El cartel para imprimir de una publicación (ver `_lib/poster.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('es', new URL(ctx.request.url).pathname, () => posterPage(ctx.params.id, 'es'));
};
