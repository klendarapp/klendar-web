// «Ayuda guiada» en la web (Iván, 18-11; RUNBOOK §4zzc de la app, parte C):
// lo mismo que la app en el panel del negocio y en «Tu cuenta», con los
// MISMOS textos (GLOSARIO, «Aspecto › Pantallas vacías que enseñan»). En la
// web no hay recorrido ni «Lo que más usas» (solo app).
//
//   1. Los textos de los vacíos que enseñan, en el código y en los 8 idiomas.
//   2. «Tu primer código»: una vez por persona en este navegador, sin
//      nombrar la pantalla de bloqueo (la web no la tiene).
//   3. En el navegador (Chromium, móvil), con un Supabase de mentira: el
//      panel (series, días cerrados, RRPP con «Listas de esta noche»,
//      partidos y la Ayuda con el asistente encendido y apagado) y «Tu
//      cuenta» (Tus planes, Tus códigos, Sellos y el primer código, que sale
//      una vez). Capturas en OUT.
//
//   node tools/ayuda_guiada_check.mjs            (solo 1 y 2)
//   PW=<ruta a playwright> node tools/ayuda_guiada_check.mjs --navegador
//   (con --navegador arranca su serve_dev en PORT, 8941, con Supabase cortado)
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = new URL('..', import.meta.url);
const lee = (f) => readFileSync(new URL(f, raiz), 'utf8');
let fallos = 0;
const ok = (cond, nombre) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

// ── 1. Los textos (los de la app, `lib/l10n/app_es.arb`) ─────────────────
const PANEL = {
  'panel/panel.js': [
    'Cuando quien lleva el negocio cree una, la verás aquí.',
    'Marca vacaciones, festivos u obras, por ejemplo «del 1 al 15 de agosto», y tu ficha dirá hasta cuándo cierras.',
  ],
  'panel/sorteos.js': ['Sortea algo entre quienes te tienen en favoritos, por ejemplo «una cena para dos»: es gratis para ellos y te trae gente nueva.'],
  'assets/emisiones.js': [
    'Añade los partidos que vas a poner, por ejemplo «Betis – Sevilla, domingo a las 21:00», y saldrán en tu ficha para quien busque dónde verlos.',
    'Añadir un partido',
  ],
  'panel/aforo.js': ['Cuenta en la puerta con +1 y −1, y «¿Hay sitio ahora?» se pone solo. Por ejemplo: «32 de 60». Actívalo y pon cuántas personas caben.'],
  'panel/rrpp.js': [
    'Aún no tienes RRPP. Invita a alguien por su correo: tendrá su enlace y su QR para traer gente, y solo verá su lista.',
    'Nadie en las listas de esta noche',
    'Aquí sale quien se apunta con el enlace de un RRPP, por ejemplo «Lista de Laura · 4 personas». Le buscas por su nombre y le validas en la puerta.',
  ],
  'panel/series.js': ['Ver publicaciones'],
  'panel/grupos.js': ['Cuando alguien te pida presupuesto para un grupo, por ejemplo «cena de empresa para 20 personas», lo verás aquí.'],
  'panel/cola.js': ['No hay nadie esperando. La gente coge número escaneando el cartel de la puerta.'],
  'panel/preguntas.js': ['No tienes preguntas sin contestar. La gente te pregunta desde tu ficha, por ejemplo «¿Hay terraza?», y aquí contestas.'],
};
const CUENTA = [
  'Aquí tendrás lo que guardas, tus reservas y tus códigos, por fechas. Cuando algo te guste, dale a «Guardar».',
  'Cuando consigas el código de una oferta o reserves plaza en un evento, lo tendrás aquí para enseñarlo en el local.',
  'Funcionan como las de cartón: cada canje en un sitio con tarjeta suma un sello y, al completarla, tienes tu premio. Se abren solas con el primero, o escaneando el QR del local.',
  'Enséñalo en el local para que te lo validen. Lo tienes en Tus códigos.',
];
const IDIOMAS = ['ca', 'gl', 'eu', 'fr', 'de', 'it'];
const js = JSON.stringify;
for (const [f, textos] of Object.entries(PANEL)) {
  const src = lee(f);
  for (const s of textos) {
    ok(src.includes(s), `1. ${f}: «${s.slice(0, 48)}…»`);
    for (const l of IDIOMAS) ok(lee(`panel/i18n/${l}.js`).includes(`${js(s)}:`), `1. panel ${l}: «${s.slice(0, 30)}…»`);
  }
}
const app = lee('assets/cuenta/app.js');
const en = lee('assets/cuenta/i18n.js');
for (const s of CUENTA) {
  ok(app.includes(`t('${s}')`), `1. cuenta: «${s.slice(0, 48)}…»`);
  ok(en.includes(`${js(s)}:`), `1. cuenta en: «${s.slice(0, 30)}…»`);
  for (const l of IDIOMAS) ok(lee(`assets/cuenta/i18n/${l}.js`).includes(`${js(s)}:`), `1. cuenta ${l}: «${s.slice(0, 30)}…»`);
}
ok(/t\('Ver ofertas'\)[\s\S]{0,200}t\('Tu QR de cliente'\)/.test(app), '1. Tus códigos vacío: «Ver ofertas» y, debajo, «Tu QR de cliente»');
ok(/t\('Descubre'\)\)\}<\/a>\$\{navigator\.mediaDevices\?\.getUserMedia[\s\S]{0,120}t\('Escanear un QR'\)/.test(app), '1. Sellos vacío: «Descubre» y «Escanear un QR» (con cámara)');
ok(en.includes('"Ver ofertas": "See offers"'), '1. «Ver ofertas» en inglés');
ok(!/pantalla de bloqueo/.test(CUENTA[3]), '2. la frase de la web no nombra la pantalla de bloqueo');

// ── 2. primerCodigo(): una vez por persona en este navegador ─────────────
{
  const ini = app.indexOf('function primerCodigo(');
  let i = app.indexOf('{', ini);
  for (let n = 0; i < app.length; i++) { if (app[i] === '{') n++; else if (app[i] === '}' && --n === 0) break; }
  const almacen = new Map();
  const localStorage = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)) };
  const hacer = (yo) => new Function('localStorage', 'YO', `${app.slice(ini, i + 1)}; return primerCodigo;`)(localStorage, yo);
  const ana = hacer({ id: 'u1' });
  ok(ana() === true && ana() === false, '2. sale la primera vez y no la segunda');
  ok(hacer({ id: 'u2' })() === true, '2. otra persona en el mismo navegador, sí');
  ok(hacer(null)() === false, '2. sin sesión, nada');
  ok(!/klendar\.primer_codigo/.test(app.slice(app.indexOf("if (ev === 'SIGNED_OUT')"), app.indexOf("if (ev === 'SIGNED_OUT')") + 800)),
    '2. no se borra al cerrar sesión (una vez por persona)');
}

// ── El asistente en la Ayuda del panel ────────────────────────────────────
const panel = lee('panel/panel.js');
const ayuda = panel.slice(panel.indexOf('PAGES.ayuda = '), panel.indexOf('// ── Dar de baja el negocio'));
ok(ayuda.includes('<div data-asistente hidden></div>') && ayuda.includes('window.KL_ASISTENTE?.monta()'), '3. la Ayuda del panel monta el asistente');
const html = lee('panel.html');
ok(/<script src="\/assets\/asistente\.js\?v=[^"]+"><\/script>/.test(html) && /asistente\.css/.test(html), '3. panel.html carga asistente.js y su CSS');

// ── 3. En el navegador ────────────────────────────────────────────────────
if (process.argv.includes('--navegador')) await navegador();

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);

async function navegador() {
  const { playwright, REF, SUPA, servidorSeguro } = await import('./_supabase_simulado.mjs');
  const { chromium } = playwright();
  const PORT = Number(process.env.PORT || 8941);
  const BASE = `http://localhost:${PORT}`;
  const OUT = process.env.OUT || 'tools/out/ayuda_guiada';
  mkdirSync(OUT, { recursive: true });
  const dev = spawn(process.execPath, [fileURLToPath(new URL('serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(PORT), SUPABASE_BLOQUEADO: '1' }, stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 50; i++) {
      try { await fetch(`${BASE}/__supabase_bloqueado`); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
    }
    await servidorSeguro(BASE);

    const U = '0e7717e0-0000-4000-8000-0000000a7da1';
    const BIZ = 'b1000000-0000-4000-8000-0000000a7da1';
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2', amr: [{ method: 'password', timestamp: 1 }] })}.firma`;
    const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'ayuda.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Ana' }, created_at: '2026-01-01T00:00:00Z' };
    const sesion = JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
    const SUB = { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: '2027-01-01T00:00:00Z', payment_method: 'transfer',
      price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
      billing: { enabled: true, blocked: false, hold: null, block_soon: false } };

    const contexto = async (rpc) => {
      const ctx = await (await chromium.launch()).newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
      await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion]);
      const base = {
        my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
        my_businesses: [{ id: BIZ, name: 'Café Aurora', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' }],
        business_is_organizer: false,
        my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
        my_subscription: SUB,
        business_tools_overview: { ok: true, can_edit: true },
        business_report: { ok: true, totals: {}, daily: [], offers: [], by_hour: [], redemptions: [], loyalty: {} },
        assistant_status: { available: false },
        ...rpc,
      };
      // El tiempo real (el código validado en el local): mudo.
      await ctx.routeWebSocket(new RegExp(`^wss://${REF}\\.supabase\\.co/realtime/`), () => { /* mudo */ });
      await ctx.route(`${SUPA}/**`, async (route) => {
        const req = route.request();
        const p = new URL(req.url()).pathname;
        const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
        if (p.startsWith('/auth/v1/user')) return json(USER);
        if (p.startsWith('/auth/v1/')) return json({});
        if (p.startsWith('/rest/v1/rpc/')) {
          const fn = p.slice('/rest/v1/rpc/'.length);
          const r = base[fn];
          return json(typeof r === 'function' ? r() : r === undefined ? [] : r);
        }
        if (p.startsWith('/rest/v1/')) return json([]);
        return json({});
      });
      const pg = await ctx.newPage();
      const errores = [];
      pg.on('pageerror', (e) => errores.push(e.message));
      pg.setDefaultTimeout(15000);
      return { ctx, pg, errores };
    };
    const texto = (pg, sel = 'body') => pg.locator(sel).innerText();

    // Panel: los vacíos que enseñan.
    {
      const { ctx, pg, errores } = await contexto({});
      for (const [ruta, buscar, foto] of [
        ['series', 'Micro abierto de los jueves', 'panel-series'],
        ['cerrados', 'del 1 al 15 de agosto', 'panel-dias-cerrados'],
        ['rrpp', 'Lista de Laura · 4 personas', 'panel-rrpp-listas'],
      ]) {
        await pg.goto(`${BASE}/panel#/${ruta}`);
        await pg.waitForFunction((s) => document.querySelector('#view')?.innerText.includes(s), buscar, { timeout: 15000 }).catch(() => null);
        ok((await texto(pg, '#view')).includes(buscar), `3. panel #/${ruta}: «${buscar}»`);
        await pg.screenshot({ path: `${OUT}/${foto}.png`, fullPage: true });
      }
      await pg.goto(`${BASE}/panel#/series`);
      await pg.waitForSelector('#view a[href="#/publicaciones"]', { timeout: 15000 }).catch(() => null);
      ok(await pg.locator('#view a[href="#/publicaciones"]').count() === 1, '3. panel series vacías: «Ver publicaciones»');
      // La Ayuda, con el asistente apagado: nada.
      await pg.goto(`${BASE}/panel#/ayuda`);
      await pg.waitForSelector('#view [data-asistente]', { state: 'attached' });
      await pg.waitForTimeout(800);
      ok(await pg.locator('#view [data-asistente]').isHidden(), '3. Ayuda del panel con el asistente apagado: sin entrada');
      ok(!errores.length, `3. panel sin errores JS ${errores.join(' | ')}`);
      await ctx.close();
    }
    {
      const { ctx, pg, errores } = await contexto({ assistant_status: { available: true, signed_in: true, consent: true, asked: true, max_turns: 6, max_chars: 500 } });
      await pg.goto(`${BASE}/panel#/ayuda`);
      await pg.waitForSelector('#view [data-asistente] .asis-entrada', { timeout: 15000 }).catch(() => null);
      ok(await pg.locator('#view [data-asistente] .asis-entrada').isVisible(), '3. Ayuda del panel con el asistente encendido: «Pregúntale al asistente» arriba');
      await pg.screenshot({ path: `${OUT}/panel-ayuda-asistente.png`, fullPage: true });
      ok(!errores.length, `3. Ayuda sin errores JS ${errores.join(' | ')}`);
      await ctx.close();
    }

    // «Tu cuenta»: los vacíos y el primer código.
    {
      const ahora = Date.now();
      const ticket = { id: 'r1', code: '87249cecd8a637aa', expires_at: new Date(ahora + 5 * 60e3).toISOString(), now: new Date(ahora).toISOString(),
        business_name: 'Café Aurora', offer_title: 'Café y tostada 2,50', offer_kind: 'flash', seats: 1, named: false, status: 'pending' };
      const { ctx, pg, errores } = await contexto({ start_redemption: ticket, offer_tz: 'Europe/Madrid', my_stamp_cards: [], my_redemptions: [] });
      for (const [ruta, buscar, botones, foto] of [
        ['planes', 'por fechas', ['Descubre'], 'cuenta-planes'],
        ['codigos', 'para enseñarlo en el local', ['Ver ofertas', 'Tu QR de cliente'], 'cuenta-codigos'],
        ['sellos', 'Funcionan como las de cartón', ['Descubre'], 'cuenta-sellos'],
      ]) {
        await pg.goto(`${BASE}/cuenta/${ruta}`);
        await pg.waitForSelector('.vacio', { timeout: 15000 }).catch(() => null);
        const t = await texto(pg, '.vacio').catch(() => '');
        ok(t.includes(buscar), `3. cuenta/${ruta}: «${buscar}»`);
        for (const b of botones) ok(await pg.locator('.vacio .vacio-botones a', { hasText: b }).count() === 1, `3. cuenta/${ruta}: botón «${b}»`);
        await pg.screenshot({ path: `${OUT}/${foto}.png`, fullPage: true });
      }
      const FRASE = 'Enséñalo en el local para que te lo validen. Lo tienes en Tus códigos.';
      const abre = async () => {
        await pg.goto(`${BASE}/cuenta/codigo/o1`);
        const boton = pg.getByRole('button', { name: 'Conseguir el código' });
        await Promise.race([boton.waitFor({ timeout: 8000 }), pg.waitForSelector('.ticket #qr', { timeout: 8000 })]).catch(() => null);
        if (await boton.count()) await boton.click();
        await pg.waitForSelector('.ticket #qr', { timeout: 15000 });
      };
      await abre();
      ok((await texto(pg, '.ticket')).includes(FRASE), '3. el primer código: la frase debajo');
      await pg.screenshot({ path: `${OUT}/cuenta-primer-codigo.png`, fullPage: true });
      await abre();
      ok(!(await texto(pg, '.ticket')).includes(FRASE), '3. el segundo: ya no');
      ok(!errores.length, `3. cuenta sin errores JS ${errores.join(' | ')}`);
      await ctx.close();
    }
  } finally {
    dev.kill();
  }
}
