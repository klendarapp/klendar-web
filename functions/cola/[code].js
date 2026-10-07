import { configure, pickLang } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { queuePublicPage } from '../_lib/cola.js';

// klendar.app/cola/<código>: el QR del «Cartel para la puerta» (cola
// virtual). Con la app instalada lo abre la app (App Link / enlace
// universal); si no, llega aquí. Es la dirección que va impresa, así que el
// idioma lo decide `?lang=` o el del navegador; la versión inglesa también
// vive en /en/queue/<código>. Ver `_lib/cola.js`.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  const pedido = url.searchParams.get('lang');
  const lang = pedido === 'en' || pedido === 'es' ? pedido : pickLang(ctx.request);
  return guard(lang, url.pathname, () => queuePublicPage(String(ctx.params.code || ''), lang));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
