import { configure } from '../../../_lib/page.js';
import { guard } from '../../../_lib/public.js';
import { storyPage } from '../../../_lib/historia.js';

// «Share to stories»: /en/story/o/<id>, /en/story/b/<business>,
// /en/story/c/<collection> (ver `_lib/historia.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('en', new URL(ctx.request.url).pathname, () => storyPage(ctx.params.kind, ctx.params.id, 'en'));
};

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
