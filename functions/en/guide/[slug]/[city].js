import { configure } from '../../../_lib/page.js';
import { guard } from '../../../_lib/public.js';
import { guiaPage } from '../../../_lib/guias.js';

// Una guía en un municipio («Navidad en Málaga»): la arma `_lib/guias.js`.
// Sin planes en ese municipio, 404 con noindex.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => guiaPage(ctx.params.slug, ctx.params.city, url, 'en', ctx.request));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
