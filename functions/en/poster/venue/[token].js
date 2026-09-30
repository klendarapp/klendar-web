import { configure } from '../../../_lib/page.js';
import { guard } from '../../../_lib/public.js';
import { venuePosterPage } from '../../../_lib/poster.js';

// Printable venue poster (see `_lib/poster.js`). `?mesa=1`: four per sheet,
// for the tables.
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => venuePosterPage(ctx.params.token, 'en', url.searchParams.get('mesa') === '1'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
