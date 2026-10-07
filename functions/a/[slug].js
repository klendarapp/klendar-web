import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { artistaPage } from '../_lib/artistas.js';

// Punto de entrada: la página de un artista la arma `_lib/artistas.js`; aquí
// solo se dice cuál y en qué idioma. La versión inglesa vive en /en/a/.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('es', url.pathname, () => artistaPage(ctx.params.slug, url, 'es'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
