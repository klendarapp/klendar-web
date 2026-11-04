// El año del pie de las páginas de las Functions (P1 de la revisión del
// 5-11-2026): en Cloudflare Workers el reloj marca 1970 fuera de una
// petición, así que el año no puede calcularse al cargar el módulo. Aquí se
// carga `_lib/chrome.js` con el reloj en 1970 (como en Workers) y luego se
// pinta el pie con el reloj de verdad (como dentro de una petición).
//
//   node tools/pie_anio_check.mjs
import assert from 'node:assert/strict';

const DateReal = globalThis.Date;
class Date1970 extends DateReal {
  constructor(...a) { super(...(a.length ? a : [0])); }
  static now() { return 0; }
}
globalThis.Date = Date1970;
const { siteFooter } = await import('../functions/_lib/chrome.js');
globalThis.Date = DateReal;

const anio = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', year: 'numeric' }).format(new Date());
for (const lang of ['es', 'en']) {
  const pie = siteFooter(lang);
  assert(!pie.includes('© 1970'), `${lang}: el pie dice «© 1970»`);
  assert(pie.includes(`© ${anio} Klendar`), `${lang}: el pie no dice «© ${anio} Klendar»`);
}
console.log(`  ok   el pie dice «© ${anio} Klendar» aunque el módulo se cargue con el reloj en 1970`);
