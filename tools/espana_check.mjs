// «Toda España preparada» en la web (2026-11-03): «Busca tu municipio» en
// «¿Dónde?», las páginas de municipio con su slug (301 desde las variantes y
// las direcciones de antes, «¿Cuál de ellos?» con un homónimo), el enlace de la
// ficha de un negocio a la página de su municipio y el sitemap.
// Contra un servidor en marcha (con la base de dev, que tiene la tabla):
//
//   SUPABASE_BLOQUEADO=1 PORT=8797 node tools/serve_dev.mjs
//   BASE=http://localhost:8797 node tools/espana_check.mjs
import assert from 'node:assert/strict';
import { servidorSeguro } from './_supabase_simulado.mjs';

const BASE = process.env.BASE || 'http://localhost:8788';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let bien = 0;
let total = 0;
const check = (nombre, ok, detalle = '') => {
  total += 1;
  if (ok) bien += 1;
  console.log(`${ok ? '  ok ' : '  MAL'}  ${nombre}${ok ? '' : `  ${String(detalle).slice(0, 300)}`}`);
};
const pide = (ruta) => fetch(BASE + ruta, { redirect: 'manual' });
const texto = async (ruta) => (await pide(ruta)).text();

// Las variantes y lo de antes, a la dirección buena (301).
for (const [ruta, destino] of [
  ['/hoy/coruna/', '/hoy/a-coruna/'], ['/hoy/M%C3%A1laga/', '/hoy/malaga/'], ['/agenda/Madrid/', '/agenda/madrid/'],
  ['/agenda/san-sebastian/', '/agenda/donostia-san-sebastian/'], ['/agenda/donostia/', '/agenda/donostia-san-sebastian/'],
  ['/en/whats-on/elche/', '/en/whats-on/elx-elche/'], ['/con-ninos/coruna/', '/con-ninos/a-coruna/'],
  ['/agenda/santa%20cruz%20de%20tenerife/', '/agenda/santa-cruz-de-tenerife/'],
  // Las cuatro Ciudades de Klendar de 2026-11-03: su id y otros nombres.
  ['/hoy/laspalmas/', '/hoy/las-palmas-de-gran-canaria/'], ['/hoy/las-palmas/', '/hoy/las-palmas-de-gran-canaria/'],
  ['/hoy/hospitalet/', '/hoy/l-hospitalet-de-llobregat/'], ['/hoy/gasteiz/', '/hoy/vitoria-gasteiz/'],
  ['/hoy/vitoria/', '/hoy/vitoria-gasteiz/'], ['/hoy/santa-cruz/', '/hoy/santa-cruz-de-tenerife/'],
]) {
  const r = await pide(ruta);
  const loc = new URL(r.headers.get('location') || '/', BASE).pathname;
  check(`${decodeURIComponent(ruta)} → 301 ${destino}`, r.status === 301 && loc === destino, `${r.status} ${loc}`);
}
// La buena, sin redirigir.
{
  const r = await pide('/agenda/madrid/');
  check('/agenda/madrid/ es la buena (200)', r.status === 200, r.status);
}
// Un homónimo sin provincia: elegir, sin indexar.
{
  const r = await pide('/hoy/torrent/');
  const h = await r.text();
  check('/hoy/torrent/: «¿Cuál de ellos?» con los dos, sin indexar',
    r.status === 200 && h.includes('href="/hoy/torrent-valencia/"') && h.includes('href="/hoy/torrent-girona/"') && h.includes('noindex'), r.status);
}
// «¿Dónde?» › Una ciudad: el buscador, «Todas las ciudades» y las Populares.
{
  const h = await texto('/descubre/?ciudad=alcaniz');
  check('Descubre en Alcañiz: la fila dice «Alcañiz»', /chip-t">Alcañiz</.test(h));
  check('«Busca tu municipio» con su enlace por slug', h.includes('data-muni-busca') && h.includes('data-muni-href="/descubre/?ciudad=__SLUG__"'));
  check('sin JavaScript, el formulario manda el nombre', /<input type="search" name="ciudad"/.test(h));
  check('las «Populares»: las Ciudades de Klendar por su slug', h.includes('>Populares<') && h.includes('href="/descubre/?ciudad=madrid"'));
  const nuevas = ['las-palmas-de-gran-canaria', 'l-hospitalet-de-llobregat', 'vitoria-gasteiz', 'santa-cruz-de-tenerife'];
  check('… con las cuatro de 2026-11-03', nuevas.every((s) => h.includes(`href="/descubre/?ciudad=${s}"`)), nuevas.filter((s) => !h.includes(`href="/descubre/?ciudad=${s}"`)));
  const pos = (s) => h.indexOf(`href="/descubre/?ciudad=${s}"`);
  check('… en su orden (Palma, Las Palmas, Bilbao)', pos('palma') < pos('las-palmas-de-gran-canaria') && pos('las-palmas-de-gran-canaria') < pos('bilbao'));
  check('y el script del buscador', h.includes('/assets/municipios.js'));
  const h2 = await texto('/descubre/?ciudad=Alca%C3%B1iz');
  check('un nombre escrito (con tilde) también vale', /chip-t">Alcañiz</.test(h2));
  const en = await texto('/en/discover/?city=alcaniz');
  check('en inglés: «Find your town» y «Popular»', en.includes('Find your town') && en.includes('>Popular<'));
}
// La ficha de un negocio enlaza a la página de su municipio, por su slug
// (`business_municipality_info`, migración 20261260100040 de la app): el
// nombre bajo el título, las migas y «Más planes en …», en los dos idiomas.
// Las direcciones son las buenas (200, sin 301).
for (const [ruta, hoy, semana, frase, descubre] of [
  ['/b/nails-co-madrid', '/hoy/madrid/', '/agenda/madrid/', 'Más planes en Madrid', '/descubre/?ciudad=madrid&visita=1'],
  ['/en/b/nails-co-madrid', '/en/today/madrid/', '/en/whats-on/madrid/', 'More plans in Madrid', '/en/discover/?city=madrid&visit=1'],
]) {
  const h = await texto(ruta);
  check(`${ruta}: el municipio bajo el título enlaza a ${hoy}`, h.includes(`class="neg-muni" href="${hoy}"`));
  // Como en la app: Descubre en ese municipio, por el slug, solo para esa
  // visita (tools/mas_planes_visita_check.mjs).
  check(`${ruta}: «${frase}» lleva a ${descubre}`,
    h.includes(`data-municipio="madrid"><a class="pill" href="${descubre.replace('&', '&amp;')}">`) && h.includes(`<span>${frase}</span></a>`));
  check(`${ruta}: las migas, a ${semana}`, h.includes(`<p class="crumbs"><a href="/${ruta.startsWith('/en/') ? 'en/' : ''}">Klendar</a> · <a href="${semana}">Madrid</a>`));
  for (const destino of [hoy, semana, descubre]) {
    const r = await pide(destino);
    check(`${destino} es la buena (200, sin redirigir)`, r.status === 200, r.status);
  }
}

// Las páginas de las cuatro nuevas: la agenda con su nombre; «Hoy» como
// la de cualquier ciudad sin planes (Salamanca en dev: 404 hasta que haya).
{
  const hoySin = (await pide('/hoy/salamanca/')).status;
  for (const [slug, nombre] of [['las-palmas-de-gran-canaria', 'Las Palmas de Gran Canaria'],
    ['l-hospitalet-de-llobregat', "L'Hospitalet de Llobregat"], ['vitoria-gasteiz', 'Vitoria-Gasteiz'],
    ['santa-cruz-de-tenerife', 'Santa Cruz de Tenerife']]) {
    const r = await pide(`/agenda/${slug}/`);
    const h = (await r.text()).replace(/&#39;|&#x27;|&apos;/g, "'");
    check(`/agenda/${slug}/ (200, «${nombre}»)`, r.status === 200 && h.includes(nombre), r.status);
    const s = (await pide(`/hoy/${slug}/`)).status;
    check(`/hoy/${slug}/ como Salamanca (${hoySin})`, s === hoySin, s);
  }
}
// El sitemap: con datos de prueba sale vacío, pero no se rompe.
{
  const r = await pide('/sitemap-agenda.xml');
  check('sitemap-agenda.xml contesta', r.status === 200, r.status);
}
assert.ok(total > 0);
console.log(`\n${bien}/${total} comprobaciones`);
process.exit(bien === total ? 0 : 1);
