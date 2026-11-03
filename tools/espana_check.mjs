// «Toda España preparada» en la web (2026-11-03): «Busca tu municipio» en
// «¿Dónde?», las páginas de municipio con su slug (301 desde las variantes y
// las direcciones de antes, «¿Cuál de ellos?» con un homónimo) y el sitemap.
// Contra un servidor en marcha (con la base de dev, que tiene la tabla):
//
//   PORT=8797 node tools/serve_dev.mjs
//   BASE=http://localhost:8797 node tools/espana_check.mjs
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:8788';
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
  check('y el script del buscador', h.includes('/assets/municipios.js'));
  const h2 = await texto('/descubre/?ciudad=Alca%C3%B1iz');
  check('un nombre escrito (con tilde) también vale', /chip-t">Alcañiz</.test(h2));
  const en = await texto('/en/discover/?city=alcaniz');
  check('en inglés: «Find your town» y «Popular»', en.includes('Find your town') && en.includes('>Popular<'));
}
// El sitemap: con datos de prueba sale vacío, pero no se rompe.
{
  const r = await pide('/sitemap-agenda.xml');
  check('sitemap-agenda.xml contesta', r.status === 200, r.status);
}
assert.ok(total > 0);
console.log(`\n${bien}/${total} comprobaciones`);
process.exit(bien === total ? 0 : 1);
