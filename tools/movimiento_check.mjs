// Movimiento (2026-10-27; docs/GLOSARIO.md de la app, «Aspecto → Movimiento»)
// en la web local, con y sin «Reducir movimiento», sin tocar la base (Supabase
// de mentira para «Tu cuenta»):
//  1. Las variables `--mov-*` son las de la app (100/150/200/280 ms).
//  2. Portada y Descubre: lo que se anima solo toca transform y opacidad
//     (y el trazo de la marca de «hecho»), nada pasa de 300 ms y, con
//     «Reducir movimiento», no queda ninguna animación.
//  3. «Tu cuenta»: una pantalla nueva entra escalonada (`.mov-entra`); con
//     «Reducir movimiento», no.
//  4. Favoritos: quitar uno pliega su fila (las de debajo suben con
//     transform), el aviso «Deshacer» entra animado y se va con un fundido.
//     Con «Reducir movimiento», la fila se va al momento y el aviso, quieto.
//  5. «Seguir» encendido late (.mov-late) y apagado no.
//  6. Sin errores en la consola.
// Chromium y WebKit, móvil (375) y escritorio. Capturas en OUT.
//
//   PORT=8877 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8877 node tools/movimiento_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8877';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000097d1';
const BIZ = 'b1000000-0000-4000-8000-0000000097d1';
const BIZ2 = 'b1000000-0000-4000-8000-0000000097d2';
const BIZ3 = 'b1000000-0000-4000-8000-0000000097d3';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'mov@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, name: 'Bar Sonda', time_zone: 'Europe/Madrid' }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

/** Lo que se está animando ahora mismo: propiedades y duración. */
const animaciones = (p) => p.evaluate(() => document.getAnimations().map((a) => {
  const t = a.effect?.getTiming?.() || {};
  const props = new Set();
  for (const k of a.effect?.getKeyframes?.() || []) {
    for (const x of Object.keys(k)) if (!['offset', 'easing', 'composite', 'computedOffset'].includes(x)) props.add(x);
  }
  return { nombre: a.animationName || a.transitionProperty || a.id || '', props: [...props], dur: Number(t.duration) || 0, iter: t.iterations };
}));
// Lo único que se anima: transform y opacidad (y `scale`/`translate`, que son
// transform), más el trazo de la marca de «hecho» (stroke-dashoffset, solo
// pintura del SVG).
const PERMITIDAS = new Set(['transform', 'opacity', 'scale', 'translate', 'strokeDashoffset', 'stroke-dashoffset']);

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const reducido of [false, true]) {
      const tag = `${nombre}/${forma}${reducido ? '/reducido' : ''}`;
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid', reducedMotion: reducido ? 'reduce' : 'no-preference' });
      await ctx.addInitScript(([k, v]) => {
        try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ }
      }, [`sb-${REF}-auth-token`, sesion()]);
      let quitado = false;
      const estado = {
        llamadas: [],
        rpc: {
          my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
          my_businesses: [],
          my_favorites: () => ([
            { id: BIZ, name: 'Bar Sonda', logo: null, category_id: 'c1', city: 'Madrid', distance_m: 1200, active_flash: 1, upcoming_events: 0 },
            { id: BIZ2, name: 'Fiestas Luna', logo: null, category_id: 'c1', city: 'Madrid', distance_m: 300, active_flash: 0, upcoming_events: 2 },
            { id: BIZ3, name: 'Café Nube', logo: null, category_id: 'c1', city: 'Madrid', distance_m: 900, active_flash: 0, upcoming_events: 0 },
          ].filter((b) => !quitado || b.id !== BIZ)),
          favorites_feed: [],
          toggle_favorite: () => { quitado = !quitado; return !quitado; },
        },
        tablas: {},
      };
      await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
      const page = await ctx.newPage();
      page.setDefaultTimeout(15000);
      const errores = [];
      const deFuera = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed|turnstile|challenges/i.test(x);
      page.on('console', (m) => { if (m.type() === 'error' && !deFuera(m.text())) errores.push(m.text()); });
      page.on('pageerror', (e) => { if (!deFuera(`${e.message} ${e.stack || ''}`)) errores.push(String(e)); });

      // 1 y 2. Portada y Descubre.
      for (const ruta of ['/', '/descubre/']) {
        await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(60);
        if (ruta === '/') {
          const v = await page.evaluate(() => ['--mov-pulsar', '--mov-rapido', '--mov-base', '--mov-lento']
            .map((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()));
          ok(v.join() === '100ms,150ms,200ms,280ms', `${tag} variables de movimiento ${v.join()}`);
        }
        const an = (await animaciones(page)).filter((a) => a.iter !== Infinity);
        const raras = an.filter((a) => a.props.some((x) => !PERMITIDAS.has(x)));
        ok(raras.length === 0, `${tag} ${ruta}: solo transform y opacidad ${JSON.stringify(raras)}`);
        const largas = an.filter((a) => a.dur > 300 && !/float/.test(a.nombre));
        ok(largas.length === 0, `${tag} ${ruta}: nada pasa de 300 ms ${JSON.stringify(largas)}`);
        if (reducido) {
          const vivas = an.filter((a) => a.dur > 1);
          ok(vivas.length === 0, `${tag} ${ruta}: sin animaciones con «Reducir movimiento» ${JSON.stringify(vivas)}`);
        }
      }
      // La hoja de ☰ (segunda pasada, filtros en tres preguntas): sube en el
      // móvil, crece en el escritorio; un bloque abierto despliega lo suyo.
      await page.goto(`${BASE}/explorar/?lat=40.417&lng=-3.704`, { waitUntil: 'domcontentloaded' });
      await page.locator('#filtros > summary').click();
      await page.waitForTimeout(40);
      const hoja = await page.evaluate(() => getComputedStyle(document.querySelector('#filtros > .hoja-cuerpo')).animationName);
      const esperada = reducido ? 'none' : forma === 'movil' ? 'mov-hoja-sube' : 'mov-hoja-centro';
      ok(hoja === esperada, `${tag} la hoja de ☰ se abre con ${hoja}`);
      const bloque = page.locator('#filtros details.hoja-bloque:not([open]) > summary').first();
      if (await bloque.count()) {
        await bloque.click();
        await page.waitForTimeout(40);
        const b = await page.evaluate(() => {
          const c = [...document.querySelectorAll('#filtros details.hoja-bloque[open] > .hoja-bloque-c')].pop();
          return c ? getComputedStyle(c).animationName : 'sin bloque';
        });
        ok(b === (reducido ? 'none' : 'mov-sube'), `${tag} el bloque se despliega con ${b}`);
      }
      const anH = (await animaciones(page)).filter((a) => a.iter !== Infinity);
      ok(anH.every((a) => a.props.every((x) => PERMITIDAS.has(x))), `${tag} hoja: solo transform y opacidad ${JSON.stringify(anH)}`);
      if (reducido) ok(anH.every((a) => a.dur <= 1), `${tag} hoja: quieta con «Reducir movimiento»`);
      await page.screenshot({ path: `${OUT}/mov-hoja-${nombre}-${forma}${reducido ? '-reducido' : ''}.png` });

      if (forma === 'movil') {
        // La pestaña elegida: su icono crece al llegar (sin reducir).
        const pop = await page.evaluate(() => getComputedStyle(document.querySelector('.tabbar .tab[aria-current="page"] svg') || document.body).animationName);
        ok(reducido ? pop === 'none' : pop === 'mov-pop', `${tag} pestaña elegida: ${pop}`);
      }

      // 3 y 4. «Tu cuenta» › Favoritos.
      await page.goto(`${BASE}/app/#/favoritos`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.fav-fila');
      const entra = await page.evaluate(() => document.getElementById('view').classList.contains('mov-entra'));
      ok(reducido ? !entra : entra, `${tag} pantalla nueva ${reducido ? 'quieta' : 'entra escalonada'}`);
      await page.waitForTimeout(450);
      const filas = await page.locator('.fav-fila').count();
      ok(filas === 3, `${tag} favoritos: tres filas`);
      const yDe = (i) => page.locator('.fav-fila').nth(i).evaluate((el) => el.getBoundingClientRect().top);
      const y0 = await yDe(0);
      await page.locator('[data-quitar-fav]').first().click();
      if (!reducido) {
        await page.waitForTimeout(60);
        const an = await animaciones(page);
        ok(an.length > 0 && an.every((a) => a.props.every((x) => PERMITIDAS.has(x))), `${tag} plegar: con transform y opacidad ${JSON.stringify(an)}`);
      }
      await page.waitForFunction(() => document.querySelectorAll('.fav-fila').length === 2);
      ok(estado.llamadas.some(([fn]) => fn === 'toggle_favorite'), `${tag} quitar favorito llama a toggle_favorite`);
      await page.waitForTimeout(300);
      const y2 = await yDe(0);
      ok(Math.abs(y2 - y0) < 2 && /Fiestas Luna/.test(await page.locator('.fav-fila').first().innerText()),
        `${tag} la de debajo ocupa su sitio (${Math.round(y0)} → ${Math.round(y2)})`);
      const aviso = await page.evaluate(() => {
        const el = document.getElementById('toast');
        return el && !el.hidden ? getComputedStyle(el).animationName : 'oculto';
      });
      ok(reducido ? aviso === 'none' : aviso === 'mov-aviso', `${tag} el aviso «Deshacer» ${aviso}`);
      await page.screenshot({ path: `${OUT}/mov-favoritos-${nombre}-${forma}${reducido ? '-reducido' : ''}.png` });
      // Se va con un fundido.
      const sale = await page.evaluate(() => new Promise((ok) => {
        const el = document.getElementById('toast');
        movOcultaAviso(el);
        const clase = el.classList.contains('mov-sale');
        setTimeout(() => ok({ clase, oculto: el.hidden }), 220);
      }));
      ok(sale.oculto && (reducido ? !sale.clase : sale.clase), `${tag} el aviso se va ${reducido ? 'al momento' : 'con un fundido'}`);

      // 5. «Seguir» encendido late.
      const late = await page.evaluate(() => new Promise((ok) => {
        const b = document.createElement('button');
        b.className = 'pill';
        b.setAttribute('aria-pressed', 'false');
        document.body.append(b);
        b.setAttribute('aria-pressed', 'true');
        setTimeout(() => {
          const on = b.classList.contains('mov-late');
          b.setAttribute('aria-pressed', 'false');
          b.classList.remove('mov-late');
          setTimeout(() => { ok({ on, off: b.classList.contains('mov-late') }); b.remove(); }, 30);
        }, 30);
      }));
      ok(reducido ? !late.on : late.on && !late.off, `${tag} «Seguir» al encenderse ${reducido ? 'quieto' : 'late'}`);

      ok(errores.length === 0, `${tag} sin errores en la consola ${errores.join(' | ')}`);
      await ctx.close();
    }
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
