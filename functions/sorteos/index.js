import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { sorteosPage } from '../_lib/sorteos.js';

// Punto de entrada: la página la arma `_lib/sorteos.js`, aquí solo se dice
// cuál y en qué idioma. La versión en el otro idioma vive en la ruta gemela.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('es', url.pathname, () => sorteosPage(url, 'es'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
