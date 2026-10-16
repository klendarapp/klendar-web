import { configure } from '../../../_lib/page.js';
import { guard } from '../../../_lib/public.js';
import { tablePosterPage } from '../../../_lib/poster.js';

// Printable table cards (see `_lib/poster.js`), four per sheet. `?mesas=12`:
// numbered 1 to 12.
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => tablePosterPage(ctx.params.token, 'en', url.searchParams.get('mesas')));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
