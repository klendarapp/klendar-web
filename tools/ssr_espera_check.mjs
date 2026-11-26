// Revisión general, parte 4 (§4zzz-revweb): las Functions no esperan para
// siempre a la base. Con una petición a Supabase que no contesta nunca,
// `rpc()`, `rows()` y el calendario (`/cal/<token>`) cortan con `BackendDown`
// (la página dice «Ahora mismo no podemos…», 503) en vez de dejar la visita
// colgada; y la siguiente visita no se queda enganchada a la llamada colgada
// de antes (`memo` las comparte). Sin red ni navegador, < 2 s.
//
//   node tools/ssr_espera_check.mjs
process.env.KLENDAR_ESPERA_MS = '150';
process.env.KLENDAR_MEMO = '1';
const raiz = new URL('..', import.meta.url);
const page = await import(new URL('functions/_lib/page.js', raiz));
const { onRequestGet: calendario } = await import(new URL('functions/cal/[token].js', raiz));
const { guard } = await import(new URL('functions/_lib/public.js', raiz));

let fallos = 0;
const ok = (nombre, cond) => { console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`); if (!cond) fallos++; };
const ENV = { SUPABASE_URL: 'http://base-colgada.invalid', SUPABASE_KEY: 'k' };
page.configure(ENV);
// La base no contesta nunca: solo se corta si quien llama lo corta.
let pedidas = 0;
globalThis.fetch = (url, init = {}) => {
  pedidas++;
  return new Promise((_, mal) => {
    init.signal?.addEventListener('abort', () => mal(init.signal.reason || new Error('aborted')));
  });
};
/** [p] o «colgada» a los 2 s. */
const aTiempo = (p) => Promise.race([p.then((v) => ({ v }), (e) => ({ e })), new Promise((r) => { setTimeout(() => r({ colgada: true }), 2000); })]);

let r = await aTiempo(page.rpc('public_offer', { p_id: 'x' }));
ok('rpc() corta con BackendDown', r.e instanceof page.BackendDown);
r = await aTiempo(page.rows('offers', 'select=id'));
ok('rows() corta con BackendDown', r.e instanceof page.BackendDown);
// Lo que se recuerda en memoria (las ciudades): la segunda visita vuelve a preguntar, no espera a la primera.
const antes = pedidas;
r = await aTiempo(page.rpcAll('public_cities', {}));
ok('rpcAll() de lo recordado corta', r.e instanceof page.BackendDown);
r = await aTiempo(page.rpcAll('public_cities', {}));
ok('la visita siguiente vuelve a preguntar y corta', r.e instanceof page.BackendDown && pedidas === antes + 2);
r = await aTiempo(guard('es', '/descubre', () => page.rpc('public_offer', {})));
ok('una página pública: 503 «no podemos cargar»', r.v?.status === 503);
r = await aTiempo(calendario({ env: ENV, params: { token: 'a'.repeat(32) }, request: new Request('https://klendar.app/cal/x') }));
ok('el calendario: 503 (lo vuelve a intentar)', r.v?.status === 503);
if (r.v?.status !== 503) console.log('   ', r.colgada ? 'colgado' : r.e?.message || r.v?.status);

console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
