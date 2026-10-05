// /con-ninos/ sin ciudad: la selección «Planes con niños» de todas las ciudades.
export const onRequestGet = () => new Response(null, {
  status: 301, headers: { location: '/coleccion/con-ninos/', 'cache-control': 'public, max-age=86400' },
});

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
