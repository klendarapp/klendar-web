// klendar.app/tv/enlazar/<código>: el QR que enseña la tele mientras espera
// a que la enlacen («Klendar en la tele del local», /tv/). Con la app
// instalada, Android la abre en la app (App Link: «Poner en la tele» con el
// código ya escrito); si no, llega aquí y lleva al panel del negocio en la
// web, a la misma pantalla. El código no sirve de nada sin una sesión de
// propietario o encargado.

export const onRequestGet = (ctx) => {
  const code = String(ctx.params.code || '').replace(/\D/g, '');
  const destino = /^\d{6}$/.test(code) ? `/panel/#/tele?codigo=${code}` : '/panel/#/tele';
  return new Response(null, {
    status: 302,
    headers: { Location: destino, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
};

export const onRequestHead = onRequestGet;
