import { configure, pickLang } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { promoterLinkPage } from '../_lib/rrpp.js';

// klendar.app/rp/<código>: el enlace (y el QR) de un RRPP. Con la app
// instalada lo abre la app (App Link / enlace universal); si no, llega aquí.
// Es la dirección que se comparte, así que el idioma lo decide `?lang=en` o
// el del navegador; la versión inglesa también vive en /en/rp/<código>.
// `/r/<código>` es otra cosa: el QR de un canje.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  const pedido = url.searchParams.get('lang');
  const lang = pedido === 'en' || pedido === 'es' ? pedido : pickLang(ctx.request);
  return guard(lang, url.pathname, () => promoterLinkPage(String(ctx.params.code || ''), lang));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
