// Cómo se llama la carta de un negocio en las páginas públicas (Iván, 18-11):
// «Carta» en comer, beber y noche; «Servicios y precios» en belleza, salud y
// servicios; «Productos y precios» en tiendas; «Precios y tarifas» en ocio,
// deporte, alojamiento, eventos y cultura. Lo mismo por dentro; cambia el
// nombre. Por su categoría principal (`category_id`), como `MenuName` de la
// app y `tipoCarta` del panel.
import KC from '../../assets/categorias.js';
import { isUuid, rows } from './page.js';

/** 'menu', 'services', 'products' o 'prices' del negocio `id` (o de su
 * categoría `categoryId`, si ya se sabe). Si no se puede saber (sin
 * categoría o sin respuesta), 'menu': como antes. */
export async function tipoCartaDe(id, categoryId) {
  try {
    let cat = categoryId;
    if (cat === undefined && isUuid(id)) {
      cat = (await rows('businesses', `select=category_id&id=eq.${id}`))[0]?.category_id;
    }
    if (!isUuid(cat)) return 'menu';
    const c = (await rows('categories', `select=slug,category_group&id=eq.${cat}`))[0];
    return c ? KC.carta(c) : 'menu';
  } catch {
    return 'menu';
  }
}

const I = { menu: 0, services: 1, products: 2, prices: 3 };

/** Los textos de cada tipo, en español e inglés ([carta, servicios,
 * productos, precios]; con dos, [carta, lo demás]). */
const TEXTOS = {
  es: {
    titulo: ['Carta', 'Servicios y precios', 'Productos y precios', 'Precios y tarifas'],
    todo: ['Ver toda la carta', 'Ver todos los servicios', 'Ver todos los productos', 'Ver todos los precios'],
    fotos: ['Fotos de la carta', 'Fotos de la lista de precios'],
    nuestra: ['nuestra carta', 'nuestros servicios', 'nuestros productos', 'nuestros precios'],
    mesa: ['Ofertas y carta', 'Ofertas y servicios', 'Ofertas y productos', 'Ofertas y precios'],
    sinWifi: ['Mira lo que hay hoy aquí y la carta.', 'Mira lo que hay hoy aquí y sus servicios.', 'Mira lo que hay hoy aquí y sus productos.', 'Mira lo que hay hoy aquí y sus precios.'],
  },
  en: {
    titulo: ['Menu', 'Services and prices', 'Products and prices', 'Prices and rates'],
    todo: ['See the whole menu', 'See all services', 'See all products', 'See all prices'],
    fotos: ['Photos of the menu', 'Photos of the price list'],
    nuestra: ['our menu', 'our services', 'our products', 'our prices'],
    mesa: ['Offers and menu', 'Offers and services', 'Offers and products', 'Offers and prices'],
    sinWifi: ['See what’s on here today and the menu.', 'See what’s on here today and their services.', 'See what’s on here today and their products.', 'See what’s on here today and their prices.'],
  },
};

/** El texto `clave` del tipo `tipo` en `lang` ('en' o el español). */
export function textoCarta(clave, tipo, lang) {
  const lista = TEXTOS[lang === 'en' ? 'en' : 'es'][clave];
  const i = I[tipo] ?? I.prices;
  return lista[lista.length === 2 ? Math.min(i, 1) : i];
}
