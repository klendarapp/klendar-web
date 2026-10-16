import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { tablePosterPage } from '../../_lib/poster.js';

// Los carteles de mesa para imprimir (ver `_lib/poster.js`), cuatro por
// folio. `?mesas=12`: numerados del 1 al 12.
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('es', url.pathname, () => tablePosterPage(ctx.params.token, 'es', url.searchParams.get('mesas')));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
