// Los 14 alérgenos, solo en comida y bebida (Iván, 18-11): qué tipos los
// llevan (`KlendarCategorias.alergenos`, generado desde
// klendar/tool/categorias.json) y cuándo sale la nota de la carta en las
// páginas públicas (`functions/_lib/carta.js`). Sin red ni navegador.
//
//   node tools/alergenos_check.mjs
import KC from '../assets/categorias.js';
import { alergenosDeCategoria, hayAlergenos } from '../functions/_lib/carta.js';

let fallos = 0;
const ok = (cond, que) => {
  console.log(`${cond ? 'ok' : 'FALLA'}: ${que}`);
  if (!cond) fallos++;
};
const lleva = (slug, grupo) => KC.alergenos({ slug, category_group: grupo });

for (const [s, g] of [['bar', 'food'], ['restaurant', 'food'], ['bakery', 'food'], ['grocery', 'food'], ['market', 'food'],
  ['cocktail', 'night'], ['nightclub', 'night'], ['music', 'night'], ['catering', 'events']]) {
  ok(lleva(s, g), `${s} lleva alérgenos`);
}
for (const [s, g] of [['stage', 'night'], ['cinema', 'night'], ['culture', 'night'], ['art', 'night'], ['hairdresser', 'care'],
  ['fashion', 'shops'], ['pharmacy', 'health'], ['lodging', 'stay'], ['event_venue', 'events'], ['gym', 'sports'], ['civic', 'services']]) {
  ok(!lleva(s, g), `${s} no lleva alérgenos`);
}
ok(lleva('nueva', 'food') && !lleva('nueva', 'care'), 'una nueva del admin, la de su grupo');
ok(!KC.alergenos(null) && !lleva('toString', 'care'), 'sin categoría, no (y sin líos con el prototipo)');
ok(alergenosDeCategoria(null), 'página pública sin poder saber el tipo: la nota, como antes');
ok(!alergenosDeCategoria({ slug: 'hairdresser', category_group: 'care' }), 'página pública de una peluquería: sin nota');
ok(hayAlergenos([{ items: [{ name: 'x', allergens: ['gluten'] }] }]), 'un plato con alérgenos ya puestos los enseña (y la nota)');
ok(!hayAlergenos([{ items: [{ name: 'x' }] }]) && !hayAlergenos(null), 'sin alérgenos puestos, nada');

if (fallos) {
  console.log(`\n${fallos} fallos.`);
  process.exit(1);
}
console.log('\nAlérgenos: todo bien.');
