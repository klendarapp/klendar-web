// Distancias sin ubicación de verdad (revisión del 9-11, I1; como la app,
// `distanceLabel`): las tarjetas y los sitios no dicen «1,2 km» como si se
// midiera desde donde estás cuando no se sabe dónde estás.
//  1. Con un municipio elegido: «En Madrid» (dentro de su radio) o «A 30 km
//     de Madrid», nunca «350 m» o «1,2 km» a secas. También en Sitios y en
//     «Para grupos».
//  2. Con «Cerca de ti» (posición en la dirección): «350 m», «1,2 km».
//  3. Con la zona aproximada de la conexión (unos 10 km): sin distancia, y
//     «Ahora, a un paseo» pide la posición en vez de ir a «1 km» de un punto
//     que no es el tuyo.
//  4. Todas las ciudades: sin distancia.
// Sin navegador: las Functions de verdad contra el Supabase falso de
// tools/_web_con_datos.mjs (no sale nada).
//
//   node tools/distancias_check.mjs
import { webConDatos } from './_web_con_datos.mjs';
import { ajustaDistancias } from '../functions/_lib/distancia.js';

let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };

// Lo que dice cada tarjeta (`.tj-dist`) y cada fila de sitio (su línea de abajo).
const dists = (html) => [...html.matchAll(/<span class="tj-dist">([^<]*)<\/span>/g)].map((m) => m[1].replace(/^\s*·\s*/, '').trim()).filter(Boolean);
const filas = (html) => [...html.matchAll(/class="sitio-fila"[\s\S]*?<\/a>/g)].map((m) => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
const aSecas = (t) => /^\d[\d.,]*\s?(m|km)$/.test(t);

// La regla, sola.
{
  const l = [{ distance_m: 1200 }, { distance_m: 30000 }, { distance_m: null }];
  ajustaDistancias(l, { cerca: false, aprox: false, centro: { radius_m: 25000 }, nombre: 'Málaga', lang: 'es' });
  ok(l[0].distance_txt === 'En Málaga' && l[1].distance_txt === 'A 30 km de Málaga' && l[0].distance_m === null && !l[2].distance_txt, 'regla: con municipio, «En Málaga» y «A 30 km de Málaga»', JSON.stringify(l));
  const en = [{ distance_m: 30000 }];
  ajustaDistancias(en, { cerca: false, centro: {}, nombre: 'Malaga', lang: 'en' });
  ok(en[0].distance_txt === '30 km from Malaga', 'regla: en inglés, «30 km from Malaga»', en[0].distance_txt);
  const ap = [{ distance_m: 1200 }];
  ajustaDistancias(ap, { cerca: true, aprox: true, lang: 'es' });
  ok(ap[0].distance_m === null && !ap[0].distance_txt, 'regla: zona aproximada, sin distancia');
  const gps = [{ distance_m: 1200 }];
  ajustaDistancias(gps, { cerca: true, aprox: false, lang: 'es' });
  ok(gps[0].distance_m === 1200, 'regla: con tu posición, la distancia tal cual');
}

const web = await webConDatos({ puerto: Number(process.env.PORT || 8921) });
const pide = async (base, ruta) => (await fetch(`${base}${ruta}`)).text();
try {
  // 1. Municipio elegido.
  for (const ruta of ['/descubre/?ciudad=madrid', '/explorar/?ciudad=madrid&vista=lista', '/en/discover/?city=madrid']) {
    const d = dists(await pide(web.BASE, ruta));
    ok(d.length > 3 && d.every((t) => /^(En|In) Madrid$|^A .+ de Madrid$|^.+ from Madrid$/.test(t)), `${ruta}: «En Madrid», nunca «1,2 km» a secas`, JSON.stringify(d.slice(0, 6)));
  }
  const s = filas(await pide(web.BASE, '/explorar/?ciudad=madrid&que=sitios'));
  ok(s.length > 3 && s.every((t) => / En Madrid\b/.test(t) && !/\d\s?(m|km)\b/.test(t)), 'Sitios en Madrid: «En Madrid» en cada fila', JSON.stringify(s.slice(0, 2)));
  const g = await pide(web.BASE, '/grupos/?ciudad=madrid');
  ok(/En Madrid/.test(g) && !/·\s*\d[\d,]*\s?(m|km)\s*</.test(g), '«Para grupos» en Madrid: «En Madrid», sin «1,2 km»');

  // 2. Con tu posición (Cerca de ti).
  const c = dists(await pide(web.BASE, '/descubre/?cerca=1&lat=40.417&lng=-3.704'));
  ok(c.length > 3 && c.every(aSecas), 'Cerca de ti: «350 m», «1,2 km»', JSON.stringify(c.slice(0, 6)));

  // 4. Todas las ciudades.
  const t = dists(await pide(web.BASE, '/descubre/?todas=1'));
  ok(!t.length, 'Todas las ciudades: sin distancia', JSON.stringify(t.slice(0, 4)));
} finally {
  await web.cierra();
}

// 3. La zona aproximada de la conexión (`request.cf`, lo simula serve_dev con CF_PRUEBA).
const aprox = await webConDatos({ puerto: Number(process.env.PORT || 8921) + 2, entorno: { CF_PRUEBA: JSON.stringify({ country: 'ES', latitude: '40.42', longitude: '-3.70' }) } });
try {
  const h = await pide(aprox.BASE, '/descubre/');
  ok(/Ubicación aproximada/.test(h), 'zona de la conexión: «Ubicación aproximada»');
  const d = dists(h);
  ok(!d.length, 'zona de la conexión: sin distancia en las tarjetas', JSON.stringify(d.slice(0, 4)));
  // «Ahora, a un paseo»: un botón que pide la posición (`botonCerca`), no un enlace a 1 km.
  const paseo = h.match(/<(a|button)[^>]*>(?:(?!<\/(?:a|button)>).)*Ahora, a un paseo/s)?.[1];
  ok(paseo === 'button', 'zona de la conexión: «Ahora, a un paseo» pide tu posición', paseo || 'no está');
} finally {
  await aprox.cierra();
}

console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
