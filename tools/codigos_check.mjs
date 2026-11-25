// Revisión de «Conseguir y validar un código» (2026-11-15) en «Tu cuenta»:
// lo que la web tiene que hacer igual que la app. Sin navegador ni red: lee
// assets/cuenta/app.js y prueba sus funciones sueltas.
//
//   1. «Copiar» copia el código como se ve (mayúsculas, de cuatro en cuatro).
//   2. «Tus códigos» se vuelve a pintar cuando caduca el primero de «Para
//      usar» (`proximaCaducidad`).
//   3. La cuenta atrás va con la hora del servidor (`horaServidor`, `now`).
//   4. El error del equipo del negocio (`team_member`), en los 8 idiomas.
//   5. «Ya no voy: anular la reserva» solo en un evento.
//   6. En la ficha, con el límite por persona gastado, el botón se apaga y
//      dice por qué (assets/amigos.js).
//   7. «Ya no lo quiero» en el código de una oferta (2026-11-25, como la
//      app): fuera de los eventos, con confirmación, `cancel_redemption` y
//      sus textos en los 8 idiomas.
//
//   node tools/codigos_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const app = readFileSync(new URL('assets/cuenta/app.js', raiz), 'utf8');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

/** Saca `function nombre(…) { … }` de app.js y la devuelve lista para usar. */
function funcion(nombre) {
  const ini = app.indexOf(`function ${nombre}(`);
  if (ini < 0) throw new Error(`no está ${nombre}`);
  let i = app.indexOf('{', ini);
  let nivel = 0;
  for (; i < app.length; i++) {
    if (app[i] === '{') nivel++;
    else if (app[i] === '}' && --nivel === 0) break;
  }
  return new Function(`${app.slice(ini, i + 1)}; return ${nombre};`)();
}

// 1
const legible = new Function(`${app.match(/const codigoLegible = [^\n]+/)[0]}; return codigoLegible;`)();
ok('1. el código se ve en grupos', legible('87249cecd8a637aa') === '8724 9CEC D8A6 37AA');
ok('1. «Copiar» copia el código como se ve', /clipboard\.writeText\(codigoLegible\(tk\.code\)\)/.test(app));

// 2
const proxima = funcion('proximaCaducidad');
const ahora = Date.parse('2026-11-15T16:00:00Z');
const r = (min, status = 'pending') => ({ status, expires_at: new Date(ahora + min * 60000).toISOString() });
ok('2. el primero que caduca de los vivos', proxima([r(4), r(2), r(-1), r(1, 'validated')], ahora) === ahora + 2 * 60000);
ok('2. sin vivos, nada', proxima([r(-3), r(5, 'cancelled')], ahora) === null);
ok('2. se vuelve a pintar a esa hora', /proximaCaducidad\(lista \|\| \[\], Date\.now\(\)\)/.test(app)
  && /setTimeout\(\(\) => navegar\(\)/.test(app));

// 3
const hora = funcion('horaServidor');
const d = hora(new Date(Date.now() + 180000).toISOString());
ok('3. el desfase con el servidor', Math.abs(d - 180000) < 1000);
ok('3. sin `now`, sin desfase', hora(undefined) === 0 && hora('no') === 0);
ok('3. la cuenta atrás lo usa', /const falta = caduca\.getTime\(\) - ahora\(\);/.test(app));

// 4
const es = 'Eres del equipo de este negocio: tus códigos no se pueden validar aquí.';
ok('4. team_member tiene su texto', app.includes(`team_member: '${es}'`));
const en = readFileSync(new URL('assets/cuenta/i18n.js', raiz), 'utf8');
ok('4. en inglés', en.includes(`'${es}':`));
for (const l of ['ca', 'gl', 'eu', 'fr', 'it', 'de']) {
  const dic = readFileSync(new URL(`assets/cuenta/i18n/${l}.js`, raiz), 'utf8');
  ok(`4. en ${l}`, dic.includes(`${JSON.stringify(es)}:`));
}

// 5
ok('5. «Ya no voy» solo en un evento', /largo && \(tk\.offer_kind \?\? 'future_event'\) === 'future_event' \? `<p><button class="pill" id="anular"/.test(app));

// 6
const amigos = readFileSync(new URL('assets/amigos.js', raiz), 'utf8');
ok('6. ficha: el botón se apaga con el límite gastado', /Number\(o\.my_redemptions\) >= maxUsos/.test(amigos)
  && /setAttribute\('aria-disabled', 'true'\)/.test(amigos) && amigos.includes("usedUp: 'Ya has canjeado esta oferta'"));

// 7
ok('7. «Ya no lo quiero» solo fuera de un evento',
  /\(tk\.offer_kind \?\? 'future_event'\) !== 'future_event' \? `<p><button class="pill" id="ya-no"/.test(app));
const yaNo = app.slice(app.indexOf("$('#ya-no')"), app.indexOf("$('#otro-codigo')"));
ok('7. confirma y anula con cancel_redemption', yaNo.includes('confirma(') && yaNo.includes("llamar('cancel_redemption'")
  && yaNo.includes("t('Mantenerlo')") && yaNo.includes("e.clave === 'not_pending'"));
const enDic = readFileSync(new URL('assets/cuenta/i18n.js', raiz), 'utf8');
for (const es of ['Ya no lo quiero', '¿Anular este código?', 'Mantenerlo', 'Código anulado.',
  'Este código ya no se podía anular (se usó o ha caducado).']) {
  ok(`7. «${es}» en en`, enDic.includes(`${JSON.stringify(es)}:`));
  for (const l of ['ca', 'gl', 'eu', 'fr', 'de', 'it']) {
    const dic = readFileSync(new URL(`assets/cuenta/i18n/${l}.js`, raiz), 'utf8');
    ok(`7. «${es}» en ${l}`, dic.includes(`${JSON.stringify(es)}:`));
  }
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
