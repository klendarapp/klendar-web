import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { businessPage } from '../_lib/views.js';

// Punto de entrada: la página la arma `_lib/views.js`, aquí solo se dice
// cuál y en qué idioma. La versión en el otro idioma vive en la ruta gemela.
// `id` es el id del negocio o su dirección con nombre (`cafe-central-madrid`):
// con el id se redirige (301) a la de la dirección.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('es', url.pathname, () => businessPage(ctx.params.id, 'es', url.search));
};
