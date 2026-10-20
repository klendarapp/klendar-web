import { configure, pickLang } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { ordersPublicPage } from '../_lib/listo.js';

// klendar.app/listo/<código>: el QR del «Cartel para el mostrador» (Te aviso
// cuando esté listo). Con la app instalada lo abre la app; si no, llega aquí.
// Va impresa, así que el idioma lo decide `?lang=` o el del navegador; la
// versión inglesa también vive en /en/ready/<código>. Ver `_lib/listo.js`.
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  const pedido = url.searchParams.get('lang');
  const lang = pedido === 'en' || pedido === 'es' ? pedido : pickLang(ctx.request);
  return guard(lang, url.pathname, () => ordersPublicPage(String(ctx.params.code || ''), lang));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
