import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { posterPage } from '../_lib/poster.js';

// El cartel para imprimir de una publicación (ver `_lib/poster.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  // `?rp=<código>`: desde la ficha abierta con el enlace de un RRPP.
  return guard('es', url.pathname, () => posterPage(ctx.params.id, 'es', url.searchParams.get('rp') || ''));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
