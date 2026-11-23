// Sin foto, nunca un hueco vacío (§4zzz-sinfoto): el hueco lo pinta
// `assets/sin-foto.js` (el mismo para el navegador). Aquí, lo que necesita el
// servidor para saber el icono de una publicación o un negocio por el id de su
// categoría: las categorías de la base (`rows` las guarda en memoria, así que
// pedirlas en cada página no cuesta una llamada de más).

import KSF from '../../assets/sin-foto.js';
import { rows } from './page.js';

/** Carga las categorías (`id` y `slug`) en `KlendarSinFoto` antes de pintar
 * tarjetas. Si la base no responde, el hueco sale con la tienda. */
export async function categoriasSinFoto() {
  try {
    KSF.categorias(await rows('categories', 'select=id,slug'));
  } catch {
    // Sin categorías: la tienda (no es motivo para no pintar la página).
  }
}

export default KSF;
