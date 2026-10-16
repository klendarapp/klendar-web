import { configure } from '../_lib/page.js';
import { guard } from '../_lib/public.js';
import { tableQrPage } from '../_lib/mesa.js';

// klendar.app/m/<…> son dos QR distintos, por la forma del código:
//
// · <clave>.<ventana>.<firma> (con puntos): el QR de «Dar en el momento» que
//   enseña el negocio (cambia cada 30 s y vale 2 minutos). Con la app
//   instalada, el móvil lo abre en la app (App Link / enlace universal). Si
//   no, llega aquí y lo mandamos a «Tu cuenta» con el QR puesto: si ya ha
//   entrado, ve lo que le dan y «Aceptar»; si no, tras entrar
//   (app/momento.js).
// · 16 caracteres sin puntos: el QR de mesa (wifi, lo de hoy y la carta),
//   que se pinta aquí mismo (`_lib/mesa.js`). Con la app instalada, la abre.

const MOMENTO = /^[0-9a-f]{16}\.[0-9]{1,12}\.[0-9a-f]{12}$/;

export const onRequestGet = (ctx) => {
  const raw = String(ctx.params.token || '');
  // Sin puntos: un QR de mesa (uno mal escrito dice «Este código no existe»).
  if (!raw.includes('.')) {
    configure(ctx.env);
    return guard('es', new URL(ctx.request.url).pathname, () => tableQrPage(raw, 'es'));
  }
  const token = raw.toLowerCase();
  if (!MOMENTO.test(token)) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `/app/#/momento/${token}`, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
};

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
