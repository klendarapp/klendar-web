import { configure } from '../../../_lib/page.js';
import { guard } from '../../../_lib/public.js';
import { ordersPosterPage } from '../../../_lib/poster.js';

// Printable “Poster for the counter” of the ready alert (see
// `_lib/poster.js`). A4 only.
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => ordersPosterPage(ctx.params.code, 'en'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
