// Revisión general, parte 4 (seguridad y rendimiento), 20-11-2026. Sin red ni navegador.
//
//   node tools/revseg_check.mjs
//
// - jsonEnScript: un valor dentro de un <script> en línea no puede cerrarlo
//   (un negocio llamado «x</script><script>…» en la pantalla de la cola).
// - Ningún `${JSON.stringify(` suelto dentro de las Functions que pintan HTML.
// - KFotos.mini: la miniatura de una foto de Storage; lo demás, igual.
// - enOrden (admin): nunca dos cargas a la vez; la última pintada es la de lo
//   último pedido.
// - La clave de push del admin no se escribe en el HTML.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fallos = 0;
const ok = (nombre, cond, detalle = '') => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}${!cond && detalle ? ` — ${detalle}` : ''}`);
  if (!cond) fallos += 1;
};

// 1. jsonEnScript
const { jsonEnScript } = await import(new URL('../functions/_lib/page.js', import.meta.url));
const LS = String.fromCharCode(0x2028); const PS = String.fromCharCode(0x2029);
const malo = { name: 'x</script><script>alert(1)</script>', s: `a${LS}b${PS}c` };
const out = jsonEnScript(malo);
ok('jsonEnScript no deja «</script>»', !/<\/script/i.test(out), out);
ok('jsonEnScript escapa U+2028 y U+2029', !out.includes(LS) && !out.includes(PS), out);
ok('jsonEnScript se lee igual', JSON.stringify(JSON.parse(out)) === JSON.stringify(malo));
ok('jsonEnScript(undefined) es null (no rompe el script)', jsonEnScript(undefined) === 'null');

// 2. Ningún JSON.stringify suelto dentro de HTML en las Functions.
const lib = path.join(RAIZ, 'functions', '_lib');
const sueltos = [];
for (const f of readdirSync(lib).filter((x) => x.endsWith('.js'))) {
  readFileSync(path.join(lib, f), 'utf8').split('\n').forEach((l, i) => {
    if (l.includes('${JSON.stringify(')) sueltos.push(`${f}:${i + 1}`);
  });
}
ok('las Functions usan jsonEnScript en sus <script>', sueltos.length === 0, sueltos.join(', '));
// `.replace(/</g, '<barra>u003c')` con una sola barra no cambia nada (el '<'
// se cambia por '<'): así estaba el mapa de Explorar.
const B = String.fromCharCode(92);
const nulo = [];
for (const f of readdirSync(lib).filter((x) => x.endsWith('.js'))) {
  readFileSync(path.join(lib, f), 'utf8').split(String.fromCharCode(10)).forEach((l, i) => {
    const j = l.indexOf(`${B}u003c'`);
    if (j > 0 && l[j - 1] !== B) nulo.push(`${f}:${i + 1}`);
  });
}
ok("ningún replace de '<' que no escapa nada", nulo.length === 0, nulo.join(', '));

// 3. KFotos.mini (assets/fotos.js) en un contexto sin navegador.
const ctx = { window: {}, document: { addEventListener() {} }, HTMLImageElement: function HTMLImageElement() {} };
vm.runInNewContext(readFileSync(path.join(RAIZ, 'assets', 'fotos.js'), 'utf8'), ctx);
const mini = ctx.window.KFotos.mini;
const foto = 'https://x.supabase.co/storage/v1/object/public/business-images/b/o/1.jpg';
ok('mini: miniatura de una foto de Storage', mini(`${foto}?v=2`) === foto.replace('1.jpg', '1-thumb.jpg'));
ok('mini: un vídeo, igual', mini(foto.replace('.jpg', '.mp4')) === foto.replace('.jpg', '.mp4'));
ok('mini: otra web, igual', mini('https://example.com/a.jpg') === 'https://example.com/a.jpg');
ok('mini: una miniatura, igual', mini(foto.replace('.jpg', '-thumb.jpg')) === foto.replace('.jpg', '-thumb.jpg'));

// 4. enOrden del admin.
const admin = readFileSync(path.join(RAIZ, 'admin', 'admin.js'), 'utf8');
const def = admin.match(/const enOrden = \(fn\) => \{[\s\S]*?\n\};\n/);
ok('admin.js define enOrden', !!def);
if (def) {
  const enOrden = vm.runInNewContext(`${def[0]}; enOrden`);
  // Tres peticiones seguidas («Siguiente» dos veces y una letra): la primera
  // tarda más que las demás. Antes pintaba la última la primera (vieja).
  let pedido = 0;
  let enMarcha = 0;
  let maxALaVez = 0;
  const pintado = [];
  const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });
  const load = enOrden(async () => {
    const quiero = pedido;
    enMarcha += 1; maxALaVez = Math.max(maxALaVez, enMarcha);
    await espera(quiero === 1 ? 60 : 10);
    enMarcha -= 1;
    pintado.push(quiero);
  });
  pedido = 1; const p1 = load();
  pedido = 2; load();
  pedido = 3; const p3 = load();
  await Promise.all([p1, p3]);
  ok('enOrden: nunca dos a la vez', maxALaVez === 1, String(maxALaVez));
  ok('enOrden: lo último pintado es lo último pedido', pintado.at(-1) === 3, pintado.join(','));
  ok('enOrden: las intermedias se juntan en una', pintado.length === 2, pintado.join(','));
}

// 5. La clave de push no se escribe en el HTML del admin.
ok('el admin no pinta la clave de push', !/value="\$\{esc\(sp\.key/.test(admin));
ok('Configuración usa key_set', /sp\.key_set/.test(admin));

// 6. CSP de scripts (§4zzz-segF, solo informe; desde el 23-11 obligatoria, §4zzz-csp): la misma en `_headers`
//    (/*) y en el middleware (functions/_lib/csp.js), con lo que de verdad carga la web (Turnstile, Mapbox, el
//    contador de Cloudflare). Lo demás de la CSP (nonce, páginas, navegadores): tools/csp_check.mjs.
{
  const cab = readFileSync(path.join(RAIZ, '_headers'), 'utf8');
  const mw = readFileSync(path.join(RAIZ, 'functions/_middleware.js'), 'utf8');
  const { CSP_PUBLICA } = await import(new URL('../functions/_lib/csp.js', import.meta.url));
  const enCab = /^\/\*\r?\n(?: {2}.*\r?\n)*? {2}Content-Security-Policy: (.+)$/m.exec(cab)?.[1]?.trim();
  ok('CSP obligatoria en /* de _headers', !!enCab);
  ok('la misma en el middleware', enCab === CSP_PUBLICA && /'content-security-policy': CSP_PUBLICA/.test(mw), `${enCab} / ${CSP_PUBLICA}`);
  for (const d of ["script-src 'self'", 'https://challenges.cloudflare.com', 'https://api.mapbox.com', 'https://static.cloudflareinsights.com']) {
    ok(`CSP con ${d}`, (enCab || '').includes(d));
  }
  ok("sin 'unsafe-inline' ni 'unsafe-eval' en la de /*", !/unsafe-(inline|eval)/.test(enCab || ''));
  ok('ya sin la de solo informe', !/^ {2}Content-Security-Policy-Report-Only:/m.test(cab));
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
