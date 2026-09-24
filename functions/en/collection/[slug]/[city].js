import { configure } from '../../../_lib/page.js';
import { collectionPage } from '../../../_lib/explore.js';

// Punto de entrada: la pagina la arma `_lib/explore.js`, aqui solo se dice
// cual y en que idioma. La version en el otro idioma vive en la ruta gemela.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return collectionPage(ctx.params.slug, ctx.params.city, 'en');
};
