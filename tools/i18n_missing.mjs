// Textos de «Tu cuenta» que no tienen traducción inglesa.
//
// Busca los t('…') de app.js y cuenta.js, y los textos de las listas que se
// traducen al vuelo (motivos, tipos de sugerencia, estados), y dice cuáles no
// están en APP_EN. Sale con 1 si falta alguno, para poder usarlo de prueba.
//
//   node tools/i18n_missing.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('../app/', import.meta.url);
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8');

const ctx = {};
vm.runInNewContext(`${leer('i18n.js')}\nthis.APP_EN = APP_EN;`, ctx);
const EN = ctx.APP_EN;

const codigo = leer('app.js') + leer('cuenta.js');
const textos = new Set();
for (const m of codigo.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) textos.add(m[1].replace(/\\'/g, "'"));
// Listas: ['clave', 'Texto', 'Ejemplo'] y { clave: 'Texto' } dentro de las
// constantes que se pasan por t().
for (const nombre of ['TIPOS_SUGERENCIA', 'MOTIVOS']) {
  const bloque = codigo.match(new RegExp(`const ${nombre} = \\[([\\s\\S]*?)\\n\\];`));
  if (!bloque) continue;
  for (const fila of bloque[1].matchAll(/\['[a-z_]+', '([^']*)'(?:, '([^']*)')?\]/g)) {
    if (fila[1]) textos.add(fila[1]);
    if (fila[2]) textos.add(fila[2]);
  }
}
for (const nombre of ['ESTADO_SUGERENCIA', 'QUE_SE_DENUNCIA', 'ERRORES']) {
  for (const bloque of codigo.matchAll(new RegExp(`${nombre}(?: = |, )\\{([\\s\\S]*?)\\n\\}`, 'g'))) {
    for (const par of bloque[1].matchAll(/:\s*'([^']+)'/g)) textos.add(par[1]);
  }
}

const faltan = [...textos].filter((s) => !(s in EN));
if (faltan.length) {
  console.log(`Faltan ${faltan.length} traducciones:\n`);
  for (const s of faltan) console.log(`  ${JSON.stringify(s)}`);
  process.exit(1);
}
console.log(`Todo traducido (${textos.size} textos).`);
