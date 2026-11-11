// «Precio del local» con €, €€ y €€€ de selección múltiple (Iván, 11-11;
// como la app; migración 20261274600000 de la app):
//  1. ☰ trae tres casillas (sin «Cualquiera» ni «Hasta …»), con lo que
//     significa cada una para el lector.
//  2. `?precios-local=1&precios-local=3` las marca y pide `price_is_1` y
//     `price_is_3` a la base (en Planes y en Sitios).
//  3. El `?precio-local=2` de antes («Hasta €€») sigue valiendo: € y €€.
//  4. ☰ cuenta el precio como uno aunque haya varios marcados.
// Sin navegador: las Functions de verdad contra el Supabase falso (no sale
// nada).
//
//   node tools/precio_local_check.mjs
import { webConDatos } from './_web_con_datos.mjs';

let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };

const web = await webConDatos({ puerto: Number(process.env.PORT || 8996) });
const pide = async (ruta) => (await fetch(`${web.BASE}${ruta}`)).text();
const casillas = (html) => [...html.matchAll(/<input type="checkbox" name="precios-local" value="(\d)"[^>]*>/g)]
  .map((m) => ({ v: m[1], on: / checked/.test(m[0]) }));
const traitsPedidos = () => web.llamadas.flatMap((l) => [
  ...(Array.isArray(l.args?.p_traits) ? l.args.p_traits : []),
  ...(Array.isArray(l.args?.p_filters?.traits) ? l.args.p_filters.traits : []),
]);

try {
  const h = await pide('/explorar');
  const c = casillas(h);
  ok(c.map((x) => x.v).join() === '1,2,3' && c.every((x) => !x.on), 'tres casillas, ninguna marcada', JSON.stringify(c));
  ok(!/name="precio-local"/.test(h) && !/Hasta €/.test(h), 'sin «Cualquiera» ni «Hasta …» para el precio del local');
  ok(/aria-label="€€, Precio medio"/.test(h), 'el lector dice lo que significa «€€»');

  web.llamadas.length = 0;
  const h2 = await pide('/explorar?precios-local=1&precios-local=3');
  ok(casillas(h2).filter((x) => x.on).map((x) => x.v).join() === '1,3', '€ y €€€ marcados');
  const t2 = traitsPedidos();
  ok(t2.includes('price_is_1') && t2.includes('price_is_3') && !t2.some((x) => /^price_le_/.test(x)), 'pide price_is_1 y price_is_3', JSON.stringify(t2));
  ok(/data-bloque="sitio"[\s\S]*?data-bloque-n> · 1</.test(h2), '«Cómo es el sitio · 1» con dos precios');

  web.llamadas.length = 0;
  await pide('/explorar?ver=sitios&precios-local=2');
  ok(traitsPedidos().includes('price_is_2'), 'en Sitios, también', JSON.stringify(traitsPedidos()));

  const h3 = await pide('/explorar?precio-local=2');
  ok(casillas(h3).filter((x) => x.on).map((x) => x.v).join() === '1,2', 'el «Hasta €€» de antes: € y €€');
} finally {
  await web.cierra();
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
