// klendar.app/m/<clave>.<ventana>.<firma>: el QR de «Dar en el momento» que
// enseña el negocio (cambia cada 30 s y vale 2 minutos). Con la app
// instalada, el móvil lo abre en la app (App Link / enlace universal). Si no,
// llega aquí y lo mandamos a «Tu cuenta» con el QR puesto: si ya ha entrado,
// ve lo que le dan y «Aceptar»; si no, tras entrar (app/momento.js).

export const onRequestGet = (ctx) => {
  const token = String(ctx.params.token || '').toLowerCase();
  if (!/^[0-9a-f]{16}\.[0-9]{1,12}\.[0-9a-f]{12}$/.test(token)) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `/app/#/momento/${token}`, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
};

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
