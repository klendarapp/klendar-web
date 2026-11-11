// «Sitios en Explorar» (tanda D, 2026-10-20) en la web local, solo leyendo
// (sin sesión, no escribe nada):
//  1. /explorar/?que=sitios: «Planes | Sitios» con Sitios puesto, Lista | Mapa,
//     las filas (foto, nombre, categoría y distancia, el horario de ahora) y
//     «N sitios»; sin desbordar a lo ancho en un móvil.
//  2. La hoja de filtros en Sitios: solo lo del sitio (Abierto ahora, Se puede
//     comer ahora, Momento del día, Precio del local, Cómo es, Menú del día y
//     Categorías); ni «¿Cuándo?» ni «Para quién».
//  3. El mapa de Sitios pide `map_places` (y otra vez al moverlo).
//  4. Explorar recuerda lo último: tras ver Sitios, /explorar/ sin nada abre
//     Sitios; tras volver a Planes, Planes.
//  5. La lupa: con «nails», «Solo sitios» lleva a `?que=sitios&q=nails`.
//  6. Los enlaces de antes (`?tipo=negocios`) llevan a Sitios.
//  7. Sin saltos: «Planes | Sitios», Lista y Mapa, el buscador, Filtros y el
//     «dónde» en la misma posición exacta en Planes y en Sitios (en lista y
//     en mapa), y casi sin desplazamientos al cargar (CLS).
//  8. La tarjeta del mapa de Sitios dice lo mismo que la fila de la lista
//     (`place_card` pintada con la misma función, `detallesHtml`).
//  9. La lista de un día del calendario de Planes, por partes (`?p=`).
// 10. Sin errores en la consola.
// 11. La ficha a medias (migración 20261274500000 de la app): sin foto ni
//     logo, las iniciales (en la fila y en el marcador); sin horario,
//     «Horario no indicado».
// Chromium y WebKit, móvil (375) y escritorio. Capturas en OUT.
//
// Con sus propios datos (tools/_web_con_datos.mjs): los sitios de Madrid con
// su horario de ahora (`hours`, como `public_places`: abierto con cocina o
// cerrado hasta mañana), Nails & Co para la lupa y `place_card` con la misma
// fila que la lista (como la base: la tarjeta del mapa y la fila son el mismo
// sitio). Antes iba contra dev y, desde que las pruebas no llegan a Supabase
// (5-11), Sitios salía vacío y fallaba siempre.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/sitios_check.mjs
import { playwright } from './_supabase_simulado.mjs';
import { DATOS, webConDatos } from './_web_con_datos.mjs';

const { chromium, webkit } = playwright();
const en = (h) => new Date(Date.now() + h * 36e5).toISOString();
// El horario de ahora: casi todos abiertos (con cocina), alguno cerrado.
const horario = (i) => (i % 3 === 2
  ? { open: false, opens_at: en(20), closes_at: null, kitchen: null }
  : { open: true, closes_at: en(5), opens_at: null, kitchen: i % 3 === 0 ? { open: true, until: en(3), opens_at: null } : null });
const NAILS = {
  ...DATOS.NEGOCIOS[0], id: 'b9000000-0000-4000-8000-0000000000e5', name: 'Nails & Co', slug: 'nails-co-madrid',
  category_id: DATOS.CATEGORIAS.find((c) => c.slug === 'beauty').id, category_slug: 'beauty',
  names: DATOS.CATEGORIAS.find((c) => c.slug === 'beauty').names, lat: 40.4190, lng: -3.7020,
};
// La Panadería, sin horario (ficha a medias: `hours` null). Ninguno tiene
// foto ni logo: todos con sus iniciales.
const NEGOCIOS = [...DATOS.NEGOCIOS, NAILS].map((b, i) => ({
  ...b, hours: b.name === 'Panadería Muestra' ? null : horario(i), holiday: null,
}));
const metros = (a, b, c, d) => {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2);
  const y = Math.sin(((d - b) * r) / 2);
  return 12742000 * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y));
};
// Un día del calendario con más de 24 (para «por partes», punto 9): treinta
// catas más en el Restaurante Ensayo, dentro de media hora.
const CATAS = Array.from({ length: 30 }, (_, i) => ({
  ...DATOS.PLANES.find((o) => o.title === 'Cata de vinos'), id: `a9000000-0000-4000-8000-0000000009${String(i).padStart(2, '0')}`,
  title: `Cata de prueba ${i + 1}`, event_at: en(0.5), starts_at: en(0.5), event_end_at: en(2),
}));
const web = await webConDatos({
  puerto: Number(process.env.PORT || 9018),
  datos: { ...DATOS, NEGOCIOS, PLANES: [...DATOS.PLANES, ...CATAS] },
  rpc: {
    // La tarjeta del mapa: la misma fila que da `public_places`.
    place_card: (a) => {
      const b = NEGOCIOS.find((x) => x.id === a.p_business);
      if (!b) return null;
      return { ...b, distance_m: a.p_lat != null ? Math.round(metros(Number(a.p_lat), Number(a.p_lng), b.lat, b.lng)) : null };
    },
  },
});
const BASE = web.BASE;
// Las capturas, en tools/out/ (git las ignora): en la raíz se publicaban
// en klendar.app (revisión del 3-11-2026, 5.4).
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const AQUI = 'lat=40.417&lng=-3.704';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
    const page = await ctx.newPage();
    const errores = [];
    // Lo de Mapbox (teselas, fuentes que WebKit sin GPU no deja cargar) no es
    // de la página.
    // («Load failed» es como WebKit dice que no ha podido bajar una fuente del
    // mapa; las peticiones de la página van con su try/catch.)
    const deMapbox = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
    page.on('console', (m) => { if (m.type() === 'error' && !deMapbox(m.text())) errores.push(m.text()); });
    page.on('pageerror', (e) => { if (!deMapbox(`${e.message} ${e.stack || ''}`)) errores.push(String(e)); });
    const t = `[${nombre} ${forma}]`;

    // 1. La lista.
    await page.goto(`${BASE}/explorar/?que=sitios&${AQUI}`);
    ok(await page.locator('.que a.on').innerText() === 'Sitios', `${t} «Planes | Sitios» con Sitios puesto`);
    // Arriba, como la app: «Ver en el mapa» (revisión del 3-11, 1.1); la lupa,
    // solo la de la cabecera (Iván, 2026-11-04).
    const botones = await page.locator('.exp-acciones .exp-boton').evaluateAll((l) => l.map((a) => a.getAttribute('aria-label')));
    ok(botones.join(' · ') === 'Ver en el mapa', `${t} «Ver en el mapa», sin lupa en la fila (${botones.join(' · ')})`);
    const filas = await page.locator('.sitio-fila').count();
    ok(filas > 0, `${t} filas de sitios (${filas})`);
    ok(!(await page.locator('.resumen-n').count()), `${t} sin «N sitios» (la app no lo tiene)`);
    const hora = await page.locator('.sitio-hora').first().innerText();
    ok(/^(Abierto|Cerrado)/.test(hora), `${t} el horario de ahora («${hora}»)`);
    ok(/\d+(,\d)?\s?(m|km)/.test(await page.locator('.sitio-fila .muted').first().innerText()), `${t} categoría y distancia`);
    // 11. Ficha a medias.
    const bar = page.locator('.sitio-fila', { hasText: 'Bar Sonda' });
    ok(await bar.locator('.ph.iniciales').innerText() === 'BS', `${t} sin foto ni logo, sus iniciales («BS»)`);
    const pan = page.locator('.sitio-fila', { hasText: 'Panadería Muestra' });
    const sinHora = await pan.locator('.sitio-hora').innerText().catch(() => '');
    ok(sinHora === 'Horario no indicado', `${t} sin horario, «Horario no indicado» («${sinHora}»)`);
    if (forma === 'movil') {
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
      ok(ancho <= 375, `${t} sin desbordar a lo ancho (${ancho})`);
    }
    await page.screenshot({ path: `${OUT}/web-sitios-${nombre}-${forma}.png`, fullPage: false });

    // 2. La hoja de filtros.
    // Opción A (2026-10-26): ¿Cuándo? (lo del sitio, ahora, y el momento), ¿Qué?
    // (categorías y menú del día) y ☰ (cómo es el sitio y alérgenos).
    await page.locator('#filtros > summary').click();
    const hoja = (await page.locator('#cuando form, #que-hoja form, #filtros form').allTextContents()).join(' ');
    ok(/Abierto ahora/.test(hoja) && /Se puede comer ahora/.test(hoja) && /Momento del día/.test(hoja)
      && /Precio del local/.test(hoja) && /Cómo es/.test(hoja) && /Menú del día/.test(hoja) && /Categorías/.test(hoja),
    `${t} las hojas traen lo del sitio`);
    ok(!/El plan es/.test(hoja) && !/Para quién/.test(hoja) && !/Precio del plan/.test(hoja), `${t} las hojas no traen lo de los planes`);
    await page.screenshot({ path: `${OUT}/web-sitios-filtros-${nombre}-${forma}.png` });

    // 3. El mapa.
    const pide = page.waitForResponse((r) => r.url().includes('/rpc/map_places'), { timeout: 30000 }).catch(() => null);
    await page.goto(`${BASE}/explorar/?que=sitios&vista=mapa&${AQUI}`);
    const r = await pide;
    ok(r && r.ok(), `${t} el mapa pide map_places`);
    await page.waitForTimeout(1500);
    // Los marcadores sin logo ni portada, con sus iniciales (si el mapa pinta).
    const marcas = await page.locator('#mapa-sitios .marca').count();
    const conIniciales = await page.locator('#mapa-sitios .mc-iniciales').count();
    ok(!marcas || conIniciales > 0, `${t} marcadores con iniciales (${conIniciales} de ${marcas})`);
    await page.locator('#mapa-sitios').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/web-sitios-mapa-${nombre}-${forma}.png` });

    // 4. Recuerda lo último.
    await page.goto(`${BASE}/explorar/`);
    await page.waitForURL(/que=sitios/, { timeout: 10000 }).catch(() => {});
    ok(/que=sitios/.test(page.url()), `${t} /explorar/ abre en Sitios tras verlo (${page.url().replace(BASE, '')})`);
    await page.locator('.que a', { hasText: 'Planes' }).click();
    await page.waitForLoadState('domcontentloaded');
    ok(!/que=sitios/.test(page.url()), `${t} «Planes» vuelve a los planes`);
    await page.goto(`${BASE}/explorar/`);
    await page.waitForTimeout(800);
    ok(!/que=sitios/.test(page.url()), `${t} y /explorar/ se queda en Planes`);

    // 5. La lupa.
    await page.goto(`${BASE}/explorar/?q=nails`);
    await page.locator('.chip-solo a').click();
    await page.waitForURL(/que=sitios/, { timeout: 10000 }).catch(() => {});
    ok(/que=sitios/.test(page.url()) && /q=nails/.test(page.url()), `${t} «Solo sitios» en la búsqueda`);
    ok(await page.locator('.sitio-fila').count() >= 1, `${t} «nails» encuentra Nails & Co`);

    // 6. Los enlaces de antes.
    await page.goto(`${BASE}/explorar/?tipo=negocios`);
    ok(await page.locator('.que a.on').innerText() === 'Sitios', `${t} ?tipo=negocios → Sitios`);

    // 7. Sin saltos.
    const medir = async (url) => {
      await page.goto(`${BASE}${url}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      return page.evaluate(() => {
        window.scrollTo(0, 0);
        const r = (sel) => {
          const e = document.querySelector(sel);
          if (!e) return null;
          const b = e.getBoundingClientRect();
          return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 2) / 2).join(',');
        };
        return {
          'Planes | Sitios': r('.que'), Planes: r('.que a:first-child'), Sitios: r('.que a:last-child'),
          Buscar: r('header.top [data-abre-hoja="buscar"]'), 'botón de vista': r('.exp-acciones .exp-boton:last-child'),
          // La fila de filtros (lo de dentro cambia: en Planes, el orden
          // «según el tiempo» va antes del «dónde», como en la app).
          Filtros: r('#filtros > summary'), 'fila de filtros': r('#barra'),
        };
      });
    };
    for (const [a, b, que] of [
      [`/explorar/?vista=lista&${AQUI}`, `/explorar/?que=sitios&${AQUI}`, 'en lista'],
      [`/explorar/?${AQUI}`, `/explorar/?que=sitios&${AQUI}`, 'calendario ↔ lista'],
      [`/explorar/?vista=mapa&${AQUI}`, `/explorar/?que=sitios&vista=mapa&${AQUI}`, 'en el mapa'],
    ]) {
      const pa = await medir(a);
      const pb = await medir(b);
      const distintos = Object.keys(pa).filter((k) => !pa[k] || pa[k] !== pb[k]);
      ok(distintos.length === 0, `${t} Planes ↔ Sitios ${que}: los controles no se mueven ${distintos.map((k) => `${k}: ${pa[k]} → ${pb[k]}`).join('; ')}`);
    }
    await page.goto(`${BASE}/explorar/?que=sitios&${AQUI}`);
    await page.waitForTimeout(1500);
    const cls = await page.evaluate(() => new Promise((res) => {
      let v = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; })
        .observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => res(v), 300);
    })).catch(() => 0);
    ok(cls < 0.05, `${t} casi sin desplazamientos al cargar (CLS ${cls.toFixed(3)})`);

    // 8. La tarjeta del mapa = la fila: la primera fila, pedida como la pide
    // el mapa (`place_card`) y pintada con la misma función.
    const plano = (h) => h.replace(/\s+</g, '<').replace(/>\s+/g, '>').trim();
    const { tarjeta, fila } = await page.evaluate(async () => {
      const a = document.querySelector('.sitio-fila');
      const slug = decodeURIComponent(a.getAttribute('href').split('/b/')[1]);
      const cfg = await (await fetch('/config.js')).text();
      const url = (cfg.match(/url:\s*'([^']+)'/) || [])[1];
      const key = (cfg.match(/key:\s*'([^']+)'/) || [])[1];
      const neg = await (await fetch(`${url}/rest/v1/businesses?select=id&slug=eq.${encodeURIComponent(slug)}`,
        { headers: { apikey: key } })).json();
      const r = await fetch(`${url}/rest/v1/rpc/place_card`, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_business: neg[0].id, p_lat: 40.417, p_lng: -3.704 }),
      });
      const c = a.querySelector('.sitio-cuerpo').cloneNode(true);
      c.querySelector('b')?.remove();
      c.querySelector('.muted')?.remove();
      return { tarjeta: window.KlendarSitios.detallesHtml(await r.json(), 'es'), fila: c.innerHTML };
    });
    ok(plano(tarjeta) === plano(fila), `${t} la tarjeta del mapa dice lo mismo que la fila`);
    // 9. La lista de un día del calendario, por partes.
    await page.goto(`${BASE}/explorar/?vista=calendario&${AQUI}&km=25`);
    const pager = await page.locator('.pager').count();
    const n1 = await page.locator('.cal-lista .tj-filas > *').count();
    ok(n1 <= 24, `${t} el día, como mucho 24 de cada vez (${n1})`);
    if (pager) {
      await page.locator('.pager a[rel="next"]').click();
      await page.waitForLoadState('domcontentloaded');
      ok(/[?&]p=2/.test(page.url()) && await page.locator('.cal-lista .tj-filas > *').count() > 0,
        `${t} la parte siguiente del día (${page.url().replace(BASE, '')})`);
    }

    ok(errores.length === 0, `${t} sin errores en la consola ${errores.join(' | ')}`);
    await ctx.close();
  }
  await nav.close();
}
await web.cierra();
console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
