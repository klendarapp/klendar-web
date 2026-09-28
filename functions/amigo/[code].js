import { configure, pickLang } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { friendLinkPage } from '../_lib/views.js';

// klendar.app/amigo/<código>: el enlace de amigo que alguien comparte (el
// mismo que lleva su QR). Con la app instalada lo abre la app (App Link /
// enlace universal); si no, llega aquí. Es la dirección que se comparte, así
// que el idioma lo decide `?lang=en` o el del navegador; la versión inglesa
// también vive en /en/friend/<código>.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  const pedido = url.searchParams.get('lang');
  const lang = pedido === 'en' || pedido === 'es' ? pedido : pickLang(ctx.request);
  return guard(lang, url.pathname, () => friendLinkPage(String(ctx.params.code || ''), lang));
};
