// /hoy/ sin ciudad: la lista de ciudades, que ya enlaza con el «hoy» de cada una.
export const onRequestGet = () => new Response(null, {
  status: 301, headers: { location: '/agenda/', 'cache-control': 'public, max-age=86400' },
});

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
