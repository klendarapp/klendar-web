// Prueba de la CSP de scripts (RUNBOOK §4zzz-csp, 23-11): que la web no lleve
// <script> en línea con código ni `onclick=` y que, con la CSP obligatoria, las
// páginas principales no tengan ni una violación. Con un Supabase de mentira
// (_web_con_datos): no toca dev ni prod.
//
//  1. Cabeceras: la CSP de `/*` en `_headers` es `CSP_PUBLICA`
//     (functions/_lib/csp.js), la que pone el middleware; sin `'unsafe-inline'`
//     ni `'unsafe-eval'` en ningún `script-src`; sin `Report-Only`; el widget
//     con la suya (`CSP_WIDGET`) en la Function y en `_headers`.
//  2. El middleware: nonce nuevo en cada página pública (también en las
//     estáticas y el widget), nunca en las zonas con sesión ni en lo que no es
//     HTML; la de solo informe, fuera.
//  3. Las páginas del repo (.html) y lo que pintan las Functions (HTML tal cual
//     sale del servidor): ningún <script> sin `src` salvo JSON
//     (`application/json`, `application/ld+json`, que tiene que ser JSON de
//     verdad), ningún `on…=` y ningún `href="javascript:`.
//  4. El código: ningún `on…="` en las plantillas de los JS (functions/,
//     assets/, panel/, admin/), ni `eval(` / `new Function(` fuera de vendor/.
//  5. En Chromium y WebKit, en el móvil (390) y en el escritorio (1280): cada
//     página principal sin violaciones de CSP (`securitypolicyviolation` y
//     la consola) y sin <script> en línea en el DOM ya cargado.
//
//   PW=<ruta a playwright> node tools/csp_check.mjs        (todo)
//   node tools/csp_check.mjs --sin-navegador                (1–4, unos 3 s)
//   CSP_SOLO=/explorar,/o/… node tools/csp_check.mjs        (solo esas)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP_ADMIN, CSP_PANEL, CSP_PUBLICA, CSP_WIDGET, conNonce } from '../functions/_lib/csp.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lee = (f) => readFileSync(path.join(RAIZ, f), 'utf8');
let fallos = 0;
const ok = (m, c, det = '') => { if (!c) { fallos += 1; console.log(`FALLO: ${m}${det ? `\n    ${String(det).slice(0, 600)}` : ''}`); } else if (!process.env.CSP_CALLADO) console.log(`ok: ${m}`); };
const SIN_NAVEGADOR = process.argv.includes('--sin-navegador');

// ── Lo que se busca en un HTML ─────────────────────────────────────────────
/** Los <script> en línea con código, los manejadores `on…=` y los `javascript:`. */
export function enLinea(html) {
  const malos = [];
  const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of sinComentarios.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const [, attrs, cuerpo] = m;
    if (/\bsrc\s*=/i.test(attrs)) {
      if (cuerpo.trim()) malos.push(`<script src> con código dentro: ${cuerpo.trim().slice(0, 80)}`);
      continue;
    }
    const tipo = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1] || '').toLowerCase();
    if (tipo === 'application/json' || tipo === 'application/ld+json') {
      try { JSON.parse(cuerpo); } catch { malos.push(`<script type="${tipo}"> que no es JSON: ${cuerpo.trim().slice(0, 80)}`); }
      continue;
    }
    if (cuerpo.trim()) malos.push(`<script${attrs}> en línea: ${cuerpo.trim().replace(/\s+/g, ' ').slice(0, 100)}`);
  }
  // Dentro de una etiqueta (no en el texto): ` onclick="…"`, ` onload=…`.
  const sinScripts = sinComentarios.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  for (const m of sinScripts.matchAll(/<[a-zA-Z][\w-]*(?:\s+[^<>]*?)?\s(on[a-z]+)\s*=/g)) malos.push(`manejador en línea ${m[1]}=: ${m[0].slice(0, 100)}`);
  for (const m of sinScripts.matchAll(/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/gi)) malos.push(`enlace javascript: ${m[0].slice(0, 80)}`);
  return malos;
}

// ── 1. Cabeceras ───────────────────────────────────────────────────────────
const cab = lee('_headers');
const mw = lee('functions/_middleware.js');
const general = /^\/\*\r?\n((?: {2}.*\r?\n)+)/m.exec(cab)?.[1] || '';
const enCab = /^ {2}Content-Security-Policy: (.+)$/m.exec(general)?.[1]?.trim();
ok('la CSP de /* en _headers es CSP_PUBLICA', enCab === CSP_PUBLICA, `${enCab}\n    ${CSP_PUBLICA}`);
ok('el middleware pone CSP_PUBLICA', /'content-security-policy': CSP_PUBLICA/.test(mw));
ok('sin Content-Security-Policy-Report-Only en _headers', !/Report-Only/i.test(cab.replace(/^#.*$/gm, '')));
ok('sin report-only en el middleware (salvo para quitarla)', !/'content-security-policy-report-only':/.test(mw));
for (const d of ["script-src 'self'", 'https://challenges.cloudflare.com', 'https://api.mapbox.com', 'https://static.cloudflareinsights.com', "worker-src 'self' blob:", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'"]) {
  ok(`CSP_PUBLICA con ${d}`, CSP_PUBLICA.includes(d));
}
const todas = [...cab.matchAll(/^ {2}Content-Security-Policy: (.+)$/gm)].map((m) => m[1]).concat([CSP_PUBLICA, CSP_WIDGET, CSP_ADMIN]);
for (const c of todas) {
  const s = /(?:^|;)\s*script-src\s([^;]*)/.exec(c)?.[1] || '';
  ok(`sin 'unsafe-inline' ni 'unsafe-eval' en script-src (${c.slice(0, 50)}…)`, !/unsafe-inline|unsafe-eval|\*(?!\.)/.test(s) || !s, s);
  ok(`con script-src (${c.slice(0, 50)}…)`, !!s);
}
const widget = lee('functions/widget/[id].js');
ok('el widget usa CSP_WIDGET', /'content-security-policy': CSP_WIDGET/.test(widget));
ok('…y la misma en /widget/* de _headers', new RegExp(`^/widget/\\*\\r?\\n(?: {2}.*\\r?\\n)*? {2}Content-Security-Policy: ${CSP_WIDGET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?$`, 'm').test(cab));

// ── 2. El middleware ───────────────────────────────────────────────────────
{
  const { onRequest } = await import('../functions/_middleware.js');
  const pide = async (ruta, { csp, tipo = 'text/html; charset=utf-8', metodo = 'GET', host = 'klendar.app' } = {}) => {
    const h = { 'content-type': tipo };
    if (csp) h['content-security-policy'] = csp;
    const ctx = {
      request: new Request(`https://${host}${ruta}`, { method: metodo }),
      env: { ASSETS: { fetch: async () => new Response('<!doctype html><p>hola', { status: 200, headers: h }) } },
      next: async () => new Response(metodo === 'HEAD' ? null : '<!doctype html><p>hola', { status: 200, headers: h }),
    };
    return onRequest(ctx);
  };
  const nonce = (r) => /'nonce-([A-Za-z0-9+/=]+)'/.exec(r.headers.get('content-security-policy') || '')?.[1];
  const a = await pide('/para-negocios', { csp: CSP_PUBLICA });
  const b = await pide('/para-negocios', { csp: CSP_PUBLICA });
  ok('middleware: página estática con nonce', !!nonce(a), a.headers.get('content-security-policy'));
  ok('middleware: un nonce distinto en cada respuesta', nonce(a) && nonce(a) !== nonce(b));
  ok('middleware: el nonce, de 16 bytes', nonce(a) && Buffer.from(nonce(a), 'base64').length === 16);
  ok('middleware: la CSP es CSP_PUBLICA + nonce', a.headers.get('content-security-policy') === conNonce(CSP_PUBLICA, nonce(a)));
  ok('middleware: sin report-only', !a.headers.has('content-security-policy-report-only'));
  const f = await pide('/o/0ff00000-0000-4000-8000-000000000001');
  ok('middleware: página de una Function sin CSP → CSP_PUBLICA + nonce', f.headers.get('content-security-policy') === conNonce(CSP_PUBLICA, nonce(f)) && !!nonce(f), f.headers.get('content-security-policy'));
  const w = await pide('/widget/abc', { csp: CSP_WIDGET });
  ok('middleware: el widget, su CSP + nonce', w.headers.get('content-security-policy') === conNonce(CSP_WIDGET, nonce(w)) && !!nonce(w));
  // El panel (§4zzz-panellimpio): sus pantallas, con CSP_PANEL (la de `/panel` en `_headers`) y sin nonce.
  for (const z of ['/panel', '/panel/hoy', '/panel/sellos/abc/editar']) {
    const r = await pide(z, { csp: CSP_PUBLICA });
    ok(`middleware: ${z} con CSP_PANEL y sin nonce (zona con sesión, no-transform)`, !nonce(r) && r.headers.get('content-security-policy') === CSP_PANEL, r.headers.get('content-security-policy'));
  }
  for (const z of ['/cuenta/codigos', '/tv']) {
    const r = await pide(z, { csp: "default-src 'self'; script-src 'self'" });
    ok(`middleware: ${z} sin nonce (zona con sesión, no-transform)`, !nonce(r) && r.headers.get('content-security-policy') === "default-src 'self'; script-src 'self'");
  }
  // El admin, en la raíz de su host (§4zzz-admindom): su CSP, sin nonce.
  const ad = await pide('/', { csp: CSP_PUBLICA, host: 'admin.klendar.app' });
  ok('middleware: el admin (admin.klendar.app/) con CSP_ADMIN y sin nonce', !nonce(ad) && ad.headers.get('content-security-policy') === CSP_ADMIN, ad.headers.get('content-security-policy'));
  const js = await pide('/assets/x.js', { csp: CSP_PUBLICA, tipo: 'text/javascript' });
  ok('middleware: lo que no es HTML, sin nonce', !nonce(js));
  const hd = await pide('/para-negocios', { csp: CSP_PUBLICA, metodo: 'HEAD' });
  ok('middleware: HEAD, sin nonce y sin cuerpo', !nonce(hd) && hd.body === null);
  const vieja = await pide('/para-negocios', { csp: CSP_PUBLICA });
  ok('middleware: X-Frame-Options sigue', vieja.headers.get('x-frame-options') === 'DENY');
}

// ── 3. El HTML del repo ────────────────────────────────────────────────────
const FUERA = new Set(['node_modules', 'tools', '.git', '.claude', '.githooks']);
function ficheros(dir, ext, out = []) {
  for (const n of readdirSync(dir)) {
    if (FUERA.has(n)) continue;
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) ficheros(p, ext, out);
    else if (ext.test(n)) out.push(p);
  }
  return out;
}
let paginas = 0;
for (const f of ficheros(RAIZ, /\.html$/)) {
  paginas += 1;
  const malos = enLinea(readFileSync(f, 'utf8'));
  ok(`${path.relative(RAIZ, f)} sin código en línea`, !malos.length, malos.join('\n    '));
}
ok(`páginas del repo miradas (${paginas})`, paginas >= 45);

// ── 4. El código ───────────────────────────────────────────────────────────
for (const f of ficheros(RAIZ, /\.(m?js)$/).filter((f) => !/[\\/]vendor[\\/]/.test(f) && !/[\\/]i18n[\\/]/.test(f))) {
  const t = readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
  const rel = path.relative(RAIZ, f).replace(/\\/g, '/');
  const manejador = /<[a-zA-Z][^<>`]*\son(?:click|load|error|change|input|submit|key\w+|mouse\w+|focus|blur|toggle|beforeprint|afterprint)\s*=\s*\\?["'`]/.exec(t);
  ok(`${rel}: sin on…= en sus plantillas`, !manejador, manejador?.[0]);
  ok(`${rel}: sin setAttribute('on…')`, !/setAttribute\(\s*['"]on[a-z]+['"]/.test(t));
  ok(`${rel}: sin eval ni new Function`, !/(^|[^.\w])eval\s*\(|new\s+Function\s*\(/.test(t));
}

// ── 5. Lo que pintan las Functions y los navegadores ──────────────────────
if (SIN_NAVEGADOR) {
  console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien (sin navegador)');
  process.exit(fallos ? 1 : 0);
}
const { webConDatos, NEGOCIOS, PLANES } = await import('./_web_con_datos.mjs');
const { enSuHost, fetchLocal, playwright } = await import('./_supabase_simulado.mjs');
const flash = PLANES.find((p) => p.kind === 'flash_offer');
const evento = PLANES.find((p) => p.kind === 'future_event' && !p.adults_only && !p.imported);
const adultos = PLANES.find((p) => p.adults_only);
const NEG = NEGOCIOS[0];
const COLA = 'CoLa0123456789ab';
const TOKEN = 'AbCdEfGhIjKlMnOp';
const infoNegocio = { id: NEG.id, name: NEG.name, slug: NEG.slug, city: NEG.city, address: NEG.address, logo_url: null, time_zone: 'Europe/Madrid' };
const RPC = {
  queue_info: { ok: true, business: infoNegocio, queue: { status: 'open', called: [3], next: [4, 5], waiting: 2, wait_minutes: 6, call_minutes: 5 } },
  queue_screen: { ok: true, business: infoNegocio, queue: { status: 'open', called: [3, 2], next: [4, 5], wait_minutes: 6 } },
  orders_info: { ok: true, business: infoNegocio, state: 'available', team: false, me: null },
  table_qr_info: { ok: true, visible: true, has_wifi: true, business: infoNegocio, wifi: { ssid: 'Bar-Clientes', password: 'cafe1234' } },
  visit_qr_info: { ok: true, business: infoNegocio, business_id: NEG.id, slug: NEG.slug },
};
const RUTAS = [
  '/', '/en', '/para-negocios', '/en/for-business', '/precios', '/privacidad', '/terminos', '/cookies', '/novedades', '/estado', '/soporte',
  '/para-entidades', '/preguntas', '/404-no-existe', '/en/no-existe', `/captcha?k=1x00000000000000000000AA&hl=es&pre=1`, '/alta',
  '/explorar', '/explorar?vista=mapa', '/explorar?vista=calendario', '/explorar?que=sitios', '/explorar?celda=eysbg', '/descubre', '/en/explore', '/en/discover',
  `/o/${flash.id}`, `/o/${evento.id}`, `/en/o/${flash.id}`, `/o/${adultos.id}`, `/b/${NEG.slug}`, `/en/b/${NEG.slug}`,
  '/agenda/madrid', '/hoy/madrid', '/con-ninos/madrid', '/partidos', '/grupos', '/sorteos',
  `/cartel/${flash.id}`, `/cartel/${evento.id}?tam=a3`, '/cartel/pegatina', `/cartel/pegatina/${NEG.id}`, `/cartel/local/${TOKEN}`, `/cartel/mesa/${TOKEN}?mesas=4`,
  `/cartel/cola/${COLA}`, `/cartel/listo/${COLA}`, `/cola/${COLA}`, `/cola/${COLA}?pantalla=1`, `/listo/${COLA}`, `/m/${TOKEN}`,
  `/historia/o/${flash.id}`, `/widget/${NEG.id}`, '/amigo/abcdef',
  '/cuenta', '/cuenta/entrar', '/panel', '/admin', '/tv',
];
const solo = (process.env.CSP_SOLO || '').split(',').filter(Boolean);
const rutas = solo.length ? RUTAS.filter((r) => solo.some((s) => r.startsWith(s))) : RUTAS;

const web = await webConDatos({ puerto: Number(process.env.PORT || 9361), rpc: RPC });
try {
  // 5a. El HTML tal cual sale del servidor.
  for (const r of rutas) {
    const res = await fetchLocal(enSuHost(web.BASE, r), { redirect: 'manual' });
    const html = await res.text();
    const tipo = res.headers.get('content-type') || '';
    if (!/text\/html/.test(tipo)) { ok(`${r}: es HTML`, false, `${res.status} ${tipo}`); continue; }
    const csp = res.headers.get('content-security-policy') || '';
    ok(`${r}: con CSP de scripts (${res.status})`, /script-src/.test(csp), csp || '(sin CSP)');
    const malos = enLinea(html);
    ok(`${r}: sin código en línea`, !malos.length, malos.join('\n    '));
  }

  // 5b. En los navegadores.
  const pw = playwright();
  const navegadores = [['Chromium', pw.chromium], ['WebKit', pw.webkit]];
  const VENTANAS = [['móvil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]];
  for (const [nombre, tipo] of navegadores) {
    let nav;
    try { nav = await tipo.launch(); } catch (e) { ok(`${nombre}: se abre`, false, e.message); continue; }
    try {
      for (const [vn, ventana] of VENTANAS) {
        const ctx = await nav.newContext({ viewport: ventana, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
        await ctx.addInitScript(() => {
          window.__csp = [];
          document.addEventListener('securitypolicyviolation', (e) => {
            window.__csp.push(`${e.effectiveDirective || e.violatedDirective} ${e.blockedURI || '(en línea)'} ${e.sourceFile || ''}:${e.lineNumber || ''} ${(e.sample || '').slice(0, 60)}`);
          });
        });
        let consola = [];
        const pagina = async () => {
          const q = await ctx.newPage();
          q.on('console', (m) => {
            const t = m.text();
            if (/Content[- ]Security[- ]Policy|Refused to (execute|load|apply|create)|\[Report Only\]/i.test(t)) consola.push(`${m.type()}: ${t.slice(0, 220)}`);
          });
          return q;
        };
        let p = await pagina();
        for (const r of rutas) {
          consola = [];
          if (process.env.CSP_TRAZA) console.log(`· ${nombre} ${vn} ${r}`);
          try {
            await p.goto(enSuHost(web.BASE, r), { waitUntil: 'load', timeout: 30000 }).catch(() => {});
            await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
            await p.waitForTimeout(250);
          } catch (e) {
            // Una página que tumba el navegador (WebKit, a veces) no es de la CSP: se dice y se sigue con otra.
            console.log(`AVISO: ${nombre} · ${vn} · ${r}: ${String(e.message).split(/\r?\n/)[0]}`);
            await p.close().catch(() => {});
            p = await pagina();
            continue;
          }
          const datos = await p.evaluate(() => ({
            csp: window.__csp || [],
            enLinea: [...document.querySelectorAll('script:not([src])')]
              .filter((s) => !/^application\/(ld\+)?json$/i.test(s.type || '') && s.textContent.trim())
              .map((s) => s.textContent.trim().slice(0, 80)),
            manejadores: [...document.querySelectorAll('*')].flatMap((el) => [...el.attributes].filter((a) => /^on[a-z]+$/i.test(a.name)).map((a) => `${el.tagName.toLowerCase()} ${a.name}`)).slice(0, 5),
          })).catch((e) => ({ csp: [], enLinea: [], manejadores: [], error: e.message }));
          const donde = `${nombre} · ${vn} · ${r}`;
          ok(`${donde}: sin violaciones de CSP`, !datos.csp.length && !consola.length, [...datos.csp, ...consola].join('\n    '));
          ok(`${donde}: sin <script> en línea en la página cargada`, !datos.enLinea.length && !datos.manejadores.length, [...datos.enLinea, ...datos.manejadores].join('\n    '));
          if (datos.error) ok(`${donde}: se lee la página`, false, datos.error);
        }
        await ctx.close();
      }
    } finally {
      await nav.close();
    }
  }
} finally {
  await web.cierra();
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
