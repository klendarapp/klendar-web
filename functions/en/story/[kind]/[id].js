import { configure } from '../../../_lib/page.js';
import { guard } from '../../../_lib/public.js';
import { storyPage } from '../../../_lib/historia.js';

// «Share to stories»: /en/story/o/<id>, /en/story/b/<business>,
// /en/story/c/<collection> (ver `_lib/historia.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  // `?rp=<código>`: desde la ficha abierta con el enlace de un RRPP.
  // `?para=whatsapp`: la misma imagen para el estado de WhatsApp.
  return guard('en', url.pathname, () => storyPage(ctx.params.kind, ctx.params.id, 'en', url.searchParams.get('rp') || '', url.searchParams.get('para') || ''));
};

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
