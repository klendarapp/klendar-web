// La ficha sin repetir y un solo «Compartir» (propuestas de la revisión de
// la persona usuaria, aprobadas por Iván el 20-11), con datos de mentira
// (tools/_web_con_datos.mjs; no toca Supabase):
//
//  - ficha de una oferta: la tarjeta, solo con los botones (sin la caja de
//    «Se canjea / Dónde / Plazas libres»); la fecha, las plazas, la cuenta
//    atrás y «Por orden de llegada», una vez, arriba; sin «El negocio» abajo
//    (ya está la fila del negocio);
//  - un solo «Compartir» que abre «Invitar a un amigo», «Compartir enlace» y
//    «Compartir en historias» (en la del negocio, sin invitar); sin los
//    botones sueltos de antes;
//  - reseñas de la ficha del negocio: si la lista no llega, un aviso discreto
//    con «Reintentar» (y la página sin caché); si llega vacía con nota, nada;
//    nunca «Todavía no hay reseñas» con «★ 4,5 (12)».
//
//   node tools/ficha_una_vez_check.mjs
import { DATOS, webConDatos } from './_web_con_datos.mjs';

let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };

const flash = DATOS.PLANES.find((p) => p.title === 'Cañas 2x1');
const evento = DATOS.PLANES.find((p) => p.title === 'Monólogos');
const llegada = { ...flash, id: 'a9000000-0000-4000-8000-0000000009b1', title: 'Sin guardar sitio', holds_seats: false };
const [conNota, falla, sinNota] = [DATOS.NEGOCIOS[0], DATOS.NEGOCIOS[3], { ...DATOS.NEGOCIOS[1], rating: null, ratings: 0 }];

const web = await webConDatos({
  puerto: Number(process.env.PORT || 8960),
  datos: {
    ...DATOS,
    PLANES: [...DATOS.PLANES, llegada],
    NEGOCIOS: DATOS.NEGOCIOS.map((b) => (b.id === sinNota.id ? sinNota : b)),
  },
  rpc: {
    business_reviews: (a) => {
      if (a.p_id === falla.id) throw new Error('la base no contesta');
      return [];
    },
  },
});
const pide = async (ruta) => { const r = await fetch(`${web.BASE}${ruta}`, { redirect: 'manual' }); return { st: r.status, h: await r.text(), cc: r.headers.get('cache-control') || '' }; };
const lado = (h) => (h.match(/<aside class="side">([\s\S]*?)<\/aside>/) || [])[1] || '';
const cuerpo = (h) => (h.match(/<div class="d-body">([\s\S]*?)<\/div>\s*<\/div>/) || [])[1] || '';
const cabeza = (h) => (h.match(/<div class="d-head">([\s\S]*?)<\/div>\s*<aside/) || [])[1] || '';
const cuantos = (h, re) => (h.match(re) || []).length;

try {
  for (const [ruta, que, en] of [[`/o/${flash.id}`, 'oferta', false], [`/en/o/${flash.id}`, 'oferta (EN)', true], [`/o/${evento.id}`, 'evento', false]]) {
    const { st, h } = await pide(ruta);
    ok(st === 200, `${que}: 200`, String(st));
    const side = lado(h);
    ok(!/<dl>/.test(side), `${que}: la tarjeta sin la caja de datos`);
    ok(!/Se canjea|Plazas libres|Redemption window|Places left/.test(side), `${que}: sin «Se canjea» ni «Plazas libres»`);
    ok(!/<h2>(El negocio|The business|Quién lo organiza|Who organises it)<\/h2>/.test(cuerpo(h)), `${que}: sin «El negocio» abajo`);
    ok(cuantos(h, /<details class="mas-menu toque compartir">/g) === 1, `${que}: un solo «Compartir»`);
    ok(cuantos(h, /data-compartir=/g) === 1, `${que}: «Compartir enlace» dentro del menú`);
    const menu = (h.match(/<details class="mas-menu toque compartir">([\s\S]*?)<\/details>/) || [])[1] || '';
    ok(menu.includes(en ? 'Invite a friend' : 'Invitar a un amigo') && menu.includes('/invitar/'), `${que}: «Invitar a un amigo» en el menú`);
    ok(menu.includes(en ? 'Share to stories' : 'Compartir en historias') && menu.includes(en ? '/en/story/o/' : '/historia/o/'), `${que}: «Compartir en historias» en el menú`);
    ok(cuantos(h, en ? /Invite a friend/g : /Invitar a un amigo/g) === 1, `${que}: «Invitar a un amigo» una vez`);
    ok(cuantos(h, en ? /Share to stories/g : /Compartir en historias/g) === 1, `${que}: «Compartir en historias» una vez`);
  }
  const f = (await pide(`/o/${flash.id}`)).h;
  ok(/<span class="dato-chip cuenta" id="cuenta" hidden/.test(cabeza(f)), 'oferta: la cuenta atrás, arriba con los datos');
  ok(cuantos(f, /Quedan 20 plazas|>20</g) === 1, 'oferta: las plazas, una vez');
  ok(cuantos(f, /<h2>Dónde<\/h2>/g) === 1 && !/Dónde<\/dt>/.test(f), 'oferta: «Dónde», una vez');
  const l = (await pide(`/o/${llegada.id}`)).h;
  ok(/<span class="dato-chip">Por orden de llegada<\/span>/.test(cabeza(l)), 'oferta: «Por orden de llegada», arriba');

  const n = await pide(`/b/${conNota.slug}`);
  ok(n.st === 200, 'negocio: 200', String(n.st));
  ok(cuantos(n.h, /<details class="mas-menu toque compartir">/g) === 1, 'negocio: un solo «Compartir»');
  const menuN = (n.h.match(/<details class="mas-menu toque compartir">([\s\S]*?)<\/details>/) || [])[1] || '';
  ok(menuN.includes('data-compartir') && menuN.includes('/historia/b/') && !menuN.includes('/invitar/'), 'negocio: enlace e historias, sin invitar');
  ok(cuantos(n.h, /Compartir en historias/g) === 1, 'negocio: «Compartir en historias» una vez');
  ok(!/Todavía no hay reseñas/.test(n.h), 'negocio con nota y la lista vacía: sin «Todavía no hay reseñas»');
  ok(!/No se han podido cargar las reseñas/.test(n.h), 'negocio con la lista vacía: tampoco el aviso de error');

  const x = await pide(`/b/${falla.slug}`);
  ok(x.st === 200, 'negocio con las reseñas caídas: la ficha sale', String(x.st));
  ok(/class="muted resenas-fallo" role="status">No se han podido cargar las reseñas\. <a href="[^"]*#resenas">Reintentar<\/a>/.test(x.h), 'reseñas caídas: aviso discreto con «Reintentar»');
  ok(!/Todavía no hay reseñas/.test(x.h), 'reseñas caídas: nunca «no hay»');
  ok(/no-store/.test(x.cc), 'reseñas caídas: la página no se guarda en la caché', x.cc);
  const xe = await pide(`/en/b/${falla.slug}`);
  ok(/We couldn(?:'|&#39;|&#x27;)t load the reviews\./.test(xe.h) && />Try again</.test(xe.h), 'reseñas caídas (EN)');
  const xl = await pide(`/b/${falla.slug}?ver=resenas`);
  ok(/No se han podido cargar las reseñas/.test(xl.h) && !/Todavía no hay reseñas/.test(xl.h) && /no-store/.test(xl.cc), 'reseñas caídas, la lista entera: el aviso y sin caché');

  const s = await pide(`/b/${sinNota.slug}`);
  ok(/Todavía no hay reseñas/.test(s.h), 'negocio sin reseñas: «Todavía no hay reseñas»');
  ok(!/no-store/.test(s.cc), 'negocio sin reseñas: con su caché de siempre', s.cc);
} finally {
  await web.cierra();
}
console.log(fallos ? `${fallos} fallos` : 'todo bien');
process.exit(fallos ? 1 : 0);
