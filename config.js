// A qué Supabase apunta la web. **Este es el único sitio donde se dice.**
//
// Ahora mismo, dev. Para pasar a producción se cambian estas dos líneas (o se
// define SUPABASE_URL y SUPABASE_KEY en las variables de Cloudflare Pages,
// que mandan sobre esto para las Functions: ver `functions/_lib/page.js`).
//
// La clave «publishable» es pública a propósito: es la misma que lleva la
// app y solo sirve para lo que las políticas de la base permiten. Aun así,
// dev y producción no se mezclan: cada una con la suya.
window.KLENDAR_ENV = {
  name: 'dev',
  url: 'https://dpbbtgwxrlqlplbrtjuq.supabase.co',
  key: 'sb_publishable_gNwxFIJGW_o_lGhv3si6IQ_35xHCq30',
};
