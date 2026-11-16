// Guías de temporada (Iván, 2026-11-17; migración 20261283800000 de la app):
// lo que la web tiene que hacer igual que la app. Sin navegador ni red: la
// página /guia/<slug> con un Supabase de mentira (fetch simulado) y la
// lectura del código del panel, el admin y Descubre. Lo de la base (quién
// puede qué), en la app: tool/guias_smoke.py.
//
//   1. /guia/<slug>: portada, texto, sitio y fechas, las publicaciones y los
//      filtros normales (¿Cuándo? y el tipo, en la dirección); OG con la
//      portada; indexable sin filtros; /en/guide/<slug> su gemela.
//   2. Terminada: «Esta guía ha terminado», a Descubre (coral solo ahí), 200
//      y noindex. Una que no existe: 404.
//   3. Descubre (web): la franja de la guía de tu ciudad, sobria (sin coral).
//   4. Panel: «Añadir a «…»» solo con «Para todos», desmarcada; se guarda con
//      `set_offer_guide` al guardar la publicación.
//   5. Admin: crear, editar, archivar, portada en `guides/<id>/` y
//      publicaciones a mano; sitemap y robots.
//
//   node tools/guias_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const lee = (f) => readFileSync(new URL(f, raiz), 'utf8');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

const COVER = 'https://falso.supabase.example/storage/v1/object/public/business-images/guides/g1/portada.jpg';
const guia = (extra = {}) => ({
  id: 'g1', slug: 'navidad-en-malaga', title: { es: 'Navidad en Málaga', en: 'Christmas in Málaga' },
  text: { es: 'Luces, belenes y mercadillos.' }, cover_url: COVER, place_name: 'Málaga',
  starts_on: '2026-12-01', ends_on: '2027-01-06', status: 'live', count: 2, ...extra,
});
const hora = (h) => new Date(Date.now() + h * 36e5).toISOString();
const item = (id, titulo, kind = 'future_event') => ({
  id, kind, title: titulo, business_id: 'b1', business_name: 'Café Central', business_logo: null,
  starts_at: hora(24), event_at: kind === 'future_event' ? hora(24) : null, redeem_start_at: kind === 'flash_offer' ? hora(-1) : null,
  redeem_end_at: kind === 'flash_offer' ? hora(3) : null, images: [], price_cents: 0, currency: 'EUR', city: 'Málaga',
  lat: 36.72, lng: -4.42, audience: 'all', is_boosted: false, destacado: false, imported: false,
});
let estado = guia();
const pedidas = [];
globalThis.fetch = async (url, op = {}) => {
  const u = String(url);
  const body = op.body ? JSON.parse(op.body) : {};
  pedidas.push({ u, body });
  const json = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } });
  if (u.endsWith('/rpc/guide_info')) return json(body.p_slug === 'navidad-en-malaga' ? estado : null);
  if (u.endsWith('/rpc/guide_offers')) {
    const todas = [item('o1', 'Belén viviente'), item('o2', 'Chocolate con churros', 'flash_offer')];
    const f = body.p_filters || {};
    const items = todas.filter((o) => !f.kind || o.kind === f.kind);
    return json({ total: items.length, items });
  }
  if (u.includes('/rpc/')) return json(null);
  return json([]);
};
const { configure } = await import('../functions/_lib/page.js');
configure({ SUPABASE_URL: 'https://falso.supabase.example', SUPABASE_KEY: 'clave-publica' });
const { guiaPage, bannerGuia } = await import('../functions/_lib/guias.js');
const { altPath } = await import('../functions/_lib/public.js');
const pagina = async (ruta, lang = 'es') => {
  const url = new URL(`https://klendar.app${ruta}`);
  const slug = url.pathname.split('/').pop();
  const r = await guiaPage(slug, url, lang);
  return { r, h: await r.text() };
};

// 1
{
  const { r, h } = await pagina('/guia/navidad-en-malaga');
  ok('1. viva: 200 con título, sitio y fechas', r.status === 200 && h.includes('<h1>Navidad en Málaga</h1>')
    && h.includes('Málaga · 1 dic – 6 ene') && h.includes('Luces, belenes y mercadillos.'));
  ok('1. el título de la pestaña «Guía · Klendar»', h.includes('<title>Navidad en Málaga · Klendar</title>'));
  ok('1. OG con la portada y la descripción', h.includes(`<meta property="og:image" content="${COVER}">`)
    && h.includes('<meta property="og:description" content="Luces, belenes y mercadillos.">'));
  ok('1. las publicaciones de la guía', h.includes('Belén viviente') && h.includes('Chocolate con churros'));
  ok('1. indexable sin filtros, canónica y gemela en inglés', !h.includes('noindex')
    && h.includes('<link rel="canonical" href="https://klendar.app/guia/navidad-en-malaga">')
    && h.includes('hreflang="en" href="https://klendar.app/en/guide/navidad-en-malaga"'));
  ok('1. datos estructurados (CollectionPage)', h.includes('"@type":"CollectionPage"'));
  ok('1. los filtros normales: ¿Cuándo? y el tipo', h.includes('?cuando=finde') && h.includes('?tipo=eventos') && h.includes('Este finde'));
  const f = await pagina('/guia/navidad-en-malaga?tipo=eventos');
  const pedido = pedidas.filter((p) => p.u.endsWith('/rpc/guide_offers')).pop();
  ok('1. con filtro: se pide a la base y noindex', pedido?.body?.p_filters?.kind === 'future_event'
    && f.h.includes('Belén viviente') && !f.h.includes('Chocolate con churros') && f.h.includes('noindex'));
  const en = await pagina('/en/guide/navidad-en-malaga?when=weekend', 'en');
  ok('1. en inglés: su título y sus filtros', en.h.includes('<h1>Christmas in Málaga</h1>') && en.h.includes('This weekend')
    && pedidas.filter((p) => p.u.endsWith('/rpc/guide_offers')).pop()?.body?.p_filters?.when === 'weekend');
  ok('1. /guia/x ⇄ /en/guide/x', altPath('/guia/x', 'es') === '/en/guide/x' && altPath('/en/guide/x', 'en') === '/guia/x');
  ok('1. el coral, solo en el botón principal (aquí no hay ninguno)', !h.includes('pill accent'));
}

// 2
{
  estado = guia({ status: 'ended' });
  const { r, h } = await pagina('/guia/navidad-en-malaga');
  ok('2. terminada: lo dice y lleva a Descubre', r.status === 200 && h.includes('Esta guía ha terminado')
    && h.includes('<a class="pill accent" href="/descubre">Ir a Descubre</a>'));
  ok('2. …sin indexar y sin pedir publicaciones', h.includes('noindex') && !h.includes('Belén viviente'));
  estado = guia({ status: 'soon' });
  const pronto = await pagina('/guia/navidad-en-malaga');
  ok('2. por empezar: «Empieza el …»', pronto.h.includes('Empieza el martes, 1 de diciembre') || pronto.h.includes('Empieza el martes 1 de diciembre'));
  estado = guia();
  const no = await pagina('/guia/no-existe');
  ok('2. una que no existe: 404', no.r.status === 404);
  const mala = await pagina('/guia/Mal%20Slug');
  ok('2. un slug raro: 404 sin preguntar', mala.r.status === 404);
}

// 3
{
  const b = bannerGuia(guia(), 'es');
  ok('3. la franja: nombre, sitio, fechas y «Ver la guía»', b.includes('Navidad en Málaga') && b.includes('Málaga · 1 dic – 6 ene · 2 planes')
    && b.includes('href="/guia/navidad-en-malaga"') && b.includes('Ver la guía'));
  ok('3. sobria: sin coral', !/accent|coral/.test(b));
  ok('3. sin guía, nada', bannerGuia(null, 'es') === '');
  const explore = lee('functions/_lib/explore.js');
  ok('3. Descubre la pide en la primera página y la pone encima', explore.includes("rpc('current_guide'")
    && explore.includes('descubre && page === 1') && /\$\{guiaHtml\}\s*\$\{resultados\}/.test(explore));
}

// 4
{
  const panel = lee('panel/panel.js');
  const g = lee('panel/guias.js');
  const html = lee('panel.html');
  ok('4. el bloque, fuera de «Más opciones»', panel.includes("${guiasHtml()}\n      ${bloque('bMas'"));
  ok('4. solo con «Para todos»', g.includes("que().audiencia === 'all' ? guias.filter"));
  ok('4. desmarcada salvo que ya esté', g.includes('(elegido[g.id] ?? g.on)') && !g.includes('checked: true'));
  ok('4. se guarda con la publicación', panel.includes('await guias.guarda(offerId)') && g.includes("rpc('set_offer_guide'"));
  ok('4. lo pide a la base con las fechas del formulario', g.includes("rpc('business_guides'") && g.includes("f.get('start')"));
  ok('4. el script, en el panel', /<script src="\/panel\/guias\.js\?v=[0-9a-f]+"><\/script>/.test(html));
}

// 5
{
  const a = lee('admin/guias.js');
  const admin = lee('admin/admin.js');
  ok('5. en el menú de Contenido', admin.includes("['guias', 'menu_book', 'Guías']"));
  ok('5. crear y editar, archivar y recuperar', a.includes("rpc('admin_save_guide'") && a.includes("rpc('admin_archive_guide'"));
  ok('5. la portada, en guides/<id>/', a.includes('`guides/${id}/${crypto.randomUUID()}.${ext}`'));
  ok('5. dónde: municipio o provincia', a.includes("rpc('admin_guide_places'"));
  ok('5. publicaciones a mano', a.includes("rpc('admin_collection_add'") && a.includes("rpc('admin_collection_remove'"));
  ok('5. sitemap y robots', lee('robots.txt').includes('Sitemap: https://klendar.app/sitemap-guias.xml')
    && lee('functions/sitemap-guias.xml.js').includes("'/en/guide/") === false && lee('functions/sitemap-guias.xml.js').includes('/en/guide/'));
  ok('5. la app abre el enlace (iOS)', lee('.well-known/apple-app-site-association').includes('"/guia/*"'));
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
