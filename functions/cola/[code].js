import { configure, pickLang } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { queuePublicPage, queueScreenPage } from '../_lib/cola.js';

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
  // `?pantalla=1`: la pantalla de la puerta (tele o tablet), no la página.
  if (url.searchParams.has('pantalla')) return guard(lang, url.pathname, () => queueScreenPage(String(ctx.params.code || ''), lang));
  return guard(lang, url.pathname, () => queuePublicPage(String(ctx.params.code || ''), lang));
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
