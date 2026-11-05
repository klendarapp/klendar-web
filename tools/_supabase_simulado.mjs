// Supabase simulado y bloqueado para las pruebas de tools/ (Iván, 2026-11-05).
//
// Desde el 4-11 la web llama a PRODUCCIÓN (config.js). Las pruebas simulan
// Supabase con `ctx.route(...)`, pero lo que una prueba no simulara salía de
// verdad (escrituras incluidas). Este módulo es el único sitio de tools/ que
// sabe a qué proyecto apunta la web y el único que nombra los proyectos
// (el pre-push, tools/supabase_refs_check.py, lo vigila):
//
//  - REF / SUPA / KEY: el proyecto de config.js (lo que la web va a llamar),
//    para enrutar ahí lo simulado y para las claves de sesión de mentira
//    (`claveSesion()` → `sb-<ref>-auth-token`).
//  - playwright(): carga Playwright (PW=ruta o el instalado) con cada
//    contexto ya protegido: cualquier petición a `*.supabase.co` que la
//    prueba no conteste (de cualquier proyecto, también por WebSocket) se
//    corta antes de salir y la prueba FALLA al acabar, con la lista.
//    Lo que la prueba enruta después (ctx.route / page.route) manda sobre
//    esta red de seguridad, que va la primera y por eso es la última en
//    mirar cada petición.
//  - fetch de Node de la prueba: lo mismo (cortado y la prueba falla).
//  - serve_dev con SUPABASE_BLOQUEADO (los que lanza la prueba lo heredan; el
//    de BASE se arranca así y servidorSeguro() lo comprueba): lo que sus
//    Functions pidan a `*.supabase.co` no sale; se contesta aquí como una
//    base vacía ([] / null) y la prueba lo cuenta como AVISO al acabar (una
//    página que necesita datos de verdad saldrá vacía y su prueba lo dirá).
//
//  - config.js de la web local, sin la clave de Turnstile de producción (en
//    localhost no vale): como dev. Quien prueba Turnstile enruta config.js.
//
// `--en-vivo` (p. ej. contra https://klendar.app con BASE=…): deja pasar solo
// GET/HEAD a lo público de lectura (/rest/v1/… sin sesión, la parte pública
// de /storage/v1/ y /auth/v1/settings). Todo lo demás, bloqueado igual. Sin
// `--en-vivo`, una BASE que no sea localhost no arranca.
//
// Ayudas: servidorSeguro(BASE) (al empezar), configA() (config.js a otro
// Supabase), alFalso() (lo de `${SUPA}` al Supabase falso local de la prueba),
// realtimeMudo() (el WebSocket de realtime, aceptado y callado). Un serve_dev
// lanzado con SUPABASE_URL=<falso> y SUPABASE_URL_NAVEGADOR=SUPA lee del falso
// y le dice al navegador `${SUPA}`, como config.js.
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/<algo>_check.mjs
//
//   import { REF, SUPA, playwright, servidorSeguro } from './_supabase_simulado.mjs';
//   const { chromium, webkit } = playwright();
//   await servidorSeguro(BASE);
//   await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
import { appendFileSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONFIG = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const m = CONFIG.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
if (!m) throw new Error('_supabase_simulado: config.js no dice a qué Supabase apunta la web');

/** Los dos proyectos de Klendar (solo aquí: el pre-push no los deja en otro fichero de tools/). */
export const PROYECTOS = { dev: 'dpbbtgwxrlqlplbrtjuq', prod: 'hcxurneiftwyxuebpndf' };
/** El proyecto al que apunta la web (config.js). */
export const REF = m[1];
export const SUPA = `https://${REF}.supabase.co`;
export const KEY = (CONFIG.match(/key:\s*'([^']+)'/) || [])[1] || '';
/** El otro proyecto (para probar que la sesión de otro no cuenta). */
export const OTRO_REF = REF === PROYECTOS.dev ? PROYECTOS.prod : PROYECTOS.dev;
/** La clave de la sesión de supabase-js: `sb-<ref>-auth-token` (o `sb-<ref>-admin-auth-token`). */
export const claveSesion = (tipo = '', ref = REF) => `sb-${ref}-${tipo ? `${tipo}-` : ''}auth-token`;

// En la prueba, con `--en-vivo`; en sus serve_dev, heredado (SUPABASE_EN_VIVO).
export const EN_VIVO = process.argv.includes('--en-vivo')
  || (Boolean(process.env.SUPABASE_BLOQUEADO) && process.env.SUPABASE_EN_VIVO === '1');
const ES_SUPABASE = /^(https?|wss?):\/\/[^/]*\.supabase\.co(:\d+)?(\/|$)/i;

/** ¿Una lectura pública que `--en-vivo` deja pasar? Solo GET/HEAD y sin sesión. */
function lecturaPublica(metodo, url, cabeceras = {}) {
  if (!EN_VIVO || !['GET', 'HEAD'].includes(String(metodo).toUpperCase())) return false;
  // Con un token de usuario ya no es «público» (la clave publicable no es un JWT).
  const auth = String(cabeceras.authorization || cabeceras.Authorization || '');
  const jwt = auth.match(/^bearer\s+([\w-]+\.([\w-]+)\.[\w-]*)$/i);
  if (jwt) {
    try {
      if (JSON.parse(Buffer.from(jwt[2], 'base64url').toString()).role !== 'anon') return false;
    } catch { return false; }
  }
  const { pathname } = new URL(url);
  return pathname.startsWith('/rest/v1/') || pathname.startsWith('/storage/v1/object/public/')
    || pathname.startsWith('/storage/v1/render/image/public/') || pathname === '/auth/v1/settings';
}

// Lo bloqueado, en memoria y en un fichero que comparten los serve_dev hijos.
const DONDE = process.env.SUPABASE_BLOQUEADO && process.env.SUPABASE_BLOQUEADO !== '1'
  ? process.env.SUPABASE_BLOQUEADO : null;
const PADRE = !process.env.SUPABASE_BLOQUEADO;
const LOG = DONDE || join(tmpdir(), `klendar-supabase-bloqueado-${process.pid}.log`);
const bloqueadas = [];
function bloquea(quien, metodo, url) {
  const linea = `${quien}: ${metodo} ${url}`;
  bloqueadas.push(linea);
  console.log(`FALLO: petición a Supabase sin simular, cortada antes de salir (${linea})`);
  try { appendFileSync(LOG, `${linea}\n`); } catch { /* sin fichero: queda en memoria */ }
}

/** Lo que contesta la base vacía a las Functions de un serve_dev de pruebas (y lo apunta como aviso). */
function baseVacia(quien, metodo, url) {
  try { appendFileSync(LOG, `vacía ${quien}: ${metodo} ${url}\n`); } catch { /* sin fichero */ }
  const { pathname } = new URL(url);
  const lista = pathname.startsWith('/rest/v1/');
  return new Response(metodo === 'HEAD' ? null : (lista ? '[]' : '{}'), {
    status: 200, headers: { 'content-type': 'application/json', 'content-range': '*/0' },
  });
}

/** Corta en `fetch` de Node lo que vaya a `*.supabase.co` (salvo lo de `--en-vivo`). */
export function protegeFetch(quien = 'node') {
  const real = globalThis.fetch;
  if (!real || real.__klendarProtegido) return;
  const protegido = (entrada, init = {}) => {
    const req = entrada instanceof Request ? entrada : null;
    const url = String(req ? req.url : entrada);
    const metodo = init.method || req?.method || 'GET';
    if (ES_SUPABASE.test(url)) {
      const cab = Object.fromEntries(new Headers(init.headers || req?.headers || {}));
      if (!lecturaPublica(metodo, url, cab)) {
        if (!PADRE) return Promise.resolve(baseVacia(quien, metodo, url));
        bloquea(quien, metodo, url);
        return Promise.reject(new TypeError(`Supabase bloqueado en las pruebas: ${metodo} ${url}`));
      }
    }
    return real(entrada, init);
  };
  protegido.__klendarProtegido = true;
  globalThis.fetch = protegido;
}

/** La red de seguridad de un contexto de Playwright (va la primera: lo que la prueba enrute después manda). */
export async function protegeContexto(ctx) {
  if (ctx.__klendarProtegido) return ctx;
  ctx.__klendarProtegido = true;
  await ctx.route(ES_SUPABASE, async (route) => {
    const r = route.request();
    if (lecturaPublica(r.method(), r.url(), await r.allHeaders().catch(() => ({})))) return route.continue();
    // Las páginas de la Ayuda preguntan al cargar si sale el asistente (assets/asistente.js): solo lo simula quien lo prueba,
    // y para las demás está apagado. No sale nada.
    if (new URL(r.url()).pathname === '/rest/v1/rpc/assistant_status') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"available":false}' });
    }
    bloquea('navegador', r.method(), r.url());
    return route.abort('blockedbyclient');
  });
  if (ctx.routeWebSocket) {
    await ctx.routeWebSocket(ES_SUPABASE, (ws) => { bloquea('navegador', 'WebSocket', ws.url()); ws.close(); });
  }
  // config.js de producción lleva la clave de Turnstile de klendar.app, que en
  // localhost no vale (y su iframe llena la consola de errores): en las
  // pruebas, sin Turnstile, como dev. Las que prueban Turnstile enrutan
  // config.js ellas mismas (después, y por eso mandan).
  await ctx.route(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/config\.js(\?|$)/, async (route) => {
    try {
      const r = await route.fetch();
      route.fulfill({ response: r, body: (await r.text()).replace(/turnstile:\s*'[^']*'/, "turnstile: ''") });
    } catch { route.continue().catch(() => {}); }
  });
  return ctx;
}

function protegeNavegador(nav) {
  if (nav.__klendarProtegido) return nav;
  nav.__klendarProtegido = true;
  const nuevo = nav.newContext.bind(nav);
  // browser.newPage() también pasa por aquí (llama a this.newContext).
  nav.newContext = async (...a) => protegeContexto(await nuevo(...a));
  return nav;
}

/**
 * config.js de una web local apuntando a otro Supabase (el falso de las
 * Functions de un serve_dev con SUPABASE_URL=http://localhost:…): así el
 * navegador y las Functions hablan con el mismo, como en producción, y la
 * cabecera no toma la sesión por la de otro proyecto.
 */
export async function configA(ctx, base, url, extra = {}) {
  const env = { name: 'prueba', url, key: 'falsa', turnstile: '', ...extra };
  await ctx.route(`${base}/config.js*`, (route) => route.fulfill({
    contentType: 'text/javascript', body: `window.KLENDAR_ENV = ${JSON.stringify(env)};`,
  }));
}

/**
 * `${SUPA}` simulado como una base pública vacía, para las páginas que solo
 * leen de pasada (las formas de entrar, las ciudades, el ocio de ahora…):
 * Google y correo para entrar, sin sesión, listas vacías. Va antes que lo
 * que la prueba enrute después (que manda). Sin red.
 */
export async function supabaseVacio(ctx) {
  await ctx.route(`${SUPA}/**`, (route) => {
    const r = route.request();
    const p = new URL(r.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: JSON.stringify(body) });
    if (p === '/auth/v1/settings') return json({ external: { email: true, google: true }, disable_signup: false });
    if (p.startsWith('/auth/v1/user')) return json({ code: 401, msg: 'sin sesión' }, 401);
    if (p.startsWith('/auth/v1/')) return json({});
    if (r.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' });
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
}

/**
 * Lo que el navegador pida a `${SUPA}` lo contesta el Supabase falso local de
 * la prueba (`http://localhost:…`, el mismo que usan sus Functions).
 */
export async function alFalso(ctx, falso) {
  await ctx.route(`${SUPA}/**`, async (route) => {
    const url = route.request().url().replace(SUPA, falso);
    route.fulfill({ response: await route.fetch({ url }) }).catch(() => {});
  });
}

/**
 * Realtime de mentira (el WebSocket de `${SUPA}/realtime/v1/…`): se acepta y
 * no se contesta nada, ni se conecta a ningún sitio. Para las pantallas que se
 * suscriben (pedidos, la cola…) cuando la prueba no mira el tiempo real.
 */
export async function realtimeMudo(ctx) {
  await ctx.routeWebSocket(new RegExp(`^wss://${REF}\\.supabase\\.co/realtime/`), () => { /* mudo */ });
}

/** Dónde apunta lo cortado este proceso (serve_dev lo enseña en /__supabase_bloqueado). */
export const REGISTRO = LOG;

// Lo que corten los serve_dev de fuera (los de BASE), desde que empezó la prueba.
const deFuera = [];
/**
 * La web contra la que va la prueba no puede llegar a Supabase:
 *  - local (localhost): su serve_dev tiene que cortar (SUPABASE_BLOQUEADO=1);
 *    lo que corte durante la prueba cuenta como petición sin simular;
 *  - publicada (https://klendar.app…): solo con `--en-vivo`.
 * Si no, la prueba no empieza.
 */
export async function servidorSeguro(...bases) {
  for (const base of bases.filter(Boolean)) {
    const { hostname } = new URL(base);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
      if (EN_VIVO) continue;
      console.log(`FALLO: ${base} es una web publicada (llama a Supabase de verdad): solo con --en-vivo.`);
      process.exit(1);
    }
    let info = null;
    try { info = await (await globalThis.fetch(`${base}/__supabase_bloqueado`)).json(); } catch { /* no es nuestro serve_dev o es uno viejo */ }
    if (!info?.bloqueado) {
      console.log(`FALLO: el serve_dev de ${base} no corta Supabase (sus Functions llamarían a ${SUPA}).\n`
        + '  Arráncalo así: SUPABASE_BLOQUEADO=1 PORT=… node tools/serve_dev.mjs');
      process.exit(1);
    }
    if (info.registro && info.registro !== LOG) {
      let desde = 0;
      try { desde = readFileSync(info.registro, 'utf8').length; } catch { /* aún vacío */ }
      deFuera.push({ registro: info.registro, desde });
    }
  }
}

let pw = null;
/** Playwright (PW=ruta o el instalado) con todos los contextos protegidos. */
export function playwright() {
  if (pw) return pw;
  pw = createRequire(import.meta.url)(process.env.PW || 'playwright');
  for (const tipo of [pw.chromium, pw.webkit, pw.firefox].filter(Boolean)) {
    const lanza = tipo.launch.bind(tipo);
    tipo.launch = async (...a) => protegeNavegador(await lanza(...a));
    const persistente = tipo.launchPersistentContext.bind(tipo);
    tipo.launchPersistentContext = async (...a) => protegeContexto(await persistente(...a));
  }
  return pw;
}

// Al importarlo: fetch protegido, y los serve_dev que lance la prueba
// (heredan process.env) también, apuntando lo que corten a este fichero.
protegeFetch(PADRE ? 'prueba' : 'serve_dev');
if (PADRE) {
  process.env.SUPABASE_BLOQUEADO = LOG;
  if (EN_VIVO) process.env.SUPABASE_EN_VIVO = '1';
  else delete process.env.SUPABASE_EN_VIVO;
  // Al salir (también con process.exit(0)): si se cortó algo, la prueba falla.
  process.on('exit', () => {
    let hijos = [];
    try { hijos = readFileSync(LOG, 'utf8').split('\n').filter(Boolean); rmSync(LOG, { force: true }); } catch { /* nada */ }
    for (const { registro, desde } of deFuera) {
      try { hijos.push(...readFileSync(registro, 'utf8').slice(desde).split('\n').filter(Boolean)); } catch { /* nada */ }
    }
    const vacias = hijos.filter((l) => l.startsWith('vacía '));
    if (vacias.length) {
      const n = new Set(vacias.map((l) => l.replace(/\?.*$/, '')));
      console.log(`\nAVISO: ${vacias.length} petición(es) de las Functions a Supabase contestadas por la base vacía (no han salido):`);
      for (const l of [...n].slice(0, 12)) console.log(`  ${l.slice(6)}`);
    }
    const todas = [...new Set([...bloqueadas, ...hijos.filter((l) => !l.startsWith('vacía '))])];
    if (!todas.length) return;
    console.log(`\nFALLO: ${todas.length} petición(es) a Supabase sin simular (cortadas, no han salido):`);
    for (const l of todas.slice(0, 40)) console.log(`  ${l}`);
    if (todas.length > 40) console.log(`  … y ${todas.length - 40} más`);
    process.exitCode = 1;
  });
}
