import { configure } from '../../../_lib/page.js';
import { guard } from '../../../_lib/public.js';
import { stickerPage } from '../../../_lib/pegatina.js';

// La pegatina de escaparate (ver `_lib/pegatina.js`): ?modo=hoja|grande|imprenta, ?fondo=claro, ?lang=ca…
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => stickerPage(ctx.params.id, 'en', url.searchParams));
};

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
