// La misma cabecera en todas las páginas y el idioma bien llevado (Iván,
// 2026-11-02: «la barra no es constante» y «el tema de los idiomas va mal»).
// En la web local contra dev, solo leyendo (con sesión, una de mentira y la
// base simulada: no se escribe nada de verdad).
//
//  1. La cabecera: en la portada, Descubre, Explorar, una ficha /o/ y /b/, la
//     agenda, una selección, Para negocios, Precios, Preguntas, Prensa, una
//     legal, Soporte, «Tu cuenta» y el panel (con sesión), en ES y EN, móvil
//     y escritorio, sin y con sesión: los mismos botones en el mismo orden
//     (logo · pestañas · ✨ · lupa · campana con sesión · Para negocios ·
//     idioma · Entrar o tu inicial · ☰), 65 px de alto y la pestaña activa
//     que toca.
//  2. Los 8 idiomas (elegidos en este navegador): una página pública se ve en
//     su versión (ca, gl, eu → la española; fr, de, it → la inglesa), entera
//     en ese idioma (cabecera y contenido) y el selector marca el elegido;
//     «Tu cuenta» sale en ese idioma, con las pestañas con los nombres de la
//     app (lib/l10n/app_<lang>.arb del repo de la app).
//  3. Cambiar de idioma con el selector: lleva a la versión de esa página, se
//     recuerda al ir a «Tu cuenta» y, con sesión, se guarda en la cuenta
//     (`profiles.locale` y los datos de la sesión, como «Ajustes › Idioma»).
//  4. Con sesión, manda el idioma de la cuenta (el de la app): en las páginas
//     públicas el de la sesión y en «Tu cuenta» el del perfil.
// Chromium y WebKit, móvil (390) y escritorio (1280).
//
//   SUPABASE_BLOQUEADO=1 PORT=8857 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8857 node tools/cabecera_igual_check.mjs
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { playwright, REF, SUPA, servidorSeguro, supabaseVacio } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8857';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
// Las capturas, en tools/out/ (git las ignora): en la raíz se publicaban
// en klendar.app (revisión del 3-11-2026, 5.4).
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const U = '0e7717e0-0000-4000-8000-0000000cab02';
const BIZ = 'b1000000-0000-4000-8000-0000000cab02';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2' })}.firma`;
const usuario = (locale) => ({ id: U, aud: 'authenticated', role: 'authenticated', email: 'cabecera.igual@example.com', app_metadata: { provider: 'email' },
  user_metadata: locale ? { display_name: 'Prueba', locale } : { display_name: 'Prueba' }, created_at: '2026-01-01T00:00:00Z' });
const sesion = (locale) => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: usuario(locale) });
const RPC = {
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Sala Igual', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
  business_is_organizer: false,
  my_subscription: { plan_slug: 'standard', status: 'active', price_cents: 1990, active_offers: 0, has_analytics: true, billing: { enabled: true, blocked: false, hold: null, block_soon: false } },
  business_stats: { redemptions_30d: 0 }, my_business_offers: [], business_tools_overview: { ok: true, can_edit: true, team: { members: 1 } },
};
/** La base de mentira. `perfil`: el idioma de `profiles.locale`; `apunta`: lo
 * que se guarda (para comprobarlo). */
const falso = ({ perfil = null, apunta = [] } = {}) => async (route) => {
  // Lo que se guarda, se queda (como la base de verdad).
  const req = route.request();
  const u = new URL(req.url());
  const p = u.pathname;
  const json = (b, h = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range', ...h }, body: JSON.stringify(b) });
  if (p.startsWith('/auth/v1/user')) {
    if (req.method() === 'PUT') { const d = JSON.parse(req.postData() || '{}'); apunta.push(['auth', d?.data?.locale]); perfil = d?.data?.locale ?? perfil; return json(usuario(perfil)); }
    return json(usuario(perfil));
  }
  if (p.startsWith('/auth/v1/')) return json({});
  if (p.startsWith('/rest/v1/rpc/')) { const f = p.slice(13); return json(f in RPC ? RPC[f] : null); }
  if (p === '/rest/v1/profiles') {
    if (req.method() === 'PATCH') { const l = JSON.parse(req.postData() || '{}').locale; apunta.push(['perfil', l]); perfil = l; return route.fulfill({ status: 204, body: '' }); }
    return json(u.searchParams.get('select')?.includes('locale') ? { locale: perfil } : []);
  }
  if (p === '/rest/v1/notifications') return route.fulfill({ status: 200, headers: { 'content-range': '*/2', 'access-control-expose-headers': 'content-range' }, body: '' });
  if (p.startsWith('/rest/v1/')) return json([]);
  return json({});
};

// Los nombres de las pestañas en la app (lo que dice el GLOSARIO).
const ARB = (() => {
  const d = new URL('../../klendar/lib/l10n/', import.meta.url);
  const out = {};
  for (const l of ['es', 'en', 'ca', 'gl', 'eu', 'fr', 'de', 'it']) {
    const f = new URL(`app_${l}.arb`, d);
    if (!existsSync(f)) continue;
    const a = JSON.parse(readFileSync(f, 'utf8'));
    out[l] = [a.tabFeed, a.tabExplore, a.tabPlans, a.tabProfile];
  }
  return out;
})();
const LADO = (l) => (/^(en|fr|de|it)$/.test(l) ? 'en' : 'es');

/** Lo que se ve de la cabecera, en orden, como «tipos» de botón (si la
 * página aún estaba pasando a su versión en otro idioma, se espera). */
const firma = async (page) => {
  for (let i = 0; i < 3; i++) {
    try { return await firma1(page); } catch { await page.waitForLoadState('domcontentloaded').catch(() => {}); await page.waitForTimeout(1200); }
  }
  return firma1(page);
};
const firma1 = (page) => page.evaluate(() => {
  const h = document.querySelector('header.top');
  const vis = (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
  const tipo = (el) => {
    if (el.matches('.brand')) return 'logo';
    if (el.matches('.pestana')) return `pestaña:${el.dataset.tab}`;
    if (el.matches('[data-abre-hoja="selecciones"]')) return 'selecciones';
    if (el.matches('[data-abre-hoja="buscar"]')) return 'lupa';
    if (el.matches('[data-campana]')) return 'campana';
    if (el.matches('.top-negocios')) return 'negocios';
    if (el.matches('summary.idioma-b')) return 'idioma';
    if (el.matches('.top-entrar')) return el.classList.contains('top-yo') ? 'tu-inicial' : 'entrar';
    if (el.matches('.menu-toggle')) return 'menu';
    return null;
  };
  const items = [...h.querySelectorAll('a, summary, label')].filter((el) => !el.closest('nav.main, .idioma-menu') && vis(el)).map(tipo).filter(Boolean);
  const activa = document.querySelector('[data-tab][aria-current="page"]')?.dataset.tab || '';
  return { items, alto: Math.round(h.getBoundingClientRect().height), activa, lang: document.documentElement.lang,
    pestanas: [...document.querySelectorAll('header.top .pestana span, .tabbar .tab span')].slice(0, 4).map((s) => s.textContent.trim()),
    marcado: document.querySelector('header.top [data-idioma] a[aria-current="true"]')?.dataset.lang || '',
    cod: document.querySelector('[data-idioma-cod]')?.textContent || '' };
});

// WebKit para Windows se cae a veces al recargar una página mientras aún
// carga (pasaba ya antes de esta cabecera: el panel sin sesión → «Tu
// cuenta»). Entonces se repite en una pestaña nueva y se cuenta aparte.
let caidas = 0;
const caida = new WeakSet();
async function ve(page, url, sel = 'header.top') {
  for (let i = 0; i < 3; i++) {
    if (caida.has(page) || page.isClosed()) {
      caidas++;
      const ctx = page.context();
      page = await ctx.newPage();
    }
    if (!page.__vigilada) { page.__vigilada = true; const p = page; p.on('crash', () => caida.add(p)); }
    try { await page.goto(url, { waitUntil: 'domcontentloaded' }); } catch { /* otra vez */ }
    if (caida.has(page)) continue;
    try { if (await page.locator(sel).count()) break; } catch { continue; }
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(1300).catch(() => {});
  return page;
}

const PAGINAS = [
  ['/', ''], ['/descubre/', 'descubre'], ['/explorar/', 'explorar'], ['/explorar/?que=sitios', 'explorar'],
  ['/b/cafe-central-lab-madrid', null], ['/agenda/madrid/', 'explorar'], ['/coleccion/finde/', 'explorar'],
  ['/para-negocios/', ''], ['/precios/', ''], ['/preguntas/', ''], ['/prensa/', ''], ['/aviso-legal/', ''], ['/soporte/', ''],
  ['/en/', ''], ['/en/discover/', 'descubre'], ['/en/explore/', 'explorar'], ['/en/faq/', ''],
  ['/cuenta/', 'cuenta'], ['/panel/#/resumen', 'cuenta'],
];

const NAVS = (process.env.NAVS || 'chromium,webkit').split(',');
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]].filter(([n]) => NAVS.includes(n))) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    const movil = forma === 'movil';
    // ── 1. La misma cabecera en todas las páginas ──
    for (const conSesion of [false, true]) {
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', isMobile: movil && nombre === 'chromium', hasTouch: movil });
      // Lo que lee de pasada (formas de entrar, ciudades…): base vacía simulada.
      await supabaseVacio(ctx);
      await ctx.addInitScript(([k, v, con]) => { try { if (!sessionStorage.getItem('puesto')) { localStorage.setItem('klendar_lang', 'es'); if (con) localStorage.setItem(k, v); sessionStorage.setItem('puesto', '1'); } } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion(null), conSesion]);
      await ctx.route(`${SUPA}/**`, falso());
      let page = await ctx.newPage();
      const t = `[${nombre} ${forma} ${conSesion ? 'con sesión' : 'sin sesión'}]`;
      const quiere = [
        'logo', ...(movil ? [] : ['pestaña:descubre', 'pestaña:explorar', 'pestaña:planes', 'pestaña:cuenta']),
        'selecciones', 'lupa', ...(conSesion ? ['campana'] : []), ...(movil ? [] : ['negocios', 'idioma']),
        conSesion ? 'tu-inicial' : 'entrar', 'menu',
      ].join(' · ');
      for (const [ruta, activa] of PAGINAS) {
        if (ruta.startsWith('/panel/') && !conSesion) continue;
        if (ruta.startsWith('/en/')) await page.evaluate(() => { try { localStorage.setItem('klendar_lang', 'en'); } catch { /* */ } });
        else await page.evaluate(() => { try { localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }).catch(() => {});
        page = await ve(page, BASE + ruta);
        const f = await firma(page);
        ok(f.items.join(' · ') === quiere, `${t} ${ruta}: ${f.items.join(' · ')}`);
        ok(f.alto === 65, `${t} ${ruta}: 65 px de alto (${f.alto})`);
        if (activa !== null) ok(f.activa === activa, `${t} ${ruta}: pestaña activa «${activa || 'ninguna'}» (${f.activa || 'ninguna'})`);
        if (!conSesion && movil && ['/', '/descubre/', '/cuenta/'].includes(ruta)) await page.screenshot({ path: `${OUT}/igual-${nombre}-${forma}-${ruta.replace(/\W+/g, '_')}.png`, clip: { x: 0, y: 0, width: vp.width, height: 70 } });
      }
      // Una ficha se queda con la pestaña de la que vienes (como la app).
      page = await ve(page, `${BASE}/descubre/`);
      page = await ve(page, `${BASE}/b/cafe-central-lab-madrid`);
      ok((await firma(page)).activa === 'descubre', `${t} una ficha desde Descubre, con «Descubre» marcada`);
      page = await ve(page, `${BASE}/explorar/`);
      page = await ve(page, `${BASE}/b/cafe-central-lab-madrid`);
      ok((await firma(page)).activa === 'explorar', `${t} una ficha desde Explorar, con «Explorar» marcada`);
      await ctx.close();
    }

    // ── 2. Los 8 idiomas ──
    for (const l of ['es', 'en', 'ca', 'gl', 'eu', 'fr', 'de', 'it']) {
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', isMobile: movil && nombre === 'chromium', hasTouch: movil });
      // Lo que lee de pasada (formas de entrar, ciudades…): base vacía simulada.
      await supabaseVacio(ctx);
      await ctx.addInitScript((x) => { try { if (!sessionStorage.getItem('puesto')) { localStorage.setItem('klendar_lang', x); sessionStorage.setItem('puesto', '1'); } } catch { /* */ } }, l);
      let page = await ctx.newPage();
      const t = `[${nombre} ${forma} ${l}]`;
      page = await ve(page, `${BASE}/aviso-legal/`);
      await page.waitForURL(LADO(l) === 'en' ? /\/en\/legal-notice\// : /\/aviso-legal\//, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      const f = await firma(page);
      ok(f.lang === LADO(l), `${t} pública: en su versión (${LADO(l)}) — ${new URL(page.url()).pathname}`);
      const textoMain = await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 400) || '');
      const enIngles = /\b(the|and|of|is)\b/i.test(textoMain);
      ok(LADO(l) === 'en' ? enIngles : !enIngles, `${t} pública: el contenido en ${LADO(l)}`);
      ok(JSON.stringify(f.pestanas) === JSON.stringify(ARB[LADO(l)]), `${t} pública: la cabecera en el idioma de la página (${f.pestanas.join(', ')})`);
      ok(f.marcado === l && f.cod === l.toUpperCase(), `${t} pública: el selector marca «${l}» (${f.marcado}, ${f.cod})`);
      page = await ve(page, `${BASE}/cuenta/`);
      const a = await firma(page);
      ok(a.lang === l, `${t} «Tu cuenta» en ${l} (${a.lang})`);
      ok(!ARB[l] || JSON.stringify(a.pestanas) === JSON.stringify(ARB[l]), `${t} «Tu cuenta»: las pestañas como en la app (${a.pestanas.join(', ')})`);
      ok(a.marcado === l, `${t} «Tu cuenta»: el selector marca «${l}» (${a.marcado})`);
      if (movil && ['eu', 'de'].includes(l)) await page.screenshot({ path: `${OUT}/idioma-${nombre}-${forma}-${l}-cuenta.png`, clip: { x: 0, y: 0, width: vp.width, height: 70 } });
      if (!movil && ['eu', 'de'].includes(l)) await page.screenshot({ path: `${OUT}/idioma-${nombre}-${forma}-${l}-cuenta.png`, clip: { x: 0, y: 0, width: vp.width, height: 70 } });
      await ctx.close();
    }

    // ── 3. Cambiar de idioma con el selector (sin sesión y con sesión) ──
    for (const conSesion of [false, true]) {
      const apunta = [];
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', isMobile: movil && nombre === 'chromium', hasTouch: movil });
      // Lo que lee de pasada (formas de entrar, ciudades…): base vacía simulada.
      await supabaseVacio(ctx);
      await ctx.addInitScript(([k, v, con]) => { try { if (!sessionStorage.getItem('puesto')) { localStorage.setItem('klendar_lang', 'es'); if (con) localStorage.setItem(k, v); sessionStorage.setItem('puesto', '1'); } } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion('es'), conSesion]);
      await ctx.route(`${SUPA}/**`, falso({ perfil: 'es', apunta }));
      let page = await ctx.newPage();
      const t = `[${nombre} ${forma} cambiar ${conSesion ? 'con sesión' : 'sin sesión'}]`;
      const elige = async (l) => {
        if (movil) await page.click('#menu'); else await page.click('header.top summary.idioma-b');
        await page.waitForTimeout(250);
        await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
          page.click(`header.top ${movil ? '.idioma-lista' : '.idioma-menu'} a[data-lang="${l}"]`)]);
        await page.waitForTimeout(1300);
      };
      page = await ve(page, `${BASE}/descubre/?cuando=finde`);
      await elige('de');
      const u1 = new URL(page.url());
      ok(u1.pathname === '/en/discover/' && u1.searchParams.get('when') === 'weekend', `${t} Deutsch: a la versión inglesa de la misma página, con sus filtros (${u1.pathname}${u1.search})`);
      const g1 = await page.evaluate(() => localStorage.getItem('klendar_lang'));
      ok(g1 === 'de', `${t} Deutsch: se recuerda (${g1})`);
      const f1 = await firma(page);
      ok(f1.cod === 'DE', `${t} Deutsch: el selector dice «DE» (${f1.cod})`);
      if (conSesion) {
        ok(apunta.some(([q, v]) => q === 'perfil' && v === 'de') && apunta.some(([q, v]) => q === 'auth' && v === 'de'), `${t} con sesión, se guarda en la cuenta (${JSON.stringify(apunta)})`);
        const meta = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}')?.user?.user_metadata?.locale, `sb-${REF}-auth-token`);
        ok(meta === 'de', `${t} con sesión, la sesión guardada lo sabe (${meta})`);
      }
      page = await ve(page, `${BASE}/cuenta/`);
      ok((await firma(page)).lang === 'de', `${t} y «Tu cuenta» en alemán`);
      // En «Tu cuenta», cambiar a euskera se queda en la misma pantalla.
      page = await ve(page, `${BASE}/cuenta/ajustes`);
      const antes = new URL(page.url()).pathname;
      await elige('eu');
      const f2 = await firma(page);
      ok(f2.lang === 'eu' && new URL(page.url()).pathname === antes, `${t} en «Tu cuenta», euskera en la misma pantalla (${f2.lang} ${antes} → ${new URL(page.url()).pathname})`);
      page = await ve(page, `${BASE}/en/explore/`);
      await page.waitForURL(/\/explorar\//, { timeout: 8000 }).catch(() => {});
      ok(new URL(page.url()).pathname === '/explorar/', `${t} euskera y una página inglesa: a la española (${new URL(page.url()).pathname})`);
      await ctx.close();
    }

    // ── 4. Con sesión manda el idioma de la cuenta ──
    {
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', isMobile: movil && nombre === 'chromium', hasTouch: movil });
      // Lo que lee de pasada (formas de entrar, ciudades…): base vacía simulada.
      await supabaseVacio(ctx);
      await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('puesto')) { localStorage.setItem('klendar_lang', 'es'); localStorage.setItem(k, v); sessionStorage.setItem('puesto', '1'); } } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion('fr')]);
      await ctx.route(`${SUPA}/**`, falso({ perfil: 'it' }));
      let page = await ctx.newPage();
      const t = `[${nombre} ${forma} idioma de la cuenta]`;
      page = await ve(page, `${BASE}/aviso-legal/`);
      await page.waitForURL(/\/en\/legal-notice\//, { timeout: 8000 }).catch(() => {});
      ok(new URL(page.url()).pathname === '/en/legal-notice/' && (await firma(page)).cod === 'FR', `${t} la sesión dice francés: la versión inglesa y «FR» (${new URL(page.url()).pathname})`);
      // «Tu cuenta» se vuelve a cargar en el idioma del perfil. (WebKit para
      // Windows se cae a veces en una recarga mientras la página aún carga,
      // como al pasar del panel sin sesión a «Tu cuenta»: entonces, una
      // pestaña nueva, que ya trae el idioma guardado.)
      let fit = null;
      for (let i = 0; i < 3 && !fit; i++) {
        try {
          page = await ve(page, `${BASE}/cuenta/`);
          await page.waitForFunction(() => document.documentElement.lang === 'it', null, { timeout: 8000 }).catch(() => {});
          fit = await firma(page);
        } catch { caida.add(page); }
      }
      ok(fit && fit.lang === 'it', `${t} «Tu cuenta» con el idioma del perfil (italiano)`);
      await ctx.close();
    }
  }
  await nav.close();
}
if (caidas) console.log(`(WebKit se cayó ${caidas} vez/veces al recargar; se repitió en una pestaña nueva)`);
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
