// «Cerca de mí» en Partidos, Grupos, Sorteos y las guías, como en Explorar y
// Descubre (Iván, 25-11-2026; RUNBOOK §4zzz-ubicacion-web2): la dirección
// lleva la CELDA en la que estás (`?celda=` / `?cell=`, geohash de 5: unos
// 5 km; assets/celda.js), nunca tu punto. La página se pinta desde su centro
// y la caché del borde la guarda con la celda en la clave (es la dirección),
// igual para todos los de esa celda. Un enlace de antes con `?lat=&lng=`
// lleva a su celda con un 301 (`aSuCelda`) y sigue funcionando.
//
// Estas páginas no afinan nada en el navegador (Explorar sí: quita lo que
// desde tu punto queda más lejos), así que la base se pregunta con el radio
// más la mitad de la diagonal de la celda (`margenM`, ~3 km): no falta nada
// de lo que esté a esa distancia desde cualquier punto de la celda. La
// distancia de cada sitio desde el centro no es la tuya: no se enseña (la
// pone el navegador si tiene tu punto de «Cerca de mí»).

import KCe from '../../assets/celda.js';

/** La celda de la dirección: { celda, lat, lng (su centro), vieja }; `vieja`
 * si llegó como `?lat=&lng=` (un enlace de antes). null sin zona. */
export function celdaDeUrl(qs) {
  const c = String(qs.get('celda') || qs.get('cell') || '').toLowerCase();
  if (KCe.valida(c)) return { celda: c, ...KCe.centro(c), vieja: false };
  const lat = Number.parseFloat(qs.get('lat') || '');
  const lng = Number.parseFloat(qs.get('lng') || '');
  const v = KCe.de(lat, lng);
  return v ? { celda: v, ...KCe.centro(v), vieja: true } : null;
}

/** La clave de la celda en cada idioma (la de Explorar). */
export const claveCelda = (lang) => (lang === 'en' ? 'cell' : 'celda');

/** Un enlace de antes con `?lat=&lng=`: la misma página con su celda (301,
 * como Explorar). Lo demás de la dirección se queda. */
export function aSuCelda(url, lang, celda) {
  const q = new URLSearchParams(url.search);
  ['lat', 'lng', 'celda', 'cell'].forEach((k) => q.delete(k));
  q.set(claveCelda(lang), celda);
  return new Response(null, { status: 301, headers: { location: `${url.pathname}?${q}`, 'cache-control': 'public, max-age=3600, s-maxage=3600' } });
}

/** El radio para la base desde el centro de la celda: el elegido y la
 * mitad de su diagonal (ver arriba). */
export const radioConCelda = (celda, radioM) => radioM + (KCe.valida(celda) ? KCe.margenM(celda) : 0);

/** La celda de una zona { cerca, celda, lat, lng } (la de Explorar puede
 * venir con su celda o, la de la conexión, con su centro). '' sin zona. */
export const celdaDeZona = (e) => (!e?.cerca ? '' : KCe.valida(e.celda) ? e.celda : KCe.de(e.lat, e.lng));
