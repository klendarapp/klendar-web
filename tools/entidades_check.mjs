// Prueba de la tanda B (entidades y agenda pública) en la web local:
// la ficha de un evento importado (sello, «Fuente», todo el día, noindex),
// Explorar con el filtro «Agenda pública», «Fuentes y licencias» y la ficha
// de la cuenta «Agenda pública de Madrid», en Chromium y WebKit, móvil y
// escritorio. Guarda capturas en OUT.
//
// Con sus propios datos (tools/_web_con_datos.mjs): un evento importado de
// la «Agenda pública de Madrid» con su fuente (`offer_source`, con la forma
// de la migración 20261130100001 de la app). Antes leía un evento de dev
// (OFFER=) y, desde que las pruebas no llegan a Supabase (5-11), fallaba
// siempre.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/entidades_check.mjs
import { playwright } from './_supabase_simulado.mjs';
import { DATOS, webConDatos } from './_web_con_datos.mjs';

// Playwright no es dependencia del repo: el de la caché de npx (PW=ruta) o el instalado.
const { chromium, webkit } = playwright();

// La cuenta de la agenda es una entidad «Agenda pública» (como la crea el
// sistema), y un evento suyo importado y de todo el día.
const NEGOCIOS = DATOS.NEGOCIOS.map((b) => (b.organizer && b.entity_kind ? { ...b, entity_kind: 'public_agenda' } : b));
const AGENDA = NEGOCIOS.find((b) => b.entity_kind === 'public_agenda');
const EVENTO = DATOS.PLANES.find((o) => o.imported && o.all_day && o.business_id === AGENDA.id);
const OFFER = EVENTO.id;
// Lo que da `offer_source` (la fuente de Madrid de la migración).
const FUENTE = {
  source_id: 'madrid', publisher: 'Ayuntamiento de Madrid', site: 'datos.madrid.es',
  dataset_name: 'Actividades culturales y de ocio municipal en los próximos 100 días',
  dataset_url: 'https://datos.madrid.es/dataset/206974-0-agenda-eventos-culturales-100',
  license: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/deed.es',
  attribution_es: 'Fuente: Ayuntamiento de Madrid, datos.madrid.es', attribution_en: 'Source: Madrid City Council, datos.madrid.es',
  source_url: 'https://datos.madrid.es/agenda/evento-de-prueba', updated_at: new Date().toISOString(), edited: false,
};
// Los de una entidad (`traits: ['entity']`, «Agenda pública»): solo esos.
const deEntidad = (o) => Boolean(NEGOCIOS.find((b) => b.id === o.business_id)?.entity_kind);
const web = await webConDatos({
  puerto: Number(process.env.PORT || 9000),
  datos: { ...DATOS, NEGOCIOS },
  rpc: {
    offer_source: (a) => (DATOS.PLANES.find((o) => o.id === a.p_offer)?.imported ? FUENTE : null),
    // Con «Agenda pública», solo lo de las entidades (lo demás, sin filtrar:
    // aquí se mira que la web lo pida y lo pinte, no la búsqueda de la base).
    public_explore: (a) => {
      const l = DATOS.PLANES.filter((o) => !(a.p_filters?.traits || []).includes('entity') || deEntidad(o));
      return { items: l.slice(0, Number(a.p_limit) || 24), total: l.length };
    },
  },
});
const BASE = web.BASE;
// Las capturas, en tools/out/ (git las ignora): en la raíz se publicaban
// en klendar.app (revisión del 3-11-2026, 5.4).
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const p = await nav.newPage({ viewport: vp });
    const errores = [];
    p.on('pageerror', (e) => errores.push(e.message));

    await p.goto(`${BASE}/o/${OFFER}`, { waitUntil: 'networkidle' });
    const html = await p.content();
    // El sello (`.badge-entidad`), no solo el nombre de la cuenta («Agenda pública de Madrid»).
    ok(/class="badge badge-entidad"[^>]*>(?:(?!<\/span>)[\s\S])*Agenda pública<\/span>/.test(html), `${nombre}/${t} ficha: sello «Agenda pública»`);
    ok(html.includes('Fuente: Ayuntamiento de Madrid, datos.madrid.es'), `${nombre}/${t} ficha: atribución`);
    ok(html.includes('CC BY 4.0'), `${nombre}/${t} ficha: licencia`);
    ok(/name="robots" content="noindex/.test(html), `${nombre}/${t} ficha: noindex`);
    ok(!/00:00/.test(await p.locator('.ficha-datos').innerText()), `${nombre}/${t} ficha: sin «00:00»`);
    await p.screenshot({ path: `${OUT}/web-ficha-${nombre}-${t}.png`, fullPage: true });

    web.llamadas.length = 0;
    await p.goto(`${BASE}/explorar?ciudad=madrid&agenda-publica=1`, { waitUntil: 'networkidle' });
    const n = await p.locator('.tj').count();
    ok(n > 0, `${nombre}/${t} explorar con «Agenda pública»: ${n} tarjetas`);
    // Y se lo ha pedido así a la base (`traits: ['entity']`).
    ok(web.llamadas.some(({ fn, args }) => fn === 'public_explore' && (args.p_filters?.traits || []).includes('entity')),
      `${nombre}/${t} explorar con «Agenda pública»: pide solo lo de las entidades`);
    await p.screenshot({ path: `${OUT}/web-explorar-agenda-${nombre}-${t}.png` });

    await p.goto(`${BASE}/fuentes`, { waitUntil: 'networkidle' });
    ok((await p.locator('table tbody tr').count()) >= 2, `${nombre}/${t} fuentes: tabla`);
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(ancho, `${nombre}/${t} fuentes: sin scroll horizontal`);
    await p.screenshot({ path: `${OUT}/web-fuentes-${nombre}-${t}.png`, fullPage: true });

    await p.goto(`${BASE}/en/sources`, { waitUntil: 'networkidle' });
    ok((await p.content()).includes('Sources and licences'), `${nombre}/${t} sources (en)`);

    ok(errores.length === 0, `${nombre}/${t} sin errores JS ${errores.join(' | ')}`);
    await p.close();
  }
  await nav.close();
}
await web.cierra();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
