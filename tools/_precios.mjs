// El interruptor de precios de la web (`PRECIOS` en functions/_lib/chrome.js;
// Iván, 11-11-2026) para las pruebas: con él apagado, /precios dice «¿Cuánto
// cuesta? Te lo explicamos en persona» (noindex) y ninguna página enseña
// precio, cuota, IVA, prueba de 30 días ni «gratis hasta…». Las pruebas que
// vigilan textos de precios comprueban una cosa u otra según esté, sin dejar
// de vigilar lo suyo.
import { PRECIOS } from '../functions/_lib/chrome.js';

export { PRECIOS };

/** Lo que tiene que decir /precios (o /en/pricing) con el interruptor apagado. */
export const PRECIOS_APAGADO = {
  es: [/¿Cuánto cuesta\?/, /Te lo explicamos en persona, sin compromiso/],
  en: [/What does it cost\?/, /We'll explain it in person, with no obligation/],
};

/** Lo que nunca sale con el interruptor apagado (en ninguna página). */
export const NUNCA_PRECIO = [
  /19[,.]90/, /24[,.]08/, /\+ IVA|\+ VAT/, /gratis hasta el|free until/i, /30 días con todo|30 days with everything/,
];

/** Las entradas de una prueba con precios (encendido) o las de apagado. */
export const segunPrecios = (encendido, apagado) => (PRECIOS ? encendido : apagado);
