import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { offerPage } from '../_lib/views.js';

// Punto de entrada: la página la arma `_lib/views.js`, aquí solo se dice
// cuál y en qué idioma. La versión en el otro idioma vive en la ruta gemela.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  // `?rp=<código>`: abierta desde el enlace de un RRPP (ver _lib/rrpp.js).
  return guard('es', url.pathname, () => offerPage(ctx.params.id, 'es', url.searchParams.get('rp') || ''));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
