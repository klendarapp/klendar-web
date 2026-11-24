// Encargos (Iván, 2026-11-17): lo que la web tiene que hacer igual que la
// app. Sin navegador ni red: lee el código y prueba piezas con datos de
// mentira. Lo de la base, en la app (tool/encargos_smoke.py).
//
//   1. La ficha: «Hacer un encargo» con `preorder_menu` y a /cuenta/encargar.
//   2. «Tu cuenta»: «Tus encargos» en «Tus códigos», con «Quitar de la
//      lista» en los terminados; el encargo con su QR y «Anular el encargo».
//   3. Antes de encargar, los alérgenos con su nombre oficial; bajo la nota,
//      «No escribas datos de salud…»; el resumen con «Se paga al recogerlo»
//      y «Klendar no cobra ni responde del pedido».
//   4. El panel: /panel/encargos (acciones de todo el equipo) y /panel/encargos-cosas
//      con los alérgenos; la tarjeta en «Más herramientas»; la hoja de
//      cierre con los encargos.
//
//   node tools/encargos_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const lee = (f) => readFileSync(new URL(f, raiz), 'utf8');
const ficha = lee('assets/encargo-ficha.js');
const views = lee('functions/_lib/views.js');
const cuenta = lee('assets/cuenta/encargos.js');
const app = lee('assets/cuenta/app.js');
const panel = lee('panel/encargos.js');
const panelJs = lee('panel/panel.js');
const herr = lee('panel/herramientas.js');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

// 1
ok('1. la ficha pide preorder_menu y lleva a encargar', ficha.includes('/rest/v1/rpc/preorder_menu')
  && ficha.includes('/cuenta/encargar/') && views.includes('data-encargo-ficha') && views.includes('/assets/encargo-ficha.js'));

// 2: «Tus encargos», con una fila de mentira.
const ini = cuenta.indexOf('function encargosHtml(');
const fin = cuenta.indexOf('\n}\n', ini) + 2;
const piezas = cuenta.slice(cuenta.indexOf('const ENCARGO_ESTADO'), cuenta.indexOf('/** «Tus encargos»'));
const html = new Function('EN', 't', 'esc', 'ic', 'pre', 'LOC', 'seccionQuitable', 'quitable',
  `${piezas}\n${cuenta.slice(ini, fin)}; return encargosHtml;`)(
  false, (x) => x, (s) => String(s), (n) => `<i>${n}</i>`, '', 'es-ES',
  (titulo, tipo) => `<h2 data-tipo="${tipo}">${titulo}</h2>`,
  (h, id, si) => (si ? `<div class="quitable" data-id="${id}">${h}</div>` : h))([
  { id: 'a', status: 'accepted', quantity: 2, item_name: 'Tarta', business_name: 'Obrador', pickup_day: '2026-11-21', slot_start: '10:00', slot_end: '13:00' },
  { id: 'b', status: 'picked_up', quantity: 1, item_name: 'Ramo', business_name: 'Flores', pickup_day: '2026-11-10', slot_start: '09:00', slot_end: '12:00' },
], true);
ok('2. «Tus encargos» con su título y quitable', html.includes('Tus encargos') && html.includes('data-tipo="preorders"'));
ok('2. lo vivo no se quita; lo terminado sí', !html.includes('data-id="a"') && html.includes('data-id="b"'));
ok('2. «2 × Tarta» y la franja', html.includes('2 × Tarta') && html.includes('10:00–13:00'));
ok('2. en «Tus códigos»', app.includes("llamar('my_preorders'") && app.includes("conectaQuitar($('#codigosEncargos'), 'preorders')"));
ok('2. el encargo con su QR y «Anular el encargo»', cuenta.includes('https://klendar.app/r/${p.code}')
  && cuenta.includes("'cancel_preorder'") && cuenta.includes('Anular el encargo'));

// 3
ok('3. los 14 alérgenos con su nombre oficial', (cuenta.slice(cuenta.indexOf('const ENCARGO_ALERGENOS'), cuenta.indexOf('const encargoAlergeno ')).match(/\['[a-z_]+', '[^']+', '[^']+'\]/g) || []).length === 14
  && cuenta.includes('Cereales que contienen gluten') && cuenta.includes('Dióxido de azufre y sulfitos'));
ok('3. se enseñan antes de encargar', cuenta.includes("L('Alérgenos', 'Allergens')") && cuenta.includes('encargoAlergenosTexto(x)'));
ok('3. bajo la nota, sin datos de salud', cuenta.includes('No escribas datos de salud. Si tienes una alergia, consulta los alérgenos o contacta con el negocio.'));
ok('3. el resumen', cuenta.includes('Se paga al recogerlo en {business}.') && cuenta.includes('Klendar no cobra ni responde del pedido.'));
ok('3. encargar con place_preorder', cuenta.includes("'place_preorder'") && cuenta.includes('p_phone'));

// 4
ok('4. /panel/encargos con las acciones', panel.includes('PAGES.encargos =') && ['accept', 'ready', 'picked_up', 'no_show', 'reject']
  .every((a) => panel.includes(`'${a}'`)) && panel.includes("'preorder_action'"));
ok('4. rechazar pide el motivo', panel.includes('¿Por qué lo rechazas?') && panel.includes('required: true, maxlength: 200'));
ok('4. «Lo que se encarga» con los alérgenos', panel.includes("PAGES['encargos-cosas']") && panel.includes('allergens_none')
  && panel.includes("'save_preorder_item'"));
ok('4. la tarjeta en «Más herramientas»', herr.includes("herrSi(o, 'preorders', 'enabled')") && herr.includes('/panel/encargos'));
ok('4. la hoja de cierre con los encargos', panelJs.includes("rpc('closure_preorders'") && panelJs.includes("rpc('cancel_closure_preorders'"));

if (fallos) {
  console.log(`\n${fallos} fallo(s)`);
  process.exit(1);
}
console.log('\nEncargos: todo bien.');
