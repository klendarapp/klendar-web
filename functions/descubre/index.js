import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { explorePage } from '../_lib/explore.js';

// Descubre: el feed de tarjetas grandes (la pestaña 1 de la app). La página
// la arma `_lib/explore.js`; la versión inglesa vive en /en/discover/.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('es', new URL(ctx.request.url).pathname, () => explorePage(new URL(ctx.request.url), 'es', 'descubre'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
