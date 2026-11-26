// El CPU de cada ruta de la web, sin red y con la base simulada (RUNBOOK §3f y
// §4zzz-cpu-web). Cloudflare corta a los 10 ms de CPU por petición en el plan
// gratis (la espera a Supabase no cuenta); esto mide solo lo que gasta
// JavaScript: el middleware (`functions/_middleware.js`) y la Function de la
// ruta, con el Supabase falso de tools/_web_con_datos.mjs llamado en el mismo
// proceso (su tiempo se resta) y los ficheros estáticos ya en memoria.
//
//   node tools/cpu_check.mjs               → tabla y falla (código 1) si una
//                                            ruta pasa de UMBRAL en caliente
//                                            o de UMBRAL_FRIO en frío
//   node tools/cpu_check.mjs una /explorar → solo esa ruta (JSON)
//   ESCALA=10 node tools/cpu_check.mjs     → con 10 veces más planes y
//                                            negocios (de serie, 4)
//   CACHE=1 node tools/cpu_check.mjs una /explorar → con la caché del borde
//                                            (de mentira): la 2.ª visita es HIT
//
// «En frío»: la primera petición de una copia nueva de la Function (todo el
// código ya cargado, como en Cloudflare, pero sin estrenar: V8 compila cada
// función la primera vez que se usa). «En caliente»: la mediana de las
// siguientes. Cada ruta, en un proceso nuevo (lo de una no calienta a otra).
// Request, Response, Headers y URL se estrenan antes de medir: en Node son
// JavaScript, en Cloudflare van en C++ y no cuentan.
//
// Las cifras son de Node en este ordenador, no de Cloudflare: sirven para
// comparar y para que nada vuelva a dispararse. Desde Git Bash, con
// `MSYS_NO_PATHCONV=1` si se pasa una ruta.
//
// **Con el ordenador ocupado** (otra prueba a la vez, la app compilando) el
// reloj corre igual pero el JavaScript va más lento, y fallaba sin que nada
// hubiera cambiado (§4zzz-revweb, 26-11). Cada proceso mide también una
// referencia fija (`referencia()`: texto, JSON, expresiones regulares y
// objetos, como pintar una página) intercalada con las visitas; su mediana
// dividida por la de este ordenador sin nada más (`REF_PC`, 1,4 ms) es cuánto
// va más lento ahora (`carga`, entre 1 y 2: más que eso escondería un fallo de verdad), y los umbrales se multiplican
// por ella. Lo que vigila no cambia: una ruta que gasta de más también va más
// lenta con la carga, en la misma proporción. Además, una ruta que sale mal
// se repite (como mucho 3 veces) y vale la mejor. `CARGA=1` lo apaga.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const [, , modo = 'todas', arg] = process.argv;
// Por encima de esto falla (ms de CPU en este ordenador; Cloudflare corta a 10).
const UMBRAL = Number(process.env.UMBRAL || 8);
const UMBRAL_FRIO = Number(process.env.UMBRAL_FRIO || 40);
const ESCALA = Math.max(1, Number(process.env.ESCALA || 4));
// La mediana de `referencia()` en este ordenador sin nada más (ms).
const REF_PC = Number(process.env.REF_PC || 1.4);
const CARGA_MAX = 2;
const FALSO = 'http://supabase-falso.invalid';

// Las rutas: [ruta, qué tan pedida es (robots, buscadores, vistas previas)].
const OFERTA = 'a9000000-0000-4000-8000-000000000001';
const EVENTO = 'a9000000-0000-4000-8000-000000000012';
const NEGOCIO = 'bar-sonda-madrid';
const CELDA = 'ezjmg';
export const RUTAS = [
  ['/', 'muy alta'], ['/precios', 'alta'], ['/en', 'media'], ['/cuenta', 'media'], ['/panel', 'baja'],
  ['/descubre', 'muy alta'], ['/en/discover', 'alta'], [`/descubre?celda=${CELDA}`, 'alta'],
  ['/explorar', 'muy alta'], ['/explorar?ciudad=Madrid', 'alta'], ['/explorar?vista=negocios', 'alta'],
  ['/explorar?que=sitios', 'media'], ['/explorar?vista=mapa&ciudad=Madrid', 'media'], [`/explorar?celda=${CELDA}`, 'alta'],
  ['/explorar?cuando=finde&ciudad=Madrid', 'media'], ['/explorar?vista=calendario&ciudad=Madrid', 'media'], ['/en/explore', 'media'],
  ['/agenda', 'media'], ['/agenda/madrid', 'alta'], ['/agenda/madrid/music', 'media'], ['/hoy/madrid', 'alta'], ['/hoy', 'media'],
  ['/con-ninos/madrid', 'media'], ['/ofertas/madrid', 'media'], ['/provincia/madrid', 'media'], ['/coleccion/finde/madrid', 'media'],
  ['/guia/navidad', 'media'], ['/guia/navidad/madrid', 'media'],
  [`/o/${OFERTA}`, 'muy alta'], [`/o/${EVENTO}`, 'muy alta'], [`/en/o/${OFERTA}`, 'alta'],
  [`/b/${NEGOCIO}`, 'muy alta'], ['/b/agenda-publica-de-madrid', 'alta'], ['/b/no-existe', 'media'],
  [`/cartel/${OFERTA}`, 'baja'], [`/historia/o/${OFERTA}`, 'baja'],
  ['/partidos', 'media'], ['/grupos', 'media'], ['/sorteos', 'media'],
  ['/sitemap-agenda.xml', 'alta'], ['/sitemap-negocios.xml', 'alta'], ['/sitemap-planes.xml', 'alta'],
  ['/sitemap-guias.xml', 'alta'], ['/sitemap-artistas.xml', 'alta'],
  ['/salud', 'alta'], ['/agenda/madrid/', 'media'], ['/no-existe', 'media'],
];

// ── Como enruta Cloudflare Pages: por los nombres de los ficheros de functions/.
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
        let resto = 0;
        const re = segs.map((s) => {
          const todo = /^\[\[(\w+)\]\]$/.exec(s);
          if (todo) { names.push(todo[1]); resto += 1; return '?(.*)'; }
          const m = /^\[(\w+)\]$/.exec(s);
          if (m) { names.push(m[1]); return '([^/]+)'; }
          return s.replace(/[.]/g, '\\.');
        }).join('/');
        rutas.push({ file: p, names, resto, re: new RegExp(`^/${re}/?$`) });
      }
    };
    walk(base);
    // Lo fijo antes que lo variable (como Pages).
    rutas.sort((a, b) => (a.resto - b.resto) || (a.names.length - b.names.length));
  }
  for (const r of rutas) {
    const m = r.re.exec(path);
    if (m) return { file: r.file, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1] || '')])) };
  }
  return null;
}

// ── Los ficheros estáticos (env.ASSETS), en memoria.
const ASSETS = new Map();
function fichero(pathname) {
  const p = decodeURIComponent(pathname);
  const opciones = p.endsWith('/') ? [`${p}index.html`] : [p, `${p}.html`, `${p}/index.html`];
  for (const o of opciones) {
    const f = join(REPO, o);
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}
const TIPOS = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', xml: 'application/xml; charset=utf-8', txt: 'text/plain; charset=utf-8' };
function asset(url) {
  const u = new URL(url);
  if (!ASSETS.has(u.pathname)) {
    const f = fichero(u.pathname);
    const no = join(REPO, '404.html');
    ASSETS.set(u.pathname, f
      ? { status: 200, cuerpo: readFileSync(f), tipo: TIPOS[f.split('.').pop()] || 'application/octet-stream' }
      : { status: 404, cuerpo: readFileSync(no), tipo: TIPOS.html });
  }
  const a = ASSETS.get(u.pathname);
  return new Response(a.cuerpo, { status: a.status, headers: { 'content-type': a.tipo, 'cache-control': 'public, max-age=0, must-revalidate' } });
}

// ── Los datos: los de _web_con_datos, [ESCALA] veces (planes y negocios).
async function datos() {
  // Como un serve_dev hijo de _supabase_simulado (sin su aviso al salir, que lee
  // un fichero por pid y podía traer líneas de otra prueba): aquí fetch es el
  // falso de `una()` y nada sale a la red.
  if (!process.env.SUPABASE_BLOQUEADO) process.env.SUPABASE_BLOQUEADO = '1';
  const W = await import(pathToFileURL(join(REPO, 'tools', '_web_con_datos.mjs')).href);
  const D = W.DATOS;
  const copia = (l, pre, k) => l.map((x) => ({
    ...x, id: x.id.replace(/^[0-9a-f]{8}/, pre + String(k).padStart(2, '0')), slug: x.slug ? `${x.slug}-${k}` : x.slug,
    title: x.title ? `${x.title} ${k}` : x.title, name: x.name ? `${x.name} ${k}` : x.name,
  }));
  const PLANES = [...D.PLANES];
  const NEGOCIOS = [...D.NEGOCIOS];
  for (let k = 1; k < ESCALA; k += 1) { PLANES.push(...copia(D.PLANES, 'a9ff00', k)); NEGOCIOS.push(...copia(D.NEGOCIOS, 'b9ff00', k)); }
  const guia = { id: 'g1', slug: 'navidad', title: 'Navidad', title_es: 'Navidad', title_en: 'Christmas', count: PLANES.length, starts_on: null, ends_on: null };
  return W.respondeSinRed({
    base: FALSO,
    datos: { ...D, PLANES, NEGOCIOS },
    rpc: {
      guide_info: () => guia,
      guide_places: () => [{ slug: 'madrid', name: 'Madrid', n: PLANES.length }],
      guide_offers: () => ({ items: PLANES.slice(0, 24), total: PLANES.length }),
      current_guide: () => null,
      service_health: () => ({ ok: true }),
    },
  });
}

// ── Una ruta, en este proceso.
async function una(ruta) {
  const responde = await datos();
  // El CPU que gasta el Supabase falso (y leer un estático) no es de la web: se resta.
  let fuera = 0;
  const memo = new Map();
  // En Windows, el CPU del hilo (process.threadCpuUsage) va a saltos de 15,6 ms:
  // se mide el reloj (sin red ni disco, aquí reloj ≈ CPU) y se toma la mediana.
  const hilo = () => performance.now();
  // Y el CPU de verdad del hilo, que no cuenta el tiempo que otro proceso le
  // quita (con el ordenador ocupado): va a saltos, pero sumado en muchas
  // visitas sale bien. Segunda opinión (ver `mala`).
  const cpuHilo = process.threadCpuUsage ? () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; } : null;
  let fueraCpu = 0;
  let pedidas = 0;
  globalThis.fetch = async (u, init) => {
    pedidas += 1;
    // Sin `await` en medio: otra petición a la vez no se cuela en lo que se resta.
    let t0 = hilo();
    let c0 = cpuHilo ? cpuHilo() : 0;
    // Cada pregunta, contestada una vez (lo que sigue sale de la memoria: menos basura del falso que el GC cobre a la web).
    const k = `${u} ${init?.body || ''} ${new Headers(init?.headers || {}).get('accept') || ''}`;
    let r = memo.get(k) || responde(String(u), init || {});
    if (r && typeof r.then === 'function') { fuera += hilo() - t0; if (cpuHilo) fueraCpu += cpuHilo() - c0; r = await r; t0 = hilo(); c0 = cpuHilo ? cpuHilo() : 0; }
    memo.set(k, r);
    const res = r ? new Response(r.cuerpo, { status: r.status, headers: { 'content-type': 'application/json' } }) : new Response('{}', { status: 200 });
    fuera += hilo() - t0;
    if (cpuHilo) fueraCpu += cpuHilo() - c0;
    return res;
  };
  // La caché del borde, de mentira (solo con CACHE=1).
  // CACHE=hit: la caché ya tiene la página (una visita HIT a una copia nueva:
  // solo el middleware y _lib/cache.js, sin pintar nada).
  if (process.env.CACHE === 'hit') {
    const cuerpo = readFileSync(join(REPO, 'index.html'));
    globalThis.caches = { default: {
      async match() {
        return new Response(cuerpo, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-klendar-cc': 'public, max-age=300, s-maxage=900', 'x-klendar-en': String(Date.now()), 'content-security-policy': "script-src 'self'" } });
      },
      async put() {},
    } };
  } else if (process.env.CACHE) {
    const g = new Map();
    globalThis.caches = { default: {
      async match(req) { const x = g.get(req.url); return x ? new Response(x.cuerpo, { status: x.status, headers: x.headers }) : undefined; },
      async put(req, res) { g.set(req.url, { cuerpo: await res.arrayBuffer(), status: res.status, headers: [...res.headers] }); },
    } };
  }
  // Todo el código cargado, como al arrancar la copia en Cloudflare (no cuenta en la petición).
  const mw = await import(pathToFileURL(join(REPO, 'functions', '_middleware.js')).href);
  const modulos = new Map();
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) modulos.set(p, null); } };
  walk(join(REPO, 'functions'));
  for (const p of modulos.keys()) modulos.set(p, await import(pathToFileURL(p).href));
  if (process.env.PRUEBA_COMPILA) {
    const ex = await import(pathToFileURL(join(REPO, 'functions', '_lib', 'explore.js')).href);
    const trampa = { get headers() { throw new Error('arranque'); } };
    ex.explorePage(null, 'es', 'explorar', trampa).catch(() => {});
  }
  // Al cargar no se pide nada (compilaAlArrancar vuelve antes; en Cloudflare, fetch() fuera de una petición lanza).
  const alArrancar = pedidas;
  encuentra('/'); // la tabla de rutas de Pages (en Cloudflare ya viene hecha)
  // Request/Response/Headers/URL/streams de Node, estrenados (en Cloudflare son nativos).
  for (let i = 0; i < 20; i += 1) {
    const rq = new Request('https://klendar.app/x?y=1', { headers: { 'accept-language': 'es', cookie: 'a=b' } });
    const h = new Headers(rq.headers); h.set('x', 'y'); h.delete('x'); [...h];
    const rs = new Response('<p>x</p>', { status: 200, headers: h });
    const [a, b] = rs.body.tee();
    await new Response(a).text(); await new Response(b).arrayBuffer();
    await new Response(JSON.stringify({ a: [1, 2] })).json();
    new URL('https://klendar.app/a/b?c=d').searchParams.get('c');
    crypto.getRandomValues(new Uint8Array(16));
    new TextEncoder().encode('x');
  }

  let ultimo = null; // VUELCA=fichero: el HTML de la 1.ª visita (para comparar antes y después)
  const visita = async () => {
    const pendientes = [];
    const request = new Request(`https://klendar.app${ruta}`, { headers: { 'accept-language': 'es-ES,es;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } });
    const env = { SUPABASE_URL: FALSO, SUPABASE_KEY: 'falsa', ASSETS: { fetch: async (u) => { const t0 = hilo(); const c0 = cpuHilo ? cpuHilo() : 0; const r = asset(String(u.url || u)); fuera += hilo() - t0; if (cpuHilo) fueraCpu += cpuHilo() - c0; return r; } } };
    const ctx = {
      request, env, params: {}, waitUntil: (p) => pendientes.push(p), data: {},
      next: async (otra) => {
        const rq = otra instanceof Request ? otra : request;
        const { pathname } = new URL(rq.url);
        const f = encuentra(pathname);
        if (!f) return env.ASSETS.fetch(rq);
        const m = modulos.get(f.file);
        const h = m.onRequestGet || m.onRequest;
        return h({ ...ctx, request: rq, params: f.params });
      },
    };
    fuera = 0;
    fueraCpu = 0;
    if (process.env.MARCAS) MARCA_INICIO(); // node --log-function-events: dónde empieza la 1.ª visita
    const t0 = hilo();
    const c0 = cpuHilo ? cpuHilo() : 0;
    const res = await mw.onRequest(ctx);
    const cuerpo = res.body ? await res.text() : '';
    if (process.env.VUELCA && !ultimo) ultimo = cuerpo;
    await Promise.all(pendientes);
    const ms = hilo() - t0 - fuera;
    const cpu = cpuHilo ? cpuHilo() - c0 - fueraCpu : null;
    if (process.env.MARCAS) MARCA_FIN();
    return { status: res.status, kb: cuerpo.length / 1024, ms, cpu, cache: res.headers.get('x-klendar-cache') };
  };
  const ms = [];
  const cpu = [];
  const ref = [];
  for (let i = 0; i < 5; i += 1) referencia(); // estrenada
  let info;
  // PERFIL=x.cpuprofile: el perfil de la 1.ª visita (en frío), para ver qué gasta.
  let sesion = null;
  // PERFIL_EN=n: el de la visita n (0 = la primera).
  const perfilEn = Number(process.env.PERFIL_EN || 0);
  const empieza = async () => {
    const { Session } = await import('node:inspector/promises');
    sesion = new Session(); sesion.connect();
    await sesion.post('Profiler.enable'); await sesion.post('Profiler.setSamplingInterval', { interval: 50 }); await sesion.post('Profiler.start');
  };
  if (process.env.PERFIL && perfilEn === 0) {
    await empieza();
  }
  for (let i = 0; i < Number(process.env.N || 9); i += 1) {
    if (process.env.PERFIL && perfilEn && i === perfilEn) await empieza();
    info = await visita(); ms.push(info.ms); cpu.push(info.cpu);
    for (let k = 0; k < 3; k += 1) ref.push(referencia());
    if (sesion && i === perfilEn) {
      const { profile } = await sesion.post('Profiler.stop');
      (await import('node:fs')).writeFileSync(process.env.PERFIL, JSON.stringify(profile));
      sesion = null;
    }
  }
  if (process.env.VUELCA) (await import('node:fs')).writeFileSync(process.env.VUELCA, ultimo ?? '');
  // El CPU en caliente, la media de las visitas (cada una va a saltos de 15,6 ms en Windows).
  const caliente = cpu.slice(1);
  const cpuCaliente = cpu[0] == null ? null : caliente.reduce((a, b) => a + b, 0) / caliente.length;
  return { ruta, status: info.status, kb: info.kb, cache: info.cache, alArrancar, ms, ref: med(ref), cpu: cpu[0] == null ? null : [Math.max(0, cpu[0]), Math.max(0, cpuCaliente)] };
}

// Un trabajo fijo, como el de pintar una página (sin red ni disco): lo que
// tarda dice cuánto va de lento el ordenador en este momento.
const FILAS = Array.from({ length: 300 }, (_, i) => ({ id: `a9-${i}`, title: `Plan ${i} <b>& «${i % 7}»</b>`, price: (i * 37) % 1000, tags: ['bar', 'música', String(i)] }));
function referencia() {
  const t0 = performance.now();
  let html = '';
  for (let k = 0; k < 3; k += 1) {
    const filas = JSON.parse(JSON.stringify(FILAS));
    html = filas.map((f) => `<li data-id="${f.id}">${f.title.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)} · ${(f.price / 100).toFixed(2).replace('.', ',')} € ${f.tags.join(', ')}</li>`).join('');
  }
  if (html.length < 100) throw new Error('referencia');
  return performance.now() - t0;
}

// Las marcas de MARCAS=1 (no se llaman hasta la 1.ª visita: su «first-execution» la delimita).
function MARCA_INICIO() { return 1; }
function MARCA_FIN() { return 2; }

const med = (l) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

if (modo === 'una') {
  console.log(JSON.stringify(await una(arg)));
} else {
  const lista = process.env.RUTAS ? process.env.RUTAS.split(',').map((r) => [r, '']) : RUTAS;
  const filas = new Array(lista.length);
  let siguiente = 0;
  const hilos = Math.max(1, Math.min(Number(process.env.HILOS || 2), 6));
  const mide = (ruta) => new Promise((ok) => {
    let out = ''; let err = '';
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), 'una', ruta], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', () => ok({ out, err }));
  });
  const fila = (ruta, uso, salida) => {
    try {
      const j = JSON.parse(salida.out.trim().split('\n').filter((l) => l.startsWith('{"ruta"')).pop());
      const carga = process.env.CARGA ? Number(process.env.CARGA) : Math.min(CARGA_MAX, Math.max(1, j.ref / REF_PC));
      return { ruta, uso, estado: j.status, KB: Math.round(j.kb), 'frío (ms)': +j.ms[0].toFixed(1), 'caliente (ms)': +med(j.ms.slice(1)).toFixed(1), carga: +carga.toFixed(2),
        ...(j.cpu ? { 'CPU frío': +j.cpu[0].toFixed(1), 'CPU caliente': +j.cpu[1].toFixed(1) } : {}),
        ...(j.alArrancar ? { error: `${j.alArrancar} petición(es) a la base al cargar el código` } : {}) };
    } catch { return { ruta, uso, error: (salida.err || salida.out).trim().split('\n').slice(-2).join(' ').slice(0, 160) }; }
  };
  // /salud da 503 sin una base de verdad (mira también la de prod): solo cuenta su CPU.
  // Los umbrales, por la carga del ordenador al medir esa ruta; y, si se
  // sabe, el CPU del hilo también tiene que pasarse (el reloj solo, con otros
  // procesos quitándole el turno, salía alto sin que la ruta gastara más). En
  // frío, una sola medida a saltos de 15,6 ms: se le da ese margen.
  // (El CPU también va más lento con la carga: el otro hilo del mismo núcleo
  // y la caché compartida; `carga` lo mide así, con medidas cortas.)
  const pasa = (f, reloj, cpu, umbral, margen) => f[reloj] > umbral * f.carga && (f[cpu] == null || f[cpu] > umbral * f.carga + margen);
  const mala = (f) => f.error || (f.estado >= 500 && f.ruta !== '/salud')
    || pasa(f, 'caliente (ms)', 'CPU caliente', UMBRAL, 0) || pasa(f, 'frío (ms)', 'CPU frío', UMBRAL_FRIO, 15.6);
  // Lo que cuenta al elegir la mejor de varias medidas: lo medido, sin la carga.
  const peso = (f) => (f['caliente (ms)'] + f['frío (ms)'] / 10) / f.carga;
  const trabaja = async () => {
    while (siguiente < lista.length) {
      const i = siguiente++;
      const [ruta, uso] = lista[i];
      let f = fila(ruta, uso, await mide(ruta));
      // Con el ordenador ocupado (otras pruebas a la vez) una medida sale alta:
      // se repite dos veces y vale la mejor.
      for (let r = 0; r < 2 && mala(f) && !f.error; r += 1) {
        const otra = fila(ruta, uso, await mide(ruta));
        if (!otra.error && peso(otra) < peso(f)) f = otra;
      }
      filas[i] = f;
    }
  };
  await Promise.all(Array.from({ length: hilos }, trabaja));
  const ordenadas = [...filas].sort((a, b) => (b['caliente (ms)'] ?? 99) - (a['caliente (ms)'] ?? 99));
  if (!process.env.CALLADO) console.table(ordenadas);
  const malas = filas.filter(mala);
  if (malas.length) {
    console.error(`cpu_check: ${malas.length} ruta(s) fallan o pasan de ${UMBRAL} ms en caliente / ${UMBRAL_FRIO} ms en frío, por la carga (ESCALA=${ESCALA}):`);
    for (const f of malas) console.error(' ', f.ruta, f.error || `${f.estado} · frío ${f['frío (ms)']} · caliente ${f['caliente (ms)']} · carga ×${f.carga} · CPU ${f['CPU frío']}/${f['CPU caliente']}`);
    process.exit(1);
  }
  console.log(`cpu_check: ${filas.length} rutas, todas por debajo de ${UMBRAL} ms en caliente y ${UMBRAL_FRIO} ms en frío (ESCALA=${ESCALA}).`);
}
