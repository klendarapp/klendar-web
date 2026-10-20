import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { ordersPublicPage } from '../../_lib/listo.js';

// klendar.app/en/ready/<code>: the ready alert page in English (see
// `functions/listo/[code].js` and `_lib/listo.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => ordersPublicPage(String(ctx.params.code || ''), 'en'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
