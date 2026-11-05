// Prueba de lo arreglado el 2026-11-04 con las incoherencias del paquete del
// abogado (lo que no es legal pendiente), en la web local:
//
//  1. Fuentes y licencias (ES y EN): las fuentes de los festivos, una por
//     fila con su licencia y su cita (la del BOE, la que piden sus
//     condiciones), y los mapas (Mapbox y OpenStreetMap, ODbL).
//  2. Para negocios (ES y EN): el orden de serie es «Recomendado» (ya no
//     «el orden lo elige la persona»).
//  3. «Tu cuenta»: la casilla de correos dice «novedades de Klendar», como la
//     privacidad (ya no «ofertas destacadas»), y la pantalla de privacidad se
//     llama «Ajustes → Privacidad y datos» en los ocho idiomas.
//  4. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/incoherencias_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/fuentes/', [
    /Basado en datos de la Agencia Estatal Boletín Oficial del Estado/,
    /Locales de Madrid\s+Ayuntamiento de Madrid, Calendario laboral\s+CC BY 4\.0/,
    /Locales de Cataluña\s+Generalitat de Catalunya, Calendari de festes locals a Catalunya\s+Llicència oberta d’ús d’informació – Catalunya: «Generalitat de Catalunya\. Departament d’Empresa i Treball»/,
    /Locales de Andalucía\s+Junta de Andalucía/,
    /Locales de Aragón\s+Gobierno de Aragón/,
    /Locales de Illes Balears\s+Govern de les Illes Balears/,
    /Locales de Euskadi\s+Gobierno Vasco/,
    /Locales de Castilla y León\s+Junta de Castilla y León/,
    /Mapas\s+Los mapas, las direcciones y las rutas a pie son de Mapbox, con datos de © los colaboradores de OpenStreetMap \(licencia ODbL\)/,
    /El tiempo\s+«Según el tiempo» usa la previsión de MET Norway/,
    /Instituto Geográfico Nacional/,
  ], [/football-data/i]],
  ['/en/sources/', [
    /Basado en datos de la Agencia Estatal Boletín Oficial del Estado/,
    /Local, Madrid\s+Madrid City Council, Calendario laboral\s+CC BY 4\.0/,
    /Local, Catalonia\s+Government of Catalonia/,
    /Local, Andalusia\s+Regional Government of Andalusia/,
    /Local, Basque Country\s+Basque Government/,
    /Maps\s+Maps, addresses and walking routes come from Mapbox, with data © OpenStreetMap contributors \(ODbL licence\)/,
  ], [/football-data/i]],
  ['/para-negocios/', [
    /en la app el orden de serie es «Recomendado» \(el tiempo de hoy, lo más nuevo y los gustos de cada persona\) y cada uno puede cambiarlo en los filtros/,
  ], [/el orden lo elige la persona/]],
  ['/en/for-business/', [
    /in the app the default order is “Recommended” \(today's weather, what's newest and each person's interests\)/,
  ], [/the order is chosen by the person/]],
];

// Lo de «Tu cuenta» se comprueba en el código que se sirve (la casilla solo
// se ve al crear la cuenta).
const CODIGO = [
  ['/assets/cuenta/app.js', [/Quiero recibir novedades de Klendar por correo \(opcional\)\./, /se quita en Ajustes → Privacidad y datos\)\./],
    [/ofertas destacadas/, /se quita en Ajustes → Privacidad\)/]],
  ['/assets/cuenta/amigos.js', [/Puedes apagarlo en Ajustes → Privacidad y datos\./, /Se cambia en Ajustes → Privacidad y datos\./],
    [/Ajustes → Privacidad\.'/]],
  ['/assets/cuenta/cuenta.js', [/No recibes novedades de Klendar por correo/], [/novedades ni promociones/]],
  ['/assets/cuenta/i18n.js', [/"I'd like to receive Klendar news by email \(optional\)\."/, /Settings → Privacy and data\)\."/],
    [/featured offers/]],
  ...['ca', 'gl', 'eu', 'fr', 'it', 'de'].map((l) => [`/assets/cuenta/i18n/${l}.js`,
    [/"Quiero recibir novedades de Klendar por correo \(opcional\)\."/, /"No recibes novedades de Klendar por correo"/],
    [/ofertas destacadas/, /novedades ni promociones/, /Ajustes → Privacidad\.":/]]),
];

for (const [ruta, esperas, nunca] of CODIGO) {
  const r = await fetch(`${BASE}${ruta}`);
  const txt = await r.text();
  ok(r.status === 200, `${ruta}: 200`);
  for (const re of esperas) ok(re.test(txt), `${ruta}: ${re.source.slice(0, 70)}`);
  for (const re of nunca) ok(!re.test(txt), `${ruta}: ya no dice ${re.source}`);
}

async function paginas(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, esperas, nunca] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: ya no dice ${re.source}`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  ok(errores.length === 0, `${nombre}/${t}: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    await paginas(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
