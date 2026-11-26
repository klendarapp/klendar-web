// Revisión general, parte 3 (§4zzz-revnegocio de la app): el panel del
// negocio sin dobles envíos, sin cámaras encendidas de más, sin «Deshacer»
// que toque otro local, sin altas repetidas y sin pintar en otra pantalla.
// Sin navegador ni red: lee el panel.
//
//   node tools/revnegocio_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const leer = (f) => readFileSync(new URL(f, raiz), 'utf8');
const panel = leer('panel/panel.js');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};
/** Desde [desde] hasta la siguiente función o página de arriba del todo. */
const trozo = (src, desde) => {
  const a = src.indexOf(desde);
  if (a < 0) return '';
  const resto = src.slice(a + desde.length);
  const m = resto.search(/\n(PAGES[.[]|async function |function )/);
  return desde + (m < 0 ? resto : resto.slice(0, m));
};

// Sellos: cada botón una vez cada vez y Enter no recarga la página.
const persona = trozo(panel, 'async function tarjetaClientes');
for (const id of ['pone', 'quita', 'da', 'cero']) {
  ok(`sellos: #${id} con enBoton`, new RegExp(`\\$\\('#${id}', v\\)\\.onclick = \\(e\\) => enBoton\\(e\\.currentTarget`).test(persona));
}
ok('sellos: Enter en «¿Cuántos sellos?» suma', /\$\('#fp', v\)\.onsubmit = \(e\) => \{ e\.preventDefault\(\); \$\('#pone', v\)\.click\(\); \}/.test(persona));

// Encargos: el formulario del producto, una vez; la foto se espera.
const enc = trozo(leer('panel/encargos.js'), "PAGES['encargos-cosas']");
const encTodo = leer('panel/encargos.js');
ok('encargos: sinDobleEnvio en el formulario que se pinta al tocar', /f\.onsubmit = async[\s\S]*sinDobleEnvio\(caja\);/.test(encTodo));
ok('encargos: «Crear» espera a la foto que sube', encTodo.includes('if (subiendo) await subiendo;'));
ok('encargos: «Foto lista» solo si ha subido', encTodo.includes("if (url) { foto = url; toast(bi('Foto lista', 'Photo ready')); }"));
void enc;

// Cámara: un turno por arranque; parar mientras pide permiso.
const camara = trozo(panel, 'async function escanerQR');
ok('cámara: se apaga si se ha salido mientras pedía permiso', camara.includes("if (!sigue()) { flujo.getTracks().forEach((t) => t.stop()); return null; }"));
ok('cámara: paraCamara cambia de turno', /function paraCamara\(\) \{\n  CAMARA_TURNO\+\+;/.test(panel));
ok('cámara: «Parar» también mientras arranca', panel.includes('if (PARA_CAMARA || CAMARA_ARRANCA) {'));

// Cerrar por hoy: «Deshacer» del local de entonces.
const cerrado = trozo(panel, 'async function cambiaCerradoHoy');
ok('cerrar por hoy: el negocio es un parámetro', cerrado.includes('{ deshacer = true, negocio = BIZ.id } = {}'));
ok('cerrar por hoy: «Deshacer» lleva el de entonces', cerrado.includes('{ deshacer: false, negocio }'));

// Altas: no se repiten al reintentar.
ok('alta de negocio: tras crearlo, no se vuelve a crear', /let creado = null;[\s\S]*const id = creado = await rpc\('register_business'[\s\S]*if \(creado\) \{ location\.assign\('\/panel\/negocio'\); return; \}/.test(leer('panel/ficha.js')));
ok('alta de entidad: igual', /creado = true;[\s\S]*if \(creado\) \{ location\.assign\('\/panel\/hoy'\); return; \}/.test(leer('panel/entidades.js')));

// Validar sin conexión: uno a la vez en toda la página y sin perder los nuevos.
ok('cola sin conexión: bandera de la página', panel.includes('window.KL_COLA_ENVIANDO = true;') && !/let enviando = false;\n  const enviaCola/.test(panel));
ok('cola sin conexión: los guardados mientras tanto se quedan', panel.includes('guardaCola([...quedan, ...nuevos]);'));

// Festivo y menú del día.
const pedir = leer('panel/pedir.js');
ok('festivo: una respuesta cada vez', pedir.includes('if (ocupado) return;') && pedir.includes('const respondeYa = async'));
const mesa = leer('panel/mesa.js');
ok('menú del día: «Publicar» espera a la foto', mesa.includes('await subiendo.catch(() => null);'));

// Repintados que no pasan por route().
ok('grupos: propuesta y «No podemos» con enBoton', /data-propuesta[\s\S]{0,200}enBoton\(b,/.test(leer('panel/grupos.js')) && /data-no-podemos[\s\S]{0,120}enBoton\(b, async/.test(leer('panel/grupos.js')));
ok('grupos: sinDobleEnvio al repintarse', /sinDobleEnvio\(v\);\n\};/.test(trozo(leer('panel/grupos.js'), 'PAGES.grupos = async (v) => {')));
ok('habituales: sinDobleEnvio al repintarse', trozo(leer('panel/fidelizar.js'), 'PAGES.habituales = async (v) => {').includes('sinDobleEnvio(v);'));
ok('bonos: sinDobleEnvio al repintarse', trozo(leer('panel/bonos.js'), 'async function bonoForm(v, id) {').includes('sinDobleEnvio(v);'));

// Lo escrito por el negocio, escapado en el diálogo.
ok('habituales: el regalo, escapado', leer('panel/fidelizar.js').includes('esc(bi(`Recibirán «${regalo}»'));

// Publicar y Equipo pintan en su pantalla, no en la que haya.
ok('publicar: #list, #filtroArch y #vistaSw de su pantalla', !/\$\('#(list|filtroArch|vistaSw)'\)/.test(trozo(panel, 'PAGES.publicar = async (v) => {')));
ok('equipo: #list de su pantalla', !/\$\('#list'\)/.test(trozo(panel, 'PAGES.equipo = async (v) => {')));

if (fallos) { console.log(`\n${fallos} fallo(s)`); process.exit(1); }
console.log('\nTodo bien');
