import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { explorePage } from '../../_lib/explore.js';

// Punto de entrada: la pagina la arma `_lib/explore.js`, aqui solo se dice
// cual y en que idioma. La version en el otro idioma vive en la ruta gemela.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('en', new URL(ctx.request.url).pathname, () => explorePage(new URL(ctx.request.url), 'en'));
};
