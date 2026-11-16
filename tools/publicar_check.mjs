// Revisión de «Publicar una oferta o un evento» (2026-11-16) en el panel:
// lo que la web tiene que hacer igual que la app. Sin navegador ni red: lee
// panel/panel.js y comprueba cada arreglo.
//
//   1. Una agotada está publicada: «Pasar a borrador» · «Guardar cambios», y
//      pasarla a borrador la pausa (antes la dejaba agotada).
//   2. Reintentar tras un fallo a medias (fotos, RRPP, artistas) no crea otra
//      publicación: se edita la ya creada.
//   3. Al editar, las fotos nuevas entran antes de quitar las de antes.
//   4. Con una foto o un vídeo subiéndose, la barra no guarda.
//   5. Las cifras de la app: % de 1 a 100, importes > 0, aforo ≥ 1 y de 1 a
//      20 canjes por persona.
//   6. El precio anterior, solo con % o precio fijo.
//   7. Editar un «Menú del día» no le quita el sello ni la comida.
//   8. Publicar algo que ya ha terminado: no.
//   9. «Activar» no sale en un borrador que ya ha terminado.
//  10. «Primeros pasos»: un borrador no es «ya has publicado» (`publicadas`).
//  11. Los textos nuevos, en los 6 idiomas del panel además de es/en.
//
//   node tools/publicar_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const panel = readFileSync(new URL('panel/panel.js', raiz), 'utf8');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};
const tiene = (s) => panel.includes(s);

// 1
ok('1. agotada = publicada', tiene("const enVivo = !!id && ['active', 'sold_out'].includes(o.status);"));
// Desde el 16-11, sin publicar es borrador siempre (también terminada o
// cancelada, como la app): tools/publicar2_check.mjs, punto 4.
ok('1. «Pasar a borrador» pausa una agotada', tiene("status: alas ? 'draft' : (publicar ? 'active' : 'draft'),")
  && !tiene("['expired', 'sold_out', 'cancelled'].includes(o.status) ? o.status"));

// 2
ok('2. reintento: edita la ya creada', tiene('let offerId = id || creada;') && tiene('creada = offerId;'));

// 3
const iNuevas = panel.indexOf("from('offer_images').insert(images.map");
const iViejas = panel.indexOf(".delete().in('id', viejas)");
ok('3. primero las fotos nuevas, luego quitar las viejas', iNuevas > 0 && iViejas > iNuevas
  && !tiene("from('offer_images').delete().eq('offer_id', id)"));

// 4
ok('4. con una subida en marcha no se guarda', tiene('if (subiendo) {') && /subiendo = true;[\s\S]{0,200}disabled = true/.test(panel)
  && /finally \{\s*subiendo = false;/.test(panel));

// 5
ok('5. % de 1 a 100', tiene("num('discount_value') >= 1 && num('discount_value') <= 100"));
ok('5. importes > 0', tiene("!vacio('price') && !(num('price') > 0)") && tiene("dType === 'fixed' && !(num('discount_value') > 0)"));
ok('5. aforo ≥ 1', /aforo && !\(\/\^\\d\+\$\/\.test\(aforo\) && Number\(aforo\) >= 1\)/.test(panel));
ok('5. de 1 a 20 por persona', tiene('porPersona >= 1 && porPersona <= 20'));

// 6
ok('6. precio anterior solo con % o fijo', tiene("...(prior && ['percent', 'fixed'].includes(dType) ? { compare_at_cents: prior } : {})"));

// 7: limpiaEstilo + estiloJson con un estilo de «Menú del día»
const limpia = new Function('PLANTILLAS', 'colorSeguro',
  `${panel.match(/const limpiaEstilo = \(s2\) => \(\{[\s\S]*?\n {2}\}\);/)[0]}; return limpiaEstilo;`)([['glass']], () => null);
const est = limpia({ template: 'glass', badge: 'daily_menu', meal: 'lunch' });
ok('7. el «Menú del día» se lee', est.daily_menu === true && est.meal === 'lunch');
ok('7. y se vuelve a guardar en una flash', tiene("estilo.daily_menu && kind === 'flash_offer' ? { badge: 'daily_menu', ...(estilo.meal ? { meal: estilo.meal } : {}) }"));

// 8
ok('8. publicar algo ya terminado: no', tiene("if (publicar && !alas && acaba && new Date(acaba) <= new Date()) {")
  && tiene("Ya ha terminado: cambia las fechas para publicarla."));

// 9
ok('9. «Activar» no en un borrador terminado', tiene("o.status === 'draft' && !(finDe(o) && new Date(finDe(o)) < new Date()) ? `<button type=\"button\" class=\"btn sm ghost\" data-act=\"activate\""));

// 10
ok('10. Primeros pasos mira «publicadas»', tiene('cuentas?.publicadas != null ? cuentas.publicadas === 0'));

// 11
const nuevos = ['Pon un porcentaje del 1 al 100.', 'Pon un importe mayor que 0, por ejemplo 12,50.',
  'Pon cuántas plazas hay, de 1 en adelante, o déjalo vacío.', 'Pon de 1 a 20 canjes por persona.',
  'Ya ha terminado: cambia las fechas para publicarla.', 'Espera a que acabe de subirse la foto o el vídeo.'];
for (const l of ['ca', 'gl', 'eu', 'fr', 'it', 'de']) {
  const dic = readFileSync(new URL(`panel/i18n/${l}.js`, raiz), 'utf8');
  ok(`11. en ${l}`, nuevos.every((t) => dic.includes(`${JSON.stringify(t)}:`)));
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
