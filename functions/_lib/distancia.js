// Desde dónde se mide una distancia que se enseña (revisión 9-11, I1). Una
// sola regla para Explorar, Descubre, Sitios y «Para grupos», como la app
// (`distanceLabel`, lib/core/location/distance_label.dart).
import { distancia } from './tarjeta.js';

/** El radio de un municipio si no viene el suyo (como `RADIO_CIUDAD_M` de explore.js). */
const RADIO_CIUDAD_M = 25000;

/**
 * Desde dónde se mide la distancia de cada tarjeta y de cada sitio (revisión
 * del 9-11, I1; lo mismo que la app, `distanceLabel`):
 *  - con «Cerca de ti» de verdad (la posición del navegador): «350 m», «1,2 km»;
 *  - con un municipio elegido, desde su punto: «En Málaga» dentro de su radio y
 *    «A 30 km de Málaga» fuera. Nunca como si se midiera desde donde estás;
 *  - con la ubicación aproximada de la conexión (redondeada a unos 10 km) o en
 *    todas las ciudades: sin distancia. Si el navegador guarda una posición de
 *    «Cerca de mí» reciente, /assets/tarjetas.js la pone con esa.
 * Cambia la lista en su sitio (son filas recién leídas de la base).
 */
export function ajustaDistancias(lista, { cerca, aprox, centro, nombre, lang }) {
  const en = lang === 'en';
  for (const o of lista || []) {
    if (!o || o.distance_m == null) continue;
    if (cerca && !aprox) continue;
    const m = Number(o.distance_m);
    o.distance_m = null;
    if (cerca || !centro || !nombre || !Number.isFinite(m)) continue;
    const radio = Number(centro.radius_m) || RADIO_CIUDAD_M;
    o.distance_txt = m <= radio ? (en ? `In ${nombre}` : `En ${nombre}`)
      : en ? `${distancia(m, 'en')} from ${nombre}` : `A ${distancia(m, 'es')} de ${nombre}`;
  }
  return lista;
}
