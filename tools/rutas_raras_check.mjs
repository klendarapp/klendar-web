// Revisión general, parte 4 (§4zzz-revweb): direcciones raras de la web
// pública (un id inventado, una ciudad mal escrita, parámetros rotos) no dan
// nunca un 5xx, y lo que no existe da 404, no una página de mentira. Con
// datos de mentira, sin navegador (unos s).
//
//   node tools/rutas_raras_check.mjs
import { webConDatos, NEGOCIOS } from './_web_con_datos.mjs';
import { fetchLocal } from './_supabase_simulado.mjs';

const web = await webConDatos({ puerto: 8993 });
let fallos = 0;
const ok = (nombre, cond, extra = '') => { console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}${cond || !extra ? '' : ` (${extra})`}`); if (!cond) fallos++; };
// [ruta, estado esperado (null: cualquiera menos 5xx)]
const RUTAS = [
  ['/b/xyz', 404], ['/hoy/xyz', 404], ['/agenda/xyz', 404], ['/agenda/madrid/xyz', 404], ['/provincia/xyz', 404], ['/guia/xyz', 404],
  ['/coleccion/xyz', 404], ['/con-ninos/xyz', 404], ['/ofertas/xyz', 404], ['/a/xyz', 404], ['/cola/xyz', 404], ['/m/xyz', 404],
  ['/listo/xyz', 404], ['/cartel/xyz', 404], ['/amigo/xyz', 404], ['/rp/xyz', 404], ['/en/b/xyz', 404], ['/en/today/xyz', 404],
  ['/en/whats-on/xyz', 404], ['/o/00000000-0000-4000-8000-000000000000', 404], ['/o/no-es-un-id', 404],
  ['/agenda/madrid', 200], ['/agenda/teruel', 200], ['/hoy/madrid', 200], [`/b/${NEGOCIOS[0].slug}`, 200],
  ['/partidos?equipo=xyz', null], ['/explorar?ciudad=xyz', null], ['/explorar?celda=zzz', null], ['/explorar?celda=999999999', null],
  ['/explorar?p=999', null], ['/explorar?p=-1', null], ['/explorar?p=abc', null], ['/explorar?cuando=zzz', null], ['/explorar?cat=zzz', null],
  [`/explorar?q=${'a'.repeat(500)}`, null], ['/explorar?que=zzz', null], ['/explorar?vista=zzz', null], ['/explorar?precio=-5', null],
  ['/explorar?distancia=abc', null], ['/explorar?dia=2026-13-45', null], ['/explorar?vista=calendario&mes=2026-99', null],
  ['/explorar?lat=999&lng=999', null], ['/descubre?p=abc', null], ['/descubre?p=99', null], ['/descubre?ciudad=xyz', null],
  ['/descubre?celda=-1', null], ['/hoy/madrid?p=abc', null], ['/grupos?celda=zz', null], ['/sorteo/xyz', null], ['/baja/xyz', null],
  ['/avisame/confirmar/xyz', null], ['/avisame/baja/xyz', null], ['/c/xyz', null], ['/r/xyz', null], ['/v/xyz', null], ['/tv/xyz', null],
  ['/historia/xyz', null], ['/cal/xyz', null], ['/widget/xyz', null], ['/b/%E0%A4%A', null], ['/hoy/%ZZ', null],
];
for (const [ruta, espera] of RUTAS) {
  let estado;
  try { estado = (await fetchLocal(web.BASE + ruta, { redirect: 'manual' })).status; } catch (e) { estado = `error: ${e.message}`; }
  ok(`${ruta.slice(0, 50)} → ${espera ?? 'sin 5xx'}`, espera == null ? typeof estado === 'number' && estado < 500 : estado === espera, String(estado));
}
await web.cierra();
console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
