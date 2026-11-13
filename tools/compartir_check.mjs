// Compartir: la vista previa que sacan WhatsApp, Telegram, X o el correo de
// una oferta, un evento, un negocio o un artista (Open Graph y Twitter), con
// datos de mentira (tools/_web_con_datos.mjs; no toca Supabase).
//
//  - og:title, og:description, og:image (https), og:url canónica sin barra,
//    og:locale, og:type y twitter:card grande en cada ficha;
//  - sin foto propia: la portada o el logo del negocio y, si tampoco hay, la
//    tarjeta de Klendar con su tamaño (1200 × 630);
//  - una página que no existe sigue con noindex.
//
//   node tools/compartir_check.mjs
import { DATOS, webConDatos } from './_web_con_datos.mjs';

let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };
const meta = (h, k) => (h.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`)) || [])[1];

const conFoto = DATOS.PLANES.find((p) => (p.images || []).length && p.kind === 'flash_offer');
const sinFoto = { ...conFoto, id: 'a9000000-0000-4000-8000-0000000009a1', images: [], business_cover: 'https://cdn.example.test/portada.jpg' };
const nada = { ...conFoto, id: 'a9000000-0000-4000-8000-0000000009a2', images: [], business_cover: null, business_logo: null };
const negocio = DATOS.NEGOCIOS[0];

const web = await webConDatos({
  puerto: Number(process.env.PORT || 8940),
  datos: { ...DATOS, PLANES: [...DATOS.PLANES, sinFoto, nada] },
});
const pide = async (ruta) => { const r = await fetch(`${web.BASE}${ruta}`, { redirect: 'manual' }); return { st: r.status, h: await r.text() }; };

try {
  for (const [ruta, que] of [[`/o/${conFoto.id}`, 'oferta'], [`/en/o/${conFoto.id}`, 'oferta (EN)'], [`/b/${negocio.slug}`, 'negocio']]) {
    const { st, h } = await pide(ruta);
    ok(st === 200, `${que}: 200`, String(st));
    for (const k of ['og:title', 'og:description', 'og:image', 'og:url', 'og:locale', 'og:type', 'og:image:alt', 'twitter:image']) ok(!!meta(h, k), `${que}: ${k}`);
    ok(/^https:\/\//.test(meta(h, 'og:image') || ''), `${que}: og:image con https`, meta(h, 'og:image'));
    ok(!/\/$/.test(meta(h, 'og:url') || '/'), `${que}: og:url sin barra final`, meta(h, 'og:url'));
    ok(meta(h, 'twitter:card') === 'summary_large_image', `${que}: tarjeta grande en X`);
  }
  const o = (await pide(`/o/${conFoto.id}`)).h;
  ok(meta(o, 'og:image') === conFoto.images[0], 'oferta: su foto', meta(o, 'og:image'));
  ok(meta(o, 'og:description').includes(conFoto.business_name), 'oferta: el negocio en la descripción', meta(o, 'og:description'));
  ok(meta(o, 'og:locale') === 'es_ES' && meta((await pide(`/en/o/${conFoto.id}`)).h, 'og:locale') === 'en_GB', 'og:locale por idioma');

  const s = (await pide(`/o/${sinFoto.id}`)).h;
  ok(meta(s, 'og:image') === sinFoto.business_cover, 'sin foto: la portada del negocio', meta(s, 'og:image'));
  ok(!meta(s, 'og:image:width'), 'foto ajena: sin tamaño inventado');

  const n = (await pide(`/o/${nada.id}`)).h;
  ok(/\/assets\/og\.png$/.test(meta(n, 'og:image') || ''), 'sin nada: la tarjeta de Klendar', meta(n, 'og:image'));
  ok(meta(n, 'og:image:width') === '1200' && meta(n, 'og:image:height') === '630', 'la tarjeta con su tamaño');

  const x = await pide('/o/00000000-0000-4000-8000-000000000000');
  ok(x.st === 404 && /<meta name="robots" content="noindex/.test(x.h), 'la que no existe: 404 y noindex');
} finally {
  await web.cierra();
}
console.log(fallos ? `${fallos} fallos` : 'todo bien');
process.exit(fallos ? 1 : 0);
