// Cuánto CPU gasta cada Function (RUNBOOK §3f). Cloudflare corta a los 10 ms
// en el plan gratis y la espera a Supabase no cuenta, así que aquí tampoco:
// primero se graban una vez las respuestas de dev (una petición por ruta) y
// después cada ruta se pinta con ellas, sin red, y se mide el tiempo.
//
//   node tools/cpu_mide.mjs graba        → .wrangler/cpu_grabado.json (dev)
//   node tools/cpu_mide.mjs              → tabla: «en frío» (la primera visita
//                                          de una copia nueva de la Function)
//                                          y «normal» (mediana de las demás)
//   node tools/cpu_mide.mjs una /explorar/   → solo esa ruta (en un proceso
//                                          nuevo; con `node --cpu-prof` se ve
//                                          qué función gasta)
//
// Desde Git Bash, `MSYS_NO_PATHCONV=1` para que no toque las rutas. Las cifras
// son de Node, no de Cloudflare: sirven para comparar antes y después.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const GRAB = join(REPO, '.wrangler', 'cpu_grabado.json');
const [, , modo = 'todas', arg] = process.argv;

// Datos de dev (cámbialos si desaparecen): una publicación, un negocio
// normal, la agenda pública de Madrid (la ficha más grande) y un widget.
const OFERTA = process.env.OFERTA || '2cce6c9a-db1c-4281-a302-07786800c709';
const NEGOCIO = process.env.NEGOCIO || 'la-taberna-del-gato-madrid';
const WIDGET = process.env.WIDGET || 'ea67ec1f-3266-482b-9149-d4ced6f23558';
const RUTAS = [
  '/salud',
  '/descubre/', '/en/discover/', '/explorar/', '/explorar/?ciudad=Madrid', '/explorar/?vista=negocios',
  '/agenda/', '/agenda/madrid/', '/agenda/zaragoza/', '/agenda/madrid/stage/', '/hoy/madrid/',
  '/coleccion/con-ninos/madrid/', '/coleccion/finde/', '/coleccion/finde/madrid/',
  `/o/${OFERTA}`, `/en/o/${OFERTA}`, `/b/${NEGOCIO}`, '/b/agenda-publica-de-madrid',
  `/cartel/${OFERTA}`, `/historia/o/${OFERTA}`,
  '/partidos/', '/grupos/', '/sorteos/', `/widget/${WIDGET}`,
  '/sitemap-agenda.xml', '/sitemap-negocios.xml',
];

// Como enruta Cloudflare Pages: por los nombres de los ficheros de functions/.
let rutas = null;
function encuentra(path) {
  if (!rutas) {
    rutas = [];
    const base = join(REPO, 'functions');
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) { if (f !== '_lib') walk(p); continue; }
        if (!f.endsWith('.js') || f === '_middleware.js') continue;
        let segs = relative(base, p).replace(/\\/g, '/').replace(/\.js$/, '').split('/');
        if (segs.at(-1) === 'index') segs = segs.slice(0, -1);
        const names = [];
        const re = segs.map((s) => {
          const m = /^\[(\w+)\]$/.exec(s);
          if (m) { names.push(m[1]); return '([^/]+)'; }
          return s.replace(/[.]/g, '\\.');
        }).join('/');
        rutas.push({ file: p, names, re: new RegExp(`^/${re}/?$`) });
      }
    };
    walk(base);
    rutas.sort((a, b) => a.names.length - b.names.length);
  }
  for (const r of rutas) {
    const m = r.re.exec(path);
    if (m) return { file: r.file, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  throw new Error(`sin Function para ${path}`);
}

const clave = (url, init) => `${init?.method || 'GET'} ${url} ${init?.body || ''}`;
const modulos = new Map();
async function pinta(ruta) {
  const { file, params } = encuentra(ruta.split('?')[0]);
  if (!modulos.has(file)) modulos.set(file, await import(pathToFileURL(file).href));
  const request = new Request(`https://klendar.app${ruta}`, { headers: { 'accept-language': 'es-ES,es;q=0.9' } });
  const res = await modulos.get(file).onRequestGet({ request, params, env: {}, waitUntil() {}, next() {} });
  return { status: res.status, kb: (await res.text()).length / 1024 };
}

if (modo === 'graba') {
  const grab = {};
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const r = await real(url, init);
    const t = await r.text();
    grab[clave(String(url), init)] = { s: r.status, t };
    return new Response(t, { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  for (const ruta of RUTAS) {
    try { const r = await pinta(ruta); console.log(ruta, r.status, `${r.kb.toFixed(0)} KB`); } catch (e) { console.log(ruta, 'ERROR', e.message); }
  }
  mkdirSync(join(REPO, '.wrangler'), { recursive: true });
  writeFileSync(GRAB, JSON.stringify(grab));
  console.log(`${Object.keys(grab).length} respuestas en ${GRAB}`);
} else if (modo === 'una') {
  const grab = JSON.parse(readFileSync(GRAB, 'utf8'));
  globalThis.fetch = async (url, init) => {
    const g = grab[clave(String(url), init)];
    return new Response(g ? g.t : '[]', { status: g ? g.s : 200, headers: { 'content-type': 'application/json' } });
  };
  // Cargar el módulo (en Cloudflare, al arrancar: no cuenta en la petición)
  // y calentar Request/Response de Node con una ruta que no pinta nada.
  await import(pathToFileURL(encuentra(arg.split('?')[0]).file).href);
  for (let i = 0; i < 3; i++) await pinta('/salud');
  const ms = [];
  let info;
  for (let i = 0; i < Number(process.env.N || 8); i++) {
    const t0 = performance.now();
    info = await pinta(arg);
    ms.push(performance.now() - t0);
  }
  console.log(JSON.stringify({ ruta: arg, ...info, ms }));
} else {
  const filas = [];
  for (const ruta of RUTAS) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'una', ruta], { encoding: 'utf8' });
    try {
      const j = JSON.parse(r.stdout.trim().split('\n').pop());
      const resto = j.ms.slice(1).sort((a, b) => a - b);
      filas.push({ ruta, estado: j.status, KB: Math.round(j.kb), 'en frío (ms)': +j.ms[0].toFixed(1), 'normal (ms)': +resto[Math.floor(resto.length / 2)].toFixed(1) });
    } catch { filas.push({ ruta, error: (r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ') }); }
  }
  console.table(filas);
}
