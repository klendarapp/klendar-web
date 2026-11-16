// Revisión de «Sellos, bonos y Fidelizar» (2026-11-17) en «Tu cuenta»: lo que
// la web tiene que hacer igual que la app. Sin navegador ni red: lee
// assets/cuenta/app.js y sus diccionarios.
//
//   1. Una oferta de primera visita que ya no te toca (`first_visit_only`) o
//      que es de tu negocio (`first_visit_team`) dice por qué, con el nombre
//      del negocio, en vez de «Algo no ha ido bien… escríbenos» (como la app,
//      `redeemErrorFirstVisit` / `redeemErrorFirstVisitTeam`), en los 8 idiomas.
//
//   node tools/sellos_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const app = readFileSync(new URL('assets/cuenta/app.js', raiz), 'utf8');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

// 1
const solo = 'Esta oferta es solo para la primera visita a {negocio}, y ya has canjeado allí antes.';
const equipo = 'Es para clientes nuevos y eres del equipo del negocio.';
const ini = app.indexOf('RUTAS.codigo = async');
const codigo = app.slice(ini, app.indexOf('\nRUTAS.', ini + 10));
ok('1. «Conseguir el código» trata first_visit_only y first_visit_team',
  /e\.clave === 'first_visit_only' \|\| e\.clave === 'first_visit_team'/.test(codigo));
ok('1. con el nombre del negocio', codigo.includes(`t('${solo}')`)
  && /\.replace\('\{negocio\}', e\.datos\?\.business_name \|\| t\('este negocio'\)\)/.test(codigo));
ok('1. el del equipo, como la app', codigo.includes(`t('${equipo}')`));
ok('1. sin «Reintentar» (no cambia nada)', app.includes('const sinReintentar = /^(team_member|first_visit_team|first_visit_only)$/'));
const en = readFileSync(new URL('assets/cuenta/i18n.js', raiz), 'utf8');
for (const k of [solo, equipo, 'este negocio']) ok(`1. en inglés: ${k.slice(0, 30)}…`, en.includes(`${JSON.stringify(k)}:`));
for (const l of ['ca', 'gl', 'eu', 'fr', 'it', 'de']) {
  const dic = readFileSync(new URL(`assets/cuenta/i18n/${l}.js`, raiz), 'utf8');
  ok(`1. en ${l}`, [solo, equipo, 'este negocio'].every((k) => dic.includes(`${JSON.stringify(k)}:`))
    && /\{negocio\}/.test(dic.slice(dic.indexOf(JSON.stringify(solo)), dic.indexOf(JSON.stringify(solo)) + 400)));
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
