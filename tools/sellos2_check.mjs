// Los 5 cambios de sellos y Fidelizar (Iván, 2026-11-17; migración
// 20261283400000 de la app), en la web igual que en la app. Sin navegador ni
// red: lee el panel, «Tu cuenta» y sus diccionarios.
//
//   1. Cupón para la próxima visita: «Uno por visita (dos códigos el mismo día
//      dan uno)», no «uno por canje», en los 8 idiomas.
//   2. Tarjetas de sellos: el personal entra (ya no es solo de gestión), las
//      ve y suma o quita sellos; «Nueva tarjeta», «Editar», el cartel,
//      «Entregar el premio», «Poner a 0» y «Cambios a mano» solo con
//      `can_edit` (propietario o encargado). Al personal, la nota de lo que
//      puede hacer, en los 8 idiomas.
//   3. Cifras › Tarjetas de sellos: sellos dados y premios canjeados.
//   5. «Tus códigos» › Premios: «Quitar de la lista» los canjeados o
//      caducados (`hide_my_history('rewards')`), no el que aún vale.
//
//   node tools/sellos2_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8');
const panel = leer('panel/panel.js');
const fiel = leer('panel/fidelizar.js');
const app = leer('assets/cuenta/app.js');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};
const IDIOMAS = ['ca', 'gl', 'eu', 'fr', 'de', 'it'];
const dics = Object.fromEntries(IDIOMAS.map((l) => [l, leer(`panel/i18n/${l}.js`)]));
const enTodos = (es) => IDIOMAS.every((l) => dics[l].includes(`${JSON.stringify(es)}:`));

// 1
const cupon = 'Vale desde el día siguiente al canje y se valida en «Validar códigos», como los demás. Uno por visita (dos códigos el mismo día dan uno); tu equipo no los recibe. Si menciona alcohol, solo lo reciben mayores de edad.';
ok('1. el cupón: uno por visita', fiel.includes(cupon) && !fiel.includes('Uno por canje'));
ok('1. en inglés', fiel.includes('One per visit (two codes on the same day get one)'));
ok('1. en los otros 6 idiomas', enTodos(cupon));

// 2
const solo = panel.match(/const SOLO_GESTION = \[([^\]]*)\]/)?.[1] || '';
ok('2. «sellos» ya no es solo de gestión', solo.length > 0 && !solo.includes("'sellos'"));
ok('2. el cartel del local sigue siendo de gestión', solo.includes("'cartel-local'"));
ok('2. Fidelizar › Tarjetas de sellos: botón también para el personal («Ver»)',
  /titulo: bi\('Tarjetas de sellos'[\s\S]{0,600}boton: configurar,/.test(fiel));
const lista = panel.slice(panel.indexOf('PAGES.sellos = async'), panel.indexOf('async function tarjetaForm'));
ok('2. lista: «Nueva tarjeta» y el cartel solo con can_edit', lista.includes('const edita = d.can_edit ?? gestiona();')
  && /edita \? `<button class="btn sm primary" type="button" id="nueva"/.test(lista)
  && lista.includes("esOrganizador() || !edita ? ''"));
const form = panel.slice(panel.indexOf('async function tarjetaForm'), panel.indexOf('async function tarjetaClientes'));
ok('2. cambiar las reglas: el personal no entra', form.includes("if (!(d.can_edit ?? gestiona()))"));
const gente = panel.slice(panel.indexOf('async function tarjetaClientes'), panel.indexOf('// Añadir a alguien: quien ya ha canjeado'));
ok('2. tarjeta: «Editar» solo con can_edit', /\$\{edita \? `<a class="btn sm ghost" href="\/panel\/sellos\/\$\{esc\(c\.id\)\}\/editar">Editar<\/a>` : ''\}/.test(gente));
ok('2. «Entregar el premio» y «Poner a 0», solo con can_edit',
  /\$\{edita \? `<div class="f full"><button class="btn primary" type="button" id="da"/.test(gente)
  && gente.includes("if (edita) $('#da', v).onclick") && gente.includes("if (edita) $('#cero', v).onclick"));
ok('2. «Añadir» y «Quitar», para todos', gente.includes('id="quita"') && gente.includes('id="pone"')
  && !/edita \? `[^`]*id="pone"/.test(gente));
ok('2. «Cambios a mano», solo con can_edit', /\$\{edita \? `<h3>Cambios a mano<\/h3>/.test(gente));
const nota = 'Puedes sumar o quitar sellos para corregir un error; queda apuntado quién lo hace. Poner a 0, entregar el premio sin código y cambiar la tarjeta es cosa del propietario o de un encargado.';
ok('2. la nota del personal', gente.includes(nota) && gente.includes('You can add or remove stamps to fix a mistake'));
ok('2. la nota, en los otros 6 idiomas', enTodos(nota));

// 3
ok('3. Cifras: el apartado de sellos', /function informeSellosHtml\(s\)/.test(panel)
  && panel.includes("conRes(informeSellosHtml(r.stamps)"));
const inf = panel.slice(panel.indexOf('function informeSellosHtml'), panel.indexOf('/** «Toques en tus enlaces»'));
ok('3. sellos dados y premios canjeados', inf.includes("bi('Sellos dados', 'Stamps given')")
  && inf.includes("bi('Premios canjeados', 'Rewards redeemed')") && inf.includes('origenSellos('));
ok('3. sin el dato (una base de antes), no sale', inf.includes("if (!s || !(s.given || s.rewards_redeemed)) return '';"));
ok('3. en los otros 6 idiomas', enTodos('Premios canjeados') && enTodos('Sellos dados')
  && enTodos('Los sellos que han caído en el periodo en tus tarjetas (los quitados a mano no cuentan) y los premios de sellos canjeados.'));

// 5
ok('5. ¿la base sabe quitar premios? (si no, sin botones)',
  /llamar\('hide_my_history', \{ p_kind: 'rewards', p_ids: \[\] \}\)/.test(app));
const cod = app.slice(app.indexOf('RUTAS.codigos = async'), app.indexOf('function filaPremio'));
ok('5. el premio que aún vale no se quita', cod.includes("const premioVivo = (p) => p.status === 'pending' && !!p.code;")
  && cod.includes('quitable(filaPremio(p), p.id, quitarPremios && !premioVivo(p))'));
ok('5. «Quitar todos» de premios', cod.includes("premios.some((p) => !premioVivo(p)) ? 'rewards' : ''"));
ok('5. conectado', cod.includes("conectaQuitar($('#codigosPremios'), 'rewards')"));

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
