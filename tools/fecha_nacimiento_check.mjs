// La fecha de nacimiento en «Tu cuenta», como en la app: se escribe con máscara
// (15/03/1980, las barras salen solas) o se elige con el calendario. En «Crea tu
// cuenta», «Un último paso» y «Editar perfil», con Supabase contestado aquí (no
// toca dev ni prod ni manda nada).
//
// Chromium y WebKit, a 390 px.
//
//   SUPABASE_BLOQUEADO=1 PORT=8872 node tools/serve_dev.mjs &
//   BASE=http://localhost:8872 PW=<ruta a playwright> OUT=<carpeta> node tools/fecha_nacimiento_check.mjs
import { playwright, REF, SUPA, realtimeMudo, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8872';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-0000000097d3';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', exp: 4102444800 })}.x`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'fecha@example.com', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const JOVEN = 'Necesitas tener al menos 14 años para usar Klendar';
const MAL = 'Revisa la fecha';
const ahora = new Date();
const dd = (n) => String(n).padStart(2, '0');
const texto = (a, m, d) => `${dd(d)}/${dd(m)}/${a}`;

let fallos = 0;
function ok(cond, nombre, extra = '') {
  if (cond) console.log(`  ok  ${nombre}`);
  else { fallos += 1; console.log(`  MAL ${nombre} ${extra}`); }
}

async function abre(nav, { ruta, lang = 'es', sesion = false, consents = {}, perfil = {} }) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => {
    try {
      if (v) localStorage.setItem(k, v);
      localStorage.setItem('klendar_lang', l);
    } catch { /* */ }
  }, [`sb-${REF}-auth-token`, sesion ? SESION : '', lang]);
  const estado = { rpc: [], signup: [] };
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (url.pathname.startsWith('/auth/v1/signup')) { estado.signup.push(body); return json({ code: 'email_address_invalid', msg: 'prueba' }, 400); }
    if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
    if (url.pathname.startsWith('/auth/v1/settings')) return json({ external: { email: true, google: true } });
    if (url.pathname.startsWith('/auth/v1/')) return json({});
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.slice('/rest/v1/rpc/'.length);
      estado.rpc.push([fn, body]);
      if (fn === 'my_consents') return json({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true, ...consents });
      if (fn === 'display_name_allowed') return json(true);
      return json(null);
    }
    if (url.pathname.startsWith('/rest/v1/profiles')) {
      const fila = { id: U, display_name: 'Ana', avatar_url: null, birth_date: null, ...perfil };
      return json(req.headers().accept?.includes('vnd.pgrst.object') ? fila : [fila]);
    }
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
  await realtimeMudo(ctx);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  await p.goto(`${BASE}/cuenta/${ruta}`, { waitUntil: 'load' });
  await p.waitForSelector('[name=birth]');
  return { ctx, p, estado, errores };
}

const CAMPO = '[name=birth]';
const valor = (p) => p.inputValue(CAMPO);
const aviso = async (p) => {
  await p.waitForTimeout(30); // la comprobación va justo después del «input»
  return (await p.locator('#err-birth').count()) ? p.locator('#err-birth').textContent() : '';
};
async function escribe(p, cifras) {
  await p.fill(CAMPO, '');
  await p.click(CAMPO);
  await p.keyboard.type(cifras);
}
/** Elegir en el selector nativo: lo que hace el navegador al aceptar. */
const elige = (p, iso) => p.evaluate((v) => {
  const n = document.querySelector('.campo-fecha-nativo');
  n.value = v;
  n.dispatchEvent(new Event('change', { bubbles: true }));
}, iso);

async function pruebaRegistro(nav, motor) {
  console.log(`\n${motor} · Crea tu cuenta`);
  const { ctx, p, estado, errores } = await abre(nav, { ruta: 'registro' });
  const alto = async () => (await p.locator(CAMPO).boundingBox()).height;
  const altoVacio = await alto();

  // Accesibilidad: la etiqueta, el teclado y el botón con nombre.
  ok(await p.locator(`label:has(${CAMPO})`).first().textContent().then((s) => s.includes('Fecha de nacimiento')), 'el campo va dentro de su etiqueta');
  ok(await p.getAttribute(CAMPO, 'inputmode') === 'numeric', 'teclado numérico');
  ok(await p.getAttribute(CAMPO, 'autocomplete') === 'bday', 'autorrelleno de la fecha');
  ok(await p.getAttribute(CAMPO, 'placeholder') === 'DD/MM/AAAA', 'la pista dice el formato');
  ok(await p.getByRole('button', { name: 'Elige la fecha' }).count() === 1, 'botón del calendario con nombre');
  const nativo = p.locator('.campo-fecha-nativo');
  ok(await nativo.getAttribute('aria-hidden') === 'true' && await nativo.getAttribute('tabindex') === '-1', 'el selector nativo no se oye ni se tabula');
  ok(await nativo.getAttribute('name') === null, 'el selector nativo no va en el formulario');

  // Escribir, tecla a tecla.
  await escribe(p, '15');
  ok(await valor(p) === '15/', 'la barra sale sola tras el día', await valor(p));
  await p.keyboard.press('Backspace');
  ok(await valor(p) === '15', 'borrar quita la barra');
  await p.keyboard.press('Backspace');
  ok(await valor(p) === '1', 'y sigue borrando (no se atasca)');
  await escribe(p, '15031980');
  ok(await valor(p) === '15/03/1980', 'escribir: 15/03/1980', await valor(p));
  ok(await aviso(p) === '', 'válida: sin aviso');
  ok(await alto() === altoVacio, 'escrita, el campo mide lo mismo');
  await escribe(p, '5/3/1980');
  ok(await valor(p) === '05/03/1980', 'una barra a mano completa el día y el mes', await valor(p));

  // Inválidas.
  await escribe(p, '31022000');
  ok(await aviso(p) === MAL, 'el 31/02: «Revisa la fecha»', await aviso(p));
  ok(await p.getAttribute(CAMPO, 'aria-invalid') === 'true' && await p.getAttribute(CAMPO, 'aria-describedby') === 'err-birth', 'error asociado al campo');
  ok(await p.locator('#err-birth').getAttribute('role') === 'alert', 'y el lector de pantalla lo dice');
  await p.fill(CAMPO, '310120');
  ok(await aviso(p) === '', 'al corregir, el aviso se va');
  await escribe(p, texto(ahora.getFullYear() + 1, 3, 15).replace(/\//g, ''));
  ok(await aviso(p) === MAL, 'futura: «Revisa la fecha»', await aviso(p));
  await escribe(p, '01011800');
  ok(await aviso(p) === MAL, 'de hace dos siglos: «Revisa la fecha»', await aviso(p));
  await escribe(p, texto(ahora.getFullYear() - 10, 3, 15).replace(/\//g, ''));
  ok(await aviso(p) === JOVEN, 'menor de 14: el mensaje de siempre', await aviso(p));
  await escribe(p, texto(ahora.getFullYear() - 14, ahora.getMonth() + 1, ahora.getDate()).replace(/\//g, ''));
  ok(await aviso(p) === '', 'hoy cumple 14: vale', await aviso(p));
  await p.fill(CAMPO, '1503');
  await p.locator('[name=email]').click();
  ok(await aviso(p) === MAL, 'a medias, al salir del campo: «Revisa la fecha»', await aviso(p));

  // Pegar.
  for (const [pegado, queda] of [['15/03/1980', '15/03/1980'], ['15-3-1980', '15/03/1980'], ['5.3.1980', '05/03/1980'], ['15031980', '15/03/1980'], ['1980-03-15', '15/03/1980'], [' 15/03/1980 ', '15/03/1980']]) {
    await p.fill(CAMPO, pegado);
    ok(await valor(p) === queda, `pegar «${pegado}» → ${queda}`, await valor(p));
  }

  // Corregir por en medio: el cursor no se va al final.
  await p.fill(CAMPO, '15/03/1980');
  await p.click(CAMPO);
  await p.evaluate(() => document.querySelector('[name=birth]').setSelectionRange(2, 2));
  await p.keyboard.press('Backspace');
  await p.keyboard.type('6');
  ok(await valor(p) === '16/03/1980', 'cambiar una cifra del día', await valor(p));
  ok(await p.evaluate(() => document.querySelector('[name=birth]').selectionStart) === 2, 'con el cursor donde estaba');

  // El calendario: se abre y lo elegido queda escrito.
  // Primero el de verdad (o su respaldo, si el navegador no lo deja): que no rompa.
  await p.getByRole('button', { name: 'Elige la fecha' }).click();
  await p.keyboard.press('Escape');
  ok(errores.length === 0, 'abrir el calendario de verdad no da error', errores.join(' | '));
  await p.evaluate(() => {
    const n = document.querySelector('.campo-fecha-nativo');
    window.abierto = [];
    n.showPicker = () => window.abierto.push(n.value);
  });
  await p.fill(CAMPO, '15/03/1980');
  await p.getByRole('button', { name: 'Elige la fecha' }).click();
  ok((await p.evaluate(() => window.abierto.join())) === '1980-03-15', 'el calendario se abre en lo escrito');
  await p.fill(CAMPO, texto(ahora.getFullYear() + 1, 3, 15));
  await p.getByRole('button', { name: 'Elige la fecha' }).click();
  ok((await p.evaluate(() => window.abierto.at(-1))) === '', 'con una fecha imposible, se abre vacío');
  await elige(p, '1990-07-20');
  ok(await valor(p) === '20/07/1990', 'lo elegido se ve en el campo', await valor(p));
  ok(await aviso(p) === '', 'elegida y válida: sin aviso', await aviso(p));
  await elige(p, `${ahora.getFullYear() - 10}-03-15`);
  ok(await aviso(p) === JOVEN, 'elegir a un menor de 14 avisa igual');

  // Sin saltos.
  ok(await alto() === altoVacio, 'con aviso, el campo mide lo mismo');
  const anchos = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(anchos[0] <= anchos[1], 'sin scroll lateral', anchos.join());
  await p.screenshot({ path: `${OUT}/fecha-registro-${motor}.png`, fullPage: true });

  // Lo que se manda es AAAA-MM-DD, escrita o elegida.
  await p.fill('[name=name]', 'Prueba Fecha');
  await p.fill('[name=email]', 'fecha.prueba@example.com');
  await p.fill('[name=password]', 'Prueba-Fecha-2026');
  await p.fill(CAMPO, '15/03/1980');
  await p.check('[name=terms]');
  await p.click('#f button[type=submit]');
  await p.waitForTimeout(800);
  ok(estado.signup[0]?.data?.birth_date === '1980-03-15', 'al crear la cuenta va 1980-03-15', JSON.stringify(estado.signup[0]?.data));
  ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
  await ctx.close();
}

async function pruebaIdiomas(nav, motor) {
  console.log(`\n${motor} · idiomas`);
  {
    const { ctx, p } = await abre(nav, { ruta: 'registro?lang=en', lang: 'en' });
    ok(await p.getAttribute(CAMPO, 'placeholder') === 'DD/MM/YYYY', 'inglés: DD/MM/YYYY');
    ok(await p.getByRole('button', { name: 'Pick the date' }).count() === 1, 'inglés: «Pick the date»');
    await escribe(p, '03151980');
    ok(await aviso(p) === 'Check the date', 'inglés: en orden americano no cuela', await aviso(p));
    await escribe(p, '15031980');
    ok(await valor(p) === '15/03/1980', 'inglés: día primero');
    await ctx.close();
  }
  {
    const { ctx, p } = await abre(nav, { ruta: 'registro?lang=de', lang: 'de' });
    await p.waitForFunction(() => document.querySelector('[name=birth]')?.placeholder === 'TT.MM.JJJJ');
    await escribe(p, '15031980');
    ok(await valor(p) === '15.03.1980', 'alemán: con puntos', await valor(p));
    ok(await aviso(p) === '', 'alemán: válida');
    await ctx.close();
  }
}

async function pruebaUltimoPaso(nav, motor) {
  console.log(`\n${motor} · Un último paso (Google/Apple)`);
  const { ctx, p, estado, errores } = await abre(nav, { ruta: '', sesion: true, consents: { terms_accepted_at: null, has_birth_date: false } });
  ok(await p.getByRole('heading', { name: 'Un último paso' }).count() === 1, 'sale «Un último paso»');
  await p.check('[name=terms]');
  await p.click('#seguir');
  ok(await aviso(p) === 'Obligatorio', 'sin fecha: «Obligatorio»', await aviso(p));
  await escribe(p, '15031980');
  await p.click('#seguir');
  await p.waitForTimeout(500);
  const acepta = estado.rpc.find(([fn]) => fn === 'accept_terms');
  ok(acepta?.[1]?.p_birth_date === '1980-03-15', 'manda 1980-03-15', JSON.stringify(acepta));
  ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
  await ctx.close();
}

async function pruebaPerfil(nav, motor) {
  console.log(`\n${motor} · Editar perfil`);
  const { ctx, p, estado, errores } = await abre(nav, { ruta: 'perfil', sesion: true });
  await p.screenshot({ path: `${OUT}/fecha-perfil-${motor}.png`, fullPage: true });
  await p.fill(CAMPO, '1503');
  await p.click('#g-perfil');
  await p.waitForTimeout(300);
  ok(await aviso(p) === MAL, 'a medias no se guarda', await aviso(p));
  ok(!estado.rpc.some(([fn]) => fn === 'set_my_birth_date'), 'y no sale nada');
  await p.fill(CAMPO, '');
  await p.click('#g-perfil');
  await p.waitForTimeout(500);
  ok(!estado.rpc.some(([fn]) => fn === 'set_my_birth_date'), 'vacía se puede guardar el resto');
  await elige(p, '1980-03-15');
  await p.click('#g-perfil');
  await p.waitForTimeout(500);
  const pone = estado.rpc.find(([fn]) => fn === 'set_my_birth_date');
  ok(pone?.[1]?.p_birth_date === '1980-03-15', 'elegida con el calendario, manda 1980-03-15', JSON.stringify(pone));
  ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
  await ctx.close();
}

for (const [motor, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  try {
    await pruebaRegistro(nav, motor);
    await pruebaIdiomas(nav, motor);
    await pruebaUltimoPaso(nav, motor);
    await pruebaPerfil(nav, motor);
  } finally {
    await nav.close();
  }
}

console.log(fallos ? `\n${fallos} comprobación(es) mal` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
