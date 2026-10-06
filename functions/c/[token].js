// klendar.app/c/<clave>.<ventana>.<firma>: el QR de cliente (bonos pagados en
// el local). Lo normal es que el negocio lo lea con la app o con «Validar
// códigos» del panel, que no pasan por aquí. Si alguien del equipo lo
// escanea con la cámara del móvil o desde un ordenador, en vez de un «no
// existe» lo mandamos al panel web con el QR puesto: si ya ha entrado, ve los
// bonos de esa persona; si no, tras entrar. El QR caduca solo en 2 minutos.

export const onRequestGet = (ctx) => {
  const token = String(ctx.params.token || '').toLowerCase();
  if (!/^[0-9a-f]{16}\.[0-9]{1,12}\.[0-9a-f]{12}$/.test(token)) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: `/panel/#/validar?cliente=${token}`, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
};

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
