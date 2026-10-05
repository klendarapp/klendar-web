// /en/kids/ without a city: the “Plans with kids” selection for every city.
export const onRequestGet = () => new Response(null, {
  status: 301, headers: { location: '/en/collection/con-ninos/', 'cache-control': 'public, max-age=86400' },
});

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
