import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { kidsPage } from '../_lib/explore.js';

// «Planes con niños en <ciudad>». La página la arma `_lib/explore.js`; la
// versión en el otro idioma vive en la ruta gemela (/en/kids/<city>/).

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('es', new URL(ctx.request.url).pathname, () => kidsPage(ctx.params.city, 'es'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
