import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { queuePublicPage } from '../../_lib/cola.js';

// klendar.app/en/queue/<code>: the virtual queue page in English (see
// `functions/cola/[code].js` and `_lib/cola.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => queuePublicPage(String(ctx.params.code || ''), 'en'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
