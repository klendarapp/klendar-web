// «Toda España preparada» en la web (2026-11-03): «Busca tu municipio» en
// «¿Dónde?», las páginas de municipio con su slug (301 desde las variantes y
// las direcciones de antes, «¿Cuál de ellos?» con un homónimo), el enlace de la
// ficha de un negocio a la página de su municipio y el sitemap.
//
// Con sus propios datos (tools/_web_con_datos.mjs): los municipios de abajo,
// con sus slugs y sus otros nombres, y `resolve_municipality` /
// `search_municipalities` como en la base (migración 20261260100005 de la
// app). Antes iba contra la tabla de dev y, desde que las pruebas no llegan
// a Supabase (5-11), fallaba siempre.
//
//   node tools/espana_check.mjs
import assert from 'node:assert/strict';
import { DATOS, webConDatos } from './_web_con_datos.mjs';

// ── Los municipios ────────────────────────────────────────────────────────
// Como `municipality_json` (más `aliases`, `population` y la posición de su
// Ciudad de Klendar, que solo usa este falso). Las Ciudades de Klendar, en
// su orden (`cities.position`): son las «Populares».
const MUNI = (code, slug, name, province, lat, lng, { ciudad = null, pos = null, aliases = [], population = 10000 } = {}) => ({
  code, slug, name, province, lat, lng, radius_m: ciudad ? 25000 : 10000, city_id: ciudad, popular: Boolean(ciudad),
  aliases, population, pos,
});
const MUNICIPIOS = [
  MUNI('28079', 'madrid', 'Madrid', 'Madrid', 40.4168, -3.7038, { ciudad: 'madrid', pos: 1, population: 3300000 }),
  MUNI('08019', 'barcelona', 'Barcelona', 'Barcelona', 41.3874, 2.1686, { ciudad: 'barcelona', pos: 2, population: 1660000 }),
  MUNI('29067', 'malaga', 'Málaga', 'Málaga', 36.7213, -4.4214, { ciudad: 'malaga', pos: 3, population: 580000 }),
  MUNI('15030', 'a-coruna', 'A Coruña', 'A Coruña', 43.3623, -8.4115, { ciudad: 'coruna', pos: 4, aliases: ['coruna', 'la-coruna'], population: 245000 }),
  MUNI('07040', 'palma', 'Palma', 'Illes Balears', 39.5696, 2.6502, { ciudad: 'palma', pos: 5, aliases: ['palma-de-mallorca'], population: 420000 }),
  MUNI('35016', 'las-palmas-de-gran-canaria', 'Las Palmas de Gran Canaria', 'Las Palmas', 28.1235, -15.4363,
    { ciudad: 'laspalmas', pos: 6, aliases: ['laspalmas', 'las-palmas'], population: 380000 }),
  MUNI('48020', 'bilbao', 'Bilbao', 'Bizkaia', 43.2630, -2.9350, { ciudad: 'bilbao', pos: 7, population: 345000 }),
  MUNI('08101', 'l-hospitalet-de-llobregat', "L'Hospitalet de Llobregat", 'Barcelona', 41.3596, 2.0997,
    { ciudad: 'hospitalet', pos: 8, aliases: ['hospitalet'], population: 265000 }),
  MUNI('01059', 'vitoria-gasteiz', 'Vitoria-Gasteiz', 'Araba/Álava', 42.8467, -2.6716,
    { ciudad: 'vitoria', pos: 9, aliases: ['vitoria', 'gasteiz'], population: 255000 }),
  MUNI('38038', 'santa-cruz-de-tenerife', 'Santa Cruz de Tenerife', 'Santa Cruz de Tenerife', 28.4636, -16.2518,
    { ciudad: 'santacruz', pos: 10, aliases: ['santa-cruz'], population: 210000 }),
  MUNI('20069', 'donostia-san-sebastian', 'Donostia / San Sebastián', 'Gipuzkoa', 43.3183, -1.9812,
    { aliases: ['donostia', 'san-sebastian'], population: 188000 }),
  MUNI('03065', 'elx-elche', 'Elx / Elche', 'Alacant/Alicante', 38.2699, -0.7126, { aliases: ['elche', 'elx'], population: 235000 }),
  MUNI('46244', 'torrent-valencia', 'Torrent', 'Valencia/València', 39.4371, -0.4655, { aliases: ['torrent'], population: 85000 }),
  MUNI('17199', 'torrent-girona', 'Torrent', 'Girona', 41.9531, 3.1272, { aliases: ['torrent'], population: 180 }),
  MUNI('44013', 'alcaniz', 'Alcañiz', 'Teruel', 41.0511, -0.1336, { population: 16000 }),
  MUNI('37274', 'salamanca', 'Salamanca', 'Salamanca', 40.9701, -5.6635, { population: 144000 }),
];
// Lo que devuelve la base: sin lo que solo usa este falso.
const json = ({ aliases, population, pos, ...m }) => m;
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// `public.slugify`: sin tildes ni mayúsculas, lo demás a guiones.
const slugify = (s) => plano(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Un negocio de Madrid (su ficha enlaza a la página de su municipio).
const NAILS = {
  ...DATOS.NEGOCIOS[0], id: 'b9000000-0000-4000-8000-0000000000e5', name: 'Nails & Co', slug: 'nails-co-madrid',
  category_id: DATOS.CATEGORIAS.find((c) => c.slug === 'beauty').id, category_slug: 'beauty',
};
const web = await webConDatos({
  puerto: Number(process.env.PORT || 9004),
  datos: { ...DATOS, NEGOCIOS: [...DATOS.NEGOCIOS, NAILS], MUNICIPIOS },
  rpc: {
    // Como en la base: el slug bueno ('slug'), otro de sus nombres ('alias',
    // 301) o un homónimo sin provincia ('choice', a elegir).
    resolve_municipality: (a) => {
      const s = slugify(String(a.p_slug || '').slice(0, 80));
      if (!s) return [];
      const m = MUNICIPIOS.find((x) => x.slug === s);
      if (m) return [{ municipality: json(m), match: 'slug' }];
      const l = MUNICIPIOS.filter((x) => x.aliases.includes(s)).sort((x, y) => y.population - x.population);
      return l.map((x) => ({ municipality: json(x), match: l.length === 1 ? 'alias' : 'choice' }));
    },
    // Sin texto, las «Populares» (las Ciudades de Klendar, en su orden); con
    // texto, los que tienen una palabra que empieza así.
    search_municipalities: (a) => {
      const q = slugify(a.p_q || '').replace(/-/g, ' ');
      if (!q) return MUNICIPIOS.filter((m) => m.city_id).sort((x, y) => x.pos - y.pos).map(json);
      return MUNICIPIOS.filter((m) => ` ${slugify(m.name).replace(/-/g, ' ')}`.includes(` ${q}`))
        .sort((x, y) => y.population - x.population).slice(0, Number(a.p_limit) || 8).map(json);
    },
    business_municipality_info: (a) => (a.p_business === NAILS.id ? json(MUNICIPIOS[0]) : null),
  },
});
const BASE = web.BASE;
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
  ['/hoy/coruna', '/hoy/a-coruna'], ['/hoy/M%C3%A1laga', '/hoy/malaga'], ['/agenda/Madrid', '/agenda/madrid'],
  ['/agenda/san-sebastian', '/agenda/donostia-san-sebastian'], ['/agenda/donostia', '/agenda/donostia-san-sebastian'],
  ['/en/whats-on/elche', '/en/whats-on/elx-elche'], ['/con-ninos/coruna', '/con-ninos/a-coruna'],
  ['/agenda/santa%20cruz%20de%20tenerife', '/agenda/santa-cruz-de-tenerife'],
  // Las cuatro Ciudades de Klendar de 2026-11-03: su id y otros nombres.
  ['/hoy/laspalmas', '/hoy/las-palmas-de-gran-canaria'], ['/hoy/las-palmas', '/hoy/las-palmas-de-gran-canaria'],
  ['/hoy/hospitalet', '/hoy/l-hospitalet-de-llobregat'], ['/hoy/gasteiz', '/hoy/vitoria-gasteiz'],
  ['/hoy/vitoria', '/hoy/vitoria-gasteiz'], ['/hoy/santa-cruz', '/hoy/santa-cruz-de-tenerife'],
]) {
  const r = await pide(ruta);
  const loc = new URL(r.headers.get('location') || '/', BASE).pathname;
  check(`${decodeURIComponent(ruta)} → 301 ${destino}`, r.status === 301 && loc === destino, `${r.status} ${loc}`);
}
// La buena, sin redirigir.
{
  const r = await pide('/agenda/madrid');
  check('/agenda/madrid/ es la buena (200)', r.status === 200, r.status);
}
// Un homónimo sin provincia: elegir, sin indexar.
{
  const r = await pide('/hoy/torrent');
  const h = await r.text();
  check('/hoy/torrent/: «¿Cuál de ellos?» con los dos, sin indexar',
    r.status === 200 && h.includes('href="/hoy/torrent-valencia"') && h.includes('href="/hoy/torrent-girona"') && h.includes('noindex'), r.status);
}
// «¿Dónde?» › Una ciudad: el buscador, «Todas las ciudades» y las Populares.
{
  const h = await texto('/descubre?ciudad=alcaniz');
  check('Descubre en Alcañiz: la fila dice «Alcañiz»', /chip-t">Alcañiz</.test(h));
  check('«Busca tu municipio» con su enlace por slug', h.includes('data-muni-busca') && h.includes('data-muni-href="/descubre?ciudad=__SLUG__"'));
  check('sin JavaScript, el formulario manda el nombre', /<input type="search" name="ciudad"/.test(h));
  check('las «Populares»: las Ciudades de Klendar por su slug', h.includes('>Populares<') && h.includes('href="/descubre?ciudad=madrid"'));
  const nuevas = ['las-palmas-de-gran-canaria', 'l-hospitalet-de-llobregat', 'vitoria-gasteiz', 'santa-cruz-de-tenerife'];
  check('… con las cuatro de 2026-11-03', nuevas.every((s) => h.includes(`href="/descubre?ciudad=${s}"`)), nuevas.filter((s) => !h.includes(`href="/descubre?ciudad=${s}"`)));
  const pos = (s) => h.indexOf(`href="/descubre?ciudad=${s}"`);
  check('… en su orden (Palma, Las Palmas, Bilbao)', pos('palma') < pos('las-palmas-de-gran-canaria') && pos('las-palmas-de-gran-canaria') < pos('bilbao'));
  check('y el script del buscador', h.includes('/assets/municipios.js'));
  const h2 = await texto('/descubre?ciudad=Alca%C3%B1iz');
  check('un nombre escrito (con tilde) también vale', /chip-t">Alcañiz</.test(h2));
  const en = await texto('/en/discover?city=alcaniz');
  check('en inglés: «Find your town» y «Popular»', en.includes('Find your town') && en.includes('>Popular<'));
}
// La ficha de un negocio enlaza a la página de su municipio, por su slug
// (`business_municipality_info`, migración 20261260100040 de la app): el
// nombre bajo el título, las migas y «Más planes en …», en los dos idiomas.
// Las direcciones son las buenas (200, sin 301).
for (const [ruta, hoy, semana, frase, descubre] of [
  ['/b/nails-co-madrid', '/hoy/madrid', '/agenda/madrid', 'Más planes en Madrid', '/descubre?ciudad=madrid&visita=1'],
  ['/en/b/nails-co-madrid', '/en/today/madrid', '/en/whats-on/madrid', 'More plans in Madrid', '/en/discover?city=madrid&visit=1'],
]) {
  const h = await texto(ruta);
  check(`${ruta}: el municipio bajo el título enlaza a ${hoy}`, h.includes(`class="neg-muni" href="${hoy}"`));
  // Como en la app: Descubre en ese municipio, por el slug, solo para esa
  // visita (tools/mas_planes_visita_check.mjs).
  check(`${ruta}: «${frase}» lleva a ${descubre}`,
    h.includes(`data-municipio="madrid"><a class="pill" href="${descubre.replace('&', '&amp;')}">`) && h.includes(`<span>${frase}</span></a>`));
  check(`${ruta}: las migas, a ${semana}`, h.includes(`<p class="crumbs"><a href="${ruta.startsWith('/en/') ? '/en' : '/'}">Klendar</a> · <a href="${semana}">Madrid</a>`));
  for (const destino of [hoy, semana, descubre]) {
    const r = await pide(destino);
    check(`${destino} es la buena (200, sin redirigir)`, r.status === 200, r.status);
  }
}

// Las páginas de las cuatro nuevas: la agenda con su nombre; «Hoy» como
// la de cualquier municipio sin planes (Salamanca: la página vacía, sin indexar).
{
  const hoySin = (await pide('/hoy/salamanca')).status;
  for (const [slug, nombre] of [['las-palmas-de-gran-canaria', 'Las Palmas de Gran Canaria'],
    ['l-hospitalet-de-llobregat', "L'Hospitalet de Llobregat"], ['vitoria-gasteiz', 'Vitoria-Gasteiz'],
    ['santa-cruz-de-tenerife', 'Santa Cruz de Tenerife']]) {
    const r = await pide(`/agenda/${slug}`);
    const h = (await r.text()).replace(/&#39;|&#x27;|&apos;/g, "'");
    check(`/agenda/${slug}/ (200, «${nombre}»)`, r.status === 200 && h.includes(nombre), r.status);
    const s = (await pide(`/hoy/${slug}`)).status;
    check(`/hoy/${slug}/ como Salamanca (${hoySin})`, s === hoySin, s);
  }
}
// El sitemap: con datos de prueba sale vacío, pero no se rompe.
{
  const r = await pide('/sitemap-agenda.xml');
  check('sitemap-agenda.xml contesta', r.status === 200, r.status);
}
assert.ok(total > 0);
await web.cierra();
console.log(`\n${bien}/${total} comprobaciones`);
process.exit(bien === total ? 0 : 1);
