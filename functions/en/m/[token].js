import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { tableQrPage } from '../../_lib/mesa.js';

// klendar.app/en/m/<code>: the table QR page in English (see `_lib/mesa.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => tableQrPage(String(ctx.params.token || ''), 'en'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
