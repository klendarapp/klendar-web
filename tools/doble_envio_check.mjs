// Ningún formulario se manda dos veces (§4zzz-revweb; la prueba general que
// pedía §4zzz-revnegocio). Sin navegador ni red: lee el panel y «Tu cuenta».
//
// Panel. `route()` pasa `sinDobleEnvio(v)` a lo que pinta una pantalla al
// abrirla; lo que se pinta DESPUÉS (una pantalla que se repinta sola o tras
// guardar) se queda sin esa guarda y un doble clic lo manda dos veces (lo que
// arregló §4zzz-revnegocio en Grupos, Habituales, Bonos y Encargos). Falla:
//  · una pantalla con formularios (`PAGES.x` con `onsubmit`) a la que se
//    llama a mano fuera de `route()` (`PAGES.x(v)`) sin `sinDobleEnvio` ni en
//    ella ni junto a la llamada;
//  · una función que pinta un formulario (`f.onsubmit = …`), que no es una
//    pantalla y que se llama desde otro sitio que no sea `return f(…)` de una
//    pantalla (es decir, se repinta), sin guarda propia (`sinDobleEnvio`,
//    `enBoton`, `disabled`).
// «Tu cuenta» no tiene `route()` con guarda: cada formulario lleva la suya
// (`ocupado(boton, …)` o el botón `disabled`). Falla uno sin ella que no esté
// en NO_MANDAN (los que no mandan nada: resuelven una promesa o buscan).
//
//   node tools/doble_envio_check.mjs            (--prueba: comprueba que la prueba detecta los casos)
import { readFileSync, readdirSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8');
const js = (dir) => readdirSync(new URL(dir, raiz)).filter((f) => f.endsWith('.js')).map((f) => [`${dir}${f}`, leer(`${dir}${f}`)]);

const ENVIO = /\.onsubmit\s*=|addEventListener\(\s*'submit'/;
const GUARDA = /sinDobleEnvio\(|enBoton\(|ocupado\(|\.disabled\s*=\s*true/;
/** Los bloques de arriba del todo: `PAGES.x = …`, `RUTAS.x = …`, `function f(…)`. */
function bloques(src) {
  const re = /^(?:export )?(?:async )?function (\w+)|^((?:PAGES|RUTAS)(?:\.[\w$]+|\['[\w-]+'\]))\s*=|^const (\w+) = (?:async )?\(/gm;
  const marcas = [];
  for (let m; (m = re.exec(src));) marcas.push({ nombre: m[1] || m[2] || m[3], desde: m.index });
  return marcas.map((b, i) => ({ ...b, texto: src.slice(b.desde, i + 1 < marcas.length ? marcas[i + 1].desde : src.length) }));
}
/** ¿Todos los formularios de [texto] llevan su propia guarda (o no mandan nada)? */
const todosConGuarda = (f, texto) => {
  const lineas = texto.split('\n');
  return lineas.every((l, i) => !ENVIO.test(l) || NO_MANDAN.some(([ff, trozo]) => ff === f && l.includes(trozo)) || GUARDA.test(manejador(lineas, i)));
};
const pagina = (n) => n.replace(/^PAGES\.([\w$]+)$/, '$1').replace(/^PAGES\['([\w-]+)'\]$/, '$1');

export function revisaPanel(ficheros) {
  const mal = [];
  const todos = ficheros.flatMap(([f, src]) => bloques(src).map((b) => ({ ...b, f })));
  const pantallas = new Map(todos.filter((b) => b.nombre.startsWith('PAGES')).map((b) => [pagina(b.nombre), b]));
  const fuente = ficheros.map(([, s]) => s).join('\n');
  // 1. Pantallas con formularios repintadas a mano.
  for (const [p, b] of pantallas) {
    if (!ENVIO.test(b.texto) || b.texto.includes('sinDobleEnvio(') || todosConGuarda(b.f, b.texto)) continue;
    const llamada = new RegExp(`PAGES(?:\\.${p.replace(/\$/g, '\\$')}|\\['${p}'\\])\\(`, 'g');
    for (const [f, src] of ficheros) {
      const lineas = src.split('\n');
      lineas.forEach((l, i) => {
        if (!llamada.test(l)) return;
        llamada.lastIndex = 0;
        if (/^\s*return PAGES/.test(l) && bloqueDe(src, i)?.nombre.startsWith('PAGES')) return; // otra pantalla que la abre: la pinta route()
        const cerca = lineas.slice(Math.max(0, i - 2), i + 4).join('\n');
        if (!cerca.includes('sinDobleEnvio(')) mal.push(`${f}:${i + 1}: se repinta «${p}» (tiene formularios) sin sinDobleEnvio`);
      });
    }
  }
  // 2. Funciones que pintan un formulario y se llaman fuera de una pantalla.
  for (const b of todos) {
    if (b.nombre.startsWith('PAGES') || /^[A-Z_]+$/.test(b.nombre) || !ENVIO.test(b.texto) || b.texto.includes('sinDobleEnvio(') || todosConGuarda(b.f, b.texto)) continue;
    if (b.nombre === 'sinDobleEnvio' || b.nombre === 'modal' || b.nombre === 'confirmaIdentidad') continue; // la guarda misma; diálogos que solo resuelven
    const llamada = new RegExp(`\\b${b.nombre}\\(`, 'g');
    for (const [f, src] of ficheros) {
      const lineas = src.split('\n');
      lineas.forEach((l, i) => {
        if (!llamada.test(l)) return;
        llamada.lastIndex = 0;
        if (/^\s*(export )?(async )?function /.test(l)) return;
        const dentro = bloqueDe(src, i);
        const desdePantalla = dentro?.nombre.startsWith('PAGES') && /^\s*(return|if \(.*\) return) /.test(l);
        const cerca = lineas.slice(Math.max(0, i - 2), i + 4).join('\n');
        if (!desdePantalla && !cerca.includes('sinDobleEnvio(')) mal.push(`${f}:${i + 1}: «${b.nombre}» pinta un formulario sin guarda y se llama fuera de una pantalla`);
      });
    }
  }
  void fuente;
  return mal;
}
function bloqueDe(src, linea) {
  const pos = src.split('\n').slice(0, linea).join('\n').length;
  return bloques(src).filter((b) => b.desde <= pos).pop() || null;
}

// «Tu cuenta»: formularios que no mandan nada (sin guarda a propósito).
const NO_MANDAN = [
  ['assets/cuenta/contacto.js', "$('#f-contacto')"], // resuelve la promesa de la pantalla (una vez)
  ['assets/cuenta/reservar_preguntas.js', "$('#f-preguntas')"], // ídem
  ['assets/cuenta/partidos.js', "d.querySelector('form')"], // busca equipos (lo pide busca(), que va por turnos)
  ['assets/cuenta/cuenta.js', 'fa.addEventListener'], // Ajustes › Notificaciones: solo evita que Intro recargue
  ['assets/cuenta/cuenta.js', 'ftel?.addEventListener'], // llama a guardaTel, que va con ocupado()
  // Panel:
  ['panel/partidos.js', "$('form', d).addEventListener('submit'"], // «Elegir siempre»: busca equipos, no guarda nada
  ['panel/panel.js', "$('#form').onsubmit = (e) => e.preventDefault();"], // Publicar: solo evita que Intro recargue
  ['panel/pedir.js', "$('.ped-otro', caja).onsubmit"], // el festivo: llama a responde(), que va con su `ocupado` (§4zzz-revnegocio)
  ['panel/panel.js', "$('#fp', v).onsubmit = (e) => { e.preventDefault(); $('#pone', v).click(); };"], // pulsa «Añadir», que va con enBoton
];
/** El trozo de [lineas] desde [i] hasta que se cierran sus llaves. */
function manejador(lineas, i) {
  let fondo = 0; let empezado = false; const out = [];
  for (const l of lineas.slice(i, i + 150)) {
    out.push(l);
    for (const c of l) { if (c === '{') { fondo++; empezado = true; } else if (c === '}') fondo--; }
    if (empezado && fondo <= 0) break;
  }
  return out.join('\n');
}
export function revisaCuenta(ficheros) {
  const mal = [];
  for (const [f, src] of ficheros) {
    const lineas = src.split('\n');
    lineas.forEach((l, i) => {
      if (!ENVIO.test(l)) return;
      if (NO_MANDAN.some(([ff, trozo]) => ff === f && l.includes(trozo))) return;
      if (!GUARDA.test(manejador(lineas, i))) mal.push(`${f}:${i + 1}: un formulario sin guarda (ocupado(boton, …)): ${l.trim().slice(0, 80)}`);
    });
  }
  return mal;
}

if (process.argv.includes('--prueba')) {
  // Lo que tiene que pillar: una pantalla con formulario repintada a mano y un formulario de «Tu cuenta» sin guarda.
  const panelMalo = [['panel/x.js', "PAGES.x = async (v) => {\n  v.innerHTML = '<form></form>';\n  $('form', v).onsubmit = async () => { await rpc('a'); };\n};\nfunction otra(v) {\n  b.onclick = () => PAGES.x(v);\n}\n"]];
  const panelBien = [['panel/x.js', "PAGES.x = async (v) => {\n  v.innerHTML = '<form></form>';\n  $('form', v).onsubmit = async () => { await rpc('a'); };\n};\nfunction otra(v) {\n  b.onclick = () => { PAGES.x(v); sinDobleEnvio(v); };\n}\n"]];
  const subMalo = [['panel/y.js', "function pintaF(v) {\n  f.onsubmit = async () => { await rpc('a'); };\n}\nPAGES.y = async (v) => {\n  return pintaF(v);\n};\nfunction luego(v) {\n  b.onclick = () => pintaF(v);\n}\n"]];
  const cuentaMala = [['assets/cuenta/z.js', "RUTAS.z = async () => {\n  f.addEventListener('submit', async (ev) => {\n    ev.preventDefault();\n    await llamar('x');\n  });\n};\n"]];
  const cuentaBien = [['assets/cuenta/z.js', "RUTAS.z = async () => {\n  f.addEventListener('submit', (ev) => {\n    ev.preventDefault();\n    ocupado(b, () => llamar('x'));\n  });\n};\n"]];
  const r = [revisaPanel(panelMalo).length === 1, revisaPanel(panelBien).length === 0, revisaPanel(subMalo).length === 1,
    revisaCuenta(cuentaMala).length === 1, revisaCuenta(cuentaBien).length === 0];
  console.log(r.every(Boolean) ? 'la prueba se prueba: bien' : `la prueba se prueba: MAL ${JSON.stringify(r)}`);
  process.exit(r.every(Boolean) ? 0 : 1);
}

const mal = [...revisaPanel(js('panel/')), ...revisaCuenta(js('assets/cuenta/'))];
for (const m of mal) console.log(`  FALLA  ${m}`);
console.log(mal.length ? `\n${mal.length} formularios que se pueden mandar dos veces` : 'doble envío: ningún formulario sin guarda');
process.exit(mal.length ? 1 : 0);
