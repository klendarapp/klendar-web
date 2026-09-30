import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { venuePosterPage } from '../../_lib/poster.js';

// El cartel del local para imprimir (ver `_lib/poster.js`). `?mesa=1`: cuatro
// por folio, para las mesas.
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('es', url.pathname, () => venuePosterPage(ctx.params.token, 'es', url.searchParams.get('mesa') === '1'));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
