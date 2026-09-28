// /hoy/ sin ciudad: la lista de ciudades, que ya enlaza con el «hoy» de cada una.
export const onRequestGet = () => new Response(null, {
  status: 301, headers: { location: '/agenda/', 'cache-control': 'public, max-age=86400' },
});
