// Publicar, segunda tanda (Iván, 2026-11-16): lo que la web tiene que hacer
// igual que la app. Sin navegador ni red: lee panel/panel.js y prueba la
// ficha (/o/…) con un Supabase de mentira (fetch simulado).
//
//   1. Una agotada se puede pausar («Pausar»): `sePuedePausar`.
//   2. Compartir en historias y Cartel, solo en una activa o agotada
//      (aprobada y sin terminar): `seComparte`.
//   3. Quien tiene código o reserva ve la ficha aunque esté en pausa o el
//      local cerrado hoy: el «ya no está» lleva /assets/ficha-con-codigo.js,
//      y con su sesión (`x-klendar-sesion`) la base se la da, sin caché, con
//      «En pausa…» y sin compartir.
//   4. «Guardar borrador» en una terminada o cancelada la pasa a borrador.
//   5. «Crear a partir de esta» propone fechas nuevas (flash: ahora y 3 h;
//      evento: mañana a las 20:00), como la app.
//
//   node tools/publicar2_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const panel = readFileSync(new URL('panel/panel.js', raiz), 'utf8');
const script = readFileSync(new URL('assets/ficha-con-codigo.js', raiz), 'utf8');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};
const tiene = (s) => panel.includes(s);
const linea = (re) => (panel.match(re) || [''])[0];

// 1 y 2: las reglas, sacadas de panel.js y probadas.
const reglas = new Function(`${linea(/const finDe = [^\n]+/)}
${linea(/const sePuedePausar = [^\n]+/)}
${linea(/const seComparte = [^\n]+/)}
return { sePuedePausar, seComparte };`)();
const hora = (h) => new Date(Date.now() + h * 36e5).toISOString();
const pub = (status, extra = {}) => ({ kind: 'flash_offer', status, moderation_status: 'approved', redeem_start_at: hora(-1), redeem_end_at: hora(2), ...extra });
ok('1. se pausa una activa', reglas.sePuedePausar(pub('active')));
ok('1. se pausa una agotada', reglas.sePuedePausar(pub('sold_out')));
ok('1. no lo que ha terminado', !reglas.sePuedePausar(pub('sold_out', { redeem_end_at: hora(-0.1) })));
ok('1. ni un borrador', !reglas.sePuedePausar(pub('draft')));
ok('1. el botón usa la regla', tiene('${sePuedePausar(o) ? `<button type="button" class="btn sm ghost" data-act="pause"'));
ok('2. se comparte una activa y una agotada', reglas.seComparte(pub('active')) && reglas.seComparte(pub('sold_out')));
ok('2. no una programada', !reglas.seComparte(pub('draft', { publish_at: hora(24) })));
ok('2. ni terminada, cancelada o en revisión', !reglas.seComparte(pub('expired')) && !reglas.seComparte(pub('cancelled'))
  && !reglas.seComparte(pub('active', { moderation_status: 'pending' })) && !reglas.seComparte(pub('active', { redeem_end_at: hora(-1) })));
ok('2. historias y cartel usan la regla', tiene("const difundir = seComparte(o) && o.audience !== 'promoters'"));

// 4
ok('4. sin publicar, borrador (también terminada o cancelada)', tiene("status: alas ? 'draft' : (publicar ? 'active' : 'draft'),")
  && !tiene("['expired', 'cancelled'].includes(o.status) ? o.status : 'draft'"));

// 5
const copia = panel.slice(panel.indexOf("«Crear a partir de esta»: fechas nuevas"), panel.indexOf("if (desde.rrpp) o.audience = 'promoters';"));
ok('5. flash: desde ahora y 3 horas', /o\.redeem_start_at = ya\.toISOString\(\);\s*o\.redeem_end_at = new Date\(ya\.getTime\(\) \+ 3 \* 36e5\)/.test(copia));
ok('5. evento: mañana a las 20:00', copia.includes('o.event_at = enDiasNegocio(1, 20).toISOString();'));
ok('5. ya no se vacían las fechas', !tiene('o.redeem_start_at = null; o.redeem_end_at = null; o.event_at = null; o.event_end_at = null;'));

// 3: la ficha con un Supabase de mentira.
const ID = '5c0d2800-0000-4000-8000-0000000000f1';
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.firma';
const fila = {
  id: ID, kind: 'flash_offer', title: 'Café en pausa', status: 'draft', business_id: 'b1', business_name: 'Forno Nata',
  redeem_start_at: hora(-1), redeem_end_at: hora(3), images: [], locked: false, audience: 'all', max_seats: 1,
};
const pedidas = [];
globalThis.fetch = async (url, op = {}) => {
  const u = String(url);
  const auth = op.headers?.Authorization || '';
  pedidas.push({ u, auth });
  const json = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } });
  // La base: la ficha solo a quien manda su sesión (tiene código).
  if (u.endsWith('/rpc/offer_detail')) return json(auth === `Bearer ${TOKEN}` ? [fila] : auth === 'Bearer x.y.activa' ? [{ ...fila, status: 'active' }] : []);
  if (u.includes('/rpc/')) return json(null);
  return json([]);
};
const { configure } = await import('../functions/_lib/page.js');
configure({ SUPABASE_URL: 'https://falso.supabase.example', SUPABASE_KEY: 'clave-publica' });
const { offerPage, sesionDeFicha } = await import('../functions/_lib/views.js');
const peticion = (h = {}) => new Request(`https://klendar.app/o/${ID}`, { headers: h });

const sin = await offerPage(ID, 'es', '', peticion());
const sinHtml = await sin.text();
ok('3. sin sesión: «ya no está» (404)', sin.status === 404 && sinHtml.includes('Esta publicación ya no está'));
ok('3. y el script que la vuelve a pedir con la sesión', sinHtml.includes(`data-ficha-codigo="${ID}"`)
  && sinHtml.includes('/assets/ficha-con-codigo.js'));
const con = await offerPage(ID, 'es', '', peticion({ 'x-klendar-sesion': TOKEN }));
const conHtml = await con.text();
ok('3. con la sesión de quien tiene código: la ficha', con.status === 200 && conHtml.includes('Café en pausa'));
ok('3. la sesión va a la base', pedidas.some((p) => p.u.endsWith('/rpc/offer_detail') && p.auth === `Bearer ${TOKEN}`));
ok('3. sin caché ni buscadores', /private/.test(con.headers.get('cache-control') || '') && /no-store/.test(con.headers.get('cache-control') || '')
  && /x-klendar-sesion/.test(con.headers.get('vary') || '') && con.headers.get('x-robots-tag') === 'noindex');
ok('3. dice que está en pausa y que el código sigue valiendo', conHtml.includes('En pausa: ya no se ve en Klendar. Tu código sigue valiendo.'));
const activa = await (await offerPage(ID, 'es', '', peticion({ 'x-klendar-sesion': 'x.y.activa' }))).text();
ok('3. en pausa no se comparte (activa, sí)', !conHtml.includes('/historia/o/') && activa.includes('/historia/o/')
  && !activa.includes('En pausa: ya no se ve'));
ok('3. con sesión y sin código: «ya no está», sin volver a pedirla',
  await offerPage(ID, 'es', '', peticion({ 'x-klendar-sesion': 'a.b.c' })).then(async (r) => r.status === 404 && !(await r.text()).includes('data-ficha-codigo')));
ok('3. una cabecera que no es un token no cuenta', sesionDeFicha(peticion({ 'x-klendar-sesion': 'hola <script>' })) === null);
ok('3. el script pide la página con la sesión y no guarda nada', script.includes("'x-klendar-sesion': token")
  && script.includes('document.write(html)') && !/localStorage\.setItem|document\.cookie/.test(script));

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
