// klendar.app/r/<código>: la dirección que va dentro del QR de cada canje.
//
// Lo normal es que el negocio lo lea con la app (que valida sin pasar por
// aquí). Si lo escanea con la cámara del móvil o desde un ordenador, en vez de
// un «no existe» lo mandamos al panel web, a «Validar códigos», con el código
// ya puesto: si ya ha entrado, se valida al momento; si no, tras entrar.

export const onRequestGet = (ctx) => {
  const code = String(ctx.params.code || '');
  if (!/^[0-9a-f]{8,64}$/i.test(code)) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }
  // Relativa: se queda en el mismo sitio (klendar.app o el de pruebas).
  return new Response(null, {
    status: 302,
    headers: { Location: `/panel/#/validar?code=${code}`, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
};
