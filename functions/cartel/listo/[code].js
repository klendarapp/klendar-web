import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { ordersPosterPage } from '../../_lib/poster.js';

// El «Cartel para el mostrador» de «Te aviso cuando esté listo», para
// imprimir (ver `_lib/poster.js`). Solo A4.
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('es', url.pathname, () => ordersPosterPage(ctx.params.code, 'es'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
