// La caché del borde (functions/_lib/cache.js) y la memoria de las listas
// comunes (functions/_lib/page.js), sin Cloudflare ni red (rendimiento,
// Iván, 18-11). Una Cache API de mentira con su `max-age`, el reloj a mano y
// un `ctx.next()` que cuenta cuántas veces se pinta.
//
//   node tools/cache_borde_check.mjs
let ahora = Date.parse('2026-11-18T12:00:00Z');
const dateNow = Date.now;
Date.now = () => ahora;

// ── La Cache API de mentira (lo que hace la de Cloudflare: guarda hasta su max-age) ──
const guardado = new Map();
globalThis.caches = {
  default: {
    async match(req) {
      const g = guardado.get(typeof req === 'string' ? req : req.url);
      if (!g || ahora > g.hasta) return undefined;
      return new Response(g.cuerpo, { status: g.status, headers: g.headers });
    },
    async put(req, res) {
      if (res.headers.has('vary') && res.headers.get('vary').includes('*')) throw new TypeError('Vary: *');
      const ma = Number((/max-age=(\d+)/.exec(res.headers.get('cache-control') || '') || [])[1] || 0);
      guardado.set(typeof req === 'string' ? req : req.url, { cuerpo: await res.text(), status: res.status, headers: [...res.headers], hasta: ahora + ma * 1000 });
    },
  },
};
process.env.KLENDAR_MEMO = '1';

const { desdeLaCache, tiempos, peticionGuardable } = await import('../functions/_lib/cache.js');
const { onRequest } = await import('../functions/_middleware.js');

let fallos = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? 'OK  ' : 'FALLA'} ${m}${c ? '' : ` ${extra}`}`); if (!c) fallos += 1; };

/** Una visita: { r, pintadas } (cuántas veces llegó a la página). */
let pintadas = 0;
let pendientes = [];
async function visita(ruta, { metodo = 'GET', cabeceras = {}, cf = undefined, pagina } = {}) {
  const request = new Request(`https://klendar.app${ruta}`, { method: metodo, headers: cabeceras });
  if (cf) Object.defineProperty(request, 'cf', { value: cf });
  const ctx = {
    request,
    env: {},
    waitUntil: (p) => pendientes.push(p),
    next: async () => { pintadas += 1; return pagina(); },
  };
  const r = await onRequest(ctx);
  const cuerpo = await r.text();
  await Promise.all(pendientes.splice(0));
  return { r, cuerpo, estado: r.headers.get('x-klendar-cache') };
}
const html = (cuerpo, cc, status = 200, extra = {}) => () => new Response(cuerpo, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cc, ...extra } });
const DE_SERIE = 'public, max-age=60, s-maxage=300';

// 1. Una ficha de oferta: se pinta una vez y luego sale de la caché.
{
  pintadas = 0;
  const p = html('<p>oferta</p>', DE_SERIE);
  const a = await visita('/o/11111111-1111-4111-8111-111111111111', { pagina: p });
  const b = await visita('/o/11111111-1111-4111-8111-111111111111', { pagina: p });
  ok(a.estado === 'MISS' && b.estado === 'HIT' && pintadas === 1, '1. oferta: MISS y luego HIT, pintada una vez', `${a.estado} ${b.estado} ${pintadas}`);
  ok(b.cuerpo === '<p>oferta</p>', '1. …con el mismo HTML');
  ok(b.r.headers.get('cache-control') === DE_SERIE, '1. …y el Cache-Control de la página para el navegador', b.r.headers.get('cache-control'));
  ok(!b.r.headers.has('x-klendar-cc') && !b.r.headers.has('x-klendar-en'), '1. …sin las cabeceras internas');
  ok(b.r.headers.get('x-content-type-options') === 'nosniff', '1. …con las cabeceras de seguridad');
  // 6 min después: más de sus 5 min frescos, dentro de la reserva (10 min).
  ahora += 6 * 60e3;
  const c = await visita('/o/11111111-1111-4111-8111-111111111111', { pagina: html('<p>oferta nueva</p>', DE_SERIE) });
  ok(c.estado === 'STALE' && c.cuerpo === '<p>oferta</p>' && pintadas === 2, '1. a los 6 min: la vieja al momento y la nueva por detrás', `${c.estado} ${pintadas}`);
  const d = await visita('/o/11111111-1111-4111-8111-111111111111', { pagina: p });
  ok(d.estado === 'HIT' && d.cuerpo === '<p>oferta nueva</p>' && pintadas === 2, '1. …y la siguiente visita ya ve la nueva', `${d.estado} ${d.cuerpo}`);
  // 20 min sin visitas: más que frescos + reserva → se pinta ahora.
  ahora += 20 * 60e3;
  const e = await visita('/o/11111111-1111-4111-8111-111111111111', { pagina: html('<p>otra</p>', DE_SERIE) });
  ok(e.estado === 'MISS' && e.cuerpo === '<p>otra</p>', '1. pasada la reserva, se pinta en el momento', e.estado);
  // «Tirar para actualizar» (no-cache): dentro de 30 s, la guardada; después, nueva.
  const f = await visita('/o/11111111-1111-4111-8111-111111111111', { cabeceras: { 'cache-control': 'no-cache' }, pagina: html('<p>x</p>', DE_SERIE) });
  ok(f.estado === 'HIT', '1. una recarga a mano a los pocos segundos: la guardada (frena los bucles)', f.estado);
  ahora += 40e3;
  const g = await visita('/o/11111111-1111-4111-8111-111111111111', { cabeceras: { 'cache-control': 'no-cache' }, pagina: html('<p>recargada</p>', DE_SERIE) });
  ok(g.estado === 'MISS' && g.cuerpo === '<p>recargada</p>', '1. …y pasados 30 s, pintada de nuevo', g.estado);
  const h = await visita('/o/11111111-1111-4111-8111-111111111111', { metodo: 'HEAD', pagina: p });
  ok(h.r.status === 200 && h.cuerpo === '' && h.estado === 'HIT', '1. HEAD: de la caché y sin cuerpo', `${h.r.status} ${h.estado}`);
}

// 2. Lo que nunca se guarda ni se sirve de la caché.
{
  const ruta = '/b/cafe-central-madrid';
  pintadas = 0;
  await visita(ruta, { pagina: html('<p>ficha</p>', DE_SERIE) });
  for (const [nombre, cab] of [
    ['la cookie de la edad', { cookie: 'otra=1; klendar_18=1' }],
    ['la sesión de la ficha', { 'x-klendar-sesion': 'a.b.c' }],
    ['Authorization', { authorization: 'Bearer a.b.c' }],
  ]) {
    const antes = pintadas;
    const r = await visita(ruta, { cabeceras: cab, pagina: html('<p>suya</p>', 'private, max-age=0') });
    ok(r.estado === 'BYPASS' && r.cuerpo === '<p>suya</p>' && pintadas === antes + 1, `2. con ${nombre}: se pinta para él (BYPASS)`, r.estado);
  }
  const otra = await visita(ruta, { cabeceras: { cookie: '_ga=1' } , pagina: html('<p>x</p>', DE_SERIE) });
  ok(otra.estado === 'HIT' && otra.cuerpo === '<p>ficha</p>', '2. otra cookie cualquiera no cambia la página: de la caché', otra.estado);
  const casos = [
    ['privada', html('a', 'private, max-age=0')],
    ['no-store', html('a', 'no-store')],
    ['public sin s-maxage', html('a', 'public, max-age=300')],
    ['con Set-Cookie', html('a', DE_SERIE, 200, { 'set-cookie': 'x=1' })],
    ['Vary por la IP', html('a', DE_SERIE, 200, { vary: 'Cookie, CF-Connecting-IP' })],
    ['un 503', html('a', 'no-store', 503)],
    ['un 500 aunque diga public', html('a', DE_SERIE, 500)],
    ['un 302', () => new Response(null, { status: 302, headers: { location: '/x', 'cache-control': 'public, s-maxage=300' } })],
  ];
  for (const [i, [nombre, p]] of casos.entries()) {
    pintadas = 0;
    const r1 = `/agenda/caso-${i}`;
    await visita(r1, { pagina: p });
    const b = await visita(r1, { pagina: p });
    ok(b.estado === 'MISS' && pintadas === 2, `2. ${nombre}: no se guarda`, `${b.estado} ${pintadas}`);
  }
  ok(!peticionGuardable(new Request('https://klendar.app/o/x', { method: 'POST' })), '2. POST: nunca');
  // Fuera de EN_CACHE (Tu cuenta, panel…): ni se mira.
  const cuenta = await visita('/cuenta', { pagina: html('c', DE_SERIE) });
  ok(cuenta.estado === null, '2. /cuenta ni pasa por la caché', cuenta.estado);
}

// 3. Vary: Cookie (Explorar y Descubre) sí: la cookie de la edad se mira antes.
{
  pintadas = 0;
  const p = html('<p>agenda</p>', 'public, max-age=120, s-maxage=600', 200, { vary: 'Cookie' });
  await visita('/agenda/madrid', { pagina: p });
  const b = await visita('/agenda/madrid', { pagina: p });
  ok(b.estado === 'HIT' && pintadas === 1 && b.r.headers.get('vary') === 'Cookie', '3. Vary: Cookie se guarda y sale con su Vary', `${b.estado} ${b.r.headers.get('vary')}`);
  const c = await visita('/agenda/madrid?p=2', { pagina: p });
  ok(c.estado === 'MISS', '3. otra consulta, otra clave');
  const en = await visita('/en/whats-on/madrid', { pagina: p });
  ok(en.estado === 'MISS', '3. otro idioma (/en/…), otra clave');
}

// 4. Los 404 (ids que no existen): 2 min, sin reserva.
{
  pintadas = 0;
  const p = html('<p>no está</p>', 'public, max-age=0, s-maxage=120', 404);
  await visita('/o/00000000-0000-4000-8000-000000000000', { pagina: p });
  const b = await visita('/o/00000000-0000-4000-8000-000000000000', { pagina: p });
  ok(b.estado === 'HIT' && b.r.status === 404 && pintadas === 1, '4. 404: de la caché', `${b.estado} ${b.r.status}`);
  ahora += 3 * 60e3;
  const c = await visita('/o/00000000-0000-4000-8000-000000000000', { pagina: p });
  ok(c.estado === 'MISS', '4. …y a los 3 min se pregunta de nuevo', c.estado);
  ok(tiempos('/b/x', new Response(null, { status: 301, headers: { location: '/b/y', 'cache-control': 'public, max-age=3600, s-maxage=3600' } }))?.frescos === 3600, '4. un 301 público: 1 h');
  ok(tiempos('/o/x', new Response('', { headers: { 'cache-control': 'public, max-age=300, s-maxage=900' } }))?.frescos === 300, '4. una oferta, como mucho 5 min aunque pida más');
  ok(tiempos('/m/x', new Response('', { headers: { 'cache-control': 'public, max-age=30, s-maxage=30' } }))?.reserva === 120, '4. el QR de mesa (30 s) casi sin reserva');
}

// 5. Descubre y Explorar con la zona de la conexión: nunca de la caché.
{
  const ES = { country: 'ES', latitude: '36.72', longitude: '-4.42' };
  const p = html('<p>todas las ciudades</p>', 'public, max-age=120, s-maxage=600', 200, { vary: 'Cookie' });
  pintadas = 0;
  await visita('/descubre', { pagina: p });
  const robot = await visita('/descubre', { cabeceras: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }, cf: ES, pagina: p });
  ok(robot.estado === 'HIT' && pintadas === 1, '5. un robot (aunque sea desde España): «Todas las ciudades», de la caché', robot.estado);
  const fuera = await visita('/descubre', { cf: { country: 'FR', latitude: '48.8', longitude: '2.3' }, pagina: p });
  ok(fuera.estado === 'HIT', '5. desde fuera de España: de la caché', fuera.estado);
  const persona = await visita('/descubre', { cf: ES, pagina: html('<p>cerca de ti</p>', 'private, max-age=0', 200, { vary: 'Cookie, CF-Connecting-IP' }) });
  ok(persona.estado === 'BYPASS' && persona.cuerpo === '<p>cerca de ti</p>', '5. una persona en España sin ciudad: su página, pintada para ella', persona.estado);
  await visita('/explorar?ciudad=madrid', { pagina: p });
  const conCiudad = await visita('/explorar?ciudad=madrid', { cf: ES, pagina: p });
  ok(conCiudad.estado === 'HIT', '5. con ciudad en la dirección no depende de la conexión: de la caché', conCiudad.estado);
  const guia = await visita('/guia/navidad', { cf: ES, pagina: p });
  ok(guia.estado === 'BYPASS', '5. una guía sin municipio, con zona: su página', guia.estado);
  const guiaMuni = await visita('/guia/navidad/malaga', { cf: ES, pagina: p });
  ok(guiaMuni.estado === 'MISS', '5. una guía de un municipio: a la caché', guiaMuni.estado);
}

// 6. La página de Explorar de verdad: pública sin zona, privada con ella.
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('[]', { headers: { 'content-type': 'application/json' } });
  const { explorePage } = await import('../functions/_lib/explore.js');
  const sinZona = await explorePage(new URL('https://klendar.app/descubre'), 'es', 'descubre', new Request('https://klendar.app/descubre'));
  ok(/public/.test(sinZona.headers.get('cache-control')) && !/connecting-ip/i.test(sinZona.headers.get('vary') || ''), '6. Descubre sin zona (robots): pública y sin Vary por la IP', `${sinZona.headers.get('cache-control')} · ${sinZona.headers.get('vary')}`);
  const req = new Request('https://klendar.app/descubre');
  Object.defineProperty(req, 'cf', { value: { country: 'ES', latitude: '40.41', longitude: '-3.70' } });
  const conZona = await explorePage(new URL('https://klendar.app/descubre'), 'es', 'descubre', req);
  ok(/private/.test(conZona.headers.get('cache-control')) && /connecting-ip/i.test(conZona.headers.get('vary') || ''), '6. con la zona de la conexión: privada', conZona.headers.get('cache-control'));
  const edad = await explorePage(new URL('https://klendar.app/explorar?ciudad=madrid'), 'es', 'explorar', new Request('https://klendar.app/explorar', { headers: { cookie: 'klendar_18=1' } }));
  ok(/private/.test(edad.headers.get('cache-control')), '6. con la cookie de la edad: privada', edad.headers.get('cache-control'));
  globalThis.fetch = realFetch;
}

// 7. La memoria de las listas comunes (page.js).
{
  const { rpcAll, rpc, rows, olvidaMemo, BackendDown } = await import('../functions/_lib/page.js');
  olvidaMemo();
  const realFetch = globalThis.fetch;
  let pedidas = [];
  let falla = false;
  globalThis.fetch = async (u, init = {}) => {
    pedidas.push(String(u));
    if (falla) return new Response('{}', { status: 503 });
    await new Promise((r) => setTimeout(r, 5));
    return new Response(JSON.stringify([{ id: 'madrid', name: 'Madrid', n: pedidas.length }]), { headers: { 'content-type': 'application/json' } });
  };
  const [a, b] = await Promise.all([rpcAll('public_cities', {}), rpcAll('public_cities', {})]);
  ok(pedidas.length === 1 && a[0].id === 'madrid' && b[0].id === 'madrid', '7. dos páginas a la vez: una sola llamada', String(pedidas.length));
  a[0].name = 'CAMBIADA';
  const c = await rpcAll('public_cities', {});
  ok(pedidas.length === 1 && c[0].name === 'Madrid', '7. de la memoria, y lo que cambie una página no le llega a la siguiente');
  await rows('categories', 'select=*&order=position.asc');
  await rows('categories', 'select=*&order=position.asc');
  ok(pedidas.length === 2, '7. las categorías (tabla): una vez');
  await rpcAll('search_municipalities', { p_q: '' });
  await rpcAll('search_municipalities', { p_q: '' });
  await rpcAll('search_municipalities', { p_q: 'mal', p_limit: 8 });
  await rpcAll('search_municipalities', { p_q: 'mal', p_limit: 8 });
  ok(pedidas.length === 5, '7. «Populares» de la memoria; lo escrito, siempre a la base', String(pedidas.length));
  await rpc('public_explore', { p_city: null });
  await rpc('public_explore', { p_city: null });
  ok(pedidas.length === 7, '7. public_explore nunca de la memoria (va en la página, que ya se guarda)');
  await rpcAll('public_categories', { p_city: 'madrid' }, { 'x-klendar-18': '1' });
  await rpcAll('public_categories', { p_city: 'madrid' }, { 'x-klendar-18': '1' });
  ok(pedidas.length === 9, '7. con cabeceras de quien mira (+18, sesión): siempre a la base');
  // Caducada y con la base caída: lo último que se supo, un rato.
  ahora += 11 * 60e3;
  falla = true;
  const viejas = await rpcAll('public_cities', {});
  ok(viejas[0].id === 'madrid', '7. caducada y la base caída: lo último que se supo');
  olvidaMemo();
  let lanzo = false;
  try { await rpcAll('public_cities', {}); } catch (e) { lanzo = e instanceof BackendDown; }
  ok(lanzo, '7. sin nada guardado y la base caída: el error de siempre (BackendDown)');
  falla = false;
  const otra = await rpcAll('public_cities', {});
  ok(otra[0].id === 'madrid', '7. el fallo no se recuerda: a la siguiente, a la base');
  globalThis.fetch = realFetch;
}

Date.now = dateNow;
console.log(fallos ? `\n${fallos} FALLAN` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
