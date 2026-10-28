// Prueba de la traducción a petición en las fichas públicas (Iván,
// 2026-10-28), con Supabase contestado aquí (no toca dev ni gasta nada):
//
//  1. El idioma probable (`assets/idioma-probable.js`), con los mismos textos
//     que la app (`test/language_guess_test.dart`).
//  2. Publicación en inglés (`/en/o/`) con textos en español: «Translate»
//     bajo el título y nada pedido hasta tocarlo; al tocarlo, la traducción,
//     `lang="en-x-mtfrom-es"`, «See original» y «Translated automatically ·
//     Google Translate»; «See original» y «See translation» sin volver a
//     pedir.
//  3. La misma en español (`/o/`): ni «Traducir» ni una sola petición.
//  4. Ficha en inglés (`/en/b/`): «Translate» bajo la descripción, cada
//     novedad, «Qué pedir aquí» y encima de la carta; una novedad pide solo
//     lo suyo (`only`).
//  5. Tope del mes: «Couldn't translate right now» y el original.
//  6. «Traducir siempre automáticamente» (`klendar.traducir`): ya traducido,
//     una llamada por ficha.
//  7. Sin proveedor (sin clave): nada.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   BASE=… PW=<ruta a playwright> OUT=<carpeta> node tools/traducir_check.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const OUT = process.env.OUT || '.';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8862);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8863);
const BIZ = 'b1000000-0000-4000-8000-0000000097d1';
const OFERTA = 'a1000000-0000-4000-8000-0000000097d1';
const POST1 = 'c2000000-0000-4000-8000-0000000097d1';
const POST2 = 'c2000000-0000-4000-8000-0000000097d2';
const H1 = 'd3000000-0000-4000-8000-0000000097d1';
const SEC = 'e4000000-0000-4000-8000-0000000097d1';
const ITEM = 'e5000000-0000-4000-8000-0000000097d1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

// ── 1. El idioma probable ──────────────────────────────────────────────────
const ctx = { globalThis: {} };
vm.runInNewContext(readFileSync(new URL('../assets/idioma-probable.js', import.meta.url), 'utf8'), ctx);
const { adivina, hayQueTraducir } = ctx.globalThis.KIdioma;
const MUESTRAS = {
  es: ['Cinco vermús artesanos con maridaje de tapas. Plazas limitadas.',
    'Tapas de toda la vida y cañas bien tiradas en pleno Malasaña.',
    '¡Nueva carta de tapas de otoño! Pasa a probarla.',
    'Trae tu canción, tu poema o tu monólogo. Entrada libre.',
    'Aprende a hacer tagliatelle y ravioli con nuestro chef.',
    'Indie rock madrileño en directo. Apertura de puertas a las 21:00.',
    'Un día entero de clases gratis para nuevos socios.',
    'Cortes a 5 € y todo lo recaudado va a una ONG local.'],
  en: ['Live music every Friday night with the best local bands.',
    "Two cocktails for the price of one until midnight. Don't miss it!",
    'Join us for a wine tasting and tapas this weekend.',
    'Free entry before 11 pm. Book your table now.'],
  ca: ['Música en directe cada divendres a la nit amb les millors bandes.',
    'Dos còctels pel preu d’un fins a la mitjanit. No t’ho perdis!',
    'Vine a tastar els nostres vermuts i tapes aquest dissabte.',
    'Entrada gratuïta abans de les 11. Reserva la teva taula ara.'],
  gl: ['Música en directo todos os venres pola noite coas mellores bandas.',
    'Dous cócteles polo prezo dun ata a medianoite. Non o perdas!',
    'Ven probar os nosos vermús e tapas este sábado.',
    'Entrada de balde antes das 11. Reserva xa a túa mesa.'],
  eu: ['Zuzeneko musika ostiral gauero talde onenekin.',
    'Bi koktel baten prezioan gauerdira arte. Ez galdu!',
    'Etorri gure bermutak eta pintxoak dastatzera larunbat honetan.',
    'Doako sarrera 11ak baino lehen. Erreserbatu zure mahaia orain.'],
  fr: ['Musique live tous les vendredis soir avec les meilleurs groupes.',
    "Deux cocktails pour le prix d'un jusqu'à minuit. C'est le moment !",
    'Venez goûter nos vermouths et tapas ce samedi.',
    'Entrée gratuite avant 23 h. Réservez votre table dès maintenant.'],
  de: ['Livemusik jeden Freitagabend mit den besten Bands der Stadt.',
    'Zwei Cocktails zum Preis von einem bis Mitternacht.',
    'Probiert unsere Wermuts und Tapas an diesem Samstag.',
    'Freier Eintritt vor 23 Uhr. Reserviere jetzt deinen Tisch.'],
  it: ['Musica dal vivo ogni venerdì sera con le migliori band.',
    'Due cocktail al prezzo di uno fino a mezzanotte. Non perderlo!',
    'Vieni ad assaggiare i nostri vermouth e le tapas questo sabato.',
    'Ingresso gratuito prima delle 23. Prenota ora il tuo tavolo.'],
};
for (const [l, textos] of Object.entries(MUESTRAS)) {
  for (const t of textos) ok(adivina(t) === l, `idioma ${l}: ${t} (sale ${adivina(t)})`);
}
ok(adivina('Concierto: The Local Waves') === null && adivina('Happy hour') === null && adivina('') === null,
  'en la duda, nada');
const DUDA = 'Brunch, jazz, vermut, pintxos y cócteles';
ok(adivina(DUDA) === null && !hayQueTraducir(DUDA, 'es') && hayQueTraducir(DUDA, 'en'),
  'en la duda: no con la página en español; sí en inglés (4 palabras o más)');
ok(!hayQueTraducir('Pintxo pote', 'en'), 'en la duda y corto, no');
ok(hayQueTraducir(MUESTRAS.es[0], 'en') && !hayQueTraducir(MUESTRAS.es[0], 'es'), 'otro idioma sí, el suyo no');

if (process.env.SOLO_IDIOMA) {
  console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
  process.exit(fallos ? 1 : 0);
}

// ── El Supabase de mentira (para la Function y para el navegador) ──────────
const TEXTOS = {
  [`offer:${OFERTA}:title`]: 'Cata de vermús de Madrid',
  [`offer:${OFERTA}:description`]: 'Cinco vermús artesanos con maridaje de tapas. Plazas limitadas.',
  [`offer:${OFERTA}:terms`]: 'Reserva en el local.',
  [`business:${BIZ}:description`]: 'Tapas de toda la vida y cañas bien tiradas en pleno Malasaña.',
  [`post:${POST1}:body`]: '¡Nueva carta de tapas de otoño! Pasa a probarla.',
  [`post:${POST2}:body`]: 'Este viernes, vermú con música en directo hasta las doce.',
  [`highlight:${H1}:title`]: 'Croquetas de jamón',
  [`highlight:${H1}:note`]: 'Las de la abuela, cremosas por dentro',
  [`menu_section:${SEC}:name`]: 'Para picar',
  [`menu_item:${ITEM}:name`]: 'Tortilla de patata',
  [`menu_item:${ITEM}:description`]: 'Con cebolla, como debe ser',
};
const ahora = Date.now();
const iso = (h) => new Date(ahora + h * 3600e3).toISOString();
const OFERTA_ROW = {
  id: OFERTA, business_id: BIZ, business_name: 'Bar Sonda', business_city: 'Madrid', business_address: 'Calle Mayor 1',
  lat: 40.4168, lng: -3.7038, images: [], status: 'active', time_zone: 'Europe/Madrid', audience: 'all', locked: false, style: {},
  waitlist_count: 0, redemptions_count: 0, max_per_user: 1, kind: 'future_event', title: TEXTOS[`offer:${OFERTA}:title`],
  description: TEXTOS[`offer:${OFERTA}:description`], terms: TEXTOS[`offer:${OFERTA}:terms`], event_at: iso(30), seats_left: 20,
  price_cents: 1800, currency: 'EUR',
};
const estado = { modo: 'bien', pedidos: [] };

function supabaseFalso() {
  return createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, 'http://x');
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(b)); };
      let args = {};
      try { args = JSON.parse(cuerpo || '{}'); } catch { /* */ }
      const p = url.pathname;
      if (p === '/functions/v1/translate') {
        estado.pedidos.push(args);
        if (args.op === 'status') return json({ available: estado.modo !== 'sin-clave', languages: ['es', 'en'] });
        if (estado.modo === 'sin-clave') return json({ available: false });
        if (estado.modo === 'tope') return json({ available: true, provider: 'google', translations: {}, from: {}, same: [], pending: 1, capped: true });
        const mios = Object.keys(TEXTOS).filter((k) => (args.kind === 'offer' ? k.startsWith('offer:')
          : args.kind === 'menu' ? k.startsWith('menu_') : !k.startsWith('offer:') && !k.startsWith('menu_'))
          && (!args.only || args.only.some((pre) => k.startsWith(pre))));
        return json({ available: true, provider: 'google', translations: Object.fromEntries(mios.map((k) => [k, `[EN] ${TEXTOS[k]}`])),
          from: Object.fromEntries(mios.map((k) => [k, 'es'])), same: [], pending: 0, capped: false });
      }
      if (p === '/rest/v1/rpc/offer_detail') return json(args.p_id === OFERTA ? [OFERTA_ROW] : []);
      if (p === '/rest/v1/rpc/business_profile') {
        return json([{ id: BIZ, name: 'Bar Sonda', city: 'Madrid', address: 'Calle Mayor 1, 28013 Madrid', lat: 40.4168, lng: -3.7038,
          is_verified: true, member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid', posts: 2,
          description: TEXTOS[`business:${BIZ}:description`], closed_indefinitely: false, social: {}, rating: null, ratings: 0 }]);
      }
      if (p === '/rest/v1/business_posts') {
        return json([
          { id: POST1, body: TEXTOS[`post:${POST1}:body`], image_url: null, created_at: iso(-48) },
          { id: POST2, body: TEXTOS[`post:${POST2}:body`], image_url: null, created_at: iso(-72) },
        ]);
      }
      if (p === '/rest/v1/rpc/business_menu') {
        return json([{ id: SEC, name: TEXTOS[`menu_section:${SEC}:name`], position: 1, items: [
          { id: ITEM, name: TEXTOS[`menu_item:${ITEM}:name`], description: TEXTOS[`menu_item:${ITEM}:description`], price_cents: 350, allergens: [] },
        ] }]);
      }
      if (p === '/rest/v1/rpc/business_ficha_info') {
        return json({ highlights: [{ id: H1, title: TEXTOS[`highlight:${H1}:title`], note: TEXTOS[`highlight:${H1}:note`] }], moments: [], special_days: [] });
      }
      return json([]);
    });
  });
}


// Pegado al texto (Iván, 2026-10-28): el hueco que se ve entre el texto y
// «Translate» (de la caja de su línea a la del enlace) y la zona de toque
// (≥ 44 de alto: el toque 10 px por encima o por debajo de lo que se ve
// también es del enlace).
const pegado = (p, texto, nota) => p.evaluate(([t, n]) => {
  const el = document.querySelector(t);
  const b = document.querySelector(`${n} .tr-boton`);
  b.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = el.getBoundingClientRect();
  const v = b.querySelector('span').getBoundingClientRect();
  const x = v.left + 4;
  const zona = [v.top - 10, v.bottom + 10].map((y) => document.elementFromPoint(x, y)).map((e) => (e?.closest('.tr-boton') === b ? true : `${e?.tagName}.${e?.className}`));
  return { hueco: Math.round(v.top - r.bottom), zona, m: getComputedStyle(el).marginBottom, mt: getComputedStyle(b.parentElement).marginTop, prev: b.parentElement.previousElementSibling?.tagName };
}, [texto, nota]);
const traducciones = () => estado.pedidos.filter((x) => x.op !== 'status');
const empieza = async (nav, vp, { siempre = false, modo = 'bien' } = {}) => {
  estado.modo = modo;
  estado.pedidos = [];
  const c = await nav.newContext({ viewport: vp, locale: 'en-GB' });
  if (siempre) await c.addInitScript(() => localStorage.setItem('klendar.traducir', '1'));
  const p = await c.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  return { c, p, errores };
};

async function oferta(nav, nombre, t, vp) {
  let { c, p, errores } = await empieza(nav, vp);
  await p.goto(`http://localhost:${FICHA_PORT}/en/o/${OFERTA}`, { waitUntil: 'networkidle' });
  const nota = p.locator(`[data-tr-nota="offer:${OFERTA}:"]`);
  await nota.locator('button').waitFor({ timeout: 8000 });
  ok(await nota.locator('button').innerText() === 'Translate', `${nombre}/${t} oferta: «Translate» bajo el título`);
  ok(traducciones().length === 0, `${nombre}/${t} oferta: nada pedido sin tocar`);
  const g = await pegado(p, 'h1', `[data-tr-nota="offer:${OFERTA}:"]`);
  ok(g.hueco >= 0 && g.hueco <= 8 && g.zona.every((z) => z === true), `${nombre}/${t} oferta: pegado al título ${JSON.stringify(g)}`);
  await p.screenshot({ path: `${OUT}/web-oferta-traducir-${nombre}-${t}.png` });
  await nota.locator('button').click();
  await p.waitForFunction(() => /\[EN\]/.test(document.querySelector('h1').textContent));
  ok(await p.locator('h1').innerText() === '[EN] Cata de vermús de Madrid', `${nombre}/${t} oferta: título traducido`);
  ok(await p.locator('h1').getAttribute('lang') === 'en-x-mtfrom-es', `${nombre}/${t} oferta: marcado como traducción automática`);
  ok(/\[EN\] Cinco vermús/.test(await p.locator(`[data-tr="offer:${OFERTA}:description"]`).innerText()), `${nombre}/${t} oferta: descripción traducida`);
  ok(await nota.locator('button').innerText() === 'See original' && await nota.locator('.tr-atrib').innerText() === 'Translated automatically · Google Translate',
    `${nombre}/${t} oferta: «See original» y la atribución`);
  ok(traducciones().length === 1 && traducciones()[0].kind === 'offer' && traducciones()[0].lang === 'en', `${nombre}/${t} oferta: una petición ${JSON.stringify(traducciones())}`);
  await p.screenshot({ path: `${OUT}/web-oferta-traducida-${nombre}-${t}.png` });
  await nota.locator('button').click();
  ok(await p.locator('h1').innerText() === 'Cata de vermús de Madrid' && await nota.locator('button').innerText() === 'See translation'
    && await p.locator('h1').getAttribute('lang') === null, `${nombre}/${t} oferta: «See original»`);
  await nota.locator('button').click();
  ok(/\[EN\]/.test(await p.locator('h1').innerText()) && traducciones().length === 1, `${nombre}/${t} oferta: «See translation» sin volver a pedir`);
  ok(errores.length === 0, `${nombre}/${t} oferta sin errores JS ${errores.join(' | ')}`);
  await c.close();

  // En español: el texto ya está en su idioma.
  ({ c, p, errores } = await empieza(nav, vp));
  await p.goto(`http://localhost:${FICHA_PORT}/o/${OFERTA}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok(await p.locator('.tr-nota').count() === 0 && estado.pedidos.length === 0, `${nombre}/${t} oferta en español: nada, ni una petición`);
  await c.close();

  // Tope del mes.
  ({ c, p, errores } = await empieza(nav, vp, { modo: 'tope' }));
  await p.goto(`http://localhost:${FICHA_PORT}/en/o/${OFERTA}`, { waitUntil: 'networkidle' });
  await nota.locator('button').waitFor({ timeout: 8000 }).catch(() => null);
  await p.locator(`[data-tr-nota="offer:${OFERTA}:"] button`).click();
  await p.waitForSelector('.tr-falla', { timeout: 8000 }).catch(() => null);
  ok(await p.locator('.tr-falla').innerText().catch(() => '') === "Couldn't translate right now"
    && await p.locator('h1').innerText() === 'Cata de vermús de Madrid', `${nombre}/${t} tope: «Couldn't translate right now» y el original`);
  await p.screenshot({ path: `${OUT}/web-oferta-tope-${nombre}-${t}.png` });
  await c.close();

  // Sin clave.
  ({ c, p, errores } = await empieza(nav, vp, { modo: 'sin-clave' }));
  await p.goto(`http://localhost:${FICHA_PORT}/en/o/${OFERTA}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok(await p.locator('.tr-nota').count() === 0 && traducciones().length === 0, `${nombre}/${t} sin clave: nada`);
  await c.close();
}

async function ficha(nav, nombre, t, vp) {
  let { c, p, errores } = await empieza(nav, vp);
  await p.goto(`http://localhost:${FICHA_PORT}/en/b/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.tr-nota button', { timeout: 8000 }).catch(() => null);
  const notas = async (pre) => p.locator(`[data-tr-nota="${pre}"] button`).count();
  ok(await notas(`business:${BIZ}:description`) === 1 && await notas(`post:${POST1}:`) === 1 && await notas(`post:${POST2}:`) === 1
    && await notas('highlight:') === 1 && await notas('menu_') === 1,
    `${nombre}/${t} ficha: «Translate» bajo la descripción, cada novedad, «Qué pedir aquí» y la carta`);
  ok(traducciones().length === 0, `${nombre}/${t} ficha: nada pedido sin tocar`);
  for (const [texto, nota] of [[`[data-tr="business:${BIZ}:description"]`, `[data-tr-nota="business:${BIZ}:description"]`],
    [`[data-tr="post:${POST1}:body"]`, `[data-tr-nota="post:${POST1}:"]`], ['.que-pedir', '[data-tr-nota="highlight:"]']]) {
    const g = await pegado(p, texto, nota);
    ok(g.hueco >= 0 && g.hueco <= 8 && g.zona.every((z) => z === true), `${nombre}/${t} ficha: pegado ${nota} ${JSON.stringify(g)}`);
  }
  await p.locator(`[data-tr-nota="post:${POST1}:"] button`).click();
  await p.waitForFunction((id) => /\[EN\]/.test(document.querySelector(`[data-tr="post:${id}:body"]`).textContent), POST1);
  ok(JSON.stringify(traducciones()[0]?.only) === JSON.stringify([`post:${POST1}:`]) && traducciones()[0].kind === 'business',
    `${nombre}/${t} ficha: una novedad pide solo lo suyo ${JSON.stringify(traducciones())}`);
  ok(!/\[EN\]/.test(await p.locator(`[data-tr="post:${POST2}:body"]`).innerText())
    && !/\[EN\]/.test(await p.locator(`[data-tr="business:${BIZ}:description"]`).innerText()), `${nombre}/${t} ficha: lo demás, en el original`);
  await p.locator(`[data-tr-nota="menu_"] button`).click();
  await p.waitForFunction((id) => /\[EN\]/.test(document.querySelector(`[data-tr="menu_item:${id}:name"]`).textContent), ITEM);
  ok(traducciones()[1]?.kind === 'menu' && !traducciones()[1].only, `${nombre}/${t} ficha: la carta entera de una vez`);
  await p.locator('#novedades').scrollIntoViewIfNeeded().catch(() => null);
  await p.screenshot({ path: `${OUT}/web-ficha-traducir-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} ficha sin errores JS ${errores.join(' | ')}`);
  await c.close();

  // «Traducir siempre automáticamente».
  ({ c, p, errores } = await empieza(nav, vp, { siempre: true }));
  await p.goto(`http://localhost:${FICHA_PORT}/en/b/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForFunction((id) => /\[EN\]/.test(document.querySelector(`[data-tr="business:${id}:description"]`).textContent), BIZ, { timeout: 8000 }).catch(() => null);
  const kinds = traducciones().map((x) => x.kind).sort();
  ok(JSON.stringify(kinds) === '["business","menu"]', `${nombre}/${t} siempre: una llamada por ficha y carta ${JSON.stringify(traducciones())}`);
  ok(/\[EN\]/.test(await p.locator(`[data-tr="post:${POST2}:body"]`).innerText())
    && await p.locator('.tr-atrib').count() === 5, `${nombre}/${t} siempre: todo traducido, con su atribución`);
  await p.screenshot({ path: `${OUT}/web-ficha-siempre-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} siempre sin errores JS ${errores.join(' | ')}`);
  await c.close();
}

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const falso = supabaseFalso();
await new Promise((r) => falso.listen(FALSO_PORT, r));
const servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(FICHA_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2000));
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const f of [oferta, ficha]) {
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${f.name}: ${e.message.split('\n')[0]}`));
    }
  }
  await nav.close();
}
servidor.kill();
falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
