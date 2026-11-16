import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { guiaPage } from '../../_lib/guias.js';

// Punto de entrada: la página de una guía de temporada la arma
// `_lib/guias.js`; aquí solo se dice cuál y en qué idioma. La gemela en el
// otro idioma vive en /guia/.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => guiaPage(ctx.params.slug, null, url, 'en', ctx.request));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
