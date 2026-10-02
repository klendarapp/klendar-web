import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { explorePage } from '../../_lib/explore.js';

// Descubre: el feed de tarjetas grandes (la pestaña 1 de la app). La página
// la arma `_lib/explore.js`; la española vive en /descubre/.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('en', new URL(ctx.request.url).pathname, () => explorePage(new URL(ctx.request.url), 'en', 'descubre'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
