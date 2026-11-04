// A qué Supabase apunta la web. **Este es el único sitio donde se dice.**
//
// Ahora mismo, producción. Para cambiar de proyecto se cambian estas dos líneas (o se
// define SUPABASE_URL y SUPABASE_KEY en las variables de Cloudflare Pages,
// que mandan sobre esto para las Functions: ver `functions/_lib/page.js`).
//
// La clave «publishable» es pública a propósito: es la misma que lleva la
// app y solo sirve para lo que las políticas de la base permiten. Aun así,
// dev y producción no se mezclan: cada una con la suya.
window.KLENDAR_ENV = {
  name: 'prod',
  url: 'https://hcxurneiftwyxuebpndf.supabase.co',
  key: 'sb_publishable_k8KYqQGIYsoI38kZzaeK3A_vPJ0PdJK',
  // Clave pública de Cloudflare Turnstile (anti-robots al entrar). Vacía en
  // dev: las pruebas automáticas entran solas. En producción, la del widget
  // de klendar.app (y en Supabase prod, Attack Protection con su secreto).
  turnstile: '0x4AAAAAAFWncxVLRe_mMojg',
};
